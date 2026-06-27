# PKG-15 — รับชำระเงิน (PromptPay/Slip) · Final Handoff

> **สถานะ: UX หลักผ่าน ✅ · เหลือ polish 8 รายการก่อนปิดงาน**
> เจ้าของ: SEVENDOG DEV · แอป: หมูนุ่น–เป๋าตุง · ทดสอบบนเครื่องจริง: 13/06/2569
> มติรวม: ทีม 1 + ทีม 2 + ทีม 3 (ตัดสินใจโดยทีม 3)

---

## ✅ ผลทดสอบวันนี้ (13 มิ.ย. 2569)

| Flow | ผล | หมายเหตุ |
|------|----|---------|
| สร้าง QR Code | ✅ | ยอด, รายละเอียด, ref ครบ |
| ส่งลิงก์ทุก Social / Messenger | ✅ | ส่งก้อนเดียว ไม่ 2-bubble |
| เปิดลิงก์ใน Messenger → เห็น QR | ✅ | OG preview โชว์ QR image |
| เปิดแอปธนาคารสแกน QR | ✅ | PromptPay payload ถูกต้อง |
| อัปโหลดสลิป | ✅ | |
| ตรวจสลิป (Thunder API ใหม่) | ✅ | รวดเร็ว |
| หน้า success ฝั่งลูกค้า (web) | ✅ | ขึ้น "ชำระเรียบร้อย" |
| หน้า success ฝั่งเจ้าของร้าน (app) | ✅ | countdown + auto-redirect |
| Auto-polling (6s × 3 นาที) | ✅ | หน้าเปลี่ยนเองหลังจ่าย |

**มติ:** PKG-15 UX หลักถือว่าผ่านแล้ว งานที่เหลือคือ **polish ก่อน ship** ไม่ใช่เพิ่มฟีเจอร์ใหม่

---

## มติตัดสินใจ (Decision Table)

### ✅ SHIP — ต้องทำให้จบก่อนปิด PKG-15

| # | งาน | มาจากทีม | เหตุผล |
|---|-----|---------|--------|
| 1 | **Confirm dialog ตอนกด Back** เฉพาะเมื่อมีข้อมูล/สร้าง QR แล้ว | ทีม 1, 2, 3 | กันลั่นออกโดยไม่ตั้งใจ |
| 2 | **Resume last active request** เก็บใน SQLite | ทีม 1, 3 | กู้ลิงก์ที่เพิ่งสร้างกลับมาแชร์ซ้ำได้ |
| 3 | **Default expiry 24h → 15 นาที** (constant เดียว) | ทีม 1, 2, 3 | ตรงกับ use case จริง |
| 4 | **🐞 Fix timezone bug** | ทีม 3 เท่านั้น | ลูกค้าเห็นเวลา 2 ค่าต่างกัน 7 ชม. |
| 5 | **🐞 Success page ซ่อน pending UI** | ทีม 3 เท่านั้น | banner + ปุ่ม Save QR ยังขึ้นพร้อม ✅ |
| 6 | **QR: raster image + hint long-press** | ทีม 2, 3 | download button พังใน WebView ของ LINE/Messenger |
| 7 | **Merchant success countdown 15–20s + ปุ่มกลับหน้าหลัก** | ทีม 1, 2, 3 | อ่านทัน + กดข้ามได้ |
| 8 | **เลขอ้างอิง contrast** ใน success page | ทีม 1, 3 | ใช้เทียบสลิป ต้องอ่านง่าย |

### ⏸️ DEFER — ไม่ทำในรอบนี้ (backlog)

| งานที่ทีมเสนอ | ทีมเสนอ | เหตุผลที่เลื่อน |
|---|---|---|
| Expiry picker (10/15/30/24h dropdown) | ทีม 1, 2 | ยังไม่มี use case ต่างกัน — 15 นาทีเดียวพอ, ขยายทีหลังง่าย |
| Payment lifecycle manager + pending-list card แบบ full | ทีม 1 | status เป็นของ server อยู่แล้ว อย่าสร้าง source of truth ซ้อน |
| Composed PNG (QR+ยอด+ref) ผ่าน html2canvas | ทีม 2 | ลูกค้าต้องการแค่ QR สแกน ข้อมูลอยู่ใน payload แล้ว |
| "เปิดใน Chrome/Safari" escape hatch | ทีม 2 | long-press + screenshot ครอบคลุมกรณีนี้แล้ว |
| AsyncStorage draft | ทีม 2 | **ผิด stack** — แอปเป็น expo-sqlite/Drizzle offline-first อยู่แล้ว |

> **หมายเหตุสถาปัตยกรรม:** ทีม 2 แนะนำ AsyncStorage — ข้าม เพราะแอปนี้ใช้ expo-sqlite + Drizzle อยู่แล้ว ให้ใช้ DB เดิม

---

## รายละเอียด SHIP Items

