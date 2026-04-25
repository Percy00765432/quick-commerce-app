import { scrapeBlinkit } from '../scrapers/blinkit';
import { scrapeZepto } from '../scrapers/zepto';
import { matchProducts } from '../lib/matcher';

const QUERY = process.argv[2] ?? 'milk';
const PINCODE = process.argv[3] ?? '560001';

async function main() {
  console.log(`\nTesting scrapers — query: "${QUERY}", pincode: ${PINCODE}\n`);

  let blinkitResults: Awaited<ReturnType<typeof scrapeBlinkit>> = [];
  let zeptoResults: Awaited<ReturnType<typeof scrapeZepto>> = [];

  // --- Blinkit ---
  console.log('=== Blinkit ===');
  try {
    blinkitResults = await scrapeBlinkit(QUERY, PINCODE);
    if (blinkitResults.length === 0) {
      console.log('⚠️  No products found');
    } else {
      console.log(`✅ ${blinkitResults.length} products`);
      blinkitResults.forEach((r) =>
        console.log(`  • ${r.name}${r.unit ? ` (${r.unit})` : ''} — ₹${r.price}${r.originalPrice ? ` (was ₹${r.originalPrice})` : ''} [${r.available ? 'in stock' : 'OOS'}] ${r.deliveryTime ?? ''}`)
      );
    }
  } catch (err) {
    console.error('❌ Blinkit error:', (err as Error).message);
  }

  // --- Zepto ---
  console.log('\n=== Zepto ===');
  try {
    zeptoResults = await scrapeZepto(QUERY, PINCODE);
    if (zeptoResults.length === 0) {
      console.log('⚠️  No products found');
    } else {
      console.log(`✅ ${zeptoResults.length} products`);
      zeptoResults.forEach((r) =>
        console.log(`  • ${r.name}${r.unit ? ` (${r.unit})` : ''} — ₹${r.price}${r.originalPrice ? ` (was ₹${r.originalPrice})` : ''} [${r.available ? 'in stock' : 'OOS'}]`)
      );
    }
  } catch (err) {
    console.error('❌ Zepto error:', (err as Error).message);
  }

  // --- Matching ---
  const allResults = [...blinkitResults, ...zeptoResults];
  if (allResults.length > 0) {
    console.log('\n=== Matched products (cross-platform) ===');
    const matched = matchProducts(allResults);
    console.log(`${matched.length} unique products after matching`);
    matched.slice(0, 5).forEach((p) => {
      const platforms = p.results.map((r) => `${r.platform}:₹${r.price}`).join(' | ');
      console.log(`  • ${p.name}${p.unit ? ` (${p.unit})` : ''} → best ₹${p.bestPrice} on ${p.bestPlatform} | ${platforms}`);
    });
  }

  console.log('\nDone.\n');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
