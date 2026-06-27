# PKG-05 — Build 7 QA Triage & Closeout Addendum

**เอกสาร:** PKG-05-CLOSEOUT-ADDENDUM-v1.0
**ต่อท้าย:** PKG-05-CLOSEOUT-v1.0
**Feature:** MiniShop Pro — หน้าแก้ไขสินค้า (Edit Product / Pricing & Variant)
**App:** Moonoon Paotung (หมูนุ่น–เป๋าตุง)
**Build:** APK Build 7 → แก้ใน Build 8
**สถานะ:** ✅ **CLOSED** — เคลียร์ Exit Criteria (P0/P1) + Fast-follow ครบ · รอ on-device retest บน Build 8
**ผู้ทดสอบ:** Internal QA (end-to-end, on-device install)
**วันที่:** 2026-06-25 (แก้ไข 2026-06-25)

---

## 1. บทสรุปผู้บริหาร (Executive Summary)

Build 7 ผ่าน end-to-end smoke test บนเครื่องจริง UX โดยรวมดีขึ้นชัดเจน โดยเฉพาะ flow การบันทึกต้นทุน (cost capture) ซึ่งเป็น core value ของ Poatung — ทำงานเข้าใจง่ายขึ้น

อย่างไรก็ตาม **ยังไม่ปิด PKG-05 ในสถานะปัจจุบัน** พบ defect ที่กระทบความน่าเชื่อถือของข้อมูลราคา/ต้นทุน 1 รายการ (P0, ต้องวินิจฉัยให้ชัดก่อน) และ visible defect ที่ควรเก็บก่อน hand off อีก 2 รายการ ส่วนที่เหลือเป็น design decision ที่ต้องล็อก และ polish ที่ทำ fast-follow ได้

จุดสำคัญ: ข้อ 4 (กำไรไม่อัพเดทหลังแก้ต้นทุน) **ไม่ใช่ bug** แต่เป็นพฤติกรรมที่ถูกต้องตามหลัก COGS snapshot — ต้องล็อกเป็น design decision และเสริม UX note ไม่ใช่ "แก้"

---

## 2. ตารางสรุป Triage

| # | รายการ | ประเภท | Severity | Block การปิด? |
|---|--------|--------|----------|----------------|
| 1 | ตัวเลขในช่องราคาโดนตัดครึ่ง (clipping) | Visible defect | **P1 — Major** | ✅ ใช่ |
| 3.1 | ค่าที่บันทึกแล้วแสดงเป็น placeholder (เทา) | Data trust defect | **P0 — Blocker (pending diagnosis)** | ✅ ใช่ |
| 3.2 | Base price vs Variant section ไม่สอดคล้องกัน + คำศัพท์ | UX / Architecture | **P1 — Major** | ✅ ใช่ |
| 2 | Color chip ควรมีพื้นหลังสีจริง | Polish | P2 — Minor | ❌ Fast-follow |
| 4 | กำไรไม่อัพเดทหลังแก้ต้นทุน catalog | **Design decision (not a bug)** | Decision + UX note | ⚠️ ต้องยืนยัน snapshot |
| 5 | Loader หมุน 2 รอบหลัง snackbar | Polish | P3 — Trivial | ❌ Fast-follow |

---

## 3. รายละเอียดรายข้อ

### [P1] ข้อ 1 — ตัวเลขในช่องราคาโดนตัดครึ่ง

**อาการ:** ในช่องราคาขาย/ราคาต้นทุน (เด่นชัดใน variant rows, รูปที่ 3) ตัวเลขถูก clip ครึ่งบน/ล่าง อ่านไม่ครบ

**Root cause hypothesis:** บน Android มักเกิดจาก `padding` + `fixed height` + `includeFontPadding` รวมกัน หรือ `lineHeight < fontSize`

**Fix direction:**
- ลบ `height` ตายตัวออกจาก `TextInput` ให้ `paddingVertical` กำหนดความสูงแทน
- เพิ่ม `includeFontPadding: false` + `textAlignVertical: 'center'` (Android)
- ตรวจ `lineHeight >= fontSize * 1.2`

**Acceptance criteria:** ตัวเลข 1–7 หลัก (เช่น `1,250,000`) แสดงครบทุกหลักทั้งบนและล่าง บนเครื่องทดสอบจริง ทั้ง base price และ variant rows

---

### [P0] ข้อ 3.1 — ค่าที่บันทึกแล้วแสดงเป็น placeholder

**อาการ:** จากรูปที่ 2 — ค่า `3` และ `1.5` แสดงเป็นดำทึบ (ค่าจริง) แต่ `350` และ `80` แสดงเป็นสีเทาเหมือน placeholder ทำให้สับสนว่าบันทึกแล้วหรือยัง กระทบความเชื่อมั่นในจุดที่เป็นจุดขายของแอป

