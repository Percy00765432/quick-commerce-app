import { scrapeInstamart } from '../scrapers/instamart';

const QUERY = process.argv[2] ?? 'milk';
const PINCODE = process.argv[3] ?? '560001';

async function main() {
  console.log(`\nTesting Swiggy Instamart — query: "${QUERY}", pincode: ${PINCODE}\n`);
  try {
    const results = await scrapeInstamart(QUERY, PINCODE);
    if (results.length === 0) {
      console.log('⚠️  No products found (selectors may need updating)');
    } else {
      console.log(`✅ ${results.length} products found`);
      results.forEach((r) =>
        console.log(
          `  • ${r.name}${r.unit ? ` (${r.unit})` : ''} — ₹${r.price}` +
            `${r.originalPrice ? ` (was ₹${r.originalPrice})` : ''}` +
            ` [${r.available ? 'in stock' : 'OOS'}] ${r.deliveryTime ?? ''}`
        )
      );
    }
  } catch (err) {
    console.error('❌ Error:', (err as Error).message);
  }
  console.log('\nDone.\n');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
