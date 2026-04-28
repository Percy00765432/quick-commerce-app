import { chromium } from 'playwright';
import * as fs from 'fs';

const PINCODE = '560001';
const QUERY = 'milk';

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'en-IN',
  });
  const page = await context.newPage();

  await page.goto('https://www.swiggy.com/instamart', { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForTimeout(3000);

  // Step 1: Click the search-location element to open location input
  console.log('Clicking search-location...');
  await page.locator('[data-testid="search-location"]').click().catch(() =>
    console.log('search-location not clickable, trying DEFAULT_ADDRESS_CONTAINER')
  );
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'scripts/im3-after-click.png' });

  const afterClick = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input')).map((el) => ({
      placeholder: el.placeholder, type: el.type, visible: el.offsetParent !== null,
    }));
    const testIds = new Set<string>();
    document.querySelectorAll('[data-testid]').forEach((el) =>
      testIds.add((el as HTMLElement).dataset.testid ?? '')
    );
    return { inputs, testIds: Array.from(testIds) };
  });
  console.log('Inputs after click:', JSON.stringify(afterClick.inputs));
  console.log('TestIds after click:', afterClick.testIds.join(', '));

  // Step 2: Try typing pincode into any visible input
  const locInput = page.locator('input[placeholder*="city"], input[placeholder*="area"], input[placeholder*="location"], input[placeholder*="pincode"], input[placeholder*="address"]').first();
  const locInputVisible = await locInput.isVisible({ timeout: 3000 }).catch(() => false);
  if (locInputVisible) {
    console.log('\nFound location input! Filling pincode:', PINCODE);
    await locInput.fill(PINCODE);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'scripts/im3-after-fill.png' });

    // Look for suggestions
    const suggestions = await page.evaluate(() => {
      const items = document.querySelectorAll('[data-testid*="suggestion"], [data-testid*="location"], li');
      const out: string[] = [];
      items.forEach((el) => out.push((el as HTMLElement).innerText?.slice(0, 80)));
      return out.filter(Boolean).slice(0, 5);
    });
    console.log('Suggestions:', suggestions);

    // Click the first suggestion
    const firstSuggestion = page.locator('[data-testid*="suggestion"], [data-testid*="location-item"]').first();
    const hasSuggestion = await firstSuggestion.isVisible({ timeout: 3000 }).catch(() => false);
    if (hasSuggestion) {
      await firstSuggestion.click();
      await page.waitForTimeout(2000);
    }
  } else {
    console.log('No location input found after click. Trying direct input search...');
    // Try typing pincode directly and pressing enter
    await page.keyboard.type(PINCODE);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'scripts/im3-typed.png' });
  }

  // Step 3: Navigate to search after (hopefully) setting location
  console.log('\nNavigating to search...');
  await page.goto(`https://www.swiggy.com/instamart/search?query=${encodeURIComponent(QUERY)}`, {
    waitUntil: 'domcontentloaded', timeout: 20000,
  });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'scripts/im3-search.png' });

  const searchResult = await page.evaluate(() => {
    const testIds = new Set<string>();
    document.querySelectorAll('[data-testid]').forEach((el) =>
      testIds.add((el as HTMLElement).dataset.testid ?? '')
    );
    return {
      url: window.location.href,
      testIds: Array.from(testIds).slice(0, 50),
      bodyText: document.body.innerText.slice(0, 600),
    };
  });

  console.log('URL after search nav:', searchResult.url);
  console.log('TestIds:', searchResult.testIds.join(', '));
  console.log('Body:', searchResult.bodyText);

  fs.writeFileSync('scripts/instamart-search-dom.json', JSON.stringify(searchResult, null, 2));
  await context.close();
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
