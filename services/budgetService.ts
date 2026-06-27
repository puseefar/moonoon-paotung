import { eq, and, gte, lte, sum } from 'drizzle-orm';
import { db } from '@/db/client';
import { budgets, budgetCategories, transactions, categories } from '@/db/schema';
import { generateId } from '@/lib/uuid';

// ============================================================
// Types
// ============================================================
export type AllocationRule = '50-30-20' | 'daily-allowance' | 'envelope' | 'custom';

export type PersonaId = 'office' | 'government' | 'housewife' | 'trader' | 'general';

export interface PersonaTemplate {
  id: PersonaId;
  name: string;
  icon: string;
  description: string;
  categoryDistribution: Record<string, number>; // categoryName → % of income
}

export interface BudgetCategoryProgress {
  id: string;
  budgetId: string;
  categoryId: string | null;
  categoryName: string;
  categoryIcon: string;
  allocatedAmount: number;
  spentAmount: number;
  remainingAmount: number;
  percentUsed: number;
  isOverBudget: boolean;
  isWarning: boolean; // ≥ 80%
}

export interface BudgetProgress {
  yearMonth: string;
  budgetId: string | null;
  totalPlannedIncome: number;
  totalAllocated: number;
  totalSpent: number;
  totalBudgetedSpent: number; // spent in categories that have a budget entry
  unbudgetedSpent: number;    // spent in categories/transactions outside the budget plan
  totalRemaining: number;
  allocationRule: AllocationRule;
  categories: BudgetCategoryProgress[];
  forecast: MonthEndForecast;
}

export interface MonthEndForecast {
  dailyAvgSpend: number;
  daysElapsed: number;
  daysRemaining: number;
  projectedMonthTotal: number;
  projectedBalance: number;
}

// ============================================================
// Persona Templates (rule-based, no AI)
// ============================================================
// NOTE: คีย์ของ categoryDistribution ต้อง "ตรง" กับชื่อหมวดรายจ่ายจริงใน DB (ดู db/seed.ts)
// เพื่อให้ค่าแนะนำไปลงในหมวดที่มีอยู่ ไม่สร้างแถวซ้ำ (orphan)
// เงินออมไม่ใส่เป็นหมวดที่นี่ — ส่วนที่เหลือ (รายรับ − งบที่ตั้ง) คือเงินออมโดยปริยาย
export const PERSONAS: PersonaTemplate[] = [
  {
    id: 'office',
    name: 'พนักงานออฟฟิศ',
    icon: '💼',
    description: 'เงินเดือนประจำ รายจ่ายรายเดือนคงที่',
    categoryDistribution: {
      'อาหาร/เครื่องดื่ม': 25,
      'เดินทาง/น้ำมัน': 15,
      'ที่อยู่อาศัย/ค่าเช่า': 20,
      'ช้อปปิ้ง': 10,
      'บันเทิง': 5,
      'สุขภาพ/ยา': 5,
    },
  },
  {
    id: 'government',
    name: 'ข้าราชการ',
    icon: '🏛️',
    description: 'เงินเดือนราชการ มีค่าใช้จ่ายเบิกได้',
    categoryDistribution: {
      'อาหาร/เครื่องดื่ม': 25,
      'เดินทาง/น้ำมัน': 10,
      'ที่อยู่อาศัย/ค่าเช่า': 20,
      'การศึกษา': 10,
      'สุขภาพ/ยา': 5,
      'ช้อปปิ้ง': 10,
    },
  },
  {
    id: 'housewife',
    name: 'แม่บ้าน',
    icon: '🏠',
    description: 'ดูแลค่าใช้จ่ายในบ้าน งบจ่ายตลาด',
    categoryDistribution: {
      'อาหาร/เครื่องดื่ม': 35,
      'ที่อยู่อาศัย/ค่าเช่า': 20,
      'ช้อปปิ้ง': 15,
      'สุขภาพ/ยา': 10,
      'เดินทาง/น้ำมัน': 10,
      'อื่นๆ': 10,
    },
  },
  {
    id: 'trader',
    name: 'แม่ค้า/พ่อค้า',
    icon: '🛒',
    description: 'ค้าขาย รายได้ไม่แน่นอน มีต้นทุนสินค้า',
    categoryDistribution: {
      'ประกอบธุรกิจ': 40,
      'อาหาร/เครื่องดื่ม': 20,
      'เดินทาง/น้ำมัน': 10,
      'ที่อยู่อาศัย/ค่าเช่า': 15,
    },
  },
  {
    id: 'general',
    name: 'บุคคลทั่วไป',
    icon: '😊',
    description: 'ไม่มีหมวดที่ตายตัว ตั้งเองทั้งหมด',
    categoryDistribution: {
      'อาหาร/เครื่องดื่ม': 30,
      'เดินทาง/น้ำมัน': 15,
      'ที่อยู่อาศัย/ค่าเช่า': 20,
      'บันเทิง': 10,
      'ช้อปปิ้ง': 10,
    },
  },
];

