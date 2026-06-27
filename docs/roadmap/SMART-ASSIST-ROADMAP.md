# แผนปรับปรุงสู่ Smart Assist — หมูนุ่น+เป๋าตุง
## การบ้านทีมงาน (สังเคราะห์ความเห็น 3 ทีม) — 6 มิ.ย. 2569

> **เป้าหมายรอบนี้ (กฎเหล็ก):** ไม่ใช่ "เดาถูกทุกเคส" แต่คือ **"ห้ามมั่นใจสูงในขณะที่คำนวณเงินผิด"**
> นี่คือแอปการเงิน — ข้อมูลผิดที่ถูก auto-save แพงกว่าการถามกลับเสมอ

---

## สถานะ Handoff — 9 มิ.ย. 2569

หลังทดสอบเครื่องจริงแล้ว Pro Core / Daily Snapshot / Smart Entry / Trade Set เข้าสู่สถานะ scope freeze: แก้เฉพาะ bug, regression, และ UX เล็กน้อยที่ไม่เปลี่ยน behavior หลัก งานถัดไปคือใช้เอกสาร `PREMIUM-AI-HANDOFF.md` เป็นฐานประชุมทีมเพื่อสรุป Road Map Premium Version AI

หลักการต่อยอด Premium: local deterministic core ยังเป็นฐานของระบบ, AI ใช้เป็นชั้น review/insight/advisor, และเคสที่ไม่มั่นใจต้องถามหรือให้ผู้ใช้ยืนยันก่อนบันทึก

---

## 0. สรุปผลทดสอบ 4 เคส + สถานะหลังแก้รอบนี้

| # | Input | ก่อนแก้ | หลังแก้ (รอบนี้) | สถานะ |
|---|---|---|---|---|
| 1 | ขายรถ 850,000 บาท ได้**ค่านายหน้า 3%** | 850,000 [มั่นใจสูง] ❌ | **25,500 [computed]** ✅ | **แก้แล้ว** |
| 2 | ข้าวเปลือก 16 ตัน กก.ละ 17 | 272,000 [ปานกลาง] ✅ | 272,000 (คงเดิม) | ดีอยู่แล้ว |
| 3 | กบ 80 ตัว ตัวละ 700 กรัม กก.ละ 75 | 4,200,000 ❌ | **4,200 [ambiguous]** ✅ | **แก้แล้ว** |
| 4 | ขายปลา 5 ตัว ตัวละ 60 | 11 / note เลขหาย ❌ | **300 + note ครบ** ✅ | **แก้แล้ว** |

---

## ✅ สิ่งที่ทำเสร็จแล้วในรอบนี้ (commit แล้ว, มีเทสต์)

1. **แปลงหน่วยชั่งตวง** (`UNIT_DIMENSION`): ตัน↔กก.↔กรัม↔ขีด, ลิตร↔มล. → "80 ตัว × 700 กรัม → 56 กก. × 75 = 4,200"
2. **ราคาต่อหน่วยหลายชั้น** (`ตัวละ...กก.ละ...`) → คูณต่อกัน + แปลงหน่วยระหว่างชั้น
3. **เปอร์เซ็นต์ modifier** (ค่านายหน้า/คอมมิชชั่น/กำไร X%) → `recorded = base × %` (เคส Toyota)
4. **Confidence gating ตาม amountSource**: explicit/sole→high ได้ · computed/inferred→≤medium · ambiguous→≤low
   → เคสที่มี % / แปลงหน่วย / หลายเลข จะ **ไม่ขึ้น "บันทึกเลย" one-tap** ต้องเหลือบตรวจ
5. **Explain Calculation** (UI): โชว์ "🧮 ค่านายหน้า 850,000 × 3% = 25,500" / "🧮 80 ตัว · กก.ละ 75 = 4,200"
6. **note เก็บประโยคต้นฉบับ** เมื่อมีโครงสร้าง (กัน "60 หาย")
7. **ภาษาหมูนุ่น** ("ระบบเดาว่า"→"🐷 หมูนุ่นคิดว่า..." 3 ระดับตาม confidence — แต่คงป้าย confidence ซื่อสัตย์)
8. **กัน auto-return** ตอนมี entry ค้าง/กำลัง review

ทดสอบ: `npm run test:smart-parser` (17 เคส) + regression เดิม `npm run test:quick-add:all` (298/298 ไม่พัง)

