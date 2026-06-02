import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Colors from '@/constants/Colors';
import { Card } from '@/components/ui/Card';
import { useColorScheme } from '@/components/useColorScheme';
import { formatCurrency } from '@/lib/format';
import type { ScannedSlip } from '@/db/schema';
import {
  SLIP_INBOX_STATUSES,
  slipInboxService,
  type SlipInboxStatus,
  type SlipInboxSummary,
} from '@/services/slipInboxService';

const STATUS_COLOR: Record<SlipInboxStatus, string> = {
  pending: '#7C3AED',
  needs_review: '#FF9800',
  confirmed: '#4CAF50',
  tax_evidence: '#0EA5E9',
  skipped: '#9CA3AF',
};

const STATUS_ICON: Record<SlipInboxStatus, React.ComponentProps<typeof FontAwesome>['name']> = {
  pending: 'inbox',
  needs_review: 'exclamation-circle',
  confirmed: 'check-circle',
  tax_evidence: 'file-text-o',
  skipped: 'ban',
};

const EMPTY_SUMMARY: SlipInboxSummary = {
  pending: 0,
  needs_review: 0,
  confirmed: 0,
  tax_evidence: 0,
  skipped: 0,
};

function getStatusLabel(status: string | null) {
  return SLIP_INBOX_STATUSES.find((item) => item.status === status)?.label ?? 'ไม่ระบุ';
}

function formatSlipDate(value: string | null) {
  if (!value) return 'ไม่ระบุวันที่';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear() + 543}`;
}

export default function SlipInboxScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [slips, setSlips] = useState<ScannedSlip[]>([]);
  const [summary, setSummary] = useState<SlipInboxSummary>(EMPTY_SUMMARY);
  const [activeStatus, setActiveStatus] = useState<SlipInboxStatus | 'all'>('all');
  const [isLoading, setIsLoading] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [allSlips, counts] = await Promise.all([
        activeStatus === 'all'
          ? slipInboxService.getAll()
          : slipInboxService.getByStatus(activeStatus),
        slipInboxService.getSummary(),
      ]);
      setSlips(allSlips);
      setSummary(counts);
    } finally {
      setIsLoading(false);
    }
  }, [activeStatus]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const updateStatus = async (id: string, status: SlipInboxStatus) => {
    await slipInboxService.updateStatus(id, status);
    await loadData();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          title: 'Slip Inbox',
          headerStyle: { backgroundColor: colors.tint },
          headerTintColor: '#FFF',
        }}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadData} />}>
        <Card variant="elevated">
          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>
            กล่องสลิปในเครื่อง
          </Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 20, marginTop: 6 }}>
            Free ใช้แนว local-first: ข้อมูลสลิปอยู่ในเครื่องคุณ ไม่ขึ้น cloud เว้นแต่คุณเลือกสำรองหรือ sync เองในอนาคต
          </Text>
        </Card>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <FilterChip
            label="ทั้งหมด"
            count={Object.values(summary).reduce((sum, count) => sum + count, 0)}
            active={activeStatus === 'all'}
            color={colors.tint}
            onPress={() => setActiveStatus('all')}
          />
          {SLIP_INBOX_STATUSES.map((item) => (
            <FilterChip
              key={item.status}
              label={item.label}
              count={summary[item.status]}
              active={activeStatus === item.status}
              color={STATUS_COLOR[item.status]}
              onPress={() => setActiveStatus(item.status)}
            />
          ))}
        </ScrollView>

        <View style={{ gap: 10 }}>
          {slips.map((slip) => {
            const status = (slip.status ?? 'pending') as SlipInboxStatus;
            const statusColor = STATUS_COLOR[status] ?? colors.tint;
            return (
              <Card key={slip.id} variant="elevated" style={{ gap: 12 }}>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      backgroundColor: statusColor + '18',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <FontAwesome name={STATUS_ICON[status] ?? 'inbox'} size={18} color={statusColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>
                      {slip.amount ? `${formatCurrency(slip.amount)} บาท` : 'ยังไม่พบยอดเงิน'}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 3 }}>
                      {slip.bankName || 'ไม่ระบุธนาคาร'} · {formatSlipDate(slip.transferDate)}
                    </Text>
                    <Text style={{ fontSize: 12, color: statusColor, fontWeight: '700', marginTop: 4 }}>
                      {getStatusLabel(status)}
                    </Text>
                  </View>
                </View>

                <View style={{ gap: 4 }}>
                  {slip.senderName && (
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>จาก: {slip.senderName}</Text>
                  )}
                  {slip.receiverName && (
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>ถึง: {slip.receiverName}</Text>
                  )}
                  {slip.refCode && (
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>Ref: {slip.refCode}</Text>
                  )}
                </View>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <ActionButton
                    label="ต้องตรวจ"
                    color={STATUS_COLOR.needs_review}
                    disabled={status === 'needs_review'}
                    onPress={() => updateStatus(slip.id, 'needs_review')}
                  />
                  <ActionButton
                    label="สำเร็จ"
                    color={STATUS_COLOR.confirmed}
                    disabled={status === 'confirmed'}
                    onPress={() => updateStatus(slip.id, 'confirmed')}
                  />
                  <ActionButton
                    label="หลักฐานภาษี"
                    color={STATUS_COLOR.tax_evidence}
                    disabled={status === 'tax_evidence'}
                    onPress={() => updateStatus(slip.id, 'tax_evidence')}
                  />
                  <ActionButton
                    label="ข้าม"
                    color={STATUS_COLOR.skipped}
                    disabled={status === 'skipped'}
                    onPress={() => updateStatus(slip.id, 'skipped')}
                  />
                </View>
              </Card>
            );
          })}
        </View>

        {slips.length === 0 && (
          <Card variant="elevated">
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, textAlign: 'center' }}>
              ยังไม่มีสลิปในกล่องนี้
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 6 }}>
              สแกนสลิปหรือเลือกรูปจาก Gallery เพื่อเริ่มสะสมข้อมูลในเครื่อง
            </Text>
          </Card>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

function FilterChip({
  label,
  count,
  active,
  color,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        borderRadius: 999,
        paddingHorizontal: 13,
        paddingVertical: 9,
        backgroundColor: active ? color : '#FFFFFF',
        borderWidth: 1,
        borderColor: color,
      }}>
      <Text style={{ fontSize: 12, fontWeight: '800', color: active ? '#FFF' : color }}>
        {label} {count}
      </Text>
    </Pressable>
  );
}

function ActionButton({
  label,
  color,
  disabled,
  onPress,
}: {
  label: string;
  color: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 7,
        backgroundColor: disabled ? '#E5E7EB' : pressed ? color + '30' : color + '16',
      })}>
      <Text style={{ fontSize: 12, fontWeight: '800', color: disabled ? '#9CA3AF' : color }}>
        {label}
      </Text>
    </Pressable>
  );
}
