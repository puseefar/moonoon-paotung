// Format จำนวนเงินแบบไทย
export function formatCurrency(amount: number, currency: string = 'THB'): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Format เป็นตัวย่อ (เช่น 1.5K, 2.3M)
export function formatCompact(amount: number): string {
  if (Math.abs(amount) >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(amount) >= 1_000) {
    return `${(amount / 1_000).toFixed(1)}K`;
  }
  return amount.toFixed(0);
}

// Format วันที่แบบไทย
const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

export function formatMonthYear(month: number, year: number): string {
  return `${THAI_MONTHS_FULL[month]} ${year + 543}`;
}

export function formatMonthYearShort(month: number, year: number): string {
  return `${THAI_MONTHS_SHORT[month]} ${year + 543}`;
}

export function formatDate(date: Date): string {
  const d = date.getDate();
  const month = THAI_MONTHS_SHORT[date.getMonth()];
  const year = date.getFullYear() + 543;
  return `${d} ${month} ${year}`;
}

// ช่วงวันที่ของเดือน
export function getMonthDateRange(year: number, month: number) {
  return {
    startDate: new Date(year, month, 1),
    endDate: new Date(year, month + 1, 0, 23, 59, 59, 999),
  };
}
