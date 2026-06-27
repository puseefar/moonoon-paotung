# Golden Set v1 + Metrics Runner (Phase 3)

อ้างอิงสเปก: `../../poatung_phase3_golden_set_spec.md`

## ไฟล์
- `golden_set_v1.jsonl` — เคส + ground truth (1 บรรทัด = 1 เคส, schema ตาม spec §2)
- `run-golden-set.cjs` — metrics runner (โหลด parser ปัจจุบันแบบ deterministic, ไม่ต่อ network)
- `baseline.json` — baseline run ที่ freeze ไว้เป็นจุดอ้างอิง (parser + #1 agriculture rule)
- `report.json` — ผลรันล่าสุด (machine-readable + รายการ auto-band failures)

## รัน
```bash
npm run test:golden            # รายงาน overall + ราย slice → เขียน report.json
npm run test:golden:baseline   # บันทึก baseline.json ใหม่ (ทำตอน freeze เท่านั้น)
npm run test:golden:check      # CI gate: fail ถ้า FASR slice ใด "แย่กว่า" baseline
```

## หลักการสำคัญ
- **band map (parser เป็น categorical):** `high→auto`, `medium→suggest`, `low→abstain` (§6)
- **FASR = (auto-band ∧ ผิด) / auto-band** — simulation metric วัด calibration ("confidence โกหกไหม")
- **correct-for-auto-save = ครบทุก field** (category + amount + count + trade_link); partial = ผิด
- compound (count≥2): ไม่นับ category ราย leg (deterministic ที่ UI: cost→ต้นทุนขาย, revenue→business) — นับ count + trade_link + amounts
- หมวดรายขาของ trade-set ตรวจด้วย mini regression แยกใน `tests/market-intent` (cost/revenue/businessActivity) เพื่อกันบั๊ก state ขัดกันเองบนการ์ด

## สถานะปัจจุบัน: v1-SEED (ยังไม่ freeze ของจริง)
103 เคส authored ครบ 12 `difficulty_type` เน้น slice ⚠️ ที่วัด #1 (agriculture).
**ก่อน freeze v1 จริง (spec §5):** ทีมต้องเติม `real_log` + author ให้ครบ ~620 ตามสัดส่วน + **double-review slice ⚠️ และ L3/L4**. เคสใหม่หลัง freeze → `golden_set_v2`.

## Baseline (current = parser + #1 agriculture rule + findCategory null-fix)
findCategory คืน `null` เมื่อ no-match จริง (เลิก fallback "อื่นๆ") → confidence low → abstain.
ผลเทียบก่อน/หลัง fix บน seed 103:

| metric | ก่อน fix | หลัง fix |
|---|---|---|
| Abstain recall | 22.2% | **55.6%** ⬆️ |
| FASR (overall) | 55.6% | **20.0%** ⬇️ |
| Auto-save coverage | 16.5% | 11.8% (ตกเล็กน้อย) |
| Agriculture TP recall (#1) | — | **60.9%** (14/23) |

**ผลกระทบ quick-add regression suite:** type/amount ยัง 100% · category 100%→89.9% (30 เคส catch-all "อื่นๆ" เช่น เพื่อนยืมเงิน/ถูกหวย/แม่ขอเงิน ตอนนี้ abstain แทน — trade-off ที่ตั้งใจ)

### คำตอบ #1 (ครบทั้ง precision + recall)
- ✅ **precision ปลอดภัย:** `agriculture_false_positive` FASR = **0%** (ไม่ over-fire บน ข้าวสาร/กาแฟ/จ่ายตลาด)
- ⚠️ **recall ยังไม่ครบ 60.9%:** miss ฝั่ง income ("ขายข้าวเปลือก/ขายไข่ไก่/ขายผักสวนครัว" → ธุรกิจส่วนตัว แทน เกษตรกร) + object-leak ("อาหารหมูที่เลี้ยง"→อาหาร, "น้ำมันสูบน้ำเข้านา"→เดินทาง). misses เกือบหมดเป็น band suggest (ไม่ confidently-wrong)
- **→ เป้า Phase 4:** ดัน agri recall ขึ้นโดย FASR ทุก slice ไม่แย่กว่า baseline (รัน `test:golden:check`)

> baseline เต็มอยู่ใน `baseline.json`. ยังไม่เคาะ τ/gate thresholds จริงจนกว่าจะมี golden set เต็ม 620 (spec §8) — coverage ในตารางต่ำเพราะ seed เป็น stress-weighted (should_abstain/L3-L4 เยอะ) ไม่ใช่ traffic จริง
