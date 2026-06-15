import { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Image, Alert } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { diaryService } from '@/services/diaryService';
import type { DiaryEntry, DiaryMedia, DiaryExpense } from '@/db/schema';
import { formatCurrency } from '@/lib/format';
import { useSnackbar } from '@/components/ui/SnackbarProvider';
import { useDiaryTier } from '@/features/life-diary/hooks/useDiaryTier';
import ProEntryDetailScreen from '@/features/life-diary/screens/ProEntryDetailScreen';

// ── Emotion Theme System ──────────────────────────────────────────────────────
interface MoodTheme {
  gradients: string[];
  cardBg: string;
  accentColor: string;
  textAccent: string;
  quote: string;
}

const MOOD_THEMES: Record<string, MoodTheme> = {
  '😊': {
    gradients: ['#D97706', '#F59E0B', '#FDE68A'],
    cardBg: '#FFFBEB',
    accentColor: '#F59E0B',
    textAccent: '#92400E',
    quote: 'วันนี้เป็นวันที่หัวใจยิ้มได้ ✨',
  },
  '🥰': {
    gradients: ['#BE185D', '#EC4899', '#F9A8D4'],
    cardBg: '#FDF2F8',
    accentColor: '#EC4899',
    textAccent: '#9D174D',
    quote: 'บางความทรงจำก็อบอุ่นกว่าที่คิด 💕',
  },
  '😆': {
    gradients: ['#C2410C', '#F97316', '#FDBA74'],
    cardBg: '#FFF7ED',
    accentColor: '#F97316',
    textAccent: '#7C2D12',
    quote: 'วันนี้มีเสียงหัวเราะเก็บไว้เต็มกระเป๋า 🎉',
  },
  '😌': {
    gradients: ['#047857', '#059669', '#6EE7B7'],
    cardBg: '#F0FDF4',
    accentColor: '#059669',
    textAccent: '#064E3B',
    quote: 'วันนี้ใจได้พักสักนิด 🌿',
  },
  '🤩': {
    gradients: ['#5B21B6', '#7C3AED', '#C4B5FD'],
    cardBg: '#F5F3FF',
    accentColor: '#7C3AED',
    textAccent: '#4C1D95',
    quote: 'วันนี้เต็มไปด้วยพลังงานและความตื่นเต้น ⚡',
  },
  '😴': {
    gradients: ['#3730A3', '#4F46E5', '#A5B4FC'],
    cardBg: '#EEF2FF',
    accentColor: '#4F46E5',
    textAccent: '#312E81',
    quote: 'วันนี้เหนื่อยได้ พรุ่งนี้ค่อยเริ่มใหม่ 🌙',
  },
  '😢': {
    gradients: ['#1D4ED8', '#3B82F6', '#93C5FD'],
    cardBg: '#EFF6FF',
    accentColor: '#3B82F6',
    textAccent: '#1E3A5F',
    quote: 'บางวันไม่ต้องเข้มแข็งตลอดเวลาก็ได้ 🌧',
  },
  '😤': {
    gradients: ['#B91C1C', '#EF4444', '#FCA5A5'],
    cardBg: '#FEF2F2',
    accentColor: '#EF4444',
    textAccent: '#7F1D1D',
    quote: 'ปล่อยวางได้เลย วันนี้ทำดีที่สุดแล้ว 💪',
  },
  '🥺': {
    gradients: ['#6D28D9', '#8B5CF6', '#DDD6FE'],
    cardBg: '#F5F3FF',
    accentColor: '#8B5CF6',
    textAccent: '#4C1D95',
    quote: 'ทุกความรู้สึกล้วนมีคุณค่า 🌸',
  },
  '😮': {
    gradients: ['#0F766E', '#14B8A6', '#99F6E4'],
    cardBg: '#F0FDFA',
    accentColor: '#14B8A6',
    textAccent: '#134E4A',
    quote: 'ชีวิตมักพลิกแพลงในแบบที่คาดไม่ถึง ⚡',
  },
};

const DEFAULT_THEME: MoodTheme = {
  gradients: ['#5B21B6', '#7C3AED', '#9333EA'],
  cardBg: '#F5F3FF',
  accentColor: '#7C3AED',
  textAccent: '#4C1D95',
  quote: '',
};

