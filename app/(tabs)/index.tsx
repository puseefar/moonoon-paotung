import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DailyMoneySnapshot } from '@/components/home/DailyMoneySnapshot';
import { HomeHeader } from '@/components/home/HomeHeader';
import { MenuGrid } from '@/components/home/MenuGrid';
import { dailySnapshotService, type DailySnapshot } from '@/services/dailySnapshotService';
import { useSummaryStore } from '@/stores/useSummaryStore';
import { useTransactionStore } from '@/stores/useTransactionStore';
import { useWalletStore } from '@/stores/useWalletStore';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [snapshot, setSnapshot] = useState<DailySnapshot | null>(null);

  const { loadWallets, totalBalance, wallets } = useWalletStore();
  const { loadAll, isLoading } = useSummaryStore();
  const lastUpdated = useTransactionStore((s) => s.lastUpdated);

  const refresh = useCallback(async () => {
    try {
      const [dailySnapshot] = await Promise.all([
        dailySnapshotService.getTodaySnapshot(),
        loadWallets(),
        loadAll(),
      ]);
      setSnapshot(dailySnapshot);
    } catch (e) {
      console.warn('HomeScreen refresh error:', e);
    }
  }, [loadWallets, loadAll]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // Proactive refresh: fires whenever addTransaction is called anywhere in the app
  // (scan-slip, add tab, recurring, etc.) — home sees new data without needing focus change
  useEffect(() => {
    if (lastUpdated > 0) refresh();
  }, [lastUpdated]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor="#fff" />}>
        <HomeHeader
          name="หมูนุ่น"
          tambon="ตำบล เมืองบัว"
          totalBalance={totalBalance}
          wallets={wallets.map((w) => ({ name: w.name, balance: w.balance ?? 0, icon: w.icon ?? null }))}
        />

        <DailyMoneySnapshot
          snapshot={snapshot}
          isLoading={isLoading}
        />

        <MenuGrid />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F5F0FF',
  },
});
