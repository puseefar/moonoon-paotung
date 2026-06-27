# แผนปรับปรุง: Card-Set ซื้อ-ขาย (Compound Trade) — Preview + History

## ✅ สถานะดำเนินการ (7 มิ.ย. 2569 — Expo/Drizzle+SQLite)

| Phase | งาน | สถานะ |
|---|---|---|
| 0 | `trade_group_id` + `trade_role` (nullable) + index + migration idempotent | ✅ schema/provider/phase0.ts (DB v12) |
| 0 | ledger posting ครบ 2 legs (−ต้นทุน, +ขาย) — การ์ดเป็นแค่ display (R7) | ✅ |
| 0 | กำไร = derived (financeSummary netting / การ์ดคำนวณสด) ไม่เก็บ row | ✅ |
| 1 | Preview การ์ดชุดใบเดียว: 3 บรรทัด ต้นทุน/ยอดขาย/กำไร + ปุ่ม primary เดียว | ✅ add.tsx (แก้ P3/P4/AC8) |
| 1 | escape hatch "ไม่ใช่ซื้อ-ขาย? แยก/แก้ไข" → กางตัวเลือกแยก (R1/R2) | ✅ |
| 1 | เคสขาดทุน → label "ขาดทุน" สีแดง (R6/AC7) | ✅ |
| 2 | History การ์ดชุดใบเดียวต่อ set (TradeGroupCard) — group ด้วย tradeGroupId | ✅ (แก้ P1/P2/AC3) |
| 2 | ลบครั้งเดียว → ทั้งชุด atomic + คืน ledger ครบ (AC2) | ✅ transactionService.deleteTradeGroup + store |
| 3 | Confidence gating variant สูง/ต่ำ + auto-save | ⬜ defer (dual_entry คงที่ = medium ต้องกดยืนยัน, AC4 ✅) |
| 4 | multi-cost legs / cross-wallet UI / manual merge ของเก่า | ⬜ YAGNI |

**Decisions §11 (v1 default):** (1) ไม่ทำ TH_HIGH/LOW variant — dual_entry=medium เสมอ (2) cross-day/wallet: 2 legs ใช้วัน+กระเป๋าเดียวจากฟอร์ม (per-leg defer) (3) ของเก่าปล่อยไว้ (4) ไม่ auto-save (กดยืนยันเสมอ)
ทดสอบ: regression 298/298, smart-parser/phase0/phase1 ผ่าน, tsc clean

---


> **สำหรับ:** ทีม Coder · **โปรเจกต์:** Poatung (หมูนุ่น) · **ขอบเขต:** ฟีเจอร์บันทึกธุรกรรมซื้อ-ขายในครั้งเดียว (compound trade)
> **เอกสารแนบ:** screenshot ปัญหา 2 รูป — (A) หน้า History แสดง 2 การ์ดแยก, (B) หน้า Preview แสดง 3 ปุ่มเท่ากัน

---

## 1. สรุปย่อ (TL;DR)

ตอนนี้เมื่อผู้ใช้พิมพ์/พูดประโยคเดียวที่มีทั้งต้นทุนและยอดขาย (เช่น *"ซื้อเงาะจากสวน 3,000 ขายในตลาดได้ 7,000"*) ระบบ parse ออกเป็น **2 transaction อิสระที่ไม่มีอะไรผูกกัน** แค่บังเอิญมี description เหมือนกัน

เราจะเปลี่ยนเป็น **1 trade-set** ที่ผูก 2 legs (ต้นทุน + ยอดขาย) ด้วย `trade_id` เดียว, คำนวณกำไรแบบ **derived** (ไม่เก็บค่าตายตัว), แสดงผลเป็น **การ์ดใบเดียว** ทั้งหน้า Preview และ History, และ **ลบครั้งเดียวหายทั้งชุด**

> หลักการสำคัญที่ห้ามพลาด: **"สิ่งที่บันทึก = linked set เสมอ"** แต่ **"จำนวนปุ่มที่ผู้ใช้เห็น = ขึ้นกับ confidence"** — สองอย่างนี้คนละเลเยอร์ อย่ามัดรวมเป็นปุ่มเดียวล้วนในทุกกรณี

