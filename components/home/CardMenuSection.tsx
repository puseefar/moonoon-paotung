import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { theme } from '@/lib/theme';

type CardItem = {
  id: string;
  type: 'banner' | 'group';
  title: string;
  bg?: string;
  cta?: string;
  items?: string[];
};

const CARDS: CardItem[] = [
  {
    id: 'promo',
    type: 'banner',
    title: 'ประกันที่ใช้ สมัครง่าย แค่ปลายนิ้ว',
    bg: theme.color.primary,
    cta: 'คลิก',
  },
  {
    id: 'store',
    type: 'group',
    title: 'EASY Store ศูนย์รวมบริการทางการเงิน',
    items: ['ใหม่', 'ประกัน', 'สินเชื่อ', 'บัตร', 'บัญชี'],
  },
  {
    id: 'loan',
    type: 'banner',
    title: 'Apply Loan & Credit Card',
    bg: '#F59E0B',
    cta: 'สมัคร',
  },
];

type Props = {
  onCardPress?: (id: string) => void;
};

export function CardMenuSection({ onCardPress }: Props) {
  return (
    <View style={styles.wrap}>
      {CARDS.map(card => (
        <Pressable
          key={card.id}
          style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
          onPress={() => onCardPress?.(card.id)}>
          {card.type === 'banner' ? (
            <BannerCard card={card} />
          ) : (
            <GroupCard card={card} />
          )}
        </Pressable>
      ))}
    </View>
  );
}

function BannerCard({ card }: { card: CardItem }) {
  return (
    <View style={[styles.banner, { backgroundColor: card.bg ?? theme.color.primary }]}>
      <Text style={styles.bannerTitle} numberOfLines={2}>{card.title}</Text>
      {card.cta ? (
        <View style={styles.ctaBtn}>
          <Text style={styles.ctaText}>{card.cta}</Text>
        </View>
      ) : null}
    </View>
  );
}

function GroupCard({ card }: { card: CardItem }) {
  return (
    <View style={styles.groupCard}>
      <Text style={styles.groupTitle}>{card.title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
        <View style={styles.groupItems}>
          {(card.items ?? []).map(item => (
            <View key={item} style={styles.groupItem}>
              <Text style={styles.groupItemText}>{item}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: theme.space.lg,
    gap: 16,
    paddingBottom: theme.space.xl,
  },
  card: {
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  banner: {
    minHeight: 110,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
  },
  bannerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: '#fff',
    lineHeight: 24,
  },
  ctaBtn: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: theme.radius.pill,
    marginLeft: 10,
  },
  ctaText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  groupCard: {
    backgroundColor: '#fff',
    padding: 18,
    minHeight: 100,
  },
  groupTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.color.text,
  },
  groupItems: {
    flexDirection: 'row',
    gap: 10,
  },
  groupItem: {
    backgroundColor: theme.color.bgSoft,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  groupItemText: {
    fontSize: 13,
    color: theme.color.primary,
    fontWeight: '600',
  },
});
