# Quick Add Thai Regression

Regression suite นี้ใช้วัดความแม่นของ `quickAddParser` สำหรับข้อความภาษาไทยสั้น ๆ ในงานบันทึกรายรับ/รายจ่าย

## โครงสร้าง

- `cases.th.json` ชุด baseline ภาษาไทย
- `cases.adversarial.th.json` ชุดข้อความกำกวม, typo, ภาษาพูด, และรูปประโยคที่จงใจหลอก parser
- `fixtures/category-profiles.json` โปรไฟล์หมวดหมู่ตัวอย่าง
- `run-quick-add-regression.cjs` ตัวรัน regression test

## วิธีรัน

```bash
npm run test:quick-add
```

รันเฉพาะ adversarial suite:

```bash
npm run test:quick-add:adversarial
```

รันทุก suite รวมกัน:

```bash
npm run test:quick-add:all
```

กรองเฉพาะโปรไฟล์:

```bash
node ./tests/quick-add/run-quick-add-regression.cjs --profile freelancer
```

เลือก suite เอง:

```bash
node ./tests/quick-add/run-quick-add-regression.cjs --suite adversarial --profile default
```

ดูผลแบบ JSON:

```bash
node ./tests/quick-add/run-quick-add-regression.cjs --json
```

## หลักการตีความผล

- `Type accuracy` วัดว่า parser แยก `income` / `expense` ถูกหรือไม่
- `Category accuracy` วัดว่า parser เดาหมวดหมู่ได้ตรงหรือไม่
- `Overall accuracy` ต้องถูกทั้งประเภทและหมวดหมู่พร้อมกัน
