import TextRecognition from '@react-native-ml-kit/text-recognition';

// ==========================================
// ML Kit OCR — อ่านข้อความจากภาพสลิป (on-device)
// ทำงานบนเครื่อง ไม่ต้องใช้ Internet ฟรี
// แต่ได้แค่ข้อความดิบ ต้อง parse ด้วย regex
// ==========================================

export type MLKitOCRResult = {
  amount: number | null;
  bankName: string | null;
  transferDate: string | null;
  senderName: string | null;
  receiverName: string | null;
  rawText: string;
  confidence: 'high' | 'medium' | 'low';
};

// ==========================================
// Main: ใช้ ML Kit อ่านข้อความจากภาพ แล้ว parse
// ==========================================

export async function extractSlipDataWithMLKit(imageUri: string): Promise<MLKitOCRResult> {
  // 1. ใช้ ML Kit อ่านข้อความจากภาพ
  const result = await TextRecognition.recognize(imageUri);
  const rawText = result.text;

  console.log('ML Kit raw text:', rawText.substring(0, 300));

  // 2. Parse ข้อมูลจากข้อความ
  const amount = extractAmount(rawText);
  const bankName = extractBankName(rawText);
  const transferDate = extractTransferDate(rawText);
  const senderReceiver = extractSenderReceiver(rawText);

  // 3. คำนวณ confidence
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (amount && bankName) confidence = 'high';
  else if (amount || bankName) confidence = 'medium';

  return {
    amount,
    bankName,
    transferDate,
    senderName: senderReceiver.sender,
    receiverName: senderReceiver.receiver,
    rawText,
    confidence,
  };
}

// ==========================================
// Extract: จำนวนเงิน
// ==========================================

function extractAmount(text: string): number | null {
  const normalized = text.replace(/\n/g, ' ').replace(/\s+/g, ' ');

  const patterns = [
    // Pattern 1: "จำนวนเงิน 5,000.00" หรือ "จำนวนเงิน: 5,000.00"
    /จ(?:ำ|ํา)นวนเง(?:ิ|ี)น\s*[:.\s]*?([\d,]+\.?\d*)/i,
    // Pattern 2: "5,000.00 THB" หรือ "5,000.00 บาท"
    /([\d,]+\.\d{2})\s*(?:THB|บาท|baht)/i,
    // Pattern 3: "Amount 5,000.00"
    /amount\s*[:.\s]*?([\d,]+\.?\d*)/i,
    // Pattern 4: "ยอดโอน 5,000.00" หรือ "ยอดเงิน 5,000.00"
    /(?:ยอดโอน|ยอดเง(?:ิ|ี)น|ยอดชำระ|ยอด)\s*[:.\s]*?([\d,]+\.?\d*)/i,
    // Pattern 5: ตัวเลขที่มี comma format + ทศนิยม 2 ตำแหน่ง (ขนาดใหญ่)
    /([\d]{1,3}(?:,\d{3})+\.\d{2})/,
    // Pattern 6: ตัวเลขทศนิยม 2 ตำแหน่ง (≥4 หลัก)
    /(?:^|\s)([\d]{4,}\.\d{2})(?:\s|$)/,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      if (amount > 0 && amount < 10_000_000) {
        return amount;
      }
    }
  }

  // Fallback: หาตัวเลขที่มีทศนิยม 2 ตำแหน่งที่ใหญ่ที่สุด
  const allAmounts = normalized.match(/(\d[\d,]*\.\d{2})/g);
  if (allAmounts) {
    const parsed = allAmounts
      .map((s) => parseFloat(s.replace(/,/g, '')))
      .filter((n) => n > 0 && n < 10_000_000)
      .sort((a, b) => b - a);
    if (parsed.length > 0) {
      return parsed[0];
    }
  }

  return null;
}

// ==========================================
// Extract: ชื่อธนาคาร
// ==========================================