---

## 2. ปัญหาปัจจุบัน (ทำไมต้องปรับ)

| # | ปัญหา | หลักฐาน | ผลกระทบ |
|---|-------|---------|---------|
| P1 | 2 legs ถูกเก็บเป็น transaction อิสระ ไม่มี FK ผูกกัน (รู้ได้จาก description ที่ซ้ำกันเป๊ะทั้งสองแถว) | screenshot A | คำนวณกำไรต่อกิจกรรมไม่ได้จริง, แก้/ลบต้องทำทีละอัน, เสี่ยงเหลือ orphan |
| P2 | History แสดงเป็น 2 การ์ดเต็มใบ ผู้ใช้ต้องบวก/ลบเอง | screenshot A | กินพื้นที่จอ, ไม่เห็นกำไรซึ่งเป็นตัวเลขที่แม่ค้าอยากรู้จริง |
| P3 | Preview โชว์ 3 ปุ่มน้ำหนักเท่ากัน (บันทึกทั้ง 2 / แยกรายรับ / แยกรายจ่าย) | screenshot B | ผู้ใช้สับสน, เสี่ยงเผลอบันทึกขาเดียว |
| P4 | บรรทัด "บันทึกทั้ง 2 รายการ ... **7,000.00**" แสดงตัวเลขเดี่ยวที่สื่อผิด | screenshot B | ผู้ใช้กวาดตาเร็วๆ นึกว่าได้ +7,000 ทั้งที่ net จริง = +4,000 → ต้นทุนหายไปไหน? |

---

## 3. เป้าหมาย / นอกขอบเขต

**Goals**
- ผูก 2 legs เป็น 1 trade-set ด้วย `trade_id` ตั้งแต่ตอนสร้าง
- กำไร/ขาดทุน = derived metric (คำนวณจาก legs ไม่เก็บค่า)
- การ์ดใบเดียวทั้ง Preview และ History; ลบ/แก้แบบ atomic
- ปุ่มหลักปุ่มเดียวในเคสปกติ + **คงทางถอย (escape hatch) เสมอ**
- ผูกพฤติกรรมเข้ากับ **confidence**

**Non-goals (ยังไม่ทำในรอบนี้ — YAGNI)**
- รองรับต้นทุนหลายก้อนใน 1 set (multi-cost legs) — รองรับแค่ใน data shape แต่ยังไม่ทำ UI
- Auto-merge รายการเก่าใน DB ที่ยังไม่มี link (เสี่ยง — ดู §8 R3)
- Trade ข้ามวัน/ข้าม wallet เต็มรูปแบบ (รับเป็น open decision ก่อน — §11)

---

## 4. Data Model

หัวใจคือแยก "กลุ่มกิจกรรม" ออกจาก "transaction รายตัว" และให้กำไรเป็น derived

```
trade_group
  id            (PK)            -- = trade_id
  user_id       (FK)
  title         (string)        -- label หมวด เช่น "ขายของในตลาด"
  note          (string)        -- ประโยคต้นฉบับที่ผู้ใช้พิมพ์/พูด
  source        (enum)          -- manual | smart_assist | voice
  confidence    (float 0..1)    -- จาก NLP parser
  status        (enum)          -- active | void
  created_at    (datetime)

transaction
  id               (PK)
  user_id          (FK)
  trade_group_id   (FK, NULLABLE)   -- null = รายการเดี่ยว (ไม่ใช่ trade)
  type             (enum)           -- income | expense
  amount           (decimal)        -- เก็บเป็นค่าบวกเสมอ, ทิศทางใช้ type
  category_id      (FK)
  wallet_id        (FK)             -- per-leg (รองรับคนละ wallet ได้, ดู R8)
  occurred_at      (datetime)       -- per-leg (รองรับคนละวันได้, ดู R9)
  description      (string)
```

