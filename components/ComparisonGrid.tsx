import { Sparkles, Store, Tags } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ProductCard } from './ProductCard';
import type { SearchResponse } from '@/types';

interface ComparisonGridProps {
  data: SearchResponse | null;
  loading: boolean;
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-[1.75rem] border border-white/70 bg-white/72 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]"
        >
          <div className="flex gap-3">
            <Skeleton className="h-20 w-20 rounded-2xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4 rounded-full" />
              <Skeleton className="h-3 w-1/2 rounded-full" />
              <Skeleton className="h-6 w-1/3 rounded-full" />
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ComparisonGrid({ data, loading }: ComparisonGridProps) {
  if (loading) return <LoadingSkeleton />;
  if (!data) return null;

  const { products, errors, query, pincode } = data;
  const matchedAcrossStores = products.filter((product) => product.results.length > 1).length;
  const maxSavings = products.reduce((best, product) => {
    if (product.results.length < 2) return best;
    const prices = product.results.map((result) => result.price);
    return Math.max(best, Math.max(...prices) - Math.min(...prices));
  }, 0);
  const liveStores = new Set(
    products.flatMap((product) => product.results.map((result) => result.platform))
  );

  return (
    <div className="result-appear space-y-6">
      <div className="glass-panel rounded-[2rem] p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="ui-font text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--color-accent-strong)]">
              Comparison board
            </p>
            <h2 className="heading-font mt-2 text-2xl font-black tracking-[-0.04em] text-foreground sm:text-3xl">
              Results for &quot;{query}&quot;
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">PIN code: {pincode}</p>
          </div>
          <Badge
            variant="secondary"
            className="rounded-full bg-[color:var(--color-panel)] px-4 py-2 text-sm font-semibold text-foreground"
          >
            {products.length} product{products.length !== 1 ? 's' : ''} surfaced
          </Badge>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-[1.5rem] bg-white/76 px-4 py-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <Store className="h-3.5 w-3.5" />
              Stores matched
            </div>
            <p className="mt-2 text-3xl font-black">{liveStores.size}</p>
            <p className="mt-1 text-sm text-foreground/68">Platforms represented in these results</p>
          </div>
          <div className="rounded-[1.5rem] bg-white/76 px-4 py-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Cross-store matches
            </div>
            <p className="mt-2 text-3xl font-black">{matchedAcrossStores}</p>
            <p className="mt-1 text-sm text-foreground/68">Products seen on more than one platform</p>
          </div>
          <div className="rounded-[1.5rem] bg-white/76 px-4 py-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <Tags className="h-3.5 w-3.5" />
              Best spread
            </div>
            <p className="mt-2 text-3xl font-black">Rs. {maxSavings.toFixed(0)}</p>
            <p className="mt-1 text-sm text-foreground/68">Largest visible price gap in the grid</p>
          </div>
        </div>
      </div>

      {data.summaryError && (
        <div className="rounded-[1.5rem] border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-700 shadow-sm">
          {data.summaryError}
        </div>
      )}

      {errors.length > 0 && (
        <div className="glass-panel rounded-[1.75rem] p-4 shadow-[0_12px_36px_rgba(15,23,42,0.06)]">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Platform notes
          </p>
          <div className="flex flex-col gap-2">
            {errors.map((e) => (
              <Badge
                key={e.platform}
                variant="destructive"
                className="w-full justify-start whitespace-normal break-words rounded-2xl px-3 py-3 text-left"
              >
                {e.platform}: {e.message}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {products.length === 0 && errors.length === 0 && (
        <div className="glass-panel rounded-[1.75rem] px-6 py-12 text-center shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
          <p className="text-lg font-semibold">No results found.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Try a different product name or check your PIN code.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
