import { apiFetch } from '@/lib/http';
import type { Page, Product, StoreDetail } from '../home/types';

export interface StoreProductsQuery {
  page?: number;
  pageSize?: number;
  category?: string;
  minPricePaise?: number;
  maxPricePaise?: number;
  minRating?: number;
  sort?: string;
}

function queryString(query: StoreProductsQuery) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  return params.size ? `?${params.toString()}` : '';
}

export const storeApi = {
  store: (slug: string, signal?: AbortSignal) =>
    apiFetch<StoreDetail>(`/stores/${encodeURIComponent(slug)}`, { signal }),
  products: (slug: string, query: StoreProductsQuery, signal?: AbortSignal) =>
    apiFetch<Page<Product>>(
      `/stores/${encodeURIComponent(slug)}/products${queryString(query)}`,
      { signal },
    ),
  follow: (slug: string) => apiFetch<{ following: true; followerCount: number }>(`/stores/${encodeURIComponent(slug)}/follow`, { method: 'POST', auth: true }),
  unfollow: (slug: string) => apiFetch<{ following: false; followerCount: number }>(`/stores/${encodeURIComponent(slug)}/follow`, { method: 'DELETE', auth: true }),
};
