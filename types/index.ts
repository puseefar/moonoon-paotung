// Phase 0 — Single Ledger:
//  - 'opening'      = ยอดตั้งต้นของกระเป๋า (นับในยอดคงเหลือ แต่ไม่นับเป็นรายรับ/รายจ่าย)
//  - 'transfer_out' / 'transfer_in' = คู่ entry ของการโอน ผูกด้วย transferGroupId
//  - 'transfer'     = legacy (แถวเดียว) — เก็บไว้อ่านข้อมูลเก่าก่อน migrate
export type TransactionType =
  | 'income'
  | 'expense'
  | 'transfer'
  | 'transfer_out'
  | 'transfer_in'
  | 'opening';
export type FrequencyType = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type SyncAction = 'backup' | 'restore';
export type SyncStatus = 'success' | 'failed';

export type DateRange = {
  startDate: Date;
  endDate: Date;
};

export type MonthYear = {
  month: number; // 0-11
  year: number;
};

export type CategorySummary = {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  total: number;
  percentage: number;
  count: number;
};

export type MonthlyBalance = {
  totalIncome: number;
  totalExpense: number;
  balance: number;
};

export type TransactionWithCategory = {
  id: string;
  amount: number;
  type: TransactionType;
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  walletId: string;
  walletName: string;
  toWalletId?: string | null;
  tradeGroupId?: string | null;
  tradeRole?: 'revenue' | 'cost' | 'standalone' | null;
  note: string | null;
  date: Date;
  createdAt: Date;
};

export type WalletActivityAction =
  | 'income'
  | 'expense'
  | 'transfer_in'
  | 'transfer_out'
  | 'opening'
  | 'deleted';

export type WalletActivityItem = {
  id: string;
  source: 'transaction' | 'log';
  transactionId: string | null;
  walletId: string;
  actionType: WalletActivityAction;
  transactionType: TransactionType;
  amount: number;
  signedAmount: number;
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  note: string | null;
  date: Date;
  balanceBefore: number;
  balanceAfter: number;
  counterpartyWalletId: string | null;
  counterpartyWalletName: string | null;
};
