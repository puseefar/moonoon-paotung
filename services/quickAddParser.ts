import type { Category } from '@/db/schema';

export type QuickAddResult = {
  amount: number | null;
  type: 'income' | 'expense';
  category: Category | null;
  note: string;
  confidence: 'high' | 'medium' | 'low';
};

export type QuickAddLearningRuleInput = {
  keyword: string;
  normalizedKeyword?: string;
  type: 'income' | 'expense';
  categoryId: string | null;
  confidence?: number | null;
};

export type QuickAddStarterKeywordMapping = {
  keyword: string;
  type: 'income' | 'expense';
  categoryHint: string;
  scoreBoost?: number;
};

export type QuickAddStarterProfile = {
  id: string;
  name: string;
  source: 'starter_template' | 'custom_bundle';
  templateIds: string[];
  preferredIncomeCategories: string[];
  preferredExpenseCategories: string[];
  keywordMappings: QuickAddStarterKeywordMapping[];
  helperTags: string[];
  sampleEntries: string[];
};

type ParseOptions = {
  preferredType?: 'income' | 'expense';
  learningRules?: QuickAddLearningRuleInput[];
  starterProfile?: QuickAddStarterProfile | null;
};

type TransactionType = QuickAddResult['type'];

type ScoreRule = {
  pattern: string;
  score: number;
};

type RuleGroup = {
  name: string;
  rules: ScoreRule[];
};

type CategoryRule = {
  name: string;
  keywords: string[];
  categoryHints: string[];
};

type IntentCategoryRule = {
  name: string;
  type: TransactionType;
  triggers: string[];
  preferredHints: string[];
  fallbackHints?: string[];
};

type TypeScoreSummary = {
  total: number;
  matchedRules: ScoreRule[];
};

type CategoryHintMatch = {
  category: Category;
  score: number;
};

type CategoryCandidate = {
  category: Category;
  score: number;
};

const MONEY_REQUEST_SUBJECTS = ['แม่', 'พ่อ', 'เพื่อน', 'หลาน', 'ลูก', 'น้อง', 'พี่', 'แฟน'];

const MONEY_REQUEST_PATTERNS = MONEY_REQUEST_SUBJECTS.flatMap((subject) => [
  `${subject}ขอตัง`,
  `${subject}ขอตังค์`,
  `${subject}ขอเงิน`,
]);

const DEBT_REPAYMENT_SUBJECTS = ['เพื่อน', 'แฟน', 'พี่', 'น้อง', 'ลูกหนี้'];

const DEBT_REPAYMENT_PATTERNS = DEBT_REPAYMENT_SUBJECTS.flatMap((subject) => [
  `${subject}จ่ายหนี้`,
  `${subject}ใช้หนี้`,
  `${subject}คืนหนี้`,
]);

const GENERAL_WAGE_EXPENSE_PATTERNS = ['ค่าจ้าง', 'ค่าแรง'];

const STAFF_EXPENSE_PATTERNS = [
  'ค่าจ้างแอดมิน',
  'ค่าจ้างผู้ดูแลระบบ',
  'ค่าจ้างแม่บ้าน',
  'ค่าจ้างพนักงาน',
  'ค่าจ้างพนักงานทั่วไป',
  'ค่าจ้างรถขนของ',
  'เงินเดือนพนักงาน',
  'ค่าแรงพนักงาน',
  'จ่ายพนักงาน',
];

const OPERATING_EXPENSE_PATTERNS = [
  'ค่าส่ง',
  'ค่าจัดส่ง',
  'แพ็กของ',
  'แพ็คของ',
  'ต้นทุน',
  'ค่าใช้จ่ายธุรกิจ',
  'ค่าใช้จ่ายในธุรกิจ',
  'ค่าใช้จ่ายการเกษตร',
  'ค่าใช้จ่ายสวน',
  'ค่าใช้จ่ายฟาร์ม',
  'ค่าธรรมเนียม',
  'ค่าแพลตฟอร์ม',
  'ค่าplatform',
  'platformfee',
  'ค่าอุปกรณ์ไอที',
  'อุปกรณ์ไอที',
  'ค่าอุปกรณ์เกษตร',
  'ค่าวัตถุดิบ',
  'วัตถุดิบการผลิต',
  'ค่าเครื่องจักร',
  'ค่าซ่อมเครื่องจักร',
];

const REFUND_EXPENSE_PATTERNS = ['คืนเงินลูกค้า', 'คืนเงินให้ลูกค้า'];

const STAFF_EXPENSE_CONTEXT_PATTERNS = ['พนักงาน', 'แอดมิน', 'ผู้ดูแลระบบ', 'แม่บ้าน', 'รถขนของ', 'คนงานสวน', 'คนงาน'];

const OPERATING_EXPENSE_CONTEXT_PATTERNS = ['ขนของ', 'วัตถุดิบ', 'การผลิต', 'เครื่องจักร', 'แพลตฟอร์ม', 'ธุรกิจ', 'สวน', 'ฟาร์ม', 'เกษตร'];

const CREATOR_FEE_EXPENSE_PATTERNS = ['ค่าคอมมิชชั่นcreator', 'คอมมิชชั่นcreator'];

const createScoredRules = (patterns: string[], score: number): ScoreRule[] =>
  patterns.map((pattern) => ({ pattern, score }));

