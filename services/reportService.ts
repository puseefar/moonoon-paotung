import { and, gte, lte, eq, sql, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { transactions, categories } from '@/db/schema';

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

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

export const reportService = {
  // สรุปรายสัปดาห์ในเดือน
  async getWeeklySummary(year: number, month: number): Promise<WeeklySummary[]> {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59);

    const result = await db
      .select({
        type: transactions.type,
        amount: transactions.amount,
        date: transactions.date,
      })
      .from(transactions)
      .where(
        and(
          gte(transactions.date, startDate),
          lte(transactions.date, endDate)
        )
      );

    // จัดกลุ่มตามสัปดาห์
    const weeks: WeeklySummary[] = [];
    const daysInMonth = endDate.getDate();
    const weekCount = Math.ceil(daysInMonth / 7);

    for (let w = 0; w < weekCount; w++) {
      const weekStart = w * 7 + 1;
      const weekEnd = Math.min((w + 1) * 7, daysInMonth);
      weeks.push({
        weekLabel: `${weekStart}-${weekEnd}`,
        income: 0,
        expense: 0,
      });
    }

    for (const row of result) {
      if (row.type === 'transfer') continue;
      const d = new Date(row.date).getDate();
      const weekIdx = Math.min(Math.floor((d - 1) / 7), weekCount - 1);
      if (row.type === 'income') weeks[weekIdx].income += row.amount;
      if (row.type === 'expense') weeks[weekIdx].expense += row.amount;
    }

    return weeks;
  },

  // แนวโน้มย้อนหลัง N เดือน (สำหรับ Line Chart)
  async getMonthlyTrend(months: number = 6): Promise<MonthlyTrend[]> {
    const now = new Date();
    const trends: MonthlyTrend[] = [];

    for (let i = months - 1; i >= 0; i--) {
      const targetMonth = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = targetMonth.getFullYear();
      const m = targetMonth.getMonth();
      const startDate = new Date(y, m, 1);
      const endDate = new Date(y, m + 1, 0, 23, 59, 59);

      const result = await db
        .select({
          type: transactions.type,
          total: sql<number>`SUM(${transactions.amount})`,
        })
        .from(transactions)
        .where(
          and(
            gte(transactions.date, startDate),
            lte(transactions.date, endDate)
          )
        )
        .groupBy(transactions.type);

      let income = 0;
      let expense = 0;
      for (const row of result) {
        if (row.type === 'income') income = row.total ?? 0;
        if (row.type === 'expense') expense = row.total ?? 0;
      }

      trends.push({
        month: m,
        year: y,
        label: THAI_MONTHS_SHORT[m],
        income,
        expense,
      });
    }

    return trends;
  },

  // สรุปตามหมวดหมู่ (Pie Chart)
  async getCategoryBreakdown(
    year: number,
    month: number,
    type: 'income' | 'expense'
  ): Promise<CategoryBreakdown[]> {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59);

    const result = await db
      .select({
        categoryId: transactions.categoryId,
        categoryName: categories.name,
        categoryIcon: categories.icon,
        categoryColor: categories.color,
        total: sql<number>`SUM(${transactions.amount})`,
        count: sql<number>`COUNT(*)`,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(
        and(
          gte(transactions.date, startDate),
          lte(transactions.date, endDate),
          eq(transactions.type, type)
        )
      )
      .groupBy(transactions.categoryId)
      .orderBy(sql`SUM(${transactions.amount}) DESC`);

    const grandTotal = result.reduce((sum, r) => sum + (r.total ?? 0), 0);

    return result.map((r) => ({
      categoryId: r.categoryId ?? '',
      categoryName: r.categoryName ?? 'อื่นๆ',
      categoryIcon: r.categoryIcon ?? '📦',
      categoryColor: r.categoryColor ?? '#607D8B',
      total: r.total ?? 0,
      percentage: grandTotal > 0 ? ((r.total ?? 0) / grandTotal) * 100 : 0,
      count: r.count ?? 0,
    }));
  },

  // ภาพรวมทั้งหมด (ไม่จำกัดช่วงเวลา)
  async getAllTimeReport() {
    const result = await db
      .select({
        type: transactions.type,
        total: sql<number>`SUM(${transactions.amount})`,
        count: sql<number>`COUNT(*)`,
      })
      .from(transactions)
      .groupBy(transactions.type);

    let income = 0, expense = 0, transactionCount = 0;
    for (const r of result) {
      if (r.type === 'income') { income = Number(r.total ?? 0); transactionCount += Number(r.count ?? 0); }
      if (r.type === 'expense') { expense = Number(r.total ?? 0); transactionCount += Number(r.count ?? 0); }
    }

    return { income, expense, balance: income - expense, transactionCount };
  },

  // สรุปรายเดือนเต็ม (สำหรับหน้ารายงาน)
  async getMonthlyReport(year: number, month: number) {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59);

    // prev month for comparison
    const prevStartDate = new Date(year, month - 1, 1);
    const prevEndDate = new Date(year, month, 0, 23, 59, 59);

    const [currentResult, prevResult, txCount] = await Promise.all([
      // Current month totals
      db
        .select({
          type: transactions.type,
          total: sql<number>`SUM(${transactions.amount})`,
        })
        .from(transactions)
        .where(and(gte(transactions.date, startDate), lte(transactions.date, endDate)))
        .groupBy(transactions.type),

      // Prev month totals
      db
        .select({
          type: transactions.type,
          total: sql<number>`SUM(${transactions.amount})`,
        })
        .from(transactions)
        .where(and(gte(transactions.date, prevStartDate), lte(transactions.date, prevEndDate)))
        .groupBy(transactions.type),

      // Transaction count
      db
        .select({ count: sql<number>`COUNT(*)` })
        .from(transactions)
        .where(and(gte(transactions.date, startDate), lte(transactions.date, endDate))),
    ]);

    let income = 0, expense = 0, prevIncome = 0, prevExpense = 0;
    for (const r of currentResult) {
      if (r.type === 'income') income = r.total ?? 0;
      if (r.type === 'expense') expense = r.total ?? 0;
    }
    for (const r of prevResult) {
      if (r.type === 'income') prevIncome = r.total ?? 0;
      if (r.type === 'expense') prevExpense = r.total ?? 0;
    }

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysPassed = month === new Date().getMonth() && year === new Date().getFullYear()
      ? new Date().getDate()
      : daysInMonth;

    return {
      income,
      expense,
      balance: income - expense,
      prevIncome,
      prevExpense,
      incomeChange: prevIncome > 0 ? ((income - prevIncome) / prevIncome) * 100 : 0,
      expenseChange: prevExpense > 0 ? ((expense - prevExpense) / prevExpense) * 100 : 0,
      dailyAverage: daysPassed > 0 ? expense / daysPassed : 0,
      transactionCount: txCount[0]?.count ?? 0,
      daysInMonth,
    };
  },
};
