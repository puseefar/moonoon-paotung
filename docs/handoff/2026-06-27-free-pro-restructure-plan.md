# Moonoon Paotung — Free/Pro Restructure Plan

**Document ID:** `2026-06-27-free-pro-restructure-plan`
**Status:** Draft v1.0 → Pending team review
**Owner:** Pu (Tech Lead, SEVENDOG DEV)
**Created:** 2026-06-27
**Audience:** Coder team, QA team, architecture review
**Supersedes:** team-1 informal proposal (chat, 2026-06-27)
**Related:**
- `PKG-05-CLOSEOUT-ADDENDUM-Build7-v1.0.md` (MiniShop Pro closeout)
- `FEATURE-INVENTORY.md` (existing, to be migrated)
- `STRATEGIC-FEATURE-ROADMAP.md` (existing)

---

## 0. Executive Summary

จบ Pro phase ของ Moonoon Paotung (Build 7) แล้ว ก่อนเริ่ม phase ถัดไป (PKG-13 LINE Notify, Premium tier, server subscription) ต้องจัดระเบียบ codebase และวาง **entitlement architecture** ให้ชัดเจน เพื่อรองรับ:

1. **One app, one codebase, many packages** — ไม่แตกเป็นสอง APK
2. **Tier-driven feature gating** — Free / Pro / (future) Premium ควบคุมจากจุดเดียว
3. **Maintainable docs** — ย้าย markdown/mockup ออกจาก project root
4. **Future-proof** — รองรับ subscription, downgrade, server-side enforcement

เอกสารนี้คือ **executable plan** — coder team อ่านแล้วเริ่มงานได้เลย ไม่ต้องถามเพิ่ม ยกเว้นจุดที่ระบุไว้ใน §11 (Open Questions)

**Timeline:** 2 สัปดาห์ (week 1 = zero-risk reorganize, week 2 = entitlement layer)
**Risk level:** ต่ำ — ไม่แตะ business logic ของฟีเจอร์ที่ ship แล้ว
**Rollback:** git tag `pre-restructure-v1` ก่อนเริ่ม

---

## 1. Background & Problem Statement

### 1.1 สถานะปัจจุบัน

- **Build 7** ผ่าน QA closeout (PKG-05) แล้ว — MiniShop Pro พร้อมขาย
- **Feature inventory** (จากภาพ Settings screen, PDF หน้า 7) ครอบคลุม:
  - **Free:** สมุดชีวิต (basic), Slip Inbox, รายงานสรุป (basic), การแจ้งเตือน, ตงั้คา่ ทวั่ ไป, สำรองข้อมูล
  - **Pro:** สมุดชีวิต (full), PromptPay Dynamic QR, LINE Notify, MiniShop, Pro Trip, รายงานขั้นสูง, ตู้กดเก็บ, รายงานประจำเดือน, ป้ายภาษีกรอบ, สลากสะสมเงิน, Tax Doc, Tax Checklist, รายงานละเอียด
  - **System:** ทรงป้ายฟิน, หมวดหมู่, Starter Templates
- **PKG ที่ยัง backlog:** PKG-13 (LINE Notify), Premium AI, Server subscription

### 1.2 ปัญหาที่พบ

จากการ audit project tree (PDF หน้า 2-5):

**A. Project root รก** — ≈30 ไฟล์ `.md` / `.docx` / `.html` / `.webp` อยู่ที่ `expense-tracker/` root ปนกับ config files (`package.json`, `tsconfig.json`, `metro.config.js`) ทำให้:
- หาไฟล์ config ยาก
- ไม่รู้ว่า `.md` ตัวไหน active ตัวไหน stale
- มี `ProDiaryHomeOld.tsx` หลุดอยู่ใน root (มีคำว่า "Old" ในชื่อ — สัญญาณว่าควรลบ)
- mockup `.html` ของ life-diary อยู่ปนกับ source code

**B. Tier baked ลงใน filename** — ใน `features/mini-shop/screens/` มี:
```
FreeShopScreen.tsx
ProAnalyticsScreen.tsx
ProCheckoutScreen.tsx
ProCreateProductScreen.tsx
ProOrderSuccessScreen.tsx
ProPlaceOrderScreen.tsx
ProProductDetailScreen.tsx
ProShopDashboardScreen.tsx
ProShopOrdersScreen.tsx
ProShopProfileScreen.tsx
ProStorefrontScreen.tsx
```
นี่คือ **code smell** — เป็นการ hardcode entitlement ลงใน file system โดยตรง ปัญหาที่จะเกิด:
- เพิ่ม Premium tier → ต้องสร้าง `PremiumXxx.tsx` อีกชุด → 3 ไฟล์ logic 80% เหมือนกัน
- Downgrade Pro → Free: render `FreeShopScreen` หรือ block `ProShopScreen`? — UX inconsistent
- Bug fix ต้องไล่หลายไฟล์
- ไม่ futureproof สำหรับ A/B test, feature flag, trial mode

**C. ไม่มี entitlement service กลาง** — ตอนนี้แต่ละ screen อาจ check tier เอง (กระจาย logic) ทำให้:
- ไม่มี single source of truth
- จะเพิ่ม tier ใหม่ต้องไล่แก้หลายจุด
- ไม่มี route guard — deep link เข้า Pro screen ได้ตรงๆ
- ไม่มี server validation — local jailbreak ได้ฟรี

**D. ไม่มี policy นิยามชัดเจน** — กรณีต่อไปนี้ยังไม่มีคำตอบ:
- User Pro มีสินค้า 50 ตัวใน MiniShop → subscription หมด → ทำยังไง?
- Free user แตะฟีเจอร์ Pro → เห็น preview, hard wall, หรือ trial?
- Subscription หมดอายุระหว่าง user กำลังใช้งาน → invalidate ทันที หรือรอครบ session?

### 1.3 ทำไมต้องทำตอนนี้

ถ้าเพิ่ม PKG-13 (LINE Notify) เข้าไปก่อน restructure:
- จะเกิดไฟล์ `ProLineNotifyScreen.tsx` (ตาม pattern เดิม) → ปัญหาขยายอีก
- ต้องเขียน tier check ในไฟล์ใหม่อีก → drift จากเดิม
- ถ้าเพิ่ม Premium ทีหลัง จะต้อง refactor ใหญ่ทันที

**ทำตอนนี้ = zero feature pressure** เพราะ Pro phase จบแล้ว ไม่มี deadline บีบ

---

## 2. Goals & Non-Goals

### 2.1 Goals (must)

