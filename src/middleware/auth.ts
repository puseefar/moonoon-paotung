import type { Context, Next } from 'hono';
import type { AppVariables } from '../types.js';
import { verifyToken } from '../lib/jwt.js';

export async function authMiddleware(c: Context<{ Variables: AppVariables }>, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ ok: false, code: 'UNAUTHORIZED', message: 'Missing token' }, 401);
  }
  const token = authHeader.slice(7);
  try {
    const payload = await verifyToken(token);
    c.set('userId', payload.userId);
    c.set('tier', payload.tier);
    c.set('deviceId', payload.deviceId);
    await next();
  } catch {
    return c.json({ ok: false, code: 'INVALID_TOKEN', message: 'Invalid or expired token' }, 401);
  }
}

export function requireTier(...tiers: string[]) {
  return async (c: Context<{ Variables: AppVariables }>, next: Next) => {
    const tier = c.get('tier') as string;
    if (!tiers.includes(tier)) {
      return c.json({
        ok: false, code: 'TIER_REQUIRED',
        message: `ฟีเจอร์นี้ต้องการแผน: ${tiers.join(' หรือ ')}`,
      }, 403);
    }
    await next();
  };
}
