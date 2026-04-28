import { NextRequest, NextResponse } from 'next/server';
import { scrapeBlinkit } from '@/scrapers/blinkit';
import { scrapeZepto } from '@/scrapers/zepto';
import { scrapeInstamart } from '@/scrapers/instamart';
import { matchProducts } from '@/lib/matcher';
import { cacheGet, cacheSet, cacheKey } from '@/lib/cache';
import type { SearchResponse, ScrapedProduct, Platform } from '@/types';

export const maxDuration = 60; // Vercel: allow up to 60s for scraping

function deriveSummaryError(
  errors: SearchResponse['errors'],
  scraperCount: number,
  pincode: string
): string | undefined {
  if (errors.length !== scraperCount) return undefined;

  const allLocationFailures = errors.every((error) =>
    /PIN code|delivery location|serviceable PIN code|delivery availability/i.test(error.message)
  );

  if (!allLocationFailures) return undefined;

  return `PIN code ${pincode} does not appear to be serviceable on any platform right now. Try a nearby PIN code.`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const query = searchParams.get('query')?.trim();
  const pincode = searchParams.get('pincode')?.trim();

  if (!query || !pincode) {
    return NextResponse.json({ error: 'query and pincode are required' }, { status: 400 });
  }

  if (!/^\d{6}$/.test(pincode)) {
    return NextResponse.json({ error: 'pincode must be a 6-digit number' }, { status: 400 });
  }

  const key = cacheKey('search', query, pincode);
  const cached = cacheGet<SearchResponse>(key);
  if (cached) {
    return NextResponse.json({ ...cached, fromCache: true });
  }

  const errors: SearchResponse['errors'] = [];
  const allResults: ScrapedProduct[] = [];

  const scrapers: Array<{ platform: Platform; fn: () => Promise<ScrapedProduct[]> }> = [
    { platform: 'blinkit', fn: () => scrapeBlinkit(query, pincode) },
    { platform: 'zepto', fn: () => scrapeZepto(query, pincode) },
    { platform: 'swiggy_instamart', fn: () => scrapeInstamart(query, pincode) },
  ];

  const settled = await Promise.allSettled(scrapers.map((s) => s.fn()));

  settled.forEach((result, idx) => {
    if (result.status === 'fulfilled') {
      allResults.push(...result.value);
    } else {
      errors.push({
        platform: scrapers[idx].platform,
        message: result.reason instanceof Error ? result.reason.message : 'Unknown error',
      });
    }
  });

  const products = matchProducts(allResults);
  const summaryError = deriveSummaryError(errors, scrapers.length, pincode);

  const response: SearchResponse = {
    query,
    pincode,
    products,
    errors,
    summaryError,
    cachedAt: new Date().toISOString(),
  };

  cacheSet(key, response);

  return NextResponse.json(response);
}