1. ✅ Project root เหลือเฉพาะ config files + top-level folders
2. ✅ Docs ทั้งหมดย้ายเข้า `docs/` พร้อม structure ที่ค้นง่าย
3. ✅ Feature registry + tier model + entitlement service พร้อมใช้
4. ✅ Route guard ป้องกัน deep link bypass
5. ✅ Policy ชัดเจน 3 เรื่อง: downgrade semantics, upsell UX, source of truth
6. ✅ ฟีเจอร์ใหม่ทุกตัวต้องผ่าน entitlement service (no more `Pro*Screen.tsx`)
7. ✅ Build 7 ยังทำงานเหมือนเดิมหลัง restructure (zero behavior regression)

### 2.2 Non-Goals (won't do in this phase)

- ❌ Refactor `Pro*Screen.tsx` เดิมทั้งหมด — ใช้ **opportunistic refactor** (แก้ตอน touch)
- ❌ เปลี่ยน UX ของ MiniShop Pro ที่ ship ใน Build 7
- ❌ Implement Premium tier — แค่เตรียม architecture รองรับ
- ❌ Implement server-side subscription enforcement — แค่วาง interface
- ❌ Migrate database schema (entitlement state ใช้ local cache + future server endpoint)
- ❌ Localize ใหม่ — ข้อความใน upsell screen ใช้ Thai ตามเดิม

### 2.3 Out of scope (deferred to next phase)

- Real subscription gateway integration (Stripe / TrueMoney / 7-Eleven slip)
- Trial period mechanism
- Family / team plans
- Promo code redemption

---

## 3. Architecture Decisions (ADRs)

จะมี ADR แยกเป็น 3 ไฟล์ใน `docs/decisions/` แต่ summary ของแต่ละ decision อยู่ด้านล่างนี้

### ADR-001: One codebase, not two projects

**Status:** Accepted
**Context:** มีตัวเลือก (a) split เป็น 2 repo / 2 APK, หรือ (b) single codebase ควบคุมด้วย entitlement
**Decision:** (b) Single codebase
**Rationale:**
- Bug fix ครั้งเดียวครอบคลุมทั้ง Free/Pro
- ไม่มี drift ระหว่าง 2 codebase
- Free → Pro upgrade ไม่ต้อง download แอปใหม่
- Code reuse 80%+ ของฟีเจอร์
**Consequences:**
- App bundle ใหญ่ขึ้นเล็กน้อย (รับได้ — แค่ JS bundle, ไม่ใช่ native code)
- ต้องเขียน entitlement layer ให้ดี (ครอบคลุมใน §5)

### ADR-002: Hybrid entitlement source of truth

**Status:** Accepted
**Context:** Entitlement state เก็บที่ไหน? local, server, หรือ hybrid?
**Decision:** **Hybrid** — server เป็น canonical, local cache เป็น hint, sensitive actions validate ที่ server
**Rationale:**
- Local-only: jailbreak ง่าย, ใครเปลี่ยน flag = Pro ฟรี
- Server-only: ต้องออนไลน์ตลอด ขัด value prop ของ Poatung (พ่อค้าแม่ค้าในตลาดสด/ตลาดนัด)
- Hybrid: balance — ออฟไลน์ใช้ได้ตามข้อมูลล่าสุด, online validate sensitive op
**Sensitive actions ที่ต้อง server validate:**
- ซื้อ / ต่ออายุ subscription
- Sync slip ผ่าน SlipOK
- Export tax document
- Activate / deactivate subscription
**Non-sensitive (local cache พอ):**
- Render UI, นำทาง, แสดง preview
- บันทึก transaction (offline-first ของ Poatung เดิม)
- ดูรายงาน (จากข้อมูลที่มี local อยู่แล้ว)
**Consequences:**
- ต้องวาง `EntitlementSource` interface (local + server impl)
- ต้อง refresh entitlement cache เมื่อ app launch + on resume
- ต้องเขียน reconciliation strategy เมื่อ local ↔ server ไม่ตรงกัน (default: server ชนะ)

### ADR-003: Downgrade = soft read-only

**Status:** Accepted
**Context:** User Pro มี 50 สินค้าใน MiniShop → subscription หมด → ทำยังไง?
**Decision:** **Soft read-only** — เห็นข้อมูลครบ, แก้ไข/เพิ่มไม่ได้ จนกว่าจะลบเหลือ ≤ Free limit หรือ upgrade กลับ
**Rationale:**
- Hard block: user รู้สึกเสียข้อมูล → churn สูง
- Auto archive: ระบบลบเองโดยไม่ถาม → trust ตก
- Soft read-only: เคารพ user, ให้เลือกเอง, ไม่หาย, แต่ก็ไม่ปล่อย Pro feature ฟรี
**Consequences:**
- ต้อง implement read-only mode ในทุก screen ที่ใช้ tier-gated data
- ต้องแสดง banner ชัดเจน "Pro หมดอายุ — แก้ไขไม่ได้จนกว่าจะ upgrade หรือลดข้อมูลให้เหลือไม่เกิน 5"
- Export / backup ของข้อมูลเดิมต้องใช้ได้เสมอ (ไม่ tier-gate การ export ข้อมูลที่ user สร้างเองตอนเป็น Pro)

---

## 4. Free/Pro Policy

ไฟล์เต็มจะอยู่ที่ `docs/architecture/free-pro-policy.md` — สรุปประเด็นหลัก:

### 4.1 Tier definitions

| Tier | Price | Audience | Key features |
|---|---|---|---|
| **Free** | 0 บาท | New users, light vendors | สมุดชีวิต basic, transaction tracking, รายงานสรุป, Slip Inbox, MiniShop limit 5 สินค้า |
| **Pro** | (กำหนดภายหลัง) | Active vendors, side hustlers | ทุกฟีเจอร์ใน Settings list, unlimited MiniShop, รายงานละเอียด, Tax Doc/Checklist, PromptPay Dynamic QR, LINE Notify |
| **Premium** *(future)* | (กำหนดภายหลัง) | Power users, AI-assisted | Pro + AI categorizer, AI advisor, multi-shop |

### 4.2 Free MiniShop limits (locked)

- สินค้าสูงสุด: **5 ตัว** (ก่อนหน้านี้กำหนดใน PKG-05 แล้ว)
- Variant สูงสุดต่อสินค้า: **3 ตัว**
- Order history: เก็บได้ **30 วัน** (older auto archive แต่ไม่ลบ)
- Storefront URL: ไม่มี (Pro เท่านั้นที่มี public storefront)
- Analytics: ไม่มี (เห็นแค่ order list)

### 4.3 Upsell UX (per-feature)

ตัดสินใจแยกเป็น 2 mode:

**Hard wall** — ใช้กับฟีเจอร์ที่ต้อง backend / มี cost ต่อ call:
- PromptPay Dynamic QR
- LINE Notify
- MiniShop checkout / storefront / orders
- SlipOK verification
- Tax Doc export

