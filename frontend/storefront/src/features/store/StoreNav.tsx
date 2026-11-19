'use client';
import Link from 'next/link';
import { cn, focusRing } from '@/design-system';

const tabs = [['home', 'Home'], ['products', 'All products'], ['categories', 'Categories'], ['about', 'About'], ['reviews', 'Reviews']] as const;

export function StoreNav({ slug, active = 'home' }: { slug: string; active?: string }) {
  const current = tabs.some(([key]) => key === active) ? active : 'home';
  return <nav aria-label="Store navigation" className="overflow-x-auto border-b border-slate-200"><div className="flex min-w-max gap-6">{tabs.map(([key, label]) => <Link key={key} href={`/store/${encodeURIComponent(slug)}${key === 'home' ? '' : `?section=${key}`}`} aria-current={current === key ? 'page' : undefined} className={cn('whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium', focusRing, current === key ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-navy')}>{label}</Link>)}</div></nav>;
}
