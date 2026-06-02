import * as Crypto from 'expo-crypto';
import * as ImageManipulator from 'expo-image-manipulator';
import { inflate } from 'pako';
import { db } from '@/db/client';
import { scannedSlips } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateId } from '@/lib/uuid';

// ==========================================
// PromptPay QR Payload Parser
// อ้างอิง: BOT PromptPay Standard (ISO 20022)
// ==========================================

export type SlipData = {
  amount: number | null;
  transferDate: string | null;
  senderName: string | null;
  receiverName: string | null;
  bankName: string | null;
  refCode: string | null;
  rawPayload: string;
};

// TLV (Tag-Length-Value) parser สำหรับ EMVCo QR
function parseTLV(data: string): Map<string, string> {
  const result = new Map<string, string>();
  let i = 0;
  while (i < data.length - 3) {
    const tag = data.substring(i, i + 2);
    const len = parseInt(data.substring(i + 2, i + 4), 10);
    if (isNaN(len) || len <= 0) break;
    const value = data.substring(i + 4, i + 4 + len);
    result.set(tag, value);
    i += 4 + len;
  }
  return result;
}

// ดึงชื่อธนาคารจาก AID/acquirer ID
function getBankName(aid: string): string {
  const bankMap: Record<string, string> = {
    'A000000677010112': 'กสิกรไทย (KBank)',
    'A000000677010111': 'กรุงเทพ (BBL)',
    'A000000677010114': 'กรุงไทย (KTB)',
    'A000000677010115': 'ทหารไทยธนชาต (TTB)',
    'A000000677010113': 'ไทยพาณิชย์ (SCB)',
    'A000000677010116': 'กรุงศรี (BAY)',
    'A000000677010117': 'ออมสิน (GSB)',
    'A000000677010118': 'ธ.ก.ส. (BAAC)',
  };
  // ค้นหาจาก prefix
  for (const [key, name] of Object.entries(bankMap)) {
    if (aid.includes(key) || aid.includes(key.substring(0, 10))) return name;
  }
  return 'PromptPay';
}

