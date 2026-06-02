import { View, Text } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { formatCompact } from '@/lib/format';
import type { WeeklySummary } from '@/services/reportService';

type Props = {
  data: WeeklySummary[];
};

export function WeeklyBarChart({ data }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  if (data.length === 0) {
    return (
      <View style={{ alignItems: 'center', padding: 24 }}>
        <Text style={{ fontSize: 32, marginBottom: 8 }}>📊</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>ไม่มีข้อมูล</Text>
      </View>
    );
  }

  const barData = data.flatMap((week) => [
    {
      value: week.income,
      label: week.weekLabel,
      frontColor: colors.income,
      spacing: 2,
      labelWidth: 50,
      labelTextStyle: { color: colors.textSecondary, fontSize: 10 },
    },
    {
      value: week.expense,
      frontColor: colors.expense,
      spacing: 16,
    },
  ]);

  const maxValue = Math.max(
    ...data.map((w) => Math.max(w.income, w.expense)),
    100
  );

  return (
    <View>
      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 16 }}>
        เปรียบเทียบรายสัปดาห์
      </Text>

      {/* Legend */}
      <View style={{ flexDirection: 'row', gap: 16, marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: colors.income }} />
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>รายรับ</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: colors.expense }} />
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>รายจ่าย</Text>
        </View>
      </View>

      <BarChart
        data={barData}
        barWidth={16}
        noOfSections={4}
        maxValue={maxValue * 1.1}
        yAxisTextStyle={{ color: colors.textSecondary, fontSize: 10 }}
        xAxisColor={colors.border}
        yAxisColor={colors.border}
        backgroundColor={colors.cardBackground}
        formatYLabel={(val) => formatCompact(Number(val))}
        isAnimated
        animationDuration={500}
        height={160}
        roundedTop
        roundedBottom
      />
    </View>
  );
}
