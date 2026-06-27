# PKG15 — รับชำระเงิน PromptPay Dynamic QR + Slip Inbox
## แผนดำเนินงานสำหรับทีม Coder (Step-by-Step พร้อมจุดตรวจรับทุกสเต็ป)

**Project:** Poatung (หมูนุ่น–เป๋าตุง)
**Package:** PKG15 — PromptPay Payment Collection
**หลักการ:** Reuse pipeline จาก `D:\noonstoreV7` ให้มากที่สุด — ไม่เขียน slip verification ใหม่
**กติกา:** ห้ามข้ามสเต็ป — ทุกสเต็ปต้องผ่าน ✅ Checkpoint ก่อนเริ่มสเต็ปถัดไป

---

## ภาพรวม Flow

```
เจ้าของแอปสร้างรายการรับเงิน
        │
        ▼
[1] PaymentRequest ถูกสร้าง ──► Dynamic QR (มียอดเงิน) + uploadSlipUrl เฉพาะรายการ
        │
        ▼
[2] ลูกค้าสแกน QR จ่ายเงินผ่านแอปธนาคาร
        │
        ▼
[3] ลูกค้าเปิด uploadSlipUrl ──► อัปโหลด/แชร์สลิป
        │
        ▼
[4] Backend: decode mini-QR (jsQR) ──► SlipOK verify ──► ตัดสินสถานะ
        │
        ├── PAID ──────► บันทึกรายรับอัตโนมัติ + push noti เจ้าของ
        ├── NEED_REVIEW ► เข้า Slip Inbox ให้เจ้าของกดยืนยัน
        └── REJECTED ──► แจ้งผู้จ่ายว่าไม่ผ่าน
        │
        ▼
[5] หน้าเว็บผู้จ่าย polling สถานะ ──► แสดงหน้าขอบคุณ
```

**สถานะ (State Machine):**
`WAITING_SLIP → SLIP_UPLOADED → VERIFYING → PAID | NEED_REVIEW | REJECTED | EXPIRED`

กฎ transition:
- ห้ามย้อนสถานะ ยกเว้น `NEED_REVIEW → PAID/REJECTED` (โดยเจ้าของกดยืนยัน)
- `EXPIRED` เกิดได้จาก `WAITING_SLIP` เท่านั้น (cron/lazy check ตอน access)
- ทุก transition ต้องบันทึกลง audit log (ใคร/อะไร/เมื่อไหร่)

---

## STEP 0 — Inventory & Port ของเดิมจาก noonstoreV7

**เป้าหมาย:** รู้ว่าจะ reuse อะไรได้บ้าง ก่อนเขียนโค้ดแม้แต่บรรทัดเดียว

**งาน:**
1. สำรวจ `D:\noonstoreV7` หา module เหล่านี้จาก guest checkout pipeline:
   - PromptPay Dynamic QR generator (EMVCo payload + ยอดเงิน + ref)
   - jsQR — decode mini-QR บนภาพสลิป
   - SlipOK API client (verify transRef / ยอด / บัญชีปลายทาง)
   - File upload + storage handler
   - Slip dedup logic (ถ้ามี)
2. จดบันทึก: path ของแต่ละไฟล์, dependencies, env vars ที่ต้องใช้ (SlipOK API key, branch ID ฯลฯ)
3. ตัดสินใจวิธี port: copy เข้า Poatung backend ตรงๆ หรือ extract เป็น shared package `@noonstore/slip-verify` (แนะนำ copy ก่อนถ้า Poatung ไม่ได้อยู่ใน monorepo เดียวกัน — YAGNI)
4. ทดสอบ run module เดิมแบบ standalone กับสลิปจริง 1 ใบ

**✅ Checkpoint 0 (ตรวจรับ):**
- [ ] มีเอกสาร 1 หน้า ระบุ path + function signature ของทุก module ที่จะ reuse
- [ ] run jsQR decode กับภาพสลิปจริงได้ payload ออกมา
- [ ] ยิง SlipOK ด้วย payload นั้นแล้วได้ response 200 พร้อมข้อมูล transRef/amount
- [ ] ระบุ env vars ครบ และใส่ลง `.env.example` ของ Poatung backend แล้ว

> ⚠️ ถ้าสเต็ปนี้พบว่า module เดิมใช้ไม่ได้ (เช่น SlipOK key หมดอายุ) ให้หยุดและรายงานทันที — อย่าเริ่ม Step 1

---

