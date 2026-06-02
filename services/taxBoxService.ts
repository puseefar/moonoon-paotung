import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db/client';
import { taxBoxes, taxDeductionItems } from '@/db/schema';
import { generateId } from '@/lib/uuid';
import { formatCurrency } from '@/lib/format';

// ============================================================
// ประเภทลดหย่อนภาษีไทย (rule-based, ปีภาษี 2568)
// ============================================================
export interface TaxDeductionType {
  id: string;
  name: string;
  icon: string;
  ceiling: number | null;   // null = ขึ้นกับเงินได้ / ไม่มีเพดานคงที่
  ceilingNote: string;
  description: string;
  color: string;
}

export const TAX_DEDUCTION_TYPES: TaxDeductionType[] = [
  {
    id: 'social-security',
    name: 'ประกันสังคม',
    icon: '🏛️',
    ceiling: 9000,
    ceilingNote: 'ไม่เกิน 9,000 บาท',
    description: 'เงินสมทบกองทุนประกันสังคมที่จ่ายในปีนั้น',
    color: '#1565C0',
  },
  {
    id: 'insurance-life',
    name: 'ประกันชีวิต',
    icon: '🛡️',
    ceiling: 100000,
    ceilingNote: 'ไม่เกิน 100,000 บาท',
    description: 'เบี้ยประกันชีวิตที่มีระยะเวลา ≥ 10 ปี',
    color: '#1976D2',
  },
  {
    id: 'insurance-health',
    name: 'ประกันสุขภาพ',
    icon: '🏥',
    ceiling: 25000,
    ceilingNote: 'ไม่เกิน 25,000 บาท (รวมประกันชีวิตไม่เกิน 100,000)',
    description: 'เบี้ยประกันสุขภาพของตัวเองและครอบครัว',
    color: '#00838F',
  },
  {
    id: 'ssf',
    name: 'กองทุน SSF',
    icon: '📈',
    ceiling: 200000,
    ceilingNote: 'ไม่เกิน 30% ของเงินได้ และไม่เกิน 200,000 บาท',
    description: 'Super Savings Fund — ถือครอง ≥ 10 ปี',
    color: '#2E7D32',
  },
  {
    id: 'rmf',
    name: 'กองทุน RMF',
    icon: '🏦',
    ceiling: 500000,
    ceilingNote: 'ไม่เกิน 30% ของเงินได้ และไม่เกิน 500,000 บาท',
    description: 'Retirement Mutual Fund — ถือถึงอายุ ≥ 55 ปี',
    color: '#4527A0',
  },
  {
    id: 'provident-fund',
    name: 'กองทุนสำรองเลี้ยงชีพ',
    icon: '💼',
    ceiling: 500000,
    ceilingNote: 'ไม่เกิน 500,000 บาท (รวม RMF)',
    description: 'เงินสะสมกองทุนสำรองเลี้ยงชีพที่จ่ายในปี',
    color: '#6A1B9A',
  },
  {
    id: 'home-loan-interest',
    name: 'ดอกเบี้ยเงินกู้บ้าน',
    icon: '🏠',
    ceiling: 100000,
    ceilingNote: 'ไม่เกิน 100,000 บาท',
    description: 'ดอกเบี้ยเงินกู้ซื้อ/สร้างที่อยู่อาศัย',
    color: '#E65100',
  },
  {
    id: 'easy-e-receipt',
    name: 'Easy E-Receipt',
    icon: '🧾',
    ceiling: 50000,
    ceilingNote: 'ไม่เกิน 50,000 บาท (ม.ค.–ก.พ. ของปีนั้น)',
    description: 'ช้อปสินค้า/บริการที่ออก e-Tax Invoice หรือใบกำกับภาษีอิเล็กทรอนิกส์',
    color: '#00796B',
  },
  {
    id: 'donation-general',
    name: 'เงินบริจาคทั่วไป',
    icon: '🙏',
    ceiling: null,
    ceilingNote: 'ไม่เกิน 10% ของเงินได้สุทธิหลังหักค่าลดหย่อนอื่น',
    description: 'บริจาคให้วัด สถานสาธารณกุศล หน่วยงานที่กรมสรรพากรรับรอง',
    color: '#C62828',
  },
  {
    id: 'donation-education',
    name: 'บริจาคเพื่อการศึกษา/กีฬา',
    icon: '🎓',
    ceiling: null,
    ceilingNote: 'นับได้ 2 เท่า ไม่เกิน 10% ของเงินได้สุทธิ',
    description: 'บริจาคให้สถานศึกษาหรือสโมสรกีฬาที่รับรอง',
    color: '#1565C0',
  },
  {
    id: 'pregnancy',
    name: 'ค่าฝากครรภ์/คลอดบุตร',
    icon: '👶',
    ceiling: 60000,
    ceilingNote: 'ไม่เกิน 60,000 บาทต่อครรภ์',
    description: 'ค่าใช้จ่ายฝากครรภ์และคลอดบุตรตามที่จ่ายจริง',
    color: '#E91E63',
  },
  {
    id: 'other',
    name: 'ลดหย่อนอื่นๆ',
    icon: '📋',
    ceiling: null,
    ceilingNote: 'ตรวจสอบกับกรมสรรพากร',
    description: 'ลดหย่อนที่ไม่อยู่ในหมวดข้างต้น เช่น ค่าเลี้ยงดูบิดามารดา บุตร ฯลฯ',
    color: '#546E7A',
  },
];

