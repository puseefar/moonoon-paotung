import { useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { formatCurrency } from '@/lib/format';
import type { TransactionWithCategory } from '@/types';

type Props = {
  legs: TransactionWithCategory[];
  onDelete: () => void;
};

// การ์ดชุดซื้อ-ขายใบเดียว (compound trade) — ต้นทุน/ยอดขาย/กำไร (กำไร = derived)
// ลบครั้งเดียว → หายทั้งชุด (atomic) ผ่าน onDelete (deleteTradeGroup)
export function TradeGroupCard({ legs, onDelete }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const swipeableRef = useRef<Swipeable>(null);

  const cost = legs
    .filter((l) => l.type === 'expense')
    .reduce((s, l) => s + l.amount, 0);
  const sale = legs
    .filter((l) => l.type === 'income')
    .reduce((s, l) => s + l.amount, 0);
  const profit = sale - cost;
  const isLoss = profit < 0;

  const title =
    legs.find((l) => l.type === 'income')?.categoryName ??
    legs[0]?.categoryName ??
    'ชุดซื้อ-ขาย';
  const baseNote = (legs[0]?.note ?? '').replace(/\s*\((ต้นทุน|ยอดขาย)\)\s*$/, '');

  const costWallet = legs.find((l) => l.type === 'expense')?.walletName ?? null;
  const saleWallet = legs.find((l) => l.type === 'income')?.walletName ?? null;
  const walletLine =
    costWallet && saleWallet
      ? costWallet === saleWallet
        ? `กระเป๋า: ${costWallet}`
        : `ต้นทุน: ${costWallet} · รับเข้า: ${saleWallet}`
      : (costWallet ?? saleWallet ?? 'ไม่ระบุกระเป๋า');

  const renderRightActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    _dragX: Animated.AnimatedInterpolation<number>
  ) => (
    <Pressable
      onPress={() => {
        swipeableRef.current?.close();
        onDelete();
      }}
      style={{ backgroundColor: '#F44336', justifyContent: 'center', alignItems: 'center', width: 80 }}>
      <FontAwesome name="trash" size={18} color="#FFF" />
      <Text style={{ color: '#FFF', fontSize: 11, marginTop: 4, fontWeight: '700' }}>ลบทั้งชุด</Text>
    </Pressable>
  );

  return (
    <Swipeable ref={swipeableRef} renderRightActions={renderRightActions} overshootRight={false} friction={2}>
      <View style={{ backgroundColor: colors.cardBackground, paddingHorizontal: 16, paddingVertical: 12 }}>
        <View style={{ borderLeftWidth: 3, borderLeftColor: '#7F77DD', paddingLeft: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Text style={{ fontSize: 14.5, fontWeight: '800', color: colors.text, flexShrink: 1 }} numberOfLines={1}>
              🧺 {title}
            </Text>
            <View style={{ backgroundColor: '#7F77DD22', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 }}>
              <Text style={{ fontSize: 9.5, fontWeight: '800', color: '#5B52C9' }}>🔗 ชุดซื้อ-ขาย</Text>
            </View>
          </View>
          {baseNote ? (
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 2 }} numberOfLines={1}>
              {baseNote}
            </Text>
          ) : null}
          <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 6, opacity: 0.75 }} numberOfLines={1}>
            {walletLine}
          </Text>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 1 }}>
            <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>ยอดขาย</Text>
            <Text style={{ fontSize: 13.5, fontWeight: '700', color: colors.income }}>+{formatCurrency(sale)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 1 }}>
            <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>ต้นทุน</Text>
            <Text style={{ fontSize: 13.5, fontWeight: '700', color: colors.expense }}>−{formatCurrency(cost)}</Text>
          </View>
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: isLoss ? colors.expense : '#5B52C9' }}>
              {isLoss ? 'ขาดทุน' : 'กำไรสุทธิ'}
            </Text>
            <Text style={{ fontSize: 15, fontWeight: '900', color: isLoss ? colors.expense : '#5B52C9' }}>
              {isLoss ? '−' : '+'}{formatCurrency(Math.abs(profit))}
            </Text>
          </View>
        </View>
      </View>
    </Swipeable>
  );
}
