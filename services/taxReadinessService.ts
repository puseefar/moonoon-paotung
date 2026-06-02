import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { categories, scannedSlips, transactions } from '@/db/schema';

export type TaxChecklistItem = {
  id: string;
  label: string;
  detail: string;
  status: 'ready' | 'needs-review' | 'not-started';
};

export type TaxReminder = {
  form: 'ภ.ง.ด.94' | 'ภ.ง.ด.90/91';
  title: string;
  detail: string;
  windowLabel: string;
  audience: string;
};

export type TaxReadinessChecklist = {
  taxYear: number;
  checklist: TaxChecklistItem[];
  reminders: TaxReminder[];
  summary: {
    ready: number;
    needsReview: number;
    notStarted: number;
  };
  disclaimer: string;
};

const TAX_KEYWORDS = [
  'tax',
  'ภาษี',
  'ลดหย่อน',
  'easy e-receipt',
  'easy e receipt',
  'ประกัน',
  'ssf',
  'rmf',
  'บริจาค',
  'ดอกเบี้ยบ้าน',
];

function getTaxYear(date: Date) {
  return date.getFullYear() + 543;
}

function getCalendarYearFromTaxYear(taxYear: number) {
  return taxYear - 543;
}

function hasTaxKeyword(value: string | null | undefined) {
  const text = (value ?? '').toLowerCase();
  return TAX_KEYWORDS.some((keyword) => text.includes(keyword));
}

function summarize(checklist: TaxChecklistItem[]) {
  return checklist.reduce(
    (acc, item) => {
      if (item.status === 'ready') acc.ready++;
      if (item.status === 'needs-review') acc.needsReview++;
      if (item.status === 'not-started') acc.notStarted++;
      return acc;
    },
    { ready: 0, needsReview: 0, notStarted: 0 },
  );
}

export const taxReadinessService = {
  async getChecklist(date: Date = new Date()): Promise<TaxReadinessChecklist> {
    const taxYear = getTaxYear(date);
    const calendarYear = getCalendarYearFromTaxYear(taxYear);
    const yearStart = new Date(calendarYear, 0, 1);
    const yearEnd = new Date(calendarYear, 11, 31, 23, 59, 59, 999);
    const halfYearEnd = new Date(calendarYear, 5, 30, 23, 59, 59, 999);

    const [taxCategoryRows, taxTransactionRows, halfYearBusinessRows, slipRows] =
      await Promise.all([
        db.select().from(categories),
        db
          .select({
            count: sql<number>`COUNT(*)`,
          })
          .from(transactions)
          .leftJoin(categories, eq(transactions.categoryId, categories.id))
          .where(
            and(
              gte(transactions.date, yearStart),
              lte(transactions.date, yearEnd),
            ),
          ),
        db
          .select({
            count: sql<number>`COUNT(*)`,
          })
          .from(transactions)
          .leftJoin(categories, eq(transactions.categoryId, categories.id))
          .where(
            and(
              gte(transactions.date, yearStart),
              lte(transactions.date, halfYearEnd),
            ),
          ),
        db
          .select({
            count: sql<number>`COUNT(*)`,
          })
          .from(scannedSlips)
          .where(gte(scannedSlips.createdAt, yearStart)),
      ]);

    const hasTaxCategories = taxCategoryRows.some((category) => hasTaxKeyword(category.name));
    const hasTaxTransactions = taxTransactionRows[0]?.count > 0;
    const hasHalfYearData = halfYearBusinessRows[0]?.count > 0;
    const hasSlipEvidence = slipRows[0]?.count > 0;

    const checklist: TaxChecklistItem[] = [
      {
        id: 'tax-categories',
        label: 'มีหมวดสำหรับเอกสาร/รายการภาษี',
        detail: 'เช่น Easy E-Receipt, ประกัน, SSF/RMF, บริจาค หรือดอกเบี้ยบ้าน',
        status: hasTaxCategories ? 'ready' : 'not-started',
      },
      {
        id: 'tax-transactions',
        label: 'มีรายการรายรับ/รายจ่ายในปีภาษีนี้',
        detail: 'ใช้สำหรับรวบรวมข้อมูลก่อนยื่นแบบ ไม่ใช่การคำนวณภาษี',
        status: hasTaxTransactions ? 'ready' : 'not-started',
      },
      {
        id: 'slip-evidence',
        label: 'มีหลักฐานสลิป/เอกสารแนบในแอป',
        detail: 'ช่วยให้ตรวจเอกสารประกอบก่อนยื่นหรือขอคืนภาษีได้ง่ายขึ้น',
        status: hasSlipEvidence ? 'ready' : 'needs-review',
      },
      {
        id: 'pnd94-review',
        label: 'ตรวจว่าต้องยื่น ภ.ง.ด.94 หรือไม่',
        detail: 'เหมาะกับผู้มีเงินได้ประเภท 5, 6, 7 หรือ 8 เช่น ฟรีแลนซ์/ค้าขาย/ธุรกิจบางประเภท',
        status: hasHalfYearData ? 'needs-review' : 'not-started',
      },
    ];

    return {
      taxYear,
      checklist,
      reminders: [
        {
          form: 'ภ.ง.ด.94',
          title: 'รอบครึ่งปี',
          detail: 'สำหรับเงินได้พึงประเมินประเภท 5, 6, 7 หรือ 8 ที่ได้รับตั้งแต่มกราคมถึงมิถุนายน',
          windowLabel: `เตรียมเอกสาร ก.ค.-ก.ย. ${taxYear} / โดยทั่วไปยื่นภายในเดือนกันยายน`,
          audience: 'ฟรีแลนซ์ แม่ค้าออนไลน์ เจ้าของร้าน และผู้มีรายได้จากธุรกิจ/อาชีพอิสระบางประเภท',
        },
        {
          form: 'ภ.ง.ด.90/91',
          title: 'รอบปลายปี',
          detail: 'สำหรับยื่นภาษีเงินได้บุคคลธรรมดาประจำปี',
          windowLabel: `เตรียมเอกสาร ม.ค.-มี.ค. ${taxYear + 1} / ช่องทางออนไลน์มักมีระยะเวลาขยายตามประกาศกรมสรรพากร`,
          audience: 'บุคคลธรรมดาที่มีหน้าที่ยื่นแบบประจำปี',
        },
      ],
      summary: summarize(checklist),
      disclaimer:
        'ข้อมูลนี้เป็น checklist เพื่อช่วยรวบรวมเอกสารและเตือนกำหนดการทั่วไป ไม่ใช่คำแนะนำทางภาษี ไม่ใช่การคำนวณภาษี และไม่รับรองความถูกต้องของสิทธิ์ลดหย่อน โปรดตรวจสอบกับกรมสรรพากรหรือผู้เชี่ยวชาญก่อนยื่นแบบ',
    };
  },
};
