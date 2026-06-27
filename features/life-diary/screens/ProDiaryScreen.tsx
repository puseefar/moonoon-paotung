/**
 * ProDiaryScreen — Life Diary (Pro tier)
 * All-New UI: collapsed mood/activity chips in header, colorful fixed gradient,
 * prominent centered CTA, clean body layout.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, ActivityIndicator,
  Animated, Modal, TextInput, TouchableWithoutFeedback,
  Platform, Keyboard, StyleSheet,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import { diaryService } from '@/services/diaryService';
import { formatCurrency } from '@/lib/format';
import { useSnackbar } from '@/components/ui/SnackbarProvider';
import { CalendarView } from '../components/CalendarView';
import type { EntryWithRelations } from '../types';

// ── Background slideshow images ────────────────────────────────────────────────
// วางลิงค์รูปภาพจากเว็บภายนอกที่นี่ครับ (สามารถเพิ่ม/เปลี่ยน URL ได้เลย)

/* ══════════════════════════════════════════════════════════════════
   BACKGROUND SLIDESHOW — crossfade
══════════════════════════════════════════════════════════════════ */
const BG_IMAGES = [
  'https://i.pinimg.com/1200x/e9/22/bf/e922bf3f3e800c78bcd1ef1bf562ce84.jpg',
  'https://i.pinimg.com/736x/f7/85/db/f785db36c546ec7050d5526b623d4b9d.jpg',
  'https://i.pinimg.com/736x/45/94/07/4594073798d5b3544eec1de17ae4bfa9.jpg',   
  'https://i.pinimg.com/736x/d0/cf/1f/d0cf1ffc69ce15b4bee0a4f5b3a133bb.jpg',
  'https://i.pinimg.com/736x/e4/39/14/e4391455bf1ac7156257697b376ff457.jpg',
  'https://i.pinimg.com/736x/1a/9d/8c/1a9d8c86489ac81f6318744da23d1ae1.jpg',
  'https://i.pinimg.com/736x/9b/36/2b/9b362b873b9cb74cd1fae234a3d47da0.jpg',
  'https://i.pinimg.com/736x/38/6b/c8/386bc806a19f28989a6e80f44711d8ad.jpg',
  'https://i.pinimg.com/736x/ea/1d/df/ea1ddf93133ede72f4c17651babf310b.jpg',
  'https://i.pinimg.com/736x/61/a6/03/61a60391fa0cf3ac74304de93be4c225.jpg',
  'https://i.pinimg.com/736x/bd/51/d9/bd51d9ae5b23f9fb29de7bbb872cedd7.jpg',
];

// const BG_IMAGES = [
//   'https://picsum.photos/id/1080/800/1200',
//   'https://picsum.photos/id/15/800/1200',
//   'https://picsum.photos/id/37/800/1200',
//   'https://picsum.photos/id/189/800/1200',
// ];
// รูป placeholder ในกรณียังไม่มีบันทึก (โชวในหน้าแรก)
const PLACEHOLDER_PHOTOS = [
  'https://picsum.photos/id/366/200/300',
  'https://picsum.photos/id/491/200/300',
  'https://picsum.photos/id/488/200/300',
];

// ── Design tokens ──────────────────────────────────────────────────────────────
const C = {
  paper: '#FBF8F3', paperDeep: '#F3EEE5',
  ink: '#3D3548', inkSoft: '#7A7186', inkFaint: '#A9A1B3',
  line: '#E7DFD3',
  rose: '#D14F86', roseSoft: '#E0689A', roseTint: '#FBEAF1',
  sage: '#7E9E7C', sageTint: '#EAF0E7',
  gold: '#CC9A3A', goldTint: '#FAF1DC',
} as const;

const FONT_BRAND   = 'Mali_700Bold';
const FONT_SEMI    = 'Mali_600SemiBold';
const FONT_REGULAR = 'Mali_400Regular';

