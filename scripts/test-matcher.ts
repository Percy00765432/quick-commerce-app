/* eslint-disable @typescript-eslint/no-explicit-any */
import { matchProducts, buildFeatures, detectSize, sizesCompatible } from '../lib/matcher';
import type { ScrapedProduct, Platform } from '../types';

let pass = 0;
let fail = 0;

function expect(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    pass++;
    console.log(`  ✅ ${label}`);
  } else {
    fail++;
    console.log(`  ❌ ${label}\n     actual:   ${JSON.stringify(actual)}\n     expected: ${JSON.stringify(expected)}`);
  }
}

function p(platform: Platform, name: string, price: number, unit?: string): ScrapedProduct {
  return { platform, name, price, available: true, deliveryFee: 0, unit };
}

console.log('\n=== detectSize ===');
expect('500 ml', detectSize('Amul Milk', '500 ml'), { value: 500, unit: 'ml' });
expect('1 ltr → 1000 ml', detectSize('Amul Gold (1 ltr)'), { value: 1000, unit: 'ml' });
expect('5 kg → 5000 g', detectSize('Aashirvaad Atta 5 kg'), { value: 5000, unit: 'g' });
expect('multipack 6 x 300 ml = 1800 ml', detectSize('Coca-Cola Pack of 6 (6 x 300 ml)'), { value: 1800, unit: 'ml' });
expect('zepto "1 pack (450 ml)"', detectSize('Country Delight', '1 pack (450 ml)'), { value: 450, unit: 'ml' });
expect('no size', detectSize('Mother Dairy Toned Milk'), null);

console.log('\n=== sizesCompatible ===');
expect('same → true', sizesCompatible({ value: 500, unit: 'ml' }, { value: 500, unit: 'ml' }), true);
expect('5% diff → true', sizesCompatible({ value: 450, unit: 'ml' }, { value: 470, unit: 'ml' }), true);
expect('100g vs 500g → false', sizesCompatible({ value: 100, unit: 'g' }, { value: 500, unit: 'g' }), false);
expect('one null → true', sizesCompatible(null, { value: 500, unit: 'ml' }), true);
expect('different units → false', sizesCompatible({ value: 500, unit: 'g' }, { value: 500, unit: 'ml' }), false);

console.log('\n=== buildFeatures (brand extraction) ===');
expect(
  'Zepto "Foo | Aashirvaad" → brand=aashirvaad',
  buildFeatures('Superior MP Wheat Atta, 0% Maida | Aashirvaad').brand,
  'aashirvaad'
);
expect(
  'Coca-Cola → coca cola',
  buildFeatures('Coca-Cola Soft Drink (750 ml)').brand,
  'coca cola'
);
expect(
  'no brand on plain "Onion (Pyaz)"',
  buildFeatures('Onion (Pyaz)').brand,
  null
);

console.log('\n=== buildFeatures (synonym expansion) ===');
expect(
  'Tomato (Tamatar) productKey contains tomato only',
  buildFeatures('Desi Tomato (Tamatar)').productKey,
  'desi tomato'
);
expect(
  'Tomato Local productKey contains local tomato',
  buildFeatures('Tomato Local').productKey,
  'local tomato'
);

console.log('\n=== matchProducts: cross-platform matches ===');

// 1. Coca-Cola same product, same size, different platforms → MATCH
{
  const r = matchProducts([
    p('blinkit', 'Coca-Cola Soft Drink (750 ml)', 39),
    p('zepto', 'Coca-Cola Soft Drink | Carbonated Beverage (1 pc (750 ml))', 33),
  ]);
  expect('Coca-Cola: 1 anchor', r.length, 1);
  expect('Coca-Cola: best price ₹33 zepto', { price: r[0]?.bestPrice, platform: r[0]?.bestPlatform }, { price: 33, platform: 'zepto' });
}

// 2. Amul Lite Milk Fat Spread — DIFFERENT sizes → SHOULD NOT match
{
  const r = matchProducts([
    p('blinkit', 'Amul Lite Milk Fat Spread (100 g)', 45, '100 g'),
    p('zepto', 'Amul Lite Milk Fat Spread (1 pack (500 g))', 218),
  ]);
  expect('Amul Lite: 2 anchors (different sizes)', r.length, 2);
}

