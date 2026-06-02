# แผนพัฒนา App หมูนุ่น + เป๋าตุง
### Development Plan from Feature Inventory & Strategic Roadmap

**ปรับปรุงล่าสุด:** 18 พฤษภาคม 2569  
**จัดทำโดย:** SEVENDOG DEV Team  
**แหล่งอ้างอิง:** `FEATURE-INVENTORY.md`, `STRATEGIC-FEATURE-ROADMAP.md`, `IMPLEMENTATION-QUEUE.md`  
**หลักการพัฒนา:** ทำทีละ phase, จบเป็น milestone, บันทึกความก้าวหน้าใน `PROGRESS-LOG.md`

---

## Phase 0 — Project Baseline & Verification

**เป้าหมาย:** ตรวจสอบของเดิมให้ชัดก่อนเพิ่มฟีเจอร์ใหม่

| ลำดับ | งาน | ผลลัพธ์ที่ต้องได้ | สถานะ |
|------|-----|-------------------|-------|
| 0.1 | ตรวจสอบ 15 screens, 8 tables, 12 services ตาม Feature Inventory | รายการจุดที่ตรง/ไม่ตรงกับเอกสาร | เสร็จแล้ว |
| 0.2 | ตรวจ TypeScript/build/runtime errors | รายการ error และงานแก้ไข | เสร็จแล้ว |
| 0.3 | ตรวจ flow หลัก: add transaction, history, report, wallet, scan slip | baseline QA checklist | เสร็จแล้ว |
| 0.4 | จัดลำดับ technical debt ที่ขวาง Phase 1 | backlog สำหรับแก้ก่อนเปิด beta | เสร็จแล้ว |

---

## Phase 1 — Free Launch / Closed Beta

**เป้าหมาย:** สร้างนิสัยผู้ใช้, พิสูจน์ตลาด, เปิด Closed Beta 100-500 คน

| ลำดับ | Feature | งานพัฒนา | สถานะ |
|------|---------|----------|-------|
| 1.1 | Daily Money Snapshot | ปรับหน้า Home ให้แสดงวันนี้ใช้เท่าไหร่, เดือนนี้เหลือเท่าไหร่, หมวดเด่น, recurring ใกล้ถึง | เสร็จแล้ว |
| 1.2 | Quick Add Parser | เพิ่ม rule parser เช่น "กาแฟ 45" เป็น amount/category/note และใช้ร่วมกับปุ่มลัด | เสร็จแล้ว |
| 1.3 | Starter Templates | เพิ่ม onboarding templates: นักศึกษา, พนักงานเงินเดือน, ฟรีแลนซ์, แม่ค้าออนไลน์, เจ้าของร้าน, คนเตรียมยื่นภาษี | เสร็จแล้ว |
| 1.4 | Tax Readiness Checklist | เพิ่ม checklist ความครบถ้วนเอกสารภาษีไทย พร้อม disclaimer และรอบเตือน ภ.ง.ด.94 / 90 / 91 โดยไม่ใช้ score และไม่คำนวณภาษี | เสร็จแล้ว |
| 1.5 | Auto Tax-Tagging | เพิ่ม taxonomy/flag ให้ category และ transaction เพื่อระบุรายการลดหย่อนภาษี | รอดำเนินการ |
| 1.6 | Slip Inbox | เพิ่มสถานะสลิป: รอจัดหมวด, อ่านยอดสำเร็จ, ต้องตรวจเอง, เป็นหลักฐานภาษีได้ | เสร็จแล้ว |
| 1.7 | Gallery Bulk Import | เลือกรูปสลิปหลายใบเข้า Slip Inbox แบบจำกัดจำนวนสำหรับ Free | รอดำเนินการ |
| 1.8 | Budget 3 หมวด | ตั้งงบรายหมวดแบบ Free limit และแจ้งเตือนใกล้เกินงบ | รอดำเนินการ |
| 1.9 | หมูนุ่น Financial Avatar | เพิ่ม asset/state logic แสดงอารมณ์ตาม snapshot/budget/savings | รอดำเนินการ |
| 1.10 | 7-Day Trial Mission | เพิ่ม guided mission, progress, summary วันที่ 7 และจุดแนะนำ Pro | รอดำเนินการ |
| 1.11 | Share Success Card | แชร์ภาพสรุปภารกิจ/เป้าออมสำเร็จลง LINE/FB/IG | รอดำเนินการ |
| 1.12 | Beta Readiness | QA, privacy text, store metadata, feedback channel | รอดำเนินการ |