## STEP 1 — Database Schema (Prisma)

**เป้าหมาย:** วาง data model ให้ครบก่อน เพราะทุกสเต็ปถัดไปพิงกับ schema นี้

**Schema:**

```prisma
model PaymentRequest {
  id           String   @id @default(cuid())
  referenceNo  String   @unique          // PAY-YYYYMMDD-XXXX
  userId       String                    // เจ้าของแอป (ผู้รับเงิน)
  amount       Decimal  @db.Decimal(12, 2)
  description  String?
  receiverName String
  promptpayId  String                    // เบอร์/เลขบัตร ปชช. ผูก PromptPay
  status       PaymentStatus @default(WAITING_SLIP)
  uploadToken  String   @unique          // unguessable, ใช้ใน uploadSlipUrl
  expiresAt    DateTime
  paidAt       DateTime?
  ledgerTxId   String?  @unique          // FK ไปรายรับใน ledger (กัน double-record)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  slips        PaymentSlip[]
}

model PaymentSlip {
  id                   String   @id @default(cuid())
  paymentRequestId     String
  paymentRequest       PaymentRequest @relation(fields: [paymentRequestId], references: [id])
  imageUrl             String
  fileHash             String           // SHA-256 ของไฟล์
  transRef             String?  @unique // จาก mini-QR — dedup ตัวจริง
  detectedAmount       Decimal? @db.Decimal(12, 2)
  detectedBank         String?
  detectedTransferTime DateTime?
  detectedReceiverName String?
  verificationStatus   SlipVerifyStatus @default(PENDING)
  verifyRawResponse    Json?            // SlipOK response เต็มๆ เก็บไว้ debug
  rejectReason         String?
  createdAt            DateTime @default(now())

  @@unique([paymentRequestId, fileHash])  // กันอัปโหลดไฟล์เดิมซ้ำในรายการเดียว
}

enum PaymentStatus {
  WAITING_SLIP
  SLIP_UPLOADED
  VERIFYING
  PAID
  NEED_REVIEW
  REJECTED
  EXPIRED
}

enum SlipVerifyStatus {
  PENDING
  PASSED
  FAILED
  UNREADABLE
}
```

**จุดสำคัญ:**
- `transRef` มี `@unique` ระดับ global — สลิปใบเดียวใช้ซ้ำข้ามรายการไม่ได้ นี่คือ dedup ตัวจริง
- `fileHash` unique แค่ภายในรายการ — กันอัปโหลดรูปเดิมรัวๆ
- `ledgerTxId` unique — การันตีว่า 1 PaymentRequest บันทึกรายรับได้ครั้งเดียว (idempotency)

**✅ Checkpoint 1:**
- [ ] `prisma migrate dev` ผ่านบน dev DB
- [ ] เขียน seed script สร้าง PaymentRequest ตัวอย่าง 3 รายการ
- [ ] ทดสอบ unique constraint: insert transRef ซ้ำ → ต้อง throw error
- [ ] ทดสอบ insert fileHash ซ้ำใน paymentRequest เดียวกัน → ต้อง throw error
- [ ] Code review schema โดย Pu ก่อน merge

---

## STEP 2 — API สร้าง Payment Request + Dynamic QR

**เป้าหมาย:** เจ้าของแอปสร้างรายการรับเงิน ได้ QR + ลิงก์ส่งสลิปกลับมา

**Endpoints:**

```
POST /api/v1/payment-requests
Body: { amount, description?, promptpayId }
Auth: เจ้าของแอป (ต้องเช็ค entitlement PKG15)

Response 201:
{
  id, referenceNo, amount, status: "WAITING_SLIP",
  qrPayload,          // EMVCo string สำหรับ render QR
  uploadSlipUrl,      // https://poatung.app/pay/{id}?t={uploadToken}
  expiresAt
}
```

**งาน:**
1. Port PromptPay QR generator จาก noonstoreV7 — Dynamic QR ต้องฝังยอดเงินตายตัว
2. สร้าง `referenceNo` รูปแบบ `PAY-YYYYMMDD-XXXX` (running per day)
3. สร้าง `uploadToken` ด้วย crypto random ≥ 32 bytes (ห้ามใช้ cuid/uuid v1 ที่เดาได้)
4. `expiresAt` default 24 ชม. (config ได้)
5. Gate ด้วย package entitlement: user ไม่มี PKG15 → 403
6. **ห้าม** ฝัง uploadSlipUrl ลงใน EMVCo payload — QR จ่ายเงินกับลิงก์ส่งสลิปแยกกันเด็ดขาด

