'use client';
import { useEffect, useState } from 'react';
import { BrandLogo } from '@/components/BrandLogo';
import { Icon } from '@/features/home/components/Icon';
import { homeApi } from '@/features/home/api';
import { cartApi } from '@/features/cart/api';
import { useCheckout } from '@/features/checkout/hooks/use-checkout';
import { CheckoutStepper } from '@/features/checkout/components/CheckoutStepper';
import { AddressSelector, formatAddressLine } from '@/features/checkout/components/AddressSelector';
import { GstinField, GSTIN_PATTERN } from '@/features/checkout/components/GstinField';
import { DeliveryOptions } from '@/features/checkout/components/DeliveryOptions';
import { PaymentMethods, QuickPayButtons } from '@/features/checkout/components/PaymentMethods';
import { OrderSummary } from '@/features/checkout/components/OrderSummary';
import { PlaceOrderButton } from '@/features/checkout/components/PlaceOrderButton';
import { checkoutApi } from '@/features/checkout/api';
import { button, card, secondary } from '@/features/product/components/primitives';

const steps = ['ADDRESS', 'DELIVERY', 'PAYMENT', 'REVIEW'];

export default function CheckoutPage() {
  const { status, addresses, setAddresses, input, setInput, quote, loading, error, retry } = useCheckout();
  const [step, setStep] = useState(0);
  const [gstin, setGstin] = useState('');
  const [placed, setPlaced] = useState(false);
  const [quickPay, setQuickPay] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);

  useEffect(() => {
    const payment = new URLSearchParams(window.location.search).get('payment') as typeof input.paymentMethod;
    if (payment) setInput(old => ({ ...old, paymentMethod: payment }));
  }, [setInput]);
  useEffect(() => {
    if (status === 'authenticated') void checkoutApi.session().then(session => {
      const index = steps.indexOf(session.step);
      if (index >= 0) setStep(index);
    }).catch(() => undefined);
  }, [status]);
  useEffect(() => {
    if (status === 'authenticated') void checkoutApi.saveSession({ step: steps[step] }).catch(() => undefined);
  }, [status, step]);

  const valid = !loading && !!quote && (step === 0
    ? !!input.addressId && (!gstin || GSTIN_PATTERN.test(gstin))
    : step === 1
      ? quote.deliveryGroups.every(group => group.options.some(option => option.method === group.selected))
      : !!input.paymentMethod);
  const issue = quote?.issues?.[0];
  const applyCoupon = async (code: string | null) => { await cartApi.coupon(code); retry(); };
  const next = () => {
    if (!valid) return;
    if (step === 1 && quote) setInput(old => ({ ...old, deliveries: quote.deliveryGroups.map(group => ({ vendorId: group.vendorId, method: group.selected })) }));
    setStep(current => Math.min(3, current + 1));
  };
  const chooseQuick = (method: typeof input.paymentMethod) => {
    if (!method) return;
    setInput(old => ({ ...old, paymentMethod: method }));
    setQuickPay(true);
    setStep(3);
  };

  return <div className="min-h-dvh bg-slate-50 text-navy">
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6"><BrandLogo /><span className="flex items-center gap-2 text-sm font-semibold"><Icon name="lock" className="h-4 w-4 text-teal-700" />Secure checkout</span><a className="text-sm font-medium underline" href="/pages/contact">Need help?</a></div>
    </header>
    <div className="border-b border-slate-200 bg-white"><CheckoutStepper step={step} onStep={setStep} /></div>
    <main className="mx-auto max-w-7xl px-4 py-5 pb-24 sm:px-6 lg:py-8">
      {status === 'guest' ? <section className={`${card} mx-auto max-w-xl text-center`}><h1 className="text-2xl font-semibold">Sign in to continue</h1><p className="mt-2 text-slate-600">Use your saved address and place your order securely.</p><a className={`${button} mt-5`} href="/login?next=/checkout">Sign in</a></section> : <>
        <div className="mb-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 lg:hidden"><span className="text-sm font-semibold">Order summary</span><button type="button" className="text-sm underline" onClick={() => setSummaryOpen(value => !value)}>{summaryOpen ? 'Hide' : 'Show'} · {quote ? money(quote.summary.totalPayable / 100) : '—'}</button></div>
        {error && <div role="alert" className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><Icon name="shield" className="h-4 w-4" /><span className="mr-auto">{error}</span>{issue?.itemId && <button className={secondary} onClick={async () => { await homeApi.removeFromCart(issue.itemId!); retry(); }}>Remove this item</button>}<button className={secondary} onClick={retry}>Try again</button><a className={secondary} href="/cart">Return to cart</a></div>}
        {loading && <div role="status" className="mb-5 h-16 animate-pulse rounded-xl bg-slate-200" />}
        {summaryOpen && quote && <div className={`${card} mb-5 lg:hidden`}><OrderSummary quote={quote} /></div>}
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(300px,1fr)]">
          <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-7">
            {step === 0 && <div className="space-y-6"><div><h1 className="text-2xl font-semibold">Where should we deliver?</h1><p className="mt-1 text-sm text-slate-500">Choose a saved address or add a new one.</p></div><AddressSelector addresses={addresses} value={input.addressId} onSaved={setAddresses} onSelect={addressId => setInput(old => ({ ...old, addressId, deliveries: undefined, paymentMethod: undefined }))} />{quote?.isB2B && <div><p className="mb-2 font-semibold">Business purchase{quote.businessName ? ` · ${quote.businessName}` : ''}</p><GstinField value={gstin} onChange={value => { setGstin(value); if (!value || GSTIN_PATTERN.test(value)) setInput(old => ({ ...old, gstin: value || undefined })); }} /></div>}</div>}
            {step === 1 && <div className="space-y-5"><div><h1 className="text-2xl font-semibold">Choose delivery</h1><p className="mt-1 text-sm text-slate-500">Delivery options are shown separately for each seller.</p></div>{quote?.deliveryGroups.map(group => <DeliveryOptions key={group.vendorId} group={group} onChange={method => setInput(old => ({ ...old, deliveries: quote.deliveryGroups.map(item => ({ vendorId: item.vendorId, method: item.vendorId === group.vendorId ? method : item.selected })) }))} />)}</div>}
            {step === 2 && quote && <PaymentMethods available={quote.paymentMethods} value={input.paymentMethod} walletBalance={quote.walletBalance} useWallet={input.useWallet} onUseWallet={useWallet => setInput(old => ({ ...old, useWallet }))} onChange={paymentMethod => setInput(old => ({ ...old, paymentMethod }))} onQuickPay={chooseQuick} coupon={quote.cart.coupon} onApplyCoupon={applyCoupon} emiMinimumPaise={quote.summary.totalPayable} />}
            {step === 3 && quote && <ReviewStep quote={quote} addresses={addresses} addressId={input.addressId} paymentMethod={input.paymentMethod} quickPay={quickPay} onQuickPay={chooseQuick} onEdit={setStep} input={input} fingerprint={quote.fingerprint} disabled={loading || !!error} onPlaced={() => setPlaced(true)} />}
            {!placed && step < 3 && <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-5"><button type="button" className={secondary} disabled={step === 0} onClick={() => setStep(current => current - 1)}>Back</button><span className="text-xs text-amber-700">{!valid ? 'Fix the issue above to continue.' : ''}</span><button type="button" className={button} disabled={!valid} onClick={next}>Next</button></div>}
          </section>
          <aside className="hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-24 lg:block">{quote ? <OrderSummary quote={quote} /> : <SummarySkeleton />}</aside>
        </div>
      </>}
    </main>
    {quote && !placed && <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white p-3 shadow-lg lg:hidden"><div className="flex items-center justify-between gap-3"><strong>{money(quote.summary.totalPayable / 100)}</strong>{step < 3 ? <button type="button" className={`${button} min-w-36`} disabled={!valid} onClick={next}>Next</button> : <PlaceOrderButton input={input} fingerprint={quote.fingerprint} disabled={loading || !!error} onPlaced={() => setPlaced(true)} />}</div></div>}
  </div>;
}

