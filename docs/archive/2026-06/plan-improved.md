# 📝 Project Plan: Digital Expense Tracker (Local-First)

## Tech Stack (ปรับปรุง)

| Layer | เดิม | ปรับปรุงใหม่ | เหตุผล |
|-------|------|-------------|--------|
| Framework | Expo (React Native) | **Expo SDK 52+** (React Native) | ✅ คงเดิม |
| Database ORM | WatermelonDB | **Drizzle ORM** | คล้าย Prisma ที่คุ้นเคย, type-safe |
| Database Engine | SQLite ผ่าน JSI | **expo-sqlite** (built-in) | ไม่ต้อง link native module |
| State Management | - | **Zustand** | คุ้นเคยจาก NoonStore |
| Navigation | - | **expo-router** (file-based) | คล้าย Next.js routing |
| Charts | react-native-chart-kit | **react-native-gifted-charts** | สวยกว่า, customize ง่ายกว่า |
| Cloud Backup | Google Drive API | **Google Drive API** | ✅ คงเดิม |
| UI Components | - | **NativeWind (Tailwind CSS)** | คุ้นเคยจาก Tailwind |

---

## 📦 Database Schema (ปรับปรุง - Drizzle ORM)

```typescript
// db/schema.ts
import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';

// บัญชี/กระเป๋าเงิน (ใหม่ - รองรับหลายบัญชี)
export const wallets = sqliteTable('wallets', {
  id: text('id').primaryKey(), // uuid
  name: text('name').notNull(), // เช่น "เงินสด", "ธ.กสิกร", "บัตรเครดิต"
  icon: text('icon').default('💰'),
  balance: real('balance').default(0),
  currency: text('currency').default('THB'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// หมวดหมู่
export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(), // เช่น "อาหาร", "ค่าเดินทาง"
  icon: text('icon').notNull(), // emoji หรือ icon name
  type: text('type').notNull(), // 'income' | 'expense'
  color: text('color').default('#4CAF50'),
  sortOrder: integer('sort_order').default(0),
  isDefault: integer('is_default', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// รายการรายรับ/รายจ่าย
export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  amount: real('amount').notNull(),
  type: text('type').notNull(), // 'income' | 'expense' | 'transfer'
  categoryId: text('category_id').references(() => categories.id),
  walletId: text('wallet_id').references(() => wallets.id).notNull(),
  toWalletId: text('to_wallet_id').references(() => wallets.id), // สำหรับ transfer
  note: text('note'),
  date: integer('date', { mode: 'timestamp' }).notNull(),
  attachmentUri: text('attachment_uri'), // รูปใบเสร็จ (optional)
  isRecurring: integer('is_recurring', { mode: 'boolean' }).default(false),
  recurringId: text('recurring_id').references(() => recurringRules.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// กฎการทำซ้ำอัตโนมัติ (ใหม่)
export const recurringRules = sqliteTable('recurring_rules', {
  id: text('id').primaryKey(),
  amount: real('amount').notNull(),
  type: text('type').notNull(), // 'income' | 'expense'
  categoryId: text('category_id').references(() => categories.id),
  walletId: text('wallet_id').references(() => wallets.id).notNull(),
  note: text('note'),
  frequency: text('frequency').notNull(), // 'daily' | 'weekly' | 'monthly' | 'yearly'
  dayOfMonth: integer('day_of_month'), // วันที่ของเดือน (สำหรับ monthly)
  nextDate: integer('next_date', { mode: 'timestamp' }).notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// เป้าหมายการออม (ปรับปรุง)
export const savingsGoals = sqliteTable('savings_goals', {
  id: text('id').primaryKey(),
  name: text('name').notNull(), // เช่น "เที่ยวญี่ปุ่น"
  targetAmount: real('target_amount').notNull(),
  currentAmount: real('current_amount').default(0),
  deadline: integer('deadline', { mode: 'timestamp' }),
  icon: text('icon').default('🎯'),
  color: text('color').default('#FF9800'),
  isCompleted: integer('is_completed', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// ตั้งค่าแอป (ใหม่)
export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Log การ Sync (ใหม่ - ติดตาม backup)
export const syncLog = sqliteTable('sync_log', {
  id: text('id').primaryKey(),
  action: text('action').notNull(), // 'backup' | 'restore'
  status: text('status').notNull(), // 'success' | 'failed'
  fileSize: integer('file_size'),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
  errorMessage: text('error_message'),
});
```

