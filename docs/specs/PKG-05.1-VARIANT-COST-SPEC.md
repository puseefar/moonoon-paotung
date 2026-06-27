# PKG-05.1 — Variant Cost & กำไรขั้นต้น (Gross Profit) Spec

**Build target:** Build 7
**Status:** Ready for implementation
**Parent:** PKG-05 (Mini Shop Pro) — closeout ยืนยันแล้วทุกส่วน ยกเว้นรายงานกำไร
**Scope owner:** SEVENDOG DEV
**หลักการ:** YAGNI-first · reuse snapshot pattern เดิม · เก็บข้อมูลถูกตั้งแต่ต้นน้ำ

---

## 1. ปัญหา (Problem statement)

รายงานโชว์ **กำไรสุทธิ ฿5 · margin 100%** ทั้งที่สินค้ามีต้นทุนจริง

Root cause มี 2 ช่องที่แยกกัน:

1. **ไม่มีที่เก็บต้นทุน** ในระบบเลย → ระบบถือว่า cost = 0 → กำไร = ยอดขายทั้งก้อน → margin 100% โดยอัตโนมัติ
2. ต่อให้ใส่ต้นทุนทีหลัง รายงานจะ **คำนวณย้อนหลังผิด** ถ้าไม่ snapshot ต้นทุน ณ เวลาขาย (ต้นทุนแม่สี/วัสดุเปลี่ยนตามเวลา)

**ข้อเท็จจริงจากหน้างาน (จากพี่):** สีชมพูกับสีเทา แม้ไซส์เดียวกัน ต้นทุนแม่สี+วัสดุ **ไม่เท่ากัน** → ขายราคาเดียวกันไม่ได้ และกำไรต้องคำนวณแยกรายสี/รายไซส์ → ดังนั้น **ต้นทุนต้องอยู่ที่ระดับ variant** ไม่ใช่ระดับ product

---

## 2. หลักการออกแบบ (Design principles)

| # | หลักการ | เหตุผล |
|---|---------|--------|
| P1 | **Variant เป็น row จริง (first-class)** ถือ cost/price/stock ของตัวเอง | ต้นทุนต่อกันไม่ได้ถ้า variant เป็นแค่ label/JSON |
| P2 | **Snapshot ต้นทุน ณ เวลาขาย** ลง order_item | เหมือน pattern `price`, `wallet_name_snapshot` เดิม — รายงานเดือนเก่าต้องไม่เพี้ยนเมื่อต้นทุนวันนี้เปลี่ยน |
| P3 | **รายงานได้แค่กำไรขั้นต้น (gross)** เท่านั้น | ค่าส่ง/ค่าธรรมเนียม/packaging ยังไม่ track → เรียก "สุทธิ" ไม่ได้ |
| P4 | **cost = null → ไม่แสดงกำไร/margin** ของรายการนั้น | กันการ ship กำไรปลอม; null ≠ 0 |
| P5 | **Order เก่าไม่ย้อนเดา** ปล่อย cost_snapshot = null | ข้อมูลเก่าไม่มีต้นทุน → ห้าม fabricate |

---

## 3. สูตรคำนวณ (Calculation)

```
กำไรขั้นต้นต่อรายการ = (unit_price_snapshot − unit_cost_snapshot) × qty
กำไรขั้นต้นรวม      = Σ ของทุก order_item ที่ unit_cost_snapshot != null
```

**กฎการแสดงผล (สำคัญ):**

- ถ้า order_item ใด `unit_cost_snapshot = null` → **ไม่นำเข้าสูตรกำไร** และทำให้รายงานรวมติดธง "ต้นทุนบางรายการยังไม่ระบุ"
- ถ้าทุกรายการ cost = null → การ์ดกำไรโชว์ `—` + ปุ่ม "ตั้งต้นทุนเพื่อดูกำไร" **ห้ามโชว์ margin 100%**
- margin = `กำไรขั้นต้น / ยอดขาย × 100` คำนวณเฉพาะจากรายการที่มี cost ครบเท่านั้น

---

## 4. Data model changes

### 4.1 ตารางใหม่: `product_variants`

