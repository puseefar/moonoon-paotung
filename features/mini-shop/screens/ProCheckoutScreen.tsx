import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, Pressable, ScrollView, ActivityIndicator,
  Alert, Image, StyleSheet, Dimensions, Clipboard, Share,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { api } from '@/lib/api/client';
import { useSnackbar } from '@/components/ui/SnackbarProvider';
import type { Order, PaymentRequest, Shop } from '@/lib/api/contract';

const QR_SIZE = Math.min(Dimensions.get('window').width - 80, 200);

// ── Countdown hook ─────────────────────────────────────────
function useCountdown(expiresAt?: string): { mm: string; ss: string; expired: boolean; pct: number } {
  const TOTAL_MS = 30 * 60 * 1000;
  // null = ยังไม่ได้ tick ครั้งแรก (ป้องกัน false "expired" ตอน mount)
  const [remaining, setRemaining] = useState<number | null>(null);
  const ref = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    if (!expiresAt) return;
    function tick() {
      const ms = new Date(expiresAt!).getTime() - Date.now();
      setRemaining(Math.max(0, ms));
    }
    tick();
    ref.current = setInterval(tick, 1000);
    return () => clearInterval(ref.current);
  }, [expiresAt]);

  const r = remaining ?? TOTAL_MS;
  const mm = String(Math.floor(r / 60000)).padStart(2, '0');
  const ss = String(Math.floor((r % 60000) / 1000)).padStart(2, '0');
  const expired = remaining !== null && remaining <= 0 && !!expiresAt;
  const pct = Math.max(0, r / TOTAL_MS);
  return { mm, ss, expired, pct };
}

// ── Step progress bar ──────────────────────────────────────
const STEPS = ['เลือกสินค้า', 'ยืนยันออเดอร์', 'ชำระเงิน', 'สำเร็จ'];

