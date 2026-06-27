// ── shopNotificationService ────────────────────────────────────────────────
// เก็บ list การแจ้งเตือน "ขายได้" ในแอป (in-app inbox) ผ่าน appSettings (SQLite)
// ใช้คู่กับ Local Push (notificationService.sendNow) — push เด้งทันที, list ไว้ดูย้อนหลัง
import { appSettingsService } from '@/services/appSettingsService';

const KEY = 'shop.notifications';
const MAX = 50;

export interface ShopNotification {
  id: string;
  orderNo: string;
  total: number;
  createdAt: string; // ISO
  read: boolean;
}

export const shopNotificationService = {
  async getAll(): Promise<ShopNotification[]> {
    return (await appSettingsService.getJson<ShopNotification[]>(KEY)) ?? [];
  },

  async push(input: { orderNo: string; total: number }): Promise<void> {
    const list = await this.getAll();
    const item: ShopNotification = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      orderNo: input.orderNo,
      total: input.total,
      createdAt: new Date().toISOString(),
      read: false,
    };
    await appSettingsService.setJson(KEY, [item, ...list].slice(0, MAX));
  },

  async unreadCount(): Promise<number> {
    return (await this.getAll()).filter(n => !n.read).length;
  },

  async markAllRead(): Promise<void> {
    const list = await this.getAll();
    await appSettingsService.setJson(KEY, list.map(n => ({ ...n, read: true })));
  },
};
