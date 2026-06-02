# 🗂️ Moonoon-Poatung — Icon & Widget Inventory
> สร้าง: 27 พ.ค. 2569 | อัปเดตอัตโนมัติจากการสแกน source code

---

## ✅ A. PNG Custom Icons — ทำเสร็จแล้ว

### A1. Footer Tab Bar (`assets/menu-footer/`)
| ไฟล์ | แท็บ | หมายเหตุ |
|------|------|----------|
| `home.png` | หน้าหลัก | ✅ Custom PNG 42×42 + shadow |
| `report.png` | รายงาน | ✅ Custom PNG 42×42 + shadow |
| `add.png` | บันทึก (FAB กลาง) | ✅ Custom PNG 44×44 ใน circle 62×62 |
| `history.png` | ประวัติ | ✅ Custom PNG 42×42 + shadow |
| `settings.png` | ตั้งค่า | ✅ Custom PNG 42×42 + shadow |

### A2. Menu Widget Grid (`assets/menu-widget/`)
| ไฟล์ | เมนู | หมายเหตุ |
|------|------|----------|
| `add.png` | บันทึก | ✅ Custom 3D PNG 56×56 |
| `history.png` | ประวัติ | ✅ Custom 3D PNG 56×56 |
| `report.png` | รายงาน | ✅ Custom 3D PNG 56×56 |
| `scan.png` | สแกนสลิป | ✅ Custom 3D PNG 56×56 |
| `inbox.png` | Slip Inbox | ✅ Custom 3D PNG 56×56 |
| `recurring.png` | รายจ่ายประจำ | ✅ Custom 3D PNG 56×56 |
| `savings.png` | เป้าหมายออม | ✅ Custom 3D PNG 56×56 |
| `tax.png` | Tax Checklist | ✅ Custom 3D PNG 56×56 |
| `wallet.png` | กระเป๋าเงิน | ✅ Custom 3D PNG 56×56 |
| `export.png` | ส่งออก | ✅ Custom 3D PNG 56×56 |

### A3. ตัวละคร DailyMoneySnapshot (`assets/characters/`)
| ไฟล์ | ใช้ใน | หมายเหตุ |
|------|-------|----------|
| `moonoon-happy.png` | DailyMoneySnapshot (ยอดบวก) | ✅ AI Character 96×116 |
| `moonoon-sad.png` | DailyMoneySnapshot (ยอดลบ) | ✅ AI Character 96×116 |

### A4. Bank Icons (`assets/bank-icons/`)
| ไฟล์ | ธนาคาร | หมายเหตุ |
|------|--------|----------|
| `baac.png` | ธกส. | ✅ PNG |
| `bangkok-bank.png` | กรุงเทพ (BBL) | ✅ PNG |
| `gsb.png` | ออมสิน | ✅ PNG |
| `kbank.png` | กสิกรไทย | ✅ PNG |
| `krungsri.png` | กรุงศรี | ✅ PNG |
| `krungthai.png` | กรุงไทย | ✅ PNG |
| `scb.png` | ไทยพาณิชย์ | ✅ PNG |

### A5. Background Scenery (`assets/scenery/`)
| ไฟล์ | ช่วงเวลา | ใช้ใน |
|------|----------|-------|
| `bg-morning.png` | เช้า | HomeHeader background |
| `bg-day.png` | กลางวัน | HomeHeader background |
| `bg-evening.png` | เย็น | HomeHeader background |
| `bg-night.png` | กลางคืน | HomeHeader background |

---

## ❌ B. FontAwesome Icons — ยังไม่ได้ปรับปรุง

> ไอคอนเหล่านี้ยังใช้ `@expo/vector-icons/FontAwesome` (vector icon สีเดียว)
> สามารถเปลี่ยนเป็น Custom PNG หรือ Emoji ได้

---

### B1. 🏠 หน้าหลัก — HomeHeader (`components/home/HomeHeader.tsx`)
| Icon Name | ขนาด | สี | ใช้เป็น |
|-----------|------|----|---------|
| `user` | 23–26 | #fff | Avatar placeholder (กรณีไม่มีรูป) |
| `map-marker` | 10–11 | #FF8CA8 | ตำบล/Location label |
| `qrcode` | 14–15 | #FFFFFF | ปุ่ม QR ของฉัน |
| `credit-card` | 14–15 | #FFFFFF | ปุ่ม สแกนสลิป (quick action) |