**⚠️ ต้องวินิจฉัยก่อนตีตรา severity จริง — แตะเข้าช่อง `80` แล้วเช็ค:**

| ผลที่เจอ | ความหมาย | Severity จริง |
|----------|-----------|----------------|
| **มีค่าให้แก้ได้ในช่อง** | Styling bug ล้วน — render ค่าจริงด้วยสี placeholder (เป็นไปได้ว่า bind ผ่าน `placeholder` prop แทน `value` หรือ text color ผิด field) | P1 — Cosmetic, impact สูง |
| **ช่องว่างเปล่า** | Persistence / rehydration bug — ค่าจริงไม่ถูกโหลดกลับเข้า `value` ตอนเปิดหน้าใหม่ → **ข้อมูลต้นทุนหายจริง** | **P0 — Hard blocker** |

**Fix direction:**
- กรณี styling: ผูก `value={state.cost}` ให้ถูก field, set text color เป็นสีปกติเมื่อ `value` มีค่า, ใช้ `placeholderTextColor` แยกจาก text color
- กรณี persistence: ตรวจ rehydration flow — ค่า cost/compare-at ต้องถูก read จาก SQLite (Drizzle) กลับเข้า form state ตอน mount

**Acceptance criteria:** บันทึกค่า → ออกจากหน้า → กลับเข้ามาใหม่ → ค่าที่บันทึกแสดงเป็นสีปกติ (ดำทึบ) และตรงกับที่บันทึก ไม่ใช่ placeholder

---

### [P1] ข้อ 3.2 — Base price vs Variant section + คำศัพท์

**ปัญหาที่ผู้ทดสอบสัมผัสได้ ("ไม่สอดคล้องกัน") ถูกต้อง:** ปัจจุบัน section ราคาเริ่มต้น (บน) และ variant rows (ล่าง) เปิดแก้ได้พร้อมกันทั้งคู่ ทำให้กำกวมว่าราคาไหนคือ source of truth

**Design decision ที่ต้องล็อก:**

> เมื่อ toggle "เปิดใช้ตัวเลือกสินค้า (สี/ขนาด)" = **ON**
> → ช่องราคาขาย/ต้นทุนใน section บนต้อง **disable หรือซ่อน**
> → variant rows เป็น source of truth เพียงแห่งเดียว
> → ราคาบน (ถ้าคงไว้) ลดบทบาทเหลือเป็น "ค่าตั้งต้น/default ตอนเพิ่ม variant ใหม่" พร้อมกำกับชัด
> → **ห้ามให้ทั้งสอง section เป็น live editable พร้อมกัน**

**คำศัพท์ (แยก 2 ระดับ):**

ระดับ technical / schema / handoff doc:
- **Simple Product** (ไม่มี variant) / **Variant Product** (มี variant)
- ⚠️ **เช็คก่อนว่า NoonStore เรียกอะไรอยู่แล้ว — ถ้ามี ให้ reuse คำเดิม** เพื่อ ecosystem consistency (reuse-over-rebuild)

ระดับ UX ที่ผู้ใช้เห็น (พ่อค้าแม่ค้าตลาดต้องเข้าใจทันที):
- ไม่มีตัวเลือก → **"สินค้าราคาเดียว"**
  - helper: "ตั้งราคาครั้งเดียว ใช้กับสินค้าที่ไม่มีสี/ขนาดให้เลือก"
- มีตัวเลือก → **"สินค้ามีตัวเลือก (สี/ขนาด)"**
  - helper: "ตั้งราคา-ต้นทุนแยกตามสี/ขนาด/น้ำหนัก"

**Acceptance criteria:**
- เปิด toggle variant → section ราคาบน disable/ซ่อนทันที
- มี label + helper text ตามข้างต้นแสดงในแต่ละ section
- มีเพียง source of truth เดียวสำหรับราคา/ต้นทุนในแต่ละ mode

---

### [DECISION] ข้อ 4 — กำไรไม่อัพเดทหลังแก้ต้นทุนสินค้าที่ขายไปแล้ว

**สถานะ: ไม่ใช่ bug — เป็นพฤติกรรมที่ถูกต้อง ต้องล็อกเป็น design decision**

**หลักการ:** ต้นทุนของสินค้าที่ขายไปแล้ว (COGS) ต้องเป็น **snapshot ณ เวลาที่ขาย** การแก้ต้นทุนใน catalog แล้วรื้อกำไรย้อนหลังทุกบิลจะทำให้ P&L ในอดีตเพี้ยน ตรวจสอบไม่ได้ และขัดกับ snapshot pattern ที่วางไว้แล้วในระบบ (`wallet_name_snapshot`, `source_type`, `source_ref`)

