import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { and, gte, lte, eq, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { transactions, categories, wallets } from '@/db/schema';
import { formatCurrency, formatDate } from '@/lib/format';

export const exportService = {
  // Export CSV สำหรับช่วงเวลาที่กำหนด
  async exportCSV(year: number, month: number): Promise<string> {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59);

    const result = await db
      .select({
        date: transactions.date,
        type: transactions.type,
        amount: transactions.amount,
        categoryName: categories.name,
        walletName: wallets.name,
        note: transactions.note,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .leftJoin(wallets, eq(transactions.walletId, wallets.id))
      .where(and(gte(transactions.date, startDate), lte(transactions.date, endDate)))
      .orderBy(desc(transactions.date));

    // BOM for Excel Thai encoding
    const BOM = '\uFEFF';
    const header = 'วันที่,ประเภท,จำนวนเงิน,หมวดหมู่,กระเป๋าเงิน,โน้ต\n';

    const rows = result.map((row) => {
      const date = formatDate(new Date(row.date));
      const type = row.type === 'income' ? 'รายรับ' : row.type === 'expense' ? 'รายจ่าย' : 'โอน';
      const amount = row.amount.toFixed(2);
      const category = (row.categoryName ?? '-').replace(/,/g, ' ');
      const wallet = (row.walletName ?? '-').replace(/,/g, ' ');
      const note = (row.note ?? '-').replace(/,/g, ' ').replace(/\n/g, ' ');
      return `${date},${type},${amount},${category},${wallet},${note}`;
    });

    const csv = BOM + header + rows.join('\n');

    const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const filename = `poatung-${THAI_MONTHS[month]}-${year + 543}.csv`;
    const filePath = `${FileSystem.cacheDirectory}${filename}`;

    await FileSystem.writeAsStringAsync(filePath, csv, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    return filePath;
  },

  // Export เป็น HTML report (สำหรับแชร์/พิมพ์)
  async exportHTMLReport(year: number, month: number): Promise<string> {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59);

    const result = await db
      .select({
        date: transactions.date,
        type: transactions.type,
        amount: transactions.amount,
        categoryName: categories.name,
        categoryIcon: categories.icon,
        walletName: wallets.name,
        note: transactions.note,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .leftJoin(wallets, eq(transactions.walletId, wallets.id))
      .where(and(gte(transactions.date, startDate), lte(transactions.date, endDate)))
      .orderBy(desc(transactions.date));

    let totalIncome = 0;
    let totalExpense = 0;
    for (const row of result) {
      if (row.type === 'income') totalIncome += row.amount;
      if (row.type === 'expense') totalExpense += row.amount;
    }

    const THAI_MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    const monthLabel = `${THAI_MONTHS_FULL[month]} ${year + 543}`;

    const tableRows = result.map((row) => {
      const typeLabel = row.type === 'income' ? 'รายรับ' : row.type === 'expense' ? 'รายจ่าย' : 'โอน';
      const color = row.type === 'income' ? '#4CAF50' : row.type === 'expense' ? '#F44336' : '#FF9800';
      return `<tr>
        <td>${formatDate(new Date(row.date))}</td>
        <td>${row.categoryIcon ?? ''} ${row.categoryName ?? '-'}</td>
        <td style="color:${color};font-weight:bold">${typeLabel}</td>
        <td style="text-align:right;color:${color};font-weight:bold">${formatCurrency(row.amount)}</td>
        <td>${row.walletName ?? '-'}</td>
        <td>${row.note ?? '-'}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>รายงาน ${monthLabel}</title>
<style>
  body{font-family:sans-serif;padding:20px;color:#333;max-width:800px;margin:0 auto}
  h1{color:#1976D2;font-size:24px}
  .summary{display:flex;gap:16px;margin:20px 0}
  .summary-card{flex:1;padding:16px;border-radius:12px;text-align:center}
  .income{background:#E8F5E9;color:#4CAF50}
  .expense{background:#FFEBEE;color:#F44336}
  .balance{background:#E3F2FD;color:#1976D2}
  .summary-card h3{margin:0;font-size:14px;opacity:0.8}
  .summary-card p{margin:4px 0 0;font-size:22px;font-weight:800}
  table{width:100%;border-collapse:collapse;margin-top:20px;font-size:13px}
  th{background:#1976D2;color:#FFF;padding:10px 8px;text-align:left}
  td{padding:8px;border-bottom:1px solid #E0E0E0}
  tr:hover{background:#F5F5F5}
  .footer{text-align:center;margin-top:30px;color:#999;font-size:12px}
</style>
</head>
<body>
<h1>Poatung - รายงานประจำเดือน</h1>
<h2>${monthLabel}</h2>

<div class="summary">
  <div class="summary-card income"><h3>รายรับ</h3><p>+${formatCurrency(totalIncome)}</p></div>
  <div class="summary-card expense"><h3>รายจ่าย</h3><p>-${formatCurrency(totalExpense)}</p></div>
  <div class="summary-card balance"><h3>คงเหลือ</h3><p>${formatCurrency(totalIncome - totalExpense)}</p></div>
</div>

<table>
<thead><tr><th>วันที่</th><th>หมวดหมู่</th><th>ประเภท</th><th style="text-align:right">จำนวนเงิน</th><th>กระเป๋า</th><th>โน้ต</th></tr></thead>
<tbody>${tableRows}</tbody>
</table>

<p style="margin-top:16px;font-size:13px;color:#666">ทั้งหมด ${result.length} รายการ</p>

<div class="footer">
  <p>สร้างโดย Poatung | SEVENDOG DEV</p>
  <p>${new Date().toLocaleString('th-TH')}</p>
</div>
</body></html>`;

    const filename = `poatung-report-${monthLabel.replace(/ /g, '-')}.html`;
    const filePath = `${FileSystem.cacheDirectory}${filename}`;

    await FileSystem.writeAsStringAsync(filePath, html, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    return filePath;
  },

  // Share ไฟล์
  async shareFile(filePath: string, mimeType: string = 'text/csv') {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(filePath, {
        mimeType,
        dialogTitle: 'ส่งออกรายงาน',
      });
    }
  },
};
