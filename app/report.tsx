import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Card } from '@/components/ui/Card';
import { ExpensePieChart } from '@/components/charts/ExpensePieChart';
import { WeeklyBarChart } from '@/components/charts/WeeklyBarChart';
import { TrendLineChart } from '@/components/charts/TrendLineChart';
import { reportService } from '@/services/reportService';
import type { WeeklySummary, MonthlyTrend, CategoryBreakdown } from '@/services/reportService';
import { dailySnapshotService } from '@/services/dailySnapshotService';
import type { DailySnapshot } from '@/services/dailySnapshotService';
import { formatCurrency, formatMonthYear } from '@/lib/format';

const HEADER_GRADIENT = ['#2e326b', '#403168', '#4e3064', '#59305f', '#62315a'];

type AllTimeReport = { income: number; expense: number; balance: number; transactionCount: number };

export default function ReportScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { month: now.getMonth(), year: now.getFullYear() };
  });

  const [isLoading, setIsLoading] = useState(false);
  const [expenseBreakdown, setExpenseBreakdown] = useState<CategoryBreakdown[]>([]);
  const [incomeBreakdown, setIncomeBreakdown] = useState<CategoryBreakdown[]>([]);
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([]);
  const [report, setReport] = useState({
    income: 0, expense: 0, balance: 0,
    prevIncome: 0, prevExpense: 0,
    incomeChange: 0, expenseChange: 0,
    dailyAverage: 0, transactionCount: 0, daysInMonth: 30,
  });
  const [allTime, setAllTime] = useState<AllTimeReport>({ income: 0, expense: 0, balance: 0, transactionCount: 0 });
  const [todaySnapshot, setTodaySnapshot] = useState<DailySnapshot | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    const { year, month } = currentMonth;
    const [expBreak, incBreak, weekly, trend, rep, allTimeData, todayData] = await Promise.all([
      reportService.getCategoryBreakdown(year, month, 'expense'),
      reportService.getCategoryBreakdown(year, month, 'income'),
      reportService.getWeeklySummary(year, month),
      reportService.getMonthlyTrend(6),
      reportService.getMonthlyReport(year, month),
      reportService.getAllTimeReport(),
      dailySnapshotService.getTodaySnapshot(),
    ]);
    setExpenseBreakdown(expBreak);
    setIncomeBreakdown(incBreak);
    setWeeklySummary(weekly);
    setMonthlyTrend(trend);
    setReport(rep);
    setAllTime(allTimeData);
    setTodaySnapshot(todayData);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth.month, currentMonth.year]);

  const goToPrevMonth = () => {
    setCurrentMonth((prev) => {
      if (prev.month === 0) return { month: 11, year: prev.year - 1 };
      return { month: prev.month - 1, year: prev.year };
    });
  };

  const goToNextMonth = () => {
    const now = new Date();
    if (currentMonth.month === now.getMonth() && currentMonth.year === now.getFullYear()) return;
    setCurrentMonth((prev) => {
      if (prev.month === 11) return { month: 0, year: prev.year + 1 };
      return { month: prev.month + 1, year: prev.year };
    });
  };

  const isCurrentMonth =
    currentMonth.month === new Date().getMonth() &&
    currentMonth.year === new Date().getFullYear();

  const todayStr = new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
  const todayNet = (todaySnapshot?.todayIncome ?? 0) - (todaySnapshot?.todayExpense ?? 0);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* ซ่อน Stack header เพื่อใช้ custom header แทน */}
      <Stack.Screen options={{ headerShown: false }} />

      {/* Custom gradient header — รวม status bar, title, month selector */}
      <LinearGradient
        colors={HEADER_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.header, { paddingTop: insets.top + 10 }]}>

        {/* Row 1: ปุ่มกลับ + Title */}
        <View style={styles.headerTitleRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
            <FontAwesome name="chevron-left" size={18} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle}>รายงาน</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Row 2: Month selector */}
        <View style={styles.monthRow}>
          <Pressable onPress={goToPrevMonth} style={styles.monthArrow} hitSlop={8}>
            <FontAwesome name="chevron-left" size={14} color="rgba(255,255,255,0.85)" />
          </Pressable>
          <Text style={styles.monthLabel}>
            {formatMonthYear(currentMonth.month, currentMonth.year)}
          </Text>
          <Pressable onPress={goToNextMonth} style={styles.monthArrow} hitSlop={8}>
            <FontAwesome
              name="chevron-right"
              size={14}
              color={isCurrentMonth ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.85)'}
            />
          </Pressable>
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 28 }]}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadData} />}>

        {/* Card 1: วันนี้ */}
        <Card variant="elevated">
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <View style={[styles.dot, { backgroundColor: '#7C3AED' }]} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>วันนี้</Text>
            </View>
            <Text style={[styles.chip, { color: colors.textSecondary, backgroundColor: colors.background }]}>
              {todayStr}
            </Text>
          </View>

          <View style={styles.twoCol}>
            <View style={styles.statCell}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>รายรับ</Text>
              <Text style={[styles.statAmount, { color: '#2E7D32' }]}>
                +{formatCurrency(todaySnapshot?.todayIncome ?? 0)}
              </Text>
            </View>
            <View style={[styles.statCell, styles.statCellRight, { borderLeftColor: colors.border }]}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>รายจ่าย</Text>
              <Text style={[styles.statAmount, { color: '#C62828' }]}>
                -{formatCurrency(todaySnapshot?.todayExpense ?? 0)}
              </Text>
            </View>
          </View>

          <View style={[styles.balanceRow, { borderTopColor: colors.border }]}>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>สุทธิวันนี้</Text>
            <Text style={[styles.balanceAmount, { color: todayNet >= 0 ? '#2E7D32' : '#C62828' }]}>
              {formatCurrency(todayNet)}
            </Text>
          </View>
        </Card>

        {/* Card 2: เดือนนี้ */}
        <Card variant="elevated">
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <View style={[styles.dot, { backgroundColor: '#1565C0' }]} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>เดือนนี้</Text>
            </View>
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>{report.transactionCount} รายการ</Text>
          </View>

          <View style={styles.twoCol}>
            <View style={styles.statCell}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>รายรับ</Text>
              <Text style={[styles.statAmount, { color: '#2E7D32' }]}>{formatCurrency(report.income)}</Text>
              {report.incomeChange !== 0 && (
                <View style={styles.changeRow}>
                  <FontAwesome
                    name={report.incomeChange > 0 ? 'arrow-up' : 'arrow-down'}
                    size={9}
                    color={report.incomeChange > 0 ? '#2E7D32' : '#C62828'}
                  />
                  <Text style={[styles.changeText, { color: report.incomeChange > 0 ? '#2E7D32' : '#C62828' }]}>
                    {Math.abs(report.incomeChange).toFixed(1)}%
                  </Text>
                  <Text style={[styles.changeText, { color: colors.textSecondary }]}>จากเดือนก่อน</Text>
                </View>
              )}
            </View>
            <View style={[styles.statCell, styles.statCellRight, { borderLeftColor: colors.border }]}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>รายจ่าย</Text>
              <Text style={[styles.statAmount, { color: '#C62828' }]}>{formatCurrency(report.expense)}</Text>
              {report.expenseChange !== 0 && (
                <View style={styles.changeRow}>
                  <FontAwesome
                    name={report.expenseChange > 0 ? 'arrow-up' : 'arrow-down'}
                    size={9}
                    color={report.expenseChange > 0 ? '#C62828' : '#2E7D32'}
                  />
                  <Text style={[styles.changeText, { color: report.expenseChange > 0 ? '#C62828' : '#2E7D32' }]}>
                    {Math.abs(report.expenseChange).toFixed(1)}%
                  </Text>
                  <Text style={[styles.changeText, { color: colors.textSecondary }]}>จากเดือนก่อน</Text>
                </View>
              )}
            </View>
          </View>

          <View style={[styles.balanceRow, { borderTopColor: colors.border }]}>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>คงเหลือเดือนนี้</Text>
            <Text style={[styles.balanceAmount, { color: report.balance >= 0 ? '#2E7D32' : '#C62828' }]}>
              {formatCurrency(report.balance)}
            </Text>
          </View>
        </Card>

        {/* Card 3: ภาพรวมทั้งหมด */}
        <Card variant="elevated">
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <View style={[styles.dot, { backgroundColor: '#E65100' }]} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>ภาพรวมทั้งหมด</Text>
            </View>
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>{allTime.transactionCount} รายการ</Text>
          </View>

          <View style={styles.twoCol}>
            <View style={styles.statCell}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>รายรับรวม</Text>
              <Text style={[styles.statAmount, { color: '#2E7D32' }]}>{formatCurrency(allTime.income)}</Text>
            </View>
            <View style={[styles.statCell, styles.statCellRight, { borderLeftColor: colors.border }]}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>รายจ่ายรวม</Text>
              <Text style={[styles.statAmount, { color: '#C62828' }]}>{formatCurrency(allTime.expense)}</Text>
            </View>
          </View>

          <View style={[styles.balanceRow, { borderTopColor: colors.border }]}>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>ยอดสุทธิ</Text>
            <Text style={[styles.balanceAmount, { color: allTime.balance >= 0 ? '#2E7D32' : '#C62828' }]}>
              {formatCurrency(allTime.balance)}
            </Text>
          </View>
        </Card>

        {/* Card 4: ค่าเฉลี่ยต่อวัน */}
        <Card variant="elevated">
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <View style={[styles.dot, { backgroundColor: '#7C3AED' }]} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>ค่าเฉลี่ยต่อวัน</Text>
            </View>
          </View>
          <View style={styles.avgRow}>
            <View style={styles.avgIconBox}>
              <FontAwesome name="bar-chart" size={22} color="#7C3AED" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.avgAmount}>{formatCurrency(report.dailyAverage)}</Text>
              <Text style={[styles.avgSubtext, { color: colors.textSecondary }]}>
                รายจ่ายเฉลี่ยต่อวันในเดือนนี้
              </Text>
            </View>
          </View>
        </Card>

        {/* Pie Chart: สัดส่วนรายจ่าย */}
        <Card variant="elevated">
          <ExpensePieChart
            data={expenseBreakdown}
            totalAmount={report.expense}
            title="สัดส่วนรายจ่าย"
            titleColor="#E53935"
            centerAmountColor="#E53935"
          />
        </Card>

        {/* Pie Chart: สัดส่วนรายรับ */}
        {incomeBreakdown.length > 0 && (
          <Card variant="elevated">
            <ExpensePieChart
              data={incomeBreakdown}
              totalAmount={report.income}
              title="สัดส่วนรายรับ"
              titleColor="#1565C0"
              centerAmountColor="#2E7D32"
            />
          </Card>
        )}

        {/* Bar Chart: เปรียบเทียบรายสัปดาห์ */}
        <Card variant="elevated">
          <WeeklyBarChart data={weeklySummary} />
        </Card>

        {/* Line Chart: แนวโน้ม 6 เดือน */}
        <Card variant="elevated">
          <TrendLineChart data={monthlyTrend} />
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  monthArrow: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  monthLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  scrollContent: {
    padding: 14,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  chip: {
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
  },
  twoCol: {
    flexDirection: 'row',
  },
  statCell: {
    flex: 1,
    paddingRight: 8,
    gap: 4,
  },
  statCellRight: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    paddingLeft: 12,
    paddingRight: 0,
  },
  statLabel: {
    fontSize: 12,
  },
  statAmount: {
    fontSize: 19,
    fontWeight: '800',
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  changeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  balanceAmount: {
    fontSize: 16,
    fontWeight: '800',
  },
  avgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 2,
  },
  avgIconBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(124,58,237,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avgAmount: {
    fontSize: 26,
    fontWeight: '800',
    color: '#7C3AED',
  },
  avgSubtext: {
    fontSize: 12,
    marginTop: 3,
  },
});
