import { Hono } from 'hono';
import type { AppVariables } from '../types.js';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { shops, products, orders } from '../db/schema.js';
import { genId } from '../lib/id.js';
import { authMiddleware, requireTier } from '../middleware/auth.js';

export const pkg05Router = new Hono<{ Variables: AppVariables }>();
pkg05Router.use('*', authMiddleware);
pkg05Router.use('*', requireTier('server', 'business'));

const MAX_PRODUCTS = 5; // Hard limit ตามเอกสาร

// ── Shop ──────────────────────────────────────────────────────────────────────

// GET /pkg05/shop
pkg05Router.get('/shop', async (c) => {
  const userId = c.get('userId') as string;
  const shop = await db.query.shops.findFirst({ where: eq(shops.userId, userId) });
  if (!shop) return c.json({ ok: true, data: null });

  const productCount = (await db.query.products.findMany({ where: eq(products.shopId, shop.id) })).length;
  return c.json({ ok: true, data: toShopResponse(shop, productCount) });
});

// POST /pkg05/shop
pkg05Router.post('/shop', async (c) => {
  const userId = c.get('userId') as string;
  const existing = await db.query.shops.findFirst({ where: eq(shops.userId, userId) });
  if (existing) return c.json({ ok: false, code: 'SHOP_EXISTS', message: 'มีร้านอยู่แล้ว (1 ร้าน/1 user)' }, 409);

  const body = await c.req.json<{ name: string; description?: string; phone: string }>();
  if (!body.name?.trim() || !body.phone?.trim()) {
    return c.json({ ok: false, code: 'BAD_REQUEST', message: 'name และ phone ต้องมี' }, 400);
  }

  const now = new Date();
  const id = genId();
  await db.insert(shops).values({
    id, userId, name: body.name.trim(),
    description: body.description?.trim() ?? '',
    phone: body.phone.trim(), isOpen: true, createdAt: now, updatedAt: now,
  });

  const shop = await db.query.shops.findFirst({ where: eq(shops.id, id) });
  return c.json({ ok: true, data: toShopResponse(shop!, 0) }, 201);
});

// PATCH /pkg05/shop
pkg05Router.patch('/shop', async (c) => {
  const userId = c.get('userId') as string;
  const shop = await db.query.shops.findFirst({ where: eq(shops.userId, userId) });
  if (!shop) return c.json({ ok: false, code: 'NOT_FOUND', message: 'ไม่มีร้าน' }, 404);

  const body = await c.req.json<Partial<{ name: string; description: string; phone: string; isOpen: boolean }>>();
  const now = new Date();
  await db.update(shops).set({ ...body, updatedAt: now }).where(eq(shops.id, shop.id));

  const updated = await db.query.shops.findFirst({ where: eq(shops.id, shop.id) });
  const productCount = (await db.query.products.findMany({ where: eq(products.shopId, shop.id) })).length;
  return c.json({ ok: true, data: toShopResponse(updated!, productCount) });
});

// ── Products ──────────────────────────────────────────────────────────────────

// GET /pkg05/products
pkg05Router.get('/products', async (c) => {
  const userId = c.get('userId') as string;
  const shop = await db.query.shops.findFirst({ where: eq(shops.userId, userId) });
  if (!shop) return c.json({ ok: true, data: [] });

  const prods = await db.query.products.findMany({ where: eq(products.shopId, shop.id) });
  return c.json({ ok: true, data: prods.map(toProductResponse) });
});

// POST /pkg05/products
pkg05Router.post('/products', async (c) => {
  const userId = c.get('userId') as string;
  const shop = await db.query.shops.findFirst({ where: eq(shops.userId, userId) });
  if (!shop) return c.json({ ok: false, code: 'NO_SHOP', message: 'สร้างร้านก่อน' }, 404);

  const existingCount = (await db.query.products.findMany({ where: eq(products.shopId, shop.id) })).length;
  if (existingCount >= MAX_PRODUCTS) {
    return c.json({ ok: false, code: 'LIMIT_EXCEEDED', message: `ร้านของคุณมีสินค้าครบ ${MAX_PRODUCTS} ชิ้นแล้ว` }, 422);
  }

  const body = await c.req.json<{ name: string; price: number; description?: string }>();
  if (!body.name?.trim() || !body.price || body.price <= 0) {
    return c.json({ ok: false, code: 'BAD_REQUEST', message: 'name และ price ต้องมี' }, 400);
  }

  const id = genId();
  await db.insert(products).values({
    id, shopId: shop.id, name: body.name.trim(),
    price: body.price, description: body.description?.trim() ?? '',
    isActive: true, sortOrder: existingCount, createdAt: new Date(),
  });

  const prod = await db.query.products.findFirst({ where: eq(products.id, id) });
  return c.json({ ok: true, data: toProductResponse(prod!) }, 201);
});

