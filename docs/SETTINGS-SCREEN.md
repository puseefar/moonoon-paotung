# SETTINGS SCREEN — รายละเอียดหน้า ตั้งค่า
> ไฟล์: `app/(tabs)/settings.tsx`
> อัปเดต: 2026-06-14

---

## โครงสร้าง Settings Menu

หน้า Settings แบ่งเป็น **4 section** ดังนี้:

---

### Section 1: ฟีเจอร์

| เมนู | Icon | Route ปลายทาง | ไฟล์ Screen |
|---|---|---|---|
| 📖 สมุดชีวิต | `savings.png` | `/diary` | `app/diary.tsx` |
| 💳 รับชำระเงิน (PromptPay) | `scan.png` | `/payment-qr` | `app/payment-qr.tsx` |
| 💬 LINE แจ้งเตือน | `notification.png` | `/line-connect` | `app/line-connect.tsx` |
| 🏪 Mini Shop | `wallet.png` | `/shop-manage` | `app/shop-manage.tsx` |
| เตรียมงบก่อนออก (Pre-Trip) | `recurring.png` | `/trip-estimator` | `app/trip-estimator.tsx` |
| วางแผนงบประมาณ | `savings.png` | `/budget` | `app/budget.tsx` |
| ติดตามบิล | `recurring.png` | `/bills` | `app/bills.tsx` |
| รายจ่ายประจำ | `recurring.png` | `/recurring` | `app/recurring.tsx` |
| เป้าหมายการออม | `savings.png` | `/savings` | `app/savings.tsx` |
| สแกนสลิป | `scan.png` | `/scan-slip` | `app/scan-slip.tsx` |
| Slip Inbox | `inbox.png` | `/slip-inbox` | `app/slip-inbox.tsx` |
| Tax Box — กล่องลดหย่อนภาษี | `tax.png` | `/tax-box` | `app/tax-box.tsx` |
| Tax Checklist | `tax.png` | `/tax-readiness` | `app/tax-readiness.tsx` |
| รายงานและกราฟ | `report.png` | `/report` | `app/report.tsx` |

---

### Section 2: จัดการ

| เมนู | Icon | Route ปลายทาง | ไฟล์ Screen |
|---|---|---|---|
| กระเป๋าเงิน | `wallet.png` | `/wallet-manage` | `app/wallet-manage.tsx` |
| หมวดหมู่ | `category.png` | `/category-manage` | `app/category-manage.tsx` |
| Starter Templates | `templates.png` | `/starter-templates` | `app/starter-templates.tsx` |

---

### Section 3: ข้อมูล

| เมนู | Icon | Route ปลายทาง | ไฟล์ Screen |
|---|---|---|---|
| สำรองและกู้คืนข้อมูล | `backup.png` | `/backup` | `app/backup.tsx` |
| ส่งออกรายงาน | `export.png` | `/export-report` | `app/export-report.tsx` |

---

### Section 4: ทั่วไป

| เมนู | Icon | Route ปลายทาง | ไฟล์ Screen / Action |
|---|---|---|---|
| การแจ้งเตือน | `notification.png` | `/notification-settings` | `app/notification-settings.tsx` |
| ล็อคแอป | `lock.png` | `/app-lock` | `app/app-lock.tsx` |
| ธีม | `theme.png` | — (toggle inline) | `Appearance.setColorScheme()` |

---

## Widget Icons (assets/setting-widget-icon/)

ไฟล์ icon ที่ใช้ใน Settings screen มีทั้งหมด **15 ไฟล์**:

| ชื่อไฟล์ | ใช้กับเมนู |
|---|---|
| `backup.png` | สำรองและกู้คืนข้อมูล |
| `category.png` | หมวดหมู่ |
| `export.png` | ส่งออกรายงาน |
| `inbox.png` | Slip Inbox |
| `lock.png` | ล็อคแอป |
| `notification.png` | การแจ้งเตือน, LINE แจ้งเตือน |
| `recurring.png` | Pre-Trip, ติดตามบิล, รายจ่ายประจำ |
| `report.png` | รายงานและกราฟ |
| `savings.png` | สมุดชีวิต*, วางแผนงบ, เป้าหมายการออม |
| `scan.png` | รับชำระเงิน, สแกนสลิป |
| `setting.png` | (header icon) |
| `tax.png` | Tax Box, Tax Checklist |
| `templates.png` | Starter Templates |
| `theme.png` | ธีม |
| `wallet.png` | Mini Shop, กระเป๋าเงิน |

> *หมายเหตุ: `savings.png` ใช้แทน `budget.png` ชั่วคราว (TODO ใน code: `// TODO: replace with budget.png`)

---

## Dependencies ของ settings.tsx

```
imports:
  - react-native (Image, View, Text, ScrollView, Pressable, StyleSheet)
  - expo-router (useRouter)
  - react-native-safe-area-context (useSafeAreaInsets)
  - react-native-linear-gradient (LinearGradient)
  - @/constants/Colors
  - @/components/useColorScheme
  - @/components/ui/Card
```
