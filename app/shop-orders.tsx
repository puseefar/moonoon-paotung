import { useState, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { api } from '@/lib/api/client';
import type { Order, OrderStatus } from '@/lib/api/contract';
import { formatCurrency } from '@/lib/format';
import { useSnackbar } from '@/components/ui/SnackbarProvider';

const STATUS_CONFIG: Record<OrderStatus, { label: string; bg: string; text: string; icon: string }> = {
  pending:   { label: 'รอชำระ',   bg: '#FEF9C3', text: '#92400E', icon: '⏳' },
  confirmed: { label: 'ยืนยันแล้ว', bg: '#DBEAFE', text: '#1D4ED8', icon: '✅' },
  paid:      { label: 'ชำระแล้ว', bg: '#DCFCE7', text: '#065F46', icon: '💚' },
  cancelled: { label: 'ยกเลิก',   bg: '#FEE2E2', text: '#7F1D1D', icon: '❌' },
};

export default function ShopOrdersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showSnackbar } = useSnackbar();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');

  const load = useCallback(async () => {
    const result = await api.getOrders();
    if (result.ok) setOrders(result.data);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  async function handleConfirm(order: Order) {
    Alert.alert('ยืนยัน Order', `ยืนยัน order "${order.productName}" ฿${formatCurrency(order.amount)}?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ยืนยัน', onPress: async () => {
          const result = await api.confirmOrder(order.orderId);
          if (result.ok) {
            setOrders(prev => prev.map(o => o.orderId === order.orderId ? result.data : o));
            showSnackbar({ message: '✅ ยืนยัน order แล้ว', variant: 'success' });
          }
        },
      },
    ]);
  }

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter);
  const pendingCount = orders.filter(o => o.status === 'pending').length;

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFBEB' }}>
      <Stack.Screen options={{ headerShown: false }} />

      <LinearGradient colors={['#78350F', '#B45309', '#F59E0B']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 8, paddingBottom: 16, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => router.back()} style={{ padding: 6, marginRight: 8 }}>
            <Text style={{ fontSize: 20, color: '#fff' }}>←</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff' }}>📦 Orders</Text>
            {pendingCount > 0 && (
              <Text style={{ fontSize: 12, color: '#FDE68A', marginTop: 2 }}>
                รอดำเนินการ {pendingCount} รายการ
              </Text>
            )}
          </View>
        </View>

        {/* Filter tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, marginTop: 12 }}>
          {(['all', 'pending', 'confirmed', 'paid', 'cancelled'] as const).map(s => (
            <Pressable key={s} onPress={() => setFilter(s)}
              style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                backgroundColor: filter === s ? '#fff' : 'rgba(255,255,255,0.2)' }}>
              <Text style={{ fontSize: 12, fontWeight: '700',
                color: filter === s ? '#B45309' : 'rgba(255,255,255,0.9)' }}>
                {s === 'all' ? 'ทั้งหมด' : STATUS_CONFIG[s].label}
                {s === 'pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </LinearGradient>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#B45309" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>📦</Text>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#888' }}>
            {filter === 'all' ? 'ยังไม่มี order' : `ไม่มี order สถานะ "${STATUS_CONFIG[filter as OrderStatus]?.label}"`}
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 80 }}>
          {filtered.map(order => {
            const cfg = STATUS_CONFIG[order.status];
            return (
              <View key={order.orderId} style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16,
                marginBottom: 10, elevation: 1, shadowColor: '#B45309', shadowOpacity: 0.07, shadowRadius: 6,
                borderLeftWidth: 4, borderLeftColor: cfg.bg.replace('F', '8') }}>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: '#111', flex: 1 }} numberOfLines={1}>
                    {order.productName}
                  </Text>
                  <View style={{ backgroundColor: cfg.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: cfg.text }}>
                      {cfg.icon} {cfg.label}
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 13, color: '#6B7280' }}>ยอดชำระ</Text>
                  <Text style={{ fontSize: 16, fontWeight: '900', color: '#B45309' }}>
                    {formatCurrency(order.amount)}฿
                  </Text>
                </View>

                {order.buyerName && (
                  <Text style={{ fontSize: 12, color: '#9CA3AF' }}>ผู้ซื้อ: {order.buyerName}</Text>
                )}

                <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
                  {new Date(order.createdAt).toLocaleString('th-TH')}
                  {order.refId ? ` · Ref: ${order.refId}` : ''}
                </Text>

                {order.status === 'pending' && (
                  <Pressable onPress={() => handleConfirm(order)}
                    style={{ marginTop: 12, backgroundColor: '#B45309', borderRadius: 12,
                      paddingVertical: 10, alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                      ✅ ยืนยัน Order นี้
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
