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

  console.log('Loading Swiggy Instamart search page...');
  await page.goto(`https://www.swiggy.com/instamart/search?query=${encodeURIComponent(QUERY)}`, {
    waitUntil: 'domcontentloaded',
    timeout: 25000,
  });
  await page.waitForTimeout(5000);

  const title = await page.title();
  const url = page.url();
  console.log('Title:', title);
  console.log('Final URL:', url);

  await page.screenshot({ path: 'scripts/instamart-screenshot.png', fullPage: false });
  console.log('Screenshot saved.');

  const result = await page.evaluate(() => {
    // Collect data-testid values
    const testIds = new Set<string>();
    document.querySelectorAll('[data-testid]').forEach((el) =>
      testIds.add((el as HTMLElement).dataset.testid ?? '')
    );

    // Find product-like containers (have price + name)
    const candidates: Array<{ tag: string; className: string; text: string; html: string }> = [];
    document.querySelectorAll('div, article, li, a').forEach((el) => {
      const text = (el as HTMLElement).innerText ?? '';
      const children = el.children.length;
      if (
        text.includes('₹') &&
        (text.includes('ADD') || text.includes('Add')) &&
        children >= 2 &&
        children <= 20 &&
        text.length < 500
      ) {
        candidates.push({
          tag: el.tagName.toLowerCase(),
          className: el.className.slice(0, 120),
          text: text.slice(0, 250),
          html: el.outerHTML.slice(0, 1500),
        });
      }
    });

    // De-dup: only keep the smallest enclosing element
    const unique = candidates.filter((d, i) =>
      !candidates.slice(0, i).some((prev) => prev.html.includes(d.html.slice(0, 80)))
    );

    return {
      testIds: Array.from(testIds).slice(0, 60),
      cards: unique.slice(0, 4),
      bodyText: document.body.innerText.slice(0, 800),
    };
  });

  console.log('\n=== data-testid values ===');
  console.log(result.testIds.join(', '));
  console.log('\n=== Body text preview ===');
  console.log(result.bodyText);
  console.log('\n=== Product card candidates ===');
  result.cards.forEach((c, i) => {
    console.log(`\n--- Card ${i + 1} ---`);
    console.log('Tag:', c.tag, '| Class:', c.className);
    console.log('Text:', c.text);
    console.log('HTML:', c.html.slice(0, 800));
  });

  fs.writeFileSync('scripts/instamart-dom.json', JSON.stringify(result, null, 2));
  await context.close();
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
