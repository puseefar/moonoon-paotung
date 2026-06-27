# FILE-MAP — Poatung App (expense-tracker)
> อัปเดต: 2026-06-14 | สร้างโดย SEVENDOG DEV

---

## วิธีอ่านสถานะ

| สัญลักษณ์ | ความหมาย |
|---|---|
| ✅ ใช้งาน | ไฟล์นี้ active อยู่ในระบบ ใช้งานจริง |
| ⚠️ ตรวจสอบ | อาจไม่ได้ใช้แล้ว หรือยังไม่ได้ต่อ route |
| 🚧 ร่าง | ไฟล์สร้างแล้วแต่ยังไม่ complete |
| ❌ ไม่ใช้ | สามารถ archive หรือลบได้ |

---

## 1. APP SCREENS — หน้าจอทั้งหมด

### 1.1 Tab Screens (Tab Bar หลัก)

| ไฟล์ | ชื่อหน้าจอ | สถานะ |
|---|---|---|
| `app/(tabs)/_layout.tsx` | Tab Navigation Layout | ✅ ใช้งาน |
| `app/(tabs)/index.tsx` | หน้าหลัก (Home) | ✅ ใช้งาน |
| `app/(tabs)/add.tsx` | บันทึกรายรับ-รายจ่าย (Quick Add) | ✅ ใช้งาน |
| `app/(tabs)/history.tsx` | ประวัติรายการ (History) | ✅ ใช้งาน |
| `app/(tabs)/report-tab.tsx` | รายงานการเงิน (Report Tab) | ✅ ใช้งาน |
| `app/(tabs)/settings.tsx` | ตั้งค่า (Settings Menu) | ✅ ใช้งาน |

### 1.2 Settings → Feature Screens (ฟีเจอร์)

> หน้าจอที่เปิดจาก Settings > ฟีเจอร์

| ไฟล์ | ชื่อเมนู Settings | Route | สถานะ |
|---|---|---|---|
| `app/diary.tsx` | 📖 สมุดชีวิต (รายการ) | `/diary` | ✅ ใช้งาน |
| `app/diary-entry.tsx` | สมุดชีวิต (ดูรายการ) | `/diary-entry` | ✅ ใช้งาน |
| `app/diary-write.tsx` | สมุดชีวิต (เขียน/แก้ไข) | `/diary-write` | ✅ ใช้งาน |
| `app/payment-qr.tsx` | 💳 รับชำระเงิน PromptPay | `/payment-qr` | ✅ ใช้งาน |
| `app/line-connect.tsx` | 💬 LINE แจ้งเตือน | `/line-connect` | ✅ ใช้งาน |
| `app/shop-manage.tsx` | 🏪 Mini Shop (จัดการร้าน) | `/shop-manage` | ✅ ใช้งาน |
| `app/shop-orders.tsx` | Mini Shop (รายการออเดอร์) | `/shop-orders` | ✅ ใช้งาน |
| `app/trip-estimator.tsx` | เตรียมงบก่อนออก (Pre-Trip) | `/trip-estimator` | ✅ ใช้งาน |
| `app/trip-session.tsx` | Pre-Trip (session ที่เปิดอยู่) | `/trip-session` | ✅ ใช้งาน |
| `app/budget.tsx` | วางแผนงบประมาณ (ดูงบ) | `/budget` | ✅ ใช้งาน |
| `app/budget-setup.tsx` | วางแผนงบประมาณ (ตั้งค่า) | `/budget-setup` | ✅ ใช้งาน |
| `app/bills.tsx` | ติดตามบิล | `/bills` | ✅ ใช้งาน |
| `app/recurring.tsx` | รายจ่ายประจำ | `/recurring` | ✅ ใช้งาน |
| `app/savings.tsx` | เป้าหมายการออม | `/savings` | ✅ ใช้งาน |
| `app/scan-slip.tsx` | สแกนสลิป | `/scan-slip` | ✅ ใช้งาน |
| `app/slip-inbox.tsx` | Slip Inbox | `/slip-inbox` | ✅ ใช้งาน |
| `app/slip-verify.tsx` | ยืนยันสลิป (manual) | `/slip-verify` | ✅ ใช้งาน |
| `app/tax-box.tsx` | Tax Box — กล่องลดหย่อนภาษี | `/tax-box` | ✅ ใช้งาน |
| `app/tax-box-add.tsx` | Tax Box (เพิ่มรายการ) | `/tax-box-add` | ✅ ใช้งาน |
| `app/tax-readiness.tsx` | Tax Checklist | `/tax-readiness` | ✅ ใช้งาน |
| `app/report.tsx` | รายงานและกราฟ | `/report` | ✅ ใช้งาน |