// DELETE /pkg05/products/:id
pkg05Router.delete('/products/:id', async (c) => {
  const userId = c.get('userId') as string;
  const shop = await db.query.shops.findFirst({ where: eq(shops.userId, userId) });
  if (!shop) return c.json({ ok: false, code: 'NOT_FOUND', message: 'ไม่มีร้าน' }, 404);

  const prod = await db.query.products.findFirst({
    where: and(eq(products.id, c.req.param('id')), eq(products.shopId, shop.id)),
  });
  if (!prod) return c.json({ ok: false, code: 'NOT_FOUND', message: 'ไม่พบสินค้า' }, 404);

  await db.delete(products).where(eq(products.id, prod.id));
  return c.json({ ok: true, data: { success: true } });
});

// ── Orders ────────────────────────────────────────────────────────────────────

// GET /pkg05/orders
pkg05Router.get('/orders', async (c) => {
  const userId = c.get('userId') as string;
  const shop = await db.query.shops.findFirst({ where: eq(shops.userId, userId) });
  if (!shop) return c.json({ ok: true, data: [] });

  const orderList = await db.query.orders.findMany({ where: eq(orders.shopId, shop.id) });
  return c.json({ ok: true, data: orderList.map(toOrderResponse) });
});

// POST /pkg05/orders/:id/confirm
pkg05Router.post('/orders/:id/confirm', async (c) => {
  const userId = c.get('userId') as string;
  const shop = await db.query.shops.findFirst({ where: eq(shops.userId, userId) });
  if (!shop) return c.json({ ok: false, code: 'NOT_FOUND', message: 'ไม่มีร้าน' }, 404);

  const order = await db.query.orders.findFirst({
    where: and(eq(orders.id, c.req.param('id')), eq(orders.shopId, shop.id)),
  });
  if (!order) return c.json({ ok: false, code: 'NOT_FOUND', message: 'ไม่พบ order' }, 404);
  if (order.status !== 'pending') {
    return c.json({ ok: false, code: 'INVALID_STATUS', message: `Order อยู่ในสถานะ ${order.status} แล้ว` }, 422);
  }

  await db.update(orders).set({ status: 'confirmed' }).where(eq(orders.id, order.id));
  const updated = await db.query.orders.findFirst({ where: eq(orders.id, order.id) });
  return c.json({ ok: true, data: toOrderResponse(updated!) });
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function toShopResponse(shop: typeof shops.$inferSelect, productCount: number) {
  return {
    shopId: shop.id, name: shop.name, description: shop.description,
    phone: shop.phone, isOpen: shop.isOpen, productCount,
    createdAt: (shop.createdAt as Date).toISOString(),
  };
}

function toProductResponse(p: typeof products.$inferSelect) {
  return {
    productId: p.id, shopId: p.shopId, name: p.name, price: p.price,
    description: p.description, isActive: p.isActive, sortOrder: p.sortOrder,
    createdAt: (p.createdAt as Date).toISOString(),
  };
}

function toOrderResponse(o: typeof orders.$inferSelect) {
  return {
    orderId: o.id, shopId: o.shopId, productId: o.productId,
    productName: o.productName, amount: o.amount, status: o.status,
    buyerName: o.buyerName ?? undefined, buyerLineId: o.buyerLineId ?? undefined,
    refId: o.refId ?? undefined,
    createdAt: (o.createdAt as Date).toISOString(),
    paidAt: o.paidAt ? (o.paidAt as Date).toISOString() : undefined,
  };
}
