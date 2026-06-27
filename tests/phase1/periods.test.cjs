/**
 * Phase 1 — Thai-time period boundary test (pure, no DB)
 *
 * พิสูจน์ว่า getTodayRange / getMonthRange (Asia/Bangkok) จัดวันถูกต้อง
 * โดยเฉพาะ edge case ตาม checklist §8: รายการเวลา 23:30 และ 00:30
 *
 * Run: node tests/phase1/periods.test.cjs
 */

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    failures += 1;
    console.error(`  ❌ ${msg}`);
  } else {
    console.log(`  ✅ ${msg}`);
  }
}

// ── replica ของ lib/time.ts ───────────────────────────────────────────────────
const THAI = 7 * 3_600_000;
function getThaiDateParts(date) {
  const t = new Date(date.getTime() + THAI);
  return { year: t.getUTCFullYear(), month: t.getUTCMonth(), day: t.getUTCDate() };
}
function getTodayRange(now) {
  const { year, month, day } = getThaiDateParts(now);
  const startMs = Date.UTC(year, month, day, 0, 0, 0, 0) - THAI;
  return { startDate: new Date(startMs), endDate: new Date(startMs + 24 * 3_600_000 - 1) };
}
function getMonthRange(year, month) {
  const startMs = Date.UTC(year, month, 1, 0, 0, 0, 0) - THAI;
  const endMs = Date.UTC(year, month + 1, 1, 0, 0, 0, 0) - THAI - 1;
  return { startDate: new Date(startMs), endDate: new Date(endMs) };
}
// สร้าง instant จากเวลา "ผนัง" ไทย
function thaiWallTime(y, m, d, hh, mm) {
  return new Date(Date.UTC(y, m, d, hh, mm, 0, 0) - THAI);
}
function inRange(t, r) {
  return t.getTime() >= r.startDate.getTime() && t.getTime() <= r.endDate.getTime();
}

// ── §8: 23:30 วันนี้ ต้องอยู่ในวันนี้, 00:30 วันถัดไป ต้องไม่อยู่ ──────────────────
console.log('Period boundaries — Asia/Bangkok');
{
  // อ้างอิง "ตอนนี้" = 5 มิ.ย. 2026 เวลาไทย 12:00
  const now = thaiWallTime(2026, 5, 5, 12, 0);
  const today = getTodayRange(now);

  const at2330 = thaiWallTime(2026, 5, 5, 23, 30); // 5 มิ.ย. 23:30
  const at0030NextDay = thaiWallTime(2026, 5, 6, 0, 30); // 6 มิ.ย. 00:30
  const at0030Today = thaiWallTime(2026, 5, 5, 0, 30); // 5 มิ.ย. 00:30

  assert(inRange(at2330, today), '23:30 ของวันนี้ → อยู่ในช่วง "วันนี้"');
  assert(inRange(at0030Today, today), '00:30 ของวันนี้ → อยู่ในช่วง "วันนี้"');
  assert(!inRange(at0030NextDay, today), '00:30 ของวันถัดไป → "ไม่" อยู่ในวันนี้');
}

// ── ขอบเขตเดือน: 31 พ.ค. 23:30 ไม่ใช่ มิ.ย., 1 มิ.ย. 00:30 คือ มิ.ย. ───────────────
console.log('Month boundaries');
{
  const june = getMonthRange(2026, 5); // มิถุนายน (month=5)

  const may31_2330 = thaiWallTime(2026, 4, 31, 23, 30); // 31 พ.ค. 23:30
  const jun1_0030 = thaiWallTime(2026, 5, 1, 0, 30); // 1 มิ.ย. 00:30
  const jun30_2330 = thaiWallTime(2026, 5, 30, 23, 30); // 30 มิ.ย. 23:30
  const jul1_0000 = thaiWallTime(2026, 6, 1, 0, 0); // 1 ก.ค. 00:00

  assert(!inRange(may31_2330, june), '31 พ.ค. 23:30 → ไม่อยู่ในเดือน มิ.ย.');
  assert(inRange(jun1_0030, june), '1 มิ.ย. 00:30 → อยู่ในเดือน มิ.ย.');
  assert(inRange(jun30_2330, june), '30 มิ.ย. 23:30 → อยู่ในเดือน มิ.ย.');
  assert(!inRange(jul1_0000, june), '1 ก.ค. 00:00 → ไม่อยู่ในเดือน มิ.ย.');
}

console.log('');
if (failures > 0) {
  console.error(`Phase 1 period test: ${failures} assertion(s) FAILED`);
  process.exit(1);
}
console.log('Phase 1 period test: ALL PASSED ✅');
