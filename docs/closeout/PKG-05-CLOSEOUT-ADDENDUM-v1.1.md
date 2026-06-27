# PKG-05 (MiniShop Pro) — Closeout Addendum v1.1

**App:** Moonoon Paotung Pro (หมูนุ่น–เป๋าตุง)
**Package:** PKG-05 MiniShop Pro
**ต่อจาก:** Build 7 QA Closeout (25 มิ.ย. 2026)
**วันที่:** 26 มิ.ย. 2026
**สถานะ:** Conditional Close → ต้องผ่าน addendum นี้ก่อนปิด Pro
**ขอบเขต:** Variant pricing independence + base-section field cleanup เมื่อเปิด variant

---

## 1. สรุปประเด็น (Context)

ระหว่าง ultimate meeting ก่อนปิด Pro พบพฤติกรรมในหน้า **แก้ไขสินค้า** ของสินค้าประเภทมีตัวเลือก (สี/ขนาด):

> เมื่อแก้ **ราคาตั้งต้น (base price)** ราคาขายของทุก variant ด้านล่างขยับตามแบบ **ส่วนต่าง (delta)**
> — base 3→2 ทุก variant ลด 1 / base 3→5 ทุก variant เพิ่ม 2

นี่ขัดกับมาตรฐาน e-commerce (Shopee/Lazada/TikTok Shop) ที่แต่ละ variant = SKU อิสระ ราคา/ต้นทุน/สต๊อกเป็น **absolute** ไม่ผูกกับ base price

**Diagnosis:** UI copy ถูกต้องแล้วทั้งหมด แต่ logic ไม่ทำตามที่ UI พูด
- Label ช่อง base price = "ค่าเริ่มต้นของตัวเลือกใหม่" ✅
- การ์ดเตือน = "ค่าตรงนี้ใช้เป็นค่าตั้งต้น" ✅
- แต่ handler จริงยัง treat base price เป็น **master** ที่ propagate ด้วยสูตร delta ❌

ที่ถูกคือ base price ต้องเป็น **seed** (ใช้ครั้งเดียวตอนสร้าง variant ใหม่ แล้วเลิกยุ่ง) ไม่ใช่ master

---

## 2. มติที่ประชุม (Decisions)

| # | มติ | ระดับ |
|---|-----|-------|
| D1 | ลบ delta-propagation บน base price เมื่อ `hasVariants === true` | **Mandatory** |
| D2 | คง base price เป็น seed-for-new-variant ตามเดิม (verify ว่าทำงานถูก) | **Mandatory** |
| D3 | Verify `priceSnapshot` / `costSnapshot` บน order item (น่าจะทำใน PKG-05.1 แล้ว) | **Verify only** |
| D4 | เมื่อ variant ON → **ซ่อน** ช่อง "ราคาก่อนลด" + "ราคาขายส่ง" ใน base section | **Mandatory** |
| D5 | ปุ่ม "คัดลอกราคาไปทุกตัวเลือก / apply to all" | **Defer (YAGNI)** |

**เหตุผล D5 (defer):** เพดานคือ 6 variant/สินค้า และ 5 สินค้า/ร้าน — แก้มือทีละช่องเร็วกว่าอ่าน confirm dialog การเพิ่ม feature ใหม่ก่อนปิด package ขัดกฎ YAGNI จดเป็น future enhancement พอ

---

## 3. งานที่ต้องทำ (Action Items)

### A1 — ลบ delta-propagation (D1) — **CRITICAL**

**เดิม (ต้องลบ):**
เมื่อ user แก้ base price ระบบ recompute ทุก variant ด้วยสูตร
```
newVariantPrice = oldVariantPrice + (newBasePrice − oldBasePrice)
```

**ใหม่:**
เมื่อ `hasVariants === true` → การแก้ base price **ห้ามแตะ** `variant.price` / `variant.cost` ใด ๆ ทั้งสิ้น

```ts
// onBasePriceChange
function onBasePriceChange(next: number) {
  product.basePrice = next;
  // ❌ ลบทั้ง block ที่ loop แก้ variant ด้วยสูตร delta
  // ✅ ไม่ทำอะไรกับ variants ที่มีอยู่แล้ว
}
```

**Edge case:** ถ้ามี state ที่จำ `oldBasePrice` ไว้เพื่อคำนวณ delta — ลบ state นั้นทิ้งด้วย ไม่มีใครต้องใช้แล้ว

---

### A2 — Verify seed-on-new-variant (D2)

ตอนกดปุ่มเพิ่มสีใหม่ (+ขาว / +ดำ / +น้ำเงิน …) ระบบต้องเอา **ค่า base price ปัจจุบัน** ไปเติม `variant.price` ของตัวใหม่ "ครั้งเดียว" แล้วปล่อยให้ user แก้อิสระ

```ts
function addVariant(option: VariantOption) {
  variants.push({
    ...option,
    price: product.basePrice,   // seed ครั้งเดียว
    cost: product.baseCost ?? null,
    stock: 0,
    isActive: true,
  });
}
```

หลัง seed แล้ว variant ตัวนั้นเป็นอิสระทันที — แก้ base price ทีหลังไม่กระทบ (รับประกันโดย A1)

---

### A3 — ซ่อน compare-at + wholesale เมื่อ variant ON (D4) — **CRITICAL**

**Root cause ที่ยังรั่ว:** ใน base section (sec3) มี
- **ราคาก่อนลด = 9** → โชว์ badge "ลด 67%"
- **ราคาขายส่ง = 1.5**

ค่าพวกนี้เป็น shop-level เดี่ยว ๆ แต่ variant ขายจริงคนละราคา (2/3/5)
→ พอลูกค้าเลือกสีเทา (ขาย 5) badge "ลด 67%" (คิดจาก base 3 เทียบ 9) **หมายถึงอะไร? ไม่มีความหมาย**

