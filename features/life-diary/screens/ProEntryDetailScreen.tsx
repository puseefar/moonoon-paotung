import { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, ActivityIndicator,
  Image, Alert, Modal, Dimensions, StyleSheet, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { diaryService } from '@/services/diaryService';
import type { DiaryEntry, DiaryMedia, DiaryExpense } from '@/db/schema';
import { formatCurrency } from '@/lib/format';
import { useSnackbar } from '@/components/ui/SnackbarProvider';

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  paper:    '#FBF8F3',
  ink:      '#3D3548',
  inkSoft:  '#7A7186',
  inkFaint: '#A9A1B3',
  line:     '#E7DFD3',
  gold:     '#CC9A3A',
  rose:     '#D14F86',
};

// Handwriting-feel font (Mali not yet installed → Georgia/serif)
const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

// ─────────────────────────────────────────────────────────────────────────────
// Pro 5-mood system
// ─────────────────────────────────────────────────────────────────────────────
type MoodKey = 'great' | 'good' | 'ok' | 'tired' | 'bad';

interface ProMood {
  key: MoodKey;
  label: string;
  dot: string;
  gradA: string;
  gradB: string;
  quote: string;
}

const PRO_MOODS: Record<MoodKey, ProMood> = {
  great: { key: 'great', label: 'ดีมาก',   dot: '#E9C46A', gradA: '#F0DBA0', gradB: '#F6E9C6',
    quote: 'วันที่หัวใจยิ้มได้เต็มๆ ✨' },
  good:  { key: 'good',  label: 'ดี',       dot: '#A8C3A0', gradA: '#C8DCC2', gradB: '#E1ECDC',
    quote: 'บางความทรงจำก็อบอุ่นกว่าที่คิด 🌿' },
  ok:    { key: 'ok',    label: 'เฉยๆ',    dot: '#AFC5D8', gradA: '#C7D8E4', gradB: '#E2ECF1',
    quote: 'วันนี้ใจได้พักสักนิด ☁️' },
  tired: { key: 'tired', label: 'เหนื่อย', dot: '#B9A8C9', gradA: '#D6CBE2', gradB: '#E8E0F0',
    quote: 'วันที่เหนื่อยก็มีคุณค่าเหมือนกัน 💜' },
  bad:   { key: 'bad',   label: 'แย่',      dot: '#C9A0A8', gradA: '#E0C7CC', gradB: '#EFDDE0',
    quote: 'ปล่อยวางได้เลย พรุ่งนี้ค่อยเริ่มใหม่ 🌧' },
};

const EMOJI_TO_MOOD: Record<string, MoodKey> = {
  '🤩': 'great', '😆': 'great', '🥰': 'great',
  '😊': 'good',
  '😌': 'ok', '😮': 'ok', '😴': 'ok',
  '😤': 'tired', '🥺': 'tired',
  '😢': 'bad',
};

function getMood(emoji: string | null | undefined): ProMood {
  const key = emoji ? EMOJI_TO_MOOD[emoji] : undefined;
  return key ? PRO_MOODS[key] : PRO_MOODS.ok;
}

// ─────────────────────────────────────────────────────────────────────────────
// Photo collage — adapts to 1 / 2 / 3+ images
// ─────────────────────────────────────────────────────────────────────────────
const SCREEN_W = Dimensions.get('window').width;
const COLLAGE_H = 190;
const GAP = 4;