UX: แตะปุ่ม → เด้ง `<UpgradeSheet feature="..." />` modal ทันที, ไม่เข้าหน้าเลย

**Preview mode** — ใช้กับฟีเจอร์ visual ที่โชว์ได้ดี ดึงดูด conversion:
- Pro Trip (เครื่องมือกระตอนวอน)
- รายงานละเอียด (Pro Chart, Bar Chart, รายงานรายเดือน)
- ตู้กดเก็บ
- Tax Checklist

UX: เข้าหน้าได้, เห็น UI จริง + ข้อมูล sample/blurred, action button (save/export) ทำให้เด้ง upgrade

**Implementation:** `<EntitlementGate>` component รับ prop `mode: 'hard' | 'preview'`

### 4.4 Downgrade behavior (ตาม ADR-003)

User Pro → expired → Free:

| Resource | Behavior |
|---|---|
| MiniShop products เกิน 5 | Read-only, banner เตือน, ลบให้เหลือ ≤5 ได้ |
| Pro Trip records | Read-only history, สร้างใหม่ไม่ได้ |
| LINE Notify config | Disconnected, แต่ config เก็บไว้ (re-activate ตอน upgrade) |
| Tax Doc ที่ export แล้ว | เข้าถึงได้เสมอ (file ของ user) |
| Tax Doc ตัวใหม่ | Block — ต้อง upgrade |
| Storefront URL | Inactive (return 404 หรือ landing "shop ปิดชั่วคราว") |
| Reports | View historical, ไม่ generate ใหม่ |

### 4.5 Upgrade behavior

User Free → Pro:
- Entitlement update ภายใน 5 วินาที (ไม่ต้อง restart app)
- Pro features ปลดล็อกทันที
- ข้อมูลเดิมที่เคยถูก read-only กลับมาแก้ไขได้

User Pro → Premium *(future)*:
- Additive — ไม่กระทบ Pro features เดิม

### 4.6 Grace period

หลัง subscription หมด → ให้ **3 วัน grace period** ก่อน enforce read-only

- วันที่ 1-3: banner เตือน "หมดอายุแล้ว ต่ออายุภายใน X วัน"
- วันที่ 4 เป็นต้นไป: enforce read-only ตาม policy ข้างบน

Rationale: ผู้ใช้อาจกดต่ออายุไม่ทัน, มีปัญหาการชำระเงิน, อยู่ในพื้นที่ไม่มีสัญญาณ — ไม่ควรลงโทษทันที

---

## 5. Technical Design

### 5.1 Three-layer model

แยก concern เป็น 3 layer ชัดเจน (ทีม 1 รวมไว้ใน object เดียว — อันนั้นจะลาก dependency กันเอง)

```
┌─────────────────────────────────────┐
│   Layer 1: features.ts (stable)    │  ← ฟีเจอร์มีอะไรบ้าง
└─────────────────────────────────────┘
                  ▲
                  │
┌─────────────────────────────────────┐
│   Layer 2: tiers.ts (changes)       │  ← แต่ละ tier ปลดอะไร, limit เท่าไร
└─────────────────────────────────────┘
                  ▲
                  │
┌─────────────────────────────────────┐
│   Layer 3: entitlementService.ts    │  ← ตอบคำถาม runtime
└─────────────────────────────────────┘
```

### 5.2 Layer 1: Feature Registry

**File:** `features/config/featureRegistry.ts`

```ts
export type FeatureCategory =
  | 'commerce'      // MiniShop, Storefront
  | 'payment'       // PromptPay, SlipOK
  | 'wellness'      // Life Diary
  | 'reporting'     // Reports, Charts
  | 'tax'           // Tax Doc, Tax Checklist
  | 'notification'  // LINE Notify, Alerts
  | 'system'        // Settings, Backup, Categories
  | 'utility';      // Starter Templates, etc.

export type FeatureId =
  | 'life_diary'
  | 'life_diary.advanced'
  | 'promptpay_dynamic'
  | 'line_notify'
  | 'mini_shop'
  | 'mini_shop.analytics'
  | 'mini_shop.storefront'
  | 'pro_trip'
  | 'monthly_report'
  | 'savings_jar'
  | 'savings_lottery'
  | 'reports.detailed'
  | 'tax_doc'
  | 'tax_checklist'
  | 'reports.advanced'
  // ... ครบทุก feature
  ;

export interface FeatureDefinition {
  id: FeatureId;
  category: FeatureCategory;
  route?: string;              // route name (optional — บาง feature เป็น sub-feature ไม่มี route)
  parentFeature?: FeatureId;   // ถ้าเป็น sub-feature
  displayName: { th: string; en: string };
  iconName?: string;
  serverEnforced: boolean;     // ต้อง validate server หรือไม่
}

export const FEATURES: Record<FeatureId, FeatureDefinition> = {
  mini_shop: {
    id: 'mini_shop',
    category: 'commerce',
    route: 'MiniShop',
    displayName: { th: 'Mini Shop', en: 'Mini Shop' },
    iconName: 'storefront',
    serverEnforced: false,
  },
  'mini_shop.analytics': {
    id: 'mini_shop.analytics',
    category: 'commerce',
    parentFeature: 'mini_shop',
    displayName: { th: 'วิเคราะห์ร้าน', en: 'Shop Analytics' },
    serverEnforced: false,
  },
  // ... ทุก feature
};
```

**กฎ:** Layer 1 **ห้ามรู้เรื่อง tier** ทำหน้าที่แค่ declare ว่าฟีเจอร์มีอะไร อยู่ที่ route ไหน

### 5.3 Layer 2: Tier Model

**File:** `features/config/tiers.ts`

```ts
export type TierId = 'free' | 'pro' | 'premium';

export interface TierLimits {
  miniShopProducts: number;        // -1 = unlimited
  miniShopVariantsPerProduct: number;
  orderHistoryDays: number;        // -1 = unlimited
  lifeDiaryEntriesPerMonth: number;
  taxDocExportsPerMonth: number;
  reportsRetentionDays: number;
}

export interface TierDefinition {
  id: TierId;
  displayName: { th: string; en: string };
  unlocks: FeatureId[] | ['*'];    // ['*'] = ทุก feature
  limits: TierLimits;
}

export const TIERS: Record<TierId, TierDefinition> = {
  free: {
    id: 'free',
    displayName: { th: 'ฟรี', en: 'Free' },
    unlocks: [
      'life_diary',
      'mini_shop',
      // ... features ที่ free ใช้ได้
    ],
    limits: {
      miniShopProducts: 5,
      miniShopVariantsPerProduct: 3,
      orderHistoryDays: 30,
      lifeDiaryEntriesPerMonth: 30,
      taxDocExportsPerMonth: 0,
      reportsRetentionDays: 90,
    },
  },
  pro: {
    id: 'pro',
    displayName: { th: 'โปร', en: 'Pro' },
    unlocks: ['*'],   // ทุก feature ยกเว้นของ premium (ถ้ามี)
    limits: {
      miniShopProducts: -1,
      miniShopVariantsPerProduct: -1,
      orderHistoryDays: -1,
      lifeDiaryEntriesPerMonth: -1,
      taxDocExportsPerMonth: -1,
      reportsRetentionDays: -1,
    },
  },
  premium: {
    id: 'premium',
    displayName: { th: 'พรีเมียม', en: 'Premium' },
    unlocks: ['*'],
    limits: { /* เหมือน pro + AI features */ },
  },
};
```

