import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Card } from '@/components/ui/Card';
import { useColorScheme } from '@/components/useColorScheme';
import { WalletAvatar } from '@/components/wallet/WalletAvatar';
import Colors from '@/constants/Colors';
import { getWalletBrandPreset, getWalletDisplayType } from '@/constants/walletBrands';
import type { Wallet } from '@/db/schema';
import { formatCurrency } from '@/lib/format';
import { walletService } from '@/services/walletService';
import type { WalletActivityItem } from '@/types';

type DetailFilter = 'all' | 'income' | 'expense' | 'transfer' | 'deleted';

const FILTERS: { key: DetailFilter; label: string }[] = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'income', label: 'รับเงิน' },
  { key: 'expense', label: 'จ่ายเงิน' },
  { key: 'transfer', label: 'โอน' },
  { key: 'deleted', label: 'ลบแล้ว' },
];

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getActivityTitle(activity: WalletActivityItem) {
  if (activity.actionType === 'income') return 'เงินเข้า';
  if (activity.actionType === 'expense') return 'รายจ่าย';
  if (activity.actionType === 'transfer_in') return `รับโอนจาก ${activity.counterpartyWalletName ?? 'อีกกระเป๋า'}`;
  if (activity.actionType === 'transfer_out') return `โอนไป ${activity.counterpartyWalletName ?? 'อีกกระเป๋า'}`;
  if (activity.transactionType === 'transfer') return 'ลบรายการโอน';
  if (activity.transactionType === 'income') return 'ลบรายการรับเงิน';
  return 'ลบรายการรายจ่าย';
}

function getActivityIcon(activity: WalletActivityItem) {
  if (activity.actionType === 'income') return 'arrow-down';
  if (activity.actionType === 'expense') return 'arrow-up';
  if (activity.actionType === 'transfer_in' || activity.actionType === 'transfer_out') return 'exchange';
  return 'trash';
}

