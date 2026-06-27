import { useState, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView, Alert, Share } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { api } from '@/lib/api/client';
import type { Order, OrderStatus } from '@/lib/api/contract';
import { useSnackbar } from '@/components/ui/SnackbarProvider';
import { shopOrderSyncService } from '../services/shopOrderSyncService';

const PAID_OR_LATER: OrderStatus[] = ['PAID', 'PREPARING', 'SHIPPED', 'COMPLETED'];

const STATUS_CONFIG: Partial<Record<OrderStatus, { label: string; bg: string; text: string; icon: string }>> = {
  PENDING_PAYMENT: { label: 'รอชำระ',      bg: '#FEF9C3', text: '#92400E', icon: '⏳' },
  VERIFYING_SLIP:  { label: 'ตรวจสลิป',    bg: '#DBEAFE', text: '#1D4ED8', icon: '🔍' },
  SLIP_REJECTED:   { label: 'สลิปไม่ผ่าน', bg: '#FEE2E2', text: '#7F1D1D', icon: '❌' },
  PAID:            { label: 'ชำระแล้ว',    bg: '#DCFCE7', text: '#065F46', icon: '💚' },
  PREPARING:       { label: 'เตรียมสินค้า', bg: '#EDE9FE', text: '#5B21B6', icon: '📦' },
  SHIPPED:         { label: 'จัดส่งแล้ว',  bg: '#DBEAFE', text: '#1D4ED8', icon: '🚚' },
  COMPLETED:       { label: 'สำเร็จ',       bg: '#DCFCE7', text: '#065F46', icon: '✅' },
  CANCELLED:       { label: 'ยกเลิก',      bg: '#FEE2E2', text: '#7F1D1D', icon: '❌' },
  REFUNDED:        { label: 'คืนเงิน',     bg: '#F3F4F6', text: '#374151', icon: '↩️' },
};

const FILTER_TABS: (OrderStatus | 'all')[] = [
  'all', 'PENDING_PAYMENT', 'VERIFYING_SLIP', 'PAID', 'PREPARING', 'SHIPPED', 'COMPLETED', 'CANCELLED',
];