// ── Mood system ────────────────────────────────────────────────────────────────
const PRO_MOODS = [
  { key: 'great', label: 'ดีมาก',   dot: '#E9C46A', gradA: '#F0DBA0', gradB: '#F6E9C6', emoji: '🤩' },
  { key: 'good',  label: 'ดี',       dot: '#A8C3A0', gradA: '#C8DCC2', gradB: '#E1ECDC', emoji: '😊' },
  { key: 'ok',    label: 'สบายๆ',    dot: '#AFC5D8', gradA: '#C7D8E4', gradB: '#E2ECF1', emoji: '😐' },
  { key: 'tired', label: 'เหนื่อย', dot: '#B9A8C9', gradA: '#D6CBE2', gradB: '#E8E0F0', emoji: '😔' },
  { key: 'bad',   label: 'สู้ๆ',      dot: '#C9A0A8', gradA: '#E0C7CC', gradB: '#EFDDE0', emoji: '😞' },
] as const;
type MoodKey = typeof PRO_MOODS[number]['key'];

const EMOJI_TO_MOOD: Record<string, MoodKey> = {
  '🤩': 'great', '😆': 'great', '🥰': 'great', '😄': 'great',
  '😊': 'good',
  '😌': 'ok', '😮': 'ok', '😴': 'ok', '😐': 'ok',
  '😤': 'tired', '🥺': 'tired', '😔': 'tired',
  '😢': 'bad', '😞': 'bad',
};

function getMood(key: MoodKey) { return PRO_MOODS.find(m => m.key === key)!; }

// ── Activities ─────────────────────────────────────────────────────────────────
const ACTIVITIES = [
  { key: 'work',     icon: '🏢', label: 'ทำงาน' },
  { key: 'shop',     icon: '🏪', label: 'เปิดร้าน' },
  { key: 'dayoff',   icon: '🌴', label: 'วันหยุด' },
  { key: 'family',   icon: '👨‍👩‍👧', label: 'พาครอบครัว' },
  { key: 'trip',     icon: '✈️', label: 'ไปทริป' },
  { key: 'festival', icon: '🎉', label: 'เทศกาล' },
  { key: 'study',    icon: '📚', label: 'เรียน/อบรม' },
  { key: 'home',     icon: '🏠', label: 'อยู่บ้าน' },
  { key: 'exercise', icon: '💪', label: 'ออกกำลัง' },
  { key: 'doctor',   icon: '🏥', label: 'นัดหมอ' },
  { key: 'shopping', icon: '🛒', label: 'ช็อปปิ้ง' },
  { key: 'eatout',   icon: '🍽️', label: 'กินข้าวนอก' },
];

// ── Daily questions ────────────────────────────────────────────────────────────
const DAILY_QS = [
  'วันนี้มีอะไรที่ทำให้คุณยิ้มไหม?',
  'วันนี้เหนื่อยเรื่องอะไรที่สุด?',
  'วันนี้อยากขอบคุณใคร?',
  'วันนี้มีภาพไหนที่อยากเก็บไว้?',
  'วันนี้คุณภูมิใจอะไรเล็กๆ บ้าง?',
  'วันนี้เรียนรู้อะไรใหม่ไหม?',
  'วันนี้ช่วงเวลาไหนที่ดีที่สุด?',
  'วันนี้ทำอะไรเพื่อตัวเองบ้างไหม?',
  'วันนี้อยากบอกอะไรกับตัวเองในอนาคต?',
];
const Q_ITEM_H = 50;

type Tab = 'home' | 'calendar';

