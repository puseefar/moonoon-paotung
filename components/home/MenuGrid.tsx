import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '@/lib/theme';

type MenuItem = {
  id: string;
  image: ReturnType<typeof require>;
  label: string;
  route: string;
};

const MENU_ITEMS: MenuItem[] = [
  { id: 'add',       image: require('@/assets/menu-widget/add.png'),       label: 'บันทึก',        route: '/(tabs)/add' },
  { id: 'history',   image: require('@/assets/menu-widget/history.png'),   label: 'ประวัติ',       route: '/(tabs)/history' },
  { id: 'report',    image: require('@/assets/menu-widget/report.png'),    label: 'รายงาน',        route: '/report' },
  { id: 'scan',      image: require('@/assets/menu-widget/scan.png'),      label: 'สแกนสลิป',     route: '/scan-slip' },
  { id: 'inbox',     image: require('@/assets/menu-widget/inbox.png'),     label: 'Slip Inbox',    route: '/slip-inbox' },
  { id: 'recurring', image: require('@/assets/menu-widget/recurring.png'), label: 'รายจ่ายประจำ',  route: '/recurring' },
  { id: 'savings',   image: require('@/assets/menu-widget/savings.png'),   label: 'เป้าหมายออม',  route: '/savings' },
  { id: 'tax',       image: require('@/assets/menu-widget/tax.png'),       label: 'Tax',           route: '/tax-readiness' },
  { id: 'wallet',    image: require('@/assets/menu-widget/wallet.png'),    label: 'กระเป๋าเงิน',  route: '/wallet-manage' },
  { id: 'export',    image: require('@/assets/menu-widget/export.png'),    label: 'ส่งออก',        route: '/export-report' },
];

type MenuGridProps = {
  onItemPress?: (item: MenuItem) => void;
};

function MenuGridContent({ onItemPress }: MenuGridProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>เมนูลัด</Text>
      <View style={styles.grid}>
        {MENU_ITEMS.map(item => (
          <Pressable
            key={item.id}
            style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
            onPress={() => onItemPress?.(item)}
          >
            <View style={styles.iconWrap}>
              <Image source={item.image} style={styles.iconImage} resizeMode="contain" />
            </View>
            <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function MenuGrid({ onItemPress }: MenuGridProps = {}) {
  const router = useRouter();
  return (
    <MenuGridContent
      onItemPress={onItemPress ?? ((item) => router.push(item.route as any))}
    />
  );
}

export function StaticMenuGrid({ onItemPress }: MenuGridProps = {}) {
  return <MenuGridContent onItemPress={onItemPress} />;
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 16,
    gap: 10,
  },
  sectionTitle: {
    paddingHorizontal: theme.space.lg,
    fontSize: 11,
    fontWeight: '700',
    color: theme.color.sub,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: theme.space.lg,
  },
  item: {
    width: '20%',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  itemPressed: {
    opacity: 0.65,
    transform: [{ scale: 0.90 }],
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 10,
    overflow: 'hidden',
  },
  iconImage: {
    width: 56,
    height: 56,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.color.text,
    textAlign: 'center',
  },
});