### 1.3 Settings → Management Screens (จัดการ)

| ไฟล์ | ชื่อเมนู Settings | Route | สถานะ |
|---|---|---|---|
| `app/wallet-manage.tsx` | กระเป๋าเงิน | `/wallet-manage` | ✅ ใช้งาน |
| `app/wallet-transfer.tsx` | โอนระหว่างกระเป๋า | `/wallet-transfer` | ✅ ใช้งาน |
| `app/wallet/[id].tsx` | รายละเอียดกระเป๋า | `/wallet/[id]` | ✅ ใช้งาน |
| `app/category-manage.tsx` | หมวดหมู่ | `/category-manage` | ✅ ใช้งาน |
| `app/starter-templates.tsx` | Starter Templates | `/starter-templates` | ✅ ใช้งาน |

### 1.4 Settings → Data Screens (ข้อมูล)

| ไฟล์ | ชื่อเมนู Settings | Route | สถานะ |
|---|---|---|---|
| `app/backup.tsx` | สำรองและกู้คืนข้อมูล | `/backup` | ✅ ใช้งาน |
| `app/export-report.tsx` | ส่งออกรายงาน | `/export-report` | ✅ ใช้งาน |

### 1.5 Settings → General Screens (ทั่วไป)

| ไฟล์ | ชื่อเมนู Settings | Route | สถานะ |
|---|---|---|---|
| `app/notification-settings.tsx` | การแจ้งเตือน | `/notification-settings` | ✅ ใช้งาน |
| `app/app-lock.tsx` | ล็อคแอป (FaceID/PIN) | `/app-lock` | ✅ ใช้งาน |
| `app/modal.tsx` | Generic Modal | `/modal` | ⚠️ ตรวจสอบ |

### 1.6 System Screens

| ไฟล์ | หน้าที่ | สถานะ |
|---|---|---|
| `app/_layout.tsx` | Root Stack Navigator | ✅ ใช้งาน |
| `app/+html.tsx` | Web HTML wrapper | ⚠️ ตรวจสอบ (web only) |
| `app/+not-found.tsx` | 404 fallback | ✅ ใช้งาน |

---

## 2. DATABASE — ฐานข้อมูล (Drizzle + SQLite)

| ไฟล์ | หน้าที่ | สถานะ |
|---|---|---|
| `db/schema.ts` | ตาราง DB ทั้งหมด | ✅ ใช้งาน |
| `db/client.ts` | เปิดการเชื่อมต่อ Drizzle | ✅ ใช้งาน |
| `db/provider.tsx` | React Context สำหรับ DB | ✅ ใช้งาน |
| `db/index.ts` | Export รวม | ✅ ใช้งาน |
| `db/seed.ts` | ข้อมูลเริ่มต้น (default data) | ✅ ใช้งาน |
| `db/migrations/migrations.ts` | Migration runner | ✅ ใช้งาน |
| `db/migrations/phase0.ts` | Migration Phase 0 | ✅ ใช้งาน |

---

## 3. STORES — State Management (Zustand)

| ไฟล์ | หน้าที่ | สถานะ |
|---|---|---|
| `stores/useSettingsStore.ts` | การตั้งค่า App (theme, lock, ฯลฯ) | ✅ ใช้งาน |
| `stores/useSummaryStore.ts` | ยอดรวมรายรับ-รายจ่าย | ✅ ใช้งาน |
| `stores/useTransactionStore.ts` | รายการ transaction | ✅ ใช้งาน |
| `stores/useWalletStore.ts` | กระเป๋าเงิน | ✅ ใช้งาน |
| `stores/index.ts` | Export รวม | ✅ ใช้งาน |

---

## 4. SERVICES — Business Logic

