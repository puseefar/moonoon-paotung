CREATE TABLE IF NOT EXISTS `wallets` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `icon` text DEFAULT '💰',
  `balance` real DEFAULT 0,
  `currency` text DEFAULT 'THB',
  `is_active` integer DEFAULT true,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS `categories` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `icon` text NOT NULL,
  `type` text NOT NULL,
  `color` text DEFAULT '#4CAF50',
  `sort_order` integer DEFAULT 0,
  `is_default` integer DEFAULT false,
  `created_at` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS `transactions` (
  `id` text PRIMARY KEY NOT NULL,
  `amount` real NOT NULL,
  `type` text NOT NULL,
  `category_id` text REFERENCES `categories`(`id`),
  `wallet_id` text NOT NULL REFERENCES `wallets`(`id`),
  `to_wallet_id` text REFERENCES `wallets`(`id`),
  `note` text,
  `date` integer NOT NULL,
  `attachment_uri` text,
  `is_recurring` integer DEFAULT false,
  `recurring_id` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE INDEX IF NOT EXISTS `idx_transactions_date` ON `transactions` (`date`);
CREATE INDEX IF NOT EXISTS `idx_transactions_wallet` ON `transactions` (`wallet_id`);
CREATE INDEX IF NOT EXISTS `idx_transactions_category` ON `transactions` (`category_id`);
CREATE INDEX IF NOT EXISTS `idx_transactions_month_type` ON `transactions` (`date`, `type`);

CREATE TABLE IF NOT EXISTS `recurring_rules` (
  `id` text PRIMARY KEY NOT NULL,
  `amount` real NOT NULL,
  `type` text NOT NULL,
  `category_id` text REFERENCES `categories`(`id`),
  `wallet_id` text NOT NULL REFERENCES `wallets`(`id`),
  `note` text,
  `frequency` text NOT NULL,
  `day_of_month` integer,
  `next_date` integer NOT NULL,
  `is_active` integer DEFAULT true,
  `created_at` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS `savings_goals` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `target_amount` real NOT NULL,
  `current_amount` real DEFAULT 0,
  `deadline` integer,
  `icon` text DEFAULT '🎯',
  `color` text DEFAULT '#FF9800',
  `is_completed` integer DEFAULT false,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS `app_settings` (
  `key` text PRIMARY KEY NOT NULL,
  `value` text NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS `sync_log` (
  `id` text PRIMARY KEY NOT NULL,
  `action` text NOT NULL,
  `status` text NOT NULL,
  `file_size` integer,
  `timestamp` integer NOT NULL,
  `error_message` text
);

CREATE TABLE IF NOT EXISTS `quick_add_learning_rules` (
  `id` text PRIMARY KEY NOT NULL,
  `keyword` text NOT NULL,
  `normalized_keyword` text NOT NULL,
  `type` text NOT NULL,
  `category_id` text REFERENCES `categories`(`id`),
  `confidence` integer DEFAULT 1,
  `source` text DEFAULT 'user_correction',
  `hit_count` integer DEFAULT 1,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE INDEX IF NOT EXISTS `idx_quick_add_learning_normalized_keyword` ON `quick_add_learning_rules` (`normalized_keyword`);
CREATE INDEX IF NOT EXISTS `idx_quick_add_learning_category` ON `quick_add_learning_rules` (`category_id`);
