import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { scannedSlips } from '@/db/schema';
import type { ScannedSlip } from '@/db/schema';

export type SlipInboxStatus = 'pending' | 'needs_review' | 'confirmed' | 'tax_evidence' | 'skipped';

export type SlipInboxSummary = Record<SlipInboxStatus, number>;

export const SLIP_INBOX_STATUSES: Array<{
  status: SlipInboxStatus;
  label: string;
  description: string;
}> = [
  {
    status: 'pending',
    label: 'รอจัดหมวด',
    description: 'สลิปที่อ่านข้อมูลได้แล้ว แต่ยังควรตรวจหมวดหรือรายละเอียด',
  },
  {
    status: 'needs_review',
    label: 'ต้องตรวจ',
    description: 'สลิปที่ข้อมูลไม่ครบ เช่น ไม่พบยอดเงินหรือ OCR ยังไม่มั่นใจ',
  },
  {
    status: 'confirmed',
    label: 'สำเร็จ',
    description: 'สลิปที่เชื่อมกับธุรกรรมแล้ว',
  },
  {
    status: 'tax_evidence',
    label: 'หลักฐานภาษี',
    description: 'สลิปที่ควรเก็บไว้ตรวจเอกสารภาษี',
  },
  {
    status: 'skipped',
    label: 'ข้าม',
    description: 'เก็บ record ไว้ แต่ไม่สร้างธุรกรรม',
  },
];

const EMPTY_SUMMARY: SlipInboxSummary = {
  pending: 0,
  needs_review: 0,
  confirmed: 0,
  tax_evidence: 0,
  skipped: 0,
};

export const slipInboxService = {
  async getAll(): Promise<ScannedSlip[]> {
    return db.select().from(scannedSlips).orderBy(desc(scannedSlips.createdAt));
  },

  async getByStatus(status: SlipInboxStatus): Promise<ScannedSlip[]> {
    return db
      .select()
      .from(scannedSlips)
      .where(eq(scannedSlips.status, status))
      .orderBy(desc(scannedSlips.createdAt));
  },

  async getSummary(): Promise<SlipInboxSummary> {
    const rows = await db
      .select({
        status: scannedSlips.status,
        count: sql<number>`COUNT(*)`,
      })
      .from(scannedSlips)
      .groupBy(scannedSlips.status);

    const summary = { ...EMPTY_SUMMARY };
    for (const row of rows) {
      const status = row.status as SlipInboxStatus | null;
      if (status && status in summary) {
        summary[status] = row.count ?? 0;
      }
    }
    return summary;
  },

  async updateStatus(id: string, status: SlipInboxStatus) {
    await db.update(scannedSlips).set({ status }).where(eq(scannedSlips.id, id));
  },
};
