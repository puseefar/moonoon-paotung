# เอกสารรายการ Feature — App หมูนุ่น + เป๋าตุง
### Feature Inventory & Status Report
**วันที่จัดทำ:** 17 พฤษภาคม 2569  
**ปรับปรุงเพิ่มเติม:** 21 พฤษภาคม 2569  
**จัดทำโดย:** SEVENDOG DEV Team  
**เอกสารกลยุทธ์ที่อ้างอิง:** `STRATEGIC-FEATURE-ROADMAP.md`  
**Stack:** React Native + Expo · Drizzle ORM + SQLite · Zustand · TypeScript  
**Version ปัจจุบัน:** 1.0.0

---

## ภาพรวมระบบ (System Overview)

| รายการ | จำนวน |
|--------|-------|
| หน้าจอหลัก (Routes) | 19 |
| ตาราง Database | 10 |
| บริการหลัก (Services) | 18 |
| ประเภทธุรกรรม | 3 (รายรับ / รายจ่าย / โอนเงิน) |
| รูปแบบ Export | 2 (CSV, HTML) |
| ระบบรักษาความปลอดภัย | 2 (PIN 6 หลัก, Biometric) |
| ประเภทกราฟ | 3 (Pie, Bar, Line Trend) |

---

## หมวด 1 — หน้าจอหลัก (Screens)

---

### 1.1 หน้าหลัก (Home Screen)
**เส้นทาง:** `/(tabs)/index`

| Feature | รายละเอียด | สถานะ |
|---------|-----------|-------|
| Header เปลี่ยนตามเวลา | พื้นหลังเปลี่ยน 4 ช่วงเวลา (เช้า/กลางวัน/เย็น/กลางคืน) พร้อมคำทักทาย | ✅ พร้อมใช้ |
| แสดงชื่อผู้ใช้ + ตำบล | แสดง Avatar, ชื่อ, ตำบลที่อยู่ | ✅ พร้อมใช้ |
| เมนู Grid 3×2 | 6 เมนูหลักเชื่อมต่อทุกส่วนของแอป | ✅ พร้อมใช้ |
| Card Menu รายการ | Banner โปรโมชัน + EASY Store + Apply Loan | ✅ พร้อมใช้ |
| ปุ่ม สแกนสลิป / QR ของฉัน | Quick Action ใน Header | ✅ พร้อมใช้ |
| Pull-to-Refresh | ดึงข้อมูลใหม่ทั้งหมด | ✅ พร้อมใช้ |

---

### 1.2 บันทึกธุรกรรม (Add Transaction)
**เส้นทาง:** `/(tabs)/add`

| Feature | รายละเอียด | สถานะ |
|---------|-----------|-------|
| สลับโหมด รายรับ/รายจ่าย | Toggle tab ด้านบน | ✅ พร้อมใช้ |
| คีย์แพดตัวเลขแบบ Custom | ใส่จำนวนเงินพร้อม format | ✅ พร้อมใช้ |
| เลือกหมวดหมู่ | Grid หมวดหมู่กรองตามประเภท | ✅ พร้อมใช้ |
| เลือกกระเป๋าเงิน | เลื่อนดูกระเป๋าทั้งหมดในแนวนอน | ✅ พร้อมใช้ |
| เลือกวันที่ | Date picker (กำหนดไม่เกินวันนี้) | ✅ พร้อมใช้ |
| ช่องบันทึกโน้ต | ข้อความอิสระ | ✅ พร้อมใช้ |
| Validation ก่อนบันทึก | ตรวจจำนวนเงิน / หมวดหมู่ / กระเป๋า | ✅ พร้อมใช้ |

---

### 1.3 ประวัติรายการ (Transaction History)
**เส้นทาง:** `/(tabs)/history`

| Feature | รายละเอียด | สถานะ |
|---------|-----------|-------|
| เลื่อนดูรายเดือน | ปุ่ม ก่อนหน้า / ถัดไป (ล็อคเดือนปัจจุบัน) | ✅ พร้อมใช้ |
| กรองตามประเภท | ทั้งหมด / รายจ่าย / รายรับ | ✅ พร้อมใช้ |
| กรองตามหมวดหมู่ | Dropdown หมวดหมู่ | ✅ พร้อมใช้ |
| ค้นหาด้วยข้อความ | ค้นหาจากโน้ตหรือชื่อหมวดหมู่ | ✅ พร้อมใช้ |
| รายการจัดกลุ่มตามวัน | หัวข้อวันพร้อมยอดรวมรายวัน | ✅ พร้อมใช้ |
| แถบสรุปผล | จำนวนรายการ / รายรับ / รายจ่ายที่กรอง | ✅ พร้อมใช้ |
| Swipe ลบรายการ | ปัดซ้ายเพื่อลบ | ✅ พร้อมใช้ |
| Empty State | แสดงข้อความเมื่อไม่มีรายการ | ✅ พร้อมใช้ |

