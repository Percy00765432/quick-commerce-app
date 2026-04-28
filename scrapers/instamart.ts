import { chromium, type Browser, type Page } from 'playwright';
import type { ScrapedProduct } from '@/types';

const IM_BASE = 'https://www.swiggy.com/instamart';
const SEARCH_URL = (q: string) => `${IM_BASE}/search?query=${encodeURIComponent(q)}`;

const TIMEOUT = 25_000;
const MAX_RETRIES = 2;

// ─── Pincode → area (live reverse-geocode via India Post free API) ───────────

// Coarse city fallback — used when the API is unreachable
const PREFIX_FALLBACK: Record<string, string> = {
  '110': 'New Delhi',      '111': 'New Delhi',      '112': 'New Delhi',
  '400': 'Mumbai',         '401': 'Mumbai',
  '411': 'Pune',           '412': 'Pune',
  '380': 'Ahmedabad',      '382': 'Ahmedabad',
  '395': 'Surat',
  '302': 'Jaipur',         '303': 'Jaipur',
  '226': 'Lucknow',        '227': 'Lucknow',
  '500': 'Hyderabad',      '501': 'Hyderabad',
  '530': 'Visakhapatnam',
  '560': 'Bangalore',      '562': 'Bangalore',      '563': 'Bangalore',
  '600': 'Chennai',        '601': 'Chennai',
  '641': 'Coimbatore',
  '682': 'Kochi',          '683': 'Kochi',
  '700': 'Kolkata',        '711': 'Kolkata',
  '440': 'Nagpur',
  '452': 'Indore',         '453': 'Indore',
  '160': 'Chandigarh',
  '390': 'Vadodara',
};

// Simple in-process cache so repeated searches for the same pincode skip the API
const areaCache = new Map<string, string>();

interface PostalApiResponse {
  Status: string;
  PostOffice?: Array<{ Name: string; District: string; State: string }>;
}

async function pincodeToArea(pincode: string): Promise<string> {
  if (areaCache.has(pincode)) return areaCache.get(pincode)!;

  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, {
      signal: AbortSignal.timeout(6_000),
    });
    const data = (await res.json()) as PostalApiResponse[];

    if (data[0]?.Status === 'Success' && data[0].PostOffice?.length) {
      const { Name, District } = data[0].PostOffice[0];
      const area = Name.trim();
      const city = District.trim();
      // If the API returns just the city as both Name and District (e.g. "Bangalore, Bangalore"),
      // use only the city so Swiggy's Google-Places search works reliably.
      const result = area && area.toLowerCase() !== city.toLowerCase()
        ? `${area}, ${city}`
        : city;
      areaCache.set(pincode, result);
      return result;
    }
  } catch {
    // API unreachable — fall through to prefix map
  }

  const fallback = PREFIX_FALLBACK[pincode.slice(0, 3)] ?? 'Bangalore';
  areaCache.set(pincode, fallback);
  return fallback;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

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

// ─── Location setting ────────────────────────────────────────────────────────

// Try to click a location suggestion for `searchTerm`. Returns true on success.
async function tryClickSuggestion(page: Page, searchTerm: string): Promise<boolean> {
  // Clear the input and type fresh
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Backspace');
  await page.keyboard.type(searchTerm, { delay: 80 });
  await sleep(3500);

  const clicked = await page.evaluate((term) => {
    const allEls = Array.from(document.querySelectorAll('*'));
    const exactLeaf = allEls.find(
      (el) => el.children.length === 0 && (el as HTMLElement).innerText?.trim() === term
    );
    if (exactLeaf) { (exactLeaf as HTMLElement).click(); return true; }
    const prefixLeaf = allEls.find(
      (el) =>
        el.children.length === 0 &&
        (el as HTMLElement).innerText?.trim().startsWith(term) &&
        (el as HTMLElement).innerText.trim().length < 80
    );
    if (prefixLeaf) { (prefixLeaf as HTMLElement).click(); return true; }
    return false;
  }, searchTerm);

  return clicked;
}

async function setInstamartLocation(page: Page, area: string): Promise<void> {
  await page.goto(IM_BASE, { waitUntil: 'networkidle', timeout: TIMEOUT });
  await sleep(2000);

  // Open location picker
  const searchLocBtn = page.locator('[data-testid="search-location"]');
  await searchLocBtn.waitFor({ state: 'visible', timeout: 15_000 });
  await searchLocBtn.click();
  await sleep(1000);

  // Find and fill the location input
  const locInput = page.locator('input[placeholder]').first();
  await locInput.waitFor({ state: 'visible', timeout: 8_000 });
  await locInput.click();

  // Build search terms in order of specificity:
  // 1. Specific area (e.g. "Agara")
  // 2. City only (e.g. "Bangalore") — extracted from "Agara, Bangalore"
  const parts = area.split(',').map((s) => s.trim());
  const searchTerms = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : [parts[0]];

  for (const term of searchTerms) {
    const success = await tryClickSuggestion(page, term);
    if (success) {
      await sleep(3000); // wait for modal to dismiss
      return;
    }
  }

  throw new Error(
    `Swiggy Instamart: no location suggestion found for "${area}" (tried: ${searchTerms.join(', ')}). ` +
      `This pincode may not be serviceable — try a nearby one.`
  );

  // Wait for modal to close (location is confirmed)
  await sleep(3500);
}

