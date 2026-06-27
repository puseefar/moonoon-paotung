# PKG-05.2 — Base Price Auto-Default & Variant Validation Fix

**Build target:** Build 8
**Status:** Ready for implementation
**Parent:** PKG-05 (Mini Shop Pro) — ปิดท้าย Pro version
**Sibling:** PKG-05.1 (Variant Cost & กำไรขั้นต้น) — ใช้ snapshot/variant-row pattern เดียวกัน
**Scope owner:** SEVENDOG DEV
**หลักการ:** YAGNI-first · reuse footer ช่วงราคาเดิม · single source of truth · ไม่ persist derived value

---

## 1. ปัญหา (Problem statement)

หน้าจอ **เพิ่ม/แก้ไขสินค้า** เมื่อเปิด toggle "ตัวเลือกสินค้า (สี/ขนาด)" และกรอกราคาขายราย variant ครบแล้ว → กด "เพิ่มสินค้า · เปิดขาย" ระบบกลับเด้ง error:

> **กรุณาใส่ราคาขายที่ถูกต้อง** (scr0)

ทั้งที่ราคาขายจริงถูกกรอกครบทุก variant แล้ว (scr3/scr4: ชมพู ฿3 / เขียว ฿4 / เทา ฿6) และ footer section ก็คำนวณ **ช่วงราคา ฿3 – ฿6** ถูกต้องอยู่แล้ว

### Root cause

ปัญหานี้ **ไม่ใช่ feature ที่ขาด** — เป็น **validation bug**:

- rule เดิมบังคับ `basePrice > 0` **เสมอ** ไม่ว่าจะเปิด variant หรือไม่
- เมื่อเปิด variant ผู้ใช้ตั้งราคาจริงราย variant ด้านล่าง (ตาม banner ใน scr2 ที่เขียนเองว่า "ตั้งราคา-ต้นทุนจริงแยกในแต่ละตัวเลือกด้านล่าง · ค่าตรงนี้ใช้เป็นค่าตั้งต้น") → ช่อง `basePrice` ด้านบนจึงปล่อยเป็น `0` ตามธรรมชาติ
- แต่ validator ยังไม่รู้เรื่องนี้ → เห็น `basePrice = 0` → reject

สรุป: **ฝั่ง UI รู้แล้วว่าราคามาจาก variant แต่ฝั่ง validate ยังไม่รู้** — แก้ที่ logic เส้นเดียวคือจบ

---

## 2. แก่นของการแก้ (Core fix)

```
hasVariants ? validateVariants() : (basePrice > 0)
```

ทุกอย่างที่เหลือในเอกสารนี้คือ UX layer ที่ทับบน core fix นี้ ไม่ใช่ตัวแก้หลัก

---

## 3. หลักการออกแบบ (Design principles)

| # | หลักการ | เหตุผล |
|---|---------|--------|
| P1 | **เปิด variant → ราคา/ต้นทุน เป็นของ variant เท่านั้น** | source of truth เดียว ไม่ซ้อนกับ base |
| P2 | **`displayPrice` / `priceRange` คำนวณตอน read (compute-on-read)** | ไม่ persist ค่า derived → ไม่มี stale cache เมื่อแก้ variant ทีหลัง |
| P3 | **ซ่อน section ราคาตั้งต้น เมื่อ variant = ON** (ไม่ lock/ไม่ทำสีเทา) | ลด redundant field; footer ช่วงราคาทำงานครบแล้ว |
| P4 | **ห้ามมี `baseCost` aggregate เด็ดขาด** | กำไรราย variant เท่านั้น (ตาม PKG-05.1) — baseCost ทำกำไรเพี้ยน |
| P5 | **ราคาต่ำสุดที่ตั้งไว้ ≠ ราคาต่ำสุดที่ยังมีสต๊อก** | แยกคนละ concern; runtime stock เป็นเรื่อง storefront ไม่ใช่หน้านี้ |

---

## 4. พฤติกรรมที่ต้องการ (Expected behavior)

### 4.1 โหมดสินค้าราคาเดียว (`hasVariants = false`)

- ช่อง "ราคาตั้งต้น" + "ราคาต้นทุน" **แสดงตามเดิม**
- validate `basePrice > 0` ตามเดิม
- ไม่เปลี่ยนอะไร

### 4.2 โหมดสินค้ามีตัวเลือก (`hasVariants = true`)

| รายการ | พฤติกรรม |
|--------|----------|
| Section "ราคาตั้งต้น" (basePrice + baseCost ด้านบน) | **ซ่อนทั้ง block** (collapse / unmount) |
| Validate ตอนบันทึก | ตรวจ **ราย variant** แทน basePrice |
| ราคาแสดงหน้าร้าน | `displayPrice = min(variant.price)` คำนวณตอน read |
| ช่วงราคา | `priceRange = [min(price), max(price)]` → "฿3 – ฿6" (มีใน footer แล้ว) |
| กำไร | คำนวณราย variant เท่านั้น (scr4 โชว์ กำไร ฿2/฿2/฿3 ถูกแล้ว) |
| baseCost | **ไม่ใช้ / ไม่เก็บ / ไม่คำนวณ** |

### 4.3 กฎ validate ราย variant (`validateVariants()`)

ทุก variant ที่เปิดอยู่ต้องผ่าน:

- `price > 0` (บังคับ)
- `stock >= 0` (ห้ามติดลบ)
- `cost` — **ใส่ได้ หรือเว้นว่างได้** ถ้ายังไม่ทราบ (null) ตาม PKG-05.1

