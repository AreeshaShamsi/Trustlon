import { createHmac } from 'node:crypto';
import { RESERVATION_CLEANUP_INTERVAL_MS, shippingTax, taxDataIssues } from './checkout.service';
import { NotificationQueueService } from '../notifications/notification-queue.service';
import { validSignature } from './payments.service';
import { guestExpired } from '../shopping/cart.service';
describe('Checkout rules', () => {
  it('splits inclusive GST using shipping state, with exact paise reconciliation', () => {
    expect(shippingTax(11800, 1800, 'Karnataka', 'Karnataka')).toEqual({ taxable: 10000, cgst: 900, sgst: 900, igst: 0, total: 1800 });
    expect(shippingTax(11800, 1800, 'Karnataka', 'Maharashtra')).toEqual({ taxable: 10000, cgst: 0, sgst: 0, igst: 1800, total: 1800 });
    const odd = shippingTax(11807, 1800, 'Delhi', 'Delhi');
    expect(odd.cgst + odd.sgst).toBe(odd.total);
  });
  it('reports missing tax data for one cart item without affecting other items', () => {
    const issues = [
      ...taxDataIssues('missing-item', 'Trustlon travel-ready combo', null, null, 'Uttar Pradesh'),
      ...taxDataIssues('valid-item', 'Ready item', '4202', 500, 'Uttar Pradesh'),
    ];
    expect(issues).toEqual([
      expect.objectContaining({ itemId: 'missing-item', code: 'MISSING_HSN' }),
      expect.objectContaining({ itemId: 'missing-item', code: 'MISSING_GST_RATE' }),
    ]);
    expect(issues.some(issue => issue.itemId === 'valid-item')).toBe(false);
  });
  it('accepts only the exact valid HMAC and rejects malformed signatures', () => {
    const body = 'order_test|pay_test', secret = 'test-secret';
    const signature = createHmac('sha256', secret).update(body).digest('hex');
    expect(validSignature(body, signature, secret)).toBe(true);
    expect(validSignature(body + 'x', signature, secret)).toBe(false);
    expect(validSignature(body, 'a', secret)).toBe(false);
    expect(validSignature(body, signature, '')).toBe(false);
  });
  it('expires a guest cart exactly at the 30-day boundary', () => {
    const created = Date.parse('2026-01-01T00:00:00Z');
    const cart = { expiresAt: new Date(created + 30 * 86400000) };
    expect(guestExpired(cart, new Date(cart.expiresAt.getTime() - 1))).toBe(false);
    expect(guestExpired(cart, cart.expiresAt)).toBe(true);
  });
  it('runs reservation cleanup on a one-minute cadence', () => expect(RESERVATION_CLEANUP_INTERVAL_MS).toBe(60_000));
  it('keeps notification channels idempotent and independently retryable', () => {
    const queue = new NotificationQueueService({ notificationJob: { upsert: () => Promise.resolve({}) } } as never);
    const sms = queue.enqueueOrderConfirmed('order-1', 'sms');
    expect(queue.enqueueOrderConfirmed('order-1', 'sms').queued).toBe(false);
    expect(queue.enqueueOrderConfirmed('order-1', 'email').queued).toBe(true);
    expect(queue.retry(sms.key, true)?.attempts).toBe(1);
    expect(queue.retry('order.confirmed:order-1:email', false)?.status).toBe('SENT');
  });
});
