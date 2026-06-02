import { useState } from 'react';
import {
  View, Text, Pressable, TextInput, ActivityIndicator,
  Alert, ScrollView, Platform, KeyboardAvoidingView, Dimensions,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { api } from '@/lib/api/client';
import type { PaymentRequest } from '@/lib/api/contract';
import { formatCurrency } from '@/lib/format';
import { useSnackbar } from '@/components/ui/SnackbarProvider';

const QR_SIZE = Math.min(Dimensions.get('window').width - 96, 220);

export default function PaymentQrScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showSnackbar } = useSnackbar();

  const [amountText, setAmountText] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [request, setRequest] = useState<PaymentRequest | null>(null);
  const [checking, setChecking] = useState(false);

  async function handleCreateQR() {
    const amount = parseFloat(amountText.replace(/,/g, ''));
    if (!amount || amount <= 0) {
      Alert.alert('ระบุยอดเงิน', 'กรุณาใส่จำนวนเงินที่ถูกต้อง');
      return;
    }
    setLoading(true);
    try {
      const result = await api.createPaymentRequest({ amount, description: description.trim() || 'ชำระเงิน' });
      if (!result.ok) { showSnackbar({ message: result.message, variant: 'error' }); return; }
      setRequest(result.data);
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckStatus() {
    if (!request) return;
    setChecking(true);
    try {
      const result = await api.getPaymentRequest(request.requestId);
      if (result.ok) {
        setRequest(result.data);
        if (result.data.status === 'paid') {
          showSnackbar({ title: '✅ ชำระเงินสำเร็จ', message: `${formatCurrency(result.data.amount)}฿ — ref: ${result.data.refId}`, variant: 'success', durationMs: 5000 });
        }
      }
    } finally {
      setChecking(false);
    }
  }

  const isExpired = request && new Date(request.expiresAt) < new Date();
  const minutesLeft = request
    ? Math.max(0, Math.floor((new Date(request.expiresAt).getTime() - Date.now()) / 60000))
    : 0;

  return (
    <View style={{ flex: 1, backgroundColor: '#F0FDF4' }}>
      <Stack.Screen options={{ headerShown: false }} />

      <LinearGradient colors={['#047857', '#059669', '#10B981']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 8, paddingBottom: 20, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => router.back()} style={{ padding: 6, marginRight: 8 }}>
            <Text style={{ fontSize: 20, color: '#fff' }}>←</Text>
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff' }}>💳 รับชำระเงิน</Text>
        </View>
        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 4, marginLeft: 38 }}>
          สร้าง PromptPay QR + ยืนยันสลิป
        </Text>
      </LinearGradient>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 100 }}>

          {!request ? (
            /* ── สร้าง QR ── */
            <View>
              <View style={{ backgroundColor: '#fff', borderRadius: 18, padding: 20,
                elevation: 1, shadowColor: '#059669', shadowOpacity: 0.1, shadowRadius: 8, marginBottom: 16 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#6B7280', marginBottom: 8 }}>
                  จำนวนเงิน (บาท)
                </Text>
                <TextInput value={amountText} onChangeText={setAmountText}
                  keyboardType="decimal-pad" placeholder="0.00"
                  selectTextOnFocus placeholderTextColor="#D1D5DB"
                  style={{ backgroundColor: '#F0FDF4', borderRadius: 12, padding: 16,
                    fontSize: 28, fontWeight: '900', color: '#047857', textAlign: 'center',
                    borderWidth: 1.5, borderColor: '#6EE7B7', marginBottom: 16 }} />

                <Text style={{ fontSize: 13, fontWeight: '700', color: '#6B7280', marginBottom: 8 }}>
                  รายละเอียด (ไม่บังคับ)
                </Text>
                <TextInput value={description} onChangeText={setDescription}
                  placeholder="เช่น ค่าสินค้า, ค่าบริการ"
                  placeholderTextColor="#D1D5DB"
                  style={{ backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14,
                    fontSize: 15, color: '#111', borderWidth: 1, borderColor: '#E5E7EB' }} />
              </View>

              <Pressable onPress={handleCreateQR} disabled={loading}
                style={{ backgroundColor: loading ? '#A7F3D0' : '#059669',
                  borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}>
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
                      สร้าง QR Code 📱
                    </Text>}
              </Pressable>
            </View>
          ) : (
            /* ── แสดง QR ── */
            <View>
              {/* Status banner */}
              <View style={{ borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16,
                marginBottom: 16, alignItems: 'center',
                backgroundColor: request.status === 'paid' ? '#ECFDF5'
                  : isExpired ? '#FEF2F2' : '#FFF9C4',
                borderWidth: 1.5,
                borderColor: request.status === 'paid' ? '#6EE7B7'
                  : isExpired ? '#FCA5A5' : '#FDE68A' }}>
                <Text style={{ fontSize: 16, fontWeight: '800',
                  color: request.status === 'paid' ? '#065F46'
                    : isExpired ? '#7F1D1D' : '#92400E' }}>
                  {request.status === 'paid' ? '✅ ชำระแล้ว'
                    : isExpired ? '❌ หมดอายุแล้ว'
                    : `⏳ รอชำระ · หมดอายุใน ${minutesLeft} นาที`}
                </Text>
              </View>

              {/* QR */}
              <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 24,
                alignItems: 'center', marginBottom: 16,
                elevation: 2, shadowColor: '#059669', shadowOpacity: 0.1, shadowRadius: 8 }}>
                <View style={{ padding: 12, backgroundColor: '#fff', borderRadius: 12,
                  borderWidth: 1, borderColor: '#E5E7EB' }}>
                  <QRCode
                    value={request.qrPayload}
                    size={QR_SIZE}
                    color="#000"
                    backgroundColor="#fff"
                    logo={undefined}
                  />
                </View>
                <View style={{ marginTop: 16, alignItems: 'center' }}>
                  <Text style={{ fontSize: 28, fontWeight: '900', color: '#047857' }}>
                    ฿{formatCurrency(request.amount)}
                  </Text>
                  <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 4 }}>
                    {request.description}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6 }}>
                    PromptPay: {request.promptPayId}
                  </Text>
                </View>
              </View>

              {/* Actions */}
              {request.status === 'pending' && !isExpired && (
                <Pressable onPress={handleCheckStatus} disabled={checking}
                  style={{ backgroundColor: checking ? '#D1FAE5' : '#059669',
                    borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 10 }}>
                  {checking
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                        🔄 ตรวจสอบสถานะ
                      </Text>}
                </Pressable>
              )}

              <Pressable onPress={() => router.push('/slip-verify' as any)}
                style={{ backgroundColor: '#EFF6FF', borderRadius: 14, paddingVertical: 14,
                  alignItems: 'center', marginBottom: 10,
                  borderWidth: 1.5, borderColor: '#BFDBFE' }}>
                <Text style={{ color: '#1D4ED8', fontWeight: '700', fontSize: 15 }}>
                  📄 อัปโหลดสลิปเพื่อยืนยัน
                </Text>
              </Pressable>

              <Pressable onPress={() => setRequest(null)}
                style={{ paddingVertical: 12, alignItems: 'center' }}>
                <Text style={{ color: '#9CA3AF', fontSize: 13 }}>สร้าง QR ใหม่</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