### B2. 🏠 หน้าหลัก — DailyMoneySnapshot (`components/home/DailyMoneySnapshot.tsx`)
| Icon Name | ขนาด | สี | ใช้เป็น |
|-----------|------|----|---------|
| `calendar-o` | 10 | #fff | ไอคอนหน้า Date badge |
| `arrow-down` | 12 | GREEN | รายรับ income row |
| `arrow-up` | 12 | RED | รายจ่าย expense row |
| `plus` | 11 | #fff | ปุ่มขยาย/ยุบ monthly detail |
| `lightbulb-o` | 13 | titleBtnColor | ไอคอน insight/สรุป |

### B3. ⚙️ Settings Screen (`app/(tabs)/settings.tsx`)
| Icon Name | ขนาด | สี | รายการเมนู |
|-----------|------|----|-----------|
| `repeat` | 16 | #2196F3 | รายจ่ายประจำ |
| `bullseye` | 16 | #FF9800 | เป้าหมายการออม |
| `qrcode` | 16 | #009688 | สแกนสลิป |
| `inbox` | 16 | #0EA5E9 | Slip Inbox |
| `check-square-o` | 16 | #7C3AED | Tax Checklist |
| `bar-chart` | 16 | #673AB7 | รายงานและกราฟ |
| `money` | 16 | #4CAF50 | กระเป๋าเงิน |
| `th-large` | 16 | #FF9800 | หมวดหมู่ |
| `magic` | 16 | #7C3AED | Starter Templates |
| `cloud-upload` | 16 | #9C27B0 | สำรองและกู้คืนข้อมูล |
| `file-text-o` | 16 | #607D8B | ส่งออกรายงาน |
| `bell` | 16 | #FF5722 | การแจ้งเตือน |
| `lock` | 16 | #F44336 | ล็อคแอป |
| `moon-o` | 16 | #3F51B5 | ธีม (Dark/Light mode) |
| `chevron-right` | 12 | textSecondary | ลูกศรขวา (ทุก row) |

### B4. ➕ Add Transaction Screen (`app/(tabs)/add.tsx`)
| Icon Name | ขนาด | สี | ใช้เป็น |
|-----------|------|----|---------|
| `magic` | 16 | #42A5F5 | AI parse hint (นำหน้า text input) |
| `microphone` | 17 | #42A5F5 | ปุ่ม Mic (voice input) |
| `wifi` | — | #42A5F5 | Voice session active state |
| `calendar` | 18 | #42A5F5 | Row เลือกวันที่ |
| `chevron-right` | — | textSecondary | ปลาย row วันที่ |
| `pencil` | 18 | #42A5F5 | Row หมายเหตุ |

### B5. 📋 History Screen (`app/(tabs)/history.tsx`)
| Icon Name | ขนาด | สี | ใช้เป็น |
|-----------|------|----|---------|
| `chevron-left` | 15 | tint | ปุ่มเดือนก่อนหน้า |
| `chevron-right` | 15 | tint | ปุ่มเดือนถัดไป |

### B6. 📊 Report Screen (`app/report.tsx`)
| Icon Name | ขนาด | สี | ใช้เป็น |
|-----------|------|----|---------|
| `chevron-left` | 18 | #FFFFFF | ปุ่มกลับ (header) |
| `chevron-left` | 14 | rgba(255,255,255,0.85) | ปุ่มเดือนก่อนหน้า |
| `bar-chart` | 22 | #7C3AED | Section icon Charts |

### B7. 📷 Scan Slip Screen (`app/scan-slip.tsx`)
| Icon Name | ขนาด | สี | ใช้เป็น |
|-----------|------|----|---------|
| `qrcode` | 40 | tint | Empty state illustration |
| `camera` | 26 | #2196F3 | Option: ถ่ายรูป |
| `image` | 26 | #4CAF50 | Option: เลือกจาก Gallery |
| `chevron-right` | 14 | textSecondary | ปลาย option row |
| `arrow-left` | 18 | #FFF | ปุ่มกลับ (camera mode) |
| `image` | 22 | #FFF | ปุ่ม Pick image (camera bar) |
| `check-circle` | 32 | income | Duplicate found - success icon |
| `exclamation-triangle` | 28 | #FF9800 | Duplicate warning |
| `camera` | 18 | #FFF | ปุ่ม สแกนใหม่ |
| `refresh` | 16 | textSecondary | ปุ่ม ลองใหม่ |
| `exclamation-triangle` | 24 | #FF9800 | Error state |
| `check-circle` | 20 | tint | Field confirmed ✓ |
| `check` | 18 | #FFF | ปุ่ม ยืนยัน/บันทึก |
| `times` | 16 | #F44336 | ปุ่ม ยกเลิก |
| `refresh` | 16 | textSecondary | ปุ่ม สแกนใหม่ (bottom) |
| dynamic `icon` | 14 | tint | ไอคอนประจำ field (สลิป detail) |

