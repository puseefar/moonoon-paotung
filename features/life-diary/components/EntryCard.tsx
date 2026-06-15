import { View, Text, Pressable } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { formatCurrency } from '@/lib/format';
import type { EntryWithRelations } from '../types';

interface Props {
  item: EntryWithRelations;
  onPress: () => void;
}

export function EntryCard({ item, onPress }: Props) {
  const { entry, media, totalExpenses } = item;
  const firstPhoto = media[0];
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10,
        elevation: 1, shadowColor: '#7C3AED', shadowOpacity: 0.06, shadowRadius: 6,
        flexDirection: 'row', gap: 12,
      }}>
      <View style={{ alignItems: 'center', minWidth: 36 }}>
        <View style={{
          width: 36, height: 36, borderRadius: 18,
          backgroundColor: entry.mood ? '#EDE9FE' : '#F3F4F6',
          justifyContent: 'center', alignItems: 'center',
        }}>
          <Text style={{ fontSize: 20 }}>{entry.mood ?? '📝'}</Text>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {entry.title ? (
          <Text
            style={{ fontSize: 14, fontWeight: '800', color: '#1E1B4B', marginBottom: 3 }}
            numberOfLines={1}>
            {entry.title}
          </Text>
        ) : null}
        <Text style={{ fontSize: 13, color: '#555', lineHeight: 20 }} numberOfLines={2}>
          {entry.content}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          {entry.locationName ? (
            <Text style={{ fontSize: 11, color: '#9CA3AF' }}>📍 {entry.locationName}</Text>
          ) : null}
          {media.length > 0 && (
            <Text style={{ fontSize: 11, color: '#9CA3AF' }}>🖼 {media.length} รูป</Text>
          )}
          {totalExpenses > 0 && (
            <View style={{ backgroundColor: '#F0FDF4', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ fontSize: 11, color: '#15803D', fontWeight: '700' }}>
                💰 {formatCurrency(totalExpenses)}฿
              </Text>
            </View>
          )}
        </View>
      </View>

      {firstPhoto ? (
        <ExpoImage
          source={{ uri: firstPhoto.localUri }}
          style={{ width: 64, height: 64, borderRadius: 10 }}
          contentFit="cover"
        />
      ) : null}
    </Pressable>
  );
}
