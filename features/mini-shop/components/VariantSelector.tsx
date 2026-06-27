import { View, Text, Pressable, StyleSheet } from 'react-native';
import { resolveVariantPrice, type VariantOptionGroup, type VariantValue } from '@/lib/api/contract';

interface Props {
  group: VariantOptionGroup;
  selectedId: string | null;
  onSelect: (value: VariantValue) => void;
  basePrice: number;
}

export function VariantSelector({ group, selectedId, onSelect, basePrice }: Props) {
  const selected = group.values.find(v => v.id === selectedId);
  const isSoldOut = (v: VariantValue) => v.stock <= 0;

  // ราคาเต็มของ variant ที่เลือก (absolute — addendum v1.1)
  const selectedFullPrice = selected
    ? resolveVariantPrice(basePrice, selected)
    : null;

  return (
    <View style={styles.wrap}>
      {/* Header: ชื่อกลุ่ม + selected info */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 4 }}>
        <Text style={styles.groupName}>{group.name}</Text>
        {selected && (
          <>
            <Text style={{ fontSize: 12, color: '#7C5CB8' }}>:</Text>
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#7C3AED' }}>
              {selected.label}
            </Text>
            {selectedFullPrice !== null && (
              <Text style={{ fontSize: 13, fontWeight: '900', color: '#EC4899' }}>
                ฿{selectedFullPrice.toLocaleString()}
              </Text>
            )}
            <Text style={{ fontSize: 11, color: '#9B7FC8' }}>
              · เหลือ {selected.stock} ชิ้น
            </Text>
          </>
        )}
      </View>

      {/* Variant pills */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {group.values.map(v => {
          const isSelected = v.id === selectedId;
          const soldOut = isSoldOut(v);
          const fullPrice = resolveVariantPrice(basePrice, v);
          const hasDifferentPrice = fullPrice !== basePrice;

          return (
            <Pressable key={v.id} onPress={() => !soldOut && onSelect(v)}
              disabled={soldOut}
              style={[
                styles.pill,
                isSelected && styles.pillSelected,
                soldOut && styles.pillSoldOut,
              ]}>
              {/* ชื่อ variant */}
              <Text style={[
                styles.pillText,
                isSelected && styles.pillTextSelected,
                soldOut && styles.pillTextSoldOut,
              ]}>
                {v.label}
              </Text>

              {/* ราคาเต็ม (แสดงเสมอถ้าราคาต่างกัน, หรือแสดงเฉพาะที่ selected) */}
              {!soldOut && hasDifferentPrice && (
                <Text style={{
                  fontSize: 10, fontWeight: '700',
                  color: isSelected ? 'rgba(255,255,255,0.9)' : '#7C3AED',
                }}>
                  ฿{fullPrice.toLocaleString()}
                </Text>
              )}

              {soldOut && (
                <Text style={{ fontSize: 9, color: '#C4B5D8' }}>หมด</Text>
              )}
            </Pressable>
          );
        })}
      </View>

      {!selectedId && (
        <Text style={{ fontSize: 11, color: '#EC4899', marginTop: 8, fontWeight: '600' }}>
          ⚠️ กรุณาเลือก{group.name}ก่อนเพิ่มในตะกร้า
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#F8F5FF', borderRadius: 14, padding: 14,
    borderWidth: 1.5, borderColor: 'rgba(124,58,237,0.15)',
  },
  groupName: { fontSize: 13, fontWeight: '800', color: '#2D1B69' },
  pill: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: 'rgba(167,139,250,0.35)',
    alignItems: 'center', gap: 2, minWidth: 56,
  },
  pillSelected: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  pillSoldOut: { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB', opacity: 0.6 },
  pillText: { fontSize: 13, fontWeight: '700', color: '#5B21B6' },
  pillTextSelected: { color: '#fff' },
  pillTextSoldOut: { color: '#9CA3AF', textDecorationLine: 'line-through' },
});