const TYPE_RULE_ENGINE: Record<TransactionType, RuleGroup[]> = {
  income: [
    {
      name: 'signals',
      rules: [
        { pattern: 'รับค่า', score: 8 },
        { pattern: 'รับตัง', score: 9 },
        { pattern: 'รับเงิน', score: 8 },
        { pattern: 'ได้รับ', score: 8 },
        { pattern: 'ได้เงิน', score: 8 },
        { pattern: 'ได้เงินคืน', score: 10 },
        { pattern: 'ได้คืน', score: 8 },
        { pattern: 'ได้ค่า', score: 8 },
        { pattern: 'เงินเข้า', score: 8 },
        { pattern: 'โอนเข้า', score: 8 },
        { pattern: 'โอนเข้าจาก', score: 10 },
        { pattern: 'ลูกค้าจ่ายค่า', score: 12 },
        { pattern: 'ลูกค้าโอนค่า', score: 12 },
        { pattern: 'ลคจ่ายค่า', score: 12 },
        { pattern: 'ลคโอนค่า', score: 12 },
        { pattern: 'ลูกค้าโอน', score: 8 },
        { pattern: 'ลูกค้าจ่าย', score: 10 },
        { pattern: 'ลคโอน', score: 10 },
        { pattern: 'ลคจ่าย', score: 10 },
        { pattern: 'ขายได้', score: 8 },
        { pattern: 'ของขวัญ', score: 8 },
        { pattern: 'รับคืนเงิน', score: 10 },
        { pattern: 'เพื่อนคืนเงิน', score: 10 },
        { pattern: 'เพื่อนโอนคืน', score: 10 },
        { pattern: 'เงินคืน', score: 8 },
        { pattern: 'หารค่าอาหาร', score: 10 },
        ...createScoredRules(DEBT_REPAYMENT_PATTERNS, 12),
        { pattern: 'แม่ให้เงิน', score: 10 },
        { pattern: 'พ่อให้เงิน', score: 10 },
        { pattern: 'แม่โอนให้', score: 10 },
        { pattern: 'เเม่โอนให้', score: 10 },
        { pattern: 'ขอเงินแม่', score: 10 },
        { pattern: 'ขอตังแม่', score: 10 },
        { pattern: 'ขอตังค์แม่', score: 10 },
        { pattern: 'ขอตังจากแม่', score: 10 },
        { pattern: 'ขอเงินจากแม่', score: 10 },
        { pattern: 'ถูกหวย', score: 10 },
        { pattern: 'ฝากเงิน', score: 8 },
        { pattern: 'ค่าถ่ายรูป', score: 9 },
        { pattern: 'ค่าตัดต่อ', score: 9 },
        { pattern: 'ค่าทำเว็บ', score: 9 },
        { pattern: 'งานตัดต่อ', score: 8 },
        { pattern: 'งานเว็บ', score: 8 },
        { pattern: 'รับ', score: 6 },
        { pattern: 'รายได้', score: 6 },
        { pattern: 'เงินเดือน', score: 6 },
        { pattern: 'เงินดือน', score: 6 },
        { pattern: 'โบนัส', score: 6 },
        { pattern: 'คอมมิชชั่น', score: 6 },
        { pattern: 'ค่าคอม', score: 5 },
        { pattern: 'ฟรีแลนซ์', score: 5 },
        { pattern: 'freelance', score: 5 },
        { pattern: 'รับงาน', score: 5 },
        { pattern: 'งานนอก', score: 4 },
        { pattern: 'งานเสริม', score: 4 },
        { pattern: 'ขายของ', score: 4 },
        { pattern: 'ยอดขาย', score: 4 },
        { pattern: 'ขายสินค้า', score: 4 },
        { pattern: 'ดอกเบี้ย', score: 4 },
      ],
    },
    {
      name: 'activity',
      rules: [
        { pattern: 'ลูกค้าจ่ายค่า', score: 10 },
        { pattern: 'ลูกค้าโอนค่า', score: 10 },
        { pattern: 'ลคจ่ายค่า', score: 10 },
        { pattern: 'ลคโอนค่า', score: 10 },
        { pattern: 'รับจ้าง', score: 7 },
        { pattern: 'รับงาน', score: 7 },
        { pattern: 'ทำงานให้ลูกค้า', score: 7 },
        { pattern: 'ลูกค้าจ่าย', score: 8 },
        { pattern: 'ลูกค้าโอน', score: 8 },
        { pattern: 'ลคจ่าย', score: 8 },
        { pattern: 'ลคโอน', score: 8 },
        { pattern: 'ได้เงินจากลูกค้า', score: 9 },
        { pattern: 'รับตังจากลูกค้า', score: 9 },
        { pattern: 'โอนเข้าจากลูกค้า', score: 10 },
        ...createScoredRules(DEBT_REPAYMENT_PATTERNS, 8),
        { pattern: 'ขับ grab', score: 6 },
        { pattern: 'ขับแกร็บ', score: 6 },
        { pattern: 'ขับแท็กซี่', score: 6 },
        { pattern: 'ขับรถรับจ้าง', score: 6 },
        { pattern: 'ส่งอาหาร', score: 6 },
        { pattern: 'ติดตั้งเน็ต', score: 6 },
        { pattern: 'ติดตั้งอินเตอร์เน็ต', score: 6 },
        { pattern: 'ล้างแอร์', score: 6 },
        { pattern: 'รับซ่อม', score: 6 },
        { pattern: 'ซ่อมจักรยานให้ลูกค้า', score: 6 },
        { pattern: 'ซ่อมมอเตอร์ไซค์ให้ลูกค้า', score: 6 },
        { pattern: 'ขายของ', score: 6 },
        { pattern: 'ขายสินค้า', score: 6 },
        { pattern: 'ไลฟ์ขายของ', score: 6 },
        { pattern: 'สอนพิเศษ', score: 6 },
        { pattern: 'ทำเว็บ', score: 5 },
        { pattern: 'งานเว็บ', score: 5 },
        { pattern: 'เขียนโปรแกรม', score: 5 },
        { pattern: 'ออกแบบโลโก้', score: 5 },
        { pattern: 'ตัดต่อวิดีโอ', score: 5 },
        { pattern: 'ตัดต่อวีดีโอ', score: 5 },
        { pattern: 'งานตัดต่อ', score: 5 },
        { pattern: 'ค่าตัดต่อ', score: 5 },
        { pattern: 'ค่าทำเว็บ', score: 5 },
        { pattern: 'ค่าถ่ายรูป', score: 5 },
        { pattern: 'ถ่ายรูป', score: 5 },
      ],
    },
    {
      name: 'context',
      rules: [
        { pattern: 'รับเงิน', score: 6 },
        { pattern: 'ได้เงิน', score: 6 },
        { pattern: 'เงินเข้า', score: 6 },
        { pattern: 'มัดจำ', score: 4 },
      ],
    },
    {
      name: 'intent',
      rules: [
        { pattern: 'ลูกค้าจ่ายค่า', score: 18 },
        { pattern: 'ลูกค้าโอนค่า', score: 18 },
        { pattern: 'ลคจ่ายค่า', score: 18 },
        { pattern: 'ลคโอนค่า', score: 18 },
        { pattern: 'ลูกค้าจ่าย', score: 16 },
        { pattern: 'ลูกค้าโอน', score: 16 },
        { pattern: 'ลคจ่าย', score: 16 },
        { pattern: 'ลคโอน', score: 16 },
        { pattern: 'โอนเข้าจากลูกค้า', score: 16 },
        ...createScoredRules(DEBT_REPAYMENT_PATTERNS, 16),
        { pattern: 'ขาย', score: 12 },
        { pattern: 'ขายของ', score: 12 },
        { pattern: 'ขายผัก', score: 12 },
        { pattern: 'ขายอาหาร', score: 12 },
        { pattern: 'ขายสินค้า', score: 12 },
        { pattern: 'ขายออนไลน์', score: 12 },
        { pattern: 'ยอดขาย', score: 12 },
        { pattern: 'กำไร', score: 8 },
      ],
    },
  ],
  expense: [
    {
      name: 'signals',
      rules: [
        { pattern: 'จ่ายค่า', score: 8 },
        { pattern: 'เสียค่า', score: 12 },
        { pattern: 'เสียค่าแพลต', score: 14 },
        { pattern: 'เสียค่าplatform', score: 14 },
        { pattern: 'ค่าแพลตฟอร์ม', score: 10 },
        { pattern: 'ค่าplatform', score: 10 },
        { pattern: 'ค่าธรรมเนียมแพลตฟอร์ม', score: 14 },
        { pattern: 'platformfee', score: 12 },
        ...createScoredRules(GENERAL_WAGE_EXPENSE_PATTERNS, 8),
        ...createScoredRules(STAFF_EXPENSE_PATTERNS, 12),
        ...createScoredRules(OPERATING_EXPENSE_PATTERNS, 8),
        ...createScoredRules(REFUND_EXPENSE_PATTERNS, 12),
        ...createScoredRules(CREATOR_FEE_EXPENSE_PATTERNS, 12),
        { pattern: 'โอนจ่าย', score: 8 },
        { pattern: 'โอนเงินให้', score: 10 },
        { pattern: 'คืนเงินให้', score: 10 },
        ...createScoredRules(MONEY_REQUEST_PATTERNS, 12),
        { pattern: 'เพื่อนยืม', score: 12 },
        { pattern: 'ให้เพื่อนยืม', score: 12 },
        { pattern: 'ให้ยืม', score: 10 },
        { pattern: 'จ่าย', score: 7 },
        { pattern: 'ซื้อ', score: 7 },
        { pattern: 'ชำระ', score: 7 },
        { pattern: 'หัก', score: 6 },
        { pattern: 'เติมน้ำมัน', score: 6 },
        { pattern: 'เติมน้ามัน', score: 6 },
        { pattern: 'กินข้าว', score: 6 },
        { pattern: 'ค่าน้ำ', score: 5 },
        { pattern: 'บิลน้ำ', score: 5 },
        { pattern: 'ค่าไฟ', score: 5 },
        { pattern: 'บิลไฟ', score: 5 },
        { pattern: 'ค่าเน็ต', score: 5 },
        { pattern: 'ค่าเช่า', score: 5 },
        { pattern: 'ค่าห้อง', score: 5 },
        { pattern: 'ค่าหอ', score: 5 },
        { pattern: 'จ่ายตลาด', score: 5 },
        { pattern: 'ผัก', score: 3 },
        { pattern: 'ผลไม้', score: 3 },
        { pattern: 'อาหาร', score: 3 },
        { pattern: 'กาแฟ', score: 3 },
        { pattern: 'น้ำมัน', score: 3 },
        { pattern: 'ซ้อมดนตรี', score: 3 },
        { pattern: 'ห้องซ้อม', score: 3 },
      ],
    },
    {
      name: 'activity',
      rules: [
        { pattern: 'กิน', score: 5 },
        { pattern: 'ดื่ม', score: 5 },
        { pattern: 'หมูกะทะ', score: 5 },
        { pattern: 'หมูกระทะ', score: 5 },
        { pattern: 'ปิ้งย่าง', score: 5 },
        { pattern: 'ชาบู', score: 5 },
        { pattern: 'บุฟเฟต์', score: 5 },
        { pattern: 'ก๋วยเตี๋ยว', score: 4 },
        { pattern: 'ข้าว', score: 4 },
        { pattern: 'กาแฟ', score: 4 },
        { pattern: 'ชาไข่มุก', score: 4 },
        { pattern: 'เที่ยว', score: 4 },
        { pattern: 'ดูหนัง', score: 4 },
        { pattern: 'คอนเสิร์ต', score: 4 },
        { pattern: 'ฟิตเนส', score: 4 },
        { pattern: 'ว่ายน้ำ', score: 4 },
        { pattern: 'พบแพทย์', score: 5 },
        { pattern: 'หาหมอ', score: 5 },
        { pattern: 'ทำฟัน', score: 5 },
        { pattern: 'ค่าฟัน', score: 5 },
        { pattern: 'โรงพยาบาล', score: 5 },
        { pattern: 'ซื้อยา', score: 5 },
        { pattern: 'ค่าธรรมเนียม', score: 6 },
        { pattern: 'แพลตฟอร์ม', score: 4 },
        { pattern: 'สปา', score: 4 },
        { pattern: 'นวด', score: 4 },
        { pattern: 'ขัดผิว', score: 4 },
        { pattern: 'ตัดผม', score: 4 },
        { pattern: 'ทำเล็บ', score: 4 },
        { pattern: 'ล้างรถ', score: 4 },
        { pattern: 'ซ่อมรถ', score: 3 },
        { pattern: 'ซ่อมมือถือ', score: 3 },
        { pattern: 'เติมเกม', score: 4 },
        { pattern: 'จองโรงแรม', score: 4 },
        { pattern: 'เดินทาง', score: 3 },
      ],
    },
    {
      name: 'context',
      rules: [
        { pattern: 'ไปซ่อม', score: 5 },
        { pattern: 'เอารถไปซ่อม', score: 6 },
        { pattern: 'ค่าซ่อม', score: 6 },
        { pattern: 'จ่ายค่า', score: 6 },
        { pattern: 'เสียค่า', score: 10 },
        { pattern: 'เสียค่าแพลต', score: 14 },
        { pattern: 'เสียค่าplatform', score: 14 },
        { pattern: 'โดนหักค่า', score: 12 },
        { pattern: 'หักค่าแพลตฟอร์ม', score: 14 },
        { pattern: 'หักค่าplatform', score: 14 },
        { pattern: 'ไปหาลูกค้า', score: 8 },
        { pattern: 'เดินทางไปหาลูกค้า', score: 10 },
        { pattern: 'เดินทางพบลูกค้า', score: 8 },
        ...createScoredRules(STAFF_EXPENSE_CONTEXT_PATTERNS, 5),
        ...createScoredRules(OPERATING_EXPENSE_CONTEXT_PATTERNS, 4),
        ...createScoredRules(MONEY_REQUEST_PATTERNS, 8),
        { pattern: 'เพื่อนยืม', score: 8 },
        { pattern: 'ให้เพื่อนยืม', score: 8 },
        { pattern: 'ไปซื้อ', score: 5 },
        { pattern: 'ซื้อ', score: 5 },
        { pattern: 'ค่าอาหาร', score: 5 },
      ],
    },
    {
      name: 'intent',
      rules: [
        { pattern: 'ซื้อ', score: 12 },
        { pattern: 'ซื้อผัก', score: 12 },
        { pattern: 'ซื้อของ', score: 12 },
        { pattern: 'จ่าย', score: 12 },
        { pattern: 'จ่ายค่า', score: 12 },
        { pattern: 'เสียค่า', score: 18 },
        { pattern: 'เสียค่าแพลต', score: 20 },
        { pattern: 'เสียค่าplatform', score: 20 },
        { pattern: 'ค่าธรรมเนียมแพลตฟอร์ม', score: 18 },
        { pattern: 'ค่าแพลตฟอร์ม', score: 16 },
        { pattern: 'ค่าplatform', score: 16 },
        { pattern: 'โดนหักค่า', score: 18 },
        { pattern: 'platformfee', score: 16 },
        ...createScoredRules(STAFF_EXPENSE_PATTERNS, 16),
        ...createScoredRules(REFUND_EXPENSE_PATTERNS, 16),
        ...createScoredRules(CREATOR_FEE_EXPENSE_PATTERNS, 16),
        ...createScoredRules(MONEY_REQUEST_PATTERNS, 16),
        { pattern: 'เพื่อนยืม', score: 16 },
        { pattern: 'ให้เพื่อนยืม', score: 16 },
        { pattern: 'ให้ยืม', score: 14 },
        { pattern: 'กิน', score: 10 },
        { pattern: 'ทาน', score: 10 },
        { pattern: 'เติม', score: 8 },
        { pattern: 'ผ่อน', score: 8 },
        { pattern: 'เช่า', score: 8 },
      ],
    },
  ],
};

