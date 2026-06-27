// ── shopAnalyticsService ────────────────────────────────────────────────────
// คำนวณ analytics ร้านค้าฝั่ง device จากออเดอร์จริง (server ไม่มี endpoint /analytics)
// PKG-05.1: กำไร = "ขั้นต้น" จาก snapshot ต้นทุน (item.unitCost) ของแต่ละรายการ
//   - รายการที่ไม่มีต้นทุน (unitCost == null) → ไม่นำเข้าสูตรกำไร + ติดธงเตือน (ห้ามเดา = 0)
import { api } from '@/lib/api/client';
import type {
  ShopAnalytics, Order, OrderLineItem, SalesDataPoint, ProductStat,
} from '@/lib/api/contract';

const TH_DOW = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

const isPaid    = (o: Order) => o.status === 'PAID' || o.status === 'COMPLETED';
const isPending = (o: Order) => o.status === 'PENDING_PAYMENT' || o.status === 'VERIFYING_SLIP';
const orderDate = (o: Order) => new Date(o.paidAt ?? o.createdAt);
const hasCost   = (i: OrderLineItem) => typeof i.unitCost === 'number';
// กำไรขั้นต้นต่อรายการ — เฉพาะรายการที่มีต้นทุน
const itemProfit = (i: OrderLineItem) => hasCost(i) ? (i.price - (i.unitCost as number)) * i.qty : 0;

export const shopAnalyticsService = {
  async compute(period: 'week' | 'month'): Promise<ShopAnalytics> {
    const days = period === 'week' ? 7 : 30;

    const [ordersRes, productsRes] = await Promise.all([api.getOrders(), api.getProducts()]);
    const orders   = ordersRes.ok ? ordersRes.data : [];
    const products = productsRes.ok ? productsRes.data : [];

    // map productId → ชื่อ/รูปฐาน (กัน name ติด label variant ใน top products)
    const meta = new Map(products.map(p => [p.productId, { name: p.name, image: p.images?.[0] }]));

    // ช่วงเวลา: ย้อนหลัง N วันรวมวันนี้
    const start = new Date(); start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    const rangeOrders = orders.filter(o => orderDate(o) >= start);
    const paidOrders  = rangeOrders.filter(isPaid);

    const totalRevenue    = paidOrders.reduce((s, o) => s + o.total, 0);
    const completedOrders = paidOrders.length;
    const pendingOrders   = rangeOrders.filter(isPending).length;
    const totalOrders     = rangeOrders.length;
    const avgOrderValue   = completedOrders > 0 ? totalRevenue / completedOrders : 0;

    // ── กำไรขั้นต้น เฉพาะรายการที่มีต้นทุน ──
    let grossProfit = 0;
    let revenueWithCost = 0;
    let itemsTotal = 0;
    let itemsWithCost = 0;
    for (const o of paidOrders) {
      for (const it of o.items) {
        itemsTotal += 1;
        if (hasCost(it)) {
          itemsWithCost += 1;
          grossProfit     += itemProfit(it);
          revenueWithCost += it.price * it.qty;
        }
      }
    }
    const hasCostData    = itemsWithCost > 0;
    const profitComplete = itemsTotal > 0 && itemsWithCost === itemsTotal;

    // ── กราฟรายวัน (กำไรในกราฟ = gross เฉพาะรายการที่มีต้นทุน) ──
    const buckets: SalesDataPoint[] = [];
    const idx = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      idx.set(dayKey(d), buckets.length);
      buckets.push({
        date: d.toISOString().slice(0, 10),
        label: period === 'week' ? TH_DOW[d.getDay()] : String(d.getDate()),
        revenue: 0, orders: 0, profit: 0,
      });
    }
    for (const o of paidOrders) {
      const i = idx.get(dayKey(orderDate(o)));
      if (i !== undefined) {
        buckets[i].revenue += o.total;
        buckets[i].orders  += 1;
        buckets[i].profit  += o.items.reduce((s, it) => s + itemProfit(it), 0);
      }
    }

    // ── สินค้าขายดี (รวมทุก variant เข้าสินค้าเดียว) ──
    type Agg = ProductStat & { _itemsTotal: number; _itemsWithCost: number };
    const stat = new Map<string, Agg>();
    for (const o of paidOrders) {
      for (const it of o.items) {
        const m = meta.get(it.productId);
        const cur = stat.get(it.productId) ?? {
          productId: it.productId,
          name: m?.name ?? it.name,
          image: m?.image ?? it.image,
          totalQty: 0, totalRevenue: 0, totalProfit: 0, profitKnown: true,
          _itemsTotal: 0, _itemsWithCost: 0,
        };
        cur.totalQty     += it.qty;
        cur.totalRevenue += it.price * it.qty;
        cur.totalProfit  += itemProfit(it);
        cur._itemsTotal  += 1;
        if (hasCost(it)) cur._itemsWithCost += 1;
        stat.set(it.productId, cur);
      }
    }
    const topProducts: ProductStat[] = [...stat.values()]
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 5)
      .map(({ _itemsTotal, _itemsWithCost, ...p }) => ({
        ...p,
        // รู้กำไรเฉพาะเมื่อทุกชิ้นที่ขายมีต้นทุนครบ
        profitKnown: _itemsTotal > 0 && _itemsWithCost === _itemsTotal,
      }));

    return {
      period, totalRevenue, totalOrders,
      totalProfit: grossProfit, avgOrderValue,
      completedOrders, pendingOrders, dailySales: buckets, topProducts,
      hasCostData, profitComplete, revenueWithCost,
    };
  },
};
