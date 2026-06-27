# Entitlement System — Developer Guide

> Unified Free/Pro/Premium gating. Built 2026-06-27 (restructure week 2, additive).
> Source of truth = shipped **Build 7** behaviour.

## TL;DR — how to gate something

```tsx
import { EntitlementGate, useEntitlement, unifiedEntitlementService } from '@/features/entitlement';

// 1) Gate a whole block of UI (hard wall → upsell card on lock)
<EntitlementGate feature="mini_shop.storefront">
  <StorefrontShareButton />
</EntitlementGate>

// 2) Visual preview (show it, but disable the action)
<EntitlementGate feature="pro_report" mode="preview">
  <FancyChart />
</EntitlementGate>

// 3) Imperative check inside logic / before a sensitive action
const ok = await unifiedEntitlementService.canAsync('tax_box'); // server-validated
if (!ok) return showUpgrade();

// 4) Hook for conditional rendering / disabling buttons
const { allowed, readOnly, tier, loading } = useEntitlement('mini_shop');
```

## The 3 layers

| Layer | File | Responsibility | Changes |
|---|---|---|---|
| 1 — Features | [`features/config/featureRegistry.ts`](../config/featureRegistry.ts) | what features exist, route, owning package | rarely |
| 2 — Tiers | [`features/config/tiers.ts`](../config/tiers.ts) | what each tier unlocks + limits | when pricing changes |
| 3 — Service | [`services/entitlement/unifiedEntitlementService.ts`](../../services/entitlement/unifiedEntitlementService.ts) | runtime `can()` / `limit()` / `refresh()` | rarely |

Layer 1 must **not** know about tiers. Layer 2 must **not** know about runtime state.

## It wraps the existing system — it does not replace it

`unifiedEntitlementService` is a **facade** over the legacy
[`services/entitlementService.ts`](../../services/entitlementService.ts) (package on/off in
SQLite + `api.getEntitlement()` sync). Gating resolves exactly as Build 7 does today:

- top-level feature → `entitlementService.isPackageEnabled(pkg)`
- sub-capability → that feature's `*TierConfig` table at the resolved tier
- numeric limit → `tiers.ts` (`limitsForTier`, derived from the same configs)

So adopting it changes **nothing** about behaviour — it just centralises the question.

## Feature ids

Top-level (1:1 with a package): `life_diary`, `mini_shop`, `line_notify`,
`payment_promptpay`, `budget`, `bills`, `savings_goals`, `trip_estimator`,
`category_manage`, `tax_box`.

Sub-capabilities (dotted): `mini_shop.open|orders|promptpay|storefront|line|web_tracking`,
`life_diary.location|export_pdf|ai_reflection|mood_templates|activity_mode|bottom_sheet|watercolor`.

Add a new one in `featureRegistry.ts`, then map its tier in `tiers.ts` / its config table.

## Migration (opportunistic — restructure §8.4)

These older pieces still work and stay until touched. When you edit one, migrate it:

| Old | New |
|---|---|
| `useDiaryTier()` / `useShopTier()` | `useEntitlement('life_diary' \| 'mini_shop')` |
| `features/life-diary/components/FeatureGate` | `EntitlementGate` |
| `Free*Screen.tsx` + `Pro*Screen.tsx` pair | one screen + `<EntitlementGate>` inside |
| direct `entitlementService.setPackageEnabled` | `unifiedEntitlementService.setPackageEnabled` (so `onChange` fires) |

**Rule:** new features never use `Free`/`Pro` filename prefixes.

## Not implemented yet (interface ready, honest stubs)

- **`readOnlyMode()` always returns `false`** — needs subscription-expiry in the
  local store (ADR-003). Wire it when expiry lands.
- **Premium tier** — schema exists; `tierForPackage()` returns `'pro'`/`'free'`
  only until a subscription store distinguishes premium.
- **Server per-action validate** — `canAsync()` re-syncs the package cache (the
  available server signal); a dedicated `/entitlement/validate` endpoint is future.
