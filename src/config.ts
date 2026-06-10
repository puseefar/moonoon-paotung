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
    channelId: process.env.LINE_CHANNEL_ID ?? '',
    channelSecret: process.env.LINE_CHANNEL_SECRET ?? '',
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN ?? '',
    apiBase: 'https://api.line.me/v2/bot',
    isReady: !!(process.env.LINE_CHANNEL_SECRET && process.env.LINE_CHANNEL_ACCESS_TOKEN
      && !process.env.LINE_CHANNEL_SECRET.startsWith('FILL_IN')),
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
} as const;
