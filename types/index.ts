export type TransactionType = 'income' | 'expense' | 'transfer';
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
  note: string | null;
  date: Date;
  createdAt: Date;
};

export type WalletActivityAction =
  | 'income'
  | 'expense'
  | 'transfer_in'
  | 'transfer_out'
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
