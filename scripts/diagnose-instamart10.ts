import { chromium } from 'playwright';
import * as fs from 'fs';

const QUERY = 'milk';
const AREA = 'Koramangala';

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'en-IN',
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const page = await context.newPage();
  await page.goto('https://www.swiggy.com/instamart', { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForTimeout(3000);

  // Set location
  await page.locator('[data-testid="search-location"]').click();
  await page.waitForTimeout(1000);
  const locInput = page.locator('input[placeholder*="area"], input[placeholder*="street"]').first();
  await locInput.waitFor({ state: 'visible', timeout: 5000 });
  await locInput.click();
  for (const char of AREA) await page.keyboard.type(char, { delay: 100 });
  await page.waitForTimeout(3500);

  // Click the first exact-match leaf element
  await page.evaluate((area) => {
    const leaf = Array.from(document.querySelectorAll('*')).find(
      (el) => el.children.length === 0 && (el as HTMLElement).innerText?.trim() === area
    );
    if (leaf) (leaf as HTMLElement).click();
  }, AREA);
  await page.waitForTimeout(3000);

  // Search
  await page.goto(`https://www.swiggy.com/instamart/search?query=${encodeURIComponent(QUERY)}`, {
    waitUntil: 'domcontentloaded', timeout: 20000,
  });
  await page.waitForTimeout(5000);

  // Get product card HTML
  const cards = await page.evaluate(() => {
    const cardEls = document.querySelectorAll('[data-testid="item-collection-card-full"]');
    const results: Array<{ html: string; text: string }> = [];
    cardEls.forEach((el, i) => {
      if (i < 4) {
        results.push({
          html: el.outerHTML.slice(0, 2000),
          text: (el as HTMLElement).innerText.slice(0, 300),
        });
      }
    });

    // Also check what data-testid values exist inside the cards
    const innerTestIds = new Set<string>();
    if (cardEls.length > 0) {
      cardEls[0].querySelectorAll('[data-testid]').forEach((el) =>
        innerTestIds.add((el as HTMLElement).dataset.testid ?? '')
      );
    }

    return {
      count: cardEls.length,
      cards: results,
      innerTestIds: Array.from(innerTestIds),
    };
  });

  console.log(`Found ${cards.count} product cards`);
  console.log('Inner testIds:', cards.innerTestIds.join(', '));
  cards.cards.forEach((c, i) => {
    console.log(`\n=== Card ${i + 1} TEXT ===`);
    console.log(c.text);
    console.log(`=== Card ${i + 1} HTML ===`);
    console.log(c.html);
  });

  fs.writeFileSync('scripts/instamart-cards.json', JSON.stringify(cards, null, 2));
  await context.close();
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
