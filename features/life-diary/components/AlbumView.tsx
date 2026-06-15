import { FlatList, View, Text, Pressable, ActivityIndicator, Dimensions } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import type { DiaryMedia } from '@/db/schema';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ALBUM_COLS = 3;
const ALBUM_GAP = 3;
const ALBUM_ITEM = Math.floor((SCREEN_WIDTH - 32 - ALBUM_GAP * ALBUM_COLS) / ALBUM_COLS);

interface Props {
  media: DiaryMedia[];
  loading: boolean;
  insets: { bottom: number };
  onPress: (entryId: string) => void;
}

export function AlbumView({ media, loading, insets, onPress }: Props) {
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={{ marginTop: 12, color: '#9CA3AF', fontSize: 13 }}>โหลดอัลบั้ม...</Text>
      </View>
    );
  }

  if (media.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <Text style={{ fontSize: 52, marginBottom: 12 }}>🖼</Text>
        <Text style={{ fontSize: 16, fontWeight: '800', color: '#333' }}>ยังไม่มีรูปภาพ</Text>
        <Text style={{ fontSize: 13, color: '#888', marginTop: 6, textAlign: 'center' }}>
          เพิ่มรูปภาพในบันทึกเพื่อให้โชว์ที่นี่
        </Text>
      </View>
    );
  }

  return (
    <FlatList<DiaryMedia>
      data={media}
      numColumns={ALBUM_COLS}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 80 }}
      columnWrapperStyle={{ gap: ALBUM_GAP, marginBottom: ALBUM_GAP }}
      renderItem={({ item }) => (
        <Pressable onPress={() => onPress(item.entryId)} style={{ flex: 1, height: ALBUM_ITEM }}>
          <ExpoImage
            source={{ uri: item.localUri }}
            style={{ flex: 1, borderRadius: 10 }}
            contentFit="cover"
            transition={200}
          />
        </Pressable>
      )}
    />
  );
}
