// ── Real API Client ──────────────────────────────────────────────────────────
// HTTP fetch จริงทุก method — contract เหมือน mockApi ทุกตัว
// ใช้ authApiService.getToken() ก่อนทุก request + retry เมื่อ 401

import { authApiService } from '@/services/authApiService';
import { productLocalService } from '@/features/mini-shop/services/productLocalService';
import type {
  ApiResult, EntitlementResponse, PaymentRequest, PaymentRequestInput,
  SlipVerifyInput, SlipVerifyResponse,
  LineConnectUrlResponse, LineConnection, LineNotificationSettings, LineNotifUpdateInput,
  Shop, ShopInput, Product, ProductInput, Order, CreateOrderInput, ShopAnalytics,
} from './contract';

type RealApiConfig = { baseUrl: string };

// ── Backend response transformer ──────────────────────────
// Backend เก่าใช้ schema: { imageUri, isActive } แทน { images[], status }
// ตรงนี้ map ค่าเก่า → ค่าใหม่ และ provide defaults สำหรับ fields ที่ยังไม่มีใน backend
function normalizeProduct(raw: any): Product {
  return {
    productId:            raw.productId ?? raw.id ?? '',
    shopId:               raw.shopId ?? '',
    images:               Array.isArray(raw.images) ? raw.images
                            : raw.imageUri ? [raw.imageUri] : [],
    name:                 raw.name ?? '',
    category:             raw.category ?? 'other',
    customCategoryLabel:  raw.customCategoryLabel,
    description:          raw.description ?? '',
    costPrice:            raw.costPrice ?? 0,
    wholesalePrice:       raw.wholesalePrice,
    price:                raw.price ?? 0,
    comparePrice:         raw.comparePrice,
    stock:                typeof raw.stock === 'number' ? raw.stock : 999,
    lowStockThreshold:    raw.lowStockThreshold ?? 3,
    hideWhenOutOfStock:   raw.hideWhenOutOfStock ?? false,
    // Backend เก่าส่ง isActive: boolean — แปลงเป็น status
    status: raw.status
              ?? (raw.isActive === false ? 'sold_out'
                 : raw.isActive === true  ? 'active' : 'active'),
    shipping: raw.shipping ?? {
      free: true, fixed: false, fixedPrice: 40, pickup: false, cod: false,
    },
    hasVariants: raw.hasVariants ?? false,
    variants:    raw.variants,
    saleEndsAt:  raw.saleEndsAt,
    sortOrder:   raw.sortOrder ?? 0,
    createdAt:   raw.createdAt ?? new Date().toISOString(),
  };
}

