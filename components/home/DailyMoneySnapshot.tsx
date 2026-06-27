import { useEffect, useRef, useState } from 'react';
import { Image, LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import Colors from '@/constants/Colors';
import { Card } from '@/components/ui/Card';
import { useColorScheme } from '@/components/useColorScheme';
import { formatCurrency } from '@/lib/format';
import type { DailySnapshot } from '@/services/dailySnapshotService';

const CHAR_HAPPY = require('@/assets/characters/moonoon-happy.png');
const CHAR_SAD   = require('@/assets/characters/moonoon-sad.png');

// Thai Buddhist year date: DD/MM/พ.ศ.
function formatThaiDate(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear() + 543;
  return `${d}/${m}/${y}`;
}

type Props = {
  snapshot: DailySnapshot | null;
  isLoading?: boolean;
};

export function DailyMoneySnapshot({ snapshot, isLoading }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const [detailExpanded, setDetailExpanded] = useState(false);
  const autoCollapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimer() {
    if (autoCollapseTimer.current) {
      clearTimeout(autoCollapseTimer.current);
      autoCollapseTimer.current = null;
    }
  }

  useEffect(() => {
    if (detailExpanded) {
      autoCollapseTimer.current = setTimeout(() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setDetailExpanded(false);
      }, 15000);
    } else {
      clearTimer();
    }
    return clearTimer;
  }, [detailExpanded]);

  function toggleDetail() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setDetailExpanded(v => !v);
  }

  // ── Empty / Loading ──────────────────────────────────────────────────────────
  if (!snapshot) {
    return (
      <Card variant="elevated" style={styles.wrap}>
        <View style={styles.emptyBox}>
          <Image source={CHAR_HAPPY} style={styles.emptyChar} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.healthTitle, { color: colors.tint }]}>สุขภาพการเงิน</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {isLoading ? 'กำลังสรุปข้อมูล...' : 'ยังไม่มีรายการวันนี้\nเริ่มเพิ่มรายการเพื่อดูสุขภาพการเงิน'}
            </Text>
          </View>
        </View>
      </Card>
    );
  }

  // ── State ────────────────────────────────────────────────────────────────────
  const GREEN = '#2E7D32';
  const RED   = '#C62828';

  const todayBalance = snapshot.todayIncome - snapshot.todayExpense;

  // §4.2/§6.2 — character + ข้อความ ผูกกับ "สุขภาพการเงินเดือนนี้" (ไม่ใช่ยอดวันนี้)
  // happy = สุขภาพดี/ปกติ/ยังไม่เคลื่อนไหว, sad = รายจ่ายเกินรายรับ (over) เท่านั้น
  const status        = snapshot.health.status;
  const isHealthy     = status !== 'over';
  const message       = snapshot.healthMessage;
  const charImage     = isHealthy ? CHAR_HAPPY : CHAR_SAD;

  // Gradient: ฟ้า=สุขภาพดี / ชมพู=รายจ่ายเกิน
  const gradStart = isHealthy ? '#1aafeb' : '#eb5078';
  const gradColors: [string, string, string] = [gradStart, 'rgba(235,245,255,0.6)', '#f7f7f7'];
  const gradLocations: [number, number, number] = [0, 0.45, 0.66];

  const cardBorder    = isHealthy ? '#90CAF9' : '#F48FB1';
  const balanceColor  = todayBalance >= 0 ? GREEN : RED;
  const titleBtnColor = isHealthy ? '#1565C0' : '#AD1457';

  // Monthly
  const maxMonth       = Math.max(snapshot.monthIncome, snapshot.monthExpense, 1);
  const incomeRatio    = snapshot.monthIncome / maxMonth;
  const expenseRatio   = snapshot.monthExpense / maxMonth;
  const monthBalance   = snapshot.monthBalance ?? (snapshot.monthIncome - snapshot.monthExpense);
  const monthBalColor  = monthBalance >= 0 ? GREEN : RED;

  const hasUncategorized = snapshot.uncategorizedCount > 0;

  return (
    <View style={[styles.wrap, { borderColor: cardBorder }]}>
      <LinearGradient
        colors={gradColors}
        locations={gradLocations}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.48, y: 1 }}
        style={styles.gradInner}
      >
        {/* ── Row 1: Title + Date ─────────────────────────────────────────────── */}
        <View style={styles.titleRow}>
          <View style={styles.titleLeft}>
            <Text style={styles.heartIcon}>{isHealthy ? '💙' : '❤️'}</Text>
            <Text style={styles.healthTitle}>สุขภาพการเงินเดือนนี้</Text>
          </View>
          <View style={styles.dateBadge}>
            <FontAwesome name="calendar-o" size={10} color="#fff" />
            <Text style={styles.dateBadgeText}>{formatThaiDate(new Date())}</Text>
          </View>
        </View>

        {/* ── CARD 3 (§4.1): สุขภาพการเงิน — Character + ข้อความตีความ (แสดงเสมอ) ── */}
        <View style={styles.charRow}>
          <Image source={charImage} style={styles.charImage} resizeMode="contain" />
          <Text style={[styles.charMessage, { color: isHealthy ? '#0D47A1' : '#880E4F' }]}>
            {message}
          </Text>
        </View>

        {/* ── §5.1: ป้ายเตือนแบบย่อ (สั้น สะอาด แตะเพื่อแก้ไข) ───────────────────── */}
        {hasUncategorized && (
          <Pressable
            style={styles.uncatBanner}
            onPress={() => router.push('/(tabs)/history' as any)}
            hitSlop={6}>
            <Text style={styles.uncatText} numberOfLines={1}>
              {snapshot.uncategorizedCount} รายการยังไม่จัดหมวดหมู่
            </Text>
            <View style={styles.uncatEdit}>
              <FontAwesome name="pencil" size={11} color="#E65100" />
              <Text style={styles.uncatEditText}>แก้ไข</Text>
            </View>
          </Pressable>
        )}

        {/* ── Chevron Toggle ──────────────────────────────────────────────────── */}
        <Pressable style={styles.expandToggle} onPress={toggleDetail} hitSlop={8}>
          <Text style={[styles.expandLabel, { color: colors.textSecondary }]}>
            ดูรายละเอียด · วันนี้ และ เดือนนี้
          </Text>
          <FontAwesome
            name={detailExpanded ? 'chevron-up' : 'chevron-down'}
            size={12}
            color={colors.textSecondary}
          />
        </Pressable>

        {/* ── CARD 2: Stats + Monthly Detail (แสดงเมื่อกด chevron) ──────────────── */}
        {detailExpanded && (
          <View style={styles.detailBody}>
            {/* ── ส่วน "วันนี้" (§6.1 — แยกชัดจากเดือนนี้) ──────────────────────── */}
            <Text style={styles.sectionHeader}>วันนี้</Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <View style={[styles.statIcon, { backgroundColor: 'rgba(255,255,255,0.75)' }]}>
                  <FontAwesome name="arrow-down" size={12} color={GREEN} />
                </View>
                <Text style={styles.statLabel}>รับ</Text>
                <Text style={[styles.statAmount, { color: GREEN }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {formatCurrency(snapshot.todayIncome)}
                </Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <View style={[styles.statIcon, { backgroundColor: 'rgba(255,255,255,0.75)' }]}>
                  <FontAwesome name="arrow-up" size={12} color={RED} />
                </View>
                <Text style={styles.statLabel}>จ่าย</Text>
                <Text style={[styles.statAmount, { color: RED }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {formatCurrency(snapshot.todayExpense)}
                </Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <View style={[styles.statIcon, { backgroundColor: 'rgba(255,255,255,0.75)' }]}>
                  <Text style={{ fontSize: 13 }}>{todayBalance >= 0 ? '😊' : '😢'}</Text>
                </View>
                <Text style={styles.statLabel}>คงเหลือวันนี้</Text>
                <Text style={[styles.statAmount, { color: balanceColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {todayBalance >= 0 ? '+' : ''}{formatCurrency(todayBalance)}
                </Text>
              </View>
            </View>

            <View style={[styles.detailDivider, { backgroundColor: cardBorder }]} />

            {/* ── ส่วน "เดือนนี้" (§9 คำศัพท์มาตรฐาน) ───────────────────────────── */}
            <Text style={styles.sectionHeader}>เดือนนี้</Text>

            <View style={styles.barRow}>
              <Text style={[styles.barLabel, { color: colors.textSecondary }]}>เงินเข้า</Text>
              <View style={[styles.barTrack, { backgroundColor: '#C8E6C9' }]}>
                <View style={[styles.barFill, { width: `${Math.round(incomeRatio * 100)}%`, backgroundColor: GREEN }]} />
              </View>
              <Text style={[styles.barVal, { color: GREEN }]} numberOfLines={1}>
                {formatCurrency(snapshot.monthIncome)}
              </Text>
            </View>

            <View style={styles.barRow}>
              <Text style={[styles.barLabel, { color: colors.textSecondary }]}>ใช้ไป</Text>
              <View style={[styles.barTrack, { backgroundColor: '#FFCDD2' }]}>
                <View style={[styles.barFill, { width: `${Math.round(expenseRatio * 100)}%`, backgroundColor: RED }]} />
              </View>
              <Text style={[styles.barVal, { color: RED }]} numberOfLines={1}>
                {formatCurrency(snapshot.monthExpense)}
              </Text>
            </View>

            <View style={[styles.monthBalRow, { borderColor: cardBorder, backgroundColor: monthBalance >= 0 ? '#E8F5E9' : '#FFEBEE' }]}>
              <Text style={[styles.monthBalLabel, { color: colors.textSecondary }]}>เหลือใช้เดือนนี้</Text>
              <Text style={[styles.monthBalAmount, { color: monthBalColor }]}>
                {monthBalance >= 0 ? '+' : ''}{formatCurrency(monthBalance)}
              </Text>
            </View>

            {/* ── §4.3: ข้อความสรุปอัตโนมัติ (ภาษาคน) ──────────────────────────── */}
            {snapshot.monthNarrative ? (
              <View style={styles.insightRow}>
                <FontAwesome name="comment-o" size={13} color={titleBtnColor} />
                <Text style={[styles.insightText, { color: colors.text }]}>
                  {snapshot.monthNarrative}
                </Text>
              </View>
            ) : null}

            {snapshot.dailyAverage > 0 ? (
              <Text style={[styles.avgText, { color: colors.textSecondary }]}>
                เฉลี่ยใช้จ่าย {formatCurrency(snapshot.dailyAverage)}/วัน
              </Text>
            ) : null}
          </View>
        )}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    overflow: 'hidden',
    // Shadow
    shadowColor: '#1aafeb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  gradInner: {
    borderRadius: 18,
  },

  // Empty state
  emptyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  emptyChar: {
    width: 64,
    height: 64,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: 4,
  },

  // Row 1: Title + Date
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  titleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  heartIcon: {
    fontSize: 17,
  },
  healthTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  dateBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Row 2: Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  statIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#546E7A',
    textAlign: 'center',
  },
  statAmount: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 56,
    backgroundColor: 'rgba(255,255,255,0.5)',
    marginHorizontal: 4,
  },

  // Row 3: Character + Message
  charRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.6)',
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 10,
    minHeight: 100,
  },
  charImage: {
    width: 96,
    height: 116,
  },
  charMessage: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 21,
  },

  // Expand toggle
  expandToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  expandLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  // Expanded monthly detail
  detailBody: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 8,
    gap: 10,
    backgroundColor: '#FFFFFF',
  },
  detailDivider: {
    height: 1,
    marginBottom: 2,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barLabel: {
    fontSize: 12,
    fontWeight: '600',
    width: 50,
  },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: 8,
    borderRadius: 4,
    minWidth: 4,
  },
  barVal: {
    fontSize: 12,
    fontWeight: '700',
    width: 88,
    textAlign: 'right',
  },
  monthBalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 2,
  },
  monthBalLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  monthBalAmount: {
    fontSize: 18,
    fontWeight: '800',
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#F5F5F5',
  },
  insightText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#455A64',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  avgText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'right',
  },
  // §5.1 uncategorized warning — แบบย่อ บรรทัดเดียว
  uncatBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 12,
    marginBottom: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,243,224,0.9)',
  },
  uncatText: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '600',
    color: '#BF6000',
  },
  uncatEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  uncatEditText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#E65100',
  },
});