### B8. 🔁 Recurring Screen (`app/recurring.tsx`)
| Icon Name | ขนาด | สี | ใช้เป็น |
|-----------|------|----|---------|
| `refresh` | 14 | tint | ปุ่มตรวจสอบรายการครบกำหนด |
| `trash` | 16 | expense | ปุ่มลบ rule |
| `plus-circle` | 20 | tint | ปุ่มเพิ่มรายจ่ายประจำ |
| `times` | 22 | textSecondary | ปิด modal |

### B9. 🎯 Savings Screen (`app/savings.tsx`)
| Icon Name | ขนาด | สี | ใช้เป็น |
|-----------|------|----|---------|
| `trash` | 14 | expense | ปุ่มลบเป้าหมาย |
| `plus-circle` | 20 | #FF9800 | ปุ่มเพิ่มเป้าหมาย |
| `times` | 22 | textSecondary | ปิด modal |
| `calendar` | 16 | #FF9800 | วันที่ใน modal |

### B10. 💼 Wallet Manage (`app/wallet-manage.tsx`)
| Icon Name | ขนาด | สี | ใช้เป็น |
|-----------|------|----|---------|
| `pencil` | 16 | tint | ปุ่มแก้ไข wallet |
| `trash` | 16 | expense | ปุ่มลบ wallet |
| `plus-circle` | 20 | tint | ปุ่มเพิ่ม wallet |
| `exchange` | 18 | transfer | ปุ่มโอนเงิน |
| `times` | 22 | textSecondary | ปิด modal |

### B11. 💳 Wallet Detail (`app/wallet/[id].tsx`)
| Icon Name | ขนาด | สี | ใช้เป็น |
|-----------|------|----|---------|
| `arrow-down` | 16 | tint | Activity: income |
| `arrow-up` | 16 | tint | Activity: expense |
| `exchange` | 16 | tint | Activity: transfer in/out |
| `trash` | 16 | expense | Activity: deleted |

### B12. 📤 Export Report (`app/export-report.tsx`)
| Icon Name | ขนาด | สี | ใช้เป็น |
|-----------|------|----|---------|
| `chevron-left` | 18 | tint | เดือนก่อนหน้า |
| `chevron-right` | 18 | tint | เดือนถัดไป |
| `file-text` | 22 | #4CAF50 | CSV icon (card) |
| `share-square-o` | 16 | #FFF | ปุ่ม Export CSV |
| `file-code-o` | 22 | #FF9800 | HTML icon (card) |
| `share-square-o` | 16 | #FFF | ปุ่ม Export HTML |

### B13. 🏦 Backup Screen (`app/backup.tsx`)
| Icon Name | ขนาด | สี | ใช้เป็น |
|-----------|------|----|---------|
| `cloud-upload` | 28 | #9C27B0 | Backup section icon (card) |
| `download` | 16 | #FFF | ปุ่ม Backup |
| `cloud-download` | 28 | #00BCD4 | Restore section icon (card) |
| `upload` | 16 | #FFF | ปุ่ม Restore |
| dynamic | — | — | History list icons |

### B14. 🔔 Notification Settings (`app/notification-settings.tsx`)
| Icon Name | ขนาด | สี | ใช้เป็น |
|-----------|------|----|---------|
| `bell` | 22 | #FF5722 | Header icon |
| `bell-o` | 16 | #FFF | ปุ่ม ทดสอบส่งแจ้งเตือน |

### B15. 🔒 App Lock Screen (`app/app-lock.tsx`)
| Icon Name | ขนาด | สี | ใช้เป็น |
|-----------|------|----|---------|
| `lock` | 28 | tint | Main icon header |
| `check-circle` | 32 | income | PIN success state |
| `arrow-left` | 22 | textSecondary | Numpad backspace |
| `lock` | 22 | #F44336 | PIN error state |
| `hand-stop-o` | 22 | #4CAF50 | Biometric enabled icon |
| `key` | 16 | tint | ปุ่ม ตั้ง PIN |
| `chevron-right` | 12 | textSecondary | Row ลูกศรขวา |
| `trash` | 16 | expense | ปุ่ม ลบ PIN |

