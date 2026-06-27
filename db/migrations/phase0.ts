import { and, eq } from 'drizzle-orm';
import { db, expoDb } from '../client';
import { appSettings, transactions, wallets } from '../schema';
import { generateId } from '../../lib/uuid';

// ─────────────────────────────────────────────────────────────────────────────
// Phase 0 — Single Ledger migration
//
// เป้าหมาย: ทำให้ Invariant เป็นจริง
//   ยอดคงเหลือกระเป๋า = ยอดตั้งต้น(opening) + ผลรวมธุรกรรมทุกชนิดที่ผูกกับกระเป๋า
//
// 1. เพิ่มคอลัมน์ transfer_group_id (สำหรับ DB เก่าที่สร้างก่อน Phase 0)
// 2. Backfill (รันครั้งเดียว, มี flag กัน):
//    a. แปลง transfer (แถวเดียว) เดิม → คู่ transfer_out + transfer_in
//    b. สร้าง opening transaction = ยอดที่ "ลอย" อยู่ใน wallet.balance
//       (= balance ปัจจุบัน − ผลรวมธุรกรรมที่มีอยู่) ให้ ledger reconcile กับกระเป๋า
// ─────────────────────────────────────────────────────────────────────────────

const MIGRATION_FLAG_KEY = 'phase0_ledger_migrated';
const WALLET_AUDIT_BACKFILL_KEY = 'wallet_audit_backfilled';
const EPSILON = 0.005; // กันปัญหา floating point ของ real

type PragmaColumn = { name: string };

/** เพิ่มคอลัมน์ที่ใช้ผูกกลุ่ม (transfer/trade) + index ถ้ายังไม่มี (idempotent) */
async function ensureTransferGroupColumn(): Promise<void> {
  const columns = (await expoDb.getAllAsync(
    `PRAGMA table_info(transactions);`
  )) as PragmaColumn[];
  const has = (name: string) => columns.some((c) => c.name === name);

  if (!has('transfer_group_id')) {
    await expoDb.execAsync(`ALTER TABLE transactions ADD COLUMN transfer_group_id text;`);
  }
  // Compound trade (ซื้อมาขายไป) — ผูก 2 ขา cost+revenue
  if (!has('trade_group_id')) {
    await expoDb.execAsync(`ALTER TABLE transactions ADD COLUMN trade_group_id text;`);
  }
  if (!has('trade_role')) {
    await expoDb.execAsync(`ALTER TABLE transactions ADD COLUMN trade_role text;`);
  }

  await expoDb.execAsync(
    `CREATE INDEX IF NOT EXISTS idx_transactions_transfer_group ON transactions(transfer_group_id);`
  );
  await expoDb.execAsync(
    `CREATE INDEX IF NOT EXISTS idx_transactions_trade_group ON transactions(trade_group_id);`
  );
}

/** Phase 2 — เพิ่มคอลัมน์ Wallet Audit Trail (idempotent) */
async function ensureWalletAuditColumns(): Promise<void> {
  const columns = (await expoDb.getAllAsync(
    `PRAGMA table_info(transactions);`
  )) as PragmaColumn[];
  const has = (name: string) => columns.some((c) => c.name === name);

  if (!has('wallet_name_snapshot')) {
    await expoDb.execAsync(`ALTER TABLE transactions ADD COLUMN wallet_name_snapshot text;`);
  }
  if (!has('source_type')) {
    await expoDb.execAsync(`ALTER TABLE transactions ADD COLUMN source_type text;`);
  }
  if (!has('source_ref')) {
    await expoDb.execAsync(`ALTER TABLE transactions ADD COLUMN source_ref text;`);
  }
}

/** Phase 2 — backfill wallet_name_snapshot + source_type สำหรับรายการเก่า (รันครั้งเดียว) */
async function backfillWalletAudit(): Promise<void> {
  const rows = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, WALLET_AUDIT_BACKFILL_KEY))
    .limit(1);
  if (rows[0]?.value === 'done') return;

  // wallet_name_snapshot — ดึงจากชื่อกระเป๋าปัจจุบัน (ชื่อที่บันทึกตอนนั้น)
  await expoDb.execAsync(`
    UPDATE transactions
    SET wallet_name_snapshot = (SELECT name FROM wallets WHERE wallets.id = transactions.wallet_id)
    WHERE wallet_name_snapshot IS NULL;
  `);

  // source_type — classify แบบ best-effort (ลำดับ: specific → generic)
  await expoDb.execAsync(
    `UPDATE transactions SET source_type = 'opening_balance' WHERE source_type IS NULL AND type = 'opening';`
  );
  await expoDb.execAsync(
    `UPDATE transactions SET source_type = 'transfer' WHERE source_type IS NULL AND type IN ('transfer_out','transfer_in','transfer');`
  );
  await expoDb.execAsync(
    `UPDATE transactions SET source_type = 'trade_set' WHERE source_type IS NULL AND trade_group_id IS NOT NULL;`
  );
  await expoDb.execAsync(
    `UPDATE transactions SET source_type = 'scan_slip' WHERE source_type IS NULL AND note LIKE 'สลิป:%';`
  );
  await expoDb.execAsync(
    `UPDATE transactions SET source_type = 'legacy' WHERE source_type IS NULL;`
  );

  const now = new Date();
  await db
    .insert(appSettings)
    .values({ key: WALLET_AUDIT_BACKFILL_KEY, value: 'done', updatedAt: now })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: 'done', updatedAt: now },
    });
}

