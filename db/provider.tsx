import React, { createContext, useContext, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { BrandedLoadingScreen } from '@/components/splash/BrandedLoadingScreen';
import { expoDb } from './client';
import { seedDefaultData } from './seed';

type DatabaseContextType = {
  isReady: boolean;
};

const DatabaseContext = createContext<DatabaseContextType>({ isReady: false });

const DB_INIT_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error('Database initialization timed out')), timeoutMs);
    }),
  ]);
}

export function useDatabaseReady() {
  return useContext(DatabaseContext);
}

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function initDatabase() {
      setErrorMessage(null);
      setIsReady(false);

      try {
        await withTimeout(
          expoDb.execAsync(`
            CREATE TABLE IF NOT EXISTS wallets (
              id text PRIMARY KEY NOT NULL,
              name text NOT NULL,
              icon text DEFAULT '💰',
              balance real DEFAULT 0,
              currency text DEFAULT 'THB',
              is_active integer DEFAULT 1,
              created_at integer NOT NULL,
              updated_at integer NOT NULL
            );

            CREATE TABLE IF NOT EXISTS categories (
              id text PRIMARY KEY NOT NULL,
              name text NOT NULL,
              icon text NOT NULL,
              type text NOT NULL,
              color text DEFAULT '#4CAF50',
              sort_order integer DEFAULT 0,
              is_default integer DEFAULT 0,
              created_at integer NOT NULL
            );

            CREATE TABLE IF NOT EXISTS transactions (
              id text PRIMARY KEY NOT NULL,
              amount real NOT NULL,
              type text NOT NULL,
              category_id text REFERENCES categories(id),
              wallet_id text NOT NULL REFERENCES wallets(id),
              to_wallet_id text REFERENCES wallets(id),
              note text,
              date integer NOT NULL,
              attachment_uri text,
              is_recurring integer DEFAULT 0,
              recurring_id text,
              created_at integer NOT NULL,
              updated_at integer NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
            CREATE INDEX IF NOT EXISTS idx_transactions_wallet ON transactions(wallet_id);
            CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
            CREATE INDEX IF NOT EXISTS idx_transactions_month_type ON transactions(date, type);

            CREATE TABLE IF NOT EXISTS wallet_activity_logs (
              id text PRIMARY KEY NOT NULL,
              wallet_id text NOT NULL REFERENCES wallets(id),
              related_transaction_id text,
              action_type text NOT NULL,
              transaction_type text NOT NULL,
              category_id text REFERENCES categories(id),
              counterparty_wallet_id text REFERENCES wallets(id),
              amount real NOT NULL,
              balance_before real NOT NULL,
              balance_after real NOT NULL,
              note text,
              created_at integer NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_wallet_activity_wallet ON wallet_activity_logs(wallet_id);
            CREATE INDEX IF NOT EXISTS idx_wallet_activity_created_at ON wallet_activity_logs(created_at);

            CREATE TABLE IF NOT EXISTS recurring_rules (
              id text PRIMARY KEY NOT NULL,
              amount real NOT NULL,
              type text NOT NULL,
              category_id text REFERENCES categories(id),
              wallet_id text NOT NULL REFERENCES wallets(id),
              note text,
              frequency text NOT NULL,
              day_of_month integer,
              next_date integer NOT NULL,
              is_active integer DEFAULT 1,
              created_at integer NOT NULL
            );

            CREATE TABLE IF NOT EXISTS savings_goals (
              id text PRIMARY KEY NOT NULL,
              name text NOT NULL,
              target_amount real NOT NULL,
              current_amount real DEFAULT 0,
              deadline integer,
              icon text DEFAULT '🎯',
              color text DEFAULT '#FF9800',
              is_completed integer DEFAULT 0,
              created_at integer NOT NULL,
              updated_at integer NOT NULL
            );

            CREATE TABLE IF NOT EXISTS app_settings (
              key text PRIMARY KEY NOT NULL,
              value text NOT NULL,
              updated_at integer NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sync_log (
              id text PRIMARY KEY NOT NULL,
              action text NOT NULL,
              status text NOT NULL,
              file_size integer,
              timestamp integer NOT NULL,
              error_message text
            );

            CREATE TABLE IF NOT EXISTS scanned_slips (
              id text PRIMARY KEY NOT NULL,
              qr_payload text NOT NULL,
              qr_hash text NOT NULL UNIQUE,
              image_uri text,
              amount real,
              transfer_date text,
              sender_name text,
              receiver_name text,
              bank_name text,
              ref_code text,
              status text DEFAULT 'pending',
              transaction_id text,
              created_at integer NOT NULL
            );

            CREATE TABLE IF NOT EXISTS quick_add_learning_rules (
              id text PRIMARY KEY NOT NULL,
              keyword text NOT NULL,
              normalized_keyword text NOT NULL,
              type text NOT NULL,
              category_id text REFERENCES categories(id),
              confidence integer DEFAULT 1,
              source text DEFAULT 'user_correction',
              hit_count integer DEFAULT 1,
              created_at integer NOT NULL,
              updated_at integer NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_quick_add_learning_normalized_keyword ON quick_add_learning_rules(normalized_keyword);
            CREATE INDEX IF NOT EXISTS idx_quick_add_learning_category ON quick_add_learning_rules(category_id);

            CREATE TABLE IF NOT EXISTS trip_sessions (
              id text PRIMARY KEY NOT NULL,
              name text NOT NULL,
              template_id text,
              estimated_budget real DEFAULT 0,
              actual_spent real DEFAULT 0,
              status text DEFAULT 'planning',
              note text,
              created_at integer NOT NULL,
              completed_at integer
            );

            CREATE INDEX IF NOT EXISTS idx_trip_sessions_status ON trip_sessions(status);

            CREATE TABLE IF NOT EXISTS trip_items (
              id text PRIMARY KEY NOT NULL,
              session_id text NOT NULL REFERENCES trip_sessions(id),
              item_name text NOT NULL,
              estimated_price real DEFAULT 0,
              actual_price real,
              quantity real DEFAULT 1,
              unit text,
              is_ticked integer DEFAULT 0,
              sort_order integer DEFAULT 0,
              created_at integer NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_trip_items_session ON trip_items(session_id);

            CREATE TABLE IF NOT EXISTS price_memory (
              id text PRIMARY KEY NOT NULL,
              item_key text NOT NULL UNIQUE,
              last_price real NOT NULL,
              avg_price real NOT NULL,
              hit_count integer DEFAULT 1,
              updated_at integer NOT NULL
            );

            CREATE TABLE IF NOT EXISTS bills (
              id text PRIMARY KEY NOT NULL,
              name text NOT NULL,
              amount real NOT NULL,
              due_date integer NOT NULL,
              status text DEFAULT 'pending',
              category_id text REFERENCES categories(id),
              wallet_id text REFERENCES wallets(id),
              recurring_rule_id text,
              note text,
              paid_at integer,
              paid_amount real,
              paid_transaction_id text,
              created_at integer NOT NULL,
              updated_at integer NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_bills_due_date ON bills(due_date);
            CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);

            CREATE TABLE IF NOT EXISTS goal_contributions (
              id text PRIMARY KEY NOT NULL,
              goal_id text NOT NULL REFERENCES savings_goals(id),
              amount real NOT NULL,
              note text,
              created_at integer NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_goal_contributions_goal ON goal_contributions(goal_id);

            CREATE TABLE IF NOT EXISTS tax_boxes (
              id text PRIMARY KEY NOT NULL,
              tax_year integer NOT NULL UNIQUE,
              planned_income real DEFAULT 0,
              created_at integer NOT NULL,
              updated_at integer NOT NULL
            );

            CREATE TABLE IF NOT EXISTS tax_deduction_items (
              id text PRIMARY KEY NOT NULL,
              tax_box_id text NOT NULL REFERENCES tax_boxes(id),
              deduction_type_id text NOT NULL,
              deduction_name text NOT NULL,
              amount real NOT NULL DEFAULT 0,
              document_note text,
              document_uri text,
              created_at integer NOT NULL,
              updated_at integer NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_tax_items_box ON tax_deduction_items(tax_box_id);
            CREATE INDEX IF NOT EXISTS idx_tax_items_type ON tax_deduction_items(deduction_type_id);

            CREATE TABLE IF NOT EXISTS budgets (
              id text PRIMARY KEY NOT NULL,
              year_month text NOT NULL UNIQUE,
              total_planned_income real DEFAULT 0,
              allocation_rule text DEFAULT 'custom',
              created_at integer NOT NULL,
              updated_at integer NOT NULL
            );

            CREATE TABLE IF NOT EXISTS budget_categories (
              id text PRIMARY KEY NOT NULL,
              budget_id text NOT NULL REFERENCES budgets(id),
              category_id text REFERENCES categories(id),
              category_name text NOT NULL,
              allocated_amount real DEFAULT 0,
              created_at integer NOT NULL,
              updated_at integer NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_budget_categories_budget ON budget_categories(budget_id);

            CREATE TABLE IF NOT EXISTS local_payment_requests (
              id text PRIMARY KEY NOT NULL,
              amount real NOT NULL,
              description text NOT NULL,
              qr_payload text NOT NULL,
              status text DEFAULT 'pending',
              ref_id text,
              expires_at integer NOT NULL,
              paid_at integer,
              created_at integer NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_local_payments_status ON local_payment_requests(status);

            CREATE TABLE IF NOT EXISTS local_line_connection (
              id text PRIMARY KEY DEFAULT 'singleton',
              connected integer DEFAULT 0,
              line_user_id text,
              display_name text,
              notifications_enabled integer DEFAULT 0,
              payment_alerts integer DEFAULT 1,
              order_alerts integer DEFAULT 1,
              daily_digest integer DEFAULT 0,
              connected_at integer,
              updated_at integer NOT NULL
            );

            CREATE TABLE IF NOT EXISTS local_shop (
              id text PRIMARY KEY DEFAULT 'singleton',
              shop_id text,
              name text NOT NULL DEFAULT '',
              description text NOT NULL DEFAULT '',
              phone text NOT NULL DEFAULT '',
              is_open integer DEFAULT 1,
              product_count integer DEFAULT 0,
              synced_at integer,
              updated_at integer NOT NULL
            );

            CREATE TABLE IF NOT EXISTS local_products (
              id text PRIMARY KEY NOT NULL,
              product_id text NOT NULL,
              name text NOT NULL,
              price real NOT NULL,
              description text NOT NULL DEFAULT '',
              image_uri text,
              is_active integer DEFAULT 1,
              sort_order integer DEFAULT 0,
              created_at integer NOT NULL
            );

            CREATE TABLE IF NOT EXISTS local_orders (
              id text PRIMARY KEY NOT NULL,
              order_id text NOT NULL,
              product_name text NOT NULL,
              amount real NOT NULL,
              status text DEFAULT 'pending',
              buyer_name text,
              ref_id text,
              paid_at integer,
              created_at integer NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_local_orders_status ON local_orders(status);

            CREATE TABLE IF NOT EXISTS diary_trips (
              id text PRIMARY KEY NOT NULL,
              name text NOT NULL,
              destination text,
              start_date integer NOT NULL,
              end_date integer,
              cover_media_id text,
              total_budget real,
              status text DEFAULT 'ongoing',
              created_at integer NOT NULL
            );

            CREATE TABLE IF NOT EXISTS diary_entries (
              id text PRIMARY KEY NOT NULL,
              title text,
              content text NOT NULL,
              mood text,
              entry_date integer NOT NULL,
              location_name text,
              trip_id text REFERENCES diary_trips(id) ON DELETE SET NULL,
              linked_trip_session_id text,
              created_at integer NOT NULL,
              updated_at integer NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_diary_entries_date ON diary_entries(entry_date);
            CREATE INDEX IF NOT EXISTS idx_diary_entries_trip ON diary_entries(trip_id);

            CREATE TABLE IF NOT EXISTS diary_media (
              id text PRIMARY KEY NOT NULL,
              entry_id text NOT NULL REFERENCES diary_entries(id) ON DELETE CASCADE,
              local_uri text NOT NULL,
              mime_type text DEFAULT 'image/jpeg',
              file_size integer,
              width integer,
              height integer,
              caption text,
              sort_order integer DEFAULT 0,
              created_at integer NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_diary_media_entry ON diary_media(entry_id);

            CREATE TABLE IF NOT EXISTS diary_expenses (
              id text PRIMARY KEY NOT NULL,
              entry_id text NOT NULL REFERENCES diary_entries(id) ON DELETE CASCADE,
              item_name text NOT NULL,
              amount real NOT NULL,
              category_id text REFERENCES categories(id),
              transaction_id text,
              created_at integer NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_diary_expenses_entry ON diary_expenses(entry_id);
          `),
          DB_INIT_TIMEOUT_MS
        );

        await withTimeout(seedDefaultData(), DB_INIT_TIMEOUT_MS);

        if (!cancelled) {
          setIsReady(true);
        }
      } catch (error) {
        console.error('Failed to initialize database:', error);
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : 'Unknown database error');
        }
      }
    }

    initDatabase();

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (errorMessage) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#FFFFFF',
          paddingHorizontal: 24,
        }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#D32F2F', textAlign: 'center' }}>
          แอปเริ่มต้นฐานข้อมูลไม่สำเร็จ
        </Text>
        <Text
          style={{
            marginTop: 12,
            fontSize: 14,
            color: '#666666',
            textAlign: 'center',
            lineHeight: 22,
          }}>
          {errorMessage}
        </Text>
        <Pressable
          onPress={() => setAttempt((value) => value + 1)}
          style={{
            marginTop: 20,
            paddingHorizontal: 20,
            paddingVertical: 12,
            borderRadius: 12,
            backgroundColor: '#2196F3',
          }}>
          <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>ลองใหม่</Text>
        </Pressable>
      </View>
    );
  }

  if (!isReady) {
    return <BrandedLoadingScreen message="กำลังเตรียมข้อมูล..." />;
  }

  return <DatabaseContext.Provider value={{ isReady }}>{children}</DatabaseContext.Provider>;
}
