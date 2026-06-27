/**
 * Layer 1 — Feature Registry (STABLE)
 * ----------------------------------------------------------------------------
 * Declares WHAT features exist, their category, route, and which existing
 * "package" gates them. This layer MUST NOT know about tiers/limits — that is
 * Layer 2 (`tiers.ts`). It only describes the feature graph.
 *
 * Source of truth = shipped Build 7 (per restructure decision 2026-06-27):
 *   - Package gating lives in `services/entitlementService.ts` (PackageId on/off)
 *   - Per-feature capabilities live in each feature's `*TierConfig.ts`
 * This registry is the unified index that bridges the two, so new code can ask
 * one question — `can(featureId)` — instead of importing per-feature configs.
 *
 * RULE (restructure §7): new features register here. No more `Pro*Screen.tsx` /
 * `Free*Screen.tsx` filenames — gate at runtime via <EntitlementGate feature="...">.
 */

import type { PackageId } from '@/services/entitlementService';

export type FeatureCategory =
  | 'commerce' // Mini Shop, storefront, orders
  | 'payment' // PromptPay dynamic QR, SlipOK
  | 'wellness' // Life Diary
  | 'reporting' // reports, charts
  | 'tax' // Tax Box / Tax Checklist
  | 'notification' // LINE Notify, alerts
  | 'budgeting' // budget, bills, recurring, savings, trip estimator
  | 'system'; // categories, backup, settings, starter templates

/**
 * Canonical feature identifiers. Top-level ids map 1:1 to an entitlement
 * package; dotted ids are sub-capabilities resolved from the parent feature's
 * tier-config table.
 */
export type FeatureId =
  // ── Top-level package features (gated by entitlementService.isPackageEnabled)
  | 'life_diary' // pkg-01-diary   (paid)
  | 'mini_shop' // pkg-05-marketplace (paid)
  | 'line_notify' // pkg-13-social  (paid)
  | 'payment_promptpay' // pkg-15-payment (paid)
  | 'budget' // pkg-02-budget  (free-core, default on)
  | 'bills' // pkg-03-bills   (free-core)
  | 'savings_goals' // pkg-07-goals   (free-core)
  | 'trip_estimator' // pkg-14-estimator (free-core)
  | 'category_manage' // pkg-16-category (free-core)
  | 'tax_box' // pkg-17-taxbox  (free-core)
  // ── Mini Shop sub-capabilities (resolved from SHOP_TIER_CONFIG)
  | 'mini_shop.open'
  | 'mini_shop.orders'
  | 'mini_shop.promptpay'
  | 'mini_shop.storefront'
  | 'mini_shop.line'
  | 'mini_shop.web_tracking'
  // ── Life Diary sub-capabilities (resolved from DIARY_TIER_CONFIG)
  | 'life_diary.location'
  | 'life_diary.export_pdf'
  | 'life_diary.ai_reflection'
  | 'life_diary.mood_templates'
  | 'life_diary.activity_mode'
  | 'life_diary.bottom_sheet'
  | 'life_diary.watercolor';

export interface FeatureDefinition {
  id: FeatureId;
  category: FeatureCategory;
  displayName: { th: string; en: string };
  /**
   * Owning entitlement package. Present on every top-level feature.
   * Sub-features inherit gating from their `parentFeature`'s package.
   */
  packageId?: PackageId;
  /** Set on sub-capabilities; points at the top-level feature that owns the tier config. */
  parentFeature?: FeatureId;
  /** Primary Expo Router route (used by the route guard to map url → feature). */
  route?: string;
  /**
   * If true, a sensitive action behind this feature must be re-validated against
   * the server before proceeding (ADR-002). UI rendering may still use local cache.
   */
  serverEnforced: boolean;
}

