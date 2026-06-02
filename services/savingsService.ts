import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { savingsGoals } from '@/db/schema';
import type { NewSavingsGoal } from '@/db/schema';
import { generateId } from '@/lib/uuid';

export const savingsService = {
  async getAll() {
    return db.select().from(savingsGoals).orderBy(savingsGoals.createdAt);
  },

  async getActive() {
    return db
      .select()
      .from(savingsGoals)
      .where(eq(savingsGoals.isCompleted, false))
      .orderBy(savingsGoals.deadline);
  },

  async getById(id: string) {
    const result = await db.select().from(savingsGoals).where(eq(savingsGoals.id, id)).limit(1);
    return result[0] ?? null;
  },

  async create(data: Omit<NewSavingsGoal, 'id' | 'createdAt' | 'updatedAt'>) {
    const now = new Date();
    const id = generateId();
    await db.insert(savingsGoals).values({
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },

  async addAmount(id: string, amount: number) {
    const goal = await this.getById(id);
    if (!goal) return;

    const newAmount = (goal.currentAmount ?? 0) + amount;
    const isCompleted = newAmount >= goal.targetAmount;

    await db
      .update(savingsGoals)
      .set({
        currentAmount: newAmount,
        isCompleted,
        updatedAt: new Date(),
      })
      .where(eq(savingsGoals.id, id));

    return { newAmount, isCompleted };
  },

  async update(id: string, data: Partial<Omit<NewSavingsGoal, 'id' | 'createdAt'>>) {
    await db
      .update(savingsGoals)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(savingsGoals.id, id));
  },

  async delete(id: string) {
    await db.delete(savingsGoals).where(eq(savingsGoals.id, id));
  },
};