**กฎ:** เพิ่ม tier ใหม่ = แก้ไฟล์นี้ไฟล์เดียว

### 5.4 Layer 3: Entitlement Service

**File:** `services/entitlement/entitlementService.ts`

```ts
export interface EntitlementService {
  // ตรวจสิทธิ์
  can(featureId: FeatureId): boolean;
  canAsync(featureId: FeatureId): Promise<boolean>;  // server-validated สำหรับ sensitive ops

  // ตรวจ limit
  limit(key: keyof TierLimits): number;
  usage(key: keyof TierLimits): Promise<number>;
  remaining(key: keyof TierLimits): Promise<number>;

  // ตรวจ tier
  currentTier(): TierId;
  isExpired(): boolean;
  isInGracePeriod(): boolean;
  daysUntilExpiry(): number | null;

  // Mode detection (สำหรับ downgrade)
  readOnlyMode(featureId: FeatureId): boolean;

  // Lifecycle
  refresh(): Promise<void>;          // ดึงจาก server, update cache
  onChange(cb: (tier: TierId) => void): () => void;  // subscribe
}
```

**Implementation strategy:**

```
┌────────────────────────────────────┐
│  EntitlementService (facade)        │
└────────────────────────────────────┘
         │
         ├──► LocalEntitlementSource (SQLite / AsyncStorage)
         │     - cache: tier, expiry, last_synced_at
         │     - ใช้ตอบ sync queries (can, limit)
         │
         └──► RemoteEntitlementSource (server API)
               - ใช้ตอน refresh, canAsync, sensitive ops
               - timeout 5s, fallback to local cache
```

**Reconciliation rules:**
- Local ↔ Server ไม่ตรง → **server ชนะ** (update local)
- Server unreachable + local cache อายุ ≤7 วัน → ใช้ local
- Server unreachable + local cache อายุ >7 วัน → ถือว่า Free (ปลอดภัยที่สุด)

### 5.5 React integration

**Hook:** `features/entitlement/useEntitlement.ts`

```ts
export function useEntitlement(featureId: FeatureId) {
  const service = useEntitlementService();
  const [state, setState] = useState({
    allowed: service.can(featureId),
    readOnly: service.readOnlyMode(featureId),
    tier: service.currentTier(),
  });

  useEffect(() => {
    return service.onChange(() => {
      setState({
        allowed: service.can(featureId),
        readOnly: service.readOnlyMode(featureId),
        tier: service.currentTier(),
      });
    });
  }, [featureId]);

  return state;
}
```

**Component:** `features/entitlement/EntitlementGate.tsx`

```tsx
type Props = {
  feature: FeatureId;
  mode?: 'hard' | 'preview';
  children: ReactNode;
  fallback?: ReactNode;          // override default UpgradeSheet
};

export function EntitlementGate({ feature, mode = 'hard', children, fallback }: Props) {
  const { allowed, readOnly } = useEntitlement(feature);

  if (!allowed && mode === 'hard') {
    return fallback ?? <UpgradeSheet feature={feature} />;
  }

  if (!allowed && mode === 'preview') {
    return <PreviewWrapper feature={feature}>{children}</PreviewWrapper>;
  }

  if (readOnly) {
    return <ReadOnlyBanner feature={feature}>{children}</ReadOnlyBanner>;
  }

  return <>{children}</>;
}
```

### 5.6 Route guard

**File:** `app/navigation/RouteGuard.tsx`

ใส่ที่ navigation root — block deep link bypass

```tsx
function RouteGuard({ children }: { children: ReactNode }) {
  const navigation = useNavigation();
  const route = useRoute();
  const service = useEntitlementService();

  useEffect(() => {
    const feature = findFeatureByRoute(route.name);
    if (feature && !service.can(feature.id)) {
      // Log unauthorized attempt (for analytics)
      logUnauthorizedAccess(route.name, service.currentTier());

      // Redirect ตาม policy
      navigation.replace('UpgradePrompt', { from: route.name, feature: feature.id });
    }
  }, [route.name]);

  return <>{children}</>;
}
```

### 5.7 Server enforcement (sensitive ops)

สำหรับ `serverEnforced: true` features (ระบุใน featureRegistry):

```ts
// ตัวอย่าง: ก่อน export tax doc
async function exportTaxDoc(data: TaxData) {
  const allowed = await entitlementService.canAsync('tax_doc');
  if (!allowed) {
    throw new EntitlementError('tax_doc');
  }
  // proceed with export
}
```

Server endpoint (future, ยังไม่ implement ใน phase นี้):
```
POST /api/entitlement/validate
Body: { userId, featureId, action }
Response: { allowed: boolean, reason?: string }
```

ใน phase นี้ — stub ที่ return ตาม local cache เลย (ตาม `ADR-002`) แต่ interface ต้องพร้อม

---

## 6. Folder Structure

### 6.1 Target structure

