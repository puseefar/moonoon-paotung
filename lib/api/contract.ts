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
export type ShopCategory =
  | 'fashion'
  | 'home'
  | 'agriculture'
  | 'homemade'
  | 'secondhand'
  | 'other';

export type PromptPayType = 'phone' | 'national_id';
export type PaymentMethod = 'promptpay' | 'bank';
export type PaymentVisibility = 'qr_only' | 'qr_name' | 'qr_name_account';

export interface Shop {
  shopId: string;
  // Section A — ข้อมูลร้าน (public)
  name: string;
  category: ShopCategory;
  description: string;
  phone: string;
  lineId?: string;
  facebookPage?: string;
  // Section B — ที่ตั้ง (public, optional)
  hasPhysicalLocation: boolean;
  address?: string;
  openHours?: string;
  // Section C — รับเงิน (private fields masked from storefront)
  paymentMethod: PaymentMethod;
  promptPayType?: PromptPayType;
  promptPayNumber?: string;      // private — never expose in storefront
  accountName?: string;          // public — shown to buyer for verification
  bankName?: string;             // optional
  accountNumber?: string;        // optional — masked if shown
  paymentVisibility: PaymentVisibility;
  // Meta
  isOpen: boolean;
  productCount: number;          // max 5 on Pro
  createdAt: string;
}

export interface ShopInput {
  name: string;
  category: ShopCategory;
  description: string;
  phone: string;
  lineId?: string;
  facebookPage?: string;
  hasPhysicalLocation: boolean;
  address?: string;
  openHours?: string;
  paymentMethod: PaymentMethod;
  promptPayType?: PromptPayType;
  promptPayNumber?: string;
  accountName?: string;
  bankName?: string;
  accountNumber?: string;
  paymentVisibility: PaymentVisibility;
}

export type ProductStatus = 'active' | 'draft' | 'sold_out';

// ── Variant types ──────────────────────────────────────────
export interface VariantValue {
  id: string;            // slug/id unique within group
  label: string;         // "ชมพู", "S", "M", etc.
  stock: number;         // stock for this specific value
  price?: number;        // ราคาขาย ABSOLUTE ของ variant นี้ (PKG-05 addendum v1.1)
                         // — แต่ละ variant = SKU อิสระ ไม่ผูกกับ base price
  costPrice?: number;    // cost override ABSOLUTE for this value
  /** @deprecated เก่า: เก็บราคาเป็น delta จาก base ทำให้แก้ base แล้ว variant ขยับตาม
   *  คงไว้เพื่ออ่านข้อมูลเก่า (backward-compat) — โค้ดใหม่ใช้ `price` แทน
   *  resolve ผ่าน resolveVariantPrice() เสมอ */
  extraPrice?: number;
}

export interface VariantOptionGroup {
  name: string;          // "สี", "ขนาด", "แบบ", etc.
  values: VariantValue[];
}

/**
 * คืนราคาขาย "ABSOLUTE" ของ variant — จุดเดียวที่ทุกหน้าจอต้องใช้ (PKG-05 addendum v1.1)
 * - ข้อมูลใหม่: ใช้ v.price ตรง ๆ (ไม่ผูกกับ basePrice → แก้ base ไม่กระทบ)
 * - ข้อมูลเก่า (มีแค่ extraPrice): fallback = basePrice + extraPrice เพื่อให้ render เท่าเดิม
 */
export function resolveVariantPrice(basePrice: number, v: VariantValue): number {
  if (v.price != null) return v.price;
  return basePrice + (v.extraPrice ?? 0);
}

// ── Analytics types ────────────────────────────────────────
export interface SalesDataPoint {
  date: string;          // YYYY-MM-DD
  label: string;         // "จ", "อ", etc.
  revenue: number;
  orders: number;
  profit: number;
}

export interface ProductStat {
  productId: string;
  name: string;
  image?: string;
  totalQty: number;
  totalRevenue: number;
  totalProfit: number;   // กำไรขั้นต้น (gross) จาก snapshot ต้นทุน
  profitKnown: boolean;  // false = สินค้านี้ยังไม่มีต้นทุน → อย่าโชว์กำไร
}

export interface ShopAnalytics {
  period: 'week' | 'month';
  totalRevenue: number;
  totalOrders: number;
  totalProfit: number;        // กำไรขั้นต้น (gross) จากรายการที่มีต้นทุนเท่านั้น
  avgOrderValue: number;
  completedOrders: number;
  pendingOrders: number;
  dailySales: SalesDataPoint[];
  topProducts: ProductStat[];
  // ── PKG-05.1 cost/profit flags ──
  hasCostData: boolean;       // มีอย่างน้อย 1 รายการที่ระบุต้นทุน → โชว์กำไรได้
  profitComplete: boolean;    // ทุกรายการที่ขายมีต้นทุนครบ → ไม่ต้องเตือน
  revenueWithCost: number;    // ยอดขายเฉพาะรายการที่มีต้นทุน — ใช้เป็นฐาน margin
}

