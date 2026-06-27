# Moonoon-Paotung · Pro Package #5 — MiniShop Pro
## แผนการพัฒนา (Development Plan)

| | |
|---|---|
| **โปรเจกต์** | Moonoon-Paotung (หมูนุ่น–เป๋าตุง) |
| **Package** | Pro Package #5 — MiniShop Pro (`PKG-05`) |
| **ประเภทเอกสาร** | Engineering Handoff / Development Plan |
| **เวอร์ชัน** | v1.0 (Draft for Dev Review) |
| **ผู้จัดทำ** | Pu — SEVENDOG DEV |
| **วันที่** | 20 มิ.ย. 2026 |
| **สถานะ** | รอ review จากทีม Dev ก่อน lock scope Phase 1 |

> เอกสารนี้ประมวลจากต้นแบบ 7 หน้า (mockup) + บทวิเคราะห์ของทีมงาน 1 และทีมงาน 2 แล้ว filter ผ่านหลัก YAGNI เพื่อ lock ขอบเขต MVP ที่ "ship ได้และ defensible" ก่อนเริ่ม implement

---

## 1. บริบทและกรอบคิด (Context)

MiniShop Pro **ไม่ใช่ระบบใหม่ที่สร้างจากศูนย์** แต่เป็น **storefront + order layer บางๆ ที่วางบน infrastructure เดิม** ของ Poatung กรอบนี้สำคัญเพราะมันลด scope งานจริงลงมาก และบอกชัดว่าจุดไหน reuse จุดไหน build ใหม่

| ชั้นงาน | สถานะ |
|---|---|
| รับชำระเงิน (PromptPay QR + SlipOK verify) | **Reuse `PKG-15`** |
| แจ้งเตือน LINE | **Reuse `PKG-13`** |
| บันทึกรายรับ/รายจ่าย/กำไร (wallet/ledger) | **Reuse ledger เดิม** |
| Customer identity สำหรับลูกค้า guest | **Reuse Canonical Customer Identity (จาก NoonStore)** |
| Storefront, Product, Order, Back-office | **Build ใหม่ (งานหลักของ PKG-05)** |

**จุดขายตัวจริง (USP):** ไม่ใช่ "เปิดร้านออนไลน์" (ใครก็ทำได้) แต่คือ **ออเดอร์ที่จ่ายเงินแล้ว → รายรับ / ต้นทุน / กำไร / สต็อก ไหลเข้าเป๋าตุงโดยอัตโนมัติ** ผู้ใช้ไม่ต้องขายเสร็จแล้วกลับมาคีย์บัญชีซ้ำ — อันนี้คือ moat ของฟีเจอร์ ไม่ใช่ของเสริม

---

## 2. หลักการออกแบบ (Guiding Principles)

1. **Reuse before build** — ทุกอย่างที่แตะเงิน/แจ้งเตือน/บัญชี ใช้ของเดิม ห้ามเขียนซ้ำ
2. **Single-vendor, not marketplace** — เฟสแรก MiniShop = ร้านส่วนตัวของผู้ใช้แต่ละคน ไม่ใช่ตลาดรวม
3. **YAGNI** — สินค้าจำกัด 5 ชิ้น/ร้าน ฟีเจอร์ที่สมเหตุสมผลเฉพาะตอนมีสินค้าจำนวนมาก ให้เลื่อนออกไปก่อน
4. **Integrity ต้องลงที่ data layer ไม่ใช่ UI** — order lifecycle, stock, ledger ต้องถูกต้องระดับ transaction
5. **ลูกค้าไม่ต้องลงแอป** — buyer คือคนทั่วไป ทุก flow ฝั่งซื้อต้องทำงานบน browser ได้

---

## 3. ขอบเขต (Scope)

### 3.1 In Scope — Phase 1 (MVP)