```
expense-tracker/
├── .env
├── .gitignore
├── app.json
├── eas.json
├── package.json
├── package-lock.json
├── tsconfig.json
├── metro.config.js
├── tailwind.config.js
├── drizzle.config.ts
├── global.css
├── nativewind-env.d.ts
├── expo-env.d.ts
│
├── app/                          # Expo Router routes
│   ├── navigation/
│   │   └── RouteGuard.tsx        # ← NEW
│   └── ...
│
├── features/
│   ├── _shared/                  # ← NEW — shared types/utils across features
│   ├── config/                   # ← NEW
│   │   ├── featureRegistry.ts
│   │   ├── tiers.ts
│   │   └── README.md
│   ├── entitlement/              # ← NEW
│   │   ├── EntitlementGate.tsx
│   │   ├── UpgradeSheet.tsx
│   │   ├── ReadOnlyBanner.tsx
│   │   ├── PreviewWrapper.tsx
│   │   ├── useEntitlement.ts
│   │   └── README.md
│   ├── life-diary/               # ← existing
│   ├── mini-shop/                # ← existing (cleanup ใน phase ถัดไป)
│   ├── payment/                  # ← existing
│   ├── tax/                      # ← existing
│   └── starter-template/         # ← existing
│
├── services/
│   ├── entitlement/              # ← NEW
│   │   ├── entitlementService.ts
│   │   ├── LocalEntitlementSource.ts
│   │   ├── RemoteEntitlementSource.ts
│   │   └── __tests__/
│   ├── slip/                     # ← existing (slipok)
│   ├── promptpay/                # ← existing
│   └── ...
│
├── stores/                       # ← existing (Zustand)
├── db/                           # ← existing (Drizzle)
├── components/                   # ← existing (shared UI)
├── hooks/                        # ← existing
├── lib/                          # ← existing
├── constants/                    # ← existing
├── types/                        # ← existing
├── assets/                       # ← existing
├── android/                      # ← existing
├── android-config-backup/        # ← existing (เก็บไว้)
│
├── docs/                         # ← NEW (รวบรวมจาก root)
│   ├── 00-INDEX.md
│   ├── architecture/
│   │   ├── entitlement-model.md
│   │   ├── feature-registry.md
│   │   ├── free-pro-policy.md
│   │   └── data-flow.md
│   ├── specs/
│   │   ├── pkg-05-mini-shop.md
│   │   ├── pkg-13-line-notify.md
│   │   ├── pkg-15-payment.md
│   │   └── pkg-XX-template.md
│   ├── closeout/
│   │   ├── pkg-05-closeout-v1.0.md
│   │   ├── pkg-05-closeout-build7-addendum.md
│   │   └── pkg-15-closeout.md
│   ├── handoff/
│   │   ├── 2026-06-23-pkg05-ui-review.md
│   │   ├── 2026-06-25-build7-qa-triage.md
│   │   └── 2026-06-27-free-pro-restructure.md      ← เอกสารนี้
│   ├── decisions/
│   │   ├── 001-one-codebase.md
│   │   ├── 002-entitlement-hybrid.md
│   │   └── 003-downgrade-soft-readonly.md
│   ├── roadmap/
│   │   ├── strategic-feature-roadmap.md
│   │   └── smart-assist-roadmap.md
│   └── archive/
│       └── 2026-06/                            # ← stale docs ที่ยังไม่กล้าลบ
│
├── mockups/                      # ← merge "morckup" + root .html ลงตรงนี้
│   ├── life-diary/
│   │   ├── home.html
│   │   ├── composer.html
│   │   ├── entry.html
│   │   ├── home-compare.html
│   │   ├── search.html
│   │   └── timeline.html
│   ├── mini-shop/
│   └── _images/                  # webp, png ที่ใช้ใน mockup
│
├── tests/                        # ← existing
├── scripts/                      # ← existing
├── web/                          # ← existing
├── dist/                         # ← gitignore
├── build-output/                 # ← gitignore
└── node_modules/                 # ← gitignore
```

### 6.2 Sub-server (เก็บไว้นอก root)

`poatung-server/` — ปัจจุบันอยู่ที่ `NoonStore-Poatung/poatung-server/` (พี่กับ expense-tracker) **ไม่ย้าย** เพราะคนละ deployment

### 6.3 File-by-file action sheet

ดู §10 (Migration Checklist) สำหรับ inventory เต็ม

---

## 7. Naming Conventions (lock เป็น standard)

### 7.1 Component / Screen files

**❌ ห้ามใช้:** `FreeXxxScreen.tsx`, `ProXxxScreen.tsx`, `PremiumXxxScreen.tsx`

**✅ ใช้:** ชื่อ feature ตรงๆ — แล้วใช้ `<EntitlementGate>` ภายใน

```tsx
// ❌ BAD (current)
// FreeShopScreen.tsx + ProShopDashboardScreen.tsx (2 ไฟล์)

// ✅ GOOD (target)
// ShopDashboardScreen.tsx (1 ไฟล์)
export function ShopDashboardScreen() {
  return (
    <EntitlementGate feature="mini_shop">
      <BaseShopView />
      <EntitlementGate feature="mini_shop.analytics" mode="preview">
        <AnalyticsSection />
      </EntitlementGate>
    </EntitlementGate>
  );
}
```

### 7.2 Docs files

| Type | Pattern | Example |
|---|---|---|
| Architecture (stable) | `kebab-case.md` | `entitlement-model.md` |
| Spec (stable per pkg) | `pkg-NN-feature.md` | `pkg-13-line-notify.md` |
| Closeout (versioned) | `pkg-NN-closeout-vX.Y.md` | `pkg-05-closeout-v1.0.md` |
| Handoff (date) | `YYYY-MM-DD-topic.md` | `2026-06-27-free-pro-restructure.md` |
| ADR | `NNN-title.md` | `001-one-codebase.md` |

### 7.3 Git branches

- `feature/restructure-week1` — สำหรับ docs move
- `feature/restructure-week2-entitlement` — สำหรับ entitlement layer
- ไม่ merge เข้า `master` จนกว่า test ผ่าน + manual smoke test ผ่าน

---

## 8. Migration Plan

### 8.1 Pre-flight (Day 0)

- [ ] ยืนยัน Build 7 stable on production (TestFlight / internal track)
- [ ] `git tag pre-restructure-v1` + push tag
- [ ] สร้าง branch `feature/restructure-week1`
- [ ] Backup `expense-tracker/` ทั้ง folder (zip + Google Drive)
- [ ] ประกาศใน team Slack: freeze ไม่ merge feature branch จนกว่า restructure เสร็จ

### 8.2 Week 1 — Zero-risk reorganize

**Day 1: Inventory + cull**
- [ ] เปิด `docs/handoff/2026-06-27-file-inventory.md` (ดู §10)
- [ ] ไล่ทุกไฟล์ใน root → label: `keep` / `archive` / `delete` / `unsure`
- [ ] List unsure ทั้งหมด → ถามทีม (Slack thread)
- [ ] ลบไฟล์ที่ label `delete` (commit แยก พร้อม reason ใน commit message)

**Day 2: Move docs**
- [ ] สร้างโครงสร้าง `docs/` ตาม §6
- [ ] ย้ายไฟล์ตาม inventory (ใช้ `git mv` เสมอ — preserve history)
- [ ] เขียน `docs/00-INDEX.md` — navigation hub
- [ ] รัน `expo start` → smoke test ว่า build ไม่พัง
- [ ] Commit: `chore(docs): reorganize docs into docs/ structure`

