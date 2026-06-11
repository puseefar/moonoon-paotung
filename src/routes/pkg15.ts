import { Hono } from 'hono';
import type { AppVariables } from '../types.js';
import { eq, and } from 'drizzle-orm';
import { createHash } from 'crypto';
import { db } from '../db/client.js';
import { paymentRequests, slipUsed, actionLog } from '../db/schema.js';
import { genId } from '../lib/id.js';
import { generatePromptPayQR } from '../lib/promptpay.js';
import { authMiddleware, requireTier } from '../middleware/auth.js';
import { config } from '../config.js';
import { notifyPaymentPaid } from './pkg13.js';

export const pkg15Router = new Hono<{ Variables: AppVariables }>();
pkg15Router.use('*', authMiddleware);
pkg15Router.use('*', requireTier('pro', 'server', 'business'));

// POST /pkg15/payment
// สร้าง payment request + QR payload
pkg15Router.post('/payment', async (c) => {
  const userId = c.get('userId') as string;
  const body = await c.req.json<{ amount: number; description?: string }>();

  if (!body.amount || body.amount <= 0) {
    return c.json({ ok: false, code: 'BAD_REQUEST', message: 'amount must be > 0' }, 400);
  }
  if (body.amount > 100000) {
    return c.json({ ok: false, code: 'AMOUNT_TOO_LARGE', message: 'amount สูงสุด 100,000 บาท' }, 400);
  }

  const id = genId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.payment.qrExpiryHours * 60 * 60 * 1000);
  const qrPayload = generatePromptPayQR(config.promptpay.id, body.amount);

  await db.insert(paymentRequests).values({
    id, userId, amount: body.amount,
    description: body.description ?? 'ชำระเงิน',
    qrPayload, status: 'pending',
    expiresAt, createdAt: now,
  });

  // log
  await db.insert(actionLog).values({
    id: genId(), userId, action: 'payment.create',
    meta: JSON.stringify({ requestId: id, amount: body.amount }),
    ip: c.req.header('x-forwarded-for') ?? 'unknown',
    createdAt: now,
  });

  return c.json({
    ok: true,
    data: {
      requestId: id,
      amount: body.amount,
      description: body.description ?? 'ชำระเงิน',
      qrPayload,
      promptPayId: config.promptpay.id,
      status: 'pending',
      expiresAt: expiresAt.toISOString(),
      createdAt: now.toISOString(),
    },
  });
});

// GET /pkg15/payment/:id
pkg15Router.get('/payment/:id', async (c) => {
  const userId = c.get('userId') as string;
  const req = await db.query.paymentRequests.findFirst({
    where: and(eq(paymentRequests.id, c.req.param('id')), eq(paymentRequests.userId, userId)),
  });
  if (!req) return c.json({ ok: false, code: 'NOT_FOUND', message: 'Not found' }, 404);

  // Auto-expire check
  if (req.status === 'pending' && req.expiresAt < new Date()) {
    await db.update(paymentRequests).set({ status: 'expired' }).where(eq(paymentRequests.id, req.id));
    req.status = 'expired';
  }

  return c.json({ ok: true, data: toPaymentResponse(req) });
});

