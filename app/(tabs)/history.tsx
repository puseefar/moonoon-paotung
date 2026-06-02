import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useColorScheme } from '@/components/useColorScheme';
import { SwipeableTransactionItem } from '@/components/transaction/SwipeableTransactionItem';
import { TransactionFilter, type FilterState } from '@/components/transaction/TransactionFilter';
import Colors from '@/constants/Colors';
import type { Category } from '@/db/schema';
import { useTransactionsByDate } from '@/hooks/useTransactionsByDate';
import { formatCurrency, formatMonthYear, getMonthDateRange } from '@/lib/format';
import { categoryService } from '@/services/categoryService';
import { useSummaryStore } from '@/stores/useSummaryStore';
import { useTransactionStore } from '@/stores/useTransactionStore';
import { useWalletStore } from '@/stores/useWalletStore';

export default function HistoryScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { month: now.getMonth(), year: now.getFullYear() };
  });
  const [filter, setFilter] = useState<FilterState>({
    type: 'all',
    categoryId: null,
    walletId: null,
    searchText: '',
  });
  const [allCategories, setAllCategories] = useState<Category[]>([]);

  const { deleteTransaction } = useTransactionStore();
  const { wallets, loadWallets } = useWalletStore();
  const { loadAll } = useSummaryStore();

  useEffect(() => {
    categoryService.getAll().then(setAllCategories);
    loadWallets();
  }, [loadWallets]);

  const dateRange = useMemo(
    () => getMonthDateRange(currentMonth.year, currentMonth.month),
    [currentMonth.month, currentMonth.year]
  );

  const { grouped, isLoading, refresh } = useTransactionsByDate(dateRange);

  const filteredSections = useMemo(() => {
    return grouped
      .map((group) => {
        let filtered = group.data;

        if (filter.type !== 'all') {
          filtered = filtered.filter((tx) => tx.type === filter.type);
        }

        if (filter.categoryId) {
          filtered = filtered.filter((tx) => tx.categoryId === filter.categoryId);
        }

        if (filter.walletId) {
          filtered = filtered.filter(
            (tx) => tx.walletId === filter.walletId || tx.toWalletId === filter.walletId
          );
        }

        if (filter.searchText.trim()) {
          const keyword = filter.searchText.trim().toLowerCase();
          filtered = filtered.filter(
            (tx) =>
              tx.note?.toLowerCase().includes(keyword) ||
              tx.categoryName?.toLowerCase().includes(keyword)
          );
        }

        return {
          title: group.displayDate,
          totalIncome: filtered
            .filter((tx) => tx.type === 'income')
            .reduce((sum, tx) => sum + tx.amount, 0),
          totalExpense: filtered
            .filter((tx) => tx.type === 'expense')
            .reduce((sum, tx) => sum + tx.amount, 0),
          data: filtered,
        };
      })
      .filter((section) => section.data.length > 0);
  }, [filter, grouped]);

  const filteredSummary = useMemo(() => {
    let income = 0;
    let expense = 0;
    let count = 0;

    for (const section of filteredSections) {
      income += section.totalIncome;
      expense += section.totalExpense;
      count += section.data.length;
    }

    return { income, expense, count };
  }, [filteredSections]);

  const goToPrevMonth = () => {
    setCurrentMonth((prev) => {
      if (prev.month === 0) {
        return { month: 11, year: prev.year - 1 };
      }
      return { month: prev.month - 1, year: prev.year };
    });
  };

  const goToNextMonth = () => {
    const now = new Date();
    const isCurrentMonth =
      currentMonth.month === now.getMonth() && currentMonth.year === now.getFullYear();
    if (isCurrentMonth) return;

    setCurrentMonth((prev) => {
      if (prev.month === 11) {
        return { month: 0, year: prev.year + 1 };
      }
      return { month: prev.month + 1, year: prev.year };
    });
  };

  const handleDelete = (id: string) => {
    Alert.alert('ยืนยันการลบ', 'ต้องการลบรายการนี้หรือไม่?', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ลบ',
        style: 'destructive',
        onPress: async () => {
          await deleteTransaction(id);
          refresh();
          loadWallets();
          loadAll();
        },
      },
    ]);
  };

  const isCurrentMonth =
    currentMonth.month === new Date().getMonth() &&
    currentMonth.year === new Date().getFullYear();

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Month selector */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 10,
          backgroundColor: colors.cardBackground,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        }}>
        <Pressable onPress={goToPrevMonth} style={styles.monthArrow}>
          <FontAwesome name="chevron-left" size={15} color={colors.tint} />
        </Pressable>
        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
          {formatMonthYear(currentMonth.month, currentMonth.year)}
        </Text>
        <Pressable onPress={goToNextMonth} style={styles.monthArrow}>
          <FontAwesome
            name="chevron-right"
            size={15}
            color={isCurrentMonth ? colors.border : colors.tint}
          />
        </Pressable>
      </View>

      <TransactionFilter
        filter={filter}
        onFilterChange={setFilter}
        categories={allCategories}
        wallets={wallets}
      />

      {/* Summary bar */}
      <View
        style={{
          flexDirection: 'row',
          paddingVertical: 10,
          paddingHorizontal: 14,
          backgroundColor: colors.cardBackground,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          gap: 8,
        }}>
        <View style={{ flex: 1, alignItems: 'center', paddingVertical: 4, borderRadius: 8, backgroundColor: colors.background }}>
          <Text style={{ fontSize: 10, color: colors.textSecondary, marginBottom: 2 }}>รายการ</Text>
          <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>
            {filteredSummary.count}
          </Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(46,125,50,0.07)' }}>
          <Text style={{ fontSize: 10, color: colors.textSecondary, marginBottom: 2 }}>รายรับ</Text>
          <Text style={{ fontSize: 14, fontWeight: '800', color: '#2E7D32' }}>
            +{formatCurrency(filteredSummary.income)}
          </Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(198,40,40,0.07)' }}>
          <Text style={{ fontSize: 10, color: colors.textSecondary, marginBottom: 2 }}>รายจ่าย</Text>
          <Text style={{ fontSize: 14, fontWeight: '800', color: '#C62828' }}>
            -{formatCurrency(filteredSummary.expense)}
          </Text>
        </View>
      </View>

      <SectionList
        sections={filteredSections}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} />}
        renderSectionHeader={({ section }) => (
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingVertical: 10,
              backgroundColor: colors.background,
            }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>
              {section.title}
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {section.totalIncome > 0 && (
                <Text style={{ fontSize: 13, color: colors.income, fontWeight: '600' }}>
                  +{formatCurrency(section.totalIncome)}
                </Text>
              )}
              {section.totalExpense > 0 && (
                <Text style={{ fontSize: 13, color: colors.expense, fontWeight: '600' }}>
                  -{formatCurrency(section.totalExpense)}
                </Text>
              )}
            </View>
          </View>
        )}
        renderItem={({ item }) => (
          <SwipeableTransactionItem transaction={item} onDelete={() => handleDelete(item.id)} />
        )}
        ItemSeparatorComponent={() => (
          <View
            style={{
              height: 1,
              backgroundColor: colors.border,
              marginHorizontal: 16,
            }}
          />
        )}
        ListEmptyComponent={
          <View style={{ padding: 48, alignItems: 'center', gap: 12 }}>
            <Text style={{ fontSize: 52 }}>
              {filter.type !== 'all' || filter.categoryId || filter.walletId || filter.searchText
                ? '🔍'
                : '🧾'}
            </Text>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, textAlign: 'center' }}>
              {filter.type !== 'all' || filter.categoryId || filter.walletId || filter.searchText
                ? 'ไม่พบรายการที่ตรงกับตัวกรอง'
                : 'ยังไม่มีรายการในเดือนนี้'}
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 }}>
              {filter.type !== 'all' || filter.categoryId || filter.walletId || filter.searchText
                ? 'ลองเปลี่ยนตัวกรอง หรือกด "ล้าง" เพื่อดูรายการทั้งหมด'
                : 'กดปุ่ม + เพื่อเริ่มบันทึกรายรับ-รายจ่าย'}
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  monthArrow: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
});
