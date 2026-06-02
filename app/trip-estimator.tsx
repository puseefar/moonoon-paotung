import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  ActivityIndicator, Modal, Platform, KeyboardAvoidingView, Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { tripEstimatorService, TRIP_TEMPLATES } from '@/services/tripEstimatorService';
import type { TripSession } from '@/db/schema';
import { formatCurrency, formatDate } from '@/lib/format';
import { useSnackbar } from '@/components/ui/SnackbarProvider';

export default function TripEstimatorScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showSnackbar } = useSnackbar();

  const [allActiveSessions, setAllActiveSessions] = useState<TripSession[]>([]);
  const [doneSessions, setDoneSessions] = useState<TripSession[]>([]);
  const [loading, setLoading] = useState(true);

  // Create modal
  const [showModal, setShowModal] = useState(false);
  const [tripName, setTripName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(TRIP_TEMPLATES[0]);
  const [creating, setCreating] = useState(false);
  const [carryForwardItems, setCarryForwardItems] = useState<{ itemName: string; estimatedPrice: number; unit: string | null }[]>([]);
  const [includeCarryForward, setIncludeCarryForward] = useState(true);
  const [duplicating, setDuplicating] = useState(false);

  const load = useCallback(async () => {
    const [active, done] = await Promise.all([
      tripEstimatorService.getActiveSessions(),
      tripEstimatorService.getDoneSessions(),
    ]);
    setAllActiveSessions(active);
    setDoneSessions(done.slice(0, 10));
    setLoading(false);
  }, []);

  async function handleSelectTemplate(t: typeof TRIP_TEMPLATES[0]) {
    setSelectedTemplate(t);
    if (t.id !== 'blank') {
      const items = await tripEstimatorService.getCarryForwardItems(t.id);
      setCarryForwardItems(items);
      setIncludeCarryForward(items.length > 0);
    } else {
      setCarryForwardItems([]);
    }
  }

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  async function handleCreate() {
    const name = tripName.trim() || selectedTemplate.name;
    setCreating(true);
    try {
      const sessionId = await tripEstimatorService.createSession(name, selectedTemplate.id, {
        carryForwardItems: includeCarryForward ? carryForwardItems : [],
      });
      setShowModal(false);
      setTripName('');
      setSelectedTemplate(TRIP_TEMPLATES[0]);
      setCarryForwardItems([]);
      router.push({ pathname: '/trip-session' as any, params: { sessionId } });
    } finally {
      setCreating(false);
    }
  }

  async function handleDuplicate(session: TripSession) {
    setDuplicating(true);
    try {
      const newId = await tripEstimatorService.duplicateSession(session.id);
      load();
      router.push({ pathname: '/trip-session' as any, params: { sessionId: newId } });
    } finally {
      setDuplicating(false);
    }
  }

  function handleDelete(session: TripSession) {
    Alert.alert('ลบทริป', `ต้องการลบ "${session.name}" หรือไม่?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'ลบ', style: 'destructive', onPress: async () => { await tripEstimatorService.deleteSession(session.id); load(); } },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#FFF9F0' }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Gradient Header */}
      <LinearGradient
        colors={['#4A148C', '#6A1B9A', '#7B1FA2']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 8, paddingBottom: 20, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: '#fff', flex: 1 }}>🛒 เตรียมงบก่อนออก</Text>
          <Pressable
            onPress={() => setShowModal(true)}
            style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>+ ทริปใหม่</Text>
          </Pressable>
        </View>
        {!loading && (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 10, alignItems: 'center' }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#fff' }}>
                {allActiveSessions.filter(s => s.status === 'planning').length}
              </Text>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>วางแผน</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 10, alignItems: 'center' }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#FFE082' }}>
                {allActiveSessions.filter(s => s.status === 'active').length}
              </Text>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>🛍️ ซื้ออยู่</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 10, alignItems: 'center' }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#A5D6A7' }}>{doneSessions.length}</Text>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>เสร็จแล้ว</Text>
            </View>
          </View>
        )}
      </LinearGradient>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#7B1FA2" />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>

          {allActiveSessions.length === 0 && doneSessions.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 48 }}>
              <Text style={{ fontSize: 52, marginBottom: 12 }}>🛒</Text>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#333', marginBottom: 8 }}>ยังไม่มีทริปวางแผน</Text>
              <Text style={{ fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 22, marginBottom: 24 }}>
                สร้าง shopping list ก่อนออกไปซื้อของ{'\n'}ประมาณงบ เทียบจ่ายจริง จำราคาไว้ครั้งหน้า
              </Text>
              <Pressable onPress={() => setShowModal(true)} style={{ backgroundColor: '#7B1FA2', borderRadius: 16, paddingHorizontal: 24, paddingVertical: 14 }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>สร้างทริปแรก</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {/* กำลังซื้ออยู่ */}
              {allActiveSessions.filter(s => s.status === 'active').length > 0 && (
                <>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#E65100', marginBottom: 10 }}>
                    🛍️ กำลังซื้ออยู่ ({allActiveSessions.filter(s => s.status === 'active').length})
                  </Text>
                  {allActiveSessions.filter(s => s.status === 'active').map((s) => (
                    <Pressable key={s.id}
                      onPress={() => router.push({ pathname: '/trip-session' as any, params: { sessionId: s.id } })}
                      style={{ backgroundColor: '#FFF8E7', borderRadius: 16, padding: 16, marginBottom: 10, elevation: 2, shadowColor: '#E65100', shadowOpacity: 0.12, shadowRadius: 6, borderWidth: 1, borderColor: '#FFE082' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFE082', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                          <Text style={{ fontSize: 22 }}>{TRIP_TEMPLATES.find(t => t.id === s.templateId)?.icon ?? '🛒'}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 15, fontWeight: '800', color: '#333' }}>{s.name}</Text>
                          <Text style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                            {formatDate(s.createdAt as Date)} · ประมาณ {formatCurrency(s.estimatedBudget ?? 0)} บาท
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <View style={{ backgroundColor: '#E65100', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 4 }}>
                            <Text style={{ fontSize: 11, color: '#fff', fontWeight: '700' }}>ซื้ออยู่</Text>
                          </View>
                          <Pressable onPress={() => handleDelete(s)}>
                            <Text style={{ fontSize: 11, color: '#FFCDD2' }}>ลบ</Text>
                          </Pressable>
                        </View>
                      </View>
                    </Pressable>
                  ))}
                </>
              )}

              {/* กำลังวางแผน */}
              {allActiveSessions.filter(s => s.status === 'planning').length > 0 && (
                <>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#7B1FA2', marginBottom: 10, marginTop: allActiveSessions.some(s => s.status === 'active') ? 8 : 0 }}>
                    📋 กำลังวางแผน ({allActiveSessions.filter(s => s.status === 'planning').length})
                  </Text>
                  {allActiveSessions.filter(s => s.status === 'planning').map((s) => (
                    <Pressable key={s.id}
                      onPress={() => router.push({ pathname: '/trip-session' as any, params: { sessionId: s.id } })}
                      style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#F3E5F5', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                          <Text style={{ fontSize: 22 }}>
                            {TRIP_TEMPLATES.find((t) => t.id === s.templateId)?.icon ?? '🛒'}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 15, fontWeight: '800', color: '#333' }}>{s.name}</Text>
                          <Text style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                            {formatDate(s.createdAt as Date)} · ประมาณ {formatCurrency(s.estimatedBudget ?? 0)} บาท
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ fontSize: 13, color: '#7B1FA2', fontWeight: '700' }}>เปิด →</Text>
                          <Pressable onPress={() => handleDelete(s)} style={{ marginTop: 4 }}>
                            <Text style={{ fontSize: 11, color: '#FFCDD2' }}>ลบ</Text>
                          </Pressable>
                        </View>
                      </View>
                    </Pressable>
                  ))}
                </>
              )}

              {doneSessions.length > 0 && (
                <>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#4CAF50', marginBottom: 10, marginTop: 8 }}>
                    ✅ เสร็จแล้ว
                  </Text>
                  {doneSessions.map((s) => (
                    <View key={s.id} style={{ backgroundColor: '#F9FBE7', borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: '#E8F5E9', overflow: 'hidden' }}>
                      <Pressable
                        onPress={() => router.push({ pathname: '/trip-session' as any, params: { sessionId: s.id } })}
                        style={{ padding: 14 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={{ fontSize: 20, marginRight: 10 }}>
                            {TRIP_TEMPLATES.find((t) => t.id === s.templateId)?.icon ?? '✅'}
                          </Text>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, fontWeight: '700', color: '#333' }}>{s.name}</Text>
                            <Text style={{ fontSize: 11, color: '#888', marginTop: 1 }}>
                              {s.completedAt ? formatDate(s.completedAt as Date) : '-'} · ใช้จ่าย {formatCurrency(s.actualSpent ?? 0)} บาท
                            </Text>
                          </View>
                          <View style={{ backgroundColor: '#E8F5E9', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                            <Text style={{ fontSize: 11, color: '#2E7D32', fontWeight: '700' }}>เสร็จ</Text>
                          </View>
                        </View>
                      </Pressable>
                      {/* Duplicate button */}
                      <Pressable
                        onPress={() => handleDuplicate(s)}
                        disabled={duplicating}
                        style={{ borderTopWidth: 1, borderTopColor: '#E8F5E9', paddingVertical: 9, alignItems: 'center', backgroundColor: duplicating ? '#F5F5F5' : '#FAFFF0' }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: duplicating ? '#AAA' : '#7B1FA2' }}>
                          {duplicating ? '⏳ กำลังคัดลอก...' : '🔄 ทำทริปนี้ซ้ำ'}
                        </Text>
                      </Pressable>
                    </View>
                  ))}
                </>
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* ── Create Trip Modal ── */}
      <Modal visible={showModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' }} />
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#333' }}>🛒 สร้างทริปใหม่</Text>
                <Pressable onPress={() => setShowModal(false)}><Text style={{ fontSize: 22, color: '#BBB' }}>✕</Text></Pressable>
              </View>

              <Text style={{ fontSize: 12, fontWeight: '700', color: '#888', marginBottom: 8 }}>เลือกประเภท</Text>
              <View style={{ gap: 8, marginBottom: 16 }}>
                {TRIP_TEMPLATES.map((t) => (
                  <Pressable
                    key={t.id}
                    onPress={() => handleSelectTemplate(t)}
                    style={{
                      flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12,
                      borderWidth: 1.5, borderColor: selectedTemplate.id === t.id ? t.color : '#E8E8E8',
                      backgroundColor: selectedTemplate.id === t.id ? t.color + '10' : '#fff',
                    }}>
                    <Text style={{ fontSize: 22, marginRight: 12 }}>{t.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: selectedTemplate.id === t.id ? t.color : '#333' }}>{t.name}</Text>
                      <Text style={{ fontSize: 11, color: '#888', marginTop: 1 }}>{t.description}</Text>
                    </View>
                    {selectedTemplate.id === t.id && <Text style={{ fontSize: 16, color: t.color }}>✓</Text>}
                  </Pressable>
                ))}
              </View>

              {/* Carry-Forward Banner */}
              {carryForwardItems.length > 0 && (
                <Pressable onPress={() => setIncludeCarryForward(!includeCarryForward)}
                  style={{ backgroundColor: includeCarryForward ? '#E8F5E9' : '#F5F5F5', borderRadius: 12, padding: 12, marginBottom: 14,
                    borderWidth: 1, borderColor: includeCarryForward ? '#66BB6A' : '#E0E0E0', flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                  <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, marginTop: 1,
                    borderColor: includeCarryForward ? '#2E7D32' : '#DDD',
                    backgroundColor: includeCarryForward ? '#2E7D32' : '#fff',
                    justifyContent: 'center', alignItems: 'center' }}>
                    {includeCarryForward && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>✓</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: includeCarryForward ? '#2E7D32' : '#888' }}>
                      🔄 ยกรายการที่ยังไม่ได้ซื้อ ({carryForwardItems.length} รายการ)
                    </Text>
                    <Text style={{ fontSize: 11, color: '#888', marginTop: 3 }}>
                      {carryForwardItems.slice(0, 3).map(i => i.itemName).join(' · ')}
                      {carryForwardItems.length > 3 ? ` +${carryForwardItems.length - 3}` : ''}
                    </Text>
                  </View>
                </Pressable>
              )}

              <Text style={{ fontSize: 12, fontWeight: '700', color: '#888', marginBottom: 6 }}>ชื่อทริป (ไม่บังคับ)</Text>
              <TextInput
                value={tripName}
                onChangeText={setTripName}
                placeholder={selectedTemplate.name}
                placeholderTextColor="#CCC"
                style={{ backgroundColor: '#F5F0FF', borderRadius: 12, padding: 14, fontSize: 15, color: '#333', marginBottom: 16, borderWidth: 1, borderColor: '#CE93D8' }}
              />

              <Pressable onPress={handleCreate} disabled={creating} style={{ backgroundColor: creating ? '#CE93D8' : '#7B1FA2', borderRadius: 14, paddingVertical: 16, alignItems: 'center' }}>
                {creating ? <ActivityIndicator color="#fff" /> : <Text style={{ fontSize: 15, fontWeight: '800', color: '#fff' }}>เริ่มวางแผน →</Text>}
              </Pressable>
              <View style={{ height: insets.bottom + 8 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
