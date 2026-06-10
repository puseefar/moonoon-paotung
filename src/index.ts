import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { initDb } from './db/client.js';
import { config } from './config.js';
import { authRouter } from './routes/auth.js';
import { pkg15Router } from './routes/pkg15.js';
import { pkg13Router } from './routes/pkg13.js';
import { pkg05Router } from './routes/pkg05.js';
import { webhookRouter } from './routes/webhooks.js';
import { payPageRouter } from './routes/payPage.js';

// Initialize DB
initDb();

const app = new Hono();

// Global middleware
app.use('*', logger());
app.use('*', cors({
  origin: '*', // Production: lock to expo app origin
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Health check — 2 paths (/ + /health) ตาม deploy plan requirement
const healthResponse = (c: any) => c.json({
  name: 'Poatung Server',
  version: '1.0.0',
  status: 'ok',
  env: config.nodeEnv,
  packages: ['PKG-15 PromptPay', 'PKG-13 LINE', 'PKG-05 Shop'],
  timestamp: new Date().toISOString(),
});
app.get('/', healthResponse);
app.get('/health', healthResponse);

// Routes — public routes ขึ้นก่อน (ไม่มี auth)
app.route('/pay', payPageRouter);         // GET /pay/:id → หน้าชำระเงิน HTML
app.route('/webhook', webhookRouter);   // POST /webhook/line ← LINE Developers Console
app.route('/auth', authRouter);
app.route('/pkg15', pkg15Router);
app.route('/pkg13', pkg13Router);
app.route('/pkg05', pkg05Router);

// 404
app.notFound((c) => c.json({ ok: false, code: 'NOT_FOUND', message: 'Route not found' }, 404));

// Error handler
app.onError((err, c) => {
  console.error(err);
  return c.json({ ok: false, code: 'INTERNAL_ERROR', message: config.isDev ? err.message : 'Internal server error' }, 500);
});

// Start
serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`
╔══════════════════════════════════════╗
║  🐷 Poatung Server                   ║
║  Port: ${String(info.port).padEnd(28)}║
║  Mode: ${config.nodeEnv.padEnd(28)}║
╠══════════════════════════════════════╣
║  Services:                           ║
║  PromptPay : ${config.promptpay.id.padEnd(22)}║
║  Thunder   : ${(config.thunder.isReady ? '✅ Ready' : '⚠️  URL missing').padEnd(22)}║
║  LINE OA   : ${(config.line.isReady ? '✅ Ready' : '❌ Token missing').padEnd(22)}║
║  LINE Login: ${(config.line.isLoginReady ? '✅ Ready' : '⚠️  Set LOGIN_ID').padEnd(22)}║
║  Cloudinary: ${(config.cloudinary.isReady ? '✅ Ready' : '❌ Not set').padEnd(22)}║
║  Email     : ${(config.email.isReady ? '✅ Ready' : '❌ Not set').padEnd(22)}║
╚══════════════════════════════════════╝
  `);
});

export default app;