```
product_variants
  id            text     pk
  product_id    text     fk → products.id   (on delete cascade)
  name          text     not null   -- free-form: "ชมพู / 3 นิ้ว" ให้แม่ค้าพิมพ์เอง
  sell_price    integer  not null
  cost_price    integer  null       -- ต้นทุน, null = ยังไม่ตั้ง (P4)
  stock         integer  not null default 0
  is_active     integer  not null default 1
  sort_order    integer  not null default 0
  created_at    integer
  updated_at    integer
```

### 4.2 แก้ `order_items` (เพิ่ม 3 คอลัมน์ + null สำหรับ order เก่า)

```
order_items  (เพิ่ม)
  variant_id            text     null  -- fk → product_variants.id, null = order เก่า / สินค้าไม่มี variant
  variant_name_snapshot text     null  -- snapshot ชื่อ variant ณ เวลาขาย
  unit_cost_snapshot    integer  null  -- 🆕 ต้นทุน ณ เวลาขาย (P2)
```

> `unit_price` ของ order_item มี snapshot อยู่แล้ว — ไม่แตะ

### 4.3 ตัวอย่างข้อมูลกระถางของพี่

| variant.name | cost_price | sell_price |
|---|---|---|
| ชมพู / 3 นิ้ว | 1 | 2 |
| ชมพู / 4 นิ้ว | 1 | 3 |
| เทา / 3 นิ้ว | 2 | 3 |
| เทา / 4 นิ้ว | 2 | 4 |
| เขียว / 3 นิ้ว | 3 | 5 |
| เขียว / 4 นิ้ว | 3 | 6 |

→ 1 product (กระถางหลากสี) = 6 variant rows = 6 SKU แต่ละตัวถือ cost/price/stock ของตัวเอง
เสื้อผ้าใช้โมเดลเดียวกัน: ไซส์ = variant

---

## 5. Migration plan (offline-first / expo-sqlite + Drizzle)

ทำแบบ **additive + backward-compatible** ไม่ทำลายข้อมูลเดิม:

1. **M1 — สร้างตาราง** `product_variants` (idempotent: `CREATE TABLE IF NOT EXISTS`)
2. **M2 — ALTER `order_items`** เพิ่ม 3 คอลัมน์ ทุกตัว nullable (SQLite รองรับ ADD COLUMN)
3. **M3 — ไม่ backfill ต้นทุน** order เก่า → `unit_cost_snapshot` คงเป็น null (P5)
4. **M4 — สินค้าเดิมที่ยังไม่มี variant:** ปล่อยทำงานต่อแบบ "no-variant"
   - order_item.variant_id = null → ใช้ราคา/ต้นทุนระดับ product (ถ้าจะมี) หรือ cost = null ไปก่อน
   - **ไม่บังคับ migrate ทุก product ให้มี variant** — สินค้าไซส์เดียวสีเดียวไม่ต้องมี variant
5. **Sync:** ตรวจ Google Drive sync schema ให้รวมตารางใหม่ + คอลัมน์ใหม่ก่อน ship

> หมายเหตุ WebView/SQLite: ทดสอบ migration บนเครื่องที่มี DB เดิม (ไม่ใช่ fresh install) ตาม requirement เดิมของ PKG-15

---

## 6. UI/UX changes

### 6.1 หน้าแก้ไขสินค้า (ต้นน้ำ — จุดที่สำคัญที่สุด)
- เพิ่มส่วน **"ตัวเลือกสินค้า (variant)"**: เพิ่ม/ลบ/แก้ row ได้
- แต่ละ variant กรอก: **ชื่อ · ราคาขาย · ต้นทุน · สต็อก**
- ต้นทุนเป็น optional แต่มี hint: "ใส่ต้นทุนเพื่อให้รายงานกำไรถูกต้อง"
- **ไม่ทำ matrix generator** (สี × ไซส์ auto-cross) ในรอบนี้ — flat rows พอ (ดู §8)

