import { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  ActivityIndicator, Modal, Platform, KeyboardAvoidingView,
  Alert, Image, Keyboard, StyleSheet,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { diaryService } from '@/services/diaryService';
import type { DiaryExpense } from '@/db/schema';
import { categoryService } from '@/services/categoryService';
import { useWalletStore } from '@/stores/useWalletStore';
import { formatCurrency } from '@/lib/format';
import { useSnackbar } from '@/components/ui/SnackbarProvider';
import type { Category } from '@/db/schema';

// ── Design tokens ──────────────────────────────────────────────────────────────
const C = {
  paper: '#FBF8F3',
  ink: '#3D3548',
  inkSoft: '#7A7186',
  inkFaint: '#A9A1B3',
  line: '#E7DFD3',
  rose: '#D14F86',
  roseTint: '#FBEAF1',
  gold: '#CC9A3A',
  goldTint: '#FAF1DC',
  sage: '#7E9E7C',
  sageTint: '#EAF0E7',
};

const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

// ── Pro moods ──────────────────────────────────────────────────────────────────
type MoodKey = 'great' | 'good' | 'ok' | 'tired' | 'bad';
interface ProMood {
  key: MoodKey; label: string; dot: string;
  gradA: string; gradB: string; emoji: string;
  saveText: string;
}
const PRO_MOODS: Record<MoodKey, ProMood> = {
  great: { key: 'great', label: 'ดีมาก', dot: '#E9C46A', gradA: '#F0DBA0', gradB: '#F6E9C6', emoji: '🤩', saveText: 'เก็บวันที่หัวใจยิ้มไว้ ✨' },
  good:  { key: 'good',  label: 'ดี',     dot: '#A8C3A0', gradA: '#C8DCC2', gradB: '#E1ECDC', emoji: '😊', saveText: 'บันทึกความอบอุ่นนี้ 🌿' },
  ok:    { key: 'ok',    label: 'เฉยๆ',   dot: '#AFC5D8', gradA: '#C7D8E4', gradB: '#E2ECF1', emoji: '😌', saveText: 'บันทึกช่วงเวลาพักสงบ ☁️' },
  tired: { key: 'tired', label: 'เหนื่อย', dot: '#B9A8C9', gradA: '#D6CBE2', gradB: '#E8E0F0', emoji: '😤', saveText: 'วันที่เหนื่อยก็มีคุณค่า 💜' },
  bad:   { key: 'bad',   label: 'แย่',    dot: '#C9A0A8', gradA: '#E0C7CC', gradB: '#EFDDE0', emoji: '😢', saveText: 'ปล่อยวางแล้วเริ่มใหม่ 🌧' },
};
const MOOD_KEYS = Object.keys(PRO_MOODS) as MoodKey[];

// Map legacy emoji moods → Pro mood key for editing existing entries
const EMOJI_TO_MOOD: Record<string, MoodKey> = {
  '🤩': 'great', '😆': 'great', '🥰': 'great',
  '😊': 'good',
  '😌': 'ok', '😮': 'ok', '😴': 'ok',
  '😤': 'tired', '🥺': 'tired',
  '😢': 'bad',
};

// ── Activity chips ─────────────────────────────────────────────────────────────
const ACTIVITIES = [
  { id: 'family', label: 'ครอบครัว', icon: '🏠' },
  { id: 'friends', label: 'เพื่อน', icon: '👥' },
  { id: 'work', label: 'งาน', icon: '💼' },
  { id: 'study', label: 'เรียน', icon: '📚' },
  { id: 'exercise', label: 'ออกกำลัง', icon: '🏃' },
  { id: 'food', label: 'อาหาร', icon: '🍜' },
  { id: 'travel', label: 'เดินทาง', icon: '✈️' },
  { id: 'shopping', label: 'ช้อปปิ้ง', icon: '🛍️' },
  { id: 'movie', label: 'หนัง/ซีรีส์', icon: '🎬' },
  { id: 'music', label: 'ดนตรี', icon: '🎵' },
  { id: 'nature', label: 'ธรรมชาติ', icon: '🌿' },
  { id: 'alone', label: 'เวลาส่วนตัว', icon: '🌙' },
];

export default function ProDiaryWriteScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const { entryId } = useLocalSearchParams<{ entryId?: string }>();
  const isEditing = !!entryId;
  const { wallets, loadWallets } = useWalletStore();

  // Entry fields
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedMood, setSelectedMood] = useState<MoodKey | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [location, setLocation] = useState('');
  const [entryDate] = useState(new Date());

  // Photos
  const [localPhotos, setLocalPhotos] = useState<{ id: string; uri: string; isNew: boolean; mediaId?: string }[]>([]);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);

  // GPS
  const [fetchingLocation, setFetchingLocation] = useState(false);

  // Expenses
  const [expenses, setExpenses] = useState<{
    id: string; itemName: string; amount: string;
    createTransaction: boolean; categoryId?: string; existing?: DiaryExpense;
  }[]>([]);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expItemName, setExpItemName] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expCreateTx, setExpCreateTx] = useState(false);
  const [expCategories, setExpCategories] = useState<Category[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEditing);

  const totalExpenses = useMemo(
    () => expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0),
    [expenses],
  );
  const isReady = useMemo(() => !!content.trim(), [content]);

  const activeMood = selectedMood ? PRO_MOODS[selectedMood] : null;
  const headerGradA = activeMood?.gradA ?? '#E8E0F0';
  const headerGradB = activeMood?.gradB ?? '#F3EEE5';

  const load = useCallback(async () => {
    const [cats] = await Promise.all([categoryService.getByType('expense'), loadWallets()]);
    setExpCategories(cats);
    if (wallets.length > 0) setSelectedWalletId(wallets[0].id);

    if (isEditing && entryId) {
      const result = await diaryService.getEntryWithRelations(entryId);
      if (result) {
        const { entry, media, expenses: exps } = result;
        setTitle(entry.title ?? '');
        setContent(entry.content);
        // Map emoji mood to Pro mood
        if (entry.mood) {
          const mk = EMOJI_TO_MOOD[entry.mood] ?? (MOOD_KEYS.includes(entry.mood as MoodKey) ? entry.mood as MoodKey : null);
          setSelectedMood(mk);
        }
        setLocation(entry.locationName ?? '');
        setLocalPhotos(media.map(m => ({ id: m.id, uri: m.localUri, isNew: false, mediaId: m.id })));
        setExpenses(exps.map(e => ({
          id: e.id, itemName: e.itemName, amount: String(e.amount),
          createTransaction: !!e.transactionId, existing: e,
        })));
      }
    }
    setLoading(false);
  }, [entryId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ── Photo handlers ─────────────────────────────────────────────────────────
  async function pickFromGallery() {
    setShowPhotoPicker(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('ขออนุญาต', 'กรุณาอนุญาตการเข้าถึงคลังรูปภาพในการตั้งค่า');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], quality: 0.8,
      allowsMultipleSelection: true, selectionLimit: 10,
    });
    if (!result.canceled && result.assets.length > 0) {
      const newPhotos = result.assets.map(asset => ({
        id: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        uri: asset.uri, isNew: true,
      }));
      setLocalPhotos(prev => [...prev, ...newPhotos]);
    }
  }

  async function takePhoto() {
    setShowPhotoPicker(false);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('ขออนุญาต', 'กรุณาอนุญาตการเข้าถึงกล้องในการตั้งค่า');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      setLocalPhotos(prev => [...prev, { id: `new-${Date.now()}`, uri: result.assets[0].uri, isNew: true }]);
    }
  }

  function removePhoto(id: string) {
    setLocalPhotos(prev => prev.filter(p => p.id !== id));
  }

  // ── GPS ────────────────────────────────────────────────────────────────────
  async function fetchGPSLocation() {
    setFetchingLocation(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Location = require('expo-location');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('ขออนุญาต', 'กรุณาอนุญาตการเข้าถึงตำแหน่งในการตั้งค่า');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const geo = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      if (geo[0]) {
        const parts = [geo[0].name, geo[0].street, geo[0].subregion, geo[0].city].filter(Boolean);
        setLocation(parts.join(', ') || `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
      }
    } catch {
      showSnackbar({ message: 'GPS ยังไม่พร้อม — ต้อง rebuild แอปก่อนครั้งแรก', variant: 'warning' });
    } finally {
      setFetchingLocation(false);
    }
  }

  // ── Expense handlers ───────────────────────────────────────────────────────
  function addExpenseToList() {
    if (!expItemName.trim()) return;
    const amount = parseFloat(expAmount);
    if (!amount || amount <= 0) {
      Alert.alert('ระบุยอดเงิน', 'กรุณาใส่จำนวนเงินที่ถูกต้อง');
      return;
    }
    setExpenses(prev => [...prev, {
      id: `new-${Date.now()}`, itemName: expItemName.trim(),
      amount: String(amount), createTransaction: expCreateTx,
    }]);
    setExpItemName(''); setExpAmount(''); setExpCreateTx(false);
    setShowExpenseForm(false);
  }

  function removeExpense(id: string) {
    setExpenses(prev => prev.filter(e => e.id !== id));
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!content.trim()) {
      showSnackbar({ message: 'กรุณาเล่าเรื่องราวสักนิด', variant: 'warning' });
      return;
    }
    Keyboard.dismiss();
    setSaving(true);
    try {
      // Store Pro mood key as the mood string (compatible with EMOJI_TO_MOOD on read)
      const moodToSave = selectedMood ? PRO_MOODS[selectedMood].emoji : undefined;
      let eid = entryId;
      if (!isEditing) {
        eid = await diaryService.createEntry({
          title: title.trim() || undefined,
          content: content.trim(),
          mood: moodToSave,
          entryDate,
          locationName: location.trim() || undefined,
        });
      } else if (eid) {
        await diaryService.updateEntry(eid, {
          title: title.trim() || null,
          content: content.trim(),
          mood: moodToSave ?? null,
          entryDate,
          locationName: location.trim() || null,
        });
      }
      if (!eid) throw new Error('No entry id');

      for (const p of localPhotos) {
        if (p.isNew) await diaryService.addMedia(eid, p.uri);
      }
      for (const exp of expenses) {
        if (!exp.existing) {
          await diaryService.addExpense(eid, {
            itemName: exp.itemName, amount: parseFloat(exp.amount),
            categoryId: exp.categoryId,
            createTransaction: exp.createTransaction,
            walletId: exp.createTransaction ? (selectedWalletId ?? undefined) : undefined,
          });
        }
      }
      if (isEditing) {
        showSnackbar({ message: '✏️ แก้ไขความทรงจำแล้ว', variant: 'success' });
        router.back();
      } else {
        router.replace({ pathname: '/diary-entry' as any, params: { entryId: eid, fromSave: '1' } });
      }
    } catch {
      showSnackbar({ message: 'บันทึกไม่สำเร็จ', variant: 'error' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.paper }}>
        <ActivityIndicator size="large" color={C.rose} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Mood-tinted Header ──────────────────────────────────────────────── */}
      <LinearGradient
        colors={[headerGradA, headerGradB]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 8, paddingBottom: 16, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => router.back()} style={{ padding: 6, marginRight: 8 }}>
            <Text style={{ fontSize: 20, color: C.ink }}>←</Text>
          </Pressable>
          <Text style={{ fontSize: 17, fontWeight: '800', color: C.ink, flex: 1, fontFamily: SERIF }}>
            {isEditing ? 'แก้ไขความทรงจำ' : 'บันทึกวันนี้'}
          </Text>
          <Pressable onPress={handleSave} disabled={saving}
            style={{
              backgroundColor: saving ? 'rgba(61,53,72,0.1)' : C.rose,
              borderRadius: 14, paddingHorizontal: 16, paddingVertical: 8,
            }}>
            {saving
              ? <ActivityIndicator color={C.rose} size="small" />
              : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>บันทึก ✓</Text>}
          </Pressable>
        </View>

        {/* Date badge */}
        <View style={{ flexDirection: 'row', marginTop: 10 }}>
          <View style={{ backgroundColor: 'rgba(61,53,72,0.08)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: C.inkSoft }}>
              📅 {entryDate.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'long' })}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 200 }}>

          {/* ── Mood picker ─────────────────────────────────────────────────── */}
          <Text style={s.sectionLabel}>ความรู้สึกวันนี้</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {MOOD_KEYS.map(mk => {
              const m = PRO_MOODS[mk];
              const active = selectedMood === mk;
              return (
                <Pressable key={mk}
                  onPress={() => setSelectedMood(active ? null : mk)}
                  style={{
                    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 16,
                    backgroundColor: active ? m.gradA : '#fff',
                    borderWidth: 1.5,
                    borderColor: active ? m.dot : C.line,
                  }}>
                  <View style={{
                    width: 22, height: 22, borderRadius: 11,
                    backgroundColor: m.dot,
                    shadowColor: m.dot, shadowOpacity: 0.5,
                    shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
                    elevation: active ? 4 : 0,
                    marginBottom: 5,
                  }} />
                  <Text style={{ fontSize: 10, fontWeight: active ? '700' : '500', color: C.inkSoft }}>
                    {m.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* ── Activity chips ───────────────────────────────────────────────── */}
          <Text style={s.sectionLabel}>กิจกรรมวันนี้</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, marginBottom: 20 }}
            keyboardShouldPersistTaps="handled">
            {ACTIVITIES.map(act => {
              const active = selectedActivity === act.id;
              return (
                <Pressable key={act.id}
                  onPress={() => setSelectedActivity(active ? null : act.id)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 5,
                    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
                    backgroundColor: active ? C.roseTint : '#fff',
                    borderWidth: 1.5, borderColor: active ? C.rose : C.line,
                  }}>
                  <Text style={{ fontSize: 14 }}>{act.icon}</Text>
                  <Text style={{ fontSize: 12, fontWeight: active ? '700' : '500', color: active ? C.rose : C.inkSoft }}>
                    {act.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* ── Canvas card ─────────────────────────────────────────────────── */}
          <View style={s.canvas}>
            {/* Mood accent bar */}
            {selectedMood && (
              <View style={{
                height: 4, borderRadius: 2, marginBottom: 14,
                backgroundColor: PRO_MOODS[selectedMood].dot,
              }} />
            )}

            {/* Title */}
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="ตั้งชื่อให้วันนี้..."
              placeholderTextColor={C.inkFaint}
              returnKeyType="next"
              style={{
                fontSize: 18, fontWeight: '700', color: C.ink,
                fontFamily: SERIF, marginBottom: 10,
                borderBottomWidth: 1, borderBottomColor: C.line,
                paddingBottom: 8,
              }}
            />

            {/* Content — notebook-lined area */}
            <View style={s.notebookLines}>
              <TextInput
                value={content}
                onChangeText={setContent}
                placeholder="เล่าเรื่องราวของวันนี้..."
                placeholderTextColor={C.inkFaint}
                multiline
                numberOfLines={8}
                textAlignVertical="top"
                style={{
                  fontSize: 15, color: C.ink, lineHeight: 26,
                  minHeight: 180, fontFamily: SERIF,
                }}
              />
            </View>
          </View>

          {/* ── Location ────────────────────────────────────────────────────── */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 }}>
            <View style={{
              flex: 1, flexDirection: 'row', alignItems: 'center',
              backgroundColor: '#fff', borderRadius: 14,
              paddingHorizontal: 12, borderWidth: 1.5, borderColor: C.line,
            }}>
              <Text style={{ fontSize: 16, marginRight: 6 }}>📍</Text>
              <TextInput
                value={location}
                onChangeText={setLocation}
                placeholder="วันนี้เกิดขึ้นที่ไหน?"
                placeholderTextColor={C.inkFaint}
                style={{ flex: 1, paddingVertical: 10, fontSize: 14, color: C.ink }}
              />
            </View>
            <Pressable onPress={fetchGPSLocation} disabled={fetchingLocation}
              style={{
                backgroundColor: fetchingLocation ? C.line : C.rose,
                borderRadius: 14, paddingHorizontal: 10, paddingVertical: 10,
                alignItems: 'center', justifyContent: 'center', minWidth: 44,
              }}>
              {fetchingLocation
                ? <ActivityIndicator size="small" color={C.rose} />
                : <Text style={{ fontSize: 16 }}>🛰️</Text>}
            </Pressable>
          </View>

          {/* ── Photos strip ────────────────────────────────────────────────── */}
          <View style={{ marginBottom: 16 }}>
            <Text style={s.sectionLabel}>ภาพความทรงจำ {localPhotos.length > 0 ? `(${localPhotos.length})` : ''}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10 }}
              keyboardShouldPersistTaps="handled">
              {localPhotos.map(p => (
                <View key={p.id} style={{ position: 'relative' }}>
                  <Image source={{ uri: p.uri }}
                    style={{ width: 90, height: 90, borderRadius: 14, backgroundColor: C.line }} />
                  <Pressable onPress={() => removePhoto(p.id)}
                    style={{
                      position: 'absolute', top: -6, right: -6,
                      width: 22, height: 22, borderRadius: 11,
                      backgroundColor: C.rose,
                      justifyContent: 'center', alignItems: 'center',
                    }}>
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>✕</Text>
                  </Pressable>
                </View>
              ))}
              <Pressable onPress={() => setShowPhotoPicker(true)}
                style={{
                  width: 90, height: 90, borderRadius: 14, backgroundColor: '#fff',
                  borderWidth: 1.5, borderColor: C.line, borderStyle: 'dashed',
                  justifyContent: 'center', alignItems: 'center',
                }}>
                <Text style={{ fontSize: 24 }}>📷</Text>
                <Text style={{ fontSize: 10, color: C.inkFaint, marginTop: 2 }}>เพิ่มรูป</Text>
              </Pressable>
            </ScrollView>
          </View>

          {/* ── Expenses ────────────────────────────────────────────────────── */}
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={s.sectionLabel}>
                ค่าใช้จ่าย{expenses.length > 0 ? ` · รวม ${formatCurrency(totalExpenses)}฿` : ''}
              </Text>
              <Pressable onPress={() => setShowExpenseForm(true)}
                style={{ backgroundColor: C.goldTint, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ fontSize: 12, color: C.gold, fontWeight: '700' }}>+ เพิ่ม</Text>
              </Pressable>
            </View>
            {expenses.map(exp => (
              <View key={exp.id} style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: '#fff', borderRadius: 12, padding: 10, marginBottom: 6,
                borderWidth: 1, borderColor: C.line,
              }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink }}>{exp.itemName}</Text>
                  <Text style={{ fontSize: 12, color: C.gold }}>
                    {formatCurrency(parseFloat(exp.amount))}฿
                    {exp.createTransaction ? ' · บันทึกรายจ่ายด้วย ✓' : ''}
                  </Text>
                </View>
                <Pressable onPress={() => removeExpense(exp.id)} style={{ padding: 6 }}>
                  <Text style={{ fontSize: 14, color: C.inkFaint }}>✕</Text>
                </Pressable>
              </View>
            ))}
          </View>

          {/* ── Save button (new entry) ──────────────────────────────────────── */}
          {!isEditing && (
            <Pressable onPress={handleSave} disabled={saving || !isReady}
              style={{
                marginTop: 8, borderRadius: 20, paddingVertical: 16,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: isReady ? C.rose : C.line,
              }}>
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ fontSize: 15, fontWeight: '800', color: isReady ? '#fff' : C.inkFaint }}>
                    {isReady
                      ? (activeMood?.saveText ?? 'บันทึกความทรงจำนี้ 💙')
                      : 'เล่าเรื่องราวสักนิด...'}
                  </Text>}
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Photo picker sheet ─────────────────────────────────────────────── */}
      <Modal visible={showPhotoPicker} animationType="slide" transparent>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
          onPress={() => setShowPhotoPicker(false)} />
        <View style={{
          backgroundColor: C.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24,
          paddingHorizontal: 24, paddingTop: 20, paddingBottom: insets.bottom + 16,
        }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: C.ink, marginBottom: 16, textAlign: 'center' }}>
            เพิ่มรูปภาพ
          </Text>
          <Pressable onPress={takePhoto}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 14,
              backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10,
              borderWidth: 1, borderColor: C.line }}>
            <Text style={{ fontSize: 28 }}>📷</Text>
            <View>
              <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink }}>ถ่ายรูปใหม่</Text>
              <Text style={{ fontSize: 12, color: C.inkSoft }}>เปิดกล้องถ่ายภาพทันที</Text>
            </View>
          </Pressable>
          <Pressable onPress={pickFromGallery}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 14,
              backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10,
              borderWidth: 1, borderColor: C.line }}>
            <Text style={{ fontSize: 28 }}>🖼</Text>
            <View>
              <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink }}>เลือกจากคลังภาพ</Text>
              <Text style={{ fontSize: 12, color: C.inkSoft }}>รูปที่ถ่ายไว้แล้วในเครื่อง</Text>
            </View>
          </Pressable>
          <Pressable onPress={() => setShowPhotoPicker(false)}
            style={{ paddingVertical: 14, alignItems: 'center' }}>
            <Text style={{ fontSize: 14, color: C.inkFaint }}>ยกเลิก</Text>
          </Pressable>
        </View>
      </Modal>

      {/* ── Add expense sheet ──────────────────────────────────────────────── */}
      <Modal visible={showExpenseForm} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={() => setShowExpenseForm(false)} />
          <View style={{ backgroundColor: C.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: C.ink }}>เพิ่มค่าใช้จ่าย</Text>
              <Pressable onPress={() => setShowExpenseForm(false)}>
                <Text style={{ fontSize: 22, color: C.inkFaint }}>✕</Text>
              </Pressable>
            </View>

            <TextInput value={expItemName} onChangeText={setExpItemName}
              placeholder="เช่น ข้าวเย็น, ค่ารถ, ของฝาก"
              placeholderTextColor={C.inkFaint} returnKeyType="next"
              style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12,
                fontSize: 15, color: C.ink, marginBottom: 12,
                borderWidth: 1.5, borderColor: C.line }} />

            <TextInput value={expAmount} onChangeText={setExpAmount}
              keyboardType="decimal-pad" placeholder="0.00" selectTextOnFocus
              placeholderTextColor={C.inkFaint}
              style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12,
                fontSize: 22, fontWeight: '800', color: C.ink, marginBottom: 14,
                borderWidth: 1.5, borderColor: C.line, textAlign: 'center' }} />

            <Pressable onPress={() => setExpCreateTx(!expCreateTx)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16,
                padding: 12,
                backgroundColor: expCreateTx ? C.sageTint : '#fff',
                borderRadius: 12, borderWidth: 1.5,
                borderColor: expCreateTx ? C.sage : C.line }}>
              <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2,
                borderColor: expCreateTx ? C.sage : C.line,
                backgroundColor: expCreateTx ? C.sage : '#fff',
                justifyContent: 'center', alignItems: 'center' }}>
                {expCreateTx && <Text style={{ color: '#fff', fontSize: 13 }}>✓</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: expCreateTx ? C.sage : C.inkSoft }}>
                  บันทึกเป็นรายจ่ายด้วย
                </Text>
                <Text style={{ fontSize: 11, color: C.inkFaint }}>เข้า "ประวัติรายจ่าย" ในแอปด้วย</Text>
              </View>
            </Pressable>

            {expCreateTx && wallets.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, marginBottom: 14 }}>
                {wallets.map(w => (
                  <Pressable key={w.id} onPress={() => setSelectedWalletId(w.id)}
                    style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
                      backgroundColor: selectedWalletId === w.id ? C.rose : '#fff',
                      borderWidth: 1.5, borderColor: selectedWalletId === w.id ? C.rose : C.line }}>
                    <Text style={{ fontSize: 13, fontWeight: '600',
                      color: selectedWalletId === w.id ? '#fff' : C.inkSoft }}>
                      {w.icon} {w.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            <Pressable onPress={addExpenseToList}
              style={{ backgroundColor: C.rose, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>เพิ่มรายการนี้</Text>
            </Pressable>
            <View style={{ height: insets.bottom + 8 }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ── StyleSheet ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: '#A9A1B3',
    letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8,
  },
  canvas: {
    backgroundColor: '#fff',
    borderRadius: 18, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: '#E7DFD3',
    shadowColor: '#3D3548', shadowOpacity: 0.06,
    shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  notebookLines: {
    borderTopWidth: 1, borderTopColor: '#E7DFD3', paddingTop: 10,
  },
});