**Day 3: Move mockups**
- [ ] สร้าง `mockups/` ตาม §6
- [ ] ย้าย `morckup/*` + root `.html` files ลง `mockups/`
- [ ] ย้าย `.webp` ของ mockup ลง `mockups/_images/`
- [ ] Smoke test
- [ ] Commit: `chore(mockups): consolidate mockups under mockups/`

**Day 4: Write ADRs + policy doc**
- [ ] `docs/decisions/001-one-codebase.md`
- [ ] `docs/decisions/002-entitlement-hybrid.md`
- [ ] `docs/decisions/003-downgrade-soft-readonly.md`
- [ ] `docs/architecture/free-pro-policy.md` (เนื้อหาจาก §4)
- [ ] `docs/architecture/entitlement-model.md` (เนื้อหาจาก §5)
- [ ] `docs/architecture/feature-registry.md`
- [ ] Code review สำหรับเอกสาร 3 ADR + 3 architecture docs

**Day 5: Buffer + merge week 1**
- [ ] รวม commit, squash ถ้าจำเป็น
- [ ] Open PR → review → merge เข้า `master`
- [ ] Tag `restructure-week1-done`

### 8.3 Week 2 — Entitlement layer

**Day 6: Layer 1 (Feature Registry)**
- [ ] สร้าง `features/config/featureRegistry.ts`
- [ ] List ทุก feature จาก Settings screen (PDF หน้า 7) ครบ
- [ ] Unit test: ทุก route ใน `app/` ต้องมี feature registered (snapshot test)

**Day 7: Layer 2 (Tier Model)**
- [ ] สร้าง `features/config/tiers.ts`
- [ ] Map ทุก feature → tier ที่ unlock ได้
- [ ] Unit test: free tier ต้องไม่มี feature ของ pro (negative test)

**Day 8: Layer 3 (Entitlement Service)**
- [ ] สร้าง `services/entitlement/entitlementService.ts` (facade)
- [ ] สร้าง `LocalEntitlementSource.ts` (SQLite/AsyncStorage)
- [ ] สร้าง `RemoteEntitlementSource.ts` (stub — return local data ใน phase นี้)
- [ ] Unit test: 12 case (ดู §9.2)

**Day 9: React integration**
- [ ] `useEntitlement` hook
- [ ] `<EntitlementGate>` component (hard + preview mode)
- [ ] `<UpgradeSheet>` component (UI ตามที่ทีม design ทำไว้)
- [ ] `<ReadOnlyBanner>` component
- [ ] `<PreviewWrapper>` component
- [ ] Storybook / manual test page

**Day 10: Route guard + Settings screen**
- [ ] `app/navigation/RouteGuard.tsx`
- [ ] Refactor `SettingsScreen` ให้อ่าน feature list จาก registry กลาง
- [ ] Manual test:
  - [ ] Free user เห็น Settings มีเฉพาะ feature ของ free
  - [ ] Pro user เห็นครบ
  - [ ] Deep link `app://mini-shop/dashboard` ตอน free → redirect upgrade
- [ ] Commit + open PR

**Day 11: QA + buffer**
- [ ] รัน test suite เต็ม
- [ ] Manual smoke test ทุก flow ของ Build 7 — ต้องเหมือนเดิม
- [ ] Performance check: app launch time ไม่ช้าขึ้น >100ms
- [ ] Open PR → review → merge

**Day 12: Documentation + handoff**
- [ ] Update `docs/00-INDEX.md`
- [ ] เขียน developer guide สั้น: "วิธีเพิ่ม feature ใหม่"
- [ ] Tag `restructure-week2-done`
- [ ] ประกาศใน team Slack: restructure จบ, เริ่ม PKG-13 ได้

### 8.4 Opportunistic refactor (ongoing)

ฟีเจอร์เดิมที่ใช้ `Pro*Screen.tsx` ยังคงอยู่ — refactor ตอนที่ touch เท่านั้น

**Rule:** ถ้าจะแก้ Pro screen เดิม → ต้อง refactor ออกจาก `Pro*` prefix ในงานนั้นด้วย ห้าม push tech debt ไปข้างหน้าโดยรู้ตัว

ภายใน 3 เดือน คาดว่าทุก `Pro*Screen.tsx` จะถูก refactor ครบ

---

## 9. Test Plan

### 9.1 Unit tests

**Feature Registry (`features/config/featureRegistry.test.ts`)**
- [ ] ทุก feature ID ใน enum ต้องมีใน FEATURES object
- [ ] ทุก feature ที่มี `parentFeature` ต้องชี้ไป feature ที่มีอยู่จริง
- [ ] ทุก feature ที่มี `route` ต้อง match กับ route ใน `app/`

**Tier Model (`features/config/tiers.test.ts`)**
- [ ] ทุก feature ID ใน `unlocks` ต้องมีใน FEATURES
- [ ] Free tier limit ต้อง > 0 ทุกค่า (ยกเว้น `taxDocExportsPerMonth`)
- [ ] Pro tier limit ต้อง -1 (unlimited) ทุกค่า

**Entitlement Service (`services/entitlement/entitlementService.test.ts`)**

| # | Case | Expected |
|---|---|---|
| 1 | Free user ถาม `can('mini_shop')` | true |
| 2 | Free user ถาม `can('mini_shop.analytics')` | false |
| 3 | Pro user ถาม `can('tax_doc')` | true |
| 4 | Expired Pro (grace period) ถาม `can('tax_doc')` | true (ยังใช้ได้) |
| 5 | Expired Pro (พ้น grace) ถาม `can('tax_doc')` | false |
| 6 | Expired Pro ถาม `readOnlyMode('mini_shop')` | true |
| 7 | Free user ถาม `limit('miniShopProducts')` | 5 |
| 8 | Pro user ถาม `limit('miniShopProducts')` | -1 |
| 9 | Server unreachable + cache fresh | use cache |
| 10 | Server unreachable + cache stale >7d | downgrade to free |
| 11 | Server return tier=pro แต่ local=free | update local to pro |
| 12 | `onChange` callback fires เมื่อ tier เปลี่ยน | yes |

### 9.2 Integration tests

- [ ] Free user navigate ถึง `MiniShopDashboard` → block + redirect upgrade
- [ ] Pro user → expired (mock time skip) → MiniShop เปลี่ยนเป็น read-only banner
- [ ] Upgrade Free → Pro → MiniShop unlock โดยไม่ต้อง restart app (≤5 วินาที)
- [ ] Downgrade Pro → Free with 10 products → ทั้ง 10 ยังเห็น, แก้ไขไม่ได้
- [ ] Deep link `app://mini-shop/create` ตอน Free → block, ไม่ enter screen

### 9.3 Manual smoke tests (post-restructure)

