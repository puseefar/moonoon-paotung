import type { Category } from '@/db/schema';
import { appSettingsService } from '@/services/appSettingsService';
import { categoryService } from '@/services/categoryService';
import type { QuickAddStarterKeywordMapping, QuickAddStarterProfile } from '@/services/quickAddParser';

export type StarterTemplateCategory = {
  name: string;
  icon: string;
  color: string;
  type: 'income' | 'expense';
};

export type StarterTemplateGroup =
  | 'general'
  | 'commerce'
  | 'freelance'
  | 'agriculture'
  | 'family';

export type StarterTemplate = {
  id: string;
  name: string;
  description: string;
  icon: string;
  group: StarterTemplateGroup;
  targetUser: string;
  popularity: number;
  helperTags: string[];
  sampleEntries: string[];
  categories: StarterTemplateCategory[];
};

export type ApplyStarterTemplateResult = {
  created: number;
  skipped: number;
};

export type ActiveStarterTemplateProfile = QuickAddStarterProfile;

export type GuidedTemplateQuestionId = 'incomeSource' | 'workStyle' | 'frequentExpense';

export type GuidedTemplateAnswerMap = Partial<Record<GuidedTemplateQuestionId, string>>;

export type GuidedTemplateQuestionOption = {
  id: string;
  label: string;
  description: string;
  weights: Partial<Record<string, number>>;
};

export type GuidedTemplateQuestion = {
  id: GuidedTemplateQuestionId;
  title: string;
  helper: string;
  options: GuidedTemplateQuestionOption[];
};

export type StarterTemplateRecommendation = {
  template: StarterTemplate;
  secondaryTemplate: StarterTemplate | null;
  score: number;
  secondaryScore: number;
  reasons: string[];
};