| ไฟล์ | หน้าที่ | สถานะ |
|---|---|---|
| `services/transactionService.ts` | CRUD รายการรายรับ-รายจ่าย | ✅ ใช้งาน |
| `services/walletService.ts` | CRUD กระเป๋าเงิน + ยอดคงเหลือ | ✅ ใช้งาน |
| `services/categoryService.ts` | CRUD หมวดหมู่ | ✅ ใช้งาน |
| `services/budgetService.ts` | วางแผนงบ + ติดตาม | ✅ ใช้งาน |
| `services/billService.ts` | บิลค้างจ่าย + แจ้งเตือน | ✅ ใช้งาน |
| `services/recurringService.ts` | รายจ่ายประจำ | ✅ ใช้งาน |
| `services/savingsService.ts` | เป้าหมายการออม | ✅ ใช้งาน |
| `services/reportService.ts` | สร้างรายงาน + คำนวณ | ✅ ใช้งาน |
| `services/financeSummaryService.ts` | วิเคราะห์ภาพรวมการเงิน | ✅ ใช้งาน |
| `services/dailySnapshotService.ts` | snapshot รายวัน | ✅ ใช้งาน |
| `services/backupService.ts` | Backup/Restore JSON | ✅ ใช้งาน |
| `services/exportService.ts` | Export CSV/HTML | ✅ ใช้งาน |
| `services/appSettingsService.ts` | บันทึกการตั้งค่า App | ✅ ใช้งาน |
| `services/authService.ts` | PIN/Biometric lock | ✅ ใช้งาน |
| `services/authApiService.ts` | LINE OAuth / Server auth | ✅ ใช้งาน |
| `services/notificationService.ts` | Push notification scheduling | ✅ ใช้งาน |
| `services/diaryService.ts` | สมุดชีวิต CRUD | ✅ ใช้งาน |
| `services/taxBoxService.ts` | กล่องลดหย่อนภาษี CRUD | ✅ ใช้งาน |
| `services/taxReadinessService.ts` | Tax checklist + สถานะ | ✅ ใช้งาน |
| `services/slipService.ts` | เก็บข้อมูลสลิป | ✅ ใช้งาน |
| `services/slipInboxService.ts` | คิว Slip Inbox | ✅ ใช้งาน |
| `services/ocrService.ts` | ประสานงาน OCR | ✅ ใช้งาน |
| `services/mlkitOCR.ts` | ML Kit text recognition | ✅ ใช้งาน |
| `services/visionOCR.ts` | Vision API text recognition | ⚠️ ตรวจสอบ (อาจซ้ำกับ mlkit) |
| `services/quickAddParser.ts` | parse ข้อความ → transaction | ✅ ใช้งาน |
| `services/quickAddDraftService.ts` | บันทึก draft Quick Add | ✅ ใช้งาน |
| `services/quickAddLearningService.ts` | เรียนรู้ pattern Quick Add | ✅ ใช้งาน |
| `services/starterTemplateService.ts` | Starter Template library | ✅ ใช้งาน |
| `services/entitlementService.ts` | ตรวจสอบสิทธิ์ Premium | ✅ ใช้งาน |
| `services/tripEstimatorService.ts` | Pre-Trip estimator | ✅ ใช้งาน |
| `services/dreamGoalService.ts` | เป้าหมายระยะยาว | ⚠️ ตรวจสอบ (มี UI หรือยัง?) |
| `services/voiceInputService.ts` | Voice → transaction | ⚠️ ตรวจสอบ (มี UI หรือยัง?) |
| `services/index.ts` | Export รวม | ✅ ใช้งาน |

---

## 5. HOOKS — React Hooks

| ไฟล์ | หน้าที่ | สถานะ |
|---|---|---|
| `hooks/useCategorySummary.ts` | ยอดรวมแต่ละหมวดหมู่ | ✅ ใช้งาน |
| `hooks/useMonthlyBalance.ts` | ยอดรวมรายเดือน | ✅ ใช้งาน |
| `hooks/useTransactionsByDate.ts` | query transaction ตามช่วงวันที่ | ✅ ใช้งาน |
| `hooks/index.ts` | Export รวม | ✅ ใช้งาน |

---

## 6. COMPONENTS — UI Components

### 6.1 Core / Root

| ไฟล์ | หน้าที่ | สถานะ |
|---|---|---|
| `components/Themed.tsx` | Theme wrapper | ✅ ใช้งาน |
| `components/useColorScheme.ts` | อ่าน color scheme | ✅ ใช้งาน |
| `components/useColorScheme.web.ts` | (web version) | ⚠️ ตรวจสอบ |
| `components/useClientOnlyValue.ts` | ค่าที่ render ฝั่ง client เท่านั้น | ⚠️ ตรวจสอบ |
| `components/useClientOnlyValue.web.ts` | (web version) | ⚠️ ตรวจสอบ |
| `components/StyledText.tsx` | Typography | ⚠️ ตรวจสอบ (อาจถูกแทนด้วย NativeWind) |
| `components/EditScreenInfo.tsx` | Expo template leftover | ❌ ไม่ใช้ (Expo default) |
| `components/ExternalLink.tsx` | Link ออกนอก app | ⚠️ ตรวจสอบ |