Critical paths จาก Build 7 — ต้องทำงานเหมือนเดิม:

- [ ] เปิดแอป → login → Home loads
- [ ] บันทึก transaction (manual entry)
- [ ] บันทึก transaction (slip upload + SlipOK)
- [ ] เปิด MiniShop → สร้างสินค้า (Pro) / เห็น 5 สินค้าแล้ว block (Free)
- [ ] สร้าง Pro Order → checkout → success
- [ ] เปิด Life Diary → บันทึก mood entry
- [ ] เปิด Settings → เห็น list features ถูกต้องตาม tier
- [ ] รายงานสรุป → render กราฟ
- [ ] PromptPay Dynamic QR → generate QR
- [ ] Sync ข้อมูล (ถ้ามี server connection)

### 9.4 Regression test scope

ใช้ test plan ของ PKG-05 closeout เดิม + เพิ่ม entitlement tests ข้างบน

---

## 10. File Inventory Template

สร้างไฟล์ `docs/handoff/2026-06-27-file-inventory.md` ใช้ template นี้

```markdown
# Project Root File Inventory (2026-06-27)

| File | Type | Last modified | Action | Target location | Note |
|---|---|---|---|---|---|
| PRIVACY_POLICY.md | doc | 2026-XX-XX | keep | docs/legal/ | needed for store submission |
| DEVELOPMENT-PLAN.md | doc | 2026-XX-XX | move | docs/roadmap/ | |
| FEATURE-INVENTORY.md | doc | 2026-XX-XX | replace | features/config/featureRegistry.ts | superseded by registry |
| IMPLEMENTATION-QUEUE.md | doc | 2026-XX-XX | move | docs/roadmap/ | |
| moonoon-paotung-list-icon-widget.md | doc | 2026-XX-XX | archive | docs/archive/2026-06/ | stale spec |
| moonoon-paotung-pro-package-memory.md | doc | 2026-XX-XX | archive | docs/archive/2026-06/ | |
| moonoon-paotung-pro-package-plan.md | doc | 2026-XX-XX | move | docs/specs/ | merge into pkg-05 spec |
| Moonoon-paotung-pro-pkg-15-13-5-plan.md | doc | 2026-XX-XX | move | docs/specs/ | rename to pkg-15-payment.md |
| MULTI-WALLET-UX-PROPOSAL.md | doc | 2026-XX-XX | move | docs/specs/ | future feature |
| PLAN_compound-trade-recording.md | doc | 2026-XX-XX | move | docs/specs/ | |
| plan-improved.md | doc | 2026-XX-XX | DELETE | - | superseded, no value |
| poatung_phase3_golden_set_spec.md | doc | 2026-XX-XX | move | docs/specs/ | |
| Poatung_TradeSet_ReviewMode_Handoff.md | doc | 2026-XX-XX | move | docs/handoff/ | rename with date prefix |
| poatung-trade-cardset-plan.md | doc | 2026-XX-XX | move | docs/specs/ | |
| PREMIUM-AI-HANDOFF.md | doc | 2026-XX-XX | move | docs/handoff/ | rename with date prefix |
| ProDiaryHomeOld.tsx | code | 2026-XX-XX | DELETE | - | dead code (name says "Old") |
| PROGRESS-LOG.md | doc | 2026-XX-XX | archive | docs/archive/2026-06/ | superseded by handoff docs |
| SMART-ASSIST-ROADMAP.md | doc | 2026-XX-XX | move | docs/roadmap/ | |
| STARTER-TEMPLATES-SPEC.md | doc | 2026-XX-XX | move | docs/specs/ | |
| STRATEGIC-FEATURE-ROADMAP.md | doc | 2026-XX-XX | move | docs/roadmap/ | |
| USER_GUIDE.md | doc | 2026-XX-XX | move | docs/ | end-user facing |
| PKG-05_MiniShop_Closeout.docx | doc | 2026-XX-XX | move | docs/closeout/ | keep as docx (formal) |
| PKG-05-CLOSEOUT-ADDENDUM-Build7-v1.0.md | doc | 2026-XX-XX | move | docs/closeout/ | |
| PKG-05-CLOSEOUT-ADDENDUM-v1.1.md | doc | 2026-XX-XX | move | docs/closeout/ | |
| PKG-05.1-VARIANT-COST-SPEC.md | doc | 2026-XX-XX | move | docs/specs/ | |
| PKG-05.2-BASEPRICE-AUTODEFAULT-SPEC.md | doc | 2026-XX-XX | move | docs/specs/ | |
| pkg15_implementation_plan.md | doc | 2026-XX-XX | move | docs/specs/ | rename pkg-15-implementation.md |
| pkg15_payment_ux_action_plan.md | doc | 2026-XX-XX | move | docs/specs/ | rename pkg-15-payment-ux.md |
| poatung_pkg15_payment_final_handoff.md | doc | 2026-XX-XX | move | docs/handoff/ | |
| poatung_wallet_ref_handoff_spec.md | doc | 2026-XX-XX | move | docs/handoff/ | |
| dayly-expend.webp | image | 2026-XX-XX | move | mockups/_images/ | |
| landing.webp | image | 2026-XX-XX | move | mockups/_images/ | |
| รายจ่าย-รายรับ (1).webp | image | 2026-XX-XX | move | mockups/_images/ | rename ASCII |
| สถานะ-สุขภาพทางการเงิน.webp | image | 2026-XX-XX | move | mockups/_images/ | rename ASCII |
| Ordder manages.png | image | 2026-XX-XX | move | mockups/_images/ | rename Order-manages.png |
| life-diary-*.html (6 files) | mockup | 2026-XX-XX | move | mockups/life-diary/ | |
| debug.log | log | 2026-XX-XX | DELETE | - | gitignore |
| build-local.ps1 | script | 2026-XX-XX | move | scripts/ | |
| DEPLOY_PLAN_staging.md | doc | 2026-XX-XX | move | docs/ | |
```

> **Action key:** `keep` = stay at root | `move` = relocate | `archive` = move to docs/archive/ | `DELETE` = remove | `replace` = superseded

> **Coder:** ก่อน execute ใส่ `Last modified` ให้ครบจาก `git log` หรือ `stat`

---

## 11. Open Questions (ต้องตอบก่อนเริ่ม Week 1)

ทีมต้องตอบใน Slack thread หรือ comment ในเอกสารนี้ก่อน Day 1:

1. **Server-side enforcement scope** — ใน phase นี้ implement แค่ stub (return local) หรือทำ real endpoint ด้วย?
   - **Pu recommend:** stub only — full server validation ทำใน phase ถัดไป
