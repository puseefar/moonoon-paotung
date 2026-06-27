import { eq, desc, and, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { tripSessions, tripItems, priceMemory, transactions, wallets } from '@/db/schema';
import { generateId } from '@/lib/uuid';
import { sql } from 'drizzle-orm';

// ============================================================
// Trip Templates (hardcoded, rule-based)
// ============================================================
export interface TripTemplateItem {
  itemName: string;
  estimatedPrice: number;
  unit?: string;
}

export interface TripTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
  defaultItems: TripTemplateItem[];
}

export const TRIP_TEMPLATES: TripTemplate[] = [
  {
    id: 'market-housewife',
    name: 'จ่ายตลาด (แม่บ้าน)',
    icon: '🛒',
    description: 'วางแผนงบจ่ายตลาดประจำวัน/สัปดาห์',
    color: '#E65100',
    defaultItems: [
      { itemName: 'ข้าวสาร', estimatedPrice: 150, unit: 'กก.' },
      { itemName: 'ผัก', estimatedPrice: 80 },
      { itemName: 'เนื้อหมู', estimatedPrice: 120 },
      { itemName: 'ไข่ไก่', estimatedPrice: 60, unit: 'แผง' },
      { itemName: 'น้ำมันพืช', estimatedPrice: 55 },
      { itemName: 'เครื่องปรุง', estimatedPrice: 50 },
    ],
  },
  {
    id: 'stock-trader',
    name: 'ซื้อของมาขาย (แม่ค้า)',
    icon: '🧺',
    description: 'ต้นทุนสินค้าและคำนวณกำไรก่อนออกไปซื้อ',
    color: '#1565C0',
    defaultItems: [
      { itemName: 'สินค้าหลัก', estimatedPrice: 500 },
      { itemName: 'บรรจุภัณฑ์/ถุง', estimatedPrice: 50 },
      { itemName: 'ค่าเดินทาง', estimatedPrice: 80 },
      { itemName: 'ค่าแผง/ที่วาง', estimatedPrice: 100 },
    ],
  },
  {
    id: 'grocery-run',
    name: 'ช้อปซุปเปอร์มาร์เก็ต',
    icon: '🏪',
    description: 'ช้อปของใช้ในบ้าน ห้าง หรือร้านสะดวกซื้อ',
    color: '#00695C',
    defaultItems: [
      { itemName: 'ของใช้ส่วนตัว', estimatedPrice: 200 },
      { itemName: 'ผลิตภัณฑ์ทำความสะอาด', estimatedPrice: 150 },
      { itemName: 'อาหารแห้ง/กระป๋อง', estimatedPrice: 180 },
      { itemName: 'เครื่องดื่ม', estimatedPrice: 100 },
    ],
  },
  {
    id: 'material-purchase',
    name: 'ซื้อวัตถุดิบ/วัสดุ',
    icon: '🔧',
    description: 'ซื้อวัตถุดิบสำหรับผลิต/ซ่อม/ก่อสร้าง',
    color: '#37474F',
    defaultItems: [
      { itemName: 'วัตถุดิบหลัก', estimatedPrice: 300 },
      { itemName: 'อุปกรณ์เสริม', estimatedPrice: 150 },
      { itemName: 'ค่าขนส่ง/เดินทาง', estimatedPrice: 80 },
    ],
  },
  {
    id: 'blank',
    name: 'กำหนดเอง',
    icon: '✏️',
    description: 'สร้าง shopping list เปล่าและเพิ่มเองทั้งหมด',
    color: '#7C3AED',
    defaultItems: [],
  },
];

// ============================================================
// Helpers
// ============================================================
function normalizeItemKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

