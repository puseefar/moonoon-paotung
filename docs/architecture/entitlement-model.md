# Entitlement Model (as-built)

**Status:** Implemented (additive) · **Updated:** 2026-06-27

The unified entitlement system added in restructure week 2. It **wraps** the
existing `services/entitlementService.ts` rather than replacing it (ADR-004).

## Layers

```
 UI / screens
     │  useEntitlement(featureId)  ·  <EntitlementGate feature=…>
     ▼
 services/entitlement/unifiedEntitlementService.ts   ← Layer 3 (facade)
     │            │
     │            ├─ features/config/featureRegistry.ts   ← Layer 1 (what exists)
     │            └─ features/config/tiers.ts             ← Layer 2 (what each tier gets)
     ▼
 services/entitlementService.ts   ← legacy: PackageId on/off (SQLite + server sync)
     │
     ├─ LocalEntitlementSource  = appSettingsService (SQLite key `entitlement.<pkg>`)
     └─ RemoteEntitlementSource = api.getEntitlement()  (server canonical)
```

## Resolution rules (faithful to Build 7)

| Question | Resolved by |
|---|---|
| `can('mini_shop')` (top-level) | `entitlementService.isPackageEnabled('pkg-05-marketplace')` |
| `can('mini_shop.storefront')` (sub) | resolve shop tier → `SHOP_TIER_CONFIG[tier].canShareStorefront` |
| `miniShopProductLimit()` | `limitsForTier(tier).miniShopProducts` (= `SHOP_TIER_CONFIG[tier].maxProducts`) |
| `tierForFeature('life_diary')` | package enabled ? `'pro'` : `'free'` (premium = TODO) |
| `currentPlanTier()` | cached `EntitlementResponse.tier` from last `refresh()` |

## Source of truth — Hybrid (ADR-002)

- **Local cache** answers all synchronous UI questions (offline-first; market vendors).
- **`refresh()`** pulls from server and reconciles — *server wins*. Called on app
  launch / resume. Server reports `pkg05Shop`, `pkg13Line`, `pkg15Payment`.
- **`canAsync()`** re-syncs before a `serverEnforced` action (checkout, PromptPay,
  LINE, tax export). A dedicated `/entitlement/validate` endpoint is future work;
  today it re-syncs the package cache (the available server signal).
- **Offline reconciliation:** server unreachable + cache fresh → use cache;
  cache stale > 7 days → treat as Free (safe). *(stale-window enforcement: future.)*

## Reactivity

`useEntitlement` re-resolves on (a) screen focus — like the legacy `useShopTier` —
and (b) `unifiedEntitlementService.onChange` events, so an in-session upgrade
unlocks features without an app restart.

## Known gaps (interface ready, not yet wired)

1. `readOnlyMode()` → always `false` (needs expiry in local store) — ADR-003.
2. Premium distinction → not resolved at runtime yet.
3. Settings screen still hardcodes its feature list — migrate to `FEATURES` +
   `tierUnlocksByDefault()` (week-2 follow-up).
4. Route guard (`app/navigation/RouteGuard.tsx`) not yet added — `ROUTE_TO_FEATURE`
   + `owningPackage()` are ready for it.
