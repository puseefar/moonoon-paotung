# Real-Device Test Checklist — Market Intent + Keyboard + Learning

มติทีม 8 มิ.ย. 2569 — สิ่งที่ unit test ครอบไม่ได้ ต้องลองบนเครื่องจริง (Android ก่อน)

## A. เคสค้าขายที่ต้องมั่นใจสูง (Trade Set / ขายของในตลาด)
อัตโนมัติแล้วใน `npm run test:market-intent` (positive_trade / positive_single) — บนเครื่องจริงให้ดูว่า **การ์ดโชว์ "มั่นใจสูง" + หมวด "ขายของในตลาด"**:

- [ ] `ซื้อไก่ 5000 ไปย่างขายในตลาดได้เงิน 12000` → ชุดซื้อ-ขาย · มั่นใจสูง · ขายของในตลาด · กำไร 7,000
- [ ] `ซื้อลูกชิ้น 700 ไปขายในตลาดได้เงิน 2400` → ชุดซื้อ-ขาย · มั่นใจสูง
- [ ] `ซื้อหมู 1000 ไปทอดขายได้เงิน 3000` → ชุดซื้อ-ขาย · มั่นใจสูง
- [ ] `ทอดขายได้ 800` (เดี่ยว) → รายรับ · ขายของในตลาด

## B. เคสที่คำว่า "ตลาด" ห้าม hijack ไปเป็นรายรับ/ขายของในตลาด
อัตโนมัติแล้ว (negative_no_hijack) — ยืนยันว่า **ไม่กลายเป็นชุดซื้อ-ขาย และไม่เป็น "ขายของในตลาด"**:

- [ ] `ไปตลาดซื้อผัก 80` → รายจ่าย (อาหาร) ไม่ใช่ขายของในตลาด
- [ ] `ค่ารถไปตลาด 40` → รายจ่าย — ⚠️ **หมายเหตุ pre-existing:** ปัจจุบันได้ "อาหาร" (คำว่า "ตลาด" เป็น keyword หมวดอาหารใน CATEGORY_RULE เดิม) ที่ถูกต้องควรเป็น "เดินทาง" — **ไม่ใช่ของรอบนี้** (income rule ไม่ยุ่ง) ถ้าทีมอยากแก้ต้องทำแยกรอบ + เช็ก regression `จ่ายตลาด/ซื้อผักตลาด`
- [ ] `จ่ายค่าเช่าแผงตลาด 500` → รายจ่าย (ปัจจุบันได้ "อาหาร" เช่นกัน — pre-existing เหมือนข้างบน)
- [ ] `เดินตลาดกับแม่` (ไม่มียอด) → ไม่บันทึก/ขอยอดก่อน

## C. Learning Override (P4 — เปิดเฉพาะ trade-set save รอบนี้)
- [ ] พิมพ์ประโยคที่ระบบเดาหมวดผิด → กดแก้หมวดเอง → บันทึก
- [ ] ปิด-เปิดแอปใหม่ → พิมพ์ประโยค**เหมือนเดิม** → ระบบเสนอหมวดที่เคยแก้
- [ ] ⚠️ ปัจจุบัน learning เก็บ keyword = ประโยคเต็ม(ลบยอด) → จำได้เฉพาะพิมพ์ซ้ำเกือบเป๊ะ (phrase-level เป็น Phase ถัดไป, `ENABLE_PHRASE_LEARNING=false`)
- [ ] learned rule **ต้องไม่** ทับ type/amount ที่ parser จับ และไม่ override เคสที่ core มั่นใจสูง

## D. Keyboard บัง bottom sheet "แก้ไขตัวเลข" (P1)
`app.json` ตั้ง `softwareKeyboardLayoutMode='pan'` (มาจาก PKG-01 diary) — **ห้ามแก้ global** ทดสอบ 3 จอ:

- [ ] **Trade Set → "แก้ไขตัวเลข"**: numpad ไม่บังช่องต้นทุน/ยอดขาย และปุ่ม "ใช้ตัวเลขนี้" กดได้เสมอ (เลื่อน ScrollView ถึง)
- [ ] **Quick Add / Daily Snapshot**: พิมพ์รายการปกติ คีย์บอร์ดไม่ดันจอเพี้ยน
- [ ] **Life Diary (PKG-01)**: ยังพิมพ์ได้ปกติ (จอที่เคยมีปัญหาคีย์บอร์ด)
- ถ้า `behavior='height'` ยังกวนบน Android → สลับ **เฉพาะ Modal นี้** เป็น `'padding'` หรือพิจารณา `react-native-keyboard-controller` (แยกรอบ — เป็น dep ใหม่มี regression risk) **อย่าแตะ app.json global**

## E. ปุ่ม "แยกเป็นรายการปกติ" (P2)
- [ ] confidence สูง → **ไม่เห็น**ปุ่ม "แยกเป็นรายการปกติ" (เหลือ "แก้ไขตัวเลข" เต็มแถว)
- [ ] confidence กลาง/ต่ำ → ยังเห็นปุ่มไว้เป็นทางหนี

## Gate ก่อน merge (อัตโนมัติ)
```bash
npm run test:quick-add:all     # category regression — ต้อง 298/298
npm run test:golden:check      # FASR ทุก slice ไม่แย่กว่า baseline
npm run test:market-intent     # mini golden set ตลาด — ต้องผ่านทุกกลุ่ม
npm run test:smart-parser
```
Feature flags (`services/quickAddParser.ts` → `QUICK_ADD_FLAGS`): ถ้า market rule พังบนเครื่องจริง ปิด `ENABLE_MARKET_SELLING_INTENT=false` ได้โดยไม่ rollback ทั้ง build
