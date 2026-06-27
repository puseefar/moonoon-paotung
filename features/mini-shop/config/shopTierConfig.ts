export type ShopTier = 'free' | 'pro' | 'premium';

export const SHOP_TIER_CONFIG = {
  free: {
    canOpenShop: false,
    maxProducts: 0,
    canViewOrders: false,
    canUsePromptPay: false,
    canShareStorefront: false,
    lineNotifications: false,
    webOrderTracking: false,
  },
  pro: {
    canOpenShop: true,
    maxProducts: 5,
    canViewOrders: true,
    canUsePromptPay: true,
    canShareStorefront: true,
    lineNotifications: true,
    webOrderTracking: true,
  },
  premium: {
    canOpenShop: true,
    maxProducts: 999,
    canViewOrders: true,
    canUsePromptPay: true,
    canShareStorefront: true,
    lineNotifications: true,
    webOrderTracking: true,
  },
} as const;

export type ShopFeatureKey = keyof typeof SHOP_TIER_CONFIG['free'];
