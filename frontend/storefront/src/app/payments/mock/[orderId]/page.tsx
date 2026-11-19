'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { accountApi } from '@/features/account/api';
import type { OrderDetail } from '@/features/account/types';
import { checkoutApi } from '@/features/checkout/api';
import { button, card, secondary } from '@/features/product/components/primitives';
import { money } from '@/features/product/helpers';

export default function MockPaymentPage() {
  const params = useParams<{ orderId: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail>();
  const [delay, setDelay] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { void accountApi.order(params.orderId).then(setOrder).catch(e => setError(e instanceof Error ? e.message : 'Could not load payment.')); }, [params.orderId]);
  async function act(action: 'success' | 'failure' | 'cancel') {
    setBusy(true); setError('');
    try {
      if (action === 'success') await checkoutApi.mockSucceed(params.orderId, delay);
      if (action === 'failure') await checkoutApi.mockFail(params.orderId);
      if (action === 'cancel') await checkoutApi.mockCancel(params.orderId);
      router.push(`/order/success/${encodeURIComponent(params.orderId)}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Payment action failed.'); setBusy(false); }
  }
  return <main className="mx-auto flex min-h-dvh max-w-lg items-center px-4 py-8 text-navy"><section className={`${card} w-full space-y-6`} aria-labelledby="mock-payment-title">
    <div className="rounded-lg bg-amber-100 p-3 text-center text-sm font-semibold text-amber-950">TEST MODE - no real money</div>
    <div><p className="text-sm text-slate-500">Trustlon marketplace</p><h1 id="mock-payment-title" className="text-2xl font-semibold">Complete payment</h1></div>
    {order ? <dl className="space-y-2 text-sm"><div className="flex justify-between"><dt>Order</dt><dd className="font-semibold">{order.orderNumber}</dd></div><div className="flex justify-between"><dt>Amount</dt><dd className="text-xl font-semibold">{money(order.breakup.totalPaise / 100)}</dd></div><div className="flex justify-between"><dt>Chosen method</dt><dd>{order.payment.preference ?? order.payment.method}</dd></div></dl> : <p role="status">Loading payment…</p>}
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={delay} onChange={e => setDelay(e.target.checked)} /> Delay webhook 5s</label>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <div className="space-y-3"><button className={`${button} w-full`} disabled={!order || busy} onClick={() => void act('success')}>Simulate success</button><button className={`${secondary} w-full`} disabled={!order || busy} onClick={() => void act('failure')}>Simulate failure</button><button className="w-full text-sm underline" disabled={!order || busy} onClick={() => void act('cancel')}>Cancel</button></div>
  </section></main>;
}
