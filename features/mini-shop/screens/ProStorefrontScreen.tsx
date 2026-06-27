import { useState, useCallback } from 'react';
import {
  View, Text, Pressable, ScrollView, Share, Clipboard,
  ActivityIndicator, Image, StyleSheet, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { api } from '@/lib/api/client';
import { useSnackbar } from '@/components/ui/SnackbarProvider';
import { useCart } from '../context/CartContext';
import { resolveVariantPrice, type Shop, type Product, type ShopCategory } from '@/lib/api/contract';

// ── Helpers ────────────────────────────────────────────────
const SHOP_URL_BASE = 'poatung.app/shop/';

const CAT_CONFIG: Record<ShopCategory | 'all', { icon: string; label: string }> = {
  all:         { icon: '🛒', label: 'ทั้งหมด' },
  fashion:     { icon: '👗', label: 'เสื้อผ้า' },
  home:        { icon: '🏠', label: 'ของใช้ในบ้าน' },
  agriculture: { icon: '🌿', label: 'การเกษตร' },
  homemade:    { icon: '✨', label: 'Homemade' },
  secondhand:  { icon: '♻️', label: 'มือสอง' },
  other:       { icon: '⋯',  label: 'อื่น ๆ' },
};

const CAT_BG: Record<ShopCategory, readonly [string, string]> = {
  fashion:     ['#EDE9FE', '#DDD6FE'],
  home:        ['#FCE7F3', '#FBCFE8'],
  agriculture: ['#D1FAE5', '#A7F3D0'],
  homemade:    ['#FEF3C7', '#FDE68A'],
  secondhand:  ['#F3F4F6', '#E5E7EB'],
  other:       ['#DBEAFE', '#BFDBFE'],
};

function isNew(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < 7 * 24 * 60 * 60 * 1000;
}

function calcDiscount(price: number, compare?: number): number {
  if (!compare || compare <= price) return 0;
  return Math.round((1 - price / compare) * 100);
}

function productBadge(p: Product): { label: string; color: string; bg: string } | null {
  if (p.status === 'sold_out')
    return { label: 'สินค้าหมด', color: '#fff', bg: '#6B7280' };
  if (p.stock <= p.lowStockThreshold)
    return { label: `⚠️ เหลือ ${p.stock}`, color: '#fff', bg: '#EF4444' };
  // variant ON → ไม่มี per-variant compare-at → ไม่โชว์ badge ลดราคา (addendum v1.1 A3)
  if (!p.hasVariants && p.comparePrice && p.comparePrice > p.price)
    return { label: '🏷️ ลดราคา', color: '#fff', bg: '#EC4899' };
  if (isNew(p.createdAt))
    return { label: '✨ NEW', color: '#fff', bg: '#7C3AED' };
  return null;
}

// ── Product Card (2-col grid) ─────────────────────────────
function ProductCard({ product, onPress }: { product: Product; onPress: () => void }) {
  const badge = productBadge(product);
  const disc = calcDiscount(product.price, product.comparePrice);
  const isSoldOut = product.status === 'sold_out';
  const bg = CAT_BG[product.category] ?? ['#EDE9FE', '#DDD6FE'];
  const catIcon  = CAT_CONFIG[product.category]?.icon ?? '📦';
  // ถ้า category = 'other' และมี customCategoryLabel → แสดงชื่อที่ตั้งเอง
  const catLabel = (product.category === 'other' && product.customCategoryLabel)
    ? product.customCategoryLabel
    : (CAT_CONFIG[product.category]?.label ?? '');

  // Variant info
  const variantGroup = product.hasVariants && product.variants?.[0] ? product.variants[0] : null;
  const variantCount = variantGroup?.values?.length ?? 0;
  const variantPrices = variantGroup?.values?.map(v => resolveVariantPrice(product.price, v)) ?? [];
  const minPrice = variantPrices.length ? Math.min(...variantPrices) : product.price;
  const maxPrice = variantPrices.length ? Math.max(...variantPrices) : product.price;
  const hasPriceRange = maxPrice > minPrice;

  return (
    <Pressable onPress={onPress} style={styles.productCard}>
      {/* Image area */}
      <View style={{ height: 118, overflow: 'hidden', position: 'relative' }}>
        {product.images?.[0] ? (
          <Image source={{ uri: product.images[0] }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <LinearGradient colors={[...bg] as [string, string]}
            style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontSize: 44 }}>{catIcon}</Text>
          </LinearGradient>
        )}
        {isSoldOut && (
          <View style={[StyleSheet.absoluteFill, {
            backgroundColor: 'rgba(255,255,255,0.55)',
            justifyContent: 'center', alignItems: 'center',
          }]}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: '#6B7280', letterSpacing: 0.5 }}>
              สินค้าหมด
            </Text>
          </View>
        )}
        {badge && (
          <View style={{ position: 'absolute', top: 7, left: 7,
            backgroundColor: badge.bg, borderRadius: 6,
            paddingHorizontal: 6, paddingVertical: 3 }}>
            <Text style={{ fontSize: 9, fontWeight: '800', color: badge.color }}>
              {badge.label}
            </Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={{ padding: 9 }}>
        <Text style={{ fontSize: 9.5, fontWeight: '700', color: '#A78BFA', marginBottom: 2 }}>
          {catIcon} {catLabel}
        </Text>
        <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#2D1B69', marginBottom: 4 }}
          numberOfLines={1}>
          {product.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5, marginBottom: 4 }}>
          <Text style={{ fontSize: 15, fontWeight: '900', color: isSoldOut ? '#9CA3AF' : '#7C3AED' }}>
            {hasPriceRange
              ? `฿${minPrice.toLocaleString()}–${maxPrice.toLocaleString()}`
              : `฿${product.price.toLocaleString()}`}
          </Text>
          {!product.hasVariants && product.comparePrice && product.comparePrice > product.price && !hasPriceRange && (
            <Text style={{ fontSize: 11, color: '#C4B5D8', textDecorationLine: 'line-through' }}>
              ฿{product.comparePrice.toLocaleString()}
            </Text>
          )}
        </View>
        {/* Variant count badge */}
        {variantCount > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            <View style={{ backgroundColor: '#EDE9FE', borderRadius: 6,
              paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ fontSize: 9.5, fontWeight: '700', color: '#6D28D9' }}>
                🎨 {variantCount} {variantGroup!.name}
              </Text>
            </View>
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 10, color: '#B8A5E0' }}>
            {isSoldOut ? 'หมดแล้ว' : `สต็อก ${product.stock ?? 0} ชิ้น`}
          </Text>
          {!isSoldOut && (
            <View style={{ width: 26, height: 26, borderRadius: 8, overflow: 'hidden' }}>
              <LinearGradient colors={['#7C3AED', '#EC4899']}
                style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 13 }}>🛒</Text>
              </LinearGradient>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// ── Main Screen ────────────────────────────────────────────