const CATEGORY_RULE_ENGINE: CategoryRule[] = [
  {
    name: 'transport-specific',
    keywords: ['ค่าน้ำมัน', 'ค่าน้ำมันรถ', 'ค่ารถไฟฟ้า', 'รถไฟฟ้า'],
    categoryHints: ['เดินทาง', 'น้ำมัน'],
  },
  {
    name: 'utility',
    keywords: ['ค่าไฟ', 'ค่าน้ำ', 'บิลไฟ', 'บิลน้ำ', 'ไฟฟ้า', 'ประปา'],
    categoryHints: ['ค่าน้ำ', 'ค่าไฟ', 'สาธารณูปโภค'],
  },
  {
    name: 'communication',
    keywords: ['เน็ต', 'อินเทอร์เน็ต', 'โทรศัพท์', 'โทรศัพย์', 'มือถือ', 'โทรศัพท์รายเดือน', 'เน็ตบ้าน'],
    categoryHints: ['โทรศัพท์', 'อินเทอร์เน็ต', 'สื่อสาร'],
  },
  {
    name: 'transport',
    keywords: ['แท็กซี่', 'รถ', 'รถไฟฟ้า', 'ค่ารถไฟฟ้า', 'น้ำมัน', 'ค่าน้ำมัน', 'ค่าน้ำมันรถ', 'เติมน้ามัน', 'bts', 'mrt', 'เดินทาง', 'ไปหาลูกค้า', 'วิน', 'ล้างรถ'],
    categoryHints: ['เดินทาง', 'น้ำมัน'],
  },
  {
    name: 'food',
    keywords: [
      'กิน', 'ดื่ม', 'หมูกะทะ', 'หมูกระทะ', 'ปิ้งย่าง', 'ชาบู', 'บุฟเฟต์',
      'ก๋วยเตี๋ยว', 'จ่ายตลาด', 'ตลาด', 'ผัก', 'ผลไม้', 'กับข้าว',
      'ของกิน', 'อาหาร', 'ข้าว', 'กาแฟ', 'ชา', 'ขนม', 'มื้อ',
      'supermarket',
    ],
    categoryHints: ['อาหาร', 'จ่ายตลาด', 'ของกิน'],
  },
  {
    name: 'holiday-travel',
    keywords: [
      'ทริป', 'trip', 'ทัวร์', 'ท่องเที่ยว', 'เที่ยวญี่ปุ่น', 'เที่ยวเกาหลี', 'เที่ยวต่างประเทศ',
      'พักผ่อน', 'วันหยุด', 'พักร้อน', 'จองตั๋วเครื่องบิน', 'ค่าตั๋วเครื่องบิน',
      'แพ็กเกจทัวร์', 'จองโรงแรมเที่ยว', 'ค่าที่พักเที่ยว',
    ],
    categoryHints: ['ท่องเที่ยววันหยุด', 'Trip', 'ทัวร์', 'วันหยุด'],
  },
  {
    name: 'entertainment',
    keywords: ['เที่ยว', 'เติมเกม', 'ห้องซ้อม', 'ซ้อมดนตรี', 'ดนตรี', 'คาราโอเกะ', 'คอนเสิร์ต', 'ดูหนัง', 'เกม', 'เพลง', 'บันเทิง'],
    categoryHints: ['บันเทิง', 'เพลง', 'งานอดิเรก'],
  },
  {
    name: 'housing',
    keywords: ['ค่าห้อง', 'ค่าหอ', 'ค่าเช่า', 'ห้องพัก', 'หอพัก', 'คอนโด', 'อพาร์ตเมนต์', 'บ้านเช่า', 'จองโรงแรม'],
    categoryHints: ['ค่าเช่า', 'ที่พัก', 'บ้าน', 'ห้อง'],
  },
  {
    name: 'health',
    keywords: ['ซื้อยา', 'ค่ายา', 'ซื้อวิตามิน', 'ฟิตเนส', 'ว่ายน้ำ', 'สปา', 'นวด', 'ขัดผิว', 'ทำฟัน', 'ค่าฟัน', 'พบแพทย์', 'ไปหาหมอ', 'หาหมอ', 'ตัดผม', 'ทำเล็บ', 'ยา', 'หมอ', 'โรงพยาบาล', 'สุขภาพ', 'ประกันชีวิต', 'ประกันสุขภาพ'],
    categoryHints: ['สุขภาพ/ยา', 'สุขภาพ', 'ยา', 'ความงาม', 'ประกัน'],
  },
  {
    name: 'education',
    keywords: ['เรียน', 'หนังสือ', 'คอร์ส', 'การศึกษา', 'สอนพิเศษ'],
    categoryHints: ['การศึกษา'],
  },
  {
    name: 'clothing',
    keywords: ['เสื้อ', 'กางเกง', 'รองเท้า', 'เสื้อผ้า'],
    categoryHints: ['เสื้อผ้า'],
  },
  {
    name: 'shopping',
    keywords: ['ซื้อ', 'ช้อป', 'shopping', 'ของใช้'],
    categoryHints: ['ช้อป', 'ของใช้'],
  },
  {
    name: 'salary',
    keywords: ['เงินเดือน', 'เงินดือน'],
    categoryHints: ['เงินเดือน'],
  },
  {
    name: 'commission',
    keywords: ['คอมมิชชั่น'],
    categoryHints: ['โบนัส', 'ค่าคอม', 'คอมมิชชั่น'],
  },
  {
    name: 'gift',
    keywords: ['ของขวัญ', 'แม่ให้เงิน', 'แม่โอนให้', 'เเม่โอนให้', 'พ่อให้เงิน', 'ขอเงินแม่', 'ขอตังแม่', 'ขอตังค์แม่', 'ขอตังจากแม่', 'ขอเงินจากแม่'],
    categoryHints: ['ของขวัญ', 'โบนัส'],
  },
  {
    name: 'deposit',
    keywords: ['มัดจำ'],
    categoryHints: ['มัดจำ'],
  },
  {
    name: 'freelance-income',
    keywords: [
      'ฟรีแลนซ์', 'freelance', 'รับงาน', 'งานนอก', 'งานเสริม', 'รายได้เสริม',
      'ค่าจ้าง', 'ค่าแรง', 'ค่าคอม', 'รับค่า', 'ตัดต่อ', 'วิดีโอ', 'วีดีโอ',
      'ทำเว็บ', 'เว็บไซต์', 'ออกแบบ', 'โลโก้', 'กราฟิก', 'ถ่ายรูป', 'ค่าถ่ายรูป', 'ค่าตัดต่อ', 'ค่าทำเว็บ', 'งานตัดต่อ', 'งานเว็บ',
      'เขียนบทความ', 'แอดมินเพจ', 'ลูกค้าจ่าย', 'ลูกค้าโอน', 'ลคจ่าย', 'ลคโอน', 'โอนเข้าจากลูกค้า', 'มัดจำงาน',
      'เงินจากลูกค้า', 'จากลูกค้า', 'ตังจากลูกค้า', 'รับตังจากลูกค้า', 'ติดตั้งเน็ต', 'ล้างแอร์', 'รับซ่อม', 'สอนพิเศษ',
      'ขับ grab', 'ขับแกร็บ', 'ขับแท็กซี่', 'ส่งอาหาร',
    ],
    categoryHints: ['รายได้พิเศษ', 'รายได้เสริม', 'ฟรีแลนซ์', 'ค่าจ้าง', 'บริการ', 'โปรเจกต์', 'โปรเจค'],
  },
  {
    name: 'sales-income',
    keywords: ['ขายของ', 'ยอดขาย', 'ขายสินค้า', 'ลูกค้าซื้อ', 'ขายได้', 'ไลฟ์ขายของ', 'ค่าสินค้า', 'ลูกค้าโอนค่าสินค้า', 'ลคโอนค่าสินค้า'],
    categoryHints: ['ยอดขาย', 'ขาย', 'รายได้เสริม', 'รายได้พิเศษ', 'ฟรีแลนซ์', 'ค่าสินค้า'],
  },
  {
    name: 'bonus',
    keywords: ['โบนัส', 'ของขวัญ'],
    categoryHints: ['ของขวัญ', 'โบนัส'],
  },
  {
    name: 'interest',
    keywords: ['ดอกเบี้ย'],
    categoryHints: ['ดอกเบี้ย'],
  },
  {
    name: 'work-tools',
    keywords: ['เมาส์', 'คีย์บอร์ด', 'อุปกรณ์ทำงาน', 'เครื่องมือทำงาน', 'ขาตั้งกล้อง', 'ไมค์'],
    categoryHints: ['เครื่องมือ', 'อุปกรณ์ทำงาน'],
  },
  {
    name: 'software',
    keywords: ['canva', 'adobe', 'subscription', 'ซอฟต์แวร์', 'โปรแกรมรายเดือน'],
    categoryHints: ['ซอฟต์แวร์', 'subscription'],
  },
  {
    name: 'withholding-tax',
    keywords: ['ภาษีหัก ณ ที่จ่าย', 'หัก ณ ที่จ่าย'],
    categoryHints: ['หัก ณ ที่จ่าย', 'ภาษี'],
  },
  {
    name: 'inventory',
    keywords: ['สต็อกสินค้า', 'ต้นทุน', 'ของมาขาย', 'ซื้อของเข้าร้านมาขาย'],
    categoryHints: ['ต้นทุน', 'สต็อกสินค้า'],
  },
  {
    name: 'shipping',
    keywords: ['ค่าส่งพัสดุ', 'ค่าส่งของ', 'ค่าส่งลูกค้า', 'ค่าส่งแฟลช', 'ค่าส่ง', 'ส่งพัสดุ'],
    categoryHints: ['ค่าส่งพัสดุ', 'ค่าส่ง'],
  },
  {
    name: 'staff-cost',
    keywords: [
      'ค่าจ้าง',
      'ค่าแรง',
      'ค่าจ้างแอดมิน',
      'ค่าจ้างผู้ดูแลระบบ',
      'ค่าจ้างแม่บ้าน',
      'ค่าจ้างพนักงาน',
      'ค่าจ้างพนักงานทั่วไป',
      'เงินเดือนพนักงาน',
      'ค่าแรงพนักงาน',
      'จ่ายพนักงาน',
      'แอดมิน',
      'ผู้ดูแลระบบ',
      'แม่บ้าน',
    ],
    categoryHints: [
      'ค่าแรงพนักงาน',
      'ค่าแรงพนักงานร้าน',
      'ค่าแรงเกษตร',
      'ค่าใช้จ่ายธุรกิจ',
      'ค่าใช้จ่ายการเกษตร',
      'ค่าตัดต่อ/ทีมงาน',
    ],
  },
  {
    name: 'packaging',
    keywords: ['กล่องแพ็กของ', 'กล่องแพ็คของ', 'ค่ากล่อง', 'บับเบิล', 'ค่าบับเบิล', 'เทปกาวแพ็กของ', 'ค่าเทปกาว', 'ถุงพัสดุ', 'ฉลากสินค้า', 'สติกเกอร์แปะกล่อง', 'แพ็กของ', 'ของแถมแพ็กของ'],
    categoryHints: ['แพ็กของ', 'แพ็คของ', 'กล่อง', 'ถุง', 'ฉลาก', 'สติกเกอร์', 'บับเบิล', 'เทป'],
  },
  {
    name: 'ads',
    keywords: ['ค่าโฆษณา', 'ยิงแอด', 'ยิงads', 'ค่าads', 'adsfacebook', 'ค่าโปรโมทโพสต์', 'โปรโมทร้าน'],
    categoryHints: ['โฆษณา', 'แอด', 'โปรโมท'],
  },
  {
    name: 'platform-fee',
    keywords: [
      'เสียค่าแพลต',
      'เสียค่าplatform',
      'ค่าแพลตฟอร์ม',
      'ค่าplatform',
      'ค่าธรรมเนียมแพลตฟอร์ม',
      'โดนหักค่าแพลตฟอร์ม',
      'โดนหักค่าplatform',
      'platformfee',
      'ค่าคอมแพลตฟอร์ม',
      'ค่าคอม platform',
      'ค่าไลฟ์สด',
      'ค่าธรรมเนียมไลฟ์สด',
    ],
    categoryHints: ['ค่าใช้จ่ายธุรกิจ'],
  },
  {
    name: 'business-expense',
    keywords: [
      'ค่าใช้จ่ายธุรกิจ',
      'ค่าใช้จ่ายในธุรกิจ',
      'ค่าธรรมเนียม',
      'ค่าอุปกรณ์ไอที',
      'อุปกรณ์ไอที',
      'ค่าเครื่องจักร',
      'ค่าซ่อมเครื่องจักร',
      'ค่าแพลตฟอร์ม',
      'ค่าplatform',
      'platformfee',
      'คืนเงินลูกค้า',
      'คืนเงินให้ลูกค้า',
    ],
    categoryHints: ['ค่าใช้จ่ายธุรกิจ'],
  },
  {
    name: 'operating-cost',
    keywords: ['ต้นทุน', 'ค่าวัตถุดิบ', 'วัตถุดิบการผลิต'],
    categoryHints: [
      'ต้นทุนสินค้า',
      'ค่าวัตถุดิบธุรกิจ',
      'วัตถุดิบร้านอาหาร',
    ],
  },
  {
    name: 'agriculture-expense',
    keywords: [
      'ค่าใช้จ่ายการเกษตร',
      'ค่าใช้จ่ายสวน',
      'ค่าใช้จ่ายฟาร์ม',
      'ค่าอุปกรณ์เกษตร',
      'ค่าซ่อมเครื่องจักร',
      'ค่าเครื่องจักร',
    ],
    categoryHints: ['ค่าใช้จ่ายการเกษตร'],
  },
  {
    name: 'office-food',
    keywords: ['อาหารกลางวัน', 'ข้าวเที่ยง', 'ก่อนเข้าออฟฟิศ', 'อาหารประชุม'],
    categoryHints: ['อาหารกลางวัน'],
  },
  {
    name: 'office-transport',
    keywords: ['เดินทางทำงาน', 'ไปทำงาน', 'ไปออฟฟิศ', 'ไปประชุม', 'เดินทางไปประชุม', 'รถไฟฟ้าไปทำงาน'],
    categoryHints: ['เดินทางทำงาน', 'เดินทาง'],
  },
  {
    name: 'insurance',
    keywords: ['ประกันสุขภาพ', 'ประกันชีวิต', 'ประกัน'],
    categoryHints: ['ประกัน', 'สุขภาพ'],
  },
  {
    name: 'tax-deduction',
    keywords: ['rmf', 'ssf', 'easy e receipt', 'easy e-receipt', 'บริจาคลดหย่อนภาษี', 'ลดหย่อนภาษี'],
    categoryHints: ['กองทุน', 'ลดหย่อนภาษี', 'ภาษี'],
  },
  {
    name: 'charity',
    keywords: ['ทำบุญ', 'การกุศล', 'บริจาค', 'ถวาย', 'ตักบาตร', 'ทอดกฐิน', 'ทอดผ้าป่า'],
    categoryHints: ['ทำบุญ', 'การกุศล', 'บริจาค'],
  },
  {
    name: 'private-business-income',
    keywords: ['ธุรกิจส่วนตัว', 'เงินจากธุรกิจ', 'รายได้ธุรกิจ', 'กำไรธุรกิจ'],
    categoryHints: ['ธุรกิจส่วนตัว'],
  },
  {
    name: 'restaurant-income',
    keywords: ['ขายอาหาร', 'ยอดขายร้านอาหาร', 'ลูกค้าร้านอาหาร', 'เงินเข้าร้านอาหาร'],
    categoryHints: ['ร้านอาหาร'],
  },
  {
    name: 'market-sales-income',
    keywords: ['ขายของตลาด', 'ขายของในตลาด', 'ขายตลาด', 'ขายผักตลาด', 'ขายผลไม้ตลาด'],
    categoryHints: ['ขายของในตลาด', 'ตลาด'],
  },
  {
    name: 'online-seller-income',
    keywords: ['แม่ค้าออนไลน์', 'ขายออนไลน์', 'ออเดอร์', 'ยอดขายออนไลน์', 'ไลฟ์สดขายของ'],
    categoryHints: ['แม่ค้าออนไลน์', 'ออนไลน์'],
  },
  {
    name: 'artist-income',
    keywords: [
      'ศิลปิน',
      'งานศิลปะ',
      'ขายรูป',
      'รับวาดรูป',
      'คอมมิชชั่นวาดรูป',
      'รับงานเล่นดนตรี',
      'เล่นดนตรีงานแต่ง',
      'เล่นดนตรีได้เงิน',
      'รับงานร้องเพลง',
      'ร้องเพลงงาน',
      'นักดนตรี',
    ],
    categoryHints: ['ศิลปิน'],
  },
  {
    name: 'farmer-income',
    keywords: ['เกษตรกร', 'ขายผัก', 'ขายผลไม้', 'ขายข้าว', 'ขายพืชผล', 'ขายยาง', 'ขายผลผลิต'],
    categoryHints: ['เกษตรกร'],
  },
  {
    name: 'athlete-income',
    keywords: ['นักกีฬา', 'แข่งกีฬา', 'รางวัลกีฬา', 'สปอนเซอร์กีฬา', 'ค่าสอนกีฬา'],
    categoryHints: ['นักกีฬา'],
  },
  {
    name: 'gamer-income',
    keywords: ['gamer', 'สตรีมเกม', 'แคสเกม', 'โดเนทสตรีม', 'สตรีมเมอร์'],
    categoryHints: ['Gamer', 'เกม'],
  },
  {
    name: 'it-income',
    keywords: ['พนักงานไอที', 'งานไอที', 'โปรแกรมเมอร์', 'developer', 'it support', 'system admin'],
    categoryHints: ['พนักงานไอที', 'ไอที'],
  },
];