export default function WalletDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [activities, setActivities] = useState<WalletActivityItem[]>([]);
  const [filter, setFilter] = useState<DetailFilter>('all');
  const [isLoading, setIsLoading] = useState(true);

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const [walletData, timeline] = await Promise.all([
        walletService.getById(id),
        walletService.getActivityTimeline(id),
      ]);
      setWallet(walletData);
      setActivities(timeline);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadDetail();
    }, [loadDetail])
  );

  const filteredActivities = useMemo(() => {
    if (filter === 'all') return activities;
    if (filter === 'deleted') return activities.filter((item) => item.actionType === 'deleted');
    if (filter === 'transfer') {
      return activities.filter(
        (item) => item.actionType === 'transfer_in' || item.actionType === 'transfer_out'
      );
    }
    return activities.filter((item) => item.actionType === filter);
  }, [activities, filter]);

  const thisMonthSummary = useMemo(() => {
    const now = new Date();
    return activities.reduce(
      (summary, activity) => {
        const sameMonth =
          activity.source === 'transaction' &&
          activity.date.getMonth() === now.getMonth() &&
          activity.date.getFullYear() === now.getFullYear();
        if (!sameMonth) return summary;

        if (activity.actionType === 'income') summary.income += activity.amount;
        if (activity.actionType === 'expense') summary.expense += activity.amount;
        if (activity.actionType === 'transfer_in') summary.transferIn += activity.amount;
        if (activity.actionType === 'transfer_out') summary.transferOut += activity.amount;
        return summary;
      },
      { income: 0, expense: 0, transferIn: 0, transferOut: 0 }
    );
  }, [activities]);

  const brand = getWalletBrandPreset(wallet?.icon);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          title: wallet?.name ?? 'รายละเอียดกระเป๋า',
          headerStyle: { backgroundColor: colors.tint },
          headerTintColor: '#FFF',
        }}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 16 }}>
        {wallet ? (
          <Card variant="elevated">
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <WalletAvatar icon={wallet.icon} size={68} />
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={{ fontSize: 21, fontWeight: '800', color: colors.text }}>
                  {wallet.name}
                </Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
                  {brand?.name ?? getWalletDisplayType(wallet.icon)}
                </Text>
                <Text style={{ fontSize: 28, fontWeight: '800', color: colors.text, marginTop: 8 }}>
                  {formatCurrency(wallet.balance ?? 0)} บาท
                </Text>
              </View>
            </View>
          </Card>
        ) : (
          <Card variant="elevated">
            <Text style={{ fontSize: 15, color: colors.textSecondary }}>
              {isLoading ? 'กำลังโหลดข้อมูลกระเป๋า...' : 'ไม่พบกระเป๋าที่เลือก'}
            </Text>
          </Card>
        )}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Card variant="elevated" style={{ flex: 1, minWidth: 150 }}>
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>รายรับเดือนนี้</Text>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.income, marginTop: 6 }}>
              +{formatCurrency(thisMonthSummary.income)}
            </Text>
          </Card>
          <Card variant="elevated" style={{ flex: 1, minWidth: 150 }}>
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>รายจ่ายเดือนนี้</Text>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.expense, marginTop: 6 }}>
              -{formatCurrency(thisMonthSummary.expense)}
            </Text>
          </Card>
          <Card variant="elevated" style={{ flex: 1, minWidth: 150 }}>
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>โอนเข้าเดือนนี้</Text>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.income, marginTop: 6 }}>
              +{formatCurrency(thisMonthSummary.transferIn)}
            </Text>
          </Card>
          <Card variant="elevated" style={{ flex: 1, minWidth: 150 }}>
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>โอนออกเดือนนี้</Text>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.transfer, marginTop: 6 }}>
              -{formatCurrency(thisMonthSummary.transferOut)}
            </Text>
          </Card>
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable
            onPress={() => router.push('/(tabs)/add' as any)}
            style={{
              flex: 1,
              paddingVertical: 14,
              borderRadius: 14,
              backgroundColor: colors.tint,
              alignItems: 'center',
            }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFF' }}>บันทึกรายการ</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/wallet-transfer' as any)}
            style={{
              flex: 1,
              paddingVertical: 14,
              borderRadius: 14,
              backgroundColor: colors.transfer,
              alignItems: 'center',
            }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFF' }}>โอนเงิน</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/wallet-manage' as any)}
            style={{
              flex: 1,
              paddingVertical: 14,
              borderRadius: 14,
              backgroundColor: colors.cardBackground,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: 'center',
            }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>จัดการ</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {FILTERS.map((item) => {
            const active = filter === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setFilter(item.key)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: active ? colors.tint : colors.cardBackground,
                  borderWidth: 1,
                  borderColor: active ? colors.tint : colors.border,
                }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '700',
                    color: active ? '#FFF' : colors.textSecondary,
                  }}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={{ gap: 10 }}>
          {filteredActivities.map((activity) => {
            const amountColor =
              activity.signedAmount >= 0
                ? activity.actionType === 'deleted'
                  ? colors.income
                  : colors.income
                : activity.actionType === 'transfer_out'
                ? colors.transfer
                : colors.expense;

            const amountPrefix = activity.signedAmount > 0 ? '+' : '';

            return (
              <Card key={activity.id} variant="elevated">
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <View
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      backgroundColor:
                        activity.categoryColor
                          ? `${activity.categoryColor}22`
                          : colors.tint + '16',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}>
                    <FontAwesome
                      name={getActivityIcon(activity)}
                      size={16}
                      color={activity.actionType === 'deleted' ? colors.expense : colors.tint}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 10,
                      }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                          {getActivityTitle(activity)}
                        </Text>
                        <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 3 }}>
                          {activity.categoryName
                            ? `${activity.categoryIcon ?? ''} ${activity.categoryName}`
                            : 'ไม่มีหมวดหมู่'}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: amountColor }}>
                        {amountPrefix}
                        {formatCurrency(activity.signedAmount)}
                      </Text>
                    </View>

                    {activity.note ? (
                      <Text style={{ fontSize: 13, color: colors.text, marginTop: 8 }}>
                        {activity.note}
                      </Text>
                    ) : null}

                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 8 }}>
                      {formatDateTime(activity.date)}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
                      ก่อนทำรายการ {formatCurrency(activity.balanceBefore)} บาท
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                      หลังทำรายการ {formatCurrency(activity.balanceAfter)} บาท
                    </Text>
                  </View>
                </View>
              </Card>
            );
          })}

          {!isLoading && filteredActivities.length === 0 && (
            <Card variant="elevated">
              <Text style={{ fontSize: 15, color: colors.textSecondary, textAlign: 'center' }}>
                ยังไม่มีรายการในมุมมองนี้
              </Text>
            </Card>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