---

### 1.4 รายงาน & กราฟ (Reports & Charts)
**เส้นทาง:** `/report`

| Feature | รายละเอียด | สถานะ |
|---------|-----------|-------|
| เลื่อนดูรายเดือน | เปรียบเทียบข้ามเดือนได้ | ✅ พร้อมใช้ |
| การ์ดสรุป 4 ใบ | รายรับ / รายจ่าย / ยอดคงเหลือ / เฉลี่ยต่อวัน | ✅ พร้อมใช้ |
| % เปลี่ยนแปลง | เปรียบเทียบกับเดือนก่อน (ขึ้น/ลง) | ✅ พร้อมใช้ |
| Pie Chart รายจ่ายตามหมวด | แสดง % และจำนวนเงินต่อหมวด | ✅ พร้อมใช้ |
| Pie Chart รายรับตามหมวด | แสดงเมื่อมีรายรับ | ✅ พร้อมใช้ |
| Bar Chart รายสัปดาห์ | รายรับ/จ่ายแต่ละวันของสัปดาห์ | ✅ พร้อมใช้ |
| Line Chart แนวโน้ม 6 เดือน | เทรนด์รายรับ vs รายจ่าย | ✅ พร้อมใช้ |

---

### 1.5 สแกนสลิป (Scan Slip / OCR)
**เส้นทาง:** `/scan-slip`

| Feature | รายละเอียด | สถานะ |
|---------|-----------|-------|
| สแกน QR Code แบบ Real-time | ใช้กล้องตรวจจับ QR สลิปโอนเงิน | ✅ พร้อมใช้ |
| เลือกรูปจากแกลเลอรี | นำเข้าสลิปจากรูปที่มีอยู่ | ✅ พร้อมใช้ |
| OCR อ่านข้อมูลสลิป | ดึง จำนวนเงิน / ธนาคาร / วันที่ / ชื่อผู้โอน | ✅ พร้อมใช้ |
| ตรวจซ้ำสลิป (Dedup) | ป้องกันบันทึกสลิปเดิมซ้ำด้วย Hash | ✅ พร้อมใช้ |
| ยืนยันและบันทึก | สร้างธุรกรรมจากข้อมูลสลิปอัตโนมัติ | ✅ พร้อมใช้ |
| กรอกเพิ่มด้วยตัวเอง | แก้ไขประเภท / หมวดหมู่ / กระเป๋า | ✅ พร้อมใช้ |
| Skip บันทึกสลิปเปล่า | บันทึก slip record โดยไม่สร้าง transaction | ✅ พร้อมใช้ |
| Visual Scan Frame | กรอบสแกนพร้อมมุมสีขาว | ✅ พร้อมใช้ |

---

### 1.6 กระเป๋าเงิน (Wallet Management)
**เส้นทาง:** `/wallet-manage`

| Feature | รายละเอียด | สถานะ |
|---------|-----------|-------|
| ดูยอดรวมทุกกระเป๋า | แสดงยอดรวมทั้งหมดด้านบน | ✅ พร้อมใช้ |
| เพิ่ม/แก้ไขกระเป๋า | ตั้งชื่อ + ไอคอน Emoji + ยอดเริ่มต้น | ✅ พร้อมใช้ |
| ลบกระเป๋า (Soft Delete) | ซ่อนกระเป๋า ข้อมูลยังคงอยู่ | ✅ พร้อมใช้ |
| รองรับหลายกระเป๋า | ไม่จำกัดจำนวน | ✅ พร้อมใช้ |
| สีแสดงสถานะยอด | เขียว (บวก) / แดง (ลบ) | ✅ พร้อมใช้ |
| ปุ่มโอนเงินระหว่างกระเป๋า | เชื่อมต่อหน้า Wallet Transfer | ✅ พร้อมใช้ |

---

### 1.7 โอนเงินระหว่างกระเป๋า (Wallet Transfer)
**เส้นทาง:** `/wallet-transfer`