**กฎสำคัญ**
- กำไร **ห้ามเก็บเป็นคอลัมน์** — คำนวณตอน query เสมอ:
  ```sql
  profit = SUM(CASE WHEN type='income' THEN amount ELSE -amount END)
           WHERE trade_group_id = :id
  ```
- `trade_group_id` เป็น **nullable** → รายการเดี่ยว (ไม่ใช่ trade) แค่ปล่อย null ไม่ต้องมี table พิเศษ
- ลบ set = ลบ/void ทั้ง group (cascade ไป legs) ใน transaction เดียวของ DB
- ทั้งสอง legs **ยังคง post เข้า wallet ledger ตามปกติ** (−3,000 แล้ว +7,000) — การ์ดใบเดียวเป็นเรื่อง "การแสดงผล" ไม่ใช่ "ยุบ posting" (สำคัญมาก, ดู R7)

**Migration:** รายการเก่าที่ยังไม่มี link → **ปล่อยไว้เหมือนเดิม** ทำเฉพาะรายการใหม่ ถ้าจะรวมของเก่าให้เป็น manual action ในอนาคต (ห้าม auto-merge ด้วย heuristic — ดู R3)

---

## 5. UI: หน้า Preview (ยืนยันก่อนบันทึก)

### 5.1 เคสปกติ (มั่นใจปานกลาง — ตรงกับ screenshot B)

```
┌─────────────────────────────────────────┐
│ ✨ หมูนุ่นสรุปให้           [มั่นใจปานกลาง] │   ← badge สี amber
├─────────────────────────────────────────┤
│ ▌🧺 ขายของในตลาด   [🔗 ชุดซื้อ-ขาย]      │   ← แถบซ้ายสีม่วง = trade-set
│ ▌   ซื้อเงาะจากสวน 3,000 ขายได้ 7,000     │
│ ▌                                         │
│ ▌  ต้นทุน (รายจ่าย)            −3,000      │   ← แดง
│ ▌  ยอดขาย (รายรับ)            +7,000      │   ← เขียว
│ ▌  ─────────────────────────────────     │
│ ▌  กำไรสุทธิ                  +4,000      │   ← ม่วง เด่น
├─────────────────────────────────────────┤
│ [   บันทึกชุดซื้อ-ขาย · 2 รายการ   ]      │   ← ปุ่ม primary เดียว เด่น
│        ⚙ ไม่ใช่ซื้อ-ขาย? แยก/แก้ไขรายการ   │   ← ลิงก์ secondary เล็ก = escape hatch
└─────────────────────────────────────────┘
```

**สเปคองค์ประกอบ**
- การ์ด: แถบซ้าย 3px สีม่วง (`#7F77DD`) เป็นสัญลักษณ์ว่าเป็น trade-set + pill "🔗 ชุดซื้อ-ขาย"
- 3 บรรทัดเสมอ: ต้นทุน (แดง) / ยอดขาย (เขียว) / กำไรสุทธิ (ม่วง, font ใหญ่กว่า) — **แก้ปัญหา P4** ไม่มีตัวเลขเดี่ยวลอยๆ ให้สับสนอีก
- ปุ่ม **primary เดียว**: `บันทึกชุดซื้อ-ขาย · 2 รายการ`
- **escape hatch** = ลิงก์ text เล็ก สีเทา ใต้ปุ่ม: `ไม่ใช่ซื้อ-ขาย? แยก/แก้ไขรายการ` → เปิดโหมดแยก 2 ราย (พฤติกรรมเดิม)

> **เลิกใช้** layout 3 ปุ่มน้ำหนักเท่ากันแบบเดิม (P3) — มันบังคับให้ผู้ใช้เลือกทั้งที่ส่วนใหญ่ต้องการแค่ "บันทึกทั้งชุด"

### 5.2 Confidence gating (ผูกกับงาน calibration ที่มีอยู่)

