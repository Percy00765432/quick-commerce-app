import { chromium } from 'playwright';
import * as fs from 'fs';

const QUERY = 'milk';
const PLACE_ID = 'ChIJLfyY2E4UrjsRVq4AjI7zgRY'; // Koramangala from previous step

async function apiCall(page: ReturnType<typeof chromium.prototype.launch extends Promise<infer B> ? (B extends { newContext: (...a: unknown[]) => Promise<infer C> } ? C extends { newPage: (...a: unknown[]) => Promise<infer P> } ? P : never : never) : never>, url: string, opts?: RequestInit) {
  return page.evaluate(
    async ({ url, opts }: { url: string; opts?: RequestInit }) => {
      const resp = await fetch(url, { credentials: 'include', ...opts });
      const text = await resp.text();
      return { status: resp.status, body: text };
    },
    { url, opts }
  );
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'en-IN',
  });

  const capturedApis: Record<string, unknown> = {};
  const page = await context.newPage();
  page.on('response', async (resp) => {
    const url = resp.url();
    if (url.includes('swiggy.com/api/instamart') && !url.includes('google-analytics')) {
      try {
        const body = await resp.json();
        const key = url.replace('https://www.swiggy.com/api/instamart/', '').split('?')[0];
        capturedApis[key] = body;
      } catch { /* skip */ }
    }
  });

  // Load homepage to get session cookies
  await page.goto('https://www.swiggy.com/instamart', { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForTimeout(2000);

  // Step 1: Get place details
  console.log('Step 1: Get place details for placeId...');
  const detailsResult = await page.evaluate(async (placeId) => {
    const resp = await fetch(`/api/instamart/maps/place-details?placeId=${placeId}`, {
      credentials: 'include',
    });
    return { status: resp.status, body: await resp.text() };
  }, PLACE_ID);
  console.log('Status:', detailsResult.status);
  console.log('Body:', detailsResult.body.slice(0, 1500));
  fs.writeFileSync('scripts/im7-place-details.json', detailsResult.body);

  let lat = 12.9352, lng = 77.6245; // Koramangala defaults
  try {
    const parsed = JSON.parse(detailsResult.body);
    const loc = parsed?.data?.geometry?.location ?? parsed?.data?.location;
    if (loc?.lat) { lat = loc.lat; lng = loc.lng; }
  } catch { /* use defaults */ }
  console.log(`Using lat=${lat}, lng=${lng}`);

  // Step 2: Try to set address via API
  console.log('\nStep 2: Set address via API...');
  const setAddrResult = await page.evaluate(async (body: object) => {
    const resp = await fetch('/api/instamart/address', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: resp.status, body: await resp.text() };
  }, { placeId: PLACE_ID, lat, lng, address: 'Koramangala, Bengaluru' });
  console.log('Set address status:', setAddrResult.status, setAddrResult.body.slice(0, 300));

  // Step 3: Try select-place
  console.log('\nStep 3: Try select-place API...');
  const selectPlaceResult = await page.evaluate(async (body: object) => {
    const resp = await fetch('/api/instamart/select-place', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: resp.status, body: await resp.text() };
  }, { placeId: PLACE_ID, latitude: lat, longitude: lng });
  console.log('Select-place status:', selectPlaceResult.status, selectPlaceResult.body.slice(0, 300));

  // Step 4: Try navigate to search after location set via cookies
  // The home page already made a call with storeId=1374258, let's check if that's the store for this area
  const homeData = capturedApis['home/v2'] as Record<string, unknown> | undefined;
  if (homeData) {
    console.log('\nHome API store info:');
    const storeInfo = JSON.stringify(homeData).match(/storeId[":]+(\d+)/g);
    console.log(storeInfo);
  }

  // Step 5: Try search with lat/lng in headers or query
  console.log('\nStep 5: Try search API variants...');
  const searchVariants = [
    `/api/instamart/search?query=${QUERY}`,
    `/api/instamart/search?query=${QUERY}&lat=${lat}&lng=${lng}`,
    `/api/instamart/search?query=${QUERY}&storeId=1374258`,
    `/api/instamart/search?query=${QUERY}&pageType=INSTAMART_SEARCH_PAGE&lat=${lat}&lng=${lng}`,
  ];

  for (const url of searchVariants) {
    const r = await page.evaluate(async (url) => {
      const resp = await fetch(url, { credentials: 'include' });
      return { status: resp.status, body: await resp.text() };
    }, url);
    console.log(`\n${url.split('?')[1].slice(0, 80)}`);
    console.log(`Status: ${r.status} | Body (first 300): ${r.body.slice(0, 300)}`);
    if (r.body.includes('product') || r.body.includes('item')) {
      console.log('>>> LOOKS LIKE PRODUCTS!');
      fs.writeFileSync('scripts/im7-search-success.json', r.body);
    }
  }

  // Step 6: Try clicking the location button UI flow + capture the search API after location set
  console.log('\nStep 6: Full UI location flow + search...');
  await page.locator('[data-testid="search-location"]').click().catch(() => null);
  await page.waitForTimeout(1000);
  const locInput = page.locator('input[placeholder*="area"], input[placeholder*="street"]').first();
  await locInput.waitFor({ state: 'visible', timeout: 4000 }).catch(() => null);
  await locInput.click();
  for (const char of 'Koramangala') await page.keyboard.type(char, { delay: 80 });
  await page.waitForTimeout(3000);

  // Check if suggestions dropdown appeared with specific selectors
  const suggestionDropdown = await page.evaluate(() => {
    // Look for any dropdown/list that appeared after typing
    const selectors = [
      '[data-testid="location-suggestions"]',
      '[data-testid="suggestion-item"]',
      '[class*="suggestion"]',
      '[class*="Suggestion"]',
      '[class*="dropdown"]',
      '[class*="autocomplete"]',
    ];
    const found: { sel: string; count: number; first: string }[] = [];
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) found.push({ sel, count: els.length, first: (els[0] as HTMLElement).innerText?.slice(0, 80) });
    }
    // Also look by content (has "Koramangala")
    const divs = Array.from(document.querySelectorAll('div, li')).filter((el) =>
      (el as HTMLElement).innerText?.includes('Koramangala') && el.children.length <= 5
    );
    return { found, koraElements: divs.map((el) => ({ class: el.className.slice(0, 80), text: (el as HTMLElement).innerText?.slice(0, 100) })).slice(0, 5) };
  });
  console.log('Suggestion dropdown elements:', JSON.stringify(suggestionDropdown, null, 2));

  fs.writeFileSync('scripts/im7-apis.json', JSON.stringify(capturedApis, null, 2));
  await context.close();
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