| Feature | รายละเอียด | สถานะ |
|---------|-----------|-------|
| เลือกกระเป๋าต้นทาง / ปลายทาง | เลื่อนแนวนอน แยกรายการ | ✅ พร้อมใช้ |
| ปุ่ม Swap ต้นทาง/ปลายทาง | สลับกระเป๋าด้วยคลิกเดียว | ✅ พร้อมใช้ |
| Custom Numpad | ป้อนจำนวนเงิน | ✅ พร้อมใช้ |
| Validation | จำนวน > 0 / ต้องไม่เป็นกระเป๋าเดียวกัน | ✅ พร้อมใช้ |

---

### 1.8 หมวดหมู่ (Category Management)
**เส้นทาง:** `/category-manage`

| Feature | รายละเอียด | สถานะ |
|---------|-----------|-------|
| แยกหมวดรายรับ/รายจ่าย | Toggle tab | ✅ พร้อมใช้ |
| เพิ่ม/แก้ไขหมวดหมู่ | ชื่อ + Emoji (30 แบบ) + สี (16 สี) | ✅ พร้อมใช้ |
| ลบหมวดหมู่ | ป้องกันลบหมวด Default | ✅ พร้อมใช้ |

---

### 1.9 รายการประจำ (Recurring Transactions)
**เส้นทาง:** `/recurring`

| Feature | รายละเอียด | สถานะ |
|---------|-----------|-------|
| สร้างกฎรายการซ้ำ | รายรับ/จ่ายที่เกิดซ้ำตามรอบ | ✅ พร้อมใช้ |
| ความถี่ 4 แบบ | รายวัน / รายสัปดาห์ / รายเดือน / รายปี | ✅ พร้อมใช้ |
| เปิด/ปิดกฎแต่ละรายการ | Toggle Switch | ✅ พร้อมใช้ |
| ประมวลผลรายการค้างชำระ | ปุ่ม Manual trigger | ✅ พร้อมใช้ |
| แสดงวันครบกำหนดถัดไป | คำนวณอัตโนมัติ | ✅ พร้อมใช้ |

---

### 1.10 เป้าหมายการออม (Savings Goals)
**เส้นทาง:** `/savings`

| Feature | รายละเอียด | สถานะ |
|---------|-----------|-------|
| สร้างเป้าหมาย | ชื่อ + จำนวนเงิน + วันสิ้นสุด + Emoji | ✅ พร้อมใช้ |
| แสดง Progress Bar | % ความสำเร็จ + จำนวนคงเหลือ | ✅ พร้อมใช้ |
| เพิ่มเงินเข้าเป้าหมาย | บันทึกจำนวนที่ออมเพิ่ม | ✅ พร้อมใช้ |
| ตรวจจับครบเป้าหมาย | Alert แจ้งเตือนเมื่อออมครบ | ✅ พร้อมใช้ |
| Emoji ไอคอน 12 แบบ | เลือกสัญลักษณ์เป้าหมาย | ✅ พร้อมใช้ |

---

### 1.11 Backup & Restore
**เส้นทาง:** `/backup`

| Feature | รายละเอียด | สถานะ |
|---------|-----------|-------|
| Export JSON | ส่งออกฐานข้อมูลทั้งหมดเป็นไฟล์ JSON | ✅ พร้อมใช้ |
| Import JSON | นำเข้าไฟล์ Backup คืน | ✅ พร้อมใช้ |
| Preview ก่อน Restore | แสดงจำนวน Transaction/กระเป๋า/หมวด | ✅ พร้อมใช้ |
| Confirmation Dialog | เตือน destructive operation | ✅ พร้อมใช้ |
| Sync Log | ประวัติการ Backup/Restore ล่าสุด 10 รายการ | ✅ พร้อมใช้ |
| แชร์ผ่าน Native Share Sheet | ส่งไปยัง Google Drive / Line / Email | ✅ พร้อมใช้ |

---

### 1.12 ส่งออกรายงาน (Export Report)
**เส้นทาง:** `/export-report`

| Feature | รายละเอียด | สถานะ |
|---------|-----------|-------|
| เลือกเดือน | ปุ่มเดือนก่อน/ถัดไป | ✅ พร้อมใช้ |
| Export CSV | รองรับ Excel / Google Sheets (UTF-8 BOM) | ✅ พร้อมใช้ |
| Export HTML | รายงานพิมพ์ได้ / บันทึกเป็น PDF | ✅ พร้อมใช้ |
| ปฏิทินพุทธศักราช | แสดงปี พ.ศ. | ✅ พร้อมใช้ |

