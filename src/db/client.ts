import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { config } from '../config.js';
import * as schema from './schema.js';

if (!config.db.url) {
  throw new Error('DATABASE_URL is required. Get it from https://neon.tech');
}

const client = postgres(config.db.url, {
  ssl: 'require',
  max: 5,          // connection pool สำหรับ Neon
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });

export async function initDb() {
  await client`
    CREATE TABLE IF NOT EXISTS users (
      id text PRIMARY KEY NOT NULL,
      device_id text NOT NULL UNIQUE,
      tier text NOT NULL DEFAULT 'free',
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL
    )
  `;
  await client`CREATE INDEX IF NOT EXISTS idx_users_device ON users(device_id)`;

  await client`
    CREATE TABLE IF NOT EXISTS payment_requests (
      id text PRIMARY KEY NOT NULL,
      user_id text NOT NULL REFERENCES users(id),
      amount double precision NOT NULL,
      description text NOT NULL,
      qr_payload text NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      ref_id text,
      ref_hash text,
      expires_at timestamptz NOT NULL,
      paid_at timestamptz,
      created_at timestamptz NOT NULL
    )
  `;
  await client`CREATE INDEX IF NOT EXISTS idx_payments_user ON payment_requests(user_id)`;
  await client`CREATE INDEX IF NOT EXISTS idx_payments_status ON payment_requests(status)`;
  await client`CREATE INDEX IF NOT EXISTS idx_payments_refhash ON payment_requests(ref_hash)`;

  await client`
    CREATE TABLE IF NOT EXISTS slip_used (
      ref_hash text PRIMARY KEY NOT NULL,
      request_id text NOT NULL,
      used_at timestamptz NOT NULL
    )
  `;

  await client`
    CREATE TABLE IF NOT EXISTS line_connections (
      user_id text PRIMARY KEY NOT NULL REFERENCES users(id),
      line_user_id text NOT NULL UNIQUE,
      display_name text,
      notifications_enabled boolean DEFAULT true,
      payment_alerts boolean DEFAULT true,
      order_alerts boolean DEFAULT true,
      daily_digest boolean DEFAULT false,
      connected_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL
    )
  `;

  await client`
    CREATE TABLE IF NOT EXISTS line_notif_log (
      id text PRIMARY KEY NOT NULL,
      user_id text NOT NULL REFERENCES users(id),
      type text NOT NULL,
      status text NOT NULL,
      error_message text,
      sent_at timestamptz NOT NULL
    )
  `;
  await client`CREATE INDEX IF NOT EXISTS idx_notif_user ON line_notif_log(user_id)`;

  await client`
    CREATE TABLE IF NOT EXISTS shops (
      id text PRIMARY KEY NOT NULL,
      user_id text NOT NULL UNIQUE REFERENCES users(id),
      name text NOT NULL,
      description text NOT NULL DEFAULT '',
      phone text NOT NULL,
      is_open boolean DEFAULT true,
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL
    )
  `;

  await client`
    CREATE TABLE IF NOT EXISTS products (
      id text PRIMARY KEY NOT NULL,
      shop_id text NOT NULL REFERENCES shops(id),
      name text NOT NULL,
      price double precision NOT NULL,
      description text NOT NULL DEFAULT '',
      is_active boolean DEFAULT true,
      sort_order double precision DEFAULT 0,
      created_at timestamptz NOT NULL
    )
  `;
  await client`CREATE INDEX IF NOT EXISTS idx_products_shop ON products(shop_id)`;

  await client`
    CREATE TABLE IF NOT EXISTS orders (
      id text PRIMARY KEY NOT NULL,
      shop_id text NOT NULL REFERENCES shops(id),
      product_id text NOT NULL REFERENCES products(id),
      product_name text NOT NULL,
      amount double precision NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      buyer_line_id text,
      buyer_name text,
      ref_id text,
      paid_at timestamptz,
      created_at timestamptz NOT NULL
    )
  `;
  await client`CREATE INDEX IF NOT EXISTS idx_orders_shop ON orders(shop_id)`;
  await client`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`;

  // ── PKG-05 stock column (idempotent) ────────────────────────────────────────
  await client`ALTER TABLE products ADD COLUMN IF NOT EXISTS stock double precision DEFAULT 999`;

  // ── PKG-05 stock deduction idempotency table ─────────────────────────────────
  await client`
    CREATE TABLE IF NOT EXISTS stock_deductions (
      id text PRIMARY KEY NOT NULL,
      order_id text NOT NULL,
      deducted_at timestamptz NOT NULL
    )
  `;

  // ── PKG-05 v2 order migration (idempotent) ───────────────────────────────────
  await client`ALTER TABLE orders ALTER COLUMN product_id DROP NOT NULL`.catch(() => {});
  await client`ALTER TABLE orders ALTER COLUMN product_name DROP NOT NULL`.catch(() => {});
  await client`ALTER TABLE orders ALTER COLUMN amount DROP NOT NULL`.catch(() => {});
  await client`ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_no text`;
  await client`ALTER TABLE orders ADD COLUMN IF NOT EXISTS items_json text`;
  await client`ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name text`;
  await client`ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone text`;
  await client`ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_address text`;
  await client`ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal double precision`;
  await client`ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_cost double precision DEFAULT 0`;
  await client`ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount double precision DEFAULT 0`;
  await client`ALTER TABLE orders ADD COLUMN IF NOT EXISTS total double precision`;
  await client`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_method text`;
  await client`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method text`;
  await client`ALTER TABLE orders ADD COLUMN IF NOT EXISTS note text`;
  await client`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_request_id text REFERENCES payment_requests(id)`.catch(() => {});
  await client`ALTER TABLE orders ADD COLUMN IF NOT EXISTS expires_at timestamptz`;
  await client`ALTER TABLE orders ADD COLUMN IF NOT EXISTS public_token text`;

  await client`
    CREATE TABLE IF NOT EXISTS action_log (
      id text PRIMARY KEY NOT NULL,
      user_id text,
      action text NOT NULL,
      meta text,
      ip text,
      created_at timestamptz NOT NULL
    )
  `;
  await client`CREATE INDEX IF NOT EXISTS idx_log_user ON action_log(user_id)`;

  // ── PKG-15 migrations (idempotent) ───────────────────────────────────────────
  await client`ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS upload_token text`;
  await client`CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_upload_token ON payment_requests(upload_token) WHERE upload_token IS NOT NULL`;

  await client`
    CREATE TABLE IF NOT EXISTS payment_slips (
      id text PRIMARY KEY NOT NULL,
      payment_request_id text NOT NULL REFERENCES payment_requests(id),
      image_data text NOT NULL,
      file_hash text NOT NULL,
      trans_ref text,
      detected_amount double precision,
      verification_status text NOT NULL DEFAULT 'pending',
      verify_raw_response text,
      reject_reason text,
      created_at timestamptz NOT NULL,
      UNIQUE(payment_request_id, file_hash)
    )
  `;
  await client`CREATE UNIQUE INDEX IF NOT EXISTS idx_slips_trans_ref ON payment_slips(trans_ref) WHERE trans_ref IS NOT NULL`;
  await client`CREATE INDEX IF NOT EXISTS idx_slips_payment ON payment_slips(payment_request_id)`;
}
