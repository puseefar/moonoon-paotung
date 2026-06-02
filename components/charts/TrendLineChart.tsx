import { View, Text } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { formatCompact } from '@/lib/format';
import type { MonthlyTrend } from '@/services/reportService';

type Props = {
  data: MonthlyTrend[];
};

export function TrendLineChart({ data }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  if (data.length === 0) {
    return (
      <View style={{ alignItems: 'center', padding: 24 }}>
        <Text style={{ fontSize: 32, marginBottom: 8 }}>📈</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>ไม่มีข้อมูล</Text>
      </View>
    );
  }

  const incomeData = data.map((item) => ({
    value: item.income,
    label: item.label,
    labelTextStyle: { color: colors.textSecondary, fontSize: 10, width: 36 },
  }));

  const expenseData = data.map((item) => ({
    value: item.expense,
  }));

  const maxValue = Math.max(
    ...data.map((d) => Math.max(d.income, d.expense)),
    100
  );

  return (
    <View>
      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 16 }}>
        แนวโน้มย้อนหลัง 6 เดือน
      </Text>

      {/* Legend */}
      <View style={{ flexDirection: 'row', gap: 16, marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 16, height: 3, borderRadius: 2, backgroundColor: colors.income }} />
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>รายรับ</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 16, height: 3, borderRadius: 2, backgroundColor: colors.expense }} />
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>รายจ่าย</Text>
        </View>
      </View>

      <LineChart
        data={incomeData}
        data2={expenseData}
        height={160}
        maxValue={maxValue * 1.1}
        noOfSections={4}
        spacing={50}
        color1={colors.income}
        color2={colors.expense}
        dataPointsColor1={colors.income}
        dataPointsColor2={colors.expense}
        textColor1={colors.textSecondary}
        xAxisColor={colors.border}
        yAxisColor={colors.border}
        yAxisTextStyle={{ color: colors.textSecondary, fontSize: 10 }}
        formatYLabel={(val) => formatCompact(Number(val))}
        curved
        isAnimated
        animationDuration={500}
        thickness={2.5}
        dataPointsRadius={4}
        startFillColor1={colors.income + '30'}
        endFillColor1={colors.income + '05'}
        startFillColor2={colors.expense + '30'}
        endFillColor2={colors.expense + '05'}
        areaChart
      />
    </View>
  );
}
