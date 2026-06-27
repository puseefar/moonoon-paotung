# Docs Index — Moonoon Paotung (expense-tracker)

> Navigation hub. Updated 2026-06-27 after the docs/mockups reorg.
> All project docs live here (co-located with code). Only `PRIVACY_POLICY.md`
> stays at the repo root (store/legal requirement).

## Structure

```
docs/
├── 00-INDEX.md            ← this file
├── FILE-MAP.md            ← file-by-file status of the codebase
├── HOW-TO-MANAGE-DOCS.md  ← doc conventions for the team
├── README.md
├── SETTINGS-SCREEN.md
├── USER_GUIDE.md          ← end-user guide
├── STARTER-TEMPLATES-SPEC.md
├── architecture/          ← how the system works (stable)
├── decisions/             ← ADRs (numbered)
├── specs/                 ← active feature specs
├── closeout/              ← package closeout reports
├── handoff/               ← dated handoffs / session snapshots
├── roadmap/               ← forward-looking plans
└── archive/2026-06/       ← stale docs (kept for reference)
```

## Architecture
- [architecture/free-pro-policy.md](architecture/free-pro-policy.md) — **authoritative** Free/Pro/Premium tier matrix (as-built, Build 7)
- [architecture/entitlement-model.md](architecture/entitlement-model.md) — how entitlement resolves at runtime

## Decisions (ADR)
- [decisions/001-one-codebase.md](decisions/001-one-codebase.md)
- [decisions/002-entitlement-hybrid.md](decisions/002-entitlement-hybrid.md)
- [decisions/003-downgrade-soft-readonly.md](decisions/003-downgrade-soft-readonly.md)
- [decisions/004-extend-existing-entitlement.md](decisions/004-extend-existing-entitlement.md) — why we extended (not rebuilt) the entitlement system

## Active specs
- `specs/PKG-05.1-VARIANT-COST-SPEC.md`, `specs/PKG-05.2-BASEPRICE-AUTODEFAULT-SPEC.md`

## Closeout
- `closeout/PKG-05-CLOSEOUT-ADDENDUM-Build7-v1.0.md`, `closeout/PKG-05-CLOSEOUT-ADDENDUM-v1.1.md`, `closeout/PKG-05_MiniShop_Closeout.docx`

## Handoff
- [handoff/2026-06-27-restructure-reconciliation.md](handoff/2026-06-27-restructure-reconciliation.md) — **start here** for the Free/Pro restructure
- `handoff/2026-06-27-free-pro-restructure-plan.md` — the original driving plan
- `handoff/PREMIUM-AI-HANDOFF.md`, `handoff/Poatung_TradeSet_ReviewMode_Handoff.md`, `handoff/poatung_pkg15_payment_final_handoff.md`, `handoff/poatung_wallet_ref_handoff_spec.md`

## Roadmap
- `roadmap/STRATEGIC-FEATURE-ROADMAP.md`, `roadmap/SMART-ASSIST-ROADMAP.md`

## Related
- Code guide: [../features/entitlement/README.md](../features/entitlement/README.md)
- Mockups: [../mockups/](../mockups/) — `life-diary/`, `mini-shop/`, `_images/`
  (`life-diary/_superseded/` = older root copies kept for diff; safe to purge after review)