**✅ Checkpoint 2:**
- [ ] สร้างรายการยอด 1.00 บาท → เอา qrPayload ไป render → **สแกนด้วยแอปธนาคารจริง** เห็นยอด 1 บาท + ชื่อผู้รับถูกต้อง
- [ ] โอนจริง 1 บาทสำเร็จ (เก็บสลิปนี้ไว้เป็น golden test ของ Step 4)
- [ ] user ที่ไม่มี PKG15 เรียก API → ได้ 403
- [ ] uploadToken ของ 2 รายการไม่ซ้ำกัน และยาวพอ (≥ 43 ตัวอักษร base64url)
- [ ] Unit test: amount ติดลบ/ศูนย์/เกิน limit → 400

---

## STEP 3 — Public Slip Upload Endpoint + Security

**เป้าหมาย:** มี "ปลายทางของสลิป" ที่ปลอดภัย รับไฟล์จากคนแปลกหน้าได้โดยไม่พังระบบ

**Endpoints:**

```
GET  /api/v1/pay/:id?t={token}          → ข้อมูลรายการ (ยอด, ชื่อผู้รับ, สถานะ) สำหรับหน้าเว็บ
POST /api/v1/pay/:id/slip?t={token}     → รับไฟล์สลิป (multipart)
GET  /api/v1/pay/:id/status?t={token}   → สถานะปัจจุบัน (สำหรับ polling)
```

**กฎ security (บังคับครบทุกข้อ):**
1. token ไม่ตรง → 403 / token ตรงแต่รายการ `EXPIRED` หรือเลย `expiresAt` → 410
2. รับเฉพาะ `image/jpeg`, `image/png` — เช็ค magic bytes ไม่ใช่แค่ extension/mimetype header
3. จำกัดขนาด ≤ 5 MB
4. Rate limit: ≤ 5 uploads ต่อ paymentId ต่อชั่วโมง, ≤ 20 ต่อ IP ต่อชั่วโมง
5. คำนวณ SHA-256 ก่อนเก็บ — ถ้า fileHash ซ้ำในรายการเดิม → 409 "สลิปนี้ถูกส่งแล้ว"
6. เก็บไฟล์ใน storage แบบ private (ห้าม public bucket) — ออก signed URL เวลาแสดงผล
7. รายการที่ `PAID` แล้ว → ปิดรับสลิปเพิ่ม (409)

**พฤติกรรมหลังรับไฟล์:** เปลี่ยนสถานะเป็น `SLIP_UPLOADED` → ตอบ 202 ทันที → ส่งเข้า verification (Step 4) แบบ async ธรรมดา (fire-and-forget + error handler) — **ยังไม่ต้องใช้ BullMQ/Redis**

**✅ Checkpoint 3:**
- [ ] Happy path: อัปโหลดสลิปจริง → 202, ไฟล์อยู่ใน storage, record PaymentSlip ถูกสร้าง, สถานะเป็น SLIP_UPLOADED
- [ ] token ผิด → 403 / รายการหมดอายุ → 410 / ไฟล์ 10 MB → 413 / ไฟล์ .exe เปลี่ยนนามสกุลเป็น .jpg → 400
- [ ] อัปโหลดไฟล์เดิมซ้ำ → 409
- [ ] ยิงรัวเกิน rate limit → 429
- [ ] เช็คว่า image URL ใน DB เปิดตรงๆ จาก browser ไม่ได้ (ต้องผ่าน signed URL เท่านั้น)

---

## STEP 4 — Verification Pipeline (หัวใจของ PKG15)

**เป้าหมาย:** ตรวจสลิปอัตโนมัติด้วย jsQR + SlipOK แล้วตัดสินสถานะตาม decision matrix

**Pipeline (port จาก noonstoreV7):**