// Parse QR payload จากสลิปธนาคาร
// หมายเหตุ: QR ของสลิปส่วนใหญ่ไม่มี amount — ใช้ OCR อ่านจากภาพแทน
// QR ใช้สำหรับ: ref code, bank name, duplicate check
export function parseQRPayload(payload: string): SlipData {
  const result: SlipData = {
    amount: null,
    transferDate: null,
    senderName: null,
    receiverName: null,
    bankName: null,
    refCode: null,
    rawPayload: payload,
  };

  try {
    // === Format 1: EMVCo TLV (PromptPay Payment QR) ===
    // ตรวจสอบว่าเป็น TLV format (ขึ้นต้นด้วย "00" tag)
    if (/^00\d{2}/.test(payload)) {
      const tlv = parseTLV(payload);

      // Tag 54: Transaction Amount
      const amountStr = tlv.get('54');
      if (amountStr) {
        result.amount = parseFloat(amountStr);
      }

      // Tag 29/30/26: Merchant info (PromptPay)
      const merchantInfo = tlv.get('29') || tlv.get('30') || tlv.get('26');
      if (merchantInfo) {
        const subTlv = parseTLV(merchantInfo);
        const aid = subTlv.get('00') || '';
        result.bankName = getBankName(aid);
      }

      // Tag 62: Additional Data
      const additionalData = tlv.get('62');
      if (additionalData) {
        const subTlv = parseTLV(additionalData);
        result.refCode = subTlv.get('05') || subTlv.get('01') || null;
      }
    }

    // === Format 2: URL-based Slip Verification QR ===
    // เช่น https://promptpay.io/... หรือ bank-specific URLs
    if (payload.startsWith('http')) {
      try {
        const url = new URL(payload);
        // ดึง amount จาก URL params
        const amountParam = url.searchParams.get('amount') ||
                            url.searchParams.get('amt') ||
                            url.searchParams.get('a');
        if (amountParam) {
          result.amount = parseFloat(amountParam);
        }
        // ดึง ref จาก URL params
        const refParam = url.searchParams.get('ref') ||
                         url.searchParams.get('reference') ||
                         url.searchParams.get('txn') ||
                         url.searchParams.get('id');
        if (refParam) {
          result.refCode = refParam;
        }
        // ตรวจสอบธนาคารจาก hostname
        result.bankName = getBankFromUrl(url.hostname);
      } catch {
        // ไม่ใช่ URL ที่ถูกต้อง — ข้าม
      }
    }

    // === Format 3: JSON payload (บาง QR มี JSON) ===
    if (payload.startsWith('{')) {
      try {
        const json = JSON.parse(payload);
        if (json.amount) result.amount = parseFloat(json.amount);
        if (json.amt) result.amount = parseFloat(json.amt);
        if (json.ref) result.refCode = String(json.ref);
        if (json.reference) result.refCode = String(json.reference);
        if (json.bank) result.bankName = String(json.bank);
        if (json.date) result.transferDate = String(json.date);
        if (json.sender) result.senderName = String(json.sender);
        if (json.receiver) result.receiverName = String(json.receiver);
      } catch {
        // ไม่ใช่ JSON ที่ถูกต้อง — ข้าม
      }
    }

    // === Fallback: ดึง amount จาก raw text ===
    if (!result.amount) {
      // ค้นหา pattern จำนวนเงินทั่วไป: 12,000.00 หรือ 12000.00
      const amountMatch = payload.match(/(\d{1,3}(?:,\d{3})*\.\d{2})/);
      if (amountMatch) {
        result.amount = parseFloat(amountMatch[1].replace(/,/g, ''));
      } else {
        // ลองหา pattern แบบไม่มี comma
        const simpleMatch = payload.match(/(\d+\.\d{2})/);
        if (simpleMatch) {
          result.amount = parseFloat(simpleMatch[1]);
        }
      }
    }

    // === Fallback: ดึง ref code จาก raw text ===
    if (!result.refCode) {
      const refMatch = payload.match(/(?:ref|Ref|REF)[:\s#]*([A-Za-z0-9]+)/);
      if (refMatch) {
        result.refCode = refMatch[1];
      } else {
        // Bangkok Bank / บางธนาคาร: QR payload คือ reference number ล้วนๆ (≥14 ตัวอักษร)
        const longRefMatch = payload.match(/^([A-Za-z0-9]{14,})$/);
        if (longRefMatch) result.refCode = longRefMatch[1];
      }
    }

    // ตั้ง transferDate เป็นวันนี้ถ้าไม่มีใน QR
    if (!result.transferDate) {
      result.transferDate = new Date().toISOString().split('T')[0];
    }
  } catch (e) {
    console.warn('QR Parse error:', e);
  }

  return result;
}

// ดึงชื่อธนาคารจาก URL hostname
function getBankFromUrl(hostname: string): string {
  const h = hostname.toLowerCase();
  if (h.includes('kbank') || h.includes('kasikorn')) return 'กสิกรไทย (KBank)';
  if (h.includes('scb') || h.includes('siam')) return 'ไทยพาณิชย์ (SCB)';
  if (h.includes('ktb') || h.includes('krungthai')) return 'กรุงไทย (KTB)';
  if (h.includes('bbl') || h.includes('bangkok')) return 'กรุงเทพ (BBL)';
  if (h.includes('ttb') || h.includes('tmb') || h.includes('thanachart')) return 'ทหารไทยธนชาต (TTB)';
  if (h.includes('bay') || h.includes('krungsri')) return 'กรุงศรี (BAY)';
  if (h.includes('gsb')) return 'ออมสิน (GSB)';
  if (h.includes('baac')) return 'ธ.ก.ส. (BAAC)';
  if (h.includes('promptpay')) return 'PromptPay';
  return 'PromptPay';
}

// ==========================================
// Merge: รวมข้อมูล QR + OCR เข้าด้วยกัน
// OCR มีความสำคัญกว่า QR สำหรับ amount/bank/date
// ==========================================

export function mergeQRAndOCR(
  qrData: SlipData,
  ocrData: {
    amount: number | null;
    bankName: string | null;
    transferDate: string | null;
    senderName: string | null;
    receiverName: string | null;
    refCode?: string | null;
  },
): SlipData {
  return {
    ...qrData,
    // OCR amount มีความน่าเชื่อถือกว่า (อ่านจากภาพจริง)
    amount: ocrData.amount ?? qrData.amount,
    bankName: ocrData.bankName ?? qrData.bankName,
    transferDate: ocrData.transferDate ?? qrData.transferDate,
    senderName: ocrData.senderName ?? qrData.senderName,
    receiverName: ocrData.receiverName ?? qrData.receiverName,
    // refCode จาก Vision OCR ดีกว่า QR (อ่านจากข้อความในภาพ)
    refCode: ocrData.refCode ?? qrData.refCode,
  };
}

// ==========================================
// Hash & Duplicate Check
// ==========================================

async function createHash(payload: string): Promise<string> {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    payload,
  );
}

export async function isDuplicate(qrPayload: string): Promise<{
  duplicate: boolean;
  existingSlip: typeof scannedSlips.$inferSelect | null;
}> {
  const hash = await createHash(qrPayload);
  const existing = await db
    .select()
    .from(scannedSlips)
    .where(eq(scannedSlips.qrHash, hash))
    .limit(1);

  return {
    duplicate: existing.length > 0,
    existingSlip: existing.length > 0 ? existing[0] : null,
  };
}

// ==========================================
// Save Scanned Slip
// ==========================================

export async function saveScannedSlip(
  qrPayload: string,
  slipData: SlipData,
  imageUri?: string,
): Promise<string> {
  const hash = await createHash(qrPayload);
  const id = generateId();

  await db.insert(scannedSlips).values({
    id,
    qrPayload,
    qrHash: hash,
    imageUri: imageUri || null,
    amount: slipData.amount,
    transferDate: slipData.transferDate,
    senderName: slipData.senderName,
    receiverName: slipData.receiverName,
    bankName: slipData.bankName,
    refCode: slipData.refCode,
    status: slipData.amount && slipData.amount > 0 ? 'pending' : 'needs_review',
    createdAt: new Date(),
  });

  return id;
}

export async function updateSlipStatus(
  slipId: string,
  status: 'pending' | 'needs_review' | 'confirmed' | 'tax_evidence' | 'skipped',
  transactionId?: string,
): Promise<void> {
  await db.update(scannedSlips)
    .set({
      status,
      transactionId: transactionId || null,
    })
    .where(eq(scannedSlips.id, slipId));
}

// ==========================================
// QR Scanner from Image (jsQR)
// ==========================================

export async function scanQRFromImage(imageUri: string): Promise<string | null> {
  // ลองหลายขนาดเพื่อเพิ่มโอกาสตรวจจับ QR
  const sizes = [800, 1200, 600];

  for (const size of sizes) {
    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: size } }],
        { format: ImageManipulator.SaveFormat.PNG, base64: true },
      );

      if (!manipResult.base64) continue;

      const pixelData = decodeBase64ToBitmap(manipResult.base64);
      if (!pixelData) continue;

      const jsQR = require('jsqr');
      // ลองทั้ง inversionAttempts เพื่อรองรับ QR สี/พื้นหลังต่างๆ
      const code = jsQR(pixelData.data, pixelData.width, pixelData.height, {
        inversionAttempts: 'attemptBoth',
      });

      if (code) {
        console.log(`QR found at size ${size}:`, code.data.substring(0, 50));
        return code.data;
      }
    } catch (e) {
      console.warn(`scanQRFromImage error at size ${size}:`, e);
    }
  }

  return null;
}

