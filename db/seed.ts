import { count, eq } from 'drizzle-orm';
import { db } from './client';
import { appSettings, categories, wallets } from './schema';
import { generateId } from '../lib/uuid';

type DefaultCategorySeed = {
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
  type: 'income' | 'expense';
};

type DefaultSettingSeed = {
  key: string;
  value: string;
};

const DEFAULT_EXPENSE_CATEGORIES: DefaultCategorySeed[] = [
  { name: 'อาหาร/เครื่องดื่ม', icon: '🍜', color: '#FF5722', sortOrder: 1, type: 'expense' },
  { name: 'เดินทาง/น้ำมัน', icon: '🚗', color: '#2196F3', sortOrder: 2, type: 'expense' },
  { name: 'ที่อยู่อาศัย/ค่าเช่า', icon: '🏠', color: '#9C27B0', sortOrder: 3, type: 'expense' },
  { name: 'ค่าน้ำ/ค่าไฟ', icon: '⚡', color: '#FF9800', sortOrder: 4, type: 'expense' },
  { name: 'ค่าโทรศัพท์/อินเทอร์เน็ต', icon: '📱', color: '#00BCD4', sortOrder: 5, type: 'expense' },
  { name: 'ช้อปปิ้ง', icon: '🛒', color: '#E91E63', sortOrder: 6, type: 'expense' },
  { name: 'สุขภาพ/ยา', icon: '🏥', color: '#4CAF50', sortOrder: 7, type: 'expense' },
  { name: 'การศึกษา', icon: '🎓', color: '#3F51B5', sortOrder: 8, type: 'expense' },
  { name: 'บันเทิง', icon: '🎮', color: '#673AB7', sortOrder: 9, type: 'expense' },
  { name: 'เสื้อผ้า', icon: '👟', color: '#795548', sortOrder: 10, type: 'expense' },
  { name: 'อื่นๆ', icon: '📦', color: '#607D8B', sortOrder: 11, type: 'expense' },
  { name: 'Lifestyle', icon: '✨', color: '#EC4899', sortOrder: 12, type: 'expense' },
  { name: 'Trip/ทัวร์', icon: '🧳', color: '#0EA5E9', sortOrder: 13, type: 'expense' },
  { name: 'ท่องเที่ยววันหยุด', icon: '🏖️', color: '#14B8A6', sortOrder: 14, type: 'expense' },
  { name: 'ทำบุญ/การกุศล', icon: '🙏', color: '#F59E0B', sortOrder: 15, type: 'expense' },
  { name: 'ประกอบธุรกิจ', icon: '🏢', color: '#3F51B5', sortOrder: 16, type: 'expense' },
  { name: 'กิจกรรมการเกษตร', icon: '🌱', color: '#4CAF50', sortOrder: 17, type: 'expense' },
];

const DEFAULT_INCOME_CATEGORIES: DefaultCategorySeed[] = [
  { name: 'เงินเดือน', icon: '💰', color: '#4CAF50', sortOrder: 1, type: 'income' },
  { name: 'รายได้เสริม/ฟรีแลนซ์', icon: '💼', color: '#8BC34A', sortOrder: 2, type: 'income' },
  { name: 'ดอกเบี้ย', icon: '🏦', color: '#CDDC39', sortOrder: 3, type: 'income' },
  { name: 'ของขวัญ/โบนัส', icon: '🎁', color: '#FFC107', sortOrder: 4, type: 'income' },
  { name: 'อื่นๆ', icon: '📦', color: '#607D8B', sortOrder: 5, type: 'income' },
  { name: 'ธุรกิจส่วนตัว', icon: '🏪', color: '#14B8A6', sortOrder: 6, type: 'income' },
  { name: 'ร้านอาหาร', icon: '🍽️', color: '#F97316', sortOrder: 7, type: 'income' },
  { name: 'ขายของในตลาด', icon: '🧺', color: '#22C55E', sortOrder: 8, type: 'income' },
  { name: 'แม่ค้าออนไลน์', icon: '📦', color: '#EC4899', sortOrder: 9, type: 'income' },
  { name: 'ศิลปิน', icon: '🎨', color: '#8B5CF6', sortOrder: 10, type: 'income' },
  { name: 'เกษตรกร', icon: '🌾', color: '#84CC16', sortOrder: 11, type: 'income' },
  { name: 'นักกีฬา', icon: '🏅', color: '#06B6D4', sortOrder: 12, type: 'income' },
  { name: 'Gamer', icon: '🎮', color: '#6366F1', sortOrder: 13, type: 'income' },
  { name: 'พนักงานไอที', icon: '💻', color: '#3B82F6', sortOrder: 14, type: 'income' },
  { name: 'ค่าคอมมิชชั่น', icon: '💹', color: '#00BCD4', sortOrder: 15, type: 'income' },
];

const DEFAULT_SETTINGS: DefaultSettingSeed[] = [
  { key: 'currency', value: 'THB' },
  { key: 'theme', value: 'light' },
  { key: 'notification_enabled', value: 'true' },
  { key: 'notification_time', value: '20:00' },
];

const DEFAULT_WALLET = {
  name: 'เงินสด',
  icon: '💵',
  balance: 0,
  currency: 'THB',
  isActive: true,
};

function categoryKey(type: 'income' | 'expense', name: string) {
  return `${type}:${name.trim().toLowerCase()}`;
}

async function ensureDefaultCategories(now: Date) {
  const existingCategories = await db
    .select({
      name: categories.name,
      type: categories.type,
    })
    .from(categories);

  const existingKeys = new Set(
    existingCategories.map((category) => categoryKey(category.type, category.name))
  );

  for (const category of [...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES]) {
    const key = categoryKey(category.type, category.name);
    if (existingKeys.has(key)) continue;

    await db.insert(categories).values({
      id: generateId(),
      name: category.name,
      icon: category.icon,
      type: category.type,
      color: category.color,
      sortOrder: category.sortOrder,
      isDefault: true,
      createdAt: now,
    });

    existingKeys.add(key);
  }
}

async function ensureDefaultWallet(now: Date) {
  const [walletCount] = await db.select({ value: count() }).from(wallets);
  if ((walletCount?.value ?? 0) > 0) return;

  await db.insert(wallets).values({
    id: generateId(),
    ...DEFAULT_WALLET,
    createdAt: now,
    updatedAt: now,
  });
}

async function ensureDefaultSettings(now: Date) {
  const existingSettings = await db.select({ key: appSettings.key }).from(appSettings);
  const existingKeys = new Set(existingSettings.map((setting) => setting.key));

  for (const setting of DEFAULT_SETTINGS) {
    if (existingKeys.has(setting.key)) continue;

    await db.insert(appSettings).values({
      key: setting.key,
      value: setting.value,
      updatedAt: now,
    });
  }
}

async function ensureLegacyCashWalletIcon() {
  const legacyWallets = await db
    .select({
      id: wallets.id,
      icon: wallets.icon,
      name: wallets.name,
    })
    .from(wallets)
    .where(eq(wallets.name, 'เงินสด'));

  for (const wallet of legacyWallets) {
    if (wallet.icon && wallet.icon !== '💵') continue;

    await db
      .update(wallets)
      .set({
        icon: '💵',
        updatedAt: new Date(),
      })
      .where(eq(wallets.id, wallet.id));
  }
}

export async function seedDefaultData() {
  const now = new Date();

  await ensureDefaultCategories(now);
  await ensureDefaultWallet(now);
  await ensureDefaultSettings(now);
  await ensureLegacyCashWalletIcon();
}
