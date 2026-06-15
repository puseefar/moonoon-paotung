import { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { diaryService } from '@/services/diaryService';
import type { DiaryMedia } from '@/db/schema';
import { formatCurrency } from '@/lib/format';
import { EntryCard } from '../components/EntryCard';
import { CalendarView } from '../components/CalendarView';
import { AlbumView } from '../components/AlbumView';
import type { EntryWithRelations } from '../types';
import { isSameDay } from '../types';

type Tab = 'timeline' | 'calendar' | 'album';

function formatThaiDate(date: Date | number): string {
  const d = new Date(date as number);
  return d.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export default function FreeDiaryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('timeline');
  const [items, setItems] = useState<EntryWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [allMedia, setAllMedia] = useState<DiaryMedia[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaLoaded, setMediaLoaded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const entries = await diaryService.getEntries({ limit: 100 });
    const rich = await Promise.all(entries.map(e => diaryService.getEntryWithRelations(e.id)));
    setItems(rich.filter(Boolean) as EntryWithRelations[]);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function loadAlbum() {
    if (mediaLoaded) return;
    setMediaLoading(true);
    const media = await diaryService.getAllMedia(300);
    setAllMedia(media as DiaryMedia[]);
    setMediaLoaded(true);
    setMediaLoading(false);
  }

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    if (tab === 'album' && !mediaLoaded) loadAlbum();
  }

  function handleDayPress(_date: Date) {
    setActiveTab('timeline');
  }

  // Group entries by day for timeline view
  const grouped: { dateLabel: string; date: Date; entries: EntryWithRelations[] }[] = [];
  if (activeTab === 'timeline') {
    for (const item of items) {
      const d = new Date(item.entry.entryDate as unknown as number);
      const last = grouped[grouped.length - 1];
      if (last && isSameDay(last.date, d)) {
        last.entries.push(item);
      } else {
        grouped.push({ dateLabel: formatThaiDate(d), date: d, entries: [item] });
      }
    }
  }

  const totalPhotoCount = items.reduce((s, i) => s + i.media.length, 0);
  const totalExpenses = items.reduce((s, i) => s + i.totalExpenses, 0);

  return (
    <View style={{ flex: 1, backgroundColor: '#FBF7FF' }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <LinearGradient
        colors={['#5B21B6', '#7C3AED', '#9333EA']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 8, paddingBottom: 16, paddingHorizontal: 20 }}>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: '900', color: '#fff' }}>📖 สมุดชีวิต</Text>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
              บันทึกเรื่องราว ความรู้สึก และเงิน
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/diary-write' as any)}
            style={{
              backgroundColor: '#fff', borderRadius: 20,
              paddingHorizontal: 14, paddingVertical: 8,
              flexDirection: 'row', alignItems: 'center', gap: 4,
              elevation: 2, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 4,
            }}>
            <Text style={{ color: '#7C3AED', fontWeight: '900', fontSize: 16, lineHeight: 18 }}>+</Text>
            <Text style={{ color: '#7C3AED', fontWeight: '700', fontSize: 13 }}>บันทึก</Text>
          </Pressable>
        </View>

        {/* Stats */}
        {!loading && (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 10, alignItems: 'center' }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: '#fff' }}>{items.length}</Text>
              <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)' }}>บันทึก</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 10, alignItems: 'center' }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: '#A5D6A7' }}>{totalPhotoCount}</Text>
              <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)' }}>รูปภาพ</Text>
            </View>
            <View style={{ flex: 2, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 10, alignItems: 'center' }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: '#FFE082' }}>{formatCurrency(totalExpenses)}฿</Text>
              <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)' }}>ค่าใช้จ่ายรวม</Text>
            </View>
          </View>
        )}

        {/* Tab bar */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          {([
            { id: 'timeline', label: '📋 ไทม์ไลน์' },
            { id: 'calendar', label: '📅 ปฏิทิน' },
            { id: 'album',    label: '🖼 อัลบั้ม' },
          ] as { id: Tab; label: string }[]).map(tab => (
            <Pressable
              key={tab.id}
              onPress={() => handleTabChange(tab.id)}
              style={{
                flex: 1, paddingVertical: 7, borderRadius: 12, alignItems: 'center',
                backgroundColor: activeTab === tab.id ? '#fff' : 'rgba(255,255,255,0.15)',
              }}>
              <Text style={{
                fontSize: 12, fontWeight: '700',
                color: activeTab === tab.id ? '#7C3AED' : 'rgba(255,255,255,0.85)',
              }}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </LinearGradient>

      {/* Content */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      ) : items.length === 0 && activeTab === 'timeline' ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <Text style={{ fontSize: 56, marginBottom: 16 }}>📖</Text>
          <Text style={{ fontSize: 20, fontWeight: '800', color: '#333', textAlign: 'center', marginBottom: 8 }}>
            ยังไม่มีบันทึกเลย
          </Text>
          <Text style={{ fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 22, marginBottom: 28 }}>
            เริ่มบันทึกเรื่องราวแรก{'\n'}ความรู้สึก รูปภาพ และค่าใช้จ่ายในวันนี้
          </Text>
          <Pressable
            onPress={() => router.push('/diary-write' as any)}
            style={{ backgroundColor: '#7C3AED', borderRadius: 16, paddingHorizontal: 28, paddingVertical: 14 }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>✍️ บันทึกความทรงจำแรก</Text>
          </Pressable>
        </View>
      ) : activeTab === 'timeline' ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}>
          {grouped.map((group) => (
            <View key={group.dateLabel}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginTop: 4 }}>
                <View style={{ backgroundColor: '#EDE9FE', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#5B21B6' }}>{group.dateLabel}</Text>
                </View>
                <View style={{ flex: 1, height: 1, backgroundColor: '#EDE9FE', marginLeft: 8 }} />
              </View>
              {group.entries.map((item) => (
                <EntryCard
                  key={item.entry.id}
                  item={item}
                  onPress={() => router.push({ pathname: '/diary-entry' as any, params: { entryId: item.entry.id } })}
                />
              ))}
            </View>
          ))}
        </ScrollView>
      ) : activeTab === 'calendar' ? (
        <CalendarView items={items} insets={insets} onDayPress={handleDayPress} />
      ) : (
        <AlbumView
          media={allMedia}
          loading={mediaLoading}
          insets={insets}
          onPress={(entryId) => router.push({ pathname: '/diary-entry' as any, params: { entryId } })}
        />
      )}
    </View>
  );
}