### 6.2 Auth

| ไฟล์ | หน้าที่ | สถานะ |
|---|---|---|
| `components/auth/LockScreen.tsx` | หน้า Biometric/PIN lock | ✅ ใช้งาน |

### 6.3 Category

| ไฟล์ | หน้าที่ | สถานะ |
|---|---|---|
| `components/category/CategoryGrid.tsx` | Grid เลือกหมวดหมู่ | ✅ ใช้งาน |

### 6.4 Charts

| ไฟล์ | หน้าที่ | สถานะ |
|---|---|---|
| `components/charts/ExpensePieChart.tsx` | Pie Chart หมวดหมู่ | ✅ ใช้งาน |
| `components/charts/TrendLineChart.tsx` | Line Chart แนวโน้มรายเดือน | ✅ ใช้งาน |
| `components/charts/WeeklyBarChart.tsx` | Bar Chart รายสัปดาห์ | ✅ ใช้งาน |

### 6.5 Home

| ไฟล์ | หน้าที่ | สถานะ |
|---|---|---|
| `components/home/CardMenuSection.tsx` | Section การ์ดเมนูหน้าหลัก | ✅ ใช้งาน |
| `components/home/DailyMoneySnapshot.tsx` | ยอดเงินสรุปรายวัน | ✅ ใช้งาน |
| `components/home/HomeHeader.tsx` | Header หน้าหลัก | ✅ ใช้งาน |
| `components/home/MenuGrid.tsx` | Grid เมนูหน้าหลัก | ✅ ใช้งาน |

### 6.6 Splash

| ไฟล์ | หน้าที่ | สถานะ |
|---|---|---|
| `components/splash/BrandedLoadingScreen.tsx` | Loading screen ตอน boot | ✅ ใช้งาน |

### 6.7 Transaction

| ไฟล์ | หน้าที่ | สถานะ |
|---|---|---|
| `components/transaction/CategoryAssignModal.tsx` | Modal เลือกหมวดหมู่ | ✅ ใช้งาน |
| `components/transaction/Numpad.tsx` | Numpad กรอกจำนวนเงิน | ✅ ใช้งาน |
| `components/transaction/SwipeableTransactionItem.tsx` | Transaction item แบบ swipe | ✅ ใช้งาน |
| `components/transaction/TradeGroupCard.tsx` | การ์ด trade กลุ่ม | ✅ ใช้งาน |
| `components/transaction/TradeSetReviewCard.tsx` | การ์ด review trade set | ✅ ใช้งาน |
| `components/transaction/TransactionFilter.tsx` | Filter รายการ | ✅ ใช้งาน |
| `components/transaction/TransactionItem.tsx` | Transaction item พื้นฐาน | ✅ ใช้งาน |

### 6.8 UI

| ไฟล์ | หน้าที่ | สถานะ |
|---|---|---|
| `components/ui/Card.tsx` | การ์ดพื้นฐาน | ✅ ใช้งาน |
| `components/ui/SkeletonLoader.tsx` | Loading placeholder | ✅ ใช้งาน |
| `components/ui/SnackbarProvider.tsx` | Toast/Snackbar | ✅ ใช้งาน |

### 6.9 Wallet

| ไฟล์ | หน้าที่ | สถานะ |
|---|---|---|
| `components/wallet/BalanceCard.tsx` | การ์ดแสดงยอดเงิน | ✅ ใช้งาน |
| `components/wallet/WalletAvatar.tsx` | ไอคอนกระเป๋าเงิน | ✅ ใช้งาน |

### 6.10 Web Preview

| ไฟล์ | หน้าที่ | สถานะ |
|---|---|---|
| `components/web-preview/WebUiPreviewApp.tsx` | Web demo wrapper | ⚠️ ตรวจสอบ (dev only?) |

---

## 7. LIB — Utilities

