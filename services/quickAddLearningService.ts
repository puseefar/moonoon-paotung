import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { quickAddLearningRules } from '@/db/schema';
import type { NewQuickAddLearningRule, QuickAddLearningRule } from '@/db/schema';
import { generateId } from '@/lib/uuid';

export type QuickAddLearningInput = {
  rawText: string;
  type: 'income' | 'expense';
  categoryId: string | null;
  source: 'user_correction' | 'user_confirmation';
};

function normalize(input: string) {
  return input
    .normalize('NFC')
    .trim()
    .replace(/เเ/g, 'แ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function compact(input: string) {
  return normalize(input).replace(/\s+/g, '');
}

const THAI_NUMBER_WORD_PATTERN =
  'ศูนย์|หนึ่ง|เอ็ด|ยี่|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า';
const THAI_SCALE_WORD_PATTERN = 'ล้าน|แสน|หมื่น|พัน|ร้อย|สิบ';
const THAI_NUMBER_TOKEN_PATTERN =
  `(?:\\d+(?:\\.\\d+)?|[๐-๙]+|${THAI_NUMBER_WORD_PATTERN})`;
const THAI_SCALED_AMOUNT_REGEX = new RegExp(
  `((?:(?:${THAI_NUMBER_TOKEN_PATTERN})?\\s*(?:${THAI_SCALE_WORD_PATTERN})\\s*)+(?:(?:${THAI_NUMBER_TOKEN_PATTERN})\\s*)?(?:บาท|฿)?)`,
  'g'
);

function stripScaledAmount(input: string) {
  const matches = [...input.matchAll(THAI_SCALED_AMOUNT_REGEX)]
    .map((match) => ({
      index: match.index ?? -1,
      value: match[0],
    }))
    .filter(
      (match) =>
        match.index >= 0 &&
        ( /บาท|฿/.test(match.value)
          || /\d|[๐-๙]/.test(match.value)
          || /ร้อย|พัน|หมื่น|แสน|ล้าน/.test(match.value))
    )
    .sort((a, b) => b.index - a.index);

  let stripped = input;
  for (const match of matches) {
    stripped = `${stripped.slice(0, match.index)} ${stripped.slice(match.index + match.value.length)}`;
  }

  return stripped;
}

function stripAmount(input: string) {
  return stripScaledAmount(normalize(input))
    .replace(/(?:฿|บาท)?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?\s*(?:บาท|฿)?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getKeyword(rawText: string) {
  const withoutAmount = stripAmount(rawText);
  const keyword = withoutAmount || normalize(rawText);
  return keyword.slice(0, 80);
}

export const quickAddLearningService = {
  normalizeKeyword(rawText: string) {
    return compact(getKeyword(rawText));
  },

  async getAll(): Promise<QuickAddLearningRule[]> {
    return db
      .select()
      .from(quickAddLearningRules)
      .orderBy(desc(quickAddLearningRules.confidence), desc(quickAddLearningRules.hitCount));
  },

  async learn(input: QuickAddLearningInput) {
    const keyword = getKeyword(input.rawText);
    const normalizedKeyword = compact(keyword);
    if (!normalizedKeyword || normalizedKeyword.length < 2) return null;

    const now = new Date();
    const existing = await db
      .select()
      .from(quickAddLearningRules)
      .where(
        and(
          eq(quickAddLearningRules.normalizedKeyword, normalizedKeyword),
          eq(quickAddLearningRules.type, input.type)
        )
      )
      .limit(1);

    const current = existing[0];
    if (current) {
      await db
        .update(quickAddLearningRules)
        .set({
          keyword,
          categoryId: input.categoryId,
          source: input.source,
          confidence: Math.min((current.confidence ?? 1) + 1, 10),
          hitCount: (current.hitCount ?? 0) + 1,
          updatedAt: now,
        })
        .where(eq(quickAddLearningRules.id, current.id));
      return current.id;
    }

    const id = generateId();
    const data: NewQuickAddLearningRule = {
      id,
      keyword,
      normalizedKeyword,
      type: input.type,
      categoryId: input.categoryId,
      confidence: input.source === 'user_correction' ? 3 : 1,
      source: input.source,
      hitCount: 1,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(quickAddLearningRules).values(data);
    return id;
  },
};
