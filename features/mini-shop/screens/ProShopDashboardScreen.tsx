import { useState, useCallback } from 'react';
import {
  View, Text, Pressable, ActivityIndicator,
  Alert, ScrollView, StyleSheet, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { api } from '@/lib/api/client';
import type { Shop, Product, Order } from '@/lib/api/contract';
import { formatCurrency } from '@/lib/format';
import { useSnackbar } from '@/components/ui/SnackbarProvider';
import { SHOP_TIER_CONFIG } from '../config/shopTierConfig';
import { shopOrderSyncService } from '../services/shopOrderSyncService';
import { shopNotificationService } from '../services/shopNotificationService';

const MAX_PRODUCTS = SHOP_TIER_CONFIG.pro.maxProducts;

const CAT_ICON: Record<string, string> = {
  fashion: '👗', home: '🏠', agriculture: '🌿',
  homemade: '✨', secondhand: '♻️', other: '📦',
};

// ── Stat Card ──────────────────────────────────────────────
function StatCard({
  icon, label, value, sub, onPress, accent,
}: {
  icon: string; label: string; value: string | number;
  sub?: string; onPress?: () => void; accent?: string;
}) {
  return (
    <Pressable onPress={onPress}
      style={{ flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12,
        elevation: 2, shadowColor: '#6430C8', shadowOpacity: 0.06, shadowRadius: 6 }}>
      <Text style={{ fontSize: 20, marginBottom: 6 }}>{icon}</Text>
      <Text style={{ fontSize: 20, fontWeight: '900', color: accent ?? '#2D1B69' }}>
        {value}
      </Text>
      <Text style={{ fontSize: 11, fontWeight: '700', color: '#2D1B69', marginTop: 1 }}>{label}</Text>
      {sub && <Text style={{ fontSize: 10, color: '#9B7FC8', marginTop: 2 }}>{sub}</Text>}
    </Pressable>
  );
}

// ── Main Screen ────────────────────────────────────────────
export default function ProShopDashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showSnackbar } = useSnackbar();

  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadSales, setUnreadSales] = useState(0);

  const load = useCallback(async () => {
    // เช็คออเดอร์ที่ลูกค้าจ่ายแล้วก่อน → บันทึกรายรับ/ตัดสต็อก/แจ้งเตือน
    const { newSales } = await shopOrderSyncService.syncPaidOrders();
    const [shopRes, prodRes, orderRes] = await Promise.all([
      api.getShop(),
      api.getProducts(),
      api.getOrders(),
    ]);
    if (shopRes.ok) setShop(shopRes.data);
    if (prodRes.ok) setProducts(prodRes.data);
    if (orderRes.ok) setOrders(orderRes.data);
    setUnreadSales(await shopNotificationService.unreadCount());
    setLoading(false);
    if (newSales.length > 0) {
      showSnackbar({ message: `🎉 มีออเดอร์ชำระเงินแล้ว ${newSales.length} รายการ`, variant: 'success' });
    }
  }, [showSnackbar]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  async function handleToggleOpen() {
    if (!shop) return;
    const result = await api.updateShop({ isOpen: !shop.isOpen });
    if (result.ok) setShop(result.data);
  }

  async function handleDeleteProduct(product: Product) {
    Alert.alert('ลบสินค้า', `ลบ "${product.name}"?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ลบ', style: 'destructive', onPress: async () => {
          const result = await api.deleteProduct(product.productId);
          if (result.ok) {
            setProducts(prev => prev.filter(p => p.productId !== product.productId));
            if (shop) setShop({ ...shop, productCount: Math.max(0, shop.productCount - 1) });
          }
        },
      },
    ]);
  }

  // ── Computed stats ─────────────────────────────────────
  const today = new Date().toDateString();
  // "รอดำเนินการ" = ออเดอร์ที่ร้านต้องจัดการจริง (จ่ายแล้ว รอเตรียม/ส่ง)
  // ไม่นับ PENDING_PAYMENT (รอลูกค้าจ่าย — ร้านยังทำอะไรไม่ได้)
  const actionableOrders = orders.filter(o =>
    o.status === 'PAID' || o.status === 'PREPARING' || o.status === 'SHIPPED'
  ).length;
  const todayPaidOrders = orders.filter(o =>
    (o.status === 'PAID' || o.status === 'COMPLETED')
    && new Date(o.paidAt ?? o.createdAt).toDateString() === today
  );
  const todayRevenue = todayPaidOrders.reduce((s, o) => s + o.total, 0);
  const todayCount = todayPaidOrders.length;
  const lowStockProducts = products.filter(
    p => p.status === 'active' && p.stock <= p.lowStockThreshold
  );
  // backend เก่าอาจไม่ส่ง status → นับ products ที่ไม่ใช่ draft/sold_out
  const activeProducts = products.filter(
    p => !p.status || p.status === 'active'
  ).length;

  return (
    <View style={{ flex: 1, backgroundColor: '#F8F5FF' }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <LinearGradient colors={['#6B21A8', '#9333EA', '#EC4899']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 8, paddingBottom: 20, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          <Pressable onPress={() => router.back()}
            style={{ width: 36, height: 36, backgroundColor: 'rgba(255,255,255,0.18)',
              borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
            <Text style={{ fontSize: 16, color: '#fff' }}>←</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff' }}>🏪 Mini Shop Pro</Text>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 1 }}>
              สินค้าสูงสุด {MAX_PRODUCTS} ชิ้น · PKG-05
            </Text>
          </View>
          {shop && (
            <Pressable onPress={() => router.push('/shop-orders' as any)}
              style={{ position: 'relative', backgroundColor: 'rgba(255,255,255,0.18)',
                borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>📦 Orders</Text>
              {actionableOrders > 0 && (
                <View style={{ position: 'absolute', top: -4, right: -4,
                  backgroundColor: '#EC4899', borderRadius: 8, minWidth: 16, height: 16,
                  justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 }}>
                  <Text style={{ fontSize: 9, fontWeight: '900', color: '#fff' }}>{actionableOrders}</Text>
                </View>
              )}
            </Pressable>
          )}
        </View>
      </LinearGradient>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      ) : !shop ? (
        /* ── ยังไม่มีร้าน ── */
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <View style={{ width: 80, height: 80, backgroundColor: '#EDE9FE',
            borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 40 }}>🏪</Text>
          </View>
          <Text style={{ fontSize: 22, fontWeight: '900', color: '#2D1B69', marginBottom: 8 }}>
            เปิดร้านของคุณ
          </Text>
          <Text style={{ fontSize: 14, color: '#7C5CB8', textAlign: 'center',
            lineHeight: 22, marginBottom: 28 }}>
            ขายสินค้าออนไลน์ได้ง่ายๆ{'\n'}รับชำระผ่าน PromptPay · แจ้งเตือนทาง LINE
          </Text>
          <Pressable onPress={() => router.push('/shop-profile' as any)}
            style={{ overflow: 'hidden', borderRadius: 16 }}>
            <LinearGradient colors={['#7C3AED', '#EC4899']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ paddingHorizontal: 32, paddingVertical: 16 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
                🏪 เปิดร้านเลย
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 24, gap: 12 }}>

          {/* ── Shop info card ────────────────────────────────── */}
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <View style={{ width: 52, height: 52, borderRadius: 16,
                backgroundColor: '#EDE9FE', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 28 }}>🐷</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: '800', color: '#2D1B69' }}>{shop.name}</Text>
                <Text style={{ fontSize: 12, color: '#9B7FC8', marginTop: 2 }}>📞 {shop.phone}</Text>
              </View>
              <Pressable onPress={handleToggleOpen}
                style={{ backgroundColor: shop.isOpen ? '#DCFCE7' : '#FEF2F2',
                  borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
                  borderWidth: 1.5, borderColor: shop.isOpen ? '#86EFAC' : '#FCA5A5' }}>
                <Text style={{ fontSize: 12, fontWeight: '800',
                  color: shop.isOpen ? '#065F46' : '#7F1D1D' }}>
                  {shop.isOpen ? '🟢 เปิดร้าน' : '🔴 ปิดร้าน'}
                </Text>
              </Pressable>
            </View>

            {/* Action buttons */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={() => router.push('/shop-storefront' as any)}
                style={{ flex: 1, overflow: 'hidden', borderRadius: 10 }}>
                <LinearGradient colors={['#7C3AED', '#A855F7']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={{ paddingVertical: 9, alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: '#fff', fontWeight: '700' }}>🏪 ดูหน้าร้าน</Text>
                </LinearGradient>
              </Pressable>
              <Pressable
                onPress={() => router.push({ pathname: '/shop-profile' as any, params: { shopId: shop.shopId } })}
                style={{ flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center',
                  borderWidth: 1.5, borderColor: 'rgba(124,58,237,0.3)',
                  backgroundColor: 'rgba(124,58,237,0.04)' }}>
                <Text style={{ fontSize: 13, color: '#7C3AED', fontWeight: '700' }}>✏️ แก้ไขข้อมูล</Text>
              </Pressable>
            </View>
          </View>

          {/* ── แจ้งเตือนขายได้ใหม่ ───────────────────────────── */}
          {unreadSales > 0 && (
            <Pressable
              onPress={async () => {
                await shopNotificationService.markAllRead();
                setUnreadSales(0);
                router.push('/shop-orders' as any);
              }}
              style={{ backgroundColor: '#ECFDF5', borderRadius: 14,
                borderWidth: 1.5, borderColor: '#6EE7B7', padding: 14,
                flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ fontSize: 26 }}>🔔</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#065F46' }}>
                  ขายได้ใหม่ {unreadSales} รายการ!
                </Text>
                <Text style={{ fontSize: 11, color: '#059669', marginTop: 1 }}>
                  ลูกค้าชำระเงินแล้ว — แตะดูออเดอร์ + บันทึกรายรับให้อัตโนมัติ
                </Text>
              </View>
              <Text style={{ fontSize: 18, color: '#059669' }}>›</Text>
            </Pressable>
          )}

          {/* ── Stats row ────────────────────────────────────── */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <StatCard
              icon="📬"
              label="รอจัดส่ง"
              value={actionableOrders}
              sub="ออเดอร์ที่จ่ายแล้ว"
              accent={actionableOrders > 0 ? '#DC2626' : '#2D1B69'}
              onPress={() => router.push('/shop-orders' as any)}
            />
            <StatCard
              icon="💰"
              label="ขายวันนี้"
              value={todayRevenue > 0 ? `฿${formatCurrency(todayRevenue)}` : '—'}
              sub={todayCount > 0 ? `${todayCount} ออเดอร์` : 'ยอดขาย'}
              accent="#7C3AED"
              onPress={() => router.push('/shop-analytics' as any)}
            />
            <StatCard
              icon="📦"
              label="สินค้า"
              value={`${activeProducts}/${MAX_PRODUCTS}`}
              sub="เปิดขาย"
              accent="#059669"
              onPress={() => {}}
            />
          </View>

          {/* ── Low stock alert ───────────────────────────────── */}
          {lowStockProducts.length > 0 && (
            <View style={{ backgroundColor: '#FEF2F2', borderRadius: 14,
              borderWidth: 1.5, borderColor: '#FCA5A5', padding: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Text style={{ fontSize: 16 }}>⚠️</Text>
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#DC2626', flex: 1 }}>
                  สินค้าใกล้หมด {lowStockProducts.length} รายการ
                </Text>
              </View>
              {lowStockProducts.map(p => (
                <Pressable key={p.productId}
                  onPress={() => router.push({ pathname: '/shop-create-product' as any, params: { productId: p.productId } })}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8,
                    paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#FEE2E2' }}>
                  <Text style={{ fontSize: 16 }}>{CAT_ICON[p.category] ?? '📦'}</Text>
                  <Text style={{ flex: 1, fontSize: 12, fontWeight: '700', color: '#7F1D1D' }}
                    numberOfLines={1}>{p.name}</Text>
                  <View style={{ backgroundColor: '#FEE2E2', borderRadius: 6,
                    paddingHorizontal: 7, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#DC2626' }}>
                      เหลือ {p.stock} ชิ้น
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          {/* ── Product list ──────────────────────────────────── */}
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center',
              justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#2D1B69' }}>
                สินค้าทั้งหมด ({products.length}/{MAX_PRODUCTS})
              </Text>
              {products.length < MAX_PRODUCTS ? (
                <Pressable onPress={() => router.push('/shop-create-product' as any)}
                  style={{ overflow: 'hidden', borderRadius: 10 }}>
                  <LinearGradient colors={['#7C3AED', '#A855F7']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={{ paddingHorizontal: 12, paddingVertical: 6,
                      flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>+ เพิ่มสินค้า</Text>
                  </LinearGradient>
                </Pressable>
              ) : (
                <View style={{ backgroundColor: '#FEF2F2', borderRadius: 10,
                  paddingHorizontal: 10, paddingVertical: 5,
                  borderWidth: 1, borderColor: '#FCA5A5' }}>
                  <Text style={{ fontSize: 11, color: '#DC2626', fontWeight: '700' }}>
                    ครบ {MAX_PRODUCTS} ชิ้นแล้ว
                  </Text>
                </View>
              )}
            </View>

            {products.length === 0 ? (
              <View style={[styles.card, { alignItems: 'center', paddingVertical: 28 }]}>
                <Text style={{ fontSize: 40, marginBottom: 10 }}>📦</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#9B7FC8', marginBottom: 4 }}>
                  ยังไม่มีสินค้า
                </Text>
                <Text style={{ fontSize: 12, color: '#C4B5D8' }}>
                  เพิ่มได้สูงสุด {MAX_PRODUCTS} ชิ้น
                </Text>
              </View>
            ) : (
              products.map(prod => {
                const safeStock = prod.stock ?? 0;
                const isLow = safeStock <= (prod.lowStockThreshold ?? 3) && (!prod.status || prod.status === 'active');
                const catIcon = CAT_ICON[prod.category] ?? '📦';
                return (
                  <Pressable key={prod.productId}
                    onPress={() => router.push({
                      pathname: '/shop-create-product' as any,
                      params: { productId: prod.productId },
                    })}
                    style={[styles.card, { flexDirection: 'row', alignItems: 'center',
                      gap: 12, marginBottom: 8, padding: 12 }]}>

                    {/* Thumb */}
                    <View style={{ width: 48, height: 48, borderRadius: 13,
                      backgroundColor: '#EDE9FE', justifyContent: 'center',
                      alignItems: 'center', overflow: 'hidden' }}>
                      {prod.images?.[0] ? (
                        <Image source={{ uri: prod.images[0] }}
                          style={{ width: 48, height: 48 }} resizeMode="cover" />
                      ) : (
                        <Text style={{ fontSize: 24 }}>{catIcon}</Text>
                      )}
                    </View>

                    {/* Info */}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#2D1B69' }}
                        numberOfLines={1}>{prod.name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                        <Text style={{ fontSize: 14, fontWeight: '900', color: '#7C3AED' }}>
                          ฿{formatCurrency(prod.price)}
                        </Text>
                        {/* Status badge */}
                        <View style={{
                          backgroundColor: (!prod.status || prod.status === 'active') ? '#DCFCE7'
                            : prod.status === 'draft' ? '#FEF3C7' : '#FEE2E2',
                          borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1,
                        }}>
                          <Text style={{ fontSize: 9, fontWeight: '700',
                            color: (!prod.status || prod.status === 'active') ? '#065F46'
                              : prod.status === 'draft' ? '#92400E' : '#7F1D1D' }}>
                            {(!prod.status || prod.status === 'active') ? '● เปิดขาย'
                              : prod.status === 'draft' ? '📝 ร่าง'
                              : prod.status === 'sold_out' ? '❌ หมด' : '● เปิดขาย'}
                          </Text>
                        </View>
                      </View>
                      {/* Stock bar */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <View style={{ flex: 1, height: 3, backgroundColor: '#F0EAF8', borderRadius: 2 }}>
                          <View style={{
                            height: 3, borderRadius: 2,
                            width: `${Math.min(100, (safeStock / Math.max(safeStock + 10, 20)) * 100)}%`,
                            backgroundColor: isLow ? '#EF4444' : '#7C3AED',
                          }} />
                        </View>
                        <Text style={{ fontSize: 10, color: isLow ? '#DC2626' : '#9B7FC8',
                          fontWeight: isLow ? '800' : '600' }}>
                          {isLow ? `⚠️ ${safeStock}` : safeStock} ชิ้น
                        </Text>
                      </View>
                    </View>

                    {/* Delete */}
                    <Pressable onPress={() => handleDeleteProduct(prod)}
                      style={{ padding: 8 }}>
                      <Text style={{ fontSize: 14, color: '#FECACA', fontWeight: '700' }}>✕</Text>
                    </Pressable>
                  </Pressable>
                );
              })
            )}
          </View>

          {/* ── Quick actions ─────────────────────────────────── */}
          <View style={[styles.card, { flexDirection: 'row', gap: 10 }]}>
            {[
              { icon: '📊', label: 'รายงาน', sub: 'Analytics', onPress: () => router.push('/shop-analytics' as any) },
              { icon: '💬', label: 'LINE แจ้งเตือน', sub: 'PKG-13', onPress: () => router.push('/line-connect' as any) },
              { icon: '💳', label: 'PromptPay', sub: 'PKG-15', onPress: () => router.push('/payment-qr' as any) },
            ].map(a => (
              <Pressable key={a.label} onPress={a.onPress}
                style={{ flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10,
                  backgroundColor: '#F8F5FF', borderRadius: 12 }}>
                <Text style={{ fontSize: 22 }}>{a.icon}</Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#2D1B69', textAlign: 'center' }}>
                  {a.label}
                </Text>
                <Text style={{ fontSize: 9, color: '#9B7FC8' }}>{a.sub}</Text>
              </Pressable>
            ))}
          </View>

        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    elevation: 2, shadowColor: '#6430C8', shadowOpacity: 0.05, shadowRadius: 8,
  },
});
