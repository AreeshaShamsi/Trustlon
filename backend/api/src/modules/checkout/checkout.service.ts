import { BadRequestException, ConflictException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import { PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { splitGst } from '../../common/utils/gst';
import { checkGstin } from '../../common/utils/gstin';
import { CartService, currentPrice } from '../shopping/cart.service';
import { CheckoutSessionDto, CreateOrderDto, ValidateCheckoutDto } from './dto';
import { CheckoutPayment, CheckoutQuote, TaxBreakup } from './types';
import { NotificationQueueService } from '../notifications/notification-queue.service';
import { Env } from '../../config/env';

export function shippingTax(total: number, rate: number, sellerState: string, shippingState: string): TaxBreakup {
  const { taxablePaise, gstPaise } = splitGst(total, rate);
  const same = sellerState.trim().toLowerCase() === shippingState.trim().toLowerCase();
  const cgst = same ? Math.floor(gstPaise / 2) : 0;
  return { taxable: taxablePaise, cgst, sgst: same ? gstPaise - cgst : 0, igst: same ? 0 : gstPaise, total: gstPaise };
}
export const RESERVATION_CLEANUP_INTERVAL_MS = 60_000;
const emptyTax = (): TaxBreakup => ({ taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 });
const addTax = (a: TaxBreakup, b: TaxBreakup) => { for (const key of Object.keys(a) as (keyof TaxBreakup)[]) a[key] += b[key]; };
export function taxDataIssues(itemId: string, productName: string, hsnCode: string | null, gstRateBps: number | null, vendorState: string | null) {
  const issues: Array<{ itemId: string; code: string; message: string }> = [];
  if (!hsnCode) issues.push({ itemId, code: 'MISSING_HSN', message: `Tax information is incomplete for ${productName}: HSN code is missing.` });
  if (gstRateBps === null) issues.push({ itemId, code: 'MISSING_GST_RATE', message: `Tax information is incomplete for ${productName}: GST rate is missing.` });
  if (!vendorState) issues.push({ itemId, code: 'MISSING_VENDOR_STATE', message: `Tax information is incomplete for ${productName}: vendor state is missing.` });
  return issues;
}

@Injectable()
export class CheckoutService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private cleaning = false;
  private readonly logger = new Logger(CheckoutService.name);
  constructor(private readonly prisma: PrismaService, private readonly carts: CartService, private readonly notifications: NotificationQueueService, private readonly config: ConfigService<Env, true>) {}
  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.cleanup().catch(() => this.logger.error('Reservation cleanup failed; will retry.')), RESERVATION_CLEANUP_INTERVAL_MS);
    this.timer.unref();
    void this.cleanup().catch(() => this.logger.error('Initial reservation cleanup failed; will retry.'));
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async quote(userId: string, dto: ValidateCheckoutDto, db: Prisma.TransactionClient = this.prisma) {
    const shopper = { kind: 'user' as const, userId };
    const record = await this.carts.record(shopper, db);
    const cart = await this.carts.calculate(record, shopper, db);
    if (!record || !cart.itemCount) throw new BadRequestException('Your cart is empty.');
    if (cart.hasUnavailableItems) throw new ConflictException('Some items are out of stock or exceed available quantity. Please update your cart.');
    if (cart.coupon && !cart.coupon.valid) throw new BadRequestException(cart.coupon.message);
    const address = dto.addressId ? await db.address.findFirst({ where: { id: dto.addressId, userId } }) : null;
    if (dto.addressId && !address) throw new BadRequestException('Choose one of your saved addresses.');
    const pin = address ? await db.pincode.findUnique({ where: { pincode: address.pincode } }) : null;
    if (address && (!pin?.serviceable || pin.state.toLowerCase() !== address.state.toLowerCase())) throw new BadRequestException('Check the shipping address and pincode serviceability.');
    const business = await db.businessProfile.findUnique({ where: { userId } });
    if (dto.gstin) {
      const gst = checkGstin(dto.gstin);
      if (!gst.valid) throw new BadRequestException(gst.reason ?? 'Enter a valid GSTIN.');
      if (business?.status !== 'VERIFIED') throw new BadRequestException('A verified business profile is required for a GST invoice.');
    }
    const wallet = await db.wallet.findUnique({ where: { userId } });
    const active = record.items.filter(i => !i.savedForLater);
    const tax = emptyTax();
    const issues: Array<{ itemId: string; code: string; message: string }> = [];
    const subTotals = new Map<string, { tax: TaxBreakup; coupon: number; items: number; delivery: number }>();
    let remainingDiscount = cart.summary.couponDiscount;
    // Allocate coupon paise deterministically; rounding remainder belongs to the last line.
    active.forEach((item, index) => {
      const p = item.product, gross = currentPrice(p) * item.quantity;
      const discount = index === active.length - 1 ? remainingDiscount : Math.floor(cart.summary.couponDiscount * gross / cart.subtotalPaise);
      remainingDiscount -= discount;
      const totals = subTotals.get(p.vendorId) ?? { tax: emptyTax(), coupon: 0, items: 0, delivery: 0 };
      totals.coupon += discount; totals.items += gross;
      if (address) {
        issues.push(...taxDataIssues(item.productId, p.name, p.hsnCode, p.gstRateBps, p.vendor.pickup?.state ?? null));
        if (p.gstRateBps !== null && p.vendor.pickup?.state) addTax(totals.tax, shippingTax(gross - discount, p.gstRateBps, p.vendor.pickup.state, address.state));
        if (issues.some(issue => issue.itemId === item.productId)) this.logger.warn(`Checkout tax data missing productId=${item.productId}`);
      }
      subTotals.set(p.vendorId, totals);
    });
    const isPrepaid = dto.paymentMethod !== undefined && dto.paymentMethod !== 'COD';
    const freeShippingThreshold = this.config.get('FREE_SHIPPING_THRESHOLD_PAISE', { infer: true });
    const deliveryGroups: CheckoutQuote['deliveryGroups'] = cart.groups.map(group => {
      const vendor = active.find(i => i.product.vendorId === group.vendorId)!.product.vendor;
      const options: CheckoutQuote['deliveryGroups'][number]['options'] = [];
      if (pin) {
        options.push({ method: 'standard', fee: vendor.standardDeliveryPaise, estimate: `${pin.deliveryDays} days` });
        if (vendor.expressDeliveryPaise !== null && vendor.pickup?.state === pin.state && pin.deliveryDays > 1) options.push({ method: 'express', fee: vendor.expressDeliveryPaise, estimate: `${Math.max(1, pin.deliveryDays - 1)} days` });
        if (vendor.sameDayDelivery && pin.sameDayAvailable && vendor.pickup?.city === pin.city && vendor.sameDayDeliveryPaise !== null && new Date().getHours() < this.config.get('SAME_DAY_CUTOFF_HOUR', { infer: true })) options.push({ method: 'same-day', fee: vendor.sameDayDeliveryPaise, estimate: 'Today' });
      }
      const selected = dto.deliveries?.find(d => d.vendorId === group.vendorId)?.method ?? 'standard';
      const choice = options.find(o => o.method === selected);
      if (address && !choice) throw new BadRequestException('The selected delivery option is unavailable at this pincode.');
      const totals = subTotals.get(group.vendorId)!;
      totals.delivery = isPrepaid && cart.subtotalPaise >= freeShippingThreshold ? 0 : choice?.fee ?? vendor.standardDeliveryPaise;
      if (address && totals.delivery) {
        if (vendor.deliveryGstRateBps === null || !vendor.pickup?.state) throw new BadRequestException('Delivery tax information is being updated. Please contact support.');
        addTax(totals.tax, shippingTax(totals.delivery, vendor.deliveryGstRateBps, vendor.pickup.state, address.state));
      }
      addTax(tax, totals.tax);
      return { vendorId: group.vendorId, vendorName: group.vendorName, selected, options };
    });
    if (dto.deliveries && (new Set(dto.deliveries.map(d => d.vendorId)).size !== dto.deliveries.length || dto.deliveries.some(d => !subTotals.has(d.vendorId)))) throw new BadRequestException('Choose delivery once per vendor.');
    const deliveryFee = [...subTotals.values()].reduce((s, v) => s + v.delivery, 0);
    const codFee = dto.paymentMethod === 'COD' ? this.config.get('COD_FEE_PAISE', { infer: true }) : 0;
    const prepaidDiscount = isPrepaid ? Math.floor(Math.max(0, cart.subtotalPaise - cart.summary.couponDiscount) * this.config.get('PREPAID_DISCOUNT_BPS', { infer: true }) / 10000) : 0;
    const beforeWallet = Math.max(0, cart.summary.totalPayable - cart.summary.deliveryFee + deliveryFee - prepaidDiscount + codFee);
    const walletAppliedPaise = (dto.useWallet || dto.paymentMethod === 'TRUSTLON_WALLET') ? Math.min(wallet?.balancePaise ?? 0, beforeWallet) : 0;
    const summary = { ...cart.summary, deliveryFee, prepaidDiscount, codFee, walletAppliedPaise, totalPayable: Math.max(0, beforeWallet - walletAppliedPaise) };
    const paymentMethods: CheckoutPayment[] = ['UPI', 'CARD', 'NETBANKING', 'WALLET'];
    if (summary.totalPayable >= this.config.get('EMI_MINIMUM_PAISE', { infer: true })) paymentMethods.push('EMI');
    if (pin?.codAvailable && active.every(i => i.product.codAllowed) && business?.status !== 'VERIFIED' && beforeWallet <= this.config.get('COD_LIMIT_PAISE', { infer: true })) paymentMethods.push('COD');
    if ((wallet?.balancePaise ?? 0) >= beforeWallet && beforeWallet > 0) paymentMethods.push('TRUSTLON_WALLET');
    if (dto.paymentMethod && !paymentMethods.includes(dto.paymentMethod)) throw new BadRequestException('Choose an eligible payment method.');
    const fingerprint = createHash('sha256').update(JSON.stringify({
      items: active.map(i => [i.productId, i.quantity, currentPrice(i.product), i.product.gstRateBps]),
      summary, tax, address, deliveries: deliveryGroups.map(g => [g.vendorId, g.selected]), payment: dto.paymentMethod, gstin: dto.gstin, useWallet: dto.useWallet,
    })).digest('hex');
    const result: CheckoutQuote = { cart, summary, tax, deliveryGroups, paymentMethods, walletBalance: wallet?.balancePaise ?? 0, isB2B: business?.status === 'VERIFIED', businessName: business?.businessName ?? null, fingerprint, shippingState: address?.state ?? null, ok: issues.length === 0, issues };
    return { result, record, active, address, subTotals };
  }
  async validate(userId: string, dto: ValidateCheckoutDto) { return (await this.quote(userId, dto)).result; }

  async session(userId: string, dto?: CheckoutSessionDto) {
    const cart = await this.prisma.cart.findUnique({ where: { userId }, select: { id: true } });
    if (!cart) return { step: 'ADDRESS', payload: null };
    const session = await this.prisma.checkoutSession.upsert({
      where: { userId_cartId: { userId, cartId: cart.id } },
      create: { userId, cartId: cart.id, step: dto?.step ?? 'ADDRESS', payload: dto?.payload as Prisma.InputJsonValue | undefined },
      update: dto ? { step: dto.step, payload: dto.payload as Prisma.InputJsonValue | undefined } : {},
    });
    return { step: session.step, payload: session.payload };
  }

  async create(userId: string, dto: CreateOrderDto) {
    for (let attempt = 0; ; attempt++) {
      try { return await this.reserve(userId, dto); }
      catch (error) {
        if (attempt < 2 && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') continue;
        throw error;
      }
    }
  }

  async retry(userId: string, orderId: string) {
    return this.prisma.$transaction(async tx => {
      const order = await tx.order.findFirst({ where: { id: orderId, userId }, include: { subOrders: { include: { items: true } } } });
      if (!order) throw new BadRequestException('Order not found.');
      if (order.reservationState === 'RESERVED') return this.created(order);
      if (order.paymentStatus !== PaymentStatus.FAILED) throw new ConflictException('This order is not available for payment retry.');
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${order.id}))`;
      for (const item of order.subOrders.flatMap(sub => sub.items)) if (item.productId) {
        const changed = await tx.product.updateMany({ where: { id: item.productId, stock: { gte: item.quantity }, status: 'LIVE', deletedAt: null }, data: { stock: { decrement: item.quantity } } });
        if (!changed.count) throw new ConflictException('Some items are no longer in stock. Please review your cart.');
      }
      const expiresAt = new Date(Date.now() + this.config.get('STOCK_RESERVATION_TTL_SECONDS', { infer: true }) * 1000);
      await tx.stockReservation.deleteMany({ where: { orderId: order.id } });
      await tx.stockReservation.createMany({ data: order.subOrders.flatMap(sub => sub.items).filter(item => item.productId).map(item => ({ orderId: order.id, productId: item.productId!, quantity: item.quantity, expiresAt })) });
      await tx.subOrder.updateMany({ where: { orderId: order.id }, data: { status: 'PLACED', cancelledAt: null, cancelledBy: null, cancelReason: null } });
      const updated = await tx.order.update({ where: { id: order.id }, data: { reservationState: 'RESERVED', reservationExpiresAt: expiresAt, paymentStatus: PaymentStatus.PENDING, paymentReference: null, razorpayOrderId: null, razorpayPaymentId: null, gatewayCreating: false, confirmedAt: null, escrowStatus: 'PENDING' } });
      return this.created(updated);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 });
  }
  private async reserve(userId: string, dto: CreateOrderDto) {
    if (!dto.addressId || !dto.paymentMethod) throw new BadRequestException('Choose an address and payment method.');
    return this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
      const existing = await tx.order.findUnique({ where: { checkoutKey: dto.checkoutKey } });
      if (existing) {
        if (existing.userId !== userId || existing.checkoutFingerprint !== dto.fingerprint) throw new ConflictException('Checkout request has changed. Please review it again.');
        return this.created(existing);
      }
      const cart = await tx.cart.findUnique({ where: { userId } });
      if (!cart) throw new BadRequestException('Your cart is empty.');
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${cart.id}))`;
      const { result, active, address, subTotals } = await this.quote(userId, dto, tx);
      if (result.issues?.length) throw new BadRequestException({ message: 'Fix the tax information before placing this order.', issues: result.issues });
      if (dto.fingerprint !== result.fingerprint) throw new ConflictException('Prices or delivery details changed. Review the updated order before placing it.');
      if (dto.deliveries?.length !== result.deliveryGroups.length) throw new BadRequestException('Choose delivery for every vendor.');
      if (dto.paymentMethod !== 'COD' && dto.paymentMethod !== 'TRUSTLON_WALLET' && result.summary.totalPayable < 100) throw new BadRequestException('Online payments require a total of at least ₹1.');
      for (const item of [...active].sort((a, b) => a.productId.localeCompare(b.productId))) {
        const changed = await tx.product.updateMany({ where: { id: item.productId, stock: { gte: item.quantity }, status: 'LIVE', deletedAt: null }, data: { stock: { decrement: item.quantity } } });
        if (changed.count !== 1) throw new ConflictException('An item just sold out. Please review your cart.');
      }
      const orderNumber = `TL${randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()}`;
      const method = dto.paymentMethod === 'EMI' ? PaymentMethod.CARD : dto.paymentMethod === 'TRUSTLON_WALLET' ? PaymentMethod.WALLET : dto.paymentMethod as PaymentMethod;
      const reservationExpiresAt = new Date(Date.now() + this.config.get('STOCK_RESERVATION_TTL_SECONDS', { infer: true }) * 1000);
      const order = await tx.order.create({ data: {
        userId, checkoutKey: dto.checkoutKey, checkoutFingerprint: dto.fingerprint, orderNumber,
        paymentMethod: method, checkoutPaymentMethod: dto.paymentMethod,
        reservationState: 'RESERVED', reservationExpiresAt, escrowStatus: 'PENDING',
        mrpTotalPaise: result.summary.itemsTotal, itemsTotalPaise: result.cart.subtotalPaise,
        couponCode: result.cart.coupon?.code, couponDiscountPaise: result.summary.couponDiscount,
        deliveryPaise: result.summary.deliveryFee, taxPaise: result.tax.total, totalPaise: result.summary.totalPayable,
        shippingAddress: JSON.parse(JSON.stringify(address)), gstin: dto.gstin, taxBreakup: { ...result.tax }, coinsUsed: result.cart.coins.used, walletUsedPaise: result.summary.walletAppliedPaise,
        reservations: { create: active.map(item => ({ productId: item.productId, quantity: item.quantity, expiresAt: reservationExpiresAt })) },
        subOrders: { create: result.cart.groups.map((g, index) => {
          const amounts = subTotals.get(g.vendorId)!;
          return { vendorId: g.vendorId, subOrderNumber: `${orderNumber}-${index + 1}`, itemsTotalPaise: amounts.items,
            couponDiscountPaise: amounts.coupon, deliveryPaise: amounts.delivery, taxPaise: amounts.tax.total, totalPaise: amounts.items - amounts.coupon + amounts.delivery,
            items: { create: active.filter(i => i.product.vendorId === g.vendorId).map(i => ({
              productId: i.productId, productSlug: i.product.slug, productName: i.product.name, brand: i.product.brand,
              imageUrl: i.product.imageUrl, hsnCode: i.product.hsnCode, gstRateBps: i.product.gstRateBps!, quantity: i.quantity, unitPricePaise: currentPrice(i.product), unitMrpPaise: i.product.mrpPaise,
              ...(() => { const lineTax = shippingTax(currentPrice(i.product) * i.quantity, i.product.gstRateBps!, i.product.vendor.pickup!.state, address!.state); return { taxablePaise: lineTax.taxable, cgstPaise: lineTax.cgst, sgstPaise: lineTax.sgst, igstPaise: lineTax.igst, taxPaise: lineTax.total }; })(),
            })) },
          };
        }) },
      } });
      if (order.couponCode) {
        // Count the use now; a released reservation gives it back.
        const used = await tx.coupon.updateMany({
          where: { code: order.couponCode, OR: [{ usageLimit: null }, { usedCount: { lt: tx.coupon.fields.usageLimit } }] },
          data: { usedCount: { increment: 1 } },
        });
        if (!used.count) throw new ConflictException('This coupon has just been fully used. Review your order.');
      }
      if (order.coinsUsed) {
        const changed = await tx.wallet.updateMany({ where: { userId, coins: { gte: order.coinsUsed } }, data: { coins: { decrement: order.coinsUsed } } });
        if (!changed.count) throw new ConflictException('Your coin balance changed. Review your order.');
        const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } });
        await tx.walletEntry.create({ data: { userId, type: 'DEBIT', source: 'ORDER_PAYMENT', coins: order.coinsUsed, amountPaise: 0, balanceAfterPaise: wallet.balancePaise, reference: order.id, description: 'Coins reserved for checkout' } });
      }
      if (result.summary.walletAppliedPaise) {
        const debited = await tx.wallet.updateMany({ where: { userId, balancePaise: { gte: result.summary.walletAppliedPaise } }, data: { balancePaise: { decrement: result.summary.walletAppliedPaise } } });
        if (!debited.count) throw new ConflictException('Your Trustlon Wallet balance changed. Review your order.');
        const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } });
        await tx.walletEntry.create({ data: { userId, type: 'DEBIT', source: 'ORDER_PAYMENT', amountPaise: result.summary.walletAppliedPaise, coins: 0, balanceAfterPaise: wallet.balancePaise, reference: order.id, description: 'Wallet amount reserved for checkout' } });
      }
      let finalOrder = order;
      if (dto.paymentMethod === 'COD' || dto.paymentMethod === 'TRUSTLON_WALLET') {
        finalOrder = await tx.order.update({ where: { id: order.id }, data: { paymentStatus: PaymentStatus.PAID, paymentReference: dto.paymentMethod === 'COD' ? 'COD' : 'TRUSTLON_WALLET', reservationState: 'CONSUMED', confirmedAt: new Date(), escrowStatus: 'HELD' } });
        await tx.subOrder.updateMany({ where: { orderId: order.id, status: 'PLACED' }, data: { status: 'CONFIRMED' } });
        await tx.stockReservation.updateMany({ where: { orderId: order.id, status: 'ACTIVE' }, data: { status: 'CONSUMED', consumedAt: new Date() } });
        await tx.escrowLedger.create({ data: { orderId: order.id, entryType: 'escrow_hold', amountPaise: order.totalPaise } });
        for (const channel of ['sms', 'email', 'whatsapp'] as const) this.notifications.enqueueOrderConfirmed(order.id, channel);
      }
      await tx.cartItem.deleteMany({ where: { cartId: cart.id, savedForLater: false } });
      await tx.cart.update({ where: { id: cart.id }, data: { couponCode: null, coinsEnabled: false } });
      return this.created(finalOrder);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 });
  }
  created(order: { id: string; orderNumber: string; totalPaise: number; reservationExpiresAt: Date | null; reservationState: string | null }) {
    return { id: order.id, orderNumber: order.orderNumber, totalPaise: order.totalPaise, reservationExpiresAt: order.reservationExpiresAt?.toISOString() ?? null, status: order.reservationState ?? 'PENDING' };
  }
  async release(orderId: string, reason: 'FAILED' | 'EXPIRED') {
    await this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${orderId}))`;
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { subOrders: { include: { items: true } } } });
      if (!order || order.reservationState !== 'RESERVED') return;
      if (reason === 'EXPIRED' && order.reservationExpiresAt && order.reservationExpiresAt > new Date()) return;
      const changed = await tx.order.updateMany({ where: { id: orderId, reservationState: 'RESERVED' }, data: { reservationState: reason, paymentStatus: 'FAILED', escrowStatus: order.escrowStatus === 'REFUND_REQUIRED' ? 'REFUND_REQUIRED' : 'RELEASED' } });
      if (!changed.count) return;
      await tx.stockReservation.updateMany({ where: { orderId, status: 'ACTIVE' }, data: { status: 'RELEASED' } });
      const cart = await tx.cart.upsert({ where: { userId: order.userId }, create: { userId: order.userId }, update: {} });
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${cart.id}))`;
      for (const sub of order.subOrders) {
        // A customer cancellation already returned its stock through OrdersService.
        if (sub.status === 'CANCELLED') continue;
        for (const item of sub.items) if (item.productId) {
          const restored = await tx.product.updateMany({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
          if (restored.count) await tx.cartItem.upsert({ where: { cartId_productId: { cartId: cart.id, productId: item.productId } },
            create: { cartId: cart.id, productId: item.productId, quantity: item.quantity, lastPricePaise: item.unitPricePaise }, update: {} });
        }
      }
      await tx.subOrder.updateMany({ where: { orderId, status: 'PLACED' }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledBy: 'SYSTEM', cancelReason: reason === 'EXPIRED' ? 'Payment window expired' : 'Payment failed' } });
      if (order.couponCode) {
        await tx.coupon.updateMany({ where: { code: order.couponCode, usedCount: { gt: 0 } }, data: { usedCount: { decrement: 1 } } });
      }
      if (order.coinsUsed || order.walletUsedPaise) {
        const wallet = await tx.wallet.update({ where: { userId: order.userId }, data: { coins: { increment: order.coinsUsed }, balancePaise: { increment: order.walletUsedPaise } } });
        await tx.walletEntry.create({ data: { userId: order.userId, type: 'CREDIT', source: 'REFUND', coins: order.coinsUsed, amountPaise: order.walletUsedPaise, balanceAfterPaise: wallet.balancePaise, reference: order.id, description: 'Checkout reservation released' } });
      }
    });
  }
  async cleanup() {
    if (this.cleaning) return;
    this.cleaning = true;
    try {
      const orders = await this.prisma.order.findMany({ where: { reservationState: 'RESERVED', reservationExpiresAt: { lte: new Date() } }, select: { id: true }, take: 100 });
      for (const order of orders) await this.release(order.id, 'EXPIRED');
      await this.prisma.cart.deleteMany({ where: { userId: null, expiresAt: { lte: new Date() } } });
    } finally { this.cleaning = false; }
  }
}
