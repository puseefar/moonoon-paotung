import { and, desc, eq, gte, like, lte, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { categories, transactions, walletActivityLogs, wallets } from '@/db/schema';
import type { NewTransaction } from '@/db/schema';
import type { CategorySummary, DateRange, TransactionWithCategory } from '@/types';
import { generateId } from '@/lib/uuid';
import { financeSummaryService } from './financeSummaryService';

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

    if (data.type === 'expense' || data.type === 'transfer_out') {
      await db
        .update(wallets)
        .set({ balance: sql`${wallets.balance} - ${data.amount}`, updatedAt: now })
        .where(eq(wallets.id, data.walletId));
    } else if (data.type === 'income' || data.type === 'transfer_in' || data.type === 'opening') {
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
        tradeGroupId: transactions.tradeGroupId,
        tradeRole: transactions.tradeRole,
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
        tradeGroupId: transactions.tradeGroupId,
        tradeRole: transactions.tradeRole,
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

  // Phase 1 — delegate ไป financeSummaryService (แหล่งความจริงเดียว + เวลาไทย)
  async getMonthlyBalance(year: number, month: number) {
    const { income, expense, balance } = await financeSummaryService.getMonthlySummary(
      month,
      year
    );
    return { totalIncome: income, totalExpense: expense, balance };
  },

  async getCategorySummary(
    year: number,
    month: number,
    type: 'income' | 'expense'
  ): Promise<CategorySummary[]> {
    return financeSummaryService.getCategoryBreakdown(month, year, type);
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

    // Phase 0 — โอนแบบคู่ entry: ลบทั้ง 2 ขา (ผ่าน transferGroupId) และคืนยอดทั้งสองกระเป๋า
    if ((tx.type === 'transfer_out' || tx.type === 'transfer_in') && tx.transferGroupId) {
      const legs = await db
        .select()
        .from(transactions)
        .where(eq(transactions.transferGroupId, tx.transferGroupId));

      for (const leg of legs) {
        const legWallet = (
          await db.select().from(wallets).where(eq(wallets.id, leg.walletId)).limit(1)
        )[0];
        // transfer_out เคยหัก → คืน +, transfer_in เคยเพิ่ม → คืน −
        const reverse = leg.type === 'transfer_out' ? leg.amount : -leg.amount;
        if (legWallet) {
          await db.insert(walletActivityLogs).values({
            id: generateId(),
            walletId: leg.walletId,
            relatedTransactionId: leg.id,
            actionType: 'deleted',
            transactionType: leg.type,
            categoryId: null,
            counterpartyWalletId: leg.toWalletId ?? null,
            amount: leg.amount,
            balanceBefore: legWallet.balance ?? 0,
            balanceAfter: (legWallet.balance ?? 0) + reverse,
            note: leg.note ?? null,
            createdAt: now,
          });
        }
        await db
          .update(wallets)
          .set({ balance: sql`${wallets.balance} + ${reverse}`, updatedAt: now })
          .where(eq(wallets.id, leg.walletId));
      }

      await db
        .delete(transactions)
        .where(eq(transactions.transferGroupId, tx.transferGroupId));
      return;
    }

    // Phase 0 — opening เคยบวกเข้ายอด → ลบแล้วต้องหักกลับ
    if (tx.type === 'opening') {
      if (fromWallet) {
        await db.insert(walletActivityLogs).values({
          id: generateId(),
          walletId: tx.walletId,
          relatedTransactionId: tx.id,
          actionType: 'deleted',
          transactionType: tx.type,
          categoryId: null,
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
      await db.delete(transactions).where(eq(transactions.id, id));
      return;
    }

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

  // Compound trade — ลบทั้งชุดในครั้งเดียว (atomic): คืนยอดทุก leg + ลบทุก row (AC2)
  async deleteTradeGroup(tradeGroupId: string) {
    const legs = await db
      .select()
      .from(transactions)
      .where(eq(transactions.tradeGroupId, tradeGroupId));
    if (legs.length === 0) return;

    const now = new Date();
    for (const leg of legs) {
      // income เคย + → คืน −, expense เคย − → คืน +
      const reverse = leg.type === 'income' ? -leg.amount : leg.type === 'expense' ? leg.amount : 0;
      const w = (await db.select().from(wallets).where(eq(wallets.id, leg.walletId)).limit(1))[0];
      if (w) {
        await db.insert(walletActivityLogs).values({
          id: generateId(),
          walletId: leg.walletId,
          relatedTransactionId: leg.id,
          actionType: 'deleted',
          transactionType: leg.type === 'income' || leg.type === 'expense' ? leg.type : 'expense',
          categoryId: leg.categoryId ?? null,
          counterpartyWalletId: null,
          amount: leg.amount,
          balanceBefore: w.balance ?? 0,
          balanceAfter: (w.balance ?? 0) + reverse,
          note: leg.note ?? null,
          createdAt: now,
        });
      }
      await db
        .update(wallets)
        .set({ balance: sql`${wallets.balance} + ${reverse}`, updatedAt: now })
        .where(eq(wallets.id, leg.walletId));
    }

    await db.delete(transactions).where(eq(transactions.tradeGroupId, tradeGroupId));
  },
};
