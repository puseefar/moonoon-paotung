import { View, Text, Pressable } from 'react-native';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { formatCurrency } from '@/lib/format';
import type { TransactionType, TransactionWithCategory } from '@/types';

function getWalletLabel(type: TransactionType, walletName: string | null): string {
  const name = walletName ?? 'ไม่ระบุกระเป๋า';
  if (type === 'income') return `เข้ากระเป๋า: ${name}`;
  if (type === 'expense') return `จ่ายจาก: ${name}`;
  if (type === 'opening') return `กระเป๋า: ${name}`;
  if (type === 'transfer_out' || type === 'transfer') return `โอนจาก: ${name}`;
  if (type === 'transfer_in') return `รับเข้า: ${name}`;
  return `กระเป๋า: ${name}`;
}

type Props = {
  transaction: TransactionWithCategory;
  onPress?: () => void;
};

export function TransactionItem({ transaction, onPress }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { type } = transaction;
  const isExpense = type === 'expense';
  // โอน (legacy แถวเดียว / คู่ entry) แสดงโทนกลางเหมือนกัน
  const isTransfer = type === 'transfer' || type === 'transfer_out' || type === 'transfer_in';
  const isOutflow = isExpense || type === 'transfer_out';
  const isOpening = type === 'opening';
  // null = ยังไม่จัดหมวด (แสดงเป็น "อื่นๆ" + ป้าย "รอจัด") เฉพาะรายรับ/รายจ่าย
  const isPendingCategory = !transaction.categoryId && (type === 'income' || type === 'expense');

  const walletLabel = getWalletLabel(type, transaction.walletName ?? null);

  const amountColor = isOutflow
    ? colors.expense
    : isTransfer
    ? colors.transfer
    : colors.income;

  const prefix = isOutflow ? '-' : isTransfer ? '+' : isOpening ? '' : '+';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: pressed ? colors.border + '40' : 'transparent',
      })}>
      {/* Icon */}
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          backgroundColor: (transaction.categoryColor ?? '#607D8B') + '20',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
        <Text style={{ fontSize: 22 }}>
          {transaction.categoryIcon ?? (isTransfer ? '🔄' : isOpening ? '🚩' : '📦')}
        </Text>
      </View>

      {/* Details */}
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: '600',
              color: colors.text,
              flexShrink: 1,
            }}
            numberOfLines={1}>
            {transaction.categoryName ?? (isTransfer ? 'โอนเงิน' : isOpening ? 'ยอดตั้งต้น' : 'อื่นๆ')}
          </Text>
          {isPendingCategory && (
            <View
              style={{
                paddingHorizontal: 6,
                paddingVertical: 1,
                borderRadius: 6,
                backgroundColor: '#FFF3E0',
                borderWidth: 1,
                borderColor: '#FFB74D',
              }}>
              <Text style={{ fontSize: 9.5, fontWeight: '700', color: '#E65100' }}>รอจัด</Text>
            </View>
          )}
        </View>
        {transaction.note ? (
          <Text
            style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}
            numberOfLines={1}>
            {transaction.note}
          </Text>
        ) : null}
        <Text
          style={{ fontSize: 11.5, color: colors.textSecondary, marginTop: 1, opacity: 0.75 }}
          numberOfLines={1}>
          {walletLabel}
        </Text>
      </View>

      {/* Amount */}
      <Text
        style={{
          fontSize: 16,
          fontWeight: '700',
          color: amountColor,
        }}>
        {prefix}{formatCurrency(transaction.amount)}
      </Text>
    </Pressable>
  );
}