```
รับ PaymentSlip ──► เปลี่ยน PaymentRequest เป็น VERIFYING
   │
   ├─ 1. jsQR decode mini-QR จากภาพ
   │      └─ decode ไม่ได้ → verificationStatus = UNREADABLE → NEED_REVIEW
   │
   ├─ 2. เช็ค transRef ซ้ำใน DB (global)
   │      └─ ซ้ำ → FAILED, rejectReason = "DUPLICATE_SLIP" → REJECTED
   │
   ├─ 3. ยิง SlipOK verify
   │      └─ SlipOK ตอบ error/timeout → retry 2 ครั้ง → ยังพัง → NEED_REVIEW
   │
   └─ 4. Decision matrix:
          ✓ ยอดตรง (ตรงเป๊ะ)            ─┐
          ✓ บัญชีปลายทางตรงกับ promptpayId ├─ ครบทุกข้อ → PAID
          ✓ เวลาโอนอยู่ในช่วง created→now  ─┘
          ✗ ยอดไม่ตรง                    → REJECTED ("AMOUNT_MISMATCH")
          ✗ บัญชีปลายทางไม่ตรง            → REJECTED ("WRONG_RECEIVER")
          ~ ข้อมูลครบบางส่วน/ก้ำกึ่ง       → NEED_REVIEW
```

**กฎเหล็ก:**
- ระบบ auto ตัดสินได้แค่ `PAID` กับ `REJECTED` ในเคสที่ชัดเจน 100% เท่านั้น — สงสัย = `NEED_REVIEW` เสมอ (กัน "confidently wrong" แบบเคส Toyota)
- เก็บ `verifyRawResponse` จาก SlipOK ทุกครั้ง ไว้ debug
- transition สถานะใช้ transaction + optimistic check (`WHERE status = 'VERIFYING'`) กัน race จากสลิป 2 ใบพร้อมกัน

**✅ Checkpoint 4 — Golden Test Set (บังคับมีครบก่อนผ่าน):**

| # | Test slip | ผลที่ต้องได้ |
|---|-----------|--------------|
| 1 | สลิปจริงจาก Step 2 (ยอด/บัญชีตรง) | PAID |
| 2 | สลิปจริงแต่ยอดไม่ตรง (โอน 1 บาทเข้ารายการ 2 บาท) | REJECTED: AMOUNT_MISMATCH |
| 3 | สลิปใบเดิมส่งซ้ำเข้ารายการใหม่ | REJECTED: DUPLICATE_SLIP |
| 4 | ภาพเบลอ/crop จน QR อ่านไม่ได้ | NEED_REVIEW (UNREADABLE) |
| 5 | สลิปโอนเข้าบัญชีคนอื่น | REJECTED: WRONG_RECEIVER |
| 6 | Mock SlipOK timeout | retry 2 ครั้งแล้ว NEED_REVIEW |
| 7 | สลิป 2 ใบยิงพร้อมกัน (race) | ใบเดียว PAID, อีกใบไม่ทำให้สถานะเพี้ยน |

- [ ] ผ่านครบ 7 เคส
- [ ] เก็บ test slips + expected results เป็น fixture ใน repo (รัน CI ได้ ยกเว้นเคสที่ต้องยิง SlipOK จริง → mock)

---

## STEP 5 — Trigger Layer: บันทึกรายรับ + แจ้งเตือน

**เป้าหมาย:** เมื่อ `PAID` ระบบบันทึกรายรับเข้า ledger ของ Poatung อัตโนมัติ และแจ้งทุกฝ่าย

**งาน:**
1. Event dispatcher ภายใน: เมื่อสถานะเปลี่ยนเป็น `PAID` →
   - สร้างรายรับใน ledger: ยอด, หมวด "รับชำระเงิน", หมายเหตุ = description + referenceNo, แนบ slip image
   - เก็บ `ledgerTxId` กลับลง PaymentRequest (idempotency — มีแล้วห้ามสร้างซ้ำ)
   - Push notification ถึงเจ้าของ: "ได้รับเงิน 350 บาท — ค่าข้าวกล่อง ✅"
2. เมื่อ `NEED_REVIEW` → push notification: "มีสลิปรอตรวจสอบ 1 รายการ"
3. เมื่อ `REJECTED` → ไม่ต้อง noti เจ้าของ (ลด noise) แต่สถานะแสดงในหน้า payer
4. (เผื่ออนาคต) ออกแบบ dispatcher ให้เพิ่ม webhook URL ภายนอกได้ — แต่**ยังไม่ implement** webhook ภายนอกในรอบนี้ ฝั่งผู้จ่ายใช้ polling (Step 6) ไม่ใช่ webhook

