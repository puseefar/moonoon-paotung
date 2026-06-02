import { extractSlipDataWithMLKit } from './mlkitOCR';
import { extractSlipDataWithVision, extractDateWithVision, extractDateAndBankWithVision, isVisionOCRAvailable } from './visionOCR';

// ==========================================
// Feature Gate — Vision Date Supplement
// Free tier  : false (ML Kit date fallback เท่านั้น)
// Pro tier   : true  (Vision AI อ่าน date แม่น)
// ภายหลัง: return isVisionOCRAvailable() && subscriptionService.hasProAccess()
// ==========================================
function isVisionDateSupplementEnabled(): boolean {
  return isVisionOCRAvailable();
}

// ==========================================
// OCR Service — Unified (ML Kit + Vision API)
// Strategy: ML Kit ก่อน (เร็ว, ฟรี, offline)
//           → ถ้าไม่เจอ amount → fallback ไป Claude Vision API
// ==========================================

export type OCRSlipData = {
  amount: number | null;
  bankName: string | null;
  transferDate: string | null;
  senderName: string | null;
  receiverName: string | null;
  refCode: string | null;
  rawText: string;
};

const EMPTY_RESULT: OCRSlipData = {
  amount: null,
  bankName: null,
  transferDate: null,
  senderName: null,
  receiverName: null,
  refCode: null,
  rawText: '',
};

// ==========================================
// Main: อ่าน OCR จากภาพสลิป (unified)
// ==========================================

export async function recognizeSlipFromImage(imageUri: string): Promise<OCRSlipData> {
  // ──────────────────────────────────────
  // Strategy 1: ลอง ML Kit ก่อน (on-device, เร็ว, ฟรี)
  // ──────────────────────────────────────
  try {
    const mlResult = await extractSlipDataWithMLKit(imageUri);
    console.log('ML Kit result:', {
      amount: mlResult.amount,
      bank: mlResult.bankName,
      date: mlResult.transferDate,
      confidence: mlResult.confidence,
    });

    // ถ้า ML Kit เจอ amount → ใช้เลย
    if (mlResult.amount) {
      let transferDate = mlResult.transferDate;
      let bankName = mlResult.bankName;

      // ★ Pro Feature: Vision Supplement
      // ML Kit ได้ amount แต่ date หรือ bankName null → ขอจาก Vision ในคำขอเดียว
      if ((!transferDate || !bankName) && isVisionDateSupplementEnabled()) {
        const missing = [!transferDate && 'date', !bankName && 'bank'].filter(Boolean).join(', ');
        console.log(`ML Kit: amount found but missing [${missing}] — calling Vision supplement`);
        try {
          const supp = await extractDateAndBankWithVision(imageUri);
          if (!transferDate && supp.date) {
            transferDate = supp.date;
            console.log('Vision supplement date:', transferDate);
          }
          if (!bankName && supp.bankName) {
            bankName = supp.bankName;
            console.log('Vision supplement bank:', bankName);
          }
        } catch (e) {
          console.warn('Vision supplement failed:', e);
        }
      }

      return {
        amount: mlResult.amount,
        bankName,
        transferDate,
        senderName: mlResult.senderName,
        receiverName: mlResult.receiverName,
        refCode: null,
        rawText: mlResult.rawText,
      };
    }

    // ML Kit ไม่เจอ amount แต่เจอข้อมูลอื่น → เสริมด้วย Vision API
    if (mlResult.bankName || mlResult.transferDate) {
      console.log('ML Kit found partial data, trying Vision API for amount...');

      // ──────────────────────────────────────
      // Strategy 2: ML Kit ได้บางส่วน → เสริมด้วย Vision API
      // ──────────────────────────────────────
      if (isVisionOCRAvailable()) {
        try {
          const visionResult = await extractSlipDataWithVision(imageUri);
          return {
            amount: visionResult.amount ?? mlResult.amount,
            bankName: visionResult.bankName ?? mlResult.bankName,
            transferDate: visionResult.transferDate ?? mlResult.transferDate,
            senderName: visionResult.senderName ?? mlResult.senderName,
            receiverName: visionResult.receiverName ?? mlResult.receiverName,
            refCode: visionResult.refCode ?? null,
            rawText: visionResult.rawText || mlResult.rawText,
          };
        } catch (visionErr) {
          console.warn('Vision API fallback failed:', visionErr);
        }
      }

      // Vision ไม่ได้ → ส่ง ML Kit result ที่มีกลับไป (แม้ไม่มี amount)
      return {
        amount: mlResult.amount,
        bankName: mlResult.bankName,
        transferDate: mlResult.transferDate,
        senderName: mlResult.senderName,
        receiverName: mlResult.receiverName,
        refCode: null,
        rawText: mlResult.rawText,
      };
    }
  } catch (mlErr) {
    console.warn('ML Kit OCR failed:', mlErr);
  }

  // ──────────────────────────────────────
  // Strategy 3: ML Kit ล้มเหลวทั้งหมด → ลอง Vision API เต็มตัว
  // ──────────────────────────────────────
  if (isVisionOCRAvailable()) {
    try {
      const visionResult = await extractSlipDataWithVision(imageUri);
      return {
        amount: visionResult.amount,
        bankName: visionResult.bankName,
        transferDate: visionResult.transferDate,
        senderName: visionResult.senderName,
        receiverName: visionResult.receiverName,
        refCode: visionResult.refCode ?? null,
        rawText: visionResult.rawText,
      };
    } catch (visionErr) {
      console.warn('Vision API also failed:', visionErr);
    }
  }

  // ──────────────────────────────────────
  // Strategy 4: ไม่เจอเลย → ให้ user กรอกเอง
  // ──────────────────────────────────────
  return { ...EMPTY_RESULT };
}

// ==========================================
// Re-export extract functions สำหรับ backward compatibility
// ==========================================

export { extractSlipDataWithMLKit } from './mlkitOCR';
export { extractSlipDataWithVision, extractDateAndBankWithVision, isVisionOCRAvailable } from './visionOCR';

// ==========================================
// Export all
// ==========================================

export const ocrService = {
  recognizeSlipFromImage,
};
