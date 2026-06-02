// ── LINE Webhook Handler ──────────────────────────────────────────────────────
// ⚠️ ไม่มี authMiddleware — ใช้ LINE Signature Verification แทน
// LINE Platform ยิง POST มาพร้อม x-line-signature header
import { Hono } from 'hono';
import { createHmac } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { lineConnections } from '../db/schema.js';
import { config } from '../config.js';
import { genId } from '../lib/id.js';

export const webhookRouter = new Hono();

// POST /webhook/line — LINE Messaging API webhook
webhookRouter.post('/line', async (c) => {
  const signature = c.req.header('x-line-signature');
  const rawBody = await c.req.text();

  // 1. Verify LINE Signature
  if (config.line.channelSecret && signature) {
    const expectedSig = createHmac('sha256', config.line.channelSecret)
      .update(rawBody)
      .digest('base64');

    if (expectedSig !== signature) {
      // Log mismatch สำหรับ debug แต่ผ่านใน staging ถ้า NODE_ENV !== production
      console.warn('[LINE Webhook] Signature mismatch — expected:', expectedSig.slice(0, 10), 'got:', signature.slice(0, 10));
      if (config.nodeEnv === 'production') {
        return c.json({ status: 'error', message: 'Invalid signature' }, 401);
      }
      // staging: ผ่านต่อแม้ sig ไม่ตรง (เพื่อ LINE verification test)
      console.warn('[LINE Webhook] Allowing in non-production mode');
    }
  } else if (!signature) {
    // ไม่มี sig เลย → reject
    return c.json({ status: 'error', message: 'Missing x-line-signature' }, 400);
  }

  // 2. Parse events
  let body: { events?: any[] };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return c.json({ status: 'error', message: 'Invalid JSON' }, 400);
  }

  const events = body.events ?? [];
  console.log(`[LINE Webhook] ${events.length} event(s) received`);

  // 3. Process each event
  for (const event of events) {
    const lineUserId = event.source?.userId as string | undefined;
    if (!lineUserId) continue;

    switch (event.type) {
      // ผู้ใช้กด "Add Friend" หรือ Unblock → บันทึก connection ถ้าเชื่อมอยู่
      case 'follow':
        console.log(`[LINE Webhook] Follow: ${lineUserId}`);
        // Upsert connection ถ้ามีอยู่แล้ว → อัปเดต connectedAt
        try {
          const existing = await db.query.lineConnections.findFirst({
            where: eq(lineConnections.lineUserId, lineUserId),
          });
          if (existing) {
            await db.update(lineConnections)
              .set({ notificationsEnabled: true, updatedAt: new Date() })
              .where(eq(lineConnections.lineUserId, lineUserId));
          }
        } catch (e) {
          console.error('[LINE Webhook] follow error:', e);
        }
        break;

      // ผู้ใช้ Block → ปิด notification
      case 'unfollow':
        console.log(`[LINE Webhook] Unfollow: ${lineUserId}`);
        try {
          await db.update(lineConnections)
            .set({ notificationsEnabled: false, updatedAt: new Date() })
            .where(eq(lineConnections.lineUserId, lineUserId));
        } catch (e) {
          console.error('[LINE Webhook] unfollow error:', e);
        }
        break;

      // ข้อความจากผู้ใช้ (จะขยายเพิ่มภายหลัง)
      case 'message':
        console.log(`[LINE Webhook] Message from ${lineUserId}:`, event.message?.text ?? '[non-text]');
        break;

      default:
        console.log(`[LINE Webhook] Unhandled event type: ${event.type}`);
    }
  }

  // 4. ต้องตอบ 200 ภายใน timeout เสมอ
  return c.json({ status: 'ok' });
});

// GET /webhook/line — LINE Developers Console ใช้ verify URL
webhookRouter.get('/line', (c) => c.json({ status: 'ok', service: 'LINE Webhook' }));
