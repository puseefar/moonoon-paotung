import { useEffect } from 'react';
import { useSummaryStore } from '@/stores/useSummaryStore';
import type { MonthYear } from '@/types';

export function useMonthlyBalance(monthYear?: MonthYear) {
  const {
    monthlyBalance,
    currentMonth,
    setMonth,
    loadMonthlySummary,
    isLoading,
  } = useSummaryStore();

  useEffect(() => {
    if (monthYear) {
      setMonth(monthYear);
    }
  }, [monthYear?.month, monthYear?.year]);

  useEffect(() => {
    loadMonthlySummary();
  }, [currentMonth.month, currentMonth.year]);

  return {
    ...monthlyBalance,
    currentMonth,
    isLoading,
    setMonth,
    refresh: loadMonthlySummary,
  };
}
