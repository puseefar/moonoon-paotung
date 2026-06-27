/**
 * ProDiaryTimelineScreen — Life Diary chronological timeline (Pro tier)
 * Design: light-blue bg, month nav, mood bar chart, vertical connector entries.
 */
import { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Platform, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { diaryService } from '@/services/diaryService';
import { formatCurrency } from '@/lib/format';
import type { EntryWithRelations } from '../types';

// ── Design tokens ──────────────────────────────────────────────────────────────
const C = {
  bg:          '#F0F4FB',
  surface:     '#FFFFFF',
  ink:         '#1A1630',
  inkSoft:     '#6B6585',
  inkFaint:    '#AFAABB',
  line:        '#EDEAF5',
  rose:        '#D14F86',
  roseMid:     '#C93E7A',
  roseTint:    '#FBEAF1',
  sage:        '#4FAD86',
  sageTint:    '#E6F7F0',
  gold:        '#CC9A3A',
  goldTint:    '#FBF3E2',
  blue:        '#3D8EF0',
  blueTint:    '#EDF4FE',
  purple:      '#7C5CBF',
  purpleTint:  '#F0EBFF',
} as const;

const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

// ── Mood system ────────────────────────────────────────────────────────────────
type MoodKey = 'great' | 'good' | 'ok' | 'tired' | 'bad';
const MOOD_MAP: Record<MoodKey, { dot: string; barColor: string; barH: number; label: string; emoji: string }> = {
  great: { dot: '#E9C46A', barColor: '#E9C46A', barH: 36, label: 'ดีมาก',   emoji: '🤩' },
  good:  { dot: '#A8C3A0', barColor: '#A8C3A0', barH: 28, label: 'ดี',       emoji: '😊' },
  ok:    { dot: '#AFC5D8', barColor: '#AFC5D8', barH: 20, label: 'สบายๆ',    emoji: '😐' },
  tired: { dot: '#B9A8C9', barColor: '#B9A8C9', barH: 14, label: 'เหนื่อย', emoji: '😔' },
  bad:   { dot: '#C9A0A8', barColor: '#C9A0A8', barH: 8,  label: 'สู้ๆ',      emoji: '😞' },
};
const EMOJI_TO_MOOD: Record<string, MoodKey> = {
  '🤩': 'great', '😆': 'great', '🥰': 'great', '😄': 'great',
  '😊': 'good',
  '😌': 'ok', '😮': 'ok', '😴': 'ok', '😐': 'ok',
  '😤': 'tired', '🥺': 'tired', '😔': 'tired',
  '😢': 'bad', '😞': 'bad',
};
function moodOf(emoji: string | null | undefined): MoodKey {
  if (!emoji) return 'ok';
  return EMOJI_TO_MOOD[emoji] ?? 'ok';
}

// Thai day abbreviations (Sun=0)
const DAY_ABBR = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const MONTH_NAMES_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const MONTH_NAMES_LONG = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

function buddhistYear(d: Date) { return d.getFullYear() + 543; }

function isoMonth(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }

function parseIsoMonth(ym: string): { year: number; month: number } {
  const [y, m] = ym.split('-').map(Number);
  return { year: y, month: m };
}

function monthLabel(ym: string) {
  const { year, month } = parseIsoMonth(ym);
  return `${MONTH_NAMES_LONG[month - 1]} ${year + 543}`;
}

function prevMonth(ym: string) {
  const { year, month } = parseIsoMonth(ym);
  const d = new Date(year, month - 2, 1);
  return isoMonth(d);
}
function nextMonth(ym: string) {
  const { year, month } = parseIsoMonth(ym);
  const d = new Date(year, month, 1);
  return isoMonth(d);
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function ProDiaryTimelineScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [items, setItems] = useState<EntryWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(isoMonth(new Date()));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const entries = await diaryService.getEntries({ limit: 500 });
      const rich = await Promise.all(entries.map(e => diaryService.getEntryWithRelations(e.id)));
      setItems(rich.filter(Boolean) as EntryWithRelations[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ── Stats for selected month ────────────────────────────────────────────────
  const monthItems = useMemo(
    () => items.filter(it => isoMonth(new Date(it.entry.entryDate as unknown as number)) === selectedMonth),
    [items, selectedMonth],
  );

  const stats = useMemo(() => {
    const goodDays = monthItems.filter(it => ['great', 'good'].includes(moodOf(it.entry.mood))).length;
    const total = monthItems.reduce((s, it) => s + it.totalExpenses, 0);
    const locs = new Set(monthItems.map(it => it.entry.locationName).filter(Boolean)).size;
    return { count: monthItems.length, goodDays, total, locs };
  }, [monthItems]);

  // ── Mood bar chart — last 7 days of selected month with data ───────────────
  const moodBars = useMemo(() => {
    const today = new Date();
    const bars: { day: number; dayAbbr: string; mk: MoodKey | null; isToday: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const ym = isoMonth(d);
      // Only show bars for selected month days
      if (ym !== selectedMonth) continue;
      const dayNum = d.getDate();
      const entry = monthItems.find(it => {
        const ed = new Date(it.entry.entryDate as unknown as number);
        return ed.getDate() === dayNum && isoMonth(ed) === selectedMonth;
      });
      bars.push({
        day: dayNum,
        dayAbbr: DAY_ABBR[d.getDay()],
        mk: entry ? moodOf(entry.entry.mood) : null,
        isToday: i === 0,
      });
    }
    return bars.length > 0 ? bars : Array.from({ length: 7 }, (_, i) => ({
      day: i + 1, dayAbbr: DAY_ABBR[i % 7], mk: null as MoodKey | null, isToday: false,
    }));
  }, [monthItems, selectedMonth]);

  // ── Group all entries by month ─────────────────────────────────────────────
  const groupedByMonth = useMemo(() => {
    const map = new Map<string, EntryWithRelations[]>();
    for (const it of items) {
      const ym = isoMonth(new Date(it.entry.entryDate as unknown as number));
      if (!map.has(ym)) map.set(ym, []);
      map.get(ym)!.push(it);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([ym, monthEntries]) => ({
        ym,
        label: monthLabel(ym),
        entries: monthEntries.sort((a, b) =>
          (b.entry.entryDate as unknown as number) - (a.entry.entryDate as unknown as number)),
      }));
  }, [items]);

  // ──────────────────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Header ── */}
      <View style={{
        paddingTop: insets.top + 14, paddingBottom: 12, paddingHorizontal: 20,
        backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.line,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Text style={{ fontFamily: SERIF, fontSize: 20, fontWeight: '700', color: C.ink }}>
          ไทม์ไลน์
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable onPress={() => router.push('/diary-search' as any)} style={s.headBtn}>
            <Text style={{ fontSize: 17 }}>🔍</Text>
          </Pressable>
          <Pressable onPress={() => router.back()} style={s.headBtn}>
            <Text style={{ fontSize: 17, color: C.inkSoft }}>✕</Text>
          </Pressable>
        </View>
      </View>

      {/* ── Month strip ── */}
      <View style={{
        backgroundColor: C.surface, paddingHorizontal: 20, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: C.line,
        shadowColor: C.ink, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
      }}>
        {/* Month nav */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Pressable onPress={() => setSelectedMonth(prevMonth(selectedMonth))} style={s.monthNavBtn}>
            <Text style={{ fontSize: 16, color: C.inkSoft }}>‹</Text>
          </Pressable>
          <Text style={{ fontFamily: SERIF, fontSize: 16, fontWeight: '700', color: C.ink }}>
            {monthLabel(selectedMonth)}
          </Text>
          <Pressable
            onPress={() => setSelectedMonth(nextMonth(selectedMonth))}
            disabled={selectedMonth >= isoMonth(new Date())}
            style={[s.monthNavBtn, selectedMonth >= isoMonth(new Date()) && { opacity: 0.3 }]}>
            <Text style={{ fontSize: 16, color: C.inkSoft }}>›</Text>
          </Pressable>
        </View>

        {/* Mood bar chart */}
        <View style={{ flexDirection: 'row', gap: 4, alignItems: 'flex-end', height: 48, marginBottom: 12 }}>
          {moodBars.map((bar, i) => {
            const mood = bar.mk ? MOOD_MAP[bar.mk] : null;
            const barH = mood ? mood.barH : 4;
            const barColor = mood ? mood.barColor : C.line;
            return (
              <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
                <View style={{
                  width: '100%', height: barH, borderRadius: 3,
                  backgroundColor: barColor,
                  opacity: bar.isToday ? 1 : 0.75,
                  borderWidth: bar.isToday ? 2 : 0,
                  borderColor: bar.isToday ? C.rose : 'transparent',
                }} />
                <Text style={{ fontSize: 9, color: bar.isToday ? C.rose : C.inkFaint,
                  fontWeight: bar.isToday ? '700' : '600', letterSpacing: 0.3 }}>
                  {bar.dayAbbr}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Stat chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 2 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[
              { ico: '📝', val: String(stats.count), lbl: 'บันทึก' },
              { ico: '😊', val: String(stats.goodDays), lbl: 'วันดี' },
              { ico: '💰', val: stats.total > 0 ? `฿${formatCurrency(stats.total)}` : '฿0', lbl: 'รวม' },
              { ico: '📍', val: String(stats.locs), lbl: 'สถานที่' },
            ].map((chip, i) => (
              <View key={i} style={s.statChip}>
                <Text style={{ fontSize: 14 }}>{chip.ico}</Text>
                <Text style={{ fontSize: 11.5, fontWeight: '600', color: C.ink }}>{chip.val}</Text>
                <Text style={{ fontSize: 11, color: C.inkSoft }}>{chip.lbl}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* ── Timeline scroll ── */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={C.rose} />
        </View>
      ) : items.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
          <Text style={{ fontSize: 40, marginBottom: 16 }}>📖</Text>
          <Text style={{ fontSize: 16, fontWeight: '700', color: C.ink, textAlign: 'center', marginBottom: 8 }}>
            ยังไม่มีบันทึก
          </Text>
          <Text style={{ fontSize: 13, color: C.inkSoft, textAlign: 'center' }}>
            เริ่มเขียนบันทึกแรกของคุณได้เลย
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 80 }}>

          {groupedByMonth.map(group => (
            <View key={group.ym} style={{ marginBottom: 8 }}>
              {/* Month group header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: C.line }} />
                <Text style={s.groupLabel}>{group.label}</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: C.line }} />
              </View>

              {/* Entry rows */}
              {group.entries.map((item, idx) => {
                const { entry, media, totalExpenses } = item;
                const mk = moodOf(entry.mood);
                const mood = MOOD_MAP[mk];
                const dateObj = new Date(entry.entryDate as unknown as number);
                const dayNum = dateObj.getDate();
                const dayAbbr = DAY_ABBR[dateObj.getDay()];
                const timeStr = dateObj.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
                const isLast = idx === group.entries.length - 1;

                return (
                  <View key={entry.id} style={{ flexDirection: 'row', gap: 12, marginBottom: 10 }}>
                    {/* Date column */}
                    <View style={{ width: 36, alignItems: 'center', paddingTop: 10 }}>
                      <Text style={{ fontFamily: SERIF, fontSize: 18, fontWeight: '700', color: C.ink, lineHeight: 22 }}>
                        {dayNum}
                      </Text>
                      <Text style={{ fontSize: 9.5, color: C.inkFaint, fontWeight: '600', letterSpacing: 0.3 }}>
                        {dayAbbr}
                      </Text>
                      {/* Vertical connector */}
                      {!isLast && (
                        <View style={{ flex: 1, width: 2, backgroundColor: C.line, borderRadius: 2,
                          marginTop: 6, minHeight: 20 }} />
                      )}
                    </View>

                    {/* Entry card */}
                    <Pressable
                      style={{ flex: 1 }}
                      onPress={() => router.push({ pathname: '/diary-entry' as any, params: { entryId: entry.id } })}>
                      <View style={s.entryCard}>
                        {/* Mood accent bar */}
                        <View style={{ height: 4, backgroundColor: mood.dot }} />
                        <View style={{ padding: 11 }}>
                          {/* Row 1: dot + time */}
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: mood.dot }} />
                            <Text style={{ fontSize: 10.5, color: C.inkSoft, fontWeight: '500' }}>
                              {timeStr} น.
                            </Text>
                            {entry.locationName ? (
                              <Text style={{ fontSize: 10, color: C.inkFaint, flex: 1 }} numberOfLines={1}>
                                · 📍 {entry.locationName}
                              </Text>
                            ) : null}
                          </View>
                          {/* Title */}
                          {entry.title ? (
                            <Text style={{ fontFamily: SERIF, fontSize: 14.5, fontWeight: '700', color: C.ink,
                              lineHeight: 20, marginBottom: 4 }} numberOfLines={1}>
                              {entry.title}
                            </Text>
                          ) : null}
                          {/* Preview */}
                          <Text style={{ fontSize: 12, color: C.inkSoft, lineHeight: 18 }} numberOfLines={2}>
                            {entry.content}
                          </Text>

                          {/* Photo thumbnails */}
                          {media.length > 0 && (
                            <View style={{ flexDirection: 'row', gap: 4, marginTop: 8 }}>
                              {media.slice(0, 3).map((m, pi) => (
                                <View key={m.id} style={{ position: 'relative' }}>
                                  <ExpoImage
                                    source={{ uri: m.localUri }}
                                    style={{ width: 52, height: 52, borderRadius: 10 }}
                                    contentFit="cover"
                                  />
                                  {pi === 2 && media.length > 3 && (
                                    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                      borderRadius: 10, backgroundColor: 'rgba(26,22,48,0.55)',
                                      justifyContent: 'center', alignItems: 'center' }}>
                                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 11 }}>
                                        +{media.length - 3}
                                      </Text>
                                    </View>
                                  )}
                                </View>
                              ))}
                            </View>
                          )}
                        </View>

                        {/* Footer chips */}
                        {(entry.locationName || totalExpenses > 0) && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6,
                            paddingHorizontal: 11, paddingBottom: 10, flexWrap: 'wrap' }}>
                            <View style={[s.chip, { backgroundColor: C.roseTint }]}>
                              <Text style={{ fontSize: 12 }}>{mood.emoji}</Text>
                              <Text style={{ fontSize: 10, fontWeight: '600', color: C.rose }}>{mood.label}</Text>
                            </View>
                            {totalExpenses > 0 && (
                              <Text style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: '700', color: C.gold }}>
                                ฿{formatCurrency(totalExpenses)}
                              </Text>
                            )}
                          </View>
                        )}
                      </View>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}

      {/* ── FAB (write new) ── */}
      <View style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        height: insets.bottom + 64, paddingBottom: insets.bottom,
        backgroundColor: 'rgba(240,244,251,0.94)',
        borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.8)',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Pressable
          onPress={() => router.push('/diary-write' as any)}
          style={{
            width: 52, height: 52, borderRadius: 26,
            backgroundColor: C.rose,
            justifyContent: 'center', alignItems: 'center',
            shadowColor: C.rose, shadowOpacity: 0.5, shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 }, elevation: 6,
          }}>
          <Text style={{ fontSize: 24, color: '#fff', fontWeight: '300' }}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  headBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#1A1630', shadowOpacity: 0.08, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  monthNavBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#F0F4FB',
    justifyContent: 'center', alignItems: 'center',
  },
  statChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#F0F4FB', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  groupLabel: {
    fontSize: 11, fontWeight: '700', color: '#AFAABB',
    letterSpacing: 0.5, textTransform: 'uppercase',
    backgroundColor: '#F0F4FB', paddingHorizontal: 4,
  },
  entryCard: {
    backgroundColor: '#FFFFFF', borderRadius: 18, overflow: 'hidden',
    shadowColor: '#1A1630', shadowOpacity: 0.08, shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },
});
