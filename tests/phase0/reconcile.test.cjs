/**
 * Phase 0 — Single Ledger reconcile logic test (pure, no DB)
 *
 * พิสูจน์คณิตศาสตร์ของ migration/assertReconciled โดยจำลองสถานการณ์จากเอกสาร:
 *   ยอดกระเป๋ารวม = 94,500  แต่ธุรกรรม net = +9,500
 *   → มี 85,000 ที่ "ลอย" อยู่ใน balance แต่ไม่อยู่ใน ledger (= opening ที่หายไป)
 *
 * Run: node tests/phase0/reconcile.test.cjs
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
function approx(a, b) {
  return Math.abs(a - b) < 0.005;
}

// ── replica ของ logic ใน db/migrations/phase0.ts + walletService ────────────────

// ผลรวมธุรกรรมที่ไม่ใช่ opening ที่กระทบยอดของกระเป๋าหนึ่ง
function ledgerEffectForWallet(walletId, rows) {
  let effect = 0;
  for (const r of rows) {
    if (r.walletId !== walletId) continue;
    if (r.type === 'income' || r.type === 'transfer_in') effect += r.amount;
    else if (r.type === 'expense' || r.type === 'transfer_out') effect -= r.amount;
  }
  return effect;
}

// backfill: implied opening = balance ปัจจุบัน − ผลรวมธุรกรรมที่มีอยู่
function backfillOpenings(walletsList, txRows) {
  const nonOpening = txRows.filter((t) => t.type !== 'opening');
  const openings = [];
  for (const w of walletsList) {
    const effect = ledgerEffectForWallet(w.id, nonOpening);
    const implied = w.balance - effect;
    if (Math.abs(implied) >= 0.005) {
      openings.push({ type: 'opening', amount: implied, walletId: w.id });
    }
  }
  return openings;
}

// assertReconciled: Σ wallet.balance === Σ ledger signed
function reconcile(walletsList, txRows) {
  const ledgerByWallet = new Map();
  const add = (id, d) => ledgerByWallet.set(id, (ledgerByWallet.get(id) ?? 0) + d);
  for (const r of txRows) {
    if (r.type === 'opening' || r.type === 'income' || r.type === 'transfer_in') add(r.walletId, r.amount);
    else if (r.type === 'expense' || r.type === 'transfer_out') add(r.walletId, -r.amount);
    else if (r.type === 'transfer') {
      add(r.walletId, -r.amount);
      add(r.toWalletId, r.amount);
    }
  }
  const perWallet = walletsList.map((w) => ({
    id: w.id,
    stored: w.balance,
    ledger: ledgerByWallet.get(w.id) ?? 0,
  }));
  const walletTotal = perWallet.reduce((s, w) => s + w.stored, 0);
  const ledgerTotal = perWallet.reduce((s, w) => s + w.ledger, 0);
  const ok = approx(walletTotal, ledgerTotal) && perWallet.every((w) => approx(w.stored, w.ledger));
  return { ok, walletTotal, ledgerTotal, perWallet };
}

// ── Scenario 1: ตรงตามเอกสาร (ก่อน migration ยังไม่ reconcile) ───────────────────
console.log('Scenario 1 — เอกสาร: opening 85,000 หายจาก ledger');
{
  // current balances รวม 94,500 (income/expense ถูก apply ลง balance แล้ว)
  const wallets = [
    { id: 'cash', balance: 4500 },
    { id: 'baac', balance: 40000 },
    { id: 'ktb', balance: 50000 }, // 40,000 opening + 20,000 income − 10,500 expense
  ];
  // ledger เดิม มีแค่ income/expense (ไม่มี opening)
  const txBefore = [
    { type: 'income', amount: 20000, walletId: 'ktb' },
    { type: 'expense', amount: 10500, walletId: 'ktb' },
  ];

  const before = reconcile(wallets, txBefore);
  assert(!before.ok, 'ก่อน migrate: ledger ยัง "ไม่" reconcile (ตรงกับอาการในเอกสาร)');
  assert(approx(before.walletTotal - before.ledgerTotal, 85000), 'ส่วนต่างที่หาย = 85,000 พอดี');

  // รัน backfill
  const openings = backfillOpenings(wallets, txBefore);
  const openingTotal = openings.reduce((s, o) => s + o.amount, 0);
  assert(approx(openingTotal, 85000), 'opening ที่ backfill รวม = 85,000');

  const after = reconcile(wallets, [...txBefore, ...openings]);
  assert(after.ok, 'หลัง backfill: ledger reconcile กับยอดกระเป๋าทุกใบ');
  assert(approx(after.ledgerTotal, 94500), 'ledger รวม = 94,500 = ยอดกระเป๋ารวม');
}

// ── Scenario 2: โอนคู่ entry ไม่กระทบสินทรัพย์รวม + reconcile ────────────────────
console.log('Scenario 2 — โอนเงินระหว่างกระเป๋า (paired entry)');
{
  const wallets = [
    { id: 'a', balance: 7000 }, // 10,000 opening − 3,000 โอนออก
    { id: 'b', balance: 3000 }, // 0 opening + 3,000 โอนเข้า
  ];
  const groupId = 'g1';
  const tx = [
    { type: 'opening', amount: 10000, walletId: 'a' },
    { type: 'transfer_out', amount: 3000, walletId: 'a', transferGroupId: groupId },
    { type: 'transfer_in', amount: 3000, walletId: 'b', transferGroupId: groupId },
  ];
  const r = reconcile(wallets, tx);
  assert(r.ok, 'โอนแล้วแต่ละกระเป๋ายัง reconcile');
  assert(approx(r.ledgerTotal, 10000), 'สินทรัพย์รวมไม่เปลี่ยนจากการโอน (net โอน = 0)');
}

// ── Scenario 3: legacy transfer (แถวเดียว) → reconcile ได้เช่นกัน ────────────────
console.log('Scenario 3 — legacy transfer (ก่อนแปลงเป็นคู่)');
{
  const wallets = [
    { id: 'a', balance: 7000 },
    { id: 'b', balance: 3000 },
  ];
  const tx = [
    { type: 'opening', amount: 10000, walletId: 'a' },
    { type: 'transfer', amount: 3000, walletId: 'a', toWalletId: 'b' },
  ];
  const r = reconcile(wallets, tx);
  assert(r.ok, 'legacy transfer ยัง reconcile (รองรับช่วงก่อน migrate)');
}

console.log('');
if (failures > 0) {
  console.error(`Phase 0 reconcile test: ${failures} assertion(s) FAILED`);
  process.exit(1);
}
console.log('Phase 0 reconcile test: ALL PASSED ✅');
