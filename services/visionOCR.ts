import { readAsStringAsync } from 'expo-file-system/legacy';

// ==========================================
// Vision OCR — ใช้ Claude Vision API อ่านสลิป
// ส่งรูปไป API แล้ว AI อ่านให้ ได้ข้อมูลครบ แม่นมาก
// ต้องการ Internet + API key
// ==========================================

// ===== CONFIG =====
const ANTHROPIC_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

// ถ้ามี backend proxy ให้ใส่ URL ตรงนี้แทน (แนะนำสำหรับ production)
const BACKEND_PROXY_URL = '';

export type VisionOCRResult = {
  amount: number | null;
  bankName: string | null;
  transferDate: string | null;
  senderName: string | null;
  receiverName: string | null;
  refCode: string | null;
  rawText: string;
  confidence: 'high' | 'medium' | 'low';
};

// ==========================================
// Main: ส่งรูปไป Claude Vision API
// ==========================================

export async function extractSlipDataWithVision(imageUri: string): Promise<VisionOCRResult> {
  // 1. แปลงรูปเป็น base64
  const base64Image = await readAsStringAsync(imageUri, {
    encoding: 'base64',
  });

  // 2. กำหนด media type
  const isJpeg = /\.jpe?g$/i.test(imageUri);
  const mediaType = isJpeg ? 'image/jpeg' : 'image/png';

  let responseText: string;

  if (BACKEND_PROXY_URL) {
    responseText = await callViaProxy(base64Image, mediaType);
  } else if (ANTHROPIC_API_KEY) {
    responseText = await callAnthropicDirect(base64Image, mediaType);
  } else {
    throw new Error('No API key or proxy configured for Vision OCR');
  }

  // 3. Parse JSON response
  const cleaned = responseText.replace(/```json|```/g, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    return {
      amount: parsed.amount ?? null,
      bankName: parsed.bankName ?? null,
      transferDate: parsed.date ?? null,
      senderName: parsed.senderName ?? null,
      receiverName: parsed.receiverName ?? null,
      refCode: parsed.refCode ?? null,
      rawText: cleaned,
      confidence: parsed.confidence ?? 'low',
    };
  } catch {
    console.warn('Failed to parse Claude response:', cleaned);
    throw new Error('Invalid Vision API response');
  }
}

// ตรวจสอบว่า Vision OCR พร้อมใช้งานหรือไม่
export function isVisionOCRAvailable(): boolean {
  return !!(ANTHROPIC_API_KEY || BACKEND_PROXY_URL);
}

// ==========================================
// Vision Date Supplement — ถามแค่ date อย่างเดียว
// ใช้เมื่อ ML Kit ได้ amount แล้วแต่ date = null
// Prompt สั้นกว่า → token น้อยกว่า → ถูกกว่า ~70%
// ==========================================

export async function extractDateWithVision(imageUri: string): Promise<string | null> {
  if (!ANTHROPIC_API_KEY && !BACKEND_PROXY_URL) return null;

  try {
    const base64Image = await readAsStringAsync(imageUri, { encoding: 'base64' });
    const isJpeg = /\.jpe?g$/i.test(imageUri);
    const mediaType = isJpeg ? 'image/jpeg' : 'image/png';

    let responseText: string;
    if (BACKEND_PROXY_URL) {
      responseText = await callViaProxyWithPrompt(base64Image, mediaType, DATE_ONLY_PROMPT);
    } else {
      responseText = await callAnthropicWithPrompt(base64Image, mediaType, DATE_ONLY_PROMPT);
    }

    const cleaned = responseText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    const date = parsed.date ?? null;
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    return null;
  } catch (e) {
    console.warn('extractDateWithVision failed:', e);
    return null;
  }
}

// ==========================================
// Vision Date+Bank Supplement
// ใช้เมื่อ ML Kit ได้ amount แต่ date หรือ bankName = null
// Prompt สั้น → token น้อย → ถูกกว่า full OCR ~80%
// ==========================================

export type VisionDateBankResult = {
  date: string | null;
  bankName: string | null;
};

export async function extractDateAndBankWithVision(imageUri: string): Promise<VisionDateBankResult> {
  if (!ANTHROPIC_API_KEY && !BACKEND_PROXY_URL) return { date: null, bankName: null };

  try {
    const base64Image = await readAsStringAsync(imageUri, { encoding: 'base64' });
    const isJpeg = /\.jpe?g$/i.test(imageUri);
    const mediaType = isJpeg ? 'image/jpeg' : 'image/png';

    let responseText: string;
    if (BACKEND_PROXY_URL) {
      responseText = await callViaProxyWithPrompt(base64Image, mediaType, DATE_BANK_PROMPT);
    } else {
      responseText = await callAnthropicWithPrompt(base64Image, mediaType, DATE_BANK_PROMPT, 192);
    }

    const cleaned = responseText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    const date = parsed.date ?? null;
    const bankName = parsed.bankName ?? null;
    return {
      date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
      bankName: bankName || null,
    };
  } catch (e) {
    console.warn('extractDateAndBankWithVision failed:', e);
    return { date: null, bankName: null };
  }
}

