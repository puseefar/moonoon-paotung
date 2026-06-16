/**
 * ProDiaryScreen — Life Diary (Pro tier)
 * Watercolor aesthetic: mood-wash header, activity chips, daily question ticker,
 * bottom sheet composer, Pro entry cards with mood gradient bar.
 *
 * Font note: add `@expo-google-fonts/mali` + load Mali_400Regular / Mali_700Bold
 * in app/_layout.tsx to get the handwriting feel. Falls back to system serif.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, ActivityIndicator,
  Animated, Modal, TextInput, TouchableWithoutFeedback,
  Dimensions, Platform, Keyboard,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import { diaryService } from '@/services/diaryService';
import type { DiaryMedia } from '@/db/schema';
import { formatCurrency } from '@/lib/format';
import { useSnackbar } from '@/components/ui/SnackbarProvider';
import { CalendarView } from '../components/CalendarView';
import { AlbumView } from '../components/AlbumView';
import type { EntryWithRelations } from '../types';
import { isSameDay } from '../types';

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  paper: '#FBF8F3', paperDeep: '#F3EEE5',
  ink: '#3D3548', inkSoft: '#7A7186', inkFaint: '#A9A1B3',
  line: '#E7DFD3',
  rose: '#D14F86', roseSoft: '#E0689A', roseTint: '#FBEAF1',
  sage: '#7E9E7C', sageTint: '#EAF0E7',
  gold: '#CC9A3A', goldTint: '#FAF1DC',
} as const;

// TODO: add @expo-google-fonts/mali and load in _layout.tsx
const FONT_BRAND = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

// ── Mood system ───────────────────────────────────────────────────────────────
const PRO_MOODS = [
  { key: 'great', label: 'ดีมาก',   dot: '#E9C46A', gradA: '#F0DBA0', gradB: '#F6E9C6', emoji: '🤩' },
  { key: 'good',  label: 'ดี',       dot: '#A8C3A0', gradA: '#C8DCC2', gradB: '#E1ECDC', emoji: '😊' },
  { key: 'ok',    label: 'เฉยๆ',    dot: '#AFC5D8', gradA: '#C7D8E4', gradB: '#E2ECF1', emoji: '😌' },
  { key: 'tired', label: 'เหนื่อย', dot: '#B9A8C9', gradA: '#D6CBE2', gradB: '#E8E0F0', emoji: '😤' },
  { key: 'bad',   label: 'แย่',      dot: '#C9A0A8', gradA: '#E0C7CC', gradB: '#EFDDE0', emoji: '😢' },
] as const;
type MoodKey = typeof PRO_MOODS[number]['key'];

const EMOJI_TO_MOOD: Record<string, MoodKey> = {
  '🤩': 'great', '😆': 'great', '🥰': 'great',
  '😊': 'good',
  '😌': 'ok', '😮': 'ok', '😴': 'ok',
  '😤': 'tired', '🥺': 'tired',
  '😢': 'bad',
};

function getMood(key: MoodKey) { return PRO_MOODS.find(m => m.key === key)!; }

// ── Activities ────────────────────────────────────────────────────────────────
const ACTIVITIES = [
  { key: 'work',     icon: '🏢', label: 'ทำงาน' },
  { key: 'shop',     icon: '🏪', label: 'เปิดร้าน' },
  { key: 'dayoff',   icon: '🏖️', label: 'วันหยุด' },
  { key: 'family',   icon: '👨‍👩‍👧', label: 'พาครอบครัว' },
  { key: 'trip',     icon: '✈️', label: 'ไปทริป' },
  { key: 'festival', icon: '🎉', label: 'งานเทศกาล' },
  { key: 'study',    icon: '📚', label: 'เรียน' },
  { key: 'home',     icon: '🏠', label: 'อยู่บ้าน' },
  { key: 'exercise', icon: '🏃', label: 'ออกกำลัง' },
  { key: 'doctor',   icon: '🏥', label: 'พบแพทย์' },
  { key: 'shopping', icon: '🛍️', label: 'ช็อปปิ้ง' },
  { key: 'eatout',   icon: '🍜', label: 'ออกไปกิน' },
];

// ── Daily questions ───────────────────────────────────────────────────────────
const DAILY_QS = [
  'วันนี้เกิดอะไรขึ้นที่ทำให้รู้สึกดี?',
  'วันนี้ได้เรียนรู้อะไรใหม่?',
  'วันนี้มีอะไรที่อยากเปลี่ยนไหม?',
  'สิ่งที่ดีที่สุดของวันนี้คืออะไร?',
  'วันนี้ดูแลตัวเองดีแค่ไหน?',
  'คนที่ทำให้วันนี้ดีขึ้นคือใคร?',
  'วันนี้มีอะไรที่ทำให้ยิ้มได้บ้าง?',
  'วันนี้รู้สึกยังไงตอนตื่นนอน?',
  'อะไรที่อยากขอบคุณตัวเองในวันนี้?',
];
const Q_ITEM_H = 52;

type Tab = 'home' | 'calendar' | 'album';

// ── ProEntryCard ──────────────────────────────────────────────────────────────
function ProEntryCard({ item, onPress }: { item: EntryWithRelations; onPress: () => void }) {
  const { entry, media, totalExpenses } = item;
  const moodKey = entry.mood ? (EMOJI_TO_MOOD[entry.mood] ?? 'ok') : 'ok';
  const mood = getMood(moodKey);
  const firstPhoto = media[0];

  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: '#fff', borderRadius: 18, marginBottom: 10,
        overflow: 'hidden', elevation: 1,
        shadowColor: C.ink, shadowOpacity: 0.07, shadowRadius: 8,
      }}>
      {/* mood gradient bar */}
      <LinearGradient
        colors={[mood.gradA, mood.gradB]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{ height: 5 }}
      />
      <View style={{ padding: 14, flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 5 }}>
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: mood.dot }} />
            <Text style={{ fontSize: 11, color: C.inkSoft }}>
              {new Date(entry.entryDate as unknown as number)
                .toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
              {'  '}
              {new Date(entry.entryDate as unknown as number)
                .toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {entry.locationName ? (
              <Text style={{ fontSize: 11, color: C.inkFaint }}>· 📍 {entry.locationName}</Text>
            ) : null}
          </View>
          {entry.title ? (
            <Text
              style={{ fontSize: 14.5, fontWeight: '700', color: C.ink, marginBottom: 3, fontFamily: FONT_BRAND }}
              numberOfLines={1}>
              {entry.title}
            </Text>
          ) : null}
          <Text style={{ fontSize: 13, color: C.inkSoft, lineHeight: 19 }} numberOfLines={2}>
            {entry.content}
          </Text>
          {(media.length > 0 || totalExpenses > 0) && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              {media.length > 0 && (
                <View style={{ backgroundColor: C.roseTint, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 11, color: C.rose, fontWeight: '600' }}>🖼️ {media.length} รูป</Text>
                </View>
              )}
              {totalExpenses > 0 && (
                <View style={{ backgroundColor: C.goldTint, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 11, color: C.gold, fontWeight: '700' }}>฿{formatCurrency(totalExpenses)}</Text>
                </View>
              )}
            </View>
          )}
        </View>
        {firstPhoto ? (
          <ExpoImage
            source={{ uri: firstPhoto.localUri }}
            style={{ width: 68, height: 68, borderRadius: 12 }}
            contentFit="cover"
          />
        ) : null}
      </View>
    </Pressable>
  );
}

