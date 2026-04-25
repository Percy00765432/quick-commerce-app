import { chromium } from 'playwright';
import * as fs from 'fs';

const QUERY = 'milk';

async function diagnoseBlinkitCards() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  try {
    await page.goto(`https://blinkit.com/s/?q=${encodeURIComponent(QUERY)}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(4000);

    // Dismiss location modal if present by pressing Escape
    await page.keyboard.press('Escape').catch(() => null);
    await page.waitForTimeout(1000);

    const html = await page.evaluate(() => {
      // Find the product grid container
      const gridItems = document.querySelectorAll('.tw-grid.tw-grid-cols-12');
      const results: string[] = [];
      gridItems.forEach((el, i) => {
        if (i < 3) results.push(el.outerHTML.slice(0, 2000));
      });

      // Also try to find items another way
      const allDivs = document.querySelectorAll('div');
      const productDivs: string[] = [];
      allDivs.forEach((div) => {
        const text = div.innerText || '';
        if (text.includes('₹') && text.includes('MINS') && text.length < 300) {
          productDivs.push(div.className + ' :: ' + text.slice(0, 150));
        }
      });

      return { gridItems: results, productDivsByPrice: productDivs.slice(0, 5) };
    });

    console.log('\n=== Blinkit grid items (first 3 outerHTML snippets) ===');
    html.gridItems.forEach((h, i) => { console.log(`\n--- Card ${i + 1} ---`); console.log(h); });
    console.log('\n=== Blinkit divs with price + mins ===');
    html.productDivsByPrice.forEach((p) => console.log(p));
    fs.writeFileSync('scripts/blinkit-cards.json', JSON.stringify(html, null, 2));
  } finally {
    await context.close();
    await browser.close();
  }
}

async function diagnoseZeptoCards() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  try {
    await page.goto(`https://www.zeptonow.com/search?query=${encodeURIComponent(QUERY)}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(5000);

    const html = await page.evaluate(() => {
      // Find divs containing price (₹) and "ADD" button text — these are product cards
      const allDivs = Array.from(document.querySelectorAll('div, article, section, li'));
      const productDivs: Array<{ className: string; html: string; text: string }> = [];

      for (const div of allDivs) {
        const text = (div as HTMLElement).innerText || '';
        const children = div.children.length;
        // Look for elements that have price AND add button AND reasonable size
        if (text.includes('₹') && text.includes('ADD') && children >= 2 && children <= 15 && text.length < 400) {
          productDivs.push({
            className: div.className.slice(0, 100),
            html: div.outerHTML.slice(0, 1500),
            text: text.slice(0, 200),
          });
        }
      }

      // De-duplicate by taking smallest enclosing div
      const unique = productDivs.filter((d, i) => {
        return !productDivs.slice(0, i).some((prev) => prev.html.includes(d.html.slice(0, 100)));
      });

      return unique.slice(0, 4);
    });

    console.log('\n=== Zepto product cards ===');
    html.forEach((card, i) => {
      console.log(`\n--- Card ${i + 1} ---`);
      console.log('Class:', card.className);
      console.log('Text:', card.text);
      console.log('HTML snippet:', card.html.slice(0, 800));
    });
    fs.writeFileSync('scripts/zepto-cards.json', JSON.stringify(html, null, 2));
  } finally {
    await context.close();
    await browser.close();
  }
}

async function main() {
  console.log('Diagnosing Blinkit card structure...');
  await diagnoseBlinkitCards();
  console.log('\nDiagnosing Zepto card structure...');
  await diagnoseZeptoCards();
}

main().catch((e) => { console.error(e); process.exit(1); });
