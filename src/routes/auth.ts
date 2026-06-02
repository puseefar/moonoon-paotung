import { Hono } from 'hono';
import type { AppVariables } from '../types.js';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { signToken } from '../lib/jwt.js';
import { genId } from '../lib/id.js';
import { authMiddleware } from '../middleware/auth.js';

export const authRouter = new Hono<{ Variables: AppVariables }>();

// POST /auth/device-login
// แอปส่ง deviceId → ได้ JWT + tier กลับ
authRouter.post('/device-login', async (c) => {
  const body = await c.req.json<{ deviceId: string }>();
  if (!body.deviceId?.trim()) {
    return c.json({ ok: false, code: 'BAD_REQUEST', message: 'deviceId required' }, 400);
  }

  const now = new Date();
  let user = await db.query.users.findFirst({
    where: eq(users.deviceId, body.deviceId),
  });

  if (!user) {
    const id = genId();
    await db.insert(users).values({
      id, deviceId: body.deviceId,
      tier: 'server', // Dev default — production จะเป็น 'free'
      createdAt: now, updatedAt: now,
    });
    user = { id, deviceId: body.deviceId, tier: 'server', createdAt: now, updatedAt: now };
  }

  const token = await signToken({ userId: user.id, deviceId: user.deviceId, tier: user.tier });

  return c.json({
    ok: true,
    data: { token, userId: user.id, tier: user.tier },
  });
});

// GET /auth/entitlement
authRouter.get('/entitlement', authMiddleware, (c) => {
  const tier = c.get('tier') as string;
  const userId = c.get('userId') as string;

  const features = {
    pkg15Payment: tier !== 'free',
    pkg13Line: tier !== 'free',
    pkg05Shop: tier === 'server' || tier === 'business',
  };

  return c.json({ ok: true, data: { userId, tier, features } });
});
