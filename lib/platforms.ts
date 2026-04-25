import type { Platform, PlatformInfo } from '@/types';

export const PLATFORMS: Record<Platform, PlatformInfo> = {
  blinkit: {
    id: 'blinkit',
    name: 'Blinkit',
    logoUrl: '/logos/blinkit.png',
    color: '#F8CD00',
  },
  zepto: {
    id: 'zepto',
    name: 'Zepto',
    logoUrl: '/logos/zepto.png',
    color: '#8B2FC9',
  },
  swiggy_instamart: {
    id: 'swiggy_instamart',
    name: 'Swiggy Instamart',
    logoUrl: '/logos/instamart.png',
    color: '#FC8019',
  },
};