const INTENT_CATEGORY_RULES: IntentCategoryRule[] = [
  {
    name: 'platform-fee-expense',
    type: 'expense',
    triggers: [
      'เสียค่าแพลต',
      'เสียค่าplatform',
      'ค่าแพลตฟอร์ม',
      'ค่าplatform',
      'ค่าธรรมเนียมแพลตฟอร์ม',
      'โดนหักค่าแพลตฟอร์ม',
      'โดนหักค่าplatform',
      'platformfee',
      'ค่าคอมแพลตฟอร์ม',
      'ค่าคอม platform',
      'ค่าไลฟ์สด',
      'ค่าธรรมเนียมไลฟ์สด',
    ],
    preferredHints: ['ค่าใช้จ่ายธุรกิจ'],
    fallbackHints: ['ค่าโฆษณา', 'ค่าโฆษณา/ยิงแอด', 'โฆษณา', 'แอด', 'อื่นๆ'],
  },
  {
    name: 'employee-payroll-expense',
    type: 'expense',
    triggers: [
      'ค่าจ้างพนักงาน',
      'ค่าจ้างพนักงานทั่วไป',
      'เงินเดือนพนักงาน',
      'ค่าแรงพนักงาน',
      'จ่ายพนักงาน',
    ],
    preferredHints: ['ค่าแรงพนักงาน', 'ค่าแรงพนักงานร้าน'],
    fallbackHints: ['ค่าใช้จ่ายธุรกิจ', 'อื่นๆ'],
  },
  {
    name: 'farm-labor-expense',
    type: 'expense',
    triggers: ['ค่าจ้างคนงานสวน', 'ค่าแรงคนงานสวน', 'คนงานสวน', 'ค่าแรงเกษตร'],
    preferredHints: ['ค่าแรงเกษตร'],
    fallbackHints: ['ค่าใช้จ่ายการเกษตร', 'อื่นๆ'],
  },
  {
    name: 'staff-expense',
    type: 'expense',
    triggers: [
      'ค่าจ้าง',
      'ค่าแรง',
      'ค่าจ้างแอดมิน',
      'ค่าจ้างผู้ดูแลระบบ',
      'ค่าจ้างแม่บ้าน',
      'ค่าจ้างรถขนของ',
      'แอดมิน',
      'ผู้ดูแลระบบ',
      'แม่บ้าน',
    ],
    preferredHints: [
      'ค่าใช้จ่ายธุรกิจ',
      'ค่าใช้จ่ายการเกษตร',
      'ค่าตัดต่อ/ทีมงาน',
    ],
    fallbackHints: ['อื่นๆ'],
  },
  {
    name: 'operating-cost-expense',
    type: 'expense',
    triggers: ['ต้นทุน', 'ค่าวัตถุดิบ', 'วัตถุดิบการผลิต'],
    preferredHints: [
      'ต้นทุนสินค้า',
      'ค่าวัตถุดิบธุรกิจ',
      'วัตถุดิบร้านอาหาร',
    ],
    fallbackHints: ['อื่นๆ'],
  },
  {
    name: 'business-expense',
    type: 'expense',
    triggers: [
      'ค่าใช้จ่ายธุรกิจ',
      'ค่าใช้จ่ายในธุรกิจ',
      'ค่าธรรมเนียม',
      'ค่าอุปกรณ์ไอที',
      'อุปกรณ์ไอที',
      'ค่าเครื่องจักร',
      'ค่าซ่อมเครื่องจักร',
      'คืนเงินลูกค้า',
      'คืนเงินให้ลูกค้า',
    ],
    preferredHints: ['ค่าใช้จ่ายธุรกิจ'],
    fallbackHints: ['ค่าวัตถุดิบธุรกิจ', 'ค่าโฆษณา', 'ค่าโฆษณา/ยิงแอด', 'อื่นๆ'],
  },
  {
    name: 'agriculture-expense',
    type: 'expense',
    triggers: [
      'ค่าใช้จ่ายการเกษตร',
      'ค่าใช้จ่ายสวน',
      'ค่าใช้จ่ายฟาร์ม',
      'ค่าอุปกรณ์เกษตร',
      'ค่าเครื่องจักร',
      'ค่าซ่อมเครื่องจักร',
    ],
    preferredHints: ['ค่าใช้จ่ายการเกษตร'],
    fallbackHints: ['ค่าแรงเกษตร', 'ปุ๋ย/ยาเกษตร', 'ค่าน้ำมันเครื่องจักร', 'อื่นๆ'],
  },
  {
    name: 'customer-refund-expense',
    type: 'expense',
    triggers: ['คืนเงินลูกค้า', 'คืนเงินให้ลูกค้า'],
    preferredHints: ['ค่าใช้จ่ายธุรกิจ'],
    fallbackHints: ['ต้นทุนสินค้า', 'อื่นๆ'],
  },
  {
    name: 'creator-fee-expense',
    type: 'expense',
    triggers: ['ค่าคอมมิชชั่นcreator', 'คอมมิชชั่นcreator'],
    preferredHints: ['ค่าใช้จ่ายธุรกิจ'],
    fallbackHints: ['ค่าตัดต่อ/ทีมงาน', 'ค่าโปรโมทช่อง', 'ค่าโฆษณา', 'ค่าโฆษณา/ยิงแอด', 'อื่นๆ'],
  },
  {
    name: 'creator-fee-expense-spaced',
    type: 'expense',
    triggers: ['ค่าคอมมิชชั่น creator', 'คอมมิชชั่น creator'],
    preferredHints: ['ค่าใช้จ่ายธุรกิจ'],
    fallbackHints: ['ค่าตัดต่อ/ทีมงาน', 'ค่าโปรโมทช่อง', 'ค่าโฆษณา', 'ค่าโฆษณา/ยิงแอด', 'อื่นๆ'],
  },
  {
    name: 'sales-commission',
    type: 'income',
    triggers: ['ค่าคอม'],
    preferredHints: ['รายได้เสริม', 'ฟรีแลนซ์', 'โปรเจกต์', 'โปรเจค'],
    fallbackHints: ['คอมมิชชั่น', 'โบนัส', 'ค่าคอม'],
  },
  {
    name: 'commission',
    type: 'income',
    triggers: ['คอมมิชชั่น'],
    preferredHints: ['คอมมิชชั่น', 'โบนัส', 'ค่าคอม'],
    fallbackHints: ['รายได้เสริม', 'ฟรีแลนซ์', 'โปรเจกต์', 'โปรเจค'],
  },
  {
    name: 'deposit',
    type: 'income',
    triggers: ['มัดจำ'],
    preferredHints: ['มัดจำงาน', 'มัดจำ'],
    fallbackHints: ['รายได้เสริม', 'ฟรีแลนซ์', 'โปรเจกต์', 'โปรเจค'],
  },
  {
    name: 'customer-deposit',
    type: 'income',
    triggers: ['ลูกค้าจ่ายมัดจำ', 'ลูกค้าโอนมัดจำ', 'มัดจำงาน'],
    preferredHints: ['มัดจำงาน', 'มัดจำ'],
    fallbackHints: ['รายได้โปรเจกต์', 'โปรเจกต์', 'โปรเจค'],
  },
  {
    name: 'customer-income',
    type: 'income',
    triggers: ['ลูกค้าโอน', 'ลูกค้าจ่าย', 'โอนเข้าจากลูกค้า', 'เงินจากลูกค้า', 'รับตังจากลูกค้า', 'ตังจากลูกค้า', 'จากลูกค้า'],
    preferredHints: ['โปรเจกต์', 'โปรเจค', 'รายได้เสริม', 'ฟรีแลนซ์', 'ยอดขาย', 'ขาย'],
  },
  {
    name: 'farm-produce-sales',
    type: 'income',
    triggers: ['ขายผัก', 'ขายผลไม้', 'ขายของสวน'],
    preferredHints: ['เกษตรกร/ขายผัก/ผลไม้'],
    fallbackHints: ['เกษตรกร/ขายผลผลิต', 'ขายของในตลาด'],
  },
  {
    name: 'farm-harvest-sales',
    type: 'income',
    triggers: ['ขายข้าว', 'ขายพืชผล', 'ขายผลผลิต', 'ขายไข่'],
    preferredHints: ['เกษตรกร/ขายผลผลิต'],
    fallbackHints: ['เกษตรกร/ขายผัก/ผลไม้', 'ขายของในตลาด'],
  },
  {
    name: 'market-sales',
    type: 'income',
    triggers: ['ขายของตลาด', 'ขายของในตลาด', 'ขายตลาด', 'ยอดขายตลาด'],
    preferredHints: ['ขายของในตลาด', 'เกษตรกร'],
    fallbackHints: ['ธุรกิจส่วนตัว'],
  },
  {
    name: 'online-sales',
    type: 'income',
    triggers: ['ขายออนไลน์', 'แม่ค้าออนไลน์', 'ออเดอร์', 'ไลฟ์สดขายของ', 'ลูกค้าสั่งของ'],
    preferredHints: ['แม่ค้าออนไลน์', 'ธุรกิจส่วนตัว'],
    fallbackHints: ['ขายของในตลาด'],
  },
  {
    name: 'restaurant-sales',
    type: 'income',
    triggers: ['ขายอาหาร', 'ขายข้าวกล่อง', 'ขายก๋วยเตี๋ยว', 'ขายเครื่องดื่ม', 'ขายกาแฟ'],
    preferredHints: ['ร้านอาหาร', 'ธุรกิจส่วนตัว'],
    fallbackHints: ['ขายของในตลาด'],
  },
  {
    name: 'music-gig',
    type: 'income',
    triggers: ['รับงานเล่นดนตรี', 'เล่นดนตรีงานแต่ง', 'รับงานร้องเพลง', 'ร้องเพลงงาน', 'นักดนตรี'],
    preferredHints: ['ศิลปิน'],
    fallbackHints: ['รายได้เสริม', 'ฟรีแลนซ์'],
  },
  {
    name: 'it-job',
    type: 'income',
    triggers: ['งานไอที', 'พนักงานไอที', 'โปรแกรมเมอร์', 'developer', 'it support'],
    preferredHints: ['พนักงานไอที'],
    fallbackHints: ['เงินเดือน', 'รายได้เสริม'],
  },
  {
    name: 'sales',
    type: 'income',
    triggers: ['ขาย', 'ยอดขาย', 'กำไร'],
    preferredHints: ['ธุรกิจส่วนตัว', 'ขายของในตลาด', 'แม่ค้าออนไลน์', 'เกษตรกร', 'ร้านอาหาร', 'ยอดขาย', 'ขาย'],
    fallbackHints: ['รายได้เสริม', 'รายได้พิเศษ', 'ฟรีแลนซ์', 'ค่าสินค้า'],
  },
];