### Index สำหรับ Performance

```typescript
// db/indexes.ts
import { index } from 'drizzle-orm/sqlite-core';

// ค้นหารายการตามวันที่ (ใช้บ่อยมาก)
export const transactionDateIdx = index('idx_transactions_date')
  .on(transactions.date);

// ค้นหารายการตาม wallet
export const transactionWalletIdx = index('idx_transactions_wallet')
  .on(transactions.walletId);

// ค้นหารายการตามหมวดหมู่
export const transactionCategoryIdx = index('idx_transactions_category')
  .on(transactions.categoryId);

// Composite index สำหรับ filter ตามเดือน+type (Dashboard)
export const transactionMonthTypeIdx = index('idx_transactions_month_type')
  .on(transactions.date, transactions.type);
```

---

## ✅ Phase 1: Foundation & Local Database (4 สัปดาห์) — COMPLETED

### สัปดาห์ที่ 1: Project Setup & Database
- [x] ✅ `npx create-expo-app expense-tracker --template tabs`
- [x] ✅ ติดตั้ง dependencies (expo-sqlite, drizzle-orm, zustand, nativewind, expo-router, expo-crypto)
- [x] ✅ ตั้งค่า Drizzle ORM + expo-sqlite connection (`db/client.ts`)
- [x] ✅ สร้าง Schema ทั้งหมด 7 ตาราง (`db/schema.ts`)
- [x] ✅ สร้าง Migration ระบบ (`db/migrations/`)
- [x] ✅ Seed ข้อมูล Default Categories 11 รายจ่าย + 5 รายรับ (`db/seed.ts`)

### สัปดาห์ที่ 2: Core Data Layer
- [x] ✅ สร้าง Database Service Layer (CRUD functions)
  - `transactionService.ts` — create, read, update, delete + auto wallet balance
  - `categoryService.ts` — CRUD + ป้องกันลบ default
  - `walletService.ts` — CRUD + soft delete, transfer, recalculateBalance
- [x] ✅ สร้าง Zustand Stores
  - `useTransactionStore` — transactions, recentTransactions, search
  - `useWalletStore` — wallets, totalBalance, selectedWalletId
  - `useSummaryStore` — monthlyBalance, expenseSummary, incomeSummary
- [x] ✅ เขียน Custom Hooks
  - `useMonthlyBalance()` — ยอดรวมประจำเดือน
  - `useTransactionsByDate(range)` — จัดกลุ่มตามวัน + Thai date
  - `useCategorySummary(month)` — สรุปตามหมวดหมู่

### สัปดาห์ที่ 3: Core UI - หน้าหลัก
- [x] ✅ **Tab Navigation**: หน้าหลัก | บันทึก | ประวัติ | ตั้งค่า (4 tabs)
- [x] ✅ **Dashboard Screen**: BalanceCard, wallet scroll, recent 5, FAB quick add
- [x] ✅ **Add Transaction Screen**: Numpad, expense/income toggle, CategoryGrid, wallet picker, DateTimePicker, note

### สัปดาห์ที่ 4: Core UI - ประวัติ & ทดสอบ
- [x] ✅ **History Screen**: SectionList, TransactionFilter (search + type pills + category dropdown), SwipeableTransactionItem
- [x] ✅ **Wallet Management Screen**: CRUD modal, icon picker, soft delete, link to transfer
- [x] ✅ **Wallet Transfer Screen**: Numpad, swap button, wallet selectors
- [x] ✅ Testing & Bug Fixes — 0 TypeScript errors
- [x] ✅ **Milestone: แอปใช้งานได้ Offline 100%**

