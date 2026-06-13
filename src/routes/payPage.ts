// ── Public Payment Page + Slip Upload + Polling ──────────────────────────────
// เหตุผล: in-app browser (LINE/Facebook) block CDN scripts → QR ไม่แสดง
// แก้: สร้าง QR เป็น base64 บน server → embed ตรงใน HTML
import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { createHash } from 'crypto';
import QRCode from 'qrcode';
import { db } from '../db/client.js';
import { paymentRequests, paymentSlips, slipUsed, actionLog } from '../db/schema.js';
import { config } from '../config.js';
import { genId } from '../lib/id.js';
import { notifyPaymentPaid } from './pkg13.js';

export const payPageRouter = new Hono();

// ── Rate limiter (in-memory, per-IP) ─────────────────────────────────────────
const uploadRateLimit = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string, max = 20): boolean {
  const now = Date.now();
  const entry = uploadRateLimit.get(ip);
  if (!entry || entry.resetAt < now) {
    uploadRateLimit.set(ip, { count: 1, resetAt: now + 3_600_000 });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

// ── Magic bytes validation ────────────────────────────────────────────────────
function isImageBuffer(buf: Uint8Array): boolean {
  const isJpeg = buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
  const isPng  = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
  return isJpeg || isPng;
}

// ── Async slip verification (Thunder API) ────────────────────────────────────
async function runSlipVerification(
  slipId: string,
  paymentReqId: string,
  imageData: string,
  expectedAmount: number,
  userId: string,
) {
  // Mark as verifying (optimistic — ถ้า status ไม่ใช่ pending แสดงว่า race ให้ skip)
  const updated = await db.update(paymentRequests)
    .set({ status: 'verifying' })
    .where(and(eq(paymentRequests.id, paymentReqId), eq(paymentRequests.status, 'pending')))
    .returning({ id: paymentRequests.id });
  if (!updated.length) return; // อีก slip ชนะ race แล้ว

  const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');

  let transRef: string | undefined;
  let detectedAmount: number | undefined;
  let rawResponse: string | null = null;
  let passed = false;

  if (config.thunder.isReady) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(config.thunder.apiUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.thunder.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ base64: base64Data }),
          signal: AbortSignal.timeout(15_000),
        });
        const json = await res.json() as any;
        rawResponse = JSON.stringify(json);
        if (json.success === true) {
          passed = true;
          transRef = json.data?.transRef ?? json.data?.ref_id ?? `THUNDER-${Date.now()}`;
          detectedAmount = parseFloat(String(json.data?.amount ?? expectedAmount));
          break;
        }
        break; // Thunder ตอบ success=false → ไม่ retry
      } catch {
        if (attempt === 2) {
          // timeout 3 ครั้ง → NEED_REVIEW
          await db.update(paymentSlips)
            .set({ verificationStatus: 'unreadable', rejectReason: 'THUNDER_TIMEOUT' })
            .where(eq(paymentSlips.id, slipId));
          await db.update(paymentRequests)
            .set({ status: 'need_review' })
            .where(eq(paymentRequests.id, paymentReqId));
          return;
        }
      }
    }
  } else {
    // Dev mock
    passed = true;
    transRef = `REF-DEV-${Date.now()}`;
    detectedAmount = expectedAmount;
  }

  if (!passed) {
    await db.update(paymentSlips)
      .set({ verificationStatus: 'failed', rejectReason: 'INVALID_SLIP', verifyRawResponse: rawResponse })
      .where(eq(paymentSlips.id, slipId));
    await db.update(paymentRequests)
      .set({ status: 'rejected' })
      .where(eq(paymentRequests.id, paymentReqId));
    return;
  }

  // Global transRef dedup
  const refHash = createHash('sha256').update(transRef!).digest('hex');
  const existing = await db.query.slipUsed.findFirst({ where: eq(slipUsed.refHash, refHash) });
  if (existing) {
    await db.update(paymentSlips)
      .set({ verificationStatus: 'failed', rejectReason: 'DUPLICATE_SLIP', transRef: transRef!, verifyRawResponse: rawResponse })
      .where(eq(paymentSlips.id, slipId));
    await db.update(paymentRequests)
      .set({ status: 'rejected' })
      .where(eq(paymentRequests.id, paymentReqId));
    return;
  }

  // Amount check
  if (Math.abs((detectedAmount ?? 0) - expectedAmount) > 0.01) {
    await db.update(paymentSlips)
      .set({ verificationStatus: 'failed', rejectReason: 'AMOUNT_MISMATCH',
             detectedAmount, transRef: transRef!, verifyRawResponse: rawResponse })
      .where(eq(paymentSlips.id, slipId));
    await db.update(paymentRequests)
      .set({ status: 'rejected' })
      .where(eq(paymentRequests.id, paymentReqId));
    return;
  }

  // All checks passed → PAID
  const now = new Date();
  await db.insert(slipUsed).values({ refHash, requestId: paymentReqId, usedAt: now });
  await db.update(paymentSlips)
    .set({ verificationStatus: 'passed', detectedAmount, transRef: transRef!, verifyRawResponse: rawResponse })
    .where(eq(paymentSlips.id, slipId));
  await db.update(paymentRequests)
    .set({ status: 'paid', refId: transRef!, refHash, paidAt: now })
    .where(eq(paymentRequests.id, paymentReqId));

  await db.insert(actionLog).values({
    id: genId(), userId, action: 'slip.verify.success',
    meta: JSON.stringify({ paymentReqId, transRef, detectedAmount }),
    ip: 'public', createdAt: now,
  });

  notifyPaymentPaid(userId, expectedAmount, transRef!).catch(() => {});
}

