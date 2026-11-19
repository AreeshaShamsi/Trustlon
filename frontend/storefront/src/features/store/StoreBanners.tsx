import { ProductImage } from '../home/components/ProductImage';
import type { StoreDetail } from '../home/types';
export function StoreBanners({ banners }: { banners: StoreDetail['banners'] }) {
  if (!banners.length) return <p className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500">No promotions are running right now.</p>;
  return <div className="grid gap-4 md:grid-cols-2">{banners.map((banner) => <a key={banner.id} href={banner.href ?? '#'} className="group overflow-hidden rounded-lg border border-slate-200 bg-white"><ProductImage src={banner.image} alt={banner.title} className="h-44 w-full object-cover transition group-hover:scale-[1.02]" /><div className="p-4"><h2 className="font-semibold">{banner.title}</h2>{banner.subtitle && <p className="mt-1 text-sm text-slate-500">{banner.subtitle}</p>}</div></a>)}</div>;
}
