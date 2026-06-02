import { View, Text, Pressable, ScrollView } from 'react-native';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import type { Category } from '@/db/schema';

type Props = {
  categories: Category[];
  selectedId: string | null;
  onSelect: (category: Category) => void;
};

export function CategoryGrid({ categories, selectedId, onSelect }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 8,
        gap: 8,
      }}>
      {categories.map((cat) => {
        const isSelected = cat.id === selectedId;
        return (
          <Pressable
            key={cat.id}
            onPress={() => onSelect(cat)}
            style={{
              width: '22%',
              alignItems: 'center',
              paddingVertical: 12,
              paddingHorizontal: 4,
              borderRadius: 12,
              backgroundColor: isSelected
                ? (cat.color ?? colors.tint) + '20'
                : 'transparent',
              borderWidth: isSelected ? 2 : 0,
              borderColor: cat.color ?? colors.tint,
            }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: (cat.color ?? '#607D8B') + '15',
                justifyContent: 'center',
                alignItems: 'center',
              }}>
              <Text style={{ fontSize: 24 }}>{cat.icon}</Text>
            </View>
            <Text
              style={{
                fontSize: 11,
                color: isSelected ? (cat.color ?? colors.tint) : colors.textSecondary,
                fontWeight: isSelected ? '700' : '500',
                marginTop: 6,
                textAlign: 'center',
              }}
              numberOfLines={2}>
              {cat.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
