import { and, asc, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { categories, recurringRules, transactions } from '@/db/schema';

export type DailySnapshot = {
  todayIncome: number;
  todayExpense: number;
  monthIncome: number;
  monthExpense: number;
  monthBalance: number;
  dailyAverage: number;
  transactionCountToday: number;
  topExpenseCategory: {
    name: string;
    icon: string;
    amount: number;
  } | null;
  upcomingRecurring: {
    note: string | null;
    amount: number;
    type: 'income' | 'expense';
    nextDate: Date;
  } | null;
  insight: string;
};

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function buildInsight(snapshot: Omit<DailySnapshot, 'insight'>): string {
  if (snapshot.todayExpense === 0) {
    return 'วันนี้ยังไม่มีรายจ่าย เริ่มต้นวันได้สบาย ๆ';
  }
  if (snapshot.monthBalance < 0) {
    return 'เดือนนี้รายจ่ายมากกว่ารายรับ ลองเช็กหมวดที่ใช้เยอะเป็นพิเศษ';
  }
  if (snapshot.topExpenseCategory) {
    return `เดือนนี้ใช้กับ${snapshot.topExpenseCategory.name}มากที่สุด ลองตั้งงบหมวดนี้เป็นอันดับแรก`;
  }
  return 'ภาพรวมเดือนนี้ยังดูนิ่ง เก็บข้อมูลต่ออีกนิดเพื่อให้คำแนะนำแม่นขึ้น';
}

export const dailySnapshotService = {
  async getTodaySnapshot(date: Date = new Date()): Promise<DailySnapshot> {
    const todayStart = startOfDay(date);
    const todayEnd = endOfDay(date);
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
    const upcomingEnd = new Date(date);
    upcomingEnd.setDate(upcomingEnd.getDate() + 7);
    upcomingEnd.setHours(23, 59, 59, 999);

    const [
      todayResult,
      monthResult,
      topCategoryResult,
      upcomingResult,
    ] = await Promise.all([
      // รวมทั้ง income + expense วันนี้ เพื่อให้แสดงยอดรับ/จ่ายวันนี้ได้
      db
        .select({
          type: transactions.type,
          total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
          count: sql<number>`COUNT(*)`,
        })
        .from(transactions)
        .where(and(gte(transactions.date, todayStart), lte(transactions.date, todayEnd)))
        .groupBy(transactions.type),
      db
        .select({
          type: transactions.type,
          total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
        })
        .from(transactions)
        .where(and(gte(transactions.date, monthStart), lte(transactions.date, monthEnd)))
        .groupBy(transactions.type),
      db
        .select({
          categoryName: categories.name,
          categoryIcon: categories.icon,
          total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
        })
        .from(transactions)
        .leftJoin(categories, eq(transactions.categoryId, categories.id))
        .where(
          and(
            eq(transactions.type, 'expense'),
            gte(transactions.date, monthStart),
            lte(transactions.date, monthEnd),
          ),
        )
        .groupBy(transactions.categoryId)
        .orderBy(sql`SUM(${transactions.amount}) DESC`)
        .limit(1),
      db
        .select({
          note: recurringRules.note,
          amount: recurringRules.amount,
          type: recurringRules.type,
          nextDate: recurringRules.nextDate,
        })
        .from(recurringRules)
        .where(
          and(
            eq(recurringRules.isActive, true),
            gte(recurringRules.nextDate, todayStart),
            lte(recurringRules.nextDate, upcomingEnd),
          ),
        )
        .orderBy(asc(recurringRules.nextDate))
        .limit(1),
    ]);

    let todayIncome = 0, todayExpense = 0, transactionCountToday = 0;
    for (const row of todayResult) {
      if (row.type === 'income') todayIncome = Number(row.total ?? 0);
      if (row.type === 'expense') todayExpense = Number(row.total ?? 0);
      transactionCountToday += Number(row.count ?? 0);
    }

    let monthIncome = 0;
    let monthExpense = 0;
    for (const row of monthResult) {
      if (row.type === 'income') monthIncome = row.total ?? 0;
      if (row.type === 'expense') monthExpense = row.total ?? 0;
    }

    const daysPassed = date.getDate();
    const snapshotWithoutInsight = {
      todayIncome,
      todayExpense,
      monthIncome,
      monthExpense,
      monthBalance: monthIncome - monthExpense,
      dailyAverage: daysPassed > 0 ? monthExpense / daysPassed : 0,
      transactionCountToday,
      topExpenseCategory: topCategoryResult[0]
        ? {
            name: topCategoryResult[0].categoryName ?? 'อื่น ๆ',
            icon: topCategoryResult[0].categoryIcon ?? '📦',
            amount: topCategoryResult[0].total ?? 0,
          }
        : null,
      upcomingRecurring: upcomingResult[0] ?? null,
    };

    return {
      ...snapshotWithoutInsight,
      insight: buildInsight(snapshotWithoutInsight),
    };
  },
};
