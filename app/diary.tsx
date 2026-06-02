import { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, Pressable, ActivityIndicator,
  Image, Dimensions, FlatList,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import { diaryService } from '@/services/diaryService';
import type { DiaryEntry, DiaryMedia, DiaryExpense } from '@/db/schema';
import { formatCurrency } from '@/lib/format';

// ── Constants ─────────────────────────────────────────────────────────────────
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ALBUM_COLS = 3;
const ALBUM_GAP = 3;
const ALBUM_ITEM = Math.floor((SCREEN_WIDTH - 32 - ALBUM_GAP * ALBUM_COLS) / ALBUM_COLS);

const DAY_LABELS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

const MOOD_COLORS: Record<string, string> = {
  '😊': '#F59E0B', '🥰': '#EC4899', '😆': '#F97316', '😌': '#059669',
  '🤩': '#7C3AED', '😴': '#4F46E5', '😢': '#3B82F6', '😤': '#EF4444',
  '🥺': '#8B5CF6', '😮': '#14B8A6',
};

type Tab = 'timeline' | 'calendar' | 'album';

// ── Types ─────────────────────────────────────────────────────────────────────
interface EntryWithRelations {
  entry: DiaryEntry;
  media: DiaryMedia[];
  expenses: DiaryExpense[];
  totalExpenses: number;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  mood?: string;
  count: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatThaiDate(date: Date | number): string {
  const d = new Date(date as number);
  return d.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function isSameDay(a: Date | number, b: Date | number): boolean {
  const da = new Date(a as number);
  const db = new Date(b as number);
  return da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function buildCalendarDays(year: number, month: number, items: EntryWithRelations[]): CalendarDay[] {
  const entryMap: Record<string, { mood?: string; count: number }> = {};
  for (const item of items) {
    const d = new Date(item.entry.entryDate as unknown as number);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!entryMap[key]) entryMap[key] = { count: 0 };
    entryMap[key].count++;
    if (!entryMap[key].mood && item.entry.mood) entryMap[key].mood = item.entry.mood;
  }

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days: CalendarDay[] = [];

  for (let i = firstDay.getDay() - 1; i >= 0; i--) {
    days.push({ date: new Date(year, month, -i), isCurrentMonth: false, count: 0 });
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const key = `${year}-${month}-${d}`;
    const entry = entryMap[key];
    days.push({ date: new Date(year, month, d), isCurrentMonth: true, mood: entry?.mood, count: entry?.count ?? 0 });
  }
  const rem = (7 - (days.length % 7)) % 7;
  for (let i = 1; i <= rem; i++) {
    days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false, count: 0 });
  }
  return days;
}

function thaiMonthYear(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EntryCard({ item, onPress }: { item: EntryWithRelations; onPress: () => void }) {
  const { entry, media, totalExpenses } = item;
  const firstPhoto = media[0];
  return (
    <Pressable onPress={onPress}
      style={{ backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10,
        elevation: 1, shadowColor: '#7C3AED', shadowOpacity: 0.06, shadowRadius: 6,
        flexDirection: 'row', gap: 12 }}>
      <View style={{ alignItems: 'center', minWidth: 36 }}>
        <View style={{ width: 36, height: 36, borderRadius: 18,
          backgroundColor: entry.mood ? '#EDE9FE' : '#F3F4F6',
          justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 20 }}>{entry.mood ?? '📝'}</Text>
        </View>
      </View>
      <View style={{ flex: 1 }}>
        {entry.title ? (
          <Text style={{ fontSize: 14, fontWeight: '800', color: '#1E1B4B', marginBottom: 3 }} numberOfLines={1}>
            {entry.title}
          </Text>
        ) : null}
        <Text style={{ fontSize: 13, color: '#555', lineHeight: 20 }} numberOfLines={2}>{entry.content}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          {entry.locationName ? <Text style={{ fontSize: 11, color: '#9CA3AF' }}>📍 {entry.locationName}</Text> : null}
          {media.length > 0 && <Text style={{ fontSize: 11, color: '#9CA3AF' }}>🖼 {media.length} รูป</Text>}
          {totalExpenses > 0 && (
            <View style={{ backgroundColor: '#F0FDF4', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ fontSize: 11, color: '#15803D', fontWeight: '700' }}>💰 {formatCurrency(totalExpenses)}฿</Text>
            </View>
          )}
        </View>
      </View>
      {firstPhoto ? (
        <ExpoImage source={{ uri: firstPhoto.localUri }}
          style={{ width: 64, height: 64, borderRadius: 10 }}
          contentFit="cover" />
      ) : null}
    </Pressable>
  );
}

function CalendarView({
  items, insets, onDayPress,
}: {
  items: EntryWithRelations[];
  insets: { bottom: number };
  onDayPress: (date: Date) => void;
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const days = useMemo(() => buildCalendarDays(year, month, items), [year, month, items]);

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  const today = new Date();

  return (
    <ScrollView showsVerticalScrollIndicator={false}
      contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 80 }}>

      {/* Month navigator */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 14,
        elevation: 1, shadowColor: '#7C3AED', shadowOpacity: 0.06, shadowRadius: 4 }}>
        <Pressable onPress={prevMonth} style={{ padding: 8 }}>
          <Text style={{ fontSize: 20, color: '#7C3AED' }}>‹</Text>
        </Pressable>
        <Text style={{ fontSize: 16, fontWeight: '800', color: '#1E1B4B' }}>
          {thaiMonthYear(year, month)}
        </Text>
        <Pressable onPress={nextMonth} style={{ padding: 8 }}>
          <Text style={{ fontSize: 20, color: '#7C3AED' }}>›</Text>
        </Pressable>
      </View>

      {/* Day-of-week headers */}
      <View style={{ flexDirection: 'row', marginBottom: 6 }}>
        {DAY_LABELS.map(label => (
          <View key={label} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 11, fontWeight: '700',
              color: label === 'อา' ? '#EF4444' : label === 'ส' ? '#3B82F6' : '#9CA3AF' }}>
              {label}
            </Text>
          </View>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap',
        backgroundColor: '#fff', borderRadius: 16, padding: 8,
        elevation: 1, shadowColor: '#7C3AED', shadowOpacity: 0.06, shadowRadius: 4 }}>
        {days.map((day, idx) => {
          const isToday = isSameDay(day.date, today);
          const moodColor = day.mood ? (MOOD_COLORS[day.mood] ?? '#7C3AED') : '#7C3AED';
          const cellW = (SCREEN_WIDTH - 32 - 16) / 7;
          return (
            <Pressable key={idx}
              onPress={() => day.isCurrentMonth && day.count > 0 && onDayPress(day.date)}
              style={{ width: cellW, height: cellW + 10, alignItems: 'center', justifyContent: 'center',
                paddingVertical: 4 }}>
              {/* Today ring */}
              <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isToday ? '#7C3AED' : 'transparent',
                borderWidth: isToday ? 0 : 0 }}>
                <Text style={{ fontSize: 13,
                  fontWeight: isToday ? '900' : day.count > 0 ? '700' : '400',
                  color: isToday ? '#fff' : !day.isCurrentMonth ? '#D1D5DB' : '#1E1B4B' }}>
                  {day.date.getDate()}
                </Text>
              </View>
              {/* Mood dot or emoji */}
              {day.isCurrentMonth && day.count > 0 && (
                day.mood ? (
                  <Text style={{ fontSize: 12, marginTop: 1 }}>{day.mood}</Text>
                ) : (
                  <View style={{ width: 6, height: 6, borderRadius: 3,
                    backgroundColor: moodColor, marginTop: 2 }} />
                )
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Entries of the month summary */}
      {items.filter(item => {
        const d = new Date(item.entry.entryDate as unknown as number);
        return d.getFullYear() === year && d.getMonth() === month;
      }).length > 0 && (
        <View style={{ marginTop: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#5B21B6', marginBottom: 8 }}>
            บันทึกเดือนนี้ ({items.filter(item => {
              const d = new Date(item.entry.entryDate as unknown as number);
              return d.getFullYear() === year && d.getMonth() === month;
            }).length} รายการ)
          </Text>
          {items
            .filter(item => {
              const d = new Date(item.entry.entryDate as unknown as number);
              return d.getFullYear() === year && d.getMonth() === month;
            })
            .map(item => (
              <View key={item.entry.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10,
                backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 6,
                borderLeftWidth: 3, borderLeftColor: item.entry.mood
                  ? (MOOD_COLORS[item.entry.mood] ?? '#7C3AED') : '#7C3AED' }}>
                <Text style={{ fontSize: 18 }}>{item.entry.mood ?? '📝'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E1B4B' }} numberOfLines={1}>
                    {item.entry.title ?? item.entry.content}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>
                    {new Date(item.entry.entryDate as unknown as number)
                      .toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                    {item.totalExpenses > 0 ? `  💰 ${formatCurrency(item.totalExpenses)}฿` : ''}
                  </Text>
                </View>
              </View>
            ))}
        </View>
      )}
    </ScrollView>
  );
}

function AlbumView({
  media, loading, insets, onPress,
}: {
  media: DiaryMedia[];
  loading: boolean;
  insets: { bottom: number };
  onPress: (entryId: string) => void;
}) {
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
        <Pressable
          onPress={() => onPress(item.entryId)}
          style={{ flex: 1, height: ALBUM_ITEM }}>
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

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function DiaryScreen() {
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

  function handleDayPress(date: Date) {
    // สลับไป Timeline แล้วเลื่อนหาวันนั้น (future enhancement)
    // ตอนนี้แค่ switch ไป timeline
    setActiveTab('timeline');
  }

  // Group for timeline
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
      <LinearGradient colors={['#5B21B6', '#7C3AED', '#9333EA']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 8, paddingBottom: 16, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: '900', color: '#fff' }}>📖 สมุดชีวิต</Text>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
              บันทึกเรื่องราว ความรู้สึก และเงิน
            </Text>
          </View>
          <Pressable onPress={() => router.push('/diary-write' as any)}
            style={{ backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
              flexDirection: 'row', alignItems: 'center', gap: 4,
              elevation: 2, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 4 }}>
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
            { id: 'album', label: '🖼 อัลบั้ม' },
          ] as { id: Tab; label: string }[]).map(tab => (
            <Pressable key={tab.id} onPress={() => handleTabChange(tab.id)}
              style={{ flex: 1, paddingVertical: 7, borderRadius: 12, alignItems: 'center',
                backgroundColor: activeTab === tab.id ? '#fff' : 'rgba(255,255,255,0.15)' }}>
              <Text style={{ fontSize: 12, fontWeight: '700',
                color: activeTab === tab.id ? '#7C3AED' : 'rgba(255,255,255,0.85)' }}>
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
          <Pressable onPress={() => router.push('/diary-write' as any)}
            style={{ backgroundColor: '#7C3AED', borderRadius: 16, paddingHorizontal: 28, paddingVertical: 14 }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>✍️ บันทึกความทรงจำแรก</Text>
          </Pressable>
        </View>
      ) : activeTab === 'timeline' ? (
        <ScrollView showsVerticalScrollIndicator={false}
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
                <EntryCard key={item.entry.id} item={item}
                  onPress={() => router.push({ pathname: '/diary-entry' as any, params: { entryId: item.entry.id } })} />
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