---

## 🔴 P1 — Confidence Calibration (ทำต่อ ลำดับสูงสุด)

ปัจจุบัน confidence ดูจาก amountSource + score แล้ว แต่ยังต้องเพิ่มสัญญาณ:
- **Coverage** — token ที่มีความหมายถูก consume ไปกี่ %; มี token ค้าง (โดยเฉพาะ qualifier ตัวเลข) → ตัด confidence
- **Modifier-applied check** — ถ้ามี modifier ตัวเลข (%/ลด/หัก/+ค่าส่ง) ที่ยังไม่ถูกคิด → ห้าม high (ทำบางส่วนแล้ว: % ที่ไม่ใช่ commission/profit → downgrade ambiguous)
- **KPI หลัก: False-high-confidence rate → เข้าใกล้ 0** (เคส Toyota คือ KPI นี้สอบตก — แก้แล้ว ต้องกันไม่ให้เกิดอีกที่อื่น)

**Definition of Done:** เพิ่ม discount/หัก/ทอน เข้า modifier model แล้ว false-high-confidence ใน golden set < 2%

---

## 🔴 P2 — Semantic Amount Model (ขยาย modifier)

แยก **transaction_value** (มูลค่าธุรกรรม) ออกจาก **recorded_amount** (เงินที่ได้/จ่ายจริง) — ทำแล้วสำหรับ %; ต้องเพิ่ม:

| ชนิด | ตัวอย่าง | สูตร | สถานะ |
|---|---|---|---|
| commission_pct | ค่านายหน้า/คอม X% | base × X% | ✅ เสร็จ |
| profit_pct | กำไร X% | base × X% | ✅ เสร็จ |
| discount | ขายได้ 500 แต่ลดให้ 50 | base − 50 = 450 | ⬜ TODO |
| addition | + ค่าส่ง 30 | base + 30 | ⬜ TODO |
| net/ทอน | จ่ายแบงค์ร้อยได้ทอน 60 | 100 − 60 = 40 | ⬜ TODO (ยาก) |

---

## 🟠 P3 — Golden Test Set + Metrics (เปลี่ยนจากทดสอบมือ → ระบบ)

ขยาย `tests/smart-parser/` เป็น labeled dataset **100+ เคส → 300** แบ่ง 7 กลุ่ม:
รายรับง่าย · รายจ่ายง่าย · หน่วยซับซ้อน · STT เพี้ยน (งอก/ลอก, คำติดกัน) · intent กำกวม (ซื้อ/ขาย/รับมาขาย) · **modifier (%/ลด/กำไร)** · หลายรายการในประโยคเดียว · หน่วยภาษาพูดไม่มีราคา (ลัง/กระสอบ/ถัง)

Metric (เรียงความสำคัญ): **Amount-exact accuracy** → **False-high-confidence rate** → Intent/Category accuracy → Confidence calibration (high ควรถูก >95%)
**DoD:** รันเป็น regression gate — ของใหม่ห้ามทำของเก่าพัง (มีโครงแล้ว: `test:quick-add:all` + `test:smart-parser`)

---

## 🟠 P4 — ตัดสินใจ Engine (local-only vs hybrid) — ต้องคุยในมีตติ้ง

- **Local rule-based** — เคสง่ายปริมาณมาก: เร็ว ฟรี offline (ทำต่อ)
- **Hybrid LLM fallback** — เฉพาะหางยาว ~20% (coverage ต่ำ/มี modifier/กำกวม) → บังคับ output JSON `{intent, recorded_amount, breakdown, confidence}` แล้ว validate ฝั่ง local
- ของที่มีอยู่: Anthropic API (มีใน .env), ai-engine Xiao-Er, multi-agent NoonStore
- **DoD:** เอกสารสรุป architecture + ตัวเลขประมาณ cost/latency

> หมายเหตุ: งาน lexicon/semantic ไม่เสียเปล่าไม่ว่าเลือก engine ไหน — LLM ก็ต้องถูกสอน domain เดียวกัน

---

## 🟢 P5 — Consolidate (ของดีทั้ง 3 ทีม — ทำหลัง P1–P4 นิ่ง)