function StepsBar({ currentStep }: { currentStep: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
      paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0EAF8' }}>
      {STEPS.map((label, i) => {
        const done = i < currentStep;
        const active = i === currentStep;
        return (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <View style={{ alignItems: 'center' }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: done ? '#7C3AED' : active ? 'rgba(124,58,237,0.1)' : '#F0EAF8',
                borderWidth: active ? 2 : 0, borderColor: '#7C3AED' }}>
                <Text style={{ fontSize: 10, fontWeight: '800',
                  color: done ? '#fff' : active ? '#7C3AED' : '#C4B5D8' }}>
                  {done ? '✓' : active ? '💳' : '○'}
                </Text>
              </View>
              <Text style={{ fontSize: 8.5, fontWeight: '700', marginTop: 3, textAlign: 'center',
                color: done || active ? '#7C3AED' : '#C4B5D8' }}
                numberOfLines={1}>
                {label}
              </Text>
            </View>
            {i < STEPS.length - 1 && (
              <View style={{ flex: 1, height: 2, marginHorizontal: 2, marginBottom: 12,
                backgroundColor: done ? '#7C3AED' : '#F0EAF8' }} />
            )}
          </View>
        );
      })}
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────
export default function ProCheckoutScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();

  const [order, setOrder] = useState<Order | null>(null);
  const [payReq, setPayReq] = useState<PaymentRequest | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);

  const [slipUri, setSlipUri] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [bottomBarH, setBottomBarH] = useState(0); // วัดความสูงแถบล่าง → กันปุ่มบังเนื้อหา

  const { mm, ss, expired, pct } = useCountdown(order?.expiresAt);

  useEffect(() => {
    if (!orderId) return;
    (async () => {
      const [r, sr] = await Promise.all([api.getOrder(orderId), api.getShop()]);
      if (r.ok) {
        setOrder(r.data);
        if (r.data.paymentRequestId) {
          const pr = await api.getPaymentRequest(r.data.paymentRequestId);
          if (pr.ok) setPayReq(pr.data);
        }
      }
      if (sr.ok && sr.data) setShop(sr.data);
      setLoading(false);
    })();
  }, [orderId]);

  // Auto-cancel on expiry
  useEffect(() => {
    if (expired && order && order.status === 'PENDING_PAYMENT') {
      api.updateOrderStatus(order.orderId, 'CANCELLED').then(() => {
        Alert.alert('⏰ หมดเวลา', 'QR Code หมดอายุแล้ว กรุณาสั่งซื้อใหม่', [
          { text: 'ตกลง', onPress: () => router.replace('/shop-storefront' as any) },
        ]);
      });
    }
  }, [expired]);

  async function handlePickSlip() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('', 'กรุณาอนุญาตการเข้าถึงรูปภาพ'); return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!res.canceled) setSlipUri(res.assets[0].uri);
  }

  async function handleCameraSlip() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('', 'กรุณาอนุญาตการใช้กล้อง'); return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!res.canceled) setSlipUri(res.assets[0].uri);
  }

  async function handleVerifySlip() {
    if (!slipUri || !order) return;
    if (!order.paymentRequestId) {
      // Bank payment — manual confirm
      await api.updateOrderStatus(order.orderId, 'VERIFYING_SLIP');
      setVerified(true);
      router.replace({ pathname: '/shop-order-success' as any, params: { orderId: order.orderId } });
      return;
    }
    setVerifying(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(slipUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const result = await api.verifySlip({
        requestId: order.paymentRequestId,
        slipImageBase64: base64,
      });
      if (result.ok && result.data.verified) {
        await api.updateOrderStatus(order.orderId, 'PAID');
        setVerified(true);
        showSnackbar({ message: '✅ ตรวจสลิปสำเร็จ!', variant: 'success' });
        router.replace({ pathname: '/shop-order-success' as any, params: { orderId: order.orderId } });
      } else {
        const code = result.ok ? result.data.errorCode : 'ERROR';
        const msgs: Record<string, string> = {
          DUPLICATE: 'สลิปนี้ถูกใช้แล้ว กรุณาใช้สลิปจากการโอนครั้งล่าสุด',
          AMOUNT_MISMATCH: 'ยอดเงินไม่ตรง กรุณาโอนใหม่ให้ตรงยอดที่แสดงใน QR',
          EXPIRED: 'สลิปหมดอายุ กรุณาติดต่อร้านค้า',
          INVALID: 'สลิปไม่ถูกต้อง กรุณาใช้ภาพสลิปจริงจากแอปธนาคาร',
        };
        Alert.alert('❌ ตรวจสลิปไม่ผ่าน', msgs[code ?? ''] ?? 'กรุณาลองใหม่หรือติดต่อร้านค้า');
        await api.updateOrderStatus(order.orderId, 'SLIP_REJECTED');
      }
    } catch {
      Alert.alert('', 'เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setVerifying(false);
    }
  }

  function handleCopyNumber() {
    const num = order?.paymentMethod === 'promptpay'
      ? (payReq?.promptPayId ?? shop?.promptPayNumber ?? '—')
      : (shop?.accountNumber ?? '—');
    Clipboard.setString(num);
    showSnackbar({ message: '📋 คัดลอกเลขแล้ว', variant: 'success' });
  }

  function handleCopyAmount() {
    if (!order) return;
    Clipboard.setString(order.total.toFixed(2));
    showSnackbar({ message: `📋 คัดลอกยอด ฿${order.total} แล้ว`, variant: 'success' });
  }

  async function handleShareQr() {
    if (!order) return;
    const payUrl = payReq?.uploadSlipUrl;
    const baseMsg = `💳 ชำระเงินออเดอร์ ${order.orderNo}\nยอด: ฿${order.total.toLocaleString()}`;
    await Share.share({
      title: `ชำระเงินออเดอร์ ${order.orderNo}`,
      // ใส่ URL ใน message → Facebook/LINE/Messenger ดึง OG preview (รูป QR + รายละเอียด) อัตโนมัติ
      message: payUrl ? `${baseMsg}\n\n${payUrl}` : `${baseMsg}\nPromptPay: ${payReq?.promptPayId ?? '—'}`,
      url: payUrl, // iOS native share sheet
    } as any);
  }

  if (loading || !order) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F5FF' }}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  const expireTime = order.expiresAt
    ? new Date(order.expiresAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <View style={{ flex: 1, backgroundColor: '#F8F5FF' }}>

      {/* Header */}
      <LinearGradient colors={['#6B21A8', '#9333EA']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{ paddingTop: insets.top + 8, paddingBottom: 12, paddingHorizontal: 16,
          flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={() => router.back()}
          style={{ width: 36, height: 36, backgroundColor: 'rgba(255,255,255,0.18)',
            borderRadius: 12, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 16, color: '#fff' }}>←</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>ชำระเงิน</Text>
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 1 }}>
            สแกน QR แล้วอัปโหลดสลิป
          </Text>
        </View>
        <View style={{ backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 8,
          paddingHorizontal: 8, paddingVertical: 4 }}>
          <Text style={{ fontSize: 12, color: '#fff', fontWeight: '700' }}>🔒 ปลอดภัย</Text>
        </View>
      </LinearGradient>

      {/* Steps */}
      <StepsBar currentStep={2} />

      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 14,
          paddingBottom: (bottomBarH || insets.bottom + 150) + 16, gap: 12 }}>

        {/* Order number + timer */}
        <View style={[styles.card, { flexDirection: 'row', alignItems: 'center' }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 10, color: '#9B7FC8', fontWeight: '700', marginBottom: 4 }}>เลขออเดอร์</Text>
            <Text style={{ fontSize: 14, fontWeight: '900', color: '#2D1B69', fontFamily: 'monospace' }}>
              {order.orderNo}
            </Text>
            <Text style={{ fontSize: 11, color: '#A78BFA', marginTop: 3 }}>
              {order.items.map(i => `${i.name} × ${i.qty}`).join(', ')}
            </Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 10, color: '#9B7FC8', fontWeight: '600', marginBottom: 4 }}>เหลือเวลา</Text>
            <Text style={{
              fontSize: 20, fontWeight: '900', fontFamily: 'monospace',
              color: expired ? '#9CA3AF' : parseInt(mm) < 5 ? '#DC2626' : '#7C3AED',
            }}>
              {mm}:{ss}
            </Text>
            <Text style={{ fontSize: 9, color: '#9B7FC8', fontWeight: '600' }}>นาที</Text>
          </View>
        </View>

        {/* QR Payment card */}
        {order.paymentMethod === 'promptpay' && (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#2D1B69' }}>🏦 PromptPay QR Code</Text>
              <View style={{ backgroundColor: '#EDE9FE', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#6D28D9' }}>QR พร้อมเพย์</Text>
              </View>
            </View>

            {/* QR Code */}
            <View style={{ alignItems: 'center', marginBottom: 14 }}>
              {payReq?.qrPayload ? (
                <View style={{ padding: 12, backgroundColor: '#fff', borderRadius: 16,
                  borderWidth: 2, borderColor: '#EDE9FE',
                  elevation: 2, shadowColor: '#6430C8', shadowOpacity: 0.08, shadowRadius: 8 }}>
                  <QRCode
                    value={payReq.qrPayload}
                    size={QR_SIZE}
                    color="#2D1B69"
                    backgroundColor="#fff"
                  />
                </View>
              ) : (
                <View style={{ width: QR_SIZE, height: QR_SIZE, backgroundColor: '#F3F0FF',
                  borderRadius: 12, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontSize: 40 }}>🏦</Text>
                  <Text style={{ fontSize: 12, color: '#9B7FC8', marginTop: 8 }}>PromptPay QR</Text>
                </View>
              )}

              <View style={{ marginTop: 12, alignItems: 'center' }}>
                <Text style={{ fontSize: 12, color: '#9B7FC8' }}>ยอดที่ต้องชำระ</Text>
                <Text style={{ fontSize: 32, fontWeight: '900', color: '#7C3AED' }}>
                  ฿{order.total.toLocaleString()}
                  <Text style={{ fontSize: 18, color: '#A78BFA' }}>.00</Text>
                </Text>
              </View>
            </View>

            {/* Shop info + copy */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10,
              padding: 10, backgroundColor: '#F8F5FF', borderRadius: 12, marginBottom: 10 }}>
              <View style={{ width: 36, height: 36, backgroundColor: '#7C3AED',
                borderRadius: 10, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 18 }}>🐷</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#2D1B69' }}>
                  ร้าน{order.items[0]?.name.split(' ')[0] ?? '—'}
                </Text>
                <Text style={{ fontSize: 11, color: '#9B7FC8' }}>
                  {payReq?.promptPayId
                    ? payReq.promptPayId.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')
                    : '—'} (PromptPay)
                </Text>
              </View>
              <Pressable onPress={handleCopyNumber}
                style={{ backgroundColor: 'rgba(124,58,237,0.1)', borderRadius: 8,
                  paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1.5,
                  borderColor: 'rgba(124,58,237,0.25)' }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#6D28D9' }}>📋 คัดลอก</Text>
              </Pressable>
            </View>

            {/* QR actions */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={handleShareQr}
                style={[styles.qrActionBtn, { backgroundColor: 'rgba(124,58,237,0.08)',
                  borderColor: 'rgba(124,58,237,0.25)' }]}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#6D28D9' }}>💬 ส่งให้เพื่อน</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Bank fallback card */}
        {order.paymentMethod === 'bank' && (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#2D1B69' }}>🏧 โอนเงินผ่านธนาคาร</Text>
              <View style={{ backgroundColor: '#EDE9FE', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#6D28D9' }}>Mobile Banking</Text>
              </View>
            </View>

            {/* Amount */}
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 12, color: '#9B7FC8' }}>ยอดที่ต้องโอน</Text>
              <Text style={{ fontSize: 36, fontWeight: '900', color: '#7C3AED' }}>
                ฿{order.total.toLocaleString()}
                <Text style={{ fontSize: 20, color: '#A78BFA' }}>.00</Text>
              </Text>
              <Pressable onPress={handleCopyAmount}
                style={{ marginTop: 6, backgroundColor: 'rgba(124,58,237,0.08)',
                  borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5,
                  borderWidth: 1.5, borderColor: 'rgba(124,58,237,0.2)' }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#6D28D9' }}>📋 คัดลอกยอด</Text>
              </Pressable>
            </View>

            {/* Account info */}
            {[
              { label: 'ชื่อบัญชี', val: shop?.accountName ?? '—', canCopy: false },
              { label: 'ธนาคาร', val: shop?.bankName ?? '—', canCopy: false },
              { label: 'เลขบัญชี', val: shop?.accountNumber ?? '—', canCopy: true },
            ].map((row, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center',
                paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#F0EAF8' }}>
                <Text style={{ fontSize: 12, color: '#9B7FC8', width: 90 }}>{row.label}</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#2D1B69', flex: 1 }}>
                  {row.val}
                </Text>
                {row.canCopy && row.val !== '—' && (
                  <Pressable onPress={handleCopyNumber}
                    style={{ backgroundColor: 'rgba(124,58,237,0.08)', borderRadius: 7,
                      paddingHorizontal: 8, paddingVertical: 4,
                      borderWidth: 1.5, borderColor: 'rgba(124,58,237,0.2)' }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#6D28D9' }}>📋</Text>
                  </Pressable>
                )}
              </View>
            ))}

            <View style={{ marginTop: 10, backgroundColor: 'rgba(234,179,8,0.08)',
              borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(234,179,8,0.3)', padding: 9 }}>
              <Text style={{ fontSize: 11, color: '#92400E', lineHeight: 16 }}>
                ⚠️ โอนเงิน <Text style={{ fontWeight: '800' }}>฿{order.total.toLocaleString()}.00 พอดี</Text> แล้วถ่ายสลิปและอัปโหลดด้านล่าง
              </Text>
            </View>
          </View>
        )}

        {/* How to pay */}
        <View style={styles.card}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: '#2D1B69', marginBottom: 10 }}>
            📋 วิธีชำระเงิน
          </Text>
          {(order.paymentMethod === 'promptpay' ? [
            { n: 1, text: 'เปิดแอปธนาคาร → สแกน QR หรือ คัดลอกเบอร์ PromptPay แล้วโอนเงิน' },
            { n: 2, text: `โอนเงิน ฿${order.total.toLocaleString()}.00 พอดี ไม่ต้องบวกสตางค์ (QR กำหนดยอดไว้แล้ว)` },
            { n: 3, text: 'Screenshot สลิป หรือบันทึกสลิปจากแอปธนาคาร' },
            { n: 4, text: 'กด "อัปโหลดสลิป" ด้านล่าง → ระบบตรวจสอบอัตโนมัติ ~30 วินาที' },
          ] : [
            { n: 1, text: `คัดลอกเลขบัญชี "${shop?.accountName ?? '—'}" (${shop?.bankName ?? 'ธนาคาร'}) แล้วโอนเงิน` },
            { n: 2, text: `โอนยอด ฿${order.total.toLocaleString()}.00 พอดี อย่าบวกสตางค์` },
            { n: 3, text: 'บันทึก/ถ่ายรูปสลิปหลังโอนเสร็จ' },
            { n: 4, text: 'กด "อัปโหลดสลิป" ด้านล่าง รอร้านค้ายืนยัน' },
          ]).map(s => (
            <View key={s.n} style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
              <View style={{ width: 22, height: 22, borderRadius: 11,
                backgroundColor: '#7C3AED', justifyContent: 'center', alignItems: 'center',
                flexShrink: 0, marginTop: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#fff' }}>{s.n}</Text>
              </View>
              <Text style={{ fontSize: 12, color: '#4B3A8A', lineHeight: 18, flex: 1 }}>{s.text}</Text>
            </View>
          ))}
        </View>

        {/* Upload slip */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#2D1B69' }}>📤 อัปโหลดสลิปการโอน</Text>
            <View style={{ backgroundColor: '#EDE9FE', borderRadius: 6,
              paddingHorizontal: 7, paddingVertical: 2 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#6D28D9' }}>⚡ PKG-15 Auto</Text>
            </View>
          </View>

          {!slipUri ? (
            <>
              {/* Upload area */}
              <Pressable onPress={handlePickSlip}
                style={{ padding: 20, borderRadius: 14, borderWidth: 2, borderStyle: 'dashed',
                  borderColor: 'rgba(124,58,237,0.3)', backgroundColor: 'rgba(124,58,237,0.03)',
                  alignItems: 'center', marginBottom: 10 }}>
                <Text style={{ fontSize: 36, marginBottom: 8 }}>🧾</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#5B21B6', marginBottom: 4 }}>
                  แตะเพื่อเลือกสลิป
                </Text>
                <Text style={{ fontSize: 12, color: '#9B7FC8', textAlign: 'center' }}>
                  เลือกภาพสลิปจากแกลเลอรีหรือถ่ายภาพใหม่
                </Text>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
                  {['JPG', 'PNG', 'PDF', 'Screenshot'].map(f => (
                    <View key={f} style={{ backgroundColor: '#EDE9FE', borderRadius: 5,
                      paddingHorizontal: 7, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: '#6D28D9' }}>{f}</Text>
                    </View>
                  ))}
                </View>
              </Pressable>

              <Pressable onPress={handleCameraSlip}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5,
                  borderColor: 'rgba(124,58,237,0.25)', backgroundColor: 'rgba(124,58,237,0.04)' }}>
                <Text style={{ fontSize: 16 }}>📷</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#7C3AED' }}>ถ่ายภาพสลิป</Text>
              </Pressable>
            </>
          ) : (
            <>
              {/* Slip preview */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10,
                padding: 10, backgroundColor: '#F8F5FF', borderRadius: 12, marginBottom: 10 }}>
                <Image source={{ uri: slipUri }}
                  style={{ width: 52, height: 52, borderRadius: 8 }} resizeMode="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#2D1B69' }}>สลิปที่เลือก</Text>
                  <Text style={{ fontSize: 11, color: '#9B7FC8', marginTop: 1 }}>
                    {verifying ? 'กำลังตรวจสอบ...' : 'พร้อมส่ง'}
                  </Text>
                </View>
                {verifying ? (
                  <ActivityIndicator size="small" color="#7C3AED" />
                ) : (
                  <Pressable onPress={() => setSlipUri(null)}
                    style={{ padding: 6 }}>
                    <Text style={{ fontSize: 14, color: '#EC4899', fontWeight: '700' }}>✕</Text>
                  </Pressable>
                )}
              </View>
            </>
          )}

          {/* Auto verify notice */}
          <View style={{ flexDirection: 'row', gap: 8, padding: 10,
            backgroundColor: 'rgba(124,58,237,0.04)', borderRadius: 10,
            borderWidth: 1.5, borderColor: 'rgba(124,58,237,0.15)', marginTop: 6 }}>
            <Text style={{ fontSize: 16 }}>⚡</Text>
            <View>
              <Text style={{ fontSize: 12, fontWeight: '800', color: '#5B21B6', marginBottom: 2 }}>
                ตรวจสลิปอัตโนมัติ
              </Text>
              <Text style={{ fontSize: 11, color: '#7C5CB8', lineHeight: 16 }}>
                ระบบตรวจยอดและชื่อผู้โอนใน ~30 วินาที ไม่ต้องรอเจ้าของร้าน
              </Text>
            </View>
          </View>

          {/* Expire warning */}
          <View style={{ flexDirection: 'row', gap: 8, padding: 9, marginTop: 8,
            backgroundColor: 'rgba(234,179,8,0.08)', borderRadius: 10,
            borderWidth: 1.5, borderColor: 'rgba(234,179,8,0.3)' }}>
            <Text style={{ fontSize: 14 }}>⏰</Text>
            <Text style={{ fontSize: 11, color: '#92400E', fontWeight: '600', flex: 1 }}>
              QR Code นี้ใช้ได้ถึง {expireTime} น. · อัปโหลดสลิปก่อนหมดเวลา
            </Text>
          </View>
        </View>

        {/* Help */}
        <View style={styles.card}>
          <Text style={{ fontSize: 12, fontWeight: '800', color: '#2D1B69', marginBottom: 10 }}>
            💬 ต้องการความช่วยเหลือ?
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[
              { label: '💬 LINE ร้านค้า', bg: 'rgba(6,199,85,0.08)', border: 'rgba(6,199,85,0.3)', color: '#059669' },
              { label: '📞 โทรหาร้าน',   bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.3)', color: '#1D4ED8' },
            ].map(b => (
              <Pressable key={b.label} style={{ flex: 1, paddingVertical: 10, borderRadius: 10,
                backgroundColor: b.bg, borderWidth: 1.5, borderColor: b.border,
                alignItems: 'center' }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: b.color }}>{b.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

      </ScrollView>

      {/* Fixed bottom */}
      <View
        onLayout={e => setBottomBarH(e.nativeEvent.layout.height)}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F0EAF8',
        paddingHorizontal: 16, paddingBottom: insets.bottom + 12, paddingTop: 10,
        elevation: 8, shadowColor: '#6D28D9', shadowOpacity: 0.1,
        shadowRadius: 12, shadowOffset: { width: 0, height: -4 } }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: 10 }}>
          <Text style={{ fontSize: 12, color: '#9B7FC8' }}>ยอดที่ต้องโอน</Text>
          <Text style={{ fontSize: 22, fontWeight: '900', color: '#7C3AED' }}>
            ฿{order.total.toLocaleString()}.00
          </Text>
        </View>
        <Pressable
          onPress={slipUri ? handleVerifySlip : handlePickSlip}
          disabled={verifying || expired}
          style={{ borderRadius: 14, overflow: 'hidden', opacity: verifying || expired ? 0.6 : 1 }}>
          <LinearGradient colors={['#EC4899', '#F472B6']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ paddingVertical: 16, alignItems: 'center', gap: 4 }}>
            {verifying ? <ActivityIndicator color="#fff" /> : (
              <>
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#fff' }}>
                  {slipUri ? '✅ ส่งสลิปเพื่อตรวจสอบ' : '📤 อัปโหลดสลิปหลังโอน'}
                </Text>
                <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)' }}>
                  {slipUri ? '→ ตรวจอัตโนมัติ ~30 วิ' : '→ ตรวจอัตโนมัติ ~30 วิ'}
                </Text>
              </>
            )}
          </LinearGradient>
        </Pressable>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    elevation: 2, shadowColor: '#6430C8', shadowOpacity: 0.05, shadowRadius: 8,
  },
  qrActionBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center',
    borderWidth: 1.5,
  },
});
