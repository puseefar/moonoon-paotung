/**
 * Layer 3 — Unified Entitlement Service (FACADE)
 * ----------------------------------------------------------------------------
 * One question for the whole app: `can(featureId)`.
 *
 * This is a FACADE over the existing `services/entitlementService.ts` — it does
 * NOT replace it. The legacy service stays the persistence + server-sync layer
 * (SQLite cache of PackageId on/off, hydrated from `api.getEntitlement()`).
 * This facade adds the unified feature/tier semantics on top so callers stop
 * importing per-feature configs and per-feature `useXTier` hooks.
 *
 * Faithful to shipped Build 7 (decision 2026-06-27):
 *   - package features      → entitlementService.isPackageEnabled(pkg)
 *   - sub-capabilities       → that feature's *TierConfig table at resolved tier
 *   - numeric limits         → tiers.ts (which derives from the same configs)
 *
 * Hybrid source of truth (ADR-002): local cache answers sync UI questions;
 * `refresh()` reconciles from the server (server wins); `canAsync()` re-syncs
 * before a sensitive action.
 */

import { api } from '@/lib/api/client';
import { entitlementService, type PackageId } from '@/services/entitlementService';
import {
  FEATURES,
  owningPackage,
  type FeatureId,
} from '@/features/config/featureRegistry';
import { limitsForTier, type TierId } from '@/features/config/tiers';
import {
  SHOP_TIER_CONFIG,
  type ShopFeatureKey,
} from '@/features/mini-shop/config/shopTierConfig';
import {
  DIARY_TIER_CONFIG,
  type DiaryFeatureKey,
} from '@/features/life-diary/config/diaryTierConfig';

type ShopBoolKey = Exclude<ShopFeatureKey, 'maxProducts'>;
type DiaryBoolKey = Exclude<DiaryFeatureKey, 'maxPhotos'>;

/** Sub-feature id → capability key in the shipped config table. */
const SHOP_SUBFEATURE_KEY: Partial<Record<FeatureId, ShopBoolKey>> = {
  'mini_shop.open': 'canOpenShop',
  'mini_shop.orders': 'canViewOrders',
  'mini_shop.promptpay': 'canUsePromptPay',
  'mini_shop.storefront': 'canShareStorefront',
  'mini_shop.line': 'lineNotifications',
  'mini_shop.web_tracking': 'webOrderTracking',
};

const DIARY_SUBFEATURE_KEY: Partial<Record<FeatureId, DiaryBoolKey>> = {
  'life_diary.location': 'locationPin',
  'life_diary.export_pdf': 'exportPdf',
  'life_diary.ai_reflection': 'aiReflection',
  'life_diary.mood_templates': 'moodTemplates',
  'life_diary.activity_mode': 'activityMode',
  'life_diary.bottom_sheet': 'bottomSheetComposer',
  'life_diary.watercolor': 'watercolorTheme',
};

/** Packages the server currently reports on (see EntitlementResponse.features). */
const SERVER_SYNCED: Record<'pkg05Shop' | 'pkg13Line' | 'pkg15Payment', PackageId> = {
  pkg05Shop: 'pkg-05-marketplace',
  pkg13Line: 'pkg-13-social',
  pkg15Payment: 'pkg-15-payment',
};

let cachedPlanTier: TierId = 'free';
const listeners = new Set<() => void>();

function normalizeTier(t: string): TierId {
  return t === 'pro' || t === 'premium' ? t : 'free';
}

function notify(): void {
  listeners.forEach((cb) => cb());
}

/** Resolve the tier for a package today. TODO Phase 3: distinguish 'premium'. */
async function tierForPackage(pkg: PackageId): Promise<TierId> {
  const enabled = await entitlementService.isPackageEnabled(pkg);
  return enabled ? 'pro' : 'free';
}

