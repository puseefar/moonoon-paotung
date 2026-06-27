import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Share, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { api } from '@/lib/api/client';
import type { Order } from '@/lib/api/contract';

const DELIVERY_LABEL: Record<string, string> = {
  free: 'ส่งฟรี (Kerry Express)',
  fixed: 'ค่าส่งคงที่',
  pickup: 'นัดรับเอง',
};

export default function ProOrderSuccessScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (orderId) {
      api.getOrder(orderId).then(r => { if (r.ok) setOrder(r.data); });
    }
  }, [orderId]);

  async function handleShare() {
    if (!order) return;
    const items = order.items.map(i => `• ${i.name} ×${i.qty} = ฿${(i.price * i.qty).toLocaleString()}`).join('\n');
    await Share.share({
      message: [
        `🧾 ใบเสร็จรับเงิน`,
        `ออเดอร์: ${order.orderNo}`,
        `วันที่: ${new Date(order.createdAt).toLocaleString('th-TH')}`,
        ``,
        items,
        ``,
        `ค่าจัดส่ง: ${order.shippingCost > 0 ? `฿${order.shippingCost}` : 'ฟรี'}`,
        `รวม: ฿${order.total.toLocaleString()}`,
        ``,
        `ขอบคุณที่ใช้บริการ 🙏`,
      ].join('\n'),
    });
  }

  const paidDate = order?.paidAt ?? order?.createdAt;

  return (
    <View style={{ flex: 1, backgroundColor: '#F8F5FF' }}>
      <LinearGradient colors={['#6B21A8', '#9333EA', '#EC4899']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 16, paddingBottom: 32, paddingHorizontal: 20,
          alignItems: 'center' }}>
        <View style={{ width: 80, height: 80, borderRadius: 40,
          backgroundColor: 'rgba(255,255,255,0.2)',
          justifyContent: 'center', alignItems: 'center', marginBottom: 14 }}>
          <Text style={{ fontSize: 44 }}>✅</Text>
        </View>
        <Text style={{ fontSize: 24, fontWeight: '900', color: '#fff', marginBottom: 6 }}>
          ชำระเงินสำเร็จ!
        </Text>
        <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', textAlign: 'center' }}>
          ตรวจสลิปผ่านแล้ว — บันทึกรายการขายและแจ้งเตือนร้านเรียบร้อย
        </Text>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100, gap: 12 }}>

        {/* Receipt card */}
        {order && (
          <View style={styles.receiptCard}>
            {/* Receipt header */}
            <View style={{ alignItems: 'center', marginBottom: 16, paddingBottom: 14,
              borderBottomWidth: 1.5, borderBottomColor: '#F0EAF8', borderStyle: 'dashed' }}>
              <Text style={{ fontSize: 12, color: '#9B7FC8', marginBottom: 4 }}>🧾 ใบเสร็จรับเงิน</Text>
              <Text style={{ fontSize: 15, fontWeight: '900', color: '#2D1B69',
                fontFamily: 'monospace' }}>{order.orderNo}</Text>
              <Text style={{ fontSize: 11, color: '#C4B5D8', marginTop: 3 }}>
                {paidDate ? new Date(paidDate).toLocaleString('th-TH', {
                  day: 'numeric', month: 'long', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                }) : '—'}
              </Text>
            </View>

            {/* Items */}
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#9B7FC8',
                textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                รายการสินค้า
              </Text>
              {order.items.map((item, i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between',
                  paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F8F5FF' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#2D1B69' }}
                      numberOfLines={1}>{item.name}</Text>
                    <Text style={{ fontSize: 11, color: '#9B7FC8', marginTop: 1 }}>
                      ฿{item.price.toLocaleString()} × {item.qty}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#7C3AED' }}>
                    ฿{(item.price * item.qty).toLocaleString()}
                  </Text>
                </View>
              ))}
            </View>

            {/* Summary */}
            <View style={{ paddingTop: 8, borderTopWidth: 1.5, borderTopColor: '#F0EAF8',
              borderStyle: 'dashed' }}>
              {[
                { label: 'ราคาสินค้า', val: `฿${order.subtotal.toLocaleString()}` },
                { label: 'ค่าจัดส่ง', val: order.shippingCost > 0 ? `฿${order.shippingCost}` : 'ฟรี',
                  green: order.shippingCost === 0 },
                ...(order.discount > 0 ? [{ label: 'ส่วนลด', val: `-฿${order.discount}`, red: true }] : []),
              ].map((r: any, i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between',
                  paddingVertical: 4 }}>
                  <Text style={{ fontSize: 12, color: '#7C5CB8' }}>{r.label}</Text>
                  <Text style={{ fontSize: 12, fontWeight: '600',
                    color: r.red ? '#EC4899' : r.green ? '#059669' : '#2D1B69' }}>
                    {r.val}
                  </Text>
                </View>
              ))}
              {/* Total */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between',
                alignItems: 'center', marginTop: 8, paddingTop: 8,
                borderTopWidth: 1, borderTopColor: '#EDE9FE' }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#2D1B69' }}>ยอดรวม</Text>
                <Text style={{ fontSize: 22, fontWeight: '900', color: '#7C3AED' }}>
                  ฿{order.total.toLocaleString()}
                </Text>
              </View>
            </View>

            {/* Customer + delivery */}
            <View style={{ marginTop: 14, paddingTop: 12,
              borderTopWidth: 1, borderTopColor: '#F0EAF8' }}>
              {[
                { label: 'ผู้รับ', val: order.customer?.name ?? '—' },
                { label: 'เบอร์โทร', val: order.customer?.phone ?? '—' },
                { label: 'ที่อยู่', val: order.customer?.address ?? '—' },
                { label: 'จัดส่ง', val: DELIVERY_LABEL[order.deliveryMethod] ?? order.deliveryMethod },
                { label: 'ชำระผ่าน', val: order.paymentMethod === 'promptpay' ? 'PromptPay' : 'โอนธนาคาร' },
                { label: 'สถานะ', val: '✅ ชำระแล้ว' },
              ].map((r, i) => (
                <View key={i} style={{ flexDirection: 'row', paddingVertical: 5 }}>
                  <Text style={{ fontSize: 11, color: '#9B7FC8', width: 72 }}>{r.label}</Text>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#2D1B69', flex: 1 }}
                    numberOfLines={2}>{r.val}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Buttons */}
        <Pressable onPress={handleShare}
          style={{ backgroundColor: '#fff', borderRadius: 14,
            paddingVertical: 14, alignItems: 'center',
            borderWidth: 1.5, borderColor: 'rgba(124,58,237,0.25)',
            flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
          <Text style={{ fontSize: 16 }}>📤</Text>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#7C3AED' }}>แชร์ใบเสร็จ</Text>
        </Pressable>

        <Pressable onPress={() => router.push('/shop-orders' as any)}
          style={{ backgroundColor: '#fff', borderRadius: 14, paddingVertical: 14,
            alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
            borderWidth: 1.5, borderColor: 'rgba(124,58,237,0.25)' }}>
          <Text style={{ fontSize: 16 }}>📦</Text>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#7C3AED' }}>ดูออเดอร์ทั้งหมด</Text>
        </Pressable>

        <Pressable onPress={() => router.replace('/shop-storefront' as any)}
          style={{ borderRadius: 14, overflow: 'hidden' }}>
          <LinearGradient colors={['#7C3AED', '#EC4899']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ paddingVertical: 14, alignItems: 'center',
              flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
            <Text style={{ fontSize: 16 }}>🏪</Text>
            <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff' }}>กลับไปหน้าร้าน</Text>
          </LinearGradient>
        </Pressable>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  receiptCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 18,
    elevation: 4, shadowColor: '#6430C8', shadowOpacity: 0.08, shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
  },
});
