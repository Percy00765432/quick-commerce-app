import { chromium } from 'playwright';
import * as fs from 'fs';

const QUERY = 'milk';

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  await page.goto(`https://blinkit.com/s/?q=${encodeURIComponent(QUERY)}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForTimeout(4000);

  const result = await page.evaluate(() => {
    // Get product cards (the indigo background ones)
    const cards = document.querySelectorAll('[class*="tw-bg-indigo-050"]');
    const htmls: string[] = [];
    cards.forEach((el, i) => {
      if (i < 3) htmls.push(el.outerHTML.slice(0, 3000));
    });

    // Also try to find the parent structure
    const allText = document.body.innerText;
    const productSection = allText.indexOf('Amul Taaza');

    return { cards: htmls, count: cards.length, textSnippet: allText.slice(productSection, productSection + 500) };
  });

  console.log(`Found ${result.count} product cards with tw-bg-indigo-050`);
  console.log('\n=== Text snippet ===\n', result.textSnippet);
  console.log('\n=== Card 1 HTML ===\n', result.cards[0]);
  console.log('\n=== Card 2 HTML ===\n', result.cards[1]);
  fs.writeFileSync('scripts/blinkit-productcards.json', JSON.stringify(result, null, 2));

  await context.close();
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
