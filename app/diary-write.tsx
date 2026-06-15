import { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  ActivityIndicator, Modal, Platform, KeyboardAvoidingView,
  Alert, Image, Keyboard,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
// expo-location: dynamic import — ต้อง rebuild native ก่อนถึงจะใช้งาน GPS ได้
import { diaryService, MOODS } from '@/services/diaryService';
import type { DiaryExpense } from '@/db/schema';
import { categoryService } from '@/services/categoryService';
import { useWalletStore } from '@/stores/useWalletStore';
import { formatCurrency } from '@/lib/format';
import { useSnackbar } from '@/components/ui/SnackbarProvider';
import type { Category } from '@/db/schema';
import { useDiaryTier } from '@/features/life-diary/hooks/useDiaryTier';
import ProDiaryWriteScreen from '@/features/life-diary/screens/ProDiaryWriteScreen';

const MOOD_LABELS: Record<string, string> = {
  '😊': 'มีความสุข', '🥰': 'รัก/อบอุ่น', '😆': 'สนุก',
  '😌': 'สงบ', '🤩': 'ตื่นเต้น', '😴': 'ง่วง',
  '😢': 'เศร้า', '😤': 'เหนื่อย', '🥺': 'อ่อนใจ', '😮': 'ประหลาด',
};

const MOOD_SAVE_TEXT: Record<string, string> = {
  '😊': 'เก็บวันที่มีความสุขนี้ไว้ ✨',
  '🥰': 'บันทึกความอบอุ่นนี้ไว้ในสมุดชีวิต 💕',
  '😆': 'เก็บเสียงหัวเราะวันนี้ไว้ 🎉',
  '😌': 'บันทึกช่วงเวลาสงบนี้ไว้ 🌿',
  '🤩': 'เก็บพลังงานวันนี้ไว้ ⚡',
  '😴': 'บันทึกวันที่เหนื่อยนี้ไว้ 🌙',
  '😢': 'เก็บความรู้สึกนี้ไว้อย่างปลอดภัย 🌧',
  '😤': 'บันทึกแล้วปล่อยวางไปนะ 💪',
  '🥺': 'บันทึกความรู้สึกนี้ไว้ 🌸',
  '😮': 'เก็บช่วงเวลาน่าประหลาดใจนี้ไว้ ⚡',
};

function CheckItem({ label, done, tag }: { label: string; done: boolean; tag?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 9, gap: 10 }}>
      <View style={{ width: 22, height: 22, borderRadius: 11,
        backgroundColor: done ? '#10B981' : '#E5E7EB',
        justifyContent: 'center', alignItems: 'center' }}>
        {done
          ? <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>✓</Text>
          : <Text style={{ color: '#9CA3AF', fontSize: 10 }}>○</Text>}
      </View>
      <Text style={{ flex: 1, fontSize: 13, color: done ? '#065F46' : '#6B7280', fontWeight: done ? '600' : '400' }}>
        {label}
      </Text>
      {!done && tag && (
        <View style={{ backgroundColor: tag === 'ข้ามได้' ? '#F3F4F6' : '#FEF9C3',
          borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
          <Text style={{ fontSize: 10, color: tag === 'ข้ามได้' ? '#9CA3AF' : '#92400E' }}>{tag}</Text>
        </View>
      )}
    </View>
  );
}

export default function DiaryWriteScreen() {
  const { tier, loading } = useDiaryTier();
  if (loading) return (
    <View style={{ flex: 1, backgroundColor: '#FBF8F3', justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#D14F86" />
    </View>
  );
  if (tier === 'pro' || tier === 'premium') return <ProDiaryWriteScreen />;
  return <FreeDiaryWriteScreen />;
}

function FreeDiaryWriteScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const { entryId } = useLocalSearchParams<{ entryId?: string }>();
  const isEditing = !!entryId;
  const { wallets, loadWallets } = useWalletStore();

  // Entry fields
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [location, setLocation] = useState('');
  const [entryDate] = useState(new Date());

  // Photos (stable: ไม่ใช้ index เป็น key)
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

  // useMemo — ไม่ trigger re-render จากการพิมพ์
  const totalExpenses = useMemo(
    () => expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0),
    [expenses],
  );
  const isReady = useMemo(() => !!content.trim(), [content]);
  const saveButtonText = useMemo(() => {
    if (!isReady) return 'กรอกรายละเอียดก่อนบันทึก';
    return (selectedMood && MOOD_SAVE_TEXT[selectedMood]) ?? 'บันทึกความทรงจำนี้ 💙';
  }, [isReady, selectedMood]);

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
        setSelectedMood(entry.mood ?? null);
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

  // ── Photo handlers ────────────────────────────────────────────────────────
  async function pickFromGallery() {
    setShowPhotoPicker(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('ขออนุญาต', 'กรุณาอนุญาตการเข้าถึงคลังรูปภาพในการตั้งค่า');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 10,
    });
    if (!result.canceled && result.assets.length > 0) {
      const newPhotos = result.assets.map(asset => ({
        id: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        uri: asset.uri,
        isNew: true,
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

  // ── GPS location ──────────────────────────────────────────────────────────
  async function fetchGPSLocation() {
    setFetchingLocation(true);
    try {
      // Dynamic import — ทำงานได้หลัง rebuild native เท่านั้น
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Location = require('expo-location');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('ขออนุญาต', 'กรุณาอนุญาตการเข้าถึงตำแหน่งในการตั้งค่า');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const geo = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude, longitude: pos.coords.longitude,
      });
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

  // ── Expense handlers ──────────────────────────────────────────────────────
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

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!content.trim()) {
      showSnackbar({ message: 'กรุณาเล่าเรื่องราวสักนิด', variant: 'warning' });
      return;
    }
    Keyboard.dismiss();
    setSaving(true);
    try {
      let eid = entryId;
      if (!isEditing) {
        eid = await diaryService.createEntry({
          title: title.trim() || undefined,
          content: content.trim(),
          mood: selectedMood ?? undefined,
          entryDate,
          locationName: location.trim() || undefined,
        });
      } else if (eid) {
        await diaryService.updateEntry(eid, {
          title: title.trim() || null,
          content: content.trim(),
          mood: selectedMood ?? null,
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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FBF7FF' }}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#FBF7FF' }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <LinearGradient colors={['#5B21B6', '#7C3AED', '#9333EA']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 8, paddingBottom: 16, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => router.back()} style={{ padding: 6, marginRight: 8 }}>
            <Text style={{ fontSize: 20, color: '#fff' }}>←</Text>
          </Pressable>
          <Text style={{ fontSize: 17, fontWeight: '800', color: '#fff', flex: 1 }}>
            {isEditing ? '✏️ แก้ไขความทรงจำ' : '📖 บันทึกความทรงจำ'}
          </Text>
          <Pressable onPress={handleSave} disabled={saving}
            style={{ backgroundColor: saving ? 'rgba(255,255,255,0.3)' : '#fff',
              borderRadius: 14, paddingHorizontal: 16, paddingVertical: 8 }}>
            {saving
              ? <ActivityIndicator color="#7C3AED" size="small" />
              : <Text style={{ color: '#7C3AED', fontWeight: '800', fontSize: 14 }}>บันทึก ✓</Text>}
          </Pressable>
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

            {/* Date badge */}
            <View style={{ flexDirection: 'row', marginBottom: 14 }}>
              <View style={{ backgroundColor: '#EDE9FE', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#5B21B6' }}>
                  📅 {entryDate.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'long' })}
                </Text>
              </View>
            </View>

            {/* Mood picker */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#888', marginBottom: 8 }}>ความรู้สึกวันนี้</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, marginBottom: 16 }}
              keyboardShouldPersistTaps="handled">
              {MOODS.map((m) => (
                <Pressable key={m} onPress={() => setSelectedMood(selectedMood === m ? null : m)}
                  style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, alignItems: 'center',
                    backgroundColor: selectedMood === m ? '#7C3AED' : '#F5F3FF',
                    borderWidth: 1.5, borderColor: selectedMood === m ? '#7C3AED' : '#DDD6FE' }}>
                  <Text style={{ fontSize: 20 }}>{m}</Text>
                  {selectedMood === m && (
                    <Text style={{ fontSize: 9, color: '#fff', marginTop: 2, fontWeight: '700' }}>
                      {MOOD_LABELS[m]}
                    </Text>
                  )}
                </Pressable>
              ))}
            </ScrollView>

            {/* Title */}
            <TextInput value={title} onChangeText={setTitle}
              placeholder="ตั้งชื่อให้วันนี้..."
              placeholderTextColor="#C4B5FD"
              returnKeyType="next"
              style={{ backgroundColor: '#F5F3FF', borderRadius: 12, padding: 12,
                fontSize: 16, fontWeight: '700', color: '#1E1B4B', marginBottom: 10,
                borderWidth: 1, borderColor: '#DDD6FE' }} />

            {/* Content */}
            <TextInput value={content} onChangeText={setContent}
              placeholder="เล่าเรื่องราวของวันนี้..."
              placeholderTextColor="#C4B5FD"
              multiline numberOfLines={6}
              textAlignVertical="top"
              style={{ backgroundColor: '#fff', borderRadius: 14, padding: 14,
                fontSize: 15, color: '#333', marginBottom: 14, minHeight: 130,
                borderWidth: 1, borderColor: '#EDE9FE', lineHeight: 24 }} />

            {/* Location */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 }}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center',
                backgroundColor: '#F5F3FF', borderRadius: 12,
                paddingHorizontal: 12, borderWidth: 1, borderColor: '#DDD6FE' }}>
                <Text style={{ fontSize: 16, marginRight: 6 }}>📍</Text>
                <TextInput value={location} onChangeText={setLocation}
                  placeholder="วันนี้เกิดขึ้นที่ไหน?"
                  placeholderTextColor="#C4B5FD"
                  style={{ flex: 1, padding: 10, fontSize: 14, color: '#333' }} />
              </View>
              <Pressable onPress={fetchGPSLocation} disabled={fetchingLocation}
                style={{ backgroundColor: fetchingLocation ? '#EDE9FE' : '#7C3AED',
                  borderRadius: 12, paddingHorizontal: 10, paddingVertical: 10,
                  alignItems: 'center', justifyContent: 'center', minWidth: 44 }}>
                {fetchingLocation
                  ? <ActivityIndicator size="small" color="#7C3AED" />
                  : <Text style={{ fontSize: 16 }}>🛰️</Text>}
              </Pressable>
            </View>

            {/* Photos */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#888', marginBottom: 8 }}>
                🖼 รูปภาพ ({localPhotos.length})
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10 }}
                keyboardShouldPersistTaps="handled">
                {localPhotos.map((p) => (
                  <View key={p.id} style={{ position: 'relative' }}>
                    <Image source={{ uri: p.uri }}
                      style={{ width: 90, height: 90, borderRadius: 12, backgroundColor: '#EDE9FE' }} />
                    <Pressable onPress={() => removePhoto(p.id)}
                      style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22,
                        borderRadius: 11, backgroundColor: '#EF4444',
                        justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>✕</Text>
                    </Pressable>
                  </View>
                ))}
                <Pressable onPress={() => setShowPhotoPicker(true)}
                  style={{ width: 90, height: 90, borderRadius: 12, backgroundColor: '#F5F3FF',
                    borderWidth: 2, borderColor: '#DDD6FE', borderStyle: 'dashed',
                    justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontSize: 24 }}>📷</Text>
                  <Text style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>เพิ่มรูป</Text>
                </Pressable>
              </ScrollView>
            </View>

            {/* Expenses */}
            <View style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center',
                justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#888' }}>
                  💰 ค่าใช้จ่ายที่เกี่ยวข้อง
                  {expenses.length > 0 ? ` · รวม ${formatCurrency(totalExpenses)}฿` : ''}
                </Text>
                <Pressable onPress={() => setShowExpenseForm(true)}
                  style={{ backgroundColor: '#EDE9FE', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 12, color: '#7C3AED', fontWeight: '700' }}>+ เพิ่ม</Text>
                </Pressable>
              </View>

              {expenses.map((exp) => (
                <View key={exp.id} style={{ flexDirection: 'row', alignItems: 'center',
                  backgroundColor: '#F5F3FF', borderRadius: 10, padding: 10, marginBottom: 6 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#333' }}>{exp.itemName}</Text>
                    <Text style={{ fontSize: 12, color: '#7C3AED' }}>
                      {formatCurrency(parseFloat(exp.amount))}฿
                      {exp.createTransaction ? ' · บันทึกรายจ่ายด้วย ✓' : ''}
                    </Text>
                  </View>
                  <Pressable onPress={() => removeExpense(exp.id)} style={{ padding: 6 }}>
                    <Text style={{ fontSize: 14, color: '#FECACA' }}>✕</Text>
                  </Pressable>
                </View>
              ))}
            </View>

            {/* ── Final Action Card ── */}
            {!isEditing && (
              <View style={{ marginTop: 20, borderRadius: 20, overflow: 'hidden',
                borderWidth: 1.5, borderColor: isReady ? '#6EE7B7' : '#E5E7EB' }}>
                <View style={{ backgroundColor: isReady ? '#ECFDF5' : '#F9FAFB', padding: 18 }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', textAlign: 'center',
                    color: isReady ? '#065F46' : '#6B7280', marginBottom: 14 }}>
                    {isReady
                      ? '✨ ความทรงจำนี้พร้อมบันทึกแล้ว'
                      : 'เติมอีกนิด ความทรงจำนี้ก็พร้อมบันทึก'}
                  </Text>

                  <CheckItem label="อารมณ์วันนี้" done={!!selectedMood} tag={!selectedMood ? 'แนะนำ' : undefined} />
                  <CheckItem label="ตั้งชื่อให้วันนี้" done={!!title.trim()} tag={!title.trim() ? 'แนะนำ' : undefined} />
                  <CheckItem label="เล่าเรื่องราวของวันนี้" done={!!content.trim()} />
                  <CheckItem label="วันนี้เกิดขึ้นที่ไหน" done={!!location.trim()} tag={!location.trim() ? 'แนะนำ' : undefined} />
                  <CheckItem label={`ภาพความทรงจำ${localPhotos.length > 0 ? ` (${localPhotos.length} รูป)` : ''}`}
                    done={localPhotos.length > 0} tag={localPhotos.length === 0 ? 'แนะนำ' : undefined} />
                  <CheckItem label={`ค่าใช้จ่าย${expenses.length > 0 ? ` (${expenses.length} รายการ)` : ''}`}
                    done={expenses.length > 0} tag={expenses.length === 0 ? 'ข้ามได้' : undefined} />
                </View>

                <Pressable onPress={handleSave} disabled={saving || !isReady}
                  style={{ paddingVertical: 18, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: isReady ? '#D1FAE5' : '#F3F4F6',
                    borderTopWidth: 1, borderTopColor: isReady ? '#6EE7B7' : '#E5E7EB' }}>
                  {saving
                    ? <ActivityIndicator color="#065F46" />
                    : <Text style={{ fontSize: 16, fontWeight: '900',
                        color: isReady ? '#065F46' : '#9CA3AF',
                        textShadowColor: isReady ? 'rgba(16,185,129,0.3)' : 'transparent',
                        textShadowOffset: { width: 0, height: 0 },
                        textShadowRadius: isReady ? 8 : 0 }}>
                        {saveButtonText}
                      </Text>}
                </Pressable>
              </View>
            )}

          </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Photo Picker Bottom Sheet ── */}
      <Modal visible={showPhotoPicker} animationType="slide" transparent>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
          onPress={() => setShowPhotoPicker(false)} />
        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
          paddingHorizontal: 24, paddingTop: 20, paddingBottom: insets.bottom + 16 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: '#333', marginBottom: 16, textAlign: 'center' }}>
            เพิ่มรูปภาพ
          </Text>
          <Pressable onPress={takePhoto}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 14,
              backgroundColor: '#F5F3FF', borderRadius: 14, padding: 16, marginBottom: 10 }}>
            <Text style={{ fontSize: 28 }}>📷</Text>
            <View>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#1E1B4B' }}>ถ่ายรูปใหม่</Text>
              <Text style={{ fontSize: 12, color: '#888' }}>เปิดกล้องถ่ายภาพทันที</Text>
            </View>
          </Pressable>
          <Pressable onPress={pickFromGallery}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 14,
              backgroundColor: '#F5F3FF', borderRadius: 14, padding: 16, marginBottom: 10 }}>
            <Text style={{ fontSize: 28 }}>🖼</Text>
            <View>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#1E1B4B' }}>เลือกจากคลังภาพ</Text>
              <Text style={{ fontSize: 12, color: '#888' }}>รูปที่ถ่ายไว้แล้วในเครื่อง</Text>
            </View>
          </Pressable>
          <Pressable onPress={() => setShowPhotoPicker(false)}
            style={{ paddingVertical: 14, alignItems: 'center' }}>
            <Text style={{ fontSize: 14, color: '#9CA3AF' }}>ยกเลิก</Text>
          </Pressable>
        </View>
      </Modal>

      {/* ── Add Expense Bottom Sheet ── */}
      <Modal visible={showExpenseForm} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={() => setShowExpenseForm(false)} />
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24,
            borderTopRightRadius: 24, padding: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: '#333' }}>💰 เพิ่มค่าใช้จ่าย</Text>
              <Pressable onPress={() => setShowExpenseForm(false)}>
                <Text style={{ fontSize: 22, color: '#BBB' }}>✕</Text>
              </Pressable>
            </View>

            <TextInput value={expItemName} onChangeText={setExpItemName}
              placeholder="เช่น ข้าวเย็น, ค่ารถ, ของฝาก"
              placeholderTextColor="#CCC" returnKeyType="next"
              style={{ backgroundColor: '#F5F3FF', borderRadius: 12, padding: 12,
                fontSize: 15, color: '#333', marginBottom: 12,
                borderWidth: 1, borderColor: '#DDD6FE' }} />

            <TextInput value={expAmount} onChangeText={setExpAmount}
              keyboardType="decimal-pad" placeholder="0.00" selectTextOnFocus
              placeholderTextColor="#CCC"
              style={{ backgroundColor: '#F5F3FF', borderRadius: 12, padding: 12,
                fontSize: 22, fontWeight: '800', color: '#333', marginBottom: 14,
                borderWidth: 1, borderColor: '#DDD6FE', textAlign: 'center' }} />

            <Pressable onPress={() => setExpCreateTx(!expCreateTx)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16,
                padding: 12, backgroundColor: expCreateTx ? '#F0FDF4' : '#F9FAFB',
                borderRadius: 12, borderWidth: 1,
                borderColor: expCreateTx ? '#86EFAC' : '#E5E7EB' }}>
              <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2,
                borderColor: expCreateTx ? '#16A34A' : '#DDD',
                backgroundColor: expCreateTx ? '#16A34A' : '#fff',
                justifyContent: 'center', alignItems: 'center' }}>
                {expCreateTx && <Text style={{ color: '#fff', fontSize: 13 }}>✓</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700',
                  color: expCreateTx ? '#15803D' : '#555' }}>บันทึกเป็นรายจ่ายด้วย</Text>
                <Text style={{ fontSize: 11, color: '#888' }}>เข้า "ประวัติรายจ่าย" ในแอปด้วย</Text>
              </View>
            </Pressable>

            {expCreateTx && wallets.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, marginBottom: 14 }}>
                {wallets.map((w) => (
                  <Pressable key={w.id} onPress={() => setSelectedWalletId(w.id)}
                    style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
                      backgroundColor: selectedWalletId === w.id ? '#7C3AED' : '#F5F5F5',
                      borderWidth: 1, borderColor: selectedWalletId === w.id ? '#7C3AED' : '#E0E0E0' }}>
                    <Text style={{ fontSize: 13, fontWeight: '600',
                      color: selectedWalletId === w.id ? '#fff' : '#333' }}>
                      {w.icon} {w.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            <Pressable onPress={addExpenseToList}
              style={{ backgroundColor: '#7C3AED', borderRadius: 14,
                paddingVertical: 14, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>เพิ่มรายการนี้</Text>
            </Pressable>
            <View style={{ height: insets.bottom + 8 }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
