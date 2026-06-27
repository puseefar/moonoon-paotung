# HOW TO MANAGE DOCS — วิธีจัดการเอกสารของโปรเจกต์
> สำหรับ SEVENDOG DEV team

---

## โครงสร้างโฟลเดอร์ที่แนะนำ

```
expense-tracker/
├── docs/                          ← เอกสารทั้งหมดรวมกันที่นี่
│   ├── FILE-MAP.md                ← รายชื่อไฟล์ทั้งหมด + สถานะ (ไฟล์นี้)
│   ├── SETTINGS-SCREEN.md         ← รายละเอียด Settings screen
│   ├── HOW-TO-MANAGE-DOCS.md      ← คู่มือนี้
│   ├── screens/                   ← (ต่อไป) รายละเอียดแต่ละ screen
│   │   ├── home.md
│   │   ├── add-transaction.md
│   │   └── ...
│   └── archive/                   ← เอกสารเก่าที่ไม่ใช้แล้ว แต่ยังเก็บไว้อ้างอิง
│
├── app/                           ← Source code เท่านั้น
├── components/
├── services/
└── ...

poatung-server/
└── docs/                          ← (แนะนำ) เอกสาร server แยกต่างหาก
```

---

## กฎการจัดการเอกสาร

### 1. ไฟล์ที่ควรอยู่ใน `docs/`
- FILE-MAP.md (รายชื่อไฟล์ทั้งหมด)
- รายละเอียด screen แต่ละหน้า
- API contract / spec
- คู่มือการ deploy

### 2. ไฟล์ที่ควรย้ายเข้า `docs/archive/`
ไฟล์ .md ต่อไปนี้อยู่ใน root ของ expense-tracker ไม่ตรงที่ ควรย้าย:

| ไฟล์ปัจจุบัน | ย้ายไปที่ | เหตุผล |
|---|---|---|
| `DEPLOY_PLAN_staging.md` | `docs/archive/` | plan เก่า staging เสร็จแล้ว |
| `DEVELOPMENT-PLAN.md` | `docs/archive/` | plan รวม |
| `FEATURE-INVENTORY.md` | merge เข้า `docs/FILE-MAP.md` | ซ้ำกับ FILE-MAP |
| `IMPLEMENTATION-QUEUE.md` | `docs/archive/` | queue เก่า |
| `MULTI-WALLET-UX-PROPOSAL.md` | `docs/archive/` | proposal เก่า |
| `Moonoon-paotung-pro-pkg-15-13-5-plan.md` | `docs/archive/` | plan PKG-15 เก่า |
| `PLAN_compound-trade-recording.md` | `docs/archive/` | plan เก่า |
| `PREMIUM-AI-HANDOFF.md` | `docs/archive/` | handoff เก่า |
| `PRIVACY_POLICY.md` | **คงไว้** | เอกสารกฎหมาย — ต้องอยู่ root |
| `PROGRESS-LOG.md` | `docs/` หรือ archive | ขึ้นอยู่กับว่ายังอัปเดตอยู่ไหม |
| `Poatung_TradeSet_ReviewMode_Handoff.md` | `docs/archive/` | handoff เก่า |
| `SMART-ASSIST-ROADMAP.md` | `docs/archive/` | roadmap เก่า |
| `STARTER-TEMPLATES-SPEC.md` | `docs/` | spec ที่ยังใช้งานอยู่ |
| `STRATEGIC-FEATURE-ROADMAP.md` | `docs/archive/` | roadmap เก่า |
| `USER_GUIDE.md` | `docs/` | คู่มือผู้ใช้ — ยังใช้งาน |
| `moonoon-paotung-list-icon-widget.md` | `docs/archive/` | icon list เก่า |
| `moonoon-paotung-pro-package-memory.md` | `docs/archive/` | memory เก่า |
| `moonoon-paotung-pro-package-plan.md` | `docs/archive/` | plan เก่า |
| `poatung-trade-cardset-plan.md` | `docs/archive/` | plan เก่า |
| `poatung_phase3_golden_set_spec.md` | `docs/archive/` | spec เก่า |

### 3. ไฟล์ที่ควรอยู่ใน root (d:/NoonStore-Poatung/)
ให้คงไว้ใน root เพียงไม่กี่ไฟล์:

| ไฟล์ | เหตุผลที่คงไว้ |
|---|---|
| `pkg15_implementation_plan.md` | ย้ายเข้า docs/ หรือ archive |
| `pkg15_payment_ux_action_plan.md` | ย้ายเข้า docs/ หรือ archive |
| `plan-improved.md` | ย้ายเข้า docs/ หรือ archive |
| `poatung_pkg15_payment_final_handoff.md` | ย้ายเข้า docs/ หรือ archive |

---

## วิธี Update FILE-MAP.md

ทุกครั้งที่:
- **เพิ่ม screen ใหม่** → เพิ่มแถวใน Section 1 ของ FILE-MAP.md
- **เพิ่ม service ใหม่** → เพิ่มแถวใน Section 4
- **เพิ่ม component ใหม่** → เพิ่มแถวใน Section 6
- **ลบไฟล์** → เปลี่ยน status เป็น ❌ แล้ว archive หรือลบแถวออก

---

## วิธีตรวจสอบไฟล์ที่ไม่ได้ใช้

วิธีง่ายๆ ในการหาไฟล์ที่ไม่มีใครเรียกใช้:

```bash
# หาว่าไฟล์ไหนไม่มี import
# ตัวอย่าง: ตรวจสอบว่า EditScreenInfo.tsx ถูก import ที่ไหนบ้าง
grep -r "EditScreenInfo" --include="*.tsx" --include="*.ts" .
```

ถ้า grep ไม่เจอผลลัพธ์ = ไม่มีใคร import = น่าจะไม่ได้ใช้

---

## หลักการ: ไฟล์ใช้งานจริง vs. ไม่ได้ใช้

**ใช้งานจริง** = ไฟล์ที่:
- มี route ใน Expo Router (มีไฟล์ใน `app/`)
- ถูก import โดยไฟล์อื่น
- ถูกเรียกใน service/store

**ไม่ได้ใช้** = ไฟล์ที่:
- ไม่มีใคร import
- เป็น Expo default template (เช่น `EditScreenInfo.tsx`)
- เป็น dev-only แต่ build เข้า production
- Feature ที่ถูกยกเลิกแล้ว
