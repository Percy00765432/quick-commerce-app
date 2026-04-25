export type Platform = 'blinkit' | 'zepto' | 'swiggy_instamart';

export interface PlatformInfo {
  id: Platform;
  name: string;
  logoUrl: string;
  color: string;
}

export interface ScrapedProduct {
  platform: Platform;
  name: string;
  price: number;
  originalPrice?: number;
  imageUrl?: string;
  unit?: string;           // e.g. "500g", "1 litre"
  available: boolean;
  deliveryFee: number;
  deliveryTime?: string;   // e.g. "10 mins"
  productUrl?: string;
}

export interface ComparisonProduct {
  id: string;
  name: string;
  normalizedName: string;
  imageUrl?: string;
  unit?: string;
  category?: string;
  results: ScrapedProduct[];
  bestPrice: number;
  bestPlatform: Platform;
}

export interface SearchParams {
  query: string;
  pincode: string;
}

export interface SearchResponse {
  query: string;
  pincode: string;
  products: ComparisonProduct[];
  errors: { platform: Platform; message: string }[];
  summaryError?: string;
  cachedAt?: string;
}

export interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}