// ── ProEntryCard ───────────────────────────────────────────────────────────────
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
        shadowOffset: { width: 0, height: 2 },
      }}>
      <LinearGradient
        colors={[mood.gradA, mood.gradB]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{ height: 4 }}
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
              <Text style={{ fontSize: 11, color: C.inkFaint }} numberOfLines={1}>· 📍 {entry.locationName}</Text>
            ) : null}
          </View>
          {entry.title ? (
            <Text style={{ fontSize: 14.5, fontWeight: '700', color: C.ink, marginBottom: 3, fontFamily: FONT_BRAND }}
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

// ── MoodMoneyInsight ───────────────────────────────────────────────────────────
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
  const ratio = sadAvg > 0 ? sadAvg / Math.max(happyAvg, 1) : 0;
  if (ratio < 1.2) return null;

  return (
    <View style={{
      backgroundColor: C.goldTint, borderRadius: 18, padding: 16, marginBottom: 14,
      borderWidth: 1, borderColor: '#EAD9B0',
    }}>
      <Text style={{ fontSize: 10, fontWeight: '700', color: C.gold, letterSpacing: 0.5, marginBottom: 6 }}>
        ✨ Insight ประจำเดือน
      </Text>
      <Text style={{ fontSize: 14, color: C.ink, lineHeight: 20 }}>
        วันที่รู้สึก <Text style={{ fontWeight: '800', color: C.gold }}>เหนื่อยหรือแย่</Text>
        {' '}คุณใช้จ่ายมากกว่าวันอารมณ์ดี{' '}
        <Text style={{ fontWeight: '800', color: C.gold }}>{ratio.toFixed(1)} เท่า</Text>
      </Text>
      <Text style={{ fontSize: 11, color: C.inkSoft, marginTop: 6 }}>
        😊 วันดี เฉลี่ย ฿{formatCurrency(Math.round(happyAvg))}
        {'  '}😔 วันเหนื่อย เฉลี่ย ฿{formatCurrency(Math.round(sadAvg))}
      </Text>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function ProDiaryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showSnackbar } = useSnackbar();

  // Data
  const [items, setItems] = useState<EntryWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const entries = await diaryService.getEntries({ limit: 100 });
    const rich = await Promise.all(entries.map(e => diaryService.getEntryWithRelations(e.id)));
    setItems(rich.filter(Boolean) as EntryWithRelations[]);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Background slideshow — 2-layer alternating crossfade (ไม่มี blink)
  const [layerA, setLayerA] = useState(BG_IMAGES[0] ?? '');
  const [layerB, setLayerB] = useState(BG_IMAGES[1 % Math.max(BG_IMAGES.length, 1)] ?? '');
  const layerAOp = useRef(new Animated.Value(0.78)).current;
  const layerBOp = useRef(new Animated.Value(0)).current;
  const activeLayerRef = useRef<'A' | 'B'>('A');
  const bgIdxRef = useRef(0);

  useEffect(() => {
    // Pre-cache ทุกรูปก่อน เพื่อไม่มี loading delay ตอน crossfade
    BG_IMAGES.forEach(url => ExpoImage.prefetch(url).catch(() => {}));

    if (BG_IMAGES.length < 2) return;
    const timer = setInterval(() => {
      const next = (bgIdxRef.current + 1) % BG_IMAGES.length;
      bgIdxRef.current = next;

      if (activeLayerRef.current === 'A') {
        // โหลดรูปถัดไปบน Layer B (opacity=0 → ไม่เห็น), แล้ว crossfade A→B
        setLayerB(BG_IMAGES[next]);
        layerBOp.setValue(0);
        Animated.parallel([
          Animated.timing(layerAOp, { toValue: 0,    duration: 1200, useNativeDriver: true }),
          Animated.timing(layerBOp, { toValue: 0.78, duration: 1200, useNativeDriver: true }),
        ]).start(() => { activeLayerRef.current = 'B'; });
      } else {
        // โหลดรูปถัดไปบน Layer A (opacity=0 → ไม่เห็น), แล้ว crossfade B→A
        setLayerA(BG_IMAGES[next]);
        layerAOp.setValue(0);
        Animated.parallel([
          Animated.timing(layerBOp, { toValue: 0,    duration: 1200, useNativeDriver: true }),
          Animated.timing(layerAOp, { toValue: 0.78, duration: 1200, useNativeDriver: true }),
        ]).start(() => { activeLayerRef.current = 'A'; });
      }
    }, 18000);
    return () => clearInterval(timer);
  }, []);

  // UI state
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [selectedMood, setSelectedMood] = useState<MoodKey | null>(null);
  const [selectedAct, setSelectedAct] = useState<string | null>(null);
  const [moodChipOpen, setMoodChipOpen] = useState(false);
  const [actChipOpen, setActChipOpen] = useState(false);

  // Derived chip labels
  const selectedMoodObj = selectedMood ? getMood(selectedMood) : null;
  const chipMoodEmoji = selectedMoodObj?.emoji ?? '🙂';
  const chipMoodLabel = selectedMoodObj ? `รู้สึก ${selectedMoodObj.label}` : 'วันนี้รู้สึกอย่างไร?';
  const selectedActObj = ACTIVITIES.find(a => a.key === selectedAct);
  const chipActEmoji = selectedActObj?.icon ?? '🌟';
  const chipActLabel = selectedActObj ? `วันนี้ ${selectedActObj.label}` : 'วันนี้ทำอะไรอยู่น๊า?';

  const todayStr = new Date().toLocaleDateString('th-TH', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  function selectChipMood(m: typeof PRO_MOODS[number]) {
    setSelectedMood(m.key);
    setMoodChipOpen(false);
  }

  function selectChipAct(a: typeof ACTIVITIES[number]) {
    setSelectedAct(selectedAct === a.key ? null : a.key);
    setActChipOpen(false);
  }

  // Question ticker
  const [qIdx, setQIdx] = useState(0);
  const qAnim = useRef(new Animated.Value(0)).current;
  const qTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  function goToQ(next: number) {
    const n = ((next % DAILY_QS.length) + DAILY_QS.length) % DAILY_QS.length;
    setQIdx(n);
    Animated.timing(qAnim, { toValue: -n * Q_ITEM_H, duration: 420, useNativeDriver: true }).start();
  }

  useEffect(() => {
    qTimer.current = setInterval(() => setQIdx(i => {
      const n = (i + 1) % DAILY_QS.length;
      Animated.timing(qAnim, { toValue: -n * Q_ITEM_H, duration: 420, useNativeDriver: true }).start();
      return n;
    }), 5000);
    return () => { if (qTimer.current) clearInterval(qTimer.current); };
  }, []);

  // Bottom sheet
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

  function handleDayPress(_date: Date) { setActiveTab('home'); }

  // Photos for the fanned summary block
  const diaryPhotos = items.flatMap(it => it.media).filter(m => m.localUri).slice(0, 3);
  const displayPhotos = diaryPhotos.length > 0
    ? diaryPhotos.map(m => m.localUri!)
    : PLACEHOLDER_PHOTOS;

  // ──────────────────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: '#18062E' }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Background slideshow (behind everything) — 2-layer alternating, no blink ── */}
      {BG_IMAGES.length > 0 && (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: layerAOp }]}>
            <ExpoImage source={{ uri: layerA }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: layerBOp }]}>
            <ExpoImage source={{ uri: layerB }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
          </Animated.View>
        </View>
      )}

      {/* ── Header (semi-transparent so bg slideshow shows through) ── */}
      <LinearGradient
        colors={['rgba(192,80,230,0.58)', 'rgba(57,144,246,0.48)', 'rgba(30,200,240,0.38)']}
        start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
        style={{ paddingTop: insets.top + 14, paddingHorizontal: 20, paddingBottom: 0 }}>

        {/* Dark overlay for text readability */}
        <View pointerEvents="none" style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(20,5,40,0.35)',
        }} />

        {/* Brand row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: '#FF50C8', fontFamily: FONT_BRAND }}>
              Life Diary
            </Text>
            <Text style={{ fontSize: 12, color: 'rgba(240,200,240,0.88)', letterSpacing: 0.5, marginTop: -2 }}>
              สมุดชีวิต
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/(tabs)/settings' as any)}
            style={{ width: 38, height: 38, borderRadius: 19,
              backgroundColor: '#C090B8',
              justifyContent: 'center', alignItems: 'center',
              shadowColor: '#FF50C8', shadowOpacity: 0.35, shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 }, elevation: 3 }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>ส</Text>
          </Pressable>
        </View>

        {/* Date strip */}
        <Text style={{ fontSize: 14, color: '#fff', textAlign: 'center', marginBottom: 8,
          fontFamily: FONT_BRAND, opacity: 0.92 }}>
          {todayStr}
        </Text>

        {/* ── Mood chip (collapsed / expandable) ── */}
        <View style={{ marginBottom: 2 }}>
          <Pressable
            onPress={() => { setMoodChipOpen(o => !o); setActChipOpen(false); }}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              backgroundColor: 'rgba(235,103,198,0.25)',
              borderRadius: 20, paddingLeft: 4, paddingRight: 8, paddingVertical: 7,
              width: '60%',
            }}>
            <Text style={{ fontSize: 20, lineHeight: 24 }}>{chipMoodEmoji}</Text>
            <Text style={{ flex: 1, fontSize: 13, color: '#fff', fontWeight: '500' }}>{chipMoodLabel}</Text>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>{moodChipOpen ? '∨' : '›'}</Text>
          </Pressable>

          {moodChipOpen && (
            <View style={{ flexDirection: 'row', gap: 6, paddingTop: 6, paddingBottom: 8 }}>
              {PRO_MOODS.map(m => (
                <Pressable key={m.key} onPress={() => selectChipMood(m)}
                  style={{
                    flex: 1, alignItems: 'center', gap: 2,
                    backgroundColor: selectedMood === m.key ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.12)',
                    borderRadius: 14, padding: 6,
                    borderWidth: selectedMood === m.key ? 2 : 0,
                    borderColor: 'rgba(255,255,255,0.5)',
                  }}>
                  <Text style={{ fontSize: 26, lineHeight: 30 }}>{m.emoji}</Text>
                  <Text style={{ fontSize: 9.5, color: '#fff',
                    opacity: selectedMood === m.key ? 1 : 0.8,
                    fontWeight: selectedMood === m.key ? '700' : '500' }}>
                    {m.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* ── Activity chip (collapsed / expandable) ── */}
        <View style={{ paddingBottom: 12 }}>
          <Pressable
            onPress={() => { setActChipOpen(o => !o); setMoodChipOpen(false); }}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              backgroundColor: 'rgba(235,103,198,0.25)',
              borderRadius: 20, paddingLeft: 4, paddingRight: 8, paddingVertical: 7,
              width: '60%',
            }}>
            <Text style={{ fontSize: 18, lineHeight: 22 }}>{chipActEmoji}</Text>
            <Text style={{ flex: 1, fontSize: 13, color: '#fff', fontWeight: '500' }}>{chipActLabel}</Text>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>{actChipOpen ? '∨' : '›'}</Text>
          </Pressable>

          {actChipOpen && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 6 }}>
              {ACTIVITIES.map(a => {
                const isActive = selectedAct === a.key;
                return (
                  <Pressable key={a.key} onPress={() => selectChipAct(a)}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 5,
                      backgroundColor: isActive ? 'rgba(255,255,255,0.92)' : 'rgba(143,201,255,0.22)',
                      borderRadius: 18, paddingHorizontal: 10, paddingVertical: 6,
                      borderWidth: 1.5,
                      borderColor: isActive ? 'rgba(255,89,214,0.36)' : 'transparent',
                    }}>
                    <Text style={{ fontSize: 14 }}>{a.icon}</Text>
                    <Text style={{ fontSize: 12, color: isActive ? C.rose : '#fff',
                      fontWeight: isActive ? '700' : '500' }}>
                      {a.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

      </LinearGradient>

      {/* ── Content ───────────────────────────────────────────────────────────── */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center',
          backgroundColor: 'rgba(24,6,46,0.6)' }}>
          <ActivityIndicator size="large" color={C.rose} />
        </View>
      ) : activeTab === 'calendar' ? (
        <CalendarView items={items} insets={insets} onDayPress={handleDayPress} />
      ) : (
        /* ── Home tab ─────────────────────────────────────────────────────────── */
        <ScrollView
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={() => { setMoodChipOpen(false); setActChipOpen(false); }}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 160 }}>

          {/* ── Daily question ticker ── */}
          <Pressable
            onPress={() => router.push('/diary-write' as any)}
            style={{
              backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 18, marginBottom: 14,
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', overflow: 'hidden',
              borderLeftWidth: 3, borderLeftColor: 'rgba(255,89,214,0.75)',
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, paddingBottom: 8 }}>
              <Text style={{ fontSize: 17, marginRight: 9 }}>💬</Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.75)', flex: 1, letterSpacing: 0.5 }}>
                คำถามประจำวัน
              </Text>
              {/* Shuffle button — แยก Pressable เพื่อไม่ให้ชนกับ outer */}
              <Pressable
                onPress={() => goToQ(qIdx + 1)}
                hitSlop={8}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                  backgroundColor: pressed
                    ? 'rgba(255,120,212,0.35)'
                    : 'rgba(255,120,212,0.18)',
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: 'rgba(255,120,212,0.40)',
                  paddingHorizontal: 10, paddingVertical: 5,
                })}>
                <Text style={{ fontSize: 13 }}>🔀</Text>
                <Text style={{ fontSize: 11, color: '#FF78D4', fontWeight: '700' }}>สุ่มใหม่</Text>
              </Pressable>
            </View>
            <View style={{ height: Q_ITEM_H, overflow: 'hidden' }}>
              <Animated.View style={{ transform: [{ translateY: qAnim }] }}>
                {DAILY_QS.map((q, i) => (
                  <View key={i} style={{ height: Q_ITEM_H, justifyContent: 'center', paddingHorizontal: 14 }}>
                    <Text style={{ fontSize: 16, color: '#a1d5f8', fontFamily: FONT_BRAND,
                      fontStyle: 'italic', fontWeight: '400', lineHeight: 21 }}>
                      {q}
                    </Text>
                  </View>
                ))}
              </Animated.View>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5, paddingVertical: 10 }}>
              {DAILY_QS.map((_, i) => (
                <View key={i} style={{
                  width: i === qIdx ? 14 : 5, height: 5, borderRadius: 3,
                  backgroundColor: i === qIdx ? '#FF78D4' : 'rgba(33, 198, 248, 0.644)',
                }} />
              ))}
            </View>
          </Pressable>

          {/* ── Main CTA ── */}
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <LinearGradient
              colors={['rgba(64, 167, 246, 0.377)', 'rgba(246, 93, 244, 0.301)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ borderRadius: 22, shadowColor: C.rose, shadowOpacity: 0.45, shadowRadius: 16,
                shadowOffset: { width: 0, height: 8 }, elevation: 6 }}>
              <Pressable onPress={() => router.push('/diary-write' as any)}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center',            
                  gap: 10, paddingHorizontal: 28, paddingVertical: 8 }}>
                <Text style={{ fontSize: 20 }}>✏️</Text>
                <Text style={{ color: '#fff', fontSize: 17, fontWeight: '600',
                  fontFamily: FONT_BRAND, letterSpacing: 0.3 }}>
                  เขียนเรื่องราววันนี้.😊💗🎉🎇
                </Text>
              </Pressable>
            </LinearGradient>
          </View>
   {/* ── New Photo summary block (empty OR populated) ── */}


