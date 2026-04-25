import type { ScrapedProduct, ComparisonProduct, Platform } from '@/types';

// =============================================================================
// 1. KNOWN BRANDS — sorted longest-first so multi-word brands win
// =============================================================================

const BRANDS_RAW = [
  // Dairy
  'amul', 'mother dairy', 'nandini', 'heritage', 'milky mist', 'country delight',
  'gowardhan', 'gopala', 'akshayakalpa', 'pride of cows', 'epigamia', 'ananda',
  'milkbasket', 'frubon', 'go cheese',
  // Cooking essentials
  'aashirvaad', 'fortune', 'tata sampann', 'tata simply better', 'tata',
  'whole farm', 'organic tattva', '24 mantra', 'borges', 'figaro', 'del monte',
  'leonardo', 'oleev', 'jivo', 'india gate', 'daawat', 'shree akshara',
  'royal bullet', 'zeeba', 'fortune premio', 'xtract organic',
  // Snacks/staples
  'parle', 'britannia', 'haldiram', 'maggi', 'nestle', 'yippee', 'sunfeast',
  'too yumm', 'beyond snack', 'yogabar', 'yoga bar', 'whole truth', 'ritebite',
  'superyou', 'kissan', 'modern', 'english oven', 'harvest gold', 'health factory',
  'bakers dozen', 'curryit', 'pasta zara', 'gimi michi', 'unifit',
  'right shift', 'avvatar', 'orika', 'zoff',
  // Beverages
  'coca cola', 'coke', 'thums up', 'pepsi', 'sprite', 'fanta', 'limca',
  'mountain dew', 'bisleri', 'minute maid', 'tropicana', 'real', 'paper boat',
  'bombay banta',
  // Personal/home care
  'dettol', 'savlon', 'colgate', 'pepsodent', 'closeup', 'oral b', 'sensodyne',
  'dove', 'l oreal', 'loreal', 'tresemme', 'clinic plus', 'head shoulders',
  'head and shoulders', 'pantene', 'sunsilk', 'garnier', 'himalaya', 'patanjali',
  'lakme', 'ponds', 'nivea', 'vaseline', 'lifebuoy', 'lux', 'cinthol',
  'santoor', 'medimix', 'mysore sandal', 'fiama', 'palmolive', 'pears',
  'love beauty planet', 'moxie beauty', 'khadi natural', 'schwarzkopf',
  'nutralite', 'delicious',
  // Meat/eggs
  'licious', 'meatigo', 'fresh meat', 'fipola', 'zappfresh', 'tendercuts',
  'nutrich', 'abis', 'eggoz', 'abhi', 'vijay', 'henfruit', 'urban eggs',
  'nature good', 'table white', 'hen fruit', 'relish', 'nandus', 'deli chic',
  'katlego', 'chefigo',
];

const BRANDS = BRANDS_RAW.map((b) => b.toLowerCase().trim()).sort(
  (a, b) => b.length - a.length
);

// =============================================================================
// 2. HINDI ↔ ENGLISH PRODUCE SYNONYMS
// =============================================================================

const SYNONYMS: Array<[string, string[]]> = [
  ['tomato', ['tamatar']],
  ['onion', ['pyaz', 'pyaaz', 'kanda']],
  ['potato', ['aloo', 'alu', 'batata']],
  ['cucumber', ['kheera', 'khira']],
  ['banana', ['kela']],
  ['apple', ['seb']],
  ['mango', ['aam']],
  ['eggplant', ['baingan', 'brinjal', 'baigan']],
  ['cauliflower', ['phool gobhi', 'phool gobi']],
  ['cabbage', ['patta gobhi', 'bandh gobhi']],
  ['spinach', ['palak']],
  ['fenugreek', ['methi']],
  ['coriander', ['dhania', 'dhaniya', 'kothmir']],
  ['mint', ['pudina']],
  ['ginger', ['adrak']],
  ['garlic', ['lehsun', 'lasun', 'lassan']],
  ['lemon', ['nimbu']],
  ['mushroom', ['khumbi']],
  ['carrot', ['gajar']],
  ['raw banana', ['kacha kela']],
  ['curry leaves', ['kadi patta', 'curry patta']],
  ['rice', ['chawal', 'chaval']],
  ['wheat flour', ['atta']],
];

