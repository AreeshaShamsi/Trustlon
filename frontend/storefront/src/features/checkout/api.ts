import { apiFetch } from '@/lib/http';
import type { CheckoutInput, CheckoutQuote, CreateOrderInput, CreatedOrder, GatewayOrder, PaymentVerification } from './types';
export const checkoutApi = {
  validate: (body: CheckoutInput, signal?: AbortSignal) => apiFetch<CheckoutQuote>('/checkout/validate', { method: 'POST', auth: true, body, signal }),
  session: () => apiFetch<{ step: string; payload: Record<string, unknown> | null }>('/checkout/session', { auth: true }),
  saveSession: (body: { step: string; payload?: Record<string, unknown> }) => apiFetch<{ step: string }>('/checkout/session', { method: 'POST', auth: true, body }),
  create: (body: CreateOrderInput) => apiFetch<CreatedOrder>('/orders', { method: 'POST', auth: true, body, headers: { 'Idempotency-Key': body.checkoutKey } }),
  gateway: (orderId: string) => apiFetch<GatewayOrder>('/payments/razorpay/order', { method: 'POST', auth: true, body: { orderId } }),
  retry: (orderId: string) => apiFetch<CreatedOrder>('/payments/razorpay/retry', { method: 'POST', auth: true, body: { orderId } }),
  verify: (body: PaymentVerification) => apiFetch<{ confirmed: boolean; orderId: string; message?: string }>('/payments/razorpay/verify', { method: 'POST', auth: true, body }),
  mockSucceed: (orderId: string, delayWebhook = false) => apiFetch<{ status: string; orderId: string }>('/payments/mock/' + orderId + '/succeed', { method: 'POST', auth: true, body: { delayWebhook } }),
  mockFail: (orderId: string) => apiFetch<{ status: string; orderId: string }>('/payments/mock/' + orderId + '/fail', { method: 'POST', auth: true }),
  mockCancel: (orderId: string) => apiFetch<{ status: string; orderId: string }>('/payments/mock/' + orderId + '/cancel', { method: 'POST', auth: true }),
};
