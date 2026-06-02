// ── Auth API Service ─────────────────────────────────────────────────────────
// จัดการ Device ID + JWT Token สำหรับการเชื่อมต่อ poatung-server
// Device ID: สร้างครั้งแรก + เก็บตลอดไปใน SecureStore
// JWT Token: ได้จาก /auth/device-login → เก็บ + refresh อัตโนมัติเมื่อ 401

import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const DEVICE_ID_KEY = 'poatung_device_id';
const TOKEN_KEY = 'poatung_api_token';
const TIER_KEY = 'poatung_tier';
const USER_ID_KEY = 'poatung_user_id';

export type PlanTier = 'free' | 'pro' | 'server' | 'business';

export interface AuthState {
  token: string;
  userId: string;
  tier: PlanTier;
}

// ── Device ID ────────────────────────────────────────────────────────────────
async function getOrCreateDeviceId(): Promise<string> {
  let id = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (!id) {
    id = Crypto.randomUUID();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
  }
  return id;
}

// ── Token Management ─────────────────────────────────────────────────────────
async function saveAuth(state: AuthState): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(TOKEN_KEY, state.token),
    SecureStore.setItemAsync(USER_ID_KEY, state.userId),
    SecureStore.setItemAsync(TIER_KEY, state.tier),
  ]);
}

async function loadCachedToken(): Promise<AuthState | null> {
  const [token, userId, tier] = await Promise.all([
    SecureStore.getItemAsync(TOKEN_KEY),
    SecureStore.getItemAsync(USER_ID_KEY),
    SecureStore.getItemAsync(TIER_KEY),
  ]);
  if (!token || !userId || !tier) return null;
  return { token, userId, tier: tier as PlanTier };
}

async function clearAuth(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(USER_ID_KEY),
    SecureStore.deleteItemAsync(TIER_KEY),
  ]);
}

// ── Main Service ─────────────────────────────────────────────────────────────
export const authApiService = {
  // เรียกตอน app เปิด — ได้ token พร้อมใช้เลย
  async ensureAuth(baseUrl: string): Promise<AuthState> {
    const cached = await loadCachedToken();
    if (cached) return cached;
    return this.login(baseUrl);
  },

  async login(baseUrl: string): Promise<AuthState> {
    const deviceId = await getOrCreateDeviceId();
    const res = await fetch(`${baseUrl}/auth/device-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId }),
    });
    if (!res.ok) throw new Error(`Login failed: ${res.status}`);
    const json = await res.json() as { ok: boolean; data: { token: string; userId: string; tier: string } };
    if (!json.ok) throw new Error('Login rejected by server');

    const state: AuthState = {
      token: json.data.token,
      userId: json.data.userId,
      tier: json.data.tier as PlanTier,
    };
    await saveAuth(state);
    return state;
  },

  async getToken(baseUrl: string): Promise<string> {
    const state = await this.ensureAuth(baseUrl);
    return state.token;
  },

  async getTier(): Promise<PlanTier | null> {
    return (await SecureStore.getItemAsync(TIER_KEY)) as PlanTier | null;
  },

  async logout(): Promise<void> {
    await clearAuth();
  },

  // เรียกเมื่อ API คืน 401 — re-login อัตโนมัติ
  async refreshToken(baseUrl: string): Promise<string> {
    await clearAuth();
    const state = await this.login(baseUrl);
    return state.token;
  },
};
