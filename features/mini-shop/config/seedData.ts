import type { ProductInput, ShopInput } from '@/lib/api/contract';

// ── Shop seed ──────────────────────────────────────────────
export const SEED_SHOP: ShopInput = {
  name: 'ร้านหมูนุ่นเป๋าตุง',
  category: 'fashion',
  description: 'ร้านเสื้อผ้าวัยรุ่นคุณภาพดี ราคาถูก จัดส่งทั่วประเทศ',
  phone: '0923153579',
  lineId: '@moonoon',
  facebookPage: 'MoonoonShop',
  hasPhysicalLocation: false,
  address: 'จัดส่งทั่วประเทศ · ฐานที่สุรินทร์',
  openHours: undefined,
  paymentMethod: 'promptpay',
  promptPayType: 'phone',
  promptPayNumber: '0923153579',
  accountName: 'หมูนุ่น เป๋าตุง',
  bankName: 'KBank',
  accountNumber: '123-4-56789-0',
  paymentVisibility: 'qr_only',
};

// ── Product seeds ──────────────────────────────────────────
// หมายเหตุ: images ว่างไว้ก่อน — เพิ่มรูปได้ผ่านหน้า "แก้ไขสินค้า" ในแอป
// รูปต้นฉบับ: assets/shop-seed/shirt-main.png, shirt-blue.png, shirt-all.png
export function buildSeedProducts(): ProductInput[] {
  return [
    {
      images: [],  // เพิ่มรูปได้ภายหลังผ่าน Edit Product
      name: 'เสื้อแขนยาววัยรุ่นลายสก๊อต',
      category: 'fashion',
      description:
        'ผลิตจากผ้าฝ้ายคุณภาพสูงจากประเทศบราซิล สวมใส่สบาย ไม่ระคาย ' +
        'ระบายอากาศดีมาก สีสันสดใส ลายสก๊อตคลาสสิก ใส่ได้ทุกฤดูกาล ' +
        'เหมาะสำหรับวัยรุ่นชายหญิง',
      costPrice: 195,
      price: 389,
      comparePrice: 499,
      stock: 150,
      lowStockThreshold: 10,
      hideWhenOutOfStock: false,
      status: 'active',
      shipping: {
        free: true,
        fixed: false,
        fixedPrice: 0,
        pickup: false,
        cod: true,
      },
      hasVariants: true,
      variants: [
        {
          name: 'สี',
          values: [
            { id: 'dark-blue', label: 'สีฟ้า (Dark Blue)', stock: 60, extraPrice: 0 },
            { id: 'all',       label: 'สีAll (ผสม)',       stock: 50, extraPrice: 0 },
            { id: 'gray',      label: 'สีเทา (Gray)',       stock: 40, extraPrice: 0 },
          ],
        },
      ],
      saleEndsAt: undefined,
    },
  ];
}
