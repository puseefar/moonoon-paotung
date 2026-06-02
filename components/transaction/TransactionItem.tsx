import { View, Text, Pressable } from 'react-native';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { formatCurrency } from '@/lib/format';
import type { TransactionWithCategory } from '@/types';

type Props = {
  transaction: TransactionWithCategory;
  onPress?: () => void;
};

export function TransactionItem({ transaction, onPress }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isExpense = transaction.type === 'expense';
  const isTransfer = transaction.type === 'transfer';

  const amountColor = isExpense
    ? colors.expense
    : isTransfer
    ? colors.transfer
    : colors.income;

  const prefix = isExpense ? '-' : isTransfer ? '' : '+';

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
          {transaction.categoryIcon ?? (isTransfer ? '🔄' : '📦')}
        </Text>
      </View>

      {/* Details */}
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text
          style={{
            fontSize: 15,
            fontWeight: '600',
            color: colors.text,
          }}
          numberOfLines={1}>
          {transaction.categoryName ?? (isTransfer ? 'โอนเงิน' : 'ไม่มีหมวดหมู่')}
        </Text>
        <Text
          style={{
            fontSize: 13,
            color: colors.textSecondary,
            marginTop: 2,
          }}
          numberOfLines={1}>
          {transaction.note || transaction.walletName}
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
