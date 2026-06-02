# คิวดำเนินการ App หมูนุ่น + เป๋าตุง
### Step-by-Step Execution Queue

**สร้างเมื่อ:** 18 พฤษภาคม 2569  
**จัดทำโดย:** SEVENDOG DEV Team  
**อ้างอิง:** `FEATURE-INVENTORY.md`, `STRATEGIC-FEATURE-ROADMAP.md`, `DEVELOPMENT-PLAN.md`  
**วิธีใช้งาน:** ทำจากบนลงล่างทีละงาน และบันทึกทุก checkpoint ใน `PROGRESS-LOG.md`

---

## สถานะเอกสาร

| รายการ | สถานะ | หมายเหตุ |
|--------|-------|----------|
| Feature Inventory ฉบับปัจจุบัน | บันทึกแล้ว | `FEATURE-INVENTORY.md` |
| Roadmap ฉบับหลอมรวม 3 ทีม วันที่ 18 พฤษภาคม 2569 | บันทึกแล้ว | `STRATEGIC-FEATURE-ROADMAP.md` |
| แผนพัฒนา Phase 0-3 | บันทึกแล้ว | `DEVELOPMENT-PLAN.md` |
| บันทึกความก้าวหน้า | ใช้งานอยู่ | `PROGRESS-LOG.md` |

---

## งานที่ต้องดำเนินการต่อไป

### Step 0 — Baseline QA ให้จบก่อนเพิ่มฟีเจอร์

| ลำดับ | งาน | สิ่งที่ต้องตรวจ | ผลลัพธ์ที่ต้องบันทึก | สถานะ |
|------|-----|------------------|------------------------|-------|
| 0.3.1 | Add Transaction Flow | validation, category, wallet, balance update, summary refresh | ผ่านแบบ static + compile | เสร็จแล้ว |
| 0.3.2 | History Flow | filter, search, monthly navigation, swipe delete, wallet balance rollback | ผ่านแบบ static + compile | เสร็จแล้ว |
| 0.3.3 | Report Flow | monthly report, category charts, weekly chart, 6-month trend | ผ่านแบบ static + compile | เสร็จแล้ว |
| 0.3.4 | Wallet Flow | create/update/delete wallet, transfer, total balance | ผ่านแบบ static + compile, มี debt เรื่อง overdraft/validation | เสร็จแล้ว |
| 0.3.5 | Scan Slip Flow | camera permission, QR/OCR, dedup, save slip, create transaction, skip slip | ผ่านแบบ static + compile, มี bug risk เรื่อง duplicate slip | เสร็จแล้ว |
| 0.4 | Technical Debt Backlog | จุดเสี่ยงที่ขวาง Phase 1 | backlog จัดลำดับความสำคัญแล้ว | เสร็จแล้ว |

### ผลตรวจ Step 0 — Baseline QA

| Flow | ผลตรวจ | หมายเหตุ |
|------|--------|----------|
| Add Transaction | ผ่าน | มี validation จำนวนเงิน/หมวดหมู่/กระเป๋า, บันทึกผ่าน `useTransactionStore`, อัปเดต wallet/summary หลังบันทึก |
| History | ผ่าน | โหลดรายการตามเดือน, filter type/category/search, swipe delete แล้ว refresh transaction/wallet/summary |
| Report | ผ่าน | โหลด monthly report, category breakdown, weekly summary, 6-month trend ผ่าน `reportService` |
| Wallet | ผ่าน | CRUD wallet และ transfer ทำงานครบ; ปิด guard กันโอนเกินยอดแล้วใน TD-02 |
| Scan Slip | ผ่านแบบมีข้อควรแก้ | QR/OCR/dedup/save transaction มีครบ แต่ duplicate slip ยังอาจ insert ชน unique `qrHash` ถ้ากดยืนยันบันทึกซ้ำ |
| Compile | ผ่าน | `npx.cmd tsc --noEmit` ผ่าน ไม่มี TypeScript error |

### Technical Debt ที่ต้องปิดก่อน Phase 1.1

| ลำดับ | ความสำคัญ | รายการ | เหตุผล | ไฟล์หลัก |
|------|-----------|--------|--------|----------|
| TD-01 | สูง | แก้ duplicate slip save flow | ปิดแล้ว: เมื่อพบสลิปซ้ำ UI ปิดปุ่มบันทึก, handler กันซ้ำอีกชั้น, และ skip ไม่ insert สลิปซ้ำ | `app/scan-slip.tsx` |
| TD-02 | กลาง | เพิ่ม guard กันโอนเงินเกินยอด | ปิดแล้ว: UI ปิดปุ่ม/แจ้งยอดเงินไม่พอ และ service ปฏิเสธ transfer ที่ยอดต้นทางไม่พอ | `app/wallet-transfer.tsx`, `services/walletService.ts` |
| TD-03 | กลาง | เพิ่ม try/finally ใน store load flows | ปิดแล้ว: action ที่เปิด `isLoading` ปิดสถานะคืนผ่าน `finally` ครอบ `useTransactionStore`, `useWalletStore`, และ `useSummaryStore` | `stores/useTransactionStore.ts`, `stores/useWalletStore.ts`, `stores/useSummaryStore.ts` |
| TD-04 | ต่ำ | เพิ่มข้อความ fallback เมื่อ gallery OCR/QR ไม่พบข้อมูล | ปิดแล้ว: reset state ก่อนอ่านรูปใหม่ และแสดง alert แนะนำเลือกรูปชัดขึ้นหรือใช้กล้องสแกนแทน | `app/scan-slip.tsx` |

