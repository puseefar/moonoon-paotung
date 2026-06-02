import { View, Text } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { formatCurrency } from '@/lib/format';
import type { CategoryBreakdown } from '@/services/reportService';

type Props = {
  data: CategoryBreakdown[];
  totalAmount: number;
  title?: string;
  titleColor?: string;
  centerAmountColor?: string;
};

export function ExpensePieChart({ data, totalAmount, title = 'สัดส่วนรายจ่าย', titleColor, centerAmountColor }: Props) {
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

  const pieData = data.map((item) => ({
    value: item.total,
    color: item.categoryColor,
    text: `${item.percentage.toFixed(0)}%`,
    textColor: '#FFF',
    textSize: 11,
  }));

  return (
    <View>
      <Text style={{ fontSize: 15, fontWeight: '700', color: titleColor ?? colors.text, marginBottom: 16 }}>
        {title}
      </Text>

      <View style={{ alignItems: 'center' }}>
        <PieChart
          data={pieData}
          donut
          radius={90}
          innerRadius={55}
          innerCircleColor={colors.cardBackground}
          centerLabelComponent={() => (
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>รวม</Text>
              <Text style={{ fontSize: 16, fontWeight: '800', color: centerAmountColor ?? colors.text }}>
                {formatCurrency(totalAmount)}
              </Text>
            </View>
          )}
        />
      </View>

      {/* Legend */}
      <View style={{ marginTop: 16, gap: 8 }}>
        {data.slice(0, 6).map((item) => (
          <View
            key={item.categoryId}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}>
              <View
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  backgroundColor: item.categoryColor,
                }}
              />
              <Text style={{ fontSize: 14 }}>{item.categoryIcon}</Text>
              <Text style={{ fontSize: 13, color: colors.text }} numberOfLines={1}>
                {item.categoryName}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>
                {formatCurrency(item.total)}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, width: 40, textAlign: 'right' }}>
                {item.percentage.toFixed(1)}%
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
