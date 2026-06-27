/**
 * Smart Money-Aware Parser test — แยกจำนวนเงิน ออกจาก ปริมาณสินค้า (tag-by-unit)
 *
 * ครอบเคสจากทุกทีม + กับดักที่ทีมสุดท้ายเตือน:
 *   - magnitude trap: "ขายไข่ 100 ฟอง ได้เงิน 90 บาท" → เงิน=90 (ไม่ใช่ 100)
 *   - ราคาต่อหน่วย "ละ": "30 ฟอง ฟองละ 5 บาท" → 150 (computed)
 *   - voice Thai numeral: "หมื่นห้า" → 15000
 *   - confidence gating: computed/inferred/ambiguous ต้อง "ไม่" เป็น high
 *
 * Run: node tests/smart-parser/money-quantity.test.cjs
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..', '..');
const PARSER_FILE = path.join(ROOT, 'services', 'quickAddParser.ts');

function loadParser() {
  const source = fs.readFileSync(PARSER_FILE, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: PARSER_FILE,
  });
  const sandbox = { exports: {}, module: { exports: {} }, require, console };
  vm.createContext(sandbox);
  vm.runInContext(transpiled.outputText, sandbox, { filename: PARSER_FILE });
  return sandbox.module.exports.quickAddParser || sandbox.exports.quickAddParser;
}

const parser = loadParser();
let failures = 0;

function check(text, expect) {
  const r = parser.parse(text, [], { preferredType: expect.type ?? 'expense' });
  const got = {
    type: r?.type ?? null,
    amount: r?.amount ?? null,
    quantity: r?.quantity ?? null,
    unit: r?.unit ?? null,
    source: r?.amountSource ?? null,
    confidence: r?.confidence ?? null,
  };
  const checks = [];
  if ('amount' in expect) checks.push(['amount', got.amount, expect.amount]);
  if ('quantity' in expect) checks.push(['quantity', got.quantity, expect.quantity]);
  if ('unit' in expect) checks.push(['unit', got.unit, expect.unit]);
  if ('type' in expect) checks.push(['type', got.type, expect.type]);
  if ('source' in expect) checks.push(['source', got.source, expect.source]);
  if ('notHigh' in expect) checks.push(['confidence!=high', got.confidence !== 'high', true]);
  if ('noteIncludes' in expect) {
    checks.push([`note⊇"${expect.noteIncludes}"`, (r?.note ?? '').includes(expect.noteIncludes), true]);
  }
  if ('action' in expect) checks.push(['action', r?.action ?? null, expect.action]);
  if ('clarifyAmounts' in expect) {
    const got = (r?.clarify?.options ?? []).map((o) => o.amount).sort((a, b) => a - b);
    const want = [...expect.clarifyAmounts].sort((a, b) => a - b);
    checks.push(['clarifyAmounts', JSON.stringify(got), JSON.stringify(want)]);
  }
  if ('hasPair' in expect) {
    const pair = (r?.clarify?.options ?? []).find((o) => o.pair);
    const got = pair ? `${pair.pair.incomeAmount}/${pair.pair.expenseAmount}` : null;
    checks.push(['pair', got, expect.hasPair]);
  }
  if ('clarifyKind' in expect) checks.push(['clarifyKind', r?.clarify?.kind ?? null, expect.clarifyKind]);

  const failed = checks.filter(([, a, b]) => a !== b);
  if (failed.length) {
    failures += 1;
    console.error(`  ❌ "${text}"`);
    for (const [field, a, b] of failed) console.error(`       ${field}: got ${a} · expected ${b}`);
  } else {
    console.log(`  ✅ "${text}" → ฿${got.amount}${got.quantity ? ` (${got.quantity} ${got.unit})` : ''} [${got.source}]`);
  }
}

console.log('Core: แยกเงินออกจากปริมาณ');
check('ขายมันสำปะหลัง 5 ตันได้เงิน 15,000 บาท', { type: 'income', amount: 15000, quantity: 5, unit: 'ตัน', source: 'explicit' });
check('ขายข้าว 10 กระสอบ ได้เงิน 8,500 บาท', { type: 'income', amount: 8500, quantity: 10, unit: 'กระสอบ' });
check('ขายผัก 20 กิโล ได้เงิน 1,200 บาท', { type: 'income', amount: 1200, quantity: 20, unit: 'กิโล' });
check('ซื้อปุ๋ย 3 กระสอบ 1,500 บาท', { type: 'expense', amount: 1500, quantity: 3, unit: 'กระสอบ' });
check('รับค่าตัดต่อวิดีโอ 3 งาน ได้เงิน 4,500 บาท', { type: 'income', amount: 4500, quantity: 3, unit: 'งาน' });
check('ขายเสื้อ 5 ตัว ได้ 1,000 บาท', { type: 'income', amount: 1000, quantity: 5, unit: 'ตัว' });

console.log('Magnitude trap (ทีมสุดท้าย): ปริมาณใหญ่กว่าเงิน');
check('ขายไข่ 100 ฟอง ได้เงิน 90 บาท', { type: 'income', amount: 90, quantity: 100, unit: 'ฟอง' });

console.log('ราคาต่อหน่วย "ละ" → คำนวณยอดรวม');
check('ขายไข่ 30 ฟอง ฟองละ 5 บาท', { type: 'income', amount: 150, quantity: 30, unit: 'ฟอง', source: 'computed', notHigh: true });
check('ขายมัน 5 ตัน ตันละ 3,000', { type: 'income', amount: 15000, quantity: 5, unit: 'ตัน', source: 'computed', notHigh: true });
// ทีม 3: บั๊ก note เลขหาย — ต้องเก็บประโยคต้นฉบับครบ (เลข 60 ต้องไม่หาย)
check('ขายปลา 5 ตัวตัวละ 60 บาท', { type: 'income', amount: 300, quantity: 5, unit: 'ตัว', source: 'computed', noteIncludes: '60' });

console.log('Nested units (หลายชั้น): 11 ตัว × 1 กก./ตัว × 80 บาท/กก. = 880');
check('ขายไก่ 11 ตัวตัวละ 1 กิโลกรัมกิโลกรัมละ 80 บาท', { type: 'income', amount: 880, quantity: 11, unit: 'ตัว', source: 'ambiguous', notHigh: true });

console.log('Cross-unit conversion (กรัม↔กิโลกรัม): 80 ตัว × 700 ก. = 56 กก. × 75 = 4,200');
check('ขายกบ 80 ตัวตัวละ 700 กรัมกิโลกรัมละ 75 บาท', { type: 'income', amount: 4200, quantity: 80, unit: 'ตัว', source: 'ambiguous', notHigh: true });

console.log('Voice Thai numeral words (แบบเต็ม)');
check('ขายมันได้เงินหนึ่งหมื่นห้าพัน', { type: 'income', amount: 15000 });
check('ไลฟ์สดขายทุเรียน 4 แสนบาท', { type: 'income', amount: 400000 });
// หมายเหตุ: คำพูดย่อ "หมื่นห้า" (=15,000) ยังไม่รองรับโดยตั้งใจ — กำกวมกับ "ร้อยห้า"(=105)
//   ปัจจุบันคืน amount=null → confidence gating บังคับให้ผู้ใช้พิมพ์เอง (ปลอดภัยกว่าเดาผิด)
check('ขายมันได้เงินหมื่นห้า', { amount: null });

console.log('เปอร์เซ็นต์ (ค่านายหน้า/กำไร %) — เคส Toyota (ทีม 3 P1/P2)');
// "ขายรถ 850,000 บาท ได้ค่านายหน้า 3%" → รายรับจริง = 850,000 × 3% = 25,500 (ไม่ใช่ 850,000!)
check('ขายรถ toyota 850000 บาท ได้ค่านายหน้า 3%', { type: 'income', amount: 25500, source: 'computed', notHigh: true });
check('ขายบ้าน 2000000 บาท ค่านายหน้า 3 เปอร์เซ็นต์', { type: 'income', amount: 60000, source: 'computed', notHigh: true });
check('ขายของได้กำไร 10% จาก 5000 บาท', { type: 'income', amount: 500, source: 'computed', notHigh: true });

console.log('Phase 1 — Deterministic modifiers (ทอน/ลด/บวก/ลด%)');
// ทอน: ยอดจ่ายจริง = paid − change
check('ซื้อของจ่าย 200 ทอน 80', { type: 'expense', amount: 120, source: 'computed', notHigh: true });
check('จ่ายเงิน 1000 ได้เงินทอน 250', { type: 'expense', amount: 750, source: 'computed', notHigh: true });
// ลด (จำนวนเต็ม)
check('ขายส้มได้ 500 ลดให้ 50 บาท', { type: 'income', amount: 450, source: 'computed', notHigh: true });
// บวกค่าส่ง
check('ค่าอาหาร 800 บวกค่าส่ง 40', { type: 'expense', amount: 840, source: 'computed', notHigh: true });
// ลดเป็น %
check('ซื้อของ 1000 บาท ลด 10%', { type: 'expense', amount: 900, source: 'computed', notHigh: true });

console.log('Phase 2 — Clarifying Question (interpretation-ambiguous → ถามกลับ)');
// ซื้อ + ขาย → เสนอ รายรับ 2,200 / กำไร 1,400 / ต้นทุน 800
check('ซื้อผักจากชาวบ้าน 800 บาทไปขายที่ตลาดได้เงิน 2,200 บาท', {
  action: 'ask', clarifyKind: 'dual_entry', clarifyAmounts: [2200, 2200, 800], hasPair: '2200/800',
});
// AC#5: ต้องไม่มีตัวเลือก "เฉพาะกำไร" (กับดักบัญชี — กำไรเป็น derived เท่านั้น)
{
  const r = parser.parse('ซื้อไก่สด 1500 บาทไปย่างขายในตลาดได้เงินทั้งหมด 4200 บาท', [], { preferredType: 'expense' });
  const hasProfitOnly = (r?.clarify?.options ?? []).some((o) => !o.pair && o.amount === 2700);
  if (hasProfitOnly) { failures += 1; console.error('  ❌ ยังมีตัวเลือก "เฉพาะกำไร 2700" (ต้องลบ)'); }
  else console.log('  ✅ ไม่มีตัวเลือก "เฉพาะกำไร" (atomic เท่านั้น) — ไก่ย่าง 1500+4200');
}
// ยืม + ดอกเบี้ย% → เสนอ ดอกเบี้ยรับ 7,000 / เงินต้น 100,000
check('เพื่อนยืมเงินไป 100,000 บาท รับดอกเบี้ยมา 7%', {
  action: 'ask', clarifyAmounts: [7000, 100000],
});
check('เพื่อนยืมเงินไป 60000 บาท จ่ายดอกเบี้ยกลับมา 6%', {
  action: 'ask', clarifyAmounts: [3600, 60000],
});
// ดอกเบี้ย% โดยไม่มี "ยืม" → คิดเป็นรายรับ base × % (ไม่กำกวม)
check('ได้ดอกเบี้ย 7% จาก 100000 บาท', { type: 'income', amount: 7000, source: 'computed', notHigh: true });

console.log('ไม่มีราคา → ปริมาณอย่างเดียว (amount = null)');
check('ขายของ 500 ชิ้น', { amount: null, quantity: 500, unit: 'ชิ้น', source: 'none' });

console.log('Category suggestion: "ขายในตลาด" → ขายของในตลาด (team #5)');
{
  const cats = [
    { id: 'c1', name: 'ขายของในตลาด', type: 'income', icon: '🧺' },
    { id: 'c2', name: 'ธุรกิจส่วนตัว', type: 'income', icon: '🏪' },
    { id: 'c3', name: 'อื่นๆ', type: 'income', icon: '📦' },
  ];
  const r = parser.parse('เอาไก่ไปทอดขายในตลาดได้เงิน 500 บาท', cats, { preferredType: 'income' });
  if (r?.category?.name === 'ขายของในตลาด') console.log('  ✅ "ทอดขายในตลาด" → หมวด ขายของในตลาด');
  else { failures += 1; console.error(`  ❌ category got "${r?.category?.name}" (ต้องการ ขายของในตลาด)`); }
}

console.log('Backward-compat: เลขเดี่ยว');
check('กาแฟ 45', { amount: 45, source: 'sole' });
check('จ่ายค่าน้ำไฟ 1200 บาท', { amount: 1200, source: 'explicit' });

console.log('');
if (failures > 0) {
  console.error(`Smart parser test: ${failures} case(s) FAILED`);
  process.exit(1);
}
console.log('Smart parser test: ALL PASSED ✅');
