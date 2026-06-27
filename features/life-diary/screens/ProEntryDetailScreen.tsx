/**
 * ProEntryDetailScreen — Life Diary entry detail (Pro tier)
 * All-New UI: Santorini-style light-blue bg, title block, horizontal photo carousel,
 * expandable content, collapsible expenses, share sheet.
 */
import { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, ActivityIndicator,
  Image, Alert, Modal, Dimensions, StyleSheet, Platform,
  FlatList,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { diaryService } from '@/services/diaryService';
import type { DiaryEntry, DiaryMedia, DiaryExpense } from '@/db/schema';
import { formatCurrency } from '@/lib/format';
import { useSnackbar } from '@/components/ui/SnackbarProvider';

// ── Design tokens (Santorini light-blue) ─────────────────────────────────────
const C = {
  bg:       '#fafdff',
  surface:  '#FFFFFF',
  ink:      '#1A1630',
  inkSoft:  '#6B6585',
  inkFaint: '#AFAABB',
  line:     '#EDEAF5',
  rose:     '#D14F86',
  roseTint: '#FBEAF1',
  sage:     '#4FAD86',
  sageTint: '#E6F7F0',
  gold:     '#CC9A3A',
  goldTint: '#FBF3E2',
  blue:     '#3D8EF0',
  blueTint: '#EDF4FE',
} as const;

const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });
const SCREEN_W = Dimensions.get('window').width;

// ── Pro mood system ───────────────────────────────────────────────────────────
type MoodKey = 'great' | 'good' | 'ok' | 'tired' | 'bad';
interface ProMood {
  key: MoodKey; label: string; dot: string; gradA: string; gradB: string; emoji: string; quote: string;
}
const PRO_MOODS: Record<MoodKey, ProMood> = {
  great: { key: 'great', label: 'ดีมาก',   dot: '#E9C46A', gradA: '#F0DBA0', gradB: '#F6E9C6', emoji: '🤩',
    quote: 'วันที่หัวใจยิ้มได้เต็มๆ ✨' },
  good:  { key: 'good',  label: 'ดี',       dot: '#A8C3A0', gradA: '#C8DCC2', gradB: '#E1ECDC', emoji: '😊',
    quote: 'บางความทรงจำก็อบอุ่นกว่าที่คิด 🌿' },
  ok:    { key: 'ok',    label: 'เฉยๆ',    dot: '#AFC5D8', gradA: '#C7D8E4', gradB: '#E2ECF1', emoji: '😌',
    quote: 'วันนี้ใจได้พักสักนิด ☁️' },
  tired: { key: 'tired', label: 'เหนื่อย', dot: '#B9A8C9', gradA: '#D6CBE2', gradB: '#E8E0F0', emoji: '😤',
    quote: 'วันที่เหนื่อยก็มีคุณค่าเหมือนกัน 💜' },
  bad:   { key: 'bad',   label: 'แย่',      dot: '#C9A0A8', gradA: '#E0C7CC', gradB: '#EFDDE0', emoji: '😢',
    quote: 'ปล่อยวางได้เลย พรุ่งนี้ค่อยเริ่มใหม่ 🌧' },
};
const EMOJI_TO_MOOD: Record<string, MoodKey> = {
  '🤩': 'great', '😆': 'great', '🥰': 'great', '😄': 'great',
  '😊': 'good',
  '😌': 'ok', '😮': 'ok', '😴': 'ok', '😐': 'ok',
  '😤': 'tired', '🥺': 'tired', '😔': 'tired',
  '😢': 'bad', '😞': 'bad',
};
function getMood(emoji: string | null | undefined): ProMood {
  const key = emoji ? EMOJI_TO_MOOD[emoji] : undefined;
  return key ? PRO_MOODS[key] : PRO_MOODS.ok;
}

