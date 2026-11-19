'use client';
import { useState } from 'react';
import { checkoutApi } from '@/features/checkout/api';
type Razorpay = { open: () => void; on: (event: string, callback: () => void) => void };
declare global { interface Window { Razorpay?: new (options: Record<string, unknown>) => Razorpay } }
let script: Promise<void> | undefined;
const load = () => script ??= new Promise((resolve, reject) => { if (window.Razorpay) return resolve(); const node = document.createElement('script'); node.src = 'https://checkout.razorpay.com/v1/checkout.js'; node.onload = () => window.Razorpay ? resolve() : reject(new Error('Payment checkout could not load.')); node.onerror = () => reject(new Error('Payment checkout could not load.')); document.head.appendChild(node); });
export function RetryPaymentButton({ orderId }: { orderId: string }) {
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  async function retry() { setBusy(true); setMessage(''); try { await checkoutApi.retry(orderId); const gateway = await checkoutApi.gateway(orderId); if (gateway.mode === 'mock') { window.location.href = gateway.mockPaymentUrl ?? `/payments/mock/${orderId}`; return; } await load(); const razorpay = new window.Razorpay!({ key: gateway.keyId, order_id: gateway.orderId, amount: gateway.amount, currency: gateway.currency, name: 'Trustlon', retry: { enabled: false }, handler: async (response: Record<string, string>) => { const result = await checkoutApi.verify({ ...response, orderId } as never); if (result.confirmed) window.location.reload(); else setMessage(result.message ?? 'Payment is still confirming.'); } }); razorpay.open(); } catch (error) { setMessage(error instanceof Error ? error.message : 'This payment reservation is no longer active.'); } finally { setBusy(false); } }
  return <div><button type="button" disabled={busy} onClick={() => void retry()} className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-navy px-4 text-sm font-semibold text-white">{busy ? 'Preparing payment…' : 'Retry payment'}</button>{message && <p role="alert" className="mt-2 text-sm text-rose-700">{message}</p>}</div>;
}
