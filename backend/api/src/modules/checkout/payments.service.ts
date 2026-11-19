import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CheckoutService } from './checkout.service';
import { VerifyPaymentDto } from './dto';
import { NotificationQueueService } from '../notifications/notification-queue.service';

export function validSignature(body: string | Buffer, signature: string, secret: string) {
  if (!secret || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(body).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}
type GatewayPayment = { id: string; order_id: string; amount: number; currency: string; status: string };
type GatewayRefund = { id: string; payment_id?: string; status?: string };
@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService, private readonly checkout: CheckoutService, private readonly config: ConfigService, private readonly notifications: NotificationQueueService) {}
  private secret(name: string) {
    const value = this.config.get<string>(name);
    if (!value) throw new ServiceUnavailableException('Payments are being configured. Please try again later.');
    return value;
  }
  private isMock() { return this.config.get<string>('PAYMENT_MODE', 'mock') === 'mock'; }
  private async gateway(path: string, body?: object) {
    const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
      method: body ? 'POST' : 'GET', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Basic ${Buffer.from(`${this.secret('RAZORPAY_KEY_ID')}:${this.secret('RAZORPAY_KEY_SECRET')}`).toString('base64')}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) throw new ServiceUnavailableException('The payment provider could not complete this request. Please try again.');
    return response.json();
  }
  async order(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, userId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.reservationState !== 'RESERVED' || !order.reservationExpiresAt || order.reservationExpiresAt <= new Date()) throw new ConflictException('This checkout has expired or is already complete.');
    if (this.isMock()) {
      const mockOrderId = order.razorpayOrderId ?? `mock_order_${randomUUID().replaceAll('-', '')}`;
      if (!order.razorpayOrderId) await this.prisma.order.update({ where: { id: order.id }, data: { razorpayOrderId: mockOrderId } });
      await this.prisma.payment.upsert({ where: { razorpayOrderId: mockOrderId }, create: { orderId, razorpayOrderId: mockOrderId, amountPaise: order.totalPaise, currency: 'INR', status: 'CREATED', provider: 'mock' }, update: { status: 'CREATED', provider: 'mock' } });
      return { mode: 'mock' as const, mockPaymentUrl: `/payments/mock/${orderId}`, amount: order.totalPaise, currency: 'INR' as const, orderNumber: order.orderNumber, paymentMethod: order.checkoutPaymentMethod };
    }
    const keyId = this.secret('RAZORPAY_KEY_ID');
    this.secret('RAZORPAY_KEY_SECRET');
    if (order.razorpayOrderId) {
      await this.prisma.payment.upsert({ where: { razorpayOrderId: order.razorpayOrderId }, create: { orderId, razorpayOrderId: order.razorpayOrderId, amountPaise: order.totalPaise, currency: 'INR', status: 'CREATED', provider: 'razorpay' }, update: {} });
      return { keyId, orderId: order.razorpayOrderId, amount: order.totalPaise, currency: 'INR' };
    }
    const claimed = await this.prisma.order.updateMany({ where: { id: orderId, gatewayCreating: false, razorpayOrderId: null, reservationState: 'RESERVED' }, data: { gatewayCreating: true } });
    if (!claimed.count) throw new ConflictException('Payment setup is processing. Please wait before retrying.');
    // Retain the claim after ambiguous network failures: never create a second chargeable gateway order.
    const remote = await this.gateway('orders', { amount: order.totalPaise, currency: 'INR', receipt: order.id, notes: { trustlonOrderId: order.id } }) as { id: string; amount: number; currency: string };
    if (typeof remote.id !== 'string' || remote.amount !== order.totalPaise || remote.currency !== 'INR') throw new ServiceUnavailableException('Unexpected payment provider response.');
    await this.prisma.order.update({ where: { id: orderId }, data: { razorpayOrderId: remote.id, gatewayCreating: false } });
    await this.prisma.payment.upsert({
      where: { razorpayOrderId: remote.id },
      create: { orderId, razorpayOrderId: remote.id, amountPaise: order.totalPaise, currency: 'INR', status: 'CREATED', provider: 'razorpay' },
      update: { amountPaise: order.totalPaise, status: 'CREATED' },
    });
    return { keyId, orderId: remote.id as string, amount: order.totalPaise, currency: 'INR' };
  }
  async retry(userId: string, orderId: string) { await this.checkout.retry(userId, orderId); return this.order(userId, orderId); }
  async mockAction(userId: string, orderId: string, action: 'succeed' | 'fail' | 'cancel', delayWebhook = false) {
    if (!this.isMock()) throw new NotFoundException('Mock payments are disabled');
    const order = await this.prisma.order.findFirst({ where: { id: orderId, userId } });
    if (!order) throw new NotFoundException('Order not found');
    if (action === 'cancel') return { status: 'PENDING_PAYMENT', orderId };
    if (!order.razorpayOrderId) throw new ConflictException('Payment has not been initialized.');
    const payment: GatewayPayment = { id: `mock_pay_${randomUUID().replaceAll('-', '')}`, order_id: order.razorpayOrderId, amount: order.totalPaise, currency: 'INR', status: action === 'succeed' ? 'captured' : 'failed' };
    if (action === 'fail') {
      await this.prisma.payment.updateMany({ where: { razorpayOrderId: order.razorpayOrderId }, data: { razorpayPaymentId: payment.id, status: 'FAILED', failureCode: 'MOCK_PAYMENT_FAILED' } });
      await this.checkout.release(order.id, 'FAILED');
      return { status: 'PAYMENT_FAILED', orderId };
    }
    const signature = createHmac('sha256', this.secret('MOCK_PAYMENT_SECRET')).update(`${payment.order_id}|${payment.id}`).digest('hex');
    if (!validSignature(`${payment.order_id}|${payment.id}`, signature, this.secret('MOCK_PAYMENT_SECRET'))) throw new BadRequestException('Mock payment signature is invalid.');
    if (delayWebhook) { setTimeout(() => void this.confirm(payment), 5000); return { status: 'PENDING_PAYMENT', orderId }; }
    return this.confirm(payment);
  }
  async verify(userId: string, dto: VerifyPaymentDto) {
    const order = await this.prisma.order.findFirst({ where: { id: dto.orderId, userId } });
    if (!order || order.razorpayOrderId !== dto.razorpay_order_id) throw new BadRequestException('Payment does not belong to this order.');
    if (!validSignature(`${order.razorpayOrderId}|${dto.razorpay_payment_id}`, dto.razorpay_signature, this.secret('RAZORPAY_KEY_SECRET'))) throw new BadRequestException('Payment signature is invalid.');
    const payment = await this.gateway(`payments/${encodeURIComponent(dto.razorpay_payment_id)}`) as GatewayPayment;
    if (payment.id !== dto.razorpay_payment_id || payment.status !== 'captured') throw new ConflictException('Your payment is processing. Confirmation will follow after capture.');
    return this.confirm(payment);
  }
  async confirm(payment: GatewayPayment) {
    return this.prisma.$transaction(async tx => {
      const found = await tx.order.findUnique({ where: { razorpayOrderId: payment.order_id } });
      if (!found) throw new BadRequestException('Unknown payment order.');
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${found.id}))`;
      const order = await tx.order.findUniqueOrThrow({ where: { id: found.id }, include: { subOrders: true } });
      if (payment.amount !== order.totalPaise || payment.currency !== 'INR' || payment.status !== 'captured') throw new BadRequestException('Payment amount or status does not match.');
      if (order.razorpayPaymentId && order.razorpayPaymentId !== payment.id) throw new ConflictException('A different payment is already linked to this order.');
      if (order.confirmedAt) return { confirmed: true, orderId: order.id };
      if (order.reservationState !== 'RESERVED' || !order.reservationExpiresAt || order.reservationExpiresAt <= new Date() || order.subOrders.some(s => s.status === 'CANCELLED')) {
        // A late payment is recorded for reconciliation, never used to resurrect released inventory.
        await tx.order.update({ where: { id: order.id }, data: { razorpayPaymentId: payment.id, escrowStatus: 'REFUND_REQUIRED' } });
        return { confirmed: false, orderId: order.id, message: 'Payment received after the reservation closed. Support will reconcile the payment.' };
      }
      const changed = await tx.order.updateMany({ where: { id: order.id, reservationState: 'RESERVED', confirmedAt: null }, data: {
        paymentStatus: 'PAID', razorpayPaymentId: payment.id, paymentReference: payment.id,
        reservationState: 'CONSUMED', confirmedAt: new Date(), escrowStatus: 'HELD',
      } });
      await tx.payment.updateMany({ where: { razorpayOrderId: payment.order_id }, data: { razorpayPaymentId: payment.id, status: 'CAPTURED' } });
      if (changed.count) {
        await tx.subOrder.updateMany({ where: { orderId: order.id, status: 'PLACED' }, data: { status: 'CONFIRMED' } });
        await tx.stockReservation.updateMany({ where: { orderId: order.id, status: 'ACTIVE' }, data: { status: 'CONSUMED', consumedAt: new Date() } });
        await tx.escrowLedger.create({ data: { orderId: order.id, entryType: 'escrow_hold', amountPaise: order.totalPaise } });
        for (const channel of ['sms', 'email', 'whatsapp'] as const) this.notifications.enqueueOrderConfirmed(order.id, channel);
      }
      // No seller credit, transfer, payable ledger or payout is created here.
      return { confirmed: true, orderId: order.id };
    });
  }
  async webhook(raw: Buffer | undefined, signature: string, eventId?: string) {
    if (!raw || !validSignature(raw, signature, this.secret('RAZORPAY_WEBHOOK_SECRET'))) throw new BadRequestException('Webhook signature is invalid.');
    let event: { event?: string; payload?: { payment?: { entity?: GatewayPayment } } };
    try { event = JSON.parse(raw.toString('utf8')); } catch { throw new BadRequestException('Invalid webhook body.'); }
    if (eventId) {
      const existing = await this.prisma.webhookEvent.findUnique({ where: { eventId } });
      if (existing) return { received: true, duplicate: true };
      await this.prisma.webhookEvent.create({ data: { eventId, event: event.event ?? 'unknown' } });
    }
    const payment = event.payload?.payment?.entity;
    if ((event.event ?? '').startsWith('refund.')) {
      const refund = (event as { payload?: { refund?: { entity?: GatewayRefund } } }).payload?.refund?.entity;
      if (refund?.payment_id) await this.prisma.payment.updateMany({ where: { razorpayPaymentId: refund.payment_id }, data: { status: event.event === 'refund.failed' ? 'REFUND_FAILED' : event.event === 'refund.processed' ? 'REFUNDED' : 'REFUND_PENDING' } });
      return { received: true };
    }
    if (!['payment.captured', 'order.paid', 'payment.failed'].includes(event.event ?? '')) return { received: true };
    if (!payment || !/^pay_[A-Za-z0-9]+$/.test(payment.id) || !/^order_[A-Za-z0-9]+$/.test(payment.order_id)) throw new BadRequestException('Invalid webhook payment.');
    if (event.event === 'payment.failed') {
      const order = await this.prisma.order.findUnique({ where: { razorpayOrderId: payment.order_id } });
      await this.prisma.payment.updateMany({ where: { razorpayOrderId: payment.order_id }, data: { razorpayPaymentId: payment.id, status: 'FAILED', failureCode: 'RAZORPAY_PAYMENT_FAILED' } });
      if (order && payment.amount === order.totalPaise && payment.currency === 'INR' && payment.status === 'failed') await this.checkout.release(order.id, 'FAILED');
    } else await this.confirm(payment);
    return { received: true };
  }
}