// ── Photo Modal — full-screen lightbox ───────────────────────────────────────
function PhotoModal({ visible, media, initialIndex, onClose }:
  { visible: boolean; media: DiaryMedia[]; initialIndex: number; onClose: () => void }) {
  const [idx, setIdx] = useState(initialIndex);
  const prevRef = useRef(false);
  if (visible && !prevRef.current) setIdx(initialIndex);
  prevRef.current = visible;
  const insets = useSafeAreaInsets();
  const current = media[idx];

  return (
    <Modal visible={visible} transparent={false} animationType="fade"
      onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#130F1E', justifyContent: 'center' }}>
        <Pressable onPress={onClose}
          style={{ position: 'absolute', top: insets.top + 12, right: 16, zIndex: 10,
            width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)',
            justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>✕</Text>
        </Pressable>
        {current && (
          <Image source={{ uri: current.localUri }}
            style={{ width: SCREEN_W, height: SCREEN_W * 1.35, alignSelf: 'center' }}
            resizeMode="contain"
          />
        )}
        {media.length > 1 && (
          <>
            <Text style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center',
              fontSize: 12, fontWeight: '700', marginTop: 8 }}>
              {idx + 1} / {media.length}
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 }}>
              {media.map((_, i) => (
                <Pressable key={i} onPress={() => setIdx(i)}>
                  <View style={{ width: i === idx ? 18 : 6, height: 6, borderRadius: 3,
                    backgroundColor: i === idx ? '#fff' : 'rgba(255,255,255,0.3)' }} />
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16,
              marginTop: 20, marginBottom: insets.bottom + 16 }}>
              <Pressable disabled={idx === 0} onPress={() => setIdx(p => p - 1)}
                style={{ width: 48, height: 48, borderRadius: 24,
                  backgroundColor: idx === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.18)',
                  justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 22, fontWeight: '300' }}>‹</Text>
              </Pressable>
              <Pressable disabled={idx === media.length - 1} onPress={() => setIdx(p => p + 1)}
                style={{ width: 48, height: 48, borderRadius: 24,
                  backgroundColor: idx === media.length - 1 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.18)',
                  justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 22, fontWeight: '300' }}>›</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