| Confidence | Layout | Auto-save | Escape hatch |
|-----------|--------|-----------|--------------|
| **สูง** (≥ TH_HIGH) | การ์ดชุด + ปุ่มเดียวเด่น | เข้าเกณฑ์ได้ (ถ้าเปิด setting) | ลิงก์เล็กจิ๋ว |
| **ปานกลาง** | การ์ดชุด + ปุ่มเดียว **ต้องกดยืนยันเอง** | ❌ ห้าม | ลิงก์เห็นชัดขึ้น |
| **ต่ำ** (< TH_LOW) | **โชว์ 2 legs แยก** ให้ผู้ใช้ยืนยันว่าจับคู่ถูกไหม | ❌ ห้าม | การจับเป็นชุดเป็นแบบ **opt-in** |

> threshold `TH_HIGH` / `TH_LOW` = ค่าที่ทีม calibration ต้องเคาะ (ดู §11) เริ่มลองที่ 0.85 / 0.55 ได้

---

## 6. UI: หน้า History (หลังบันทึก)

```
┌─────────────────────────────────────────┐
│ ▌🧺 ขายของในตลาด   [🔗 ชุดซื้อ-ขาย]      │
│ ▌   ซื้อเงาะจากสวน ขายในตลาด              │
│ ▌  ยอดขาย                     +7,000      │
│ ▌  ต้นทุน                     −3,000      │
│ ▌  ─────────────────────────────────     │
│ ▌  กำไรสุทธิ                  +4,000      │
└─────────────────────────────────────────┘
        (กด → เปิดดูรายละเอียด / แก้ไข / ลบทั้งชุด)
```

- **การ์ดใบเดียวต่อ 1 trade-set** (แก้ P1, P2) — ประหยัดพื้นที่จอกว่า 2 การ์ดเดิม และโชว์กำไรที่ผู้ใช้อยากเห็น
- กรณี **ขาดทุน** (กำไร < 0): บรรทัดสุดท้ายเปลี่ยนเป็น `ขาดทุน −X,XXX` สีแดง อย่าให้ดูเหมือนรายจ่ายธรรมดา (R6)
- **ลบ:** กดลบ 1 ครั้ง → ลบทั้ง group (ทั้งรายรับ+รายจ่าย) แบบ atomic, ไม่เหลือ orphan
- **แก้:** แก้ leg ไหนก็ได้ → กำไร recompute อัตโนมัติ (เพราะ derived)

---

## 7. ตรรกะ Atomic (Delete / Edit)

- **Delete set:** ลบ `trade_group` + ทุก leg ใน DB transaction เดียว + reverse ledger posting ทั้งคู่ออกจาก wallet
- **Delete leg เดียว (จาก escape/edit):** ต้อง prompt → *"ลบทั้งชุด หรือเก็บอีกขาเป็นรายการเดี่ยว?"* ถ้าเก็บขาเดียว ต้อง **เคลียร์ `trade_group_id` ของ leg ที่เหลือเป็น null + อัปเดต description** ไม่ให้เหลือข้อความโกหก (R4)
- **Edit amount:** ห้ามมี cache กำไรค้าง — query สดทุกครั้ง

---

## 8. จุดเสี่ยง (Risks) — อ่านก่อนเริ่มเขียน