// ── Mood × Money insight ──────────────────────────────────────────────────────
function MoodMoneyInsight({ items }: { items: EntryWithRelations[] }) {
  if (items.length < 3) return null;

  const byMood: Record<MoodKey, { total: number; count: number }> = {
    great: { total: 0, count: 0 }, good: { total: 0, count: 0 },
    ok: { total: 0, count: 0 }, tired: { total: 0, count: 0 }, bad: { total: 0, count: 0 },
  };

  for (const item of items) {
    const mk = item.entry.mood ? (EMOJI_TO_MOOD[item.entry.mood] ?? 'ok') : 'ok';
    byMood[mk].total += item.totalExpenses;
    byMood[mk].count++;
  }

  const avg = (k: MoodKey) => byMood[k].count > 0 ? byMood[k].total / byMood[k].count : 0;
  const happyAvg = (avg('great') + avg('good')) / 2;
  const sadAvg   = (avg('tired') + avg('bad')) / 2;
  if (happyAvg === 0 && sadAvg === 0) return null;

  const ratio = sadAvg > 0 ? (sadAvg / Math.max(happyAvg, 1)) : 0;
  if (ratio < 1.2) return null;

  return (
    <View style={{
      backgroundColor: C.goldTint, borderRadius: 18, padding: 16, marginBottom: 14,
      borderWidth: 1, borderColor: '#EAD9B0',
    }}>
      <Text style={{ fontSize: 10, fontWeight: '700', color: C.gold, letterSpacing: 0.5, marginBottom: 6 }}>
        อารมณ์ × การใช้จ่าย
      </Text>
      <Text style={{ fontSize: 14, color: C.ink, lineHeight: 20 }}>
        วันที่รู้สึก <Text style={{ fontWeight: '800', color: C.gold }}>เหนื่อยหรือแย่</Text>
        {' '}คุณใช้จ่ายมากกว่าวันอารมณ์ดี{' '}
        <Text style={{ fontWeight: '800', color: C.gold }}>
          เกือบ {ratio.toFixed(1)} เท่า
        </Text>
      </Text>
      <Text style={{ fontSize: 11, color: C.inkSoft, marginTop: 6 }}>
        😊 วันอารมณ์ดี เฉลี่ย ฿{formatCurrency(Math.round(happyAvg))}
        {'  '}😤 วันเหนื่อย เฉลี่ย ฿{formatCurrency(Math.round(sadAvg))}
      </Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ProDiaryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showSnackbar } = useSnackbar();

  // ── Data ──────────────────────────────────────────────────────────────────
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

  // ── UI state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [selectedMood, setSelectedMood] = useState<MoodKey>('good');
  const [selectedAct, setSelectedAct] = useState<string | null>(null);

  // ── Question ticker ───────────────────────────────────────────────────────
  const [qIdx, setQIdx] = useState(0);
  const qAnim = useRef(new Animated.Value(0)).current;
  const qTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  function goToQ(next: number) {
    const n = ((next % DAILY_QS.length) + DAILY_QS.length) % DAILY_QS.length;
    setQIdx(n);
    Animated.timing(qAnim, {
      toValue: -n * Q_ITEM_H,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }

  useEffect(() => {
    qTimer.current = setInterval(() => setQIdx(i => {
      const n = (i + 1) % DAILY_QS.length;
      Animated.timing(qAnim, { toValue: -n * Q_ITEM_H, duration: 420, useNativeDriver: true }).start();
      return n;
    }), 5000);
    return () => { if (qTimer.current) clearInterval(qTimer.current); };
  }, []);

  // ── Bottom sheet ──────────────────────────────────────────────────────────
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<'choose' | 'feel'>('choose');
  const [quickNote, setQuickNote] = useState('');
  const [quickMood, setQuickMood] = useState<MoodKey>('good');
  const [keyboardH, setKeyboardH] = useState(0);
  const sheetY = useRef(new Animated.Value(400)).current;
  const backdropOp = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const showEv = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEv = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEv, e => setKeyboardH(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEv, () => setKeyboardH(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  function openSheet() {
    setSheetMode('choose');
    setQuickNote('');
    setSheetOpen(true);
    Animated.parallel([
      Animated.spring(sheetY, { toValue: 0, tension: 65, friction: 9, useNativeDriver: true }),
      Animated.timing(backdropOp, { toValue: 1, duration: 260, useNativeDriver: true }),
    ]).start();
  }

  function closeSheet() {
    Animated.parallel([
      Animated.timing(sheetY, { toValue: 400, duration: 240, useNativeDriver: true }),
      Animated.timing(backdropOp, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => setSheetOpen(false));
  }

  async function saveQuickFeel() {
    if (!quickNote.trim()) return;
    const mood = getMood(quickMood);
    await diaryService.createEntry({
      content: quickNote.trim(),
      mood: mood.emoji,
      entryDate: new Date(),
    });
    closeSheet();
    showSnackbar({ message: 'บันทึกแล้ว ✓', variant: 'success' });
    load();
  }

  // ── Mood wash gradient ────────────────────────────────────────────────────
  const mood = getMood(selectedMood);

  // ── Tab helpers ───────────────────────────────────────────────────────────
  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    if (tab === 'album' && !mediaLoaded) loadAlbum();
  }

  const recentItems = items.slice(0, 5);

  // ── Grouped timeline (for calendar onDayPress) ────────────────────────────
  function handleDayPress(_date: Date) {
    setActiveTab('home');
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Mood-wash header ───────────────────────────────────────────────── */}
      <LinearGradient
        colors={[mood.gradA, mood.gradB, C.paper]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 10, paddingHorizontal: 20, paddingBottom: 0 }}>

        {/* brand + search */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: C.ink, fontFamily: FONT_BRAND }}>
              สมุดชีวิต
            </Text>
            <Text style={{ fontSize: 11, color: C.inkSoft, marginTop: 1, letterSpacing: 0.3 }}>
              Life Diary
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/diary-search' as any)}
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(61,53,72,0.08)',
              justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontSize: 17 }}>🔍</Text>
          </Pressable>
          <Pressable
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(61,53,72,0.08)',
              justifyContent: 'center', alignItems: 'center', marginLeft: 8 }}>
            <Text style={{ fontSize: 16 }}>👤</Text>
          </Pressable>
        </View>

        {/* mood picker */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
          {PRO_MOODS.map(m => (
            <Pressable
              key={m.key}
              onPress={() => setSelectedMood(m.key)}
              style={{ flex: 1, alignItems: 'center', gap: 5 }}>
              <View style={{
                width: selectedMood === m.key ? 34 : 28,
                height: selectedMood === m.key ? 34 : 28,
                borderRadius: 18,
                backgroundColor: m.dot,
                shadowColor: m.dot,
                shadowOpacity: selectedMood === m.key ? 0.5 : 0,
                shadowRadius: 8,
                elevation: selectedMood === m.key ? 4 : 0,
                borderWidth: selectedMood === m.key ? 2.5 : 0,
                borderColor: '#fff',
              }} />
              <Text style={{
                fontSize: 9.5, color: selectedMood === m.key ? C.ink : C.inkFaint,
                fontWeight: selectedMood === m.key ? '700' : '400',
              }}>
                {m.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* tab bar */}
        <View style={{ flexDirection: 'row', gap: 6, paddingBottom: 14 }}>
          {([
            { id: 'home',     label: '🏠 ชีวิต' },
            { id: 'calendar', label: '📅 ปฏิทิน' },
            { id: 'album',    label: '🖼 อัลบั้ม' },
          ] as { id: Tab; label: string }[]).map(t => (
            <Pressable
              key={t.id}
              onPress={() => handleTabChange(t.id)}
              style={{
                flex: 1, paddingVertical: 8, borderRadius: 14, alignItems: 'center',
                backgroundColor: activeTab === t.id ? 'rgba(61,53,72,0.12)' : 'rgba(255,255,255,0.45)',
              }}>
              <Text style={{
                fontSize: 12, fontWeight: activeTab === t.id ? '700' : '500',
                color: activeTab === t.id ? C.ink : C.inkSoft,
              }}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </LinearGradient>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={C.rose} />
        </View>
      ) : activeTab === 'calendar' ? (
        <CalendarView items={items} insets={insets} onDayPress={handleDayPress} />
      ) : activeTab === 'album' ? (
        <AlbumView media={allMedia} loading={mediaLoading} insets={insets}
          onPress={entryId => router.push({ pathname: '/diary-entry' as any, params: { entryId } })} />
      ) : (
        /* ── Home tab ──────────────────────────────────────────────────────── */
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}>

          {/* Activity mode row */}
          <View style={{ marginBottom: 14 }}>
            <Text style={{ fontSize: 11.5, fontWeight: '700', color: C.inkSoft, marginBottom: 8 }}>
              วันนี้ทำอะไรน่า
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 7 }}>
                {ACTIVITIES.map(a => (
                  <Pressable
                    key={a.key}
                    onPress={() => setSelectedAct(selectedAct === a.key ? null : a.key)}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 5,
                      paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
                      backgroundColor: selectedAct === a.key ? C.roseTint : '#fff',
                      borderWidth: 1.5,
                      borderColor: selectedAct === a.key ? C.roseSoft : C.line,
                    }}>
                    <Text style={{ fontSize: 15 }}>{a.icon}</Text>
                    <Text style={{
                      fontSize: 12, fontWeight: selectedAct === a.key ? '700' : '500',
                      color: selectedAct === a.key ? C.rose : C.inkSoft,
                    }}>
                      {a.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Daily question ticker */}
          <Pressable
            onPress={() => { goToQ(qIdx + 1); }}
            style={{
              backgroundColor: '#fff', borderRadius: 18, marginBottom: 14,
              borderWidth: 1, borderColor: C.line, overflow: 'hidden',
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, paddingBottom: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: C.inkSoft, flex: 1 }}>
                คำถามประจำวัน
              </Text>
              <Text style={{ fontSize: 11, color: C.inkFaint }}>แตะเพื่อถัดไป ›</Text>
            </View>
            {/* Clipped window for vertical slide */}
            <View style={{ height: Q_ITEM_H, overflow: 'hidden' }}>
              <Animated.View style={{ transform: [{ translateY: qAnim }] }}>
                {DAILY_QS.map((q, i) => (
                  <Pressable
                    key={i}
                    onPress={() => openSheet()}
                    style={{
                      height: Q_ITEM_H, justifyContent: 'center',
                      paddingHorizontal: 14,
                    }}>
                    <Text style={{
                      fontSize: 14.5, color: C.ink, fontFamily: FONT_BRAND,
                      fontStyle: 'italic', lineHeight: 21,
                    }}>
                      ✏️ {q}
                    </Text>
                  </Pressable>
                ))}
              </Animated.View>
            </View>
            {/* Dots indicator */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5, paddingVertical: 10 }}>
              {DAILY_QS.map((_, i) => (
                <View key={i} style={{
                  width: i === qIdx ? 14 : 5, height: 5, borderRadius: 3,
                  backgroundColor: i === qIdx ? C.rose : C.line,
                }} />
              ))}
            </View>
          </Pressable>

          {/* Empty state */}
          {items.length === 0 ? (
            <View style={{
              alignItems: 'center', paddingVertical: 36, paddingHorizontal: 20,
              backgroundColor: '#fff', borderRadius: 22, borderWidth: 1, borderColor: C.line,
              marginBottom: 14,
            }}>
              <Text style={{ fontSize: 52, marginBottom: 12 }}>🌸</Text>
              <Text style={{ fontSize: 18, fontWeight: '800', color: C.ink, textAlign: 'center',
                fontFamily: FONT_BRAND, marginBottom: 6 }}>
                ยังไม่มีบันทึกเลย
              </Text>
              <Text style={{ fontSize: 13, color: C.inkSoft, textAlign: 'center', lineHeight: 20, marginBottom: 20 }}>
                เริ่มเขียนบันทึกแรกของคุณ{'\n'}ความรู้สึก ช่วงเวลา และเงิน
              </Text>
              <Pressable
                onPress={openSheet}
                style={{
                  backgroundColor: C.rose, borderRadius: 20,
                  paddingHorizontal: 24, paddingVertical: 12,
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                }}>
                <Text style={{ fontSize: 15 }}>✏️</Text>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>เริ่มบันทึกวันนี้</Text>
              </Pressable>
            </View>
          ) : (
            /* Populated state */
            <>
              <MoodMoneyInsight items={items} />

              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: C.inkSoft, flex: 1 }}>
                  บันทึกล่าสุด
                </Text>
                <Pressable onPress={() => {}}>
                  <Text style={{ fontSize: 12, color: C.rose, fontWeight: '600' }}>ดูทั้งหมด ›</Text>
                </Pressable>
              </View>

              {recentItems.map(item => (
                <ProEntryCard
                  key={item.entry.id}
                  item={item}
                  onPress={() => router.push({ pathname: '/diary-entry' as any, params: { entryId: item.entry.id } })}
                />
              ))}
            </>
          )}
        </ScrollView>
      )}

      {/* ── FAB ────────────────────────────────────────────────────────────── */}
      {(activeTab === 'home') && (
        <Pressable
          onPress={openSheet}
          style={{
            position: 'absolute', right: 20, bottom: insets.bottom + 20,
            backgroundColor: C.rose, borderRadius: 28,
            paddingHorizontal: 20, paddingVertical: 14,
            flexDirection: 'row', alignItems: 'center', gap: 8,
            elevation: 8, shadowColor: C.rose, shadowOpacity: 0.4, shadowRadius: 16,
          }}>
          <Text style={{ fontSize: 16 }}>✏️</Text>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>บันทึกวันนี้</Text>
        </Pressable>
      )}

      {/* ── Bottom Sheet ───────────────────────────────────────────────────── */}
      <Modal visible={sheetOpen} transparent animationType="none" onRequestClose={closeSheet}>
        <TouchableWithoutFeedback onPress={closeSheet}>
          <Animated.View style={{
            position: 'absolute', inset: 0,
            backgroundColor: 'rgba(61,53,72,0.48)',
            opacity: backdropOp,
          }} />
        </TouchableWithoutFeedback>

        <Animated.View style={{
          position: 'absolute', left: 0, right: 0, bottom: keyboardH,
          backgroundColor: C.paper,
          borderTopLeftRadius: 28, borderTopRightRadius: 28,
          transform: [{ translateY: sheetY }],
          overflow: 'hidden',
        }}>
          {/* drag handle */}
          <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.line }} />
          </View>

          {sheetMode === 'choose' ? (
            /* ── Mode choose ───────────────────────────────────────────────── */
            <View style={{ padding: 20, paddingBottom: insets.bottom + 20 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: C.ink,
                fontFamily: FONT_BRAND, marginBottom: 16, textAlign: 'center' }}>
                🌸 เริ่มบันทึกยังไงดี?
              </Text>

              <Pressable
                onPress={() => { closeSheet(); router.push('/diary-write' as any); }}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 14,
                  backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 10,
                  borderWidth: 1.5, borderColor: C.line,
                }}>
                <View style={{ width: 48, height: 48, borderRadius: 16,
                  backgroundColor: C.roseTint, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontSize: 22 }}>✏️</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: C.ink }}>เขียนเต็มๆ</Text>
                  <Text style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>
                    ทั้งข้อความ รูปภาพ และรายจ่าย
                  </Text>
                </View>
                <Text style={{ color: C.inkFaint, fontSize: 18 }}>›</Text>
              </Pressable>

              <Pressable
                onPress={() => { closeSheet(); router.push('/diary-write' as any); }}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 14,
                  backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 10,
                  borderWidth: 1.5, borderColor: C.line,
                }}>
                <View style={{ width: 48, height: 48, borderRadius: 16,
                  backgroundColor: C.sageTint, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontSize: 22 }}>📷</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: C.ink }}>เริ่มจากรูป</Text>
                  <Text style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>
                    เลือกรูปก่อน แล้วค่อยเขียน
                  </Text>
                </View>
                <Text style={{ color: C.inkFaint, fontSize: 18 }}>›</Text>
              </Pressable>

              <Pressable
                onPress={() => setSheetMode('feel')}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 14,
                  backgroundColor: '#fff', borderRadius: 18, padding: 16,
                  borderWidth: 1.5, borderColor: C.line,
                }}>
                <View style={{ width: 48, height: 48, borderRadius: 16,
                  backgroundColor: C.goldTint, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontSize: 22 }}>💬</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: C.ink }}>บันทึกสั้นๆ</Text>
                  <Text style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>
                    1-2 บรรทัด บันทึกอารมณ์ไว้ก่อน
                  </Text>
                </View>
                <Text style={{ color: C.inkFaint, fontSize: 18 }}>›</Text>
              </Pressable>
            </View>
          ) : (
            /* ── Quick feel form ───────────────────────────────────────────── */
            <View style={{ padding: 20, paddingBottom: insets.bottom + 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <Pressable onPress={() => setSheetMode('choose')} style={{ marginRight: 10 }}>
                  <Text style={{ color: C.inkSoft, fontSize: 14 }}>‹ กลับ</Text>
                </Pressable>
                <Text style={{ fontSize: 15, fontWeight: '800', color: C.ink, fontFamily: FONT_BRAND, flex: 1 }}>
                  💬 รู้สึกยังไงตอนนี้?
                </Text>
              </View>

              {/* Quick mood selector */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                {PRO_MOODS.map(m => (
                  <Pressable
                    key={m.key}
                    onPress={() => setQuickMood(m.key)}
                    style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                    <View style={{
                      width: quickMood === m.key ? 30 : 24,
                      height: quickMood === m.key ? 30 : 24,
                      borderRadius: 15, backgroundColor: m.dot,
                      borderWidth: quickMood === m.key ? 2 : 0, borderColor: '#fff',
                      shadowColor: m.dot, shadowOpacity: quickMood === m.key ? 0.5 : 0,
                      shadowRadius: 6, elevation: quickMood === m.key ? 3 : 0,
                    }} />
                    <Text style={{ fontSize: 9, color: quickMood === m.key ? C.ink : C.inkFaint,
                      fontWeight: quickMood === m.key ? '700' : '400' }}>
                      {m.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <TextInput
                placeholder="เขียนสั้นๆ ว่าตอนนี้รู้สึกยังไง..."
                placeholderTextColor={C.inkFaint}
                value={quickNote}
                onChangeText={setQuickNote}
                multiline
                numberOfLines={3}
                blurOnSubmit
                onSubmitEditing={() => Keyboard.dismiss()}
                style={{
                  backgroundColor: '#fff', borderRadius: 14, padding: 14,
                  borderWidth: 1.5, borderColor: C.line,
                  fontSize: 14, color: C.ink, minHeight: 80,
                  textAlignVertical: 'top',
                }}
              />

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <Pressable
                  onPress={closeSheet}
                  style={{ flex: 1, paddingVertical: 13, borderRadius: 16,
                    backgroundColor: C.paperDeep, alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: C.inkSoft }}>ยกเลิก</Text>
                </Pressable>
                <Pressable
                  onPress={saveQuickFeel}
                  style={{
                    flex: 2, paddingVertical: 13, borderRadius: 16,
                    backgroundColor: quickNote.trim() ? C.rose : C.line,
                    alignItems: 'center',
                  }}>
                  <Text style={{ fontSize: 14, fontWeight: '800',
                    color: quickNote.trim() ? '#fff' : C.inkFaint }}>
                    บันทึก ✓
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </Animated.View>
      </Modal>
    </View>
  );
}