function expandSynonyms(text: string): string {
  let out = ` ${text} `;
  for (const [eng, hindis] of SYNONYMS) {
    for (const hindi of hindis) {
      const re = new RegExp(`\\s${hindi}\\s`, 'g');
      out = out.replace(re, ` ${eng} `);
    }
  }
  return out.trim().replace(/\s+/g, ' ');
}

// =============================================================================
// 3. SIZE / QUANTITY PARSING — normalize to grams / millilitres / pieces
// =============================================================================

export type Size = { value: number; unit: 'g' | 'ml' | 'pcs' };

const UNIT_MAP: Record<string, { unit: Size['unit']; multiplier: number }> = {
  g: { unit: 'g', multiplier: 1 },
  gm: { unit: 'g', multiplier: 1 },
  gms: { unit: 'g', multiplier: 1 },
  gram: { unit: 'g', multiplier: 1 },
  grams: { unit: 'g', multiplier: 1 },
  kg: { unit: 'g', multiplier: 1000 },
  kgs: { unit: 'g', multiplier: 1000 },
  ml: { unit: 'ml', multiplier: 1 },
  l: { unit: 'ml', multiplier: 1000 },
  ltr: { unit: 'ml', multiplier: 1000 },
  litre: { unit: 'ml', multiplier: 1000 },
  litres: { unit: 'ml', multiplier: 1000 },
  liter: { unit: 'ml', multiplier: 1000 },
  liters: { unit: 'ml', multiplier: 1000 },
  pcs: { unit: 'pcs', multiplier: 1 },
  pc: { unit: 'pcs', multiplier: 1 },
  piece: { unit: 'pcs', multiplier: 1 },
  pieces: { unit: 'pcs', multiplier: 1 },
  count: { unit: 'pcs', multiplier: 1 },
  ct: { unit: 'pcs', multiplier: 1 },
};

const SIZE_PATTERN =
  '(\\d+(?:\\.\\d+)?)\\s*(kg|kgs|gms|grams|gram|gm|g|ml|ltr|litres|litre|liters|liter|l|pieces|piece|pcs|pc|count|ct)\\b';

function findSizes(text: string): Size[] {
  const sizes: Size[] = [];
  const re = new RegExp(SIZE_PATTERN, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text.toLowerCase())) !== null) {
    const value = parseFloat(m[1]);
    const info = UNIT_MAP[m[2].toLowerCase()];
    if (!info || isNaN(value) || value <= 0) continue;
    sizes.push({ value: value * info.multiplier, unit: info.unit });
  }
  return sizes;
}

// "6 x 300 ml" → 1800 ml total
function findMultipack(text: string): Size | null {
  const re = new RegExp(
    `(\\d+)\\s*x\\s*${SIZE_PATTERN}`.replace('(\\d+(?:\\.\\d+)?)', '(\\d+(?:\\.\\d+)?)'),
    'i'
  );
  const m = text.toLowerCase().match(re);
  if (!m) return null;
  const count = parseInt(m[1], 10);
  const each = parseFloat(m[2]);
  const info = UNIT_MAP[m[3]?.toLowerCase()];
  if (!info || isNaN(count) || isNaN(each)) return null;
  return { value: count * each * info.multiplier, unit: info.unit };
}

export function detectSize(name: string, unit?: string): Size | null {
  const candidates: Size[] = [];

  // Multipack patterns first
  const multiName = findMultipack(name);
  if (multiName) candidates.push(multiName);
  if (unit) {
    const multiUnit = findMultipack(unit);
    if (multiUnit) candidates.push(multiUnit);
  }

  // Then plain sizes
  candidates.push(...findSizes(name));
  if (unit) candidates.push(...findSizes(unit));

  if (candidates.length === 0) return null;

  // Prefer the largest size (the actual product size; small numbers are usually noise)
  return candidates.reduce((biggest, s) => {
    if (s.unit !== biggest.unit) {
      // Different unit types: prefer ml/g over pcs (more specific for our products)
      if (biggest.unit === 'pcs' && s.unit !== 'pcs') return s;
      return biggest;
    }
    return s.value > biggest.value ? s : biggest;
  });
}

export function sizesCompatible(a: Size | null, b: Size | null, tolerance = 0.05): boolean {
  if (!a || !b) return true;        // unknown size on either side → don't penalize
  if (a.unit !== b.unit) return false;
  const ratio = Math.min(a.value, b.value) / Math.max(a.value, b.value);
  return ratio >= 1 - tolerance;
}

