import { eq, and, gte, lte, or, lt, desc, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { bills, transactions, wallets, categories } from '@/db/schema';
import type { NewBill } from '@/db/schema';
import { generateId } from '@/lib/uuid';

// ============================================================
// Types
// ============================================================
export type BillStatus = 'pending' | 'paid' | 'overdue';

export interface BillWithMeta {
  id: string;
  name: string;
  amount: number;
  dueDate: Date;
  status: BillStatus;
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  walletId: string | null;
  note: string | null;
  paidAt: Date | null;
  paidAmount: number | null;
  daysUntilDue: number; // negative = overdue
  isUrgent: boolean;    // due within 3 days
}

export interface MonthlyBillSummary {
  totalDue: number;
  totalPaid: number;
  totalPending: number;
  totalOverdue: number;
  countPending: number;
  countPaid: number;
  countOverdue: number;
  walletBalance: number;
  isSufficient: boolean;        // balance >= totalPending
  shortfall: number;            // totalPending - balance (if insufficient)
}

// ============================================================
// Helpers
// ============================================================
function calcDaysUntilDue(dueDate: Date): number {
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueMidnight = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  return Math.round((dueMidnight.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));
}

function autoStatus(bill: { status: string | null; dueDate: Date; paidAt: Date | null }): BillStatus {
  if (bill.paidAt || bill.status === 'paid') return 'paid';
  const days = calcDaysUntilDue(bill.dueDate);
  if (days < 0) return 'overdue';
  return 'pending';
}

// ============================================================
// Service
// ============================================================
export const billService = {
  // ── CRUD ──────────────────────────────────────────────────
  async create(data: Omit<NewBill, 'id' | 'createdAt' | 'updatedAt'>) {
    const now = new Date();
    const id = generateId();
    await db.insert(bills).values({ ...data, id, createdAt: now, updatedAt: now });
    return id;
  },

  async update(id: string, data: Partial<Omit<NewBill, 'id' | 'createdAt'>>) {
    await db.update(bills).set({ ...data, updatedAt: new Date() }).where(eq(bills.id, id));
  },

  async delete(id: string) {
    await db.delete(bills).where(eq(bills.id, id));
  },

  // ── Queries ────────────────────────────────────────────────
  async getAll(): Promise<BillWithMeta[]> {
    const rows = await db
      .select({
        b: bills,
        catName: categories.name,
        catIcon: categories.icon,
      })
      .from(bills)
      .leftJoin(categories, eq(bills.categoryId, categories.id))
      .orderBy(bills.dueDate);

    return rows.map(({ b, catName, catIcon }) => {
      const dueDate = b.dueDate as Date;
      const days = calcDaysUntilDue(dueDate);
      return {
        id: b.id,
        name: b.name,
        amount: b.amount,
        dueDate,
        status: autoStatus({ status: b.status, dueDate, paidAt: b.paidAt as Date | null }),
        categoryId: b.categoryId,
        categoryName: catName ?? null,
        categoryIcon: catIcon ?? null,
        walletId: b.walletId,
        note: b.note,
        paidAt: b.paidAt as Date | null,
        paidAmount: b.paidAmount,
        daysUntilDue: days,
        isUrgent: days >= 0 && days <= 3,
      };
    });
  },

  async getByMonth(year: number, month: number): Promise<BillWithMeta[]> {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    const all = await this.getAll();
    // Always include overdue bills from any month — they should never be hidden
    return all.filter(
      (b) => b.status === 'overdue' || (b.dueDate >= start && b.dueDate <= end)
    );
  },

  async getAllUnpaid(): Promise<BillWithMeta[]> {
    const all = await this.getAll();
    return all.filter((b) => b.status !== 'paid');
  },

  async getUpcoming(days: number = 7): Promise<BillWithMeta[]> {
    const all = await this.getAll();
    return all.filter((b) => b.status !== 'paid' && b.daysUntilDue >= 0 && b.daysUntilDue <= days);
  },

  async getOverdue(): Promise<BillWithMeta[]> {
    const all = await this.getAll();
    return all.filter((b) => b.status === 'overdue');
  },

  // ── Mark as Paid ───────────────────────────────────────────
  async markAsPaid(
    billId: string,
    options: { createTransaction: boolean; walletId?: string; paidAmount?: number }
  ) {
    const bill = await db.select().from(bills).where(eq(bills.id, billId)).limit(1);
    if (!bill[0]) throw new Error('ไม่พบบิล');
    const b = bill[0];
    const now = new Date();
    const actual = options.paidAmount ?? b.amount;

    let txId: string | null = null;
    if (options.createTransaction && options.walletId) {
      txId = generateId();
      await db.insert(transactions).values({
        id: txId,
        amount: actual,
        type: 'expense',
        categoryId: b.categoryId,
        walletId: options.walletId,
        note: `จ่ายบิล: ${b.name}`,
        date: now,
        isRecurring: false,
        createdAt: now,
        updatedAt: now,
      });
      await db
        .update(wallets)
        .set({ balance: sql`${wallets.balance} - ${actual}`, updatedAt: now })
        .where(eq(wallets.id, options.walletId));
    }

    await db.update(bills).set({
      status: 'paid',
      paidAt: now,
      paidAmount: actual,
      paidTransactionId: txId,
      updatedAt: now,
    }).where(eq(bills.id, billId));
  },

  // ── Monthly Summary + "ขาด/พอ" ────────────────────────────
  async getMonthlySummary(year: number, month: number, primaryWalletId?: string): Promise<MonthlyBillSummary> {
    const monthBills = await this.getByMonth(year, month);

    let totalDue = 0, totalPaid = 0, totalPending = 0, totalOverdue = 0;
    let countPending = 0, countPaid = 0, countOverdue = 0;

    for (const b of monthBills) {
      totalDue += b.amount;
      if (b.status === 'paid') { totalPaid += b.paidAmount ?? b.amount; countPaid++; }
      else if (b.status === 'overdue') { totalOverdue += b.amount; countOverdue++; }
      else { totalPending += b.amount; countPending++; }
    }

    // ดึงยอดกระเป๋าหลัก
    let walletBalance = 0;
    if (primaryWalletId) {
      const w = await db.select({ balance: wallets.balance }).from(wallets).where(eq(wallets.id, primaryWalletId)).limit(1);
      walletBalance = w[0]?.balance ?? 0;
    } else {
      const allW = await db.select({ balance: wallets.balance }).from(wallets).where(eq(wallets.isActive, true));
      walletBalance = allW.reduce((s, w) => s + (w.balance ?? 0), 0);
    }

    const needToPay = totalPending + totalOverdue;
    return {
      totalDue,
      totalPaid,
      totalPending,
      totalOverdue,
      countPending,
      countPaid,
      countOverdue,
      walletBalance,
      isSufficient: walletBalance >= needToPay,
      shortfall: Math.max(needToPay - walletBalance, 0),
    };
  },
};
