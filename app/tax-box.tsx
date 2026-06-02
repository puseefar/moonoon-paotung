import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { taxBoxService, TAX_DEDUCTION_TYPES } from '@/services/taxBoxService';
import type { TaxBoxSummary, TaxDeductionProgress } from '@/services/taxBoxService';
import { formatCurrency } from '@/lib/format';
import { useSnackbar } from '@/components/ui/SnackbarProvider';

const CE_TAX_YEAR = new Date().getFullYear(); // CE year

function getThaiTaxYear(ceYear: number) { return ceYear + 543; }

function ProgressBar({ pct, isOver, color }: { pct: number; isOver: boolean; color: string }) {
  const clamp = Math.min(pct, 100);
  return (
    <View style={{ height: 7, backgroundColor: '#E8E8E8', borderRadius: 4, overflow: 'hidden', marginTop: 6 }}>
      <View style={{ width: `${clamp}%`, height: 7, backgroundColor: isOver ? '#E53935' : color, borderRadius: 4 }} />
    </View>
  );
}

function DeductionCard({ cat, onAdd, onDeleteItem }: {
  cat: TaxDeductionProgress;
  onAdd: () => void;
  onDeleteItem: (itemId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 14, marginBottom: 10, overflow: 'hidden', elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4 }}>
      {/* Header Row */}
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        style={{ padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: cat.type.color + '18', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
            <Text style={{ fontSize: 20 }}>{cat.type.icon}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#333' }}>{cat.type.name}</Text>
            <Text style={{ fontSize: 11, color: '#888', marginTop: 1 }}>{cat.type.ceilingNote}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: cat.isOverCeiling ? '#E53935' : cat.type.color }}>
              {formatCurrency(cat.effectiveAmount)}
            </Text>
            {cat.isOverCeiling && (
              <Text style={{ fontSize: 10, color: '#E53935' }}>เกินเพดาน</Text>
            )}
          </View>
          <Text style={{ fontSize: 16, color: '#BBB', marginLeft: 8 }}>{expanded ? '▲' : '▼'}</Text>
        </View>

        {cat.ceiling !== null && (
          <>
            <ProgressBar pct={cat.percentUsed} isOver={cat.isOverCeiling} color={cat.type.color} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={{ fontSize: 11, color: '#888' }}>
                บันทึก {formatCurrency(cat.totalAmount)} / เพดาน {formatCurrency(cat.ceiling)}
              </Text>
              <Text style={{ fontSize: 11, color: cat.isOverCeiling ? '#E53935' : '#888' }}>
                {cat.percentUsed.toFixed(0)}%
              </Text>
            </View>
          </>
        )}
      </Pressable>

      {/* Items List */}
      {expanded && (
        <View style={{ borderTopWidth: 1, borderTopColor: '#F0F0F0' }}>
          {cat.items.map((item) => (
            <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F8F8F8' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#333' }}>{formatCurrency(item.amount)} บาท</Text>
                {item.documentNote ? (
                  <Text style={{ fontSize: 12, color: '#888', marginTop: 2 }}>📝 {item.documentNote}</Text>
                ) : null}
              </View>
              <Pressable
                onPress={() => onDeleteItem(item.id)}
                style={{ padding: 8 }}>
                <Text style={{ fontSize: 18, color: '#FFCDD2' }}>🗑️</Text>
              </Pressable>
            </View>
          ))}
          <Pressable
            onPress={onAdd}
            style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 8 }}>
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: cat.type.color, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 18, lineHeight: 22 }}>+</Text>
            </View>
            <Text style={{ fontSize: 14, fontWeight: '700', color: cat.type.color }}>เพิ่มรายการ</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export default function TaxBoxScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showSnackbar } = useSnackbar();
  const [taxYear, setTaxYear] = useState(CE_TAX_YEAR);
  const [summary, setSummary] = useState<TaxBoxSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await taxBoxService.getTaxBoxSummary(taxYear);
      setSummary(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [taxYear]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  async function handleDeleteItem(itemId: string) {
    Alert.alert('ลบรายการ', 'ต้องการลบรายการนี้?', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ลบ', style: 'destructive', onPress: async () => {
          await taxBoxService.deleteItem(itemId);
          showSnackbar({ message: 'ลบรายการแล้ว', variant: 'success' });
          load();
        },
      },
    ]);
  }

  async function handleExport() {
    if (!summary?.taxBoxId) return;
    setExporting(true);
    try {
      await taxBoxService.shareCSV(taxYear);
      showSnackbar({ title: 'ส่งออกแล้ว', message: 'สร้าง CSV Tax Box เรียบร้อย', variant: 'success' });
    } catch {
      showSnackbar({ message: 'ส่งออกไม่สำเร็จ', variant: 'error' });
    } finally {
      setExporting(false);
    }
  }

  const isEmpty = !loading && (!summary?.taxBoxId || summary.categories.length === 0);

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F6FA' }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Gradient Header */}
      <LinearGradient
        colors={['#1B5E20', '#2E7D32', '#43A047']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 8, paddingBottom: 20, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
          <Pressable onPress={() => router.back()} style={{ padding: 6, marginRight: 8 }}>
            <Text style={{ fontSize: 20, color: '#fff' }}>←</Text>
          </Pressable>
          <Text style={{ fontSize: 20, fontWeight: '800', color: '#fff', flex: 1 }}>🧾 Tax Box</Text>
          <Pressable
            onPress={() => router.push({ pathname: '/tax-readiness' as any })}
            style={{ backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginRight: 8 }}>
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Checklist</Text>
          </Pressable>
          {summary?.taxBoxId && (
            <Pressable
              onPress={handleExport}
              disabled={exporting}
              style={{ backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{exporting ? '...' : '📤 CSV'}</Text>
            </Pressable>
          )}
        </View>

        {/* Year Selector */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <Pressable onPress={() => setTaxYear((y) => y - 1)} style={{ padding: 8 }}>
            <Text style={{ fontSize: 18, color: 'rgba(255,255,255,0.8)' }}>‹</Text>
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff' }}>
              ปีภาษี {getThaiTaxYear(taxYear)}
            </Text>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
              {taxYear === CE_TAX_YEAR ? 'ปีปัจจุบัน' : `ค.ศ. ${taxYear}`}
            </Text>
          </View>
          <Pressable onPress={() => setTaxYear((y) => y + 1)} style={{ padding: 8 }}>
            <Text style={{ fontSize: 18, color: 'rgba(255,255,255,0.8)' }}>›</Text>
          </Pressable>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#2E7D32" />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>

          {/* Summary Cards */}
          {summary && (
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
              <View style={{ flex: 1, backgroundColor: '#E8F5E9', borderRadius: 14, padding: 14, alignItems: 'center' }}>
                <Text style={{ fontSize: 11, color: '#2E7D32', fontWeight: '600', marginBottom: 4 }}>ลดหย่อนได้จริง</Text>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#1B5E20' }}>
                  {formatCurrency(summary.totalEffectiveDeductions)}
                </Text>
              </View>
              <View style={{ flex: 1, backgroundColor: '#F3E8FF', borderRadius: 14, padding: 14, alignItems: 'center' }}>
                <Text style={{ fontSize: 11, color: '#7C3AED', fontWeight: '600', marginBottom: 4 }}>บันทึกทั้งหมด</Text>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#4527A0' }}>
                  {formatCurrency(summary.totalDeductions)}
                </Text>
              </View>
            </View>
          )}

          {/* Disclaimer */}
          <View style={{ backgroundColor: '#FFF8E1', borderRadius: 12, padding: 12, borderLeftWidth: 4, borderLeftColor: '#FF8F00', marginBottom: 14 }}>
            <Text style={{ fontSize: 11, color: '#7B4F00', lineHeight: 17 }}>
              ⚠️ Tax Box เป็นเครื่องมือช่วยบันทึกและประมาณการเบื้องต้นเท่านั้น ไม่ใช่การคำนวณภาษีอย่างเป็นทางการ กรุณาตรวจสอบกับกรมสรรพากรหรือผู้เชี่ยวชาญก่อนยื่นแบบ
            </Text>
          </View>

          {isEmpty ? (
            /* Empty State */
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Text style={{ fontSize: 52, marginBottom: 12 }}>🧾</Text>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#333', marginBottom: 8 }}>
                ยังไม่มีรายการลดหย่อน
              </Text>
              <Text style={{ fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 22, marginBottom: 24 }}>
                เพิ่มรายการลดหย่อนเพื่อติดตาม{'\n'}ยอดที่ใช้ได้และเพดานในแต่ละหมวด
              </Text>
            </View>
          ) : (
            summary?.categories.map((cat) => (
              <DeductionCard
                key={cat.typeId}
                cat={cat}
                onAdd={() => router.push({ pathname: '/tax-box-add' as any, params: { taxBoxId: summary.taxBoxId!, presetTypeId: cat.typeId, taxYear: String(taxYear) } })}
                onDeleteItem={handleDeleteItem}
              />
            ))
          )}

          {/* ปุ่มเพิ่มหมวดลดหย่อน */}
          <Pressable
            onPress={async () => {
              const box = await taxBoxService.getOrCreateTaxBox(taxYear);
              router.push({ pathname: '/tax-box-add' as any, params: { taxBoxId: box.id, taxYear: String(taxYear) } });
            }}
            style={{ backgroundColor: '#2E7D32', borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 8 }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>+ เพิ่มรายการลดหย่อน</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}