### B16. 🔐 Lock Screen (`components/auth/LockScreen.tsx`)
| Icon Name | ขนาด | สี | ใช้เป็น |
|-----------|------|----|---------|
| `hand-stop-o` | 22 | #fff | ปุ่ม Biometric |
| `arrow-left` | 22 | rgba(255,255,255,0.8) | ปุ่ม Backspace numpad |

### B17. 🏷️ Category Manage (`app/category-manage.tsx`)
| Icon Name | ขนาด | สี | ใช้เป็น |
|-----------|------|----|---------|
| `pencil` | 14 | tint | ปุ่มแก้ไข category |
| `trash` | 14 | expense | ปุ่มลบ category |
| `plus-circle` | 18 | #FF9800 | ปุ่มเพิ่มหมวดหมู่ |
| `times` | 22 | textSecondary | ปิด modal |
| `check` | 14 | #FFF | สัญลักษณ์สีที่เลือก |

### B18. 📋 Tax Readiness (`app/tax-readiness.tsx`)
| Icon Name | ขนาด | สี | ใช้เป็น |
|-----------|------|----|---------|
| `check-circle` | 20 | #4CAF50 | Status: ready |
| `exclamation-circle` | 20 | #FF9800 | Status: needs-review |
| `circle-o` | 20 | #9CA3AF | Status: not-started |
| `info-circle` | 18 | #F57C00 | Info banner |

### B19. 📬 Slip Inbox (`app/slip-inbox.tsx`)
| Icon Name | ขนาด | สี | ใช้เป็น |
|-----------|------|----|---------|
| `inbox` | 18 | statusColor | Status: pending |
| `exclamation-circle` | 18 | statusColor | Status: needs_review |
| `check-circle` | 18 | statusColor | Status: confirmed |
| `file-text-o` | 18 | statusColor | Status: tax_evidence |
| `ban` | 18 | statusColor | Status: skipped |

### B20. 💳 Wallet Transfer (`app/wallet-transfer.tsx`)
| Icon Name | ขนาด | สี | ใช้เป็น |
|-----------|------|----|---------|
| `exchange` | — | — | icon ตรงกลาง transfer |

### B21. 📋 Starter Templates (`app/starter-templates.tsx`)
| Icon Name | ขนาด | สี | ใช้เป็น |
|-----------|------|----|---------|
| `plus-circle` | 16 | #FFF | ปุ่ม Apply template |
| `search` | 16 | textSecondary | Search icon |
| `times-circle` | 18 | textSecondary | Clear search |
| `times-circle` | 20 | textSecondary | ปิด modal / filter |

### B22. 🔔 Snackbar Provider (`components/ui/SnackbarProvider.tsx`)
| Icon Name | ขนาด | สี | ใช้เป็น |
|-----------|------|----|---------|
| `check-circle` | 22 | #FFFFFF | Variant: success |
| `times-circle` | 22 | #FFFFFF | Variant: error |
| `exclamation-triangle` | 22 | #FFFFFF | Variant: warning |
| `info-circle` | 22 | #FFFFFF | Variant: info |
| `times` | 13 | rgba(255,255,255,0.72) | ปุ่ม Dismiss |

### B23. ↕️ Swipeable Transaction Item (`components/transaction/SwipeableTransactionItem.tsx`)
| Icon Name | ขนาด | สี | ใช้เป็น |
|-----------|------|----|---------|
| `pencil` | 18 | #FFF | Swipe right: แก้ไข |
| `trash` | 18 | #FFF | Swipe left: ลบ |

### B24. 🔍 Transaction Filter (`components/transaction/TransactionFilter.tsx`)
| Icon Name | ขนาด | สี | ใช้เป็น |
|-----------|------|----|---------|
| `search` | 14 | textSecondary | ไอคอนค้นหา |
| `times-circle` | 16 | textSecondary | Clear search text |
| `times` | 10 | textSecondary | Clear chip filter |

---

## 🎯 C. Emoji Icons — ใช้ใน UI โดยตรง