### #1 — Confirm Dialog ตอนกด Back

แยก 2 สถานะ:

**สถานะ A: กรอกฟอร์มแต่ยังไม่สร้าง QR**
```
Dialog: "ยกเลิกรายการนี้?"
"ข้อมูลที่กรอกจะหายไป"
[ทำต่อ]  [ออก]
```
ไม่ต้อง persist ฟอร์มครึ่ง ๆ — กรอกใหม่ 5 วินาที

**สถานะ B: สร้าง QR แล้ว (มี ref/link แล้ว)**
```
Dialog: "ออกจากรายการนี้?"
"รายการยังสามารถชำระได้จนถึง xx:xx"
[ทำรายการต่อ]  [ออก แต่เก็บรายการไว้]
```
ไม่มีปุ่ม "ยกเลิกรายการ" — ไม่จำเป็น ลูกค้าไม่ได้จ่ายก็ expired เอง

---

### #2 — Resume Last Active Request (SQLite)

**เก็บใน local SQLite ตาราง `lastPaymentRequest`:**
```
{ ref, link, amount, detail, expiresAt }
```

เมื่อ mount หน้า PKG-15:
- ถ้ามี record และ `expiresAt > now` → แสดง banner บาง ๆ:
```
มีรายการค้าง · ฿1.00 · ref C1EDC635
[ทำต่อ]  [สร้างใหม่]
```
- "ทำต่อ" → เปิดหน้า QR/ลิงก์เดิมเพื่อแชร์ซ้ำ
- "สร้างใหม่" → ล้าง record แล้วเริ่มใหม่
- `expiresAt` ผ่านแล้ว → ไม่ต้องโชว์ banner

---

### #3 — Default Expiry 15 นาที

```typescript
// poatung-server/src/config.ts (หรือ constants)
export const PAYMENT_EXPIRY_MINUTES = 15;
```

เปลี่ยนทีเดียวที่นี่ — ส่วนที่อื่นใช้ค่านี้ ไม่มี hardcode 24h อีก

---

### #4 — 🐞 Fix Timezone Bug (สำคัญ)

**บั๊กที่พบ (จาก screenshot):**
- ข้อความแชร์ใน Messenger → หมดอายุ **12:12**
- หน้าจ่ายเงิน → ชำระก่อน **05:12**
- ต่างกัน 7 ชม. = UTC+7 → หน้าจ่ายเงิน render expiry เป็น UTC

**ทางแก้ (วิธีที่ดีที่สุด — ไม่ต้อง format timezone):**

เมื่อเหลือ ≤ 15 นาที เปลี่ยนแสดงเป็น **live countdown**:
```html
⏳ เหลือเวลา 14:32 นาที
```
คำนวณจาก `expiresAt - Date.now()` ทุกวินาที → ไม่ต้อง format timezone เลย → บั๊กนี้หายทั้งก้อน

เมื่อ default เป็น 15 นาที countdown จะขึ้นตลอดตั้งแต่เริ่ม ไม่ต้องมีเวลา absolute เลย

**ถ้าจะคงเวลา absolute:** format ทุกที่เป็น `Asia/Bangkok` ด้วย `Intl.DateTimeFormat`:
```typescript
new Intl.DateTimeFormat('th-TH', {
  timeZone: 'Asia/Bangkok',
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
}).format(new Date(expiresAt))
```

---

### #5 — 🐞 Success Page ซ่อน Pending UI

**บั๊กที่พบ (จาก screenshot):**
Image 2/3 โชว์พร้อมกัน:
- ✅ ขอบคุณสำหรับการชำระเงิน
- ⏳ banner "กรุณาชำระภายใน 24 ชั่วโมง" ← ต้องซ่อน
- 💾 ปุ่ม "บันทึก QR เป็นรูปภาพ" ← ต้องซ่อน
- ช่องอัปโหลดสลิป ← ต้องซ่อน

**แก้ใน `payPage.ts` (web payment page):**
เมื่อ `status === 'paid'` ให้ซ่อน/remove elements:
- `.deadline-banner` → `display: none`
- `.save-qr-btn` → `display: none`
- `.upload-slip-section` → `display: none`

**เหลือในหน้า success:**
- ✅ icon ใหญ่
- ยอดเงิน + ref เด่น ๆ
- "ชำระเรียบร้อยแล้ว"
- "บันทึกหน้าจอนี้เป็นหลักฐาน"

---

### #6 — QR Save: Long-Press Primary

**ลำดับความสำคัญ (ตามที่ลูกค้าใช้จริง):**

1. **Primary — Long-press to save (เชื่อถือได้ที่สุดใน WebView)**
   - ทำให้ QR element เป็น `<img src="...qr.png">` (raster PNG) ไม่ใช่ SVG inline หรือ canvas
   - เพิ่ม hint: *"📌 กดค้างที่รูป QR เพื่อบันทึก"*
   - ทำงานใน LINE/Messenger/IG WebView ทุกตัว

