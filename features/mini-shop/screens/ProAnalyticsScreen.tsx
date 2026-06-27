import { useState, useEffect } from 'react';
import {
  View, Text, Pressable, ScrollView, ActivityIndicator,
  StyleSheet, Dimensions, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { BarChart } from 'react-native-gifted-charts';
import type { ShopAnalytics } from '@/lib/api/contract';
import { shopAnalyticsService } from '../services/shopAnalyticsService';

const CHART_W = Dimensions.get('window').width - 64;

// ── Stat Card ─────────────────────────────────────────────
function StatCard({ icon, label, value, sub, accent }: {
  icon: string; label: string; value: string; sub?: string; accent?: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={{ fontSize: 22, marginBottom: 6 }}>{icon}</Text>
      <Text style={{ fontSize: 18, fontWeight: '900', color: accent ?? '#2D1B69' }}>{value}</Text>
      <Text style={{ fontSize: 11, fontWeight: '700', color: '#2D1B69', marginTop: 1 }}>{label}</Text>
      {sub && <Text style={{ fontSize: 10, color: '#9B7FC8', marginTop: 2 }}>{sub}</Text>}
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────
export default function ProAnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [analytics, setAnalytics] = useState<ShopAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month'>('week');

  useEffect(() => {
    setLoading(true);
    shopAnalyticsService.compute(period)
      .then(data => setAnalytics(data))
      .catch(() => setAnalytics(null))
      .finally(() => setLoading(false));
  }, [period]);

  function formatB(n: number): string {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toLocaleString();
  }

  // Bar chart data
  const barData = analytics?.dailySales.map(d => ({
    value: d.revenue,
    label: d.label,
    frontColor: d.revenue > 0 ? '#7C3AED' : 'rgba(167,139,250,0.25)',
    labelTextStyle: { color: '#9B7FC8', fontSize: 10, fontWeight: '600' as const },
  })) ?? [];

  const maxBar = Math.max(...(barData.map(d => d.value)), 1);

  return (
    <View style={{ flex: 1, backgroundColor: '#F8F5FF' }}>

      {/* Header */}
      <LinearGradient colors={['#6B21A8', '#9333EA', '#EC4899']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 8, paddingBottom: 16, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Pressable onPress={() => router.back()}
            style={{ width: 36, height: 36, backgroundColor: 'rgba(255,255,255,0.18)',
              borderRadius: 12, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontSize: 16, color: '#fff' }}>←</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: '#fff' }}>📊 รายงานยอดขาย</Text>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 1 }}>
              ข้อมูลจากออเดอร์ที่ชำระแล้ว
            </Text>
          </View>
        </View>

        {/* Period tabs */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['week', 'month'] as const).map(p => (
            <Pressable key={p} onPress={() => setPeriod(p)}
              style={{ paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
                backgroundColor: period === p ? '#fff' : 'rgba(255,255,255,0.18)' }}>
              <Text style={{ fontSize: 13, fontWeight: '700',
                color: period === p ? '#7C3AED' : 'rgba(255,255,255,0.9)' }}>
                {p === 'week' ? '7 วัน' : '30 วัน'}
              </Text>
            </Pressable>
          ))}
        </View>
      </LinearGradient>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#7C3AED" />
          <Text style={{ fontSize: 13, color: '#9B7FC8', marginTop: 10 }}>กำลังคำนวณ...</Text>
        </View>
      ) : !analytics ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>📊</Text>
          <Text style={{ fontSize: 14, color: '#9B7FC8' }}>ยังไม่มีข้อมูล</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 24, gap: 12 }}>

          {/* Stats grid 2×2 */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <StatCard icon="💰" label="ยอดขาย" accent="#7C3AED"
              value={`฿${formatB(analytics.totalRevenue)}`}
              sub={`${period === 'week' ? '7' : '30'} วันล่าสุด`} />
            <StatCard icon="📦" label="ออเดอร์" accent="#1D4ED8"
              value={String(analytics.totalOrders)}
              sub={`สำเร็จ ${analytics.completedOrders}`} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <StatCard icon="💚" label="กำไรขั้นต้น"
              accent={analytics.hasCostData ? '#059669' : '#9CA3AF'}
              value={analytics.hasCostData ? `฿${formatB(analytics.totalProfit)}` : '—'}
              sub={!analytics.hasCostData
                ? 'ตั้งต้นทุนเพื่อดูกำไร'
                : analytics.revenueWithCost > 0
                  ? `margin ${Math.round(analytics.totalProfit / analytics.revenueWithCost * 100)}%`
                  : '—'} />
            <StatCard icon="🧾" label="ยอดเฉลี่ย/ออเดอร์" accent="#D97706"
              value={analytics.totalOrders > 0 ? `฿${formatB(analytics.avgOrderValue)}` : '—'}
              sub="avg order value" />
          </View>

          {/* ต้นทุนบางรายการยังไม่ระบุ — แจ้งเตือน (P4) */}
          {analytics.hasCostData && !analytics.profitComplete && (
            <View style={{ backgroundColor: '#FFFBEB', borderRadius: 12,
              borderWidth: 1.5, borderColor: '#FDE68A', padding: 10,
              flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 15 }}>⚠️</Text>
              <Text style={{ flex: 1, fontSize: 11, color: '#92400E', lineHeight: 16 }}>
                ต้นทุนบางรายการยังไม่ระบุ — กำไรขั้นต้นคำนวณเฉพาะรายการที่ใส่ต้นทุนแล้ว
              </Text>
            </View>
          )}
          {!analytics.hasCostData && analytics.completedOrders > 0 && (
            <Pressable onPress={() => router.back()}
              style={{ backgroundColor: '#F5F3FF', borderRadius: 12,
                borderWidth: 1.5, borderColor: '#DDD6FE', padding: 10,
                flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 15 }}>💡</Text>
              <Text style={{ flex: 1, fontSize: 11, color: '#5B21B6', lineHeight: 16 }}>
                ยังไม่ได้ตั้งต้นทุนสินค้า — ใส่ต้นทุนในหน้าแก้ไขสินค้า (ตัวเลือก/variant) เพื่อให้รายงานกำไรถูกต้อง
              </Text>
            </Pressable>
          )}

          {/* Bar chart */}
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center',
              justifyContent: 'space-between', marginBottom: 14 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#2D1B69' }}>
                📈 ยอดขายรายวัน
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: '#7C3AED' }} />
                <Text style={{ fontSize: 11, color: '#9B7FC8' }}>ยอดขาย (฿)</Text>
              </View>
            </View>

            {barData.every(d => d.value === 0) ? (
              <View style={{ alignItems: 'center', paddingVertical: 28 }}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>📊</Text>
                <Text style={{ fontSize: 13, color: '#9B7FC8' }}>ยังไม่มียอดขายในช่วงนี้</Text>
              </View>
            ) : (
              <BarChart
                data={barData}
                barWidth={period === 'week' ? 28 : 16}
                noOfSections={4}
                maxValue={maxBar * 1.15}
                yAxisTextStyle={{ color: '#A78BFA', fontSize: 9 }}
                xAxisColor="rgba(167,139,250,0.2)"
                yAxisColor="rgba(167,139,250,0.2)"
                backgroundColor="#fff"
                formatYLabel={v => formatB(Number(v))}
                isAnimated
                animationDuration={600}
                height={160}
                roundedTop
                width={CHART_W}
                hideRules={false}
                rulesColor="rgba(167,139,250,0.1)"
                showLine={false}
              />
            )}
          </View>

          {/* Pending vs Completed */}
          <View style={[styles.card, { flexDirection: 'row', gap: 0 }]}>
            {[
              { label: 'รอดำเนินการ', count: analytics.pendingOrders, color: '#F59E0B', bg: '#FEF3C7' },
              { label: 'สำเร็จ', count: analytics.completedOrders, color: '#059669', bg: '#DCFCE7' },
              { label: 'รวมทั้งหมด', count: analytics.totalOrders, color: '#7C3AED', bg: '#EDE9FE' },
            ].map((s, i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4,
                borderLeftWidth: i > 0 ? 1 : 0, borderLeftColor: '#F0EAF8',
                paddingVertical: 6 }}>
                <View style={{ backgroundColor: s.bg, borderRadius: 10,
                  paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 18, fontWeight: '900', color: s.color }}>
                    {s.count}
                  </Text>
                </View>
                <Text style={{ fontSize: 11, color: '#9B7FC8', fontWeight: '600' }}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* Top products */}
          {analytics.topProducts.length > 0 && (
            <View style={styles.card}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#2D1B69', marginBottom: 12 }}>
                🔥 สินค้าขายดี
              </Text>

              {/* Table header */}
              <View style={{ flexDirection: 'row', paddingBottom: 8,
                borderBottomWidth: 1, borderBottomColor: '#F0EAF8', marginBottom: 4 }}>
                <Text style={[styles.th, { flex: 3 }]}>สินค้า</Text>
                <Text style={[styles.th, { width: 44, textAlign: 'center' }]}>ขาย</Text>
                <Text style={[styles.th, { width: 70, textAlign: 'right' }]}>รายได้</Text>
                <Text style={[styles.th, { width: 60, textAlign: 'right' }]}>กำไร</Text>
              </View>

              {analytics.topProducts.map((p, i) => (
                <View key={p.productId} style={{ flexDirection: 'row', alignItems: 'center',
                  paddingVertical: 10,
                  borderBottomWidth: i < analytics.topProducts.length - 1 ? 1 : 0,
                  borderBottomColor: '#F8F5FF' }}>
                  {/* Rank */}
                  <View style={{ width: 22, height: 22, borderRadius: 6, marginRight: 8,
                    backgroundColor: i === 0 ? '#FDE68A' : i === 1 ? '#E5E7EB' : '#FED7AA',
                    justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ fontSize: 10, fontWeight: '900',
                      color: i === 0 ? '#92400E' : '#374151' }}>{i + 1}</Text>
                  </View>
                  <Text style={{ flex: 3, fontSize: 12, fontWeight: '600', color: '#2D1B69' }}
                    numberOfLines={1}>{p.name}</Text>
                  <Text style={{ width: 44, fontSize: 12, fontWeight: '700',
                    color: '#2D1B69', textAlign: 'center' }}>{p.totalQty}</Text>
                  <Text style={{ width: 70, fontSize: 12, fontWeight: '700',
                    color: '#7C3AED', textAlign: 'right' }}>
                    ฿{formatB(p.totalRevenue)}
                  </Text>
                  <Text style={{ width: 60, fontSize: 12, fontWeight: '700',
                    color: !p.profitKnown ? '#C4B5D8'
                      : p.totalProfit >= 0 ? '#059669' : '#DC2626', textAlign: 'right' }}>
                    {p.profitKnown ? `฿${formatB(p.totalProfit)}` : '—'}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Empty top products */}
          {analytics.topProducts.length === 0 && (
            <View style={[styles.card, { alignItems: 'center', paddingVertical: 24 }]}>
              <Text style={{ fontSize: 36, marginBottom: 8 }}>📈</Text>
              <Text style={{ fontSize: 13, color: '#9B7FC8' }}>
                ยังไม่มีข้อมูลยอดขาย ทำออเดอร์แรกเลย!
              </Text>
            </View>
          )}

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
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12,
    elevation: 2, shadowColor: '#6430C8', shadowOpacity: 0.06, shadowRadius: 6,
  },
  th: { fontSize: 10, fontWeight: '700', color: '#9B7FC8', textTransform: 'uppercase' },
});
