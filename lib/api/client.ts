// ── API Client — Single Entry Point ─────────────────────────────────────────
// เปลี่ยนเพียงจุดเดียวเพื่อสลับ Mock ↔ Real:
//   constants/apiConfig.ts → IS_MOCK = false + BASE_URL

import { API_CONFIG } from '@/constants/apiConfig';
import { mockApi } from './mock';
import { buildRealApi } from './realApi';

export const api = API_CONFIG.IS_MOCK
  ? mockApi
  : buildRealApi(API_CONFIG.BASE_URL);
