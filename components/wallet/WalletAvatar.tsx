import { Image, Text, View } from 'react-native';
import { getWalletBrandPreset } from '@/constants/walletBrands';

type Props = {
  icon?: string | null;
  size?: number;
  backgroundColor?: string;
};

export function WalletAvatar({ icon, size = 48, backgroundColor }: Props) {
  const brand = getWalletBrandPreset(icon);
  const radius = Math.round(size * 0.3);

  if (brand) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: backgroundColor ?? brand.backgroundColor,
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
        }}>
        {brand.icon ? (
          <Image
            source={brand.icon}
            style={{ width: size, height: size }}
            resizeMode="cover"
          />
        ) : (
          <Text style={{ fontSize: Math.round(size * 0.44) }}>{brand.fallbackEmoji}</Text>
        )}
      </View>
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: backgroundColor ?? '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
      }}>
      <Text style={{ fontSize: Math.round(size * 0.5) }}>{icon || '💵'}</Text>
    </View>
  );
}
