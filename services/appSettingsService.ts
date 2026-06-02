import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { seedDefaultData } from '@/db/seed';
import { appSettings } from '@/db/schema';

export const appSettingsService = {
  async get(key: string) {
    await seedDefaultData();

    const result = await db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, key))
      .limit(1);

    return result[0]?.value ?? null;
  },

  async getJson<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    if (!value) return null;

    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  },

  async set(key: string, value: string) {
    await seedDefaultData();

    const existing = await db
      .select({ key: appSettings.key })
      .from(appSettings)
      .where(eq(appSettings.key, key))
      .limit(1);

    const now = new Date();

    if (existing[0]) {
      await db
        .update(appSettings)
        .set({
          value,
          updatedAt: now,
        })
        .where(eq(appSettings.key, key));
      return;
    }

    await db.insert(appSettings).values({
      key,
      value,
      updatedAt: now,
    });
  },

  async setJson(key: string, value: unknown) {
    await this.set(key, JSON.stringify(value));
  },

  async remove(key: string) {
    await db.delete(appSettings).where(eq(appSettings.key, key));
  },
};