export const unifiedEntitlementService = {
  /**
   * Can the user use this feature right now? Resolves against local cache —
   * exactly the way Build 7 gates today (no behaviour change).
   */
  async can(featureId: FeatureId): Promise<boolean> {
    const def = FEATURES[featureId];

    // Top-level feature → gated by its package (ungated features are always on).
    if (!def.parentFeature) {
      if (!def.packageId) return true;
      return entitlementService.isPackageEnabled(def.packageId);
    }

    // Sub-capability → resolve the parent's tier, then read the shipped config.
    const pkg = owningPackage(featureId);
    const tier: TierId = pkg ? await tierForPackage(pkg) : 'free';

    if (def.parentFeature === 'mini_shop') {
      const key = SHOP_SUBFEATURE_KEY[featureId];
      return key ? SHOP_TIER_CONFIG[tier][key] : false;
    }
    if (def.parentFeature === 'life_diary') {
      const key = DIARY_SUBFEATURE_KEY[featureId];
      return key ? DIARY_TIER_CONFIG[tier][key] : false;
    }
    return false;
  },

  /**
   * Server-validated check for a sensitive action (ADR-002). Re-syncs the
   * relevant package from the server first, then answers from fresh cache.
   * For features not marked `serverEnforced` this is equivalent to `can()`.
   */
  async canAsync(featureId: FeatureId): Promise<boolean> {
    if (FEATURES[featureId].serverEnforced) {
      await this.refresh();
    }
    return this.can(featureId);
  },

  /** Resolved tier for the domain a feature belongs to. */
  async tierForFeature(featureId: FeatureId): Promise<TierId> {
    const pkg = owningPackage(featureId);
    return pkg ? tierForPackage(pkg) : 'free';
  },

  /** Max Mini Shop products at the user's current shop tier (Build 7: 0/5/999). */
  async miniShopProductLimit(): Promise<number> {
    const tier = await tierForPackage('pkg-05-marketplace');
    return limitsForTier(tier).miniShopProducts;
  },

  /** Max photos per diary entry at the user's current diary tier (1/5/20). */
  async diaryPhotoLimit(): Promise<number> {
    const tier = await tierForPackage('pkg-01-diary');
    return limitsForTier(tier).diaryMaxPhotos;
  },

  /**
   * Soft read-only state for downgraded users (ADR-003).
   * No subscription-expiry source exists in Build 7, so this is always false
   * today. When expiry lands in the local store, return true for tier-gated
   * data that exceeds the downgraded limit during the read-only window.
   */
  readOnlyMode(_featureId: FeatureId): boolean {
    return false;
  },

  /** Cached global plan tier from the server (default 'free'). For billing/upsell UI. */
  currentPlanTier(): TierId {
    return cachedPlanTier;
  },

  /**
   * Pull canonical entitlement from the server and reconcile local cache.
   * Server wins; offline keeps the existing local cache (ADR-002).
   */
  async refresh(): Promise<void> {
    try {
      const res = await api.getEntitlement();
      if (res.ok) {
        cachedPlanTier = normalizeTier(res.data.tier);
        await Promise.all(
          (Object.keys(SERVER_SYNCED) as (keyof typeof SERVER_SYNCED)[]).map((flag) =>
            entitlementService.setPackageEnabled(SERVER_SYNCED[flag], res.data.features[flag])
          )
        );
        notify();
      }
    } catch {
      /* offline — keep local cache per ADR-002 reconciliation rules */
    }
  },

  /** Subscribe to entitlement changes made through this facade. Returns unsubscribe. */
  onChange(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },

  /**
   * Toggle a package through the facade (so subscribers are notified).
   * Prefer this over calling entitlementService.setPackageEnabled directly in
   * new code, so `onChange` listeners stay in sync.
   */
  async setPackageEnabled(pkg: PackageId, enabled: boolean): Promise<void> {
    await entitlementService.setPackageEnabled(pkg, enabled);
    notify();
  },
};

export type UnifiedEntitlementService = typeof unifiedEntitlementService;