const ACTIVE_QUICK_ADD_PROFILE_KEY = 'quick_add_active_profile_v1';

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: 'student',
    name: 'นักศึกษา',
    description: 'ค่าอาหาร เดินทาง หอพัก หนังสือ และเงินสนับสนุนจากครอบครัว',
    icon: '🎓',
    group: 'general',
    targetUser: 'เหมาะสำหรับนักเรียน นักศึกษา และคนที่มีค่าใช้จ่ายการเรียนรายวัน',
    popularity: 96,
    helperTags: ['อาหาร', 'เดินทาง', 'หอพัก', 'หนังสือ', 'เงินสนับสนุน'],
    sampleEntries: ['ค่าหอ 3,500', 'แม่โอนค่าขนม 1,500', 'ซื้อหนังสือเรียน 490'],
    categories: [
      { name: 'อาหารในมหาวิทยาลัย', icon: '🍱', color: '#FF8A65', type: 'expense' },
      { name: 'เดินทางไปเรียน', icon: '🚌', color: '#4FC3F7', type: 'expense' },
      { name: 'หอพัก/ค่าเช่า', icon: '🏠', color: '#BA68C8', type: 'expense' },
      { name: 'หนังสือ/อุปกรณ์เรียน', icon: '📚', color: '#7986CB', type: 'expense' },
      { name: 'เงินสนับสนุนจากครอบครัว', icon: '💝', color: '#66BB6A', type: 'income' },
      { name: 'งานพิเศษ/พาร์ตไทม์', icon: '💼', color: '#9CCC65', type: 'income' },
    ],
  },
  {
    id: 'salary',
    name: 'พนักงานเงินเดือน',
    description: 'เงินเดือน โบนัส ค่าเดินทางทำงาน และค่าใช้จ่ายประจำ',
    icon: '💼',
    group: 'general',
    targetUser: 'เหมาะสำหรับคนทำงานประจำทั่วไป',
    popularity: 100,
    helperTags: ['เงินเดือน', 'โบนัส', 'อาหารกลางวัน', 'เดินทาง', 'ประกัน'],
    sampleEntries: ['เงินเดือน 28,000', 'ค่าเดินทางทำงาน 120', 'โบนัสประจำปี 15,000'],
    categories: [
      { name: 'อาหารกลางวัน', icon: '🍛', color: '#FF8A65', type: 'expense' },
      { name: 'เดินทางทำงาน', icon: '🚆', color: '#29B6F6', type: 'expense' },
      { name: 'ประกัน/สุขภาพ', icon: '🏥', color: '#66BB6A', type: 'expense' },
      { name: 'กองทุน/ลดหย่อนภาษี', icon: '🧾', color: '#9575CD', type: 'expense' },
      { name: 'เงินเดือนประจำ', icon: '💰', color: '#4CAF50', type: 'income' },
      { name: 'โบนัส/ค่าคอมมิชชัน', icon: '🎁', color: '#FFCA28', type: 'income' },
    ],
  },
  {
    id: 'family',
    name: 'ครอบครัว',
    description: 'ค่าอาหารบ้าน ค่าน้ำไฟ ของใช้ในบ้าน และค่าใช้จ่ายของลูก',
    icon: '🏡',
    group: 'family',
    targetUser: 'เหมาะสำหรับผู้ดูแลค่าใช้จ่ายภายในบ้านและครอบครัว',
    popularity: 88,
    helperTags: ['ค่าอาหารบ้าน', 'ค่าน้ำไฟ', 'ของใช้บ้าน', 'ค่าลูก', 'เงินช่วยครอบครัว'],
    sampleEntries: ['ค่ากับข้าว 850', 'ค่าไฟบ้าน 1,420', 'ค่าเทอมลูก 8,500'],
    categories: [
      { name: 'ค่าอาหารในบ้าน', icon: '🍲', color: '#FF8A65', type: 'expense' },
      { name: 'ค่าน้ำ/ค่าไฟ/อินเทอร์เน็ต', icon: '💡', color: '#FFA726', type: 'expense' },
      { name: 'ของใช้ในบ้าน', icon: '🧴', color: '#4DB6AC', type: 'expense' },
      { name: 'ค่าลูก/การศึกษา', icon: '🧒', color: '#7986CB', type: 'expense' },
      { name: 'เงินเดือนครอบครัว', icon: '💵', color: '#4CAF50', type: 'income' },
      { name: 'เงินช่วยเหลือครอบครัว', icon: '🤝', color: '#81C784', type: 'income' },
    ],
  },
  {
    id: 'online-seller',
    name: 'แม่ค้าออนไลน์',
    description: 'ยอดขายออนไลน์ ค่าส่ง แพ็กของ ยิงแอด และต้นทุนสินค้า',
    icon: '🛍️',
    group: 'commerce',
    targetUser: 'เหมาะสำหรับร้านค้าออนไลน์ ไลฟ์สด และขายผ่านโซเชียล',
    popularity: 98,
    helperTags: ['ยอดขายออนไลน์', 'ออเดอร์', 'ค่าส่ง', 'แพ็กของ', 'ยิงแอด'],
    sampleEntries: ['ลูกค้าโอนค่าสินค้า 590', 'ค่าส่งพัสดุ 45', 'ยิงแอด 300'],
    categories: [
      { name: 'ต้นทุนสินค้า', icon: '📦', color: '#EC407A', type: 'expense' },
      { name: 'ค่ากล่อง/แพ็กของ', icon: '🎁', color: '#8D6E63', type: 'expense' },
      { name: 'ค่าจัดส่งพัสดุ', icon: '🚚', color: '#29B6F6', type: 'expense' },
      { name: 'ค่าโฆษณา/ยิงแอด', icon: '📣', color: '#FF9800', type: 'expense' },
      { name: 'ค่าใช้จ่ายธุรกิจ', icon: '🧾', color: '#7E57C2', type: 'expense' },
      { name: 'ยอดขายออนไลน์', icon: '💸', color: '#4CAF50', type: 'income' },
      { name: 'ค่าส่งที่ลูกค้าจ่าย', icon: '📮', color: '#81C784', type: 'income' },
    ],
  },
  {
    id: 'market-seller',
    name: 'ขายของในตลาด',
    description: 'ขายผัก ผลไม้ ของเข้าร้าน ค่าแผง และค่าขนส่งสินค้า',
    icon: '🧺',
    group: 'commerce',
    targetUser: 'เหมาะสำหรับพ่อค้าแม่ค้าแผง ตลาดนัด และร้านขายของเล็ก',
    popularity: 94,
    helperTags: ['ขายผัก', 'ขายผลไม้', 'ของเข้าร้าน', 'ค่าแผง', 'ขนส่งสินค้า'],
    sampleEntries: ['ขายผัก 1,800', 'ค่าเช่าแผง 250', 'ซื้อของเข้าร้าน 1,200'],
    categories: [
      { name: 'ซื้อของเข้าร้าน', icon: '🛒', color: '#EC407A', type: 'expense' },
      { name: 'ค่าเช่าแผง/ตลาด', icon: '🏪', color: '#BA68C8', type: 'expense' },
      { name: 'ค่าถุง/บรรจุภัณฑ์', icon: '🧃', color: '#4DB6AC', type: 'expense' },
      { name: 'ค่าขนส่งสินค้า', icon: '🚛', color: '#42A5F5', type: 'expense' },
      { name: 'ขายของในตลาด', icon: '💵', color: '#4CAF50', type: 'income' },
      { name: 'ขายผัก/ผลไม้', icon: '🥬', color: '#81C784', type: 'income' },
    ],
  },
  {
    id: 'business-owner',
    name: 'ธุรกิจส่วนตัว',
    description: 'รายได้จากธุรกิจ วัตถุดิบ ค่าแรง ค่าเช่า และภาษีธุรกิจ',
    icon: '🏢',
    group: 'commerce',
    targetUser: 'เหมาะสำหรับเจ้าของกิจการที่มีรายรับรายจ่ายธุรกิจชัดเจน',
    popularity: 90,
    helperTags: ['รายได้ธุรกิจ', 'วัตถุดิบ', 'ค่าแรงพนักงาน', 'ค่าเช่าร้าน', 'ภาษีธุรกิจ'],
    sampleEntries: ['รายได้จากธุรกิจ 12,500', 'จ่ายพนักงาน 4,000', 'ค่าเช่าร้าน 6,500'],
    categories: [
      { name: 'ค่าวัตถุดิบธุรกิจ', icon: '🧰', color: '#EC407A', type: 'expense' },
      { name: 'ค่าแรงพนักงาน', icon: '👥', color: '#26A69A', type: 'expense' },
      { name: 'ค่าเช่าร้าน/สำนักงาน', icon: '🏬', color: '#AB47BC', type: 'expense' },
      { name: 'ค่าน้ำ/ค่าไฟธุรกิจ', icon: '⚡', color: '#FFA726', type: 'expense' },
      { name: 'ภาษีธุรกิจ', icon: '🧾', color: '#EF5350', type: 'expense' },
      { name: 'ค่าใช้จ่ายธุรกิจ', icon: '🧾', color: '#7E57C2', type: 'expense' },
      { name: 'รายได้จากธุรกิจ', icon: '💼', color: '#4CAF50', type: 'income' },
    ],
  },
  {
    id: 'restaurant',
    name: 'ร้านอาหาร/คาเฟ่',
    description: 'ขายอาหาร เครื่องดื่ม เดลิเวอรี วัตถุดิบ และค่าแอปส่งอาหาร',
    icon: '☕',
    group: 'commerce',
    targetUser: 'เหมาะสำหรับร้านอาหาร เครื่องดื่ม และเดลิเวอรี',
    popularity: 92,
    helperTags: ['ขายอาหาร', 'เครื่องดื่ม', 'วัตถุดิบ', 'เดลิเวอรี', 'ค่าแก๊ส'],
    sampleEntries: ['ขายกาแฟ 95', 'ซื้อวัตถุดิบ 1,450', 'ค่าแอปเดลิเวอรี 380'],
    categories: [
      { name: 'วัตถุดิบร้านอาหาร', icon: '🥘', color: '#EC407A', type: 'expense' },
      { name: 'แก๊ส/น้ำแข็ง/บรรจุภัณฑ์', icon: '🧊', color: '#4FC3F7', type: 'expense' },
      { name: 'ค่าแอปเดลิเวอรี', icon: '🛵', color: '#FF9800', type: 'expense' },
      { name: 'ค่าแรงพนักงานร้าน', icon: '👨‍🍳', color: '#26A69A', type: 'expense' },
      { name: 'ขายอาหาร/เครื่องดื่ม', icon: '🍜', color: '#4CAF50', type: 'income' },
      { name: 'รับจัดเลี้ยง/เดลิเวอรี', icon: '🍱', color: '#81C784', type: 'income' },
    ],
  },
  {
    id: 'freelance',
    name: 'ฟรีแลนซ์',
    description: 'รายได้โปรเจกต์ มัดจำงาน เครื่องมือ ซอฟต์แวร์ และภาษีหัก ณ ที่จ่าย',
    icon: '🧑‍💻',
    group: 'freelance',
    targetUser: 'เหมาะสำหรับคนรับงานอิสระ งานออกแบบ ตัดต่อ เขียนโปรแกรม และคอนเทนต์',
    popularity: 97,
    helperTags: ['รายได้โปรเจกต์', 'มัดจำงาน', 'เครื่องมือ', 'ซอฟต์แวร์', 'ภาษีหัก ณ ที่จ่าย'],
    sampleEntries: ['รับงานตัดต่อ 2,500', 'ลูกค้าจ่ายมัดจำ 3,000', 'ซื้อไมค์ 1,200'],
    categories: [
      { name: 'ค่าเครื่องมือทำงาน', icon: '🧰', color: '#78909C', type: 'expense' },
      { name: 'ซอฟต์แวร์/Subscription', icon: '💻', color: '#5C6BC0', type: 'expense' },
      { name: 'เดินทางพบลูกค้า', icon: '🚕', color: '#29B6F6', type: 'expense' },
      { name: 'ภาษีหัก ณ ที่จ่าย', icon: '🧾', color: '#EF5350', type: 'expense' },
      { name: 'รายได้โปรเจกต์', icon: '💼', color: '#4CAF50', type: 'income' },
      { name: 'มัดจำงาน', icon: '🤝', color: '#8BC34A', type: 'income' },
    ],
  },
  {
    id: 'creator',
    name: 'Creator/ศิลปิน',
    description: 'งานแสดง เล่นดนตรี โดเนท สปอนเซอร์ และค่าอุปกรณ์ครีเอเตอร์',
    icon: '🎤',
    group: 'freelance',
    targetUser: 'เหมาะสำหรับศิลปิน นักดนตรี นักร้อง และ content creator',
    popularity: 86,
    helperTags: ['งานแสดง', 'เล่นดนตรี', 'โดเนท', 'สปอนเซอร์', 'ค่าทีมงาน'],
    sampleEntries: ['รับงานเล่นดนตรี 3,500', 'โดเนท 420', 'ค่าตัดต่อคลิป 800'],
    categories: [
      { name: 'ค่าอุปกรณ์ครีเอเตอร์', icon: '🎬', color: '#5C6BC0', type: 'expense' },
      { name: 'ค่าเดินทางงานแสดง', icon: '🚗', color: '#29B6F6', type: 'expense' },
      { name: 'ค่าตัดต่อ/ทีมงาน', icon: '🎞️', color: '#8D6E63', type: 'expense' },
      { name: 'ค่าโปรโมตช่อง', icon: '📣', color: '#FF9800', type: 'expense' },
      { name: 'ศิลปิน/งานแสดง', icon: '🎭', color: '#4CAF50', type: 'income' },
      { name: 'โดเนท/สปอนเซอร์', icon: '💖', color: '#81C784', type: 'income' },
    ],
  },
  {
    id: 'gamer',
    name: 'Gamer/Streamer',
    description: 'สตรีมเกม โดเนท สปอนเซอร์ และค่าอุปกรณ์เกมมิ่ง',
    icon: '🎮',
    group: 'freelance',
    targetUser: 'เหมาะสำหรับสายเกม ไลฟ์สตรีม และรายได้จากแพลตฟอร์ม',
    popularity: 80,
    helperTags: ['สตรีมเกม', 'โดเนท', 'อุปกรณ์คอม', 'อินเทอร์เน็ต', 'สปอนเซอร์'],
    sampleEntries: ['รายได้สตรีม 1,900', 'โดเนท 250', 'ซื้อเกม 799'],
    categories: [
      { name: 'อุปกรณ์คอม/เกมมิ่ง', icon: '🖥️', color: '#5C6BC0', type: 'expense' },
      { name: 'เกม/Subscription', icon: '🕹️', color: '#9575CD', type: 'expense' },
      { name: 'ค่าอินเทอร์เน็ตสตรีม', icon: '📶', color: '#29B6F6', type: 'expense' },
      { name: 'ค่ากราฟิก/ตัดต่อ', icon: '🎨', color: '#FF9800', type: 'expense' },
      { name: 'Gamer/รายได้สตรีม', icon: '🎮', color: '#4CAF50', type: 'income' },
      { name: 'โดเนท/สปอนเซอร์เกม', icon: '🏆', color: '#81C784', type: 'income' },
    ],
  },
  {
    id: 'farmer',
    name: 'เกษตรกร',
    description: 'ขายผลผลิต ปุ๋ย ยาเกษตร ค่าแรง และค่าน้ำมันเครื่องจักร',
    icon: '🌾',
    group: 'agriculture',
    targetUser: 'เหมาะสำหรับผู้ใช้ที่มีรายรับจากผลผลิตทางการเกษตรและตามฤดูกาล',
    popularity: 93,
    helperTags: ['ขายผัก', 'ขายข้าว', 'ปุ๋ย', 'ยาเกษตร', 'ค่าน้ำมันเครื่องจักร'],
    sampleEntries: ['ขายผัก 1,800', 'ซื้อปุ๋ย 780', 'ค่าน้ำมันรถไถ 450'],
    categories: [
      { name: 'เมล็ดพันธุ์/ต้นกล้า', icon: '🌱', color: '#66BB6A', type: 'expense' },
      { name: 'ปุ๋ย/ยาเกษตร', icon: '🧪', color: '#FFA726', type: 'expense' },
      { name: 'ค่าแรงเกษตร', icon: '👨‍🌾', color: '#26A69A', type: 'expense' },
      { name: 'ค่าน้ำมันเครื่องจักร', icon: '⛽', color: '#42A5F5', type: 'expense' },
      { name: 'ค่าใช้จ่ายการเกษตร', icon: '🚜', color: '#8BC34A', type: 'expense' },
      { name: 'เกษตรกร/ขายผลผลิต', icon: '💵', color: '#4CAF50', type: 'income' },
      { name: 'เกษตรกร/ขายผัก/ผลไม้', icon: '🥬', color: '#81C784', type: 'income' },
    ],
  },
  {
    id: 'rider',
    name: 'ไรเดอร์/ขนส่ง',
    description: 'วิ่งงาน ค่าส่งอาหาร ค่าน้ำมัน ซ่อมรถ และค่าโทรศัพท์',
    icon: '🛵',
    group: 'agriculture',
    targetUser: 'เหมาะสำหรับคนส่งอาหาร ส่งพัสดุ และคนขับรถรับจ้าง',
    popularity: 84,
    helperTags: ['วิ่งงาน', 'ค่าส่งอาหาร', 'ค่าน้ำมัน', 'ซ่อมรถ', 'ค่าโทรศัพท์'],
    sampleEntries: ['วิ่งงาน 780', 'เติมน้ำมัน 180', 'ค่าเน็ตมือถือ 250'],
    categories: [
      { name: 'ค่าน้ำมัน', icon: '⛽', color: '#42A5F5', type: 'expense' },
      { name: 'ค่าซ่อมรถ', icon: '🔧', color: '#8D6E63', type: 'expense' },
      { name: 'ค่าโทรศัพท์/อินเทอร์เน็ต', icon: '📱', color: '#26C6DA', type: 'expense' },
      { name: 'ค่าผ่อนรถ', icon: '🧾', color: '#9575CD', type: 'expense' },
      { name: 'วิ่งงาน/ค่าส่ง', icon: '🛵', color: '#4CAF50', type: 'income' },
      { name: 'ค่าโดยสาร/ส่งพัสดุ', icon: '📦', color: '#81C784', type: 'income' },
    ],
  },
];