function extractBankName(text: string): string | null {
  // Normalize text: รวมบรรทัด + ลด whitespace
  const normalized = text.replace(/\n/g, ' ').replace(/\s+/g, ' ');

  const bankPatterns: Array<{ pattern: RegExp; name: string }> = [
    // กสิกรไทย — K+, K PLUS, KPLUS, KBank, กสิกร, ธ.กสิกร
    { pattern: /(?:กส(?:ิ|ี)กร|kasikorn|kbank|k\s*plus|kplus)/i, name: 'กสิกรไทย (KBank)' },
    { pattern: /(?:^|\s)K\s*\+/m, name: 'กสิกรไทย (KBank)' },
    // ไทยพาณิชย์ — SCB, SCB Easy, ไทยพาณิชย์
    { pattern: /(?:ไทยพาณ(?:ิ|ี)ชย|siam\s*commercial)/i, name: 'ไทยพาณิชย์ (SCB)' },
    { pattern: /(?:scb\s*easy|scb)/i, name: 'ไทยพาณิชย์ (SCB)' },
    // กรุงเทพ — Bangkok Bank, BBL, กรุงเทพ, Bualuang
    // ใช้ "bangkok" เดี่ยวๆ ก็ match ได้ เพราะ ML Kit บางครั้ง misread "Bank" → "Bonk"/"Bunk"
    { pattern: /(?:กร(?:ุ|ุุ)งเทพ|bangkok(?:\s+b[a-z]*)?|bbl|bualuang)/i, name: 'กรุงเทพ (BBL)' },
    // กรุงไทย — KTB, Krungthai, กรุงไทย, เป๋าตัง, Paotang
    { pattern: /(?:กร(?:ุ|ุุ)งไทย|krungthai|ktb|เป๋าต(?:ั|ั)ง|paotang)/i, name: 'กรุงไทย (KTB)' },
    // กรุงศรี — BAY, Krungsri, กรุงศรี, KMA
    { pattern: /(?:กร(?:ุ|ุุ)งศร(?:ี|ี)|krungsri|bay|kma)/i, name: 'กรุงศรี (BAY)' },
    // ทหารไทยธนชาต — TTB, TMB, ttb touch
    { pattern: /(?:ทหารไทย|ธนชาต|ttb|tmb|thanachart)/i, name: 'ทหารไทยธนชาต (TTB)' },
    // ออมสิน — GSB, mymo, ออมสิน
    { pattern: /(?:ออมส(?:ิ|ี)น|gsb|mymo|government\s*savings)/i, name: 'ออมสิน (GSB)' },
    // ธ.ก.ส. — BAAC, ธกส
    { pattern: /(?:ธ\.?\s*ก\.?\s*ส\.?|baac)/i, name: 'ธ.ก.ส. (BAAC)' },
    // TrueMoney
    { pattern: /(?:ทร(?:ู|ู)(?:มัน(?:น|ณ)(?:ี|ี))|true\s*money|truemoney)/i, name: 'TrueMoney Wallet' },
    // เกียรตินาคินภัทร
    { pattern: /(?:เก(?:ี|ี)ยรต(?:ิ|ี)นาค(?:ิ|ี)น|kiatnakin|kkp)/i, name: 'เกียรตินาคินภัทร (KKP)' },
    // CIMB
    { pattern: /cimb/i, name: 'CIMB' },
    // แลนด์ แอนด์ เฮ้าส์
    { pattern: /(?:แลนด์|lhbank|land\s*and\s*houses)/i, name: 'แลนด์ แอนด์ เฮ้าส์ (LH)' },
    // PromptPay
    { pattern: /(?:promptpay|พร้อมเพย์)/i, name: 'PromptPay' },
    // ธนาคารอิสลาม
    { pattern: /(?:อ(?:ิ|ี)สลาม|ibank|islamic)/i, name: 'อิสลามแห่งประเทศไทย (ISBT)' },
    // UOB
    { pattern: /uob/i, name: 'UOB' },
    // ทิสโก้
    { pattern: /(?:ท(?:ิ|ี)สโก้|tisco)/i, name: 'ทิสโก้ (TISCO)' },
  ];

  // ค้นหาจาก normalized text ก่อน แล้ว fallback ไป raw text
  for (const { pattern, name } of bankPatterns) {
    if (pattern.test(normalized) || pattern.test(text)) {
      return name;
    }
  }

  // Fallback: ค้นหาจากคำว่า "ธนาคาร" ตามด้วยชื่อ
  const bankNameMatch = normalized.match(/ธนาคาร\s*([ก-๙a-zA-Z]+(?:\s+[ก-๙a-zA-Z]+)?)/);
  if (bankNameMatch) {
    const bankText = bankNameMatch[1];
    // ลอง match อีกรอบกับชื่อที่เจอ
    for (const { pattern, name } of bankPatterns) {
      if (pattern.test(bankText)) {
        return name;
      }
    }
    // ถ้ายังไม่เจอ → ส่งชื่อดิบกลับ
    if (bankText.length >= 2) {
      return bankText;
    }
  }

  return null;
}

