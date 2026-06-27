import { create } from 'zustand';
import { transactionService } from '@/services/transactionService';
import { getCurrentThaiMonth } from '@/lib/time';
import type { MonthlyBalance, CategorySummary, MonthYear } from '@/types';

type SummaryStore = {
  currentMonth: MonthYear;
  monthlyBalance: MonthlyBalance;
  expenseSummary: CategorySummary[];
  incomeSummary: CategorySummary[];
  isLoading: boolean;

  // Actions
  setMonth: (month: MonthYear) => void;
  loadMonthlySummary: () => Promise<void>;
  loadCategorySummary: () => Promise<void>;
  loadAll: () => Promise<void>;
};

function getCurrentMonth(): MonthYear {
  // ใช้เดือนตามเวลาไทย (สอดคล้องกับ financeSummaryService)
  return getCurrentThaiMonth();
}

export const useSummaryStore = create<SummaryStore>((set, get) => ({
  currentMonth: getCurrentMonth(),
  monthlyBalance: { totalIncome: 0, totalExpense: 0, balance: 0 },
  expenseSummary: [],
  incomeSummary: [],
  isLoading: false,

  setMonth: (month) => set({ currentMonth: month }),

  loadMonthlySummary: async () => {
    const { currentMonth } = get();
    const balance = await transactionService.getMonthlyBalance(
      currentMonth.year,
      currentMonth.month
    );
    set({ monthlyBalance: balance });
  },

  loadCategorySummary: async () => {
    const { currentMonth } = get();
    const [expense, income] = await Promise.all([
      transactionService.getCategorySummary(currentMonth.year, currentMonth.month, 'expense'),
      transactionService.getCategorySummary(currentMonth.year, currentMonth.month, 'income'),
    ]);
    set({ expenseSummary: expense, incomeSummary: income });
  },

  loadAll: async () => {
    set({ isLoading: true });
    try {
      const { currentMonth } = get();
      const [balance, expense, income] = await Promise.all([
        transactionService.getMonthlyBalance(currentMonth.year, currentMonth.month),
        transactionService.getCategorySummary(currentMonth.year, currentMonth.month, 'expense'),
        transactionService.getCategorySummary(currentMonth.year, currentMonth.month, 'income'),
      ]);
      set({
        monthlyBalance: balance,
        expenseSummary: expense,
        incomeSummary: income,
      });
    } finally {
      set({ isLoading: false });
    }
  },
}));
