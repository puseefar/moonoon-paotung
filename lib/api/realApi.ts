// ── Real API Client ──────────────────────────────────────────────────────────
// HTTP fetch จริงทุก method — contract เหมือน mockApi ทุกตัว
// ใช้ authApiService.getToken() ก่อนทุก request + retry เมื่อ 401

import { authApiService } from '@/services/authApiService';
import type {
  ApiResult, EntitlementResponse, PaymentRequest, PaymentRequestInput,
  SlipVerifyInput, SlipVerifyResponse,
  LineConnectUrlResponse, LineConnection, LineNotificationSettings, LineNotifUpdateInput,
  Shop, ShopInput, Product, ProductInput, Order,
} from './contract';

type RealApiConfig = { baseUrl: string };

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

  const json = await res.json() as ApiResult<T>;
  return json;
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
      return apiFetch(cfg, '/pkg05/products');
    },

    async addProduct(input: ProductInput): Promise<ApiResult<Product>> {
      return apiFetch(cfg, '/pkg05/products', {
        method: 'POST', body: JSON.stringify(input),
      });
    },

    async deleteProduct(productId: string): Promise<ApiResult<{ success: boolean }>> {
      return apiFetch(cfg, `/pkg05/products/${productId}`, { method: 'DELETE' });
    },

    async getOrders(): Promise<ApiResult<Order[]>> {
      return apiFetch(cfg, '/pkg05/orders');
    },

    async confirmOrder(orderId: string): Promise<ApiResult<Order>> {
      return apiFetch(cfg, `/pkg05/orders/${orderId}/confirm`, { method: 'POST' });
    },
  };
}
