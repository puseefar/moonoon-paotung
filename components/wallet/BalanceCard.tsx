import { View, Text } from 'react-native';
import { formatCurrency, formatMonthYear } from '@/lib/format';
import type { MonthlyBalance, MonthYear } from '@/types';

type Props = {
  totalBalance: number;
  monthlyBalance: MonthlyBalance;
  currentMonth: MonthYear;
};

export function BalanceCard({ totalBalance, monthlyBalance, currentMonth }: Props) {
  return (
    <View
      style={{
        borderRadius: 20,
        overflow: 'hidden',
        marginHorizontal: 16,
        marginTop: 16,
      }}>
      <View
        style={{
          backgroundColor: '#1976D2',
          padding: 20,
        }}>
        {/* ยอดคงเหลือรวม */}
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>
          ยอดคงเหลือรวม
        </Text>
        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 32,
            fontWeight: '800',
            marginTop: 4,
          }}>
          {formatCurrency(totalBalance)}
          <Text style={{ fontSize: 16, fontWeight: '400' }}> บาท</Text>
        </Text>

        {/* เดือนปัจจุบัน */}
        <Text
          style={{
            color: 'rgba(255,255,255,0.6)',
            fontSize: 13,
            marginTop: 12,
          }}>
          {formatMonthYear(currentMonth.month, currentMonth.year)}
        </Text>

        {/* รายรับ / รายจ่าย */}
        <View
          style={{
            flexDirection: 'row',
            marginTop: 8,
            gap: 24,
          }}>
          {/* รายรับ */}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: '#66BB6A',
                }}
              />
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
                รายรับ
              </Text>
            </View>
            <Text
              style={{
                color: '#66BB6A',
                fontSize: 18,
                fontWeight: '700',
                marginTop: 4,
              }}>
              +{formatCurrency(monthlyBalance.totalIncome)}
            </Text>
          </View>

          {/* รายจ่าย */}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: '#EF5350',
                }}
              />
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
                รายจ่าย
              </Text>
            </View>
            <Text
              style={{
                color: '#EF5350',
                fontSize: 18,
                fontWeight: '700',
                marginTop: 4,
              }}>
              -{formatCurrency(monthlyBalance.totalExpense)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
