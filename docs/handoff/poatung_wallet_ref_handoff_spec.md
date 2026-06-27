# แผนปรับปรุงระบบ MOONOON-PAOTUNG (หมูนุ่น+เป๋าตุง)
## Wallet Reference & Audit Trail — Engineering Hand-off Spec

**เอกสารโดย:** Pu (Tech Co-founder, SEVENDOG DEV)
**วันที่:** 14 มิ.ย. 2026
**อ้างอิงผลทดสอบ:** Deep Check 14/07/2026 + ความเห็นทีม 1 และทีม 2
**ระดับความสำคัญรวม:** P1 (ไม่ใช่ cosmetic — ปลดล็อกความสามารถด้าน Tax/Audit ของแอป)

---

## 0. สรุปการตัดสินใจ (อ่านก่อนเริ่มงาน)

ทีม 1 และทีม 2 เห็นตรงกันว่าหน้า History ไม่แสดงแหล่งที่มากระเป๋าเงิน แต่ **วินิจฉัยสาเหตุพลาดทั้งคู่** จึงเสนอให้แก้ schema ก่อน เอกสารนี้ปรับลำดับใหม่ตามหลักฐานจริง และตัดงานที่เกินจำเป็นออก (YAGNI)

| ประเด็น | คำตัดสิน |
|---|---|
| ประวัติไม่โชว์กระเป๋า | **Display bug ไม่ใช่ data gap** — `wallet_id` ผูกถูกอยู่แล้ว (ยอดกระเป๋าคำนวณตรง) → แก้ UI ก่อน ไม่ต้องแตะ schema |
| "ยอดสลิปไม่เข้าวันนี้" (ทีม 2) | **ไม่ใช่บั๊ก** — เป็นการลงวันที่ตามเหตุการณ์จริงที่ถูกต้อง ห้ามแก้ให้สลิปย้อนหลังเด้งเข้า "วันนี้" |
| UX ตอนสแกนสลิปย้อนหลัง | รับข้อเสนอ แต่เป็น P2 (โชว์วันที่สลิป + ให้เลือก, เก็บ `transaction_date` + `record_date`) |
| field ที่ต้องเพิ่ม | เก็บ `wallet_name_snapshot`, `source_type`, `source_ref` / เลื่อน `wallet_type_snapshot`, `source_meta_json` |
| บังคับเลือกกระเป๋า | **ไม่บังคับ** — default + แก้ได้ (ลด friction พ่อค้าแม่ค้า) |
| Migration | audit ก่อน, ห้าม auto ยัด "เงินสด", orphan = "ไม่ระบุกระเป๋า" |

---

## หลักการ Data Model (เป้าหมายปลายทาง)

แยกข้อมูลออกเป็น 2 ชั้นให้ชัด (ตามที่ทีม 1 เสนอ ปรับให้ minimal):

- **Wallet Reference** = เงินเข้า/ออกจากกระเป๋าไหน → `wallet_id`, `wallet_name_snapshot`
- **Source Reference** = รายการนี้เกิดจาก flow ไหน → `source_type`, `source_ref`

> **เหตุผลที่ต้องเก็บ snapshot ชื่อกระเป๋า:** เมื่อผู้ใช้เปลี่ยนชื่อ/ลบกระเป๋าในอนาคต ประวัติเก่าต้องอ่านได้เหมือนใบเสร็จ — จำเป็นต่อความน่าเชื่อถือเวลายื่นภาษี ไม่ใช่ของฟุ่มเฟือย

```
transaction {
  id, type, amount, categoryId, date,
  wallet_id,                // ผูกอยู่แล้ว — ต้องยืนยันใน Phase 0
  wallet_name_snapshot,     // เพิ่ม Phase 2
  source_type,              // เพิ่ม Phase 2
  source_ref,               // เพิ่ม Phase 2
  trade_set_id,             // ใช้ของเดิม (trade_groups) สำหรับ Trade Set
  note, createdAt
}
```

`source_type` ที่ใช้จริง: `manual` | `daily_snapshot` | `trade_set` | `scan_slip` | `qr_payment` | `transfer` | `opening_balance` | `recurring` | `legacy`

