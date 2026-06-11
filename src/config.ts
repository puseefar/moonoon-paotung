import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isDev: (process.env.NODE_ENV ?? 'development') === 'development',

  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev-secret-change-in-prod',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '30d',
  },

  // Thunder Slip Verify API (ทดสอบแล้วบน NoonStore)
  thunder: {
    apiKey: process.env.THUNDER_API_KEY ?? '',
    apiUrl: process.env.THUNDER_API_URL ?? '',
    isReady: !!(process.env.THUNDER_API_KEY && process.env.THUNDER_API_URL),
  },

  // Cloudinary — product images + (optional) slip thumbnails
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? '',
    apiKey: process.env.CLOUDINARY_API_KEY ?? '',
    apiSecret: process.env.CLOUDINARY_API_SECRET ?? '',
    isReady: !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY),
  },

  line: {
    // ── Messaging API (moonoon-paotung) — ใช้สำหรับ Webhook + Push message ──
    messagingChannelId: process.env.LINE_MESSAGING_CHANNEL_ID ?? process.env.LINE_CHANNEL_ID ?? '',
    channelSecret: process.env.LINE_CHANNEL_SECRET ?? '',
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN ?? '',
    // ── LINE Login (moonoon-login) — ใช้สำหรับ OAuth2 / connect-url / callback ──
    loginChannelId: process.env.LINE_LOGIN_CHANNEL_ID ?? '',
    loginChannelSecret: process.env.LINE_LOGIN_CHANNEL_SECRET ?? '',
    callbackUrl: process.env.LINE_CALLBACK_URL ?? 'https://moonoon-paotung.onrender.com/pkg13/callback',
    apiBase: 'https://api.line.me/v2/bot',
    isReady: !!(process.env.LINE_CHANNEL_SECRET && process.env.LINE_CHANNEL_ACCESS_TOKEN
      && !process.env.LINE_CHANNEL_SECRET.startsWith('FILL_IN')),
    isLoginReady: !!(process.env.LINE_LOGIN_CHANNEL_ID && process.env.LINE_LOGIN_CHANNEL_SECRET),
  },

  promptpay: {
    id: process.env.PROMPTPAY_ID ?? '0000000000',
  },

  email: {
    host: process.env.EMAIL_HOST ?? 'smtp.gmail.com',
    port: Number(process.env.EMAIL_PORT) || 587,
    user: process.env.EMAIL_USER ?? '',
    appPassword: process.env.EMAIL_APP_PASSWORD ?? '',
    isReady: !!(process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD),
  },

  payment: {
    qrExpiryHours: Number(process.env.PAYMENT_QR_EXPIRY_HOURS) || 0.25, // default 15 min
    autoConfirm: process.env.PAYMENT_AUTO_CONFIRM === 'true',
  },

  db: {
    url: process.env.DATABASE_URL ?? '',  // Neon PostgreSQL connection string
  },

  serverUrl: process.env.SERVER_URL ?? 'https://moonoon-paotung.onrender.com',
} as const;
