# Poatung (หมูนุ่น) — Phase 3 Spec
## Golden Set v1 + Metrics Runner

**Owner:** Pu · **Status:** Ready to build · **Blocks:** Phase 4 (Agriculture lexicon + Production sign-off gate)

> **ทำไม P3 ต้องมาก่อน P4:** Phase 4 มี "Production sign-off gate" อยู่ในตัว แต่ gate จะ gate ด้วยอะไรถ้าไม่มี metric? metrics runner ในเอกสารนี้คือ "ไม้บรรทัด" ที่ทำให้ gate มีความหมาย และ #1 (agriculture intent rule ที่เพิ่งเพิ่ม) ตอนนี้ยัง **unmeasured** — เราต้องรัน baseline ก่อนถึงจะรู้ว่า #1 ดีจริงไหม แล้วค่อยเดิน Phase 4 เพื่อวัด delta

---

## 1. หลักการ (Principles)

1. **Freeze + version.** Golden Set v1 ถูก freeze หลัง label เสร็จ ห้ามแก้เคสเดิม เคสใหม่ไปลง v2 — ไม่งั้น baseline เปรียบเทียบข้าม commit ไม่ได้
2. **วัด calibration ไม่ใช่แค่ accuracy.** หัวใจคือ "confidence โกหกไหม" ไม่ใช่ "ตอบถูกกี่ %" — เพราะ failure mode ที่เรากลัวคือ *มั่นใจแต่ผิด* (Toyota commission)
3. **Slice by `difficulty_type` เสมอ.** ตัวเลขรวมไม่มีความหมาย ตัวเลขแยก slice ต่างหากที่บอกว่า rule ไหนพัง
4. **Ground truth ก่อน, prediction ทีหลัง.** label คำตอบที่ถูกของแต่ละเคสให้เสร็จก่อน แล้ว runner ค่อยเอา parser ไปยิงเทียบ

---

## 2. Case Schema

หนึ่งเคส = หนึ่งบรรทัดใน `golden_set_v1.jsonl`

```json
{
  "id": "gs1-0001",
  "input_text": "ซื้อหมูมา 5 โล โลละ 80 ขายได้ 600",
  "source": "real_log",                 // real_log | authored
  "difficulty_tier": "L3",              // L0–L4 (ข้อ 3)
  "difficulty_type": "compound_trade",  // (ข้อ 4)
  "should_abstain": false,              // true = เคสที่ระบบ "ควรไม่มั่นใจ"
  "ground_truth": {
    "transactions": [
      { "type": "expense", "category": "ต้นทุนสินค้า", "amount": 400, "note": "หมู 5 โล x 80" },
      { "type": "income",  "category": "รายได้การขาย",  "amount": 600 }
    ],
    "transaction_count": 2,
    "trade_link": true,                 // ต้องผูก trade_group_id ไหม
    "trade_group_label": "ซื้อ-ขายหมู"
  },
  "notes": "per-unit 5x80=400; compound buy+sell; ต้อง link เป็น trade group เดียว"
}
```

| field | ความหมาย | บังคับ |
|---|---|---|
| `id` | unique, prefix `gs1-` | ✅ |
| `input_text` | ข้อความ input ดิบ (เหมือนที่ user พิมพ์/พูด) | ✅ |
| `source` | มาจาก log จริง หรือ author เอง — ใช้เช็กสัดส่วนของจริง | ✅ |
| `difficulty_tier` | ความยากรวม L0–L4 | ✅ |
| `difficulty_type` | ประเภทที่ทำให้มันยาก (ตัวหลักของการ slice) | ✅ |
| `should_abstain` | `true` ถ้าคำตอบที่ถูกคือ "ระบบไม่ควรมั่นใจ/ควรถามต่อ" | ✅ |
| `ground_truth.transactions[]` | คำตอบที่ถูก แยกราย transaction | ✅ |
| `ground_truth.transaction_count` | จำนวน transaction ที่ถูก (single=1, compound≥2) | ✅ |
| `ground_truth.trade_link` | ต้องผูกเป็น trade_group เดียวไหม | ✅ |
| `notes` | เหตุผล/จุดที่ต้องระวัง สำหรับ reviewer | ทางเลือก |

---

## 3. `difficulty_tier` (ความยากรวม)

