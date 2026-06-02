import { View, type ViewProps } from 'react-native';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

type CardProps = ViewProps & {
  variant?: 'default' | 'elevated';
};

export function Card({ style, variant = 'default', ...props }: CardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View
      style={[
        {
          backgroundColor: colors.cardBackground,
          borderRadius: 16,
          padding: 16,
          ...(variant === 'elevated'
            ? {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
                elevation: 3,
              }
            : {
                borderWidth: 1,
                borderColor: colors.border,
              }),
        },
        style,
      ]}
      {...props}
    />
  );
}
