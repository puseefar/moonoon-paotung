# Restructure — Reconciliation & Progress Handoff

**Date:** 2026-06-27 · **By:** Claude (exec of `2026-06-27-free-pro-restructure-plan.md`)
**Status:** Week-2 entitlement layer landed (additive). File reorg (week 1) **deferred** — see §4.

This records where the restructure plan met reality, what was decided, what was
built, and exactly what remains.

---

## 1. The plan was right in direction, wrong in 4 premises

Audit of the actual repo on 2026-06-27 found these gaps vs the draft plan:

| # | Plan said | Reality (Build 7) | Impact |
|---|---|---|---|
| 1 | "No central entitlement service" (§1.2.C); build one in §5 | `entitlementService.ts` + tier configs + `FeatureGate` + per-feature hooks + routers already ship | Building §5 verbatim = duplicate system. → **ADR-004: extend, not rebuild** |
| 2 | Free gets 5 Mini Shop products; Pro unlimited (§4) | Mini Shop is Pro-only: Free=0/can't open, **Pro=5**, Premium=999. Diary defaults locked | Encoding §4 would break shipped gating. → **Decision: code is canonical** |
| 3 | "Build 7 stable, tag & go" (§8.1) | Working tree has **~75 uncommitted files** incl. all of `features/mini-shop/`, `app/shop-*.tsx`, `db/schema.ts` | A tag won't protect uncommitted work; moving files now risks tangling it. → **file reorg deferred** |
| 4 | Create `docs/` + `mockups/` fresh (§6) | Both already exist; `docs/` has its own scheme (`FILE-MAP.md`, `HOW-TO-MANAGE-DOCS.md`); mockups duplicated across 3 locations | Reorg must reconcile/dedup, not overwrite |

## 2. Decisions locked (2026-06-27)

1. **Source of truth = shipped Build 7 code** (not plan §4). Tier matrix corrected
   in `architecture/free-pro-policy.md`. *(user-confirmed)*
2. **This round = additive-only.** Build the entitlement layer as new files; do no
   moves/deletes until the WIP is committed. *(user-confirmed)*
3. **Extend, don't duplicate** the entitlement system — ADR-004.
4. Plan §11 open questions resolved per Pu's recommendations: server validate =
   stub; Premium = define schema now, don't implement; grace = 3 days.

## 3. Built this round (all additive — 0 changes to existing files)

| File | Layer |
|---|---|
| `features/config/featureRegistry.ts` | 1 — feature graph + package mapping |
| `features/config/tiers.ts` | 2 — tier unlocks + limits (derived from shipped configs) |
| `services/entitlement/unifiedEntitlementService.ts` | 3 — facade over legacy service |
| `features/entitlement/useEntitlement.ts` | hook |
| `features/entitlement/EntitlementGate.tsx` | gate (hard/preview) |
| `features/entitlement/index.ts` | barrel |
| `features/entitlement/README.md` | dev guide |
| `docs/architecture/{free-pro-policy,entitlement-model}.md` | architecture |
| `docs/decisions/00{1,2,3,4}-*.md` | ADRs |

**Verification:** `npx tsc --noEmit` → 0 errors in the new files. (3 pre-existing
errors remain in WIP: `app/(tabs)/add.tsx` route typing, and `ProDiaryHomeOld.tsx`
— a dead file the plan already marks DELETE.)

**Behaviour change:** none. Nothing imports the new layer yet; gating still runs
through the legacy path. Adoption is opportunistic (§8.4).

## 4. Deferred — needs a clean tree first

### 4.1 Commit the WIP (BLOCKER for everything below)
~75 modified + many untracked files. Recommended grouping before any file moves:
```
git add features/mini-shop app/shop-*.tsx        # PKG-05 Mini Shop
git add features/life-diary app/diary-*.tsx       # PKG-01 Diary
git add db/ services/ stores/ lib/ components/ app/(tabs)
# review each chunk, commit with clear messages, then:
git tag pre-restructure-v1
```
Do **not** `git mv` / delete anything until this is done and pushed.

### 4.2 File reorg (week 1) — after commit
- **Cull first:** `ProDiaryHomeOld.tsx` (dead, broken imports — confirmed), `debug.log`,
  `plan-improved.md`. Verify no imports before deleting.
- **Dedup mockups (3 locations):** `expense-tracker/mockups/` (tracked) vs
  `NoonStore-Poatung/*.html` (loose) vs `NoonStore-Poatung/morckup/`. Keep the most
  complete copy per screen; consolidate under `expense-tracker/mockups/{life-diary,mini-shop}/`.
- **Move root `.md`** into `docs/` per the existing `HOW-TO-MANAGE-DOCS.md` map
  (reconcile with plan §6 — the existing scheme is simpler and already adopted).
- Reconcile `docs/FILE-MAP.md` (note: it lists `services/entitlementService.ts` as
  "ตรวจสอบสิทธิ์ Premium" — still accurate; add the new entitlement files).

### 4.3 Code follow-ups (week 2 remainder)
- `app/navigation/RouteGuard.tsx` using `ROUTE_TO_FEATURE` + `owningPackage` (deep-link block).
- Migrate `SettingsScreen` to read its feature list from `FEATURES` / `tierUnlocksByDefault`.
- Unit tests: the 12 entitlement cases (plan §9.2), adapted to the per-package model.
- Wire `readOnlyMode` once subscription expiry is in the local store.
- Opportunistic: `useShopTier`/`useDiaryTier` → `useEntitlement`; `FeatureGate` → `EntitlementGate`.

## 5. Pointers
- Policy (authoritative): `architecture/free-pro-policy.md`
- How it works: `architecture/entitlement-model.md`
- How to use it: `../../features/entitlement/README.md`
- Why we deviated from §5: `decisions/004-extend-existing-entitlement.md`