export default function ProStorefrontScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const { totalItems } = useCart();

  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<ShopCategory | 'all'>('all');
  const [searchText, setSearchText] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    Promise.all([api.getShop(), api.getProducts()]).then(([sr, pr]) => {
      if (sr.ok && sr.data) setShop(sr.data);
      if (pr.ok) setProducts(pr.data.filter(p => p.status !== 'draft'));
      setLoading(false);
    });
  }, []));

  const shopUrl = `${SHOP_URL_BASE}${shop?.name?.toLowerCase().replace(/\s+/g, '') ?? 'shop'}`;

  function handleCopyLink() {
    Clipboard.setString(`https://${shopUrl}`);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
    showSnackbar({ message: '📋 คัดลอกลิงก์แล้ว', variant: 'success' });
  }

  async function handleShareLine() {
    await Share.share({
      message: `🛍️ ร้าน${shop?.name ?? 'ของฉัน'} บน Poatung\nhttps://${shopUrl}`,
      title: shop?.name ?? 'Mini Shop',
    });
  }

  async function handleShareGeneral() {
    await Share.share({
      message: `เข้าร้านได้เลยครับ 👉 https://${shopUrl}`,
    });
  }

  // Filter & search
  const visibleCategories = [
    'all' as const,
    ...new Set(products.map(p => p.category).filter((c): c is ShopCategory => !!c)),
  ] as (ShopCategory | 'all')[];

  const filtered = products.filter(p => {
    const matchCat = activeCategory === 'all' || p.category === activeCategory;
    const matchSearch = !searchText || p.name.toLowerCase().includes(searchText.toLowerCase());
    return matchCat && matchSearch;
  });

  const bestseller = products.find(p => p.status === 'active' && p.stock > 0) ?? products[0];

  const discountedProducts = products.filter(p => p.comparePrice && p.comparePrice > p.price);
  const bannerPct = discountedProducts.length
    ? calcDiscount(discountedProducts[0].price, discountedProducts[0].comparePrice)
    : 0;

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F5FF' }}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F8F5FF' }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <LinearGradient colors={['#6D28D9', '#8B5CF6', '#A855F7']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 6, paddingBottom: 14, paddingHorizontal: 16 }}>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
            <View style={{ width: 42, height: 42, backgroundColor: 'rgba(255,255,255,0.2)',
              borderRadius: 14, justifyContent: 'center', alignItems: 'center',
              borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)' }}>
              <Text style={{ fontSize: 22 }}>🐷</Text>
            </View>
            <View>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>
                {shop?.name ?? '—'}
              </Text>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>
                สินค้า {products.length} รายการ · {shop?.isOpen ? '🟢 เปิดอยู่' : '🔴 ปิดอยู่'}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 7 }}>
            <Pressable onPress={handleShareGeneral}
              style={styles.hdIconBtn}>
              <Text style={{ fontSize: 15 }}>🔗</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/shop-manage' as any)}
              style={styles.hdIconBtn}>
              <Text style={{ fontSize: 15 }}>⚙️</Text>
            </Pressable>
          </View>
        </View>

        {/* Search */}
        <View style={{ position: 'relative' }}>
          <Text style={{ position: 'absolute', left: 12, top: 10, fontSize: 14,
            opacity: 0.7, zIndex: 1 }}>🔍</Text>
          <TextInput
            value={searchText} onChangeText={setSearchText}
            placeholder="ค้นหาสินค้าในร้านนี้..."
            placeholderTextColor="rgba(255,255,255,0.6)"
            style={{ paddingVertical: 10, paddingLeft: 38, paddingRight: 14,
              backgroundColor: 'rgba(255,255,255,0.2)',
              borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)',
              borderRadius: 13, fontSize: 13, color: '#fff' }}
          />
        </View>
      </LinearGradient>

      {/* ── Share Panel ─────────────────────────────────────── */}
      <View style={{ backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 10,
        borderBottomWidth: 1, borderBottomColor: '#F0EAF8' }}>
        <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#9B7FC8',
          letterSpacing: 0.3, marginBottom: 8 }}>
          🔗 แชร์ร้านค้าของคุณ
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 }}>
          <View style={{ flex: 1, backgroundColor: '#F8F5FF',
            borderWidth: 1.5, borderColor: 'rgba(124,58,237,0.2)',
            borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 }}>
            <Text style={{ fontSize: 11, color: '#7C5CB8', fontFamily: 'monospace' }}
              numberOfLines={1}>
              {shopUrl}
            </Text>
          </View>
          <Pressable onPress={handleCopyLink}
            style={{ backgroundColor: linkCopied ? '#DCFCE7' : 'rgba(124,58,237,0.1)',
              borderWidth: 1.5, borderColor: linkCopied ? '#86EFAC' : 'rgba(124,58,237,0.25)',
              borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 }}>
            <Text style={{ fontSize: 11, fontWeight: '700',
              color: linkCopied ? '#065F46' : '#6D28D9' }}>
              {linkCopied ? '✅ คัดลอกแล้ว' : '📋 คัดลอก'}
            </Text>
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', gap: 7 }}>
          {[
            { label: '💬 LINE',     onPress: handleShareLine,    bg: '#06C755', color: '#fff' },
            { label: '📘 Facebook', onPress: handleShareGeneral, bg: '#1877F2', color: '#fff' },
            { label: '📷 QR',       onPress: handleShareGeneral, bg: 'rgba(124,58,237,0.1)', color: '#6D28D9', border: true },
          ].map(btn => (
            <Pressable key={btn.label} onPress={btn.onPress}
              style={{ flex: 1, paddingVertical: 8, borderRadius: 10,
                backgroundColor: btn.bg, alignItems: 'center',
                borderWidth: btn.border ? 1.5 : 0,
                borderColor: btn.border ? 'rgba(124,58,237,0.25)' : 'transparent' }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: btn.color }}>
                {btn.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* ── Scrollable content ──────────────────────────────── */}
      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 24 }}>

        {/* Banner */}
        {products.length > 0 && (
          <View key="banner" style={{ marginBottom: 16 }}>
            <LinearGradient colors={['#4C1D95', '#7C3AED', '#EC4899']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ borderRadius: 18, padding: 18, flexDirection: 'row',
                alignItems: 'center', justifyContent: 'space-between', overflow: 'hidden' }}>
              <View>
                <Text style={{ fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.8)',
                  letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 }}>
                  {bannerPct > 0 ? 'โปรโมชั่นพิเศษ' : 'ร้านค้าออนไลน์'}
                </Text>
                <Text style={{ fontSize: 24, fontWeight: '900', color: '#fff', lineHeight: 28 }}>
                  {bannerPct > 0 ? `ลด ${bannerPct}%\nวันนี้เท่านั้น` : `ร้าน${shop?.name ?? ''}\nยินดีต้อนรับ`}
                </Text>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>
                  {bannerPct > 0 ? 'สินค้าคัดพิเศษ ราคาคุ้ม' : 'ขายสินค้าออนไลน์ได้ง่ายๆ'}
                </Text>
              </View>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.2)',
                borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)',
                borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' }}>
                <Text style={{ fontSize: 20, fontWeight: '900', color: '#fff' }}>
                  {products.filter(p => p.status === 'active').length}
                </Text>
                <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', marginTop: 1 }}>รายการ</Text>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* Category tabs */}
        <View key="categories" style={{ marginBottom: 16 }}>
          <Text style={styles.sectionTitle}>หมวดหมู่</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 4 }}>
            {visibleCategories.map((cat, idx) => {
              const cfg = CAT_CONFIG[cat];
              const active = activeCategory === cat;
              return (
                <Pressable
                  key={`cat-${idx}-${cat}`}
                  onPress={() => setActiveCategory(cat)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4,
                    paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10,
                    borderWidth: 1.5, marginRight: 7,
                    backgroundColor: active ? '#7C3AED' : '#fff',
                    borderColor: active ? '#7C3AED' : 'rgba(167,139,250,0.3)' }}>
                  <Text style={{ fontSize: 12 }}>{cfg?.icon}</Text>
                  <Text style={{ fontSize: 12, fontWeight: '600',
                    color: active ? '#fff' : '#5B21B6' }}>{cfg?.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Best Seller */}
        {bestseller && activeCategory === 'all' && !searchText && (
          <View key="bestseller" style={{ marginBottom: 16 }}>
            <Text style={styles.sectionTitle}>🔥 สินค้าแนะนำ</Text>
            <Pressable onPress={() => router.push({
              pathname: '/shop-product-detail' as any,
              params: { productId: bestseller.productId },
            })}
              style={{ borderRadius: 18, overflow: 'hidden' }}>
              <LinearGradient colors={['#4C1D95', '#6D28D9']}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14,
                  padding: 14, position: 'relative' }}>
                <View style={{ width: 72, height: 72, borderRadius: 16,
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)',
                  justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
                  {bestseller.images?.[0]
                    ? <Image source={{ uri: bestseller.images[0] }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    : <Text style={{ fontSize: 36 }}>{CAT_CONFIG[bestseller.category]?.icon}</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, color: '#FDE68A', fontWeight: '700', marginBottom: 3 }}>
                    👑 อันดับ 1 ของร้าน
                  </Text>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: '#fff', marginBottom: 4 }}
                    numberOfLines={1}>
                    {bestseller.name}
                  </Text>
                  <Text style={{ fontSize: 18, fontWeight: '900', color: '#FDE68A' }}>
                    ฿{bestseller.price.toLocaleString()}
                    {bestseller.comparePrice && bestseller.comparePrice > bestseller.price && (
                      <Text style={{ fontSize: 13, fontWeight: '600',
                        color: 'rgba(255,255,255,0.5)', textDecorationLine: 'line-through' }}>
                        {' '}฿{bestseller.comparePrice.toLocaleString()}
                      </Text>
                    )}
                  </Text>
                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
                    สต็อก {bestseller.stock} ชิ้น
                  </Text>
                </View>
                <Pressable onPress={() => router.push({
                  pathname: '/shop-product-detail' as any,
                  params: { productId: bestseller.productId },
                })}
                  style={{ backgroundColor: 'rgba(255,255,255,0.2)',
                    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)',
                    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff', textAlign: 'center' }}>
                    ดู{'\n'}สินค้า
                  </Text>
                </Pressable>
              </LinearGradient>
            </Pressable>
          </View>
        )}

        {/* Products grid */}
        <View key="products-grid" style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center',
            justifyContent: 'space-between', marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.sectionTitle}>สินค้าทั้งหมด</Text>
              <View style={{ backgroundColor: 'rgba(124,58,237,0.08)',
                borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: '#A78BFA' }}>
                  {filtered.length} รายการ
                </Text>
              </View>
            </View>
            <Text style={{ fontSize: 12, color: '#7C3AED', fontWeight: '600' }}>Pro · สูงสุด 5 ชิ้น</Text>
          </View>

          {filtered.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 32,
              backgroundColor: '#fff', borderRadius: 16 }}>
              <Text style={{ fontSize: 40, marginBottom: 8 }}>📦</Text>
              <Text style={{ fontSize: 14, color: '#9B7FC8', fontWeight: '600' }}>
                {searchText ? 'ไม่พบสินค้า' : 'ยังไม่มีสินค้าในหมวดนี้'}
              </Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 11 }}>
              {filtered.map(p => (
                <View key={p.productId} style={{ width: '47.5%' }}>
                  <ProductCard
                    product={p}
                    onPress={() => router.push({
                      pathname: '/shop-product-detail' as any,
                      params: { productId: p.productId },
                    })}
                  />
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Bottom back button */}
        <Pressable key="back-btn" onPress={() => router.back()}
          style={{ alignItems: 'center', paddingVertical: 12,
            backgroundColor: '#fff', borderRadius: 14,
            borderWidth: 1.5, borderColor: 'rgba(124,58,237,0.2)' }}>
          <Text style={{ fontSize: 14, color: '#7C3AED', fontWeight: '600' }}>← กลับไปหน้าจัดการร้าน</Text>
        </Pressable>

      </ScrollView>

      {/* ── Cart badge FAB ──────────────────────────────────── */}
      {totalItems > 0 && (
        <Pressable onPress={() => router.push('/shop-place-order' as any)}
          style={{ position: 'absolute', bottom: insets.bottom + 20, right: 20,
            width: 56, height: 56, borderRadius: 28, overflow: 'hidden',
            elevation: 8, shadowColor: '#7C3AED', shadowOpacity: 0.4,
            shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}>
          <LinearGradient colors={['#7C3AED', '#EC4899']}
            style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontSize: 22 }}>🛒</Text>
            <View style={{ position: 'absolute', top: 6, right: 6,
              backgroundColor: '#fff', borderRadius: 8, minWidth: 16, height: 16,
              justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 }}>
              <Text style={{ fontSize: 9, fontWeight: '900', color: '#7C3AED' }}>
                {totalItems}
              </Text>
            </View>
          </LinearGradient>
        </Pressable>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  hdIconBtn: {
    width: 34, height: 34,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 11, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  productCard: {
    backgroundColor: '#fff', borderRadius: 16,
    overflow: 'hidden',
    elevation: 3, shadowColor: '#6430C8',
    shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  sectionTitle: {
    fontSize: 15, fontWeight: '800', color: '#2D1B69', marginBottom: 10,
  },
});
