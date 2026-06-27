export type Daypart = 'morning' | 'day' | 'evening' | 'night';

// ─────────────────────────────────────────────────────────────────────────────
// Phase 0 §2.4 — นิยาม "ช่วงเวลา" กลาง (timezone = Asia/Bangkok เสมอ)
//   service เป็นคนนิยามช่วงเวลาผ่านฟังก์ชันเหล่านี้ — หน้าจอ "ห้าม" คำนวณเอง
//   ขอบเขตทุกช่วงคืนค่าเป็น Date (instant จริง) ที่ตรงกับเที่ยงคืน/สิ้นวันตามเวลาไทย
// ─────────────────────────────────────────────────────────────────────────────

export const THAI_UTC_OFFSET_MS = 7 * 3_600_000; // UTC+7

/** ชื่อเดือนไทยแบบย่อ (index 0-11) — ใช้ร่วมกันทั้งแอป */
export const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
] as const;

/** ชื่อเดือนไทยแบบเต็ม (index 0-11) */
export const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
] as const;

export type TimeRange = {
  startDate: Date;
  endDate: Date;
};

/** วัน-เดือน-ปี ตามปฏิทินไทย ของ instant ที่กำหนด (month = 0-11) */
export function getThaiDateParts(date: Date = new Date()): {
  year: number;
  month: number;
  day: number;
} {
  const thai = new Date(date.getTime() + THAI_UTC_OFFSET_MS);
  return {
    year: thai.getUTCFullYear(),
    month: thai.getUTCMonth(),
    day: thai.getUTCDate(),
  };
}

/** เดือน/ปีปัจจุบันตามเวลาไทย (month = 0-11) */
export function getCurrentThaiMonth(): { year: number; month: number } {
  const { year, month } = getThaiDateParts();
  return { year, month };
}

/** ช่วง "วันนี้" 00:00–23:59.999 ตามเวลาไทย */
export function getTodayRange(now: Date = new Date()): TimeRange {
  const { year, month, day } = getThaiDateParts(now);
  const startMs = Date.UTC(year, month, day, 0, 0, 0, 0) - THAI_UTC_OFFSET_MS;
  const endMs = startMs + 24 * 3_600_000 - 1;
  return { startDate: new Date(startMs), endDate: new Date(endMs) };
}

/** ช่วง "เดือนนี้" (เดือนปฏิทินไทย) — month = 0-11 */
export function getMonthRange(year: number, month: number): TimeRange {
  const startMs = Date.UTC(year, month, 1, 0, 0, 0, 0) - THAI_UTC_OFFSET_MS;
  const endMs = Date.UTC(year, month + 1, 1, 0, 0, 0, 0) - THAI_UTC_OFFSET_MS - 1;
  return { startDate: new Date(startMs), endDate: new Date(endMs) };
}

// ใช้เวลาประเทศไทย UTC+7 เสมอ ไม่ขึ้นกับ timezone ของเครื่อง
function getThaiHour(): number {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  return new Date(utcMs + 7 * 3_600_000).getHours();
}

export function getDaypart(h: number = getThaiHour()): Daypart {
  if (h >= 5  && h < 11) return 'morning';
  if (h >= 11 && h < 16) return 'day';
  if (h >= 16 && h < 19) return 'evening';
  return 'night';
}

export const GREETING: Record<Daypart, string> = {
  morning: 'อรุณสวัสดิ์',
  day:     'สวัสดียามกลางวัน',
  evening: 'สวัสดียามเย็น',
  night:   'ราตรีสวัสดิ์',
};

// Gradient สี 4 ช่วงเวลา ตามเวลาไทย (แทนรูปภาพพื้นหลัง)
export const BG: Record<Daypart, string[]> = {
  morning: ['#E8722A', '#F5974A', '#FABE69', '#FFE0A3'],   // ฟ้าอรุณ → ทองอ่อน
  day:     ['#1565C0', '#1E88E5', '#64B5F6', '#BBDEFB'],   // ฟ้าเข้ม → ฟ้าอ่อน
  evening: ['#6A0572', '#AD1457', '#E64A19', '#FF7043'],   // ม่วง → ชมพู → ส้มอาทิตย์ตก
  night:   ['#0A0520', '#16093E', '#221264', '#321A85'],   // ดำ → น้ำเงินเข้ม → ม่วงคืน
};