async function isAlreadyMigrated(): Promise<boolean> {
  const rows = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, MIGRATION_FLAG_KEY))
    .limit(1);
  return rows[0]?.value === 'done';
}

async function setMigratedFlag(now: Date): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key: MIGRATION_FLAG_KEY, value: 'done', updatedAt: now })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: 'done', updatedAt: now },
    });
}

/** a. แปลง transfer legacy (แถวเดียว) → คู่ transfer_out + transfer_in */
async function convertLegacyTransfers(now: Date): Promise<number> {
  const legacy = await db
    .select()
    .from(transactions)
    .where(eq(transactions.type, 'transfer'));

  let converted = 0;
  for (const tx of legacy) {
    const groupId = generateId();

    // แถวเดิม (อยู่ที่กระเป๋าต้นทาง) → transfer_out
    await db
      .update(transactions)
      .set({ type: 'transfer_out', transferGroupId: groupId, updatedAt: now })
      .where(eq(transactions.id, tx.id));

    // ปลายทาง → transfer_in (ถ้ามี)
    if (tx.toWalletId) {
      await db.insert(transactions).values({
        id: generateId(),
        amount: tx.amount,
        type: 'transfer_in',
        categoryId: null,
        walletId: tx.toWalletId,
        toWalletId: tx.walletId,
        transferGroupId: groupId,
        note: tx.note ?? null,
        date: tx.date,
        createdAt: tx.createdAt,
        updatedAt: now,
      });
    }
    converted += 1;
  }
  return converted;
}

/**
 * ผลรวมธุรกรรม "ไม่รวม opening" ที่กระทบยอดของกระเป๋าหนึ่ง
 *   income / transfer_in (ขาเข้า) = +, expense / transfer_out (ขาออก) = −
 */
function ledgerEffectForWallet(
  walletId: string,
  rows: { type: string; amount: number; walletId: string }[]
): number {
  let effect = 0;
  for (const r of rows) {
    if (r.walletId !== walletId) continue;
    if (r.type === 'income' || r.type === 'transfer_in') effect += r.amount;
    else if (r.type === 'expense' || r.type === 'transfer_out') effect -= r.amount;
    // opening ไม่นับ (เรากำลังจะคำนวณว่ามันควรเป็นเท่าไร)
  }
  return effect;
}

/** b. สร้าง opening transaction = ยอดที่ลอยอยู่ใน balance แต่ไม่อยู่ใน ledger */
async function backfillOpeningTransactions(now: Date): Promise<number> {
  const allWallets = await db.select().from(wallets);

  // ดึงธุรกรรมที่ไม่ใช่ opening ทั้งหมดมาคำนวณใน JS (data ส่วนตัว ปริมาณไม่มาก)
  const allTx = await db
    .select({
      type: transactions.type,
      amount: transactions.amount,
      walletId: transactions.walletId,
    })
    .from(transactions);
  const nonOpening = allTx.filter((t) => t.type !== 'opening');

  let created = 0;
  for (const w of allWallets) {
    // ถ้ากระเป๋านี้มี opening อยู่แล้ว ข้าม (idempotent ระดับกระเป๋า)
    const existing = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(and(eq(transactions.walletId, w.id), eq(transactions.type, 'opening')))
      .limit(1);
    if (existing.length > 0) continue;

    const effect = ledgerEffectForWallet(w.id, nonOpening);
    const implied = (w.balance ?? 0) - effect;
    if (Math.abs(implied) < EPSILON) continue; // ไม่มียอดตั้งต้นให้บันทึก

    await db.insert(transactions).values({
      id: generateId(),
      // เก็บค่า signed: opening เป็น "บวกเข้า" ยอดกระเป๋าตรงๆ (กรณีปกติเป็นค่าบวก)
      amount: implied,
      type: 'opening',
      categoryId: null,
      walletId: w.id,
      toWalletId: null,
      transferGroupId: null,
      walletNameSnapshot: w.name,
      sourceType: 'opening_balance',
      note: 'ยอดยกมา',
      date: w.createdAt,
      createdAt: w.createdAt,
      updatedAt: now,
    });
    created += 1;
  }
  return created;
}

/**
 * รัน Phase 0 migration — เรียกตอนเริ่มแอป (หลังสร้างตาราง + seed)
 * ปลอดภัยที่จะเรียกซ้ำ: schema upgrade idempotent, backfill มี flag กัน
 */
export async function runPhase0Migration(): Promise<void> {
  // schema upgrades — idempotent, รันทุกครั้งที่เปิดแอป
  await ensureTransferGroupColumn();
  await ensureWalletAuditColumns();

  // data backfill (Phase 0 ledger) — รันครั้งเดียว
  if (!await isAlreadyMigrated()) {
    const now = new Date();
    const convertedTransfers = await convertLegacyTransfers(now);
    const createdOpenings = await backfillOpeningTransactions(now);
    await setMigratedFlag(now);

    if (convertedTransfers > 0 || createdOpenings > 0) {
      console.log(
        `[Phase0] migrated ledger — transfers→pairs: ${convertedTransfers}, opening rows: ${createdOpenings}`
      );
    }
  }

  // data backfill (Phase 2 wallet audit) — รันครั้งเดียว หลัง ensureWalletAuditColumns
  await backfillWalletAudit();
}
