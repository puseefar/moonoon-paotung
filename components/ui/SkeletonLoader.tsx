import { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

type Props = {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: object;
};

export function SkeletonLoader({ width, height, borderRadius = 8, style }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: colors.border,
          opacity,
        },
        style,
      ]}
    />
  );
}

// Skeleton สำหรับรายการ transaction
export function TransactionSkeleton() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}>
      <SkeletonLoader width={44} height={44} borderRadius={12} />
      <View style={{ flex: 1, gap: 8 }}>
        <SkeletonLoader width="60%" height={14} />
        <SkeletonLoader width="40%" height={12} />
      </View>
      <SkeletonLoader width={80} height={16} />
    </View>
  );
}

// Skeleton สำหรับ Balance Card
export function BalanceCardSkeleton() {
  return (
    <View style={{ margin: 16, padding: 20, borderRadius: 20, backgroundColor: '#1976D2', gap: 12 }}>
      <SkeletonLoader width={100} height={14} borderRadius={4} />
      <SkeletonLoader width={200} height={32} borderRadius={4} />
      <SkeletonLoader width={120} height={12} borderRadius={4} />
      <View style={{ flexDirection: 'row', gap: 24, marginTop: 8 }}>
        <View style={{ flex: 1, gap: 6 }}>
          <SkeletonLoader width={60} height={12} borderRadius={4} />
          <SkeletonLoader width={100} height={18} borderRadius={4} />
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <SkeletonLoader width={60} height={12} borderRadius={4} />
          <SkeletonLoader width={100} height={18} borderRadius={4} />
        </View>
      </View>
    </View>
  );
}
