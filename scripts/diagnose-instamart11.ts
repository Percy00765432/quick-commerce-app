import { chromium } from 'playwright';
import * as fs from 'fs';

const QUERY = 'milk';
const AREA = 'Koramangala';

async function setLocation(page: ReturnType<typeof chromium.prototype.launch extends Promise<infer B> ? (B extends { newPage: (...a: unknown[]) => Promise<infer P> } ? P : never) : never>) {
  await page.goto('https://www.swiggy.com/instamart', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  await page.locator('[data-testid="search-location"]').click({ timeout: 20000 });
  await page.waitForTimeout(1500);

  const locInput = page.locator('input').filter({ hasAttribute: 'placeholder' }).first();
  await locInput.waitFor({ state: 'visible', timeout: 8000 });
  await locInput.click();
  for (const char of AREA) await page.keyboard.type(char, { delay: 100 });
  await page.waitForTimeout(3500);

  await page.evaluate((area) => {
    const leaf = Array.from(document.querySelectorAll('*')).find(
      (el) => el.children.length === 0 && (el as HTMLElement).innerText?.trim() === area
    );
    if (leaf) (leaf as HTMLElement).click();
  }, AREA);
  await page.waitForTimeout(3000);
}

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
  await setLocation(page);

  await page.goto(`https://www.swiggy.com/instamart/search?query=${encodeURIComponent(QUERY)}`, {
    waitUntil: 'domcontentloaded', timeout: 20000,
  });
  await page.waitForTimeout(6000);

  const result = await page.evaluate(() => {
    const cardEl = document.querySelector('[data-testid="item-collection-card-full"]');
    if (!cardEl) return { error: 'no card', bodySnippet: document.body.innerText.slice(0, 300) };

    // Walk up to find parent that includes price
    let node = cardEl as Element;
    for (let i = 0; i < 10; i++) {
      if (!node.parentElement) break;
      node = node.parentElement;
      const text = (node as HTMLElement).innerText ?? '';
      if (/₹|\b\d{2,4}\b/.test(text)) break;
    }

    const fullCard = {
      tag: node.tagName,
      class: node.className.slice(0, 80),
      testId: (node as HTMLElement).dataset?.testid ?? '',
      html: node.outerHTML.slice(0, 3000),
      text: (node as HTMLElement).innerText?.slice(0, 300),
    };

    // Siblings of card-full
    const siblings = Array.from(cardEl.parentElement?.children ?? []).map((s) => ({
      tag: s.tagName,
      class: s.className.slice(0, 60),
      testId: (s as HTMLElement).dataset?.testid ?? '',
      text: (s as HTMLElement).innerText?.slice(0, 80),
    }));

    // All testIds on this page
    const testIds = new Set<string>();
    document.querySelectorAll('[data-testid]').forEach((el) =>
      testIds.add((el as HTMLElement).dataset.testid ?? '')
    );

    return { fullCard, siblings, testIds: Array.from(testIds) };
  });

  if ('error' in result) {
    console.log('ERROR:', result.error, result.bodySnippet);
  } else {
    console.log('\n=== Full card container ===');
    console.log('Tag:', (result as { fullCard: { tag: string; class: string; testId: string; html: string; text: string } }).fullCard.tag, '| testId:', (result as { fullCard: { tag: string; class: string; testId: string } }).fullCard.testId);
    console.log('Text:', (result as { fullCard: { text: string } }).fullCard.text);
    console.log('\nHTML:\n', (result as { fullCard: { html: string } }).fullCard.html);

    console.log('\n=== Siblings of item-collection-card-full ===');
    (result as { siblings: Array<{ tag: string; class: string; testId: string; text: string }> }).siblings.forEach((s) =>
      console.log(`  <${s.tag}> testId="${s.testId}" class="${s.class}" — "${s.text}"`)
    );

    console.log('\n=== All testIds on search page ===');
    console.log((result as { testIds: string[] }).testIds.join(', '));
  }

  fs.writeFileSync('scripts/im11-result.json', JSON.stringify(result, null, 2));
  await context.close();
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
