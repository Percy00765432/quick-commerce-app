import { chromium, type Browser, type Page } from 'playwright';
import type { ScrapedProduct } from '@/types';

const BLINKIT_BASE = 'https://blinkit.com';
const SEARCH_URL = (q: string) => `${BLINKIT_BASE}/s/?q=${encodeURIComponent(q)}`;

const TIMEOUT = 25_000;
const MAX_RETRIES = 2;
const LOCATION_INPUT = 'input[placeholder="search delivery location"]';
const LOCATION_SUGGESTION = '[class*="LocationSearchList__LocationListContainer"]';

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

async function setBlinkitLocation(page: Page, pincode: string): Promise<void> {
  await page.goto(BLINKIT_BASE, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });

  const input = page.locator(LOCATION_INPUT);
  await input.waitFor({ state: 'visible', timeout: 12_000 });
  await input.fill(pincode);

  const suggestion = page.locator(LOCATION_SUGGESTION).filter({ hasText: pincode }).first();
  try {
    await suggestion.waitFor({ state: 'visible', timeout: 12_000 });
  } catch {
    throw new Error(
      `Blinkit could not find a delivery location for PIN code ${pincode}. Try a nearby serviceable PIN code.`
    );
  }

  await suggestion.click().catch(() => {
    throw new Error(
      `Blinkit found locations for PIN code ${pincode}, but we could not select one automatically. Try again or use a nearby PIN code.`
    );
  });

  try {
    await page.waitForFunction(
      (pin) => {
        const text = document.body.innerText || '';
        return text.includes(pin) && !text.includes('Please provide your delivery location');
      },
      pincode,
      { timeout: 15_000 }
    );
  } catch {
    throw new Error(
      `Blinkit did not confirm delivery availability for PIN code ${pincode}. Try again or use a nearby serviceable PIN code.`
    );
  }
}

async function scrapeProducts(page: Page, query: string): Promise<ScrapedProduct[]> {
  await page.goto(SEARCH_URL(query), { waitUntil: 'domcontentloaded', timeout: TIMEOUT });

  // Wait for product cards to appear (unique bg class on product cards)
  await page
    .locator('[class*="tw-bg-indigo-050"]')
    .first()
    .waitFor({ timeout: 12_000 })
    .catch(() => null);

  await sleep(1000);

  const products = await page.evaluate(() => {
    // Product cards have the indigo-050 background
    const cards = document.querySelectorAll('[class*="tw-bg-indigo-050"]');
    const results: Array<{
      name: string;
      price: number;
      originalPrice?: number;
      imageUrl?: string;
      unit?: string;
      available: boolean;
      deliveryTime?: string;
      productUrl?: string;
    }> = [];

    cards.forEach((card) => {
      try {
        // Name: the line-clamp-2 div contains the product name
        const nameEl = card.querySelector('[class*="tw-line-clamp-2"]') as HTMLElement;
        const name = nameEl?.innerText?.trim();
        if (!name) return;

        // Unit: the tw-text-base-green div (first text node before any buttons)
        const unitEl = card.querySelector('[class*="tw-text-base-green"]') as HTMLElement;
        // get only the first text node, not button children
        const unitText = unitEl
          ? Array.from(unitEl.childNodes)
              .filter((n) => n.nodeType === Node.TEXT_NODE)
              .map((n) => n.textContent?.trim())
              .join('')
              .trim()
          : undefined;

        // Delivery time: the uppercase div with "mins"
        const etaEl = card.querySelector('[class*="tw-uppercase"]') as HTMLElement;
        const deliveryTime = etaEl?.innerText?.trim() || '~12 mins';

        // Current price: tw-font-semibold div with black color (not green, which is the unit)
        // From DOM analysis: <div class="tw-text-200 tw-font-semibold" style="color: var(--colors-black-900);">₹29</div>
        const priceEl = Array.from(
          card.querySelectorAll<HTMLElement>('[class*="tw-font-semibold"]')
        ).find((el) => {
          const txt = el.innerText?.trim();
          const style = el.getAttribute('style') ?? '';
          return (
            txt.startsWith('₹') &&
            txt.length < 12 &&
            // must be black-colored (not the green unit text)
            (style.includes('black-900') || style.includes('black'))
          );
        });

        // Strikethrough / original price
        const strikeThroughEl = card.querySelector<HTMLElement>('[class*="tw-line-through"]');

        if (!priceEl) return;

        const price = parseFloat(priceEl.innerText.replace(/₹/g, '').trim());
        if (isNaN(price) || price < 2) return; // sanity check — skip ₹0/₹1 display glitches

        const origPriceRaw = strikeThroughEl?.innerText?.replace(/₹/g, '').trim();
        const originalPrice = origPriceRaw ? parseFloat(origPriceRaw) : undefined;

        // Image
        const img = card.querySelector('img') as HTMLImageElement;
        const imageUrl = img?.src || undefined;

        const linkEl = card.closest('a') ?? card.querySelector('a');
        const productUrl = linkEl instanceof HTMLAnchorElement ? linkEl.href : undefined;

        // Out of stock: look for a button-like element that says "notify" or similar
        const addBtn = card.querySelector('[class*="tw-bg-green"]');
        const available = addBtn !== null;

        results.push({
          name,
          price,
          originalPrice: originalPrice && originalPrice > price ? originalPrice : undefined,
          imageUrl,
          unit: unitText || undefined,
          available,
          deliveryTime,
          productUrl,
        });
      } catch {
        // skip malformed card
      }
    });

    return results;
  });

  return products.map((p) => ({
    platform: 'blinkit',
    name: p.name,
    price: p.price,
    originalPrice: p.originalPrice,
    imageUrl: p.imageUrl,
    unit: p.unit,
    available: p.available,
    deliveryFee: 0,
    deliveryTime: p.deliveryTime,
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

export async function scrapeBlinkit(query: string, pincode: string): Promise<ScrapedProduct[]> {
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

      // Block fonts, tracking, analytics to speed things up
      await page.route('**/*.{woff,woff2,ttf,otf}', (r) => r.abort().catch(() => null));
      await page.route('**/{analytics,tracking,telemetry,clarity}**', (r) => r.abort().catch(() => null));

      await setBlinkitLocation(page, pincode);
      const products = await scrapeProducts(page, query);
      return products.slice(0, 10);
    } finally {
      await context.close();
    }
  });
}