- ตั้งค่าร้าน แบบ step-by-step (แก้ปัญหาฟอร์มยาวจาก mockup หน้า 2)
- สร้าง/จัดการสินค้า: รูป, ชื่อ, หมวด, รายละเอียด, **ราคาต้นทุน**, ราคาขาย, ราคาเปรียบเทียบ, สต็อก, threshold แจ้งเตือน, draft + preview
- หน้าร้านสาธารณะ + ปุ่มแชร์ (LINE / Facebook / คัดลอกลิงก์ / QR)
- หน้ารายละเอียดสินค้า + สั่งซื้อ
- ชำระเงิน PromptPay + อัปโหลด/ตรวจสลิป (**reuse `PKG-15`**)
- **หลังบ้านจัดการออเดอร์** + state machine + integrity rules (ดูข้อ 5–6)
- **ลิงก์ติดตามออเดอร์แบบเว็บ** สำหรับลูกค้า guest
- **ตัดสต็อก + ลงบัญชีเป๋าตุงอัตโนมัติ (idempotent)**
- แจ้งเตือน LINE เมื่อมีออเดอร์/อัปเดตสถานะ (**reuse `PKG-13`**)
- State หน้าจอครบ: Loading / Error / Offline / Empty / สินค้าหมด

### 3.2 Out of Scope — ตัดออกจาก MVP (YAGNI Cuts ชัดเจน)

| รายการ | เสนอโดย | เหตุผลที่ตัด |
|---|---|---|
| Search bar + Filter ในหน้าร้าน | ทีม 2 | Pro จำกัด 5 ชิ้น ไม่จำเป็นต้องค้นหา |
| Upsell / Cross-sell | ทีม 2 | ไม่มี catalog มากพอให้แนะนำคู่ |
| SKU (รหัสสินค้า) | ทีม 1 | ร้าน 5 ชิ้นไม่ต้องการรหัสจัดการ |
| Variant (สี/ขนาด) | ทีม 1 | กระทบ data model หนัก — ดูข้อ 8 (Open Decision) |
| Smart Order Inbox (รวม LINE/FB/QR) | ทีม 1 | การ parse ออเดอร์จากแชตเป็นโปรเจกต์แยก |
| Flash Sale Countdown Timer | ทีม 2 | Polish ล้วน เลื่อน Phase 3 |
| คูปอง / รายงานกำไรรายสินค้า / รายงานขายดี | ทีม 1 | เลื่อน Phase 3 |

---

## 4. สถาปัตยกรรมและ Data Model

### 4.1 Entities หลัก (ใหม่)

**Shop** (1 ต่อ 1 user)
- ข้อมูลพื้นฐาน, ช่องทางติดต่อ, ที่อยู่/จัดส่ง, ช่องทางรับเงิน (PromptPay id/type), นโยบาย
- `status`: `draft` / `published`
- **แยก field สาธารณะออกจาก field ส่วนตัวชัดเจน** — เลขบัญชี/ข้อมูลยืนยันตัวตน ต้องไม่ถูก expose ในหน้าร้าน

**Product**
- `shopId`, `name`, `images[]`, `category`, `description`
- `costPrice` (ต้นทุน — จำเป็นต่อการคำนวณกำไร), `sellPrice`, `comparePrice` (ราคาปกติ/ก่อนลด)
- `status`: `active` / `draft` / `sold_out`
- `shippingOptions`, `preorder` (bool), `cod` (bool)

**ProductVariant** *(Schema-forward — Phase 1 สร้างไว้ ไม่เปิด UI)*
- `productId`, `name` (Phase 1 = "default"), `stock`, `lowStockThreshold`
- Phase 3: เพิ่ม `optionValues[]` (เช่น สี/ขนาด) โดยไม่ต้อง migrate OrderItem

**Order**
- `orderNo` (unique, human-readable)
- `shopId`, `customer` (snapshot: name/phone/address — guest)
- `subtotal`, `shipping`, `discount`, `total`
- `status` (enum — ดูข้อ 5, COD เพิ่ม `PENDING_COD`)
- `paymentMethod` (PromptPay / MobileBanking / COD), `slipRef` (**unique — กันสลิปซ้ำ**)
- `expiresAt` (timer ชำระเงิน — COD ไม่มี timer), `trackingNo`, `shippingProvider`
- `publicToken` (สำหรับลิงก์ติดตามแบบเว็บ — ต้อง unguessable)

**OrderItem**
- `orderId`, `variantId` → FK ไปที่ ProductVariant (Phase 1 = default variant)
- `productSnapshot` (name/price/image/variantName ณ เวลาซื้อ), `qty`, `unitPrice`

**Ledger Link** (เชื่อม ledger เดิม)
- เมื่อ Order → `PAID`: สร้างรายการ รายรับ + ต้นทุนขาย (COGS) + ค่าจัดส่ง
- **idempotency key = `orderId` + entry type** เพื่อให้ retry ไม่ลงซ้ำ

