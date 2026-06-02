import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DailyMoneySnapshot } from '@/components/home/DailyMoneySnapshot';
import { HomeHeader } from '@/components/home/HomeHeader';
import { MenuGrid } from '@/components/home/MenuGrid';
import { dailySnapshotService, type DailySnapshot } from '@/services/dailySnapshotService';
import { useSummaryStore } from '@/stores/useSummaryStore';
import { useWalletStore } from '@/stores/useWalletStore';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [snapshot, setSnapshot] = useState<DailySnapshot | null>(null);

  const { loadWallets, totalBalance } = useWalletStore();
  const { loadAll, isLoading } = useSummaryStore();

  const refresh = useCallback(async () => {
    const [dailySnapshot] = await Promise.all([
      dailySnapshotService.getTodaySnapshot(),
      loadWallets(),
      loadAll(),
    ]);
    setSnapshot(dailySnapshot);
  }, [loadWallets, loadAll]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

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
          onScan={() => router.push('/scan-slip' as any)}
          onQR={() => {}}
        />

        <DailyMoneySnapshot
          snapshot={snapshot}
          isLoading={isLoading}
          onAddPress={() => router.push('/(tabs)/add' as any)}
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