export const FEATURES: Record<FeatureId, FeatureDefinition> = {
  // ── Paid packages ─────────────────────────────────────────────────────────
  life_diary: {
    id: 'life_diary',
    category: 'wellness',
    displayName: { th: 'สมุดชีวิต', en: 'Life Diary' },
    packageId: 'pkg-01-diary',
    route: '/diary',
    serverEnforced: false,
  },
  mini_shop: {
    id: 'mini_shop',
    category: 'commerce',
    displayName: { th: 'Mini Shop', en: 'Mini Shop' },
    packageId: 'pkg-05-marketplace',
    route: '/shop-manage',
    serverEnforced: true, // checkout / storefront involve backend
  },
  line_notify: {
    id: 'line_notify',
    category: 'notification',
    displayName: { th: 'LINE แจ้งเตือน', en: 'LINE Notify' },
    packageId: 'pkg-13-social',
    route: '/line-connect',
    serverEnforced: true,
  },
  payment_promptpay: {
    id: 'payment_promptpay',
    category: 'payment',
    displayName: { th: 'รับชำระเงิน PromptPay', en: 'PromptPay' },
    packageId: 'pkg-15-payment',
    route: '/payment-qr',
    serverEnforced: true,
  },

  // ── Free-core packages (PACKAGE_DEFAULTS = true) ──────────────────────────
  budget: {
    id: 'budget',
    category: 'budgeting',
    displayName: { th: 'วางแผนงบประมาณ', en: 'Budget' },
    packageId: 'pkg-02-budget',
    route: '/budget',
    serverEnforced: false,
  },
  bills: {
    id: 'bills',
    category: 'budgeting',
    displayName: { th: 'ติดตามบิล', en: 'Bills' },
    packageId: 'pkg-03-bills',
    route: '/bills',
    serverEnforced: false,
  },
  savings_goals: {
    id: 'savings_goals',
    category: 'budgeting',
    displayName: { th: 'เป้าหมายการออม', en: 'Savings Goals' },
    packageId: 'pkg-07-goals',
    route: '/savings',
    serverEnforced: false,
  },
  trip_estimator: {
    id: 'trip_estimator',
    category: 'budgeting',
    displayName: { th: 'เตรียมงบก่อนออก', en: 'Trip Estimator' },
    packageId: 'pkg-14-estimator',
    route: '/trip-estimator',
    serverEnforced: false,
  },
  category_manage: {
    id: 'category_manage',
    category: 'system',
    displayName: { th: 'หมวดหมู่', en: 'Categories' },
    packageId: 'pkg-16-category',
    route: '/category-manage',
    serverEnforced: false,
  },
  tax_box: {
    id: 'tax_box',
    category: 'tax',
    displayName: { th: 'กล่องลดหย่อนภาษี', en: 'Tax Box' },
    packageId: 'pkg-17-taxbox',
    route: '/tax-box',
    serverEnforced: false,
  },

  // ── Mini Shop sub-capabilities (keys mirror SHOP_TIER_CONFIG) ─────────────
  'mini_shop.open': {
    id: 'mini_shop.open',
    category: 'commerce',
    parentFeature: 'mini_shop',
    displayName: { th: 'เปิดร้าน', en: 'Open Shop' },
    serverEnforced: false,
  },
  'mini_shop.orders': {
    id: 'mini_shop.orders',
    category: 'commerce',
    parentFeature: 'mini_shop',
    displayName: { th: 'รายการออเดอร์', en: 'Orders' },
    route: '/shop-orders',
    serverEnforced: true,
  },
  'mini_shop.promptpay': {
    id: 'mini_shop.promptpay',
    category: 'payment',
    parentFeature: 'mini_shop',
    displayName: { th: 'รับเงินผ่าน PromptPay', en: 'Shop PromptPay' },
    serverEnforced: true,
  },
  'mini_shop.storefront': {
    id: 'mini_shop.storefront',
    category: 'commerce',
    parentFeature: 'mini_shop',
    displayName: { th: 'หน้าร้านออนไลน์', en: 'Storefront' },
    route: '/shop-storefront',
    serverEnforced: true,
  },
  'mini_shop.line': {
    id: 'mini_shop.line',
    category: 'notification',
    parentFeature: 'mini_shop',
    displayName: { th: 'แจ้งเตือนออเดอร์ทาง LINE', en: 'Shop LINE Alerts' },
    serverEnforced: true,
  },
  'mini_shop.web_tracking': {
    id: 'mini_shop.web_tracking',
    category: 'commerce',
    parentFeature: 'mini_shop',
    displayName: { th: 'ติดตามออเดอร์ผ่านเว็บ', en: 'Web Order Tracking' },
    serverEnforced: true,
  },

  // ── Life Diary sub-capabilities (keys mirror DIARY_TIER_CONFIG) ───────────
  'life_diary.location': {
    id: 'life_diary.location',
    category: 'wellness',
    parentFeature: 'life_diary',
    displayName: { th: 'ปักหมุดสถานที่', en: 'Location Pin' },
    serverEnforced: false,
  },
  'life_diary.export_pdf': {
    id: 'life_diary.export_pdf',
    category: 'wellness',
    parentFeature: 'life_diary',
    displayName: { th: 'ส่งออก PDF', en: 'Export PDF' },
    serverEnforced: false,
  },
  'life_diary.ai_reflection': {
    id: 'life_diary.ai_reflection',
    category: 'wellness',
    parentFeature: 'life_diary',
    displayName: { th: 'AI สะท้อนความรู้สึก', en: 'AI Reflection' },
    serverEnforced: true, // Premium AI — server-metered
  },
  'life_diary.mood_templates': {
    id: 'life_diary.mood_templates',
    category: 'wellness',
    parentFeature: 'life_diary',
    displayName: { th: 'เทมเพลตอารมณ์', en: 'Mood Templates' },
    serverEnforced: false,
  },
  'life_diary.activity_mode': {
    id: 'life_diary.activity_mode',
    category: 'wellness',
    parentFeature: 'life_diary',
    displayName: { th: 'โหมดกิจกรรม', en: 'Activity Mode' },
    serverEnforced: false,
  },
  'life_diary.bottom_sheet': {
    id: 'life_diary.bottom_sheet',
    category: 'wellness',
    parentFeature: 'life_diary',
    displayName: { th: 'ตัวเขียนแบบ Bottom Sheet', en: 'Bottom Sheet Composer' },
    serverEnforced: false,
  },
  'life_diary.watercolor': {
    id: 'life_diary.watercolor',
    category: 'wellness',
    parentFeature: 'life_diary',
    displayName: { th: 'ธีมสีน้ำ', en: 'Watercolor Theme' },
    serverEnforced: false,
  },
};

/** All registered feature ids (handy for tests / iteration). */
export const ALL_FEATURE_IDS = Object.keys(FEATURES) as FeatureId[];

/** Reverse index: Expo Router route → feature id (used by the route guard). */
export const ROUTE_TO_FEATURE: Record<string, FeatureId> = Object.values(FEATURES).reduce(
  (acc, def) => {
    if (def.route) acc[def.route] = def.id;
    return acc;
  },
  {} as Record<string, FeatureId>
);

/** Resolve the package that ultimately gates a feature (walks up to its parent). */
export function owningPackage(featureId: FeatureId): PackageId | undefined {
  const def = FEATURES[featureId];
  if (def.packageId) return def.packageId;
  if (def.parentFeature) return FEATURES[def.parentFeature].packageId;
  return undefined;
}
