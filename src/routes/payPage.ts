// ── Public Payment Page — no auth required ────────────────────────────────────
// GET /pay/:requestId → HTML page แสดง QR + รายละเอียด ส่งให้ลูกค้า
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { paymentRequests } from '../db/schema.js';

export const payPageRouter = new Hono();

payPageRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const req = await db.query.paymentRequests.findFirst({ where: eq(paymentRequests.id, id) });

  if (!req) {
    return c.html(`<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:40px">
      <h2>❌ ไม่พบรายการชำระเงิน</h2>
      <p>รหัส: ${id}</p>
    </body></html>`, 404);
  }

  const isExpired = req.expiresAt < new Date();
  const isPaid = req.status === 'paid';
  const amount = Number(req.amount).toLocaleString('th-TH', { minimumFractionDigits: 2 });
  const shortRef = id.slice(0, 8).toUpperCase();
  const statusText = isPaid ? '✅ ชำระแล้ว' : isExpired ? '❌ QR หมดอายุ' : '⏳ รอชำระเงิน';
  const statusColor = isPaid ? '#065F46' : isExpired ? '#7F1D1D' : '#92400E';
  const statusBg = isPaid ? '#ECFDF5' : isExpired ? '#FEF2F2' : '#FFF9C4';

  return c.html(`<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>ชำระเงิน ฿${amount} — หมูนุ่น+เป๋าตุง</title>
  <script src="https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, sans-serif; background: #F0FDF4; min-height: 100vh; }
    .header { background: linear-gradient(135deg,#047857,#059669,#10B981); color:#fff; padding:20px; text-align:center; }
    .header h1 { font-size:20px; font-weight:800; }
    .header p { font-size:13px; opacity:.8; margin-top:4px; }
    .card { background:#fff; border-radius:20px; margin:16px; padding:24px; box-shadow:0 4px 12px rgba(0,128,80,.1); text-align:center; }
    .amount { font-size:36px; font-weight:900; color:#047857; margin:8px 0 20px; }
    .desc { font-size:14px; color:#6B7280; margin-bottom:16px; }
    #qrcode { display:flex; justify-content:center; margin:16px 0; }
    #qrcode canvas { border:1px solid #E5E7EB; border-radius:12px; padding:12px; background:#fff; }
    .promptpay { font-size:12px; color:#9CA3AF; margin-top:8px; }
    .ref-box { background:#F0FDF4; border:1px solid #6EE7B7; border-radius:12px; padding:12px; margin-top:16px; }
    .ref-label { font-size:11px; color:#6B7280; }
    .ref-code { font-size:18px; font-weight:900; color:#047857; letter-spacing:3px; }
    .status { border-radius:12px; padding:10px 16px; margin:0 16px 8px; text-align:center; font-weight:800; font-size:15px; }
    .action-card { background:#EFF6FF; border-radius:20px; margin:16px; padding:20px; border:1px solid #BFDBFE; }
    .action-card h3 { color:#1D4ED8; font-size:15px; margin-bottom:8px; }
    .action-card p { color:#3B82F6; font-size:13px; line-height:1.6; }
    .footer { text-align:center; color:#9CA3AF; font-size:12px; padding:20px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>💳 หมูนุ่น+เป๋าตุง</h1>
    <p>ขอรับชำระเงิน</p>
  </div>

  <div class="status" style="background:${statusBg};color:${statusColor}">
    ${statusText}
  </div>

  <div class="card">
    <div class="desc">${req.description}</div>
    <div class="amount">฿${amount}</div>
    <div id="qrcode"></div>
    <div class="promptpay">PromptPay: ${req.qrPayload.includes('0066') ? 'เบอร์โทร' : 'TaxID'}</div>
    <div class="ref-box">
      <div class="ref-label">รหัสอ้างอิงธุรกรรม</div>
      <div class="ref-code">${shortRef}</div>
    </div>
  </div>

  <div class="action-card">
    <h3>📬 ส่งสลิปยืนยัน</h3>
    <p>หลังจากโอนเงินแล้ว<br>กรุณาส่งสลิปให้เจ้าของร้านยืนยัน<br>โดยตรงทาง LINE หรือช่องทางที่แจ้ง</p>
  </div>

  <div class="footer">
    หมูนุ่น+เป๋าตุง · SEVENDOG DEV<br>
    ระบบรับชำระเงิน PromptPay
  </div>

  <script>
    QRCode.toCanvas(document.createElement('canvas'), ${JSON.stringify(req.qrPayload)}, {
      width: 220, margin: 1, color: { dark: '#000', light: '#fff' }
    }, function(err, canvas) {
      if (!err) document.getElementById('qrcode').appendChild(canvas);
    });
  </script>
</body>
</html>`);
});
