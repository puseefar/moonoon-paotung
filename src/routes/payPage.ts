// ── Public Payment Page — Thai QR Payment style ───────────────────────────────
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
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

  const statusHtml = isPaid
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
  <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #F0F4F8; min-height:100vh; }
    .page { max-width: 420px; margin: 0 auto; padding: 0 0 40px; }

    /* Header */
    .header { background: linear-gradient(135deg, #1a1a6e 0%, #003087 50%, #0066cc 100%);
      color:#fff; padding: 20px 24px; text-align:center; }
    .header-logo { display:flex; align-items:center; justify-content:center; gap:10px; margin-bottom:4px; }
    .header-icon { width:36px; height:36px; background:#fff; border-radius:8px;
      display:flex; align-items:center; justify-content:center; font-size:20px; }
    .header-title { font-size:18px; font-weight:800; letter-spacing:.5px; }
    .header-sub { font-size:12px; opacity:.8; }

    /* Card */
    .card { background:#fff; margin:16px; border-radius:16px;
      box-shadow:0 4px 20px rgba(0,0,0,.08); overflow:hidden; }
    .card-body { padding:24px; }

    /* Info rows */
    .info-row { display:flex; justify-content:space-between; align-items:flex-start;
      padding: 10px 0; border-bottom:1px solid #F3F4F6; }
    .info-row:last-child { border-bottom:none; }
    .info-label { font-size:13px; color:#6B7280; font-weight:600; min-width:120px; }
    .info-value { font-size:13px; color:#111; font-weight:700; text-align:right; flex:1; }
    .amount-value { font-size:28px; font-weight:900; color:#047857; text-align:right; }

    /* QR */
    .qr-section { background:#F8FAFC; border-top:1px solid #E5E7EB; padding:24px;
      display:flex; flex-direction:column; align-items:center; }
    .qr-label { font-size:12px; color:#6B7280; margin-bottom:16px; text-align:center; font-weight:600; }
    #qrcode canvas { border-radius:12px; border:2px solid #E5E7EB; }
    .promptpay-badge { margin-top:12px; font-size:11px; color:#9CA3AF; }

    /* Reference */
    .ref-box { background:#F0FDF4; border:1.5px solid #6EE7B7; border-radius:10px;
      padding:10px 16px; margin-top:16px; text-align:center; }
    .ref-label { font-size:10px; color:#6B7280; text-transform:uppercase; letter-spacing:1px; }
    .ref-code { font-size:20px; font-weight:900; color:#047857; letter-spacing:4px; margin-top:2px; }

    /* Status */
    .status { margin:16px; border-radius:12px; padding:12px 16px; text-align:center;
      font-size:14px; font-weight:800; }
    .status.pending { background:#FFF9C4; color:#92400E; border:1.5px solid #FDE68A; }
    .status.paid    { background:#ECFDF5; color:#065F46; border:1.5px solid #6EE7B7; }
    .status.expired { background:#FEF2F2; color:#7F1D1D; border:1.5px solid #FCA5A5; }

    /* Deadline */
    .deadline { text-align:center; margin:0 16px 8px; font-size:13px; color:#EF4444; font-weight:600; }

    /* Slip section */
    .slip-section { margin:16px; background:#EFF6FF; border-radius:14px; padding:20px;
      border:1px solid #BFDBFE; }
    .slip-title { font-size:14px; font-weight:800; color:#1D4ED8; margin-bottom:6px; }
    .slip-text { font-size:13px; color:#3B82F6; line-height:1.6; }

    /* Save button */
    .btn-save { display:block; background:#047857; color:#fff; border:none; border-radius:14px;
      padding:14px; width:calc(100% - 32px); margin:12px 16px 4px; font-size:15px;
      font-weight:800; cursor:pointer; text-align:center; }
    .btn-save:active { opacity:.8; }
    .footer { text-align:center; color:#9CA3AF; font-size:11px; padding:20px 16px; }
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="header-logo">
      <div class="header-icon">🐷</div>
      <span class="header-title">หมูนุ่น+เป๋าตุง</span>
    </div>
    <div class="header-sub">Thai QR Payment · PromptPay</div>
  </div>

  ${statusHtml}

  <div class="card">
    <div class="card-body">
      <div class="info-row">
        <span class="info-label">ผู้รับเงิน</span>
        <span class="info-value">หมูนุ่น+เป๋าตุง<br><small style="color:#6B7280;font-weight:400">PromptPay: ${config.promptpay.id}</small></span>
      </div>
      <div class="info-row">
        <span class="info-label">รายการ</span>
        <span class="info-value">${req.description}</span>
      </div>
      <div class="info-row">
        <span class="info-label">จำนวนเงิน</span>
        <span class="amount-value">฿${amount}</span>
      </div>
      <div class="info-row">
        <span class="info-label">เลขที่อ้างอิง</span>
        <span class="info-value" style="font-family:monospace;letter-spacing:1px">${shortRef}</span>
      </div>
    </div>

    <div class="qr-section">
      <div class="qr-label">สแกน QR ด้วยแอปธนาคาร<br>หรือ แอป PromptPay</div>
      <div id="qrcode"></div>
      <div class="ref-box">
        <div class="ref-label">Invoice / Reference</div>
        <div class="ref-code">${shortRef}</div>
      </div>
    </div>
  </div>

  ${!isExpired && !isPaid ? `<div class="deadline">⏰ กรุณาชำระก่อน ${expiryDt}</div>` : ''}

  <button class="btn-save" onclick="saveImage()">💾 บันทึก QR เป็นรูปภาพ</button>

  <div class="slip-section">
    <div class="slip-title">📬 หลังชำระแล้ว</div>
    <div class="slip-text">กรุณาส่งสลิปให้เจ้าของร้านยืนยันการรับชำระเงิน<br>ผ่านช่องทาง LINE หรือที่ตกลงกันไว้</div>
  </div>

  <div class="footer">
    หมูนุ่น+เป๋าตุง · SEVENDOG DEV<br>
    Powered by Thai QR Payment / PromptPay
  </div>
</div>

<script>
const QR_PAYLOAD = ${JSON.stringify(req.qrPayload)};

QRCode.toCanvas(document.createElement('canvas'), QR_PAYLOAD, {
  width: 240, margin: 2, color: { dark: '#000000', light: '#FFFFFF' },
  errorCorrectionLevel: 'M'
}, function(err, canvas) {
  if (!err) {
    canvas.style.borderRadius = '12px';
    document.getElementById('qrcode').appendChild(canvas);
  }
});

function saveImage() {
  const canv = document.querySelector('#qrcode canvas');
  if (!canv) return;
  // สร้าง card ที่มีข้อมูลครบ
  const out = document.createElement('canvas');
  out.width = 400; out.height = 560;
  const ctx = out.getContext('2d');

  // Background
  ctx.fillStyle = '#fff';
  ctx.roundRect(0, 0, 400, 560, 16);
  ctx.fill();

  // Header
  const grad = ctx.createLinearGradient(0, 0, 400, 80);
  grad.addColorStop(0, '#1a1a6e');
  grad.addColorStop(0.5, '#003087');
  grad.addColorStop(1, '#0066cc');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 400, 80);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('หมูนุ่น+เป๋าตุง', 200, 35);
  ctx.font = '14px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,.8)';
  ctx.fillText('Thai QR Payment · PromptPay', 200, 58);

  // Info
  ctx.fillStyle = '#111';
  ctx.textAlign = 'left';
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#6B7280';
  ctx.fillText('รายการ', 24, 108);
  ctx.fillStyle = '#111';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('${req.description}', 24, 126);

  ctx.fillStyle = '#6B7280';
  ctx.font = '13px sans-serif';
  ctx.fillText('จำนวนเงิน', 24, 152);
  ctx.fillStyle = '#047857';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText('฿${amount}', 24, 184);

  ctx.fillStyle = '#6B7280';
  ctx.font = '11px sans-serif';
  ctx.fillText('เลขอ้างอิง: ${shortRef}', 24, 204);

  // QR
  ctx.drawImage(canv, 80, 216, 240, 240);

  // Footer
  ctx.fillStyle = '#9CA3AF';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PromptPay: ${config.promptpay.id}', 200, 488);
  ctx.fillText('กรุณาชำระก่อน ${expiryDt}', 200, 508);
  ctx.fillStyle = '#047857';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('หมูนุ่น+เป๋าตุง · SEVENDOG DEV', 200, 536);

  const link = document.createElement('a');
  link.download = 'payment-qr-${shortRef}.png';
  link.href = out.toDataURL('image/png');
  link.click();
}
</script>
</body>
</html>`);
});