// ==========================================
// PNG Decoder: base64 → RGBA pixels (ใช้ pako decompress)
// ==========================================

function decodeBase64ToBitmap(base64: string): {
  data: Uint8ClampedArray;
  width: number;
  height: number;
} | null {
  try {
    // 1. Convert base64 → byte array
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // 2. Validate PNG signature: 137 80 78 71 13 10 26 10
    if (bytes[0] !== 137 || bytes[1] !== 80 || bytes[2] !== 78 || bytes[3] !== 71) {
      console.warn('Not a valid PNG');
      return null;
    }

    // 3. Parse IHDR chunk (starts at byte 8)
    const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
    const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
    const bitDepth = bytes[24];
    const colorType = bytes[25];

    if (width <= 0 || height <= 0 || width > 4000 || height > 4000) {
      console.warn('Invalid PNG dimensions:', width, height);
      return null;
    }

    // 4. Collect all IDAT chunk data
    const idatChunks: Uint8Array[] = [];
    let offset = 8; // skip PNG signature
    while (offset < bytes.length) {
      const chunkLen = (bytes[offset] << 24) | (bytes[offset + 1] << 16) |
                       (bytes[offset + 2] << 8) | bytes[offset + 3];
      const chunkType = String.fromCharCode(
        bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7],
      );

      if (chunkType === 'IDAT') {
        idatChunks.push(bytes.slice(offset + 8, offset + 8 + chunkLen));
      }
      if (chunkType === 'IEND') break;

      // 4 (length) + 4 (type) + chunkLen (data) + 4 (CRC)
      offset += 12 + chunkLen;
    }

    if (idatChunks.length === 0) {
      console.warn('No IDAT chunks found');
      return null;
    }

    // 5. Concatenate IDAT chunks and decompress with pako (zlib inflate)
    const totalLen = idatChunks.reduce((sum, c) => sum + c.length, 0);
    const compressed = new Uint8Array(totalLen);
    let pos = 0;
    for (const chunk of idatChunks) {
      compressed.set(chunk, pos);
      pos += chunk.length;
    }

    const decompressed = inflate(compressed);

    // 6. Determine bytes per pixel based on colorType
    // colorType: 0=Grayscale, 2=RGB, 3=Indexed, 4=GrayAlpha, 6=RGBA
    let channels: number;
    switch (colorType) {
      case 0: channels = 1; break; // Grayscale
      case 2: channels = 3; break; // RGB
      case 4: channels = 2; break; // Grayscale + Alpha
      case 6: channels = 4; break; // RGBA
      default:
        console.warn('Unsupported PNG colorType:', colorType);
        return null;
    }
    const bpp = channels * (bitDepth / 8); // bytes per pixel
    const scanlineBytes = width * bpp;

    // 7. Unfilter scanlines → raw pixels
    const rawPixels = new Uint8Array(height * width * channels);

    for (let y = 0; y < height; y++) {
      const rowStart = y * (1 + scanlineBytes); // +1 for filter byte
      const filterType = decompressed[rowStart];
      const srcRow = rowStart + 1;
      const dstRow = y * scanlineBytes;
      const prevRow = (y - 1) * scanlineBytes;

      for (let x = 0; x < scanlineBytes; x++) {
        const raw = decompressed[srcRow + x];
        const a = x >= bpp ? rawPixels[dstRow + x - bpp] : 0; // left
        const b = y > 0 ? rawPixels[prevRow + x] : 0;          // above
        const c = (x >= bpp && y > 0) ? rawPixels[prevRow + x - bpp] : 0; // upper-left

        let val: number;
        switch (filterType) {
          case 0: val = raw; break;                    // None
          case 1: val = (raw + a) & 0xFF; break;      // Sub
          case 2: val = (raw + b) & 0xFF; break;      // Up
          case 3: val = (raw + ((a + b) >> 1)) & 0xFF; break; // Average
          case 4: val = (raw + paethPredictor(a, b, c)) & 0xFF; break; // Paeth
          default: val = raw;
        }
        rawPixels[dstRow + x] = val;
      }
    }

    // 8. Convert to RGBA (jsQR requires RGBA)
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      switch (colorType) {
        case 6: // RGBA — direct copy
          rgba[i * 4] = rawPixels[i * 4];
          rgba[i * 4 + 1] = rawPixels[i * 4 + 1];
          rgba[i * 4 + 2] = rawPixels[i * 4 + 2];
          rgba[i * 4 + 3] = rawPixels[i * 4 + 3];
          break;
        case 2: // RGB → RGBA
          rgba[i * 4] = rawPixels[i * 3];
          rgba[i * 4 + 1] = rawPixels[i * 3 + 1];
          rgba[i * 4 + 2] = rawPixels[i * 3 + 2];
          rgba[i * 4 + 3] = 255;
          break;
        case 4: // GrayAlpha → RGBA
          rgba[i * 4] = rawPixels[i * 2];
          rgba[i * 4 + 1] = rawPixels[i * 2];
          rgba[i * 4 + 2] = rawPixels[i * 2];
          rgba[i * 4 + 3] = rawPixels[i * 2 + 1];
          break;
        case 0: // Grayscale → RGBA
          rgba[i * 4] = rawPixels[i];
          rgba[i * 4 + 1] = rawPixels[i];
          rgba[i * 4 + 2] = rawPixels[i];
          rgba[i * 4 + 3] = 255;
          break;
      }
    }

    return { data: rgba, width, height };
  } catch (e) {
    console.warn('PNG decode error:', e);
    return null;
  }
}

// Paeth predictor สำหรับ PNG filter type 4
function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

// ==========================================
// Export all
// ==========================================

export const slipService = {
  parseQRPayload,
  mergeQRAndOCR,
  isDuplicate,
  saveScannedSlip,
  updateSlipStatus,
  scanQRFromImage,
};