---

## Phase 2 — Free to Pro

**เป้าหมาย:** ขายความสะดวก, ความปลอดภัยข้อมูล, และรายงานระดับมืออาชีพ

| ลำดับ | Feature | งานพัฒนา | สถานะ |
|------|---------|----------|-------|
| 2.1 | Cloud Backup & Sync | ออกแบบ sync provider สำหรับ Google Drive/iCloud และ conflict policy | รอดำเนินการ |
| 2.2 | OCR ไม่จำกัด + Auto Categorize | ปลด limit และเพิ่ม logic จัดหมวดจากประวัติเก่า | รอดำเนินการ |
| 2.3 | Budget ขั้นสูง | งบไม่จำกัด, รายสัปดาห์/เดือน, template, วิเคราะห์ย้อนหลัง | รอดำเนินการ |
| 2.4 | Tax Full Report | รวมยอดลดหย่อน, แนบสลิปกับรายการ, คำนวณภาษีสุทธิล่วงหน้า | รอดำเนินการ |
| 2.5 | Export PDF/Excel | รายงาน PDF และ Excel แยกชีตภาษีพร้อมยื่น | รอดำเนินการ |
| 2.6 | Import Bank Statement | นำเข้า statement CSV และ map column/category | รอดำเนินการ |
| 2.7 | Widget เต็มรูปแบบ | เพิ่ม widget หลายแบบสำหรับ snapshot และ quick add | รอดำเนินการ |
| 2.8 | Net Worth Overview | เพิ่มสินทรัพย์, หนี้สิน, สรุป net worth | รอดำเนินการ |

---

## Phase 3 — AI Premium

**เป้าหมาย:** ขายความฉลาดและคำแนะนำส่วนบุคคล

| ลำดับ | Feature | งานพัฒนา | สถานะ |
|------|---------|----------|-------|
| 3.1 | AI Spending Analysis | วิเคราะห์ pattern การใช้จ่ายเชิงลึก | รอดำเนินการ |
| 3.2 | Cashflow Forecast | คาดการณ์เงินเหลือปลายเดือน | รอดำเนินการ |
| 3.3 | Smart Anomaly Alert | เตือนรายการผิดปกติ | รอดำเนินการ |
| 3.4 | AI Auto Categorize | จัดหมวดอัตโนมัติแม่นขึ้นจากบริบทผู้ใช้ | รอดำเนินการ |
| 3.5 | AI Finance Chat Agent | ถามตอบเรื่องเงินและภาษีจากข้อมูลผู้ใช้ | รอดำเนินการ |
| 3.6 | Smart Notification | แจ้งเตือนเชิงบริบท | รอดำเนินการ |
| 3.7 | AI Tax Advisor | แนะนำการวางแผนลดหย่อนภาษีเฉพาะบุคคล | รอดำเนินการ |

---

## เกณฑ์บันทึกความก้าวหน้า

ทุกครั้งที่เริ่ม/จบงาน ให้บันทึกใน `PROGRESS-LOG.md` ด้วยรูปแบบ:

| วันที่ | Phase | งาน | สถานะ | หมายเหตุ | ไฟล์ที่เกี่ยวข้อง |
|--------|-------|-----|-------|----------|-------------------|

สถานะที่ใช้: `ยังไม่เริ่ม`, `กำลังทำ`, `รอตรวจ`, `เสร็จแล้ว`, `ติดปัญหา`