---

## 5. Order Lifecycle (State Machine)

```
[สร้างออเดอร์]
      |
      +---(PromptPay/โอน)---> PENDING_PAYMENT ----(หมดเวลา)----> CANCELLED
      |                             |                                  ^
      |                             v                                  |
      |                       VERIFYING_SLIP --(สลิปไม่ผ่าน)--> SLIP_REJECTED --(ยกเลิก)--+
      |                             |
      |                             v
      |                          PAID  ----(คืนเงิน)----> REFUNDED
      |                             |
      +---(COD)---------> PENDING_COD
                                    |
                             (merge ที่ PREPARING)
                                    |
                                    v
                                PREPARING
                                    |
                                    v
                                 SHIPPED
                                    |
                   +----------------+----------------+
                   v                                 v
              COMPLETED                          CANCELLED (COD ส่งไม่สำเร็จ)
              [ลง ledger]                        [คืนสต็อก ไม่ลง ledger]
```

**Enum:** `PENDING_PAYMENT` · `VERIFYING_SLIP` · `SLIP_REJECTED` · `PAID` · `PENDING_COD` · `PREPARING` · `SHIPPED` · `COMPLETED` · `CANCELLED` · `REFUNDED`

> **COD rule:** ลง ledger รายรับเฉพาะตอน `COMPLETED` เท่านั้น ไม่ใช่ตอน `SHIPPED`

> ลูกค้าและร้านค้าต้องเห็นสถานะชุดเดียวกัน เพื่อลดคำถาม "โอนแล้วหรือยัง / ส่งของหรือยัง"

---

## 6. Integrity Rules (สัญญาทาง Engineering — ห้ามพลาด)

นี่คือจุดที่ทั้งสองทีมแตะแค่ผิว แต่เป็นที่ที่ ledger/stock พังบ่อยที่สุด ต้อง lock ให้ชัดก่อนเขียนโค้ด:

1. **จุดสร้าง Order** — สร้างตอนกด "ยืนยันสั่งซื้อ" (หน้า Place Order) **ไม่ใช่** ตอนอัปสลิป
   เมื่อสร้าง ให้ทำพร้อมกันใน transaction เดียว: ออก `orderNo` → ตรวจราคา+สต็อกอีกครั้ง → **soft-lock สต็อก** → ผูก QR ที่มี **ยอดเงินตายตัว** กับออเดอร์ → ตั้ง `expiresAt = now + 30 นาที`
2. **QR ฝังยอดเงินเสมอ** — ลูกค้าห้ามกรอกยอดเอง (mockup หน้า 7 ทำถูกแล้ว)
3. **กันสลิปซ้ำ** — 1 สลิป = 1 ออเดอร์ ผูกด้วย SlipOK transaction ref + unique constraint
4. **Idempotent settlement** — เมื่อสลิปผ่าน ให้ทำใน transaction เดียว: set `PAID` → **hard-decrement สต็อก** → ลง ledger
   ถ้า verify/webhook ยิงซ้ำ ต้องเป็น no-op (key ด้วย `orderId`) — **ห้ามลงรายรับหรือตัดสต็อกซ้ำ**
5. **Timeout job** — เมื่อ `expiresAt` ผ่านและยัง `PENDING_PAYMENT` → ปล่อย soft-lock คืน + set `CANCELLED`
6. **Cancel / Refund** — คืนสต็อก + กลับรายการบัญชี (idempotent เช่นกัน)
7. **กันกดสั่งซ้ำ** — idempotency token ที่ปุ่มยืนยันสั่งซื้อ

---

## 7. หน้าจอ (Screens)

### 7.1 ปรับปรุงจาก mockup เดิม
| หน้า | สิ่งที่ต้องปรับ |
|---|---|
| Profile (หน้า 2) | เปลี่ยนเป็น step-by-step, autosave ร่าง, แสดง % ความสมบูรณ์, แยกข้อมูลสาธารณะ/ส่วนตัว |
| Create Product (หน้า 3) | เพิ่ม `costPrice`, ช่องกรอกค่า threshold, draft, preview ก่อนเผยแพร่ |
| Sale Page (หน้า 4) | คงปุ่มแชร์ไว้, **ตัด** search/filter ออกจาก MVP |
| Place Order (หน้า 6) / Checkout (หน้า 7) | **reconcile ให้ตรงกัน** — หน้า 6 มีตัวเลือก Mobile Banking แต่หน้า 7 มีแค่ QR ต้องเติม fallback โอนธรรมดา + ปุ่ม copy เลขบัญชี/ยอด (ตามทีม 2) |
| ทุกหน้า | เพิ่ม Loading / Error / Offline / Empty / สินค้าหมด, ตรวจ contrast + ขนาดตัวอักษร, ปุ่มล่างต้องอยู่เหนือ gesture area ของ Android |