function normalize(input: string) {
  return input
    .normalize('NFC')
    .trim()
    .replace(/เเ/g, 'แ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function compact(input: string) {
  return normalize(input).replace(/[\s\p{P}\p{S}]+/gu, '');
}

const THAI_DIGIT_WORD_VALUES: Record<string, number> = {
  ศูนย์: 0,
  หนึ่ง: 1,
  เอ็ด: 1,
  ยี่: 2,
  สอง: 2,
  สาม: 3,
  สี่: 4,
  ห้า: 5,
  หก: 6,
  เจ็ด: 7,
  แปด: 8,
  เก้า: 9,
};

const THAI_DIGIT_CHAR_VALUES: Record<string, string> = {
  '๐': '0',
  '๑': '1',
  '๒': '2',
  '๓': '3',
  '๔': '4',
  '๕': '5',
  '๖': '6',
  '๗': '7',
  '๘': '8',
  '๙': '9',
};

const THAI_NUMBER_WORD_PATTERN =
  'ศูนย์|หนึ่ง|เอ็ด|ยี่|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า';
const THAI_SCALE_WORD_PATTERN = 'ล้าน|แสน|หมื่น|พัน|ร้อย|สิบ';
const THAI_NUMBER_TOKEN_PATTERN =
  `(?:\\d+(?:\\.\\d+)?|[๐-๙]+|${THAI_NUMBER_WORD_PATTERN})`;
const THAI_SCALED_AMOUNT_REGEX = new RegExp(
  `((?:(?:${THAI_NUMBER_TOKEN_PATTERN})?\\s*(?:${THAI_SCALE_WORD_PATTERN})\\s*)+(?:(?:${THAI_NUMBER_TOKEN_PATTERN})\\s*)?(?:บาท|฿)?)`,
  'g'
);

function convertThaiDigitsToArabic(input: string) {
  return input.replace(/[๐-๙]/g, (digit) => THAI_DIGIT_CHAR_VALUES[digit] ?? digit);
}

function cleanAmountCandidate(input: string) {
  return convertThaiDigitsToArabic(input)
    .replace(/บาทถ้วน|บาท|฿|,/g, '')
    .replace(/\s+/g, '');
}

function parseThaiNumberToken(token: string): number | null {
  const cleaned = cleanAmountCandidate(token);
  if (!cleaned) return null;

  if (/^\d+(?:\.\d+)?$/.test(cleaned)) {
    const value = Number(cleaned);
    return Number.isFinite(value) ? value : null;
  }

  return THAI_DIGIT_WORD_VALUES[cleaned] ?? null;
}

function parseThaiSubMillionAmount(segment: string): number | null {
  if (!segment) return 0;

  let working = cleanAmountCandidate(segment);
  if (!working) return 0;

  const units = [
    { word: 'แสน', value: 100000 },
    { word: 'หมื่น', value: 10000 },
    { word: 'พัน', value: 1000 },
    { word: 'ร้อย', value: 100 },
    { word: 'สิบ', value: 10 },
  ] as const;

  let total = 0;

  for (const unit of units) {
    const index = working.indexOf(unit.word);
    if (index === -1) continue;

    const prefix = working.slice(0, index);
    if (!prefix) {
      if (unit.word !== 'สิบ') return null;
      total += unit.value;
    } else {
      const multiplier = parseThaiNumberToken(prefix);
      if (multiplier === null) return null;
      total += multiplier * unit.value;
    }

    working = working.slice(index + unit.word.length);
  }

  if (!working) return total;

  const remainder = parseThaiNumberToken(working);
  if (remainder === null) return null;

  return total + remainder;
}

function parseThaiScaledAmount(input: string): number | null {
  const cleaned = cleanAmountCandidate(input);
  if (!cleaned) return null;

  if (/^\d+(?:\.\d+)?$/.test(cleaned)) {
    const value = Number(cleaned);
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  const millionParts = cleaned.split('ล้าน');
  let total = 0;

  for (let index = 0; index < millionParts.length; index += 1) {
    const part = millionParts[index];
    const isLast = index === millionParts.length - 1;

    if (isLast) {
      const value = part ? parseThaiSubMillionAmount(part) : 0;
      if (value === null) return null;
      total += value;
      break;
    }

    const value = part ? parseThaiSubMillionAmount(part) : 1;
    if (value === null) return null;
    total = (total + value) * 1000000;
  }

  return total > 0 ? total : null;
}

function isLikelyScaledAmountCandidate(candidate: string) {
  return /บาท|฿/.test(candidate)
    || /\d|[๐-๙]/.test(candidate)
    || /ร้อย|พัน|หมื่น|แสน|ล้าน/.test(candidate);
}

function extractScaledAmount(input: string) {
  let bestMatch: { amount: number; amountText: string; score: number } | null = null;

  for (const match of input.matchAll(THAI_SCALED_AMOUNT_REGEX)) {
    const amountText = match[0].trim();
    if (!amountText || !isLikelyScaledAmountCandidate(amountText)) continue;

    const amount = parseThaiScaledAmount(amountText);
    if (!amount || !Number.isFinite(amount) || amount <= 0) continue;

    const score = amountText.length;
    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { amount, amountText, score };
    }
  }

  return bestMatch
    ? {
        amount: bestMatch.amount,
        amountText: bestMatch.amountText,
      }
    : null;
}

function extractAmount(input: string) {
  const scaledAmount = extractScaledAmount(input);
  if (scaledAmount) return scaledAmount;

  const match = input.match(/(?:฿|บาท)?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?\s*(?:บาท|฿)?/);
  if (!match) return null;

  const raw = `${match[1].replace(/,/g, '')}${match[2] ? `.${match[2]}` : ''}`;
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  return {
    amount,
    amountText: match[0],
  };
}

function hasPattern(text: string, pattern: string) {
  return text.includes(compact(pattern));
}

function matchRule(text: string, rule: ScoreRule) {
  return hasPattern(text, rule.pattern);
}

function scoreRuleGroup(text: string, group: RuleGroup): TypeScoreSummary {
  const matchedRules = group.rules.filter((rule) => matchRule(text, rule));
  return {
    total: matchedRules.reduce((sum, rule) => sum + rule.score, 0),
    matchedRules,
  };
}

function scoreType(text: string, type: TransactionType): TypeScoreSummary {
  return TYPE_RULE_ENGINE[type].reduce<TypeScoreSummary>(
    (summary, group) => {
      const groupSummary = scoreRuleGroup(text, group);
      return {
        total: summary.total + groupSummary.total,
        matchedRules: [...summary.matchedRules, ...groupSummary.matchedRules],
      };
    },
    { total: 0, matchedRules: [] }
  );
}

function mergeTypeScoreSummaries(...summaries: TypeScoreSummary[]): TypeScoreSummary {
  return summaries.reduce<TypeScoreSummary>(
    (merged, summary) => ({
      total: merged.total + summary.total,
      matchedRules: [...merged.matchedRules, ...summary.matchedRules],
    }),
    { total: 0, matchedRules: [] }
  );
}

function scoreStarterProfileType(
  text: string,
  type: TransactionType,
  starterProfile?: QuickAddStarterProfile | null
): TypeScoreSummary {
  if (!starterProfile) {
    return { total: 0, matchedRules: [] };
  }

  const matchedRules = starterProfile.keywordMappings
    .filter((mapping) => mapping.type === type)
    .map((mapping) => {
      const triggerScore = scorePatternMatches(text, [mapping.keyword]).score;
      if (!triggerScore) return null;

      return {
        pattern: mapping.keyword,
        score: triggerScore + (mapping.scoreBoost ?? 0),
      };
    })
    .filter(Boolean) as ScoreRule[];

  return {
    total: matchedRules.reduce((sum, rule) => sum + rule.score, 0),
    matchedRules,
  };
}

function inferType(
  incomeScore: TypeScoreSummary,
  expenseScore: TypeScoreSummary,
  preferredType?: TransactionType
): TransactionType {
  if (incomeScore.total > expenseScore.total) return 'income';
  if (expenseScore.total > incomeScore.total) return 'expense';

  return preferredType ?? 'expense';
}

function inferConfidence(params: {
  learnedRule: QuickAddLearningRuleInput | null;
  starterProfileMatched: boolean;
  category: Category | null;
  amountResult: ReturnType<typeof extractAmount> | null;
  incomeScore: TypeScoreSummary;
  expenseScore: TypeScoreSummary;
}): QuickAddResult['confidence'] {
  const { learnedRule, starterProfileMatched, category, amountResult, incomeScore, expenseScore } = params;

  if (learnedRule) return 'high';
  if (starterProfileMatched && category && amountResult) return 'high';

  const winningScore = Math.max(incomeScore.total, expenseScore.total);
  const losingScore = Math.min(incomeScore.total, expenseScore.total);
  const scoreGap = winningScore - losingScore;

  if (category && amountResult && winningScore >= 16 && scoreGap >= 8) {
    return 'high';
  }

  if ((category && amountResult) || winningScore >= 8) {
    return 'medium';
  }

  return category ? 'medium' : 'low';
}

function scorePatternMatches(text: string, patterns: string[]) {
  const matchedPatterns = patterns
    .map((pattern) => compact(pattern))
    .filter((pattern, index, allPatterns) => pattern.length >= 2 && text.includes(pattern) && allPatterns.indexOf(pattern) === index)
    .sort((a, b) => b.length - a.length);

  if (!matchedPatterns.length) {
    return {
      score: 0,
      matchedPatterns: [] as string[],
    };
  }

  const longestPattern = matchedPatterns[0];
  return {
    score: longestPattern.length * 8 + matchedPatterns.length * 6,
    matchedPatterns,
  };
}

function getHintMatchScore(categoryName: string, hint: string) {
  const normalizedName = compact(categoryName);
  const normalizedHint = compact(hint);

  if (!normalizedName || !normalizedHint) return 0;
  if (normalizedName === normalizedHint) return 160 + normalizedHint.length * 4;
  if (normalizedName.startsWith(normalizedHint) || normalizedHint.startsWith(normalizedName)) {
    return 130 + Math.min(normalizedName.length, normalizedHint.length) * 3;
  }
  if (normalizedName.includes(normalizedHint)) return 100 + normalizedHint.length * 2;
  if (normalizedHint.includes(normalizedName)) return 80 + normalizedName.length * 2;
  return 0;
}

function findBestCategoryByHints(categories: Category[], hints: string[]): CategoryHintMatch | null {
  let bestMatch: CategoryHintMatch | null = null;

  for (const category of categories) {
    for (const hint of hints) {
      const score = getHintMatchScore(category.name, hint);
      if (!score) continue;

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = {
          category,
          score,
        };
      }
    }
  }

  return bestMatch;
}