---

## ✅ Phase 2: Enhanced Features & UX (4 สัปดาห์) — COMPLETED

### สัปดาห์ที่ 5-6: Data Visualization & Reports
- [x] ✅ **กราฟวงกลม (Pie Chart)**: ExpensePieChart — donut chart + center total + color legend
- [x] ✅ **กราฟแท่ง (Bar Chart)**: WeeklyBarChart — grouped income vs expense per week
- [x] ✅ **กราฟเส้น (Line Chart)**: TrendLineChart — dual line area chart 6 เดือน
- [x] ✅ **สรุปรายเดือน** (`app/report.tsx`): 4 summary cards (% change), Pie/Bar/Line charts, month selector

### สัปดาห์ที่ 7: Advanced Features
- [x] ✅ **ระบบ Recurring Transactions** (`app/recurring.tsx`): CRUD + process due + toggle active + frequency selector
- [x] ✅ **Savings Goals** (`app/savings.tsx`): progress bar, add amount modal, icon/color picker, deadline DatePicker, completion celebration
- [ ] 🔲 **Local Push Notifications** (expo-notifications) — ยังไม่ได้ทำ
- [x] ✅ **หมวดหมู่ Custom** (`app/category-manage.tsx`): emoji picker (30 icons), color picker (16 colors), ป้องกันลบ default

### สัปดาห์ที่ 8: Performance & Polish
- [ ] 🔲 Pagination สำหรับ History (Infinite Scroll) — ยังไม่ได้ทำ
- [ ] 🔲 Database Indexing — ยังไม่ได้ทำ
- [x] ✅ Loading States & Skeleton Screens (`SkeletonLoader.tsx` — TransactionSkeleton, BalanceCardSkeleton)
- [x] ✅ Haptic Feedback (`lib/haptics.ts` — success/warning/error/light/medium/selection)
- [x] ✅ Dark Mode / Light Mode (useSettingsStore + Colors.ts light/dark themes)
- [x] ✅ **Milestone: แอปพร้อมใช้งานจริง** — 0 TypeScript errors

---

## ☁️ Phase 3: Sync, Security & Distribution (4 สัปดาห์) — IN PROGRESS

### สัปดาห์ที่ 9-10: Backup & Restore
- [ ] 🔲 ตั้งค่า Google Sign-In (`@react-native-google-signin/google-signin`) — package ติดตั้งแล้ว แต่ยังไม่ได้ต่อ API
- [ ] 🔲 ขอสิทธิ์ `drive.appdata` scope — ยังไม่ได้ทำ
- [ ] 🔲 **Google Drive Upload/Download** — ยังไม่ได้ทำ
- [x] ✅ **Local JSON Backup** (`services/backupService.ts`): export ทุกตาราง → JSON → แชร์ไฟล์
- [x] ✅ **Restore จาก JSON** (`backupService.restoreFromBackup`): preview stats ก่อน restore + ลบข้อมูลเก่า + import ใหม่
- [x] ✅ **Backup & Restore UI** (`app/backup.tsx`): สร้าง backup + เลือกไฟล์ restore (DocumentPicker) + ประวัติ sync
- [x] ✅ **Sync Log**: บันทึกทุก backup/restore action พร้อม status + file size

### สัปดาห์ที่ 11: Security & Privacy
- [x] ✅ **App Lock** (`services/authService.ts` + `app/app-lock.tsx`):
  - expo-local-authentication (FaceID / Fingerprint / PIN)
  - PIN numpad 4-6 หลัก, ตั้ง/เปลี่ยน/ลบ PIN
  - ทดสอบ Biometric, Switch เปิด/ปิดล็อค
  - PIN เก็บใน expo-secure-store
