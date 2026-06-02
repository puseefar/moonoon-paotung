import FontAwesome from '@expo/vector-icons/FontAwesome';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/Colors';
import { DailyMoneySnapshot } from '@/components/home/DailyMoneySnapshot';
import { HomeHeader } from '@/components/home/HomeHeader';
import { StaticMenuGrid } from '@/components/home/MenuGrid';
import { CardMenuSection } from '@/components/home/CardMenuSection';
import { useColorScheme } from '@/components/useColorScheme';
import { theme } from '@/lib/theme';
import type { DailySnapshot } from '@/services/dailySnapshotService';

const PREVIEW_HOME_BALANCE = 24580;

function buildPreviewSnapshot(): DailySnapshot {
  const recurringDate = new Date();
  recurringDate.setDate(recurringDate.getDate() + 3);

  return {
    todayExpense: 1280,
    monthIncome: 32500,
    monthExpense: 15420,
    monthBalance: 17080,
    dailyAverage: 685,
    transactionCountToday: 4,
    topExpenseCategory: {
      name: 'อาหารและเครื่องดื่ม',
      icon: '🍜',
      amount: 4320,
    },
    upcomingRecurring: {
      note: 'ค่าผ่อนโทรศัพท์',
      amount: 1299,
      type: 'expense',
      nextDate: recurringDate,
    },
    insight: 'วันนี้ใช้จ่ายพอดีและยังคุมสมดุลเดือนนี้ได้ดี ลองรักษาจังหวะนี้ต่ออีกหน่อย',
  };
}

const PREVIEW_TABS = [
  { key: 'home', label: 'หน้าแรก', icon: 'home' as const, active: true },
  { key: 'report', label: 'รายงาน', icon: 'bar-chart' as const, active: false },
  { key: 'add', label: '', icon: 'plus' as const, active: false, isCenter: true },
  { key: 'history', label: 'ประวัติ', icon: 'list-alt' as const, active: false },
  { key: 'settings', label: 'ตั้งค่า', icon: 'cog' as const, active: false },
];

export function WebUiPreviewApp() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 12);
  const tabBarHeight = 60 + bottomPadding;
  const snapshot = buildPreviewSnapshot();

  return (
    <View style={[styles.page, { backgroundColor: colors.background }]}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 28 }}>
        <View style={styles.content}>
          <HomeHeader
            name="หมูนุ่น"
            tambon="ตำบล เมืองบัว"
            totalBalance={PREVIEW_HOME_BALANCE}
            onScan={() => {}}
            onQR={() => {}}
          />

          <DailyMoneySnapshot snapshot={snapshot} onAddPress={() => {}} />
          <StaticMenuGrid onItemPress={() => {}} />
          <CardMenuSection onCardPress={() => {}} />
        </View>
      </ScrollView>

      <View style={[styles.previewBadge, { top: insets.top + 12 }]}>
        <FontAwesome name="desktop" size={12} color={theme.color.primary} />
        <Text style={styles.previewBadgeText}>Web UI Preview</Text>
      </View>

      <View style={[styles.tabBarShell, { paddingBottom: bottomPadding }]}>
        <View
          style={[
            styles.tabBar,
            {
              backgroundColor: colors.cardBackground,
              borderTopColor: colors.border,
            },
          ]}>
          {PREVIEW_TABS.map((tab) =>
            tab.isCenter ? (
              <View key={tab.key} style={styles.centerTabSlot}>
                <View style={[styles.centerFab, { backgroundColor: colors.tint }]}>
                  <FontAwesome name={tab.icon} size={24} color="#FFFFFF" />
                </View>
              </View>
            ) : (
              <View key={tab.key} style={styles.tabItem}>
                <FontAwesome
                  name={tab.icon}
                  size={20}
                  color={tab.active ? colors.tint : colors.tabIconDefault}
                />
                <Text
                  style={[
                    styles.tabLabel,
                    { color: tab.active ? colors.tint : colors.tabIconDefault },
                  ]}>
                  {tab.label}
                </Text>
              </View>
            )
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: 1024,
    alignSelf: 'center',
  },
  previewBadge: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: '#E9DDF5',
  },
  previewBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.color.primary,
  },
  tabBarShell: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    backgroundColor: 'transparent',
  },
  tabBar: {
    width: '100%',
    maxWidth: 1024,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    paddingTop: 4,
    minHeight: 60,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingBottom: 2,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  centerTabSlot: {
    flex: 1,
    alignItems: 'center',
  },
  centerFab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
});