const MOOD_LABELS: Record<string, string> = {
  '😊': 'มีความสุข', '🥰': 'รัก/อบอุ่น', '😆': 'สนุก/ฮา',
  '😌': 'สงบ/ผ่อนคลาย', '🤩': 'ตื่นเต้น', '😴': 'ง่วง/พักผ่อน',
  '😢': 'เศร้า', '😤': 'เหนื่อย/หงุดหงิด', '🥺': 'อ่อนใจ', '😮': 'ประหลาดใจ',
};

interface EntryDetail {
  entry: DiaryEntry;
  media: DiaryMedia[];
  expenses: DiaryExpense[];
  totalExpenses: number;
}

export default function DiaryEntryScreen() {
  const tier = useDiaryTier();
  if (tier === 'pro' || tier === 'premium') return <ProEntryDetailScreen />;
  return <FreeDiaryEntryDetail />;
}

function FreeDiaryEntryDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const { entryId, fromSave } = useLocalSearchParams<{ entryId: string; fromSave?: string }>();
  const [data, setData] = useState<EntryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSaveBanner, setShowSaveBanner] = useState(fromSave === '1');

  useEffect(() => {
    if (showSaveBanner) {
      const t = setTimeout(() => setShowSaveBanner(false), 4000);
      return () => clearTimeout(t);
    }
  }, [showSaveBanner]);

  const load = useCallback(async () => {
    if (!entryId) return;
    const result = await diaryService.getEntryWithRelations(entryId);
    setData(result ?? null);
    setLoading(false);
  }, [entryId]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  function handleDelete() {
    Alert.alert('ลบความทรงจำ', 'ต้องการลบบันทึกนี้? ไม่สามารถกู้คืนได้', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ลบ', style: 'destructive', onPress: async () => {
          if (!entryId) return;
          await diaryService.deleteEntry(entryId);
          showSnackbar({ message: 'ลบบันทึกแล้ว', variant: 'info' });
          router.back();
        },
      },
    ]);
  }

  if (loading || !data) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FBF7FF' }}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  const { entry, media, expenses, totalExpenses } = data;
  const theme: MoodTheme = entry.mood ? (MOOD_THEMES[entry.mood] ?? DEFAULT_THEME) : DEFAULT_THEME;
  const entryDateObj = new Date(entry.entryDate as unknown as number);
  const dateLabel = entryDateObj.toLocaleDateString('th-TH', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <View style={{ flex: 1, backgroundColor: theme.cardBg }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Themed Header */}
      <LinearGradient colors={theme.gradients as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 8, paddingBottom: 16, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => router.back()} style={{ padding: 6, marginRight: 8 }}>
            <Text style={{ fontSize: 20, color: '#fff' }}>←</Text>
          </Pressable>
          <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: '#fff' }} numberOfLines={1}>
            {entry.title ?? '📖 ความทรงจำ'}
          </Text>
          <Pressable onPress={() => router.push({ pathname: '/diary-write' as any, params: { entryId } })}
            style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>✏️ แก้</Text>
          </Pressable>
          <View style={{ width: 8 }} />
          <Pressable onPress={handleDelete}
            style={{ backgroundColor: 'rgba(239,68,68,0.25)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
            <Text style={{ color: '#FCA5A5', fontSize: 13, fontWeight: '700' }}>🗑</Text>
          </Pressable>
        </View>
      </LinearGradient>

      {/* Save Success Banner */}
      {showSaveBanner && (
        <View style={{ backgroundColor: '#065F46', paddingVertical: 12, paddingHorizontal: 20,
          flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ fontSize: 18 }}>💙</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>บันทึกไดอารี่สำเร็จแล้ว!</Text>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 1 }}>
              ความทรงจำนี้ถูกเก็บไว้ในสมุดชีวิตแล้วครับ
            </Text>
          </View>
          <Pressable onPress={() => setShowSaveBanner(false)}>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 18 }}>✕</Text>
          </Pressable>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>

        {/* Date + Mood row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <View style={{ backgroundColor: theme.accentColor + '20', borderRadius: 10,
            paddingHorizontal: 10, paddingVertical: 5 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: theme.textAccent }}>
              📅 {dateLabel}
            </Text>
          </View>
          {entry.mood && (
            <View style={{ backgroundColor: theme.accentColor + '15', borderRadius: 10,
              paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 16 }}>{entry.mood}</Text>
              <Text style={{ fontSize: 11, color: theme.textAccent, fontWeight: '600' }}>
                {MOOD_LABELS[entry.mood] ?? ''}
              </Text>
            </View>
          )}
        </View>

        {/* Content card — themed */}
        <View style={{ backgroundColor: '#fff', borderRadius: 18, padding: 18, marginBottom: 14,
          borderLeftWidth: 4, borderLeftColor: theme.accentColor,
          elevation: 1, shadowColor: theme.accentColor, shadowOpacity: 0.12, shadowRadius: 8 }}>
          {entry.title ? (
            <Text style={{ fontSize: 19, fontWeight: '800', color: '#1E1B4B', marginBottom: 10, lineHeight: 28 }}>
              {entry.title}
            </Text>
          ) : null}
          <Text style={{ fontSize: 15, color: '#333', lineHeight: 26 }}>{entry.content}</Text>
          {entry.locationName ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 4,
              paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.accentColor + '20' }}>
              <Text style={{ fontSize: 13, color: '#9CA3AF' }}>📍 {entry.locationName}</Text>
            </View>
          ) : null}
        </View>

        {/* Mood quote — themed */}
        {entry.mood && theme.quote ? (
          <View style={{ backgroundColor: theme.accentColor + '12', borderRadius: 14, padding: 14,
            marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 22 }}>{entry.mood}</Text>
            <Text style={{ flex: 1, fontSize: 13, color: theme.textAccent, fontStyle: 'italic', lineHeight: 20 }}>
              {theme.quote}
            </Text>
          </View>
        ) : null}

        {/* Photos */}
        {media.length > 0 && (
          <View style={{ marginBottom: 14 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textAccent, marginBottom: 10 }}>
              🖼 รูปภาพ ({media.length})
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {media.map((m) => (
                <Image key={m.id} source={{ uri: m.localUri }}
                  style={{ width: 160, height: 160, borderRadius: 14,
                    backgroundColor: theme.accentColor + '20' }} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Expenses — themed */}
        {expenses.length > 0 && (
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 14,
            elevation: 1, shadowColor: theme.accentColor, shadowOpacity: 0.08, shadowRadius: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textAccent, marginBottom: 12 }}>
              💰 ค่าใช้จ่าย
            </Text>
            {expenses.map((exp, idx) => (
              <View key={exp.id} style={{ flexDirection: 'row', justifyContent: 'space-between',
                alignItems: 'center', paddingVertical: 8,
                borderBottomWidth: idx < expenses.length - 1 ? 1 : 0,
                borderBottomColor: theme.accentColor + '15' }}>
                <Text style={{ fontSize: 14, color: '#333', flex: 1 }}>{exp.itemName}</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: theme.accentColor }}>
                    {formatCurrency(exp.amount)}฿
                  </Text>
                  {exp.transactionId && (
                    <Text style={{ fontSize: 10, color: '#10B981' }}>บันทึกรายจ่ายแล้ว ✓</Text>
                  )}
                </View>
              </View>
            ))}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 10,
              borderTopWidth: 2, borderTopColor: theme.accentColor + '30' }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: theme.textAccent }}>รวม</Text>
              <Text style={{ fontSize: 17, fontWeight: '900', color: theme.accentColor }}>
                {formatCurrency(totalExpenses)}฿
              </Text>
            </View>
          </View>
        )}

        {/* New entry shortcut */}
        <Pressable onPress={() => router.push('/diary-write' as any)}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            backgroundColor: theme.accentColor + '15', borderRadius: 14,
            paddingVertical: 14, marginTop: 8 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: theme.textAccent }}>
            ✍️ บันทึกความทรงจำใหม่
          </Text>
        </Pressable>

      </ScrollView>
    </View>
  );
}