function ReviewStep({ quote, addresses, addressId, paymentMethod, quickPay, onQuickPay, onEdit, input, fingerprint, disabled, onPlaced }: { quote: NonNullable<ReturnType<typeof useCheckout>['quote']>; addresses: ReturnType<typeof useCheckout>['addresses']; addressId?: string; paymentMethod?: typeof input.paymentMethod; quickPay: boolean; onQuickPay: (method: typeof input.paymentMethod) => void; onEdit: (step: number) => void; input: ReturnType<typeof useCheckout>['input']; fingerprint: string; disabled: boolean; onPlaced: () => void }) {
  const address = addresses.find(item => item.id === addressId);
  return <div className="space-y-6"><div><h1 className="text-2xl font-semibold">Review your order</h1><p className="mt-1 text-sm text-slate-500">Everything looks good? Place your secure order.</p></div><ReviewCard title="Delivery address" onEdit={() => onEdit(0)}>{address ? `${address.fullName}, ${formatAddressLine(address.line1, address.city, address.state, address.pincode, address.line2, address.landmark)}` : 'Choose an address'}</ReviewCard><ReviewCard title="Delivery options" onEdit={() => onEdit(1)}>{quote.deliveryGroups.map(group => `${group.vendorName}: ${group.selected}`).join(' · ')}</ReviewCard><ReviewCard title="Payment method" onEdit={() => onEdit(2)}>{paymentMethod ?? 'Not selected'}</ReviewCard>{paymentMethod === 'UPI' && <QuickPayButtons onSelect={onQuickPay} />}<OrderSummary quote={quote} /><label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-4 w-4 accent-teal-700" required />I agree to Terms, Refund and Return policy.</label><PlaceOrderButton input={input} fingerprint={fingerprint} disabled={disabled} autoStart={quickPay} onPlaced={onPlaced} /></div>;
}
function ReviewCard({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) { return <section className="rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between"><h2 className="font-semibold">{title}</h2><button type="button" className="text-sm font-semibold text-teal-700 underline" onClick={onEdit}>Edit</button></div><p className="mt-2 text-sm text-slate-600">{children}</p></section>; }
function SummarySkeleton() { return <div className="space-y-3"><div className="h-5 animate-pulse rounded bg-slate-200" /><div className="h-20 animate-pulse rounded bg-slate-100" /><div className="h-5 animate-pulse rounded bg-slate-200" /></div>; }
function money(value: number) { return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`; }