- **Domain Lexicon ตามอาชีพ** — ข้าวเปลือก/กบ/มันสำปะหลัง/ปุ๋ย → **เกษตรกร** (ไม่ใช่ "ธุรกิจส่วนตัว"); ผูกกับ Starter Template
- **STT normalize คำเพี้ยน** — "ลอก/งอก 16 ตัน" → "ข้าวเปลือก"; "โลละ"→"กิโลกรัมละ"
- **Smart Correction Memory (personalized)** — มี `quickAddLearningService` แล้ว; ต่อยอดให้จำ pattern รายสินค้า/ราย user (แก้ "กบ"→เกษตรกร 1 ครั้ง → จำ)
- **Ambiguous Question Mode** — ไม่มั่นใจ → ปุ่มสั้น `[ใช่ ขายข้าวเปลือก] [เปลี่ยนเป็นรายจ่าย] [เลือกหมวดเอง]` ไม่ถามยาว
- **Multi-line** — "ซื้อหมู 120 ไก่ 80 ข้าว 20" → แยก 3 รายการ หรือรวม 220
- **(พิจารณา) Time/Location context** — "ข้าวเปลือก" ช่วง พ.ย.–ธ.ค. (ฤดูเกี่ยว) → ดัน confidence เกษตรกร

---

## คำถามที่ต้องตอบในมีตติ้งพรุ่งนี้
1. **discount/หัก/ทอน** — เจอ modifier อื่นบ่อยในลูกค้าจริงอีกไหม นอกจากในตาราง P2?
2. **Engine** — local-only หรือ hybrid? ขอข้อสรุป + เหตุผล + cost
3. **ใครรับ golden test set ก้อนแรก (100 เคส)** ภายในกี่วัน?
4. **Domain lexicon** — เริ่มจากอาชีพไหนก่อน (เกษตรกร/แม่ค้าออนไลน์/ร้านอาหาร)?

> ระบบมาถูกทางแล้ว — การที่มันรู้จัก "ลังเลตอนที่ควรลังเล" (เคส 3) คือสัญญาณที่ดีมาก
> รอบนี้ปิดช่อง "มั่นใจผิด" (เคส Toyota) ได้แล้ว ขั้นต่อไปคือ **discount/ทอน + golden set + lexicon อาชีพ**

---

# ภาคผนวก: Golden Set Roadmap (มติ 3 ทีม — 7 มิ.ย. 2569)

## มติที่ตกลงร่วม (ทั้ง 3 ทีมเห็นตรง)
1. **ไม่ตัดสิน engine รอบนี้** — ตกลงแค่ architecture shape: **Local-first + Validator + Clarifying Question**
2. **LLM = data-gated decision** — ให้ Golden Set v1 พิสูจน์ก่อนว่า residual เหลือเท่าไร/ยากแบบไหน
3. **Modifier เลขคณิต (ลด/บวก/ทอน/มัดจำ/หาร) = deterministic local rule** ไม่ใช่งาน LLM ("ทอน" = paid − change)
4. **route ตาม "ชนิดความยาก"**: parsing-hard (verify ได้ → อนาคต LLM) vs interpretation-ambiguous (→ ถามกลับเสมอ ห้ามเดา)
5. **KPI สำคัญสุด: False auto-save rate → 0** (ยอม "ถามบ่อยไป" ห้าม "ผิดแบบมั่นใจ")
6. **Agriculture lexicon ก่อน** (หน่วยโหดสุด = stress test ดีสุด, engine-agnostic)

## Architecture เป้าหมาย
```
Input → Normalize(text/unit/number) → Local Parser+Rules → Arithmetic Resolver
      → Semantic Gate → Validator → Decision: {auto-save | ask | manual | (future) LLM-verify-only}
```

## แผน Phase (เริ่มดำเนินการทันที ทีละ Phase)

### 🔵 Phase 1 — Deterministic Arithmetic Modifiers (local rule) — **กำลังทำ**
ทอน (paid−change) · ลด (fixed & %) · บวก (ค่าส่ง) → คำนวณ local, source=computed (ไม่ auto-save), โชว์ breakdown
- DoD: เทสต์ "จ่าย 200 ทอน 80"→120, "500 ลดให้ 50"→450, "800 บวกค่าส่ง 40"→840, "1000 ลด 10%"→900 ✅