---

## Phase 0 — Data Audit (ก่อนเขียนโค้ดใดๆ) **[Blocking · ครึ่งวัน]**

อย่าเพิ่งเขียน migration จนกว่าจะรู้ผลข้อนี้

**งาน:**
1. รันคิวรีนับ transaction ที่ `wallet_id IS NULL` แยกตาม source/ประเภท เพื่อยืนยันสมมติฐานว่ารายการ manual/snapshot/trade-set/opening-balance ผูกกระเป๋าครบอยู่แล้ว
2. **เช็คผลรวมหน้าแรก:** ยอดรวมหัวจอ = ผลบวกกระเป๋าทั้งหมดจริงไหม (พบความต่างที่สงสัยจาก screenshot: หัวจอ 444,221.80 vs ผลบวกชิป 464,221.80 = ต่าง 20,000) ถ้าจริง → ยกเป็น **P0** ทันที

**เกณฑ์ผ่าน:** ได้ตัวเลขชัดเจนว่ามี orphan transaction กี่รายการ และผลรวมหน้าแรก reconcile หรือไม่

---

## Phase 1 — แก้ History Display **[P1 · Quick Win · ทำได้ทันที]**

งาน UI ล้วน ไม่แตะ schema — ปิดคำบ่นได้ ~80%

**งาน:** เพิ่ม sub-line ใต้ชื่อรายการในหน้า History โดย join `wallet_id` กับตารางกระเป๋าเพื่อดึงชื่อมาแสดง

**รูปแบบแสดงผล:**
- รายรับ → `เข้ากระเป๋า: เงินสด`
- รายจ่าย → `จ่ายจาก: SCB`
- ยอดตั้งต้น → `กระเป๋า: SCB`
- Trade Set → `ต้นทุน: เงินสด · รับเข้า: เงินสด` (ถ้าคนละกระเป๋าให้แยกบรรทัด)
- สลิป → คงของเดิม `สลิป: ไทยพาณิชย์ (SCB) | Ref: 00460...`
- หา wallet ไม่เจอ → `ไม่ระบุกระเป๋า`

**เกณฑ์ผ่าน:** ทุกรายการในภาพ scrnli_stL9SM3dEBGX0Q (เกษตรกร, ยอดตั้งต้น ×3, ค่าโทรศัพท์) แสดงชื่อกระเป๋าครบ และ deploy ได้อิสระโดยไม่รอ phase อื่น

---

## Phase 2 — Schema Hardening **[P1]**

**งาน:**
```sql
ALTER TABLE transactions ADD COLUMN wallet_name_snapshot TEXT;
ALTER TABLE transactions ADD COLUMN source_type TEXT;
ALTER TABLE transactions ADD COLUMN source_ref TEXT;
```
> เลื่อน `wallet_type_snapshot`, `source_meta_json` ไป P2-ภายหลัง (ยังไม่จำเป็น — derive type จาก wallet ที่ยังอยู่ได้)

**Migration รายการเก่า:**
- มี `wallet_id` อยู่แล้ว → backfill `wallet_name_snapshot` จากชื่อกระเป๋าปัจจุบัน, ใส่ `source_type` ตามที่เดาได้จาก flow เดิม
- ไม่มี `wallet_id` (orphan) → `wallet_name_snapshot = "ไม่ระบุกระเป๋า"`, `source_type = "legacy"`, ให้ผู้ใช้กดแก้ย้อนหลังได้
- **ห้าม auto ยัดเป็น "เงินสด" ทั้งหมด** — จะทำรายงานภาษีผิด

**เกณฑ์ผ่าน:** หลัง migration ไม่มีรายการ `wallet_name_snapshot IS NULL`; รายการเก่าที่มีกระเป๋ายังอ่านถูกแม้จะลองเปลี่ยนชื่อกระเป๋าต้นทาง

---

## Phase 3 — ทุก Write Path ส่ง Wallet + Source ครบ **[P1]**

**งาน:** ไล่ตรวจทุกจุดที่สร้าง transaction ให้เซ็ต `wallet_id` + `wallet_name_snapshot` + `source_type` ตอนเขียน:

