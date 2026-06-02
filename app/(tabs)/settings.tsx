import { Image, ImageSourcePropType, View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Card } from '@/components/ui/Card';

// ── Setting Widget Icons ─────────────────────────────────────────────────────
const SETTING_ICONS = {
  budget:       require('@/assets/setting-widget-icon/savings.png'), // TODO: replace with budget.png
  recurring:    require('@/assets/setting-widget-icon/recurring.png'),
  savings:      require('@/assets/setting-widget-icon/savings.png'),
  scan:         require('@/assets/setting-widget-icon/scan.png'),
  inbox:        require('@/assets/setting-widget-icon/inbox.png'),
  tax:          require('@/assets/setting-widget-icon/tax.png'),
  report:       require('@/assets/setting-widget-icon/report.png'),
  wallet:       require('@/assets/setting-widget-icon/wallet.png'),
  category:     require('@/assets/setting-widget-icon/category.png'),
  templates:    require('@/assets/setting-widget-icon/templates.png'),
  backup:       require('@/assets/setting-widget-icon/backup.png'),
  export:       require('@/assets/setting-widget-icon/export.png'),
  notification: require('@/assets/setting-widget-icon/notification.png'),
  lock:         require('@/assets/setting-widget-icon/lock.png'),
  theme:        require('@/assets/setting-widget-icon/theme.png'),
};

// ── Setting Item ─────────────────────────────────────────────────────────────
type SettingItemProps = {
  icon: ImageSourcePropType;
  title: string;
  subtitle?: string;
  onPress: () => void;
};

function SettingItem({ icon, title, subtitle, onPress }: SettingItemProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 13,
        paddingHorizontal: 16,
        backgroundColor: pressed ? colors.border + '40' : 'transparent',
      })}>
      {/* Icon Box */}
      <View style={styles.iconBox}>
        <Image source={icon} style={styles.iconImg} resizeMode="contain" />
      </View>

      {/* Text */}
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>
          {title}
        </Text>
        {subtitle && (
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2, lineHeight: 16 }}>
            {subtitle}
          </Text>
        )}
      </View>

      {/* Chevron */}
      <View style={styles.chevronWrap}>
        <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
      </View>
    </Pressable>
  );
}

type ColorsType = (typeof Colors)['light'];

function SectionLabel({ label, colors }: { label: string; colors: ColorsType }) {
  return (
    <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
      {label}
    </Text>
  );
}

