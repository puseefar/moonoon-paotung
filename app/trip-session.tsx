import { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput, Animated, Share, StyleSheet,
  ActivityIndicator, Modal, Platform, KeyboardAvoidingView, Alert,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { tripEstimatorService, TRIP_TEMPLATES } from '@/services/tripEstimatorService';
import type { TripItem } from '@/db/schema';
import { categoryService } from '@/services/categoryService';
import { useWalletStore } from '@/stores/useWalletStore';
import { formatCurrency } from '@/lib/format';
import type { Category } from '@/db/schema';
import { useSnackbar } from '@/components/ui/SnackbarProvider';
import { guessTripCategoryId } from '@/lib/tripCategoryGuess';

interface SessionSummary {
  session: Awaited<ReturnType<typeof tripEstimatorService.getSessionById>>;
  items: TripItem[];
  ticked: TripItem[];
  unticked: TripItem[];
  totalEstimated: number;
  totalActual: number;
  remainingEstimated: number;
  savedVsEstimate: number;
  completionPct: number;
}

export default function TripSessionScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { wallets, loadWallets } = useWalletStore();

  const [data, setData] = useState<SessionSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Add item
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemQty, setNewItemQty] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('');
  const [suggestedPrice, setSuggestedPrice] = useState<number | null>(null);
  const [addingItem, setAddingItem] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);
  const successScale = useRef(new Animated.Value(0)).current;

  // Pre-Departure Summary
  const [showPreDepartureModal, setShowPreDepartureModal] = useState(false);
  const [noteText, setNoteText] = useState('');

  // Frequent items suggestion
  const [frequentItems, setFrequentItems] = useState<{ itemName: string; count: number; avgPrice: number }[]>([]);

  // Tick item (enter actual price)
  const [tickItem, setTickItem] = useState<TripItem | null>(null);
  const [actualPriceText, setActualPriceText] = useState('');

  // Complete session
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [createExpense, setCreateExpense] = useState(true);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [autoGuessedCategoryId, setAutoGuessedCategoryId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sessionId) return;
    const [summary, cats] = await Promise.all([
      tripEstimatorService.getSessionSummary(sessionId),
      categoryService.getByType('expense'),
      loadWallets(),
    ]);
    setData(summary as SessionSummary);
    setExpenseCategories(cats);
    if (wallets.length > 0 && !selectedWalletId) setSelectedWalletId(wallets[0].id);
    if (summary?.session?.templateId) {
      const freq = await tripEstimatorService.getFrequentItems(summary.session.templateId);
      setFrequentItems(freq);
    }
    setLoading(false);
  }, [sessionId]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  async function handleAddItem() {
    if (!newItemName.trim()) { showSnackbar({ message: 'กรุณาระบุชื่อรายการ', variant: 'warning' }); return; }
    const price = parseFloat(newItemPrice.replace(/,/g, '')) || 0;
    const qty = parseFloat(newItemQty) || 1;
    setAddingItem(true);
    try {
      await tripEstimatorService.addItem(sessionId, newItemName.trim(), price, qty, newItemUnit.trim() || undefined);
      const addedName = newItemName.trim();
      setNewItemName(''); setNewItemPrice(''); setNewItemQty(''); setNewItemUnit(''); setSuggestedPrice(null);
      load();
      successScale.setValue(0);
      setAddSuccess(addedName);
      Animated.spring(successScale, { toValue: 1, useNativeDriver: true, tension: 50, friction: 7 }).start();
    } finally {
      setAddingItem(false);
    }
  }

  function resetAndAddMore() { setAddSuccess(null); }

  function closeModal() { setShowAddModal(false); setAddSuccess(null); }

  function closeAndComplete() {
    setShowAddModal(false);
    setAddSuccess(null);
    if (data?.session?.status === 'active') {
      openCompleteModal();
    } else {
      setShowPreDepartureModal(true);
    }
  }

  async function handleStartShopping() {
    await tripEstimatorService.startShopping(sessionId, noteText.trim() || undefined);
    setShowPreDepartureModal(false);
    load();
  }

  function openCompleteModal() {
    if (!selectedCategoryId && data?.session && expenseCategories.length > 0) {
      const guessed = guessTripCategoryId(data.session.name, data.session.templateId, expenseCategories);
      if (guessed) { setSelectedCategoryId(guessed); setAutoGuessedCategoryId(guessed); }
    }
    setShowCompleteModal(true);
  }

  async function handleShare() {
    if (!data) return;
    const template = TRIP_TEMPLATES.find(t => t.id === data.session?.templateId);
    const lines = data.items.map(item => {
      const checked = item.isTicked ? '✅' : '□';
      const qtyStr = (item.quantity && item.quantity > 1)
        ? ` ×${item.quantity}${item.unit ?? ''}`
        : (item.unit ? ` (${item.unit})` : '');
      const priceStr = item.estimatedPrice ? ` ~${formatCurrency(item.estimatedPrice)}฿` : '';
      return `${checked} ${item.itemName}${qtyStr}${priceStr}`;
    });
    const sep = '─'.repeat(28);
    const message = `${template?.icon ?? '🛒'} ${data.session?.name ?? 'Shopping List'}\n${sep}\n${lines.join('\n')}\n${sep}\n💰 ประมาณ ${formatCurrency(data.totalEstimated)}฿`;
    await Share.share({ message });
  }

  async function handleNameChange(name: string) {
    setNewItemName(name);
    if (name.length >= 2) {
      const price = await tripEstimatorService.getPriceMemory(name);
      setSuggestedPrice(price);
      if (price && !newItemPrice) setNewItemPrice(String(price));
    } else {
      setSuggestedPrice(null);
    }
  }

  async function handleTick(item: TripItem) {
    if (item.isTicked) {
      await tripEstimatorService.untickItem(item.id);
      load();
      return;
    }
    setTickItem(item);
    setActualPriceText(String(item.actualPrice ?? item.estimatedPrice ?? ''));
  }

  async function confirmTick() {
    if (!tickItem) return;
    const actual = parseFloat(actualPriceText.replace(/,/g, '')) || undefined;
    await tripEstimatorService.tickItem(tickItem.id, actual);
    setTickItem(null); setActualPriceText('');
    load();
  }

  async function handleDeleteItem(item: TripItem) {
    Alert.alert('ลบรายการ', `ลบ "${item.itemName}"?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'ลบ', style: 'destructive', onPress: async () => { await tripEstimatorService.deleteItem(item.id); load(); } },
    ]);
  }

  async function handleComplete() {
    setCompleting(true);
    try {
      await tripEstimatorService.completeSession(sessionId, {
        createExpense,
        walletId: createExpense ? (selectedWalletId ?? undefined) : undefined,
        categoryId: createExpense ? (selectedCategoryId ?? undefined) : undefined,
      });
      setShowCompleteModal(false);
      showSnackbar({
        title: '✅ ทริปเสร็จแล้ว!',
        message: `ใช้จ่าย ${formatCurrency(data?.totalActual ?? 0)} บาท${createExpense ? ' · บันทึก Transaction แล้ว' : ''}`,
        variant: 'success', durationMs: 4000,
      });
      router.back();
    } finally {
      setCompleting(false);
    }
  }

  const isDone = data?.session?.status === 'done';
  const template = TRIP_TEMPLATES.find((t) => t.id === data?.session?.templateId);

  return (
    <View style={{ flex: 1, backgroundColor: '#FAF5FF' }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Gradient Header */}
      <LinearGradient
        colors={['#4A148C', '#6A1B9A', '#7B1FA2']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 8, paddingBottom: 20, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
          <Pressable onPress={() => router.back()} style={{ padding: 6, marginRight: 8 }}>
            <Text style={{ fontSize: 20, color: '#fff' }}>←</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: '#fff' }} numberOfLines={1}>
              {template?.icon ?? '🛒'} {data?.session?.name ?? '...'}
            </Text>
            {data?.session?.note ? (
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1 }} numberOfLines={1}>
                📝 {data.session.note}
              </Text>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            {data && (
              <Pressable onPress={handleShare} style={{ backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
                <Text style={{ color: '#fff', fontSize: 13 }}>📤</Text>
              </Pressable>
            )}
            {!isDone && data?.session && (
              <Pressable
                onPress={() => setShowAddModal(true)}
                style={{ backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 3, elevation: 2, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 4 }}>
                <Text style={{ color: '#7B1FA2', fontWeight: '900', fontSize: 16, lineHeight: 18 }}>+</Text>
                <Text style={{ color: '#7B1FA2', fontWeight: '700', fontSize: 13 }}>เพิ่ม</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Status badge */}
        {data?.session?.status === 'active' && (
          <View style={{ alignSelf: 'flex-start', backgroundColor: '#FFE082', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 8 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: '#E65100' }}>🛍️ กำลังซื้ออยู่</Text>
          </View>
        )}

        {/* Summary bar */}
        {data && (
          <>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 10, alignItems: 'center' }}>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>ประมาณ</Text>
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#fff' }}>{formatCurrency(data.totalEstimated)}</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 10, alignItems: 'center' }}>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>จ่ายจริง</Text>
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#FFE082' }}>{formatCurrency(data.totalActual)}</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 10, alignItems: 'center' }}>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>ซื้อแล้ว</Text>
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#A5D6A7' }}>{data.ticked.length}/{data.items.length}</Text>
              </View>
            </View>
            {/* Progress bar */}
            {data.items.length > 0 && (
              <View style={{ marginTop: 8, height: 5, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3 }}>
                <View style={{ height: 5, width: `${data.completionPct}%` as any, backgroundColor: '#A5D6A7', borderRadius: 3 }} />
              </View>
            )}
          </>
        )}
      </LinearGradient>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#7B1FA2" />
        </View>
      ) : (
        <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}>

          {/* ประมาณ vs จ่ายจริง comparison */}
          {data && data.ticked.length > 0 && (
            <View style={{
              backgroundColor: data.savedVsEstimate >= 0 ? '#E8F5E9' : '#FFEBEE',
              borderRadius: 14, padding: 14, marginBottom: 14,
              borderWidth: 1, borderColor: data.savedVsEstimate >= 0 ? '#66BB6A' : '#EF5350',
              flexDirection: 'row', alignItems: 'center', gap: 10,
            }}>
              <Text style={{ fontSize: 24 }}>{data.savedVsEstimate >= 0 ? '💚' : '💸'}</Text>
              <View>
                <Text style={{ fontSize: 14, fontWeight: '800', color: data.savedVsEstimate >= 0 ? '#2E7D32' : '#C62828' }}>
                  {data.savedVsEstimate >= 0
                    ? `ประหยัดกว่าประมาณ ${formatCurrency(data.savedVsEstimate)} บาท`
                    : `เกินงบ ${formatCurrency(Math.abs(data.savedVsEstimate))} บาท`}
                </Text>
                {data.unticked.length > 0 && (
                  <Text style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                    ยังเหลืออีก {data.unticked.length} รายการ ≈ {formatCurrency(data.remainingEstimated)} บาท
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Items list */}
          {data?.items.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <Text style={{ fontSize: 36, marginBottom: 8 }}>📝</Text>
              <Text style={{ fontSize: 15, color: '#888' }}>ยังไม่มีรายการ กด "+ เพิ่ม" เพื่อเริ่ม</Text>
            </View>
          ) : (
            <>
              {/* Unticked items */}
              {data!.unticked.length > 0 && (
                <>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#7B1FA2', marginBottom: 8 }}>
                    📋 รอซื้อ ({data!.unticked.length})
                  </Text>
                  {data!.unticked.map((item) => (
                    <Swipeable key={item.id}
                      overshootRight={false} friction={2}
                      renderRightActions={() => !isDone ? (
                        <Pressable onPress={() => handleDeleteItem(item)}
                          style={{ width: 68, backgroundColor: '#EF5350', borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 8 }}>
                          <Text style={{ fontSize: 20 }}>🗑</Text>
                          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', marginTop: 2 }}>ลบ</Text>
                        </Pressable>
                      ) : null}>
                      <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, flexDirection: 'row', alignItems: 'center' }}>
                        <Pressable onPress={() => handleTick(item)} style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: '#CE93D8', justifyContent: 'center', alignItems: 'center', marginRight: 12 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: '#333' }}>
                            {item.itemName}{item.unit ? ` (${item.unit})` : ''}
                            {item.quantity && item.quantity > 1 ? ` ×${item.quantity}` : ''}
                          </Text>
                          <Text style={{ fontSize: 13, color: '#888', marginTop: 2 }}>
                            ประมาณ {formatCurrency((item.estimatedPrice ?? 0) * (item.quantity ?? 1))} บาท
                          </Text>
                        </View>
                      </View>
                    </Swipeable>
                  ))}
                </>
              )}

              {/* Ticked items */}
              {data!.ticked.length > 0 && (
                <>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#4CAF50', marginBottom: 8, marginTop: 8 }}>
                    ✅ ซื้อแล้ว ({data!.ticked.length})
                  </Text>
                  {data!.ticked.map((item) => (
                    <Swipeable key={item.id}
                      overshootRight={false} friction={2}
                      renderRightActions={() => !isDone ? (
                        <Pressable onPress={() => handleTick(item)}
                          style={{ width: 68, backgroundColor: '#FF9800', borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 8 }}>
                          <Text style={{ fontSize: 20 }}>↩️</Text>
                          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', marginTop: 2 }}>ยกเลิก</Text>
                        </Pressable>
                      ) : null}>
                      <View style={{ backgroundColor: '#F1F8E9', borderRadius: 14, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', opacity: 0.85 }}>
                        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#4CAF50', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '900' }}>✓</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: '#555', textDecorationLine: 'line-through' }}>
                            {item.itemName}{item.unit ? ` (${item.unit})` : ''}
                          </Text>
                          <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
                            <Text style={{ fontSize: 13, color: '#4CAF50', fontWeight: '700' }}>
                              จ่าย {formatCurrency((item.actualPrice ?? item.estimatedPrice ?? 0) * (item.quantity ?? 1))}
                            </Text>
                            {item.actualPrice && item.actualPrice !== item.estimatedPrice && (
                              <Text style={{ fontSize: 11, color: '#888' }}>
                                (ประมาณ {formatCurrency((item.estimatedPrice ?? 0) * (item.quantity ?? 1))})
                              </Text>
                            )}
                          </View>
                        </View>
                      </View>
                    </Swipeable>
                  ))}
                </>
              )}
            </>
          )}

          {/* Action button — changes with status */}
          {!isDone && data && data.items.length > 0 && (
            data.session?.status === 'active' ? (
              <Pressable
                onPress={openCompleteModal}
                style={{ backgroundColor: '#2E7D32', borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 16 }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>🏁 เสร็จซื้อแล้ว — บันทึก</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => setShowPreDepartureModal(true)}
                style={{ borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 16, overflow: 'hidden' }}>
                <LinearGradient colors={['#4A148C', '#7B1FA2']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={{ ...StyleSheet.absoluteFillObject }} />
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>🧳 สรุปก่อนออกบ้าน</Text>
              </Pressable>
            )
          )}

          {isDone && (
            <View style={{ backgroundColor: '#E8F5E9', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 }}>
              <Text style={{ fontSize: 22 }}>🏁</Text>
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#2E7D32', marginTop: 6 }}>ทริปนี้เสร็จแล้ว</Text>
              <Text style={{ fontSize: 13, color: '#555', marginTop: 4 }}>
                ใช้จ่าย {formatCurrency(data?.session?.actualSpent ?? 0)} / ประมาณ {formatCurrency(data?.session?.estimatedBudget ?? 0)} บาท
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* ── Add Item Modal ── */}
      <Modal visible={showAddModal} animationType="slide" transparent onDismiss={() => setAddSuccess(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={closeModal} />
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: '#333' }}>
                {addSuccess ? '✅ เพิ่มแล้ว!' : '+ เพิ่มรายการ'}
              </Text>
              <Pressable onPress={closeModal}><Text style={{ fontSize: 22, color: '#BBB' }}>✕</Text></Pressable>
            </View>

            {/* Frequent items chips — show when form is open and name is empty */}
            {!addSuccess && frequentItems.length > 0 && !newItemName && (
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#999', marginBottom: 6 }}>
                  ⚡ ของที่ซื้อบ่อย
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {frequentItems.slice(0, 6).map((fi) => (
                    <Pressable key={fi.itemName}
                      onPress={() => {
                        setNewItemName(fi.itemName);
                        if (fi.avgPrice > 0 && !newItemPrice) setNewItemPrice(String(fi.avgPrice));
                        setSuggestedPrice(fi.avgPrice > 0 ? fi.avgPrice : null);
                      }}
                      style={{ paddingHorizontal: 11, paddingVertical: 7, borderRadius: 20,
                        backgroundColor: '#EDE7F6', borderWidth: 1, borderColor: '#CE93D8',
                        flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#4A148C' }}>{fi.itemName}</Text>
                      {fi.avgPrice > 0 && (
                        <Text style={{ fontSize: 10, color: '#888' }}>~{formatCurrency(fi.avgPrice)}฿</Text>
                      )}
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {addSuccess ? (
              /* ── Inline Success State ── */
              <View>
                <Animated.View style={{ alignItems: 'center', paddingVertical: 20, transform: [{ scale: successScale }] }}>
                  <Text style={{ fontSize: 52 }}>🎉</Text>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#2E7D32', marginTop: 10 }}>
                    "{addSuccess}"
                  </Text>
                  <Text style={{ fontSize: 13, color: '#888', marginTop: 4 }}>เพิ่มเข้า list แล้ว — จะทำอะไรต่อ?</Text>
                </Animated.View>
                <View style={{ gap: 10 }}>
                  <Pressable onPress={resetAndAddMore} style={{ borderWidth: 1.5, borderColor: '#7B1FA2', borderRadius: 14, paddingVertical: 13, alignItems: 'center' }}>
                    <Text style={{ color: '#7B1FA2', fontWeight: '700', fontSize: 14 }}>+ เพิ่มรายการต่อ</Text>
                  </Pressable>
                  <Pressable onPress={closeModal} style={{ backgroundColor: '#EDE7F6', borderRadius: 14, paddingVertical: 13, alignItems: 'center' }}>
                    <Text style={{ color: '#4A148C', fontWeight: '700', fontSize: 14 }}>ดูรายการทั้งหมด</Text>
                  </Pressable>
                  <Pressable onPress={closeAndComplete} style={{ backgroundColor: '#2E7D32', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>เสร็จแล้ว — สรุปก่อนออก 🏁</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              /* ── Add Item Form ── */
              <>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#888', marginBottom: 6 }}>ชื่อรายการ <Text style={{ color: '#E53935' }}>*</Text></Text>
                <TextInput value={newItemName} onChangeText={handleNameChange} placeholder="เช่น ผัก, เนื้อหมู, น้ำยาล้างจาน" placeholderTextColor="#CCC"
                  style={{ backgroundColor: '#F5F0FF', borderRadius: 12, padding: 14, fontSize: 15, color: '#333', marginBottom: 8, borderWidth: 1, borderColor: '#CE93D8' }} />
                {suggestedPrice && (
                  <Text style={{ fontSize: 12, color: '#7B1FA2', marginBottom: 8 }}>
                    💡 ราคาเฉลี่ยที่จำไว้: {formatCurrency(suggestedPrice)} บาท
                  </Text>
                )}

                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
                  <View style={{ flex: 2 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#888', marginBottom: 6 }}>ราคาประมาณ (บาท)</Text>
                    <TextInput value={newItemPrice} onChangeText={setNewItemPrice} placeholder="0" keyboardType="decimal-pad"
                      placeholderTextColor="#CCC" selectTextOnFocus
                      style={{ backgroundColor: '#F5F0FF', borderRadius: 12, padding: 12, fontSize: 18, fontWeight: '800', color: '#333', borderWidth: 1, borderColor: '#CE93D8' }} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#888', marginBottom: 6 }}>จำนวน</Text>
                    <TextInput value={newItemQty} onChangeText={setNewItemQty} keyboardType="decimal-pad" placeholder="1"
                      placeholderTextColor="#AAAAAA" selectTextOnFocus
                      style={{ backgroundColor: '#F5F5F5', borderRadius: 12, padding: 12, fontSize: 18, fontWeight: '800', color: '#333', textAlign: 'center' }} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#888', marginBottom: 6 }}>หน่วย</Text>
                    <TextInput value={newItemUnit} onChangeText={setNewItemUnit} placeholder="กก." placeholderTextColor="#CCC"
                      style={{ backgroundColor: '#F5F5F5', borderRadius: 12, padding: 12, fontSize: 14, color: '#333', textAlign: 'center' }} />
                  </View>
                </View>
                {/* Quick Unit Chips */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 12 }}>
                  {['ชิ้น', 'ถุง', 'กก.', 'กำ', 'แพ็ก', 'กล่อง', 'ขวด', 'ลัง', 'โหล', 'กิโล'].map((u) => (
                    <Pressable key={u} onPress={() => setNewItemUnit(u)}
                      style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
                        backgroundColor: newItemUnit === u ? '#7B1FA2' : '#F3E5F5',
                        borderWidth: 1, borderColor: newItemUnit === u ? '#7B1FA2' : '#E1BEE7' }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: newItemUnit === u ? '#fff' : '#7B1FA2' }}>{u}</Text>
                    </Pressable>
                  ))}
                </ScrollView>

                <Pressable onPress={handleAddItem} disabled={addingItem}
                  style={{ backgroundColor: addingItem ? '#CE93D8' : '#7B1FA2', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}>
                  {addingItem ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>เพิ่มรายการ</Text>}
                </Pressable>
              </>
            )}
            <View style={{ height: insets.bottom + 8 }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Tick Item Modal (enter actual price) ── */}
      <Modal visible={!!tickItem} animationType="fade" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '85%' }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: '#333', marginBottom: 4 }}>✅ ซื้อแล้ว</Text>
              <Text style={{ fontSize: 14, color: '#888', marginBottom: 14 }}>{tickItem?.itemName}</Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#888', marginBottom: 6 }}>ราคาที่จ่ายจริง (บาท)</Text>
              <TextInput value={actualPriceText} onChangeText={setActualPriceText} keyboardType="decimal-pad" autoFocus
                style={{ backgroundColor: '#F5F0FF', borderRadius: 12, padding: 14, fontSize: 22, fontWeight: '800', color: '#333', borderWidth: 1, borderColor: '#CE93D8', textAlign: 'center', marginBottom: 16 }} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable onPress={() => { setTickItem(null); setActualPriceText(''); }} style={{ flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: '#DDD', alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#888' }}>ยกเลิก</Text>
                </Pressable>
                <Pressable onPress={confirmTick} style={{ flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: '#4CAF50', alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff' }}>ยืนยัน</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Complete Session Modal ── */}
      <Modal visible={showCompleteModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' }} />
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#333', marginBottom: 4 }}>🏁 สรุปทริป</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16, backgroundColor: '#F3E5F5', borderRadius: 14, padding: 14 }}>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 11, color: '#888' }}>ประมาณ</Text>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#7B1FA2' }}>{formatCurrency(data?.totalEstimated ?? 0)}</Text>
              </View>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 11, color: '#888' }}>จ่ายจริง</Text>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#E65100' }}>{formatCurrency(data?.totalActual ?? 0)}</Text>
              </View>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 11, color: '#888' }}>{(data?.savedVsEstimate ?? 0) >= 0 ? 'ประหยัด' : 'เกินงบ'}</Text>
                <Text style={{ fontSize: 16, fontWeight: '800', color: (data?.savedVsEstimate ?? 0) >= 0 ? '#2E7D32' : '#C62828' }}>
                  {formatCurrency(Math.abs(data?.savedVsEstimate ?? 0))}
                </Text>
              </View>
            </View>

            <Pressable onPress={() => setCreateExpense(!createExpense)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: createExpense ? '#2E7D32' : '#DDD', backgroundColor: createExpense ? '#2E7D32' : '#fff', justifyContent: 'center', alignItems: 'center' }}>
                {createExpense && <Text style={{ color: '#fff', fontSize: 13 }}>✓</Text>}
              </View>
              <Text style={{ fontSize: 14, color: '#333', fontWeight: '600' }}>บันทึกเป็น Transaction อัตโนมัติ</Text>
            </Pressable>

            {createExpense && wallets.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 14 }}>
                {wallets.map((w) => (
                  <Pressable key={w.id} onPress={() => setSelectedWalletId(w.id)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: selectedWalletId === w.id ? '#7B1FA2' : '#F5F5F5', borderWidth: 1, borderColor: selectedWalletId === w.id ? '#7B1FA2' : '#E0E0E0' }}>
                    <Text style={{ fontSize: 13, color: selectedWalletId === w.id ? '#fff' : '#333', fontWeight: '600' }}>{w.icon} {w.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {createExpense && expenseCategories.length > 0 && (
              <View style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#888' }}>หมวดหมู่</Text>
                  {autoGuessedCategoryId && autoGuessedCategoryId === selectedCategoryId && (
                    <View style={{ backgroundColor: '#E3F2FD', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 10, color: '#1565C0', fontWeight: '700' }}>🤖 แนะนำอัตโนมัติ</Text>
                    </View>
                  )}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {expenseCategories.map((c) => (
                    <Pressable key={c.id}
                      onPress={() => { setSelectedCategoryId(c.id); setAutoGuessedCategoryId(null); }}
                      style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
                        backgroundColor: selectedCategoryId === c.id ? '#7B1FA2' : '#F5F5F5',
                        borderWidth: 1, borderColor: selectedCategoryId === c.id ? '#7B1FA2' : '#E0E0E0' }}>
                      <Text style={{ fontSize: 13, color: selectedCategoryId === c.id ? '#fff' : '#333', fontWeight: '600' }}>
                        {(c as any).icon ? `${(c as any).icon} ` : ''}{c.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable onPress={() => setShowCompleteModal(false)} style={{ flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#DDD', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#888' }}>ยกเลิก</Text>
              </Pressable>
              <Pressable onPress={handleComplete} disabled={completing} style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: completing ? '#A5D6A7' : '#2E7D32', alignItems: 'center' }}>
                {completing ? <ActivityIndicator color="#fff" /> : <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff' }}>ยืนยัน ✅</Text>}
              </Pressable>
            </View>
            <View style={{ height: insets.bottom + 8 }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Pre-Departure Summary Modal ── */}
      <Modal visible={showPreDepartureModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' }}
            onPress={() => setShowPreDepartureModal(false)} />
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#333' }}>🧳 ก่อนออกบ้าน...</Text>
              <Pressable onPress={() => setShowPreDepartureModal(false)}><Text style={{ fontSize: 22, color: '#BBB' }}>✕</Text></Pressable>
            </View>

            {/* Recommended Cash Card */}
            {(() => {
              const recommended = Math.ceil((data?.totalEstimated ?? 0) * 1.1 / 50) * 50;
              return (
                <>
                  <LinearGradient colors={['#4A148C', '#7B1FA2']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={{ borderRadius: 18, padding: 20, marginBottom: 14, alignItems: 'center' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginBottom: 4 }}>💰 ควรเตรียมเงิน</Text>
                    <Text style={{ color: '#fff', fontSize: 38, fontWeight: '900', letterSpacing: -1 }}>
                      ฿{recommended.toLocaleString()}
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4 }}>
                      ประมาณ {formatCurrency(data?.totalEstimated ?? 0)}฿ + เผื่อ 10%
                    </Text>
                  </LinearGradient>

                  {/* Items summary */}
                  <View style={{ backgroundColor: '#F5F0FF', borderRadius: 14, padding: 12, marginBottom: 12 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#7B1FA2', marginBottom: 8 }}>
                      📋 {data?.items.length ?? 0} รายการที่วางแผนไว้
                    </Text>
                    {data?.items.slice(0, 4).map((item) => (
                      <Text key={item.id} style={{ fontSize: 13, color: '#555', marginBottom: 3 }}>
                        · {item.itemName}{item.unit ? ` (${item.unit})` : ''}
                        {item.quantity && item.quantity > 1 ? ` ×${item.quantity}` : ''}
                        {item.estimatedPrice ? ` ~${formatCurrency((item.estimatedPrice) * (item.quantity ?? 1))}฿` : ''}
                      </Text>
                    ))}
                    {(data?.items.length ?? 0) > 4 && (
                      <Text style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                        ...และอีก {(data?.items.length ?? 0) - 4} รายการ
                      </Text>
                    )}
                  </View>

                  {/* Assistant message */}
                  <View style={{ backgroundColor: '#FFF8E7', borderRadius: 12, padding: 12, marginBottom: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                    <Text style={{ fontSize: 20 }}>🐷</Text>
                    <Text style={{ flex: 1, fontSize: 13, color: '#666', lineHeight: 20, fontStyle: 'italic' }}>
                      "ควรเตรียมเงินสัก {formatCurrency(recommended)} บาทนะ{'\n'}เผื่อราคาขึ้นหรือของเพิ่มเล็กน้อย"
                    </Text>
                  </View>
                </>
              );
            })()}

            {/* Note field */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#888', marginBottom: 6 }}>📝 หมายเหตุ (ไม่บังคับ)</Text>
            <TextInput
              value={noteText}
              onChangeText={setNoteText}
              placeholder="เช่น ถามราคาหมูก่อนซื้อ, ซื้อแค่พอใช้สัปดาห์นี้"
              placeholderTextColor="#CCC"
              multiline
              style={{ backgroundColor: '#F5F5F5', borderRadius: 12, padding: 12, fontSize: 14, color: '#333', marginBottom: 16, minHeight: 48, maxHeight: 80 }}
            />

            {/* Actions */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable onPress={() => setShowPreDepartureModal(false)}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#DDD', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#888' }}>กลับแก้รายการ</Text>
              </Pressable>
              <Pressable onPress={handleStartShopping}
                style={{ flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: '#7B1FA2', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff' }}>ออกบ้านเลย 🛍️</Text>
              </Pressable>
            </View>
            <View style={{ height: insets.bottom + 8 }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
