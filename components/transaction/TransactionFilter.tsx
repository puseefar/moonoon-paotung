import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import type { Category, Wallet } from '@/db/schema';
import type { TransactionType } from '@/types';

type FilterState = {
  type: TransactionType | 'all';
  categoryId: string | null;
  walletId: string | null;
  searchText: string;
};

type Props = {
  filter: FilterState;
  onFilterChange: (filter: FilterState) => void;
  categories: Category[];
  wallets: Wallet[];
};

export type { FilterState };

type TypeOption = { key: FilterState['type']; label: string; color?: string };

const TYPE_OPTIONS: TypeOption[] = [
  { key: 'all',      label: 'ทั้งหมด' },
  { key: 'expense',  label: 'รายจ่าย', color: '#E53935' },
  { key: 'income',   label: 'รายรับ',  color: '#2E7D32' },
  { key: 'transfer', label: 'โอน',     color: '#1565C0' },
];

export function TransactionFilter({ filter, onFilterChange, categories }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const hasActiveFilter =
    filter.type !== 'all' || !!filter.categoryId || !!filter.searchText;

  // กรองหมวดหมู่ตาม type ที่เลือก เพื่อลดความสับสน
  const visibleCategories = useMemo(() => {
    if (filter.type === 'all' || filter.type === 'transfer') return categories;
    return categories.filter((c) => c.type === filter.type);
  }, [categories, filter.type]);

  const clearAll = () =>
    onFilterChange({ type: 'all', categoryId: null, walletId: null, searchText: '' });

  // Search และ category chip ทำงานแยกกัน — เลือกอย่างใดอย่างหนึ่งจะล้างอีกอย่างอัตโนมัติ
  const handleSearch = (text: string) => {
    onFilterChange({
      ...filter,
      searchText: text,
      categoryId: text.length > 0 ? null : filter.categoryId,
    });
  };

  const handleTypeChange = (type: FilterState['type']) => {
    const selectedCat = categories.find((c) => c.id === filter.categoryId);
    const incompatible =
      selectedCat && type !== 'all' && type !== 'transfer' && selectedCat.type !== type;
    onFilterChange({ ...filter, type, categoryId: incompatible ? null : filter.categoryId });
  };

  const handleCategorySelect = (id: string | null) => {
    onFilterChange({ ...filter, categoryId: id, searchText: '' });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.cardBackground, borderBottomColor: colors.border }]}>

      {/* ─── Search bar ─── */}
      <View style={[styles.searchBox, { backgroundColor: colors.background }]}>
        <FontAwesome name="search" size={14} color={colors.textSecondary} />
        <TextInput
          value={filter.searchText}
          onChangeText={handleSearch}
          placeholder="ค้นหาจากรายละเอียด..."
          placeholderTextColor={colors.textSecondary}
          style={[styles.searchInput, { color: colors.text }]}
          returnKeyType="search"
        />
        {filter.searchText.length > 0 && (
          <Pressable onPress={() => handleSearch('')} hitSlop={8}>
            <FontAwesome name="times-circle" size={16} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>

      {/* ─── Type segmented control + Clear ─── */}
      <View style={styles.typeRow}>
        <View style={[styles.segmented, { backgroundColor: colors.background }]}>
          {TYPE_OPTIONS.map((opt, i) => {
            const isActive = filter.type === opt.key;
            const activeColor = opt.color ?? colors.tint;
            return (
              <Pressable
                key={opt.key}
                onPress={() => handleTypeChange(opt.key)}
                style={[
                  styles.segBtn,
                  i === 0 && styles.segFirst,
                  i === TYPE_OPTIONS.length - 1 && styles.segLast,
                  isActive && { backgroundColor: activeColor },
                ]}>
                <Text
                  style={[
                    styles.segText,
                    { color: isActive ? '#FFFFFF' : colors.textSecondary },
                    isActive && styles.segTextActive,
                  ]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {hasActiveFilter && (
          <Pressable onPress={clearAll} style={[styles.clearBtn, { borderColor: colors.border }]}>
            <FontAwesome name="times" size={10} color={colors.textSecondary} />
            <Text style={[styles.clearText, { color: colors.textSecondary }]}>ล้าง</Text>
          </Pressable>
        )}
      </View>

      {/* ─── Category chips (always visible, filtered by type) ─── */}
      {visibleCategories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipScroll}>

          {/* "ทั้งหมด" chip */}
          <Pressable
            onPress={() => handleCategorySelect(null)}
            style={[
              styles.chip,
              {
                backgroundColor: !filter.categoryId ? colors.tint : colors.background,
                borderColor: !filter.categoryId ? colors.tint : colors.border,
              },
            ]}>
            <Text style={[styles.chipText, { color: !filter.categoryId ? '#FFFFFF' : colors.textSecondary }]}>
              ทั้งหมด
            </Text>
          </Pressable>

          {visibleCategories.map((cat) => {
            const isActive = filter.categoryId === cat.id;
            const bg = cat.color ?? colors.tint;
            return (
              <Pressable
                key={cat.id}
                onPress={() => handleCategorySelect(isActive ? null : cat.id)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: isActive ? bg : colors.background,
                    borderColor: isActive ? bg : colors.border,
                  },
                ]}>
                <Text style={styles.chipIcon}>{cat.icon}</Text>
                <Text
                  style={[
                    styles.chipText,
                    { color: isActive ? '#FFFFFF' : colors.textSecondary },
                  ]}>
                  {cat.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 8,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 10,
    gap: 8,
  },
  segmented: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: 10,
    overflow: 'hidden',
    height: 36,
  },
  segBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segFirst: {
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
  },
  segLast: {
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
  },
  segText: {
    fontSize: 12,
    fontWeight: '600',
  },
  segTextActive: {
    fontWeight: '800',
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  clearText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chipScroll: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    gap: 7,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  chipIcon: {
    fontSize: 13,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
