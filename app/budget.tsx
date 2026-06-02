import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { budgetService } from '@/services/budgetService';
import type { BudgetProgress, BudgetCategoryProgress } from '@/services/budgetService';
import { formatCurrency } from '@/lib/format';

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

function ProgressBar({ pct, isOver, isWarn }: { pct: number; isOver: boolean; isWarn: boolean }) {
  const clamp = Math.min(pct, 100);
  const color = isOver ? '#E53935' : isWarn ? '#FF8F00' : '#1aafeb';
  return (
    <View style={{ height: 8, backgroundColor: '#E8E8E8', borderRadius: 4, overflow: 'hidden' }}>
      <View style={{ width: `${clamp}%`, height: 8, backgroundColor: color, borderRadius: 4 }} />
    </View>
  );
}

function CategoryRow({ item }: { item: BudgetCategoryProgress }) {
  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <Text style={{ fontSize: 18, marginRight: 8 }}>{item.categoryIcon}</Text>
        <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: '#333' }}>
          {item.categoryName}
        </Text>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{
            fontSize: 13, fontWeight: '700',
            color: item.isOverBudget ? '#E53935' : '#333',
          }}>
            {formatCurrency(item.spentAmount)}
          </Text>
          <Text style={{ fontSize: 11, color: '#999' }}>
            / {formatCurrency(item.allocatedAmount)}
          </Text>
        </View>
      </View>
      <ProgressBar pct={item.percentUsed} isOver={item.isOverBudget} isWarn={item.isWarning} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={{ fontSize: 11, color: item.isOverBudget ? '#E53935' : item.isWarning ? '#FF8F00' : '#999' }}>
          {item.percentUsed.toFixed(0)}% ใช้ไปแล้ว
        </Text>
        {item.isOverBudget ? (
          <Text style={{ fontSize: 11, color: '#E53935', fontWeight: '600' }}>
            เกินงบ {formatCurrency(Math.abs(item.remainingAmount))}
          </Text>
        ) : (
          <Text style={{ fontSize: 11, color: '#4CAF50' }}>
            เหลือ {formatCurrency(item.remainingAmount)}
          </Text>
        )}
      </View>
    </View>
  );
}