const DATE_BANK_PROMPT = `นี่คือสลิปโอนเงินจากธนาคารไทย กรุณาหาวันที่ทำรายการและชื่อธนาคารจากสลิป

กฎการแปลงปีพุทธศักราชไทย (สำคัญมาก):
- ปีแบบสั้น 2 หลัก: "69" = พ.ศ. 2569 = ค.ศ. 2026, "68" = 2025, "67" = 2024
- ปีแบบเต็ม 4 หลัก: "2569" = ค.ศ. 2026, "2568" = 2025 (ลบ 543)
- ตัวอย่าง: "31 มี.ค. 69" = 2026-03-31, "15 พ.ค. 68" = 2025-05-15

ธนาคารไทยที่พบบ่อย: กรุงเทพ (BBL), กสิกรไทย (KBank), กรุงไทย (KTB), ไทยพาณิชย์ (SCB), กรุงศรี (BAY), ทหารไทยธนชาต (TTB), ออมสิน, ธกส.

ตอบเป็น JSON เท่านั้น ไม่ต้องมีข้อความอื่น:
{"date":"YYYY-MM-DD","bankName":"ชื่อธนาคาร","confidence":"high|medium|low"}
ถ้าไม่พบให้ใส่ null ในแต่ละ field`;

const DATE_ONLY_PROMPT = `นี่คือสลิปโอนเงินจากธนาคารไทย กรุณาหาวันที่ทำรายการจากสลิป

กฎการแปลงปีพุทธศักราชไทย (สำคัญมาก):
- ปีแบบสั้น 2 หลัก: "69" = พ.ศ. 2569 = ค.ศ. 2026, "68" = 2025, "67" = 2024
- ปีแบบเต็ม 4 หลัก: "2569" = ค.ศ. 2026, "2568" = 2025 (ลบ 543)
- ตัวอย่าง: "31 มี.ค. 69" = 2026-03-31, "15 พ.ค. 68" = 2025-05-15

ตอบเป็น JSON เท่านั้น ไม่ต้องมีข้อความอื่น:
{"date":"YYYY-MM-DD","confidence":"high|medium|low"}
ถ้าไม่พบให้ตอบ {"date":null,"confidence":"low"}`;

async function callAnthropicWithPrompt(
  base64Image: string,
  mediaType: string,
  prompt: string,
  maxTokens = 128,
): Promise<string> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Image } },
          { type: 'text', text: prompt },
        ],
      }],
    }),
  });
  if (!response.ok) throw new Error(`Anthropic API error ${response.status}`);
  const data = await response.json();
  return data.content?.[0]?.text || '';
}

async function callViaProxyWithPrompt(
  base64Image: string,
  mediaType: string,
  prompt: string,
): Promise<string> {
  const response = await fetch(BACKEND_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Image, mediaType, prompt }),
  });
  if (!response.ok) throw new Error(`Proxy error ${response.status}`);
  const data = await response.json();
  if (data.data) return JSON.stringify(data.data);
  return data.text || '';
}

// ==========================================
// เรียก Anthropic API โดยตรง
// ==========================================

async function callAnthropicDirect(base64Image: string, mediaType: string): Promise<string> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: SLIP_OCR_PROMPT,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || '';
}

// ==========================================
// เรียกผ่าน Backend Proxy
// ==========================================

async function callViaProxy(base64Image: string, mediaType: string): Promise<string> {
  const response = await fetch(BACKEND_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Image, mediaType }),
  });

  if (!response.ok) {
    throw new Error(`Proxy error ${response.status}`);
  }

  const data = await response.json();
  if (data.data) return JSON.stringify(data.data);
  return data.text || '';
}

// ==========================================
// Prompt สำหรับ Claude Vision API
// ==========================================

const SLIP_OCR_PROMPT = `นี่คือสลิปโอนเงินจากธนาคารไทย กรุณาอ่านข้อมูลจากสลิปนี้

กฎการแปลงปีพุทธศักราชไทย (สำคัญมาก):
- ปีแบบสั้น 2 หลัก: "69" = พ.ศ. 2569 = ค.ศ. 2026, "68" = 2025, "67" = 2024
- ปีแบบเต็ม 4 หลัก: "2569" = ค.ศ. 2026, "2568" = 2025 (ลบ 543)
- ตัวอย่าง: "31 มี.ค. 69" = 2026-03-31

ตอบเป็น JSON เท่านั้น ไม่ต้องมีข้อความอื่น ไม่ต้องมี backtick:
{
  "amount": <จำนวนเงินเป็นตัวเลข เช่น 5000.00>,
  "bankName": "<ชื่อธนาคาร เช่น กรุงเทพ (BBL), กสิกรไทย (KBank), กรุงไทย (KTB)>",
  "date": "<วันที่ทำรายการ format YYYY-MM-DD เช่น 2026-03-31>",
  "senderName": "<ชื่อผู้โอน>",
  "receiverName": "<ชื่อผู้รับ>",
  "refCode": "<หมายเลขอ้างอิงสั้น เช่น 520820 ไม่ใช่เลขยาว>",
  "confidence": "<high|medium|low>"
}
ถ้าอ่านไม่ได้ให้ใส่ null`;
