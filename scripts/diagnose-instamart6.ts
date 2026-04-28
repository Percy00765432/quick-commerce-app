/**
 * Full Swiggy Instamart API flow:
 * 1. /api/instamart/maps/suggestions?input=<area> → get placeId
 * 2. /api/instamart/maps/place-details?placeId=<id> → get lat/lng
 * 3. POST /api/instamart/set-store → get storeId  (or use header approach)
 * 4. /api/instamart/search?query=<q>&storeId=<id> → products
 *
 * All done via headless browser so cookies & WAF tokens are handled automatically.
 */
import { chromium } from 'playwright';
import * as fs from 'fs';

const AREA = 'Koramangala, Bangalore';
const QUERY = 'milk';

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'en-IN',
  });

  // Collect all API responses
  const apiResponses: Record<string, unknown> = {};
  const page = await context.newPage();
  page.on('response', async (resp) => {
    const url = resp.url();
    if (url.includes('swiggy.com/api/instamart')) {
      try {
        const text = await resp.text();
        const key = url.replace('https://www.swiggy.com/api/instamart/', '').split('?')[0];
        apiResponses[key] = JSON.parse(text);
        console.log(`\n✅ Captured: ${key} (${text.length} chars)`);
      } catch {
        // skip non-JSON
      }
    }
  });

  // Step 1: Load homepage (sets cookies/session)
  console.log('Step 1: Load homepage...');
  await page.goto('https://www.swiggy.com/instamart', { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForTimeout(2000);

  // Step 2: Trigger location suggestions API
  console.log('\nStep 2: Trigger suggestions API...');
  await page.locator('[data-testid="search-location"]').click().catch(() => null);
  await page.waitForTimeout(1000);
  const locInput = page.locator('input[placeholder*="area"], input[placeholder*="street"]').first();
  await locInput.waitFor({ state: 'visible', timeout: 5000 }).catch(() => null);
  await locInput.click();
  for (const char of 'Koramangala') {
    await page.keyboard.type(char, { delay: 60 });
  }
  await page.waitForTimeout(4000);

  // Also try calling the suggestions API directly via page.evaluate
  const suggestionsData = await page.evaluate(async () => {
    try {
      const resp = await fetch('/api/instamart/maps/suggestions?input=Koramangala', {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      return await resp.json();
    } catch (e) {
      return { error: String(e) };
    }
  });
  console.log('\nSuggestions API response:');
  console.log(JSON.stringify(suggestionsData, null, 2).slice(0, 1000));

  // Step 3: If we have a placeId, get details
  let placeId: string | null = null;
  if (suggestionsData?.data?.suggestions?.length > 0) {
    placeId = suggestionsData.data.suggestions[0]?.place_id ?? suggestionsData.data.suggestions[0]?.placeId;
    console.log('\nFirst suggestion placeId:', placeId);
    console.log('Suggestion:', JSON.stringify(suggestionsData.data.suggestions[0]));

    if (placeId) {
      const placeDetails = await page.evaluate(async (pid) => {
        try {
          const resp = await fetch(`/api/instamart/maps/place-details?placeId=${pid}`, {
            credentials: 'include',
          });
          return await resp.json();
        } catch (e) {
          return { error: String(e) };
        }
      }, placeId);
      console.log('\nPlace details:');
      console.log(JSON.stringify(placeDetails, null, 2).slice(0, 1000));

      // Step 4: Try to set location via Swiggy's set-location API
      const lat = placeDetails?.data?.geometry?.location?.lat ?? placeDetails?.data?.lat;
      const lng = placeDetails?.data?.geometry?.location?.lng ?? placeDetails?.data?.lng;
      console.log(`\nLat: ${lat}, Lng: ${lng}`);

      if (lat && lng) {
        const setLocResult = await page.evaluate(async ({ lat, lng, pid }: { lat: number; lng: number; pid: string }) => {
          try {
            const resp = await fetch('/api/instamart/maps/select-place', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ placeId: pid, latitude: lat, longitude: lng }),
            });
            return await resp.json();
          } catch (e) {
            return { error: String(e) };
          }
        }, { lat, lng, pid: placeId });
        console.log('\nSet location result:');
        console.log(JSON.stringify(setLocResult, null, 2).slice(0, 1000));
      }
    }
  }

  // Step 5: Try search API directly
  console.log('\nStep 5: Trying search API...');
  const searchResult = await page.evaluate(async (query) => {
    const urls = [
      `/api/instamart/search?query=${encodeURIComponent(query)}`,
      `/api/instamart/search?query=${encodeURIComponent(query)}&pageType=INSTAMART_HOME_PAGE`,
    ];
    for (const url of urls) {
      try {
        const resp = await fetch(url, { credentials: 'include' });
        const data = await resp.json();
        return { url, data };
      } catch (e) {
        console.error(url, e);
      }
    }
    return null;
  }, QUERY);

  if (searchResult) {
    console.log('\nSearch API URL:', searchResult.url);
    console.log('Search API response:');
    console.log(JSON.stringify(searchResult.data, null, 2).slice(0, 2000));
    fs.writeFileSync('scripts/instamart-search-api.json', JSON.stringify(searchResult.data, null, 2));
  }

  fs.writeFileSync('scripts/instamart-api-responses.json', JSON.stringify(apiResponses, null, 2));
  await context.close();
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
