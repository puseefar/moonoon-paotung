// ── shopOrderSyncService ────────────────────────────────────────────────────
// "Last mile" ฝั่งร้าน: ดึงออเดอร์ที่ลูกค้าจ่ายเงินสำเร็จ (status PAID) แล้ว
//   1) บันทึกรายรับเข้ากระเป๋า "ร้านค้า" (idempotent ด้วย transactions.sourceRef)
//   2) ตัดสต็อก variant ฝั่ง device (idempotent ด้วย flag appSettings)
//   3) แจ้งเตือนในแอป + Local Push
// เรียกจาก: app เปิด/กลับเข้า foreground + หน้า shop dashboard/orders focus
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { transactions } from '@/db/schema';
import { api } from '@/lib/api/client';
import { appSettingsService } from '@/services/appSettingsService';
import { walletService } from '@/services/walletService';
import { categoryService } from '@/services/categoryService';
import { transactionService } from '@/services/transactionService';
import { notificationService } from '@/services/notificationService';
import { productLocalService } from './productLocalService';
import { shopNotificationService } from './shopNotificationService';
import type { Order } from '@/lib/api/contract';

const WALLET_ID_KEY   = 'shop.walletId';
const INCOME_CAT_KEY  = 'shop.incomeCategoryId';
const SOURCE_TYPE     = 'shop_order';
const WALLET_NAME     = 'ร้านค้า Mini Shop';
const INCOME_CAT_NAME = 'ขายของออนไลน์';
const stockFlagKey = (orderId: string) => `shop.stockDeducted.${orderId}`;

export interface ProcessedSale { orderId: string; orderNo: string; total: number; }

let syncing = false; // กัน concurrent run

// ── กระเป๋า "ร้านค้า" (สร้างครั้งเดียว, จำ id ไว้) ──────────────────────────
async function ensureShopWallet(): Promise<string> {
  const existing = await appSettingsService.get(WALLET_ID_KEY);
  if (existing) {
    const w = await walletService.getById(existing);
    if (w) return existing;
  }
  const id = await walletService.create({ name: WALLET_NAME, icon: '🏪', balance: 0 });
  await appSettingsService.set(WALLET_ID_KEY, id);
  return id;
}

// ── หมวดรายรับ "ขายของออนไลน์" (find-or-create) ─────────────────────────────
async function ensureIncomeCategory(): Promise<string> {
  const existing = await appSettingsService.get(INCOME_CAT_KEY);
  if (existing) {
    const c = await categoryService.getById(existing);
    if (c) return existing;
  }
  const incomeCats = await categoryService.getByType('income');
  const found = incomeCats.find(c => c.name === INCOME_CAT_NAME);
  const id = found?.id ?? (await categoryService.create({
    name: INCOME_CAT_NAME, icon: '🛍️', type: 'income', color: '#7C3AED',
    sortOrder: 0, isDefault: false,
  }));
  await appSettingsService.set(INCOME_CAT_KEY, id);
  return id;
}

// ── เช็คว่าออเดอร์นี้บันทึกรายรับไปแล้วหรือยัง (idempotency) ──────────────────
async function isIncomeRecorded(orderId: string): Promise<boolean> {
  const rows = await db.select({ id: transactions.id })
    .from(transactions)
    .where(and(eq(transactions.sourceType, SOURCE_TYPE), eq(transactions.sourceRef, orderId)))
    .limit(1);
  return rows.length > 0;
}

// ── ตัดสต็อก variant (หรือ product-level ถ้าไม่มี variant) ────────────────────
async function deductStockForOrder(order: Order): Promise<void> {
  for (const item of order.items) {
    if (item.variantId) {
      const variants = await productLocalService.getVariants(item.productId);
      if (variants?.length) {
        let changed = false;
        for (const g of variants) {
          for (const v of g.values) {
            if (v.id === item.variantId) {
              v.stock = Math.max(0, (v.stock ?? 0) - item.qty);
              changed = true;
            }
          }
        }
        if (changed) await productLocalService.saveVariants(item.productId, variants);
      }
    } else {
      const cur = await productLocalService.getStock(item.productId);
      if (cur !== null) {
        await productLocalService.saveStock(item.productId, Math.max(0, cur - item.qty));
      }
    }
  }
}

export const shopOrderSyncService = {
  // คืนรายการ "ขายใหม่" รอบนี้ เพื่อให้ caller โชว์ snackbar
  async syncPaidOrders(): Promise<{ newSales: ProcessedSale[] }> {
    if (syncing) return { newSales: [] };
    syncing = true;
    const newSales: ProcessedSale[] = [];
    try {
      // ทำงานเฉพาะเมื่อ user มีร้าน
      const shopRes = await api.getShop();
      if (!shopRes.ok || !shopRes.data) return { newSales: [] };

      const ordersRes = await api.getOrders();
      if (!ordersRes.ok) return { newSales: [] };

      const paidOrders = ordersRes.data.filter(
        o => o.status === 'PAID' || o.status === 'COMPLETED'
      );

      for (const order of paidOrders) {
        // 1) รายรับ — idempotent ด้วย sourceRef
        if (!(await isIncomeRecorded(order.orderId))) {
          const [walletId, categoryId] = await Promise.all([
            ensureShopWallet(),
            ensureIncomeCategory(),
          ]);
          const summary = order.items.map(i => `${i.name}×${i.qty}`).join(', ');
          await transactionService.create({
            amount: order.total,
            type: 'income',
            categoryId,
            walletId,
            walletNameSnapshot: WALLET_NAME,
            sourceType: SOURCE_TYPE,
            sourceRef: order.orderId,
            note: `${order.orderNo} · ${summary}`,
            date: new Date(order.paidAt ?? order.createdAt),
          });
          newSales.push({ orderId: order.orderId, orderNo: order.orderNo, total: order.total });
        }

        // 2) ตัดสต็อก — idempotent ด้วย flag แยก (กันตัดซ้ำแม้รายรับเคยบันทึกแล้ว)
        if (!(await appSettingsService.get(stockFlagKey(order.orderId)))) {
          await deductStockForOrder(order);
          await appSettingsService.set(stockFlagKey(order.orderId), '1');
        }
      }

      // 3) แจ้งเตือน (เฉพาะขายใหม่รอบนี้)
      for (const s of newSales) {
        await shopNotificationService.push({ orderNo: s.orderNo, total: s.total });
        await notificationService.sendNow(
          '🛒 ขายได้! มีออเดอร์ใหม่',
          `${s.orderNo} · ฿${s.total.toLocaleString()} ชำระเงินเรียบร้อย`,
        ).catch(() => {});
      }

      return { newSales };
    } catch {
      return { newSales };
    } finally {
      syncing = false;
    }
  },
};