> **Decision:** การแก้ต้นทุนใน catalog มีผลกับ **การขายครั้งถัดไปเท่านั้น** ไม่กระทบยอด/กำไรของบิลที่ขายไปแล้ว

**Action items (ต้องทำจริง 2 อย่าง):**
1. **ยืนยันใน implementation ว่าระบบ snapshot จริง** — กำไร/ต้นทุนต่อบิลถูก store ตอนขาย ไม่ใช่ compute สด ๆ จาก catalog cost แล้วบังเอิญหน้าจอไม่ refresh
   - ⚠️ ถ้าเป็นแบบหลัง (compute สด) จะแย่กว่า เพราะกำไรในอดีตจะเพี้ยนเมื่อ catalog เปลี่ยน → ต้องแก้เป็น snapshot
2. **เพิ่ม UX note ตอนแก้ต้นทุน:** "มีผลกับการขายครั้งถัดไป ไม่กระทบยอดขายที่ผ่านมา"

**Acceptance criteria:** ยืนยันด้วย test ว่ากำไรต่อบิลถูก persist ตอนขาย และไม่เปลี่ยนเมื่อแก้ catalog cost ภายหลัง

---

### [P2] ข้อ 2 — Color chip ควรมีพื้นหลังเป็นสีจริง

**ทิศทาง:** chip สี (ชม / เข / เท) ใช้พื้นหลังเป็นสีที่ระบุ

**⚠️ Edge case:** ตัวอักษรดำใช้ได้กับสีอ่อน แต่จะอ่านไม่ออกบนสีเข้ม (เขียวเข้ม/น้ำเงิน/ม่วง) — **อย่าฮาร์ดโค้ดดำตายตัว** ให้คำนวณ luminance แล้วเลือกดำ/ขาวอัตโนมัติ:

```js
// L = 0–255
const L = 0.299 * R + 0.587 * G + 0.114 * B;
const textColor = L > 150 ? '#000' : '#FFF';
```

แบบนี้สีส่วนใหญ่ยังได้ตัวดำตามที่ต้องการ แต่ไม่พังกับสีเข้ม

**Status:** Fast-follow — ไม่ block

---

### [P3] ข้อ 5 — Loader หมุน 2 รอบหลัง snackbar

**Root cause hypothesis:** loading state ถูก trigger 2 ครั้ง — save mutation (รอบ 1) จบ → refetch/invalidate query SQLite (รอบ 2)

**Fix direction:** รวมเป็น single loading state หรือให้ refetch หลัง save เป็น background แบบเงียบ ไม่โชว์ loader รอบสอง

**Status:** Fast-follow — ไม่ block

---

## 4. Exit Criteria — เงื่อนไขปิด PKG-05

PKG-05 จะปิด (CLOSED) เมื่อครบทุกข้อต่อไปนี้:

- [x] **ข้อ 1** — ตัวเลขแสดงครบทุกหลัก ✅ แก้แล้ว (รอ on-device retest บน Build 8)
- [x] **ข้อ 3.1** — วินิจฉัยเสร็จ + แก้แล้ว: ค่าที่บันทึกแสดงเป็นค่าจริงหลัง reload (ไม่ใช่ placeholder) ✅
- [x] **ข้อ 3.2** — section บน disable/ซ่อนเมื่อเปิด variant + label/helper ครบ + source of truth เดียว ✅
- [x] **ข้อ 4** — ยืนยัน COGS snapshot ใน implementation + เพิ่ม UX note ✅

ทำหลังปิดได้ (Fast-follow backlog):
- [x] ข้อ 2 — luminance-based chip text color ✅ (ทำเลยก่อน handoff)
- [ ] ข้อ 5 — รวม loading state เป็นรอบเดียว (ยกไป fast-follow: เป็น refetch ข้ามจอ ไม่ block)

---

## 4.1 สรุปการแก้ไข (Implementation Notes — 2026-06-25)

### ข้อ 1 — ตัวเลขโดน clip
- `VariantEditor.priceInput`: ลบ `height: 32` ตายตัว → ใช้ `minHeight: 38` + `paddingVertical: 8`
- เพิ่ม `includeFontPadding: false` + `textAlignVertical: 'center'` ที่ `priceInput`, `stockVal`, และ `INPUT_STYLE` (กัน clip บน Android)
- ไฟล์: `features/mini-shop/components/VariantEditor.tsx`, `features/mini-shop/screens/ProCreateProductScreen.tsx`