export default function ProShopOrdersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showSnackbar } = useSnackbar();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');

  const load = useCallback(async () => {
    // เช็คออเดอร์ที่ลูกค้าจ่ายแล้ว → บันทึกรายรับ/ตัดสต็อก/แจ้งเตือน
    const { newSales } = await shopOrderSyncService.syncPaidOrders();
    const result = await api.getOrders();
    if (result.ok) setOrders(result.data);
    setLoading(false);
    if (newSales.length > 0) {
      showSnackbar({ message: `🎉 มีออเดอร์ชำระเงินแล้ว ${newSales.length} รายการ`, variant: 'success' });
    }
  }, [showSnackbar]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  async function handleUpdateStatus(order: Order, newStatus: OrderStatus) {
    const result = await api.updateOrderStatus(order.orderId, newStatus);
    if (result.ok) {
      setOrders(prev => prev.map(o => o.orderId === order.orderId ? result.data : o));
      showSnackbar({ message: `✅ อัปเดตสถานะแล้ว`, variant: 'success' });
    }
  }

  // ส่งใบเสร็จ/ขอบคุณลูกค้า (reuse Share — ใช้ข้อมูลในออเดอร์)
  async function handleSendReceipt(order: Order) {
    const items = order.items
      .map(i => `• ${i.name} ×${i.qty} = ฿${(i.price * i.qty).toLocaleString()}`)
      .join('\n');
    await Share.share({
      message: [
        `🧾 ยืนยันคำสั่งซื้อ — ${order.orderNo}`,
        `ขอบคุณสำหรับการสั่งซื้อค่ะ 🙏`,
        ``,
        items,
        `ค่าจัดส่ง: ${order.shippingCost > 0 ? `฿${order.shippingCost}` : 'ฟรี'}`,
        `รวมทั้งสิ้น: ฿${order.total.toLocaleString()}`,
        ``,
        `สถานะ: ชำระเงินแล้ว ✅`,
        order.customer?.name ? `ผู้รับ: ${order.customer.name}` : '',
      ].filter(Boolean).join('\n'),
    });
  }

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter);
  const pendingCount = orders.filter(o => o.status === 'PENDING_PAYMENT' || o.status === 'VERIFYING_SLIP').length;

  return (
    <View style={{ flex: 1, backgroundColor: '#F8F5FF' }}>
      <LinearGradient colors={['#6B21A8', '#9333EA', '#EC4899']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 8, paddingBottom: 14, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => router.back()} style={{ padding: 6, marginRight: 8 }}>
            <Text style={{ fontSize: 20, color: '#fff' }}>←</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff' }}>📦 จัดการออเดอร์</Text>
            {pendingCount > 0 && (
              <Text style={{ fontSize: 12, color: '#FDE68A', marginTop: 2 }}>
                รอดำเนินการ {pendingCount} รายการ
              </Text>
            )}
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 7, marginTop: 12 }}>
          {FILTER_TABS.map(s => {
            const cfg = s === 'all' ? null : STATUS_CONFIG[s];
            return (
              <Pressable key={s} onPress={() => setFilter(s)}
                style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
                  backgroundColor: filter === s ? '#fff' : 'rgba(255,255,255,0.2)' }}>
                <Text style={{ fontSize: 12, fontWeight: '700',
                  color: filter === s ? '#7C3AED' : 'rgba(255,255,255,0.9)' }}>
                  {s === 'all' ? 'ทั้งหมด' : cfg?.label ?? s}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </LinearGradient>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>📦</Text>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#9B7FC8' }}>
            {filter === 'all' ? 'ยังไม่มีออเดอร์' : `ไม่มีออเดอร์สถานะ "${STATUS_CONFIG[filter as OrderStatus]?.label ?? filter}"`}
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 80, gap: 10 }}>
          {filtered.map(order => {
            const cfg = STATUS_CONFIG[order.status] ?? { label: order.status, bg: '#F3F4F6', text: '#374151', icon: '○' };
            const productSummary = order.items?.map(i => `${i.name} ×${i.qty}`).join(', ')
              ?? '—';
            const totalItems = order.items?.reduce((s, i) => s + i.qty, 0) ?? 0;

            return (
              <View key={order.orderId} style={{
                backgroundColor: '#fff', borderRadius: 16, padding: 14,
                borderLeftWidth: 4, borderLeftColor: cfg.bg,
                elevation: 2, shadowColor: '#6430C8', shadowOpacity: 0.06, shadowRadius: 6,
              }}>
                {/* Header row */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between',
                  alignItems: 'flex-start', marginBottom: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: '900', color: '#2D1B69',
                      fontFamily: 'monospace' }}>{order.orderNo ?? order.orderId.slice(0, 12)}</Text>
                    <Text style={{ fontSize: 12, color: '#9B7FC8', marginTop: 2 }}
                      numberOfLines={1}>{productSummary}</Text>
                  </View>
                  <View style={{ backgroundColor: cfg.bg, borderRadius: 8,
                    paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: cfg.text }}>
                      {cfg.icon} {cfg.label}
                    </Text>
                  </View>
                </View>

                {/* Amount + buyer */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, color: '#7C5CB8' }}>
                    {totalItems} ชิ้น · {order.customer?.name ?? '—'}
                  </Text>
                  <Text style={{ fontSize: 17, fontWeight: '900', color: '#7C3AED' }}>
                    ฿{(order.total ?? 0).toLocaleString()}
                  </Text>
                </View>

                <Text style={{ fontSize: 11, color: '#C4B5D8', marginBottom: 10 }}>
                  {new Date(order.createdAt).toLocaleString('th-TH')}
                  {order.slipRef ? ` · Ref: ${order.slipRef}` : ''}
                </Text>

                {/* Action buttons by status */}
                {order.status === 'PAID' && (
                  <Pressable onPress={() => handleUpdateStatus(order, 'PREPARING')}
                    style={{ backgroundColor: '#7C3AED', borderRadius: 10,
                      paddingVertical: 10, alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                      📦 เริ่มเตรียมสินค้า
                    </Text>
                  </Pressable>
                )}
                {order.status === 'PREPARING' && (
                  <Pressable onPress={() => handleUpdateStatus(order, 'SHIPPED')}
                    style={{ backgroundColor: '#1D4ED8', borderRadius: 10,
                      paddingVertical: 10, alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                      🚚 ยืนยันจัดส่งแล้ว
                    </Text>
                  </Pressable>
                )}
                {order.status === 'SHIPPED' && (
                  <Pressable onPress={() => handleUpdateStatus(order, 'COMPLETED')}
                    style={{ backgroundColor: '#059669', borderRadius: 10,
                      paddingVertical: 10, alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                      ✅ ยืนยันสำเร็จ
                    </Text>
                  </Pressable>
                )}
                {PAID_OR_LATER.includes(order.status) && (
                  <Pressable onPress={() => handleSendReceipt(order)}
                    style={{ marginTop: 8, borderWidth: 1.5, borderColor: 'rgba(124,58,237,0.3)',
                      borderRadius: 10, paddingVertical: 9, alignItems: 'center',
                      backgroundColor: 'rgba(124,58,237,0.04)' }}>
                    <Text style={{ color: '#7C3AED', fontWeight: '700', fontSize: 12 }}>
                      📤 ส่งใบเสร็จ / ขอบคุณลูกค้า
                    </Text>
                  </Pressable>
                )}
                {(order.status === 'PENDING_PAYMENT' || order.status === 'SLIP_REJECTED') && (
                  <Pressable
                    onPress={() => Alert.alert('ยกเลิกออเดอร์', 'ต้องการยกเลิกออเดอร์นี้?', [
                      { text: 'ยกเลิก', style: 'cancel' },
                      { text: 'ยืนยัน', style: 'destructive',
                        onPress: () => handleUpdateStatus(order, 'CANCELLED') },
                    ])}
                    style={{ borderWidth: 1.5, borderColor: '#FCA5A5', borderRadius: 10,
                      paddingVertical: 8, alignItems: 'center',
                      backgroundColor: '#FEF2F2' }}>
                    <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 12 }}>
                      ✕ ยกเลิกออเดอร์
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
