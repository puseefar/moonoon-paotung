/**
 * Phase 2 — Financial health logic test (pure, no DB)
 *
 * พิสูจน์ §4.2: ratio = ใช้ไปเดือนนี้ / เงินเข้าเดือนนี้ → สถานะ + ข้อความผูกเลขจริง
 * และ §6.2: วัน/เดือนที่ไม่มีกิจกรรม ต้อง "ไม่ชม" (neutral) ไม่ใช่ praise
 *
 * Run: node tests/phase2/health.test.cjs
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

// ── replica ของ financeSummaryService.getFinancialHealth ───────────────────────
function computeHealth(income, expense) {
  const hasActivity = income > 0 || expense > 0;
  const ratio = income > 0 ? expense / income : 0;
  let status;
  if (!hasActivity) status = 'neutral';
  else if (income <= 0 && expense > 0) status = 'over';
  else if (ratio <= 0.6) status = 'good';
  else if (ratio <= 1) status = 'warning';
  else status = 'over';
  return { status, income, expense, remaining: income - expense, ratio, spentPercent: ratio * 100, hasActivity };
}

console.log('§4.2 — ratio → status');
{
  // ตัวอย่างในเอกสาร: 10,500 / 20,000 = 52.5% → ดี เหลือ 9,500
  const doc = computeHealth(20000, 10500);
  assert(doc.status === 'good', 'income 20,000 / expense 10,500 → good');
  assert(Math.abs(doc.spentPercent - 52.5) < 0.01, 'spentPercent = 52.5%');
  assert(doc.remaining === 9500, 'เหลือใช้เดือนนี้ = 9,500');

  assert(computeHealth(20000, 12000).status === 'good', 'ratio 0.6 พอดี → good (≤0.6)');
  assert(computeHealth(20000, 13000).status === 'warning', 'ratio 0.65 → warning');
  assert(computeHealth(20000, 20000).status === 'warning', 'ratio 1.0 พอดี → warning (≤1)');
  assert(computeHealth(20000, 25000).status === 'over', 'ratio 1.25 → over');
}

console.log('§6.2 — ไม่มีกิจกรรม ต้องไม่ชม');
{
  const zero = computeHealth(0, 0);
  assert(zero.status === 'neutral', 'income 0 / expense 0 → neutral (ไม่ชม ไม่เตือน)');
  assert(zero.hasActivity === false, 'hasActivity = false');

  // จ่ายโดยไม่มีรายรับ → over (ไม่ใช่ good)
  const spendOnly = computeHealth(0, 5000);
  assert(spendOnly.status === 'over', 'จ่าย 5,000 แต่ไม่มีรายรับ → over');
}

console.log('');
if (failures > 0) {
  console.error(`Phase 2 health test: ${failures} assertion(s) FAILED`);
  process.exit(1);
}
console.log('Phase 2 health test: ALL PASSED ✅');
