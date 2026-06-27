import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { formatCurrency } from '@/lib/format';
import type { Category } from '@/db/schema';
import type { TransactionWithCategory } from '@/types';

type Props = {
  visible: boolean;
  transaction: TransactionWithCategory | null;
  categories: Category[];
  onClose: () => void;
  onSelect: (categoryId: string) => void;
};

/**
 * §5.1/§5.2 — เลือก/เปลี่ยนหมวดหมู่ให้รายการในหน้าประวัติ
 * แสดงเฉพาะหมวดที่ตรงประเภท (รายรับ/รายจ่าย) ของรายการนั้น
 */
export function CategoryAssignModal({
  visible,
  transaction,
  categories,
  onClose,
  onSelect,
}: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const txType = transaction?.type === 'income' ? 'income' : 'expense';
  const options = categories
    .filter((c) => c.type === txType)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const currentId = transaction?.categoryId ?? null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdropWrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.cardBackground }]}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.text }]}>จัดหมวดหมู่</Text>
              {transaction ? (
                <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                  {transaction.note || (txType === 'income' ? 'รายรับ' : 'รายจ่าย')} ·{' '}
                  {transaction.type === 'expense' ? '-' : '+'}
                  {formatCurrency(transaction.amount)}
                </Text>
              ) : null}
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <FontAwesome name="times" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
            <View style={styles.grid}>
              {options.map((cat) => {
                const selected = cat.id === currentId;
                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => onSelect(cat.id)}
                    style={[
                      styles.chip,
                      {
                        borderColor: selected ? colors.tint : colors.border,
                        backgroundColor: selected ? colors.tint + '12' : colors.background,
                      },
                    ]}>
                    <Text style={{ fontSize: 22 }}>{cat.icon}</Text>
                    <Text
                      style={[styles.chipLabel, { color: colors.text }]}
                      numberOfLines={1}>
                      {cat.name}
                    </Text>
                    {selected && (
                      <FontAwesome name="check-circle" size={14} color={colors.tint} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropWrap: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: '80%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.18)',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  chipLabel: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
  },
});