function Divider({ colors }: { colors: ColorsType }) {
  return (
    <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 16 }} />
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>

      {/* ── Custom Header ─────────────────────────────────────────────────── */}
      <LinearGradient
        colors={['#6B94C0', '#8EB8D8', '#ADC6E5']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 10 }]}>

        {/* Settings icon + title row */}
        <View style={styles.headerContent}>
          <View style={styles.headerIconWrap}>
            <Image
              source={require('@/assets/menu-footer/settings.png')}
              style={styles.headerIcon}
              resizeMode="contain"
            />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.headerTitle}>ตั้งค่า</Text>
            <Text style={styles.headerSubtitle}>Poatung · SEVENDOG DEV</Text>
          </View>
          {/* Version badge */}
          <View style={styles.versionBadge}>
            <Text style={styles.versionText}>v1.0</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>

        {/* ── ฟีเจอร์ ───────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionLabel label="ฟีเจอร์" colors={colors} />
          <Card variant="elevated" style={{ padding: 0, overflow: 'hidden' }}>
            <SettingItem
              icon={SETTING_ICONS.templates}
              title="📖 สมุดชีวิต"
              subtitle="บันทึกความทรงจำ ความรู้สึก รูปภาพ และค่าใช้จ่ายในเหตุการณ์เดียวกัน"
              onPress={() => router.push('/diary' as any)}
            />
            <Divider colors={colors} />
            <SettingItem
              icon={SETTING_ICONS.scan}
              title="💳 รับชำระเงิน (PromptPay)"
              subtitle="สร้าง QR PromptPay + ยืนยันสลิปอัตโนมัติ [PRO]"
              onPress={() => router.push('/payment-qr' as any)}
            />
            <Divider colors={colors} />
            <SettingItem
              icon={SETTING_ICONS.notification}
              title="💬 LINE แจ้งเตือน"
              subtitle="รับการแจ้งเตือนสถานะผ่าน LINE OA [SERVER]"
              onPress={() => router.push('/line-connect' as any)}
            />
            <Divider colors={colors} />
            <SettingItem
              icon={SETTING_ICONS.wallet}
              title="🏪 Mini Shop"
              subtitle="เปิดร้านออนไลน์ · สินค้าสูงสุด 5 ชิ้น · รับชำระ PromptPay [SERVER]"
              onPress={() => router.push('/shop-manage' as any)}
            />
            <Divider colors={colors} />
            <SettingItem
              icon={SETTING_ICONS.recurring}
              title="เตรียมงบก่อนออก (Pre-Trip)"
              subtitle="Shopping list + ประมาณงบ + จำราคา + เปรียบ จ่ายจริง vs ประมาณ"
              onPress={() => router.push('/trip-estimator' as any)}
            />
            <Divider colors={colors} />
            <SettingItem
              icon={SETTING_ICONS.budget}
              title="วางแผนงบประมาณ"
              subtitle="ตั้งงบรายหมวด ติดตามการใช้จ่าย คาดการณ์สิ้นเดือน"
              onPress={() => router.push('/budget' as any)}
            />
            <Divider colors={colors} />
            <SettingItem
              icon={SETTING_ICONS.recurring}
              title="ติดตามบิล"
              subtitle="บิลค้างจ่าย / เลยกำหนด / จ่ายแล้ว — ตรวจเงินพอหรือขาด"
              onPress={() => router.push('/bills' as any)}
            />
            <Divider colors={colors} />
            <SettingItem
              icon={SETTING_ICONS.recurring}
              title="รายจ่ายประจำ"
              subtitle="ตั้งค่ารายจ่ายที่ทำซ้ำอัตโนมัติ"
              onPress={() => router.push('/recurring')}
            />
            <Divider colors={colors} />
            <SettingItem
              icon={SETTING_ICONS.savings}
              title="เป้าหมายการออม"
              subtitle="ตั้งเป้าหมายและติดตามความก้าวหน้า"
              onPress={() => router.push('/savings')}
            />
            <Divider colors={colors} />
            <SettingItem
              icon={SETTING_ICONS.scan}
              title="สแกนสลิป"
              subtitle="ถ่ายรูปหรือเลือกสลิปจาก Gallery"
              onPress={() => router.push('/scan-slip' as any)}
            />
            <Divider colors={colors} />
            <SettingItem
              icon={SETTING_ICONS.inbox}
              title="Slip Inbox"
              subtitle="จัดสถานะสลิปในเครื่องและทำเครื่องหมายหลักฐานภาษี"
              onPress={() => router.push('/slip-inbox' as any)}
            />
            <Divider colors={colors} />
            <SettingItem
              icon={SETTING_ICONS.tax}
              title="Tax Box — กล่องลดหย่อนภาษี"
              subtitle="บันทึกรายการลดหย่อน ติดตามเพดาน ส่งออก CSV"
              onPress={() => router.push('/tax-box' as any)}
            />
            <Divider colors={colors} />
            <SettingItem
              icon={SETTING_ICONS.tax}
              title="Tax Checklist"
              subtitle="เช็กเอกสารและรอบยื่น ภ.ง.ด.94 / 90 / 91"
              onPress={() => router.push('/tax-readiness' as any)}
            />
            <Divider colors={colors} />
            <SettingItem
              icon={SETTING_ICONS.report}
              title="รายงานและกราฟ"
              subtitle="Pie Chart, Bar Chart, แนวโน้มรายเดือน"
              onPress={() => router.push('/report')}
            />
          </Card>
        </View>

        {/* ── จัดการ ─────────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionLabel label="จัดการ" colors={colors} />
          <Card variant="elevated" style={{ padding: 0, overflow: 'hidden' }}>
            <SettingItem
              icon={SETTING_ICONS.wallet}
              title="กระเป๋าเงิน"
              subtitle="จัดการบัญชีและกระเป๋าเงิน"
              onPress={() => router.push('/wallet-manage')}
            />
            <Divider colors={colors} />
            <SettingItem
              icon={SETTING_ICONS.category}
              title="หมวดหมู่"
              subtitle="เพิ่ม/แก้ไขหมวดหมู่รายรับรายจ่าย"
              onPress={() => router.push('/category-manage')}
            />
            <Divider colors={colors} />
            <SettingItem
              icon={SETTING_ICONS.templates}
              title="Starter Templates"
              subtitle="เพิ่มหมวดหมู่ตามไลฟ์สไตล์ในครั้งเดียว"
              onPress={() => router.push('/starter-templates' as any)}
            />
          </Card>
        </View>

        {/* ── ข้อมูล ─────────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionLabel label="ข้อมูล" colors={colors} />
          <Card variant="elevated" style={{ padding: 0, overflow: 'hidden' }}>
            <SettingItem
              icon={SETTING_ICONS.backup}
              title="สำรองและกู้คืนข้อมูล"
              subtitle="Backup / Restore ไฟล์ JSON"
              onPress={() => router.push('/backup')}
            />
            <Divider colors={colors} />
            <SettingItem
              icon={SETTING_ICONS.export}
              title="ส่งออกรายงาน"
              subtitle="Export CSV / HTML Report"
              onPress={() => router.push('/export-report')}
            />
          </Card>
        </View>

        {/* ── ทั่วไป ─────────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionLabel label="ทั่วไป" colors={colors} />
          <Card variant="elevated" style={{ padding: 0, overflow: 'hidden' }}>
            <SettingItem
              icon={SETTING_ICONS.notification}
              title="การแจ้งเตือน"
              subtitle="ตั้งเวลาเตือนบันทึกรายจ่าย"
              onPress={() => router.push('/notification-settings')}
            />
            <Divider colors={colors} />
            <SettingItem
              icon={SETTING_ICONS.lock}
              title="ล็อคแอป"
              subtitle="ตั้งค่า FaceID / ลายนิ้วมือ / PIN"
              onPress={() => router.push('/app-lock')}
            />
            <Divider colors={colors} />
            <SettingItem
              icon={SETTING_ICONS.theme}
              title="ธีม"
              subtitle={`โหมดปัจจุบัน: ${colorScheme === 'dark' ? '🌙 มืด' : '☀️ สว่าง'}`}
              onPress={() => {
                const { Appearance } = require('react-native');
                const current = Appearance.getColorScheme();
                Appearance.setColorScheme(current === 'dark' ? 'light' : 'dark');
              }}
            />
          </Card>
        </View>

      </ScrollView>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Header
  header: {
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  headerIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  headerIcon: {
    width: 36,
    height: 36,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  versionBadge: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  versionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Section
  section: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },

  // Item icon
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ADC6E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  iconImg: {
    width: 42,
    height: 42,
  },

  // Chevron
  chevronWrap: {
    width: 20,
    alignItems: 'center',
  },
  chevron: {
    fontSize: 22,
    fontWeight: '300',
    lineHeight: 24,
  },
});
