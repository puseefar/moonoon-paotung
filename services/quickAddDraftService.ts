import { appSettingsService } from '@/services/appSettingsService';

/**
 * Quick-add draft persistence (มติทีม Phase 3 — quick win)
 *
 * เก็บ "ฉบับร่าง" ของหน้าเพิ่มรายการลง SQLite (app_settings) เพื่อกัน UX เสีย
 * ตอนระบบ abstain/ถามกลับ แล้วผู้ใช้ถูกขัดจังหวะ (สลับแอป/เผลอกดย้อน/ปิดแอป)
 * — กลับมาแล้วยังพิมพ์ต่อจากเดิมได้ ไม่ต้องเริ่มใหม่
 *
 * เก็บเฉพาะ input ของผู้ใช้ (ข้อความ/ยอด/ประเภท/หมวดที่เลือก/โน้ต/วันที่)
 * ไม่เก็บผลพรีวิวของ parser (derive ใหม่ได้แบบ deterministic จากข้อความ)
 */
const DRAFT_KEY = 'quick_add_draft_v1';

// อายุร่าง: ร่างที่เก่ากว่านี้ถือว่า stale → ไม่ฟื้น (กันร่างค้างข้ามวันโผล่มาสับสน)
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export type QuickAddDraft = {
  quickAddText: string;
  amount: string;
  type: 'expense' | 'income';
  categoryId: string | null;
  note: string;
  dateISO: string;
  savedAt: string; // ISO timestamp
};

export type QuickAddDraftInput = Omit<QuickAddDraft, 'savedAt'>;

// ร่างที่ "ว่างเปล่า" (ไม่มีอะไรให้กู้) → ไม่ต้องเก็บ
function isMeaningful(draft: QuickAddDraftInput): boolean {
  const amount = parseFloat(draft.amount);
  return (
    draft.quickAddText.trim().length > 0 ||
    draft.note.trim().length > 0 ||
    draft.categoryId !== null ||
    (Number.isFinite(amount) && amount > 0)
  );
}

export const quickAddDraftService = {
  /** โหลดร่างล่าสุด — คืน null ถ้าไม่มี/หมดอายุ/ไฟล์เสีย (และเคลียร์ทิ้งให้ถ้า stale) */
  async load(): Promise<QuickAddDraft | null> {
    const draft = await appSettingsService.getJson<QuickAddDraft>(DRAFT_KEY);
    if (!draft || typeof draft.quickAddText !== 'string') return null;

    const savedAtMs = Date.parse(draft.savedAt);
    if (!Number.isFinite(savedAtMs) || Date.now() - savedAtMs > DRAFT_TTL_MS) {
      await this.clear();
      return null;
    }

    return draft;
  },

  /** บันทึกร่าง — ถ้าร่างว่างเปล่าจะลบทิ้งแทน (ฟอร์มถูกล้าง = ไม่มีร่างค้าง) */
  async save(input: QuickAddDraftInput): Promise<void> {
    if (!isMeaningful(input)) {
      await this.clear();
      return;
    }

    const draft: QuickAddDraft = { ...input, savedAt: new Date().toISOString() };
    await appSettingsService.setJson(DRAFT_KEY, draft);
  },

  async clear(): Promise<void> {
    await appSettingsService.remove(DRAFT_KEY);
  },
};
