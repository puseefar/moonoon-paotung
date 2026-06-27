# แผนปรับปรุง: การบันทึกรายการแบบ "ซื้อมาขายไป" (Compound Trade)
**โปรเจกต์:** หมูนุ่น–เป๋าตุง (Poatung)
**สำหรับ:** ทีมโค้ดเดอร์
**เขียนโดย:** Tech Lead (ผ่าน Claude)
**วันที่:** 7 มิ.ย. 2569

---

## 0. สถานะการดำเนินการ (อัปเดต 7 มิ.ย. 2569 — Expo app / Drizzle+SQLite)

> แผนนี้เขียนสำหรับ backend (Prisma/PG) แต่ quick-add ของเราทำงานใน Expo app offline → adapt เป็น Drizzle/SQLite

| งาน | สถานะ |
|---|---|
| §3A เพิ่ม `trade_group_id` + `trade_role(revenue/cost/standalone)` | ✅ schema.ts + migration (phase0.ts ALTER idempotent) + provider CREATE |
| §3A ทุก row atomic (1 type), `amount>0`, ไม่มี type "profit" | ✅ (ใช้ income/expense atomic; ไม่เคยมี type profit) |
| §2.2 กำไร = derived (financeSummary netting รับ−จ่าย) | ✅ ไม่เก็บกำไรเป็น row |
| §3C ลบตัวเลือก "เฉพาะกำไร" (AC#5) | ✅ ลบจาก parser แล้ว |
| §3C Confirmation card "✅ ตรวจพบ 2 รายการ" + บันทึกคู่ atomic | ✅ add.tsx (จ่ายก่อน→รับ, trade_group_id เดียว) |
| §3C path บันทึกทีละครั้ง คงไว้ | ✅ (ตัวเลือก "เฉพาะยอดขาย"/"เฉพาะต้นทุน" ยังมี + พิมพ์ทีละรายการได้) |
| §3D standalone (ขาเดียว) → ไม่มี group | ✅ (เคสเลขเดียวไม่เข้า dual_entry) |
| §3E report gross/cost/derived profit + export ภาษี per-group | ⬜ TODO (per-trade margin report — defer, ใช้ aggregate netting ไปก่อน) |
| §B AI structured intent contract | ✅ บางส่วน (parser คืน clarify.options[].pair = transactions array) |

ทดสอบ: smart-parser (ไม่มี option กำไร + pair 4200/1500), regression 298/298, phase0 reconcile ผ่าน, tsc clean

---

## 1. ปัญหา (Root Cause)

จาก case จริง: input "ซื้อไก่สด 1,500 บาท ไปย่างขายในตลาดได้เงินทั้งหมด 4,200 บาท"

AI (หมูนุ่น) **ตีความถูกแล้ว** — จับได้ว่าเป็น ต้นทุน 1,500 + ยอดขาย 4,200 → กำไร 2,700
แต่ระบบมีปัญหา 3 จุดในชั้น presentation + persistence:

| # | ปัญหา | ผลกระทบ |
|---|-------|---------|
| 1 | เสนอ 4 ตัวเลือกที่ขัดกันเองเป็นทางเลือกเท่ากัน (บันทึกทั้ง 2 / เฉพาะยอดขาย 4,200 / เฉพาะกำไร 2,700 / เฉพาะต้นทุน 1,500) | ผู้ใช้เลือกผิดได้ง่าย โดยเฉพาะ "เฉพาะกำไร 2,700" ซึ่งผิดหลักบัญชี |
| 2 | ฟอร์มเป็น single-entry (1 ช่องเงิน, 1 หมวด, 1 กระเป๋า) | ไม่สามารถ represent รายการ 2 ขา (รายจ่าย+รายรับ คนละหมวด) ได้ |
| 3 | "กำไร" ถูกทำให้เป็นค่าที่บันทึกลง DB ได้ | ถ้าเก็บกำไรเป็น row → นับซ้ำ หรือ สูญเสียยอดขาย gross ที่ระบบภาษีต้องใช้ |

**ข้อสรุปสำคัญ:** ปัญหานี้ **ไม่ใช่ปัญหา AI ฉลาดไม่พอ** — เป็นปัญหา **data model + UX contract** เป็นหลัก (deterministic logic ~80%, AI ~20%)

---

## 2. หลักการที่ถูกต้อง (Target Model)

### 2.1 Transaction เป็น atomic เสมอ
ทุก row ใน DB = **1 type เท่านั้น** (income XOR expense), 1 amount (เป็นบวกเสมอ — sign มาจาก type), 1 หมวด, 1 กระเป๋า, 1 timestamp, 1 note
**ห้ามมี type "profit" / "กำไร" ในตาราง transaction เด็ดขาด**

### 2.2 กำไร = ค่า derived
```
profit(scope) = Σ income(scope) − Σ expense(scope)
```
คำนวณตอน query/report เท่านั้น แสดงผลได้ แต่ **ไม่เขียนลง DB**

### 2.3 Compound trade = หลาย atomic row ที่ผูกกันด้วย group
เคสไก่ → เขียน 2 row ที่มี `trade_group_id` เดียวกัน:

| row | type | amount | หมวด | role | group |
|-----|------|--------|------|------|-------|
| A | expense | 1,500 | ต้นทุนสินค้า | cost | G1 |
| B | income | 4,200 | ยอดขาย | revenue | G1 |

→ report แสดงได้ว่า "กำไร 2,700 มาจาก G1: −1,500 + 4,200" = มี **ที่มาครบ** สำหรับภาษี (ภ.ง.ด.90/91 ต้องการยอด gross 4,200 ไม่ใช่ net 2,700)

---

## 3. งานที่ต้องทำ

### A. Data Model (Prisma / PostgreSQL)
- [ ] Migration: เพิ่มฟิลด์ในตาราง transaction
  - `trade_group_id  UUID  NULL`  — ผูกรายการที่มาจาก trade เดียวกัน
  - `trade_role  ENUM('revenue','cost','standalone')  NULL`
- [ ] Constraint: `amount > 0` เสมอ; ไม่มี type `profit`
- [ ] บังคับใน Zod validation ที่ชั้น write ด้วย (ไม่ใช่แค่ DB)
- [ ] ทุก aggregation/report ต้อง **คำนวณ** กำไร ห้ามอ่านจาก row

### B. AI Output Contract (reuse pattern จาก ai-engine ของ Xiao-Er)
AI ต้องคืน **structured intent** ไม่ใช่คืน "ตัวเลือก UI"

```json
{
  "intent": "compound_trade",
  "confidence": 0.72,
  "transactions": [
    {"type":"expense","amount":1500,"category_hint":"ต้นทุนสินค้า","note":"ซื้อไก่สด","role":"cost"},
    {"type":"income","amount":4200,"category_hint":"ยอดขาย","note":"ขายไก่ย่าง","role":"revenue"}
  ],
  "derived": {"profit": 2700},
  "warnings": []
}
```
- [ ] `derived.profit` = **render-only** ใส่ guard ที่ชั้น write ให้ reject ทันทีถ้ามีใครพยายาม persist row ที่ role=profit
- [ ] intent มี 3 แบบ: `compound_trade` | `single_income` | `single_expense`

### C. UX Flow — แทน 3-option picker ด้วย Confirmation Card
- [ ] แสดงการ์ดยืนยัน "บันทึก 2 รายการนะคะ" มี 2 แถวที่ **แก้ไขได้**:
  - `[−1,500  รายจ่าย · ต้นทุน]`
  - `[+4,200  รายรับ · ยอดขาย]`
  - footer: `กำไรสุทธิ +2,700 (คำนวณให้อัตโนมัติ ไม่นับซ้ำ)`
- [ ] กด "ยืนยัน" → เขียนทั้ง 2 row แบบ atomic (DB transaction) ใช้ `trade_group_id` เดียวกัน
- [ ] **ลบตัวเลือก "บันทึกเฉพาะกำไร 2,700" ออกจาก default path** (ดู §6)
- [ ] path บันทึกทีละครั้งของเดิม (ซื้อไก่ → แล้วค่อยบันทึกขาย) **คงไว้** เป็น fallback — มันทำงานถูกอยู่แล้ว

### D. Edge Cases / Validation
- [ ] confidence threshold: ต่ำกว่า X → เข้า review mode (ไม่ auto-fill); สูงกว่า X → pre-fill การ์ดยืนยัน
- [ ] ตรวจพบขาเดียว (เช่น "ซื้อไก่ 1500" เฉย ๆ) → standalone expense, ไม่มี group
- [ ] group ที่ same-wallet + same-day ต้องกระทบยอดคงเหลือได้ถูก
- [ ] Idempotency กันเขียนซ้ำตอน retry (หลักเดียวกับ webhook idempotency ที่เราทำใน NoonStore)

### E. Reporting / ภาษี
- [ ] report รายงวด แสดง 3 ค่า: รายได้รวม (gross) / ค่าใช้จ่ายรวม / กำไรสุทธิ (derived)
- [ ] export ภ.ง.ด.90/91 (เงินได้ 40(8)): ส่ง gross 4,200 เป็น "รายได้", cost 1,500 เป็น "ค่าใช้จ่าย" (ให้ผู้ใช้เลือกหักตามจริง/เหมาตอนยื่น) — net 2,700 เป็นค่าคำนวณ **ไม่ใช่แหล่งข้อมูล**
- [ ] *นี่คือเหตุผลทั้งหมดว่าทำไมห้ามเก็บกำไรเป็น row*

---

## 4. Acceptance Criteria
- [ ] ไม่มี row ใน DB ที่ type = "profit"
- [ ] compound utterance → ได้ row ที่ผูก group กัน **2 row พอดี**
- [ ] กำไรใน report = ผลรวม = ตรงกับ 2,700
- [ ] export ภาษีแสดง gross 4,200 + cost 1,500
- [ ] ตัวเลือก "เฉพาะกำไร" หายไปจาก default UX

---

## 5. ลำดับการ build (แนะนำ)
1. Data model + write guard (กันข้อมูลผิดเข้า DB ก่อน) — *เร่งด่วนสุด*
2. Confirmation card UX + ลบ profit-only option
3. AI output contract ให้คืน structured intent
4. Report/tax export ปรับให้ใช้ derived profit
5. NLU compound parser ขั้นสูง (ดู §6 — เป็น premium layer)

---

## 6. ความเห็นเรื่อง Premium AI (ตามที่ขอ)

**ข้อสรุปตรง ๆ: การแยกรายการให้ถูก + กำไรเป็น derived คือ "ความถูกต้องพื้นฐาน" ไม่ใช่ฟีเจอร์ premium**

เหตุผล:
- แอปการเงินที่เก็บ "กำไรอย่างเดียว" หรือ "นับซ้ำ" = ออกตัวเลขผิด การปล่อยให้ free version ผิด แล้วถูกเฉพาะคนจ่ายเงิน = ทำลายความเชื่อใจ โดยเฉพาะเมื่อเราวางตำแหน่งเรื่องภาษี + Tax Readiness Score เท่ากับขาย "บัญชีที่ถูกต้อง" เป็น upsell ซึ่งไม่ควร
- ปัญหานี้แก้ด้วย schema + deterministic logic เป็นหลัก ไม่ใช่ "AI เก่งขึ้น" ถ้าโยนเข้า "Premium AI" = วินิจฉัยผิดโจทย์ และเสี่ยง over-engineer

**สิ่งที่ควรเป็น Premium AI จริง ๆ:**
- การ parse ภาษาธรรมชาติ/เสียง แยก 2 รายการให้ "ในประโยคเดียว" (ความสะดวก)
- auto-categorize ที่เรียนรู้ได้ (ฟีเจอร์ "หมูนุ่นจะจำให้")
- OCR สลิป → สร้าง compound entry อัตโนมัติ
- คำแนะนำ optimize ภาษี

**เส้นแบ่งที่ควรเป็น:** *engine ที่บันทึกถูก = free ทุกคน / AI ที่บันทึกให้คุณด้วยประโยคเดียว = premium* — ขายความเร็วและความสะดวก ไม่ใช่ขายความถูกต้อง

**คำเตือนเพิ่ม:** อย่าให้ "ทำให้มัน smart" กลายเป็น scope creep งานที่ได้ผลทันทีคือเล็กและ deterministic — แก้ schema, แก้การ์ดยืนยัน, ฆ่า option กำไรอย่างเดียว ship อันนี้ก่อน ส่วน NLU parser หรู ๆ ค่อยสร้างเป็น premium layer ทับลงไปทีหลังเมื่อฐานถูกแล้ว