function pickBestCategory(candidates: CategoryCandidate[]) {
  if (!candidates.length) return null;

  const scoredCategories = new Map<string, CategoryCandidate>();

  for (const candidate of candidates) {
    const current = scoredCategories.get(candidate.category.id);
    if (current) {
      current.score += candidate.score;
      continue;
    }

    scoredCategories.set(candidate.category.id, { ...candidate });
  }

  return [...scoredCategories.values()]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.category.name.length - a.category.name.length;
    })[0]?.category ?? null;
}

function findIntentCategory(text: string, categories: Category[], type: TransactionType) {
  const candidates: CategoryCandidate[] = [];

  for (const rule of INTENT_CATEGORY_RULES) {
    if (rule.type !== type) continue;

    const triggerScore = scorePatternMatches(text, rule.triggers);
    if (!triggerScore.score) continue;

    const preferredCategory = findBestCategoryByHints(categories, rule.preferredHints);
    if (preferredCategory) {
      candidates.push({
        category: preferredCategory.category,
        score: triggerScore.score + preferredCategory.score + 60,
      });
      continue;
    }

    if (rule.fallbackHints) {
      const fallbackCategory = findBestCategoryByHints(categories, rule.fallbackHints);
      if (fallbackCategory) {
        candidates.push({
          category: fallbackCategory.category,
          score: triggerScore.score + fallbackCategory.score + 15,
        });
      }
    }
  }

  return pickBestCategory(candidates);
}