// ─── Product scraping ────────────────────────────────────────────────────────

async function scrapeProducts(page: Page, query: string): Promise<ScrapedProduct[]> {
  await page.goto(SEARCH_URL(query), { waitUntil: 'domcontentloaded', timeout: TIMEOUT });

  // Wait for product cards to appear
  await page
    .locator('[data-testid="item-collection-card-full"]')
    .first()
    .waitFor({ timeout: 12_000 })
    .catch(() => null);

  await sleep(1500);

  const products = await page.evaluate(() => {
    /**
     * Full card structure (from DOM analysis):
     *
     * <div class="_3Rr1X">                             ← full card container
     *   <div data-testid="item-collection-card-full">  ← image + delivery + name
     *     <img class="_16I1D" alt="{name}" src="{img}">
     *     <div aria-label="Delivery in X MINS">…</div>
     *     <div class="…_1lbNR">{name}</div>
     *     <div class="…_3bM-V">{description}</div>
     *   </div>
     *   <div class="_3dcA8">                           ← price + unit (sibling)
     *     <div class="…_3wq_F">{unit}</div>
     *     <div class="…_2jn41">{price (number only)}</div>
     *     <div class="…_3eAjW">{original price or empty}</div>
     *   </div>
     * </div>
     */
    const containers = document.querySelectorAll('._3Rr1X');
    const results: Array<{
      name: string;
      price: number;
      originalPrice?: number;
      imageUrl?: string;
      unit?: string;
      available: boolean;
      deliveryTime?: string;
    }> = [];

    containers.forEach((card) => {
      try {
        const cardEl = card.querySelector('[data-testid="item-collection-card-full"]');
        if (!cardEl) return;

        // Skip ads
        if (card.querySelector('[data-testid="badge-wrapper"]')?.textContent?.trim() === 'Ad') return;

        // Name
        const nameEl = cardEl.querySelector('[class*="_1lbNR"]') as HTMLElement;
        const name = nameEl?.innerText?.trim();
        if (!name) return;

        // Image — use `alt` as name fallback too
        const imgEl = cardEl.querySelector('img._16I1D') as HTMLImageElement;
        const imageUrl = imgEl?.src || undefined;

        // Delivery time
        const etaEl = cardEl.querySelector('[aria-label^="Delivery in"]');
        const deliveryTime =
          etaEl?.getAttribute('aria-label')?.replace('Delivery in ', '').toLowerCase() ??
          '~10 mins';

        // Price container (sibling `._3dcA8`)
        const priceContainer = card.querySelector('._3dcA8');

        // Unit
        const unitEl = priceContainer?.querySelector('[class*="_3wq_F"]') as HTMLElement;
        const unit = unitEl?.innerText?.trim() || undefined;

        // Price (plain number — Swiggy omits the ₹ symbol in the DOM)
        const priceEl = priceContainer?.querySelector('[class*="_2jn41"]') as HTMLElement;
        const priceText = priceEl?.innerText?.trim();
        const price = priceText ? parseFloat(priceText) : NaN;
        if (isNaN(price) || price < 1) return;

        // Original price (present and non-empty only when discounted)
        const origEl = priceContainer?.querySelector('[class*="_3eAjW"]') as HTMLElement;
        const origText = origEl?.innerText?.trim();
        const originalPrice = origText ? parseFloat(origText) : undefined;

        // Out of stock: no add-button means OOS
        const hasAddBtn = cardEl.querySelector('[data-testid="buttonpair-add"]') !== null;

        results.push({
          name,
          price,
          originalPrice: originalPrice && !isNaN(originalPrice) && originalPrice > price ? originalPrice : undefined,
          imageUrl,
          unit,
          available: hasAddBtn,
          deliveryTime,
        });
      } catch {
        // skip malformed card
      }
    });

    return results;
  });

  return products.map((p) => ({
    platform: 'swiggy_instamart',
    name: p.name,
    price: p.price,
    originalPrice: p.originalPrice,
    imageUrl: p.imageUrl,
    unit: p.unit,
    available: p.available,
    deliveryFee: 0,
    deliveryTime: p.deliveryTime,
  }));
}

// ─── Browser singleton ───────────────────────────────────────────────────────

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.isConnected()) return browserInstance;
  browserInstance = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
    ],
  });
  return browserInstance;
}

// ─── Public export ───────────────────────────────────────────────────────────

export async function scrapeInstamart(query: string, pincode: string): Promise<ScrapedProduct[]> {
  const area = await pincodeToArea(pincode);

  return withRetry(async () => {
    const browser = await getBrowser();
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      locale: 'en-IN',
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    try {
      const page = await context.newPage();
      page.setDefaultTimeout(TIMEOUT);
      await page.route('**/*.{woff,woff2,ttf,otf}', (r) => r.abort().catch(() => null));
      await page.route('**/{analytics,clarity,newrelic}**', (r) => r.abort().catch(() => null));

      await setInstamartLocation(page, area);
      const products = await scrapeProducts(page, query);
      return products.slice(0, 10);
    } finally {
      await context.close();
    }
  });
}