### Step 1 — เริ่ม Phase 1 จากแกนที่กระทบผู้ใช้มากที่สุด

| ลำดับ | Feature | งานแรกที่ควรทำ | เหตุผล | สถานะ |
|------|---------|----------------|--------|-------|
| 1.1 | Daily Money Snapshot | สร้าง service/helper คำนวณ today spend, month balance, top category, upcoming recurring และแสดงบนหน้า Home | เป็นหน้าแรกและเป็นฐาน retention | เสร็จแล้ว |
| 1.2 | Quick Add Parser | เพิ่ม parser rule-based และช่อง Quick Add ในหน้า Add เช่น "กาแฟ 45" หรือ "เงินเดือน 30000" | เพิ่มความเร็วการบันทึกโดยไม่แตะ DB หนัก | เสร็จแล้ว |
| 1.3 | Starter Templates | เพิ่ม template หมวดหมู่ตาม persona และหน้าเลือกใช้งานจาก Settings | ลดแรงเสียดทาน onboarding | เสร็จแล้ว |
| 1.4 | Tax Readiness Checklist | เปลี่ยนแนวจาก Score เป็น checklist ความครบถ้วนเอกสาร พร้อม disclaimer และ reminder ภ.ง.ด.94 / 90 / 91 | ลดความเสี่ยง compliance และสร้างจุดต่างเรื่องภาษีไทย | เสร็จแล้ว |
| 1.5 | Slip Inbox State Machine | เพิ่มสถานะสลิปและหน้ารวมสลิปแบบ local-first | ต่อยอด OCR ให้เป็น workflow และ data engine สำหรับภาษี | เสร็จแล้ว |

### Product Decision — Slip Inbox / Privacy

| ประเด็น | การตัดสินใจ |
|---------|-------------|
| การสแกนสลิปใน Free | ไม่ gate การเก็บข้อมูลหลัก ให้ผู้ใช้เก็บข้อมูลในเครื่องได้อย่างใจกว้าง เพราะประวัติสลิปคือ data moat และเป็นฐานของภาษี |
| Privacy message | Free = local-first ข้อมูลอยู่ในเครื่องผู้ใช้ ไม่ขึ้น cloud เว้นแต่ผู้ใช้เลือก |
| Pro positioning | Pro ขายความสะดวกของ cloud sync หลายเครื่อง, storage รูปสลิป, auto-categorize, tax export และตาข่ายกันข้อมูลหาย ไม่สื่อว่า Free ไม่ปลอดภัย |
| Slip Inbox role | เป็น state machine ของข้อมูลสลิป: รอจัดหมวด, ต้องตรวจ, สำเร็จ, หลักฐานภาษี, ข้าม |

### Stability / Smart Entry Notes

| ประเด็น | สถานะ |
|---------|-------|
| Expo SDK dependency mismatch | ปรับด้วย `npx expo install --fix` แล้ว; `expo-doctor` เหลือ warning เฉพาะ `@react-native-ml-kit/text-recognition` untested กับ New Architecture |
| Expo Go notification warning | ปรับ `notificationService` เป็น lazy import และกันการเปิด notification ใน Expo Go พร้อมแนะนำ development build |
| Quick Add ภาษาไทย | เพิ่ม synonym สำหรับรายรับจากงาน เช่น ฟรีแลนซ์, รับงาน, งานนอก, ค่าจ้าง, ลูกค้าจ่าย, ขายของ |
| Smart Entry preview | หน้า Add แสดง preview หลัง parse และมีปุ่ม `บันทึกเลย` เมื่อข้อมูลครบ |
| Auto Category จากคำอธิบาย | ปรับให้ auto-suggest หมวดทันทีระหว่างพิมพ์ และรองรับคำใช้งานจริง เช่น `ฟรีเเลนซ์`, `จ่ายตลาด`, `ซื้อผัก`, `ซื้อผลไม้`, `ห้องซ้อมดนตรี`, `ค่าห้อง` |
| Save Flow ลื่นขึ้น | ก่อนเตือนเลือกหมวด ระบบจะ parse คำอธิบายซ้ำอีกครั้ง และหลังบันทึกใช้ snackbar แทน popup เพื่อให้บันทึกต่อได้เร็วขึ้น |
| Thai Smart Parser scoring | ใช้คะแนนรายรับ/รายจ่ายแทน default ตรง ๆ เพื่อให้ `รับค่าตัดต่อวีดีโอ`, `รับค่าออกแบบ`, `ลูกค้าโอนค่ามัดจำ` เป็นรายรับ และยังให้ `จ่ายค่าน้ำค่าไฟ`, `ซื้อผักผลไม้` เป็นรายจ่าย |
| Quick Add button copy | เปลี่ยนปุ่ม `เติม` เป็น `เพิ่ม` และใช้ placeholder ตัวอย่าง `รับค่าตัดต่อวีดีโอ` เพื่อลดความสับสนของผู้ใช้ใหม่ |

---

## กติกาการบันทึกความก้าวหน้า

ทุกครั้งที่เริ่มงาน ให้เพิ่มบรรทัดสถานะ `กำลังทำ` ใน `PROGRESS-LOG.md`  
ทุกครั้งที่จบงาน ให้เพิ่มบรรทัดสถานะ `เสร็จแล้ว` หรือ `ติดปัญหา` พร้อมไฟล์ที่แก้ไข/ตรวจสอบ  
ถ้ามี bug ให้บันทึกเป็น backlog ก่อนแก้ เพื่อให้ตามรอยการตัดสินใจได้