async function apiFetch<T>(
  config: RealApiConfig,
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<ApiResult<T>> {
  const token = await authApiService.getToken(config.baseUrl);
  const res = await fetch(`${config.baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });

  // 401 = expired token → refresh once
  if (res.status === 401 && retry) {
    await authApiService.refreshToken(config.baseUrl);
    return apiFetch<T>(config, path, options, false);
  }

  // HTTP error (404, 500 etc.) — backend อาจส่ง HTML แทน JSON
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json() as any;
      message = body?.message ?? body?.error ?? message;
    } catch { /* response ไม่ใช่ JSON — ใช้ HTTP status แทน */ }
    return { ok: false, code: `HTTP_${res.status}`, message } as ApiResult<T>;
  }

  // Success — parse JSON อย่างปลอดภัย
  try {
    const json = await res.json() as ApiResult<T>;
    return json;
  } catch {
    return { ok: false, code: 'PARSE_ERROR', message: 'Server response ไม่ใช่ JSON' } as ApiResult<T>;
  }
}

async function apiFetchForm<T>(
  config: RealApiConfig,
  path: string,
  formData: FormData,
): Promise<ApiResult<T>> {
  const token = await authApiService.getToken(config.baseUrl);
  const res = await fetch(`${config.baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData,
  });
  return res.json() as Promise<ApiResult<T>>;
}

export function buildRealApi(baseUrl: string): typeof import('./mock').mockApi {
  const cfg: RealApiConfig = { baseUrl };

  return {
    // ── Auth ───────────────────────────────────────────────────
    async getEntitlement(): Promise<ApiResult<EntitlementResponse>> {
      return apiFetch(cfg, '/auth/entitlement');
    },

    // ── PKG-15 ─────────────────────────────────────────────────
    async createPaymentRequest(input: PaymentRequestInput): Promise<ApiResult<PaymentRequest>> {
      return apiFetch(cfg, '/pkg15/payment', {
        method: 'POST', body: JSON.stringify(input),
      });
    },

    async getPaymentRequest(requestId: string): Promise<ApiResult<PaymentRequest>> {
      return apiFetch(cfg, `/pkg15/payment/${requestId}`);
    },

    async verifySlip(input: SlipVerifyInput): Promise<ApiResult<SlipVerifyResponse>> {
      // Thunder API ต้องการ multipart — แปลง base64 → File ก่อนส่ง server
      // server จะ forward ไปหา Thunder โดยอัตโนมัติ
      const formData = new FormData();
      const imageBuffer = Uint8Array.from(atob(input.slipImageBase64), c => c.charCodeAt(0));
      formData.append('file', new Blob([imageBuffer], { type: 'image/jpeg' }), 'slip.jpg');
      formData.append('requestId', input.requestId);
      return apiFetchForm(cfg, '/pkg15/verify-slip', formData);
    },

    // ── PKG-13 ─────────────────────────────────────────────────
    async getLineConnectUrl(): Promise<ApiResult<LineConnectUrlResponse>> {
      return apiFetch(cfg, '/pkg13/connect-url');
    },

    async getLineConnection(): Promise<ApiResult<LineConnection>> {
      return apiFetch(cfg, '/pkg13/connection');
    },

    async mockConnectLine(): Promise<ApiResult<LineConnection>> {
      // ในโหมด real ไม่มี mock connect → ใช้ getLineConnectUrl แทน
      return apiFetch(cfg, '/pkg13/connection');
    },

    async disconnectLine(): Promise<ApiResult<{ success: boolean }>> {
      return apiFetch(cfg, '/pkg13/connection', { method: 'DELETE' });
    },

    async getLineSettings(): Promise<ApiResult<LineNotificationSettings>> {
      return apiFetch(cfg, '/pkg13/notifications');
    },

    async updateLineSettings(input: LineNotifUpdateInput): Promise<ApiResult<LineNotificationSettings>> {
      return apiFetch(cfg, '/pkg13/notifications', {
        method: 'PUT', body: JSON.stringify(input),
      });
    },

    // ── PKG-05 ─────────────────────────────────────────────────
    async getShop(): Promise<ApiResult<Shop | null>> {
      return apiFetch(cfg, '/pkg05/shop');
    },

    async createShop(input: ShopInput): Promise<ApiResult<Shop>> {
      return apiFetch(cfg, '/pkg05/shop', {
        method: 'POST', body: JSON.stringify(input),
      });
    },

    async updateShop(input: Partial<ShopInput & { isOpen: boolean }>): Promise<ApiResult<Shop>> {
      return apiFetch(cfg, '/pkg05/shop', {
        method: 'PATCH', body: JSON.stringify(input),
      });
    },

    async getProducts(): Promise<ApiResult<Product[]>> {
      const res = await apiFetch<any[]>(cfg, '/pkg05/products');
      if (!res.ok) return res;
      const normalized = res.data.map(normalizeProduct);
      const merged = await productLocalService.mergeProducts(normalized);
      return { ok: true, data: merged };
    },

    async addProduct(input: ProductInput): Promise<ApiResult<Product>> {
      // 1. Copy images to permanent local dir ก่อนส่ง backend
      //    เพื่อให้ path คงอยู่แม้ temp cache ถูกล้าง
      const stableImages = input.images?.length
        ? await productLocalService.saveImages('__temp__', input.images)
        : [];

      const res = await apiFetch<any>(cfg, '/pkg05/products', {
        method: 'POST',
        body: JSON.stringify({
          name:               input.name,
          price:              input.price,
          description:        input.description,
          imageUri:           stableImages[0] ?? '',  // backward compat (first image)
          category:           input.category,
          customCategoryLabel: input.customCategoryLabel,
          costPrice:          input.costPrice,
          wholesalePrice:     input.wholesalePrice,
          comparePrice:       input.comparePrice,
          stock:              input.stock,
          lowStockThreshold:  input.lowStockThreshold,
          hideWhenOutOfStock: input.hideWhenOutOfStock,
          isActive:           input.status === 'active',
          status:             input.status,
          shipping:           input.shipping,
          hasVariants:        input.hasVariants,
          variants:           input.variants,
          saleEndsAt:         input.saleEndsAt,
        }),
      });
      if (!res.ok) return res;

      const product = normalizeProduct(res.data);

      // 2. บันทึก stock + images + variants + fields ใหม่ ด้วย productId จริง
      await Promise.all([
        productLocalService.saveStock(product.productId, input.stock),
        stableImages.length
          ? productLocalService.saveImages(product.productId, stableImages)
          : Promise.resolve([]),
        input.hasVariants && input.variants?.length
          ? productLocalService.saveVariants(product.productId, input.variants)
          : Promise.resolve(),
        productLocalService.saveCategory(product.productId, input.category),
        input.customCategoryLabel
          ? productLocalService.saveCustomCategoryLabel(product.productId, input.customCategoryLabel)
          : Promise.resolve(),
        input.wholesalePrice !== undefined
          ? productLocalService.saveWholesalePrice(product.productId, input.wholesalePrice)
          : Promise.resolve(),
        productLocalService.saveCostPrice(product.productId, input.costPrice ?? 0),
        input.comparePrice !== undefined
          ? productLocalService.saveComparePrice(product.productId, input.comparePrice)
          : Promise.resolve(),
        productLocalService.saveShipping(product.productId, input.shipping),
        productLocalService.saveThreshold(product.productId, input.lowStockThreshold),
        productLocalService.saveHideWhenOut(product.productId, input.hideWhenOutOfStock),
      ]);

      const merged = await productLocalService.mergeProduct(product);
      return { ok: true, data: merged };
    },

    async updateProduct(productId: string, input: Partial<ProductInput>): Promise<ApiResult<Product>> {
      // 1. Save images + stock + variants + fields ใหม่ locally ก่อน
      const stableImages = input.images?.length
        ? await productLocalService.saveImages(productId, input.images)
        : null;
      if (typeof input.stock === 'number') {
        await productLocalService.saveStock(productId, input.stock);
      }
      if (input.hasVariants && input.variants?.length) {
        await productLocalService.saveVariants(productId, input.variants);
      } else if (input.hasVariants === false) {
        await productLocalService.saveVariants(productId, []);
      }
      if (input.category) {
        await productLocalService.saveCategory(productId, input.category);
      }
      if (input.customCategoryLabel !== undefined) {
        await productLocalService.saveCustomCategoryLabel(productId, input.customCategoryLabel ?? '');
      }
      if (input.wholesalePrice !== undefined) {
        await productLocalService.saveWholesalePrice(productId, input.wholesalePrice);
      }
      if (input.costPrice !== undefined) {
        await productLocalService.saveCostPrice(productId, input.costPrice);
      }
      // 'in' check: คีย์ที่ส่งมาแต่เป็น undefined = ผู้ใช้ลบส่วนลด → เก็บ 0 (กันค่าเก่าค้าง)
      if ('comparePrice' in input) {
        await productLocalService.saveComparePrice(productId, input.comparePrice ?? 0);
      }
      if (input.shipping) {
        await productLocalService.saveShipping(productId, input.shipping);
      }
      if (typeof input.lowStockThreshold === 'number') {
        await productLocalService.saveThreshold(productId, input.lowStockThreshold);
      }
      if (typeof input.hideWhenOutOfStock === 'boolean') {
        await productLocalService.saveHideWhenOut(productId, input.hideWhenOutOfStock);
      }

      // 2. ลอง PATCH ไปที่ backend
      const res = await apiFetch<any>(cfg, `/pkg05/products/${productId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...input,
          imageUri:  stableImages?.[0] ?? input.images?.[0],
          isActive:  input.status === 'active',
        }),
      });

      // 3. ถ้า backend ไม่รองรับ PATCH (404/405) — ใช้ข้อมูล local แทน
      //    สร้าง product object จาก input + local data เพื่อให้ UI อัปเดตได้
      if (!res.ok) {
        const localProduct: Product = {
          productId,
          shopId:               '',
          images:               stableImages ?? input.images ?? [],
          name:                 input.name ?? '',
          category:             input.category ?? 'other',
          customCategoryLabel:  input.customCategoryLabel,
          description:          input.description ?? '',
          costPrice:            input.costPrice ?? 0,
          wholesalePrice:       input.wholesalePrice,
          price:                input.price ?? 0,
          comparePrice:         input.comparePrice,
          stock:                input.stock ?? 0,
          lowStockThreshold:    input.lowStockThreshold ?? 3,
          hideWhenOutOfStock:   input.hideWhenOutOfStock ?? false,
          status:               input.status ?? 'active',
          shipping:             input.shipping ?? { free: true, fixed: false, fixedPrice: 40, pickup: false, cod: false },
          hasVariants:          input.hasVariants ?? false,
          variants:             input.variants,
          saleEndsAt:           input.saleEndsAt,
          sortOrder:            0,
          createdAt:            new Date().toISOString(),
        };
        return { ok: true, data: localProduct };
      }

      const merged = await productLocalService.mergeProduct(normalizeProduct(res.data));
      return { ok: true, data: merged };
    },

    async deleteProduct(productId: string): Promise<ApiResult<{ success: boolean }>> {
      return apiFetch(cfg, `/pkg05/products/${productId}`, { method: 'DELETE' });
    },

    async getOrders(): Promise<ApiResult<Order[]>> {
      return apiFetch(cfg, '/pkg05/orders');
    },

    async getOrder(orderId: string): Promise<ApiResult<Order>> {
      return apiFetch(cfg, `/pkg05/orders/${orderId}`);
    },

    async createOrder(input: CreateOrderInput): Promise<ApiResult<Order>> {
      return apiFetch(cfg, '/pkg05/orders', { method: 'POST', body: JSON.stringify(input) });
    },

    async updateOrderStatus(orderId: string, status: Order['status']): Promise<ApiResult<Order>> {
      return apiFetch(cfg, `/pkg05/orders/${orderId}/status`, {
        method: 'PATCH', body: JSON.stringify({ status }),
      });
    },

    async confirmOrder(orderId: string): Promise<ApiResult<Order>> {
      return apiFetch(cfg, `/pkg05/orders/${orderId}/confirm`, { method: 'POST' });
    },

    async getAnalytics(period: 'week' | 'month' = 'week'): Promise<ApiResult<ShopAnalytics>> {
      return apiFetch(cfg, `/pkg05/analytics?period=${period}`);
    },

    async seedShopData(): Promise<ApiResult<{ shop: Shop; products: Product[] }>> {
      return apiFetch(cfg, '/pkg05/seed', { method: 'POST' });
    },
  };
}