const GUIDED_TEMPLATE_QUESTIONS: GuidedTemplateQuestion[] = [
  {
    id: 'incomeSource',
    title: 'รายได้หลักของคุณมาจากอะไร',
    helper: 'เลือกสิ่งที่ใกล้กับชีวิตจริงมากที่สุด',
    options: [
      {
        id: 'salary',
        label: 'เงินเดือนประจำ',
        description: 'ทำงานประจำ รับเงินเดือน โบนัส หรือ OT',
        weights: { salary: 5, family: 2 },
      },
      {
        id: 'online-sales',
        label: 'ขายของออนไลน์',
        description: 'มีออเดอร์ ลูกค้าโอน ค่าส่ง และยิงแอด',
        weights: { 'online-seller': 5, 'business-owner': 2, 'market-seller': 1 },
      },
      {
        id: 'shop-sales',
        label: 'ขายของหน้าร้าน/ตลาด',
        description: 'ขายผัก ผลไม้ ของชำ หรือมีหน้าร้านจริง',
        weights: { 'market-seller': 5, restaurant: 3, 'business-owner': 2, farmer: 1 },
      },
      {
        id: 'project-income',
        label: 'รับงานเป็นโปรเจกต์',
        description: 'ฟรีแลนซ์ งานออกแบบ ตัดต่อ เขียนโปรแกรม',
        weights: { freelance: 5, creator: 2, 'business-owner': 1 },
      },
      {
        id: 'creator-income',
        label: 'ทำคอนเทนต์/งานแสดง',
        description: 'เล่นดนตรี สตรีม ทำช่อง หรือรับสปอนเซอร์',
        weights: { creator: 5, gamer: 4, freelance: 1 },
      },
      {
        id: 'farm-income',
        label: 'ขายผลผลิต/งานเกษตร',
        description: 'ขายผัก ขายข้าว ขายผลผลิตตามฤดูกาล',
        weights: { farmer: 5, 'market-seller': 2 },
      },
      {
        id: 'ride-income',
        label: 'วิ่งงาน/ส่งของ/รับส่ง',
        description: 'รับงานส่งอาหาร ส่งพัสดุ หรือขับรถรับงาน',
        weights: { rider: 5 },
      },
      {
        id: 'support-income',
        label: 'เงินสนับสนุน/ค่าใช้จ่ายครอบครัว',
        description: 'ยังเรียนอยู่ หรือดูแลค่าใช้จ่ายในบ้านเป็นหลัก',
        weights: { student: 4, family: 4 },
      },
    ],
  },
  {
    id: 'workStyle',
    title: 'ลักษณะงานหรือกิจกรรมของคุณใกล้แบบไหน',
    helper: 'คำตอบข้อนี้จะช่วยให้ระบบรู้โลกของคุณมากขึ้น',
    options: [
      {
        id: 'study',
        label: 'เรียน/อยู่หอ/ใช้ชีวิตมหาวิทยาลัย',
        description: 'มีค่าหอ ค่าหนังสือ และค่าใช้จ่ายในมหาวิทยาลัย',
        weights: { student: 5 },
      },
      {
        id: 'office',
        label: 'ทำงานประจำในบริษัท',
        description: 'มีเวลาเข้างาน อาหารกลางวัน และค่าเดินทางทำงาน',
        weights: { salary: 5, family: 1 },
      },
      {
        id: 'home-manager',
        label: 'ดูแลค่าใช้จ่ายในบ้าน',
        description: 'เน้นค่าน้ำไฟ ของใช้ในบ้าน และรายจ่ายของครอบครัว',
        weights: { family: 5, salary: 1 },
      },
      {
        id: 'commerce',
        label: 'ขายของหรือดูแลร้าน',
        description: 'มีของเข้าร้าน ต้นทุนสินค้า ค่าแผง หรือเดลิเวอรี',
        weights: { 'online-seller': 3, 'market-seller': 4, 'business-owner': 3, restaurant: 3 },
      },
      {
        id: 'project',
        label: 'รับงานเป็นลูกค้า/โปรเจกต์',
        description: 'มีมัดจำงาน ค่าจ้าง และเครื่องมือทำงาน',
        weights: { freelance: 5, creator: 2 },
      },
      {
        id: 'performance',
        label: 'ทำคอนเทนต์ เล่นดนตรี หรือสตรีม',
        description: 'มีโดเนท สปอนเซอร์ งานแสดง หรือค่าอุปกรณ์ครีเอเตอร์',
        weights: { creator: 5, gamer: 4, freelance: 1 },
      },
      {
        id: 'field',
        label: 'ทำงานภาคสนาม/เกษตร',
        description: 'มีปุ๋ย ยาเกษตร ค่าแรง หรือเครื่องจักร',
        weights: { farmer: 5 },
      },
      {
        id: 'delivery',
        label: 'ขับรถ วิ่งงาน หรือส่งของ',
        description: 'มีค่าน้ำมัน ค่าซ่อมรถ และค่าโทรศัพท์',
        weights: { rider: 5 },
      },
    ],
  },
  {
    id: 'frequentExpense',
    title: 'รายจ่ายที่เกิดบ่อยที่สุดคืออะไร',
    helper: 'ข้อนี้จะช่วยให้ระบบแนะนำหมวดเริ่มต้นได้แม่นขึ้น',
    options: [
      {
        id: 'daily-life',
        label: 'อาหาร เดินทาง หอพัก หรือค่าเรียน',
        description: 'รายจ่ายแนวชีวิตประจำวันและการเรียน',
        weights: { student: 5, salary: 2 },
      },
      {
        id: 'home-family',
        label: 'ค่าน้ำไฟ ของใช้บ้าน หรือค่าลูก',
        description: 'รายจ่ายแนวบ้านและครอบครัว',
        weights: { family: 5 },
      },
      {
        id: 'online-selling',
        label: 'ต้นทุนสินค้า ค่าส่ง หรือยิงแอด',
        description: 'รายจ่ายแนวร้านค้าออนไลน์',
        weights: { 'online-seller': 5, 'business-owner': 2 },
      },
      {
        id: 'storefront',
        label: 'ของเข้าร้าน ค่าแผง หรือวัตถุดิบร้าน',
        description: 'รายจ่ายแนวหน้าร้าน ตลาด และร้านอาหาร',
        weights: { 'market-seller': 4, restaurant: 4, 'business-owner': 3 },
      },
      {
        id: 'tools-software',
        label: 'เครื่องมือ ซอฟต์แวร์ หรือภาษีหัก ณ ที่จ่าย',
        description: 'รายจ่ายแนวฟรีแลนซ์และงานโปรเจกต์',
        weights: { freelance: 5, creator: 2, gamer: 1 },
      },
      {
        id: 'creator-tools',
        label: 'อุปกรณ์ครีเอเตอร์ ค่าโปรโมต หรือค่าตัดต่อ',
        description: 'รายจ่ายแนวทำช่อง งานแสดง และสตรีม',
        weights: { creator: 5, gamer: 4 },
      },
      {
        id: 'agriculture-cost',
        label: 'ปุ๋ย ค่าแรง หรือค่าน้ำมันเครื่องจักร',
        description: 'รายจ่ายแนวเกษตรและผลผลิต',
        weights: { farmer: 5 },
      },
      {
        id: 'vehicle-phone',
        label: 'ค่าน้ำมัน ซ่อมรถ หรือค่าโทรศัพท์',
        description: 'รายจ่ายแนวไรเดอร์และขนส่ง',
        weights: { rider: 5, salary: 1 },
      },
    ],
  },
];