| ID | ความเสี่ยง | วิธีกัน |
|----|-----------|---------|
| **R1** | ปุ่มเดียวล้วน + confidence ปานกลาง = force-link parse ที่ผิดแบบ atomic | คง escape hatch + gate ตาม confidence (§5.2) |
| **R2** | บล็อกเคสบันทึกขาเดียวที่ถูกต้องจริง (ซื้อวันนี้ขายอาทิตย์หน้า / ลงแค่ยอดขาย) | รายการเดี่ยวยังเป็น first-class คิดเป็น **"default เป็นชุด + opt-out"** ไม่ใช่ "บังคับเป็นชุด" |
| **R3** | Migration auto-pair ของเก่าด้วย heuristic (วันเดียวกัน+หมวดเดียวกัน ≠ trade เสมอ) | จับคู่จาก **เจตนาตอน input เท่านั้น** ไม่ retroactive auto-merge |
| **R4** | ลบ leg เดียวเหลือ orphan + description โกหก | atomic delete / prompt + เคลียร์ link + แก้ description (§7) |
| **R5** | กำไรค้าง stale หลังแก้ leg | กำไร derived เสมอ ห้ามเก็บคอลัมน์ |
| **R6** | เคสขาดทุนแสดงเหมือนรายจ่ายธรรมดา | label `ขาดทุน` + สีแดงชัดเจน |
| **R7** | "การ์ดใบเดียว" ทำให้บางคนเผลอ post net เข้า wallet ขาเดียว | ย้ำ: ทั้ง 2 legs **ต้อง post เข้า ledger ครบ** การ์ดเป็นแค่การแสดงผล — ตรงกับ reconciliation gap ที่เคยเจอ |
| **R8** | ต้นทุนจ่ายเงินสด แต่ยอดขายรับ PromptPay (คนละ wallet) | `wallet_id` เป็น **per-leg** ไม่ผูก wallet เดียวต่อ set (decision §11) |
| **R9** | ต้นทุนวันนึง ขายอีกวัน — History ใช้วันไหนแทน set? | `occurred_at` per-leg + decision ว่าจะโชว์วันไหน (§11) |

---

## 9. Acceptance Criteria

- [ ] **AC1** — 1 compound input สร้าง N transaction ที่ทุกตัวมี `trade_group_id` เดียวกัน
- [ ] **AC2** — ลบ set 1 ครั้ง → legs หายหมด ไม่เหลือ orphan + ledger ถูก reverse ครบ
- [ ] **AC3** — History แสดง 1 การ์ดต่อ set พร้อม ต้นทุน/ยอดขาย/กำไร โดยกำไร = derived
- [ ] **AC4** — confidence ปานกลาง: ไม่ auto-save, ต้องกดยืนยัน, มี escape hatch
- [ ] **AC5** — รายการเดี่ยว (ไม่ใช่ trade) ยังทำงานปกติ ไม่ถูกบังคับเป็นชุด
- [ ] **AC6** — ยอด wallet หลังบันทึก set = ยอดเดิม + net (post ครบทั้ง 2 legs)
- [ ] **AC7** — เคสขาดทุน render กำไรเป็นสีแดง label `ขาดทุน`
- [ ] **AC8** — ไม่มีตัวเลขเดี่ยวลอยใน preview ที่สื่อผิด (แก้ P4)

---

## 10. การแบ่งเฟส (แนะนำ)

- **Phase 0 — Data model (prerequisite):** `trade_group` + `trade_group_id` nullable + derived-profit query + ledger posting ครบ 2 legs. *ยังไม่แตะ UI*
- **Phase 1 — Preview:** การ์ดชุดใบเดียว + ปุ่ม primary + escape hatch (ทำเฉพาะพฤติกรรม "ปานกลาง" ก่อน) + แก้ P4
- **Phase 2 — History:** การ์ดชุด + atomic delete/edit
- **Phase 3 — Confidence gating:** variant สูง/ต่ำ + (optional) auto-save
- **Phase 4 — Later (YAGNI):** multi-cost legs, cross-wallet UI, manual merge ของเก่า

---

## 11. คำถามที่ต้องตัดสินใจ (เคาะกับ Pu/ทีมก่อน Phase 1)

1. Threshold `TH_HIGH` / `TH_LOW` ของ confidence = เท่าไหร่?
2. Trade ข้ามวัน → History ใช้วันของ **ยอดขาย** หรือ **ต้นทุน** หรือโชว์ช่วงวัน?
3. รองรับ **คนละ wallet ต่อ leg** ตั้งแต่ Phase 1 เลย หรือเลื่อนไป Phase 4?
4. รายการเก่าที่ยังไม่มี link — ปล่อยไว้ หรือทำ manual merge ทีหลัง?
5. เปิด auto-save ที่ confidence สูงเลยไหม หรือให้ผู้ใช้ opt-in ใน setting?