{/* ── Photo summary block: compact clickable summary ── */}
<View
  style={{
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: -40,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    borderRadius: 24,
    overflow: 'visible',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  }}
>
  {/* ซ้าย: รูปภาพ 3 รูป / กดไป Gallery หรือ Write */}
  <Pressable
    onPress={
      items.length > 0
        ? () => router.push('/diary-gallery' as any)
        : () => router.push('/diary-write' as any)
    }
    style={{
      width: 80,
      height: 70,
      position: 'relative',
      marginRight: 20,
      marginLeft: 4,
    }}
  >
    {displayPhotos.slice(0, 3).map((uri, i) => {
      const rotates = ['-14deg', '-6deg', '4deg'];
      const lefts = [5, 25, 55];
      const tops = [12, 10, 14];
      const zs = [1, 2, 3];

      return (
        <ExpoImage
          key={i}
          source={{ uri }}
          style={{
            position: 'absolute',
            width: 42,
            height: 48,
            borderRadius: 10,
            borderWidth: 2,
            borderColor: '#69b3f8',

            left: lefts[i],
            top: tops[i],
            zIndex: zs[i],

            transform: [{ rotate: rotates[i] }],

            shadowColor: '#000',
            shadowOpacity: 0.22,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
          }}
          contentFit="cover"
        />
      );
    })}
  </Pressable>

  {/* ขวา: ข้อความ + ปุ่มในตัวเดียวกัน */}
  <View
    style={{
      flex: 1,
      marginLeft: 10,
      alignItems: 'flex-start',
      justifyContent: 'center',
    }}
  >
    {items.length === 0 ? (
      <Pressable
        onPress={() => router.push('/diary-write' as any)}
        style={{
          alignSelf: 'flex-start',
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderRadius: 16,
          backgroundColor: 'rgba(255,255,255,0.14)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.18)',
        }}
      >
        <Text
          style={{
            fontSize: 14,
            fontWeight: '800',
            color: '#fff',
            fontFamily: FONT_BRAND,
            textAlign: 'left',
            marginBottom: 4,
            textShadowColor: 'rgba(0,0,0,0.5)',
            textShadowRadius: 8,
          }}
        >
          ยังไม่มีบันทึกของวันนี้
        </Text>

        <Text
          style={{
            fontSize: 12,
            color: 'rgba(255,255,255,0.78)',
            textAlign: 'left',
            lineHeight: 18,
          }}
        >
          แตะเพื่อเริ่มเขียนไดอารี่
        </Text>
      </Pressable>
    ) : (
      <Pressable
        onPress={() => router.push('/diary-timeline' as any)}
        style={({ pressed }) => ({
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',

          paddingVertical: 11,
          paddingHorizontal: 16,
          borderRadius: 999,

          backgroundColor: pressed
            ? 'rgba(50,210,247,0.42)'
            : 'rgba(50,210,247,0.28)',

          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.20)',

          transform: [{ scale: pressed ? 0.98 : 1 }],
        })}
      >
        <Text
          style={{
            fontSize: 14,
            fontWeight: '800',
            color: '#fff',
            fontFamily: FONT_BRAND,
            textAlign: 'left',
            textShadowColor: 'rgba(0,0,0,0.45)',
            textShadowRadius: 8,
          }}
        >
          Diary-ของฉัน {items.length} Diary
        </Text>

        <Text
          style={{
            marginLeft: 8,
            fontSize: 18,
            fontWeight: '900',
            color: '#fff',
            opacity: 0.9,
          }}
        >
          ›
        </Text>
      </Pressable>
    )}
  </View>
