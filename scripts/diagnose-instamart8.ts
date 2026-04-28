import { chromium } from 'playwright';
import * as fs from 'fs';

const QUERY = 'milk';
const AREA = 'Koramangala';

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'en-IN',
  });

  const page = await context.newPage();
  await page.goto('https://www.swiggy.com/instamart', { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForTimeout(2000);

  // Step 1: Open location picker
  console.log('Opening location picker...');
  await page.locator('[data-testid="search-location"]').click();
  await page.waitForTimeout(1000);

  const locInput = page.locator('input[placeholder*="area"], input[placeholder*="street"]').first();
  await locInput.waitFor({ state: 'visible', timeout: 5000 });
  await locInput.click();
  for (const char of AREA) await page.keyboard.type(char, { delay: 80 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'scripts/im8-suggestions.png' });

  // Step 2: Find and click a suggestion containing our area name
  // From last diagnostic, suggestions are in elements with class _2yaY1 or _1dzZA
  console.log('\nLooking for suggestion to click...');

  // Try multiple selectors, prefer li elements inside suggestion containers
  const suggestionClicked = await page.evaluate((area) => {
    const candidates = [
      // Find all elements whose text includes our area and are leaf-ish elements
      ...Array.from(document.querySelectorAll('li')),
      ...Array.from(document.querySelectorAll('[class*="_2yaY"] li, [class*="_1dzZA"] li')),
    ].filter((el) => {
      const text = (el as HTMLElement).innerText;
      return text && text.includes(area) && text.length < 200;
    });

    if (candidates.length > 0) {
      (candidates[0] as HTMLElement).click();
      return { clicked: true, text: (candidates[0] as HTMLElement).innerText.slice(0, 80) };
    }

    // Fallback: find any clickable div with the area text
    const divs = Array.from(document.querySelectorAll('div, span, p')).filter((el) => {
      const text = (el as HTMLElement).innerText?.trim();
      return text === area || text?.startsWith(area + ',') || text?.startsWith(area + '\n');
    });

    if (divs.length > 0) {
      (divs[0] as HTMLElement).click();
      return { clicked: true, text: (divs[0] as HTMLElement).innerText.slice(0, 80) };
    }

    return { clicked: false };
  }, AREA);

  console.log('Suggestion click result:', suggestionClicked);
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'scripts/im8-after-suggestion.png' });

  // Step 3: Navigate to search
  console.log('\nNavigating to search...');
  await page.goto(`https://www.swiggy.com/instamart/search?query=${encodeURIComponent(QUERY)}`, {
    waitUntil: 'domcontentloaded', timeout: 20000,
  });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: 'scripts/im8-search.png' });

  const searchState = await page.evaluate(() => {
    const testIds = new Set<string>();
    document.querySelectorAll('[data-testid]').forEach((el) =>
      testIds.add((el as HTMLElement).dataset.testid ?? '')
    );

    // Look for product-like containers with prices
    const withPrice = Array.from(document.querySelectorAll('div, article, li')).filter((el) => {
      const text = (el as HTMLElement).innerText ?? '';
      return text.includes('₹') && text.length < 400 && el.children.length >= 2 && el.children.length <= 15;
    });
    const unique = withPrice.filter((d, i) =>
      !withPrice.slice(0, i).some((p) => p.contains(d))
    );

    return {
      url: window.location.href,
      testIds: Array.from(testIds).slice(0, 60),
      bodyText: document.body.innerText.slice(0, 1000),
      productCandidates: unique.slice(0, 3).map((el) => ({
        tag: el.tagName,
        class: el.className.slice(0, 100),
        testId: (el as HTMLElement).dataset?.testid ?? '',
        text: (el as HTMLElement).innerText.slice(0, 200),
        html: el.outerHTML.slice(0, 1200),
      })),
    };
  });

  console.log('\n=== Search page state ===');
  console.log('URL:', searchState.url);
  console.log('TestIds:', searchState.testIds.join(', '));
  console.log('Body:', searchState.bodyText);
  console.log('\nProduct candidates:', JSON.stringify(searchState.productCandidates, null, 2));
  fs.writeFileSync('scripts/im8-result.json', JSON.stringify(searchState, null, 2));

  await context.close();
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
