// ============================================================
// Mock API — ตอบ response ตาม contract โดยไม่ต้อง backend จริง
// เมื่อ backend พร้อม → สลับ IS_MOCK = false ใน client.ts
// ============================================================
import type {
  ApiResult, EntitlementResponse, PlanTier, PaymentRequest, SlipVerifyResponse,
  LineConnectUrlResponse, LineConnection, LineNotificationSettings,
  Shop, Product, Order, ShopInput, ProductInput, PaymentRequestInput,
  SlipVerifyInput, LineNotifUpdateInput,
} from './contract';

function delay(ms = 600): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function ok<T>(data: T): ApiResult<T> { return { ok: true, data }; }
function err(code: string, message: string): ApiResult<never> {
  return { ok: false, code, message };
}

let mockUserId = 'mock-user-001';
let mockTier: PlanTier = 'server';

// Mutable state (simulates DB)
let mockPayments: PaymentRequest[] = [];
let mockShop: Shop | null = null;
let mockProducts: Product[] = [];
let mockOrders: Order[] = [];
let mockLineConn: LineConnection = {
  connected: false, notificationsEnabled: false,
};
let mockLineSettings: LineNotificationSettings = {
  enabled: false, paymentAlerts: true, orderAlerts: true, dailyDigest: false,
};

export const mockApi = {

  // ── Auth ──────────────────────────────────────────────────
  async getEntitlement(): Promise<ApiResult<EntitlementResponse>> {
    await delay(300);
    return ok({
      userId: mockUserId,
      tier: mockTier,
      features: {
        pkg15Payment: (mockTier as string) !== 'free',
        pkg13Line: (mockTier as string) !== 'free',
        pkg05Shop: (mockTier as string) === 'server' || (mockTier as string) === 'business',
      },
    });
  },

  // ── PKG-15 ───────────────────────────────────────────────
  async createPaymentRequest(input: PaymentRequestInput): Promise<ApiResult<PaymentRequest>> {
    await delay(700);
    const req: PaymentRequest = {
      requestId: `req-${Date.now()}`,
      amount: input.amount,
      description: input.description,
      // QR payload จำลอง (ของจริงต้องสร้างด้วย EMVCo standard)
      qrPayload: `00020101021229370016A000000677010111011300660123456789520499995303764540${input.amount.toFixed(2)}5802TH5910MuuNunShop6304ABCD`,
      promptPayId: '0660123456789',
      status: 'pending',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    };
    mockPayments.push(req);
    return ok(req);
  },

  async getPaymentRequest(requestId: string): Promise<ApiResult<PaymentRequest>> {
    await delay(300);
    const req = mockPayments.find(p => p.requestId === requestId);
    if (!req) return err('NOT_FOUND', 'Payment request not found');
    return ok(req);
  },

  async verifySlip(input: SlipVerifyInput): Promise<ApiResult<SlipVerifyResponse>> {
    await delay(1200);
    const req = mockPayments.find(p => p.requestId === input.requestId);
    if (!req) return err('NOT_FOUND', 'Payment request not found');
    if (req.status === 'paid') {
      return ok({ verified: false, errorCode: 'DUPLICATE', errorMessage: 'สลิปนี้ถูกใช้แล้ว' });
    }
    // Mock: ยืนยันสำเร็จเสมอในโหมด mock
    const refId = `REF-${Date.now()}`;
    req.status = 'paid';
    req.refId = refId;
    req.paidAt = new Date().toISOString();
    return ok({ verified: true, amount: req.amount, refId, timestamp: req.paidAt });
  },

  // ── PKG-13 ───────────────────────────────────────────────
  async getLineConnectUrl(): Promise<ApiResult<LineConnectUrlResponse>> {
    await delay(400);
    return ok({
      connectUrl: 'https://access.line.me/oauth2/v2.1/authorize?response_type=code&mock=true',
      state: `state-${Date.now()}`,
    });
  },

  async getLineConnection(): Promise<ApiResult<LineConnection>> {
    await delay(300);
    return ok(mockLineConn);
  },

  async mockConnectLine(): Promise<ApiResult<LineConnection>> {
    await delay(800);
    mockLineConn = {
      connected: true,
      lineUserId: 'U' + Math.random().toString(36).slice(2, 12),
      displayName: 'หมูนุ่น Test',
      pictureUrl: undefined,
      notificationsEnabled: true,
      connectedAt: new Date().toISOString(),
    };
    return ok(mockLineConn);
  },

  async disconnectLine(): Promise<ApiResult<{ success: boolean }>> {
    await delay(400);
    mockLineConn = { connected: false, notificationsEnabled: false };
    return ok({ success: true });
  },

  async getLineSettings(): Promise<ApiResult<LineNotificationSettings>> {
    await delay(300);
    return ok(mockLineSettings);
  },

  async updateLineSettings(input: LineNotifUpdateInput): Promise<ApiResult<LineNotificationSettings>> {
    await delay(400);
    mockLineSettings = { ...mockLineSettings, ...input };
    return ok(mockLineSettings);
  },

  // ── PKG-05 ───────────────────────────────────────────────
  async getShop(): Promise<ApiResult<Shop | null>> {
    await delay(400);
    return ok(mockShop);
  },

  async createShop(input: ShopInput): Promise<ApiResult<Shop>> {
    await delay(700);
    mockShop = {
      shopId: `shop-${Date.now()}`,
      name: input.name,
      description: input.description,
      phone: input.phone,
      isOpen: true,
      productCount: 0,
      createdAt: new Date().toISOString(),
    };
    return ok(mockShop);
  },

  async updateShop(input: Partial<ShopInput & { isOpen: boolean }>): Promise<ApiResult<Shop>> {
    await delay(400);
    if (!mockShop) return err('NOT_FOUND', 'ยังไม่มีร้าน');
    mockShop = { ...mockShop, ...input };
    return ok(mockShop);
  },

  async getProducts(): Promise<ApiResult<Product[]>> {
    await delay(400);
    return ok(mockProducts);
  },

  async addProduct(input: ProductInput): Promise<ApiResult<Product>> {
    await delay(600);
    if (mockProducts.length >= 5) {
      return err('LIMIT_EXCEEDED', 'ร้านของคุณมีสินค้าครบ 5 ชิ้นแล้ว');
    }
    const product: Product = {
      productId: `prod-${Date.now()}`,
      shopId: mockShop?.shopId ?? '',
      name: input.name,
      price: input.price,
      description: input.description,
      imageUri: input.imageUri,
      isActive: true,
      sortOrder: mockProducts.length,
      createdAt: new Date().toISOString(),
    };
    mockProducts.push(product);
    if (mockShop) mockShop.productCount = mockProducts.length;
    return ok(product);
  },

  async deleteProduct(productId: string): Promise<ApiResult<{ success: boolean }>> {
    await delay(400);
    mockProducts = mockProducts.filter(p => p.productId !== productId);
    if (mockShop) mockShop.productCount = mockProducts.length;
    return ok({ success: true });
  },

  async getOrders(): Promise<ApiResult<Order[]>> {
    await delay(400);
    return ok(mockOrders);
  },

  async confirmOrder(orderId: string): Promise<ApiResult<Order>> {
    await delay(500);
    const order = mockOrders.find(o => o.orderId === orderId);
    if (!order) return err('NOT_FOUND', 'ไม่พบ order');
    order.status = 'confirmed';
    return ok(order);
  },
};