</View>


        </ScrollView>
      )}

      {/* ── Footer bottom nav ── */}
      <View style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        paddingBottom: insets.bottom,
        backgroundColor: 'rgba(14,4,30,0.82)',
        borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)',
        flexDirection: 'row',
      }}>
        {([
          { ico: '🏠', lbl: 'หน้าแรก', onPress: () => setActiveTab('home'),    isActive: activeTab === 'home' },
          { ico: '📅', lbl: 'ไทม์ไลน์', onPress: () => router.push('/diary-timeline' as any), isActive: false },
          { ico: '➕', lbl: 'เพิ่ม',     onPress: () => router.push('/diary-write' as any),    isActive: false, isCenter: true },
          { ico: '🔍', lbl: 'ค้นหา',    onPress: () => router.push('/diary-search' as any),   isActive: false },
          { ico: '📸', lbl: 'แกลอรี่',  onPress: () => router.push('/diary-gallery' as any),  isActive: false },
        ] as { ico: string; lbl: string; onPress: () => void; isActive: boolean; isCenter?: boolean }[]).map((t, i) => (
          <Pressable key={i} onPress={t.onPress}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center',
              paddingVertical: t.isCenter ? 6 : 8 }}>
            {t.isCenter ? (
              <View style={{ width: 46, height: 46, borderRadius: 23,
                backgroundColor: C.rose, justifyContent: 'center', alignItems: 'center',
                shadowColor: C.rose, shadowOpacity: 0.6, shadowRadius: 12,
                shadowOffset: { width: 0, height: 4 }, elevation: 6,
                marginBottom: 0 }}>
                <Text style={{ fontSize: 22 }}>{t.ico}</Text>
              </View>
            ) : (
              <>
                <Text style={{ fontSize: 20, lineHeight: 24, marginBottom: 2 }}>{t.ico}</Text>
                <Text style={{ fontSize: 9.5, fontWeight: t.isActive ? '700' : '500',
                  color: t.isActive ? '#FF78D4' : 'rgba(255,255,255,0.55)',
                  letterSpacing: 0.2 }}>
                  {t.lbl}
                </Text>
              </>
            )}
          </Pressable>
        ))}
      </View>

      {/* ── Bottom Sheet ──────────────────────────────────────────────────────── */}
      <Modal visible={sheetOpen} transparent animationType="none" onRequestClose={closeSheet}>
        <TouchableWithoutFeedback onPress={closeSheet}>
          <Animated.View style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(61,53,72,0.48)', opacity: backdropOp,
          }} />
        </TouchableWithoutFeedback>

        <Animated.View style={{
          position: 'absolute', left: 0, right: 0, bottom: keyboardH,
          backgroundColor: C.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28,
          transform: [{ translateY: sheetY }], overflow: 'hidden',
        }}>
          <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.line }} />
          </View>

          {sheetMode === 'choose' ? (
            <View style={{ padding: 20, paddingBottom: insets.bottom + 20 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: C.ink,
                fontFamily: FONT_BRAND, marginBottom: 4, textAlign: 'center' }}>
                วันนี้จะบันทึกแบบไหน?
              </Text>
              <Text style={{ fontSize: 12, color: C.inkSoft, textAlign: 'center', marginBottom: 16 }}>
                เลือกวิธีที่ง่ายที่สุดสำหรับวันนี้
              </Text>

              {[
                { icon: '✏️', bg: C.roseTint, title: 'เขียนบันทึก',
                  sub: 'เล่าเรื่อง พิมพ์ — ครบทุกอย่าง',
                  onPress: () => { closeSheet(); router.push('/diary-write' as any); } },
                { icon: '📷', bg: C.sageTint, title: 'บันทึกด้วยรูปภาพ',
                  sub: 'เลือกรูปก่อน แล้วค่อยเขียน',
                  onPress: () => { closeSheet(); router.push('/diary-write' as any); } },
                { icon: '⚡', bg: C.goldTint, title: 'บันทึกสั้นๆ วันนี้',
                  sub: 'สำหรับวันที่ขี้เกียจ — เลือก mood + เขียน 1–2 บรรทัด',
                  onPress: () => setSheetMode('feel') },
              ].map((opt, idx) => (
                <Pressable key={idx} onPress={opt.onPress}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 13,
                    backgroundColor: '#fff', borderRadius: 18, padding: 15,
                    marginBottom: idx < 2 ? 8 : 0, borderWidth: 1.5, borderColor: C.line }}>
                  <View style={{ width: 48, height: 48, borderRadius: 16,
                    backgroundColor: opt.bg, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ fontSize: 22 }}>{opt.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: C.ink }}>{opt.title}</Text>
                    <Text style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 2, lineHeight: 17 }}>{opt.sub}</Text>
                  </View>
                  <Text style={{ color: C.inkFaint, fontSize: 18 }}>›</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            /* ── Quick feel form ── */
            <View style={{ padding: 20, paddingBottom: insets.bottom + 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <Pressable onPress={() => setSheetMode('choose')} style={{ marginRight: 10 }}>
                  <Text style={{ color: C.inkSoft, fontSize: 14 }}>‹ กลับ</Text>
                </Pressable>
                <Text style={{ fontSize: 15, fontWeight: '800', color: C.ink, fontFamily: FONT_BRAND, flex: 1 }}>
                  วันนี้รู้สึกยังไง?
                </Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                {PRO_MOODS.map(m => (
                  <Pressable key={m.key} onPress={() => setQuickMood(m.key)}
                    style={{ flex: 1, alignItems: 'center', gap: 4,
                      paddingVertical: 9, borderRadius: 14,
                      backgroundColor: quickMood === m.key ? '#fff' : C.paperDeep,
                      borderWidth: 1.5, borderColor: quickMood === m.key ? C.rose : C.line }}>
                    <Text style={{ fontSize: 22 }}>{m.emoji}</Text>
                    <Text style={{ fontSize: 9, color: quickMood === m.key ? C.rose : C.inkSoft,
                      fontWeight: quickMood === m.key ? '700' : '500' }}>
                      {m.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <TextInput
                placeholder="เขียนสั้นๆ ก็ได้... 1–2 บรรทัด ก็พอ"
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
                  fontSize: 14, color: C.ink, minHeight: 80, textAlignVertical: 'top',
                  fontFamily: FONT_BRAND,
                }}
              />

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <Pressable onPress={closeSheet}
                  style={{ flex: 1, paddingVertical: 13, borderRadius: 16,
                    backgroundColor: C.paperDeep, alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: C.inkSoft }}>ยกเลิก</Text>
                </Pressable>
                <Pressable onPress={saveQuickFeel}
                  style={{ flex: 2, paddingVertical: 13, borderRadius: 16,
                    backgroundColor: quickNote.trim() ? C.rose : C.line, alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, fontWeight: '800',
                    color: quickNote.trim() ? '#fff' : C.inkFaint }}>
                    ⚡ บันทึกเลย
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