2. **Premium tier — define ตอนนี้หรือ later?**
   - **Pu recommend:** define schema ตอนนี้ (ป้องกัน rework), แต่ยังไม่ implement features
3. **MiniShop product limit สำหรับ Free** — 5 ตัวล็อกแล้วใช่ไหม? (ใน Build 7)
   - **Status:** ✅ ล็อกแล้ว ตาม PKG-05 closeout
4. **Grace period 3 วัน ตกลงไหม?** หรือควรเป็น 7 วัน?
   - **Pu recommend:** 3 วัน — balance ระหว่าง trust กับ revenue
5. **Downgrade behavior ของ Tax Doc ที่ export ไปแล้ว** — file อยู่ในเครื่อง user แล้ว เราจัดการไม่ได้ใช่ไหม?
   - **Pu confirm:** ใช่ — เราเข้าถึง file หลัง export ไม่ได้ ไม่ต้อง handle
6. **ใครเป็น owner ของ entitlement server endpoint (future)?**
   - **TBD** — discuss with backend team

---

## 12. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Behavior regression หลัง move docs | Low | Low | ไม่แตะ source code ใน week 1, smoke test ทุก commit |
| Behavior regression หลัง add entitlement layer | Medium | High | Feature gate ทุก `<EntitlementGate>` ต้อง default open สำหรับ Pro user (ไม่ block ของเดิม) |
| Performance regression (app launch ช้า) | Low | Medium | Benchmark before/after, fail if >100ms slower |
| Test coverage ไม่พอ → bug หลุด production | Medium | High | Manual smoke test ครบทุก critical path + dogfood 24h ก่อน merge |
| ทีมไม่เข้าใจ pattern ใหม่ → ใช้ผิด | Medium | Medium | เขียน developer guide + pair programming session 1 ครั้ง |
| Stale doc ที่ลบเป็นสิ่งสำคัญ | Low | Medium | ใช้ `git mv` + archive folder (ไม่ลบจริง), recoverable ผ่าน git history |
| Branch conflict กับงานอื่น | Low | Low | Freeze feature merge ระหว่าง week 1-2, รวมไม่เกิน 12 วัน |

---

## 13. Rollback Plan

หากเจอ critical bug หลัง merge:

**Level 1 — UI rollback (≤30 min):**
- Revert PR ของ week ที่มีปัญหา
- Redeploy

**Level 2 — Hard reset (≤2 hours):**
```bash
git reset --hard pre-restructure-v1
git push --force origin master  # ต้อง coordinate กับทีม
```

**Level 3 — Restore from backup:**
- Restore zip backup ของ project (Day 0)
- Re-apply commits ระหว่างนั้น manually

**Decision tree:**
- Doc-only issue → ignore, fix later
- UI bug ใน Pro feature → Level 1
- App crash หรือ data corruption → Level 2 ทันที, RCA หลัง
- Database corruption → Level 3

---

## 14. Acceptance Criteria

Restructure ถือว่าเสร็จเมื่อ:

- [ ] Project root มีเฉพาะไฟล์ใน list ของ §6.1 (config files + top-level folders)
- [ ] `docs/00-INDEX.md` link ครบทุกเอกสาร, ไม่มี dead link
- [ ] `features/config/featureRegistry.ts` registered ทุก feature จาก Settings screen
- [ ] `features/config/tiers.ts` มี Free, Pro และ Premium schema (Premium ใส่ stub ได้)
- [ ] `EntitlementService` ผ่าน 12 unit test cases (§9.2)
- [ ] `<EntitlementGate>` ใช้งานได้ทั้ง hard + preview mode
- [ ] Route guard block deep link bypass (manual test ผ่าน)
- [ ] Settings screen อ่านจาก registry กลาง (ไม่ hardcode feature list)
- [ ] Build 7 critical paths ทำงานเหมือนเดิม (manual smoke test §9.3)
- [ ] App launch time degrade ≤100ms
- [ ] PR merged เข้า `master`, tagged `restructure-week2-done`
- [ ] Developer guide เขียนเสร็จ, ทีมรีวิวแล้ว

---

## 15. Appendix

### 15.1 Reference docs

- `PKG-05-CLOSEOUT-ADDENDUM-Build7-v1.0.md` — สถานะ MiniShop Pro ตอน Build 7
- `STRATEGIC-FEATURE-ROADMAP.md` — roadmap หลังจาก restructure
- `PREMIUM-AI-HANDOFF.md` — เตรียม Premium tier
- Team 1 informal proposal (chat, 2026-06-27) — เอกสารตัวที่ทีม 1 เสนอ (เก็บไว้ใน `docs/archive/2026-06/team1-proposal-2026-06-27.md`)

### 15.2 Glossary

| Term | Meaning |
|---|---|
| Entitlement | สิทธิ์ในการใช้ feature ของ user — กำหนดโดย tier |
| Tier | ระดับสมาชิก (Free, Pro, Premium) |
| Feature ID | string identifier ของฟีเจอร์ในระบบ (e.g. `mini_shop.analytics`) |
| Read-only mode | สถานะที่ user เห็นข้อมูลได้ แต่แก้ไข/เพิ่มไม่ได้ |
| Grace period | ช่วงเวลาหลัง subscription หมด ที่ยังใช้ได้ปกติ (3 วัน) |
| Soft block | UI lock + เด้ง upgrade prompt (ไม่ลบข้อมูล) |
| Hard wall | block ก่อนเข้า screen เลย |
| Preview mode | เข้า screen ได้ เห็น UI + sample data, action block |
| Opportunistic refactor | refactor ตอน touch ไฟล์เพื่อ feature ใหม่ (ไม่ใช่งานแยก) |

### 15.3 Code style notes

- TypeScript strict mode — `any` ห้ามใช้
- ทุก feature ID เป็น string literal type (no magic string)
- Hook ต้องคืน stable reference (ใช้ useMemo/useCallback)
- Component ที่ใช้ entitlement ต้อง re-render ภายใน 1 frame เมื่อ tier เปลี่ยน

---

## 16. Sign-off

| Role | Name | Date | Signature |
|---|---|---|---|
| Tech Lead | Pu | 2026-06-27 | _draft_ |
| Coder Team Rep | | | |
| QA Team Rep | | | |

---

**Status update protocol:** อัปเดต status field ที่ top ของเอกสารทุกครั้งที่มี change

- `Draft v1.0` → first issue (2026-06-27)
- `Draft v1.1` → หลัง team feedback (TBD)
- `Approved v1.0` → หลัง sign-off
- `In progress` → ระหว่าง execute week 1-2
- `Completed v1.0` → หลัง acceptance criteria ครบ
- `Superseded` → ถ้ามี restructure plan ใหม่ทับ

---

*End of document*
