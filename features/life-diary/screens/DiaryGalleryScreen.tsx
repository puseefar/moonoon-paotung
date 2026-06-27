/**
 * DiaryGalleryScreen — Timeline Gallery
 * รูปภาพทั้งหมดจัดกลุ่มตาม Diary Entry + แยกตามเดือน
 * แต่ละ entry แสดง: วันที่/mood dot, ชื่อเรื่อง, content preview, photo grid
 */
import { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, Pressable, ActivityIndicator,
  Dimensions, StyleSheet,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import LinearGradient from 'react-native-linear-gradient';
import { diaryService } from '@/services/diaryService';
import type { EntryWithRelations } from '../types';

const { width: SCREEN_W } = Dimensions.get('window');

// outer padding 16*2=32, timeline col 32 + gap 12 = 44 → available = SCREEN_W-76
// 3 cols with 2 gaps of 3px each
const PHOTO_COL = 3;
const PHOTO_GAP = 3;
const PHOTO_AREA_W = SCREEN_W - 76;
const PHOTO_SIZE = Math.floor((PHOTO_AREA_W - PHOTO_GAP * (PHOTO_COL - 1)) / PHOTO_COL);

// ── Design tokens — ม่วง/ชมพู (Life Diary Pro theme) ──────────────────────────
const C = {
  bg:           '#18062E',
  card:         'rgba(255,255,255,0.08)',
  cardBorder:   'rgba(255,255,255,0.13)',
  ink:          '#FFFFFF',
  inkSoft:      'rgba(240,200,240,0.82)',
  inkFaint:     'rgba(255,255,255,0.42)',
  line:         'rgba(255,255,255,0.12)',
  rose:         '#D14F86',
  rosePink:     '#FF78D4',
  connector:    'rgba(255,255,255,0.16)',
} as const;

const FONT_BRAND = 'Mali_700Bold';
const FONT_SEMI  = 'Mali_600SemiBold';

// ── Helpers ───────────────────────────────────────────────────────────────────
const MONTH_NAMES_LONG = [
  'มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
  'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม',
];

const EMOJI_TO_MOOD: Record<string, string> = {
  '🤩': 'great', '😆': 'great', '🥰': 'great', '😄': 'great',
  '😊': 'good',
  '😌': 'ok', '😮': 'ok', '😴': 'ok', '😐': 'ok',
  '😤': 'tired', '🥺': 'tired', '😔': 'tired',
  '😢': 'bad', '😞': 'bad',
};

const MOOD_DOTS: Record<string, string> = {
  great: '#E9C46A', good: '#A8C3A0', ok: '#AFC5D8', tired: '#B9A8C9', bad: '#C9A0A8',
};

function isoMonth(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTH_NAMES_LONG[m - 1]} ${y + 543}`;
}

function moodDotColor(emoji: string | null | undefined) {
  const mk = EMOJI_TO_MOOD[emoji ?? ''] ?? 'ok';
  return MOOD_DOTS[mk] ?? MOOD_DOTS.ok;
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function DiaryGalleryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<EntryWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await diaryService.getEntriesWithRelations({ limit: 300 });
      // เฉพาะ entry ที่มีรูปภาพ
      setItems(all.filter(it => it.media.length > 0));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // จัดกลุ่มตามเดือน (เรียงล่าสุดขึ้นก่อน)
  const groups = useMemo(() => {
    const map = new Map<string, EntryWithRelations[]>();
    for (const it of items) {
      const ym = isoMonth(new Date(it.entry.entryDate as unknown as number));
      if (!map.has(ym)) map.set(ym, []);
      map.get(ym)!.push(it);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([ym, entries]) => ({
        ym,
        label: monthLabel(ym),
        entries: entries.sort(
          (a, b) => (b.entry.entryDate as unknown as number) - (a.entry.entryDate as unknown as number),
        ),
        totalPhotos: entries.reduce((s, e) => s + e.media.length, 0),
      }));
  }, [items]);

  const totalPhotos = useMemo(() => items.reduce((s, it) => s + it.media.length, 0), [items]);
  const totalEvents = items.length;

  // ──────────────────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Header gradient ── */}
      <LinearGradient
        colors={['rgba(192,80,230,0.60)', 'rgba(57,144,246,0.48)', 'rgba(30,200,240,0.36)']}
        start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
        style={{ paddingTop: insets.top + 14, paddingBottom: 16, paddingHorizontal: 20 }}>
        {/* dark overlay */}
        <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
          <View style={{ flex: 1, backgroundColor: 'rgba(20,5,40,0.38)' }} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable
            onPress={() => router.back()}
            style={s.backBtn}>
            <Text style={{ color: '#fff', fontSize: 20, lineHeight: 24 }}>‹</Text>
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 19, fontWeight: '700', color: C.rosePink, fontFamily: FONT_BRAND }}>
              📸 แกลอรี่ไดอารี่
            </Text>
            {!loading && (
              <Text style={{ fontSize: 11, color: C.inkSoft, marginTop: 1 }}>
                {totalPhotos} รูปภาพ · {totalEvents} เหตุการณ์
              </Text>
            )}
          </View>
        </View>
      </LinearGradient>

      {/* ── Content ── */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={C.rosePink} />
          <Text style={{ color: C.inkSoft, marginTop: 12, fontSize: 13 }}>กำลังโหลดรูปภาพ...</Text>
        </View>
      ) : groups.length === 0 ? (
        <EmptyState onWrite={() => router.push('/diary-write' as any)} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>

          {groups.map(group => (
            <View key={group.ym} style={{ marginBottom: 32 }}>
              {/* ── Month section header ── */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: C.line }} />
                <View style={s.monthBadge}>
                  <Text style={{ fontSize: 11, color: C.rosePink, fontWeight: '700', fontFamily: FONT_SEMI }}>
                    {group.label}
                  </Text>
                  <View style={s.monthCountDot} />
                  <Text style={{ fontSize: 10, color: C.inkFaint }}>
                    {group.totalPhotos} รูป
                  </Text>
                </View>
                <View style={{ flex: 1, height: 1, backgroundColor: C.line }} />
              </View>

              {/* ── Entries in this month ── */}
              {group.entries.map((item, idx) => {
                const { entry, media } = item;
                const dateObj = new Date(entry.entryDate as unknown as number);
                const dotColor = moodDotColor(entry.mood);
                const isLast = idx === group.entries.length - 1;

                const dayStr = dateObj.toLocaleDateString('th-TH', {
                  weekday: 'short', day: 'numeric', month: 'short',
                });
                const timeStr = dateObj.toLocaleTimeString('th-TH', {
                  hour: '2-digit', minute: '2-digit',
                });

                return (
                  <View key={entry.id} style={{ flexDirection: 'row', gap: 12, marginBottom: isLast ? 0 : 24 }}>
                    {/* Timeline left column */}
                    <View style={{ width: 32, alignItems: 'center' }}>
                      <View style={[s.timelineDot, { backgroundColor: dotColor }]} />
                      {!isLast && (
                        <View style={s.timelineConnector} />
                      )}
                    </View>

                    {/* Entry block */}
                    <View style={{ flex: 1 }}>
                      {/* Entry header card — กดไป entry detail */}
                      <Pressable
                        onPress={() => router.push({
                          pathname: '/diary-entry' as any,
                          params: { entryId: entry.id },
                        })}
                        style={s.entryCard}>
                        {/* Accent bar */}
                        <View style={{ height: 3, backgroundColor: dotColor, borderRadius: 3 }} />

                        <View style={{ padding: 11 }}>
                          {/* Date + time row */}
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dotColor }} />
                            <Text style={{ fontSize: 10.5, color: C.inkFaint, fontWeight: '600' }}>
                              {dayStr} · {timeStr} น.
                            </Text>
                            {entry.locationName ? (
                              <Text style={{ fontSize: 10, color: C.inkFaint, flex: 1 }} numberOfLines={1}>
                                · 📍 {entry.locationName}
                              </Text>
                            ) : null}
                          </View>

                          {/* Title */}
                          {entry.title ? (
                            <Text
                              style={{ fontSize: 13.5, fontWeight: '700', color: C.ink,
                                fontFamily: FONT_BRAND, marginBottom: 2 }}
                              numberOfLines={1}>
                              {entry.title}
                            </Text>
                          ) : null}

                          {/* Content preview */}
                          <Text
                            style={{ fontSize: 12, color: C.inkSoft, lineHeight: 18 }}
                            numberOfLines={2}>
                            {entry.content}
                          </Text>

                          {/* Photo count badge */}
                          <View style={{ flexDirection: 'row', marginTop: 7, gap: 6 }}>
                            <View style={s.photoBadge}>
                              <Text style={{ fontSize: 10, color: C.rosePink, fontWeight: '700' }}>
                                🖼️ {media.length} รูป
                              </Text>
                            </View>
                            <View style={[s.photoBadge, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                              <Text style={{ fontSize: 10, color: C.inkFaint }}>
                                กดดูบันทึก ›
                              </Text>
                            </View>
                          </View>
                        </View>
                      </Pressable>

                      {/* Photo grid — กดรูปไป entry detail */}
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: PHOTO_GAP, marginTop: 6 }}>
                        {media.map((m) => (
                          <Pressable
                            key={m.id}
                            onPress={() => router.push({
                              pathname: '/diary-entry' as any,
                              params: { entryId: entry.id },
                            })}
                            style={{ width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: 10, overflow: 'hidden' }}>
                            <ExpoImage
                              source={{ uri: m.localUri }}
                              style={{ width: PHOTO_SIZE, height: PHOTO_SIZE }}
                              contentFit="cover"
                              transition={200}
                            />
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────
function EmptyState({ onWrite }: { onWrite: () => void }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
      <Text style={{ fontSize: 56, marginBottom: 14 }}>🖼️</Text>
      <Text style={{ fontSize: 17, fontWeight: '800', color: '#fff',
        fontFamily: 'Mali_700Bold', textAlign: 'center', marginBottom: 8 }}>
        ยังไม่มีรูปภาพ
      </Text>
      <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 20 }}>
        เพิ่มรูปภาพในบันทึกไดอารี่{'\n'}รูปจะโชว์ที่นี่พร้อมเรื่องราวและวันเวลา
      </Text>
      <Pressable onPress={onWrite} style={{
        marginTop: 22, backgroundColor: '#D14F86', borderRadius: 22,
        paddingHorizontal: 28, paddingVertical: 13,
        shadowColor: '#D14F86', shadowOpacity: 0.5, shadowRadius: 12, elevation: 6,
      }}>
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14, fontFamily: 'Mali_700Bold' }}>
          ✏️ เขียนบันทึกแรก
        </Text>
      </Pressable>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center',
  },
  monthBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)',
  },
  monthCountDot: {
    width: 3, height: 3, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  timelineDot: {
    width: 12, height: 12, borderRadius: 6,
    marginTop: 8,
    borderWidth: 2.5, borderColor: '#18062E',
  },
  timelineConnector: {
    width: 2, flex: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
    marginTop: 4, borderRadius: 1,
    minHeight: 24,
  },
  entryCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)',
    marginBottom: 0,
  },
  photoBadge: {
    backgroundColor: 'rgba(209,79,134,0.22)',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
});
