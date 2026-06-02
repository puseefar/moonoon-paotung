import { eq, lte, and } from 'drizzle-orm';
import { db } from '@/db/client';
import { recurringRules, transactions, wallets } from '@/db/schema';
import type { NewRecurringRule } from '@/db/schema';
import { generateId } from '@/lib/uuid';
import { sql } from 'drizzle-orm';

export const recurringService = {
  async getAll() {
    return db.select().from(recurringRules).orderBy(recurringRules.nextDate);
  },

  async getActive() {
    return db
      .select()
      .from(recurringRules)
      .where(eq(recurringRules.isActive, true))
      .orderBy(recurringRules.nextDate);
  },

  async getById(id: string) {
    const result = await db.select().from(recurringRules).where(eq(recurringRules.id, id)).limit(1);
    return result[0] ?? null;
  },

  async create(data: Omit<NewRecurringRule, 'id' | 'createdAt'>) {
    const id = generateId();
    await db.insert(recurringRules).values({
      ...data,
      id,
      createdAt: new Date(),
    });
    return id;
  },

  async update(id: string, data: Partial<Omit<NewRecurringRule, 'id' | 'createdAt'>>) {
    await db.update(recurringRules).set(data).where(eq(recurringRules.id, id));
  },

  async delete(id: string) {
    await db.delete(recurringRules).where(eq(recurringRules.id, id));
  },

  async toggleActive(id: string, isActive: boolean) {
    await db.update(recurringRules).set({ isActive }).where(eq(recurringRules.id, id));
  },

  // คำนวณวันถัดไปตาม frequency
  calculateNextDate(currentDate: Date, frequency: string, dayOfMonth?: number | null): Date {
    const next = new Date(currentDate);
    switch (frequency) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        if (dayOfMonth) next.setDate(Math.min(dayOfMonth, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
        break;
      case 'yearly':
        next.setFullYear(next.getFullYear() + 1);
        break;
    }
    return next;
  },

  // Process overdue recurring transactions
  async processDueRecurring() {
    const now = new Date();
    const dueRules = await db
      .select()
      .from(recurringRules)
      .where(and(eq(recurringRules.isActive, true), lte(recurringRules.nextDate, now)));

    let created = 0;
    for (const rule of dueRules) {
      const txId = generateId();
      // Create transaction
      await db.insert(transactions).values({
        id: txId,
        amount: rule.amount,
        type: rule.type,
        categoryId: rule.categoryId,
        walletId: rule.walletId,
        note: rule.note,
        date: rule.nextDate,
        isRecurring: true,
        recurringId: rule.id,
        createdAt: now,
        updatedAt: now,
      });

      // Update wallet balance
      if (rule.type === 'expense') {
        await db
          .update(wallets)
          .set({ balance: sql`${wallets.balance} - ${rule.amount}`, updatedAt: now })
          .where(eq(wallets.id, rule.walletId));
      } else {
        await db
          .update(wallets)
          .set({ balance: sql`${wallets.balance} + ${rule.amount}`, updatedAt: now })
          .where(eq(wallets.id, rule.walletId));
      }

      // Update next date
      const nextDate = this.calculateNextDate(rule.nextDate, rule.frequency, rule.dayOfMonth);
      await db.update(recurringRules).set({ nextDate }).where(eq(recurringRules.id, rule.id));

      created++;
    }
    return created;
  },
};
