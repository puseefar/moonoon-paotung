// ── Public Payment Page — QR generated server-side (no CDN dependency) ────────
// เหตุผล: in-app browser (LINE/Facebook) block CDN scripts → QR ไม่แสดง
// แก้: สร้าง QR เป็น base64 บน server → embed ตรงใน HTML → ทำงานทุก browser
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import QRCode from 'qrcode';
import { db } from '../db/client.js';
import { paymentRequests } from '../db/schema.js';
import { config } from '../config.js';

export const payPageRouter = new Hono();

payPageRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
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

  const isExpired = req.expiresAt < new Date();
  const isPaid = req.status === 'paid';
  const amount = Number(req.amount).toLocaleString('th-TH', { minimumFractionDigits: 2 });
  const shortRef = id.slice(0, 8).toUpperCase();
  const expiryDt = (req.expiresAt as Date).toLocaleDateString('th-TH', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const msLeft = Math.max(0, (req.expiresAt as Date).getTime() - Date.now());
  const minLeft = Math.floor(msLeft / 60000);
  const expiryLabel = minLeft >= 60 ? `${Math.round(minLeft / 60)} ชั่วโมง` : `${minLeft} นาที`;

  // ── สร้าง QR บน server → base64 PNG ────────────────────────────────────────
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
    ? `<div class="status paid">✅ ชำระเงินสำเร็จแล้ว</div>`
    : isExpired
    ? `<div class="status expired">❌ QR Code หมดอายุแล้ว</div>`
    : `<div class="status pending">⏳ กรุณาชำระภายใน ${expiryLabel}</div>`;

  return c.html(`<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
  <title>ชำระเงิน ฿${amount} — หมูนุ่น+เป๋าตุง</title>
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
    .pending { background:#FFF9C4; color:#92400E; border:1.5px solid #FDE68A; }
    .paid    { background:#ECFDF5; color:#065F46; border:1.5px solid #6EE7B7; }
    .expired { background:#FEF2F2; color:#7F1D1D; border:1.5px solid #FCA5A5; }
    .deadline { text-align:center; margin:0 16px 4px; font-size:13px; color:#EF4444; font-weight:600; }
    .btn { display:block; border:none; border-radius:14px; padding:14px;
      width:calc(100% - 32px); margin:10px 16px 4px; font-size:15px;
      font-weight:800; cursor:pointer; text-align:center; }
    .btn-save { background:#047857; color:#fff; }
    .btn-save:active { opacity:.8; }
    .slip-box { margin:12px 16px; background:#EFF6FF; border-radius:14px;
      padding:18px; border:1px solid #BFDBFE; }
    .slip-t { font-size:14px; font-weight:800; color:#1D4ED8; margin-bottom:6px; }
    .slip-d { font-size:13px; color:#3B82F6; line-height:1.6; }
    .footer { text-align:center; color:#9CA3AF; font-size:11px; padding:20px; }
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

  <div class="card">
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
        ? `<img src="${qrDataUrl}" width="240" height="240" class="qr-img" alt="QR PromptPay">`
        : `<div style="width:240px;height:240px;border-radius:12px;border:2px dashed #E5E7EB;display:flex;align-items:center;justify-content:center;color:#9CA3AF;font-size:13px">ไม่สามารถสร้าง QR ได้</div>`}
      <div class="ref-box">
        <div class="ref-lbl">Invoice / Reference</div>
        <div class="ref-code">${shortRef}</div>
      </div>
    </div>
  </div>

  ${!isExpired && !isPaid ? `<div class="deadline">⏰ กรุณาชำระก่อน ${expiryDt}</div>` : ''}

  ${qrDataUrl ? `<button class="btn btn-save" onclick="saveCard()">💾 บันทึก QR เป็นรูปภาพ</button>` : ''}

  <div class="slip-box">
    <div class="slip-t">📬 หลังชำระแล้ว</div>
    <div class="slip-d">กรุณาส่งสลิปให้เจ้าของร้านยืนยันการรับชำระเงิน<br>ผ่านช่องทาง LINE หรือที่ตกลงกันไว้</div>
  </div>

  <div class="footer">
    หมูนุ่น+เป๋าตุง · SEVENDOG DEV<br>
    Powered by Thai QR Payment / PromptPay
  </div>
</div>

<script>
// QR ถูก embed เป็น base64 แล้ว ไม่ต้องโหลด CDN
const QR_DATA_URL = ${JSON.stringify(qrDataUrl)};
const SHORT_REF = '${shortRef}';
const AMOUNT = '${amount}';
const DESC = '${req.description}';
const EXPIRY = '${expiryDt}';
const PROMPTPAY = '${config.promptpay.id}';

function saveCard() {
  if (!QR_DATA_URL) return;
  const qrImg = new Image();
  qrImg.onload = function() {
    const out = document.createElement('canvas');
    out.width = 400; out.height = 560;
    const ctx = out.getContext('2d');

    // Background
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 400, 560);

    // Header gradient
    const g = ctx.createLinearGradient(0, 0, 400, 80);
    g.addColorStop(0, '#1a1a6e'); g.addColorStop(.5, '#003087'); g.addColorStop(1, '#0066cc');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 400, 80);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.font = 'bold 22px sans-serif'; ctx.fillText('🐷 หมูนุ่น+เป๋าตุง', 200, 36);
    ctx.font = '13px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.8)';
    ctx.fillText('Thai QR Payment · PromptPay', 200, 58);

    // Info
    ctx.textAlign = 'left'; ctx.fillStyle = '#6B7280'; ctx.font = '13px sans-serif';
    ctx.fillText('รายการ', 24, 108);
    ctx.fillStyle = '#111'; ctx.font = 'bold 15px sans-serif';
    ctx.fillText(DESC.length > 30 ? DESC.substring(0,30)+'...' : DESC, 24, 128);
    ctx.fillStyle = '#6B7280'; ctx.font = '13px sans-serif'; ctx.fillText('จำนวนเงิน', 24, 156);
    ctx.fillStyle = '#047857'; ctx.font = 'bold 34px sans-serif';
    ctx.fillText('\\u0e3f' + AMOUNT, 24, 192);
    ctx.fillStyle = '#6B7280'; ctx.font = '12px sans-serif';
    ctx.fillText('อ้างอิง: ' + SHORT_REF, 24, 212);

    // QR image
    ctx.drawImage(qrImg, 80, 222, 240, 240);

    // Footer
    ctx.fillStyle = '#9CA3AF'; ctx.textAlign = 'center'; ctx.font = '11px sans-serif';
    ctx.fillText('PromptPay: ' + PROMPTPAY, 200, 490);
    ctx.fillText('ชำระก่อน: ' + EXPIRY, 200, 508);
    ctx.fillStyle = '#047857'; ctx.font = 'bold 12px sans-serif';
    ctx.fillText('หมูนุ่น+เป๋าตุง · SEVENDOG DEV', 200, 538);

    const a = document.createElement('a');
    a.download = 'payment-qr-' + SHORT_REF + '.png';
    a.href = out.toDataURL('image/png');
    a.click();
  };
  qrImg.src = QR_DATA_URL;
}
</script>
</body>
</html>`);
});