| tier | นิยาม | ตัวอย่าง |
|---|---|---|
| **L0** Trivial | single tx, จำนวนชัด, มี keyword หมวดตรง ๆ | `กาแฟ 50 บาท` |
| **L1** Easy | single tx, ต้อง normalize เล็กน้อย (เลขไทย/พูดเล่น ๆ) | `จ่ายค่ากาแฟห้าสิบ` |
| **L2** Medium | ต้อง disambiguate intent / per-unit math / หมวดโดยนัย | `ค่าปุ๋ย 200` · `ไข่โหลละ 50 สามโหล` |
| **L3** Hard | compound, หลายรายการ, intent-vs-object ขัดกัน | `ซื้อหมู 5 โล โลละ 80 ขายได้ 600` |
| **L4** Adversarial | จงใจหลอก rule / homonym / garden-path | `ซื้อข้าวสารกิน 120` (มี "ข้าว" แต่ไม่ใช่เกษตร) |

---

## 4. `difficulty_type` Taxonomy

แต่ละเคสมี **primary type หนึ่งตัว** (เลือกตัวที่ทำให้มันยากที่สุด)

| difficulty_type | นิยาม | ตัวอย่าง | stress metric ตัวไหน |
|---|---|---|---|
| `simple_single` | tx เดียว ชัดเจน | `ค่าเน็ต 599` | coverage baseline |
| `thai_numeral` | parse ตัวเลขไทย/หน่วยนัย (ห้าสิบ, สองพันห้า, ครึ่ง, โหล/กิโล) | `จ่ายไปสองพันห้า` | amount accuracy |
| `intent_object_conflict` | object keyword ชี้ทางนึง intent ชี้อีกทาง (structural leak ที่ #1 แก้) | `ค่าคนงานเก็บฟางข้าว` → เกษตร ไม่ใช่อาหาร | category accuracy + calibration |
| `agriculture_intent` | ควรเป็น กิจกรรมการเกษตร/เกษตรกร | `ค่ารถเกี่ยวข้าว` `ค่าปุ๋ย` | category accuracy (slice เกษตร) |
| `agriculture_false_positive` ⚠️ | **มีคำเกษตรแต่ไม่ใช่เกษตร** — กับดักของ rule ใหม่ | `ซื้อข้าวสารกิน` · `กาแฟ` · `ซื้อกบมาทอด` | **FASR (gate ตัวสำคัญ)** |
| `per_unit_pricing` | ต้องคูณ หน่วย × จำนวน | `มะม่วงโลละ 40 ห้าโล` | amount accuracy |
| `compound_trade` ⚠️ | ประโยคเดียว ต้นทุน + รายได้ ต้อง link trade_group | `ซื้อมา 400 ขายได้ 600` | FASR + trade-link accuracy |
| `compound_multi_item` | หลายรายการในประโยคเดียว (ไม่ใช่ trade) | `กาแฟ 50 ข้าว 40 น้ำ 10` | transaction_count accuracy |
| `implicit_category` | ไม่มี keyword หมวด ต้องเดา | `จ่ายให้ร้านป้าแดง 120` | abstain precision |
| `ambiguous_amount` | จำนวนกำกวม/มีหลายเลข | `ซื้อของ 3 อย่าง 200 กว่า ๆ` | should_abstain |
| `out_of_scope` | ไม่ใช่รายการการเงิน | `พรุ่งนี้ฝนตกไหม` | abstain recall |
| `code_switch_noise` | ไทย-อังกฤษปน + filler (เตรียม voice/ASR) | `เอ่อ จ่าย delivery ไป 65 นะ` | robustness (รายงานแยก, ยังไม่ gate) |

> ⚠️ = slice ความเสี่ยงสูง ต้องการ N มากขึ้น (ดูข้อ 5) และมี gate เฉพาะ (ข้อ 8)

---

## 5. Golden Set v1 — Composition (600 เคส)

**ปัญหาสถิติที่ต้องระวัง:** ถ้าแบ่ง slice ละ ~50 เคส แล้วผิด 1 เคส = 2% ทันที — resolution หยาบไป สำหรับ slice ที่เราต้องการ FASR ใกล้ศูนย์ ต้องเพิ่ม N

แนวทาง: **stratified** — การันตี N ขั้นต่ำต่อ slice เสี่ยง + ที่เหลือเติมให้สะท้อน traffic จริง (ส่วนใหญ่เป็น L0–L1)

| difficulty_type | จำนวนเป้าหมาย | เหตุผล |
|---|---|---|
| `simple_single` | 120 | สะท้อน traffic จริง + วัด coverage |
| `thai_numeral` | 60 | |
| `intent_object_conflict` | 60 | จุดที่ #1 เพิ่งแก้ ต้องวัดให้แน่น |
| `agriculture_intent` | 50 | |
| `agriculture_false_positive` ⚠️ | **80** | ต้องการ resolution ละเอียด (gate ใกล้ศูนย์) |
| `per_unit_pricing` | 50 | |
| `compound_trade` ⚠️ | **80** | high-risk ต่อ auto-save |
| `compound_multi_item` | 30 | |
| `implicit_category` | 30 | |
| `ambiguous_amount` | 20 | |
| `out_of_scope` | 20 | |
| `code_switch_noise` | 20 | |
| **รวม** | **620** | (≈600 ปัดได้ตามจริง) |

**Sourcing & labeling**
- เอา `real_log` มาก่อนถ้ามี log จริง (สำคัญสุด) ที่เหลือ author เติมให้ครบ slice
- label ด้วยคน + **double-review เฉพาะ slice ⚠️ และ L3/L4** (inter-annotator agreement สำคัญกับเคสกับดัก ถ้าคน label ยังไม่ตรงกัน parser ก็วัดไม่ได้)
- freeze เป็น `golden_set_v1` แล้วห้ามแก้

---

## 6. Metric Definitions

### Confidence bands (map กับ UI เดิม high/medium/low)

| band | เงื่อนไข | UI behavior (มีอยู่แล้ว) |
|---|---|---|
| **auto** | `conf ≥ τ_auto` | (จำลอง) auto-save / pre-select เต็ม — *ปัจจุบันยังกดเอง* |
| **suggest** | `τ_suggest ≤ conf < τ_auto` | chip "แนะนำ" กดยืนยัน 1 ครั้ง |
| **abstain** | `conf < τ_suggest` | ปุ่ม "เลือกหมวดหมู่" |

**ค่าเริ่มต้นที่เสนอ (Pu เคาะ):** `τ_auto = 0.90`, `τ_suggest = 0.60`

### นิยาม "ถูก" (สำคัญมาก)
เคสนับว่า **correct-for-auto-save** ก็ต่อเมื่อ **ครบทุกอย่าง**: `category` ✓ และ `amount` ทุกตัว ✓ และ `transaction_count` ✓ และ `trade_link` ✓ — partial match = ผิด (เพราะ auto-save commit ทั้งก้อน)

### Metric หลัก (gate)

**1. False-Auto-Save Rate (FASR)** — *ตัวสำคัญที่สุด*
```
FASR = (# เคสที่ conf ≥ τ_auto AND ผิด) / (# เคสที่ conf ≥ τ_auto)
```
> หมายเหตุให้ทีม: ตอนนี้ระบบไม่ auto-save จริง (ดีแล้ว) ฉะนั้น FASR คือ **simulation metric** — "ถ้าเราเปิด auto-save ที่ τ_auto มันจะผิดกี่ %" มันวัดว่า confidence เชื่อถือได้ไหม ถ้าสูง = ห้ามเปิด auto-save และต้อง abstain เยอะขึ้น

### Metric สนับสนุน

**2. Auto-save coverage** — กันการ "ไม่มั่นใจอะไรเลยเพื่อกด FASR ให้ต่ำ"
```
coverage = (# เคสที่ conf ≥ τ_auto) / (# เคสทั้งหมดที่ไม่ใช่ should_abstain)
```

**3. Suggestion accuracy** — band suggest เชื่อได้ไหม (กระทบ UX กดยืนยัน 1 ครั้ง)
```
= (# correct ใน band suggest) / (# เคสใน band suggest)
```

**4. Abstain precision / recall**
```
recall    = (# should_abstain ที่ระบบ abstain จริง) / (# should_abstain ทั้งหมด)
precision = (# abstain ที่ should_abstain จริง)     / (# ที่ระบบ abstain ทั้งหมด)
```
recall ต่ำ = ปล่อยของกำกวมหลุดไปมั่นใจ (อันตราย) · precision ต่ำ = abstain เกินเหตุ (friction)

**5. Per-field accuracy** — แยก `category` / `amount` / `transaction_count` / `trade_link` เพื่อรู้ว่า *ส่วนไหน* อ่อน

**6. Calibration / ECE** *(optional, ทำได้ก็ดี)* — bucket ตาม confidence แล้วเทียบ confidence เฉลี่ย vs accuracy จริงในแต่ละ bucket = วัด "confidence โกหกไหม" ตรง ๆ ถ้าไม่ทันรอบนี้ เลื่อนเป็น P3.5 ได้

---

## 7. Slicing Requirement

ทุก metric รายงาน **overall + แยกราย `difficulty_type`** เสมอ

slice ที่ต้องจ้องเป็นพิเศษ:
- **FASR @ `agriculture_false_positive`** — rule ใหม่ห้ามมั่นใจผิดบนกับดัก (ต้องใกล้ 0)
- **FASR @ `compound_trade`** + trade-link accuracy
- **Calibration @ `intent_object_conflict`**

---

## 8. Phase 4 Sign-off Gate Criteria *(เสนอ — Pu เคาะตัวเลข)*

Phase 4 จะ ship ได้เมื่อรันบน `golden_set_v1` แล้วผ่าน **ทุกข้อ**:

| เกณฑ์ | ค่าที่เสนอ |
|---|---|
| Overall FASR | ≤ 1.0% |
| FASR @ slice ⚠️ (เกษตร false-pos / compound_trade / intent_conflict) | ≤ 2.0% และ false-pos เกษตรเข้าใกล้ 0 |
| Auto-save coverage | ≥ 55% (ไม่งั้น feature ไม่มีประโยชน์) |
| Suggestion accuracy | ≥ 85% |
| Abstain recall (should_abstain) | ≥ 90% |
| Regression | FASR ทุก slice **ไม่แย่กว่า** baseline |

> ตัวเลขนี้คือ proposal เพื่อให้ทีมมีเป้า — Pu ปรับได้ตาม risk appetite ของโปรดักต์

---

## 9. Metrics Runner — Engineering Requirements

- **Input:** `golden_set_v1.jsonl`
- **Process:** รัน parser ปัจจุบันทุกเคส เก็บ `predicted parse` + `confidence`
- **Output:** (1) `report.json` machine-readable (2) ตารางสรุปอ่านง่าย (overall + ราย slice)
- **Deterministic:** pin parser version; local-rule ไม่ต่อ network; (ถ้าวันหน้าใส่ LLM → pin model + `temperature=0`)
- **CI-able:** รันได้บนทุก parser change → จับ regression อัตโนมัติ **อันนี้แหละคือตัวที่กลายเป็น gate ใน Phase 4**
- บันทึก baseline run แรก (parser + #1 ปัจจุบัน) ไว้เป็นจุดอ้างอิง

---

## 10. Out of Scope สำหรับ v1

- **LLM / Smart Assist fallback eval** — data-gated ยังไม่แตะ จนกว่า golden set + baseline จะเสร็จก่อน (นี่คือเหตุผลที่เราสร้าง golden set ตั้งแต่แรก)
- **Voice / ASR-noise slice** — `code_switch_noise` ใส่ไว้แล้วแต่ยัง report แยก ไม่ gate (ยังไม่ wire STT)
- เคสใหม่หลัง freeze → ไปลง `golden_set_v2`

---

### ลำดับงานที่แนะนำให้ทีมเริ่ม
1. ตกลง schema (ข้อ 2) + taxonomy (ข้อ 3–4) — ห้ามแก้หลังเริ่ม label
2. build metrics runner (ข้อ 6, 9) กับ data ตัวอย่าง 20–30 เคสก่อน เพื่อเช็กว่า metric คำนวณถูก
3. populate 600 เคสตามสัดส่วน (ข้อ 5) + double-review slice ⚠️
4. freeze → รัน **baseline** → รู้ว่า #1 ดีจริงไหม
5. เคาะ τ และ gate thresholds (ข้อ 6, 8) จากเลข baseline จริง