| ไฟล์ | หน้าที่ | สถานะ |
|---|---|---|
| `lib/format.ts` | format เงิน/วันที่/ตัวเลข | ✅ ใช้งาน |
| `lib/haptics.ts` | Haptic feedback | ✅ ใช้งาน |
| `lib/secureStore.ts` | เก็บ token/PIN ปลอดภัย | ✅ ใช้งาน |
| `lib/theme.ts` | สี + theme config | ✅ ใช้งาน |
| `lib/time.ts` | คำนวณวันที่/เวลา | ✅ ใช้งาน |
| `lib/uuid.ts` | สร้าง UUID | ✅ ใช้งาน |
| `lib/tripCategoryGuess.ts` | AI guess category สำหรับ trip | ✅ ใช้งาน |
| `lib/webPreview.ts` | Web preview helper | ⚠️ ตรวจสอบ |
| `lib/api/client.ts` | API client (server connect) | ✅ ใช้งาน |
| `lib/api/contract.ts` | TypeScript types ของ API | ✅ ใช้งาน |
| `lib/api/realApi.ts` | การเรียก API จริง | ✅ ใช้งาน |
| `lib/api/mock.ts` | Mock API (dev/test) | ⚠️ ตรวจสอบ |

---

## 8. TYPES — TypeScript Definitions

| ไฟล์ | หน้าที่ | สถานะ |
|---|---|---|
| `types/index.ts` | Type definitions ทั้งหมด | ✅ ใช้งาน |

---

## 9. CONSTANTS — ค่าคงที่

| ไฟล์ | หน้าที่ | สถานะ |
|---|---|---|
| `constants/Colors.ts` | สีทั้งหมด light/dark | ✅ ใช้งาน |
| `constants/apiConfig.ts` | URL server + config | ✅ ใช้งาน |
| `constants/walletBrands.ts` | รายการธนาคาร/wallet brands | ✅ ใช้งาน |

---

## 10. ASSETS — ไฟล์รูปภาพ/ฟอนต์

| โฟลเดอร์ | เนื้อหา | สถานะ |
|---|---|---|
| `assets/setting-widget-icon/` | Icons สำหรับ Settings menu (15 ไฟล์) | ✅ ใช้งาน |
| `assets/menu-footer/` | Icons Tab Bar | ✅ ใช้งาน |
| `assets/menu-widget/` | Icons หน้า Home | ✅ ใช้งาน |
| `assets/bank-icons/` | Logo ธนาคาร | ✅ ใช้งาน |
| `assets/characters/` | ตัวละคร/mascot | ✅ ใช้งาน |
| `assets/fonts/` | Custom fonts | ✅ ใช้งาน |
| `assets/icons/` | App icons | ✅ ใช้งาน |
| `assets/images/` | รูปทั่วไป | ✅ ใช้งาน |
| `assets/logo/` | Logo Poatung | ✅ ใช้งาน |
| `assets/mooonoon-paotung-qr/` | QR images | ✅ ใช้งาน |
| `assets/scenery/` | Background images | ✅ ใช้งาน |
| `assets/splash/` | Splash screen assets | ✅ ใช้งาน |

---

## 11. CONFIG FILES — ไฟล์ config โปรเจกต์

| ไฟล์ | หน้าที่ |
|---|---|
| `app.json` | Expo app config (name, bundle ID, version) |
| `eas.json` | EAS Build profiles (development/staging/production) |
| `drizzle.config.ts` | Drizzle ORM config |
| `metro.config.js` | Metro bundler config |
| `tailwind.config.js` | NativeWind/Tailwind config |
| `tsconfig.json` | TypeScript config |
| `package.json` | Dependencies |
| `global.css` | Global CSS (NativeWind) |
| `expo-env.d.ts` | Expo TypeScript env types |
| `nativewind-env.d.ts` | NativeWind TypeScript env types |

---

## 12. ไฟล์ที่ต้องตรวจสอบ / อาจลบได้

> ไฟล์เหล่านี้ควรตรวจสอบว่ายังใช้งานอยู่หรือไม่

| ไฟล์ | เหตุผลที่ต้องตรวจ |
|---|---|
| `components/EditScreenInfo.tsx` | Expo default template — ไม่น่าได้ใช้ |
| `services/visionOCR.ts` | อาจซ้ำกับ `mlkitOCR.ts` |
| `services/dreamGoalService.ts` | ยังไม่มี UI screen? |
| `services/voiceInputService.ts` | ยังไม่มี UI screen? |
| `app/modal.tsx` | ถูกเรียกใช้จาก route ไหน? |
| `lib/api/mock.ts` | dev only — ไม่ควรอยู่ใน production |
| `lib/webPreview.ts` | dev only? |
| `components/web-preview/` | dev only? |
| `app/+html.tsx` | web only — ไม่ใช้ใน mobile |

---

*ไฟล์นี้อัปเดตด้วยมือ — ทุกครั้งที่เพิ่ม/ลบ screen หรือ service ให้มา update FILE-MAP.md ด้วย*
