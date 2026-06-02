import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Colors from '@/constants/Colors';
import { Card } from '@/components/ui/Card';
import { useColorScheme } from '@/components/useColorScheme';
import {
  taxReadinessService,
  type TaxChecklistItem,
  type TaxReadinessChecklist,
} from '@/services/taxReadinessService';

const STATUS_META: Record<TaxChecklistItem['status'], { icon: string; label: string; color: string }> = {
  ready: { icon: 'check-circle', label: 'พร้อมตรวจ', color: '#4CAF50' },
  'needs-review': { icon: 'exclamation-circle', label: 'ควรตรวจเพิ่ม', color: '#FF9800' },
  'not-started': { icon: 'circle-o', label: 'ยังไม่มีข้อมูล', color: '#9CA3AF' },
};

export default function TaxReadinessScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [data, setData] = useState<TaxReadinessChecklist | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const checklist = await taxReadinessService.getChecklist();
      setData(checklist);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          title: 'Tax Checklist',
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
            Checklist ความครบถ้วนเอกสารภาษี
          </Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 20, marginTop: 6 }}>
            ปีภาษี {data?.taxYear ?? '-'} เน้นรวบรวมข้อมูลและเอกสาร ไม่ประเมินเป็นคะแนนและไม่คำนวณภาษี
          </Text>
        </Card>

        {data && (
          <>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <SummaryBox label="พร้อมตรวจ" value={data.summary.ready} color={colors.income} />
              <SummaryBox label="ควรตรวจเพิ่ม" value={data.summary.needsReview} color={colors.transfer} />
              <SummaryBox label="ยังไม่มีข้อมูล" value={data.summary.notStarted} color={colors.textSecondary} />
            </View>

            <Card variant="elevated" style={{ gap: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>
                รายการตรวจความครบถ้วน
              </Text>
              {data.checklist.map((item) => {
                const meta = STATUS_META[item.status];
                return (
                  <View key={item.id} style={{ flexDirection: 'row', gap: 12 }}>
                    <FontAwesome name={meta.icon as any} size={20} color={meta.color} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                        {item.label}
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 18, marginTop: 2 }}>
                        {item.detail}
                      </Text>
                      <Text style={{ fontSize: 11, color: meta.color, fontWeight: '700', marginTop: 3 }}>
                        {meta.label}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </Card>

            <Card variant="elevated" style={{ gap: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>
                รอบยื่นที่ควรเตือน
              </Text>
              {data.reminders.map((reminder) => (
                <View
                  key={reminder.form}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 12,
                    padding: 12,
                    backgroundColor: colors.background,
                  }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>
                    {reminder.form} · {reminder.title}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 18, marginTop: 4 }}>
                    {reminder.detail}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.tint, fontWeight: '700', marginTop: 6 }}>
                    {reminder.windowLabel}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, lineHeight: 17, marginTop: 6 }}>
                    เหมาะกับ: {reminder.audience}
                  </Text>
                </View>
              ))}
            </Card>

            <Card variant="elevated" style={{ backgroundColor: '#FFF8E1', borderWidth: 1, borderColor: '#FFCC80' }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <FontAwesome name="info-circle" size={18} color="#F57C00" />
                <Text style={{ flex: 1, fontSize: 12, lineHeight: 18, color: '#8D4A00' }}>
                  {data.disclaimer}
                </Text>
              </View>
            </Card>
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

function SummaryBox({ label, value, color }: { label: string; value: number; color: string }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <Card variant="elevated" style={{ flex: 1, padding: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: '800', color }}>{value}</Text>
      <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4 }}>{label}</Text>
    </Card>
  );
}