---

### 1.13 ความปลอดภัย — PIN & Biometric
**เส้นทาง:** `/app-lock`

| Feature | รายละเอียด | สถานะ |
|---------|-----------|-------|
| PIN 6 หลัก | ตั้ง / เปลี่ยน / ยืนยัน / ลบ PIN | ✅ พร้อมใช้ |
| Biometric | Face ID / ลายนิ้วมือ / สแกนม่านตา | ✅ พร้อมใช้ |
| Auto-lock | ล็อคอัตโนมัติเมื่อออกจากแอป | ✅ พร้อมใช้ |
| Setup Mode | ตั้ง PIN ครั้งแรก + ยืนยัน | ✅ พร้อมใช้ |
| Haptic Feedback | สั่นเมื่อกด PIN ถูก/ผิด | ✅ พร้อมใช้ |
| SecureStore Encrypted | เก็บ PIN อย่างปลอดภัย (iOS Keychain / Android Keystore) | ✅ พร้อมใช้ |

---

### 1.14 การแจ้งเตือน (Notification Settings)
**เส้นทาง:** `/notification-settings`

| Feature | รายละเอียด | สถานะ |
|---------|-----------|-------|
| เปิด/ปิดแจ้งเตือน | Toggle switch | ✅ พร้อมใช้ |
| เลือกเวลา 8 ช่วง | 07:00 – 22:00 | ✅ พร้อมใช้ |
| Notification ทดสอบ | ส่ง Test notification ทันที | ✅ พร้อมใช้ |
| ขอ Permission อัตโนมัติ | Request เมื่อเปิดใช้งาน | ✅ พร้อมใช้ |

---

### 1.15 Starter Templates
**เส้นทาง:** `/starter-templates`

| Feature | รายละเอียด | สถานะ |
|---------|-----------|-------|
| ค้นหาอาชีพ/กิจกรรม | Search bar สำหรับค้นหาชุดเริ่มต้นตามอาชีพ กิจกรรม หรือคำที่เกี่ยวข้อง | ✅ พร้อมใช้ |
| Filter chips | กรองตามกลุ่ม เช่น ยอดนิยม บุคคลทั่วไป ค้าขาย ฟรีแลนซ์ เกษตร ครอบครัว | ✅ พร้อมใช้ |
| Persona Templates 12 แบบ | มี template หลักครอบคลุมอาชีพไทย เช่น นักศึกษา พนักงานเงินเดือน แม่ค้าออนไลน์ เกษตรกร ไรเดอร์ | ✅ พร้อมใช้ |
| การ์ด Template แบบกระชับ | แสดงคำอธิบายสั้น กลุ่มเป้าหมาย helper tags และตัวอย่างข้อความที่ผู้ใช้มักพิมพ์ | ✅ พร้อมใช้ |
| ใช้ Template นี้ | เพิ่มหมวดรายรับ/รายจ่ายให้อัตโนมัติ พร้อมข้ามหมวดที่มีอยู่แล้ว | ✅ พร้อมใช้ |
| ให้ระบบช่วยเลือก | ถาม 3 คำถามเรื่องแหล่งรายได้ ลักษณะงาน และรายจ่ายที่เกิดบ่อย แล้วแนะนำ template ที่เหมาะที่สุด | ✅ พร้อมใช้ |
| Template สำรอง | ถ้าคะแนนใกล้กัน ระบบจะแจ้ง template รองที่ใกล้เคียงเพื่อช่วยตัดสินใจ | ✅ พร้อมใช้ |
| สร้างชุดเริ่มต้นเอง | มี CTA และแนวทาง UI แล้ว รอทำ flow เต็มในเฟสถัดไป | 🟡 มีโครงแล้ว |

---

## หมวด 2 — ฐานข้อมูล (Database Schema)

**เครื่องมือ:** Drizzle ORM + SQLite (expo-sqlite) — **Offline-First**

