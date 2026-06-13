import { useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, TextInput, ActivityIndicator,
  Alert, ScrollView, Platform, KeyboardAvoidingView, Dimensions, Share, Clipboard,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { api } from '@/lib/api/client';
import type { PaymentRequest } from '@/lib/api/contract';
import { formatCurrency } from '@/lib/format';
import { useSnackbar } from '@/components/ui/SnackbarProvider';

const QR_SIZE = Math.min(Dimensions.get('window').width - 96, 220);
const BACKEND_URL = 'https://moonoon-paotung.onrender.com';

function formatShareMessage(req: PaymentRequest): string {
  const expDate = new Date(req.expiresAt).toLocaleString('th-TH', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
  const payLink = req.uploadSlipUrl ?? `${BACKEND_URL}/pay/${req.requestId}`;
  return [
    '💳 ขอรับชำระเงิน — หมูนุ่น+เป๋าตุง',
    '',
    `📋 รายการ: ${req.description}`,
    `💰 ยอดชำระ: ฿${formatCurrency(req.amount)}`,
    `🔑 รหัสอ้างอิง: ${req.requestId.slice(0, 8).toUpperCase()}`,
    `⏰ หมดอายุ: ${expDate}`,
    '',
    'กดลิงก์นี้เพื่อดู QR และส่งสลิป:',
    payLink,
  ].join('\n');
}

export default function PaymentQrScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const qrRef = useRef<any>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [amountText, setAmountText] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [request, setRequest] = useState<PaymentRequest | null>(null);
  const [checking, setChecking] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  // ── Auto-polling: ทุก 6 วิ ขณะ pending (หยุดเองใน 3 นาที) ──────────────────
  useEffect(() => {
    if (!request || request.status !== 'pending') {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    const isExpiredNow = new Date(request.expiresAt) < new Date();
    if (isExpiredNow) return;

    pollRef.current = setInterval(async () => {
      try {
        const result = await api.getPaymentRequest(request.requestId);
        if (result.ok && result.data.status !== request.status) {
          setRequest(result.data);
        }
      } catch {}
    }, 6_000);

    const stopTimer = setTimeout(() => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    }, 3 * 60_000);

    return () => {
      clearInterval(pollRef.current!);
      pollRef.current = null;
      clearTimeout(stopTimer);
    };
  }, [request?.requestId, request?.status]);

  // ── Countdown 5 วิ เมื่อ paid → กลับหน้าหลัก ────────────────────────────────
  useEffect(() => {
    if (request?.status !== 'paid') { setCountdown(null); return; }
    setCountdown(5);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          router.back();
          return null;
        }
        return prev - 1;
      });
    }, 1_000);
    return () => clearInterval(interval);
  }, [request?.status]);

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
      if (result.ok) setRequest(result.data);
    } finally {
      setChecking(false);
    }
  }

  async function handleShare() {
    if (!request) return;
    try {
      await Share.share({ message: formatShareMessage(request) });
    } catch {}
  }

  async function handleCopyLink() {
    if (!request) return;
    const link = request.uploadSlipUrl ?? `${BACKEND_URL}/pay/${request.requestId}`;
    Clipboard.setString(link);
    showSnackbar({ message: 'คัดลอกลิงก์แล้ว', variant: 'success' });
  }

  async function handleSaveQR() {
    if (!qrRef.current) {
      showSnackbar({ message: 'QR ยังไม่พร้อม', variant: 'warning' });
      return;
    }
    try {
      qrRef.current.toDataURL(async (base64: string) => {
        const fileUri = `${FileSystem.cacheDirectory}qr-${shortRef}.png`;
        await FileSystem.writeAsStringAsync(fileUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'image/png',
            dialogTitle: `QR ชำระเงิน ฿${formatCurrency(request!.amount)}`,
          });
        } else {
          showSnackbar({ message: 'บันทึก QR ลงเครื่องแล้ว', variant: 'success' });
        }
      });
    } catch {
      showSnackbar({ message: 'ไม่สามารถบันทึก QR ได้', variant: 'error' });
    }
  }

  function handleNewQR() {
    setRequest(null);
    setAmountText('');
    setDescription('');
  }

  const isExpired = request ? new Date(request.expiresAt) < new Date() : false;
  const msLeft = request ? Math.max(0, new Date(request.expiresAt).getTime() - Date.now()) : 0;
  const minutesLeft = Math.floor(msLeft / 60000);
  const expiryLabel = minutesLeft >= 60 ? `${Math.round(minutesLeft / 60)} ชั่วโมง` : `${minutesLeft} นาที`;
  const shortRef = request ? request.requestId.slice(0, 8).toUpperCase() : '';
  const paymentPageUrl = request ? (request.uploadSlipUrl ?? `${BACKEND_URL}/pay/${request.requestId}`) : '';

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
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff' }}>💳 รับชำระเงิน</Text>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
              PromptPay QR · แชร์ · ยืนยันสลิป
            </Text>
          </View>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 100 }}>

          {!request ? (
            /* ── ฟอร์มสร้าง QR ── */
            <View>
              <View style={{ backgroundColor: '#fff', borderRadius: 18, padding: 20,
                elevation: 1, shadowColor: '#059669', shadowOpacity: 0.1, shadowRadius: 8, marginBottom: 16 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#6B7280', marginBottom: 8 }}>จำนวนเงิน (บาท)</Text>
                <TextInput value={amountText} onChangeText={setAmountText}
                  keyboardType="decimal-pad" placeholder="0.00" selectTextOnFocus
                  placeholderTextColor="#D1D5DB"
                  style={{ backgroundColor: '#F0FDF4', borderRadius: 12, padding: 16,
                    fontSize: 28, fontWeight: '900', color: '#047857', textAlign: 'center',
                    borderWidth: 1.5, borderColor: '#6EE7B7', marginBottom: 16 }} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#6B7280', marginBottom: 8 }}>รายละเอียด</Text>
                <TextInput value={description} onChangeText={setDescription}
                  placeholder="เช่น ค่าบริการ, ค่ารับงาน, ค่าสินค้า"
                  placeholderTextColor="#D1D5DB"
                  style={{ backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14,
                    fontSize: 15, color: '#111', borderWidth: 1, borderColor: '#E5E7EB' }} />
              </View>
              <Pressable onPress={handleCreateQR} disabled={loading}
                style={{ backgroundColor: loading ? '#A7F3D0' : '#059669',
                  borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}>
                {loading ? <ActivityIndicator color="#fff" />
                  : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>สร้าง QR Code 📱</Text>}
              </Pressable>
            </View>

          ) : request.status === 'paid' ? (
            /* ── ✅ Payment Success Screen ── */
            <View>
              <View style={{ backgroundColor: '#ECFDF5', borderRadius: 24, padding: 28,
                alignItems: 'center', marginBottom: 16,
                borderWidth: 2, borderColor: '#6EE7B7',
                elevation: 2, shadowColor: '#059669', shadowOpacity: 0.15, shadowRadius: 12 }}>
                <Text style={{ fontSize: 64, marginBottom: 8 }}>✅</Text>
                <Text style={{ fontSize: 22, fontWeight: '900', color: '#065F46', marginBottom: 4 }}>
                  ชำระเงินเรียบร้อยแล้ว
                </Text>
                <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 20, textAlign: 'center' }}>
                  ระบบตรวจสอบสลิปสำเร็จ — รอบนี้ปิดเรียบร้อย
                </Text>

                <View style={{ width: '100%', backgroundColor: '#fff', borderRadius: 14,
                  padding: 16, gap: 8 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, color: '#6B7280', fontWeight: '600' }}>รายการ</Text>
                    <Text style={{ fontSize: 13, color: '#111', fontWeight: '700', flex: 1, textAlign: 'right' }}>
                      {request.description}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, color: '#6B7280', fontWeight: '600' }}>ยอดชำระ</Text>
                    <Text style={{ fontSize: 20, color: '#047857', fontWeight: '900' }}>
                      ฿{formatCurrency(request.amount)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, color: '#6B7280', fontWeight: '600' }}>รหัสอ้างอิง</Text>
                    <Text style={{ fontSize: 13, color: '#047857', fontWeight: '800', letterSpacing: 2 }}>
                      {shortRef}
                    </Text>
                  </View>
                  {request.refId && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 13, color: '#6B7280', fontWeight: '600' }}>ธุรกรรม</Text>
                      <Text style={{ fontSize: 11, color: '#6B7280', flex: 1, textAlign: 'right' }}>
                        {request.refId}
                      </Text>
                    </View>
                  )}
                </View>

                {countdown !== null && (
                  <Text style={{ marginTop: 16, fontSize: 13, color: '#6B7280' }}>
                    กลับหน้าหลักใน {countdown} วินาที...
                  </Text>
                )}
              </View>

              <Pressable onPress={handleNewQR}
                style={{ backgroundColor: '#059669', borderRadius: 16, paddingVertical: 15,
                  alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>📱 สร้างรายการใหม่</Text>
              </Pressable>
              <Pressable onPress={() => router.back()}
                style={{ paddingVertical: 12, alignItems: 'center' }}>
                <Text style={{ color: '#6B7280', fontSize: 13 }}>กลับหน้าหลัก</Text>
              </Pressable>
            </View>

          ) : isExpired ? (
            /* ── EXPIRED Screen ── */
            <View>
              <View style={{ backgroundColor: '#FEF2F2', borderRadius: 24, padding: 28,
                alignItems: 'center', marginBottom: 16,
                borderWidth: 2, borderColor: '#FCA5A5' }}>
                <Text style={{ fontSize: 56, marginBottom: 8 }}>⏰</Text>
                <Text style={{ fontSize: 20, fontWeight: '900', color: '#7F1D1D', marginBottom: 4 }}>
                  QR หมดอายุแล้ว
                </Text>
                <Text style={{ fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 20 }}>
                  {request.description}{'\n'}
                  ยอด ฿{formatCurrency(request.amount)} · รหัส {shortRef}
                </Text>
                <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 12, textAlign: 'center' }}>
                  สร้าง QR ใหม่เพื่อรับชำระในรอบถัดไป
                </Text>
              </View>

              <Pressable onPress={handleNewQR}
                style={{ backgroundColor: '#059669', borderRadius: 16, paddingVertical: 15,
                  alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>📱 สร้าง QR ใหม่</Text>
              </Pressable>
              <Pressable onPress={() => router.back()}
                style={{ paddingVertical: 12, alignItems: 'center' }}>
                <Text style={{ color: '#9CA3AF', fontSize: 13 }}>กลับหน้าหลัก</Text>
              </Pressable>
            </View>

          ) : (
            /* ── PENDING QR Screen ── */
            <View>
              {/* Status Badge */}
              <View style={{ borderRadius: 14, paddingVertical: 10, paddingHorizontal: 16,
                marginBottom: 14, alignItems: 'center',
                backgroundColor: '#FFF9C4', borderWidth: 1.5, borderColor: '#FDE68A' }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#92400E' }}>
                  {`⏳ รอชำระ · หมดอายุใน ${expiryLabel}`}
                </Text>
                <Text style={{ fontSize: 11, color: '#92400E', marginTop: 2 }}>
                  ระบบตรวจสอบอัตโนมัติ — ไม่ต้องกดรอ
                </Text>
              </View>

              {/* QR Card */}
              <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 20,
                alignItems: 'center', marginBottom: 14,
                elevation: 2, shadowColor: '#059669', shadowOpacity: 0.1, shadowRadius: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 2 }}>
                  {request.description}
                </Text>
                <Text style={{ fontSize: 32, fontWeight: '900', color: '#047857', marginBottom: 14 }}>
                  ฿{formatCurrency(request.amount)}
                </Text>
                <View style={{ padding: 12, backgroundColor: '#fff', borderRadius: 12,
                  borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 14 }}>
                  <QRCode
                    value={request.qrPayload}
                    size={QR_SIZE}
                    color="#000"
                    backgroundColor="#fff"
                    getRef={(ref) => { qrRef.current = ref; }}
                    logo={require('@/assets/logo/logo-moonoon-paotung.png')}
                    logoSize={QR_SIZE * 0.14}
                    logoBackgroundColor="#fff"
                    logoBorderRadius={6}
                    logoMargin={2}
                    quietZone={8}
                  />
                </View>
                <Text style={{ fontSize: 11, color: '#9CA3AF' }}>PromptPay: {request.promptPayId}</Text>
                <View style={{ marginTop: 10, backgroundColor: '#F0FDF4', borderRadius: 10,
                  paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#6EE7B7' }}>
                  <Text style={{ fontSize: 10, color: '#6B7280', textAlign: 'center' }}>รหัสอ้างอิงธุรกรรม</Text>
                  <Text style={{ fontSize: 14, fontWeight: '900', color: '#047857', textAlign: 'center', letterSpacing: 2 }}>
                    {shortRef}
                  </Text>
                </View>
              </View>

              {/* ── Share Section ── */}
              <View style={{ backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 14,
                elevation: 1, shadowColor: '#059669', shadowOpacity: 0.08, shadowRadius: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#374151', marginBottom: 12 }}>
                  📤 แชร์ให้ผู้ชำระเงิน
                </Text>

                {/* Primary: แชร์ข้อความ + ลิงก์ */}
                <Pressable onPress={handleShare}
                  style={{ backgroundColor: '#059669', borderRadius: 14, paddingVertical: 13,
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                    gap: 8, marginBottom: 8 }}>
                  <Text style={{ fontSize: 18 }}>📲</Text>
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>
                    แชร์รายละเอียด + ลิงก์
                  </Text>
                </Pressable>

                {/* Secondary: คัดลอกลิงก์ */}
                <Pressable onPress={handleCopyLink}
                  style={{ backgroundColor: '#F0FDF4', borderRadius: 14, paddingVertical: 11,
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                    gap: 8, marginBottom: 8, borderWidth: 1, borderColor: '#6EE7B7' }}>
                  <Text style={{ fontSize: 16 }}>📋</Text>
                  <Text style={{ color: '#047857', fontWeight: '700', fontSize: 14 }}>
                    คัดลอกลิงก์ชำระเงิน
                  </Text>
                </Pressable>

                {/* Tertiary: บันทึก QR รูปภาพ */}
                <Pressable onPress={handleSaveQR}
                  style={{ backgroundColor: '#F9FAFB', borderRadius: 14, paddingVertical: 11,
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                    gap: 8, borderWidth: 1, borderColor: '#E5E7EB' }}>
                  <Text style={{ fontSize: 16 }}>🖼</Text>
                  <Text style={{ color: '#374151', fontWeight: '600', fontSize: 13 }}>
                    บันทึก QR เป็นรูปภาพ
                  </Text>
                </Pressable>
              </View>

              {/* ── Reassurance after share ── */}
              <View style={{ backgroundColor: '#F0FDF4', borderRadius: 14, padding: 14,
                marginBottom: 14, borderWidth: 1, borderColor: '#6EE7B7' }}>
                <Text style={{ fontSize: 12, color: '#065F46', lineHeight: 18, textAlign: 'center' }}>
                  💡 เมื่อลูกค้าโอนและส่งสลิปที่ลิงก์แล้ว{'\n'}ระบบจะตรวจสอบให้อัตโนมัติ — ไม่ต้องทำอะไรเพิ่ม
                </Text>
              </View>

              {/* Fallback: ตรวจสอบสถานะด้วยตนเอง */}
              <Pressable onPress={handleCheckStatus} disabled={checking}
                style={{ backgroundColor: 'transparent', borderRadius: 14, paddingVertical: 12,
                  alignItems: 'center', marginBottom: 8,
                  borderWidth: 1, borderColor: '#D1D5DB' }}>
                {checking ? <ActivityIndicator color="#6B7280" />
                  : <Text style={{ color: '#6B7280', fontWeight: '600', fontSize: 13 }}>
                      🔄 ตรวจสอบสถานะด้วยตนเอง
                    </Text>}
              </Pressable>

              <Pressable onPress={handleNewQR}
                style={{ paddingVertical: 12, alignItems: 'center' }}>
                <Text style={{ color: '#9CA3AF', fontSize: 13 }}>+ สร้าง QR ใหม่</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