// ── GET /pay/:id/qr.png  (serve QR as real PNG — for OG image + mobile save) ──
payPageRouter.get('/:id/qr.png', async (c) => {
  const id = c.req.param('id');
  const req = await db.query.paymentRequests.findFirst({ where: eq(paymentRequests.id, id) });
  if (!req) return c.notFound();
  const buf = await QRCode.toBuffer(req.qrPayload, {
    type: 'png', width: 400, margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#FFFFFF' },
  });
  return c.body(new Uint8Array(buf), 200, {
    'Content-Type': 'image/png',
    'Cache-Control': 'public, max-age=86400',
  });
});

// ── GET /pay/:id/status  (polling endpoint) ───────────────────────────────────
payPageRouter.get('/:id/status', async (c) => {
  const id = c.req.param('id');
  const token = c.req.query('t');

  const req = await db.query.paymentRequests.findFirst({ where: eq(paymentRequests.id, id) });
  if (!req) return c.json({ ok: false }, 404);
  if (req.uploadToken && req.uploadToken !== token) return c.json({ ok: false }, 403);

  // Lazy expire
  if (req.status === 'pending' && req.expiresAt < new Date()) {
    await db.update(paymentRequests).set({ status: 'expired' }).where(eq(paymentRequests.id, id));
    return c.json({ ok: true, status: 'expired' });
  }

  let rejectReason: string | null = null;
  if (req.status === 'rejected') {
    const slip = await db.select({ rejectReason: paymentSlips.rejectReason })
      .from(paymentSlips)
      .where(eq(paymentSlips.paymentRequestId, id))
      .orderBy(desc(paymentSlips.createdAt))
      .limit(1);
    rejectReason = slip[0]?.rejectReason ?? null;
  }

  return c.json({ ok: true, status: req.status, paidAt: req.paidAt ?? null, refId: req.refId ?? null, rejectReason });
});

