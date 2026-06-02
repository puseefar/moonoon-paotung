import { eq, asc } from 'drizzle-orm';
import { db } from '@/db/client';
import { seedDefaultData } from '@/db/seed';
import { categories } from '@/db/schema';
import type { NewCategory, Category } from '@/db/schema';
import { generateId } from '@/lib/uuid';

export const categoryService = {
  // ดึงหมวดหมู่ทั้งหมด
  async getAll() {
    await seedDefaultData();
    return db
      .select()
      .from(categories)
      .orderBy(asc(categories.sortOrder));
  },

  // ดึงตามประเภท (income / expense)
  async getByType(type: 'income' | 'expense') {
    await seedDefaultData();
    return db
      .select()
      .from(categories)
      .where(eq(categories.type, type))
      .orderBy(asc(categories.sortOrder));
  },

  // ดึงตาม ID
  async getById(id: string) {
    const result = await db
      .select()
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1);
    return result[0] ?? null;
  },

  // สร้างหมวดหมู่ใหม่
  async create(data: Omit<NewCategory, 'id' | 'createdAt'>) {
    const id = generateId();
    await db.insert(categories).values({
      ...data,
      id,
      createdAt: new Date(),
    });
    return id;
  },

  // อัพเดทหมวดหมู่
  async update(id: string, data: Partial<Omit<NewCategory, 'id' | 'createdAt'>>) {
    await db
      .update(categories)
      .set(data)
      .where(eq(categories.id, id));
  },

  // ลบหมวดหมู่ (เฉพาะที่ไม่ใช่ default)
  async delete(id: string) {
    const category = await this.getById(id);
    if (category?.isDefault) {
      throw new Error('ไม่สามารถลบหมวดหมู่เริ่มต้นได้');
    }
    await db.delete(categories).where(eq(categories.id, id));
  },
};
