import type { DiaryEntry, DiaryMedia, DiaryExpense } from '@/db/schema';

export interface EntryWithRelations {
  entry: DiaryEntry;
  media: DiaryMedia[];
  expenses: DiaryExpense[];
  totalExpenses: number;
}

export function isSameDay(a: Date | number, b: Date | number): boolean {
  const da = new Date(a as number);
  const db = new Date(b as number);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}