// ==========================================
// Extract: วันที่ทำรายการ
// ==========================================

function extractTransferDate(text: string): string | null {
  const normalized = text.replace(/\n/g, ' ').replace(/\s+/g, ' ');

  const thaiMonths: Record<string, string> = {
    'ม.ค.': '01', 'มกราคม': '01', 'ม.ค': '01',
    'ก.พ.': '02', 'กุมภาพันธ์': '02', 'ก.พ': '02',
    'มี.ค.': '03', 'มีนาคม': '03', 'มี.ค': '03',
    'เม.ย.': '04', 'เมษายน': '04', 'เม.ย': '04',
    'พ.ค.': '05', 'พฤษภาคม': '05', 'พ.ค': '05',
    'มิ.ย.': '06', 'มิถุนายน': '06', 'มิ.ย': '06',
    'ก.ค.': '07', 'กรกฎาคม': '07', 'ก.ค': '07',
    'ส.ค.': '08', 'สิงหาคม': '08', 'ส.ค': '08',
    'ก.ย.': '09', 'กันยายน': '09', 'ก.ย': '09',
    'ต.ค.': '10', 'ตุลาคม': '10', 'ต.ค': '10',
    'พ.ย.': '11', 'พฤศจิกายน': '11', 'พ.ย': '11',
    'ธ.ค.': '12', 'ธันวาคม': '12', 'ธ.ค': '12',
  };

  // Pattern 1: "31 มี.ค. 69", "31 มี.ค.2569", "31 มีนาคม 2569" (Thai Buddhist calendar)
  // รองรับทั้งมี/ไม่มี space ก่อนปี, มี/ไม่มีจุดหลังเดือน
  const thaiDatePattern = /(\d{1,2})\s*(ม\.?\s*ค\.?|ก\.?\s*พ\.?|มี\.?\s*ค\.?|เม\.?\s*ย\.?|พ\.?\s*ค\.?|มิ\.?\s*ย\.?|ก\.?\s*ค\.?|ส\.?\s*ค\.?|ก\.?\s*ย\.?|ต\.?\s*ค\.?|พ\.?\s*ย\.?|ธ\.?\s*ค\.?|มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)\s*,?\s*(\d{2,4})/;
  const thaiMatch = normalized.match(thaiDatePattern);
  if (thaiMatch) {
    const day = thaiMatch[1].padStart(2, '0');
    // Normalize matched month text: ลบ dots และ spaces เพื่อเปรียบเทียบ
    const matchedMonth = thaiMatch[2].replace(/[\.\s]/g, '');
    const monthKey = Object.keys(thaiMonths).find((k) => {
      const normalizedKey = k.replace(/[\.\s]/g, '');
      return matchedMonth.includes(normalizedKey) || normalizedKey.includes(matchedMonth);
    });
    const month = monthKey ? thaiMonths[monthKey] : null;
    let year = parseInt(thaiMatch[3], 10);

    if (month) {
      if (year > 2400) year -= 543;
      else if (year < 100) year = year + 2500 - 543;
      return `${year}-${month}-${day}`;
    }
  }

  // Pattern 2: "2026-03-31" (ISO format)
  const isoMatch = normalized.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return isoMatch[0];

  // Pattern 3: "31/03/2026" หรือ "31/03/69"
  const slashMatch = normalized.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (slashMatch) {
    const day = slashMatch[1].padStart(2, '0');
    const month = slashMatch[2].padStart(2, '0');
    let year = parseInt(slashMatch[3], 10);
    if (year > 2400) year -= 543;
    else if (year < 100) year = year + 2500 - 543;
    return `${year}-${month}-${day}`;
  }

  // Pattern 4 (OCR misread fallback): "15 W.A. 2569 - 09:12"
  // ML Kit misread อักษรไทย เช่น "พ.ค." → "W.A." ทำให้ตรงกับ pattern เดิมไม่ได้
  // ดึง day + Buddhist year ได้ → ใช้เดือนปัจจุบัน (สลิปส่วนใหญ่สแกนใกล้วันที่โอน)
  const ocrFallback = normalized.match(/(\d{1,2})\s+[A-Za-zก-๙]{1,4}\.?\s*[A-Za-zก-๙]{0,4}\.?\s*(25\d{2}|[6-9]\d)\s*[-–\s]\s*\d{1,2}:\d{2}/);
  if (ocrFallback) {
    const day = ocrFallback[1].padStart(2, '0');
    let year = parseInt(ocrFallback[2], 10);
    if (year > 2400) year -= 543;
    else if (year < 100) year = year + 2500 - 543;
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
    return `${year}-${currentMonth}-${day}`;
  }

  return null;
}