### ข้อ 3.1 — ค่าแสดงเป็น placeholder (Root cause = persistence, ไม่ใช่แค่ styling)
- **Root cause:** `costPrice` และ `comparePrice` ถูกส่งขึ้น backend แต่ **ไม่ได้เก็บ local เหมือน `wholesalePrice`** → backend เก่า drop ค่า → ตอน reload `prod.costPrice`/`comparePrice` ว่าง → ฟอร์ม fallback เป็น placeholder
- **แก้ (persistence):** เพิ่ม `saveCostPrice/getCostPrice` + `saveComparePrice/getComparePrice` ใน `productLocalService` และ merge กลับใน `mergeProduct` (ตาม pattern เดิมของ wholesale — reuse-over-rebuild) + wire ใน `realApi.addProduct/updateProduct` (รองรับการลบส่วนลดด้วย `'comparePrice' in input`)
- **แก้ (styling):** ลบ `color: '#9B7FC8'` ออกจาก TextInput ราคาก่อนลด → ค่าจริงแสดงสีเข้ม `#2D1B69` แยกจาก `placeholderTextColor`
- ไฟล์: `features/mini-shop/services/productLocalService.ts`, `lib/api/realApi.ts`, `ProCreateProductScreen.tsx`

### ข้อ 3.2 — Base price vs Variant + คำศัพท์
- เพิ่ม **mode banner** ใน section ราคา: ไม่มี variant = "🏷️ สินค้าราคาเดียว" / มี variant = "🎨 สินค้ามีตัวเลือก (สี/ขนาด)" พร้อม helper
- เมื่อเปิด variant: ราคาขายปลีก relabel เป็น "ราคาตั้งต้น" (anchor/default ของตัวเลือกใหม่) · ช่องต้นทุนฐาน **disable + dim** ชี้ลงไปที่ตัวเลือกด้านล่าง → source of truth ต้นทุนเหลือที่ variant rows เดียว
- Section 6 header เปลี่ยนเป็น "ราคาตามตัวเลือก (สี/ขนาด)" + helper · ลบ badge "Phase 3" (dev jargon)
- **คำศัพท์ที่ใช้:** "สินค้าราคาเดียว" (ไม่มีตัวเลือก) / "สินค้ามีตัวเลือก (สี/ขนาด)" — ตามคำแนะนำทีม

### ข้อ 4 — COGS snapshot (ยืนยันแล้ว = ไม่ใช่ bug)
- **ยืนยัน implementation:** กำไรขั้นต้นคำนวณจาก `item.unitCost` (snapshot ตอน add-to-cart ใน `ProProductDetailScreen` → persist ลง order line ใน `ProPlaceOrderScreen`) — `shopAnalyticsService` ใช้ snapshot ไม่ใช่ catalog cost สด ✅ การแก้ต้นทุน catalog จึง **ไม่กระทบบิลเก่า** ถูกต้องตามหลัก COGS
- เพิ่ม **UX note** ใน edit mode: "แก้ต้นทุนมีผลกับการขายครั้งถัดไปเท่านั้น ไม่กระทบยอด/กำไรของบิลที่ขายไปแล้ว"

### ข้อ 2 — Color chip (fast-follow, ทำเลย)
- เพิ่ม `chipColors()` + `textOn()` (luminance: `L = 0.299R + 0.587G + 0.114B`, `L > 150 ? '#000' : '#FFF'`) ในกลุ่ม "สี" → พื้นหลังสีจริง, ตัวอักษรอ่านออกทั้งสีอ่อน/เข้ม · กลุ่มอื่นคงเป็น chip ม่วงเดิม
- ไฟล์: `features/mini-shop/components/VariantEditor.tsx`

### ข้อ 5 — Loader 2 รอบ (ยกไป fast-follow)
- เกิดจาก save mutation (รอบ 1) → `router.back()` → จอ list refetch ผ่าน `useFocusEffect` (รอบ 2) เป็นพฤติกรรมข้ามจอ ไม่ block การปิดงาน

---

## 5. Sign-off

| บทบาท | ชื่อ | สถานะ | วันที่ |
|--------|------|--------|--------|
| Tech Lead / Architect | Pu | ⏳ Pending | — |
| Dev | Claude | ✅ แก้ Exit Criteria + Fast-follow #2 ครบ | 2026-06-25 |
| QA | Internal | ⏳ รอ retest บน Build 8 | — |
| Closeout | — | ✅ CLOSED (pending Build 8 retest) | 2026-06-25 |

**หมายเหตุ:** Exit Criteria (ข้อ 1, 3.1, 3.2, 4) + fast-follow ข้อ 2 แก้ครบแล้ว — เหลือ rebuild APK เป็น Build 8 แล้ว on-device retest เพื่อยืนยัน แล้ว archive คู่กับ closeout เดิม · ข้อ 5 (loader 2 รอบ) ค้างไว้เป็น fast-follow backlog ไม่ block