export default function BudgetScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [progress, setProgress] = useState<BudgetProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const yearMonth = budgetService.toYearMonth(selectedYear, selectedMonth);

  const load = useCallback(async () => {
    try {
      const data = await budgetService.getBudgetProgress(yearMonth);
      setProgress(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [yearMonth]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load();
  }, [load]));

  const changeMonth = (delta: number) => {
    let m = selectedMonth + delta;
    let y = selectedYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setSelectedMonth(m);
    setSelectedYear(y);
  };

  const hasNoBudget = !loading && progress?.budgetId === null;

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F6FA' }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Gradient Header */}
      <LinearGradient
        colors={['#7C3AED', '#9D4FBF', '#B06CD0']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 8, paddingBottom: 20, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <Pressable onPress={() => router.back()} style={{ padding: 6, marginRight: 8 }}>
            <Text style={{ fontSize: 20, color: '#fff' }}>←</Text>
          </Pressable>
          <Text style={{ fontSize: 20, fontWeight: '800', color: '#fff', flex: 1 }}>
            วางแผนงบประมาณ
          </Text>
          <Pressable
            onPress={() => router.push({ pathname: '/budget-setup', params: { yearMonth } })}
            style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
              {hasNoBudget ? '+ ตั้งงบ' : '✏️ แก้ไข'}
            </Text>
          </Pressable>
        </View>

        {/* Month Selector */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <Pressable onPress={() => changeMonth(-1)} style={{ padding: 8 }}>
            <Text style={{ fontSize: 18, color: 'rgba(255,255,255,0.8)' }}>‹</Text>
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#fff' }}>
              {THAI_MONTHS[selectedMonth]}
            </Text>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>
              พ.ศ. {selectedYear + 543}
            </Text>
          </View>
          <Pressable onPress={() => changeMonth(1)} style={{ padding: 8 }}>
            <Text style={{ fontSize: 18, color: 'rgba(255,255,255,0.8)' }}>›</Text>
          </Pressable>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>

          {hasNoBudget ? (
            /* Empty State */
            <View style={{ alignItems: 'center', paddingVertical: 48 }}>
              <Text style={{ fontSize: 52, marginBottom: 12 }}>💰</Text>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#333', marginBottom: 8 }}>
                ยังไม่ได้ตั้งงบ
              </Text>
              <Text style={{ fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 24, lineHeight: 22 }}>
                ตั้งงบประมาณรายเดือนเพื่อติดตาม{'\n'}การใช้จ่ายได้อย่างมีแผน
              </Text>
              <Pressable
                onPress={() => router.push({ pathname: '/budget-setup', params: { yearMonth } })}
                style={{ backgroundColor: '#7C3AED', borderRadius: 16, paddingHorizontal: 28, paddingVertical: 14 }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>เริ่มตั้งงบเดือนนี้</Text>
              </Pressable>
            </View>
          ) : progress ? (
            <>
              {/* Summary Card */}
              <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#7C3AED', marginBottom: 12 }}>
                  สรุปภาพรวม
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1, backgroundColor: '#F3E8FF', borderRadius: 12, padding: 12, alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, color: '#7C3AED', fontWeight: '600', marginBottom: 4 }}>รายรับที่วางแผน</Text>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#7C3AED' }}>{formatCurrency(progress.totalPlannedIncome)}</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: '#FFF3E0', borderRadius: 12, padding: 12, alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, color: '#E65100', fontWeight: '600', marginBottom: 4 }}>ใช้จ่ายแล้ว</Text>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#E53935' }}>{formatCurrency(progress.totalSpent)}</Text>
                  </View>
                  <View style={{
                    flex: 1, borderRadius: 12, padding: 12, alignItems: 'center',
                    backgroundColor: progress.totalRemaining >= 0 ? '#E8F5E9' : '#FFEBEE',
                  }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', marginBottom: 4, color: progress.totalRemaining >= 0 ? '#2E7D32' : '#C62828' }}>
                      คงเหลือ
                    </Text>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: progress.totalRemaining >= 0 ? '#2E7D32' : '#C62828' }}>
                      {formatCurrency(Math.abs(progress.totalRemaining))}
                    </Text>
                  </View>
                </View>

                {/* Overall Progress Bar */}
                {progress.totalAllocated > 0 && (
                  <View style={{ marginTop: 14 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ fontSize: 12, color: '#666' }}>งบรวมที่ตั้ง {formatCurrency(progress.totalAllocated)}</Text>
                      <Text style={{ fontSize: 12, color: '#666' }}>
                        {progress.totalAllocated > 0
                          ? ((progress.totalSpent / progress.totalAllocated) * 100).toFixed(0)
                          : 0}% ใช้ไป
                      </Text>
                    </View>
                    <ProgressBar
                      pct={(progress.totalSpent / progress.totalAllocated) * 100}
                      isOver={progress.totalSpent > progress.totalAllocated}
                      isWarn={(progress.totalSpent / progress.totalAllocated) >= 0.8}
                    />
                  </View>
                )}
              </View>

              {/* Forecast Card */}
              {progress.forecast.daysRemaining > 0 && (
                <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#1565C0', marginBottom: 12 }}>
                    📊 คาดการณ์สิ้นเดือน
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>เฉลี่ยต่อวัน</Text>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: '#333' }}>
                        {formatCurrency(progress.forecast.dailyAvgSpend)}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>คาดว่าจะใช้</Text>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: '#E65100' }}>
                        {formatCurrency(progress.forecast.projectedMonthTotal)}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>คาดว่าเหลือ</Text>
                      <Text style={{
                        fontSize: 15, fontWeight: '700',
                        color: progress.forecast.projectedBalance >= 0 ? '#2E7D32' : '#E53935',
                      }}>
                        {progress.forecast.projectedBalance >= 0 ? '+' : '-'}
                        {formatCurrency(Math.abs(progress.forecast.projectedBalance))}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 11, color: '#999', marginTop: 8 }}>
                    ผ่านมา {progress.forecast.daysElapsed} วัน · เหลืออีก {progress.forecast.daysRemaining} วัน
                  </Text>
                </View>
              )}

              {/* Categories */}
              {progress.categories.length > 0 && (
                <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#333', marginBottom: 4 }}>
                    งบรายหมวด ({progress.categories.length} หมวด)
                  </Text>
                  {progress.categories
                    .sort((a, b) => b.percentUsed - a.percentUsed)
                    .map((cat) => (
                      <CategoryRow key={cat.id} item={cat} />
                    ))}
                </View>
              )}

              {/* Warnings */}
              {progress.categories.some((c) => c.isOverBudget || c.isWarning) && (
                <View style={{ backgroundColor: '#FFF8E1', borderRadius: 16, padding: 16, borderLeftWidth: 4, borderLeftColor: '#FF8F00' }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#E65100', marginBottom: 8 }}>
                    ⚠️ แจ้งเตือน
                  </Text>
                  {progress.categories.filter((c) => c.isOverBudget).map((c) => (
                    <Text key={c.id} style={{ fontSize: 13, color: '#B71C1C', marginBottom: 4 }}>
                      • {c.categoryIcon} {c.categoryName} — เกินงบ {formatCurrency(Math.abs(c.remainingAmount))}
                    </Text>
                  ))}
                  {progress.categories.filter((c) => c.isWarning).map((c) => (
                    <Text key={c.id} style={{ fontSize: 13, color: '#E65100', marginBottom: 4 }}>
                      • {c.categoryIcon} {c.categoryName} — ใช้ไปแล้ว {c.percentUsed.toFixed(0)}%
                    </Text>
                  ))}
                </View>
              )}
            </>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
