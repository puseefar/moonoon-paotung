import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/lib/theme';
import { getDaypart, GREETING, BG, type Daypart } from '@/lib/time';
import { formatCurrency } from '@/lib/format';

type Props = {
  name: string;
  tambon?: string;
  avatarUri?: string;
  totalBalance?: number;
  onScan?: () => void;
  onQR?: () => void;
};

// scrim เพิ่มความชัดของ text บน gradient แต่ละช่วงเวลา
const SCRIM: Record<Daypart, string> = {
  morning: 'rgba(80,30,0,0.14)',
  day:     'rgba(0,25,70,0.12)',
  evening: 'rgba(40,0,60,0.20)',
  night:   'rgba(0,0,15,0.30)',
};

const GLOW: Record<Daypart, string> = {
  morning: 'rgba(255,220,150,0.22)',
  day:     'rgba(255,255,255,0.14)',
  evening: 'rgba(255,160,100,0.20)',
  night:   'rgba(120,90,255,0.18)',
};

export function HomeHeader({ name, tambon, avatarUri, totalBalance, onScan, onQR }: Props) {
  const part = getDaypart();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();

  // ข้อ 1: header = 1/4 หน้าจอพอดี
  const headerHeight = Math.round(height * 0.25);
  const compact = width < 380 || headerHeight < 200;

  return (
    <View
      style={[
        styles.header,
        {
          height: headerHeight,
          paddingTop: insets.top + (compact ? 8 : 12),
          paddingBottom: compact ? 12 : 16,
        },
      ]}>
      {/* ข้อ 2 & 3: LinearGradient แทนรูปภาพ — ไม่มี transform/scale ไม่เบลอ */}
      <LinearGradient
        colors={BG[part]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
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
                  <FontAwesome name="map-marker" size={compact ? 10 : 11} color="#FF8CA8" />
                  <Text style={[styles.locationText, compact && styles.locationTextCompact]} numberOfLines={1}>
                    {tambon}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.balanceBlock}>
            <Text style={[styles.balanceLabel, compact && styles.balanceLabelCompact]}>
              ยอดรวมทุกกระเป๋า
            </Text>
            <Text
              style={[styles.balanceValue, compact && styles.balanceValueCompact]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}>
              {formatCurrency(totalBalance ?? 0)}
            </Text>
          </View>

          <View style={styles.actionRow}>
            <Pressable style={[styles.actionButton, compact && styles.actionButtonCompact]} onPress={onScan}>
              <View style={styles.actionIconWrap}>
                <FontAwesome name="qrcode" size={compact ? 14 : 15} color="#FFFFFF" />
              </View>
              <Text style={[styles.actionText, compact && styles.actionTextCompact]}>สแกนสลิป</Text>
            </Pressable>

            <Pressable style={[styles.actionButton, compact && styles.actionButtonCompact]} onPress={onQR}>
              <View style={styles.actionIconWrap}>
                <FontAwesome name="credit-card" size={compact ? 14 : 15} color="#FFFFFF" />
              </View>
              <Text style={[styles.actionText, compact && styles.actionTextCompact]}>QR ของฉัน</Text>
            </Pressable>
          </View>
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
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  greetingPillCompact: {
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  greetingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  greetingTextCompact: {
    fontSize: 10,
  },
  heroCard: {
    borderRadius: 26,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#10233F',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 6,
    gap: 10,
  },
  heroCardCompact: {
    borderRadius: 22,
    padding: 10,
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
  },
  nameCompact: {
    fontSize: 17,
  },
  locationPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  locationPillCompact: {
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  locationText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.84)',
  },
  locationTextCompact: {
    fontSize: 9,
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
    fontSize: 9,
  },
  balanceValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  balanceValueCompact: {
    fontSize: 22,
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
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
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