// ==========================================
// Extract: ชื่อผู้โอน/ผู้รับ
// ==========================================

function extractSenderReceiver(text: string): {
  sender: string | null;
  receiver: string | null;
} {
  const result = { sender: null as string | null, receiver: null as string | null };
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    // ค้นหา "จาก" / "from" → บรรทัดถัดไปเป็นชื่อผู้โอน
    if (/^(?:จาก|from)\s*$/i.test(lines[i]) && i + 1 < lines.length) {
      result.sender = extractNameFromLine(lines[i + 1]);
    } else if (/(?:จาก|from)\s*[:]\s*(.+)/i.test(lines[i])) {
      const match = lines[i].match(/(?:จาก|from)\s*[:]\s*(.+)/i);
      if (match) result.sender = extractNameFromLine(match[1]);
    }

    // ค้นหา "ไปที่" / "โอนไป" / "ถึง" / "to" → บรรทัดถัดไปเป็นชื่อผู้รับ
    if (/^(?:ไปท(?:ี|ี่)|โอนไป|ถ(?:ึ|ึ)ง|to)\s*$/i.test(lines[i]) && i + 1 < lines.length) {
      result.receiver = extractNameFromLine(lines[i + 1]);
    } else if (/(?:ไปท(?:ี|ี่)|โอนไป|ถ(?:ึ|ึ)ง|to)\s*[:]\s*(.+)/i.test(lines[i])) {
      const match = lines[i].match(/(?:ไปท(?:ี|ี่)|โอนไป|ถ(?:ึ|ึ)ง|to)\s*[:]\s*(.+)/i);
      if (match) result.receiver = extractNameFromLine(match[1]);
    }
  }

  return result;
}

// ดึงชื่อจากบรรทัด (กรองเลขบัญชีออก)
function extractNameFromLine(line: string): string | null {
  const cleaned = line
    .replace(/\d{3}-\d-\w{3,6}-?\d*/g, '')
    .replace(/\d{3}-\d-x{3}\d{3}/g, '')
    .trim();

  if (cleaned.length >= 2) return cleaned;
  return line.trim() || null;
}