2. **Secondary — ปุ่ม "บันทึก QR เป็นรูปภาพ"**
   - คงไว้ (navigator.share หรือ download fallback)
   - ใช้ endpoint `/pay/:id/qr.png` ที่ทำไว้แล้ว

3. **Fallback — screenshot**
   - hint "หรือบันทึกหน้าจอนี้" มีอยู่แล้ว

> **ตอบตรง ๆ:** ทำปุ่ม download ได้ แต่มันพังเงียบใน WebView ของ LINE/Messenger ซึ่งคือช่องทางที่ลูกค้าใช้จริง Long-press คือวิธีที่ reliable ที่สุด

---

### #7 — Merchant App Success Countdown

**ปรับใน `expense-tracker/app/payment-qr.tsx`:**
```typescript
// เปลี่ยนจาก 5 วินาที → 20 วินาที
setCountdown(20);
```

เพิ่มปุ่ม "กลับหน้าหลัก" ให้กดข้ามการนับถอยหลังได้ทันที:
```tsx
<TouchableOpacity onPress={() => router.back()}>
  <Text>กลับหน้าหลัก</Text>
</TouchableOpacity>
```

---

### #8 — Reference Contrast

**ใน CSS ของ payPage.ts:**
```css
.ref-number {
  font-size: 1.1rem;
  font-weight: 700;   /* เพิ่มจาก 400 */
  color: #1a1a1a;     /* เพิ่ม contrast จากสีเทาอ่อน */
  letter-spacing: 0.05em;
}
```

---

## ลำดับการ Implement (แนะนำ)

```
วันเดียว:
  #5 Success page bug (CSS + JS เล็กน้อย — เร็วสุด)
  #7 Countdown 5s → 20s + ปุ่มกลับ (1 บรรทัด + 1 component)
  #8 Reference contrast (CSS 3 บรรทัด)
  #3 Default expiry 15 นาที (constant 1 จุด)
  #4 Timezone → countdown (แก้ HTML template)

วันสอง:
  #6 QR raster image + hint (แก้ HTML template)
  #1 Back button confirm dialog (React Native useEffect + Alert)
  #2 Resume last request SQLite (Drizzle schema + query)
```

---

## Definition of Done (QA checklist)

- [ ] กด back ตอนมีข้อมูล → เด้ง confirm, ไม่หายเงียบ
- [ ] สร้าง QR → ปิดแอป → เปิดใหม่ → แถบ "มีรายการค้าง" ขึ้น → กด "ทำต่อ" แชร์ลิงก์เดิมได้
- [ ] บิลใหม่ default หมดอายุ 15 นาที (ไม่ใช่ 24h)
- [ ] หน้าจ่ายเงินโชว์ countdown ไม่ใช่เวลา absolute UTC ผิด timezone
- [ ] หน้า success (web) **ไม่มี** banner เดดไลน์ / ปุ่ม Save QR / ช่องอัปสลิป ค้าง
- [ ] QR element เป็น raster `<img>` + hint กดค้าง — ทดสอบใน **LINE WebView** (ไม่ใช่แค่ Chrome)
- [ ] Merchant app success countdown ≥15s + มีปุ่มกลับหน้าหลัก
- [ ] เลขอ้างอิงอ่านชัดในหน้า success (contrast สูง)

### QA Environment สำคัญ
> ⚠️ ต้องเทสใน WebView จริงของ **LINE / Messenger / IG** — บั๊ก timezone display และ download ไม่โผล่บน Chrome desktop

---

## สถาปัตยกรรมสรุป (Architecture Notes)

| Layer | Tech | หมายเหตุ |
|-------|------|---------|
| App | Expo + React Native | confirm dialog ใช้ `Alert.alert()` |
| Local DB | expo-sqlite + Drizzle | เก็บ lastPaymentRequest ตรงนี้ ไม่ใช่ AsyncStorage |
| Server | Hono.js on Render.com | QR endpoint, status, slip verify |
| Slip verify | Thunder API v2 | JSON body `{ base64 }` ไม่ใช่ FormData |
| DB | Neon PostgreSQL (sg) | paymentRequests + paymentSlips |
| QR | `/pay/:id/qr.png` | server-generated PNG, cacheable 24h |

---

## Packages ที่เกี่ยวข้อง

| Package | สถานะ |
|---------|--------|
| PKG-13 LINE OAuth | ✅ ผ่านเครื่องจริง 10 มิ.ย. |
| PKG-15 PromptPay QR | ✅ UX หลักผ่าน · ⏳ polish 8 รายการ |
| LINE push notification หลังจ่าย | ⏸️ backlog (ต่อยอด PKG-13) |

---

*หมูนุ่น+เป๋าตุง · SEVENDOG DEV · อัปเดต 13/06/2569*
