import { BadRequestException, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { VendorLeadStatus } from '@prisma/client';
import { checkGstin } from '../../common/utils/gstin';
import { PrismaService } from '../../prisma/prisma.service';
import { FeeCalculatorDto, VendorLeadDto } from './dto';
import {
  calculateFees,
  GST_ON_FEES_BPS,
  PAYMENT_FEE_BPS,
  PLATFORM_DEFAULT_COMMISSION_BPS,
  PRODUCT_GST_RATES_BPS,
  TCS_BPS,
  TDS_BPS,
} from './fees';

/** Emitted when a business asks to sell on Trustlon; the onboarding team is notified. */
export const VENDOR_LEAD_CREATED = 'sell.vendor-lead-created';

const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;
const percent = (bps: number) => bps / 100;

@Injectable()
export class SellService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /** Commission per main category, for the fee table and calculator. */
  async commissionRates() {
    const categories = await this.prisma.category.findMany({
      where: { parentId: null, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, slug: true, name: true, nameHi: true, commissionBps: true },
    });
    return {
      defaultCommissionPercent: percent(PLATFORM_DEFAULT_COMMISSION_BPS),
      fees: {
        paymentFeePercent: percent(PAYMENT_FEE_BPS),
        gstOnFeesPercent: percent(GST_ON_FEES_BPS),
        tcsPercent: percent(TCS_BPS),
        tdsPercent: percent(TDS_BPS),
      },
      gstRates: PRODUCT_GST_RATES_BPS.map(percent),
      categories: categories.map((category) => ({
        id: category.id,
        slug: category.slug,
        name: category.name,
        nameHi: category.nameHi,
        commissionPercent: percent(category.commissionBps ?? PLATFORM_DEFAULT_COMMISSION_BPS),
      })),
    };
  }

  async calculate(dto: FeeCalculatorDto) {
    let commissionBps = PLATFORM_DEFAULT_COMMISSION_BPS;
    let categoryName: string | null = null;
    if (dto.categoryId) {
      const category = await this.prisma.category.findFirst({
        where: { id: dto.categoryId, isActive: true },
        select: { name: true, commissionBps: true, parent: { select: { commissionBps: true } } },
      });
      if (!category) {
        throw new BadRequestException({
          statusCode: 400,
          message: 'Choose a category',
          field: 'categoryId',
        });
      }
      categoryName = category.name;
      commissionBps =
        category.commissionBps ?? category.parent?.commissionBps ?? PLATFORM_DEFAULT_COMMISSION_BPS;
    }
    return {
      categoryName,
      ...calculateFees({
        pricePaise: dto.pricePaise,
        commissionBps,
        gstRateBps: dto.gstRateBps ?? 1800,
        shippingPaise: dto.shippingPaise,
      }),
    };
  }

  async createLead(dto: VendorLeadDto, ip?: string) {
    if (dto.gstin) {
      const check = checkGstin(dto.gstin);
      if (!check.valid) {
        throw new BadRequestException({ statusCode: 400, message: check.reason, field: 'gstin' });
      }
    }
    if (dto.categoryId) {
      const exists = await this.prisma.category.count({ where: { id: dto.categoryId } });
      if (!exists) dto.categoryId = undefined;
    }
    const message =
      'Thanks! Our seller team will call you within 2 working days to help you get started.';

    // A second request from the same number within a day is treated as the same lead.
    const recent = await this.prisma.vendorLead.findFirst({
      where: {
        mobile: dto.mobile,
        status: VendorLeadStatus.NEW,
        createdAt: { gt: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
      },
      select: { id: true },
    });
    if (recent) return { message };

    const lead = await this.prisma.vendorLead.create({
      data: {
        contactName: dto.contactName,
        businessName: dto.businessName,
        mobile: dto.mobile,
        email: dto.email,
        city: dto.city,
        categoryId: dto.categoryId ?? null,
        gstin: dto.gstin ?? null,
        ip: ip?.slice(0, 45),
      },
    });
    this.events.emit(VENDOR_LEAD_CREATED, { leadId: lead.id });
    return { message };
  }
}
