import { and, desc, eq, gte, like, lte, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { categories, transactions, walletActivityLogs, wallets } from '@/db/schema';
import type { NewTransaction } from '@/db/schema';
import type { CategorySummary, DateRange, TransactionWithCategory } from '@/types';
import { generateId } from '@/lib/uuid';

export const transactionService = {
  async create(data: Omit<NewTransaction, 'id' | 'createdAt' | 'updatedAt'>) {
    const now = new Date();
    const id = generateId();

    await db.insert(transactions).values({
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    });

    if (data.type === 'expense') {
      await db
        .update(wallets)
        .set({ balance: sql`${wallets.balance} - ${data.amount}`, updatedAt: now })
        .where(eq(wallets.id, data.walletId));
    } else if (data.type === 'income') {
      await db
        .update(wallets)
        .set({ balance: sql`${wallets.balance} + ${data.amount}`, updatedAt: now })
        .where(eq(wallets.id, data.walletId));
    } else if (data.type === 'transfer' && data.toWalletId) {
      await db
        .update(wallets)
        .set({ balance: sql`${wallets.balance} - ${data.amount}`, updatedAt: now })
        .where(eq(wallets.id, data.walletId));
      await db
        .update(wallets)
        .set({ balance: sql`${wallets.balance} + ${data.amount}`, updatedAt: now })
        .where(eq(wallets.id, data.toWalletId));
    }

    return id;
  },

  async getById(id: string) {
    const result = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
    return result[0] ?? null;
  },

  async getByDateRange(range: DateRange): Promise<TransactionWithCategory[]> {
    const result = await db
      .select({
        id: transactions.id,
        amount: transactions.amount,
        type: transactions.type,
        categoryId: transactions.categoryId,
        categoryName: categories.name,
        categoryIcon: categories.icon,
        categoryColor: categories.color,
        walletId: transactions.walletId,
        walletName: wallets.name,
        toWalletId: transactions.toWalletId,
        note: transactions.note,
        date: transactions.date,
        createdAt: transactions.createdAt,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .leftJoin(wallets, eq(transactions.walletId, wallets.id))
      .where(and(gte(transactions.date, range.startDate), lte(transactions.date, range.endDate)))
      .orderBy(desc(transactions.date));

    return result as TransactionWithCategory[];
  },

  async getRecent(limit = 5): Promise<TransactionWithCategory[]> {
    const result = await db
      .select({
        id: transactions.id,
        amount: transactions.amount,
        type: transactions.type,
        categoryId: transactions.categoryId,
        categoryName: categories.name,
        categoryIcon: categories.icon,
        categoryColor: categories.color,
        walletId: transactions.walletId,
        walletName: wallets.name,
        toWalletId: transactions.toWalletId,
        note: transactions.note,
        date: transactions.date,
        createdAt: transactions.createdAt,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .leftJoin(wallets, eq(transactions.walletId, wallets.id))
      .orderBy(desc(transactions.date))
      .limit(limit);

    return result as TransactionWithCategory[];
  },

  async searchByNote(keyword: string) {
    return db
      .select()
      .from(transactions)
      .where(like(transactions.note, `%${keyword}%`))
      .orderBy(desc(transactions.date));
  },

  async getMonthlyBalance(year: number, month: number) {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59);

    const result = await db
      .select({
        type: transactions.type,
        total: sql<number>`SUM(${transactions.amount})`,
      })
      .from(transactions)
      .where(and(gte(transactions.date, startDate), lte(transactions.date, endDate)))
      .groupBy(transactions.type);

    let totalIncome = 0;
    let totalExpense = 0;

    for (const row of result) {
      if (row.type === 'income') totalIncome = row.total ?? 0;
      if (row.type === 'expense') totalExpense = row.total ?? 0;
    }

    return {
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
    };
  },

  async getCategorySummary(
    year: number,
    month: number,
    type: 'income' | 'expense'
  ): Promise<CategorySummary[]> {
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
        and(gte(transactions.date, startDate), lte(transactions.date, endDate), eq(transactions.type, type))
      )
      .groupBy(transactions.categoryId)
      .orderBy(sql`SUM(${transactions.amount}) DESC`);

    const grandTotal = result.reduce((sum, row) => sum + (row.total ?? 0), 0);

    return result.map((row) => ({
      categoryId: row.categoryId ?? '',
      categoryName: row.categoryName ?? 'ไม่มีหมวดหมู่',
      categoryIcon: row.categoryIcon ?? '🧾',
      categoryColor: row.categoryColor ?? '#607D8B',
      total: row.total ?? 0,
      percentage: grandTotal > 0 ? ((row.total ?? 0) / grandTotal) * 100 : 0,
      count: row.count ?? 0,
    }));
  },

  async update(id: string, data: Partial<Omit<NewTransaction, 'id' | 'createdAt'>>) {
    await db
      .update(transactions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(transactions.id, id));
  },

  async delete(id: string) {
    const tx = await this.getById(id);
    if (!tx) return;

    const now = new Date();
    const sourceWalletResult = await db
      .select()
      .from(wallets)
      .where(eq(wallets.id, tx.walletId))
      .limit(1);
    const fromWallet = sourceWalletResult[0] ?? null;
    const targetWalletResult = tx.toWalletId
      ? await db.select().from(wallets).where(eq(wallets.id, tx.toWalletId)).limit(1)
      : [];
    const toWallet = targetWalletResult[0] ?? null;

    if (tx.type === 'expense') {
      if (fromWallet) {
        await db.insert(walletActivityLogs).values({
          id: generateId(),
          walletId: tx.walletId,
          relatedTransactionId: tx.id,
          actionType: 'deleted',
          transactionType: tx.type,
          categoryId: tx.categoryId ?? null,
          counterpartyWalletId: null,
          amount: tx.amount,
          balanceBefore: fromWallet.balance ?? 0,
          balanceAfter: (fromWallet.balance ?? 0) + tx.amount,
          note: tx.note ?? null,
          createdAt: now,
        });
      }

      await db
        .update(wallets)
        .set({ balance: sql`${wallets.balance} + ${tx.amount}`, updatedAt: now })
        .where(eq(wallets.id, tx.walletId));
    } else if (tx.type === 'income') {
      if (fromWallet) {
        await db.insert(walletActivityLogs).values({
          id: generateId(),
          walletId: tx.walletId,
          relatedTransactionId: tx.id,
          actionType: 'deleted',
          transactionType: tx.type,
          categoryId: tx.categoryId ?? null,
          counterpartyWalletId: null,
          amount: tx.amount,
          balanceBefore: fromWallet.balance ?? 0,
          balanceAfter: (fromWallet.balance ?? 0) - tx.amount,
          note: tx.note ?? null,
          createdAt: now,
        });
      }

      await db
        .update(wallets)
        .set({ balance: sql`${wallets.balance} - ${tx.amount}`, updatedAt: now })
        .where(eq(wallets.id, tx.walletId));
    } else if (tx.type === 'transfer' && tx.toWalletId) {
      if (fromWallet) {
        await db.insert(walletActivityLogs).values({
          id: generateId(),
          walletId: tx.walletId,
          relatedTransactionId: tx.id,
          actionType: 'deleted',
          transactionType: tx.type,
          categoryId: tx.categoryId ?? null,
          counterpartyWalletId: tx.toWalletId,
          amount: tx.amount,
          balanceBefore: fromWallet.balance ?? 0,
          balanceAfter: (fromWallet.balance ?? 0) + tx.amount,
          note: tx.note ?? null,
          createdAt: now,
        });
      }

      if (toWallet) {
        await db.insert(walletActivityLogs).values({
          id: generateId(),
          walletId: tx.toWalletId,
          relatedTransactionId: tx.id,
          actionType: 'deleted',
          transactionType: tx.type,
          categoryId: tx.categoryId ?? null,
          counterpartyWalletId: tx.walletId,
          amount: tx.amount,
          balanceBefore: toWallet.balance ?? 0,
          balanceAfter: (toWallet.balance ?? 0) - tx.amount,
          note: tx.note ?? null,
          createdAt: now,
        });
      }

      await db
        .update(wallets)
        .set({ balance: sql`${wallets.balance} + ${tx.amount}`, updatedAt: now })
        .where(eq(wallets.id, tx.walletId));
      await db
        .update(wallets)
        .set({ balance: sql`${wallets.balance} - ${tx.amount}`, updatedAt: now })
        .where(eq(wallets.id, tx.toWalletId));
    }

    await db.delete(transactions).where(eq(transactions.id, id));
  },
};
