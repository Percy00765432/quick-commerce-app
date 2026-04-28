import { chromium } from 'playwright';
import * as fs from 'fs';

async function main() {
  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] }); // headless: false so we can see what happens
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'en-IN',
  });
  const page = await context.newPage();

  console.log('Step 1: Going to Swiggy Instamart homepage...');
  await page.goto('https://www.swiggy.com/instamart', { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'scripts/instamart-home.png' });
  console.log('Homepage screenshot saved. URL:', page.url());

  // Check what's on the page
  const homeInfo = await page.evaluate(() => {
    const testIds = new Set<string>();
    document.querySelectorAll('[data-testid]').forEach((el) =>
      testIds.add((el as HTMLElement).dataset.testid ?? '')
    );
    const inputs = Array.from(document.querySelectorAll('input')).map((el) => ({
      placeholder: el.placeholder,
      type: el.type,
      className: el.className.slice(0, 80),
    }));
    const buttons = Array.from(document.querySelectorAll('button')).slice(0, 10).map((b) => b.innerText?.trim().slice(0, 50));
    return {
      testIds: Array.from(testIds).slice(0, 40),
      inputs,
      buttons,
      bodySnippet: document.body.innerText.slice(0, 600),
    };
  });
  console.log('\ndata-testid:', homeInfo.testIds.join(', '));
  console.log('Inputs:', JSON.stringify(homeInfo.inputs));
  console.log('Buttons:', homeInfo.buttons);
  console.log('Body:', homeInfo.bodySnippet);

  console.log('\nStep 2: Looking for location input...');
  // Try clicking on location / detect location button
  const locationInput = page.locator('input[placeholder*="location"], input[placeholder*="area"], input[placeholder*="address"], input[placeholder*="pincode"], input[placeholder*="city"]').first();
  const isVisible = await locationInput.isVisible({ timeout: 3000 }).catch(() => false);
  console.log('Location input visible:', isVisible);

  if (isVisible) {
    await locationInput.fill('560001');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'scripts/instamart-location.png' });
    console.log('Filled pincode, screenshot saved');
  }

  // Try searching via URL with different patterns
  console.log('\nStep 3: Trying different search URL patterns...');
  const searchUrls = [
    'https://www.swiggy.com/instamart/search?query=milk',
    'https://www.swiggy.com/instamart/search?custom_back=true&query=milk',
  ];

  for (const url of searchUrls) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);
    const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 400));
    console.log(`\nURL: ${url}`);
    console.log('Body:', bodyText);
    await page.screenshot({ path: `scripts/instamart-search-${Date.now()}.png` });
  }

  fs.writeFileSync('scripts/instamart-home-dom.json', JSON.stringify(homeInfo, null, 2));
  await context.close();
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
