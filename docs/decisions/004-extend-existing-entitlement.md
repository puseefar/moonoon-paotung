# ADR-004 — Extend the existing entitlement system, don't rebuild it

**Status:** Accepted · 2026-06-27
**Deviates from:** restructure plan §1.2.C and §5.

## Context
The restructure plan states "there is no central entitlement service" (§1.2.C)
and §5 specifies building one from scratch. An audit of the actual codebase on
2026-06-27 found this is **not true** — an entitlement foundation already ships
in Build 7:

- `services/entitlementService.ts` — PackageId on/off, SQLite-cached, server-synced
  via `api.getEntitlement()` (a partial hybrid model per ADR-002 already).
- `features/*/config/*TierConfig.ts` — per-feature tier capability tables.
- `features/*/hooks/use{Shop,Diary}Tier.ts` — per-feature tier hooks.
- `features/life-diary/components/FeatureGate.tsx` — a gate component.
- `features/*/{MiniShop,LifeDiary}Router.tsx` — feature routers.
- Dev Tools entitlement toggles in Settings (`__DEV__`).

Building the plan's §5 system verbatim would create a **second, parallel**
entitlement system — exactly the duplication Team 3 warned against.

## Decision
**Extend and unify** the existing system:
- Keep `entitlementService` as the persistence + server-sync layer.
- Add Layer 1 (`featureRegistry.ts`) and Layer 2 (`tiers.ts`) on top.
- Add a **facade** `unifiedEntitlementService` that delegates to the legacy
  service and the shipped tier configs — same behaviour, one entry point.
- Collapse the per-feature `useXTier` hooks into one `useEntitlement(featureId)`,
  and `FeatureGate` → `EntitlementGate`, via **opportunistic** migration (§8.4) —
  no big-bang rewrite.

## Consequences
- Zero behaviour change vs Build 7 (the facade resolves gating identically).
- The plan's §1.2.C / §5 are corrected; see
  `handoff/2026-06-27-restructure-reconciliation.md`.
- Legacy `useShopTier` / `useDiaryTier` / `FeatureGate` remain until migrated.