// ============================================================
// Helpers
// ============================================================
function toYearMonth(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function parseYearMonth(ym: string): { year: number; month: number } {
  const [y, m] = ym.split('-').map(Number);
  return { year: y, month: m - 1 };
}

function getMonthRange(ym: string): { start: Date; end: Date } {
  const { year, month } = parseYearMonth(ym);
  return {
    start: new Date(year, month, 1),
    end: new Date(year, month + 1, 0, 23, 59, 59, 999),
  };
}

function calcForecast(
  totalSpent: number,
  yearMonth: string,
  totalPlannedIncome: number
): MonthEndForecast {
  const { year, month } = parseYearMonth(yearMonth);
  const now = new Date();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const isCurrentMonth =
    now.getFullYear() === year && now.getMonth() === month;

  const daysElapsed = isCurrentMonth
    ? Math.max(now.getDate(), 1)
    : daysInMonth;
  const daysRemaining = isCurrentMonth
    ? Math.max(daysInMonth - now.getDate(), 0)
    : 0;

  const dailyAvgSpend = daysElapsed > 0 ? totalSpent / daysElapsed : 0;
  const projectedMonthTotal = dailyAvgSpend * daysInMonth;
  const projectedBalance = totalPlannedIncome - projectedMonthTotal;

  return {
    dailyAvgSpend,
    daysElapsed,
    daysRemaining,
    projectedMonthTotal,
    projectedBalance,
  };
}

// ============================================================
// Service
// ============================================================
export const budgetService = {
  // ดึง budget สำหรับเดือนที่กำหนด (null = ยังไม่ตั้งงบ)
  async getBudget(yearMonth: string) {
    const rows = await db
      .select()
      .from(budgets)
      .where(eq(budgets.yearMonth, yearMonth))
      .limit(1);
    return rows[0] ?? null;
  },

  // สร้าง budget ใหม่ (ถ้ายังไม่มี)
  async createBudget(
    yearMonth: string,
    totalPlannedIncome: number,
    allocationRule: AllocationRule = 'custom'
  ) {
    const existing = await this.getBudget(yearMonth);
    if (existing) return existing;

    const now = new Date();
    const id = generateId();
    await db.insert(budgets).values({
      id,
      yearMonth,
      totalPlannedIncome,
      allocationRule,
      createdAt: now,
      updatedAt: now,
    });
    return (await this.getBudget(yearMonth))!;
  },

  // อัพเดท income + allocation rule
  async updateBudget(
    budgetId: string,
    data: { totalPlannedIncome?: number; allocationRule?: AllocationRule }
  ) {
    await db
      .update(budgets)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(budgets.id, budgetId));
  },

  // ดึง budget_categories ของ budget
  async getBudgetCategories(budgetId: string) {
    return db
      .select()
      .from(budgetCategories)
      .where(eq(budgetCategories.budgetId, budgetId));
  },

  // บันทึก category budgets ทั้งหมด (replace)
  async saveBudgetCategories(
    budgetId: string,
    items: { categoryId: string | null; categoryName: string; categoryIcon: string; allocatedAmount: number }[]
  ) {
    await db.delete(budgetCategories).where(eq(budgetCategories.budgetId, budgetId));
    if (items.length === 0) return;

    const now = new Date();
    await db.insert(budgetCategories).values(
      items.map((item) => ({
        id: generateId(),
        budgetId,
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        allocatedAmount: item.allocatedAmount,
        createdAt: now,
        updatedAt: now,
      }))
    );
  },

  // ============================================================
  // Main: ดึง progress ทั้งหมดสำหรับเดือน
  // ============================================================
  async getBudgetProgress(yearMonth: string): Promise<BudgetProgress> {
    const budget = await this.getBudget(yearMonth);
    const { start, end } = getMonthRange(yearMonth);

    // ดึง transactions ของเดือนนี้ (expense เท่านั้น) แยกตาม category
    const txRows = await db
      .select({
        categoryId: transactions.categoryId,
        total: sum(transactions.amount),
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.type, 'expense'),
          gte(transactions.date, start),
          lte(transactions.date, end)
        )
      )
      .groupBy(transactions.categoryId);

    const spentByCategory: Record<string, number> = {};
    let totalSpent = 0;
    for (const row of txRows) {
      const spent = Number(row.total ?? 0);
      if (row.categoryId) spentByCategory[row.categoryId] = spent;
      totalSpent += spent;
    }

    if (!budget) {
      return {
        yearMonth,
        budgetId: null,
        totalPlannedIncome: 0,
        totalAllocated: 0,
        totalSpent,
        totalBudgetedSpent: 0,
        unbudgetedSpent: totalSpent,
        totalRemaining: -totalSpent,
        allocationRule: 'custom',
        categories: [],
        forecast: calcForecast(totalSpent, yearMonth, 0),
      };
    }

    const budgetCats = await this.getBudgetCategories(budget.id);

    // ดึง category icons จาก categories table
    const catIds = budgetCats
      .map((b) => b.categoryId)
      .filter(Boolean) as string[];
    const catRows = catIds.length > 0
      ? await db.select({ id: categories.id, icon: categories.icon }).from(categories)
      : [];
    const iconMap: Record<string, string> = {};
    for (const c of catRows) iconMap[c.id] = c.icon;

    const catProgress: BudgetCategoryProgress[] = budgetCats.map((bc) => {
      const spent = bc.categoryId ? (spentByCategory[bc.categoryId] ?? 0) : 0;
      const allocated = bc.allocatedAmount ?? 0;
      const remaining = allocated - spent;
      const pct = allocated > 0 ? (spent / allocated) * 100 : 0;
      return {
        id: bc.id,
        budgetId: bc.budgetId,
        categoryId: bc.categoryId,
        categoryName: bc.categoryName,
        categoryIcon: bc.categoryId ? (iconMap[bc.categoryId] ?? '📦') : '📦',
        allocatedAmount: allocated,
        spentAmount: spent,
        remainingAmount: remaining,
        percentUsed: pct,
        isOverBudget: pct > 100,
        isWarning: pct >= 80 && pct <= 100,
      };
    });

    const totalAllocated = catProgress.reduce((s, c) => s + c.allocatedAmount, 0);
    const totalBudgetedSpent = catProgress.reduce((s, c) => s + c.spentAmount, 0);
    const unbudgetedSpent = Math.max(totalSpent - totalBudgetedSpent, 0);
    const income = budget.totalPlannedIncome ?? 0;

    return {
      yearMonth,
      budgetId: budget.id,
      totalPlannedIncome: income,
      totalAllocated,
      totalSpent,
      totalBudgetedSpent,
      unbudgetedSpent,
      totalRemaining: income - totalSpent,
      allocationRule: (budget.allocationRule as AllocationRule) ?? 'custom',
      categories: catProgress,
      forecast: calcForecast(totalSpent, yearMonth, income),
    };
  },

  // สร้าง template จาก persona + income
  generatePersonaTemplate(
    persona: PersonaTemplate,
    income: number
  ): { categoryName: string; allocatedAmount: number }[] {
    return Object.entries(persona.categoryDistribution).map(([name, pct]) => ({
      categoryName: name,
      allocatedAmount: Math.round((income * pct) / 100),
    }));
  },

  toYearMonth,
  parseYearMonth,
};
