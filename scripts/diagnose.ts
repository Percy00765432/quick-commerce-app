import { chromium } from 'playwright';
import * as fs from 'fs';

const QUERY = 'milk';
const PINCODE = '560001';

async function diagnose(name: string, url: string, outFile: string) {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'en-IN',
  });
  const page = await context.newPage();

  try {
    console.log(`\n[${name}] Loading: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(4000); // let JS render

    const title = await page.title();
    console.log(`[${name}] Page title: ${title}`);

    // Take screenshot
    await page.screenshot({ path: `scripts/${name}-screenshot.png`, fullPage: false });
    console.log(`[${name}] Screenshot saved: scripts/${name}-screenshot.png`);

    // Dump relevant part of the DOM
    const bodySnippet = await page.evaluate(() => {
      // Get first 200 unique class names to understand structure
      const allEls = document.querySelectorAll('*');
      const classes = new Set<string>();
      allEls.forEach((el) => el.classList.forEach((c) => classes.add(c)));
      const classArr = Array.from(classes).slice(0, 150).join(', ');

      // Look for product-like containers
      const selectors = [
        '[data-testid]',
        '[class*="product"]',
        '[class*="Product"]',
        '[class*="item"]',
        '[class*="Item"]',
        '[class*="card"]',
        '[class*="Card"]',
      ];

      const found: string[] = [];
      for (const sel of selectors) {
        const els = document.querySelectorAll(sel);
        if (els.length > 0) {
          found.push(`${sel} → ${els.length} elements, first: ${els[0].className.slice(0, 80)}`);
        }
      }

      // data-testid values present
      const testIds = new Set<string>();
      document.querySelectorAll('[data-testid]').forEach((el) => {
        testIds.add((el as HTMLElement).dataset.testid ?? '');
      });

      return {
        url: window.location.href,
        classes: classArr,
        selectorMatches: found,
        testIds: Array.from(testIds).slice(0, 50),
        bodyText: document.body?.innerText?.slice(0, 500),
      };
    });

    fs.writeFileSync(outFile, JSON.stringify(bodySnippet, null, 2));
    console.log(`[${name}] DOM info saved: ${outFile}`);
    console.log(`[${name}] data-testid values:`, bodySnippet.testIds.slice(0, 20));
    console.log(`[${name}] Selector matches:`);
    bodySnippet.selectorMatches.forEach((m) => console.log('  ', m));
    console.log(`[${name}] Page text preview:`, bodySnippet.bodyText?.slice(0, 200));
  } finally {
    await context.close();
    await browser.close();
  }
}

async function main() {
  await diagnose('blinkit', `https://blinkit.com/s/?q=${encodeURIComponent(QUERY)}`, 'scripts/blinkit-dom.json');
  await diagnose('zepto', `https://www.zeptonow.com/search?query=${encodeURIComponent(QUERY)}`, 'scripts/zepto-dom.json');
}

main().catch((e) => { console.error(e); process.exit(1); });