- [ ] 🔲 **Lock เมื่อ app กลับมาจาก background** — ยังไม่ได้ทำ (ต้องใช้ AppState listener)
- [ ] 🔲 **Data Encryption** (AES-256 ก่อน backup) — ยังไม่ได้ทำ
- [x] ✅ **Export รายงาน** (`services/exportService.ts` + `app/export-report.tsx`):
  - Export CSV (BOM UTF-8 รองรับ Thai ใน Excel)
  - Export HTML Report (สรุปรายรับ/รายจ่าย + ตารางรายการ + styled)
  - Share ผ่าน Line/Email/Google Drive
  - Month selector เลือกเดือนที่ต้องการ
- [ ] 🔲 **Privacy Policy**: ร่างเอกสารนโยบายความเป็นส่วนตัว — ยังไม่ได้ทำ

### สัปดาห์ที่ 12: Distribution & Launch
- [x] ✅ **EAS Build Config**: `eas.json` (development/preview/production APK profiles)
- [x] ✅ **Android Config**: `app.json` — package `com.sevendog.poatung`, biometric permissions, versionCode
- [ ] 🔲 **Build APK จริง**: `eas build -p android --profile preview` — ยังไม่ได้รัน
- [ ] 🔲 **iOS** (ถ้าต้องการ): ต้องมี Apple Developer Account ($99/ปี)
- [ ] 🔲 **OTA Update**: ตั้งค่า EAS Update — ยังไม่ได้ทำ
- [ ] 🔲 **Milestone: แอปพร้อมส่งมอบลูกค้า**

---

## 📋 TO DO NEXT — สิ่งที่ต้องทำต่อ

### 🔴 สำคัญ (ควรทำก่อน Build APK)
| # | รายการ | รายละเอียด | ระดับความยาก |
|---|--------|-----------|-------------|
| 1 | Lock เมื่อกลับจาก background | ใช้ `AppState` listener ตรวจสอบเมื่อ app กลับมา foreground แล้วแสดง PIN/Biometric screen | ง่าย |
| 2 | Local Push Notifications | ใช้ `expo-notifications` เตือนบันทึกรายจ่ายทุกเย็น + เตือน deadline ออม | ปานกลาง |
| 3 | Build APK จริง | รัน `eas build -p android --profile preview` สร้างไฟล์ APK | ง่าย |
| 4 | Privacy Policy | ร่างเอกสารนโยบายความเป็นส่วนตัว (จำเป็นถ้าจะลง Play Store) | ง่าย |

### 🟡 เสริม (ทำเมื่อมีเวลา)
| # | รายการ | รายละเอียด | ระดับความยาก |
|---|--------|-----------|-------------|
| 5 | Google Drive Backup | ต่อ Google Sign-In + Drive API upload/download backup file | ยาก |
| 6 | Data Encryption (AES-256) | Encrypt JSON backup ก่อน share/upload | ปานกลาง |
| 7 | Database Indexing | เพิ่ม index ตาม schema ที่ออกแบบไว้ เพิ่ม performance | ง่าย |
| 8 | History Infinite Scroll | Pagination สำหรับรายการเยอะๆ | ปานกลาง |
| 9 | OTA Update (EAS Update) | Push update ไม่ต้องผ่าน store | ง่าย |
| 10 | Publish Google Play Store | สร้าง Play Console account + upload AAB | ปานกลาง |

---

## 📊 Architecture Diagram (ปรับปรุง)

```
┌─────────────────────────────────────────────────┐
│                    User Interface                │
│        (React Native + Expo Router + NativeWind) │
├─────────────────────────────────────────────────┤
│                  Zustand Stores                  │
│   (Transaction | Wallet | Summary | Settings)    │
├─────────────────────────────────────────────────┤
│               Service Layer (CRUD)               │
│   transactionService | walletService | etc.      │
├─────────────────────────────────────────────────┤
│                  Drizzle ORM                     │
│        (Type-safe queries, migrations)           │
├─────────────────────────────────────────────────┤
│                  expo-sqlite                     │
│          (SQLite on device storage)              │
├─────────────────────────────────────────────────┤
│              Google Drive API                    │
│     (appdata folder — encrypted backup)          │
└─────────────────────────────────────────────────┘

Data Flow:
  UI ←→ Zustand Store ←→ Service Layer ←→ Drizzle ORM ←→ SQLite
                                              ↕
                                    Google Drive (Backup)
```

