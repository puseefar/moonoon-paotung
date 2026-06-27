# Premium AI Handoff - 9 มิถุนายน 2569

## สถานะสรุป

วันที่ 9 มิถุนายน 2569 ทีมปิดรอบการพัฒนา **Pro Core / Daily Snapshot / Smart Entry / Trade Set** แล้ว หลังจากทดสอบบนเครื่องจริงและยืนยันว่า:

- การ์ด trade set ตรวจจับรายการซื้อ-ขายได้ถูกต้องในเคสตลาดและธุรกิจส่วนตัว
- บันทึก 2 ขาแยกต้นทุนและยอดขายได้ถูกต้อง
- ประวัติรายการแสดงยอดขาย ต้นทุน และกำไรสุทธิถูกต้อง
- regression หลักผ่าน: `test:market-intent` 44/44, `test:quick-add:all` 298/298, `test:smart-parser`, `test:golden:check`

จากจุดนี้ให้ถือว่า **Pro Core อยู่ในสถานะ scope freeze**: แก้เฉพาะ bug จริง, regression, UX เล็กน้อยที่ไม่เปลี่ยน behavior หลัก และไม่เพิ่ม rule-based taxonomy ใหม่โดยไม่มีข้อมูลจริงรองรับ

## หลักที่ต้องรักษาไว้ตอนขึ้น Premium

- Local deterministic parser เป็น source of truth สำหรับเคสที่ชัดเจน
- AI ไม่ควรแทน parser หลักในเคสที่ระบบมั่นใจสูงและตรวจเลขได้แล้ว
- เคส confidence ต่ำ/กลางต้องเป็น review หรือ ask ก่อนบันทึก ไม่ auto-save เงียบ ๆ
- Trade set ต้องแยก 2 ขาบัญชีเสมอ: cost = `ต้นทุนขาย`, revenue = หมวดรายรับ/กิจกรรมธุรกิจ
- อย่าสร้างหมวด account category ซ้ำสองฝั่งเพียงเพื่อแก้ปัญหา activity เดียวกัน
- เก็บ business activity เป็น layer แยกในอนาคต เมื่อจะทำรายงาน activity จริง
- การใช้ API ต้องผ่าน consent, privacy boundary, backend proxy และ feature flag

## ขอบเขตที่เสนอสำหรับ Premium AI

เริ่มจาก AI เป็นชั้น **Review / Insight / Advisor** ก่อน ไม่ใช่ระบบบันทึกหลัก:

1. AI Daily / Weekly Insight
   - สรุปพฤติกรรมรายวันหรือรายสัปดาห์จากข้อมูลที่บันทึกแล้ว
   - ชี้รายการที่น่าสังเกต เช่น รายจ่ายสูงผิดปกติ หรือกำไรต่ำกว่าปกติ

2. AI Review สำหรับข้อความกำกวม
   - เรียก API เฉพาะเมื่อ local parser ไม่มั่นใจ หรือมีข้อความยาว/บริบทซับซ้อน
   - บังคับ output เป็น structured JSON แล้ว validate ฝั่ง local ก่อนแสดงผล
   - AI เสนอคำตอบ แต่ผู้ใช้ต้องยืนยันในเคสเสี่ยง

3. AI Category Suggestion
   - ใช้เพื่อแนะนำหมวดเมื่อ local confidence ต่ำ
   - เรียนรู้จากการแก้ของผู้ใช้ แต่ไม่ override หมวดที่ deterministic core มั่นใจสูง

4. AI Business Activity Report
   - ต่อยอดจาก trade set โดยแยก account category กับ activity tag
   - ตัวอย่าง activity: ขายของในตลาด, ธุรกิจส่วนตัว, แม่ค้าออนไลน์, เกษตรกร

5. AI Tax / Finance Assistant
   - เริ่มจากคำอธิบายและ checklist แบบ compliance-safe
   - หลีกเลี่ยงการให้คำแนะนำภาษีเชิงตัดสินเด็ดขาดจนกว่าจะมี policy และ disclaimer ชัดเจน

## คำถามสำหรับ Meeting ทีม

- Premium AI จะใช้ provider/engine ใด และผ่าน backend proxy แบบใด
- ต้องเก็บ real anonymized log อะไรบ้างเพื่อวัด false auto-save / confidence / cost
- Budget latency และ cost ต่อ request ที่ยอมรับได้คือเท่าไร
- Feature แรกของ Premium AI ควรเป็น Insight, Review, หรือ Chat
- จะออกแบบ consent และ privacy text อย่างไร
- จะ rollout ด้วย feature flag กลุ่มเล็กก่อนอย่างไร

## Next Step

นำเอกสารนี้เข้าประชุมทีมเพื่อสรุป **Road Map Premium Version AI** จากนั้นค่อยเริ่มงาน implementation รอบแรก โดยแนะนำให้เริ่มจาก:

1. Premium AI architecture document
2. feature flags และ no-op AI assist service
3. routing/gating tests: high-confidence local result ต้องไม่เรียก AI
4. privacy/consent checklist สำหรับข้อมูลที่จะส่ง API