### 7.2 หน้าใหม่ที่ต้องสร้าง (ช่องว่างสำคัญที่สุด — หลังบ้าน)
- **Seller Dashboard** — สรุปยอดขายวันนี้แบบ minimal (อย่าเพิ่งทำ analytics ใหญ่)
- **Order List** — รายการคำสั่งซื้อ + สถานะ
- **Order Detail** — เปลี่ยนสถานะ, ใส่เลขพัสดุ, ยกเลิก/คืนเงิน
- **Inventory view** — สินค้าใกล้หมด (รวมในหน้า product list ได้)
- **Web Order Tracking** (public, ไม่ต้องลงแอป) — `poatung.app/order/{publicToken}` ดูสถานะ / จ่าย / อัปสลิป / ดูเลขพัสดุ

---

## 8. จุดตัดสินใจที่ค้าง (Open Decisions — **RESOLVED 20 มิ.ย. 2026**)

1. **Cart หลายชิ้น หรือ ซื้อทีละชิ้น?**
   mockup หน้า 5 มีปุ่ม "เพิ่มในตะกร้า" แต่ flow หน้า 6 เป็นสินค้าชิ้นเดียว
   **✅ ตัดสินใจ: รองรับ Cart หลายชิ้น** — สามารถซื้อได้หลายชิ้นต่อออเดอร์ รองรับอนาคต
   → ปุ่ม "เพิ่มในตะกร้า" คงไว้, หน้า 6 (Place Order) ต้องรองรับ OrderItem หลายรายการ, สรุปยอดรวม

2. **Variant (สี/ขนาด)**
   สินค้าตัวอย่างคือเสื้อ oversize ถ้าจะขายเสื้อผ้าจริงต้องตัดสินใจเรื่อง variant ตั้งแต่ data model (กระทบ stock per variant)
   **✅ ตัดสินใจ: Schema-forward — สร้างโครงสร้าง ProductVariant ไว้ตั้งแต่ Phase 1 แต่ไม่เปิด UI**
   - Phase 1: ทุก Product สร้าง default variant 1 ตัวอัตโนมัติ, `OrderItem.variantId` อ้างอิง default variant นั้น — ผู้ขายไม่เห็น UI variant เลย
   - Phase 3: เปิด variant UI (สี/ขนาด + stock per variant) โดยไม่ต้องแตะ schema เดิม เพราะ `OrderItem` รู้จัก `variantId` อยู่แล้ว
   - **ภาระ DB:** เพิ่มแค่ 1 ตาราง + 1 row ต่อสินค้า + 1 FK — ไม่หนัก เหตุผลที่ต้องทำตั้งแต่แรกคือถ้าเพิ่มทีหลัง `OrderItem.productId → variantId` คือ breaking change บน orders เก่า migration แก้ไม่ได้

3. **COD reconciliation** — ถ้าเปิดเก็บเงินปลายทาง ต้องนิยามว่ารายรับลง ledger ตอนไหน
   **✅ ตัดสินใจ: ลง ledger เมื่อพนักงานจัดส่งยืนยันรับเงินสำเร็จเท่านั้น** (ไม่ใช่ตอนส่งออก)
   - สถานะ COD: `รับออเดอร์ → จัดส่ง → พนักงานยืนยัน Order สำเร็จ` → ลงรายรับ (idempotent เช่นกัน)
   - ถ้ามีปัญหา (ส่งไม่ได้/ลูกค้าไม่รับ) → Order ไม่ลง ledger และคืนสต็อก
   - ระหว่าง pending ใช้ state `PENDING_COD` แยกจาก `PAID` เพื่อไม่ให้รายรับปน

---

## 9. แผนเฟส (Phased Rollout)