### 6.2 หน้ารายงาน (Image 2)
- การ์ด **"กำไรสุทธิ" → เปลี่ยนเป็น "กำไรขั้นต้น"** (P3)
- ลบ/แทนที่ **"margin 100%"**:
  - cost ครบ → โชว์ margin จริง
  - cost ว่างบางส่วน → โชว์ margin จาก subset + ป้าย "⚠ ต้นทุนบางรายการยังไม่ระบุ"
  - cost ว่างทั้งหมด → โชว์ `—` + ลิงก์ "ตั้งต้นทุนเพื่อดูกำไร"
- ตาราง **สินค้าขายดี** คอลัมน์ "กำไร" ใช้ gross เดียวกัน; รายการ cost = null โชว์ `—`

### 6.3 หน้า checkout / order
- ลูกค้าเลือก variant → snapshot `variant_id`, `variant_name_snapshot`, `unit_price`, `unit_cost_snapshot` ลง order_item ตอนยืนยันออเดอร์
- ใบเสร็จ/รายการออเดอร์โชว์ชื่อ variant (เหมือน Image 3 ที่โชว์ "สี: ชม..." อยู่แล้ว)

---

## 7. Acceptance criteria — Build 7

ทดสอบด้วยเคสกระถาง 2 variant ต้นทุนต่างกัน:

- [ ] สร้าง product 1 ตัว มี variant: ชมพู/3นิ้ว (cost 1, price 2) และ เทา/3นิ้ว (cost 2, price 3)
- [ ] ขายชมพู 1 ชิ้น → order_item เก็บ `unit_price=2`, `unit_cost_snapshot=1`, `variant_name_snapshot="ชมพู / 3 นิ้ว"`
- [ ] รายงานโชว์ **กำไรขั้นต้น = ฿1** (ไม่ใช่ ฿2 / 100%)
- [ ] การ์ดเขียน **"กำไรขั้นต้น"** ไม่ใช่ "กำไรสุทธิ"
- [ ] แก้ต้นทุน variant เป็น 0.5 หลังขาย → **รายงานออเดอร์เก่ายังโชว์กำไร ฿1 เท่าเดิม** (snapshot ไม่เพี้ยน — P2)
- [ ] สร้าง variant ใหม่ไม่ใส่ต้นทุน แล้วขาย → รายการนั้น **ไม่โชว์ margin 100%** แต่โชว์ `—` + ธงเตือน
- [ ] order เก่าก่อน migration → cost_snapshot = null, ไม่ทำให้รายงานพัง, ไม่ถูกนับเป็นกำไร
- [ ] สินค้าไซส์เดียวสีเดียว (ไม่มี variant) → ยังขายได้ปกติ ไม่ถูกบังคับสร้าง variant
- [ ] migration รันบน DB เดิม (ไม่ใช่ fresh install) ไม่สูญข้อมูล

---

## 8. Out of scope — กันงานบวมกลับเข้า closeout (YAGNI)

แตกเป็น package ถัดไป **อย่าทำในรอบนี้**:

| รายการ | เลื่อนไป | เหตุผล |
|--------|---------|--------|
| Matrix generator (สี × ไซส์ auto-cross) | PKG-05.2 | สินค้าสูงสุด 5 ชิ้น variant ยังไม่บาน |
| **กำไรสุทธิจริง** (หักค่าส่ง/ค่าธรรมเนียม/packaging) | PKG-05.2 | ยังไม่ track operating expense |
| Variant-level bulk edit / รูปต่อ variant | future | YAGNI |
| ต้นทุนเฉลี่ยถ่วงน้ำหนัก / FIFO inventory costing | future | overkill สำหรับแม่ค้าตลาด |

คำว่า **"กำไรสุทธิ"** เก็บไว้ใช้ตอน PKG-05.2 มี operating expense จริงเท่านั้น

---

## 9. สรุปทิศทาง

1. Variant = row จริง ถือ cost ของตัวเอง → แก้ที่ต้นน้ำ
2. Snapshot ต้นทุนตอนขาย → รายงานย้อนหลังไม่เพี้ยน
3. รายงานแจ้ง **กำไรขั้นต้น** เท่านั้น + ลบ margin 100% ปลอม
4. ข้อมูลไม่ครบ → โชว์ `—` ไม่เดา
5. งานหนัก (matrix / net profit) → PKG-05.2

ผ่าน acceptance criteria §7 = ปิด PKG-05 ได้สมบูรณ์ครับ