const TEMPLATE_KEYWORD_MAPPING_SEEDS: Record<string, QuickAddStarterKeywordMapping[]> = {
  student: [
    { keyword: 'แม่โอน', type: 'income', categoryHint: 'เงินสนับสนุนจากครอบครัว', scoreBoost: 48 },
    { keyword: 'พ่อโอน', type: 'income', categoryHint: 'เงินสนับสนุนจากครอบครัว', scoreBoost: 48 },
    { keyword: 'ค่าขนม', type: 'income', categoryHint: 'เงินสนับสนุนจากครอบครัว', scoreBoost: 38 },
    { keyword: 'พาร์ตไทม์', type: 'income', categoryHint: 'งานพิเศษ/พาร์ตไทม์', scoreBoost: 36 },
    { keyword: 'ค่าหอ', type: 'expense', categoryHint: 'หอพัก/ค่าเช่า', scoreBoost: 42 },
    { keyword: 'หนังสือเรียน', type: 'expense', categoryHint: 'หนังสือ/อุปกรณ์เรียน', scoreBoost: 42 },
  ],
  salary: [
    { keyword: 'เงินเดือน', type: 'income', categoryHint: 'เงินเดือนประจำ', scoreBoost: 40 },
    { keyword: 'โบนัส', type: 'income', categoryHint: 'โบนัส/ค่าคอมมิชชัน', scoreBoost: 38 },
    { keyword: 'ค่าเดินทางทำงาน', type: 'expense', categoryHint: 'เดินทางทำงาน', scoreBoost: 36 },
    { keyword: 'อาหารกลางวัน', type: 'expense', categoryHint: 'อาหารกลางวัน', scoreBoost: 34 },
  ],
  family: [
    { keyword: 'ค่ากับข้าว', type: 'expense', categoryHint: 'ค่าอาหารในบ้าน', scoreBoost: 36 },
    { keyword: 'ค่าไฟบ้าน', type: 'expense', categoryHint: 'ค่าน้ำ/ค่าไฟ/อินเทอร์เน็ต', scoreBoost: 36 },
    { keyword: 'ของใช้ในบ้าน', type: 'expense', categoryHint: 'ของใช้ในบ้าน', scoreBoost: 34 },
    { keyword: 'ค่าเทอมลูก', type: 'expense', categoryHint: 'ค่าลูก/การศึกษา', scoreBoost: 38 },
  ],
  'online-seller': [
    { keyword: 'ลูกค้าโอน', type: 'income', categoryHint: 'ยอดขายออนไลน์', scoreBoost: 54 },
    { keyword: 'ลูกค้าจ่าย', type: 'income', categoryHint: 'ยอดขายออนไลน์', scoreBoost: 54 },
    { keyword: 'ออเดอร์', type: 'income', categoryHint: 'ยอดขายออนไลน์', scoreBoost: 46 },
    { keyword: 'ค่าส่งพัสดุ', type: 'expense', categoryHint: 'ค่าจัดส่งพัสดุ', scoreBoost: 40 },
    { keyword: 'ค่าส่ง', type: 'expense', categoryHint: 'ค่าจัดส่งพัสดุ', scoreBoost: 36 },
    { keyword: 'แพ็กของ', type: 'expense', categoryHint: 'ค่ากล่อง/แพ็กของ', scoreBoost: 38 },
    { keyword: 'ต้นทุน', type: 'expense', categoryHint: 'ต้นทุนสินค้า', scoreBoost: 40 },
    { keyword: 'ยิงแอด', type: 'expense', categoryHint: 'ค่าโฆษณา/ยิงแอด', scoreBoost: 42 },
    { keyword: 'ค่าใช้จ่ายธุรกิจ', type: 'expense', categoryHint: 'ค่าใช้จ่ายธุรกิจ', scoreBoost: 50 },
    { keyword: 'ค่าใช้จ่ายในธุรกิจ', type: 'expense', categoryHint: 'ค่าใช้จ่ายธุรกิจ', scoreBoost: 50 },
    { keyword: 'เสียค่าแพลต', type: 'expense', categoryHint: 'ค่าใช้จ่ายธุรกิจ', scoreBoost: 46 },
    { keyword: 'เสียค่า platform', type: 'expense', categoryHint: 'ค่าใช้จ่ายธุรกิจ', scoreBoost: 46 },
    { keyword: 'ค่าแพลตฟอร์ม', type: 'expense', categoryHint: 'ค่าใช้จ่ายธุรกิจ', scoreBoost: 42 },
    { keyword: 'ค่า platform', type: 'expense', categoryHint: 'ค่าใช้จ่ายธุรกิจ', scoreBoost: 42 },
    { keyword: 'ค่าธรรมเนียมแพลตฟอร์ม', type: 'expense', categoryHint: 'ค่าใช้จ่ายธุรกิจ', scoreBoost: 46 },
    { keyword: 'ค่าธรรมเนียม', type: 'expense', categoryHint: 'ค่าใช้จ่ายธุรกิจ', scoreBoost: 42 },
    { keyword: 'คืนเงินลูกค้า', type: 'expense', categoryHint: 'ค่าใช้จ่ายธุรกิจ', scoreBoost: 42 },
    { keyword: 'คืนเงินให้ลูกค้า', type: 'expense', categoryHint: 'ค่าใช้จ่ายธุรกิจ', scoreBoost: 42 },
    { keyword: 'ค่าจ้างแอดมิน', type: 'expense', categoryHint: 'ค่าใช้จ่ายธุรกิจ', scoreBoost: 40 },
    { keyword: 'เงินเดือนพนักงาน', type: 'expense', categoryHint: 'ค่าใช้จ่ายธุรกิจ', scoreBoost: 40 },
    { keyword: 'ค่าจ้างพนักงาน', type: 'expense', categoryHint: 'ค่าใช้จ่ายธุรกิจ', scoreBoost: 40 },
    { keyword: 'ค่าจ้างผู้ดูแลระบบ', type: 'expense', categoryHint: 'ค่าใช้จ่ายธุรกิจ', scoreBoost: 40 },
    { keyword: 'ค่าอุปกรณ์ไอที', type: 'expense', categoryHint: 'ค่าใช้จ่ายธุรกิจ', scoreBoost: 40 },
    { keyword: 'ค่าเครื่องจักร', type: 'expense', categoryHint: 'ค่าใช้จ่ายธุรกิจ', scoreBoost: 38 },
  ],
  'market-seller': [
    { keyword: 'ขายผัก', type: 'income', categoryHint: 'ขายผัก/ผลไม้', scoreBoost: 48 },
    { keyword: 'ขายผลไม้', type: 'income', categoryHint: 'ขายผัก/ผลไม้', scoreBoost: 48 },
    { keyword: 'ของเข้าร้าน', type: 'expense', categoryHint: 'ซื้อของเข้าร้าน', scoreBoost: 42 },
    { keyword: 'ค่าแผง', type: 'expense', categoryHint: 'ค่าเช่าแผง/ตลาด', scoreBoost: 42 },
  ],
  'business-owner': [
    { keyword: 'รายได้ธุรกิจ', type: 'income', categoryHint: 'รายได้จากธุรกิจ', scoreBoost: 42 },
    { keyword: 'ค่าใช้จ่ายธุรกิจ', type: 'expense', categoryHint: 'ค่าใช้จ่ายธุรกิจ', scoreBoost: 50 },
    { keyword: 'ค่าใช้จ่ายในธุรกิจ', type: 'expense', categoryHint: 'ค่าใช้จ่ายธุรกิจ', scoreBoost: 50 },
    { keyword: 'จ่ายพนักงาน', type: 'expense', categoryHint: 'ค่าแรงพนักงาน', scoreBoost: 40 },
    { keyword: 'เงินเดือนพนักงาน', type: 'expense', categoryHint: 'ค่าแรงพนักงาน', scoreBoost: 42 },
    { keyword: 'ค่าจ้างพนักงาน', type: 'expense', categoryHint: 'ค่าแรงพนักงาน', scoreBoost: 42 },
    { keyword: 'ค่าจ้างผู้ดูแลระบบ', type: 'expense', categoryHint: 'ค่าแรงพนักงาน', scoreBoost: 40 },
    { keyword: 'ค่าจ้างแอดมิน', type: 'expense', categoryHint: 'ค่าใช้จ่ายธุรกิจ', scoreBoost: 40 },
    { keyword: 'ค่าอุปกรณ์ไอที', type: 'expense', categoryHint: 'ค่าใช้จ่ายธุรกิจ', scoreBoost: 40 },
    { keyword: 'ค่าวัตถุดิบ', type: 'expense', categoryHint: 'ค่าวัตถุดิบธุรกิจ', scoreBoost: 40 },
    { keyword: 'ค่าเครื่องจักร', type: 'expense', categoryHint: 'ค่าใช้จ่ายธุรกิจ', scoreBoost: 38 },
    { keyword: 'ค่าเช่าร้าน', type: 'expense', categoryHint: 'ค่าเช่าร้าน/สำนักงาน', scoreBoost: 38 },
    { keyword: 'ภาษีธุรกิจ', type: 'expense', categoryHint: 'ภาษีธุรกิจ', scoreBoost: 40 },
    { keyword: 'ค่าธรรมเนียม', type: 'expense', categoryHint: 'ค่าใช้จ่ายธุรกิจ', scoreBoost: 40 },
    { keyword: 'ค่าแพลตฟอร์ม', type: 'expense', categoryHint: 'ค่าใช้จ่ายธุรกิจ', scoreBoost: 40 },
    { keyword: 'ค่า platform', type: 'expense', categoryHint: 'ค่าใช้จ่ายธุรกิจ', scoreBoost: 40 },
    { keyword: 'คืนเงินลูกค้า', type: 'expense', categoryHint: 'ค่าใช้จ่ายธุรกิจ', scoreBoost: 40 },
    { keyword: 'คืนเงินให้ลูกค้า', type: 'expense', categoryHint: 'ค่าใช้จ่ายธุรกิจ', scoreBoost: 40 },
  ],
  restaurant: [
    { keyword: 'ขายอาหาร', type: 'income', categoryHint: 'ขายอาหาร/เครื่องดื่ม', scoreBoost: 44 },
    { keyword: 'ขายกาแฟ', type: 'income', categoryHint: 'ขายอาหาร/เครื่องดื่ม', scoreBoost: 44 },
    { keyword: 'วัตถุดิบ', type: 'expense', categoryHint: 'วัตถุดิบร้านอาหาร', scoreBoost: 38 },
    { keyword: 'เดลิเวอรี', type: 'expense', categoryHint: 'ค่าแอปเดลิเวอรี', scoreBoost: 36 },
  ],
  freelance: [
    { keyword: 'รับงาน', type: 'income', categoryHint: 'รายได้โปรเจกต์', scoreBoost: 50 },
    { keyword: 'ลูกค้าจ่าย', type: 'income', categoryHint: 'รายได้โปรเจกต์', scoreBoost: 46 },
    { keyword: 'มัดจำ', type: 'income', categoryHint: 'มัดจำงาน', scoreBoost: 48 },
    { keyword: 'ซอฟต์แวร์', type: 'expense', categoryHint: 'ซอฟต์แวร์/Subscription', scoreBoost: 36 },
  ],
  creator: [
    { keyword: 'เล่นดนตรี', type: 'income', categoryHint: 'ศิลปิน/งานแสดง', scoreBoost: 44 },
    { keyword: 'สปอนเซอร์', type: 'income', categoryHint: 'โดเนท/สปอนเซอร์', scoreBoost: 42 },
    { keyword: 'โดเนท', type: 'income', categoryHint: 'โดเนท/สปอนเซอร์', scoreBoost: 42 },
    { keyword: 'ค่าตัดต่อ', type: 'expense', categoryHint: 'ค่าตัดต่อ/ทีมงาน', scoreBoost: 38 },
  ],
  gamer: [
    { keyword: 'สตรีม', type: 'income', categoryHint: 'Gamer/รายได้สตรีม', scoreBoost: 44 },
    { keyword: 'โดเนท', type: 'income', categoryHint: 'โดเนท/สปอนเซอร์เกม', scoreBoost: 40 },
    { keyword: 'ซื้อเกม', type: 'expense', categoryHint: 'เกม/Subscription', scoreBoost: 38 },
    { keyword: 'อินเทอร์เน็ต', type: 'expense', categoryHint: 'ค่าอินเทอร์เน็ตสตรีม', scoreBoost: 34 },
  ],
  farmer: [
    { keyword: 'ขายผัก', type: 'income', categoryHint: 'เกษตรกร/ขายผัก/ผลไม้', scoreBoost: 50 },
    { keyword: 'ขายข้าว', type: 'income', categoryHint: 'เกษตรกร/ขายผลผลิต', scoreBoost: 48 },
    { keyword: 'ค่าใช้จ่ายการเกษตร', type: 'expense', categoryHint: 'ค่าใช้จ่ายการเกษตร', scoreBoost: 50 },
    { keyword: 'ค่าใช้จ่ายสวน', type: 'expense', categoryHint: 'ค่าใช้จ่ายการเกษตร', scoreBoost: 48 },
    { keyword: 'ค่าใช้จ่ายฟาร์ม', type: 'expense', categoryHint: 'ค่าใช้จ่ายการเกษตร', scoreBoost: 48 },
    { keyword: 'ปุ๋ย', type: 'expense', categoryHint: 'ปุ๋ย/ยาเกษตร', scoreBoost: 42 },
    { keyword: 'น้ำมันรถไถ', type: 'expense', categoryHint: 'ค่าน้ำมันเครื่องจักร', scoreBoost: 42 },
    { keyword: 'ค่าเครื่องจักร', type: 'expense', categoryHint: 'ค่าใช้จ่ายการเกษตร', scoreBoost: 38 },
    { keyword: 'ค่าอุปกรณ์เกษตร', type: 'expense', categoryHint: 'ค่าใช้จ่ายการเกษตร', scoreBoost: 38 },
    { keyword: 'ค่าซ่อมเครื่องจักร', type: 'expense', categoryHint: 'ค่าใช้จ่ายการเกษตร', scoreBoost: 38 },
  ],
  rider: [
    { keyword: 'วิ่งงาน', type: 'income', categoryHint: 'วิ่งงาน/ค่าส่ง', scoreBoost: 48 },
    { keyword: 'ค่าส่งอาหาร', type: 'income', categoryHint: 'วิ่งงาน/ค่าส่ง', scoreBoost: 44 },
    { keyword: 'เติมน้ำมัน', type: 'expense', categoryHint: 'ค่าน้ำมัน', scoreBoost: 40 },
    { keyword: 'ซ่อมรถ', type: 'expense', categoryHint: 'ค่าซ่อมรถ', scoreBoost: 40 },
  ],
};