### C1. Category Icon ใน TransactionItem
> ดึงจาก DB field `categoryIcon` — เป็น emoji ที่ user เลือกเอง
| Emoji | ความหมาย | Fallback |
|-------|----------|----------|
| จาก DB | หมวดหมู่ที่ user กำหนด | `📦` (ไม่มีหมวดหมู่) |
| `🔄` | โอนเงิน (transfer) | hardcoded |

### C2. Wallet Icon
> Wallet แต่ละอันมี emoji icon เลือกจาก picker ใน wallet-manage.tsx
- Default: `💰`  
- ตัวเลือก Generic: `💰 💵 💴 💶 💷 🏦 💳 🪙 💎 ...`  
- Bank Presets: ใช้ bank logo image แบบ encoded

### C3. Settings Header
| Emoji | ที่อยู่ | ใช้เป็น |
|-------|--------|---------|
| `💰` | settings.tsx header | App logo placeholder (font size 48) |

### C4. Category Emoji List (category-manage.tsx)
> ผู้ใช้เลือก emoji ให้หมวดหมู่:
```
🍜 🚗 🏠 ⚡ 📱 🛒 🏥 🎓 🎮 👕
📦 💰 💼 🏦 🎁 🍺 ☕ 🎬 ✂️ 🏋️
🐶 💊 📚 🎵 🛫 🎂 🔧 🧹 👶 💄
```

---

## 📊 D. สรุปภาพรวม

| ประเภท | จำนวน | สถานะ |
|--------|-------|-------|
| Footer Tab PNG | 5 | ✅ เสร็จแล้ว |
| Menu Widget PNG | 10 | ✅ เสร็จแล้ว |
| Character PNG | 2 | ✅ เสร็จแล้ว |
| Bank Icon PNG | 7 | ✅ เสร็จแล้ว |
| Scenery BG PNG | 4 | ✅ เสร็จแล้ว |
| **Settings icons (HighPri)** | **14** | ❌ ยังเป็น FontAwesome |
| HomeHeader icons | 4 | ❌ ยังเป็น FontAwesome |
| DailySnapshot icons | 5 | ❌ ยังเป็น FontAwesome |
| Utility icons (chevron/pencil/trash/times/plus...) | ~35 | ❌ ยังเป็น FontAwesome |
| State icons (check-circle/warning/error) | ~20 | ❌ ยังเป็น FontAwesome |
| Emoji icons (category/wallet) | dynamic | ✅ ใช้ emoji โดยตรง (ไม่ต้อง custom) |

---

## 🚦 E. ลำดับความสำคัญแนะนำ

### 🔴 Priority 1 — เห็นบ่อย / visible ทุก session
- [ ] **Settings icons (14 ไอคอน)** — เห็นทุกครั้งที่เปิดหน้าตั้งค่า → แนะนำ custom PNG ขนาด 36×36 round
- [ ] **HomeHeader** — `user` avatar, `map-marker`, `qrcode`, `credit-card`
- [ ] **DailySnapshot** — `arrow-down/up`, `calendar-o`, `plus`, `lightbulb-o`

### 🟡 Priority 2 — หน้าฟีเจอร์หลัก
- [ ] **Add Screen** — `magic`, `microphone`, `calendar`, `pencil`
- [ ] **Scan Slip** — `camera`, `image`, `check-circle`, `exclamation-triangle`
- [ ] **Backup/Export** — `cloud-upload`, `cloud-download`, `file-text`, `file-code-o`
- [ ] **Notification/AppLock** — `bell`, `lock`, `hand-stop-o`, `key`

### 🟢 Priority 3 — Utility (ใช้ซ้ำทั่วแอป)
- [ ] **chevron-left/right** (month nav, back button) — ใช้ใน history, report, export
- [ ] **pencil + trash + plus-circle + times** — CRUD actions ทั่วแอป
- [ ] **Snackbar icons** — check-circle, times-circle, exclamation-triangle, info-circle
- [ ] **Swipeable** — pencil + trash บน swipe gesture

### ⚪ Priority 4 — ไม่จำเป็น (ไม่แนะนำเปลี่ยน)
- `WebUiPreviewApp.tsx` — Preview mode เท่านั้น ไม่ใช่ production UI
- Emoji icons ใน category/wallet — user กำหนดเอง → เปลี่ยนไม่ได้

---

*ไฟล์นี้สร้างโดย Claude Code จากการสแกน source ทุกไฟล์ใน `app/` และ `components/`*
