import { eq, desc, and, gte, lt } from 'drizzle-orm';
import * as FileSystem from 'expo-file-system/legacy';
import { db } from '@/db/client';
import {
  diaryEntries, diaryMedia, diaryExpenses, diaryTrips,
  transactions, wallets,
} from '@/db/schema';
import type { DiaryEntry, DiaryMedia, DiaryExpense, DiaryTrip } from '@/db/schema';
import { generateId } from '@/lib/uuid';
import { sql } from 'drizzle-orm';

// ── Constants ─────────────────────────────────────────────────────────────────
const DIARY_DIR = `${FileSystem.documentDirectory}diary/`;

const MOODS = ['😊', '🥰', '😆', '😴', '😢', '😤', '🥺', '😌', '🤩', '😮'] as const;
export type MoodEmoji = typeof MOODS[number];
export { MOODS };

// ── Helpers ───────────────────────────────────────────────────────────────────
async function ensureDiaryDir(entryId: string) {
  const dir = `${DIARY_DIR}${entryId}/`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  return dir;
}

// ── Photo management ──────────────────────────────────────────────────────────
export const diaryService = {
  // Copy photo from gallery/camera uri → app document directory
  async copyPhotoToStore(entryId: string, sourceUri: string): Promise<{
    localUri: string; fileSize: number | undefined; width?: number; height?: number;
  }> {
    const dir = await ensureDiaryDir(entryId);
    const ext = sourceUri.split('.').pop()?.toLowerCase() ?? 'jpg';
    const fileName = `img-${Date.now()}.${ext}`;
    const destUri = `${dir}${fileName}`;
    await FileSystem.copyAsync({ from: sourceUri, to: destUri });
    const info = await FileSystem.getInfoAsync(destUri);
    const fileSize = (info as any).size as number | undefined;
    return { localUri: destUri, fileSize };
  },

  async deletePhotoFile(localUri: string) {
    try {
      const info = await FileSystem.getInfoAsync(localUri);
      if (info.exists) await FileSystem.deleteAsync(localUri, { idempotent: true });
    } catch { /* ignore */ }
  },

  // ── Diary Entries ──────────────────────────────────────────────────────────
  async createEntry(data: {
    title?: string;
    content: string;
    mood?: string;
    entryDate: Date;
    locationName?: string;
    tripId?: string;
    linkedTripSessionId?: string;
  }): Promise<string> {
    const id = generateId();
    const now = new Date();
    await db.insert(diaryEntries).values({
      id, content: data.content, title: data.title ?? null,
      mood: data.mood ?? null, entryDate: data.entryDate,
      locationName: data.locationName ?? null,
      tripId: data.tripId ?? null,
      linkedTripSessionId: data.linkedTripSessionId ?? null,
      createdAt: now, updatedAt: now,
    });
    return id;
  },

  async updateEntry(id: string, data: Partial<{
    title: string | null; content: string; mood: string | null;
    entryDate: Date; locationName: string | null;
    tripId: string | null; linkedTripSessionId: string | null;
  }>) {
    await db.update(diaryEntries)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(diaryEntries.id, id));
  },

  async deleteEntry(id: string) {
    // Get all media files to delete from filesystem
    const media = await this.getMediaForEntry(id);
    for (const m of media) await this.deletePhotoFile(m.localUri);
    // Cascade deletes diary_media + diary_expenses automatically via FK ON DELETE CASCADE
    await db.delete(diaryEntries).where(eq(diaryEntries.id, id));
    // Try to delete entry folder
    try {
      const dir = `${DIARY_DIR}${id}/`;
      const info = await FileSystem.getInfoAsync(dir);
      if (info.exists) await FileSystem.deleteAsync(dir, { idempotent: true });
    } catch { /* ignore */ }
  },

  async getEntries(options?: { limit?: number; offset?: number; month?: Date }): Promise<DiaryEntry[]> {
    if (options?.month) {
      const start = new Date(options.month.getFullYear(), options.month.getMonth(), 1);
      const end = new Date(options.month.getFullYear(), options.month.getMonth() + 1, 1);
      return db.select().from(diaryEntries)
        .where(and(gte(diaryEntries.entryDate, start), lt(diaryEntries.entryDate, end)))
        .orderBy(desc(diaryEntries.entryDate))
        .limit(options.limit ?? 100)
        .offset(options.offset ?? 0);
    }
    return db.select().from(diaryEntries)
      .orderBy(desc(diaryEntries.entryDate))
      .limit(options?.limit ?? 50)
      .offset(options?.offset ?? 0);
  },

  async getEntryById(id: string): Promise<DiaryEntry | null> {
    const rows = await db.select().from(diaryEntries).where(eq(diaryEntries.id, id)).limit(1);
    return rows[0] ?? null;
  },

  // ── Media ──────────────────────────────────────────────────────────────────
  async addMedia(entryId: string, sourceUri: string, caption?: string): Promise<string> {
    const { localUri, fileSize } = await this.copyPhotoToStore(entryId, sourceUri);
    const existing = await this.getMediaForEntry(entryId);
    const id = generateId();
    await db.insert(diaryMedia).values({
      id, entryId, localUri,
      mimeType: 'image/jpeg',
      fileSize: fileSize ?? null,
      caption: caption ?? null,
      sortOrder: existing.length,
      createdAt: new Date(),
    });
    return id;
  },

  async getMediaForEntry(entryId: string): Promise<DiaryMedia[]> {
    return db.select().from(diaryMedia)
      .where(eq(diaryMedia.entryId, entryId))
      .orderBy(diaryMedia.sortOrder);
  },

  async deleteMedia(mediaId: string) {
    const rows = await db.select().from(diaryMedia).where(eq(diaryMedia.id, mediaId)).limit(1);
    if (rows[0]) {
      await this.deletePhotoFile(rows[0].localUri);
      await db.delete(diaryMedia).where(eq(diaryMedia.id, mediaId));
    }
  },

  // Get all media across all entries (for Album view)
  async getAllMedia(limit = 200): Promise<(DiaryMedia & { entryId: string })[]> {
    return db.select().from(diaryMedia)
      .orderBy(desc(diaryMedia.createdAt))
      .limit(limit) as any;
  },

  // ── Expenses ───────────────────────────────────────────────────────────────
  async addExpense(entryId: string, data: {
    itemName: string;
    amount: number;
    categoryId?: string;
    createTransaction?: boolean;
    walletId?: string;
  }): Promise<string> {
    const id = generateId();
    const now = new Date();
    let transactionId: string | null = null;

    if (data.createTransaction && data.walletId && data.amount > 0) {
      transactionId = generateId();
      const walletRow = await db.select({ name: wallets.name }).from(wallets).where(eq(wallets.id, data.walletId)).limit(1);
      await db.insert(transactions).values({
        id: transactionId, amount: data.amount,
        type: 'expense',
        categoryId: data.categoryId ?? null,
        walletId: data.walletId,
        walletNameSnapshot: walletRow[0]?.name ?? null,
        sourceType: 'manual',
        note: data.itemName,
        date: now, isRecurring: false, createdAt: now, updatedAt: now,
      });
      await db.update(wallets)
        .set({ balance: sql`${wallets.balance} - ${data.amount}`, updatedAt: now })
        .where(eq(wallets.id, data.walletId));
    }

    await db.insert(diaryExpenses).values({
      id, entryId, itemName: data.itemName, amount: data.amount,
      categoryId: data.categoryId ?? null,
      transactionId,
      createdAt: now,
    });
    return id;
  },

  async getExpensesForEntry(entryId: string): Promise<DiaryExpense[]> {
    return db.select().from(diaryExpenses)
      .where(eq(diaryExpenses.entryId, entryId))
      .orderBy(diaryExpenses.createdAt);
  },

  async deleteExpense(expenseId: string) {
    await db.delete(diaryExpenses).where(eq(diaryExpenses.id, expenseId));
  },

  // ── Trips ──────────────────────────────────────────────────────────────────
  async createTrip(data: { name: string; destination?: string; totalBudget?: number }): Promise<string> {
    const id = generateId();
    await db.insert(diaryTrips).values({
      id, name: data.name, destination: data.destination ?? null,
      startDate: new Date(), totalBudget: data.totalBudget ?? null,
      status: 'ongoing', createdAt: new Date(),
    });
    return id;
  },

  async getActiveTrips(): Promise<DiaryTrip[]> {
    return db.select().from(diaryTrips)
      .where(eq(diaryTrips.status, 'ongoing'))
      .orderBy(desc(diaryTrips.startDate));
  },

  // ── Full entry with relations ──────────────────────────────────────────────
  async getEntryWithRelations(id: string) {
    const entry = await this.getEntryById(id);
    if (!entry) return null;
    const [media, expenses] = await Promise.all([
      this.getMediaForEntry(id),
      this.getExpensesForEntry(id),
    ]);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    return { entry, media, expenses, totalExpenses };
  },

  async getEntriesWithRelations(options?: { limit?: number }): Promise<import('@/features/life-diary/types').EntryWithRelations[]> {
    const entries = await this.getEntries({ limit: options?.limit ?? 200 });
    return Promise.all(entries.map(async entry => {
      const [media, expenses] = await Promise.all([
        this.getMediaForEntry(entry.id),
        this.getExpensesForEntry(entry.id),
      ]);
      return { entry, media, expenses, totalExpenses: expenses.reduce((s, e) => s + e.amount, 0) };
    }));
  },

  // ── Stats ──────────────────────────────────────────────────────────────────
  async getMonthlyStats(month: Date) {
    const entries = await this.getEntries({ month });
    const allExpenses = await Promise.all(entries.map(e => this.getExpensesForEntry(e.id)));
    const totalSpent = allExpenses.flat().reduce((s, e) => s + e.amount, 0);
    const moodCounts: Record<string, number> = {};
    for (const e of entries) {
      if (e.mood) moodCounts[e.mood] = (moodCounts[e.mood] ?? 0) + 1;
    }
    return { entryCount: entries.length, totalSpent, moodCounts };
  },
};