| ตาราง | วัตถุประสงค์ | จำนวน Field |
|-------|------------|------------|
| `wallets` | กระเป๋าเงิน | 8 |
| `categories` | หมวดหมู่รายรับ/จ่าย | 9 |
| `transactions` | ธุรกรรมทั้งหมด (รับ/จ่าย/โอน) | 13 |
| `walletActivityLogs` | timeline การเปลี่ยนแปลงยอดของแต่ละกระเป๋า | 12 |
| `recurringRules` | กฎรายการซ้ำ | 11 |
| `savingsGoals` | เป้าหมายการออม | 10 |
| `appSettings` | ค่าการตั้งค่า Key-Value | 3 |
| `syncLog` | ประวัติ Backup/Restore | 7 |
| `scannedSlips` | ข้อมูลสลิปที่สแกน (Dedup) | 14 |
| `quickAddLearningRules` | กฎจำคำที่ผู้ใช้ยืนยัน/แก้หมวดใน Smart Entry | 10 |

---

## หมวด 3 — บริการหลัก (Core Services)

| Service | หน้าที่ |
|---------|--------|
| `authService` | PIN + Biometric authentication |
| `walletService` | CRUD กระเป๋าเงิน + คำนวณยอด |
| `transactionService` | CRUD ธุรกรรม + สรุปรายเดือน |
| `categoryService` | CRUD หมวดหมู่ |
| `dailySnapshotService` | สรุปภาพรวมรายวันและสุทธิของเดือนบนหน้า Home |
| `quickAddParser` | วิเคราะห์ข้อความ Smart Entry / Quick Add แบบ rule-based + scoring |
| `quickAddLearningService` | จดจำคำที่ผู้ใช้แก้หรือยืนยัน เพื่อเพิ่มความแม่นยำครั้งถัดไป |
| `starterTemplateService` | จัดการ Starter Templates, แนะนำ template และเพิ่มหมวดอัตโนมัติ |
| `taxReadinessService` | สร้าง checklist ความพร้อมด้านภาษีแบบ compliance-safe |
| `slipInboxService` | จัดกลุ่มและสรุปสถานะสลิป pending / review / confirmed |
| `recurringService` | ประมวลผลรายการซ้ำอัตโนมัติ |
| `savingsService` | จัดการเป้าหมายการออม |
| `reportService` | คำนวณกราฟและสถิติ |
| `slipService` | Parse QR + Deduplication |
| `ocrService` | OCR อ่านข้อมูลจากรูปสลิป |
| `backupService` | Export/Import JSON Database |
| `exportService` | สร้างไฟล์ CSV และ HTML |
| `notificationService` | กำหนดเวลาแจ้งเตือนรายวัน |

---

## หมวด 4 — คุณสมบัติทางเทคนิค (Technical Capabilities)

| คุณสมบัติ | รายละเอียด |
|----------|-----------|
| **Offline-First** | ทุกข้อมูลอยู่ใน SQLite บนเครื่อง ไม่ต้องมี Internet |
| **Cross-Platform** | Android ✅ / iOS ✅ |
| **Dark Mode** | รองรับ System theme อัตโนมัติ |
| **Safe Area** | รองรับ Notch / Gesture bar ทุกรุ่น |
| **Encrypted Storage** | PIN เก็บใน SecureStore (ไม่ใช่ plaintext) |
| **OTA Update** | อัปเดต UI ได้ผ่าน Expo Updates ไม่ต้อง rebuild |
| **EAS Build** | พร้อม config สำหรับ Preview / Production build |
| **Thai Locale** | UI และ format ตัวเลข/วันที่ภาษาไทย |
| **Haptic Feedback** | สัมผัสตอบสนองทุก interaction สำคัญ |

---

## หมวด 5 — สรุปตาม Phase การพัฒนา (เพื่อวางแผน Roadmap)

> **หมายเหตุ:** ตารางนี้จัดเรียง Feature ปัจจุบันเพื่อช่วยทีมกำหนดว่าอะไรควรอยู่ใน Free / Pro / AI Premium

### ✅ Feature ที่มีแล้ว — เหมาะกับ Version Free

| Feature | พร้อมใช้ |
|---------|---------|
| บันทึกรายรับ-รายจ่าย-โอน | ✅ |
| กระเป๋าเงินหลายใบ | ✅ |
| หมวดหมู่ Custom | ✅ |
| ประวัติรายการพร้อม Filter | ✅ |
| รายงานกราฟรายเดือน | ✅ |
| Starter Templates | ✅ |
| ระบบช่วยเลือก Template 3 คำถาม | ✅ |
| รายการประจำ (Recurring) | ✅ |
| เป้าหมายการออม | ✅ |
| PIN + Biometric Lock | ✅ |
| แจ้งเตือนรายวัน | ✅ |
| Backup / Restore (Local) | ✅ |
| Export CSV / HTML | ✅ |
| สแกนสลิป + OCR | ✅ |
| Dark Mode | ✅ |