export interface ShippingOptions {
  free: boolean;
  fixed: boolean;
  fixedPrice: number;
  pickup: boolean;
  cod: boolean;
}

export interface Product {
  productId: string;
  shopId: string;
  // Section 1 — รูปภาพ
  images: string[];              // URIs, max 3, index 0 = cover
  // Section 2 — ข้อมูล
  name: string;
  category: ShopCategory;
  customCategoryLabel?: string;  // label เองเมื่อ category = 'other'
  description: string;
  // Section 3 — ราคา
  costPrice: number;             // ต้นทุน — private, ใช้คำนวณกำไร
  wholesalePrice?: number;       // ราคาขายส่ง — private
  price: number;                 // ราคาขายปลีก (Retail)
  comparePrice?: number;         // ราคาก่อนลด (แสดงขีดทับ + % ลด)
  // Section 4 — สต็อก & สถานะ
  stock: number;                 // total stock (sum of variant stocks when hasVariants)
  lowStockThreshold: number;     // แจ้งเตือนเมื่อเหลือ ≤ N
  hideWhenOutOfStock: boolean;
  status: ProductStatus;
  // Section 5 — การจัดส่ง
  shipping: ShippingOptions;
  // Section 6 — Variants (Phase 3)
  hasVariants: boolean;
  variants?: VariantOptionGroup[]; // max 1 group for Phase 3
  // Flash sale
  saleEndsAt?: string;           // ISO — if set, show countdown badge
  // Meta
  sortOrder: number;
  createdAt: string;
}

export interface ProductInput {
  images: string[];
  name: string;
  category: ShopCategory;
  customCategoryLabel?: string;
  description: string;
  costPrice: number;
  wholesalePrice?: number;
  price: number;
  comparePrice?: number;
  stock: number;
  lowStockThreshold: number;
  hideWhenOutOfStock: boolean;
  status: ProductStatus;
  shipping: ShippingOptions;
  hasVariants: boolean;
  variants?: VariantOptionGroup[];
  saleEndsAt?: string;
}

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'VERIFYING_SLIP'
  | 'SLIP_REJECTED'
  | 'PAID'
  | 'PREPARING'
  | 'SHIPPED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED';

export type DeliveryMethod = 'free' | 'fixed' | 'pickup';
export type PaymentMethodOrder = 'promptpay' | 'bank';

export interface OrderAddress {
  name: string;
  phone: string;
  address: string;
}

export interface OrderLineItem {
  productId: string;
  name: string;        // snapshot at order time
  price: number;       // snapshot ราคาขาย
  qty: number;
  image?: string;
  variantId?: string;    // id ของ variant value ที่เลือก — ใช้ตัดสต็อก variant ฝั่ง device
  variantLabel?: string; // snapshot label เช่น "ชมพู"
  unitCost?: number;     // snapshot ต้นทุน ณ เวลาขาย (PKG-05.1) — null/undefined = ไม่ระบุ (ห้ามเดา=0)
}

export interface Order {
  orderId: string;
  orderNo: string;                 // ORDER-YYYYMMDD-XXXX
  shopId: string;
  customer: OrderAddress;
  items: OrderLineItem[];
  subtotal: number;
  shippingCost: number;
  discount: number;
  total: number;
  deliveryMethod: DeliveryMethod;
  paymentMethod: PaymentMethodOrder;
  note?: string;
  status: OrderStatus;
  paymentRequestId?: string;       // from PKG-15
  slipRef?: string;
  expiresAt: string;               // ISO, 30 min from creation
  publicToken: string;             // unguessable for web tracking
  trackingNo?: string;
  createdAt: string;
  paidAt?: string;
}

export interface CreateOrderInput {
  // unitPrice/name/image/variantId = snapshot ของ variant ที่เลือกจากตะกร้า
  // (variant เก็บ local เท่านั้น — server ไม่รู้ราคา variant ต้องส่งมาด้วย)
  items: { productId: string; qty: number; unitPrice?: number; name?: string; image?: string; variantId?: string; variantLabel?: string; unitCost?: number }[];
  customer: OrderAddress;
  deliveryMethod: DeliveryMethod;
  paymentMethod: PaymentMethodOrder;
  note?: string;
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
