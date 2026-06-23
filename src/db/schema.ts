import { pgTable, text, boolean, doublePrecision, timestamp, index } from 'drizzle-orm/pg-core';

// ── Users & Auth ──────────────────────────────────────────────────────────────
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  deviceId: text('device_id').notNull().unique(),
  tier: text('tier').$type<'free'|'pro'|'server'|'business'>().default('free').notNull(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
}, (t) => [index('idx_users_device').on(t.deviceId)]);

// ── PKG-15 ── Payment ─────────────────────────────────────────────────────────
export const paymentRequests = pgTable('payment_requests', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  amount: doublePrecision('amount').notNull(),
  description: text('description').notNull(),
  qrPayload: text('qr_payload').notNull(),
  status: text('status')
    .$type<'pending'|'verifying'|'paid'|'need_review'|'rejected'|'expired'>()
    .default('pending').notNull(),
  uploadToken: text('upload_token').unique(),
  refId: text('ref_id'),
  refHash: text('ref_hash'),
  expiresAt: timestamp('expires_at').notNull(),
  paidAt: timestamp('paid_at'),
  createdAt: timestamp('created_at').notNull(),
}, (t) => [
  index('idx_payments_user').on(t.userId),
  index('idx_payments_status').on(t.status),
  index('idx_payments_refhash').on(t.refHash),
]);

export const slipUsed = pgTable('slip_used', {
  refHash: text('ref_hash').primaryKey(),
  requestId: text('request_id').notNull(),
  usedAt: timestamp('used_at').notNull(),
});

export const paymentSlips = pgTable('payment_slips', {
  id: text('id').primaryKey(),
  paymentRequestId: text('payment_request_id').references(() => paymentRequests.id).notNull(),
  imageData: text('image_data').notNull(),       // base64 data URL
  fileHash: text('file_hash').notNull(),          // SHA-256 ของไฟล์ (dedup ในรายการ)
  transRef: text('trans_ref'),                    // transRef จาก Thunder (global dedup)
  detectedAmount: doublePrecision('detected_amount'),
  verificationStatus: text('verification_status')
    .$type<'pending'|'passed'|'failed'|'unreadable'>()
    .default('pending').notNull(),
  verifyRawResponse: text('verify_raw_response'), // Thunder response เก็บไว้ debug
  rejectReason: text('reject_reason'),
  createdAt: timestamp('created_at').notNull(),
}, (t) => [
  index('idx_slips_payment').on(t.paymentRequestId),
]);

// ── PKG-13 ── LINE ────────────────────────────────────────────────────────────
export const lineConnections = pgTable('line_connections', {
  userId: text('user_id').primaryKey().references(() => users.id),
  lineUserId: text('line_user_id').notNull().unique(),
  displayName: text('display_name'),
  notificationsEnabled: boolean('notifications_enabled').default(true),
  paymentAlerts: boolean('payment_alerts').default(true),
  orderAlerts: boolean('order_alerts').default(true),
  dailyDigest: boolean('daily_digest').default(false),
  connectedAt: timestamp('connected_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const lineNotifLog = pgTable('line_notif_log', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  type: text('type').notNull(),
  status: text('status').$type<'sent'|'failed'>().notNull(),
  errorMessage: text('error_message'),
  sentAt: timestamp('sent_at').notNull(),
}, (t) => [index('idx_notif_user').on(t.userId)]);

// ── PKG-05 ── Shop ────────────────────────────────────────────────────────────
export const shops = pgTable('shops', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  phone: text('phone').notNull(),
  isOpen: boolean('is_open').default(true),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const products = pgTable('products', {
  id: text('id').primaryKey(),
  shopId: text('shop_id').references(() => shops.id).notNull(),
  name: text('name').notNull(),
  price: doublePrecision('price').notNull(),
  description: text('description').notNull().default(''),
  isActive: boolean('is_active').default(true),
  sortOrder: doublePrecision('sort_order').default(0),
  stock: doublePrecision('stock').default(999),  // null = ไม่จำกัด
  createdAt: timestamp('created_at').notNull(),
}, (t) => [index('idx_products_shop').on(t.shopId)]);

export const orders = pgTable('orders', {
  id: text('id').primaryKey(),
  shopId: text('shop_id').references(() => shops.id).notNull(),
  // Legacy single-product fields (nullable for new multi-item orders)
  productId: text('product_id').references(() => products.id),
  productName: text('product_name'),
  amount: doublePrecision('amount'),
  // New full-order fields (v2)
  orderNo: text('order_no'),
  itemsJson: text('items_json'),              // JSON: OrderLineItem[]
  customerName: text('customer_name'),
  customerPhone: text('customer_phone'),
  customerAddress: text('customer_address'),
  subtotal: doublePrecision('subtotal'),
  shippingCost: doublePrecision('shipping_cost').default(0),
  discount: doublePrecision('discount').default(0),
  total: doublePrecision('total'),
  deliveryMethod: text('delivery_method'),    // 'free'|'fixed'|'pickup'
  paymentMethod: text('payment_method'),      // 'promptpay'|'bank'
  note: text('note'),
  paymentRequestId: text('payment_request_id').references(() => paymentRequests.id),
  expiresAt: timestamp('expires_at'),
  publicToken: text('public_token'),
  status: text('status')
    .$type<'PENDING_PAYMENT'|'VERIFYING_SLIP'|'SLIP_REJECTED'|'PAID'|'PREPARING'|'SHIPPED'|'COMPLETED'|'CANCELLED'|'REFUNDED'|'pending'|'confirmed'|'paid'|'cancelled'>()
    .default('PENDING_PAYMENT').notNull(),
  buyerLineId: text('buyer_line_id'),
  buyerName: text('buyer_name'),
  refId: text('ref_id'),
  paidAt: timestamp('paid_at'),
  createdAt: timestamp('created_at').notNull(),
}, (t) => [
  index('idx_orders_shop').on(t.shopId),
  index('idx_orders_status').on(t.status),
]);

// ── Stock Deduction Log (idempotency) ─────────────────────────────────────────
export const stockDeductions = pgTable('stock_deductions', {
  id: text('id').primaryKey(),        // paymentRef (idempotency key)
  orderId: text('order_id').notNull(),
  deductedAt: timestamp('deducted_at').notNull(),
});

// ── Action Log ────────────────────────────────────────────────────────────────
export const actionLog = pgTable('action_log', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  action: text('action').notNull(),
  meta: text('meta'),
  ip: text('ip'),
  createdAt: timestamp('created_at').notNull(),
}, (t) => [index('idx_log_user').on(t.userId)]);