function PhotoCollage({
  media,
  onPress,
}: {
  media: DiaryMedia[];
  onPress: (index: number) => void;
}) {
  if (media.length === 0) return null;

  if (media.length === 1) {
    return (
      <Pressable onPress={() => onPress(0)} style={{ borderRadius: 14, overflow: 'hidden' }}>
        <Image source={{ uri: media[0].localUri }}
          style={{ width: '100%', height: COLLAGE_H, backgroundColor: C.line }}
          resizeMode="cover"
        />
      </Pressable>
    );
  }

  if (media.length === 2) {
    return (
      <View style={{ flexDirection: 'row', gap: GAP }}>
        {media.map((m, i) => (
          <Pressable key={m.id} style={{ flex: 1, borderRadius: 14, overflow: 'hidden' }}
            onPress={() => onPress(i)}>
            <Image source={{ uri: m.localUri }}
              style={{ height: COLLAGE_H, backgroundColor: C.line }}
              resizeMode="cover"
            />
          </Pressable>
        ))}
      </View>
    );
  }

  // 3+ : big left (60%), two smaller right (40%), last cell shows "+N"
  const extra = media.length - 3;

  return (
    <View style={{ flexDirection: 'row', gap: GAP, height: COLLAGE_H }}>
      <Pressable style={{ flex: 6, borderRadius: 14, overflow: 'hidden' }}
        onPress={() => onPress(0)}>
        <Image source={{ uri: media[0].localUri }}
          style={styles.collageFill} resizeMode="cover" />
      </Pressable>
      <View style={{ flex: 4, gap: GAP }}>
        <Pressable style={{ flex: 1, borderRadius: 14, overflow: 'hidden' }}
          onPress={() => onPress(1)}>
          <Image source={{ uri: media[1].localUri }}
            style={styles.collageFill} resizeMode="cover" />
        </Pressable>
        <Pressable style={{ flex: 1, borderRadius: 14, overflow: 'hidden' }}
          onPress={() => onPress(2)}>
          <View style={{ flex: 1 }}>
            <Image source={{ uri: media[2].localUri }}
              style={styles.collageFill} resizeMode="cover" />
            {extra > 0 && (
              <View style={styles.extraOverlay}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18 }}>+{extra}</Text>
              </View>
            )}
          </View>
        </Pressable>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Photo Modal — full-screen lightbox
// ─────────────────────────────────────────────────────────────────────────────
function PhotoModal({
  visible,
  media,
  initialIndex,
  onClose,
}: {
  visible: boolean;
  media: DiaryMedia[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(initialIndex);
  // sync when modal opens with a different initial index
  const prevVisibleRef = useRef(false);
  if (visible && !prevVisibleRef.current) setIdx(initialIndex);
  prevVisibleRef.current = visible;

  const insets = useSafeAreaInsets();
  const current = media[idx];

  return (
    <Modal visible={visible} transparent={false} animationType="fade"
      onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#130F1E', justifyContent: 'center' }}>
        {/* Close */}
        <Pressable onPress={onClose}
          style={{ position: 'absolute', top: insets.top + 12, right: 16, zIndex: 10,
            width: 38, height: 38, borderRadius: 19,
            backgroundColor: 'rgba(255,255,255,0.15)',
            justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>✕</Text>
        </Pressable>

        {/* Photo */}
        {current && (
          <Image source={{ uri: current.localUri }}
            style={{ width: SCREEN_W, height: SCREEN_W, alignSelf: 'center' }}
            resizeMode="contain"
          />
        )}

        {/* Caption */}
        {current?.caption ? (
          <Text style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center',
            fontSize: 13, marginTop: 12, paddingHorizontal: 24 }}>
            {current.caption}
          </Text>
        ) : null}

        {/* Counter */}
        {media.length > 1 && (
          <Text style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center',
            fontSize: 12, fontWeight: '700', marginTop: 8 }}>
            {idx + 1} / {media.length}
          </Text>
        )}

        {/* Dot indicators */}
        {media.length > 1 && (
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12 }}>
            {media.map((_, i) => (
              <Pressable key={i} onPress={() => setIdx(i)}>
                <View style={{
                  width: i === idx ? 18 : 6, height: 6, borderRadius: 3,
                  backgroundColor: i === idx ? '#fff' : 'rgba(255,255,255,0.3)',
                }} />
              </Pressable>
            ))}
          </View>
        )}

        {/* Prev / Next */}
        {media.length > 1 && (
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16,
            marginTop: 20, marginBottom: insets.bottom + 16 }}>
            <Pressable
              disabled={idx === 0}
              onPress={() => setIdx(p => p - 1)}
              style={{ width: 48, height: 48, borderRadius: 24,
                backgroundColor: idx === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.18)',
                justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 22, fontWeight: '300' }}>‹</Text>
            </Pressable>
            <Pressable
              disabled={idx === media.length - 1}
              onPress={() => setIdx(p => p + 1)}
              style={{ width: 48, height: 48, borderRadius: 24,
                backgroundColor: idx === media.length - 1 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.18)',
                justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 22, fontWeight: '300' }}>›</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────