// ── POST /pay/:id/slip  (public upload — token required) ─────────────────────
payPageRouter.post('/:id/slip', async (c) => {
  const id = c.req.param('id');
  const token = c.req.query('t');
  const ip = c.req.header('x-forwarded-for') ?? 'unknown';

  // Rate limit per IP
  if (!checkRateLimit(ip)) return c.json({ ok: false, message: 'ส่งสลิปเยอะเกินไป กรุณารอสักครู่' }, 429);

  const req = await db.query.paymentRequests.findFirst({ where: eq(paymentRequests.id, id) });
  if (!req) return c.json({ ok: false, message: 'ไม่พบรายการ' }, 404);

  // Token check
  if (!req.uploadToken || req.uploadToken !== token) return c.json({ ok: false, message: 'ลิงก์ไม่ถูกต้อง' }, 403);

  // State checks
  if (req.status === 'paid') return c.json({ ok: false, message: 'ชำระเงินเรียบร้อยแล้ว' }, 409);
  if (req.status === 'expired' || req.expiresAt < new Date()) {
    await db.update(paymentRequests).set({ status: 'expired' }).where(eq(paymentRequests.id, id));
    return c.json({ ok: false, message: 'รายการหมดอายุแล้ว' }, 410);
  }
  if (req.status === 'verifying') return c.json({ ok: false, message: 'กำลังตรวจสอบสลิปที่ส่งไปแล้ว' }, 409);

  // Parse multipart
  let fileBuffer: ArrayBuffer;
  let fileType: string;
  try {
    const body = await c.req.parseBody();
    const file = body['slip'] as File;
    if (!file || !file.size) return c.json({ ok: false, message: 'ไม่พบไฟล์สลิป' }, 400);
    if (file.size > 5 * 1024 * 1024) return c.json({ ok: false, message: 'ไฟล์ใหญ่เกิน 5 MB' }, 413);
    fileBuffer = await file.arrayBuffer();
    fileType = file.type;
  } catch {
    return c.json({ ok: false, message: 'อ่านไฟล์ไม่ได้' }, 400);
  }

  // Magic bytes check (JPG/PNG เท่านั้น)
  if (!isImageBuffer(new Uint8Array(fileBuffer))) {
    return c.json({ ok: false, message: 'ต้องเป็นไฟล์ภาพ JPG หรือ PNG เท่านั้น' }, 400);
  }

  const base64 = Buffer.from(fileBuffer).toString('base64');
  const mime = (fileType === 'image/png') ? 'image/png' : 'image/jpeg';
  const imageData = `data:${mime};base64,${base64}`;
  const fileHash = createHash('sha256').update(Buffer.from(fileBuffer)).digest('hex');

  // File dedup ภายในรายการ
  const dupFile = await db.query.paymentSlips.findFirst({
    where: and(eq(paymentSlips.paymentRequestId, id), eq(paymentSlips.fileHash, fileHash)),
  });
  if (dupFile) return c.json({ ok: false, message: 'สลิปนี้เคยส่งแล้ว', code: 'DUPLICATE_FILE' }, 409);

  // บันทึก slip record
  const slipId = genId();
  await db.insert(paymentSlips).values({
    id: slipId, paymentRequestId: id, imageData, fileHash,
    verificationStatus: 'pending', createdAt: new Date(),
  });

  // Fire-and-forget verification (ไม่ block response)
  runSlipVerification(slipId, id, imageData, req.amount, req.userId).catch(console.error);

  return c.json({ ok: true, message: 'รับสลิปแล้ว กำลังตรวจสอบ' }, 202);
});