// ============================================================
// Service
// ============================================================
export const tripEstimatorService = {
  // ── Price Memory ──────────────────────────────────────────
  async getPriceMemory(itemName: string): Promise<number | null> {
    const key = normalizeItemKey(itemName);
    const rows = await db.select().from(priceMemory).where(eq(priceMemory.itemKey, key)).limit(1);
    return rows[0]?.avgPrice ?? null;
  },

  async recordPrice(itemName: string, price: number) {
    if (price <= 0) return;
    const key = normalizeItemKey(itemName);
    const existing = await db.select().from(priceMemory).where(eq(priceMemory.itemKey, key)).limit(1);
    const now = new Date();
    if (existing[0]) {
      const count = (existing[0].hitCount ?? 1) + 1;
      const newAvg = ((existing[0].avgPrice ?? price) * (count - 1) + price) / count;
      await db.update(priceMemory).set({
        lastPrice: price,
        avgPrice: Math.round(newAvg * 100) / 100,
        hitCount: count,
        updatedAt: now,
      }).where(eq(priceMemory.itemKey, key));
    } else {
      await db.insert(priceMemory).values({ id: generateId(), itemKey: key, lastPrice: price, avgPrice: price, hitCount: 1, updatedAt: now });
    }
  },

  async deletePriceMemory(itemName: string) {
    const key = normalizeItemKey(itemName);
    await db.delete(priceMemory).where(eq(priceMemory.itemKey, key));
  },

  async updatePriceMemory(itemName: string, newPrice: number) {
    if (newPrice <= 0) return;
    const key = normalizeItemKey(itemName);
    const now = new Date();
    await db.update(priceMemory)
      .set({ lastPrice: newPrice, avgPrice: newPrice, updatedAt: now })
      .where(eq(priceMemory.itemKey, key));
  },

  async searchPriceMemory(query: string) {
    if (!query.trim()) return [];
    const key = normalizeItemKey(query);
    const all = await db.select().from(priceMemory);
    return all.filter((m) => m.itemKey.includes(key)).slice(0, 5);
  },

  // ── Sessions ──────────────────────────────────────────────
  async getActiveSessions() {
    return db.select().from(tripSessions)
      .where(inArray(tripSessions.status, ['planning', 'active']))
      .orderBy(desc(tripSessions.createdAt));
  },

  async getDoneSessions() {
    return db.select().from(tripSessions)
      .where(eq(tripSessions.status, 'done'))
      .orderBy(desc(tripSessions.completedAt));
  },

  async getSessionById(id: string) {
    const rows = await db.select().from(tripSessions).where(eq(tripSessions.id, id)).limit(1);
    return rows[0] ?? null;
  },

  async startShopping(sessionId: string, note?: string) {
    if (note !== undefined) {
      await db.update(tripSessions).set({ status: 'active', note: note || null }).where(eq(tripSessions.id, sessionId));
    } else {
      await db.update(tripSessions).set({ status: 'active' }).where(eq(tripSessions.id, sessionId));
    }
  },

  async updateNote(sessionId: string, note: string) {
    await db.update(tripSessions).set({ note: note || null }).where(eq(tripSessions.id, sessionId));
  },

  async getCarryForwardItems(templateId: string): Promise<{ itemName: string; estimatedPrice: number; unit: string | null }[]> {
    const lastDone = await db.select().from(tripSessions)
      .where(and(eq(tripSessions.templateId, templateId), eq(tripSessions.status, 'done')))
      .orderBy(desc(tripSessions.completedAt))
      .limit(1);
    if (!lastDone[0]) return [];
    const items = await db.select().from(tripItems)
      .where(and(eq(tripItems.sessionId, lastDone[0].id), eq(tripItems.isTicked, false)));
    return items.map(i => ({ itemName: i.itemName, estimatedPrice: i.estimatedPrice ?? 0, unit: i.unit }));
  },

  async getFrequentItems(templateId: string): Promise<{ itemName: string; count: number; avgPrice: number }[]> {
    const sessions = await db.select().from(tripSessions)
      .where(and(eq(tripSessions.templateId, templateId), eq(tripSessions.status, 'done')))
      .orderBy(desc(tripSessions.completedAt))
      .limit(8);
    if (sessions.length < 2) return [];
    const counts = new Map<string, { count: number; prices: number[] }>();
    for (const s of sessions) {
      const items = await db.select().from(tripItems).where(eq(tripItems.sessionId, s.id));
      for (const item of items) {
        const key = normalizeItemKey(item.itemName);
        if (!counts.has(key)) counts.set(key, { count: 0, prices: [] });
        const entry = counts.get(key)!;
        entry.count++;
        if (item.estimatedPrice && item.estimatedPrice > 0) entry.prices.push(item.estimatedPrice);
      }
    }
    return Array.from(counts.entries())
      .filter(([, v]) => v.count >= 2)
      .map(([key, v]) => ({
        itemName: key,
        count: v.count,
        avgPrice: v.prices.length > 0 ? Math.round(v.prices.reduce((a, b) => a + b, 0) / v.prices.length) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  },

  async createSession(name: string, templateId?: string, options?: { carryForwardItems?: { itemName: string; estimatedPrice: number; unit: string | null }[] }) {
    const template = TRIP_TEMPLATES.find((t) => t.id === templateId);
    const now = new Date();
    const sessionId = generateId();
    await db.insert(tripSessions).values({
      id: sessionId, name, templateId: templateId ?? null,
      estimatedBudget: 0, actualSpent: 0,
      status: 'planning', createdAt: now,
    });

    let sortOrder = 0;
    if (template && template.defaultItems.length > 0) {
      for (const di of template.defaultItems) {
        const remembered = await this.getPriceMemory(di.itemName);
        await db.insert(tripItems).values({
          id: generateId(), sessionId,
          itemName: di.itemName,
          estimatedPrice: remembered ?? di.estimatedPrice,
          quantity: 1, unit: di.unit ?? null,
          isTicked: false, sortOrder: sortOrder++, createdAt: now,
        });
      }
    }
    if (options?.carryForwardItems && options.carryForwardItems.length > 0) {
      const existing = await this.getItems(sessionId);
      const existingKeys = new Set(existing.map((i) => normalizeItemKey(i.itemName)));
      for (const cf of options.carryForwardItems) {
        if (existingKeys.has(normalizeItemKey(cf.itemName))) continue;
        const remembered = await this.getPriceMemory(cf.itemName);
        await db.insert(tripItems).values({
          id: generateId(), sessionId,
          itemName: cf.itemName,
          estimatedPrice: remembered ?? cf.estimatedPrice,
          quantity: 1, unit: cf.unit,
          isTicked: false, sortOrder: sortOrder++, createdAt: now,
        });
      }
    }
    await this._recalcEstimate(sessionId);
    return sessionId;
  },

  async deleteSession(id: string) {
    await db.delete(tripItems).where(eq(tripItems.sessionId, id));
    await db.delete(tripSessions).where(eq(tripSessions.id, id));
  },

  async duplicateSession(sourceId: string, newName?: string): Promise<string> {
    const source = await this.getSessionById(sourceId);
    if (!source) throw new Error('Session not found');
    const items = await this.getItems(sourceId);
    const now = new Date();
    const newId = generateId();
    await db.insert(tripSessions).values({
      id: newId,
      name: newName ?? `${source.name} (ทำซ้ำ)`,
      templateId: source.templateId,
      estimatedBudget: 0, actualSpent: 0,
      status: 'planning', createdAt: now,
    });
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const remembered = await this.getPriceMemory(item.itemName);
      await db.insert(tripItems).values({
        id: generateId(), sessionId: newId,
        itemName: item.itemName,
        estimatedPrice: remembered ?? item.estimatedPrice ?? 0,
        quantity: item.quantity ?? 1,
        unit: item.unit,
        isTicked: false, sortOrder: i, createdAt: now,
      });
    }
    await this._recalcEstimate(newId);
    return newId;
  },

  // ── Items ─────────────────────────────────────────────────
  async getItems(sessionId: string) {
    return db.select().from(tripItems)
      .where(eq(tripItems.sessionId, sessionId))
      .orderBy(tripItems.sortOrder);
  },

  async addItem(sessionId: string, itemName: string, estimatedPrice: number, quantity: number = 1, unit?: string) {
    const existing = await this.getItems(sessionId);
    const sortOrder = existing.length;
    const id = generateId();
    await db.insert(tripItems).values({
      id, sessionId, itemName, estimatedPrice,
      quantity, unit: unit ?? null,
      isTicked: false, sortOrder, createdAt: new Date(),
    });
    await this._recalcEstimate(sessionId);
    return id;
  },

  async updateItem(itemId: string, data: { itemName?: string; estimatedPrice?: number; quantity?: number; unit?: string }) {
    await db.update(tripItems).set(data).where(eq(tripItems.id, itemId));
    const item = await db.select({ sessionId: tripItems.sessionId }).from(tripItems).where(eq(tripItems.id, itemId)).limit(1);
    if (item[0]) await this._recalcEstimate(item[0].sessionId);
  },

  async deleteItem(itemId: string) {
    const item = await db.select({ sessionId: tripItems.sessionId }).from(tripItems).where(eq(tripItems.id, itemId)).limit(1);
    await db.delete(tripItems).where(eq(tripItems.id, itemId));
    if (item[0]) await this._recalcEstimate(item[0].sessionId);
  },

  async tickItem(itemId: string, actualPrice?: number) {
    const now = new Date();
    await db.update(tripItems).set({
      isTicked: true,
      actualPrice: actualPrice ?? null,
    }).where(eq(tripItems.id, itemId));

    const item = await db.select().from(tripItems).where(eq(tripItems.id, itemId)).limit(1);
    if (item[0]) {
      if (actualPrice && actualPrice > 0) {
        await this.recordPrice(item[0].itemName, actualPrice);
      }
      await this._recalcActual(item[0].sessionId);
    }
  },

  async untickItem(itemId: string) {
    await db.update(tripItems).set({ isTicked: false, actualPrice: null }).where(eq(tripItems.id, itemId));
    const item = await db.select({ sessionId: tripItems.sessionId }).from(tripItems).where(eq(tripItems.id, itemId)).limit(1);
    if (item[0]) await this._recalcActual(item[0].sessionId);
  },

  // ── Complete Session ──────────────────────────────────────
  async completeSession(sessionId: string, options?: { createExpense: boolean; walletId?: string; categoryId?: string }) {
    const session = await this.getSessionById(sessionId);
    if (!session) return;
    const now = new Date();

    const spent = session.actualSpent ?? 0;
    if (options?.createExpense && options.walletId && spent > 0) {
      const txId = generateId();
      const walletRow = await db.select({ name: wallets.name }).from(wallets).where(eq(wallets.id, options.walletId)).limit(1);
      await db.insert(transactions).values({
        id: txId, amount: spent, type: 'expense',
        categoryId: options.categoryId ?? null,
        walletId: options.walletId,
        walletNameSnapshot: walletRow[0]?.name ?? null,
        sourceType: 'manual',
        note: `ทริป: ${session.name}`,
        date: now, isRecurring: false, createdAt: now, updatedAt: now,
      });
      await db.update(wallets)
        .set({ balance: sql`${wallets.balance} - ${spent}`, updatedAt: now })
        .where(eq(wallets.id, options.walletId));
    }

    await db.update(tripSessions).set({ status: 'done', completedAt: now }).where(eq(tripSessions.id, sessionId));

    // Record prices for all ticked items
    const items = await this.getItems(sessionId);
    for (const item of items) {
      if (item.isTicked && item.actualPrice && item.actualPrice > 0) {
        await this.recordPrice(item.itemName, item.actualPrice);
      }
    }
  },

  // ── Summary ───────────────────────────────────────────────
  async getSessionSummary(sessionId: string) {
    const session = await this.getSessionById(sessionId);
    const items = await this.getItems(sessionId);

    const ticked = items.filter((i) => i.isTicked);
    const unticked = items.filter((i) => !i.isTicked);
    const totalEstimated = items.reduce((s, i) => s + ((i.estimatedPrice ?? 0) * (i.quantity ?? 1)), 0);
    const totalActual = ticked.reduce((s, i) => s + ((i.actualPrice ?? i.estimatedPrice ?? 0) * (i.quantity ?? 1)), 0);
    const remainingEstimated = unticked.reduce((s, i) => s + ((i.estimatedPrice ?? 0) * (i.quantity ?? 1)), 0);

    return {
      session,
      items,
      ticked,
      unticked,
      totalEstimated,
      totalActual,
      remainingEstimated,
      savedVsEstimate: totalEstimated - totalActual,
      completionPct: items.length > 0 ? (ticked.length / items.length) * 100 : 0,
    };
  },

  // ── Internal ──────────────────────────────────────────────
  async _recalcEstimate(sessionId: string) {
    const items = await this.getItems(sessionId);
    const est = items.reduce((s, i) => s + ((i.estimatedPrice ?? 0) * (i.quantity ?? 1)), 0);
    await db.update(tripSessions).set({ estimatedBudget: est }).where(eq(tripSessions.id, sessionId));
  },

  async _recalcActual(sessionId: string) {
    const items = await this.getItems(sessionId);
    const actual = items
      .filter((i) => i.isTicked)
      .reduce((s, i) => s + ((i.actualPrice ?? i.estimatedPrice ?? 0) * (i.quantity ?? 1)), 0);
    await db.update(tripSessions).set({ actualSpent: actual }).where(eq(tripSessions.id, sessionId));
  },
};
