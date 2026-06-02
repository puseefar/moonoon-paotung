// ── API Config — สลับ Mock ↔ Real ──────────────────────────────────────────
// IS_MOCK = true  → ใช้ mock data (พัฒนา UI ก่อน backend deploy)
// IS_MOCK = false → เชื่อม poatung-server จริง

export const API_CONFIG = {
  IS_MOCK: false, // ✅ ใช้ Render staging server จริงแล้ว

  BASE_URL: 'https://moonoon-paotung.onrender.com',
} as const;
