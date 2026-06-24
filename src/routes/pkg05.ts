import { Hono } from 'hono';
import type { AppVariables } from '../types.js';
import { eq, and } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { db } from '../db/client.js';
import { shops, products, orders, paymentRequests, stockDeductions } from '../db/schema.js';
import { sql } from 'drizzle-orm';
import { genId } from '../lib/id.js';
import { generatePromptPayQR } from '../lib/promptpay.js';
import { authMiddleware, requireTier } from '../middleware/auth.js';
import { config } from '../config.js';

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

// GET /pkg05/orders/:id
pkg05Router.get('/orders/:id', async (c) => {
  const userId = c.get('userId') as string;
  const shop = await db.query.shops.findFirst({ where: eq(shops.userId, userId) });
  if (!shop) return c.json({ ok: false, code: 'NOT_FOUND', message: 'ไม่มีร้าน' }, 404);

  const order = await db.query.orders.findFirst({
    where: and(eq(orders.id, c.req.param('id')), eq(orders.shopId, shop.id)),
  });
  if (!order) return c.json({ ok: false, code: 'NOT_FOUND', message: 'ไม่พบ order' }, 404);
  return c.json({ ok: true, data: toOrderResponse(order) });
});

// POST /pkg05/orders
pkg05Router.post('/orders', async (c) => {
  const userId = c.get('userId') as string;
  const shop = await db.query.shops.findFirst({ where: eq(shops.userId, userId) });
  if (!shop) return c.json({ ok: false, code: 'NOT_FOUND', message: 'สร้างร้านก่อนรับออเดอร์' }, 404);
  if (!shop.isOpen) return c.json({ ok: false, code: 'SHOP_CLOSED', message: 'ร้านปิดอยู่' }, 422);

  type CreateOrderBody = {
    items: { productId: string; qty: number; unitPrice?: number; name?: string; image?: string }[];
    customer: { name: string; phone: string; address: string };
    deliveryMethod: 'free' | 'fixed' | 'pickup';
    paymentMethod: 'promptpay' | 'bank';
    note?: string;
  };
  const body = await c.req.json<CreateOrderBody>();

  if (!body.items?.length) return c.json({ ok: false, code: 'BAD_REQUEST', message: 'ไม่มีสินค้า' }, 400);
  if (!body.customer?.name?.trim() || !body.customer?.phone?.trim()) {
    return c.json({ ok: false, code: 'BAD_REQUEST', message: 'กรุณาระบุชื่อและเบอร์โทรผู้รับ' }, 400);
  }

  // Resolve product snapshots + validate stock
  const FIXED_SHIPPING = 40;
  const resolvedItems: { productId: string; name: string; price: number; qty: number; image?: string }[] = [];
  let subtotal = 0;
  for (const ci of body.items) {
    const prod = await db.query.products.findFirst({
      where: and(eq(products.id, ci.productId), eq(products.shopId, shop.id)),
    });
    if (!prod) return c.json({ ok: false, code: 'PRODUCT_NOT_FOUND', message: `ไม่พบสินค้า ${ci.productId}` }, 404);
    if (!prod.isActive) return c.json({ ok: false, code: 'PRODUCT_UNAVAILABLE', message: `${prod.name} ไม่พร้อมขาย` }, 422);
    // variant เก็บ local บนเครื่องผู้ขาย — server ไม่รู้ราคา variant
    // ใช้ราคา/ชื่อที่ client ส่งมา (snapshot จากตะกร้า) ถ้ามี, fallback เป็นราคาฐาน
    const unitPrice = (typeof ci.unitPrice === 'number' && ci.unitPrice >= 0) ? ci.unitPrice : prod.price;
    const itemName = ci.name?.trim() || prod.name;
    resolvedItems.push({ productId: prod.id, name: itemName, price: unitPrice, qty: ci.qty, image: ci.image });
    subtotal += unitPrice * ci.qty;
  }

  const shippingCost = body.deliveryMethod === 'fixed' ? FIXED_SHIPPING : 0;
  const total = subtotal + shippingCost;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000); // 30 min

  // Generate ORDER-YYYYMMDD-XXXX
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const countResult = await db.query.orders.findMany({ where: eq(orders.shopId, shop.id) });
  const seq = String(countResult.length + 1).padStart(4, '0');
  const orderNo = `ORDER-${dateStr}-${seq}`;

  // Create PromptPay payment request if needed
  let paymentRequestId: string | undefined;
  if (body.paymentMethod === 'promptpay') {
    const reqId = genId();
    const qrPayload = generatePromptPayQR(config.promptpay.id, total);
    const uploadToken = randomBytes(32).toString('base64url');
    await db.insert(paymentRequests).values({
      id: reqId,
      userId,
      amount: total,
      description: `ออเดอร์ ${orderNo} ร้าน${shop.name}`,
      qrPayload,
      status: 'pending',
      uploadToken,
      expiresAt,
      createdAt: now,
    });
    paymentRequestId = reqId;
  }

  const orderId = genId();
  const publicToken = randomBytes(16).toString('base64url');
  await db.insert(orders).values({
    id: orderId,
    shopId: shop.id,
    orderNo,
    itemsJson: JSON.stringify(resolvedItems),
    customerName: body.customer.name.trim(),
    customerPhone: body.customer.phone.trim(),
    customerAddress: body.customer.address.trim(),
    subtotal,
    shippingCost,
    discount: 0,
    total,
    deliveryMethod: body.deliveryMethod,
    paymentMethod: body.paymentMethod,
    note: body.note?.trim() || null,
    paymentRequestId: paymentRequestId ?? null,
    expiresAt,
    publicToken,
    status: 'PENDING_PAYMENT',
    createdAt: now,
  });

  const created = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  return c.json({ ok: true, data: toOrderResponse(created!) }, 201);
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

// ── Stock deduction (idempotent) ─────────────────────────────────────────────
// ตัดสต็อกได้ครั้งเดียวต่อ paymentRef — ใช้ stockDeductions เป็น idempotency guard
async function deductStockIdempotent(order: typeof orders.$inferSelect): Promise<'deducted' | 'already_done' | 'oversell'> {
  const idempotencyKey = order.paymentRequestId ?? order.id;
  const existing = await db.query.stockDeductions.findFirst({ where: eq(stockDeductions.id, idempotencyKey) });
  if (existing) return 'already_done';

  if (!order.itemsJson) return 'already_done';
  const items = JSON.parse(order.itemsJson) as { productId: string; qty: number }[];

  // ตรวจ stock ก่อนตัด
  for (const item of items) {
    const prod = await db.query.products.findFirst({ where: eq(products.id, item.productId) });
    if (prod && prod.stock !== null && prod.stock !== undefined && prod.stock < item.qty) {
      return 'oversell';
    }
  }

  // ตัดสต็อกทุก item
  for (const item of items) {
    await db.update(products)
      .set({ stock: sql`GREATEST(0, COALESCE(stock, 999) - ${item.qty})` })
      .where(eq(products.id, item.productId));
  }

  // บันทึก idempotency record
  await db.insert(stockDeductions).values({
    id: idempotencyKey,
    orderId: order.id,
    deductedAt: new Date(),
  });

  return 'deducted';
}

// PATCH /pkg05/orders/:id/status
pkg05Router.patch('/orders/:id/status', async (c) => {
  const userId = c.get('userId') as string;
  const shop = await db.query.shops.findFirst({ where: eq(shops.userId, userId) });
  if (!shop) return c.json({ ok: false, code: 'NOT_FOUND', message: 'ไม่มีร้าน' }, 404);

  const order = await db.query.orders.findFirst({
    where: and(eq(orders.id, c.req.param('id')), eq(orders.shopId, shop.id)),
  });
  if (!order) return c.json({ ok: false, code: 'NOT_FOUND', message: 'ไม่พบ order' }, 404);

  const { status } = await c.req.json<{ status: string }>();
  const now = new Date();
  const extra: Partial<typeof orders.$inferInsert> = status === 'PAID' ? { paidAt: now } : {};
  await db.update(orders).set({ status: status as any, ...extra }).where(eq(orders.id, order.id));

  // ตัดสต็อก idempotent เมื่อ transition เข้า PAID
  if (status === 'PAID') {
    const result = await deductStockIdempotent(order);
    if (result === 'oversell') {
      await db.update(orders).set({ status: 'OVERSELL_FLAGGED' as any }).where(eq(orders.id, order.id));
    }
  }

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
  // New v2 order (has itemsJson)
  if (o.itemsJson) {
    const items = JSON.parse(o.itemsJson) as { productId: string; name: string; price: number; qty: number; image?: string }[];
    return {
      orderId: o.id,
      orderNo: o.orderNo ?? o.id,
      shopId: o.shopId,
      customer: {
        name: o.customerName ?? '',
        phone: o.customerPhone ?? '',
        address: o.customerAddress ?? '',
      },
      items,
      subtotal: o.subtotal ?? 0,
      shippingCost: o.shippingCost ?? 0,
      discount: o.discount ?? 0,
      total: o.total ?? 0,
      deliveryMethod: o.deliveryMethod as 'free' | 'fixed' | 'pickup' ?? 'free',
      paymentMethod: o.paymentMethod as 'promptpay' | 'bank' ?? 'promptpay',
      note: o.note ?? undefined,
      status: o.status,
      paymentRequestId: o.paymentRequestId ?? undefined,
      expiresAt: o.expiresAt ? (o.expiresAt as Date).toISOString() : new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      publicToken: o.publicToken ?? '',
      paidAt: o.paidAt ? (o.paidAt as Date).toISOString() : undefined,
      createdAt: (o.createdAt as Date).toISOString(),
    };
  }
  // Legacy v1 order (single product, backward compat)
  return {
    orderId: o.id,
    orderNo: o.id,
    shopId: o.shopId,
    customer: { name: o.buyerName ?? '', phone: '', address: '' },
    items: o.productId ? [{ productId: o.productId, name: o.productName ?? '', price: o.amount ?? 0, qty: 1 }] : [],
    subtotal: o.amount ?? 0,
    shippingCost: 0,
    discount: 0,
    total: o.amount ?? 0,
    deliveryMethod: 'free' as const,
    paymentMethod: 'promptpay' as const,
    status: o.status,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    publicToken: '',
    paidAt: o.paidAt ? (o.paidAt as Date).toISOString() : undefined,
    createdAt: (o.createdAt as Date).toISOString(),
  };
}