// 3. Amul Salted Butter same brand+product+size → MATCH
{
  const r = matchProducts([
    p('blinkit', 'Amul Salted Butter (100 g)', 60, '100 g'),
    p('zepto', 'Amul Salted Butter (1 pack (100 g))', 60),
  ]);
  expect('Amul Salted Butter 100g: 1 anchor', r.length, 1);
}

// 4. Different brands, same product → SHOULD NOT match
{
  const r = matchProducts([
    p('blinkit', 'Mother Dairy Toned Milk', 29),
    p('zepto', 'Heritage Toned Fresh Milk | Pouch (1 pack (500 ml))', 26),
  ]);
  expect('Different brands: 2 anchors', r.length, 2);
}

// 5. Tomato (Tamatar) ↔ Tomato Local → MATCH (no brand, synonym handles Hindi)
{
  const r = matchProducts([
    p('blinkit', 'Tomato (Tamatar)', 28),
    p('zepto', 'Tomato Local (500 g)', 54),
  ]);
  expect('Tomato cross-language: 1 anchor', r.length, 1);
}

// 6. L'Oreal Glycolic Gloss → MATCH on same product, same size
{
  const r = matchProducts([
    p('blinkit', "L'Oreal Paris Glycolic Gloss Shampoo", 200),
    p('zepto', "L'Oreal Paris Glycolic Gloss Shampoo | Glycolic Acid for dull hair (1 pc (200 ml))", 191),
  ]);
  expect('Glycolic Gloss: 1 anchor', r.length, 1);
  expect('Glycolic Gloss best ₹191 zepto', { price: r[0]?.bestPrice, platform: r[0]?.bestPlatform }, { price: 191, platform: 'zepto' });
}

// 7. Different SKU same brand → SHOULD NOT match (Country Delight Cow Milk vs High Protein)
{
  const r = matchProducts([
    p('blinkit', 'Country Delight Cow Fresh Milk', 46, '450 ml'),
    p('zepto', 'Country Delight High Protein Fresh Cow Milk | 30g Protein (1 pack (450 ml))', 51),
  ]);
  expect('Country Delight Cow vs High Protein: 2 anchors', r.length, 2);
}

// 8. Maggi multipack vs single pack — different sizes → SHOULD NOT match
{
  const r = matchProducts([
    p('blinkit', 'Maggi 2 Minutes Instant Noodles Made With Quality Spices (450 g)', 83, '450 g'),
    p('zepto', 'MAGGI 2-Minute Instant Noodles | Masala Noodles | Made With Quality Spices (1 pack (70 g or 75 g))', 14),
  ]);
  expect('Maggi 450g vs 75g: 2 anchors', r.length, 2);
}

// 9. Onion (Pyaz) ↔ Onion Robusta — same vegetable, different sizes ⇒ separate
{
  const r = matchProducts([
    p('blinkit', 'Onion (Pyaz)', 28, '500 g'),
    p('zepto', 'Onion (1 Pack (900 -1000 g))', 56),
  ]);
  expect('Onion 500g vs 1kg: 2 anchors (different sizes)', r.length, 2);
}

// 10. No-brand Banana ↔ Banana Robusta — different SKUs (one is a variety), keep separate
{
  const r = matchProducts([
    p('blinkit', 'Banana', 33),               // no size
    p('zepto', 'Banana Robusta (4 pcs)', 42, '4 pcs'),
  ]);
  expect('Banana plain ↔ Banana Robusta: 2 anchors (variety differs)', r.length, 2);
}

// 11. Cherry Tomatoes — should still match its Zepto counterpart (cherry is NOT noise)
{
  const r = matchProducts([
    p('blinkit', 'Cherry Tomatoes', 42),
    p('zepto', 'Cherry Tomato (250 g)', 43),
  ]);
  expect('Cherry Tomato: 1 anchor', r.length, 1);
}

// 12. Plain "Tomato (Tamatar)" should not match "Cherry Tomato" — different varieties
{
  const r = matchProducts([
    p('blinkit', 'Tomato (Tamatar)', 28),
    p('zepto', 'Cherry Tomato (250 g)', 43),
  ]);
  expect('Plain Tomato vs Cherry Tomato: 2 anchors', r.length, 2);
}

console.log(`\n=== ${pass} passed, ${fail} failed ===\n`);
process.exit(fail > 0 ? 1 : 0);
