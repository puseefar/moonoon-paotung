# Free / Pro / Premium Policy

**Status:** Authoritative (as-built) · **Updated:** 2026-06-27
**Source of truth:** shipped **Build 7** code, not the draft restructure plan §4.

> ⚠️ This supersedes the tier table in `2026-06-27-free-pro-restructure-plan.md` §4,
> which described limits that do **not** match shipped behaviour (e.g. it said Free
> gets 5 Mini Shop products; Build 7 ships Free = cannot open shop). Decision
> 2026-06-27: **the shipped code is canonical.** See ADR-004.

---

## 1. Model: per-package, not a single global tier

The app is **not** one global Free/Pro switch. Each premium capability is a
**package** that is independently enabled (`services/entitlementService.ts`,
SQLite-cached, server-synced via `api.getEntitlement()`). "Tier" is resolved
*per domain*: a package being enabled ⇒ that domain is `pro`.

```
PACKAGE_DEFAULTS (Build 7):
  free-core (default ON):  budget · bills · goals · trip-estimator · category · tax-box
  paid      (default OFF): diary · marketplace(mini-shop) · social(LINE) · payment(promptpay)
```

Plus the core expense tracker (home, add, history, wallets, slip inbox, reports,
backup) is always available — it is the free product.

## 2. Tier matrix (as shipped)

### Mini Shop — `SHOP_TIER_CONFIG`
| Capability | Free | Pro | Premium |
|---|---|---|---|
| Open shop | ❌ | ✅ | ✅ |
| Max products | **0** | **5** | **999** |
| View orders | ❌ | ✅ | ✅ |
| PromptPay receive | ❌ | ✅ | ✅ |
| Share storefront | ❌ | ✅ | ✅ |
| LINE order alerts | ❌ | ✅ | ✅ |
| Web order tracking | ❌ | ✅ | ✅ |

> Free users land on `FreeShopScreen` (a teaser/upsell), not an empty shop.
> Mini Shop is wholly a **Pro** feature; "Free 5 products" from the plan is **not** shipped.

### Life Diary — `DIARY_TIER_CONFIG`
| Capability | Free | Pro | Premium |
|---|---|---|---|
| Max photos / entry | 1 | 5 | 20 |
| Location pin | ❌ | ✅ | ✅ |
| Export PDF | ❌ | ✅ | ✅ |
| Mood templates | ❌ | ✅ | ✅ |
| Activity mode | ❌ | ✅ | ✅ |
| Bottom-sheet composer | ❌ | ✅ | ✅ |
| Watercolor theme | ❌ | ✅ | ✅ |
| AI reflection | ❌ | ❌ | ✅ |

> Diary defaults **locked** (`pkg-01-diary = false`). Free = a basic/teaser diary.
> Only **AI reflection** is Premium-exclusive today.

### Other paid packages
| Package | Free | Pro |
|---|---|---|
| LINE Notify (`pkg-13-social`) | ❌ | ✅ |
| PromptPay Payment (`pkg-15-payment`) | ❌ | ✅ |

## 3. Upsell UX (target — restructure §4.3)

- **Hard wall** (backend/cost features): Mini Shop checkout/storefront/orders,
  PromptPay, LINE Notify, Tax Doc export → `<EntitlementGate mode="hard">` ⇒ upsell card.
- **Preview** (visual features): Pro reports/charts, diary watercolor, trip tools →
  `<EntitlementGate mode="preview">` ⇒ show UI, disable the action.

## 4. Downgrade — soft read-only (ADR-003)

When a Pro package lapses, **data is never deleted**.

| Resource | On downgrade |
|---|---|
| Mini Shop products over the Free limit | read-only; user may delete down to limit or re-upgrade |
| Diary Pro entries | read history; can't create Pro-only content |
| LINE config | disconnected, config retained for re-activation |
| Exported files (PDF/CSV) | always accessible — they live on the user's device |
| Reports | view historical, no new generation |

**Status:** policy defined; enforcement is a **future** step —
`unifiedEntitlementService.readOnlyMode()` returns `false` until subscription
expiry exists in the local store. Do not claim it works until then.

## 5. Grace period

**3 days** after expiry before read-only is enforced (banner-only during grace).
Rationale: market vendors may miss renewal / have no signal. (Future, with expiry.)

## 6. Upgrade

Free → Pro unlocks within ~5s, no app restart: `unifiedEntitlementService.refresh()`
updates the cache and fires `onChange`, which `useEntitlement` listens to.