**✅ Checkpoint 5:**
- [ ] สลิปผ่าน → รายรับโผล่ใน ledger ถูกต้อง (ยอด/หมวด/หมายเหตุ/สลิปแนบ)
- [ ] Re-run verification ซ้ำกับรายการ PAID เดิม (จำลอง retry) → **ไม่เกิดรายรับซ้ำ** (เช็ค ledgerTxId)
- [ ] Push notification เด้งจริงบนเครื่องทดสอบ ทั้งเคส PAID และ NEED_REVIEW
- [ ] ลบรายรับใน ledger เองแล้ว verify ใหม่ → ระบบไม่สร้างซ้ำมั่ว (ledgerTxId ยังอยู่)

---

## STEP 6 — หน้าเว็บฝั่งผู้จ่าย (Public Web Pages)

**เป้าหมาย:** ลูกค้าที่ไม่มีแอปเรา อัปโหลดสลิปและเห็นหน้าขอบคุณได้จาก browser มือถือ

**Pages (mobile-first เท่านั้น — ผู้ใช้ 99% เปิดจากมือถือ):**

```
/pay/:id?t={token}
  ├─ สถานะ WAITING_SLIP → แสดง: ยอดเงิน, ชื่อผู้รับ, รายการ, ปุ่มอัปโหลดสลิป
  ├─ สถานะ VERIFYING    → "กำลังตรวจสอบสลิป..." + spinner + polling /status ทุก 2.5 วิ
  ├─ สถานะ PAID         → หน้าขอบคุณ: ✅ ชำระเงินสำเร็จ, ยอด, วันที่, referenceNo
  ├─ สถานะ NEED_REVIEW  → "ได้รับสลิปแล้ว ร้านค้ากำลังตรวจสอบ จะแจ้งผลเร็วๆ นี้"
  ├─ สถานะ REJECTED     → เหตุผล + ปุ่มอัปโหลดใหม่ (ถ้ายังไม่หมดอายุ)
  └─ สถานะ EXPIRED      → "ลิงก์หมดอายุ กรุณาติดต่อร้านค้า"
```

**งาน:**
1. Polling: เริ่มหลังอัปโหลด, interval 2.5 วิ, หยุดเมื่อสถานะ terminal (PAID/REJECTED/NEED_REVIEW), timeout 3 นาทีแล้วแสดงข้อความให้รอ noti — **ไม่ใช้ WebSocket**
2. รองรับเปิดจาก in-app browser ของ LINE (ลูกค้าส่วนใหญ่ได้ลิงก์ผ่าน LINE)
3. หน้าขอบคุณมีปุ่ม "บันทึกหน้าจอนี้เป็นหลักฐาน" (แค่ข้อความแนะนำ ไม่ต้องทำ screenshot API)

**✅ Checkpoint 6:**
- [ ] E2E บนมือถือจริง: เปิดลิงก์ → อัปโหลดสลิปจริง → เห็น spinner → เปลี่ยนเป็นหน้าขอบคุณเอง **โดยไม่ต้องกดรีเฟรช** ภายใน ~10 วิ
- [ ] ทดสอบเปิดจาก LINE in-app browser ได้
- [ ] เคส REJECTED → อัปโหลดใหม่ได้และ flow วนกลับมาถูกต้อง
- [ ] เปิดลิงก์โดยตัด token ออก → เห็นแค่ 403 ไม่ leak ข้อมูลรายการ

---

## STEP 7 — Slip Inbox ในแอป (ฝั่งเจ้าของ)

**เป้าหมาย:** เจ้าของเห็นทุกรายการรับเงิน และจัดการเคส NEED_REVIEW ได้

**หน้าจอ (React Native/Expo):**
1. **รายการรับชำระ** — list PaymentRequest เรียงล่าสุด, badge สถานะสี (เขียว PAID / เหลือง NEED_REVIEW / แดง REJECTED / เทา WAITING)
2. **รายละเอียดรายการ** — ข้อมูลรายการ + ภาพสลิป (signed URL) + ข้อมูลที่ระบบอ่านได้ (detectedAmount, detectedBank, เวลาโอน)
3. **เคส NEED_REVIEW** — ปุ่ม "ยืนยันรับเงิน" / "ปฏิเสธ":
   - ยืนยัน → สถานะเป็น PAID → trigger Step 5 ตามปกติ (รายรับ + noti)
   - ปฏิเสธ → ใส่เหตุผล → REJECTED → ฝั่ง payer เห็นผ่าน polling/เปิดลิงก์ซ้ำ
4. ปุ่ม "สร้างรายการรับเงิน" → form ยอด+รายละเอียด → แสดง QR + ปุ่มแชร์ uploadSlipUrl (share sheet → ส่งให้ลูกค้าทาง LINE)

