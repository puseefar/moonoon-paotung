import { eq, or, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { categories, transactions, walletActivityLogs, wallets } from '@/db/schema';
import type { NewWallet } from '@/db/schema';
import type { WalletActivityItem } from '@/types';
import { generateId } from '@/lib/uuid';

export const walletService = {
  async getAll() {
    return db.select().from(wallets).where(eq(wallets.isActive, true));
  },

  async getAllIncludingInactive() {
    return db.select().from(wallets);
  },

  async getById(id: string) {
    const result = await db.select().from(wallets).where(eq(wallets.id, id)).limit(1);
    return result[0] ?? null;
  },

  async create(data: Omit<NewWallet, 'id' | 'createdAt' | 'updatedAt'>) {
    const now = new Date();
    const id = generateId();
    await db.insert(wallets).values({
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },

  async update(id: string, data: Partial<Omit<NewWallet, 'id' | 'createdAt'>>) {
    await db
      .update(wallets)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(wallets.id, id));
  },

  async delete(id: string) {
    await db
      .update(wallets)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(wallets.id, id));
  },

  async getTotalBalance(): Promise<number> {
    const result = await db
      .select({
        total: sql<number>`SUM(${wallets.balance})`,
      })
      .from(wallets)
      .where(eq(wallets.isActive, true));

    return result[0]?.total ?? 0;
  },

  async transfer(fromWalletId: string, toWalletId: string, amount: number) {
    if (amount <= 0) {
      throw new Error('Transfer amount must be greater than zero');
    }
    if (fromWalletId === toWalletId) {
      throw new Error('Source and destination wallets must be different');
    }

    const fromWallet = await this.getById(fromWalletId);
    const toWallet = await this.getById(toWalletId);
    if (!fromWallet || !toWallet || !fromWallet.isActive || !toWallet.isActive) {
      throw new Error('Wallet not found or inactive');
    }
    if ((fromWallet.balance ?? 0) < amount) {
      throw new Error('Insufficient wallet balance');
    }

    const now = new Date();

    await db
      .update(wallets)
      .set({ balance: sql`${wallets.balance} - ${amount}`, updatedAt: now })
      .where(eq(wallets.id, fromWalletId));

    await db
      .update(wallets)
      .set({ balance: sql`${wallets.balance} + ${amount}`, updatedAt: now })
      .where(eq(wallets.id, toWalletId));

    const id = generateId();
    await db.insert(transactions).values({
      id,
      amount,
      type: 'transfer',
      walletId: fromWalletId,
      toWalletId,
      date: now,
      createdAt: now,
      updatedAt: now,
    });

    return id;
  },

  async recalculateBalance(walletId: string) {
    const incomeResult = await db
      .select({ total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)` })
      .from(transactions)
      .where(sql`${transactions.walletId} = ${walletId} AND ${transactions.type} = 'income'`);

    const expenseResult = await db
      .select({ total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)` })
      .from(transactions)
      .where(sql`${transactions.walletId} = ${walletId} AND ${transactions.type} = 'expense'`);

    const transferOutResult = await db
      .select({ total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)` })
      .from(transactions)
      .where(sql`${transactions.walletId} = ${walletId} AND ${transactions.type} = 'transfer'`);

    const transferInResult = await db
      .select({ total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)` })
      .from(transactions)
      .where(sql`${transactions.toWalletId} = ${walletId} AND ${transactions.type} = 'transfer'`);

    const income = incomeResult[0]?.total ?? 0;
    const expense = expenseResult[0]?.total ?? 0;
    const transferOut = transferOutResult[0]?.total ?? 0;
    const transferIn = transferInResult[0]?.total ?? 0;
    const balance = income - expense - transferOut + transferIn;

    await db
      .update(wallets)
      .set({ balance, updatedAt: new Date() })
      .where(eq(wallets.id, walletId));

    return balance;
  },

  async getActivityTimeline(walletId: string): Promise<WalletActivityItem[]> {
    const wallet = await this.getById(walletId);
    if (!wallet) {
      return [];
    }

    const [allWallets, relatedTransactions, deleteLogs] = await Promise.all([
      db.select().from(wallets),
      db
        .select({
          id: transactions.id,
          amount: transactions.amount,
          type: transactions.type,
          categoryId: transactions.categoryId,
          categoryName: categories.name,
          categoryIcon: categories.icon,
          categoryColor: categories.color,
          walletId: transactions.walletId,
          toWalletId: transactions.toWalletId,
          note: transactions.note,
          date: transactions.date,
        })
        .from(transactions)
        .leftJoin(categories, eq(transactions.categoryId, categories.id))
        .where(or(eq(transactions.walletId, walletId), eq(transactions.toWalletId, walletId))),
      db
        .select({
          id: walletActivityLogs.id,
          relatedTransactionId: walletActivityLogs.relatedTransactionId,
          transactionType: walletActivityLogs.transactionType,
          amount: walletActivityLogs.amount,
          balanceBefore: walletActivityLogs.balanceBefore,
          balanceAfter: walletActivityLogs.balanceAfter,
          walletId: walletActivityLogs.walletId,
          counterpartyWalletId: walletActivityLogs.counterpartyWalletId,
          note: walletActivityLogs.note,
          createdAt: walletActivityLogs.createdAt,
          categoryId: walletActivityLogs.categoryId,
          categoryName: categories.name,
          categoryIcon: categories.icon,
          categoryColor: categories.color,
        })
        .from(walletActivityLogs)
        .leftJoin(categories, eq(walletActivityLogs.categoryId, categories.id))
        .where(eq(walletActivityLogs.walletId, walletId)),
    ]);

    const walletMap = new Map(allWallets.map((item) => [item.id, item]));
    const orderedTransactions = [...relatedTransactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const totalNetChange = orderedTransactions.reduce((sum, tx) => {
      if (tx.type === 'income' && tx.walletId === walletId) return sum + tx.amount;
      if (tx.type === 'expense' && tx.walletId === walletId) return sum - tx.amount;
      if (tx.type === 'transfer' && tx.walletId === walletId) return sum - tx.amount;
      if (tx.type === 'transfer' && tx.toWalletId === walletId) return sum + tx.amount;
      return sum;
    }, 0);

    let runningBalance = (wallet.balance ?? 0) - totalNetChange;

    const transactionItems: WalletActivityItem[] = orderedTransactions.map((tx) => {
      const signedAmount =
        tx.type === 'income' && tx.walletId === walletId
          ? tx.amount
          : tx.type === 'expense' && tx.walletId === walletId
          ? -tx.amount
          : tx.type === 'transfer' && tx.walletId === walletId
          ? -tx.amount
          : tx.type === 'transfer' && tx.toWalletId === walletId
          ? tx.amount
          : 0;

      const balanceBefore = runningBalance;
      runningBalance += signedAmount;
      const balanceAfter = runningBalance;

      let actionType: WalletActivityItem['actionType'] = 'income';
      let counterpartyWalletId: string | null = null;

      if (tx.type === 'expense') {
        actionType = 'expense';
      } else if (tx.type === 'income') {
        actionType = 'income';
      } else if (tx.walletId === walletId) {
        actionType = 'transfer_out';
        counterpartyWalletId = tx.toWalletId ?? null;
      } else {
        actionType = 'transfer_in';
        counterpartyWalletId = tx.walletId;
      }

      return {
        id: tx.id,
        source: 'transaction',
        transactionId: tx.id,
        walletId,
        actionType,
        transactionType: tx.type,
        amount: tx.amount,
        signedAmount,
        categoryId: tx.categoryId ?? null,
        categoryName: tx.categoryName ?? null,
        categoryIcon: tx.categoryIcon ?? null,
        categoryColor: tx.categoryColor ?? null,
        note: tx.note ?? null,
        date: new Date(tx.date),
        balanceBefore,
        balanceAfter,
        counterpartyWalletId,
        counterpartyWalletName: counterpartyWalletId
          ? walletMap.get(counterpartyWalletId)?.name ?? null
          : null,
      };
    });

    const deleteItems: WalletActivityItem[] = deleteLogs.map((log) => ({
      id: log.id,
      source: 'log',
      transactionId: log.relatedTransactionId ?? null,
      walletId,
      actionType: 'deleted',
      transactionType: log.transactionType,
      amount: log.amount,
      signedAmount: (log.balanceAfter ?? 0) - (log.balanceBefore ?? 0),
      categoryId: log.categoryId ?? null,
      categoryName: log.categoryName ?? null,
      categoryIcon: log.categoryIcon ?? null,
      categoryColor: log.categoryColor ?? null,
      note: log.note ?? null,
      date: new Date(log.createdAt),
      balanceBefore: log.balanceBefore,
      balanceAfter: log.balanceAfter,
      counterpartyWalletId: log.counterpartyWalletId ?? null,
      counterpartyWalletName: log.counterpartyWalletId
        ? walletMap.get(log.counterpartyWalletId)?.name ?? null
        : null,
    }));

    return [...transactionItems, ...deleteItems].sort(
      (a, b) => b.date.getTime() - a.date.getTime()
    );
  },
};
