import { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  ActivityIndicator, Image, Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { diaryService } from '@/services/diaryService';
import type { EntryWithRelations } from '@/features/life-diary/types';

// ── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:         '#F0F4FB',
  surface:    '#FFFFFF',
  ink:        '#1A1630',
  inkSoft:    '#6B6585',
  inkFaint:   '#AFAABB',
  line:       '#EDEAF5',
  rose:       '#D14F86',
  roseTint:   '#FBEAF1',
  gold:       '#CC9A3A',
  goldTint:   '#FBF3E2',
  blue:       '#3D8EF0',
  blueTint:   '#EDF4FE',
};

const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

// ── Pro moods ─────────────────────────────────────────────────────────────────
type MoodKey = 'great' | 'good' | 'ok' | 'tired' | 'bad';
const PRO_MOODS: Record<MoodKey, { label: string; dot: string; emoji: string }> = {
  great: { label: 'ดีมาก',   dot: '#E9C46A', emoji: '🤩' },
  good:  { label: 'ดี',       dot: '#A8C3A0', emoji: '😊' },
  ok:    { label: 'สบายๆ',   dot: '#AFC5D8', emoji: '😐' },
  tired: { label: 'เหนื่อย', dot: '#B9A8C9', emoji: '😔' },
  bad:   { label: 'สู้ๆ',     dot: '#C9A0A8', emoji: '😞' },
};
const MOOD_KEYS = Object.keys(PRO_MOODS) as MoodKey[];

const EMOJI_TO_MOOD: Record<string, MoodKey> = {
  '🤩': 'great', '😆': 'great', '🥰': 'great', '😄': 'great',
  '😊': 'good',
  '😌': 'ok', '😮': 'ok', '😴': 'ok', '😐': 'ok',
  '😤': 'tired', '🥺': 'tired', '😔': 'tired',
  '😢': 'bad', '😞': 'bad',
};

function moodKeyOf(mood: string | null | undefined): MoodKey | null {
  if (!mood) return null;
  if (EMOJI_TO_MOOD[mood]) return EMOJI_TO_MOOD[mood];
  if (MOOD_KEYS.includes(mood as MoodKey)) return mood as MoodKey;
  return null;
}

// ── Filter types ──────────────────────────────────────────────────────────────
type FilterType = 'all' | 'photo' | 'expense' | MoodKey;

const RECENT_TAGS = ['ออกกำลังกาย', 'ครอบครัว', 'เดินทาง', 'กาแฟ', 'ทำงาน'];