ถ้ามี variant ใดราคา `<= 0` → error ชี้ตรง variant ตัวนั้น ไม่ใช่ error รวมแบบ scr0

---

## 5. จุดที่ "ไม่ทำ" และเหตุผล (สำคัญ — กันงานบวม)

> ทีมเสนอมาหลายอย่างใน meeting แต่บางอย่างเกินจำเป็น/สร้างหนี้ทางเทคนิค ตัดออกตามนี้

| ข้อเสนอจากทีม | มติ | เหตุผล |
|--------------|-----|--------|
| **Persist `basePrice = Math.min(...)` ทับลง DB ก่อนบันทึก** | ❌ ไม่ทำ | สร้าง stale cache ทันทีที่แก้ราคา variant ทีหลัง → DB ไม่ตรงกับ variant จริง → มี source of truth ซ้อนสองที่ ใช้ compute-on-read แทน |
| **Lock / disable ช่องราคาตั้งต้นให้เป็นสีเทา** | ❌ ไม่ทำ | ช่องเทาที่มีตัวเลขแต่กดไม่ได้ ชวนแม่ค้างง ("ทำไมแก้ไม่ได้") + ไป duplicate footer ช่วงราคาที่มีอยู่แล้ว → "ซ่อน" สะอาดกว่า "ล็อก" |
| **Real-time mirror ราคา min ขึ้นช่องบน** | ❌ ไม่ทำ | footer "ช่วงราคา ฿3 – ฿6" ใน scr4 ทำหน้าที่นี้อยู่แล้ว เขียนกลไกใหม่ = ซ้ำซ้อน |
| **หน้าร้านโชว์ราคาต่ำสุดของ variant ที่ "ยังมีสต๊อก"** (เช่น ชมพูหมด → โชว์ ฿4) | ⏸ เลื่อน | เป็น storefront runtime rendering คนละ concern กับหน้าตั้งค่าร้าน → แยก ticket; แม่ค้าทั่วไปแค่ grey out สีที่หมดก็พอ |
| **`baseCost` aggregate** | ❌ ห้ามทำ | ทำกำไรเพี้ยน — bug เดียวกับที่เพิ่งปิดใน PKG-05.1 |

---

## 6. Acceptance criteria (Build 8 sign-off)

- [ ] เปิด variant + กรอกราคาขายครบทุกตัว → กดเปิดขาย **ไม่เด้ง error scr0**
- [ ] เปิด variant → section "ราคาตั้งต้น" (basePrice + baseCost) **หายไปจากจอ** ไม่ใช่แค่เทา
- [ ] ปิด variant (สินค้าราคาเดียว) → ช่องราคาตั้งต้นกลับมา + validate `basePrice > 0` ตามเดิม
- [ ] หน้าร้านแสดงราคา = ราคาต่ำสุดของ variant (฿3) และช่วงราคา ฿3 – ฿6 ถูกต้อง
- [ ] แก้ราคา variant ตัวต่ำสุดทีหลัง (฿3 → ฿5) แล้ว **ราคาหน้าร้าน update เป็น ฿4 อัตโนมัติ** (ยืนยันว่าไม่ persist ค่าเก่า)
- [ ] ไม่มี field/column `baseCost` ถูกบันทึกเมื่อเปิด variant
- [ ] กำไรยังคงคำนวณราย variant ถูกต้อง (฿2/฿2/฿3) — ไม่ regress PKG-05.1
- [ ] variant ที่ราคา `<= 0` → error ชี้ตรงตัว ไม่ใช่ error รวม

---

## 7. Out of scope — เลื่อนออกไป

| รายการ | เลื่อนไป | เหตุผล |
|--------|---------|--------|
| ราคาต่ำสุดตาม stock สด (in-stock min price) หน้าร้าน | ticket แยก (storefront) | คนละ concern กับหน้าตั้งค่า |
| Matrix generator (สี × ไซส์) | future package | สินค้าสูงสุด 5 ชิ้น ยังไม่บาน |
| กำไรสุทธิจริง (หักค่าส่ง/ค่าธรรมเนียม) | future package | ยังไม่ track operating expense |

---

## 8. Definition of done

1. core fix `hasVariants ? validateVariants() : basePrice>0` ลงแล้ว
2. section ราคาตั้งต้น **ซ่อน** เมื่อเปิด variant (ไม่ใช่ล็อก)
3. `displayPrice` / `priceRange` คำนวณตอน read — **ไม่ persist**
4. ไม่มี `baseCost` เมื่อเปิด variant — กำไรราย variant ไม่ regress
5. ผ่าน acceptance criteria §6 ครบทุกข้อ → **ปิด PKG-05 Pro ได้สมบูรณ์**

---

## 9. สรุปทิศทาง

1. scr0 = validation bug ไม่ใช่ feature ที่ขาด → แก้ logic เส้นเดียว
2. เปิด variant → **ซ่อน** section ราคาตั้งต้น (ไม่ใช่ล็อก) — ลด redundant + ใช้ footer เดิม
3. ราคาหน้าร้าน/ช่วงราคา **compute-on-read** ไม่ persist → ไม่มี stale cache
4. **ไม่มี baseCost** — กำไรราย variant เท่านั้น (สอดคล้อง PKG-05.1)
5. เคส stock สด + matrix + net profit → เลื่อนออก กันงานบวม

ผ่าน §6 = ปิด Pro version ได้ครบครับ