function normalizeBiasText(input: string) {
  return input
    .normalize('NFC')
    .trim()
    .replace(/เเ/g, 'แ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function compactBiasText(input: string) {
  return normalizeBiasText(input).replace(/[\s\p{P}\p{S}]+/gu, '');
}

function stripAmountFromEntry(input: string) {
  return normalizeBiasText(input)
    .replace(/(?:฿|บาท)?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?\s*(?:บาท|฿)?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = compactBiasText(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(value.trim());
  }

  return result;
}

function uniqueKeywordMappings(mappings: QuickAddStarterKeywordMapping[]) {
  const seen = new Set<string>();
  const result: QuickAddStarterKeywordMapping[] = [];

  for (const mapping of mappings) {
    const key = `${mapping.type}:${compactBiasText(mapping.keyword)}:${compactBiasText(mapping.categoryHint)}`;
    if (!compactBiasText(mapping.keyword) || !compactBiasText(mapping.categoryHint) || seen.has(key)) continue;
    seen.add(key);
    result.push(mapping);
  }

  return result;
}

function getTemplateHintScore(categoryName: string, hint: string) {
  const normalizedName = compactBiasText(categoryName);
  const normalizedHint = compactBiasText(hint);

  if (!normalizedName || !normalizedHint) return 0;
  if (normalizedName === normalizedHint) return 160 + normalizedHint.length * 4;
  if (normalizedName.startsWith(normalizedHint) || normalizedHint.startsWith(normalizedName)) {
    return 130 + Math.min(normalizedName.length, normalizedHint.length) * 3;
  }
  if (normalizedName.includes(normalizedHint)) return 100 + normalizedHint.length * 2;
  if (normalizedHint.includes(normalizedName)) return 80 + normalizedName.length * 2;
  return 0;
}

function findBestTemplateCategory(categories: StarterTemplateCategory[], hint: string) {
  let bestMatch: { category: StarterTemplateCategory; score: number } | null = null;

  for (const category of categories) {
    const score = getTemplateHintScore(category.name, hint);
    if (!score) continue;

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { category, score };
    }
  }

  return bestMatch;
}

function getTemplatesByIds(templateIds: string[]) {
  const uniqueIds = uniqueStrings(templateIds);
  const templates = uniqueIds
    .map((templateId) => STARTER_TEMPLATES.find((template) => template.id === templateId) ?? null);

  const missingIds = uniqueIds.filter((_, index) => !templates[index]);
  if (missingIds.length > 0) {
    throw new Error(`Starter template not found: ${missingIds.join(', ')}`);
  }

  return templates.filter(Boolean) as StarterTemplate[];
}

function buildAutoKeywordMappings(template: StarterTemplate): QuickAddStarterKeywordMapping[] {
  const phrases = uniqueStrings([
    ...template.helperTags,
    ...template.sampleEntries.map(stripAmountFromEntry),
  ]);

  return phrases.flatMap((phrase) => {
    const bestMatch = findBestTemplateCategory(template.categories, phrase);
    if (!bestMatch || bestMatch.score < 78) return [];

    return [{
      keyword: phrase,
      type: bestMatch.category.type,
      categoryHint: bestMatch.category.name,
      scoreBoost: 24,
    }];
  });
}

function buildTemplateKeywordMappings(template: StarterTemplate) {
  return uniqueKeywordMappings([
    ...buildAutoKeywordMappings(template),
    ...(TEMPLATE_KEYWORD_MAPPING_SEEDS[template.id] ?? []),
  ]);
}

function buildActiveStarterTemplateProfile(
  templateIds: string[],
  customName?: string
): ActiveStarterTemplateProfile {
  const templates = getTemplatesByIds(templateIds);
  const uniqueTemplateIds = templates.map((template) => template.id);
  const isCustomBundle = uniqueTemplateIds.length > 1 || Boolean(customName?.trim());

  return {
    id: isCustomBundle ? `custom:${uniqueTemplateIds.join('+')}` : `starter:${uniqueTemplateIds[0]}`,
    name: customName?.trim() || (uniqueTemplateIds.length === 1 ? templates[0].name : 'ชุดเริ่มต้นของฉัน'),
    source: isCustomBundle ? 'custom_bundle' : 'starter_template',
    templateIds: uniqueTemplateIds,
    preferredIncomeCategories: uniqueStrings(
      templates.flatMap((template) =>
        template.categories
          .filter((category) => category.type === 'income')
          .map((category) => category.name)
      )
    ),
    preferredExpenseCategories: uniqueStrings(
      templates.flatMap((template) =>
        template.categories
          .filter((category) => category.type === 'expense')
          .map((category) => category.name)
      )
    ),
    keywordMappings: uniqueKeywordMappings(
      templates.flatMap((template) => buildTemplateKeywordMappings(template))
    ),
    helperTags: uniqueStrings(templates.flatMap((template) => template.helperTags)),
    sampleEntries: uniqueStrings(templates.flatMap((template) => template.sampleEntries)).slice(0, 8),
  };
}

function getStoredProfileCustomName(profile: ActiveStarterTemplateProfile) {
  return profile.source === 'custom_bundle' ? profile.name : undefined;
}

function hasCategory(existing: Category[], item: StarterTemplateCategory) {
  return existing.some(
    (category) =>
      category.type === item.type &&
      category.name.trim().toLowerCase() === item.name.trim().toLowerCase()
  );
}

async function applyTemplates(templateIds: string[]): Promise<ApplyStarterTemplateResult> {
  const templates = getTemplatesByIds(templateIds);
  const existing = await categoryService.getAll();
  let created = 0;
  let skipped = 0;

  for (const template of templates) {
    for (const item of template.categories) {
      if (hasCategory(existing, item)) {
        skipped += 1;
        continue;
      }

      const sortOrder = existing.filter((category) => category.type === item.type).length + 1;

      await categoryService.create({
        name: item.name,
        icon: item.icon,
        type: item.type,
        color: item.color,
        sortOrder,
        isDefault: false,
      });

      existing.push({
        id: `${template.id}-${sortOrder}-${item.name}`,
        name: item.name,
        icon: item.icon,
        type: item.type,
        color: item.color,
        sortOrder,
        isDefault: false,
        createdAt: new Date(),
      });
      created += 1;
    }
  }

  return { created, skipped };
}

export const starterTemplateService = {
  getTemplates() {
    return [...STARTER_TEMPLATES].sort((a, b) => b.popularity - a.popularity);
  },

  getTemplateById(templateId: string) {
    return STARTER_TEMPLATES.find((template) => template.id === templateId) ?? null;
  },

  buildQuickAddProfile(templateIds: string[], customName?: string): ActiveStarterTemplateProfile {
    return buildActiveStarterTemplateProfile(templateIds, customName);
  },

  async getActiveQuickAddProfile() {
    const storedProfile = await appSettingsService.getJson<ActiveStarterTemplateProfile>(ACTIVE_QUICK_ADD_PROFILE_KEY);
    if (!storedProfile) return null;

    const templateIds = uniqueStrings(storedProfile.templateIds ?? []);
    if (!templateIds.length) return null;

    await applyTemplates(templateIds);

    const refreshedProfile = buildActiveStarterTemplateProfile(
      templateIds,
      getStoredProfileCustomName(storedProfile)
    );

    if (JSON.stringify(refreshedProfile) !== JSON.stringify(storedProfile)) {
      await appSettingsService.setJson(ACTIVE_QUICK_ADD_PROFILE_KEY, refreshedProfile);
    }

    return refreshedProfile;
  },

  async saveActiveQuickAddProfile(templateIds: string[], customName?: string) {
    const uniqueTemplateIds = uniqueStrings(templateIds);
    await applyTemplates(uniqueTemplateIds);
    const profile = buildActiveStarterTemplateProfile(uniqueTemplateIds, customName);
    await appSettingsService.setJson(ACTIVE_QUICK_ADD_PROFILE_KEY, profile);
    return profile;
  },

  async clearActiveQuickAddProfile() {
    await appSettingsService.remove(ACTIVE_QUICK_ADD_PROFILE_KEY);
  },

  getPopularTemplates(limit = 6) {
    return this.getTemplates().slice(0, limit);
  },

  getGuidedQuestions() {
    return GUIDED_TEMPLATE_QUESTIONS;
  },

  recommendTemplate(answers: GuidedTemplateAnswerMap): StarterTemplateRecommendation | null {
    const questions = GUIDED_TEMPLATE_QUESTIONS;
    const isComplete = questions.every((question) => Boolean(answers[question.id]));
    if (!isComplete) return null;

    const scoreMap = new Map<string, number>();
    const reasons: string[] = [];

    for (const template of STARTER_TEMPLATES) {
      scoreMap.set(template.id, 0);
    }

    for (const question of questions) {
      const selectedOptionId = answers[question.id];
      const selectedOption = question.options.find((option) => option.id === selectedOptionId);
      if (!selectedOption) continue;

      reasons.push(`${question.title}: ${selectedOption.label}`);

      for (const [templateId, weight] of Object.entries(selectedOption.weights)) {
        if (typeof weight !== 'number') continue;
        const currentScore = scoreMap.get(templateId) ?? 0;
        scoreMap.set(templateId, currentScore + weight);
      }
    }

    const rankedTemplates = STARTER_TEMPLATES.map((template) => ({
      template,
      score: scoreMap.get(template.id) ?? 0,
    })).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.template.popularity - a.template.popularity;
    });

    const bestMatch = rankedTemplates[0];
    if (!bestMatch) return null;

    const secondaryMatch = rankedTemplates.find((item) => item.template.id !== bestMatch.template.id) ?? null;

    return {
      template: bestMatch.template,
      secondaryTemplate: secondaryMatch?.template ?? null,
      score: bestMatch.score,
      secondaryScore: secondaryMatch?.score ?? 0,
      reasons,
    };
  },

  async applyTemplate(templateId: string): Promise<ApplyStarterTemplateResult> {
    return applyTemplates([templateId]);
  },

  async applyTemplateBundle(templateIds: string[]): Promise<ApplyStarterTemplateResult> {
    return applyTemplates(templateIds);
  },
};
