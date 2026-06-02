import { eq, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { savingsGoals, goalContributions } from '@/db/schema';
import { generateId } from '@/lib/uuid';

// ============================================================
// Milestone + Encouragement (rule-based, no AI)
// ============================================================
export type MilestoneLevel = 25 | 50 | 75 | 100;

export interface MilestoneInfo {
  level: MilestoneLevel;
  label: string;
  icon: string;
  color: string;
  reached: boolean;
}

const MILESTONE_META: Record<MilestoneLevel, { label: string; icon: string; color: string }> = {
  25:  { label: '1 ใน 4',    icon: '🌱', color: '#8BC34A' },
  50:  { label: 'ครึ่งทาง', icon: '🌿', color: '#4CAF50' },
  75:  { label: 'เกือบถึง', icon: '🌳', color: '#2E7D32' },
  100: { label: 'สำเร็จ!',   icon: '🏆', color: '#FF8F00' },
};

const ENCOURAGEMENT: Record<MilestoneLevel, string[]> = {
  25: [
    'เยี่ยมมาก! ผ่าน 25% แล้ว เดินหน้าต่อไป! 💪',
    'เริ่มต้นดีแล้ว! อีกนิดก็ถึงครึ่งทางแล้ว 🌱',
    'ก้าวแรกที่ยิ่งใหญ่ที่สุดคือก้าวที่คุณเพิ่งทำ! 🎯',
  ],
  50: [
    'ครึ่งทางแล้ว! คุณทำได้ อีกครึ่งก็ไม่ไกล! 🔥',
    'ยอดเยี่ยม! 50% แล้ว เป้าหมายอยู่แค่เอื้อม! 💫',
    'ครึ่งทางเป็นหลักฐานว่าคุณทำได้จริง ๆ! 🌿',
  ],
  75: [
    'ใกล้ถึงแล้ว! 75% อีกนิดเดียวก็สำเร็จ! 🚀',
    'เหลือแค่ 25% สุดท้าย คุณมาไกลมากแล้ว! 🌳',
    'อย่าหยุด! ความสำเร็จอยู่แค่ก้าวเดียว! ⚡',
  ],
  100: [
    'ยินดีด้วย! คุณทำสำเร็จแล้ว! 🎉🏆',
    'เก่งมาก! เป้าหมายนี้สำเร็จแล้ว ตั้งเป้าหมายใหม่ได้เลย! 🌟',
    'เป็นแรงบันดาลใจมาก! ความพยายามของคุณออกดอกผลแล้ว! 🏅',
  ],
};

// ============================================================
// Helpers
// ============================================================
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getMilestones(currentAmount: number, targetAmount: number): MilestoneInfo[] {
  if (targetAmount <= 0) return [];
  const pct = (currentAmount / targetAmount) * 100;
  return ([25, 50, 75, 100] as MilestoneLevel[]).map((level) => ({
    level,
    ...MILESTONE_META[level],
    reached: pct >= level,
  }));
}

export function getEncouragementMessage(level: MilestoneLevel): string {
  return pickRandom(ENCOURAGEMENT[level]);
}

// คำนวณต้องเก็บวันละ / เดือนละเท่าไร
export interface SavingPlan {
  remaining: number;
  daysLeft: number;
  monthsLeft: number;
  perDay: number;
  perMonth: number;
  isOverdue: boolean;
}

export function getSavingPlan(currentAmount: number, targetAmount: number, deadline: Date | null): SavingPlan | null {
  if (!deadline) return null;
  const now = new Date();
  const remaining = Math.max(targetAmount - currentAmount, 0);
  const msLeft = deadline.getTime() - now.getTime();
  const daysLeft = Math.max(Math.ceil(msLeft / (1000 * 60 * 60 * 24)), 0);
  const monthsLeft = Math.max(daysLeft / 30, 0);
  const isOverdue = msLeft < 0;

  if (daysLeft === 0 || remaining === 0) {
    return { remaining, daysLeft, monthsLeft: 0, perDay: 0, perMonth: 0, isOverdue };
  }

  return {
    remaining,
    daysLeft,
    monthsLeft,
    perDay: remaining / daysLeft,
    perMonth: remaining / Math.max(monthsLeft, 1),
    isOverdue,
  };
}

// ============================================================
// Service
// ============================================================
export const dreamGoalService = {
  // ── Contributions ──────────────────────────────────────────
  async addContribution(goalId: string, amount: number, note?: string) {
    const goal = await db.select().from(savingsGoals).where(eq(savingsGoals.id, goalId)).limit(1);
    if (!goal[0]) throw new Error('ไม่พบเป้าหมาย');

    const prev = goal[0].currentAmount ?? 0;
    const prevPct = goal[0].targetAmount > 0 ? (prev / goal[0].targetAmount) * 100 : 0;
    const newAmount = prev + amount;
    const newPct = goal[0].targetAmount > 0 ? (newAmount / goal[0].targetAmount) * 100 : 0;
    const isCompleted = newAmount >= goal[0].targetAmount;

    // บันทึก contribution
    const now = new Date();
    await db.insert(goalContributions).values({
      id: generateId(),
      goalId,
      amount,
      note: note ?? null,
      createdAt: now,
    });

    // อัพเดท goal
    await db.update(savingsGoals).set({
      currentAmount: newAmount,
      isCompleted,
      updatedAt: now,
    }).where(eq(savingsGoals.id, goalId));

    // ตรวจ milestone ที่เพิ่งข้าม
    const milestones: MilestoneLevel[] = [25, 50, 75, 100];
    const crossedMilestone = milestones.find(
      (m) => prevPct < m && newPct >= m
    ) ?? null;

    return {
      newAmount,
      isCompleted,
      crossedMilestone,
      encouragement: crossedMilestone ? getEncouragementMessage(crossedMilestone) : null,
    };
  },

  async getContributions(goalId: string) {
    return db.select()
      .from(goalContributions)
      .where(eq(goalContributions.goalId, goalId))
      .orderBy(desc(goalContributions.createdAt));
  },

  async deleteContribution(contributionId: string, goalId: string, amount: number) {
    const goal = await db.select().from(savingsGoals).where(eq(savingsGoals.id, goalId)).limit(1);
    if (!goal[0]) return;
    const newAmount = Math.max((goal[0].currentAmount ?? 0) - amount, 0);
    await db.delete(goalContributions).where(eq(goalContributions.id, contributionId));
    await db.update(savingsGoals).set({
      currentAmount: newAmount,
      isCompleted: newAmount >= goal[0].targetAmount,
      updatedAt: new Date(),
    }).where(eq(savingsGoals.id, goalId));
  },

  getMilestones,
  getSavingPlan,
  getEncouragementMessage,
};
