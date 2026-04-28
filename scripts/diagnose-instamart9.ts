import { chromium } from 'playwright';
import * as fs from 'fs';

const QUERY = 'milk';
const AREA = 'Koramangala';

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled', // hide automation
    ],
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'en-IN',
    // Remove webdriver property
    javaScriptEnabled: true,
  });

  // Remove webdriver detection
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
    // @ts-ignore
    window.chrome = { runtime: {} };
  });

  const page = await context.newPage();
  await page.goto('https://www.swiggy.com/instamart', { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForTimeout(3000);

  // Open location picker
  console.log('Opening location picker...');
  await page.locator('[data-testid="search-location"]').click();
  await page.waitForTimeout(1500);

  const locInput = page.locator('input[placeholder*="area"], input[placeholder*="street"]').first();
  await locInput.waitFor({ state: 'visible', timeout: 5000 });
  await locInput.click();
  for (const char of AREA) await page.keyboard.type(char, { delay: 100 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'scripts/im9-suggestions.png' });

  // Log all elements with Koramangala text to understand structure
  const elements = await page.evaluate((area) => {
    const found: Array<{ tag: string; class: string; parentTag: string; parentClass: string; text: string; childCount: number }> = [];
    document.querySelectorAll('*').forEach((el) => {
      const text = (el as HTMLElement).innerText;
      if (text?.trim().startsWith(area) && text.length < 100 && el.children.length <= 3) {
        found.push({
          tag: el.tagName,
          class: el.className.slice(0, 60),
          parentTag: el.parentElement?.tagName ?? '',
          parentClass: el.parentElement?.className.slice(0, 60) ?? '',
          text: text.slice(0, 80),
          childCount: el.children.length,
        });
      }
    });
    return found;
  }, AREA);

  console.log('\n=== Elements starting with area name ===');
  elements.forEach((e) => console.log(JSON.stringify(e)));

  // Click the most specific one (no children, leaf element, shortest text)
  const clicked = await page.evaluate((area) => {
    const allEls = Array.from(document.querySelectorAll('*'));
    // Find leaf elements (no children) with text starting with area name
    const leaves = allEls.filter((el) => {
      const text = (el as HTMLElement).innerText;
      return el.children.length === 0 && text?.trim() === area;
    });
    if (leaves.length > 0) {
      (leaves[0] as HTMLElement).click();
      return { method: 'leaf-exact', count: leaves.length };
    }

    // Try parent of leaf
    const leafParents = allEls.filter((el) => {
      const text = (el as HTMLElement).innerText;
      return el.children.length <= 2 && text?.trim().startsWith(area) && text.length < 80;
    });
    if (leafParents.length > 0) {
      (leafParents[0] as HTMLElement).click();
      return { method: 'leaf-parent', text: (leafParents[0] as HTMLElement).innerText.slice(0, 60), count: leafParents.length };
    }

    return { method: 'none' };
  }, AREA);
  console.log('\nClick result:', clicked);

  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'scripts/im9-after-click.png' });

  // Check if the modal closed (location set)
  const modalGone = await page.evaluate(() => {
    const modal = document.querySelector('[data-testid="focus-trap-container"], [data-testid="modal-overlay"]');
    return { modalVisible: modal !== null, url: window.location.href };
  });
  console.log('\nModal state after click:', modalGone);

  // Check localStorage for location data
  const storageData = await page.evaluate(() => {
    const data: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      data[k] = localStorage.getItem(k)?.slice(0, 150) ?? '';
    }
    return data;
  });
  console.log('\nLocalStorage after location selection:');
  Object.entries(storageData).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

  // Navigate to search
  console.log('\nNavigating to search...');
  await page.goto(`https://www.swiggy.com/instamart/search?query=${encodeURIComponent(QUERY)}`, {
    waitUntil: 'domcontentloaded', timeout: 20000,
  });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: 'scripts/im9-search.png' });

  const searchDOM = await page.evaluate(() => {
    const testIds = new Set<string>();
    document.querySelectorAll('[data-testid]').forEach((el) =>
      testIds.add((el as HTMLElement).dataset.testid ?? '')
    );
    return {
      url: window.location.href,
      testIds: Array.from(testIds).slice(0, 60),
      body: document.body.innerText.slice(0, 1000),
    };
  });
  console.log('\n=== Search page ===');
  console.log('URL:', searchDOM.url);
  console.log('TestIds:', searchDOM.testIds.join(', '));
  console.log('Body:', searchDOM.body);

  fs.writeFileSync('scripts/im9-dom.json', JSON.stringify(searchDOM, null, 2));
  await context.close();
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
