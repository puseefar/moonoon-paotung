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
    const openingBalance = data.balance ?? 0;

    await db.insert(wallets).values({
      ...data,
      id,
      balance: openingBalance,
      createdAt: now,
      updatedAt: now,
    });

    // Phase 0 §2.2 — ยอดตั้งต้นต้องเป็น transaction ชนิด opening เพื่อให้ ledger reconcile
    // (นับในยอดคงเหลือกระเป๋า แต่ไม่นับเป็นรายรับ/รายจ่าย)
    if (Math.abs(openingBalance) > 0.005) {
      await db.insert(transactions).values({
        id: generateId(),
        amount: openingBalance,
        type: 'opening',
        categoryId: null,
        walletId: id,
        toWalletId: null,
        transferGroupId: null,
        walletNameSnapshot: data.name,
        sourceType: 'opening_balance',
        note: 'ยอดตั้งต้น',
        date: now,
        createdAt: now,
        updatedAt: now,
      });
    }

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

    // Phase 0 §2.3 — โอน = คู่ entry: transfer_out (ต้นทาง) + transfer_in (ปลายทาง)
    // ผูกด้วย transferGroupId เดียวกัน → net ต่อสินทรัพย์รวม = 0, ไม่เข้ารายรับ/รายจ่าย
    const groupId = generateId();
    const outId = generateId();
    await db.insert(transactions).values([
      {
        id: outId,
        amount,
        type: 'transfer_out',
        categoryId: null,
        walletId: fromWalletId,
        toWalletId,
        transferGroupId: groupId,
        walletNameSnapshot: fromWallet.name,
        sourceType: 'transfer',
        sourceRef: groupId,
        date: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: generateId(),
        amount,
        type: 'transfer_in',
        categoryId: null,
        walletId: toWalletId,
        toWalletId: fromWalletId,
        transferGroupId: groupId,
        walletNameSnapshot: toWallet.name,
        sourceType: 'transfer',
        sourceRef: groupId,
        date: now,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    return outId;
  },

  async recalculateBalance(walletId: string) {
    // Phase 0 — balance = Σ(ทุก transaction ที่ผูกกับกระเป๋านี้ ตามทิศของ type)
    //   opening / income / transfer_in = +,  expense / transfer_out = −
    //   (legacy 'transfer' แถวเดียว: − ที่ walletId, + ที่ toWalletId — รองรับเผื่อยังไม่ migrate)
    const rows = await db
      .select({
        type: transactions.type,
        amount: transactions.amount,
        walletId: transactions.walletId,
        toWalletId: transactions.toWalletId,
      })
      .from(transactions)
      .where(or(eq(transactions.walletId, walletId), eq(transactions.toWalletId, walletId)));

    let balance = 0;
    for (const r of rows) {
      if (r.walletId === walletId) {
        if (r.type === 'opening' || r.type === 'income' || r.type === 'transfer_in') {
          balance += r.amount;
        } else if (r.type === 'expense' || r.type === 'transfer_out' || r.type === 'transfer') {
          balance -= r.amount;
        }
      } else if (r.toWalletId === walletId && r.type === 'transfer') {
        // legacy transfer: ขาเข้าฝั่งปลายทาง
        balance += r.amount;
      }
    }

    await db
      .update(wallets)
      .set({ balance, updatedAt: new Date() })
      .where(eq(wallets.id, walletId));

    return balance;
  },

  /**
   * Phase 0 / Phase 1 — ตรวจ Invariant: Σ wallet.balance === Σ ledger ทั้งระบบ
   * คืน diff ต่อกระเป๋า ถ้าไม่ตรงจะ log เตือน (กัน bug เงียบ)
   */
  async assertReconciled(): Promise<{
    ok: boolean;
    walletTotal: number;
    ledgerTotal: number;
    diff: number;
    perWallet: { walletId: string; name: string; storedBalance: number; ledgerBalance: number; diff: number }[];
  }> {
    const [allWallets, rows] = await Promise.all([
      db.select().from(wallets),
      db
        .select({
          type: transactions.type,
          amount: transactions.amount,
          walletId: transactions.walletId,
          toWalletId: transactions.toWalletId,
        })
        .from(transactions),
    ]);

    const ledgerByWallet = new Map<string, number>();
    const add = (id: string | null, delta: number) => {
      if (!id) return;
      ledgerByWallet.set(id, (ledgerByWallet.get(id) ?? 0) + delta);
    };

    for (const r of rows) {
      if (r.type === 'opening' || r.type === 'income' || r.type === 'transfer_in') {
        add(r.walletId, r.amount);
      } else if (r.type === 'expense' || r.type === 'transfer_out') {
        add(r.walletId, -r.amount);
      } else if (r.type === 'transfer') {
        // legacy: − ต้นทาง, + ปลายทาง
        add(r.walletId, -r.amount);
        add(r.toWalletId, r.amount);
      }
    }

    const perWallet = allWallets.map((w) => {
      const ledgerBalance = ledgerByWallet.get(w.id) ?? 0;
      const storedBalance = w.balance ?? 0;
      return {
        walletId: w.id,
        name: w.name,
        storedBalance,
        ledgerBalance,
        diff: storedBalance - ledgerBalance,
      };
    });

    const walletTotal = perWallet.reduce((s, w) => s + w.storedBalance, 0);
    const ledgerTotal = perWallet.reduce((s, w) => s + w.ledgerBalance, 0);
    const diff = walletTotal - ledgerTotal;
    const ok = Math.abs(diff) < 0.01 && perWallet.every((w) => Math.abs(w.diff) < 0.01);

    if (!ok) {
      console.warn(
        `[assertReconciled] ❌ ledger ไม่ reconcile กับยอดกระเป๋า — diff รวม ${diff.toFixed(2)}`,
        perWallet.filter((w) => Math.abs(w.diff) >= 0.01)
      );
    }

    return { ok, walletTotal, ledgerTotal, diff, perWallet };
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

    // Phase 0 — โมเดลใหม่ทุก leg เป็นแถวของตัวเอง (walletId == กระเป๋านี้)
    // เก็บเฉพาะ leg ที่เป็นของกระเป๋านี้ + รองรับ legacy transfer (แถวเดียว) ที่ปลายทาง
    const ownedLegs = relatedTransactions.filter(
      (tx) => tx.walletId === walletId || (tx.type === 'transfer' && tx.toWalletId === walletId)
    );
    const orderedTransactions = [...ownedLegs].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const signedFor = (tx: { type: string; amount: number; walletId: string; toWalletId: string | null }) => {
      if (tx.walletId === walletId) {
        if (tx.type === 'income' || tx.type === 'transfer_in' || tx.type === 'opening') return tx.amount;
        if (tx.type === 'expense' || tx.type === 'transfer_out' || tx.type === 'transfer') return -tx.amount;
        return 0;
      }
      // legacy transfer ฝั่งปลายทาง
      if (tx.type === 'transfer' && tx.toWalletId === walletId) return tx.amount;
      return 0;
    };

    const totalNetChange = orderedTransactions.reduce((sum, tx) => sum + signedFor(tx), 0);

    let runningBalance = (wallet.balance ?? 0) - totalNetChange;

    const transactionItems: WalletActivityItem[] = orderedTransactions.map((tx) => {
      const signedAmount = signedFor(tx);

      const balanceBefore = runningBalance;
      runningBalance += signedAmount;
      const balanceAfter = runningBalance;

      let actionType: WalletActivityItem['actionType'] = 'income';
      let counterpartyWalletId: string | null = null;

      if (tx.type === 'expense') {
        actionType = 'expense';
      } else if (tx.type === 'income') {
        actionType = 'income';
      } else if (tx.type === 'opening') {
        actionType = 'opening';
      } else if (tx.type === 'transfer_in') {
        actionType = 'transfer_in';
        counterpartyWalletId = tx.toWalletId ?? null;
      } else if (tx.type === 'transfer_out') {
        actionType = 'transfer_out';
        counterpartyWalletId = tx.toWalletId ?? null;
      } else if (tx.walletId === walletId) {
        // legacy transfer ต้นทาง
        actionType = 'transfer_out';
        counterpartyWalletId = tx.toWalletId ?? null;
      } else {
        // legacy transfer ปลายทาง
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
