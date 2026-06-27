// ── thaiAddressService ───────────────────────────────────────────────────────
// ค้นหาที่อยู่ไทย (ตำบล/อำเภอ/จังหวัด/รหัสไปรษณีย์) แบบออฟไลน์
// ใช้ข้อมูลจาก thai-data (7,475 rows — 77 จังหวัด, 928 อำเภอ, 7,436 ตำบล)

import { getAllData } from 'thai-data';

export interface ThaiAddressRow {
  subDistrict: string;   // ตำบล / แขวง
  district: string;      // อำเภอ / เขต
  province: string;      // จังหวัด
  zip: string;           // รหัสไปรษณีย์
}

// ── Build flat list once at module load ──────────────────────
let _rows: ThaiAddressRow[] | null = null;

function getRows(): ThaiAddressRow[] {
  if (_rows) return _rows;
  const all = getAllData() as any[];
  const rows: ThaiAddressRow[] = [];
  for (const z of all) {
    if (!Array.isArray(z.subDistrictList)) continue;
    for (const sub of z.subDistrictList) {
      const dist = Array.isArray(z.districtList)
        ? z.districtList.find((d: any) => d.districtId === sub.districtId)
        : null;
      const prov = Array.isArray(z.provinceList)
        ? z.provinceList.find((p: any) => p.provinceId === sub.provinceId)
        : null;
      rows.push({
        subDistrict: sub.subDistrictName ?? '',
        district:    dist?.districtName  ?? '',
        province:    prov?.provinceName  ?? '',
        zip:         z.zipCode           ?? '',
      });
    }
  }
  _rows = rows;
  return rows;
}

// ── Public API ───────────────────────────────────────────────

/**
 * ค้นหาจากตำบล หรือ รหัสไปรษณีย์
 * พิมพ์ตัวเลข → ค้นหาจาก zip เป็นหลัก
 * พิมพ์ตัวอักษร → ค้นหาจาก subDistrict + district + province
 */
export function searchAddress(query: string, limit = 10): ThaiAddressRow[] {
  const q = query.trim();
  if (q.length < 2) return [];

  const rows = getRows();
  const isNumeric = /^\d+$/.test(q);

  if (isNumeric) {
    // ค้นหาจาก zip (exact prefix)
    return rows
      .filter(r => r.zip.startsWith(q))
      .slice(0, limit);
  }

  // ค้นหาจาก subDistrict → district → province
  const exactSub  = rows.filter(r => r.subDistrict === q);
  const startSub  = rows.filter(r => r.subDistrict.startsWith(q) && r.subDistrict !== q);
  const containSub = rows.filter(r => r.subDistrict.includes(q) && !r.subDistrict.startsWith(q));
  const containDist = rows.filter(r =>
    !r.subDistrict.includes(q) &&
    (r.district.includes(q) || r.province.includes(q))
  );

  return [...exactSub, ...startSub, ...containSub, ...containDist].slice(0, limit);
}

/**
 * ดึง sub-districts ทั้งหมดของ zip code นี้
 * ใช้เมื่อผู้ใช้กรอก zip แล้วต้องให้เลือกตำบล
 */
export function getSubDistrictsByZip(zip: string): ThaiAddressRow[] {
  return getRows().filter(r => r.zip === zip);
}

/**
 * Format แสดงผล row เป็น string สำหรับ dropdown
 */
export function formatAddressRow(r: ThaiAddressRow): string {
  return `${r.subDistrict} › ${r.district} › ${r.province} (${r.zip})`;
}