// ── GET /pay/:id  (HTML หน้าชำระเงิน + อัปโหลดสลิป) ─────────────────────────
payPageRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const token = c.req.query('t') ?? '';

  const req = await db.query.paymentRequests.findFirst({ where: eq(paymentRequests.id, id) });

  if (!req) {
    return c.html(`<!DOCTYPE html><html lang="th"><body style="font-family:sans-serif;text-align:center;padding:40px;background:#f9fafb">
      <div style="max-width:400px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;box-shadow:0 4px 20px rgba(0,0,0,.08)">
        <div style="font-size:48px;margin-bottom:16px">❌</div>
        <h2 style="color:#111">ไม่พบรายการชำระเงิน</h2>
        <p style="color:#6B7280;margin-top:8px">รหัส: ${id.slice(0, 8).toUpperCase()}</p>
      </div>
    </body></html>`, 404);
  }

  const isExpired = req.status === 'expired' || req.expiresAt < new Date();
  const isPaid    = req.status === 'paid';
  const hasToken  = !!req.uploadToken && req.uploadToken === token;

  const amount    = Number(req.amount).toLocaleString('th-TH', { minimumFractionDigits: 2 });
  const shortRef  = id.slice(0, 8).toUpperCase();
  const expiryDt  = (req.expiresAt as Date).toLocaleDateString('th-TH', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  const msLeft    = Math.max(0, (req.expiresAt as Date).getTime() - Date.now());
  const minLeft   = Math.floor(msLeft / 60000);
  const expiryLabel = minLeft >= 60 ? `${Math.round(minLeft / 60)} ชั่วโมง` : `${minLeft} นาที`;

  let qrDataUrl = '';
  try {
    qrDataUrl = await QRCode.toDataURL(req.qrPayload, {
      width: 260, margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#FFFFFF' },
    });
  } catch (e) {
    console.error('[PayPage] QR generation failed:', e);
  }

  const statusBanner = isPaid
    ? `<div class="status paid" id="status-banner">✅ ชำระเงินสำเร็จแล้ว</div>`
    : isExpired
    ? `<div class="status expired" id="status-banner">❌ QR Code หมดอายุแล้ว</div>`
    : `<div class="status pending" id="status-banner">⏳ <span id="countdown-txt">กำลังนับเวลา...</span></div>`;

  const canUpload = hasToken && !isPaid && !isExpired;

  return c.html(`<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
  <title>ชำระเงิน ฿${amount} — หมูนุ่น+เป๋าตุง</title>
  <meta property="og:title" content="ชำระเงิน ฿${amount} — หมูนุ่น+เป๋าตุง">
  <meta property="og:description" content="${req.description} · รหัส ${shortRef}">
  <meta property="og:image" content="${config.serverUrl}/pay/${id}/qr.png">
  <meta property="og:image:width" content="400">
  <meta property="og:image:height" content="400">
  <meta name="twitter:card" content="summary_large_image">
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:-apple-system,Tahoma,sans-serif; background:#F0F4F8; min-height:100vh; }
    .page { max-width:420px; margin:0 auto; padding:0 0 40px; }
    .header { background:linear-gradient(135deg,#1a1a6e,#003087,#0066cc);
      color:#fff; padding:20px 24px; text-align:center; }
    .header-row { display:flex; align-items:center; justify-content:center; gap:10px; }
    .hicon { width:40px; height:40px; background:#fff; border-radius:10px;
      display:inline-flex; align-items:center; justify-content:center; font-size:22px; }
    .htitle { font-size:20px; font-weight:800; }
    .hsub { font-size:12px; opacity:.8; margin-top:4px; }
    .card { background:#fff; margin:16px; border-radius:16px;
      box-shadow:0 4px 20px rgba(0,0,0,.08); overflow:hidden; }
    .card-body { padding:20px; }
    .row { display:flex; justify-content:space-between; align-items:flex-start;
      padding:10px 0; border-bottom:1px solid #F3F4F6; }
    .row:last-child { border-bottom:none; }
    .rlabel { font-size:13px; color:#6B7280; font-weight:600; min-width:100px; }
    .rval { font-size:13px; color:#111; font-weight:700; text-align:right; }
    .amount-val { font-size:30px; font-weight:900; color:#047857; }
    .qr-area { background:#F8FAFC; border-top:1px solid #E5E7EB; padding:24px;
      display:flex; flex-direction:column; align-items:center; }
    .qr-tip { font-size:12px; color:#6B7280; font-weight:600; margin-bottom:14px; text-align:center; }
    .qr-img { border-radius:12px; border:2px solid #E5E7EB; display:block; }
    .ref-box { background:#F0FDF4; border:1.5px solid #6EE7B7; border-radius:10px;
      padding:10px 20px; margin-top:14px; text-align:center; }
    .ref-lbl { font-size:10px; color:#6B7280; text-transform:uppercase; letter-spacing:1px; }
    .ref-code { font-size:22px; font-weight:900; color:#047857; letter-spacing:4px; }
    .status { margin:16px; border-radius:12px; padding:12px 16px;
      text-align:center; font-size:14px; font-weight:800; }
    .pending     { background:#FFF9C4; color:#92400E; border:1.5px solid #FDE68A; }
    .paid        { background:#ECFDF5; color:#065F46; border:1.5px solid #6EE7B7; }
    .expired     { background:#FEF2F2; color:#7F1D1D; border:1.5px solid #FCA5A5; }
    .verifying   { background:#EFF6FF; color:#1D4ED8; border:1.5px solid #BFDBFE; }
    .need-review { background:#FFFBEB; color:#92400E; border:1.5px solid #FDE68A; }
    .rejected    { background:#FEF2F2; color:#7F1D1D; border:1.5px solid #FCA5A5; }
    .deadline { text-align:center; margin:0 16px 4px; font-size:13px; color:#EF4444; font-weight:600; }
    .btn { display:block; border:none; border-radius:14px; padding:14px;
      width:calc(100% - 32px); margin:10px 16px 4px; font-size:15px;
      font-weight:800; cursor:pointer; text-align:center; }
    .btn-save   { background:#047857; color:#fff; }
    .btn-upload { background:#7C3AED; color:#fff; }
    .btn-upload:disabled { opacity:.5; cursor:not-allowed; }
    .btn-save:active, .btn-upload:active { opacity:.8; }
    .upload-section { margin:12px 16px; background:#F5F3FF; border-radius:14px;
      padding:18px; border:1px solid #DDD6FE; }
    .upload-title { font-size:15px; font-weight:800; color:#5B21B6; margin-bottom:8px; }
    .upload-desc  { font-size:13px; color:#7C3AED; line-height:1.6; margin-bottom:12px; }
    .file-input   { display:none; }
    .file-label   { display:block; border:2px dashed #A78BFA; border-radius:10px;
      padding:20px; text-align:center; cursor:pointer; color:#7C3AED;
      font-size:13px; font-weight:600; transition:.2s; }
    .file-label:hover, .file-label.dragover { background:#EDE9FE; }
    .file-preview { max-width:100%; border-radius:8px; margin-top:10px; display:none; }
    .spinner { display:inline-block; width:20px; height:20px; border:3px solid rgba(255,255,255,.3);
      border-top:3px solid #fff; border-radius:50%; animation:spin .8s linear infinite; vertical-align:middle; }
    @keyframes spin { to { transform:rotate(360deg); } }
    .section-verifying, .section-paid, .section-rejected, .section-needreview { display:none; }
    .footer { text-align:center; color:#9CA3AF; font-size:11px; padding:20px; }
    .thank-icon { font-size:64px; text-align:center; margin:24px 0 8px; }
    .thank-title { font-size:22px; font-weight:900; color:#065F46; text-align:center; }
    .thank-sub   { font-size:14px; color:#6B7280; text-align:center; margin-top:6px; line-height:1.6; }
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="header-row">
      <div class="hicon">🐷</div>
      <span class="htitle">หมูนุ่น+เป๋าตุง</span>
    </div>
    <div class="hsub">Thai QR Payment · PromptPay</div>
  </div>

  ${statusBanner}

  <!-- ── QR Card ── -->
  <div class="card" id="qr-card" style="display:${isPaid ? 'none' : 'block'}">
    <div class="card-body">
      <div class="row">
        <span class="rlabel">ผู้รับเงิน</span>
        <span class="rval">หมูนุ่น+เป๋าตุง<br><small style="color:#6B7280;font-weight:400">${config.promptpay.id}</small></span>
      </div>
      <div class="row">
        <span class="rlabel">รายการ</span>
        <span class="rval">${req.description}</span>
      </div>
      <div class="row">
        <span class="rlabel">จำนวนเงิน</span>
        <span class="amount-val">฿${amount}</span>
      </div>
      <div class="row">
        <span class="rlabel">เลขที่อ้างอิง</span>
        <span class="rval" style="font-family:monospace;letter-spacing:1px">${shortRef}</span>
      </div>
    </div>
    <div class="qr-area">
      <div class="qr-tip">สแกน QR ด้วยแอปธนาคาร<br>หรือ แอป PromptPay</div>
      ${qrDataUrl
        ? `<img src="${qrDataUrl}" width="240" height="240" class="qr-img" alt="QR PromptPay" style="touch-action:manipulation"><div style="font-size:11px;color:#9CA3AF;margin-top:8px;text-align:center">📌 กดค้างที่รูป QR เพื่อบันทึกลงเครื่อง</div>`
        : `<div style="width:240px;height:240px;border-radius:12px;border:2px dashed #E5E7EB;display:flex;align-items:center;justify-content:center;color:#9CA3AF;font-size:13px">ไม่สามารถสร้าง QR ได้</div>`}
      <div class="ref-box">
        <div class="ref-lbl">Invoice / Reference</div>
        <div class="ref-code">${shortRef}</div>
      </div>
    </div>
  </div>

  ${!isExpired && !isPaid ? `<div class="deadline" id="deadline-div">⏰ <span id="deadline-txt">กำลังโหลด...</span></div>` : ''}
  ${qrDataUrl && !isPaid ? `<button class="btn btn-save" id="btn-save-qr" onclick="saveCard()">💾 บันทึก QR เป็นรูปภาพ</button>` : ''}

  <!-- ── Upload section (แสดงเมื่อมี token ถูกต้อง) ── -->
  ${canUpload ? `
  <div class="upload-section" id="section-upload">
    <div class="upload-title">📤 ชำระแล้ว? ส่งสลิปที่นี่เลย</div>
    <div class="upload-desc">อัปโหลดสลิปการโอนเงินเพื่อยืนยันการชำระเงิน<br>รองรับ JPG/PNG ขนาดไม่เกิน 5 MB</div>
    <input type="file" id="fileInput" class="file-input" accept="image/jpeg,image/png" onchange="onFileSelected(this)">
    <label for="fileInput" class="file-label" id="fileLabel">
      📷 แตะเพื่อเลือกรูปสลิป
    </label>
    <img id="filePreview" class="file-preview" alt="preview">
    <button class="btn btn-upload" id="btnUpload" onclick="uploadSlip()" disabled>
      ส่งสลิป
    </button>
  </div>
  <div class="status verifying section-verifying" id="section-verifying" style="display:none">
    <span class="spinner"></span>&nbsp; กำลังตรวจสอบสลิป... (อาจใช้เวลาสักครู่)
  </div>
  <div class="status need-review section-needreview" id="section-needreview" style="display:none">
    📋 ได้รับสลิปแล้ว — ร้านค้ากำลังตรวจสอบ จะแจ้งผลเร็วๆ นี้
  </div>
  <div class="status rejected section-rejected" id="section-rejected" style="display:none">
    ❌ <span id="rejectMsg">สลิปไม่ผ่านการตรวจสอบ</span> — <a href="#" onclick="resetUpload();return false" style="color:inherit">ส่งสลิปใหม่</a>
  </div>
  ` : `
  <div class="upload-section">
    <div class="upload-title">📬 หลังชำระแล้ว</div>
    <div class="upload-desc">กรุณาส่งสลิปให้เจ้าของร้านยืนยันการรับชำระเงิน<br>ผ่านช่องทาง LINE หรือที่ตกลงกันไว้</div>
  </div>
  `}

  <!-- ── Thank you page ── -->
  <div id="section-paid" style="display:${isPaid ? 'block' : 'none'}">
    <div class="thank-icon">✅</div>
    <div class="thank-title">ขอบคุณสำหรับการชำระเงิน</div>
    <div class="thank-sub">ยอด ฿${amount}<br>ชำระเรียบร้อยแล้ว</div>
    <div style="text-align:center;margin:8px 16px 0">
      <div style="font-size:10px;color:#6B7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">รหัสอ้างอิง</div>
      <div style="font-size:22px;font-weight:900;color:#047857;letter-spacing:4px;font-family:monospace">${shortRef}</div>
    </div>
    <div class="upload-section" style="background:#ECFDF5;border-color:#6EE7B7;margin-top:16px">
      <div class="upload-title" style="color:#065F46">🔒 บันทึกหน้าจอนี้เป็นหลักฐาน</div>
      <div class="upload-desc" style="color:#047857">Screenshot หน้านี้ไว้เป็นหลักฐานการชำระเงินครับ</div>
    </div>
  </div>

  <div class="footer">
    หมูนุ่น+เป๋าตุง · SEVENDOG DEV<br>
    Powered by Thai QR Payment / PromptPay
  </div>
</div>

<script>
const PAYMENT_ID = ${JSON.stringify(id)};
const UPLOAD_TOKEN = ${JSON.stringify(token)};
const QR_DATA_URL = ${JSON.stringify(qrDataUrl)};
const SHORT_REF = ${JSON.stringify(shortRef)};
const AMOUNT = ${JSON.stringify(amount)};
const DESC = ${JSON.stringify(req.description)};
const EXPIRY_TS = ${(req.expiresAt as Date).getTime()};
const PROMPTPAY = ${JSON.stringify(config.promptpay.id)};
const INITIAL_STATUS = ${JSON.stringify(req.status)};

// ── Live countdown timer (#4 timezone fix) ────────────────────────────────────
(function startCountdown() {
  if (INITIAL_STATUS !== 'pending') return;
  function tick() {
    const msLeft = Math.max(0, EXPIRY_TS - Date.now());
    const totalSec = Math.floor(msLeft / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const txt = m > 0
      ? m + ' นาที ' + String(s).padStart(2,'0') + ' วินาที'
      : totalSec + ' วินาที';
    const cd = document.getElementById('countdown-txt');
    if (cd) cd.textContent = 'เหลือเวลา ' + txt;
    const dl = document.getElementById('deadline-txt');
    if (dl) dl.textContent = 'กรุณาชำระก่อนหมดเวลา — เหลือ ' + txt;
    if (msLeft <= 0) {
      const banner = document.getElementById('status-banner');
      if (banner) { banner.className = 'status expired'; banner.textContent = '❌ QR Code หมดอายุแล้ว'; }
      const deadlineDiv = document.getElementById('deadline-div');
      if (deadlineDiv) deadlineDiv.style.display = 'none';
      const upload = document.getElementById('section-upload');
      if (upload) upload.style.display = 'none';
      return; // หยุด tick
    }
    setTimeout(tick, 1000);
  }
  tick();
})();

const REJECT_MESSAGES = {
  INVALID_SLIP:    'สลิปไม่ถูกต้องหรืออ่านไม่ได้ — กรุณาส่งภาพสลิปที่ชัดกว่านี้',
  AMOUNT_MISMATCH: 'ยอดเงินในสลิปไม่ตรงกับยอดที่ต้องชำระ',
  DUPLICATE_SLIP:  'สลิปนี้เคยใช้ยืนยันการชำระแล้ว',
  THUNDER_TIMEOUT: 'ระบบตรวจสอบขัดข้อง — กรุณาลองส่งสลิปใหม่อีกครั้ง',
};

let selectedFile = null;
let pollTimer = null;

function onFileSelected(input) {
  const file = input.files[0];
  if (!file) return;
  selectedFile = file;
  const label = document.getElementById('fileLabel');
  label.textContent = '✅ ' + file.name;
  const preview = document.getElementById('filePreview');
  preview.src = URL.createObjectURL(file);
  preview.style.display = 'block';
  document.getElementById('btnUpload').disabled = false;
}

async function uploadSlip() {
  if (!selectedFile) return;
  const btn = document.getElementById('btnUpload');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> กำลังส่ง...';

  const fd = new FormData();
  fd.append('slip', selectedFile);

  try {
    const res = await fetch('/pay/' + PAYMENT_ID + '/slip?t=' + encodeURIComponent(UPLOAD_TOKEN), {
      method: 'POST', body: fd,
    });
    const data = await res.json();
    if (res.ok) {
      showVerifying();
      startPolling();
    } else {
      btn.disabled = false;
      btn.innerHTML = 'ส่งสลิป';
      alert(data.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
    }
  } catch {
    btn.disabled = false;
    btn.innerHTML = 'ส่งสลิป';
    alert('ไม่สามารถส่งสลิปได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
  }
}

function showVerifying() {
  document.getElementById('section-upload').style.display = 'none';
  document.getElementById('section-verifying').style.display = 'block';
}

function showPaid() {
  clearPoll();
  // ซ่อน pending elements ทั้งหมด
  ['section-verifying','section-upload','section-rejected','section-needreview'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const qrCard = document.getElementById('qr-card');
  if (qrCard) qrCard.style.display = 'none';
  const banner = document.getElementById('status-banner');
  if (banner) { banner.className = 'status paid'; banner.textContent = '✅ ชำระเงินสำเร็จแล้ว'; }
  const deadlineDiv = document.getElementById('deadline-div');
  if (deadlineDiv) deadlineDiv.style.display = 'none';
  const saveBtn = document.getElementById('btn-save-qr');
  if (saveBtn) saveBtn.style.display = 'none';
  // แสดง success
  document.getElementById('section-paid').style.display = 'block';
}

function showRejected(msg) {
  clearPoll();
  document.getElementById('section-verifying').style.display = 'none';
  document.getElementById('rejectMsg').textContent = msg || 'สลิปไม่ผ่านการตรวจสอบ';
  document.getElementById('section-rejected').style.display = 'block';
}

function showNeedReview() {
  clearPoll();
  document.getElementById('section-verifying').style.display = 'none';
  document.getElementById('section-needreview').style.display = 'block';
}

function resetUpload() {
  selectedFile = null;
  document.getElementById('fileInput').value = '';
  document.getElementById('fileLabel').textContent = '📷 แตะเพื่อเลือกรูปสลิป';
  document.getElementById('filePreview').style.display = 'none';
  document.getElementById('filePreview').src = '';
  document.getElementById('btnUpload').disabled = true;
  document.getElementById('btnUpload').innerHTML = 'ส่งสลิป';
  document.getElementById('section-rejected').style.display = 'none';
  document.getElementById('section-upload').style.display = 'block';
}

function clearPoll() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

function startPolling() {
  clearPoll();
  let timeoutId = setTimeout(() => {
    clearPoll();
    document.getElementById('section-verifying').innerHTML =
      '⏳ กำลังรอผล — ระบบอาจใช้เวลาสักครู่ กรุณาอย่าปิดหน้าต่างนี้';
  }, 180_000);

  pollTimer = setInterval(async () => {
    try {
      const res = await fetch('/pay/' + PAYMENT_ID + '/status?t=' + encodeURIComponent(UPLOAD_TOKEN));
      const { status, rejectReason } = await res.json();
      if (status === 'paid') {
        clearTimeout(timeoutId);
        showPaid();
      } else if (status === 'rejected') {
        clearTimeout(timeoutId);
        showRejected(REJECT_MESSAGES[rejectReason] || 'สลิปไม่ผ่านการตรวจสอบ');
      } else if (status === 'need_review') {
        clearTimeout(timeoutId);
        showNeedReview();
      }
    } catch {}
  }, 2500);
}

// Auto-start polling ถ้ากำลัง verifying อยู่แล้ว (reload หน้า)
if (INITIAL_STATUS === 'verifying' && UPLOAD_TOKEN) {
  showVerifying();
  startPolling();
}

// ── Save / Share QR image ────────────────────────────────────────────────────
// Uses server-side /qr.png endpoint (no canvas) — reliable on all browsers/WebViews
async function saveCard() {
  const qrUrl = '/pay/' + PAYMENT_ID + '/qr.png';
  const filename = 'payment-qr-' + SHORT_REF + '.png';

  // 1) navigator.share with file — mobile Chrome/Safari
  if (navigator.canShare) {
    try {
      const res = await fetch(qrUrl);
      const blob = await res.blob();
      const file = new File([blob], filename, { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        return;
      }
    } catch(e) { /* cancelled or unsupported → fallthrough */ }
  }

  // 2) Open QR image in new tab — long-press to save (FB/LINE WebView)
  const w = window.open(qrUrl, '_blank');
  if (w) return;

  // 3) Desktop <a download>
  const a = document.createElement('a');
  a.href = qrUrl;
  a.download = filename;
  a.click();
}
</script>
</body>
</html>`);
});