### 🔵 Phase 2 — Clarifying-Question / Ambiguity Gate
เพิ่ม `action: 'auto_save' | 'review' | 'ask'` + ตรวจ intent-ambiguous ("รับของมา 300 ขายไป 450", "โอนให้แม่")
→ action='ask' + คำถามสั้น + choices; UI แสดงปุ่มเลือกแทน auto-save
- DoD: เคสกำกวม → ask (ไม่ auto-save), False-auto-save = 0 ในชุด ambiguous

### 🔵 Phase 3 — Golden Set v1 (600 เคส) + Metrics runner
labeled dataset (id/input/expected_*/difficulty_type/risk_level/requires_clarification) สูตร 30/40/30
seed: 298 regression เดิม + เคสทีม + log; runner วัด amount-exact + **False-auto-save rate** + clarification accuracy
- DoD: รันเป็น regression gate; รายงาน local pass% เพื่อ data-gate P4

### 🔵 Phase 4 — Agriculture Lexicon + Decision Gate
domain lexicon (ข้าวเปลือก/มันสำปะหลัง/ยาง/อ้อย/กบ/ปุ๋ย → เกษตรกร) + Production sign-off gates
- DoD: Local arithmetic ≥80% ใน golden set, ambiguous→ask ≥95%, uncaught failure = 0

### ⚪ Phase 5 (future, data-gated) — LLM fallback เฉพาะกอง verify ได้
เปิดเฉพาะ parsing-hard ที่ validator ตรวจเลขได้; ห้ามใช้กับ intent-ambiguous; output JSON ผ่าน validator เสมอ

---

## อัปเดตหลังทดสอบจริง (7 มิ.ย. 2569 — บูรณาการ 2 ทีม)

ผู้ใช้ทดสอบ clarify ได้ดี (ซื้อ-ขาย, ยืม-ดอกเบี้ย). 2 ทีมเสนอตรงกัน:

### ✅ ทำแล้ว: Double-Entry (บันทึกคู่)
"ซื้อ 1,800 ไปขาย 4,200" → ตัวเลือก **"บันทึกทั้งคู่ (กำไร 2,400)"** สร้าง 2 รายการ (income ขาย + expense ต้นทุน) ในแตะเดียว
หมวดอัตโนมัติ: income→ขายของในตลาด/ธุรกิจ, expense→ประกอบธุรกิจ/เกษตร; snackbar สรุปกำไร

### ⬜ TODO (ทั้ง 2 ทีมเน้น — เรียงความสำคัญ)
1. **🥇 เงินให้ยืม/เงินต้น ≠ รายจ่ายจริง** (ทีม 2 ย้ำสุด): ปัจจุบัน default ของเคสยืม = ดอกเบี้ย(income) ปลอดภัยแล้ว
   แต่ถ้าผู้ใช้เลือก "เงินต้น" ยังลงเป็น expense → รายงานเพี้ยน. ต้องเพิ่ม transaction types:
   `loan_out / loan_in / debt_payment / interest_income / cost_of_goods` (กระทบ schema + financeSummaryService — งานใหญ่)
2. **ดอกเบี้ย "วันละ X%"** (ทีม 2): ตรวจ "วันละ/ต่อวัน" → ถามจำนวนวัน → base×rate×days (ตอนนี้คิด 1 วัน medium)
3. **Context-aware category**: keyword "ตลาด"→ขายของในตลาด, "ดอก"→ดอกเบี้ย (เพิ่ม confidence + ไฮไลต์หมวด)
4. **Financial glossary ไทย**: sales/cost/profit/interestIncome/loanOut/loanIn/repayment synonym map ("กินดอก"=ดอกเบี้ย, "เหมา"=ต้นทุน)
5. **Smart memory ต่อยอด**: จำคู่ (keyword note → หมวดที่ผู้ใช้เลือก) ราย user (มี quickAddLearningService แล้ว ต่อให้จำการตีความ clarify ด้วย)
6. **3-level confidence ถาวร**: 🟢สูง=auto_save · 🟡กลาง=review+ยืนยัน · 🔴ต่ำ=ask (มี action field แล้ว — ทำเป็น rule นิ่ง)

> หมายเหตุสำคัญ (ทั้ง 2 ทีม): **"อย่าให้เงินให้ยืม/เงินกู้/เงินลงทุน ลงเป็นรายจ่ายธรรมดา"** = จุดที่ทำรายงานเพี้ยนมากสุด — เป็นงาน schema ที่ควรทำเป็น milestone แยก
