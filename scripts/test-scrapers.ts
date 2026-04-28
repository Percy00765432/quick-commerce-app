import { scrapeBlinkit } from '../scrapers/blinkit';
import { scrapeZepto } from '../scrapers/zepto';
import { scrapeInstamart } from '../scrapers/instamart';
import { matchProducts } from '../lib/matcher';
import type { ScrapedProduct } from '../types';

const QUERY = process.argv[2] ?? 'milk';
const PINCODE = process.argv[3] ?? '560001';

function printResults(label: string, results: ScrapedProduct[]) {
  if (results.length === 0) { console.log('⚠️  No products found'); return; }
  console.log(`✅ ${results.length} products`);
  results.forEach((r) =>
    console.log(
      `  • ${r.name}${r.unit ? ` (${r.unit})` : ''} — ₹${r.price}` +
        `${r.originalPrice ? ` (was ₹${r.originalPrice})` : ''}` +
        ` [${r.available ? 'in stock' : 'OOS'}]` +
        `${r.deliveryTime ? ` ${r.deliveryTime}` : ''}`
    )
  );
}

async function main() {
  console.log(`\nTesting scrapers — query: "${QUERY}", pincode: ${PINCODE}\n`);

  const allResults: ScrapedProduct[] = [];

  // Run all 3 in parallel
  const [blinkitSettled, zeptoSettled, instamartSettled] = await Promise.allSettled([
    scrapeBlinkit(QUERY, PINCODE),
    scrapeZepto(QUERY, PINCODE),
    scrapeInstamart(QUERY, PINCODE),
  ]);

  console.log('=== Blinkit ===');
  if (blinkitSettled.status === 'fulfilled') {
    allResults.push(...blinkitSettled.value);
    printResults('Blinkit', blinkitSettled.value);
  } else {
    console.error('❌ Blinkit error:', blinkitSettled.reason?.message ?? blinkitSettled.reason);
  }

  console.log('\n=== Zepto ===');
  if (zeptoSettled.status === 'fulfilled') {
    allResults.push(...zeptoSettled.value);
    printResults('Zepto', zeptoSettled.value);
  } else {
    console.error('❌ Zepto error:', zeptoSettled.reason?.message ?? zeptoSettled.reason);
  }

  console.log('\n=== Swiggy Instamart ===');
  if (instamartSettled.status === 'fulfilled') {
    allResults.push(...instamartSettled.value);
    printResults('Instamart', instamartSettled.value);
  } else {
    console.error('❌ Instamart error:', instamartSettled.reason?.message ?? instamartSettled.reason);
  }

  // Cross-platform matching
  if (allResults.length > 0) {
    console.log('\n=== Matched products (cross-platform) ===');
    const matched = matchProducts(allResults);
    const crossPlatform = matched.filter((p) => p.results.length > 1);
    console.log(`${matched.length} unique products — ${crossPlatform.length} matched across platforms`);
    matched.slice(0, 8).forEach((p) => {
      const platforms = p.results.map((r) => `${r.platform}:₹${r.price}`).join(' | ');
      console.log(
        `  • ${p.name}${p.unit ? ` (${p.unit})` : ''} → best ₹${p.bestPrice} on ${p.bestPlatform}` +
          (p.results.length > 1 ? ` | ${platforms}` : '')
      );
    });
  }

  console.log('\nDone.\n');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
