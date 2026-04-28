import { chromium } from 'playwright';
import * as fs from 'fs';

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

  // Open location modal
  await page.locator('[data-testid="search-location"]').click();
  await page.waitForTimeout(1500);

  // Type area name (Swiggy uses area/street, not pincode)
  const input = page.locator('input[placeholder*="area"], input[placeholder*="street"]').first();
  await input.waitFor({ state: 'visible', timeout: 5000 });
  await input.fill('Koramangala');
  console.log('Typed "Koramangala", waiting for suggestions...');
  await page.waitForTimeout(3000);

  // Capture all elements that appear after typing
  const afterType = await page.evaluate(() => {
    const testIds: string[] = [];
    document.querySelectorAll('[data-testid]').forEach((el) =>
      testIds.push((el as HTMLElement).dataset.testid ?? '')
    );
    const listItems = Array.from(document.querySelectorAll('li, [role="option"], [role="listitem"]'))
      .map((el) => ({ text: (el as HTMLElement).innerText?.slice(0, 100), testId: (el as HTMLElement).dataset.testid ?? '', className: el.className.slice(0, 80) }))
      .filter((i) => i.text);
    return { testIds: [...new Set(testIds)], listItems: listItems.slice(0, 10) };
  });

  console.log('TestIds:', afterType.testIds.join(', '));
  console.log('List items:', JSON.stringify(afterType.listItems, null, 2));
  await page.screenshot({ path: 'scripts/im4-suggestions.png' });

  // Try clicking first real suggestion
  const suggestionEl = page.locator('[data-testid*="location"], [data-testid*="place"], [data-testid*="suggestion"], li').filter({ hasText: 'Koramangala' }).first();
  const hasSugg = await suggestionEl.isVisible({ timeout: 3000 }).catch(() => false);
  if (hasSugg) {
    console.log('\nClicking suggestion...');
    await suggestionEl.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'scripts/im4-after-suggest.png' });

    const afterSelect = await page.evaluate(() => document.body.innerText.slice(0, 400));
    console.log('After selecting location:', afterSelect);

    // Now navigate to search
    await page.goto(`https://www.swiggy.com/instamart/search?query=${encodeURIComponent(QUERY)}`, {
      waitUntil: 'domcontentloaded', timeout: 20000,
    });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'scripts/im4-search.png' });

    const searchState = await page.evaluate(() => {
      const testIds = new Set<string>();
      document.querySelectorAll('[data-testid]').forEach((el) =>
        testIds.add((el as HTMLElement).dataset.testid ?? '')
      );
      // Look for product cards
      const cards: Array<{ testId: string; text: string; html: string }> = [];
      document.querySelectorAll('[data-testid]').forEach((el) => {
        const text = (el as HTMLElement).innerText ?? '';
        if (text.includes('₹') && text.length < 400) {
          cards.push({
            testId: (el as HTMLElement).dataset.testid ?? '',
            text: text.slice(0, 200),
            html: el.outerHTML.slice(0, 1000),
          });
        }
      });
      return {
        url: window.location.href,
        testIds: Array.from(testIds).slice(0, 60),
        bodyText: document.body.innerText.slice(0, 800),
        cards: cards.slice(0, 3),
      };
    });

    console.log('\n=== Search result ===');
    console.log('URL:', searchState.url);
    console.log('TestIds:', searchState.testIds.join(', '));
    console.log('Body:', searchState.bodyText);
    console.log('\nProduct cards:', JSON.stringify(searchState.cards.slice(0, 2), null, 2));
    fs.writeFileSync('scripts/instamart-search-result.json', JSON.stringify(searchState, null, 2));
  } else {
    console.log('No suggestion found for Koramangala');
    await page.screenshot({ path: 'scripts/im4-no-suggestion.png' });
    const pageText = await page.evaluate(() => document.body.innerText.slice(0, 500));
    console.log('Page text:', pageText);
  }

  await context.close();
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