// POST /pkg15/verify-slip
// ⚠️ CRITICAL: Slip dedupe — ref_hash ต้องไม่ซ้ำ
pkg15Router.post('/verify-slip', async (c) => {
  const userId = c.get('userId') as string;
  const body = await c.req.json<{ requestId: string; slipImageBase64: string }>();

  const req = await db.query.paymentRequests.findFirst({
    where: and(eq(paymentRequests.id, body.requestId), eq(paymentRequests.userId, userId)),
  });
  if (!req) {
    return c.json({ ok: false, code: 'NOT_FOUND', message: 'Payment request not found' }, 404);
  }
  if (req.status !== 'pending') {
    return c.json({ ok: true, data: { verified: false, errorCode: 'DUPLICATE', errorMessage: 'สลิปนี้ถูกใช้แล้วหรือหมดอายุ' } });
  }
  if (req.expiresAt < new Date()) {
    await db.update(paymentRequests).set({ status: 'expired' }).where(eq(paymentRequests.id, req.id));
    return c.json({ ok: true, data: { verified: false, errorCode: 'EXPIRED', errorMessage: 'QR หมดอายุแล้ว' } });
  }

  // ── ส่งสลิปไป SlipOK API ──
  let verified = false;
  let refId: string | undefined;
  let amount: number | undefined;

  if (config.thunder.isReady) {
    // ── Thunder Slip Verify API — multipart/form-data (confirmed format) ──
    try {
      const imageBuffer = Buffer.from(body.slipImageBase64, 'base64');
      const formData = new FormData();
      formData.append(
        'file',
        new Blob([imageBuffer], { type: 'image/jpeg' }),
        'slip.jpg',
      );
      const res = await fetch(config.thunder.apiUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${config.thunder.apiKey}` },
        // ไม่ใส่ Content-Type — ให้ fetch set boundary ของ multipart เอง
        body: formData,
      });
      const json = await res.json() as any;
      console.log('[Thunder] response:', JSON.stringify(json));
      if (json.success === true) {
        verified = true;
        refId = json.data?.transRef ?? json.data?.ref_id ?? json.data?.id ?? `THUNDER-${Date.now()}`;
        amount = parseFloat(String(json.data?.amount ?? req.amount));
      }
    } catch (e) {
      console.error('[Thunder] API error:', e);
    }
  } else {
    // Dev mode — mock verification (ใช้จนกว่าจะใส่ THUNDER_API_URL)
    console.warn('[DEV] Thunder API URL not set — using mock verification');
    verified = true;
    refId = `REF-DEV-${Date.now()}`;
    amount = req.amount;
  }

  if (!verified) {
    return c.json({ ok: true, data: { verified: false, errorCode: 'INVALID', errorMessage: 'ยืนยันสลิปไม่สำเร็จ' } });
  }

  // Dedupe check via ref_hash
  const refHash = createHash('sha256').update(refId!).digest('hex');
  const existing = await db.query.slipUsed.findFirst({ where: eq(slipUsed.refHash, refHash) });
  if (existing) {
    return c.json({ ok: true, data: { verified: false, errorCode: 'DUPLICATE', errorMessage: 'สลิปนี้ถูกใช้แล้ว (Ref ซ้ำ)' } });
  }

  // Amount check
  if (Math.abs((amount ?? 0) - req.amount) > 0.01) {
    return c.json({ ok: true, data: { verified: false, errorCode: 'AMOUNT_MISMATCH', errorMessage: `ยอดไม่ตรง (สลิป: ${amount}฿, ที่ต้องการ: ${req.amount}฿)` } });
  }

  const now = new Date();
  // Mark slip as used
  await db.insert(slipUsed).values({ refHash, requestId: req.id, usedAt: now });
  // Update payment status
  await db.update(paymentRequests).set({ status: 'paid', refId: refId!, refHash, paidAt: now }).where(eq(paymentRequests.id, req.id));

  // Fire-and-forget LINE push (ไม่ block response ถ้า LINE API ช้า)
  notifyPaymentPaid(userId, req.amount, refId!).catch(() => {});

  // log
  await db.insert(actionLog).values({
    id: genId(), userId, action: 'slip.verify.success',
    meta: JSON.stringify({ requestId: req.id, refId, amount }),
    ip: c.req.header('x-forwarded-for') ?? 'unknown',
    createdAt: now,
  });

  return c.json({ ok: true, data: { verified: true, amount, refId, timestamp: now.toISOString() } });
});

function toPaymentResponse(req: typeof paymentRequests.$inferSelect) {
  return {
    requestId: req.id, amount: req.amount, description: req.description,
    qrPayload: req.qrPayload, promptPayId: config.promptpay.id,
    status: req.status, refId: req.refId ?? undefined,
    expiresAt: (req.expiresAt as Date).toISOString(),
    paidAt: req.paidAt ? (req.paidAt as Date).toISOString() : undefined,
    createdAt: (req.createdAt as Date).toISOString(),
  };
}