### 🔄 Feature ที่ยังขาด — เป้าหมาย Version Pro

| Feature | สถานะ |
|---------|-------|
| Cloud Backup (Google Drive / iCloud) | 🔲 ยังไม่มี |
| Multi-User / ครอบครัว | 🔲 ยังไม่มี |
| Widget หน้าจอหลัก | 🔲 ยังไม่มี |
| ธีม / สีแอปแบบกำหนดเอง | 🔲 ยังไม่มี |
| นำเข้า Statement ธนาคาร (CSV) | 🔲 ยังไม่มี |
| Budget / งบประมาณรายหมวด | 🔲 ยังไม่มี |
| Report ขั้นสูง (PDF Export ตรง) | 🔲 ยังไม่มี |

### 🤖 Feature เป้าหมาย Version AI Premium

| Feature | สถานะ |
|---------|-------|
| AI วิเคราะห์พฤติกรรมการใช้จ่าย | 🔲 ยังไม่มี |
| AI/Smart แนะนำหมวดหมู่อัตโนมัติ | 🟡 มีแบบ Rule-based + User Learning ใน Quick Add (ยังไม่ใช้ AI cloud) |
| AI คาดการณ์ค่าใช้จ่ายเดือนหน้า | 🔲 ยังไม่มี |
| Chat กับ AI Agent ถามเรื่องการเงิน | 🔲 ยังไม่มี |
| สรุปรายงานด้วย AI (Auto Summary) | 🔲 ยังไม่มี |
| Smart Notification (AI เลือกเวลา) | 🔲 ยังไม่มี |

---

## หมวด 6 — ข้อมูลเทคนิคสำหรับทีมพัฒนา

```
Project Structure
─────────────────────────────────────────
expense-tracker/
├── app/                    # Expo Router (File-based routing)
│   ├── (tabs)/             # Tab navigation
│   │   ├── index.tsx       # Home
│   │   ├── add.tsx         # บันทึกธุรกรรม
│   │   ├── history.tsx     # ประวัติ
│   │   ├── settings.tsx    # ตั้งค่า
│   │   └── _layout.tsx     # Tab layout + icons
│   ├── report.tsx          # รายงาน
│   ├── scan-slip.tsx       # สแกนสลิป
│   ├── wallet-manage.tsx   # กระเป๋าเงิน
│   ├── wallet-transfer.tsx # โอนเงิน
│   ├── recurring.tsx       # รายการประจำ
│   ├── savings.tsx         # เป้าหมายออม
│   ├── backup.tsx          # Backup
│   ├── export-report.tsx   # ส่งออก
│   ├── app-lock.tsx        # ตั้งค่าล็อค
│   ├── category-manage.tsx # หมวดหมู่
│   └── notification-settings.tsx
├── components/             # UI Components
│   ├── auth/               # LockScreen
│   ├── home/               # HomeHeader, MenuGrid, CardMenu
│   ├── transaction/        # TransactionItem, Filter
│   ├── wallet/             # BalanceCard
│   ├── charts/             # Pie, Bar, Line charts
│   └── ui/                 # Card, etc.
├── db/                     # Drizzle ORM
│   ├── schema.ts           # Table definitions
│   ├── provider.tsx        # DatabaseProvider
│   └── migrations/         # SQL migrations
├── services/               # Business logic (12 services)
├── stores/                 # Zustand state
├── lib/                    # Utilities (format, haptics, theme, time)
├── assets/                 # Logo, images, fonts
└── constants/              # Colors, config
```

**Dependencies หลัก:**

| Package | Version | วัตถุประสงค์ |
|---------|---------|------------|
| expo | ~54.0.33 | Framework |
| react-native | 0.81.5 | UI Runtime |
| expo-router | ~6.0.23 | Navigation |
| drizzle-orm | ^0.45.2 | ORM |
| expo-sqlite | ~16.0.10 | Database |
| zustand | ^5.0.12 | State Management |
| expo-secure-store | ~15.0.8 | Encrypted storage |
| expo-local-authentication | ~17.0.8 | Biometric |
| react-native-reanimated | ~4.1.1 | Animation |
| expo-updates | ~29.0.16 | OTA Update |

---

*เอกสารนี้สร้างจากการวิเคราะห์ Source Code จริง — SEVENDOG DEV Team — 17 พ.ค. 2569*
