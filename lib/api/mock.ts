// ============================================================
// Mock API — ตอบ response ตาม contract โดยไม่ต้อง backend จริง
// เมื่อ backend พร้อม → สลับ IS_MOCK = false ใน client.ts
// ============================================================
import type {
  ApiResult, EntitlementResponse, PlanTier, PaymentRequest, SlipVerifyResponse,
  LineConnectUrlResponse, LineConnection, LineNotificationSettings,
  Shop, Product, Order, ShopInput, ProductInput, PaymentRequestInput,
  SlipVerifyInput, LineNotifUpdateInput, CreateOrderInput, ShopAnalytics,
} from './contract';
import { SEED_SHOP, buildSeedProducts } from '@/features/mini-shop/config/seedData';

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
      category: input.category,
      description: input.description,
      phone: input.phone,
      lineId: input.lineId,
      facebookPage: input.facebookPage,
      hasPhysicalLocation: input.hasPhysicalLocation,
      address: input.address,
      openHours: input.openHours,
      paymentMethod: input.paymentMethod,
      promptPayType: input.promptPayType,
      promptPayNumber: input.promptPayNumber,
      accountName: input.accountName,
      bankName: input.bankName,
      accountNumber: input.accountNumber,
      paymentVisibility: input.paymentVisibility,
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
    if (mockProducts.filter(p => p.status !== 'draft').length >= 5) {
      return err('LIMIT_EXCEEDED', 'ร้านของคุณมีสินค้าครบ 5 ชิ้นแล้ว');
    }
    // Compute stock: sum variant stocks if hasVariants
    const totalStock = input.hasVariants && input.variants?.length
      ? input.variants.flatMap(g => g.values).reduce((s, v) => s + v.stock, 0)
      : input.stock;

    const product: Product = {
      productId: `prod-${Date.now()}`,
      shopId: mockShop?.shopId ?? '',
      images: input.images,
      name: input.name,
      category: input.category,
      description: input.description,
      costPrice: input.costPrice,
      price: input.price,
      comparePrice: input.comparePrice,
      stock: totalStock,
      lowStockThreshold: input.lowStockThreshold,
      hideWhenOutOfStock: input.hideWhenOutOfStock,
      status: input.status,
      shipping: input.shipping,
      hasVariants: input.hasVariants,
      variants: input.variants,
      saleEndsAt: input.saleEndsAt,
      sortOrder: mockProducts.length,
      createdAt: new Date().toISOString(),
    };
    mockProducts.push(product);
    if (mockShop) mockShop.productCount = mockProducts.filter(p => p.status === 'active').length;
    return ok(product);
  },

  async updateProduct(productId: string, input: Partial<ProductInput>): Promise<ApiResult<Product>> {
    await delay(400);
    const idx = mockProducts.findIndex(p => p.productId === productId);
    if (idx === -1) return err('NOT_FOUND', 'ไม่พบสินค้า');
    mockProducts[idx] = { ...mockProducts[idx], ...input };
    if (mockShop) mockShop.productCount = mockProducts.filter(p => p.status === 'active').length;
    return ok(mockProducts[idx]);
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

  async getOrder(orderId: string): Promise<ApiResult<Order>> {
    await delay(300);
    const order = mockOrders.find(o => o.orderId === orderId);
    if (!order) return err('NOT_FOUND', 'ไม่พบ order');
    return ok(order);
  },

  async createOrder(input: CreateOrderInput): Promise<ApiResult<Order>> {
    await delay(800);
    if (!mockShop) return err('NOT_FOUND', 'ยังไม่มีร้าน');

    // Build order items from cart + product snapshot
    const orderItems = input.items.map(ci => {
      const prod = mockProducts.find(p => p.productId === ci.productId);
      return {
        productId: ci.productId,
        name: ci.name ?? prod?.name ?? 'สินค้า',
        // ใช้ราคา variant ที่ client ส่งมา (snapshot จากตะกร้า), fallback เป็นราคาฐาน
        price: typeof ci.unitPrice === 'number' ? ci.unitPrice : (prod?.price ?? 0),
        qty: ci.qty,
        image: ci.image ?? prod?.images?.[0],
        variantId: ci.variantId,
        variantLabel: ci.variantLabel,
        unitCost: ci.unitCost,
      };
    });

    const subtotal = orderItems.reduce((s, i) => s + i.price * i.qty, 0);
    const shippingCost = input.deliveryMethod === 'fixed'
      ? (orderItems[0] ? (mockProducts.find(p => p.productId === orderItems[0].productId)?.shipping.fixedPrice ?? 40) : 40)
      : 0;
    const total = subtotal + shippingCost;

    // Create payment request for PromptPay
    let paymentRequestId: string | undefined;
    if (input.paymentMethod === 'promptpay') {
      const pReq = {
        requestId: `req-${Date.now()}`,
        amount: total,
        description: `ออเดอร์ร้าน${mockShop.name}`,
        qrPayload: `00020101021229370016A000000677010111011300660123456789520499995303764540${total.toFixed(2)}5802TH5910MuuNunShop6304ABCD`,
        promptPayId: mockShop.promptPayNumber ?? '0812345678',
        status: 'pending' as const,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
      };
      mockPayments.push(pReq);
      paymentRequestId = pReq.requestId;
    }

    // Generate orderNo: ORDER-YYYYMMDD-XXXX
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const seq = String(mockOrders.length + 1).padStart(4, '0');
    const orderNo = `ORDER-${dateStr}-${seq}`;

    const order: Order = {
      orderId: `order-${Date.now()}`,
      orderNo,
      shopId: mockShop.shopId,
      customer: input.customer,
      items: orderItems,
      subtotal,
      shippingCost,
      discount: 0,
      total,
      deliveryMethod: input.deliveryMethod,
      paymentMethod: input.paymentMethod,
      note: input.note,
      status: 'PENDING_PAYMENT',
      paymentRequestId,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      publicToken: Math.random().toString(36).slice(2) + Date.now().toString(36),
      createdAt: now.toISOString(),
    };

    mockOrders.push(order);
    return ok(order);
  },

  async updateOrderStatus(orderId: string, status: Order['status']): Promise<ApiResult<Order>> {
    await delay(400);
    const order = mockOrders.find(o => o.orderId === orderId);
    if (!order) return err('NOT_FOUND', 'ไม่พบ order');
    order.status = status;
    if (status === 'PAID') order.paidAt = new Date().toISOString();
    return ok(order);
  },

  async confirmOrder(orderId: string): Promise<ApiResult<Order>> {
    await delay(500);
    const order = mockOrders.find(o => o.orderId === orderId);
    if (!order) return err('NOT_FOUND', 'ไม่พบ order');
    order.status = 'PREPARING';
    return ok(order);
  },

  async seedShopData(): Promise<ApiResult<{ shop: Shop; products: Product[] }>> {
    await delay(300);

    // สร้างร้านถ้ายังไม่มี
    if (!mockShop) {
      mockShop = {
        shopId: `shop-seed-${Date.now()}`,
        ...SEED_SHOP,
        isOpen: true,
        productCount: 0,
        createdAt: new Date().toISOString(),
      };
    }

    // เพิ่มสินค้าตัวอย่าง (ล้างของเก่าก่อน)
    mockProducts = [];
    const seedInputs = buildSeedProducts();
    const seeded: Product[] = [];
    for (const input of seedInputs) {
      const totalStock = input.hasVariants && input.variants?.length
        ? input.variants.flatMap(g => g.values).reduce((s, v) => s + v.stock, 0)
        : input.stock;
      const prod: Product = {
        productId: `prod-seed-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        shopId: mockShop.shopId,
        images: input.images,
        name: input.name,
        category: input.category,
        description: input.description,
        costPrice: input.costPrice,
        price: input.price,
        comparePrice: input.comparePrice,
        stock: totalStock,
        lowStockThreshold: input.lowStockThreshold,
        hideWhenOutOfStock: input.hideWhenOutOfStock,
        status: input.status,
        shipping: input.shipping,
        hasVariants: input.hasVariants,
        variants: input.variants,
        saleEndsAt: input.saleEndsAt,
        sortOrder: seeded.length,
        createdAt: new Date().toISOString(),
      };
      mockProducts.push(prod);
      seeded.push(prod);
      await delay(50);
    }

    mockShop.productCount = mockProducts.filter(p => p.status === 'active').length;
    return ok({ shop: mockShop, products: seeded });
  },

  async getAnalytics(period: 'week' | 'month' = 'week'): Promise<ApiResult<ShopAnalytics>> {
    await delay(600);

    // Build daily sales from real order data
    const days = period === 'week' ? 7 : 30;
    const dayNames = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
    const dailySales = Array.from({ length: days }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      const dateStr = d.toDateString();
      const dayOrders = mockOrders.filter(o =>
        (o.status === 'PAID' || o.status === 'COMPLETED') &&
        new Date(o.paidAt ?? o.createdAt).toDateString() === dateStr
      );
      const revenue = dayOrders.reduce((s, o) => s + o.total, 0);
      const profit = dayOrders.reduce((s, o) => {
        const cogs = o.items.reduce((cs, item) => {
          const prod = mockProducts.find(p => p.productId === item.productId);
          return cs + (prod?.costPrice ?? 0) * item.qty;
        }, 0);
        return s + o.total - cogs;
      }, 0);

      return {
        date: d.toISOString().slice(0, 10),
        label: period === 'week'
          ? dayNames[d.getDay()]
          : String(d.getDate()),
        revenue,
        orders: dayOrders.length,
        profit,
      };
    });

    const paidOrders = mockOrders.filter(o =>
      o.status === 'PAID' || o.status === 'COMPLETED' || o.status === 'SHIPPED' || o.status === 'PREPARING'
    );
    const totalRevenue = paidOrders.reduce((s, o) => s + o.total, 0);
    const totalProfit = paidOrders.reduce((s, o) => {
      const cogs = o.items.reduce((cs, item) => {
        const prod = mockProducts.find(p => p.productId === item.productId);
        return cs + (prod?.costPrice ?? 0) * item.qty;
      }, 0);
      return s + o.total - cogs;
    }, 0);

    // Top products by revenue
    const productMap: Record<string, { qty: number; revenue: number; profit: number }> = {};
    paidOrders.forEach(order => {
      order.items.forEach(item => {
        if (!productMap[item.productId]) {
          productMap[item.productId] = { qty: 0, revenue: 0, profit: 0 };
        }
        const prod = mockProducts.find(p => p.productId === item.productId);
        const cogs = (prod?.costPrice ?? 0) * item.qty;
        productMap[item.productId].qty += item.qty;
        productMap[item.productId].revenue += item.price * item.qty;
        productMap[item.productId].profit += item.price * item.qty - cogs;
      });
    });

    const topProducts = Object.entries(productMap)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 5)
      .map(([productId, stats]) => {
        const prod = mockProducts.find(p => p.productId === productId);
        return {
          productId,
          name: prod?.name ?? 'สินค้า',
          image: prod?.images?.[0],
          totalQty: stats.qty,
          totalRevenue: stats.revenue,
          totalProfit: stats.profit,
          profitKnown: true,
        };
      });

    return ok({
      period,
      totalRevenue,
      totalOrders: paidOrders.length,
      totalProfit,
      avgOrderValue: paidOrders.length ? Math.round(totalRevenue / paidOrders.length) : 0,
      completedOrders: mockOrders.filter(o => o.status === 'COMPLETED').length,
      pendingOrders: mockOrders.filter(o => o.status === 'PENDING_PAYMENT' || o.status === 'VERIFYING_SLIP').length,
      dailySales,
      topProducts,
      hasCostData: true,
      profitComplete: true,
      revenueWithCost: totalRevenue,
    });
  },
};
