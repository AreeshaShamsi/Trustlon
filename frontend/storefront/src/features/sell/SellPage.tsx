'use client';
import { useEffect, useId, useMemo, useState } from 'react';
import { CityField } from '@/components/location';
import { Alert, Button, cn, focusRing, ListSelect, MobileField, TextField } from '@/design-system';
import { useAuth } from '@/features/auth';
import { formatMoney } from '@/features/account/format';
import { CategoryNav } from '@/features/home/components/CategoryNav';
import { HomeFooter } from '@/features/home/components/HomeFooter';
import { HomeHeader } from '@/features/home/components/HomeHeader';
import { Icon } from '@/features/home/components/Icon';
import { MarketplaceDialogs } from '@/features/home/components/MarketplaceDialogs';
import { ApiError } from '@/lib/http';
import { useI18n } from '@/lib/i18n/language-provider';
import {
  GSTIN_SHAPE,
  isValidEmail,
  isValidName,
  suggestEmail,
  toMobileE164,
} from '@/lib/validation';
import { DEFAULT_COUNTRY, type CountryCode } from '@/lib/phone';
import { sellApi, type CommissionRates, type FeeBreakdown } from './api';

const VENDOR_PANEL_URL = process.env.NEXT_PUBLIC_VENDOR_PANEL_URL?.replace(/\/$/, '') || null;
const START_HREF = VENDOR_PANEL_URL ? `${VENDOR_PANEL_URL}/register` : '#start';

const percent = (value: number) => `${Number.isInteger(value) ? value : value.toFixed(1)}%`;

function StartSellingLink({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={START_HREF}
      className={cn(
        'inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-teal px-6 text-sm font-semibold text-navy shadow-sm hover:bg-teal/90',
        focusRing,
        className,
      )}
    >
      {children}
      <Icon name="arrow" className="h-4 w-4" />
    </a>
  );
}

/* Hero */

const ESCROW_STEPS = [
  ['Customer pays', 'Online or cash on delivery'],
  ['Trustlon holds the money', 'Safe in escrow while the order is on its way'],
  ['Order delivered', 'And the return window closes'],
  ['Paid to your bank', 'Fees and taxes shown upfront, nothing hidden'],
];