| Flow | source_type | หมายเหตุ |
|---|---|---|
| Manual Entry | `manual` | default กระเป๋าที่ใช้ล่าสุด |
| Daily Snapshot | `daily_snapshot` | default กระเป๋าหลัก |
| Trade Set | `trade_set` | **2 leg ต้องผูกกระเป๋าแยกได้** (ต้นทุน/รายรับคนละกระเป๋าได้) เชื่อมด้วย `trade_set_id` (ใช้ trade_groups เดิม) |
| Scan Slip | `scan_slip` | default = ธนาคารที่ OCR อ่านได้ |
| QR Payment | `qr_payment` | กระเป๋ารับเงินที่ตั้งค่าไว้ |
| Opening Balance | `opening_balance` | กระเป๋าที่สร้าง |
| Transfer | `transfer` | ต้องมีทั้งกระเป๋าต้นทาง/ปลายทาง |
| Recurring | `recurring` | |

**UX หน้าบันทึก:** มี dropdown เลือกกระเป๋า แต่ **pre-fill default ให้ก่อน + แก้ได้ ไม่บังคับ**

**เกณฑ์ผ่าน:** สร้างรายการใหม่จากทุก flow แล้ว query พบ `wallet_id`, `wallet_name_snapshot`, `source_type` ครบทุกครั้ง; Trade Set 2 leg ผูก `trade_set_id` เดียวกัน

---

## Phase 4 — Slip Date UX + record_date **[P2]**

> เลขปัจจุบันถูกต้องแล้ว นี่คือการแก้ "ความสับสน" ไม่ใช่แก้บั๊ก

**งาน:**
1. หน้ายืนยันหลังสแกนสลิป → โชว์ "วันที่ในสลิป" ชัดเจน + ตัวเลือก: `บันทึกตามวันที่ในสลิป (default)` / `บันทึกเป็นวันนี้`
2. เก็บ 2 field: `transaction_date` (วันเกิดเหตุการณ์ — ใช้คำนวณสรุปวันนี้/เดือนนี้) และ `record_date` (วันที่กดบันทึก)
3. (optional) แสดง hint สั้นๆ เมื่อบันทึกสลิปย้อนหลัง เพื่อไม่ให้ผู้ใช้งงว่าทำไมไม่ขึ้นใน "วันนี้"

**เกณฑ์ผ่าน:** สแกนสลิปย้อนหลังแล้วผู้ใช้เลือกวันที่ได้; รายงานวันนี้/เดือนนี้ยังอิง `transaction_date` เหมือนเดิม

---

## Phase 5 — Filters / Detail Page / Tax Export **[P2–P3]**

ต่อยอดบนข้อมูลจาก Phase 1–4 — **อย่าเริ่มก่อนข้อมูลไหลครบ**

- **Filter:** หน้า History เพิ่มกรองตามกระเป๋า (ทุกกระเป๋า/เงินสด/SCB/KTB/BAAC/ไม่ระบุ) และตาม source (บันทึกเอง/สแกนสลิป/Trade Set/QR/โอนเงิน/ยอดตั้งต้น)
- **Detail Page:** กดรายการเห็นข้อมูลเต็ม (รายการ, จำนวน, หมวด, กระเป๋า, ที่มา, Ref, วันที่ทำรายการ, วันที่บันทึก, หมายเหตุ)
- **Tax Export:** CSV/PDF คอลัมน์ `date, type, amount, category, wallet, source_type, source_ref, note`

---

## ลำดับการ Ship

```
P0 → Phase 0 (audit) + เช็คผลรวมหน้าแรก
P1 → Phase 1 (display) → ship ทันที [quick win]
P1 → Phase 2 (schema) → Phase 3 (write paths)  [แก้ root cause]
P2 → Phase 4 (slip date UX)
P2/P3 → Phase 5 (filter / detail / export)
```

ผลลัพธ์: ยกระดับจาก "แอปจดรายรับรายจ่าย" → "ระบบบันทึกการเงินที่มีหลักฐาน ตรวจย้อนหลังได้ ต่อยอดภาษีได้จริง" โดยใส่ effort เท่าที่จำเป็น
