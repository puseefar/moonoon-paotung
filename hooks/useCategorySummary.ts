import { useEffect } from 'react';
import { useSummaryStore } from '@/stores/useSummaryStore';
import type { MonthYear } from '@/types';

export function useCategorySummary(monthYear?: MonthYear) {
  const {
    expenseSummary,
    incomeSummary,
    currentMonth,
    setMonth,
    loadCategorySummary,
    isLoading,
  } = useSummaryStore();

  useEffect(() => {
    if (monthYear) {
      setMonth(monthYear);
    }
  }, [monthYear?.month, monthYear?.year]);

  useEffect(() => {
    loadCategorySummary();
  }, [currentMonth.month, currentMonth.year]);

  return {
    expenseSummary,
    incomeSummary,
    currentMonth,
    isLoading,
    refresh: loadCategorySummary,
  };
}
