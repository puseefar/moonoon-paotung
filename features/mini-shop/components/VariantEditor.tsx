import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, Switch, StyleSheet, Alert, ScrollView,
} from 'react-native';
import { resolveVariantPrice, type VariantOptionGroup, type VariantValue } from '@/lib/api/contract';

const PRESET_GROUPS: { name: string; icon: string; presets: string[] }[] = [
  // ── สี ──────────────────────────────────────────────────
  {
    name: 'สี', icon: '🎨',
    presets: ['ขาว', 'ดำ', 'เทา', 'น้ำเงิน', 'ฟ้า', 'เขียว', 'เหลือง', 'ส้ม', 'แดง', 'ชมพู', 'ม่วง', 'น้ำตาล', 'ครีม', 'สุ่มสี'],
  },
  // ── ขนาดเสื้อผ้าสากล ────────────────────────────────────
  {
    name: 'ขนาด', icon: '👗',
    presets: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', 'Free Size'],
  },
  // ── นิ้ว — ใช้กับเอว/กางเกง/กระถาง หรืออื่นๆ ────────────
  {
    name: 'นิ้ว', icon: '📏',
    presets: ['26', '27', '28', '29', '30', '31', '32', '33', '34', '36', '38', '40', '42', '44', '46', '48'],
  },
  // ── ไซส์ — ใช้กับรองเท้า/เสื้อ/กางเกง ────────────────────
  {
    name: 'ไซส์', icon: '👟',
    presets: ['34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'],
  },
  // ── เซนติเมตร — ใช้กับขนาดกว้าง/ยาว/สูง ──────────────────
  {
    name: 'เซนติเมตร', icon: '📐',
    presets: ['10cm', '15cm', '20cm', '25cm', '30cm', '35cm', '40cm', '45cm', '50cm', '60cm', '70cm', '80cm', '100cm'],
  },
  // ── น้ำหนัก ─────────────────────────────────────────────
  {
    name: 'น้ำหนัก', icon: '⚖️',
    presets: ['50g', '100g', '150g', '200g', '250g', '500g', '750g', '1kg', '1.5kg', '2kg', '3kg', '5kg', '10kg'],
  },
  // ── ปริมาตร ─────────────────────────────────────────────
  {
    name: 'ปริมาตร', icon: '🧴',
    presets: ['50ml', '100ml', '200ml', '250ml', '500ml', '750ml', '1L', '1.5L', '2L', '5L'],
  },
  // ── ปริมาณ/แพ็ค ─────────────────────────────────────────
  {
    name: 'แพ็ค', icon: '📦',
    presets: ['1 ชิ้น', '2 ชิ้น', '3 ชิ้น', '5 ชิ้น', '1 แพ็ค', '1 กล่อง', '1 โหล', '1 ลัง'],
  },
  // ── แบบ/รุ่น ─────────────────────────────────────────────
  {
    name: 'แบบ', icon: '✨',
    presets: ['แบบ A', 'แบบ B', 'แบบ C', 'รุ่น 1', 'รุ่น 2', 'รุ่น 3'],
  },
];

function genId(label: string): string {
  return label.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now().toString(36);
}

// ── Color chip mapping (PKG-05 ข้อ 2) ───────────────────────
// เฉพาะกลุ่ม "สี": พื้นหลัง = สีจริง, ตัวอักษร = ดำ/ขาว ตาม luminance (กันอ่านไม่ออกบนสีเข้ม)
const TH_COLOR_HEX: Record<string, string> = {
  'ขาว': '#FFFFFF', 'ดำ': '#1F2937', 'เทา': '#9CA3AF',
  'น้ำเงิน': '#2563EB', 'ฟ้า': '#38BDF8', 'เขียว': '#22C55E',
  'เหลือง': '#FDE047', 'ส้ม': '#FB923C', 'แดง': '#EF4444',
  'ชมพู': '#F9A8D4', 'ม่วง': '#A855F7', 'น้ำตาล': '#92400E', 'ครีม': '#FEF3C7',
};

