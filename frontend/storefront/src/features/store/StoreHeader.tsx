'use client';
import { Button, cn, focusRing } from '@/design-system';
import { Stars } from '../account/components/uploads';
import { Icon } from '../home/components/Icon';
import { ProductImage } from '../home/components/ProductImage';
import type { StoreDetail } from '../home/types';
import { countLabel } from './countLabel';

export function StoreHeader({ store, following, busy, onFollow }: { store: StoreDetail; following: boolean; busy: boolean; onFollow: () => void }) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="relative h-48 bg-navy-50 sm:h-64">
        {store.image && <ProductImage src={store.image} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="relative px-5 pb-5 pt-12 sm:px-8">
        <div className="absolute -top-10 left-5 flex h-20 w-20 items-center justify-center rounded-lg border-4 border-white bg-navy-50 text-xl font-bold shadow-sm sm:left-8">
          {store.logo ? <ProductImage src={store.logo} alt={`${store.name} logo`} className="h-full w-full rounded object-cover" /> : store.initials}
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{store.name}</h1>
            <p className="text-sm text-slate-500">{store.tagline ?? 'Official brand store'}</p>
          </div>
          <Button variant={following ? 'secondary' : 'primary'} disabled={busy} onClick={onFollow} aria-pressed={following} className={cn(focusRing, 'w-full sm:w-auto sm:shrink-0')}>
            {busy ? 'Updating…' : following ? 'Following' : 'Follow'}
          </Button>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-slate-600">
          {store.isVerified && <span className="flex items-center gap-1 text-teal-600"><Icon name="shield" className="h-4 w-4" /> Verified</span>}
          <span>Trust Score {store.trustScore}/100</span>
          {store.ratingCount > 0 && <span className="flex items-center gap-2"><Stars value={store.rating ?? 0} /> <span>{store.rating?.toFixed(1)} ({store.ratingCount})</span></span>}
          <span>{countLabel(store.followerCount, 'follower')}</span>
          <span>{countLabel(store.productCount, 'product')}</span>
        </div>
      </div>
    </section>
  );
}
