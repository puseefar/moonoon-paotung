import { useRef } from 'react';
import { View, Text, Pressable, Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { TransactionItem } from './TransactionItem';
import type { TransactionWithCategory } from '@/types';

type Props = {
  transaction: TransactionWithCategory;
  onEdit?: () => void;
  onDelete?: () => void;
};

export function SwipeableTransactionItem({ transaction, onEdit, onDelete }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const swipeableRef = useRef<Swipeable>(null);

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    return (
      <View style={{ flexDirection: 'row' }}>
        {/* Edit */}
        {onEdit && (
          <Pressable
            onPress={() => {
              swipeableRef.current?.close();
              onEdit();
            }}
            style={{
              backgroundColor: '#FF9800',
              justifyContent: 'center',
              alignItems: 'center',
              width: 72,
            }}>
            <FontAwesome name="pencil" size={18} color="#FFF" />
            <Text style={{ color: '#FFF', fontSize: 11, marginTop: 4, fontWeight: '600' }}>
              แก้ไข
            </Text>
          </Pressable>
        )}

        {/* Delete */}
        {onDelete && (
          <Pressable
            onPress={() => {
              swipeableRef.current?.close();
              onDelete();
            }}
            style={{
              backgroundColor: '#F44336',
              justifyContent: 'center',
              alignItems: 'center',
              width: 72,
            }}>
            <FontAwesome name="trash" size={18} color="#FFF" />
            <Text style={{ color: '#FFF', fontSize: 11, marginTop: 4, fontWeight: '600' }}>
              ลบ
            </Text>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}>
      <View style={{ backgroundColor: colors.cardBackground }}>
        <TransactionItem transaction={transaction} />
      </View>
    </Swipeable>
  );
}
