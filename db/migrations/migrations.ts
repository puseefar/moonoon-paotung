// Migration tracking - SQL is executed directly in provider.tsx
// This file tracks migration versions for future schema updates

export const CURRENT_DB_VERSION = 12;

export const migrations = [
  {
    version: 1,
    name: '0000_init',
    description: 'Initial schema - wallets, categories, transactions, recurring_rules, savings_goals, app_settings, sync_log',
  },
  {
    version: 2,
    name: '0001_quick_add_learning',
    description: 'Adds local quick-add learning rules for user corrections and confirmations',
  },
  {
    version: 3,
    name: '0002_wallet_activity_logs',
    description: 'Adds wallet activity logs for deletion audit history',
  },
  {
    version: 4,
    name: '0003_pkg02_budget',
    description: 'PKG-02: Adds budgets and budget_categories tables for Budget Planning feature',
  },
  {
    version: 5,
    name: '0004_pkg17_taxbox',
    description: 'PKG-17: Adds tax_boxes and tax_deduction_items tables for Tax Box feature',
  },
  {
    version: 6,
    name: '0005_pkg07_dream_goals',
    description: 'PKG-07: Adds goal_contributions table for Dream Goals contribution history',
  },
  {
    version: 7,
    name: '0006_pkg03_bills',
    description: 'PKG-03: Adds bills table for Bills & Reminders feature',
  },
  {
    version: 8,
    name: '0007_pkg14_trip_estimator',
    description: 'PKG-14: Adds trip_sessions, trip_items, price_memory tables for Pre-Trip Estimator',
  },
  {
    version: 9,
    name: '0008_pkg01_life_journal',
    description: 'PKG-01: Adds diary_trips, diary_entries, diary_media, diary_expenses tables for Life Journal (สมุดชีวิต)',
  },
  {
    version: 10,
    name: '0009_pkg15_13_05_server_pkgs',
    description: 'PKG-15/13/05: Local cache tables — local_payment_requests, local_line_connection, local_shop, local_products, local_orders',
  },
  {
    version: 11,
    name: '0010_phase0_single_ledger',
    description:
      'Phase 0: Single Ledger — adds transactions.transfer_group_id; backfills opening transactions (ยอดตั้งต้น) and converts legacy single-row transfers into paired transfer_out/transfer_in. See db/migrations/phase0.ts',
  },
  {
    version: 12,
    name: '0011_compound_trade',
    description:
      'Compound Trade (ซื้อมาขายไป): adds transactions.trade_group_id + trade_role(revenue/cost/standalone) to link 2 atomic legs. Profit = derived (never stored). ALTER applied idempotently in phase0.ts:ensureTransferGroupColumn',
  },
];
