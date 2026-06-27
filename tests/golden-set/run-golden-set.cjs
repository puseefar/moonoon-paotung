#!/usr/bin/env node
/**
 * Poatung Phase 3 — Golden Set Metrics Runner
 * อ้างอิง: poatung_phase3_golden_set_spec.md
 *
 * - โหลด parser ปัจจุบัน (transpile TS → vm) แบบ deterministic, ไม่ต่อ network
 * - ยิงทุกเคสใน golden_set_v1.jsonl แล้วเทียบกับ ground_truth
 * - คำนวณ FASR / coverage / suggestion accuracy / abstain precision-recall / per-field
 * - รายงาน overall + แยกราย difficulty_type (slice) เสมอ (§7)
 *
 * Usage:
 *   node tests/golden-set/run-golden-set.cjs                 → รายงาน + เขียน report.json
 *   node tests/golden-set/run-golden-set.cjs --save-baseline → เขียน baseline.json ด้วย
 *   node tests/golden-set/run-golden-set.cjs --check-baseline → fail ถ้า FASR slice แย่กว่า baseline (CI gate)
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..', '..');
const PARSER_FILE = path.join(ROOT, 'services', 'quickAddParser.ts');
const DATA_FILE = path.join(__dirname, 'golden_set_v1.jsonl');
const REPORT_FILE = path.join(__dirname, 'report.json');
const BASELINE_FILE = path.join(__dirname, 'baseline.json');

const AMOUNT_EPSILON = 0.5;
// หมวดเกษตรจริง (TP recall ของ #1) — expense:กิจกรรมการเกษตร, income:เกษตรกร
const AGRI_CATEGORIES = new Set(['กิจกรรมการเกษตร', 'เกษตรกร']);
// parser เป็น categorical confidence → map เป็น band ตามที่ UI ใช้จริง (§6)
//   high → auto (จำลอง auto-save), medium → suggest, low → abstain
const CONF_TO_BAND = { high: 'auto', medium: 'suggest', low: 'abstain' };

// ── หมวดหมู่จริงจาก db/seed.ts (ต้องตรงเป๊ะ เพราะ ground_truth label ด้วยชื่อเหล่านี้) ──
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

function loadCases() {
  if (!fs.existsSync(DATA_FILE)) {
    console.error(`ไม่พบไฟล์ golden set: ${DATA_FILE}`);
    process.exit(1);
  }
  return fs
    .readFileSync(DATA_FILE, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//'))
    .map((l, i) => {
      try {
        return JSON.parse(l);
      } catch (e) {
        console.error(`บรรทัด ${i + 1} parse ไม่ได้: ${e.message}`);
        process.exit(1);
      }
    });
}

// ── แปลงผล parser → predicted shape ที่เทียบกับ ground_truth ได้ ──
function toPrediction(parsed) {
  const band = parsed ? CONF_TO_BAND[parsed.confidence] : 'abstain';
  const clarify = parsed && parsed.clarify;

  if (clarify && clarify.kind === 'dual_entry') {
    const pair = (clarify.options || []).find((o) => o.pair && o.pair);
    const p = pair && pair.pair;
    return {
      band,
      confidence: parsed.confidence,
      transaction_count: 2,
      trade_link: true,
      amounts: p ? [p.expenseAmount, p.incomeAmount].sort((a, b) => a - b) : [],
      category: null, // leg category เป็น deterministic ที่ UI (cost→ต้นทุนขาย, revenue→business) ไม่ใช่ parser
      compound: true,
    };
  }

  // ambiguous clarify (เช่น ยืม+ดอกเบี้ย) → ถือว่า count ยังไม่ชัด, abstain-ish
  return {
    band,
    confidence: parsed ? parsed.confidence : 'low',
    transaction_count: 1,
    trade_link: false,
    amounts: parsed && parsed.amount != null ? [parsed.amount] : [],
    category: parsed && parsed.category ? parsed.category.name : null,
    compound: false,
  };
}

function amountsMatch(predAmounts, gtAmounts) {
  if (predAmounts.length !== gtAmounts.length) return false;
  const a = [...predAmounts].sort((x, y) => x - y);
  const b = [...gtAmounts].sort((x, y) => x - y);
  return a.every((v, i) => Math.abs(v - b[i]) <= AMOUNT_EPSILON);
}

// per-field correctness + overall (สำหรับเคส should_abstain=false เท่านั้น)
function evaluateConfident(gt, pred) {
  const gtAmounts = gt.transactions.map((t) => t.amount).sort((a, b) => a - b);
  const fields = {
    transaction_count: pred.transaction_count === gt.transaction_count,
    trade_link: pred.trade_link === Boolean(gt.trade_link),
    amount: amountsMatch(pred.amounts, gtAmounts),
    // category: เทียบเฉพาะ single tx; compound leg เป็น deterministic ที่ UI → ไม่นับเป็น field ของ parser
    category: gt.transaction_count >= 2 ? null : (pred.category === gt.transactions[0].category),
  };
  const applicable = Object.values(fields).filter((v) => v !== null);
  const overall = applicable.every(Boolean);
  return { fields, overall };
}

function pct(n, d) {
  return d === 0 ? null : n / d;
}
function fmtPct(v) {
  return v == null ? ' n/a ' : `${(v * 100).toFixed(1)}%`;
}

function newAgg() {
  return {
    total: 0,
    autoBand: 0,
    autoBandWrong: 0,
    suggestBand: 0,
    suggestBandCorrect: 0,
    abstainBand: 0,
    nonAbstainGT: 0, // ground_truth ไม่ใช่ should_abstain
    autoBandOnNonAbstain: 0,
    shouldAbstain: 0,
    shouldAbstainCaught: 0, // should_abstain ที่ระบบ abstain จริง
    field: { category: { c: 0, n: 0 }, amount: { c: 0, n: 0 }, transaction_count: { c: 0, n: 0 }, trade_link: { c: 0, n: 0 } },
  };
}

function accumulate(agg, c, pred, evalResult) {
  agg.total += 1;
  const band = pred.band;
  if (band === 'auto') agg.autoBand += 1;
  if (band === 'suggest') agg.suggestBand += 1;
  if (band === 'abstain') agg.abstainBand += 1;

  if (c.should_abstain) {
    agg.shouldAbstain += 1;
    if (band === 'abstain') agg.shouldAbstainCaught += 1;
    // should_abstain case ที่ไปอยู่ auto-band = FASR ผิดเสมอ
    if (band === 'auto') agg.autoBandWrong += 1;
    return;
  }

  // ground_truth มีคำตอบชัด
  agg.nonAbstainGT += 1;
  if (band === 'auto') agg.autoBandOnNonAbstain += 1;
  const correct = evalResult.overall;
  if (band === 'auto' && !correct) agg.autoBandWrong += 1;
  if (band === 'suggest' && correct) agg.suggestBandCorrect += 1;

  for (const k of Object.keys(agg.field)) {
    const v = evalResult.fields[k];
    if (v === null || v === undefined) continue;
    agg.field[k].n += 1;
    if (v) agg.field[k].c += 1;
  }
}

function summarize(agg) {
  return {
    n: agg.total,
    FASR: pct(agg.autoBandWrong, agg.autoBand),
    auto_band: agg.autoBand,
    coverage: pct(agg.autoBandOnNonAbstain, agg.nonAbstainGT),
    suggestion_accuracy: pct(agg.suggestBandCorrect, agg.suggestBand),
    abstain_recall: pct(agg.shouldAbstainCaught, agg.shouldAbstain),
    field_accuracy: {
      category: pct(agg.field.category.c, agg.field.category.n),
      amount: pct(agg.field.amount.c, agg.field.amount.n),
      transaction_count: pct(agg.field.transaction_count.c, agg.field.transaction_count.n),
      trade_link: pct(agg.field.trade_link.c, agg.field.trade_link.n),
    },
  };
}

function main() {
  const args = process.argv.slice(2);
  const parser = loadParser();
  const categories = buildSeedCategories();
  const cases = loadCases();

  const overall = newAgg();
  const bySlice = {};
  const failures = [];
  // agriculture TP recall (#1): เคส single-tx ที่ ground_truth เป็นหมวดเกษตร parser route ถูกกี่%
  const agri = { total: 0, caught: 0, missed: [] };

  for (const c of cases) {
    const slice = c.difficulty_type || 'unknown';
    if (!bySlice[slice]) bySlice[slice] = newAgg();

    const parsed = parser.parse(c.input_text, categories, { preferredType: 'expense' });
    const pred = toPrediction(parsed);
    const evalResult = c.should_abstain ? { fields: {}, overall: false } : evaluateConfident(c.ground_truth, pred);

    // agri TP recall — เฉพาะ single-tx (compound ไม่มี category ราย leg ที่ parser ให้)
    if (!c.should_abstain && c.ground_truth.transaction_count === 1) {
      const gtCat = c.ground_truth.transactions[0].category;
      if (AGRI_CATEGORIES.has(gtCat)) {
        agri.total += 1;
        if (pred.category && AGRI_CATEGORIES.has(pred.category)) agri.caught += 1;
        else agri.missed.push({ id: c.id, input: c.input_text, predicted: pred.category, band: pred.band, expected: gtCat });
      }
    }

    accumulate(overall, c, pred, evalResult);
    accumulate(bySlice[slice], c, pred, evalResult);

    // เก็บ failure ที่สำคัญ: auto-band แต่ผิด (= ตัวที่ทำให้ FASR ขึ้น)
    if (pred.band === 'auto' && ((c.should_abstain) || (!c.should_abstain && !evalResult.overall))) {
      failures.push({
        id: c.id,
        input: c.input_text,
        slice,
        predicted: { band: pred.band, confidence: pred.confidence, category: pred.category, amounts: pred.amounts, count: pred.transaction_count, trade_link: pred.trade_link },
        ground_truth: c.should_abstain ? 'should_abstain' : c.ground_truth,
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    dataFile: path.basename(DATA_FILE),
    caseCount: cases.length,
    thresholds: { note: 'categorical confidence → band', map: CONF_TO_BAND },
    overall: summarize(overall),
    agricultureRecall: { total: agri.total, caught: agri.caught, recall: pct(agri.caught, agri.total), missed: agri.missed },
    bySlice: Object.fromEntries(Object.entries(bySlice).map(([k, v]) => [k, summarize(v)])),
    autoBandFailures: failures,
  };

  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf8');

  // ── ตารางอ่านง่าย ──
  console.log('\nPoatung Golden Set v1 — Metrics Report');
  console.log(`Cases: ${cases.length}  ·  band map: high→auto, medium→suggest, low→abstain\n`);
  const o = report.overall;
  console.log('OVERALL');
  console.log(`  FASR (auto-band ผิด)      : ${fmtPct(o.FASR)}  (auto-band ${o.auto_band} เคส)`);
  console.log(`  Auto-save coverage        : ${fmtPct(o.coverage)}`);
  console.log(`  Suggestion accuracy       : ${fmtPct(o.suggestion_accuracy)}`);
  console.log(`  Abstain recall            : ${fmtPct(o.abstain_recall)}`);
  const ar = report.agricultureRecall;
  console.log(`  Agriculture TP recall (#1): ${fmtPct(ar.recall)}  (${ar.caught}/${ar.total} เคสเกษตร route ถูก)`);
  console.log(`  Field — category/amount/count/trade : ${fmtPct(o.field_accuracy.category)} / ${fmtPct(o.field_accuracy.amount)} / ${fmtPct(o.field_accuracy.transaction_count)} / ${fmtPct(o.field_accuracy.trade_link)}`);

  console.log('\nBY SLICE (difficulty_type)');
  const rows = Object.entries(report.bySlice).sort((a, b) => a[0].localeCompare(b[0]));
  console.log('  slice                         n   FASR    cover   sugg-acc  cat-acc  amt-acc');
  for (const [name, s] of rows) {
    const pad = (str, w) => String(str).padEnd(w);
    const padS = (str, w) => String(str).padStart(w);
    console.log(
      `  ${pad(name, 28)} ${padS(s.n, 3)}  ${padS(fmtPct(s.FASR), 6)}  ${padS(fmtPct(s.coverage), 6)}  ${padS(fmtPct(s.suggestion_accuracy), 7)}  ${padS(fmtPct(s.field_accuracy.category), 6)}  ${padS(fmtPct(s.field_accuracy.amount), 6)}`
    );
  }

  if (failures.length) {
    console.log(`\n⚠️  Auto-band failures (FASR drivers): ${failures.length} เคส — ดูรายละเอียดใน report.json`);
    for (const f of failures.slice(0, 12)) {
      console.log(`   [${f.slice}] "${f.input}" → cat=${f.predicted.category} amt=${JSON.stringify(f.predicted.amounts)}`);
    }
  } else {
    console.log('\n✅ ไม่มี auto-band failure (FASR = 0 ทุก slice)');
  }

  if (args.includes('--save-baseline')) {
    fs.writeFileSync(BASELINE_FILE, JSON.stringify(report, null, 2), 'utf8');
    console.log(`\n💾 บันทึก baseline → ${path.relative(ROOT, BASELINE_FILE)}`);
  }

  if (args.includes('--check-baseline')) {
    if (!fs.existsSync(BASELINE_FILE)) {
      console.error('\n❌ ไม่พบ baseline.json — รัน --save-baseline ก่อน');
      process.exit(1);
    }
    const base = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
    let worse = false;
    for (const [slice, s] of Object.entries(report.bySlice)) {
      const b = base.bySlice[slice];
      if (!b) continue;
      const cur = s.FASR ?? 0;
      const prev = b.FASR ?? 0;
      if (cur > prev + 1e-9) {
        console.error(`❌ FASR regress @ ${slice}: ${fmtPct(prev)} → ${fmtPct(cur)}`);
        worse = true;
      }
    }
    if (worse) process.exit(1);
    console.log('\n✅ ไม่มี FASR slice แย่กว่า baseline');
  }

  console.log(`\n→ report.json: ${path.relative(ROOT, REPORT_FILE)}\n`);
}

main();