// ============================================================
// Types
// ============================================================
export interface TaxDeductionProgress {
  typeId: string;
  type: TaxDeductionType;
  items: Array<{
    id: string;
    amount: number;
    documentNote: string | null;
    documentUri: string | null;
    createdAt: Date;
  }>;
  totalAmount: number;
  effectiveAmount: number; // min(total, ceiling)
  ceiling: number | null;
  percentUsed: number;
  isOverCeiling: boolean;
}

export interface TaxBoxSummary {
  taxYear: number;
  taxBoxId: string | null;
  plannedIncome: number;
  categories: TaxDeductionProgress[];
  totalDeductions: number;
  totalEffectiveDeductions: number;
}

// ============================================================
// Service
// ============================================================
export const taxBoxService = {
  // ดึง tax box ของปีที่กำหนด (null = ยังไม่มี)
  async getTaxBox(taxYear: number) {
    const rows = await db.select().from(taxBoxes).where(eq(taxBoxes.taxYear, taxYear)).limit(1);
    return rows[0] ?? null;
  },

  // สร้าง tax box ถ้ายังไม่มี
  async getOrCreateTaxBox(taxYear: number) {
    const existing = await this.getTaxBox(taxYear);
    if (existing) return existing;
    const now = new Date();
    const id = generateId();
    await db.insert(taxBoxes).values({ id, taxYear, plannedIncome: 0, createdAt: now, updatedAt: now });
    return (await this.getTaxBox(taxYear))!;
  },

  async updatePlannedIncome(taxBoxId: string, plannedIncome: number) {
    await db.update(taxBoxes).set({ plannedIncome, updatedAt: new Date() }).where(eq(taxBoxes.id, taxBoxId));
  },

  // ดึง deduction items ของ tax box
  async getItems(taxBoxId: string) {
    return db.select().from(taxDeductionItems).where(eq(taxDeductionItems.taxBoxId, taxBoxId));
  },

  // เพิ่ม/แก้ไข deduction item
  async addItem(taxBoxId: string, data: {
    deductionTypeId: string;
    deductionName: string;
    amount: number;
    documentNote?: string;
    documentUri?: string;
  }) {
    const now = new Date();
    const id = generateId();
    await db.insert(taxDeductionItems).values({
      id, taxBoxId, ...data,
      documentNote: data.documentNote ?? null,
      documentUri: data.documentUri ?? null,
      createdAt: now, updatedAt: now,
    });
    return id;
  },

  async updateItem(itemId: string, data: {
    amount?: number;
    documentNote?: string;
    documentUri?: string;
  }) {
    await db.update(taxDeductionItems)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(taxDeductionItems.id, itemId));
  },

  async deleteItem(itemId: string) {
    await db.delete(taxDeductionItems).where(eq(taxDeductionItems.id, itemId));
  },

  // ============================================================
  // Main: ดึง summary ทั้งหมดของปี
  // ============================================================
  async getTaxBoxSummary(taxYear: number): Promise<TaxBoxSummary> {
    const box = await this.getTaxBox(taxYear);

    if (!box) {
      return {
        taxYear,
        taxBoxId: null,
        plannedIncome: 0,
        categories: [],
        totalDeductions: 0,
        totalEffectiveDeductions: 0,
      };
    }

    const allItems = await this.getItems(box.id);

    // จัดกลุ่มตาม deductionTypeId
    const grouped: Record<string, typeof allItems> = {};
    for (const item of allItems) {
      if (!grouped[item.deductionTypeId]) grouped[item.deductionTypeId] = [];
      grouped[item.deductionTypeId].push(item);
    }

    const categories: TaxDeductionProgress[] = TAX_DEDUCTION_TYPES.map((type) => {
      const items = grouped[type.id] ?? [];
      const totalAmount = items.reduce((s, i) => s + (i.amount ?? 0), 0);
      const effectiveAmount = type.ceiling !== null ? Math.min(totalAmount, type.ceiling) : totalAmount;
      const percentUsed = type.ceiling !== null && type.ceiling > 0
        ? (totalAmount / type.ceiling) * 100 : 0;
      return {
        typeId: type.id,
        type,
        items: items.map((i) => ({
          id: i.id,
          amount: i.amount ?? 0,
          documentNote: i.documentNote,
          documentUri: i.documentUri,
          createdAt: i.createdAt as Date,
        })),
        totalAmount,
        effectiveAmount,
        ceiling: type.ceiling,
        percentUsed,
        isOverCeiling: type.ceiling !== null && totalAmount > type.ceiling,
      };
    }).filter((c) => c.items.length > 0); // แสดงเฉพาะที่มีรายการ

    const totalDeductions = categories.reduce((s, c) => s + c.totalAmount, 0);
    const totalEffectiveDeductions = categories.reduce((s, c) => s + c.effectiveAmount, 0);

    return {
      taxYear,
      taxBoxId: box.id,
      plannedIncome: box.plannedIncome ?? 0,
      categories,
      totalDeductions,
      totalEffectiveDeductions,
    };
  },

  // ============================================================
  // Export CSV
  // ============================================================
  async exportCSV(taxYear: number): Promise<string> {
    const summary = await this.getTaxBoxSummary(taxYear);
    const BOM = '﻿';
    const header = 'ประเภทลดหย่อน,จำนวนที่บันทึก,เพดาน,ที่ใช้ลดหย่อนได้จริง,หมายเหตุ\n';

    const rows = summary.categories.map((c) => {
      const ceiling = c.ceiling !== null ? formatCurrency(c.ceiling) : 'ขึ้นกับเงินได้';
      return `${c.type.name},${formatCurrency(c.totalAmount)},${ceiling},${formatCurrency(c.effectiveAmount)},${c.type.ceilingNote}`;
    });

    rows.push('');
    rows.push(`รวมลดหย่อนทั้งหมด,${formatCurrency(summary.totalDeductions)},,${formatCurrency(summary.totalEffectiveDeductions)},`);
    rows.push(`ปีภาษี,${taxYear + 543} (พ.ศ.),,,"สร้างโดย Poatung · SEVENDOG DEV"`);

    const csv = BOM + header + rows.join('\n');
    const filename = `poatung-taxbox-${taxYear + 543}.csv`;
    const filePath = `${FileSystem.cacheDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(filePath, csv, { encoding: FileSystem.EncodingType.UTF8 });
    return filePath;
  },

  async shareCSV(taxYear: number) {
    const filePath = await this.exportCSV(taxYear);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(filePath, { mimeType: 'text/csv', dialogTitle: 'ส่งออก Tax Box' });
    }
  },

  getDeductionType(id: string): TaxDeductionType | undefined {
    return TAX_DEDUCTION_TYPES.find((t) => t.id === id);
  },
};