function HeroSection({ rates }: { rates: CommissionRates | null }) {
  const lowest = rates?.categories.length
    ? Math.min(...rates.categories.map((c) => c.commissionPercent))
    : null;
  return (
    <section className="relative overflow-hidden bg-navy text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60rem 40rem at 110% -10%, rgba(60,203,180,0.22), transparent 60%), radial-gradient(40rem 30rem at -20% 110%, rgba(60,203,180,0.12), transparent 60%)',
        }}
      />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center lg:px-8 lg:py-20">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium ring-1 ring-white/15">
            <Icon name="shield" className="h-3.5 w-3.5 text-teal" />
            Become a Trustlon seller
          </p>
          <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Sell to shoppers who buy with trust.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">
            Reach customers across India with your own Brand Store, escrow-protected payouts and
            GST-ready invoices on every order.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <StartSellingLink>Start selling</StartSellingLink>
            <a
              href="#fees"
              className={cn(
                'inline-flex h-12 items-center justify-center rounded-lg border border-white/30 px-6 text-sm font-semibold text-white hover:bg-white/10',
                focusRing,
              )}
            >
              Calculate your fees
            </a>
          </div>
          <dl className="mt-10 grid max-w-lg grid-cols-2 gap-6 border-t border-white/15 pt-6 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-white/60">Commission</dt>
              <dd className="mt-1 text-xl font-semibold">
                {lowest !== null ? `From ${percent(lowest)}` : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-white/60">Registration</dt>
              <dd className="mt-1 text-xl font-semibold">Online</dd>
            </div>
            <div>
              <dt className="text-xs text-white/60">Payments</dt>
              <dd className="mt-1 text-xl font-semibold">Escrow</dd>
            </div>
          </dl>
        </div>
        <div className="rounded-lg bg-white/5 p-6 ring-1 ring-white/15">
          <p className="text-sm font-semibold">How you get paid</p>
          <ol className="mt-5 space-y-5">
            {ESCROW_STEPS.map(([title, body], index) => (
              <li key={title} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal text-sm font-semibold text-navy">
                  {index + 1}
                </span>
                <div>
                  <p className="font-medium">{title}</p>
                  <p className="mt-0.5 text-sm text-white/60">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* Benefits */

function BenefitsGrid({ rates }: { rates: CommissionRates | null }) {
  const benefits = [
    {
      icon: 'bag' as const,
      title: 'Low commission',
      body: rates
        ? `Category rates from ${percent(Math.min(...rates.categories.map((c) => c.commissionPercent), rates.defaultCommissionPercent))}. You only pay when you sell.`
        : 'Clear category rates. You only pay when you sell.',
    },
    {
      icon: 'lock' as const,
      title: 'Escrow payouts',
      body: 'Customers pay Trustlon, not a stranger, so they buy with confidence. Your money is released once the order is delivered.',
    },
    {
      icon: 'star' as const,
      title: 'Your own Brand Store',
      body: 'A storefront page with your logo, banner and story, and a verified badge that builds trust.',
    },
    {
      icon: 'check' as const,
      title: 'GST tools built in',
      body: 'A GST invoice for every order, GSTIN checks, and TCS and TDS shown clearly so you can claim them.',
    },
  ];
  return (
    <section
      aria-labelledby="benefits-title"
      className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8"
    >
      <h2 id="benefits-title" className="text-2xl font-semibold text-navy sm:text-3xl">
        Why sell on Trustlon
      </h2>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {benefits.map((benefit) => (
          <li key={benefit.title} className="rounded-lg border border-slate-200 bg-white p-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
              <Icon name={benefit.icon} className="h-5 w-5" />
            </span>
            <h3 className="mt-4 font-semibold text-navy">{benefit.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{benefit.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* Fee calculator */

function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const toPaise = (rupees: string) => {
  const value = Number(rupees.replace(/[,\s₹]/g, ''));
  return Number.isFinite(value) ? Math.round(value * 100) : NaN;
};

function FeeCalculator({ rates, failed }: { rates: CommissionRates | null; failed: boolean }) {
  const ids = { price: useId(), category: useId(), gst: useId(), shipping: useId() };
  const { language } = useI18n();
  const [price, setPrice] = useState('999');
  const [categoryId, setCategoryId] = useState('');
  const [gstRate, setGstRate] = useState(18);
  const [shipping, setShipping] = useState('');
  const [result, setResult] = useState<FeeBreakdown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const input = useDebounced(
    useMemo(
      () => ({ price, categoryId, gstRate, shipping }),
      [price, categoryId, gstRate, shipping],
    ),
  );

  useEffect(() => {
    if (!rates) return;
    const pricePaise = toPaise(input.price);
    const shippingPaise = input.shipping ? toPaise(input.shipping) : 0;
    if (!Number.isFinite(pricePaise) || pricePaise < 100) {
      setResult(null);
      setError('Enter a selling price of at least ₹1');
      return;
    }
    if (!Number.isFinite(shippingPaise) || shippingPaise < 0) {
      setError('Enter a valid shipping cost');
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    sellApi
      .calculate(
        {
          pricePaise,
          categoryId: input.categoryId || undefined,
          gstRateBps: input.gstRate * 100,
          shippingPaise: shippingPaise || undefined,
        },
        controller.signal,
      )
      .then(setResult)
      .catch((caught) => {
        if (controller.signal.aborted) return;
        setResult(null);
        setError(
          caught instanceof ApiError && caught.message
            ? caught.message
            : 'We couldn’t calculate that. Try again.',
        );
      })
      .finally(() => !controller.signal.aborted && setLoading(false));
    return () => controller.abort();
  }, [input, rates]);

  const rows: Array<[string, number]> = result
    ? [
        [`Commission (${percent(result.commissionBps / 100)})`, result.commissionPaise],
        [
          `Payment collection (${percent(rates?.fees.paymentFeePercent ?? 0)})`,
          result.paymentFeePaise,
        ],
        [`GST on fees (${percent(rates?.fees.gstOnFeesPercent ?? 0)})`, result.gstOnFeesPaise],
        [`TCS under GST (${percent(rates?.fees.tcsPercent ?? 0)}, claimable)`, result.tcsPaise],
        [
          `TDS under income tax (${percent(rates?.fees.tdsPercent ?? 0)}, claimable)`,
          result.tdsPaise,
        ],
        ...(result.shippingPaise > 0
          ? ([['Shipping you pay', result.shippingPaise]] as Array<[string, number]>)
          : []),
      ]
    : [];

  return (
    <section id="fees" aria-labelledby="fees-title" className="scroll-mt-6 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 id="fees-title" className="text-2xl font-semibold text-navy sm:text-3xl">
          Fee calculator
        </h2>
        <p className="mt-2 max-w-2xl text-slate-600">
          See what you take home from a sale before you list anything.
        </p>
        {failed ? (
          <div className="mt-8">
            <Alert>We couldn’t load commission rates. Refresh the page to try again.</Alert>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <div className="space-y-5 rounded-lg border border-slate-200 bg-cream p-6">
              <TextField
                id={ids.price}
                label="Selling price (₹, including GST)"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
              <ListSelect
                label="Category"
                value={categoryId || 'OTHER'}
                disabled={!rates}
                onChange={(next) => setCategoryId(next === 'OTHER' ? '' : next)}
                searchPlaceholder="Search category"
                options={[
                  {
                    value: 'OTHER',
                    label: 'Other',
                    detail: `${percent(rates?.defaultCommissionPercent ?? 10)} commission`,
                  },
                  ...(rates?.categories ?? []).map((category) => ({
                    value: category.id,
                    label: (language === 'hi' && category.nameHi) || category.name,
                    detail: `${percent(category.commissionPercent)} commission`,
                    keywords: category.name,
                  })),
                ]}
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <ListSelect
                  label="Product GST rate"
                  value={String(gstRate)}
                  onChange={(next) => setGstRate(Number(next))}
                  options={(rates?.gstRates ?? [0, 5, 18, 40]).map((rate) => ({
                    value: String(rate),
                    label: `${rate}%`,
                  }))}
                />
                <TextField
                  id={ids.shipping}
                  label="Your shipping cost (₹)"
                  inputMode="decimal"
                  placeholder="0"
                  value={shipping}
                  onChange={(e) => setShipping(e.target.value)}
                />
              </div>
            </div>

            <div
              className="rounded-lg border border-slate-200 bg-white p-6"
              aria-live="polite"
              aria-busy={loading}
            >
              {error ? (
                <p role="alert" className="text-sm text-red-600">
                  {error}
                </p>
              ) : !result ? (
                <div className="space-y-3" aria-hidden>
                  {[0, 1, 2, 3].map((n) => (
                    <div key={n} className="h-6 animate-pulse rounded bg-slate-100" />
                  ))}
                </div>
              ) : (
                <div className={cn('transition-opacity', loading && 'opacity-60')}>
                  <div className="flex flex-wrap items-end justify-between gap-4 rounded-lg bg-navy p-5 text-white">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-white/70">You receive</p>
                      <p className="mt-1 text-3xl font-semibold">
                        {formatMoney(result.netPayoutPaise)}
                      </p>
                    </div>
                    <p className="text-sm text-white/70">
                      {percent(result.netPercent)} of {formatMoney(result.pricePaise)}
                    </p>
                  </div>
                  <dl className="mt-5 divide-y divide-slate-100 text-sm">
                    <div className="flex justify-between gap-4 py-2.5">
                      <dt className="text-slate-600">Selling price</dt>
                      <dd className="font-medium text-navy">{formatMoney(result.pricePaise)}</dd>
                    </div>
                    {rows.map(([label, amount]) => (
                      <div key={label} className="flex justify-between gap-4 py-2.5">
                        <dt className="text-slate-600">{label}</dt>
                        <dd className="whitespace-nowrap text-navy">− {formatMoney(amount)}</dd>
                      </div>
                    ))}
                    <div className="flex justify-between gap-4 py-2.5 font-semibold">
                      <dt className="text-navy">Net payout</dt>
                      <dd className="text-teal-600">{formatMoney(result.netPayoutPaise)}</dd>
                    </div>
                  </dl>
                  <p className="mt-4 text-xs leading-relaxed text-slate-500">
                    The price includes {formatMoney(result.gstCollectedPaise)} GST that you file and
                    pay. TCS and TDS are credited to your GST and income-tax accounts. This is an
                    estimate; your seller agreement has the final rates.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* Commission table */

function CommissionTable({ rates }: { rates: CommissionRates }) {
  const { language } = useI18n();
  if (rates.categories.length === 0) return null;
  return (
    <section aria-labelledby="rates-title" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <h2 id="rates-title" className="text-2xl font-semibold text-navy sm:text-3xl">
        Commission by category
      </h2>
      <p className="mt-2 text-slate-600">
        Categories not listed here use {percent(rates.defaultCommissionPercent)}.
      </p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {rates.categories.map((category) => (
          <li
            key={category.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3"
          >
            <span className="font-medium text-navy">
              {(language === 'hi' && category.nameHi) || category.name}
            </span>
            <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-sm font-semibold text-teal-600">
              {percent(category.commissionPercent)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* Steps */

const STEPS = [
  ['Register', 'Create your seller account with your mobile number and email.'],
  ['Complete KYC', 'Add your PAN, GSTIN, bank account and pickup address. We verify them for you.'],
  [
    'List products',
    'Add photos, prices and stock. Our team checks each listing before it goes live.',
  ],
  [
    'Start selling',
    'Orders arrive in your seller panel. Pack them, and our courier partners pick up.',
  ],
];

function StepsSection() {
  return (
    <section aria-labelledby="steps-title" className="bg-navy-50">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 id="steps-title" className="text-2xl font-semibold text-navy sm:text-3xl">
          Start in four steps
        </h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([title, body], index) => (
            <li key={title} className="relative rounded-lg border border-slate-200 bg-white p-6">
              <span className="text-sm font-semibold text-teal-600">Step {index + 1}</span>
              <h3 className="mt-2 font-semibold text-navy">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* Lead form */

interface LeadErrors {
  contactName?: string;
  businessName?: string;
  mobile?: string;
  email?: string;
  city?: string;
  gstin?: string;
}

function LeadForm({ rates }: { rates: CommissionRates | null }) {
  const { user } = useAuth();
  const { language } = useI18n();
  const [values, setValues] = useState({
    contactName: '',
    businessName: '',
    email: '',
    city: '',
    category: '',
    gstin: '',
  });
  const [national, setNational] = useState('');
  const [phoneCountry, setPhoneCountry] = useState<CountryCode>(DEFAULT_COUNTRY);
  const [errors, setErrors] = useState<LeadErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    setValues((current) => ({
      ...current,
      contactName: current.contactName || user.fullName,
      email: current.email || user.email,
    }));
  }, [user]);

  const set =
    (key: keyof typeof values) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setValues((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFailure(null);
    const mobile = toMobileE164(national, phoneCountry);
    const found: LeadErrors = {};
    if (!isValidName(values.contactName)) found.contactName = 'Enter your name using letters only';
    if (values.businessName.trim().length < 2) found.businessName = 'Enter your business name';
    if (!mobile) {
      found.mobile =
        phoneCountry === 'IN'
          ? 'Enter a valid 10-digit Indian mobile number'
          : 'Enter a valid mobile number for this country';
    }
    if (!isValidEmail(values.email))
      found.email = 'Enter a valid email address, e.g. name@example.com';
    if (values.city.trim().length < 2) found.city = 'Enter your city';
    if (values.gstin.trim() && !GSTIN_SHAPE.test(values.gstin.trim().toUpperCase())) {
      found.gstin = 'A GSTIN has 15 characters, e.g. 29ABCDE1234F1Z5';
    }
    setErrors(found);
    if (Object.keys(found).length > 0 || !mobile) return;
    setBusy(true);
    try {
      const result = await sellApi.createLead({
        contactName: values.contactName.trim(),
        businessName: values.businessName.trim(),
        mobile,
        email: values.email.trim().toLowerCase(),
        city: values.city.trim(),
        categoryId: values.category || undefined,
        gstin: values.gstin.trim().toUpperCase() || undefined,
      });
      setDone(result.message);
    } catch (caught) {
      if (caught instanceof ApiError && caught.field && caught.field in values) {
        setErrors({ [caught.field as keyof LeadErrors]: caught.message } as LeadErrors);
      } else if (caught instanceof ApiError && caught.status === 429) {
        setFailure('You’ve sent a few requests already. Our team will be in touch.');
      } else {
        setFailure(
          caught instanceof ApiError && caught.message
            ? caught.message
            : 'We couldn’t send your details. Try again.',
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      id="start"
      aria-labelledby="start-title"
      className="scroll-mt-6 mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8"
    >
      <div className="grid gap-8 rounded-lg border border-slate-200 bg-white p-6 sm:p-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div>
          <h2 id="start-title" className="text-2xl font-semibold text-navy sm:text-3xl">
            Ready to start?
          </h2>
          <p className="mt-3 text-slate-600">
            Share a few details and our seller team will call you to set up your account and Brand
            Store.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-slate-600">
            {[
              'Keep your PAN and GSTIN handy',
              'A bank account in your business name',
              'An address we can pick up orders from',
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <Icon name="check" className="h-5 w-5 shrink-0 text-teal-600" />
                {item}
              </li>
            ))}
          </ul>
          {VENDOR_PANEL_URL && (
            <p className="mt-6 text-sm text-slate-600">
              Prefer to do it yourself?{' '}
              <a href={START_HREF} className="font-semibold text-teal-600 hover:underline">
                Register in the seller panel
              </a>
            </p>
          )}
        </div>

        {done ? (
          <div className="flex flex-col items-start justify-center gap-4" role="status">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-600">
              <Icon name="check" className="h-6 w-6" />
            </span>
            <p className="text-lg font-semibold text-navy">Request received</p>
            <p className="text-slate-600">{done}</p>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="Your name"
              autoComplete="name"
              value={values.contactName}
              error={errors.contactName}
              onChange={set('contactName')}
            />
            <TextField
              label="Business name"
              autoComplete="organization"
              value={values.businessName}
              error={errors.businessName}
              onChange={set('businessName')}
            />
            <MobileField
              label="Mobile number"
              country={phoneCountry}
              onCountryChange={setPhoneCountry}
              locale={language}
              placeholder="10-digit mobile number"
              value={national}
              error={errors.mobile}
              onChange={(e) => setNational(e.target.value)}
            />
            <TextField
              label="Email"
              type="email"
              autoComplete="email"
              value={values.email}
              error={errors.email}
              hint={
                suggestEmail(values.email) ? (
                  <span>
                    Did you mean{' '}
                    <button
                      type="button"
                      className="font-semibold text-teal-600 underline underline-offset-2"
                      onClick={() =>
                        setValues((current) => ({
                          ...current,
                          email: suggestEmail(current.email) ?? current.email,
                        }))
                      }
                    >
                      {suggestEmail(values.email)}
                    </button>
                    ?
                  </span>
                ) : undefined
              }
              onChange={set('email')}
            />
            <CityField
              country="IN"
              value={values.city}
              error={errors.city}
              onChange={(city) => setValues((current) => ({ ...current, city }))}
            />
            <ListSelect
              label="What do you sell? (optional)"
              placeholder="Choose a category"
              value={values.category}
              onChange={(category) => setValues((current) => ({ ...current, category }))}
              searchPlaceholder="Search category"
              options={(rates?.categories ?? []).map((category) => ({
                value: category.id,
                label: (language === 'hi' && category.nameHi) || category.name,
                keywords: category.name,
              }))}
            />
            <div className="sm:col-span-2">
              <TextField
                label="GSTIN (optional)"
                autoCapitalize="characters"
                maxLength={15}
                value={values.gstin}
                error={errors.gstin}
                hint="Add it now to speed up KYC."
                onChange={set('gstin')}
              />
            </div>
            {failure && (
              <div className="sm:col-span-2">
                <Alert>{failure}</Alert>
              </div>
            )}
            <div className="sm:col-span-2">
              <p className="mb-4 text-xs text-slate-500">
                We use these details only to contact you about selling on Trustlon.
              </p>
              <div className="sm:w-56">
                <Button type="submit" loading={busy}>
                  Request a call
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

/* FAQ */

const FAQS: Array<[string, string]> = [
  [
    'Who can sell on Trustlon?',
    'Any business in India with a PAN and a bank account in its name: brands, manufacturers, wholesalers, retailers and neighbourhood shops.',
  ],
  [
    'Do I need a GSTIN?',
    'In most cases, yes. GST law generally requires businesses selling goods through an online marketplace to be registered. If you sell only within your state and are below the GST limit, our team will check whether you qualify for an exemption.',
  ],
  [
    'When do I get paid?',
    'Customer payments are held in escrow. They are released to your bank account after the order is delivered and its return window has closed, minus the fees shown in the calculator above.',
  ],
  [
    'What are TCS and TDS?',
    'Taxes that marketplaces must collect on every sale and deposit with the government in your name. They are not fees: you claim them back against your GST and income-tax liability.',
  ],
  [
    'Who delivers the orders?',
    'Our courier partners pick up from your address and deliver to the customer. You can track every shipment in your seller panel.',
  ],
  [
    'How do returns work?',
    'Each category has a return window that customers see before they buy. Returned items come back to you, and our team checks claims with photos before a refund is approved.',
  ],
];

function FaqSection() {
  return (
    <section aria-labelledby="faq-title" className="mx-auto max-w-3xl px-4 pb-16 sm:px-6 lg:px-8">
      <h2 id="faq-title" className="text-2xl font-semibold text-navy sm:text-3xl">
        Questions sellers ask
      </h2>
      <div className="mt-6 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {FAQS.map(([question, answer]) => (
          <details key={question} className="group px-5 py-4">
            <summary
              className={cn(
                'flex cursor-pointer list-none items-center justify-between gap-4 rounded font-medium text-navy [&::-webkit-details-marker]:hidden',
                focusRing,
              )}
            >
              {question}
              <Icon
                name="down"
                className="h-5 w-5 shrink-0 text-slate-500 transition group-open:rotate-180"
              />
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">{answer}</p>
          </details>
        ))}
      </div>
      <div className="mt-10 flex flex-col items-center gap-3 text-center">
        <p className="text-slate-600">Ready when you are.</p>
        <StartSellingLink className="bg-navy text-white hover:bg-navy-700">
          Start selling
        </StartSellingLink>
      </div>
    </section>
  );
}

/** /sell: Become a vendor (spec 3.12). Public, no sign-in needed. */
export function SellPage() {
  const [rates, setRates] = useState<CommissionRates | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    sellApi
      .commissionRates(controller.signal)
      .then(setRates)
      .catch(() => !controller.signal.aborted && setFailed(true));
    return () => controller.abort();
  }, []);

  return (
    <>
      <HomeHeader />
      <CategoryNav />
      <main className="bg-cream">
        <HeroSection rates={rates} />
        <BenefitsGrid rates={rates} />
        <FeeCalculator rates={rates} failed={failed} />
        {rates && <CommissionTable rates={rates} />}
        <StepsSection />
        <LeadForm rates={rates} />
        <FaqSection />
      </main>
      <HomeFooter />
      <MarketplaceDialogs />
    </>
  );
}
