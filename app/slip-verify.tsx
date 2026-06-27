import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert, Image, ScrollView } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { api } from '@/lib/api/client';
import type { SlipVerifyResponse } from '@/lib/api/contract';
import { formatCurrency } from '@/lib/format';
import { useSnackbar } from '@/components/ui/SnackbarProvider';

export default function SlipVerifyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const { requestId: prefilledId } = useLocalSearchParams<{ requestId?: string }>();

  const [slipUri, setSlipUri] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<SlipVerifyResponse | null>(null);
  const [linkedRequestId] = useState(prefilledId ?? '');

  async function pickSlip() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('ขออนุญาต', 'กรุณาอนุญาตการเข้าถึงคลังรูปภาพ'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!res.canceled && res.assets[0]) {
      setSlipUri(res.assets[0].uri);
      setResult(null);
    }
  }

  async function takeSlipPhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('ขออนุญาต', 'กรุณาอนุญาตการเข้าถึงกล้อง'); return; }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!res.canceled && res.assets[0]) {
      setSlipUri(res.assets[0].uri);
      setResult(null);
    }
  }

  async function handleVerify() {
    if (!slipUri) return;
    setVerifying(true);
    try {
      // อ่านไฟล์เป็น base64
      const base64 = await FileSystem.readAsStringAsync(slipUri, { encoding: FileSystem.EncodingType.Base64 });
      // Mock: ใช้ requestId แรกที่มีสถานะ pending (จริงควรให้ user เลือก)
      const result = await api.verifySlip({ requestId: linkedRequestId || 'req-mock', slipImageBase64: base64 });
      if (result.ok) {
        setResult(result.data);
        if (result.data.verified) {
          showSnackbar({ title: '✅ ยืนยันสลิปสำเร็จ', message: `ยอด ${formatCurrency(result.data.amount ?? 0)}฿ · Ref: ${result.data.refId}`, variant: 'success', durationMs: 5000 });
        }
      } else {
        showSnackbar({ message: result.message, variant: 'error' });
      }
    } catch (e) {
      showSnackbar({ message: 'เกิดข้อผิดพลาดในการอ่านสลิป', variant: 'error' });
    } finally {
      setVerifying(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#EFF6FF' }}>
      <Stack.Screen options={{ headerShown: false }} />

      <LinearGradient colors={['#1D4ED8', '#2563EB', '#3B82F6']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 8, paddingBottom: 20, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => router.back()} style={{ padding: 6, marginRight: 8 }}>
            <Text style={{ fontSize: 20, color: '#fff' }}>←</Text>
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff' }}>📄 ยืนยันสลิป</Text>
        </View>
        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 4, marginLeft: 38 }}>
          {linkedRequestId
            ? `อ้างอิง: ${linkedRequestId.slice(0, 8).toUpperCase()} · อัปโหลดสลิปเพื่อยืนยัน`
            : 'อัปโหลดสลิปเพื่อยืนยันการชำระเงิน'}
        </Text>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 80 }}>

        {/* Upload area */}
        <View style={{ backgroundColor: '#fff', borderRadius: 18, padding: 20,
          elevation: 1, shadowColor: '#2563EB', shadowOpacity: 0.08, shadowRadius: 8, marginBottom: 16 }}>

          {slipUri ? (
            <View style={{ alignItems: 'center' }}>
              <Image source={{ uri: slipUri }}
                style={{ width: '100%', height: 280, borderRadius: 12, resizeMode: 'contain', backgroundColor: '#F8FAFC' }} />
              <Pressable onPress={() => { setSlipUri(null); setResult(null); }}
                style={{ marginTop: 10 }}>
                <Text style={{ fontSize: 13, color: '#9CA3AF' }}>เลือกสลิปใหม่</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
              <Text style={{ fontSize: 48, marginBottom: 12 }}>📱</Text>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#333', marginBottom: 20 }}>
                เลือกรูปสลิปโอนเงิน
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
                <Pressable onPress={takeSlipPhoto}
                  style={{ flex: 1, backgroundColor: '#EFF6FF', borderRadius: 14, padding: 14,
                    alignItems: 'center', borderWidth: 1.5, borderColor: '#BFDBFE' }}>
                  <Text style={{ fontSize: 22, marginBottom: 4 }}>📷</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#1D4ED8' }}>ถ่ายรูป</Text>
                </Pressable>
                <Pressable onPress={pickSlip}
                  style={{ flex: 1, backgroundColor: '#F5F3FF', borderRadius: 14, padding: 14,
                    alignItems: 'center', borderWidth: 1.5, borderColor: '#DDD6FE' }}>
                  <Text style={{ fontSize: 22, marginBottom: 4 }}>🖼</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#7C3AED' }}>คลังรูป</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {/* Verify button */}
        {slipUri && !result && (
          <Pressable onPress={handleVerify} disabled={verifying}
            style={{ backgroundColor: verifying ? '#BFDBFE' : '#2563EB',
              borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 16 }}>
            {verifying
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
                  ✅ ยืนยันสลิปนี้
                </Text>}
          </Pressable>
        )}

        {/* Result */}
        {result && (
          <View style={{ backgroundColor: result.verified ? '#ECFDF5' : '#FEF2F2',
            borderRadius: 18, padding: 20,
            borderWidth: 1.5, borderColor: result.verified ? '#6EE7B7' : '#FCA5A5' }}>
            <Text style={{ fontSize: 18, fontWeight: '900', textAlign: 'center',
              color: result.verified ? '#065F46' : '#7F1D1D', marginBottom: 12 }}>
              {result.verified ? '✅ สลิปถูกต้อง' : '❌ สลิปไม่ผ่านการตรวจสอบ'}
            </Text>
            {result.verified ? (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ color: '#065F46' }}>ยอดเงิน</Text>
                  <Text style={{ fontWeight: '800', color: '#065F46' }}>{formatCurrency(result.amount ?? 0)}฿</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ color: '#065F46' }}>Ref ID</Text>
                  <Text style={{ fontWeight: '700', color: '#065F46' }}>{result.refId}</Text>
                </View>
              </>
            ) : (
              <Text style={{ color: '#7F1D1D', textAlign: 'center' }}>
                {result.errorMessage ?? 'ไม่สามารถยืนยันสลิปได้'}
              </Text>
            )}
          </View>
        )}

        {/* Security note */}
        <View style={{ backgroundColor: '#FFF9C4', borderRadius: 12, padding: 14, marginTop: 16,
          flexDirection: 'row', gap: 10 }}>
          <Text style={{ fontSize: 18 }}>🔒</Text>
          <Text style={{ flex: 1, fontSize: 12, color: '#92400E', lineHeight: 18 }}>
            สลิปของคุณถูกส่งไปตรวจสอบผ่าน server อย่างปลอดภัย ไม่มีการเก็บไฟล์รูปใน server
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