---

## 🔑 สิ่งที่เพิ่มจากแผนเดิม

| หัวข้อ | แผนเดิม | แผนปรับปรุง |
|--------|---------|-------------|
| Database | WatermelonDB (ซับซ้อน) | Drizzle ORM + expo-sqlite (คุ้นเคย) |
| หลายบัญชี | ❌ ไม่มี | ✅ Wallets table |
| รายจ่ายประจำ | ❌ ไม่มี | ✅ Recurring Rules |
| Export รายงาน | ❌ ไม่มี | ✅ CSV + PDF |
| Encryption | ❌ ไม่มี | ✅ AES-256 ก่อน backup |
| โอนระหว่างบัญชี | ❌ ไม่มี | ✅ Transfer type |
| Distribution | ❌ ไม่มี | ✅ APK + Play Store + OTA |
| State Management | ไม่ระบุ | ✅ Zustand (คุ้นเคย) |
| Styling | ไม่ระบุ | ✅ NativeWind (Tailwind) |

---

## 💡 เปรียบเทียบ Database Options สำหรับ Mobile

| เกณฑ์ | expo-sqlite + Drizzle ⭐ | WatermelonDB | Realm (MongoDB) |
|-------|------------------------|--------------|-----------------|
| Learning Curve | ต่ำ (คล้าย Prisma) | สูง (Decorator pattern) | ปานกลาง |
| Setup กับ Expo | ง่ายมาก (built-in) | ต้อง config native | ต้อง config native |
| Performance | ดี | ดีมาก | ดีมาก |
| Type Safety | ✅ (Drizzle) | ⚠️ (ต้อง setup เอง) | ✅ |
| Reactive Queries | ❌ (ใช้ Zustand แทน) | ✅ (built-in) | ✅ |
| Community | กำลังโต | ปานกลาง | ใหญ่ |
| เหมาะกับ | Web Dev → Mobile | Mobile-first apps | Cross-platform |

**คำแนะนำ**: สำหรับ background ของทีม SEVENDOG DEV ที่คุ้นเคยกับ Prisma + Zustand อยู่แล้ว → **expo-sqlite + Drizzle ORM** เป็นตัวเลือกที่ดีที่สุด

---

## 📱 Default Categories (Seed Data)

### รายจ่าย (Expense)
| Icon | ชื่อ | Color |
|------|------|-------|
| 🍜 | อาหาร/เครื่องดื่ม | #FF5722 |
| 🚗 | เดินทาง/น้ำมัน | #2196F3 |
| 🏠 | ที่อยู่อาศัย/ค่าเช่า | #9C27B0 |
| ⚡ | ค่าน้ำ/ค่าไฟ | #FF9800 |
| 📱 | ค่าโทรศัพท์/อินเทอร์เน็ต | #00BCD4 |
| 🛒 | ช้อปปิ้ง | #E91E63 |
| 🏥 | สุขภาพ/ยา | #4CAF50 |
| 🎓 | การศึกษา | #3F51B5 |
| 🎮 | บันเทิง | #673AB7 |
| 👕 | เสื้อผ้า | #795548 |
| 📦 | อื่นๆ | #607D8B |

### รายรับ (Income)
| Icon | ชื่อ | Color |
|------|------|-------|
| 💰 | เงินเดือน | #4CAF50 |
| 💼 | รายได้เสริม/ฟรีแลนซ์ | #8BC34A |
| 🏦 | ดอกเบี้ย | #CDDC39 |
| 🎁 | ของขวัญ/โบนัส | #FFC107 |
| 📦 | อื่นๆ | #607D8B |



