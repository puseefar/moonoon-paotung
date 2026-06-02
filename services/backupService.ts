import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Crypto from 'expo-crypto';
import { db } from '@/db/client';
import {
  appSettings,
  categories,
  quickAddLearningRules,
  recurringRules,
  savingsGoals,
  syncLog,
  transactions,
  wallets,
} from '@/db/schema';
import { generateId } from '@/lib/uuid';

export type BackupData = {
  version: number;
  createdAt: string;
  tables: {
    wallets: any[];
    categories: any[];
    transactions: any[];
    recurringRules: any[];
    savingsGoals: any[];
    appSettings: any[];
    quickAddLearningRules?: any[];
  };
  stats: {
    totalTransactions: number;
    totalWallets: number;
    totalCategories: number;
    dateRange: { from: string; to: string } | null;
  };
};

export const backupService = {
  // สร้าง JSON backup จากทุกตาราง
  async createBackupData(): Promise<BackupData> {
    const [w, c, t, r, s, a, q] = await Promise.all([
      db.select().from(wallets),
      db.select().from(categories),
      db.select().from(transactions),
      db.select().from(recurringRules),
      db.select().from(savingsGoals),
      db.select().from(appSettings),
      db.select().from(quickAddLearningRules),
    ]);

    // หา date range ของ transactions
    let dateRange: { from: string; to: string } | null = null;
    if (t.length > 0) {
      const dates = t.map((tx) => new Date(tx.date).getTime());
      dateRange = {
        from: new Date(Math.min(...dates)).toISOString(),
        to: new Date(Math.max(...dates)).toISOString(),
      };
    }

    return {
      version: 1,
      createdAt: new Date().toISOString(),
      tables: {
        wallets: w,
        categories: c,
        transactions: t,
        recurringRules: r,
        savingsGoals: s,
        appSettings: a,
        quickAddLearningRules: q,
      },
      stats: {
        totalTransactions: t.length,
        totalWallets: w.length,
        totalCategories: c.length,
        dateRange,
      },
    };
  },

  // Export backup เป็นไฟล์ JSON แล้วแชร์
  async exportBackupFile(): Promise<string> {
    const data = await this.createBackupData();
    const json = JSON.stringify(data);

    const filename = `poatung-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const filePath = `${FileSystem.cacheDirectory}${filename}`;

    await FileSystem.writeAsStringAsync(filePath, json, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    // Log
    await this.logSync('backup', 'success', json.length);

    return filePath;
  },

  // Share backup file
  async shareBackupFile(): Promise<void> {
    const filePath = await this.exportBackupFile();

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(filePath, {
        mimeType: 'application/json',
        dialogTitle: 'แชร์ไฟล์ Backup',
      });
    }
  },

  // Import backup จากไฟล์ JSON
  async importFromJson(jsonContent: string): Promise<BackupData> {
    const data: BackupData = JSON.parse(jsonContent);

    if (!data.version || !data.tables) {
      throw new Error('ไฟล์ backup ไม่ถูกต้อง');
    }

    return data;
  },

  // Restore ข้อมูลจาก backup (ลบข้อมูลเก่าทั้งหมด)
  async restoreFromBackup(data: BackupData): Promise<void> {
    // ลบข้อมูลเก่าทั้งหมด (ต้องลบตามลำดับ FK)
    await db.delete(transactions);
    await db.delete(recurringRules);
    await db.delete(savingsGoals);
    await db.delete(appSettings);
    await db.delete(quickAddLearningRules);
    await db.delete(wallets);
    await db.delete(categories);

    // Insert ข้อมูลใหม่
    if (data.tables.categories.length > 0) {
      for (const row of data.tables.categories) {
        await db.insert(categories).values({
          ...row,
          createdAt: new Date(row.createdAt ?? row.created_at),
        });
      }
    }

    if (data.tables.wallets.length > 0) {
      for (const row of data.tables.wallets) {
        await db.insert(wallets).values({
          ...row,
          createdAt: new Date(row.createdAt ?? row.created_at),
          updatedAt: new Date(row.updatedAt ?? row.updated_at),
        });
      }
    }

    if (data.tables.transactions.length > 0) {
      for (const row of data.tables.transactions) {
        await db.insert(transactions).values({
          ...row,
          date: new Date(row.date),
          createdAt: new Date(row.createdAt ?? row.created_at),
          updatedAt: new Date(row.updatedAt ?? row.updated_at),
        });
      }
    }

    if (data.tables.recurringRules.length > 0) {
      for (const row of data.tables.recurringRules) {
        await db.insert(recurringRules).values({
          ...row,
          nextDate: new Date(row.nextDate ?? row.next_date),
          createdAt: new Date(row.createdAt ?? row.created_at),
        });
      }
    }

    if (data.tables.savingsGoals.length > 0) {
      for (const row of data.tables.savingsGoals) {
        await db.insert(savingsGoals).values({
          ...row,
          deadline: row.deadline ? new Date(row.deadline) : null,
          createdAt: new Date(row.createdAt ?? row.created_at),
          updatedAt: new Date(row.updatedAt ?? row.updated_at),
        });
      }
    }

    if (data.tables.appSettings.length > 0) {
      for (const row of data.tables.appSettings) {
        await db.insert(appSettings).values({
          ...row,
          updatedAt: new Date(row.updatedAt ?? row.updated_at),
        });
      }
    }

    if (data.tables.quickAddLearningRules && data.tables.quickAddLearningRules.length > 0) {
      for (const row of data.tables.quickAddLearningRules) {
        await db.insert(quickAddLearningRules).values({
          ...row,
          normalizedKeyword: row.normalizedKeyword ?? row.normalized_keyword,
          categoryId: row.categoryId ?? row.category_id,
          hitCount: row.hitCount ?? row.hit_count,
          createdAt: new Date(row.createdAt ?? row.created_at),
          updatedAt: new Date(row.updatedAt ?? row.updated_at),
        });
      }
    }

    await this.logSync('restore', 'success');
  },

  // Log sync action
  async logSync(action: 'backup' | 'restore', status: 'success' | 'failed', fileSize?: number, errorMessage?: string) {
    await db.insert(syncLog).values({
      id: generateId(),
      action,
      status,
      fileSize: fileSize ?? null,
      timestamp: new Date(),
      errorMessage: errorMessage ?? null,
    });
  },

  // ดึง sync history
  async getSyncHistory() {
    return db.select().from(syncLog).orderBy(syncLog.timestamp).limit(20);
  },
};