### Phase 1 — MVP (ต้อง ship)
ตั้งค่าร้าน (stepper) → สร้าง/จัดการสินค้า (มีต้นทุน, schema ProductVariant พร้อม default variant, ไม่มี UI variant) → หน้าร้าน + แชร์ → **Cart หลายชิ้น** + สั่งซื้อ + PromptPay/สลิป (reuse `PKG-15`) + COD → **หลังบ้านจัดการออเดอร์ + state machine (รวม PENDING_COD) + integrity** → ลิงก์ติดตามแบบเว็บ → **ตัดสต็อก + ลงบัญชีอัตโนมัติ (idempotent, COD ลงตอน COMPLETED)** → LINE noti (reuse `PKG-13`) → state หน้าจอครบ

### Phase 2 — เติมประสบการณ์
fallback โอนธรรมดา/copy เลขบัญชี · address dropdown (จังหวัด/อำเภอ/ตำบล) + autofill · UI ค่า threshold · Dashboard ละเอียดขึ้น · digital receipt

### Phase 3 — ขยายและกระตุ้นยอด
Variant UI (สี/ขนาด + stock per variant — schema พร้อมแล้วตั้งแต่ P1) · search/filter (เมื่อปลดล็อกจำนวนสินค้า) · upsell/cross-sell · Flash Sale countdown · คูปอง/ลูกค้าเก่า · Smart Order Inbox (รวมหลายช่องทาง) · รายงานขายดี/กำไรรายสินค้า

---

## 10. Dependencies

- `PKG-15` — PromptPay QR generation + SlipOK verification + state machine การชำระเงิน
- `PKG-13` — LINE Messaging API notification
- Wallet/Ledger model เดิม + ระบบ reconciliation
- Canonical Customer Identity — รองรับ guest checkout + ลิงก์ติดตามแบบเว็บ

---

## 11. Acceptance Criteria — Definition of Done (Phase 1)

- [ ] ผู้ใช้เปิดร้าน, เพิ่มสินค้า (≤5), เผยแพร่หน้าร้านสาธารณะได้
- [ ] ลูกค้า guest สั่งซื้อผ่าน browser โดยไม่ต้องลงแอป จ่าย PromptPay + อัปสลิปได้
- [ ] Order ถูกสร้างตอนยืนยันสั่งซื้อ พร้อม soft-lock สต็อก + QR ยอด fix + timer 30 นาที
- [ ] สลิปซ้ำถูกปฏิเสธ (1 สลิป = 1 ออเดอร์)
- [ ] เมื่อชำระสำเร็จ: ตัดสต็อก + ลงบัญชีเป๋าตุง **ครั้งเดียว** ทดสอบ retry/webhook ซ้ำแล้วไม่ลงซ้ำ
- [ ] ออเดอร์หมดเวลา → ปล่อยสต็อกคืน + CANCELLED อัตโนมัติ
- [ ] ร้านเปลี่ยนสถานะ/ใส่เลขพัสดุ/ยกเลิก-คืนเงิน (คืนสต็อก) ได้
- [ ] ลูกค้าเปิดลิงก์ `poatung.app/order/{token}` เห็นสถานะตรงกับฝั่งร้าน
- [ ] LINE แจ้งเตือนเมื่อมีออเดอร์ใหม่/อัปเดตสถานะ
- [ ] หน้าจอมี Loading / Error / Offline / Empty / สินค้าหมด ครบ

---

## 12. ความเสี่ยงหลัก (Risks)

| ความเสี่ยง | การป้องกัน |
|---|---|
| Ledger ลงรายรับ/ตัดสต็อกซ้ำ | Idempotency key = `orderId` + entry type |
| สลิปใบเดียวใช้หลายออเดอร์ | Unique constraint บน `slipRef` |
| Stock race ตอนออเดอร์พร้อมกัน | Soft-lock ตอนสร้าง + hard-decrement ใน transaction ตอน PAID |
| Timer ไม่ทำงาน → สต็อกค้าง lock | Background job เช็ก `expiresAt` + ปล่อยคืน |
| ลิงก์ติดตามถูกเดา/รั่ว | `publicToken` แบบ unguessable (ไม่ใช่ `orderNo` ลำดับ) |
| ยอด QR ไม่ตรงออเดอร์ | QR ฝังยอด fix ผูกกับออเดอร์ ลูกค้ากรอกเองไม่ได้ |

---

*จัดทำเพื่อ review ภายในทีม Dev — ขอ feedback ในข้อ 8 (Open Decisions) ก่อน lock scope Phase 1*