**วิธีแก้ (เลือกทางง่ายตามมติ):** เมื่อ `hasVariants === true`
- ซ่อน input "ราคาก่อนลด" และ "ราคาขายส่ง" ใน base section
- **ไม่โชว์ badge ลด %** บนหน้าสินค้าตอนมี variant (เพราะไม่มี per-variant compare-at)
- ราคาหน้าร้านใช้ **ช่วงราคา** จาก variant ต่อไป (฿2 – ฿5) ตามที่ทำถูกอยู่แล้ว

```tsx
{!product.hasVariants && (
  <>
    <CompareAtPriceInput />
    <WholesalePriceInput />
  </>
)}
```

> หมายเหตุ: per-variant compare-at เป็น YAGNI สำหรับ Pro นี้ ถ้าอนาคตร้านต้องการ flash sale แบบมี % ลดต่อสี ค่อยทำเป็น package ใหม่ (เกี่ยวกับ Flash Sale toggle ใน sec8 ด้วย — ดู §5)

---

### A4 — Verify order snapshot (D3)

ตรวจว่าเมื่อสร้าง order item มีการ snapshot ครบ:
```ts
orderItem = {
  productId, variantId,
  productNameSnapshot, variantNameSnapshot,
  priceSnapshot,   // ราคาขาย ณ เวลาสั่ง
  costSnapshot,    // ต้นทุน ณ เวลาสั่ง
  quantity,
}
```
ถ้า PKG-05.1 ทำครบแล้ว → ปิดข้อนี้ ไม่มีงานเพิ่ม
ถ้ายังขาด `costSnapshot` → ต้องเติม มิฉะนั้นรายงานกำไรย้อนหลังเพี้ยนเมื่อแก้ต้นทุน variant ภายหลัง

---

## 4. Acceptance Criteria (QA Checklist สำหรับ Build 8)

- [ ] **AC1** สินค้ามี variant: แก้ base price จาก 3→5 แล้ว variant ชมพู/เขียว/เทา ราคา/ต้นทุน **ไม่ขยับ** (2/3/5 และ 1/1/2 คงเดิม)
- [ ] **AC2** สินค้ามี variant: แก้ base price 3→2 แล้ว variant **ไม่ขยับ** เช่นกัน
- [ ] **AC3** กดเพิ่มสีใหม่ขณะ base price = 4 → variant ใหม่ price = 4 (seed) แต่ variant เดิมไม่เปลี่ยน
- [ ] **AC4** สินค้า **ไม่มี** variant: base price ยังเป็นราคาขายจริงตามปกติ (regression check)
- [ ] **AC5** เปิด variant ON → ช่อง "ราคาก่อนลด" + "ราคาขายส่ง" หายไปจาก base section
- [ ] **AC6** หน้าร้านสินค้ามี variant → โชว์ช่วงราคา ฿2 – ฿5, ไม่มี badge ลด %
- [ ] **AC7** สร้าง order → แก้ราคา/ต้นทุน variant ทีหลัง → order เดิมในรายงานยอดขาย/กำไร **ไม่เปลี่ยน**
- [ ] **AC8** กำไรต่อ variant คำนวณถูก (ชมพู ฿1 / เขียว ฿2 / เทา ฿3) — regression check

---

## 5. Future Enhancements (Deferred — ไม่ทำใน package นี้)

| รายการ | เหตุผลที่ defer |
|--------|----------------|
| ปุ่ม "คัดลอกราคาไปทุกตัวเลือก" + confirm dialog | YAGNI ที่ scope 6 variant × 5 สินค้า |
| Per-variant compare-at / ราคาก่อนลดต่อสี | ต้องคู่กับ Flash Sale per-variant — เป็น package แยก |
| Flash Sale badge ต่อ variant (sec8 toggle) | ตอน variant ON ยังไม่มี per-variant discount → toggle นี้ควร gate ตามด้วย ถ้าจะทำต้องออกแบบ discount model ใหม่ |

> **เตือนทีม:** Flash Sale toggle (sec8) มี dependency กับ A3 — ถ้า variant ON และซ่อน compare-at แล้ว Flash Sale badge "ลด XX%" จะไม่มีฐานคำนวณ ตอนนี้ให้ **disable Flash Sale toggle เมื่อ variant ON** หรือ hide badge % ไปก่อน อย่าปล่อยให้โชว์ % ลดที่ไม่มีที่มา

---

## 6. ขอบเขตที่ **ไม่ต้อง** แตะ (Out of Scope)

- ❌ Data model ของ variant — ถูกแล้ว (price/cost/stock absolute แยกต่อ variant)
- ❌ Storefront price-range computation — ถูกแล้ว (฿2 – ฿5)
- ❌ UI copy / labels — ถูกแล้วทั้งหมด (แค่ logic ไม่ตรง copy)
- ❌ Stock / สถานะ section
- ❌ Order confirmation / slip verification / notification (ปิดใน build ก่อนหน้าแล้ว)

---

## 7. Definition of Done

PKG-05 ปิดสมบูรณ์เมื่อ:
1. AC1–AC8 ผ่านทั้งหมดใน Build 8
2. delta-propagation handler ถูกลบออกจริง (code review ยืนยัน)
3. order snapshot ยืนยันครบ (รวม costSnapshot)
4. Flash Sale × variant dependency จัดการแล้ว (disable หรือ hide ตาม §5)

**ประมาณการ:** ~1 handler ลบ + 2 field conditional render + 1 toggle gate — งานเล็ก ปิดได้ใน build เดียว

---

*— Closeout Addendum v1.1 / SEVENDOG DEV / Moonoon Paotung Pro*
