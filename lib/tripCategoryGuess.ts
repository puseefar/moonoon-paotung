// Rule-based category guesser for Trip Estimator
// Category = "ชนิดเงินที่จ่าย", Trip = "บริบทที่เกิดขึ้น"

interface CategoryLike { id: string; name: string }

const KEYWORD_RULES: { keywords: string[]; categoryName: string }[] = [
  {
    keywords: ['โลตัส', 'บิ๊กซี', 'แม็คโคร', 'ซูเปอร์มาร์เก็ต', 'supermarket', 'ซุปเปอร์', 'ท็อปส์', 'ริมปิง', 'ฟู้ดแลนด์', '7-11', 'เซเว่น', 'ร้านสะดวก', 'แฟมิลี่มาร์ท', 'minigogo', 'ห้าง', 'เซ็นทรัล', 'เมเจอร์'],
    categoryName: 'ช้อปปิ้ง',
  },
  {
    keywords: ['ตลาดสด', 'ตลาด', 'ตลาดนัด', 'ของสด', 'แม่ค้า', 'พ่อค้า', 'ตลาดเช้า', 'ตลาดเย็น'],
    categoryName: 'อาหาร/เครื่องดื่ม',
  },
  {
    keywords: ['อาหาร', 'กินข้าว', 'ร้านอาหาร', 'ของกิน', 'ข้าว', 'กับข้าว', 'ครัว', 'เนื้อ', 'หมู', 'ไก่', 'ผัก', 'ปลา', 'กุ้ง', 'เครื่องแกง'],
    categoryName: 'อาหาร/เครื่องดื่ม',
  },
  {
    keywords: ['ซ่อม', 'ช่าง', 'ประปา', 'ท่อ', 'สี', 'ก่อสร้าง', 'ฮาร์ดแวร์', 'วัสดุก่อสร้าง', 'อุปกรณ์ซ่อม', 'ไฟฟ้า', 'เดินสาย', 'ปูน', 'กระเบื้อง', 'ตะปู', 'น็อต', 'เครื่องมือ'],
    categoryName: 'อื่นๆ',
  },
  {
    keywords: ['เที่ยว', 'ทัวร์', 'โรงแรม', 'ที่พัก', 'รีสอร์ท', 'ทะเล', 'ภูเขา', 'ท่องเที่ยว', 'วันหยุด', 'พักผ่อน', 'ไป เที่ยว', 'เช็คอิน', 'น้ำตก', 'อุทยาน'],
    categoryName: 'Trip/ทัวร์',
  },
  {
    keywords: ['ส่งของ', 'ลูกค้า', 'เข้าร้าน', 'สต็อก', 'ต้นทุน', 'กิจการ', 'ธุรกิจ', 'ขายของ', 'สินค้า', 'รับของ', 'ออเดอร์', 'ของขาย'],
    categoryName: 'ประกอบธุรกิจ',
  },
  {
    keywords: ['ยา', 'โรงพยาบาล', 'คลินิก', 'หมอ', 'แพทย์', 'ฟัน', 'ตา', 'ร้านยา', 'สุขภาพ', 'ตรวจ', 'ฉีดยา'],
    categoryName: 'สุขภาพ/ยา',
  },
  {
    keywords: ['น้ำมัน', 'เติมน้ำมัน', 'ปั๊ม', 'แก๊ส', 'รถ', 'บัส', 'รถไฟ', 'เครื่องบิน', 'แท็กซี่', 'แกร็บ', 'ค่ารถ', 'รถเมล์'],
    categoryName: 'เดินทาง/น้ำมัน',
  },
  {
    keywords: ['เกษตร', 'ปุ๋ย', 'เมล็ดพันธุ์', 'ยาฆ่าแมลง', 'ฟาร์ม', 'นา', 'สวน', 'ต้นไม้', 'ไร่', 'พืช', 'ชาวนา', 'ชาวสวน'],
    categoryName: 'กิจกรรมการเกษตร',
  },
  {
    keywords: ['เสื้อผ้า', 'รองเท้า', 'กระเป๋า', 'เครื่องสำอาง', 'แต่งตัว', 'แฟชั่น', 'ชุด'],
    categoryName: 'เสื้อผ้า',
  },
];

const TEMPLATE_CATEGORY_MAP: Record<string, string> = {
  'market-housewife': 'อาหาร/เครื่องดื่ม',
  'stock-trader': 'ประกอบธุรกิจ',
  'grocery-run': 'ช้อปปิ้ง',
  'material-purchase': 'อื่นๆ',
  'blank': 'อื่นๆ',
};

function findCategory(categories: CategoryLike[], targetName: string): CategoryLike | undefined {
  const target = targetName.toLowerCase();
  return categories.find(c => c.name.toLowerCase().includes(target) || target.includes(c.name.toLowerCase()));
}

export function guessTripCategoryId(
  tripName: string,
  templateId: string | undefined | null,
  categories: CategoryLike[]
): string | null {
  const name = tripName.toLowerCase();

  // 1. Keyword rules on trip name
  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some(kw => name.includes(kw.toLowerCase()))) {
      const cat = findCategory(categories, rule.categoryName);
      if (cat) return cat.id;
    }
  }

  // 2. Template-based fallback
  if (templateId && TEMPLATE_CATEGORY_MAP[templateId]) {
    const cat = findCategory(categories, TEMPLATE_CATEGORY_MAP[templateId]);
    if (cat) return cat.id;
  }

  // 3. Final fallback: Trip/ทัวร์ → อื่นๆ → first category
  const tripCat = categories.find(c => c.name.toLowerCase().includes('trip') || c.name.includes('ทัวร์'));
  if (tripCat) return tripCat.id;

  const otherCat = categories.find(c => c.name.includes('อื่นๆ'));
  if (otherCat) return otherCat.id;

  return categories[0]?.id ?? null;
}
