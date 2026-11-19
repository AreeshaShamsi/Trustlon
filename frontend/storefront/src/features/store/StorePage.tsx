'use client';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { HomeFooter } from '../home/components/HomeFooter';
import { HomeHeader } from '../home/components/HomeHeader';
import { SectionError, SectionSkeleton } from '../home/components/SectionStates';
import type { Product, StoreDetail } from '../home/types';
import { storeApi } from './api';
import { FeaturedCollections } from './FeaturedCollections';
import { ProductGrid } from './ProductGrid';
import { StoreBanners } from './StoreBanners';
import { StoreHeader } from './StoreHeader';
import { StoreNav } from './StoreNav';
import { StorePolicies } from './StorePolicies';

export function StorePage({ slug }: { slug: string }) {
  const search = useSearchParams(); const section = search.get('section') ?? 'home'; const { status } = useAuth();
  const [store, setStore] = useState<StoreDetail | null>(null); const [products, setProducts] = useState<Product[]>([]);
  const [storeState, setStoreState] = useState<'loading' | 'ready' | 'error'>('loading'); const [productsState, setProductsState] = useState<'loading' | 'ready' | 'error'>('loading'); const [pageInfo, setPageInfo] = useState({ totalPages: 1 }); const [following, setFollowing] = useState(false); const [followBusy, setFollowBusy] = useState(false); const [attempt, setAttempt] = useState(0);
  useEffect(() => { const controller = new AbortController(); setStoreState('loading'); storeApi.store(slug, controller.signal).then((value) => { setStore(value); setFollowing(value.isFollowing); setStoreState('ready'); }).catch(() => { if (!controller.signal.aborted) setStoreState('error'); }); return () => controller.abort(); }, [slug, attempt]);
  const loadProducts = useCallback(() => { const controller = new AbortController(); setProductsState('loading'); const query = { page: Number(search.get('page') ?? 1), pageSize: 24, category: search.get('category') ?? undefined, minPricePaise: search.get('minPricePaise') ? Number(search.get('minPricePaise')) : undefined, maxPricePaise: search.get('maxPricePaise') ? Number(search.get('maxPricePaise')) : undefined, minRating: search.get('minRating') ? Number(search.get('minRating')) : undefined, sort: search.get('sort') ?? 'relevance' }; storeApi.products(slug, query, controller.signal).then((value) => { setProducts(value.items); setPageInfo({ totalPages: value.totalPages }); setProductsState('ready'); }).catch(() => { if (!controller.signal.aborted) setProductsState('error'); }); return () => controller.abort(); }, [slug, search]);
  useEffect(() => loadProducts(), [loadProducts]);
  const follow = async () => { if (status !== 'authenticated' || !store || followBusy) return; const previous = following; setFollowing(!previous); setFollowBusy(true); try { const result = previous ? await storeApi.unfollow(slug) : await storeApi.follow(slug); setFollowing(result.following); setStore({ ...store, followerCount: result.followerCount }); } catch { setFollowing(previous); } finally { setFollowBusy(false); } };
  return <><HomeHeader /><main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">{storeState === 'loading' && <SectionSkeleton cards={2} title={false} gridClassName="grid-cols-1" />}{storeState === 'error' && <SectionError message="This store does not exist or is not currently available." onRetry={() => setAttempt((value) => value + 1)} />}{store && <><StoreHeader store={store} following={following} busy={followBusy} onFollow={follow} /><StoreNav slug={slug} active={section} />{status !== 'authenticated' && <p className="text-sm text-slate-500">Sign in to follow this store.</p>}{section === 'home' && <><StoreBanners banners={store.banners} /><FeaturedCollections collections={store.collections} /></>}{section === 'about' && <section className="rounded-lg border border-slate-200 bg-white p-6"><h2 className="text-xl font-semibold">About {store.name}</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{store.description ?? 'This seller has not added an introduction yet.'}</p></section>}{section === 'reviews' && <section className="rounded-lg border border-slate-200 bg-white p-6"><h2 className="text-xl font-semibold">Reviews</h2><p className="mt-3 text-sm text-slate-500">Customer reviews will appear here as this store receives orders.</p></section>}{(section === 'products' || section === 'categories' || section === 'home') && <ProductGrid products={products} loading={productsState === 'loading'} error={productsState === 'error'} totalPages={pageInfo.totalPages} onRetry={loadProducts} />}{section === 'about' && <StorePolicies policies={store.policies} />}</>}</main><HomeFooter /></>;
}
