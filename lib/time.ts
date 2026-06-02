export type Daypart = 'morning' | 'day' | 'evening' | 'night';

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
