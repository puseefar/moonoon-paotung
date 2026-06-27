import { and, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { categories, transactions, wallets } from '@/db/schema';
import { walletService } from './walletService';
import {
  getCurrentThaiMonth,
  getMonthRange,
  getTodayRange,
  THAI_MONTHS_FULL,
  THAI_MONTHS_SHORT,
} from '@/lib/time';
import { formatCurrency } from '@/lib/format';
import type { CategorySummary } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1 §3 — financeSummaryService (ชั้น service กลาง)
//
// กฎเหล็ก: Landing / Report / Wallet / History "ห้าม" query หรือคำนวณเอง
//          ต้องผ่าน service นี้เท่านั้น → ทุกหน้าได้ตัวเลขชุดเดียวกัน
//
// ความหมาย 3 ชั้น (แยกให้ชัด):
//   1. ยอดเงินจริง (net worth)  = opening + income − expense (+โอนสุทธิ = 0)  → getWalletSummary / getNetWorthTrend
//   2. cashflow (เดือน/วัน/รวม) = income − expense เท่านั้น (ไม่รวม opening/transfer)
//   3. สุขภาพการเงิน            = การตีความ cashflow เดือนนี้ (getFinancialHealth)
// ─────────────────────────────────────────────────────────────────────────────

/** type ที่นับเป็น cashflow — opening/transfer ถูกกันออกเสมอ */
const CASHFLOW_TYPES: ('income' | 'expense')[] = ['income', 'expense'];

/**
 * Fallback ของรายการที่ยังไม่จัดหมวด (categoryId = null)
 * แสดงผลรวมเป็น "อื่นๆ" เสมอ (§5.2 ใช้ชื่อเดียวทุกหน้า) — null ภายในยังเป็นสัญญาณ "รอจัด"
 */
export const UNCATEGORIZED_NAME = 'อื่นๆ';
const UNCATEGORIZED_ICON = '📦';
const UNCATEGORIZED_COLOR = '#607D8B';

export type PeriodSummary = {
  income: number;
  expense: number;
  balance: number; // income − expense
};

export type WalletSummaryItem = {
  id: string;
  name: string;
  icon: string | null;
  balance: number;
};

export type WalletSummary = {
  wallets: WalletSummaryItem[];
  totalBalance: number;
};

export type FinancialHealthStatus = 'good' | 'warning' | 'over' | 'neutral';

export type FinancialHealth = {
  status: FinancialHealthStatus;
  income: number;
  expense: number;
  remaining: number; // income − expense
  /** expense / income (0 ถ้าไม่มีรายรับ) */
  ratio: number;
  /** % ของรายรับที่ใช้ไป (ratio × 100) */
  spentPercent: number;
  hasActivity: boolean;
};

export type CashflowPoint = {
  month: number; // 0-11
  year: number;
  label: string;
  income: number;
  expense: number;
};

export type NetWorthPoint = {
  month: number; // 0-11
  year: number;
  label: string;
  netWorth: number; // สินทรัพย์รวม ณ สิ้นเดือนนั้น (รวม opening)
};

export type UncategorizedSummary = {
  count: number;
  total: number;
};

/**
 * §4.2 — ข้อความสุขภาพการเงิน (ผูกกับเลขจริง ไม่ใช่ชมแบบไม่มีเงื่อนไข)
 * pure function — ใช้ซ้ำได้ทุกหน้า
 */
export function formatHealthMessage(h: FinancialHealth): string {
  const pct = `${h.spentPercent.toFixed(1)}%`;
  switch (h.status) {
    case 'good':
      return `สุขภาพการเงินดี ใช้ไป ${pct} ของรายรับ เหลือ ${formatCurrency(h.remaining)} บาท`;
    case 'warning':
      return `ควรเริ่มระวัง ใช้ไปแล้ว ${pct} ของรายรับเดือนนี้`;
    case 'over':
      return h.income > 0
        ? `รายจ่ายสูงกว่ารายรับ ${formatCurrency(Math.abs(h.remaining))} บาทเดือนนี้`
        : `เดือนนี้มีรายจ่าย ${formatCurrency(h.expense)} บาท โดยยังไม่มีรายรับ`;
    case 'neutral':
    default:
      return 'เดือนนี้ยังไม่มีความเคลื่อนไหว เริ่มบันทึกรายการเพื่อดูสุขภาพการเงิน';
  }
}

/** หัวข้อสั้นของสถานะสุขภาพ (สำหรับการ์ด/ป้าย) */
export function healthHeadline(status: FinancialHealthStatus): string {
  switch (status) {
    case 'good':
      return 'สุขภาพการเงินดี';
    case 'warning':
      return 'ควรเริ่มระวัง';
    case 'over':
      return 'รายจ่ายเกินรายรับ';
    case 'neutral':
    default:
      return 'ยังไม่มีความเคลื่อนไหว';
  }
}

/** รวม income/expense ในช่วงเวลา (กัน opening/transfer ออกเสมอ) */
async function cashflowInRange(startDate: Date, endDate: Date): Promise<PeriodSummary> {
  const rows = await db
    .select({
      type: transactions.type,
      total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        gte(transactions.date, startDate),
        lte(transactions.date, endDate),
        inArray(transactions.type, CASHFLOW_TYPES)
      )
    )
    .groupBy(transactions.type);

  let income = 0;
  let expense = 0;
  for (const r of rows) {
    if (r.type === 'income') income = Number(r.total ?? 0);
    else if (r.type === 'expense') expense = Number(r.total ?? 0);
  }
  return { income, expense, balance: income - expense };
}

export const financeSummaryService = {
  // ── ชั้น 1: ยอดเงินจริง ──────────────────────────────────────────────────────

  /** ยอดแต่ละกระเป๋า + ยอดรวม (มาจาก opening + ธุรกรรม ผ่าน wallet.balance ที่ reconcile แล้ว) */
  async getWalletSummary(): Promise<WalletSummary> {
    const rows = await db
      .select({
        id: wallets.id,
        name: wallets.name,
        icon: wallets.icon,
        balance: wallets.balance,
      })
      .from(wallets)
      .where(eq(wallets.isActive, true));

    const list: WalletSummaryItem[] = rows.map((w) => ({
      id: w.id,
      name: w.name,
      icon: w.icon ?? null,
      balance: w.balance ?? 0,
    }));
    const totalBalance = list.reduce((sum, w) => sum + w.balance, 0);
    return { wallets: list, totalBalance };
  },

  // ── ชั้น 2: cashflow ─────────────────────────────────────────────────────────

  /** รายรับ/รายจ่ายของ "วันนี้" (เวลาไทย) */
  async getTodaySummary(now: Date = new Date()): Promise<PeriodSummary> {
    const { startDate, endDate } = getTodayRange(now);
    return cashflowInRange(startDate, endDate);
  },

  /** รายรับ/รายจ่ายของเดือน (เดือนปฏิทินไทย, month = 0-11) */
  async getMonthlySummary(month: number, year: number): Promise<PeriodSummary> {
    const { startDate, endDate } = getMonthRange(year, month);
    return cashflowInRange(startDate, endDate);
  },

  /** รายรับ/รายจ่ายสะสมทั้งหมด (ไม่รวม opening/transfer) */
  async getAllTimeSummary(): Promise<PeriodSummary & { transactionCount: number }> {
    const rows = await db
      .select({
        type: transactions.type,
        total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(transactions)
      .where(inArray(transactions.type, CASHFLOW_TYPES))
      .groupBy(transactions.type);

    let income = 0;
    let expense = 0;
    let transactionCount = 0;
    for (const r of rows) {
      if (r.type === 'income') income = Number(r.total ?? 0);
      else if (r.type === 'expense') expense = Number(r.total ?? 0);
      transactionCount += Number(r.count ?? 0);
    }
    return { income, expense, balance: income - expense, transactionCount };
  },

  /** สรุปตามหมวดหมู่ในเดือน — null (รอจัด) แสดงรวมเป็น "อื่นๆ" ทุกหน้า (§5.2) */
  async getCategoryBreakdown(
    month: number,
    year: number,
    type: 'income' | 'expense'
  ): Promise<CategorySummary[]> {
    const { startDate, endDate } = getMonthRange(year, month);

    const rows = await db
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

    // รวม null (รอจัด) เข้ากับหมวด "อื่นๆ" จริง → ชิ้นเดียวในรายงาน (§5.2 กันชื่อซ้ำ)
    const merged = new Map<string, CategorySummary>();
    for (const r of rows) {
      const name = r.categoryName ?? UNCATEGORIZED_NAME;
      const key = name === UNCATEGORIZED_NAME ? '__other__' : r.categoryId ?? '__other__';
      const existing = merged.get(key);
      if (existing) {
        existing.total += r.total ?? 0;
        existing.count += r.count ?? 0;
      } else {
        merged.set(key, {
          categoryId: r.categoryId ?? '',
          categoryName: name,
          categoryIcon: r.categoryIcon ?? UNCATEGORIZED_ICON,
          categoryColor: r.categoryColor ?? UNCATEGORIZED_COLOR,
          total: r.total ?? 0,
          percentage: 0,
          count: r.count ?? 0,
        });
      }
    }

    const list = Array.from(merged.values()).sort((a, b) => b.total - a.total);
    const grandTotal = list.reduce((sum, c) => sum + c.total, 0);
    for (const c of list) {
      c.percentage = grandTotal > 0 ? (c.total / grandTotal) * 100 : 0;
    }
    return list;
  },

  /** แนวโน้ม cashflow ย้อนหลัง N เดือน (income/expense ต่อเดือน) */
  async getCashflowTrend(months = 6, now: Date = new Date()): Promise<CashflowPoint[]> {
    const { year: cy, month: cm } = getCurrentThaiMonth();
    const points: CashflowPoint[] = [];

    for (let i = months - 1; i >= 0; i--) {
      // ถอยจากเดือนปัจจุบัน i เดือน (จัดการ wrap ปีด้วย Date)
      const ref = new Date(cy, cm - i, 1);
      const y = ref.getFullYear();
      const m = ref.getMonth();
      const { income, expense } = await this.getMonthlySummary(m, y);
      points.push({ month: m, year: y, label: THAI_MONTHS_SHORT[m], income, expense });
    }
    return points;
  },

  // ── ชั้น 1 (เส้นแนวโน้ม): net worth — ต่างจาก cashflow เพราะ "รวม opening" ─────────

  /** เส้นสินทรัพย์รวม ณ สิ้นแต่ละเดือน (สะสม opening + income − expense, โอนสุทธิ = 0) */
  async getNetWorthTrend(months = 6): Promise<NetWorthPoint[]> {
    const { year: cy, month: cm } = getCurrentThaiMonth();
    const points: NetWorthPoint[] = [];

    for (let i = months - 1; i >= 0; i--) {
      const ref = new Date(cy, cm - i, 1);
      const y = ref.getFullYear();
      const m = ref.getMonth();
      const { endDate } = getMonthRange(y, m);

      const rows = await db
        .select({
          type: transactions.type,
          total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
        })
        .from(transactions)
        .where(lte(transactions.date, endDate))
        .groupBy(transactions.type);

      let netWorth = 0;
      for (const r of rows) {
        const amt = Number(r.total ?? 0);
        if (r.type === 'opening' || r.type === 'income' || r.type === 'transfer_in') netWorth += amt;
        else if (r.type === 'expense' || r.type === 'transfer_out') netWorth -= amt;
        // legacy transfer (แถวเดียว) net = 0 ทั้งระบบ → ไม่กระทบ
      }
      points.push({ month: m, year: y, label: THAI_MONTHS_SHORT[m], netWorth });
    }
    return points;
  },

  // ── ชั้น 3: สุขภาพการเงิน ─────────────────────────────────────────────────────

  /** ตีความสุขภาพการเงินของเดือน (logic จริง §4.2) — ข้อความ render ที่ Phase 2 */
  async getFinancialHealth(month: number, year: number): Promise<FinancialHealth> {
    const { income, expense, balance } = await this.getMonthlySummary(month, year);
    const hasActivity = income > 0 || expense > 0;
    const ratio = income > 0 ? expense / income : 0;
    const spentPercent = ratio * 100;

    let status: FinancialHealthStatus;
    if (!hasActivity) status = 'neutral';
    else if (income <= 0 && expense > 0) status = 'over'; // ใช้จ่ายโดยไม่มีรายรับเดือนนี้
    else if (ratio <= 0.6) status = 'good';
    else if (ratio <= 1) status = 'warning';
    else status = 'over';

    return {
      status,
      income,
      expense,
      remaining: balance,
      ratio,
      spentPercent,
      hasActivity,
    };
  },

  // ── Data Hygiene §5.1 ────────────────────────────────────────────────────────

  /** จำนวน + ยอดของรายการที่ยังไม่จัดหมวด (categoryId = null) ในเดือน */
  async getUncategorizedSummary(month: number, year: number): Promise<UncategorizedSummary> {
    const { startDate, endDate } = getMonthRange(year, month);
    const rows = await db
      .select({
        count: sql<number>`COUNT(*)`,
        total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
      })
      .from(transactions)
      .where(
        and(
          gte(transactions.date, startDate),
          lte(transactions.date, endDate),
          isNull(transactions.categoryId),
          inArray(transactions.type, CASHFLOW_TYPES)
        )
      );
    return { count: Number(rows[0]?.count ?? 0), total: Number(rows[0]?.total ?? 0) };
  },

  // ── §4.3 ข้อความสรุปอัตโนมัติ (ภาษาคน) ────────────────────────────────────────

  /** สรุปเดือนเป็นประโยคภาษาคน เช่น "เดือนมิถุนายน 2569 มีเงินเข้า ... รายจ่ายหลักคือ ..." */
  async getMonthNarrative(month: number, year: number): Promise<string> {
    const [{ income, expense, balance }, health, expenseBreakdown] = await Promise.all([
      this.getMonthlySummary(month, year),
      this.getFinancialHealth(month, year),
      this.getCategoryBreakdown(month, year, 'expense'),
    ]);

    const monthName = THAI_MONTHS_FULL[month] ?? THAI_MONTHS_SHORT[month];
    const buddhistYear = year + 543;

    if (!health.hasActivity) {
      return `เดือน${monthName} ${buddhistYear} ยังไม่มีรายการ เริ่มบันทึกเพื่อดูสรุปการเงิน`;
    }

    const statusWord =
      health.status === 'good'
        ? 'อยู่ในเกณฑ์ดี'
        : health.status === 'warning'
        ? 'เริ่มต้องระวังรายจ่าย'
        : health.status === 'over'
        ? 'รายจ่ายสูงกว่ารายรับ'
        : '';

    let text = `เดือน${monthName} ${buddhistYear} มีเงินเข้า ${formatCurrency(income)} ใช้ไป ${formatCurrency(
      expense
    )} เหลือ ${formatCurrency(balance)}`;
    if (statusWord) text += ` ${statusWord}`;

    const top = expenseBreakdown.slice(0, 2).filter((c) => c.total > 0);
    if (top.length > 0) {
      const parts = top.map((c) => `${c.categoryName} ${formatCurrency(c.total)}`);
      text += ` รายจ่ายหลักคือ${parts.join(' และ ')}`;
    }
    return text;
  },

  // ── Invariant ────────────────────────────────────────────────────────────────

  /** เช็ค invariant: Σ ทุก transaction === Σ wallet.balance (กัน bug เงียบ) */
  async assertReconciled() {
    return walletService.assertReconciled();
  },
};
