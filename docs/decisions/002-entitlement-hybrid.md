# ADR-002 — Hybrid entitlement source of truth

**Status:** Accepted · 2026-06-27

## Context
Where does entitlement state live: local, server, or both? Poatung's users are
market vendors who are frequently offline.

## Decision
**Hybrid.** Server is canonical; local SQLite cache answers synchronous/offline
questions; sensitive actions re-validate against the server.

## Rationale
- Local-only → trivially jailbroken (flip a flag = free Pro).
- Server-only → breaks offline use, the core value prop.
- Hybrid balances both.

## Already partially shipped
`entitlementService` + `useShopTier` already do SQLite-first with an
`api.getEntitlement()` fallback. The unified facade formalises this.

## Sensitive actions (must `canAsync` / server-validate)
Buy/renew subscription · sync slip (SlipOK) · export tax doc · Mini Shop
checkout/storefront · PromptPay · LINE Notify.

## Reconciliation
Server wins on conflict. Offline + cache ≤ 7d → use cache; > 7d → treat as Free.
(Stale-window + a dedicated `/entitlement/validate` endpoint are future work.)
