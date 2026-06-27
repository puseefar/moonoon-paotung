import { and, gte, lte, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { transactions } from '@/db/schema';
import { financeSummaryService } from './financeSummaryService';
import { getMonthRange, getThaiDateParts } from '@/lib/time';

// Phase 1 — reportService delegate ตัวเลขหลักไป financeSummaryService (แหล่งความจริงเดียว)
// คงรูป API เดิมไว้เพื่อให้หน้า report.tsx ไม่ต้องแก้

// สรุปรายสัปดาห์ในเดือน (สำหรับ Bar Chart)
export type WeeklySummary = {
  weekLabel: string;
  income: number;
  expense: number;
};

// แนวโน้มรายเดือน (สำหรับ Line Chart)
export type MonthlyTrend = {
  month: number;
  year: number;
  label: string;
  income: number;
  expense: number;
};

// สรุปตามหมวดหมู่ (สำหรับ Pie Chart)
export type CategoryBreakdown = {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  total: number;
  percentage: number;
  count: number;
};

export const reportService = {
  // สรุปรายสัปดาห์ในเดือน (ขอบเขตเดือน = เวลาไทย, นับเฉพาะ income/expense)
  async getWeeklySummary(year: number, month: number): Promise<WeeklySummary[]> {
    const { startDate, endDate } = getMonthRange(year, month);

    const result = await db
      .select({
        type: transactions.type,
        amount: transactions.amount,
        date: transactions.date,
      })
      .from(transactions)
      .where(and(gte(transactions.date, startDate), lte(transactions.date, endDate)));

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const weekCount = Math.ceil(daysInMonth / 7);
    const weeks: WeeklySummary[] = [];
    for (let w = 0; w < weekCount; w++) {
      const weekStart = w * 7 + 1;
      const weekEnd = Math.min((w + 1) * 7, daysInMonth);
      weeks.push({ weekLabel: `${weekStart}-${weekEnd}`, income: 0, expense: 0 });
    }

    for (const row of result) {
      if (row.type !== 'income' && row.type !== 'expense') continue; // กัน opening/transfer
      const d = getThaiDateParts(new Date(row.date)).day;
      const weekIdx = Math.min(Math.floor((d - 1) / 7), weekCount - 1);
      if (row.type === 'income') weeks[weekIdx].income += row.amount;
      else weeks[weekIdx].expense += row.amount;
    }

    return weeks;
  },

  // แนวโน้มย้อนหลัง N เดือน (delegate)
  async getMonthlyTrend(months: number = 6): Promise<MonthlyTrend[]> {
    const trend = await financeSummaryService.getCashflowTrend(months);
    return trend.map((p) => ({
      month: p.month,
      year: p.year,
      label: p.label,
      income: p.income,
      expense: p.expense,
    }));
  },

  // สรุปตามหมวดหมู่ (delegate — null แสดงรวมเป็น "อื่นๆ" ตรงกันทุกหน้า §5.2)
  async getCategoryBreakdown(
    year: number,
    month: number,
    type: 'income' | 'expense'
  ): Promise<CategoryBreakdown[]> {
    return financeSummaryService.getCategoryBreakdown(month, year, type);
  },

  // ภาพรวมทั้งหมด (delegate)
  async getAllTimeReport() {
    const { income, expense, balance, transactionCount } =
      await financeSummaryService.getAllTimeSummary();
    return { income, expense, balance, transactionCount };
  },

  // สรุปรายเดือนเต็ม (สำหรับหน้ารายงาน) — ตัวเลขหลักจาก financeSummaryService
  async getMonthlyReport(year: number, month: number) {
    const [current, prev, txCount] = await Promise.all([
      financeSummaryService.getMonthlySummary(month, year),
      financeSummaryService.getMonthlySummary(month - 1 < 0 ? 11 : month - 1, month - 1 < 0 ? year - 1 : year),
      (async () => {
        const { startDate, endDate } = getMonthRange(year, month);
        const rows = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(transactions)
          .where(
            and(
              gte(transactions.date, startDate),
              lte(transactions.date, endDate),
              sql`${transactions.type} IN ('income','expense')`
            )
          );
        return rows[0]?.count ?? 0;
      })(),
    ]);

    const { income, expense, balance } = current;
    const { income: prevIncome, expense: prevExpense } = prev;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = getThaiDateParts();
    const isCurrentMonth = month === today.month && year === today.year;
    const daysPassed = isCurrentMonth ? today.day : daysInMonth;

    return {
      income,
      expense,
      balance,
      prevIncome,
      prevExpense,
      incomeChange: prevIncome > 0 ? ((income - prevIncome) / prevIncome) * 100 : 0,
      expenseChange: prevExpense > 0 ? ((expense - prevExpense) / prevExpense) * 100 : 0,
      dailyAverage: daysPassed > 0 ? expense / daysPassed : 0,
      transactionCount: txCount,
      daysInMonth,
    };
  },
};
