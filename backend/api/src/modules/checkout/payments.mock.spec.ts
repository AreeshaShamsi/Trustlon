import { NotFoundException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { PaymentsService, validSignature } from './payments.service';

describe('mock payments', () => {
  const order = { id: 'order-1', userId: 'user-1', razorpayOrderId: 'mock_order_1', totalPaise: 1200 };
  function service(mode = 'mock') {
    const prisma = { order: { findFirst: jest.fn().mockResolvedValue(order) }, payment: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) } };
    const checkout = { release: jest.fn().mockResolvedValue(undefined) };
    const config = { get: jest.fn((key: string, fallback?: string) => key === 'PAYMENT_MODE' ? mode : fallback === undefined ? 'mock-secret-long-enough' : fallback) };
    const notifications = {};
    return { instance: new PaymentsService(prisma as never, checkout as never, config as never, notifications as never), prisma, checkout };
  }
  it('uses the common confirmation path for success', async () => {
    const { instance } = service();
    const confirm = jest.spyOn(instance, 'confirm').mockResolvedValue({ confirmed: true, orderId: order.id });
    await expect(instance.mockAction('user-1', order.id, 'succeed')).resolves.toEqual({ confirmed: true, orderId: order.id });
    expect(confirm).toHaveBeenCalledTimes(1);
  });
  it('releases the reservation on failure and leaves it pending on cancel', async () => {
    const failure = service();
    await expect(failure.instance.mockAction('user-1', order.id, 'fail')).resolves.toEqual({ status: 'PAYMENT_FAILED', orderId: order.id });
    expect(failure.checkout.release).toHaveBeenCalledWith(order.id, 'FAILED');
    const cancel = service();
    await expect(cancel.instance.mockAction('user-1', order.id, 'cancel')).resolves.toEqual({ status: 'PENDING_PAYMENT', orderId: order.id });
    expect(cancel.checkout.release).not.toHaveBeenCalled();
  });
  it('returns 404 when mock endpoints are used in Razorpay mode', async () => {
    const { instance } = service('razorpay');
    await expect(instance.mockAction('user-1', order.id, 'cancel')).rejects.toBeInstanceOf(NotFoundException);
  });
  it('uses the same HMAC signature format', () => {
    const signature = createHmac('sha256', 'mock-secret-long-enough').update('mock_order_1|mock_pay_1').digest('hex');
    expect(validSignature('mock_order_1|mock_pay_1', signature, 'mock-secret-long-enough')).toBe(true);
  });
});