// ── Share Sheet ───────────────────────────────────────────────────────────────
function ShareSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(26,22,48,0.45)' }} onPress={onClose} />
      <View style={{ backgroundColor: C.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
        paddingHorizontal: 24, paddingTop: 20, paddingBottom: insets.bottom + 20 }}>
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.line,
          alignSelf: 'center', marginBottom: 20 }} />
        <Text style={{ fontSize: 16, fontWeight: '700', color: C.ink, marginBottom: 16 }}>
          แชร์บันทึก
        </Text>
        {[
          { icon: '📋', label: 'คัดลอกลิงก์', color: C.inkSoft },
          { icon: '📱', label: 'LINE', color: '#06C755' },
          { icon: '💬', label: 'Facebook', color: '#1877F2' },
          { icon: '📸', label: 'บันทึกเป็นรูปภาพ', color: C.rose },
        ].map((opt, i) => (
          <Pressable key={i} onPress={onClose}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 14,
              backgroundColor: C.bg, borderRadius: 16, padding: 14, marginBottom: 8 }}>
            <View style={{ width: 42, height: 42, borderRadius: 12,
              backgroundColor: C.surface, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 22 }}>{opt.icon}</Text>
            </View>
            <Text style={{ fontSize: 15, fontWeight: '600', color: opt.color, flex: 1 }}>{opt.label}</Text>
            <Text style={{ fontSize: 16, color: C.inkFaint }}>›</Text>
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

// ── EntryDetail type ──────────────────────────────────────────────────────────
interface EntryDetail {
  entry: DiaryEntry;
  media: DiaryMedia[];
  expenses: DiaryExpense[];
  totalExpenses: number;
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ProEntryDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const { entryId, fromSave } = useLocalSearchParams<{ entryId: string; fromSave?: string }>();

  const [data, setData] = useState<EntryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveBanner, setSaveBanner] = useState(fromSave === '1');
  const [contentExpanded, setContentExpanded] = useState(false);
  const [expenseExpanded, setExpenseExpanded] = useState(false);
  const [photoModal, setPhotoModal] = useState({ visible: false, index: 0 });
  const [shareVisible, setShareVisible] = useState(false);
  const [photoDot, setPhotoDot] = useState(0);
  const photoScrollRef = useRef<FlatList<DiaryMedia>>(null);

  const load = useCallback(async () => {
    if (!entryId) return;
    const result = await diaryService.getEntryWithRelations(entryId);
    setData(result ?? null);
    setLoading(false);
  }, [entryId]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  function handleEdit() {
    router.push({ pathname: '/diary-write' as any, params: { entryId } });
  }

  function handleDelete() {
    Alert.alert('ลบความทรงจำ', 'ต้องการลบบันทึกนี้?\nไม่สามารถกู้คืนได้', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ลบ', style: 'destructive',
        onPress: async () => {
          if (!entryId) return;
          await diaryService.deleteEntry(entryId);
          showSnackbar({ message: 'ลบบันทึกแล้ว', variant: 'info' });
          router.back();
        },
      },
    ]);
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading || !data) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={C.rose} />
      </View>
    );
  }

  const { entry, media, expenses, totalExpenses } = data;
  const mood = getMood(entry.mood);

  const entryDateObj = new Date(entry.entryDate as unknown as number);
  const dateLabel = entryDateObj.toLocaleDateString('th-TH', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const timeLabel = entryDateObj.toLocaleTimeString('th-TH', {
    hour: '2-digit', minute: '2-digit',
  });

  const CONTENT_PREVIEW_LEN = 200;
  const isContentLong = entry.content.length > CONTENT_PREVIEW_LEN;
  const displayContent = (isContentLong && !contentExpanded)
    ? entry.content.slice(0, CONTENT_PREVIEW_LEN) + '…'
    : entry.content;

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Minimal header ────────────────────────────────────────────────── */}
      <View style={{
        paddingTop: insets.top + 10, paddingBottom: 10, paddingHorizontal: 20,
        backgroundColor: C.bg, flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* Back */}
        <Pressable onPress={() => router.back()}
          style={styles.headIconBtn}>
          <Text style={{ fontSize: 18, color: C.ink }}>‹</Text>
        </Pressable>

        {/* Date */}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.rose }} />
            <Text style={{ fontSize: 11.5, fontWeight: '600', color: C.inkSoft }}>
              {entryDateObj.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
              {' · '}{timeLabel} น.
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable onPress={() => setShareVisible(true)} style={styles.headIconBtn}>
            <Text style={{ fontSize: 17 }}>⤴</Text>
          </Pressable>
          <Pressable onPress={handleEdit} style={styles.headIconBtn}>
            <Text style={{ fontSize: 16 }}>✏️</Text>
          </Pressable>
          <Pressable onPress={handleDelete}
            style={[styles.headIconBtn, { backgroundColor: C.roseTint }]}>
            <Text style={{ fontSize: 15 }}>🗑</Text>
          </Pressable>
        </View>
      </View>

      {/* ── Save success banner ─────────────────────────────────────────────── */}
      {saveBanner && (
        <Pressable onPress={() => setSaveBanner(false)}
          style={{ backgroundColor: '#1A1630', paddingVertical: 10,
            paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ fontSize: 16 }}>💙</Text>
          <Text style={{ flex: 1, color: '#fff', fontSize: 13, fontWeight: '700' }}>
            บันทึกไดอารี่สำเร็จแล้ว ✓
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16 }}>✕</Text>
        </Pressable>
      )}

      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>

        {/* ── Title block ───────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 22, paddingTop: 4, paddingBottom: 14 }}>
          {entry.title ? (
            <Text style={[styles.entryTitle, { fontFamily: SERIF }]}>
              {entry.title}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8,
            marginTop: entry.title ? 10 : 0, flexWrap: 'wrap' }}>
            <Text style={{ fontSize: 12, color: C.inkSoft, fontWeight: '500' }}>{dateLabel}</Text>
            {/* Mood badge */}
            <View style={styles.moodBadge}>
              <Text style={{ fontSize: 18, lineHeight: 22 }}>{mood.emoji}</Text>
              <Text style={{ fontSize: 12.5, fontWeight: '600', color: C.ink }}>{mood.label}</Text>
            </View>
            {/* Location */}
            {entry.locationName ? (
              <View style={[styles.moodBadge, { backgroundColor: C.blueTint }]}>
                <Text style={{ fontSize: 13 }}>📍</Text>
                <Text style={{ fontSize: 11.5, fontWeight: '600', color: C.blue }} numberOfLines={1}>
                  {entry.locationName}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── Photos ────────────────────────────────────────────────────────── */}
        {media.length > 0 && (
          <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
            {media.length === 1 ? (
              /* Single photo — tall 9:16 */
              <Pressable onPress={() => setPhotoModal({ visible: true, index: 0 })}
                style={styles.photoSingle}>
                <Image source={{ uri: media[0].localUri }}
                  style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                <View style={styles.photoOverlay} />
              </Pressable>
            ) : (
              /* Multiple photos — horizontal scroll + dot indicators */
              <>
                <FlatList
                  ref={photoScrollRef}
                  data={media}
                  horizontal
                  pagingEnabled={false}
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={m => m.id}
                  ItemSeparatorComponent={() => <View style={{ width: 10 }} />}
                  contentContainerStyle={{ paddingRight: 0 }}
                  onScroll={e => {
                    const x = e.nativeEvent.contentOffset.x;
                    const cardW = 200 + 10;
                    setPhotoDot(Math.round(x / cardW));
                  }}
                  scrollEventThrottle={16}
                  renderItem={({ item: m, index: i }) => (
                    <Pressable onPress={() => setPhotoModal({ visible: true, index: i })}
                      style={styles.photoCard}>
                      <Image source={{ uri: m.localUri }}
                        style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                      <View style={styles.photoOverlay} />
                    </Pressable>
                  )}
                />
                {/* Dot indicators */}
                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 10 }}>
                  {media.map((_, i) => (
                    <View key={i} style={{
                      width: i === photoDot ? 18 : 5, height: 5, borderRadius: 3,
                      backgroundColor: i === photoDot ? C.rose : C.line,
                    }} />
                  ))}
                </View>
              </>
            )}
          </View>
        )}

        {/* ── Content card ──────────────────────────────────────────────────── */}
        <View style={[styles.sectionCard, { marginHorizontal: 20 }]}>
          <View style={{ padding: 16 }}>
            <Text style={styles.contentText}>{displayContent}</Text>
            {isContentLong && (
              <Pressable onPress={() => setContentExpanded(e => !e)}
                style={{ marginTop: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: C.rose }}>
                  {contentExpanded ? 'ย่อลง ▲' : 'ดูเพิ่มเติม ▼'}
                </Text>
              </Pressable>
            )}
          </View>

          {/* Reflection quote */}
          <View style={[styles.reflectionBox, { borderLeftColor: mood.dot, backgroundColor: mood.gradB + 'BB' }]}>
            <Text style={styles.reflectionLabel}>บางความทรงจำ</Text>
            <Text style={[styles.reflectionText, { fontFamily: SERIF }]}>"{mood.quote}"</Text>
          </View>
        </View>

        {/* ── Expense card (collapsible) ────────────────────────────────────── */}
        {expenses.length > 0 && (
          <View style={[styles.sectionCard, { marginHorizontal: 20, marginTop: 12 }]}>
            <Pressable
              onPress={() => setExpenseExpanded(e => !e)}
              style={styles.expenseHeader}>
              <Text style={{ fontSize: 16 }}>💰</Text>
              <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: C.ink, marginLeft: 8 }}>
                ค่าใช้จ่าย
              </Text>
              <Text style={{ fontSize: 16, fontWeight: '900', color: C.gold, marginRight: 8 }}>
                {formatCurrency(totalExpenses)}฿
              </Text>
              <Text style={{ fontSize: 14, color: C.inkFaint }}>{expenseExpanded ? '▲' : '▼'}</Text>
            </Pressable>

            {expenseExpanded && (
              <>
                {expenses.map((exp, idx) => (
                  <View key={exp.id} style={[styles.expenseRow,
                    { borderBottomWidth: idx < expenses.length - 1 ? 1 : 0 }]}>
                    <Text style={{ flex: 1, fontSize: 13, color: C.ink }}>{exp.itemName}</Text>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: C.gold }}>
                        {formatCurrency(exp.amount)}฿
                      </Text>
                      {exp.transactionId && (
                        <Text style={{ fontSize: 10, color: '#10B981', marginTop: 1 }}>บันทึกรายจ่ายแล้ว ✓</Text>
                      )}
                    </View>
                  </View>
                ))}
                <View style={styles.expenseTotal}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: C.inkSoft }}>รวม</Text>
                  <Text style={{ fontSize: 16, fontWeight: '900', color: C.gold }}>
                    {formatCurrency(totalExpenses)}฿
                  </Text>
                </View>
              </>
            )}
          </View>
        )}

        {/* ── Bottom CTA ────────────────────────────────────────────────────── */}
        <Pressable onPress={() => router.push('/diary-write' as any)}
          style={[styles.newEntryBtn, { marginHorizontal: 20, marginTop: 14 }]}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: C.rose }}>
            ✏️ บันทึกความทรงจำใหม่
          </Text>
        </Pressable>

      </ScrollView>

      {/* ── Photo Modal ───────────────────────────────────────────────────────── */}
      <PhotoModal
        visible={photoModal.visible}
        media={media}
        initialIndex={photoModal.index}
        onClose={() => setPhotoModal(p => ({ ...p, visible: false }))}
      />

      {/* ── Share Sheet ──────────────────────────────────────────────────────── */}
      <ShareSheet visible={shareVisible} onClose={() => setShareVisible(false)} />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  headIconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#1A1630', shadowOpacity: 0.10, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },

  // Title block
  entryTitle: {
    fontSize: 26, fontWeight: '700', lineHeight: 34,
    color: '#1A1630', letterSpacing: -0.3,
  },
  moodBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#FFFFFF', borderRadius: 20,
    paddingHorizontal: 11, paddingVertical: 4,
    shadowColor: '#1A1630', shadowOpacity: 0.08, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },

  // Photos
  photoSingle: {
    width: '100%', aspectRatio: 9 / 16, maxHeight: 380,
    borderRadius: 18, overflow: 'hidden',
    shadowColor: '#1A1630', shadowOpacity: 0.16, shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  photoCard: {
    width: 200, aspectRatio: 9 / 16, maxHeight: 340,
    borderRadius: 18, overflow: 'hidden',
    shadowColor: '#1A1630', shadowOpacity: 0.14, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  photoOverlay: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: '40%',
    backgroundColor: 'rgba(26,22,48,0.25)',
  },

  // Section card
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18, overflow: 'hidden',
    shadowColor: '#1A1630', shadowOpacity: 0.08,
    shadowRadius: 12, shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  // Content
  contentText: {
    fontSize: 14.5, color: '#1A1630', lineHeight: 26,
  },
  reflectionBox: {
    padding: 14, borderLeftWidth: 3, marginHorizontal: 16, marginBottom: 16,
    borderRadius: 12,
  },
  reflectionLabel: {
    fontSize: 10, fontWeight: '800', color: '#AFAABB',
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6,
  },
  reflectionText: {
    fontSize: 13, fontStyle: 'italic', color: '#6B6585', lineHeight: 22,
  },

  // Expense
  expenseHeader: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderBottomWidth: 0, borderBottomColor: '#EDEAF5',
  },
  expenseRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 14,
    borderBottomColor: '#EDEAF5',
  },
  expenseTotal: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#EDEAF5',
  },

  // New entry button
  newEntryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#EDEAF5',
    borderRadius: 16, paddingVertical: 14,
    shadowColor: '#1A1630', shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
});