export default function DiarySearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [moodFilter, setMoodFilter] = useState<MoodKey | null>(null);
  const [allEntries, setAllEntries] = useState<EntryWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const entries = await diaryService.getEntriesWithRelations();
      setAllEntries(entries);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    let results = allEntries;

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      results = results.filter(item =>
        item.entry.title?.toLowerCase().includes(q) ||
        item.entry.content.toLowerCase().includes(q) ||
        item.entry.locationName?.toLowerCase().includes(q) ||
        item.expenses.some(e => e.itemName.toLowerCase().includes(q)),
      );
    }

    if (filter === 'photo') {
      results = results.filter(item => item.media.length > 0);
    } else if (filter === 'expense') {
      results = results.filter(item => item.expenses.length > 0);
    }

    if (moodFilter) {
      results = results.filter(item => moodKeyOf(item.entry.mood) === moodFilter);
    }

    return results;
  }, [allEntries, query, filter, moodFilter]);

  function clearAll() {
    setQuery('');
    setFilter('all');
    setMoodFilter(null);
  }

  const hasActiveFilter = filter !== 'all' || !!moodFilter || !!query.trim();
  const isTyping = query.trim().length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Sticky top ── */}
      <View style={{ paddingTop: insets.top + 10, backgroundColor: C.bg,
        borderBottomWidth: 1, borderBottomColor: C.line,
        shadowColor: C.ink, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>

        {/* Header row */}
        <View style={{ flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: 16, marginBottom: 10 }}>
          <Pressable onPress={() => router.back()}
            style={{ width: 36, height: 36, borderRadius: 18,
              backgroundColor: C.surface,
              justifyContent: 'center', alignItems: 'center',
              marginRight: 10,
              shadowColor: C.ink, shadowOpacity: 0.08, shadowRadius: 5, elevation: 1 }}>
            <Text style={{ fontSize: 16, color: C.ink }}>←</Text>
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: '700', color: C.ink, flex: 1, fontFamily: SERIF }}>
            ค้นหาบันทึก
          </Text>
          {hasActiveFilter && (
            <Pressable onPress={clearAll}
              style={{ paddingHorizontal: 10, paddingVertical: 5,
                backgroundColor: C.roseTint, borderRadius: 10 }}>
              <Text style={{ fontSize: 12, color: C.rose, fontWeight: '700' }}>ล้างทั้งหมด</Text>
            </Pressable>
          )}
        </View>

        {/* Search bar */}
        <View style={{ marginHorizontal: 16, marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center',
            backgroundColor: C.surface, borderRadius: 16,
            borderWidth: 1.5, borderColor: query ? C.rose : C.line,
            paddingHorizontal: 14 }}>
            <Text style={{ fontSize: 15, color: C.inkFaint, marginRight: 8 }}>🔍</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="ค้นหาในบันทึก..."
              placeholderTextColor={C.inkFaint}
              returnKeyType="search"
              autoFocus
              style={{ flex: 1, paddingVertical: 11, fontSize: 14, color: C.ink }}
            />
            {!!query && (
              <Pressable onPress={() => setQuery('')}
                style={{ width: 20, height: 20, borderRadius: 10,
                  backgroundColor: C.inkFaint,
                  justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>✕</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Recent search tags — shown when not typing */}
        {!isTyping && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 7, paddingBottom: 8 }}>
            <Text style={{ fontSize: 11, color: C.inkFaint, alignSelf: 'center', marginRight: 2 }}>
              ล่าสุด:
            </Text>
            {RECENT_TAGS.map(tag => (
              <Pressable key={tag} onPress={() => setQuery(tag)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4,
                  paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
                  backgroundColor: C.surface, borderWidth: 1, borderColor: C.line }}>
                <Text style={{ fontSize: 11, color: C.inkSoft }}>🕐</Text>
                <Text style={{ fontSize: 11.5, color: C.inkSoft }}>{tag}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 7, paddingBottom: 10 }}>
          <Pressable onPress={() => setFilter('all')}
            style={[chipStyle, filter === 'all' && chipActiveStyle]}>
            <Text style={[chipText, filter === 'all' && chipActiveText]}>ทั้งหมด</Text>
          </Pressable>

          <Pressable onPress={() => setFilter(filter === 'photo' ? 'all' : 'photo')}
            style={[chipStyle, filter === 'photo' && chipActiveStyle]}>
            <Text style={{ fontSize: 13 }}>📷</Text>
            <Text style={[chipText, filter === 'photo' && chipActiveText]}>มีรูป</Text>
          </Pressable>

          <Pressable onPress={() => setFilter(filter === 'expense' ? 'all' : 'expense')}
            style={[chipStyle, filter === 'expense' && chipActiveStyle]}>
            <Text style={{ fontSize: 13 }}>💰</Text>
            <Text style={[chipText, filter === 'expense' && chipActiveText]}>มีรายจ่าย</Text>
          </Pressable>
        </ScrollView>

        {/* Quick mood buttons row */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 8, paddingBottom: 12 }}>
          {MOOD_KEYS.map(mk => {
            const m = PRO_MOODS[mk];
            const active = moodFilter === mk;
            return (
              <Pressable key={mk}
                onPress={() => setMoodFilter(active ? null : mk)}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 14,
                  backgroundColor: active ? m.dot + '28' : C.surface,
                  borderWidth: 1.5, borderColor: active ? m.dot : C.line }}>
                <Text style={{ fontSize: 20, lineHeight: 24, marginBottom: 2 }}>{m.emoji}</Text>
                <Text style={{ fontSize: 9, fontWeight: active ? '700' : '500',
                  color: active ? m.dot : C.inkSoft }}>
                  {m.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ── Results ── */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={C.rose} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
          <Text style={{ fontSize: 40, marginBottom: 16 }}>🔍</Text>
          <Text style={{ fontSize: 16, fontWeight: '700', color: C.ink, textAlign: 'center', marginBottom: 8 }}>
            {hasActiveFilter ? 'ไม่พบบันทึกที่ตรงกัน' : 'ยังไม่มีบันทึก'}
          </Text>
          <Text style={{ fontSize: 13, color: C.inkSoft, textAlign: 'center' }}>
            {hasActiveFilter ? 'ลองเปลี่ยน filter หรือคำค้นหา' : 'เริ่มเขียนบันทึกแรกของคุณได้เลย'}
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 20 }}>

          <Text style={{ fontSize: 12, color: C.inkFaint, marginBottom: 4 }}>
            พบ {filtered.length} รายการ
          </Text>

          {filtered.map(item => (
            <SearchResultCard
              key={item.entry.id}
              item={item}
              query={query}
              onPress={() => router.push({ pathname: '/diary-entry' as any, params: { entryId: item.entry.id } })}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ── SearchResultCard ──────────────────────────────────────────────────────────
function SearchResultCard({
  item, query, onPress,
}: {
  item: EntryWithRelations;
  query: string;
  onPress: () => void;
}) {
  const { entry, media, expenses } = item;
  const mk = moodKeyOf(entry.mood);
  const mood = mk ? PRO_MOODS[mk] : null;

  const dateStr = new Date(entry.entryDate).toLocaleDateString('th-TH', {
    day: 'numeric', month: 'short', year: '2-digit',
  });

  function highlight(text: string): React.ReactNode {
    if (!query.trim()) return <Text style={{ fontSize: 13, color: C.inkSoft, lineHeight: 20 }}>{text}</Text>;
    const q = query.trim();
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return <Text style={{ fontSize: 13, color: C.inkSoft, lineHeight: 20 }}>{text}</Text>;
    return (
      <Text style={{ fontSize: 13, color: C.inkSoft, lineHeight: 20 }}>
        {text.slice(0, idx)}
        <Text style={{ color: C.rose, fontWeight: '700', backgroundColor: C.roseTint }}>
          {text.slice(idx, idx + q.length)}
        </Text>
        {text.slice(idx + q.length)}
      </Text>
    );
  }

  const snippet = entry.content.length > 80 ? entry.content.slice(0, 80) + '…' : entry.content;

  return (
    <Pressable onPress={onPress}
      style={{
        backgroundColor: C.surface, borderRadius: 18, overflow: 'hidden',
        shadowColor: C.ink, shadowOpacity: 0.07, shadowRadius: 10,
        shadowOffset: { width: 0, height: 2 }, elevation: 2,
      }}>

      {/* Mood accent bar */}
      {mood && <View style={{ height: 4, backgroundColor: mood.dot }} />}

      <View style={{ padding: 14 }}>
        {/* Top row: date + mood */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <Text style={{ fontSize: 11, color: C.inkFaint, flex: 1 }}>{dateStr}</Text>
          {mood && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 14 }}>{mood.emoji}</Text>
              <Text style={{ fontSize: 11, color: C.inkSoft }}>{mood.label}</Text>
            </View>
          )}
        </View>

        {/* Title */}
        {entry.title && (
          <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink,
            fontFamily: SERIF, marginBottom: 4 }} numberOfLines={1}>
            {entry.title}
          </Text>
        )}

        {/* Snippet */}
        {highlight(snippet)}

        {/* Meta: photo + expense + location */}
        {(media.length > 0 || expenses.length > 0 || entry.locationName) && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
            {media.length > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Text style={{ fontSize: 12 }}>📷</Text>
                <Text style={{ fontSize: 11, color: C.inkSoft }}>{media.length}</Text>
              </View>
            )}
            {expenses.length > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Text style={{ fontSize: 12 }}>💰</Text>
                <Text style={{ fontSize: 11, color: C.gold }}>
                  {expenses.reduce((s, e) => s + e.amount, 0).toFixed(0)}฿
                </Text>
              </View>
            )}
            {entry.locationName && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, flex: 1 }}>
                <Text style={{ fontSize: 12 }}>📍</Text>
                <Text style={{ fontSize: 11, color: C.inkSoft }} numberOfLines={1}>{entry.locationName}</Text>
              </View>
            )}
          </View>
        )}

        {/* Photo thumbnails */}
        {media.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, marginTop: 10 }}>
            {media.slice(0, 4).map((m, i) => (
              <View key={m.id} style={{ position: 'relative' }}>
                <Image source={{ uri: m.localUri }}
                  style={{ width: 60, height: 60, borderRadius: 10,
                    backgroundColor: C.line }} />
                {i === 3 && media.length > 4 && (
                  <View style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    borderRadius: 10,
                    backgroundColor: 'rgba(26,22,48,0.55)',
                    justifyContent: 'center', alignItems: 'center',
                  }}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                      +{media.length - 4}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </Pressable>
  );
}

// ── Chip styles ───────────────────────────────────────────────────────────────
const chipStyle = {
  flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5,
  paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
  backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#EDEAF5',
};
const chipActiveStyle = {
  backgroundColor: '#FBEAF1', borderColor: '#D14F86',
};
const chipText = {
  fontSize: 12, fontWeight: '500' as const, color: '#6B6585',
};
const chipActiveText = {
  color: '#D14F86', fontWeight: '700' as const,
};
