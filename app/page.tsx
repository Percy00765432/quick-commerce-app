'use client';

import { useState } from 'react';
import { ComparisonGrid } from '@/components/ComparisonGrid';
import { SearchBar } from '@/components/SearchBar';
import { PLATFORMS } from '@/lib/platforms';
import type { SearchResponse } from '@/types';

const HERO_POINTS = [
  'Live storefront scraping',
  'PIN-aware availability checks',
  'Matcher tuned for grocery pack sizes',
];

export default function HomePage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [apiError, setApiError] = useState('');

  async function handleSearch(query: string, pincode: string) {
    setLoading(true);
    setApiError('');
    setData(null);

    try {
      const res = await fetch(`/api/search?query=${encodeURIComponent(query)}&pincode=${pincode}`);
      const json = await res.json();

      if (!res.ok) {
        setApiError(json.error ?? 'Something went wrong. Please try again.');
        return;
      }

      setData(json as SearchResponse);
    } catch {
      setApiError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="ambient-orb ambient-orb-left" />
      <div className="ambient-orb ambient-orb-right" />

      <section className="relative px-4 pb-10 pt-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-full border border-white/55 bg-white/65 px-4 py-3 shadow-[0_16px_50px_rgba(15,23,42,0.08)] backdrop-blur md:px-6">
          <div>
            <p className="ui-font text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--color-accent-strong)]">
              QuickCompare
            </p>
            <p className="text-sm text-muted-foreground">
              Price intelligence for fast grocery runs
            </p>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <span className="rounded-full bg-[color:var(--color-panel)] px-3 py-1 text-xs font-medium text-foreground/80">
              Blinkit live
            </span>
            <span className="rounded-full bg-[color:var(--color-panel)] px-3 py-1 text-xs font-medium text-foreground/80">
              Zepto live
            </span>
            <span className="rounded-full bg-[color:var(--color-panel)] px-3 py-1 text-xs font-medium text-foreground/80">
              Instamart live
            </span>
          </div>
        </div>
      </section>

      <section className="relative px-4 pb-20 sm:px-6 lg:px-8">
        <div className="market-grid mx-auto grid max-w-6xl gap-10 overflow-hidden rounded-[2rem] border border-white/60 bg-white/62 p-6 shadow-[0_25px_90px_rgba(15,23,42,0.14)] backdrop-blur md:grid-cols-[1.2fr_0.8fr] md:p-10">
          <div className="space-y-8">
            <div className="space-y-5">
              <div className="inline-flex items-center rounded-full border border-[color:var(--color-accent-strong)]/15 bg-[color:var(--color-panel)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--color-accent-strong)]">
                Search once. Compare before checkout.
              </div>
              <div className="space-y-4">
                <h1 className="heading-font max-w-3xl text-5xl font-black leading-[0.95] tracking-[-0.05em] text-foreground sm:text-6xl">
                  Find the cheapest cart before the app opens.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-foreground/72 sm:text-lg">
                  QuickCompare checks live product listings across quick-commerce platforms,
                  normalizes pack sizes, and keeps the search anchored to your PIN code.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {Object.values(PLATFORMS).map((platform) => (
                <div
                  key={platform.id}
                  className="inline-flex items-center gap-3 rounded-full border border-black/6 bg-white/80 px-4 py-2 shadow-sm"
                >
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: platform.color }}
                  />
                  <span className="text-sm font-semibold text-foreground/82">
                    {platform.name}
                  </span>
                </div>
              ))}
            </div>

            <SearchBar onSearch={handleSearch} loading={loading} />

            {apiError && (
              <div className="rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-700 shadow-sm">
                {apiError}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-[1.75rem] border border-white/70 bg-[linear-gradient(160deg,rgba(255,255,255,0.95),rgba(247,237,224,0.82))] p-6 shadow-[0_20px_55px_rgba(15,23,42,0.08)]">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--color-accent-strong)]">
                Live readout
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-3 md:grid-cols-1 xl:grid-cols-3">
                <div className="rounded-2xl bg-[color:var(--color-panel)] px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Platforms
                  </p>
                  <p className="mt-2 text-3xl font-black">3</p>
                  <p className="mt-1 text-sm text-foreground/68">Blinkit, Zepto, Instamart</p>
                </div>
                <div className="rounded-2xl bg-[color:var(--color-panel)] px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Search mode
                  </p>
                  <p className="mt-2 text-3xl font-black">PIN</p>
                  <p className="mt-1 text-sm text-foreground/68">Location-aware results</p>
                </div>
                <div className="rounded-2xl bg-[color:var(--color-panel)] px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Matcher
                  </p>
                  <p className="mt-2 text-3xl font-black">Size</p>
                  <p className="mt-1 text-sm text-foreground/68">Handles unit normalization</p>
                </div>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-black/6 bg-[color:var(--color-surface-strong)] p-6 text-[color:var(--color-surface-foreground)] shadow-[0_24px_60px_rgba(15,23,42,0.14)]">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/65">
                Why it feels sharp
              </p>
              <div className="mt-4 space-y-3">
                {HERO_POINTS.map((point) => (
                  <div
                    key={point}
                    className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/6 px-4 py-3"
                  >
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[color:var(--color-accent-bright)]" />
                    <p className="text-sm leading-6 text-white/88">{point}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          {!data && !loading && (
            <div className="glass-panel result-appear rounded-[2rem] px-6 py-12 text-center shadow-[0_20px_70px_rgba(15,23,42,0.1)]">
              <div className="mx-auto flex max-w-xl flex-col items-center gap-4">
                <div className="rounded-full bg-[color:var(--color-panel)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--color-accent-strong)]">
                  Ready when you are
                </div>
                <p className="heading-font text-3xl font-black tracking-[-0.04em] text-foreground">
                  Search milk, atta, shampoo, or tomatoes.
                </p>
                <p className="max-w-lg text-sm leading-7 text-foreground/68 sm:text-base">
                  We will compare live listings, keep size mismatches apart, and surface the
                  fastest cheap option for your area.
                </p>
              </div>
            </div>
          )}

          <ComparisonGrid data={data} loading={loading} />
        </div>
      </section>
    </main>
  );
}