function findStarterProfileCategory(
  text: string,
  categories: Category[],
  type: TransactionType,
  starterProfile?: QuickAddStarterProfile | null
) {
  if (!starterProfile) return null;

  const candidates: CategoryCandidate[] = [];
  const preferredHints = type === 'income'
    ? starterProfile.preferredIncomeCategories
    : starterProfile.preferredExpenseCategories;

  for (const mapping of starterProfile.keywordMappings) {
    if (mapping.type !== type) continue;

    const triggerScore = scorePatternMatches(text, [mapping.keyword]);
    if (!triggerScore.score) continue;

    const directCategory = findBestCategoryByHints(categories, [mapping.categoryHint]);
    const matchedCategory = directCategory
      ?? findBestCategoryByHints(categories, preferredHints);
    if (!matchedCategory) continue;

    candidates.push({
      category: matchedCategory.category,
      score: triggerScore.score
        + matchedCategory.score
        + (mapping.scoreBoost ?? 0)
        + (directCategory ? 80 : 30),
    });
  }

  return pickBestCategory(candidates);
}

function findCategory(
  text: string,
  categories: Category[],
  type: TransactionType,
  starterProfile?: QuickAddStarterProfile | null
) {
  const starterProfileCategory = findStarterProfileCategory(text, categories, type, starterProfile);
  if (starterProfileCategory) return starterProfileCategory;

  const intentCategory = findIntentCategory(text, categories, type);
  if (intentCategory) return intentCategory;

  const candidates: CategoryCandidate[] = [];

  for (const rule of CATEGORY_RULE_ENGINE) {
    const keywordScore = scorePatternMatches(text, rule.keywords);
    if (!keywordScore.score) continue;

    const matchedCategory = findBestCategoryByHints(categories, rule.categoryHints);
    if (!matchedCategory) continue;

    candidates.push({
      category: matchedCategory.category,
      score: keywordScore.score + matchedCategory.score,
    });
  }

  const bestCategory = pickBestCategory(candidates);
  if (bestCategory) return bestCategory;

  return categories.find((category) => compact(category.name).includes('อื่น')) ?? null;
}

