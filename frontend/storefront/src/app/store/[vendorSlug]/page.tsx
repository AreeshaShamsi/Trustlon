import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { backendUrl } from '@/lib/api-url';
import { StorePage } from '@/features/store/StorePage';

async function storeMetadata(slug: string): Promise<Metadata> {
  try {
    const response = await fetch(backendUrl(`/stores/${encodeURIComponent(slug)}`), { next: { revalidate: 60 } });
    if (!response.ok) return { title: 'Store' };
    const store = (await response.json()) as { name: string; description: string | null; logo: string | null; image: string | null };
    return { title: store.name, description: store.description ?? `Shop ${store.name} on Trustlon.`, openGraph: { title: store.name, description: store.description ?? undefined, images: [store.image ?? store.logo ?? ''] } };
  } catch { return { title: 'Store' }; }
}

export async function generateMetadata({ params }: { params: Promise<{ vendorSlug: string }> }): Promise<Metadata> { return storeMetadata((await params).vendorSlug); }
export default async function Page({ params }: { params: Promise<{ vendorSlug: string }> }) {
  const vendorSlug = (await params).vendorSlug;
  try {
    const response = await fetch(backendUrl(`/stores/${encodeURIComponent(vendorSlug)}`), { next: { revalidate: 60 } });
    if (response.status === 404) notFound();
  } catch {
    // The client page retains its retryable error state when the API is unavailable.
  }
  return <StorePage slug={vendorSlug} />;
}
