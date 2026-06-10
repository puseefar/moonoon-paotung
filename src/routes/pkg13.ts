import { Hono } from 'hono';
import type { AppVariables } from '../types.js';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { lineConnections, lineNotifLog } from '../db/schema.js';
import { genId } from '../lib/id.js';
import { config } from '../config.js';
import { authMiddleware, requireTier } from '../middleware/auth.js';

export const pkg13Router = new Hono<{ Variables: AppVariables }>();
pkg13Router.use('*', authMiddleware);
pkg13Router.use('*', requireTier('pro', 'server', 'business'));

// GET /pkg13/connection
pkg13Router.get('/connection', async (c) => {
  const userId = c.get('userId') as string;
  const conn = await db.query.lineConnections.findFirst({ where: eq(lineConnections.userId, userId) });
  if (!conn) {
    return c.json({ ok: true, data: { connected: false, notificationsEnabled: false } });
  }
  return c.json({
    ok: true, data: {
      connected: true,
      lineUserId: conn.lineUserId,
      displayName: conn.displayName,
      notificationsEnabled: conn.notificationsEnabled,
      paymentAlerts: conn.paymentAlerts,
      orderAlerts: conn.orderAlerts,
      dailyDigest: conn.dailyDigest,
      connectedAt: (conn.connectedAt as Date).toISOString(),
    },
  });
});

// GET /pkg13/connect-url
// คืน URL สำหรับให้ user ผูก LINE Login (ต้องใช้ LINE Login Channel ID ไม่ใช่ Messaging API)
pkg13Router.get('/connect-url', async (c) => {
  if (!config.line.isLoginReady) {
    return c.json({ ok: false, code: 'LINE_LOGIN_NOT_CONFIGURED', message: 'LINE Login ยังไม่ได้ตั้งค่า LINE_LOGIN_CHANNEL_ID' }, 503);
  }
  const userId = c.get('userId') as string;
  const state = Buffer.from(JSON.stringify({ userId, ts: Date.now() })).toString('base64url');
  const url = `https://access.line.me/oauth2/v2.1/authorize?response_type=code`
    + `&client_id=${config.line.loginChannelId}`
    + `&redirect_uri=${encodeURIComponent(config.line.callbackUrl)}`
    + `&state=${state}&scope=profile`;
  return c.json({ ok: true, data: { connectUrl: url, state } });
});

// GET /pkg13/callback (LINE OAuth callback)
pkg13Router.get('/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');

  if (error) {
    console.error('[LINE Callback] OAuth error:', error, c.req.query('error_description'));
    return c.redirect(`poatung://line-callback?success=0&error=${encodeURIComponent(error)}`);
  }
  if (!code || !state) {
    return c.redirect(`poatung://line-callback?success=0&error=invalid_params`);
  }

  // 1. Decode state → userId
  let userId: string;
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf-8'));
    userId = decoded.userId as string;
    if (!userId) throw new Error('No userId in state');
  } catch {
    return c.redirect(`poatung://line-callback?success=0&error=invalid_state`);
  }

  try {
    // 2. Exchange code → access token (ใช้ LINE Login credentials ไม่ใช่ Messaging API)
    const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.line.callbackUrl,
        client_id: config.line.loginChannelId,
        client_secret: config.line.loginChannelSecret,
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error('[LINE Callback] Token exchange failed:', errBody);
      return c.redirect(`poatung://line-callback?success=0&error=token_exchange_failed`);
    }
    const tokenData = await tokenRes.json() as { access_token: string };

    // 3. Get LINE user profile
    const profileRes = await fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!profileRes.ok) {
      console.error('[LINE Callback] Profile fetch failed:', profileRes.status);
      return c.redirect(`poatung://line-callback?success=0&error=profile_failed`);
    }
    const profile = await profileRes.json() as {
      userId: string;
      displayName: string;
      pictureUrl?: string;
    };

    // 4. Upsert lineConnections
    const now = new Date();
    const existing = await db.query.lineConnections.findFirst({
      where: eq(lineConnections.userId, userId),
    });

    if (existing) {
      await db.update(lineConnections)
        .set({ lineUserId: profile.userId, displayName: profile.displayName, notificationsEnabled: true, updatedAt: now })
        .where(eq(lineConnections.userId, userId));
    } else {
      await db.insert(lineConnections).values({
        userId,
        lineUserId: profile.userId,
        displayName: profile.displayName,
        notificationsEnabled: true,
        paymentAlerts: true,
        orderAlerts: true,
        dailyDigest: false,
        connectedAt: now,
        updatedAt: now,
      });
    }

    console.log(`[LINE Callback] Connected userId=${userId} → lineUserId=${profile.userId}`);
    return c.redirect(`poatung://line-callback?success=1&displayName=${encodeURIComponent(profile.displayName)}`);

  } catch (err) {
    console.error('[LINE Callback] Unexpected error:', err);
    return c.redirect(`poatung://line-callback?success=0&error=server_error`);
  }
});

// DELETE /pkg13/connection
pkg13Router.delete('/connection', async (c) => {
  const userId = c.get('userId') as string;
  await db.delete(lineConnections).where(eq(lineConnections.userId, userId));
  return c.json({ ok: true, data: { success: true } });
});

// PUT /pkg13/notifications
pkg13Router.put('/notifications', async (c) => {
  const userId = c.get('userId') as string;
  const body = await c.req.json<{
    enabled?: boolean; paymentAlerts?: boolean; orderAlerts?: boolean; dailyDigest?: boolean;
  }>();

  const now = new Date();
  const conn = await db.query.lineConnections.findFirst({ where: eq(lineConnections.userId, userId) });
  if (!conn) return c.json({ ok: false, code: 'NOT_CONNECTED', message: 'ยังไม่ได้ผูก LINE' }, 404);

  const updates = {
    ...(body.enabled !== undefined && { notificationsEnabled: body.enabled }),
    ...(body.paymentAlerts !== undefined && { paymentAlerts: body.paymentAlerts }),
    ...(body.orderAlerts !== undefined && { orderAlerts: body.orderAlerts }),
    ...(body.dailyDigest !== undefined && { dailyDigest: body.dailyDigest }),
    updatedAt: now,
  };
  await db.update(lineConnections).set(updates).where(eq(lineConnections.userId, userId));

  return c.json({ ok: true, data: { ...conn, ...updates, connectedAt: (conn.connectedAt as Date).toISOString() } });
});

// ── Internal helper — ส่ง LINE message ──────────────────────────────────────
export async function sendLineMessage(lineUserId: string, text: string): Promise<boolean> {
  if (!config.line.channelAccessToken) {
    console.warn('[DEV] LINE token not set — skipping message');
    return false;
  }
  try {
    const res = await fetch(`${config.line.apiBase}/message/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.line.channelAccessToken}`,
      },
      body: JSON.stringify({ to: lineUserId, messages: [{ type: 'text', text }] }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function notifyPaymentPaid(userId: string, amount: number, refId: string) {
  const conn = await db.query.lineConnections.findFirst({ where: eq(lineConnections.userId, userId) });
  if (!conn?.notificationsEnabled || !conn.paymentAlerts) return;

  const text = `✅ รับชำระเงินสำเร็จ\nยอด: ฿${amount.toFixed(2)}\nRef: ${refId}\n🔒 ยืนยันโดย Poatung`;
  const sent = await sendLineMessage(conn.lineUserId, text);

  await db.insert(lineNotifLog).values({
    id: genId(), userId, type: 'payment',
    status: sent ? 'sent' : 'failed',
    errorMessage: sent ? null : 'send failed',
    sentAt: new Date(),
  });
}