function findLearningRule(text: string, rules: QuickAddLearningRuleInput[] = []) {
  const matches = rules
    .map((rule) => {
      const keyword = rule.normalizedKeyword ? compact(rule.normalizedKeyword) : compact(rule.keyword);
      return { rule, keyword };
    })
    .filter(({ keyword }) => keyword.length >= 2 && text.includes(keyword))
    .sort((a, b) => {
      const confidenceDiff = (b.rule.confidence ?? 1) - (a.rule.confidence ?? 1);
      if (confidenceDiff !== 0) return confidenceDiff;
      return b.keyword.length - a.keyword.length;
    });

  return matches[0]?.rule ?? null;
}

export const quickAddParser = {
  parse(input: string, categories: Category[], options: ParseOptions = {}): QuickAddResult | null {
    const normalizedText = normalize(input);
    const compactText = compact(input);
    if (!compactText) return null;

    const amountResult = extractAmount(normalizedText);
    const learnedRule = findLearningRule(compactText, options.learningRules);
    const incomeScore = mergeTypeScoreSummaries(
      scoreType(compactText, 'income'),
      scoreStarterProfileType(compactText, 'income', options.starterProfile)
    );
    const expenseScore = mergeTypeScoreSummaries(
      scoreType(compactText, 'expense'),
      scoreStarterProfileType(compactText, 'expense', options.starterProfile)
    );
    const type = learnedRule?.type
      ?? inferType(incomeScore, expenseScore, options.preferredType);
    const availableCategories = categories.filter((category) => category.type === type);
    const learnedCategory = learnedRule?.categoryId
      ? availableCategories.find((category) => category.id === learnedRule.categoryId) ?? null
      : null;
    const starterProfileCategory = learnedCategory
      ? null
      : findStarterProfileCategory(compactText, availableCategories, type, options.starterProfile);
    const category = learnedCategory
      ?? starterProfileCategory
      ?? findCategory(compactText, availableCategories, type, options.starterProfile);
    const note = amountResult
      ? normalizedText.replace(amountResult.amountText.trim().toLowerCase(), '').trim() || input.trim()
      : input.trim();

    return {
      amount: amountResult?.amount ?? null,
      type,
      category,
      note,
      confidence: inferConfidence({
        learnedRule,
        starterProfileMatched: Boolean(starterProfileCategory),
        category,
        amountResult,
        incomeScore,
        expenseScore,
      }),
    };
  },
};
