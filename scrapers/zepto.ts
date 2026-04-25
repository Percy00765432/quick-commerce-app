import { chromium, type Browser, type Page } from 'playwright';
import type { ScrapedProduct } from '@/types';

const ZEPTO_BASE = 'https://www.zepto.com';
const SEARCH_URL = (q: string) => `${ZEPTO_BASE}/search?query=${encodeURIComponent(q)}`;

const TIMEOUT = 25_000;
const MAX_RETRIES = 2;
const LOCATION_MODAL = '[data-testid="address-modal"]';
const LOCATION_INPUT = 'input[placeholder="Search a new address"]';
const LOCATION_SUGGESTION = '[data-testid="address-search-item"]';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;
      if (attempt < retries) await sleep(1500 * (attempt + 1));
    }
  }
  throw lastError;
}

async function setZeptoLocation(page: Page, pincode: string): Promise<void> {
  await page.goto(ZEPTO_BASE, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });

  const selectLocationButton = page.getByRole('button', { name: /select location/i });
  try {
    await selectLocationButton.waitFor({ state: 'visible', timeout: 12_000 });
  } catch {
    throw new Error('Zepto location picker did not load. Please try again.');
  }
  await selectLocationButton.click();

  const input = page.locator(LOCATION_INPUT);
  try {
    await input.waitFor({ state: 'visible', timeout: 12_000 });
  } catch {
    throw new Error('Zepto address search did not open. Please try again.');
  }
  await input.fill(pincode);

  const suggestion = page.locator(LOCATION_SUGGESTION).filter({ hasText: pincode }).first();
  try {
    await suggestion.waitFor({ state: 'visible', timeout: 12_000 });
  } catch {
    throw new Error(
      `Zepto could not find a delivery location for PIN code ${pincode}. Try a nearby serviceable PIN code.`
    );
  }

  await suggestion.click().catch(() => {
    throw new Error(
      `Zepto found locations for PIN code ${pincode}, but we could not select one automatically. Try again or use a nearby PIN code.`
    );
  });

  try {
    await page.locator(LOCATION_MODAL).waitFor({ state: 'hidden', timeout: 15_000 });
  } catch {
    throw new Error(
      `Zepto did not confirm delivery availability for PIN code ${pincode}. Try again or use a nearby serviceable PIN code.`
    );
  }
}

async function scrapeProducts(page: Page, query: string): Promise<ScrapedProduct[]> {
  await page.goto(SEARCH_URL(query), { waitUntil: 'domcontentloaded', timeout: TIMEOUT });

  // Wait for product links to appear
  await page
    .locator('a.B4vNQ')
    .first()
    .waitFor({ timeout: 12_000 })
    .catch(() => null);

  await sleep(1500);

  const products = await page.evaluate(() => {
    // Each product is an anchor tag with class B4vNQ inside a pngqZ grid row
    const cards = document.querySelectorAll('a.B4vNQ');
    const results: Array<{
      name: string;
      price: number;
      originalPrice?: number;
      imageUrl?: string;
      unit?: string;
      available: boolean;
      productUrl?: string;
    }> = [];

    cards.forEach((card) => {
      try {
        const anchor = card as HTMLAnchorElement;

        // Availability: data-is-out-of-stock attribute on the inner card div
        const cardDiv = anchor.querySelector('[data-is-out-of-stock]') as HTMLElement;
        const outOfStock = cardDiv?.dataset?.isOutOfStock === 'true';

        // Product name: data-slot-id="ProductName" → span text
        const nameEl = anchor.querySelector('[data-slot-id="ProductName"] span') as HTMLElement;
        // Fallback: img alt attribute
        const imgEl = anchor.querySelector('img') as HTMLImageElement;
        const name = nameEl?.innerText?.trim() || imgEl?.alt?.trim();
        if (!name) return;

        // Price: data-slot-id="EdlpPrice" contains 1 or 2 spans
        // First span = current price, second span (if exists) = original/MRP price
        const priceContainer = anchor.querySelector('[data-slot-id="EdlpPrice"]');
        const priceSpans = priceContainer ? Array.from(priceContainer.querySelectorAll('span')) : [];
        const priceText = priceSpans[0]?.innerText?.replace(/₹/g, '').trim();
        const origPriceText = priceSpans[1]?.innerText?.replace(/₹/g, '').trim();

        const price = priceText ? parseFloat(priceText) : NaN;
        if (isNaN(price) || price <= 0) return;

        const originalPrice = origPriceText ? parseFloat(origPriceText) : undefined;

        // Unit/pack size: data-slot-id="PackSize" → span text
        const unitEl = anchor.querySelector('[data-slot-id="PackSize"] span') as HTMLElement;
        const unit = unitEl?.innerText?.trim();

        // Image URL
        const imageUrl = imgEl?.src || undefined;

        // Product URL
        const productUrl = anchor.href || undefined;

        results.push({
          name,
          price,
          originalPrice: originalPrice && !isNaN(originalPrice) && originalPrice > price ? originalPrice : undefined,
          imageUrl,
          unit: unit || undefined,
          available: !outOfStock,
          productUrl,
        });
      } catch {
        // skip malformed card
      }
    });

    return results;
  });

  return products.map((p) => ({
    platform: 'zepto',
    name: p.name,
    price: p.price,
    originalPrice: p.originalPrice,
    imageUrl: p.imageUrl,
    unit: p.unit,
    available: p.available,
    deliveryFee: 0,
    deliveryTime: '10 mins',
    productUrl: p.productUrl,
  }));
}

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.isConnected()) return browserInstance;
  browserInstance = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  return browserInstance;
}

export async function scrapeZepto(query: string, pincode: string): Promise<ScrapedProduct[]> {
  return withRetry(async () => {
    const browser = await getBrowser();
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      locale: 'en-IN',
    });

    try {
      const page = await context.newPage();
      page.setDefaultTimeout(TIMEOUT);

      await page.route('**/*.{woff,woff2,ttf,otf}', (r) => r.abort().catch(() => null));
      await page.route('**/{analytics,tracking,telemetry}**', (r) => r.abort().catch(() => null));

      await setZeptoLocation(page, pincode);
      const products = await scrapeProducts(page, query);
      return products.slice(0, 10);
    } finally {
      await context.close();
    }
  });
}
