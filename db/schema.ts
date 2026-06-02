import { sqliteTable, text, real, integer, index } from 'drizzle-orm/sqlite-core';

// กระเป๋าเงิน / บัญชี
export const wallets = sqliteTable('wallets', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
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
  name: text('name').notNull(),
  icon: text('icon').notNull(),
  type: text('type', { enum: ['income', 'expense'] }).notNull(),
  color: text('color').default('#4CAF50'),
  sortOrder: integer('sort_order').default(0),
  isDefault: integer('is_default', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// รายการรายรับ/รายจ่าย
export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  amount: real('amount').notNull(),
  type: text('type', { enum: ['income', 'expense', 'transfer'] }).notNull(),
  categoryId: text('category_id').references(() => categories.id),
  walletId: text('wallet_id').references(() => wallets.id).notNull(),
  toWalletId: text('to_wallet_id').references(() => wallets.id),
  note: text('note'),
  date: integer('date', { mode: 'timestamp' }).notNull(),
  attachmentUri: text('attachment_uri'),
  isRecurring: integer('is_recurring', { mode: 'boolean' }).default(false),
  recurringId: text('recurring_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  index('idx_transactions_date').on(table.date),
  index('idx_transactions_wallet').on(table.walletId),
  index('idx_transactions_category').on(table.categoryId),
  index('idx_transactions_month_type').on(table.date, table.type),
]);

export const walletActivityLogs = sqliteTable('wallet_activity_logs', {
  id: text('id').primaryKey(),
  walletId: text('wallet_id').references(() => wallets.id).notNull(),
  relatedTransactionId: text('related_transaction_id'),
  actionType: text('action_type').notNull(),
  transactionType: text('transaction_type', { enum: ['income', 'expense', 'transfer'] }).notNull(),
  categoryId: text('category_id').references(() => categories.id),
  counterpartyWalletId: text('counterparty_wallet_id').references(() => wallets.id),
  amount: real('amount').notNull(),
  balanceBefore: real('balance_before').notNull(),
  balanceAfter: real('balance_after').notNull(),
  note: text('note'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  index('idx_wallet_activity_wallet').on(table.walletId),
  index('idx_wallet_activity_created_at').on(table.createdAt),
]);

// กฎการทำซ้ำอัตโนมัติ
export const recurringRules = sqliteTable('recurring_rules', {
  id: text('id').primaryKey(),
  amount: real('amount').notNull(),
  type: text('type', { enum: ['income', 'expense'] }).notNull(),
  categoryId: text('category_id').references(() => categories.id),
  walletId: text('wallet_id').references(() => wallets.id).notNull(),
  note: text('note'),
  frequency: text('frequency', { enum: ['daily', 'weekly', 'monthly', 'yearly'] }).notNull(),
  dayOfMonth: integer('day_of_month'),
  nextDate: integer('next_date', { mode: 'timestamp' }).notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// เป้าหมายการออม
export const savingsGoals = sqliteTable('savings_goals', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  targetAmount: real('target_amount').notNull(),
  currentAmount: real('current_amount').default(0),
  deadline: integer('deadline', { mode: 'timestamp' }),
  icon: text('icon').default('🎯'),
  color: text('color').default('#FF9800'),
  isCompleted: integer('is_completed', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// ตั้งค่าแอป
export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Log การ Sync
export const syncLog = sqliteTable('sync_log', {
  id: text('id').primaryKey(),
  action: text('action', { enum: ['backup', 'restore'] }).notNull(),
  status: text('status', { enum: ['success', 'failed'] }).notNull(),
  fileSize: integer('file_size'),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
  errorMessage: text('error_message'),
});

// สลิปที่สแกนแล้ว (ป้องกันซ้ำ)
export const scannedSlips = sqliteTable('scanned_slips', {
  id: text('id').primaryKey(),
  qrPayload: text('qr_payload').notNull(),
  qrHash: text('qr_hash').notNull().unique(),
  imageUri: text('image_uri'),
  amount: real('amount'),
  transferDate: text('transfer_date'),
  senderName: text('sender_name'),
  receiverName: text('receiver_name'),
  bankName: text('bank_name'),
  refCode: text('ref_code'),
  status: text('status', { enum: ['pending', 'needs_review', 'confirmed', 'tax_evidence', 'skipped'] }).default('pending'),
  transactionId: text('transaction_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const quickAddLearningRules = sqliteTable('quick_add_learning_rules', {
  id: text('id').primaryKey(),
  keyword: text('keyword').notNull(),
  normalizedKeyword: text('normalized_keyword').notNull(),
  type: text('type', { enum: ['income', 'expense'] }).notNull(),
  categoryId: text('category_id').references(() => categories.id),
  confidence: integer('confidence').default(1),
  source: text('source', { enum: ['user_correction', 'user_confirmation'] }).default('user_correction'),
  hitCount: integer('hit_count').default(1),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  index('idx_quick_add_learning_normalized_keyword').on(table.normalizedKeyword),
  index('idx_quick_add_learning_category').on(table.categoryId),
]);

// PKG-14: Pre-Trip Estimator
export const tripSessions = sqliteTable('trip_sessions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  templateId: text('template_id'),
  estimatedBudget: real('estimated_budget').default(0),
  actualSpent: real('actual_spent').default(0),
  status: text('status', { enum: ['planning', 'active', 'done'] }).default('planning'),
  note: text('note'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
}, (table) => [
  index('idx_trip_sessions_status').on(table.status),
]);

export const tripItems = sqliteTable('trip_items', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').references(() => tripSessions.id).notNull(),
  itemName: text('item_name').notNull(),
  estimatedPrice: real('estimated_price').default(0),
  actualPrice: real('actual_price'),
  quantity: real('quantity').default(1),
  unit: text('unit'),
  isTicked: integer('is_ticked', { mode: 'boolean' }).default(false),
  sortOrder: integer('sort_order').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  index('idx_trip_items_session').on(table.sessionId),
]);

export const priceMemory = sqliteTable('price_memory', {
  id: text('id').primaryKey(),
  itemKey: text('item_key').notNull().unique(),
  lastPrice: real('last_price').notNull(),
  avgPrice: real('avg_price').notNull(),
  hitCount: integer('hit_count').default(1),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// PKG-03: Bills & Reminders
export const bills = sqliteTable('bills', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  amount: real('amount').notNull(),
  dueDate: integer('due_date', { mode: 'timestamp' }).notNull(),
  status: text('status', { enum: ['pending', 'paid', 'overdue'] }).default('pending'),
  categoryId: text('category_id').references(() => categories.id),
  walletId: text('wallet_id').references(() => wallets.id),
  recurringRuleId: text('recurring_rule_id'),
  note: text('note'),
  paidAt: integer('paid_at', { mode: 'timestamp' }),
  paidAmount: real('paid_amount'),
  paidTransactionId: text('paid_transaction_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  index('idx_bills_due_date').on(table.dueDate),
  index('idx_bills_status').on(table.status),
]);

// PKG-07: Dream Goals — Contribution History
export const goalContributions = sqliteTable('goal_contributions', {
  id: text('id').primaryKey(),
  goalId: text('goal_id').references(() => savingsGoals.id).notNull(),
  amount: real('amount').notNull(),
  note: text('note'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  index('idx_goal_contributions_goal').on(table.goalId),
]);

// PKG-17: Tax Box
export const taxBoxes = sqliteTable('tax_boxes', {
  id: text('id').primaryKey(),
  taxYear: integer('tax_year').notNull().unique(), // CE year e.g. 2026
  plannedIncome: real('planned_income').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const taxDeductionItems = sqliteTable('tax_deduction_items', {
  id: text('id').primaryKey(),
  taxBoxId: text('tax_box_id').references(() => taxBoxes.id).notNull(),
  deductionTypeId: text('deduction_type_id').notNull(),
  deductionName: text('deduction_name').notNull(),
  amount: real('amount').notNull().default(0),
  documentNote: text('document_note'),
  documentUri: text('document_uri'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  index('idx_tax_items_box').on(table.taxBoxId),
  index('idx_tax_items_type').on(table.deductionTypeId),
]);

// PKG-02: Budget Planning
export const budgets = sqliteTable('budgets', {
  id: text('id').primaryKey(),
  yearMonth: text('year_month').notNull().unique(), // 'YYYY-MM'
  totalPlannedIncome: real('total_planned_income').default(0),
  allocationRule: text('allocation_rule', {
    enum: ['50-30-20', 'daily-allowance', 'envelope', 'custom'],
  }).default('custom'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const budgetCategories = sqliteTable('budget_categories', {
  id: text('id').primaryKey(),
  budgetId: text('budget_id').references(() => budgets.id).notNull(),
  categoryId: text('category_id').references(() => categories.id),
  categoryName: text('category_name').notNull(),
  allocatedAmount: real('allocated_amount').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  index('idx_budget_categories_budget').on(table.budgetId),
]);

// ── PKG-01 สมุดชีวิต (Life Journal) ──────────────────────────────────────────

export const diaryTrips = sqliteTable('diary_trips', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  destination: text('destination'),
  startDate: integer('start_date', { mode: 'timestamp' }).notNull(),
  endDate: integer('end_date', { mode: 'timestamp' }),
  coverMediaId: text('cover_media_id'), // plain text, ไม่มี FK เพื่อหลีก circular ref
  totalBudget: real('total_budget'),
  status: text('status', { enum: ['ongoing', 'done'] }).default('ongoing'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const diaryEntries = sqliteTable('diary_entries', {
  id: text('id').primaryKey(),
  title: text('title'),
  content: text('content').notNull(),
  mood: text('mood'),                           // emoji: 😊 😢 😤 🥰 😴 😆 🥺
  entryDate: integer('entry_date', { mode: 'timestamp' }).notNull(),
  locationName: text('location_name'),
  tripId: text('trip_id').references(() => diaryTrips.id, { onDelete: 'set null' }),
  linkedTripSessionId: text('linked_trip_session_id'), // เชื่อม PKG-14
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  index('idx_diary_entries_date').on(table.entryDate),
  index('idx_diary_entries_trip').on(table.tripId),
]);

export const diaryMedia = sqliteTable('diary_media', {
  id: text('id').primaryKey(),
  entryId: text('entry_id').notNull().references(() => diaryEntries.id, { onDelete: 'cascade' }),
  localUri: text('local_uri').notNull(),        // path ใน app documentDirectory
  mimeType: text('mime_type').default('image/jpeg'),
  fileSize: integer('file_size'),               // bytes
  width: integer('width'),
  height: integer('height'),
  caption: text('caption'),
  sortOrder: integer('sort_order').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  index('idx_diary_media_entry').on(table.entryId),
]);

export const diaryExpenses = sqliteTable('diary_expenses', {
  id: text('id').primaryKey(),
  entryId: text('entry_id').notNull().references(() => diaryEntries.id, { onDelete: 'cascade' }),
  itemName: text('item_name').notNull(),
  amount: real('amount').notNull(),
  categoryId: text('category_id').references(() => categories.id),
  transactionId: text('transaction_id'),        // null = ไม่ผูก transaction จริง
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  index('idx_diary_expenses_entry').on(table.entryId),
]);

// ── PKG-15 / PKG-13 / PKG-05 (Tier B — Server-Required) ──────────────────────
// Local cache เก็บข้อมูลจาก server เพื่อแสดง UI offline

export const localPaymentRequests = sqliteTable('local_payment_requests', {
  id: text('id').primaryKey(),                      // == requestId จาก server
  amount: real('amount').notNull(),
  description: text('description').notNull(),
  qrPayload: text('qr_payload').notNull(),
  status: text('status', { enum: ['pending', 'paid', 'expired'] }).default('pending'),
  refId: text('ref_id'),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  paidAt: integer('paid_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  index('idx_local_payments_status').on(table.status),
]);

export const localLineConnection = sqliteTable('local_line_connection', {
  id: text('id').primaryKey().default('singleton'),  // 1 row เสมอ
  connected: integer('connected', { mode: 'boolean' }).default(false),
  lineUserId: text('line_user_id'),
  displayName: text('display_name'),
  notificationsEnabled: integer('notifications_enabled', { mode: 'boolean' }).default(false),
  paymentAlerts: integer('payment_alerts', { mode: 'boolean' }).default(true),
  orderAlerts: integer('order_alerts', { mode: 'boolean' }).default(true),
  dailyDigest: integer('daily_digest', { mode: 'boolean' }).default(false),
  connectedAt: integer('connected_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const localShop = sqliteTable('local_shop', {
  id: text('id').primaryKey().default('singleton'),  // 1 ร้าน/1 user
  shopId: text('shop_id'),                           // id จาก server
  name: text('name').notNull().default(''),
  description: text('description').notNull().default(''),
  phone: text('phone').notNull().default(''),
  isOpen: integer('is_open', { mode: 'boolean' }).default(true),
  productCount: integer('product_count').default(0),
  syncedAt: integer('synced_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const localProducts = sqliteTable('local_products', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull(),           // id จาก server
  name: text('name').notNull(),
  price: real('price').notNull(),
  description: text('description').notNull().default(''),
  imageUri: text('image_uri'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  sortOrder: integer('sort_order').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const localOrders = sqliteTable('local_orders', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull(),               // id จาก server
  productName: text('product_name').notNull(),
  amount: real('amount').notNull(),
  status: text('status', { enum: ['pending', 'confirmed', 'paid', 'cancelled'] }).default('pending'),
  buyerName: text('buyer_name'),
  refId: text('ref_id'),
  paidAt: integer('paid_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  index('idx_local_orders_status').on(table.status),
]);

// Type exports
export type Wallet = typeof wallets.$inferSelect;
export type NewWallet = typeof wallets.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type WalletActivityLog = typeof walletActivityLogs.$inferSelect;
export type NewWalletActivityLog = typeof walletActivityLogs.$inferInsert;
export type RecurringRule = typeof recurringRules.$inferSelect;
export type NewRecurringRule = typeof recurringRules.$inferInsert;
export type SavingsGoal = typeof savingsGoals.$inferSelect;
export type NewSavingsGoal = typeof savingsGoals.$inferInsert;
export type AppSetting = typeof appSettings.$inferSelect;
export type SyncLogEntry = typeof syncLog.$inferSelect;
export type ScannedSlip = typeof scannedSlips.$inferSelect;
export type NewScannedSlip = typeof scannedSlips.$inferInsert;
export type QuickAddLearningRule = typeof quickAddLearningRules.$inferSelect;
export type NewQuickAddLearningRule = typeof quickAddLearningRules.$inferInsert;
export type TripSession = typeof tripSessions.$inferSelect;
export type NewTripSession = typeof tripSessions.$inferInsert;
export type TripItem = typeof tripItems.$inferSelect;
export type NewTripItem = typeof tripItems.$inferInsert;
export type PriceMemory = typeof priceMemory.$inferSelect;
export type Bill = typeof bills.$inferSelect;
export type NewBill = typeof bills.$inferInsert;
export type GoalContribution = typeof goalContributions.$inferSelect;
export type NewGoalContribution = typeof goalContributions.$inferInsert;
export type TaxBox = typeof taxBoxes.$inferSelect;
export type NewTaxBox = typeof taxBoxes.$inferInsert;
export type TaxDeductionItem = typeof taxDeductionItems.$inferSelect;
export type NewTaxDeductionItem = typeof taxDeductionItems.$inferInsert;
export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;
export type BudgetCategory = typeof budgetCategories.$inferSelect;
export type NewBudgetCategory = typeof budgetCategories.$inferInsert;
export type DiaryTrip = typeof diaryTrips.$inferSelect;
export type NewDiaryTrip = typeof diaryTrips.$inferInsert;
export type DiaryEntry = typeof diaryEntries.$inferSelect;
export type NewDiaryEntry = typeof diaryEntries.$inferInsert;
export type DiaryMedia = typeof diaryMedia.$inferSelect;
export type NewDiaryMedia = typeof diaryMedia.$inferInsert;
export type DiaryExpense = typeof diaryExpenses.$inferSelect;
export type NewDiaryExpense = typeof diaryExpenses.$inferInsert;
export type LocalPaymentRequest = typeof localPaymentRequests.$inferSelect;
export type LocalLineConnection = typeof localLineConnection.$inferSelect;
export type LocalShop = typeof localShop.$inferSelect;
export type LocalProduct = typeof localProducts.$inferSelect;
export type LocalOrder = typeof localOrders.$inferSelect;
