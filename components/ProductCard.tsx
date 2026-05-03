import { Clock3, ExternalLink, Package, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { PLATFORMS } from '@/lib/platforms';
import type { ComparisonProduct, Platform, ScrapedProduct } from '@/types';

interface ProductCardProps {
  product: ComparisonProduct;
}

const PLATFORM_SEARCH_URLS: Record<Platform, (query: string) => string> = {
  blinkit: (query) => `https://blinkit.com/s/?q=${encodeURIComponent(query)}`,
  zepto: (query) => `https://www.zepto.com/search?query=${encodeURIComponent(query)}`,
  swiggy_instamart: (query) =>
    `https://www.swiggy.com/instamart/search?query=${encodeURIComponent(query)}`,
};

function PlatformRow({ result }: { result: ScrapedProduct }) {
  const platform = PLATFORMS[result.platform];
  const productUrl = result.productUrl ?? PLATFORM_SEARCH_URLS[result.platform](result.name);

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: platform.color }}
            />
            <span className="text-sm font-semibold text-foreground">{platform.name}</span>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            {!result.available && (
              <Badge variant="secondary" className="rounded-full text-[11px]">
                Out of stock
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-panel)] px-2.5 py-1">
              <Clock3 className="h-3 w-3" />
              {result.deliveryTime ?? '~10 min'}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-panel)] px-2.5 py-1">
              <Package className="h-3 w-3" />
              {result.deliveryFee === 0 ? 'Free delivery' : `Delivery Rs. ${result.deliveryFee}`}
            </span>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-lg font-black tracking-[-0.02em] text-foreground">
            Rs. {result.price}
          </p>
          {result.originalPrice && result.originalPrice > result.price && (
            <p className="text-xs text-muted-foreground line-through">
              Rs. {result.originalPrice}
            </p>
          )}
        </div>
      </div>
    </>
  );

  return (
    <a
      href={productUrl}
      target="_blank"
      rel="noopener noreferrer"
      title={`Open ${result.name} on ${platform.name}`}
      className="block rounded-[1.35rem] border border-black/6 bg-white/78 px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:border-black/10 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent-strong)] focus-visible:ring-offset-2"
    >
      {content}
    </a>
  );
}

export function ProductCard({ product }: ProductCardProps) {
  const sortedResults = product.results.slice().sort((a, b) => a.price - b.price);
  const savings =
    product.results.length > 1
      ? Math.max(...product.results.map((r) => r.price)) - product.bestPrice
      : 0;
  const productInitial = product.name.trim().charAt(0).toUpperCase() || 'Q';

  return (
    <Card className="lift-card overflow-hidden rounded-[1.9rem] border-white/70 bg-white/76 shadow-[0_18px_55px_rgba(15,23,42,0.1)]">
      <CardContent className="p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="rounded-full bg-[color:var(--color-panel)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-accent-strong)]">
            Best on {PLATFORMS[product.bestPlatform].name}
          </div>
          {savings > 0 && (
            <div className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
              <Sparkles className="h-3 w-3" />
              Save Rs. {savings.toFixed(0)}
            </div>
          )}
        </div>

        <div className="mb-5 flex gap-4">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt={product.name}
              className="h-20 w-20 shrink-0 rounded-[1.35rem] border border-black/6 bg-[color:var(--color-panel)] object-contain p-2"
              onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
            />
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[1.35rem] bg-[color:var(--color-panel)] text-2xl font-black text-[color:var(--color-accent-strong)]">
              {productInitial}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="heading-font line-clamp-2 text-lg font-black leading-tight tracking-[-0.04em] text-foreground">
              {product.name}
            </h3>
            {product.unit && (
              <p className="mt-1 text-sm text-muted-foreground">{product.unit}</p>
            )}
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <span className="text-3xl font-black tracking-[-0.04em] text-foreground">
                Rs. {product.bestPrice}
              </span>
              <span className="pb-1 text-sm text-muted-foreground">lowest visible price</span>
            </div>
            <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-foreground/54">
              {sortedResults.length} platform{sortedResults.length !== 1 ? 's' : ''} checked
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {sortedResults.map((r) => (
            <PlatformRow key={r.platform} result={r} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