**✅ Checkpoint 7:**
- [ ] สร้างรายการจากแอป → แชร์ลิงก์ผ่าน LINE → ลูกค้า (เครื่องอื่น) จ่าย+ส่งสลิป → รายการในแอปอัปเดตสถานะ
- [ ] เคส NEED_REVIEW: กดยืนยัน → รายรับถูกบันทึก + ผู้จ่ายเห็นหน้าขอบคุณ
- [ ] กดยืนยันรัวๆ 2 ครั้ง → รายรับเกิดครั้งเดียว
- [ ] ภาพสลิปแสดงผ่าน signed URL และ URL หมดอายุได้จริง

---

## STEP 8 — E2E + Edge Cases + ส่งมอบ

**งาน:**
1. รัน E2E เต็ม flow กับเงินจริงยอดเล็ก (1–5 บาท) อย่างน้อย 5 รอบ ครอบคลุม: PAID ตรงๆ, NEED_REVIEW→ยืนยัน, REJECTED→อัปโหลดใหม่→PAID, EXPIRED, duplicate
2. Lazy expiry: เปิดลิงก์รายการที่เลย expiresAt → ระบบ mark EXPIRED ตอนนั้น (ไม่ต้องมี cron ในรอบแรก)
3. Logging: ทุก verification ต้อง trace ได้จาก referenceNo เดียว (structured log)
4. เขียน runbook สั้นๆ: SlipOK ล่มทำไง (ทุกอย่างไหลเข้า NEED_REVIEW — ระบบยังใช้ได้แบบ manual), เช็ค quota SlipOK ที่ไหน
5. Feature flag เปิด PKG15 เฉพาะ test account ก่อน → ใช้จริงภายในทีม 1 สัปดาห์ → ค่อยเปิด Pro tier

**✅ Checkpoint 8 (Definition of Done ทั้ง PKG15):**
- [ ] E2E ผ่านครบ 5 scenario ด้วยเงินจริง
- [ ] Golden test set (Step 4) รันใน CI ได้
- [ ] Runbook + เอกสาร API อยู่ใน repo
- [ ] ทีมใช้เองจริง 1 สัปดาห์ ไม่มี bug ระดับ blocker
- [ ] Pu sign-off

---

## สิ่งที่ตัดออกจากรอบนี้โดยเจตนา (อย่าเผลอทำ)

| ตัดออก | เหตุผล | ทำเมื่อไหร่ |
|--------|--------|------------|
| BullMQ / Redis queue | volume ยังต่ำ, SlipOK 1–2 วิ async ธรรมดาพอ | เมื่อ throughput จริงเกิน ~100 สลิป/ชม. |
| WebSocket / SSE | polling 2.5 วิ บนหน้าเว็บชั่วคราวพอ | ถ้ามี use case realtime อื่นค่อยรวม |
| OCR อ่านสลิปจากภาพ | mini-QR + SlipOK ครอบคลุมสลิปธนาคารไทยเกือบหมด | เมื่อเจอสลิปไม่มี QR เป็นสัดส่วนมีนัย |
| Webhook ไประบบภายนอก | ยังไม่มีผู้ใช้ภายนอกต้องการ | เมื่อมี integration partner จริง |
| Share Extension รับภาพเข้าแอป | ผู้จ่ายไม่มีแอปเรา — เคสจริงน้อย | Phase ถัดไปถ้า data บอกว่าต้องการ |
| Static QR (ไม่ระบุยอด) | Dynamic QR บังคับยอด ทำให้ verify แม่น | ถ้าผู้ใช้เรียกร้อง |

---

## ลำดับการทำงานและ dependency

```
Step 0 (Inventory) ── 1 วัน
   └─► Step 1 (Schema) ── 0.5 วัน
          └─► Step 2 (QR API) ──┐
          └─► Step 3 (Upload) ──┼─ ทำขนานกันได้ ── 2–3 วัน
                                └─► Step 4 (Verify) ── 2 วัน ★ หัวใจ
                                       └─► Step 5 (Trigger) ── 1 วัน
                                              ├─► Step 6 (Web payer) ── 2 วัน
                                              └─► Step 7 (App inbox) ── 2–3 วัน  (ขนานกับ 6 ได้)
                                                     └─► Step 8 (E2E) ── 2 วัน
```

ประมาณการรวม: **~2 สัปดาห์** สำหรับ coder 1–2 คน (ขึ้นกับสภาพของ module ใน noonstoreV7 ที่จะ port)
