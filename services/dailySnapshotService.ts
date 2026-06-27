import { and, asc, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { categories, recurringRules, transactions } from '@/db/schema';
import { financeSummaryService, formatHealthMessage } from './financeSummaryService';
import type { FinancialHealth } from './financeSummaryService';
import { getMonthRange, getThaiDateParts, getTodayRange } from '@/lib/time';

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
  // Phase 2 — การเล่าเรื่อง (§4.2 / §4.3 / §5.1)
  health: FinancialHealth;
  healthMessage: string;
  monthNarrative: string;
  uncategorizedCount: number;
  uncategorizedTotal: number;
};

type InsightInput = Pick<DailySnapshot, 'todayExpense' | 'monthBalance' | 'topExpenseCategory'>;

function buildInsight(snapshot: InsightInput): string {
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
    // Phase 1 — ใช้ขอบเขตเวลาไทยกลาง + ดึง cashflow จาก financeSummaryService
    const { startDate: todayStart, endDate: todayEnd } = getTodayRange(date);
    const { month: thaiMonth, year: thaiYear, day: thaiDay } = getThaiDateParts(date);
    const { startDate: monthStart, endDate: monthEnd } = getMonthRange(thaiYear, thaiMonth);
    const upcomingEnd = new Date(todayStart.getTime() + 8 * 24 * 3_600_000 - 1); // +7 วันเต็ม

    const [
      today,
      month,
      health,
      monthNarrative,
      uncategorized,
      todayCountResult,
      topCategoryResult,
      upcomingResult,
    ] = await Promise.all([
      financeSummaryService.getTodaySummary(date),
      financeSummaryService.getMonthlySummary(thaiMonth, thaiYear),
      financeSummaryService.getFinancialHealth(thaiMonth, thaiYear),
      financeSummaryService.getMonthNarrative(thaiMonth, thaiYear),
      financeSummaryService.getUncategorizedSummary(thaiMonth, thaiYear),
      // นับ "กิจกรรม" วันนี้ = เฉพาะ income/expense (ไม่รวม opening/transfer)
      db
        .select({ count: sql<number>`COUNT(*)` })
        .from(transactions)
        .where(
          and(
            gte(transactions.date, todayStart),
            lte(transactions.date, todayEnd),
            sql`${transactions.type} IN ('income','expense')`
          )
        ),
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

    const todayIncome = today.income;
    const todayExpense = today.expense;
    const transactionCountToday = Number(todayCountResult[0]?.count ?? 0);
    const monthIncome = month.income;
    const monthExpense = month.expense;

    const daysPassed = thaiDay;
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
            name: topCategoryResult[0].categoryName ?? 'อื่นๆ',
            icon: topCategoryResult[0].categoryIcon ?? '📦',
            amount: topCategoryResult[0].total ?? 0,
          }
        : null,
      upcomingRecurring: upcomingResult[0] ?? null,
    };

    return {
      ...snapshotWithoutInsight,
      insight: buildInsight(snapshotWithoutInsight),
      health,
      healthMessage: formatHealthMessage(health),
      monthNarrative,
      uncategorizedCount: uncategorized.count,
      uncategorizedTotal: uncategorized.total,
    };
  },
};
