import { create } from 'zustand';
import { transactionService } from '@/services/transactionService';
import type { NewTransaction } from '@/db/schema';
import type { DateRange, TransactionWithCategory } from '@/types';

type TransactionStore = {
  transactions: TransactionWithCategory[];
  recentTransactions: TransactionWithCategory[];
  isLoading: boolean;
  lastUpdated: number;          // timestamp — History ใช้ detect ว่าต้อง reload ไหม
  loadByDateRange: (range: DateRange) => Promise<void>;
  loadRecent: (limit?: number) => Promise<void>;
  addTransaction: (data: Omit<NewTransaction, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  deleteTransaction: (id: string) => Promise<void>;
  deleteTradeGroup: (tradeGroupId: string) => Promise<void>;
  updateTransactionCategory: (id: string, categoryId: string) => Promise<void>;
  searchByNote: (keyword: string) => Promise<void>;
};

export const useTransactionStore = create<TransactionStore>((set) => ({
  transactions: [],
  recentTransactions: [],
  isLoading: false,
  lastUpdated: 0,

  loadByDateRange: async (range) => {
    set({ isLoading: true });
    try {
      const result = await transactionService.getByDateRange(range);
      set({ transactions: result });
    } finally {
      set({ isLoading: false });
    }
  },

  loadRecent: async (limit = 5) => {
    const result = await transactionService.getRecent(limit);
    set({ recentTransactions: result });
  },

  addTransaction: async (data) => {
    set({ isLoading: true });
    try {
      const id = await transactionService.create(data);
      const recent = await transactionService.getRecent(5);
      set({ recentTransactions: recent, lastUpdated: Date.now() }); // lastUpdated บอก History ให้ reload
      return id;
    } finally {
      set({ isLoading: false });
    }
  },

  deleteTransaction: async (id) => {
    set({ isLoading: true });
    try {
      await transactionService.delete(id);
      const recent = await transactionService.getRecent(5);
      set({ recentTransactions: recent });
    } finally {
      set({ isLoading: false });
    }
  },

  deleteTradeGroup: async (tradeGroupId) => {
    set({ isLoading: true });
    try {
      await transactionService.deleteTradeGroup(tradeGroupId);
      const recent = await transactionService.getRecent(5);
      set({ recentTransactions: recent, lastUpdated: Date.now() });
    } finally {
      set({ isLoading: false });
    }
  },

  updateTransactionCategory: async (id, categoryId) => {
    await transactionService.update(id, { categoryId });
    const recent = await transactionService.getRecent(5);
    set({ recentTransactions: recent, lastUpdated: Date.now() });
  },

  searchByNote: async (keyword) => {
    set({ isLoading: true });
    try {
      const result = await transactionService.searchByNote(keyword);
      set({
        transactions: result.map((tx) => ({
          ...tx,
          categoryName: null,
          categoryIcon: null,
          categoryColor: null,
          walletName: '',
          toWalletId: tx.toWalletId ?? null,
        })) as TransactionWithCategory[],
      });
    } finally {
      set({ isLoading: false });
    }
  },
}));
