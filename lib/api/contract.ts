// ============================================================
// API Contract — Single Source of Truth
// ทั้ง Expo UI และ Backend ใช้ types ชุดเดียวกันนี้
// ============================================================

// ── Auth / Entitlement ────────────────────────────────────────
export type PlanTier = 'free' | 'pro' | 'server' | 'business';

export interface AuthUser {
  userId: string;
  tier: PlanTier;
  deviceId: string;
}

export interface EntitlementResponse {
  userId: string;
  tier: PlanTier;
  features: {
    pkg15Payment: boolean;
    pkg13Line: boolean;
    pkg05Shop: boolean;
  };
}

// ── PKG-15 PromptPay / Slip ────────────────────────────────────
export interface PaymentRequestInput {
  amount: number;
  description: string;
}

export interface PaymentRequest {
  requestId: string;
  amount: number;
  description: string;
  qrPayload: string;       // EMV QR string สำหรับ render เป็น QR code
  promptPayId: string;     // PromptPay ID (phone/TaxID)
  status: 'pending' | 'paid' | 'expired';
  expiresAt: string;       // ISO 8601
  paidAt?: string;
  refId?: string;
  createdAt: string;
  uploadSlipUrl?: string;  // public URL + token สำหรับลูกค้าอัปโหลดสลิป
}

export interface SlipVerifyInput {
  requestId: string;
  slipImageBase64: string; // base64 ของรูปสลิป
}

export interface SlipVerifyResponse {
  verified: boolean;
  amount?: number;
  refId?: string;
  timestamp?: string;
  errorCode?: 'DUPLICATE' | 'AMOUNT_MISMATCH' | 'EXPIRED' | 'INVALID';
  errorMessage?: string;
}

// ── PKG-13 LINE Messaging ──────────────────────────────────────
export interface LineConnectUrlResponse {
  connectUrl: string;      // URL สำหรับ user กดผูก LINE OA
  state: string;           // CSRF state
}

export interface LineConnection {
  connected: boolean;
  lineUserId?: string;
  displayName?: string;
  pictureUrl?: string;
  notificationsEnabled: boolean;
  paymentAlerts?: boolean;
  orderAlerts?: boolean;
  dailyDigest?: boolean;
  connectedAt?: string;
}

export interface LineNotificationSettings {
  enabled: boolean;
  paymentAlerts: boolean;
  orderAlerts: boolean;
  dailyDigest: boolean;
}

export interface LineNotifUpdateInput {
  enabled?: boolean;
  paymentAlerts?: boolean;
  orderAlerts?: boolean;
  dailyDigest?: boolean;
}

// ── PKG-05 Mini Shop ──────────────────────────────────────────
export interface Shop {
  shopId: string;
  name: string;
  description: string;
  phone: string;
  isOpen: boolean;
  productCount: number;   // max 5
  createdAt: string;
}

export interface ShopInput {
  name: string;
  description: string;
  phone: string;
}

export interface Product {
  productId: string;
  shopId: string;
  name: string;
  price: number;
  description: string;
  imageUri?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface ProductInput {
  name: string;
  price: number;
  description: string;
  imageUri?: string;
}

export type OrderStatus = 'pending' | 'confirmed' | 'paid' | 'cancelled';

export interface Order {
  orderId: string;
  shopId: string;
  productId: string;
  productName: string;
  amount: number;
  status: OrderStatus;
  buyerName?: string;
  buyerLineId?: string;
  refId?: string;          // จาก PKG-15 slip verify
  createdAt: string;
  paidAt?: string;
}

// ── Generic API Response wrapper ──────────────────────────────
export interface ApiOk<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  code: string;
  message: string;
}

export type ApiResult<T> = ApiOk<T> | ApiError;
