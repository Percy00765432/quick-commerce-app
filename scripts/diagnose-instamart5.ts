import { chromium } from 'playwright';
import * as fs from 'fs';

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'en-IN',
  });

  // Intercept and log all API calls
  const apiCalls: string[] = [];
  const page = await context.newPage();
  page.on('request', (req) => {
    if (req.url().includes('api') || req.url().includes('fetch') || req.url().includes('search') || req.url().includes('location')) {
      apiCalls.push(`${req.method()} ${req.url()}`);
    }
  });
  page.on('response', async (resp) => {
    const url = resp.url();
    if ((url.includes('location') || url.includes('place') || url.includes('autocomplete')) && resp.status() === 200) {
      try {
        const body = await resp.text();
        console.log(`\n>>> API response from: ${url.slice(0, 120)}`);
        console.log(body.slice(0, 500));
      } catch { /* skip */ }
    }
  });

  await page.goto('https://www.swiggy.com/instamart', { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForTimeout(2000);

  // Log localStorage and cookies
  const storage = await page.evaluate(() => {
    const ls: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      ls[k] = localStorage.getItem(k)?.slice(0, 200) ?? '';
    }
    return ls;
  });
  const cookies = await context.cookies();
  console.log('\n=== LocalStorage keys ===');
  Object.entries(storage).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  console.log('\n=== Cookies ===');
  cookies.forEach((c) => console.log(`  ${c.name}: ${c.value.slice(0, 60)}`));

  // Open location search and try with lat/lng approach
  await page.locator('[data-testid="search-location"]').click();
  await page.waitForTimeout(1000);

  const locInput = page.locator('input[placeholder*="area"], input[placeholder*="street"]').first();
  await locInput.waitFor({ state: 'visible', timeout: 5000 });
  // Type slowly character by character
  await locInput.click();
  await page.waitForTimeout(300);
  for (const char of 'Koramangala') {
    await page.keyboard.type(char, { delay: 80 });
  }
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'scripts/im5-type.png' });

  const afterType = await page.evaluate(() => {
    const allText = document.body.innerText;
    const hasKoramangala = allText.toLowerCase().includes('koramangala');
    const inputs = Array.from(document.querySelectorAll('input')).map((i) => i.value);
    // Find any new elements that appeared
    const testIds = new Set<string>();
    document.querySelectorAll('[data-testid]').forEach((el) =>
      testIds.add((el as HTMLElement).dataset.testid ?? '')
    );
    return { hasKoramangala, inputs, testIds: Array.from(testIds) };
  });
  console.log('\n=== After typing "Koramangala" ===');
  console.log('Input values:', afterType.inputs);
  console.log('Koramangala in page:', afterType.hasKoramangala);
  console.log('TestIds:', afterType.testIds.join(', '));

  console.log('\n=== API calls made ===');
  apiCalls.slice(-20).forEach((c) => console.log(' ', c));

  // Now try setting lat/lng directly in localStorage and navigating to search
  console.log('\n=== Trying lat/lng injection via localStorage ===');
  await page.evaluate(() => {
    // Swiggy typically stores address as JSON in localStorage
    const addressData = JSON.stringify({
      deliveryAddress: {
        lat: '12.9352',
        lng: '77.6245',
        address: 'Koramangala, Bangalore',
        addressLineOne: 'Koramangala',
        addressLineTwo: 'Bangalore, Karnataka',
        pinCode: '560034',
      }
    });
    localStorage.setItem('userDeliveryAddress', addressData);
    localStorage.setItem('deliveryAddress', addressData);
  });

  await page.goto(`https://www.swiggy.com/instamart/search?query=milk&lat=12.9352&lng=77.6245`, {
    waitUntil: 'domcontentloaded', timeout: 20000,
  });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'scripts/im5-latlng-search.png' });

  const latlngResult = await page.evaluate(() => ({
    url: window.location.href,
    bodyText: document.body.innerText.slice(0, 600),
  }));
  console.log('URL:', latlngResult.url);
  console.log('Body:', latlngResult.bodyText);

  fs.writeFileSync('scripts/instamart-api-calls.json', JSON.stringify(apiCalls, null, 2));
  await context.close();
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
