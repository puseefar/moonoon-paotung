/**
 * Layer 2 — Tier Model (CHANGES over time)
 * ----------------------------------------------------------------------------
 * Declares what each tier unlocks and its numeric limits.
 *
 * IMPORTANT (restructure decision 2026-06-27 — "ยึดโค้ด Build 7"):
 * The numeric limits are DERIVED from the already-shipped per-feature configs
 * (`shopTierConfig.ts`, `diaryTierConfig.ts`) so there is exactly ONE source of
 * truth and zero drift from Build 7 behaviour. Do NOT hardcode 5 / 999 here —
 * read it from the feature config via `limitsForTier()`.
 *
 * Migration direction (future / opportunistic): once every feature consumes this
 * layer, flip the dependency so the per-feature configs derive FROM here. For now
 * we bridge the other way to avoid touching shipped files.
 *
 * Reality note: runtime gating of a *package* feature is per-package (each
 * package independently on/off in entitlementService), NOT a single global tier.
 * `TIERS[x].unlocks` documents the INTENDED default split (mirrors
 * PACKAGE_DEFAULTS) and is used for Settings rendering + reconciliation tests;
 * `unifiedEntitlementService.can()` defers to entitlementService at runtime.
 */

import { SHOP_TIER_CONFIG } from '@/features/mini-shop/config/shopTierConfig';
import { DIARY_TIER_CONFIG } from '@/features/life-diary/config/diaryTierConfig';
import type { FeatureId } from './featureRegistry';

export type TierId = 'free' | 'pro' | 'premium';

/** Cross-feature numeric limits resolved for a given tier. -1 = unlimited. */
export interface TierLimits {
  /** Max products in Mini Shop. Build 7: free 0, pro 5, premium 999. */
  miniShopProducts: number;
  /** Max photos per Life Diary entry. Build 7: free 1, pro 5, premium 20. */
  diaryMaxPhotos: number;
  /**
   * Order-history retention window (days). Not yet enforced in Build 7; declared
   * here so reports/cleanup can adopt it. -1 = unlimited.
   */
  orderHistoryDays: number;
}

export interface TierDefinition {
  id: TierId;
  displayName: { th: string; en: string };
  /**
   * Features this tier is entitled to by default. `'*'` = every feature.
   * `free` mirrors PACKAGE_DEFAULTS (the always-on core). Paid packages
   * (life_diary, mini_shop, line_notify, payment_promptpay) are intentionally
   * absent from `free` and unlocked per-purchase at runtime.
   */
  unlocks: FeatureId[] | ['*'];
}

/** Free tier = the always-on core packages (PACKAGE_DEFAULTS === true). */
const FREE_UNLOCKS: FeatureId[] = [
  'budget',
  'bills',
  'savings_goals',
  'trip_estimator',
  'category_manage',
  'tax_box',
];

export const TIERS: Record<TierId, TierDefinition> = {
  free: {
    id: 'free',
    displayName: { th: 'ฟรี', en: 'Free' },
    unlocks: FREE_UNLOCKS,
  },
  pro: {
    id: 'pro',
    displayName: { th: 'โปร', en: 'Pro' },
    unlocks: ['*'],
  },
  premium: {
    id: 'premium',
    // Premium tier schema is defined now (prevents rework) but not yet
    // distinguished at runtime — see useDiaryTier/useShopTier TODOs.
    displayName: { th: 'พรีเมียม', en: 'Premium' },
    unlocks: ['*'],
  },
};

/**
 * Numeric limits for a tier, derived from the shipped feature configs.
 * Keeping this derived means Build 7 stays the single source of truth.
 */
export function limitsForTier(tier: TierId): TierLimits {
  return {
    miniShopProducts: SHOP_TIER_CONFIG[tier].maxProducts,
    diaryMaxPhotos: DIARY_TIER_CONFIG[tier].maxPhotos,
    orderHistoryDays: tier === 'free' ? 30 : -1,
  };
}

/** Does a tier unlock a feature by default policy? (NOT the runtime gate.) */
export function tierUnlocksByDefault(tier: TierId, featureId: FeatureId): boolean {
  const { unlocks } = TIERS[tier];
  if (unlocks[0] === '*') return true;
  return (unlocks as FeatureId[]).includes(featureId);
}