interface EntryDetail {
  entry: DiaryEntry;
  media: DiaryMedia[];
  expenses: DiaryExpense[];
  totalExpenses: number;
}

export default function ProEntryDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const { entryId, fromSave } = useLocalSearchParams<{ entryId: string; fromSave?: string }>();

  const [data, setData] = useState<EntryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveBanner, setSaveBanner] = useState(fromSave === '1');
  const [photoModal, setPhotoModal] = useState<{ visible: boolean; index: number }>({
    visible: false, index: 0,
  });

  const load = useCallback(async () => {
    if (!entryId) return;
    const result = await diaryService.getEntryWithRelations(entryId);
    setData(result ?? null);
    setLoading(false);
  }, [entryId]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  function openPhoto(index: number) {
    setPhotoModal({ visible: true, index });
  }

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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center',
        backgroundColor: C.paper }}>
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

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Mood-tinted Header ─────────────────────────────────────────────── */}
      <LinearGradient
        colors={[mood.gradA, mood.gradB]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 8, paddingBottom: 14, paddingHorizontal: 16 }}>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {/* Back */}
          <Pressable onPress={() => router.back()}
            style={{ width: 36, height: 36, borderRadius: 18,
              backgroundColor: 'rgba(61,53,72,0.10)',
              justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontSize: 18, color: C.ink }}>←</Text>
          </Pressable>

          {/* Date */}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink }} numberOfLines={1}>
              {dateLabel}
            </Text>
            <Text style={{ fontSize: 11, color: C.inkSoft, marginTop: 1 }}>
              ความทรงจำ · {timeLabel} น.
            </Text>
          </View>

          {/* Actions */}
          <Pressable onPress={handleEdit}
            style={{ width: 34, height: 34, borderRadius: 17,
              backgroundColor: 'rgba(61,53,72,0.10)',
              justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontSize: 15 }}>✏️</Text>
          </Pressable>
          <Pressable onPress={handleDelete}
            style={{ width: 34, height: 34, borderRadius: 17,
              backgroundColor: 'rgba(209,79,134,0.12)',
              justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontSize: 15 }}>🗑</Text>
          </Pressable>
        </View>

        {/* Mood row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <View style={{ width: 12, height: 12, borderRadius: 6,
            backgroundColor: mood.dot }} />
          <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink }}>
            {mood.label}
          </Text>
          {entry.mood && (
            <Text style={{ fontSize: 17 }}>{entry.mood}</Text>
          )}
        </View>
      </LinearGradient>

      {/* ── Save success banner ─────────────────────────────────────────────── */}
      {saveBanner && (
        <Pressable onPress={() => setSaveBanner(false)}
          style={{ backgroundColor: '#3D3548', paddingVertical: 10,
            paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ fontSize: 16 }}>💙</Text>
          <Text style={{ flex: 1, color: '#fff', fontSize: 13, fontWeight: '700' }}>
            บันทึกไดอารี่สำเร็จแล้ว ✓
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16 }}>✕</Text>
        </Pressable>
      )}

      {/* ── Scroll body ─────────────────────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: 14, paddingBottom: insets.bottom + 40,
        }}>

        {/* ── Canvas card ───────────────────────────────────────────────────── */}
        <View style={styles.canvasCard}>
          {/* Mood accent bar */}
          <LinearGradient
            colors={[mood.gradA, mood.dot, mood.gradB]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ height: 4 }}
          />

          {/* Canvas body with faint notebook lines */}
          <View style={styles.canvasBody}>

            {/* Meta: time + location */}
            <View style={{ flexDirection: 'row', alignItems: 'center',
              gap: 8, marginBottom: 12 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: C.inkFaint }}>
                {timeLabel} น.
              </Text>
              {entry.locationName && (
                <>
                  <View style={{ width: 3, height: 3, borderRadius: 1.5,
                    backgroundColor: C.line }} />
                  <Text style={{ fontSize: 11, color: C.inkFaint, flex: 1 }} numberOfLines={1}>
                    📍 {entry.locationName}
                  </Text>
                </>
              )}
            </View>

            {/* Title */}
            {entry.title ? (
              <Text style={[styles.canvasTitle, { fontFamily: SERIF }]}>
                {entry.title}
              </Text>
            ) : null}

            {/* Content */}
            <Text style={styles.canvasText}>{entry.content}</Text>

            {/* Divider */}
            {media.length > 0 && (
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={{ fontSize: 14, color: C.inkFaint, marginHorizontal: 6 }}>🌸</Text>
                <View style={styles.dividerLine} />
              </View>
            )}

            {/* Photos */}
            {media.length > 0 && (
              <View style={{ marginBottom: 14 }}>
                <Text style={styles.sectionLabel}>
                  🖼️ รูปภาพ ({media.length})
                </Text>
                <PhotoCollage media={media} onPress={openPhoto} />
              </View>
            )}

            {/* Reflection quote */}
            <View style={[styles.reflectionBox,
              { borderLeftColor: mood.dot,
                backgroundColor: mood.gradB + 'CC' }]}>
              <Text style={styles.reflectionLabel}>บางความทรงจำ</Text>
              <Text style={[styles.reflectionText, { fontFamily: SERIF }]}>
                "{mood.quote}"
              </Text>
            </View>

          </View>
        </View>

        {/* ── Expense card ──────────────────────────────────────────────────── */}
        {expenses.length > 0 && (
          <View style={styles.expenseCard}>
            <View style={styles.expenseHeader}>
              <Text style={{ fontSize: 16 }}>💰</Text>
              <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: C.ink,
                marginLeft: 8 }}>
                ค่าใช้จ่าย
              </Text>
              <Text style={{ fontSize: 16, fontWeight: '900', color: C.gold }}>
                {formatCurrency(totalExpenses)}฿
              </Text>
            </View>

            {expenses.map((exp, idx) => (
              <View key={exp.id} style={[styles.expenseRow,
                { borderBottomWidth: idx < expenses.length - 1 ? 1 : 0 }]}>
                <Text style={{ flex: 1, fontSize: 13, color: C.ink }}>
                  {exp.itemName}
                </Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: C.gold }}>
                    {formatCurrency(exp.amount)}฿
                  </Text>
                  {exp.transactionId && (
                    <Text style={{ fontSize: 10, color: '#10B981', marginTop: 1 }}>
                      บันทึกรายจ่ายแล้ว ✓
                    </Text>
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
          </View>
        )}

        {/* ── Bottom CTA ────────────────────────────────────────────────────── */}
        <Pressable
          onPress={() => router.push('/diary-write' as any)}
          style={styles.newEntryBtn}>
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
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Canvas card
  canvasCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#3D3548',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  canvasBody: {
    padding: 18,
    // Very faint notebook lines — renders as repeating gradient
    // Not supported in RN StyleSheet, kept as plain white for performance
    backgroundColor: '#FFFFFF',
  },
  canvasTitle: {
    fontSize: 20,
    fontWeight: '700',
    fontStyle: 'italic',
    color: '#3D3548',
    lineHeight: 28,
    marginBottom: 10,
  },
  canvasText: {
    fontSize: 14,
    color: '#7A7186',
    lineHeight: 26,
    marginBottom: 16,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E7DFD3',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#A9A1B3',
    marginBottom: 8,
  },
  reflectionBox: {
    borderRadius: 14,
    padding: 14,
    borderLeftWidth: 3,
    marginTop: 4,
  },
  reflectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#A9A1B3',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  reflectionText: {
    fontSize: 13,
    fontStyle: 'italic',
    color: '#7A7186',
    lineHeight: 22,
  },

  // Photo collage
  collageFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#E7DFD3',
  },
  extraOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(61,53,72,0.58)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Expense card
  expenseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#3D3548',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  expenseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E7DFD3',
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomColor: '#E7DFD3',
  },
  expenseTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    paddingTop: 10,
  },

  // New entry button
  newEntryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E7DFD3',
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 4,
  },
});