// =============================================================================
// 4. NORMALIZATION & TOKENIZATION
// =============================================================================

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const NOISE_WORDS = new Set([
  // Marketing fluff
  'pack', 'combo', 'offer', 'buy', 'get', 'free',
  'natural', 'organic', 'pure', 'fresh', 'premium', 'classic', 'special',
  'original', 'regular', 'standard', 'finest', 'authentic', 'traditional',
  'super', 'extra', 'high', 'low', 'new', 'old',
  // Packaging
  'pouch', 'tetra', 'tetrapack', 'bottle', 'can', 'box', 'jar', 'tin',
  'sachet', 'each', 'available', 'sourced', 'made', 'bag',
  // Filler
  'with', 'for', 'and', 'the', 'of', 'to', 'in', 'on', 'by', 'is', 'are',
  'set', 'no', 'pcs',
  // Generic descriptors common across both platforms (Zepto loves these)
  'carbonated', 'beverage', 'drink', 'soft',  // 'drink' & 'soft' are debatable; remove if false-positives
  'sized', 'cooking', 'spices',
  // Shelf-life
  'days', 'shelf', 'life',
  // Produce variant qualifiers — different platforms label the same vegetable
  // with different modifiers ("Desi Tomato" vs "Tomato Local" vs "Hybrid Tomato")
  'desi', 'local', 'hybrid', 'imported', 'country', 'farm',
]);

// =============================================================================
// 5. PRODUCT FEATURE EXTRACTION
// =============================================================================

interface Features {
  raw: string;
  brand: string | null;
  tokens: Set<string>;
  productKey: string;   // sorted, deduplicated tokens (brand & size already removed)
  size: Size | null;
}

function extractBrand(normalized: string): string | null {
  const padded = ` ${normalized} `;
  for (const brand of BRANDS) {
    if (padded.includes(` ${brand} `)) return brand;
  }
  return null;
}

// Crude English plural → singular stemmer
//   tomatoes → tomato, berries → berry, apples → apple
//   preserves "is", "us", "ss" endings (this, kiss, focus)
function singularize(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith('oes')) return word.slice(0, -2);
  if (word.endsWith('ies') && word.length > 4) return word.slice(0, -3) + 'y';
  if (word.endsWith('ss') || word.endsWith('us') || word.endsWith('is')) return word;
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .split(/\s+/)
      .map((t) => singularize(t.trim()))
      .filter((t) => t.length >= 2 && !NOISE_WORDS.has(t))
  );
}

export function buildFeatures(rawName: string, unit?: string): Features {
  const size = detectSize(rawName, unit);

  // Extract brand from the FULL normalized name (so Zepto's "Foo | Brand" still works)
  const fullNormalized = expandSynonyms(normalizeName(rawName));
  const brand = extractBrand(fullNormalized);

  // Build a clean product key:
  //   - drop pipe-suffix (Zepto descriptors)
  //   - drop parenthetical content (sizes, packaging notes)
  //   - drop sizes, multipack patterns, lone numbers
  let cleaned = rawName.replace(/\s*\|.*$/, '').replace(/\([^)]*\)/g, '');
  cleaned = expandSynonyms(normalizeName(cleaned));
  cleaned = cleaned.replace(new RegExp(SIZE_PATTERN, 'gi'), '');
  cleaned = cleaned.replace(/\b\d+\s*x\s*\d+(?:\.\d+)?\b/gi, '');
  cleaned = cleaned.replace(/\b(pack|set|box)\s+of\s+\d+\b/gi, '');
  cleaned = cleaned.replace(/\b\d+\s*\w*\b/g, (m) => (/^\d+$/.test(m.trim()) ? '' : m));
  cleaned = cleaned.replace(/\b\d+\b/g, '');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // Strip the brand out of the cleaned text so productKey is brand-free
  let remainder = ` ${cleaned} `;
  if (brand) remainder = remainder.replace(` ${brand} `, ' ');
  remainder = remainder.trim();

  const tokens = tokenize(remainder);
  const productKey = Array.from(tokens).sort().join(' ');

  return { raw: rawName, brand, tokens, productKey, size };
}

// =============================================================================
// 6. SIMILARITY
// =============================================================================

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

