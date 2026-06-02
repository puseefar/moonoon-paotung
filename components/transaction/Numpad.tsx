import { View, Text, Pressable } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

type Props = {
  onPress: (key: string) => void;
  onDelete: () => void;
  onClear: () => void;
};

const KEYS = [
  ['7', '8', '9'],
  ['4', '5', '6'],
  ['1', '2', '3'],
  ['.', '0', 'del'],
];

export function Numpad({ onPress, onDelete, onClear }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View style={{ paddingHorizontal: 16, gap: 6 }}>
      {KEYS.map((row, rowIndex) => (
        <View key={rowIndex} style={{ flexDirection: 'row', gap: 6 }}>
          {row.map((key) => (
            <Pressable
              key={key}
              onPress={() => {
                if (key === 'del') {
                  onDelete();
                } else {
                  onPress(key);
                }
              }}
              onLongPress={() => {
                if (key === 'del') onClear();
              }}
              style={({ pressed }) => ({
                flex: 1,
                height: 48,
                borderRadius: 12,
                backgroundColor: pressed
                  ? colors.border
                  : colors.cardBackground,
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: colors.border,
              })}>
              {key === 'del' ? (
                <FontAwesome
                  name="long-arrow-left"
                  size={22}
                  color={colors.text}
                />
              ) : (
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: '600',
                    color: colors.text,
                  }}>
                  {key}
                </Text>
              )}
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}
