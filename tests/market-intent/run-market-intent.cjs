#!/usr/bin/env node
/**
 * Mini Golden Set — Market Selling Intent (มติทีม 8 มิ.ย. 2569)
 *
 * ทดสอบ rule "ขายของในตลาด" แบบแคบ + guard แยกออกจาก golden เดิม (อย่าปนกัน)
 *   positive_trade        → ซื้อมา-ทำ-ขาย เป็นชุดซื้อ-ขาย + มั่นใจสูง
 *   positive_single       → ขาย/ทอดขาย/เอาไปขาย เดี่ยว → income/ขายของในตลาด
 *   negative_no_hijack    → คำว่า "ตลาด" เดี่ยว ๆ ห้ามถูกดึงเป็น "ขายของในตลาด"/รายรับ
 *   negative_income       → รายรับที่ไม่ใช่ค้าขายตลาด ห้าม over-fire
 *   ambiguous_not_high    → กำกวม → ห้ามมั่นใจสูง (กัน false confidence)
 *
 * ใช้ SEED categories ชุดเดียวกับ golden runner (db/seed.ts จริง) เพราะ default test profile
 *   ไม่มีหมวด "ขายของในตลาด"
 *
 * Usage: node tests/market-intent/run-market-intent.cjs
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..', '..');
const PARSER_FILE = path.join(ROOT, 'services', 'quickAddParser.ts');
const CASES_FILE = path.join(__dirname, 'cases.market-intent.json');
const CONF_TO_BAND = { high: 'auto', medium: 'suggest', low: 'abstain' };
const AMOUNT_EPSILON = 0.5;

const SEED_EXPENSE = [
  'อาหาร/เครื่องดื่ม', 'เดินทาง/น้ำมัน', 'ที่อยู่อาศัย/ค่าเช่า', 'ค่าน้ำ/ค่าไฟ',
  'ค่าโทรศัพท์/อินเทอร์เน็ต', 'ช้อปปิ้ง', 'สุขภาพ/ยา', 'การศึกษา', 'บันเทิง', 'เสื้อผ้า',
  'อื่นๆ', 'Lifestyle', 'Trip/ทัวร์', 'ท่องเที่ยววันหยุด', 'ทำบุญ/การกุศล',
  'ประกอบธุรกิจ', 'กิจกรรมการเกษตร', 'ต้นทุนขาย',
];
const SEED_INCOME = [
  'เงินเดือน', 'รายได้เสริม/ฟรีแลนซ์', 'ดอกเบี้ย', 'ของขวัญ/โบนัส', 'อื่นๆ',
  'ธุรกิจส่วนตัว', 'ร้านอาหาร', 'ขายของในตลาด', 'แม่ค้าออนไลน์', 'ศิลปิน',
  'เกษตรกร', 'นักกีฬา', 'Gamer', 'พนักงานไอที', 'ค่าคอมมิชชั่น',
];

function buildSeedCategories() {
  const mk = (name, type, i) => ({ id: `${type}_${i}`, name, type, icon: '📦', color: '#999', sortOrder: i });
  return [
    ...SEED_EXPENSE.map((n, i) => mk(n, 'expense', i)),
    ...SEED_INCOME.map((n, i) => mk(n, 'income', i)),
  ];
}

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

function evaluateCase(parsed, c) {
  const reasons = [];
  const type = parsed ? parsed.type : null;
  const category = parsed && parsed.category ? parsed.category.name : null;
  const band = parsed ? CONF_TO_BAND[parsed.confidence] : 'abstain';
  const isTradeSet = Boolean(parsed && parsed.clarify && parsed.clarify.kind === 'dual_entry');
  const costAmount = parsed && parsed.tradeSet ? parsed.tradeSet.cost.amount : null;
  const revenueAmount = parsed && parsed.tradeSet ? parsed.tradeSet.revenue.amount : null;
  const profit = costAmount != null && revenueAmount != null ? revenueAmount - costAmount : null;
  const costCategory = parsed && parsed.tradeSet && parsed.tradeSet.cost.category
    ? parsed.tradeSet.cost.category.name
    : null;
  const revenueCategory = parsed && parsed.tradeSet && parsed.tradeSet.revenue.category
    ? parsed.tradeSet.revenue.category.name
    : null;
  const businessActivity = parsed && parsed.tradeSet && parsed.tradeSet.businessActivity
    ? parsed.tradeSet.businessActivity.name
    : null;

  if (c.expectType && type !== c.expectType) reasons.push(`type ${type}≠${c.expectType}`);
  if (c.expectCategory && category !== c.expectCategory) reasons.push(`cat ${category}≠${c.expectCategory}`);
  if (c.expectCostAmount != null && (costAmount == null || Math.abs(costAmount - c.expectCostAmount) > AMOUNT_EPSILON))
    reasons.push(`costAmount ${costAmount}≠${c.expectCostAmount}`);
  if (c.expectRevenueAmount != null && (revenueAmount == null || Math.abs(revenueAmount - c.expectRevenueAmount) > AMOUNT_EPSILON))
    reasons.push(`revenueAmount ${revenueAmount}≠${c.expectRevenueAmount}`);
  if (c.expectProfit != null && (profit == null || Math.abs(profit - c.expectProfit) > AMOUNT_EPSILON))
    reasons.push(`profit ${profit}≠${c.expectProfit}`);
  if (c.expectCostCategory && costCategory !== c.expectCostCategory)
    reasons.push(`costCat ${costCategory}≠${c.expectCostCategory}`);
  if (c.expectRevenueCategory && revenueCategory !== c.expectRevenueCategory)
    reasons.push(`revenueCat ${revenueCategory}≠${c.expectRevenueCategory}`);
  if (c.expectBusinessActivity && businessActivity !== c.expectBusinessActivity)
    reasons.push(`activity ${businessActivity}≠${c.expectBusinessActivity}`);
  if (c.notCategory && category === c.notCategory) reasons.push(`cat ถูก hijack = ${category}`);
  if (typeof c.expectTradeSet === 'boolean' && isTradeSet !== c.expectTradeSet)
    reasons.push(`tradeSet ${isTradeSet}≠${c.expectTradeSet}`);
  if (c.expectConfidence && (parsed && parsed.confidence) !== c.expectConfidence)
    reasons.push(`conf ${parsed && parsed.confidence}≠${c.expectConfidence}`);
  if (c.notConfidence && parsed && parsed.confidence === c.notConfidence)
    reasons.push(`conf ห้ามเป็น ${c.notConfidence}`);

  return {
    pass: reasons.length === 0,
    reasons,
    type,
    category,
    band,
    isTradeSet,
    costAmount,
    revenueAmount,
    profit,
    costCategory,
    revenueCategory,
    businessActivity,
  };
}

function caseLearningRules(c, categories) {
  if (!Array.isArray(c.learningRules)) return undefined;
  return c.learningRules.map((rule) => {
    const category = categories.find((cat) => cat.type === rule.type && cat.name === rule.category);
    if (!category) throw new Error(`ไม่พบหมวด learning "${rule.category}" ในเคส ${c.id}`);
    return {
      keyword: rule.keyword ?? rule.normalizedKeyword,
      normalizedKeyword: rule.normalizedKeyword,
      type: rule.type,
      categoryId: category.id,
      confidence: rule.confidence ?? 10,
    };
  });
}

function main() {
  const parser = loadParser();
  const categories = buildSeedCategories();
  const { cases } = JSON.parse(fs.readFileSync(CASES_FILE, 'utf8'));

  const groups = {};
  const failures = [];

  for (const c of cases) {
    const parsed = parser.parse(c.text, categories, {
      preferredType: 'expense',
      learningRules: caseLearningRules(c, categories),
    });
    const r = evaluateCase(parsed, c);
    const g = c.group || 'unknown';
    if (!groups[g]) groups[g] = { total: 0, pass: 0 };
    groups[g].total += 1;
    if (r.pass) groups[g].pass += 1;
    else failures.push({
      id: c.id,
      text: c.text,
      group: g,
      reasons: r.reasons,
      got: {
        type: r.type,
        cat: r.category,
        costAmount: r.costAmount,
        revenueAmount: r.revenueAmount,
        profit: r.profit,
        costCat: r.costCategory,
        revenueCat: r.revenueCategory,
        activity: r.businessActivity,
        conf: parsed && parsed.confidence,
        tradeSet: r.isTradeSet,
      },
    });
  }

  console.log('\nMarket Selling Intent — Mini Golden Set');
  console.log(`ENABLE_MARKET_SELLING_INTENT flag · cases: ${cases.length}\n`);
  for (const [name, s] of Object.entries(groups)) {
    const ok = s.pass === s.total;
    console.log(`  ${ok ? '✅' : '❌'} ${name.padEnd(24)} ${s.pass}/${s.total}`);
  }

  if (failures.length) {
    console.log(`\n❌ FAIL ${failures.length} เคส:`);
    for (const f of failures) {
      console.log(`  - ${f.id} | ${f.text}`);
      console.log(
        `      got: type=${f.got.type} cat=${f.got.cat} cost=${f.got.costAmount}/${f.got.costCat} revenue=${f.got.revenueAmount}/${f.got.revenueCat} profit=${f.got.profit} activity=${f.got.activity} conf=${f.got.conf} tradeSet=${f.got.tradeSet}`
      );
      console.log(`      why: ${f.reasons.join(' · ')}`);
    }
    process.exitCode = 1;
  } else {
    console.log(`\n✅ ผ่านทั้งหมด ${cases.length} เคส`);
  }
}

main();
