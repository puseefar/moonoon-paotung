import { Image, ImageBackground, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/lib/theme';
import { getDaypart, GREETING, BG, type Daypart } from '@/lib/time';
import { formatCurrency } from '@/lib/format';
import { WalletAvatar } from '@/components/wallet/WalletAvatar';
import { getWalletBrandPreset } from '@/constants/walletBrands';

// สีเริ่มต้นของกระเป๋าที่ไม่ใช่แบรนด์ธนาคาร (เช่น เงินสด) — โทนส้มอ่อน
const CASH_CHIP_COLOR = '#EF6C00';
const CASH_CHIP_BG = '#FFF0E0';

// รูปภาพพื้นหลังตามช่วงเวลา (ใส่ null = ใช้ gradient แทน)
const BG_IMAGE: Record<Daypart, ReturnType<typeof require> | null> = {
  morning: require('@/assets/scenery/headder-morrning.png'),
  day:     require('@/assets/scenery/headder-day.png'),
  evening: null,                                              // ยังไม่มีรูป → ใช้ gradient
  night:   require('@/assets/scenery/header-night.png'),
};

type WalletBrief = { name: string; balance: number; icon?: string | null };

type Props = {
  name: string;
  tambon?: string;
  avatarUri?: string;
  totalBalance?: number;
  wallets?: WalletBrief[];
};

// scrim — ลดลงมากเพื่อไม่ให้รูปภาพมืดหรือสีเพี้ยน
const SCRIM: Record<Daypart, string> = {
  morning: 'rgba(203, 128, 253, 0.11)',  
  day:     'rgba(0,25,70,0.04)',
  evening: 'rgba(40,0,60,0.08)',
  night:   'rgba(0,0,15,0.10)',
};

const GLOW: Record<Daypart, string> = {
  morning: 'rgba(36, 129, 250, 0.247)', 
  day:     'rgba(255,255,255,0.14)',
  evening: 'rgba(255,160,100,0.20)',
  night:   'rgba(120,90,255,0.18)',
};

export function HomeHeader({ name, tambon, avatarUri, totalBalance, wallets }: Props) {
  const part = getDaypart();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();

  // ข้อ 1: header = 1/4 หน้าจอพอดี
  const headerHeight = Math.round(height * 0.25);
  const compact = width < 380 || headerHeight < 200;

  // §4.1 — chip แยกยอดแต่ละกระเป๋า สีตามแบรนด์ (ธ.ก.ส.=เขียว, กรุงไทย=ฟ้า, เงินสด=ส้ม)
  const walletChips = (wallets ?? [])
    .filter((w) => w.balance !== 0)
    .map((w) => {
      const brand = getWalletBrandPreset(w.icon);
      return {
        name: w.name,
        balance: w.balance,
        icon: w.icon ?? null,
        color: brand?.color ?? CASH_CHIP_COLOR,
        backgroundColor: brand?.backgroundColor ?? CASH_CHIP_BG,
      };
    });

  return (
    <View
      style={[
        styles.header,
        {
          minHeight: headerHeight,
          paddingTop: insets.top + (compact ? 8 : 12),
          paddingBottom: compact ? 12 : 16,
        },
      ]}>
      {/* พื้นหลัง: รูปภาพ (ถ้ามี) หรือ Gradient */}
      {BG_IMAGE[part] ? (
        <ImageBackground
          source={BG_IMAGE[part]!}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
          imageStyle={{ opacity: 1 }}>
          {/* overlay ฟ้าอ่อนโปร่งใส — ไม่ทำให้รูปมืดหรือสีเพี้ยน */}
          <LinearGradient
            colors={['rgba(120,180,255,0.10)', 'rgba(180,220,255,0.04)', 'rgba(100,160,240,0.12)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        </ImageBackground>
      ) : (
        <LinearGradient
          colors={BG[part]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      )}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: SCRIM[part] }]} />
      <View style={[styles.glow, { backgroundColor: GLOW[part] }]} />

      <View style={styles.content}>
        <View style={[styles.greetingPill, compact && styles.greetingPillCompact]}>
          <Text style={[styles.greetingText, compact && styles.greetingTextCompact]}>
            {GREETING[part]}
          </Text>
        </View>

        <View style={[styles.heroCard, compact && styles.heroCardCompact]}>
          <View style={styles.identityRow}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={[styles.avatar, compact && styles.avatarCompact]} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback, compact && styles.avatarCompact]}>
                <FontAwesome name="user" size={compact ? 23 : 26} color="#fff" />
              </View>
            )}

            <View style={styles.identityCopy}>
              <Text style={[styles.name, compact && styles.nameCompact]} numberOfLines={1}>
                {name}
              </Text>
              {tambon ? (
                <View style={[styles.locationPill, compact && styles.locationPillCompact]}>
                  <FontAwesome name="map-marker" size={compact ? 12 : 14} color="#f32ec8" />
                  <Text style={[styles.locationText, compact && styles.locationTextCompact]} numberOfLines={1}>
                    {tambon}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.balanceBlock}>
            <Text style={[styles.balanceLabel, compact && styles.balanceLabelCompact]}>
              ยอดเงินทั้งหมด
            </Text>
            <Text
              style={[styles.balanceValue, compact && styles.balanceValueCompact]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}>
              {formatCurrency(totalBalance ?? 0)}
            </Text>
            {walletChips.length > 0 ? (
              <View style={styles.chipRow}>
                {walletChips.map((w, i) => (
                  <View key={`${w.name}-${i}`} style={[styles.walletChip, { backgroundColor: w.backgroundColor }]}>
                    <WalletAvatar icon={w.icon} size={16} backgroundColor="transparent" />
                    <Text style={[styles.walletChipText, { color: w.color }]} numberOfLines={1}>
                      {w.name} {formatCurrency(w.balance)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          {/* Action buttons removed — สแกนสลิปอยู่ใน MenuGrid แล้ว */}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    left: -20,
    right: -20,
    bottom: -42,
    height: '62%',
    borderRadius: 999,
    opacity: 0.8,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: theme.space.lg,
  },
  greetingPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 2,
    paddingVertical: 2,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  greetingPillCompact: {
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  greetingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  greetingTextCompact: {
    fontSize: 14,
  },
  heroCard: {
    padding: 4,
    backgroundColor: 'transparent',
    borderWidth: 0,
    gap: 10,
  },
  heroCardCompact: {
    padding: 2,
    gap: 8,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: theme.radius.pill,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.72)',
  },
  avatarCompact: {
    width: 40,
    height: 40,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  identityCopy: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  nameCompact: {
    fontSize: 18,
  },
  locationPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'transparent',
  },
  locationPillCompact: {
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  locationText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.84)',
  },
  locationTextCompact: {
    fontSize: 12,
  },
  balanceBlock: {
    gap: 2,
  },
  balanceLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.76)',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  balanceLabelCompact: {
    fontSize: 12,
  },
  balanceValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0ff31a',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  balanceValueCompact: {
    fontSize: 18,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  walletChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 3,
    paddingRight: 9,
    paddingVertical: 3,
    borderRadius: 999,
    // เงาบางๆ ให้ลอยเหนือรูปพื้นหลัง
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 2,
    elevation: 2,
  },
  walletChipText: {
    fontSize: 11,
    fontWeight: '800',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 18,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderWidth: 0,
  },
  actionButtonCompact: {
    gap: 5,
    paddingVertical: 7,
    borderRadius: 16,
  },
  actionIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  actionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionTextCompact: {
    fontSize: 10,
  },
});
