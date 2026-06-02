import { useEffect, useMemo } from 'react';
import { useTransactionStore } from '@/stores/useTransactionStore';
import type { DateRange, TransactionWithCategory } from '@/types';

type GroupedTransactions = {
  date: string; // YYYY-MM-DD
  displayDate: string; // วัน เดือน ปี (ไทย)
  data: TransactionWithCategory[];
  totalIncome: number;
  totalExpense: number;
};

const THAI_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

const THAI_DAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

function formatThaiDate(date: Date): string {
  const day = THAI_DAYS[date.getDay()];
  const d = date.getDate();
  const month = THAI_MONTHS[date.getMonth()];
  const year = date.getFullYear() + 543; // พ.ศ.
  return `${day} ${d} ${month} ${year}`;
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function useTransactionsByDate(range: DateRange) {
  const { transactions, loadByDateRange, isLoading } = useTransactionStore();

  useEffect(() => {
    loadByDateRange(range);
  }, [range.startDate.getTime(), range.endDate.getTime()]);

  // จัดกลุ่มตามวัน
  const grouped = useMemo((): GroupedTransactions[] => {
    const groups = new Map<string, TransactionWithCategory[]>();

    for (const tx of transactions) {
      const key = toDateKey(new Date(tx.date));
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(tx);
    }

    return Array.from(groups.entries())
      .sort(([a], [b]) => b.localeCompare(a)) // ล่าสุดก่อน
      .map(([dateKey, data]) => {
        const date = new Date(dateKey);
        return {
          date: dateKey,
          displayDate: formatThaiDate(date),
          data,
          totalIncome: data
            .filter((tx) => tx.type === 'income')
            .reduce((sum, tx) => sum + tx.amount, 0),
          totalExpense: data
            .filter((tx) => tx.type === 'expense')
            .reduce((sum, tx) => sum + tx.amount, 0),
        };
      });
  }, [transactions]);

  return {
    grouped,
    transactions,
    isLoading,
    refresh: () => loadByDateRange(range),
  };
}