// Score a candidate match — returns 0 if hard constraints fail
function similarity(a: Features, b: Features): number {
  // Hard rule: if both have brands and they differ → reject
  if (a.brand && b.brand && a.brand !== b.brand) return 0;
  // Hard rule: incompatible sizes → reject
  if (!sizesCompatible(a.size, b.size)) return 0;

  const sim = jaccard(a.tokens, b.tokens);

  // Brand match bonus (small)
  if (a.brand && b.brand && a.brand === b.brand) return Math.min(1, sim + 0.1);
  // Both unbranded but tokens match well → still trust it (produce case)
  return sim;
}

// =============================================================================
// 7. MAIN MATCHER
// =============================================================================

interface Anchor {
  features: Features;
  products: ScrapedProduct[];
  merged?: boolean;
}

const MATCH_THRESHOLD = 0.55;

export function matchProducts(allResults: ScrapedProduct[]): ComparisonProduct[] {
  if (allResults.length === 0) return [];

  // Step 1: build features for every product
  const enriched = allResults.map((r) => ({
    product: r,
    features: buildFeatures(r.name, r.unit),
  }));

  // Step 2: dedupe within each platform (same brand+key+size on same platform → keep first)
  const seen = new Map<Platform, Set<string>>();
  const deduped: typeof enriched = [];
  for (const e of enriched) {
    const sizeKey = e.features.size ? `${e.features.size.value}${e.features.size.unit}` : '_';
    const key = `${e.features.brand ?? '_'}|${e.features.productKey}|${sizeKey}`;
    const platSeen = seen.get(e.product.platform) ?? new Set<string>();
    if (platSeen.has(key)) continue;
    platSeen.add(key);
    seen.set(e.product.platform, platSeen);
    deduped.push(e);
  }

  // Step 3: build anchors with strict (brand + key + size) matching
  const anchors: Anchor[] = [];
  for (const e of deduped) {
    const match = anchors.find((a) => {
      if (a.merged) return false;
      // Already has this platform? skip
      if (a.products.some((p) => p.platform === e.product.platform)) return false;
      // Brand must match exactly (both null also OK)
      if (a.features.brand !== e.features.brand) return false;
      // Same productKey
      if (a.features.productKey !== e.features.productKey) return false;
      // Size compatible
      return sizesCompatible(a.features.size, e.features.size);
    });

    if (match) {
      match.products.push(e.product);
    } else {
      anchors.push({ features: e.features, products: [e.product] });
    }
  }

  // Step 4: fuzzy second pass — try to merge single-platform anchors via token similarity
  for (let i = 0; i < anchors.length; i++) {
    const a = anchors[i];
    if (a.merged || a.products.length > 1) continue;

    const aPlatforms = new Set(a.products.map((p) => p.platform));

    let best: { idx: number; score: number } | null = null;

    for (let j = 0; j < anchors.length; j++) {
      if (i === j) continue;
      const b = anchors[j];
      if (b.merged) continue;

      // Don't merge if platforms overlap
      const bPlatforms = new Set(b.products.map((p) => p.platform));
      if ([...aPlatforms].some((p) => bPlatforms.has(p))) continue;

      const score = similarity(a.features, b.features);
      if (score < MATCH_THRESHOLD) continue;

      if (!best || score > best.score) best = { idx: j, score };
    }

    if (best) {
      anchors[best.idx].products.push(...a.products);
      a.merged = true;
    }
  }

  // Step 5: emit
  return anchors
    .filter((a) => !a.merged && a.products.length > 0)
    .map((a, idx) => {
      const available = a.products.filter((p) => p.available);
      const sortedByPrice = (available.length > 0 ? available : a.products)
        .slice()
        .sort((x, y) => x.price - y.price);
      const bestResult = sortedByPrice[0];

      // Pick the most descriptive name (longest among results)
      const displayName = a.products
        .slice()
        .sort((x, y) => y.name.length - x.name.length)[0].name;

      return {
        id: `product_${idx}`,
        name: displayName,
        normalizedName: a.features.productKey,
        imageUrl: a.products.find((p) => p.imageUrl)?.imageUrl,
        unit: a.products.find((p) => p.unit)?.unit,
        results: a.products,
        bestPrice: bestResult.price,
        bestPlatform: bestResult.platform,
      } satisfies ComparisonProduct;
    });
}

// =============================================================================
// Backwards-compat exports
// =============================================================================

export function groupKey(name: string): string {
  return buildFeatures(name).productKey;
}
