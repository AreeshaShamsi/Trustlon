import { ProductCard } from '../home/components/ProductCard';
import type { StoreDetail } from '../home/types';
export function FeaturedCollections({ collections }: { collections: StoreDetail['collections'] }) {
  if (!collections.length) return <p className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500">No featured collections yet.</p>;
  return <div className="space-y-8">{collections.map((collection) => <section key={collection.id}><h2 className="text-xl font-semibold">{collection.title}</h2>{collection.description && <p className="mt-1 text-sm text-slate-500">{collection.description}</p>}<div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">{collection.products.map((product) => <ProductCard key={product.id} product={product} />)}</div></section>)}</div>;
}