function textOn(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const L = 0.299 * r + 0.587 * g + 0.114 * b; // 0–255
  return L > 150 ? '#000' : '#FFF';
}

// คืน { bg, fg } สำหรับ chip ของ label — ถ้าเป็นสีที่รู้จักใช้สีจริง, ไม่งั้น default ม่วงอ่อน
function chipColors(groupName: string, label: string): { bg: string; fg: string } {
  if (groupName === 'สี') {
    const hex = TH_COLOR_HEX[label.trim()];
    if (hex) return { bg: hex, fg: textOn(hex) };
  }
  return { bg: '#EDE9FE', fg: '#7C3AED' };
}

interface Props {
  enabled: boolean;
  group: VariantOptionGroup | null;
  baseStock: number;
  basePrice: number;        // ราคาตั้งต้น — ใช้ "seed" ราคา variant ใหม่เท่านั้น (ไม่ผูกย้อนกลับ)
  onToggle: (enabled: boolean) => void;
  onChange: (group: VariantOptionGroup | null) => void;
}

export function VariantEditor({ enabled, group, baseStock, basePrice, onToggle, onChange }: Props) {
  const [groupName, setGroupName] = useState(group?.name ?? 'สี');
  const [showPresets, setShowPresets] = useState(false);

  function addValue(label: string) {
    if (!label.trim()) return;
    const existing = group?.values ?? [];
    if (existing.length >= 6) { Alert.alert('', 'เพิ่มได้สูงสุด 6 ตัวเลือก'); return; }
    if (existing.some(v => v.label === label)) return;
    // PKG-05.2: seed ราคา variant ใหม่ = "ราคาต่ำสุดของตัวเลือกที่มีอยู่" (auto, แก้ไขได้)
    // ถ้ายังไม่มีตัวเลือกเลย → ใช้ basePrice prop (= ราคาตั้งต้นจากหน้าหลัก ถ้ามี)
    // หลัง seed แล้ว variant เป็นอิสระทันที (absolute price)
    const seedPrice = existing.length
      ? Math.min(...existing.map(v => resolveVariantPrice(basePrice, v)))
      : basePrice;
    const newVal: VariantValue = { id: genId(label), label, stock: 5, price: seedPrice };
    const updated: VariantOptionGroup = { name: groupName, values: [...existing, newVal] };
    onChange(updated);
  }

  function removeValue(id: string) {
    if (!group) return;
    const values = group.values.filter(v => v.id !== id);
    onChange(values.length ? { ...group, values } : null);
  }

  function updateValueStock(id: string, stock: number) {
    if (!group) return;
    onChange({ ...group, values: group.values.map(v => v.id === id ? { ...v, stock } : v) });
  }

  // เก็บราคาขายเป็นค่า ABSOLUTE ต่อ variant (addendum v1.1) — ไม่ใช่ delta จาก base อีกต่อไป
  function updateValuePrice(id: string, price: number) {
    if (!group) return;
    onChange({
      ...group,
      values: group.values.map(v =>
        v.id === id ? { ...v, price, extraPrice: undefined } : v),
    });
  }

  // ต้นทุนเก็บเป็นค่าสัมบูรณ์ (ไม่ใช่ delta) · undefined = ยังไม่ตั้ง (ห้ามเดา = 0)
  function updateValueCost(id: string, cost: number | undefined) {
    if (!group) return;
    onChange({ ...group, values: group.values.map(v => v.id === id ? { ...v, costPrice: cost } : v) });
  }

  function handleGroupNameChange(name: string) {
    setGroupName(name);
    if (group) onChange({ ...group, name });
  }

  const totalStock = group?.values.reduce((s, v) => s + v.stock, 0) ?? 0;
  const presetList = PRESET_GROUPS.find(g => g.name === groupName)?.presets ?? [];

  return (
    <View>
      {/* Toggle */}
      <View style={styles.toggleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.toggleLabel}>เปิดใช้ตัวเลือกสินค้า (สี/ขนาด)</Text>
          <Text style={styles.toggleSub}>
            {enabled ? `รวมสต็อก ${totalStock} ชิ้น` : `สต็อกรวม ${baseStock} ชิ้น`}
          </Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={v => { onToggle(v); if (!v) onChange(null); }}
          trackColor={{ false: 'rgba(167,139,250,0.3)', true: '#7C3AED' }}
          thumbColor="#fff"
        />
      </View>

      {enabled && (
        <View style={{ marginTop: 12, gap: 12 }}>
          {/* Group name — horizontal scroll picker */}
          <View>
            <Text style={styles.fieldLabel}>ประเภทตัวเลือก</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 7, paddingRight: 4 }}
              style={{ marginBottom: 8 }}>
              {PRESET_GROUPS.map(pg => (
                <Pressable key={pg.name} onPress={() => handleGroupNameChange(pg.name)}
                  style={[styles.presetPill, groupName === pg.name && styles.presetPillActive]}>
                  <Text style={{ fontSize: 13 }}>{pg.icon}</Text>
                  <Text style={{ fontSize: 12, fontWeight: '700',
                    color: groupName === pg.name ? '#fff' : '#7C5CB8' }}>{pg.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {/* Custom name input */}
            <TextInput
              value={groupName} onChangeText={handleGroupNameChange}
              placeholder="หรือพิมพ์ชื่อตัวเลือกเอง เช่น รสชาติ / กลิ่น / วัสดุ"
              placeholderTextColor="#C4B5D8"
              style={styles.input}
            />
          </View>

          {/* Current values */}
          {group && group.values.length > 0 && (
            <View>
              <Text style={styles.fieldLabel}>ตัวเลือก ({group.values.length}/6)</Text>
              {group.values.map(v => {
                const sellPrice = resolveVariantPrice(basePrice, v);
                const hasCost = v.costPrice != null && v.costPrice > 0;
                const grossProfit = hasCost ? sellPrice - (v.costPrice as number) : null;
                return (
                <View key={v.id} style={styles.valueRow}>
                  {/* แถวบน: ชื่อ + ลบ */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {(() => {
                      const { bg, fg } = chipColors(group.name, v.label);
                      return (
                        <View style={{ width: 28, height: 28, borderRadius: 8,
                          backgroundColor: bg, justifyContent: 'center', alignItems: 'center',
                          borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' }}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: fg }}>
                            {v.label.slice(0, 2)}
                          </Text>
                        </View>
                      );
                    })()}
                    <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: '#2D1B69' }}>
                      {v.label}
                    </Text>
                    {grossProfit !== null && (
                      <Text style={{ fontSize: 11, fontWeight: '700',
                        color: grossProfit >= 0 ? '#059669' : '#DC2626' }}>
                        กำไร ฿{grossProfit.toLocaleString()}
                      </Text>
                    )}
                    <Pressable onPress={() => removeValue(v.id)} style={{ padding: 4 }}>
                      <Text style={{ color: '#FECACA', fontSize: 14, fontWeight: '700' }}>✕</Text>
                    </Pressable>
                  </View>

                  {/* แถวล่าง: สต็อก · ราคาขาย · ต้นทุน */}
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 8 }}>
                    {/* Stock counter */}
                    <View>
                      <Text style={styles.miniLabel}>สต็อก</Text>
                      <View style={styles.stockCtrl}>
                        <Pressable onPress={() => updateValueStock(v.id, Math.max(0, v.stock - 1))}
                          style={styles.stockBtn}>
                          <Text style={{ color: '#7C3AED', fontWeight: '700' }}>−</Text>
                        </Pressable>
                        <TextInput
                          value={String(v.stock)}
                          onChangeText={t => {
                            const n = parseInt(t.replace(/[^0-9]/g, ''), 10);
                            updateValueStock(v.id, isNaN(n) ? 0 : Math.max(0, n));
                          }}
                          keyboardType="numeric"
                          selectTextOnFocus
                          style={[styles.stockVal, { paddingVertical: 0 }]}
                        />
                        <Pressable onPress={() => updateValueStock(v.id, v.stock + 1)}
                          style={styles.stockBtn}>
                          <Text style={{ color: '#7C3AED', fontWeight: '700' }}>+</Text>
                        </Pressable>
                      </View>
                    </View>

                    {/* ราคาขาย (absolute ต่อ variant) — MoneyInput เก็บ string ดิบ กันจุดทศนิยมหาย */}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.miniLabel}>฿ ราคาขาย</Text>
                      <MoneyInput
                        initial={sellPrice}
                        onChangeNumber={n => updateValuePrice(v.id, n != null && n > 0 ? n : 0)}
                        placeholder={String(basePrice)}
                        style={styles.priceInput}
                      />
                    </View>

                    {/* ต้นทุน (สัมบูรณ์, optional) */}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.miniLabel}>฿ ต้นทุน</Text>
                      <MoneyInput
                        initial={v.costPrice}
                        onChangeNumber={n => updateValueCost(v.id, n != null && n > 0 ? n : undefined)}
                        placeholder="—"
                        style={[styles.priceInput, { borderColor: 'rgba(167,139,250,0.25)' }]}
                      />
                    </View>
                  </View>
                </View>
                );
              })}
              <Text style={{ fontSize: 11, color: '#9B7FC8', marginTop: 6 }}>
                💡 ใส่ต้นทุนแต่ละตัวเลือกเพื่อให้รายงานกำไรถูกต้อง (เว้นว่างได้ถ้ายังไม่ทราบ)
              </Text>
            </View>
          )}

          {/* Add from presets */}
          {presetList.length > 0 && (
            <View>
              <Text style={styles.fieldLabel}>เพิ่มจากรายการสำเร็จรูป</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                {presetList.map(p => {
                  const already = group?.values.some(v => v.label === p);
                  return (
                    <Pressable key={p} onPress={() => addValue(p)}
                      disabled={already}
                      style={[styles.presetChip, already && { opacity: 0.35 }]}>
                      <Text style={{ fontSize: 12, fontWeight: '700',
                        color: already ? '#9B7FC8' : '#5B21B6' }}>
                        {already ? '✓ ' : '+ '}{p}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Custom add */}
          {(group?.values.length ?? 0) < 6 && (
            <AddValueInput onAdd={addValue} placeholder={`เพิ่ม${groupName}ใหม่...`} />
          )}

          {/* Total stock + price range info */}
          {group && group.values.length > 0 && (
            <View style={{ backgroundColor: 'rgba(124,58,237,0.06)',
              borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(124,58,237,0.15)',
              padding: 10, gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 12, color: '#5B21B6', fontWeight: '600' }}>รวมสต็อกทุกตัวเลือก</Text>
                <Text style={{ fontSize: 14, fontWeight: '900', color: '#7C3AED' }}>{totalStock} ชิ้น</Text>
              </View>
              {(() => {
                const prices = group.values.map(v => resolveVariantPrice(basePrice, v));
                const min = Math.min(...prices);
                const max = Math.max(...prices);
                return (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 12, color: '#5B21B6', fontWeight: '600' }}>ช่วงราคา</Text>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#7C3AED' }}>
                      {min === max ? `฿${min.toLocaleString()}` : `฿${min.toLocaleString()} – ฿${max.toLocaleString()}`}
                    </Text>
                  </View>
                );
              })()}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ── Money input (decimal-safe) ──────────────────────────────
// เก็บ "ข้อความดิบ" ที่ผู้ใช้พิมพ์ในตัวเอง (เหมือนช่องราคาฐานในหน้าหลัก)
// กันบั๊ก: ถ้า value มาจาก String(parseFloat(...)) จุดทศนิยมที่กำลังพิมพ์ ("2.") จะถูกลบทิ้งทันที
// initial อ่านครั้งเดียวตอน mount (แต่ละ row key = v.id คงที่) — หลังจากนั้น local text คุมเอง
function MoneyInput({
  initial, onChangeNumber, placeholder, style,
}: {
  initial: number | undefined;
  onChangeNumber: (n: number | undefined) => void;
  placeholder?: string;
  style?: any;
}) {
  const [text, setText] = useState(initial != null && initial > 0 ? String(initial) : '');
  return (
    <TextInput
      value={text}
      onChangeText={t => {
        // อนุญาตเฉพาะตัวเลขและจุดทศนิยมตัวเดียว
        let clean = t.replace(/[^0-9.]/g, '');
        const dot = clean.indexOf('.');
        if (dot !== -1) {
          clean = clean.slice(0, dot + 1) + clean.slice(dot + 1).replace(/\./g, '');
        }
        setText(clean);
        const n = parseFloat(clean);
        onChangeNumber(clean === '' || isNaN(n) ? undefined : n);
      }}
      keyboardType="decimal-pad"
      selectTextOnFocus
      placeholder={placeholder}
      placeholderTextColor="#C4B5D8"
      style={style}
    />
  );
}

// ── Add value input ─────────────────────────────────────────
function AddValueInput({ onAdd, placeholder }: { onAdd: (v: string) => void; placeholder: string }) {
  const [val, setVal] = useState('');
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <TextInput
        value={val} onChangeText={setVal}
        placeholder={placeholder} placeholderTextColor="#C4B5D8"
        style={[styles.input, { flex: 1 }]}
        onSubmitEditing={() => { onAdd(val); setVal(''); }}
        returnKeyType="done"
      />
      <Pressable onPress={() => { onAdd(val); setVal(''); }}
        style={{ backgroundColor: '#7C3AED', borderRadius: 10,
          paddingHorizontal: 14, justifyContent: 'center' }}>
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderRadius: 12,
    backgroundColor: 'rgba(124,58,237,0.04)',
    borderWidth: 1.5, borderColor: 'rgba(124,58,237,0.15)',
  },
  toggleLabel: { fontSize: 13, fontWeight: '700', color: '#2D1B69' },
  toggleSub: { fontSize: 11, color: '#9B7FC8', marginTop: 1 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#5B21B6', marginBottom: 6 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1.5, borderColor: 'rgba(167,139,250,0.4)',
    borderRadius: 10, padding: 9, fontSize: 13, color: '#2D1B69',
  },
  presetPill: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1.5, borderColor: 'rgba(167,139,250,0.3)',
  },
  presetPillActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  presetChip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9,
    backgroundColor: '#F3E8FF',
    borderWidth: 1.5, borderColor: 'rgba(167,139,250,0.3)',
  },
  valueRow: {
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0EAF8',
  },
  miniLabel: { fontSize: 10, color: '#7C3AED', fontWeight: '700', marginBottom: 3 },
  stockCtrl: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: 'rgba(124,58,237,0.3)',
    borderRadius: 8, overflow: 'hidden', backgroundColor: '#fff',
  },
  stockBtn: { width: 28, height: 32, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(124,58,237,0.06)' },
  stockVal: { width: 38, textAlign: 'center', fontSize: 13, fontWeight: '800', color: '#2D1B69',
    includeFontPadding: false, textAlignVertical: 'center' },
  // PKG-05 ข้อ 1: ไม่ fix height ตายตัว — ให้ paddingVertical คุมความสูง + กัน clip บน Android
  priceInput: { textAlign: 'center', fontSize: 13, fontWeight: '700', minHeight: 38,
    color: '#2D1B69', borderWidth: 1.5, borderColor: 'rgba(167,139,250,0.4)',
    borderRadius: 8, paddingHorizontal: 6, paddingVertical: 8,
    includeFontPadding: false, textAlignVertical: 'center' },
});
