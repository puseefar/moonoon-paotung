import { useState, useCallback } from 'react';
import {
  View, Text, Pressable, ScrollView, Share, Clipboard,
  ActivityIndicator, Image, StyleSheet, Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { api } from '@/lib/api/client';
import { useSnackbar } from '@/components/ui/SnackbarProvider';
import { useCart } from '../context/CartContext';
import { resolveVariantPrice, type Product, type Shop, type ShopCategory, type VariantValue } from '@/lib/api/contract';
import { VariantSelector } from '../components/VariantSelector';

const { width: SCREEN_W } = Dimensions.get('window');

// ── Helpers ────────────────────────────────────────────────
const CAT_BG: Record<ShopCategory, readonly [string, string]> = {
  fashion:     ['#EDE9FE', '#DDD6FE'],
  home:        ['#FCE7F3', '#FBCFE8'],
  agriculture: ['#D1FAE5', '#A7F3D0'],
  homemade:    ['#FEF3C7', '#FDE68A'],
  secondhand:  ['#F3F4F6', '#E5E7EB'],
  other:       ['#DBEAFE', '#BFDBFE'],
};

const CAT_ICON: Record<ShopCategory, string> = {
  fashion: '👗', home: '🏠', agriculture: '🌿',
  homemade: '✨', secondhand: '♻️', other: '📦',
};

function calcDiscount(price: number, compare?: number): number {
  if (!compare || compare <= price) return 0;
  return Math.round((1 - price / compare) * 100);
}

// ── Main Screen ────────────────────────────────────────────
export default function ProProductDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const { showSnackbar } = useSnackbar();
  const { addItem, items } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [imgIdx, setImgIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [wishlist, setWishlist] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<VariantValue | null>(null);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    Promise.all([api.getProducts(), api.getShop()]).then(([pr, sr]) => {
      if (pr.ok) {
        const found = pr.data.find(p => p.productId === productId);
        setProduct(found ?? null);
      }
      if (sr.ok && sr.data) setShop(sr.data);
      setLoading(false);
    });
  }, [productId]));

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F5FF' }}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }
  if (!product) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F5FF' }}>
        <Text style={{ fontSize: 16, color: '#9B7FC8' }}>ไม่พบสินค้า</Text>
      </View>
    );
  }

  // ใช้เฉพาะ status เพราะ backend เก่าไม่ส่ง stock — stock=0 ไม่ได้หมายความว่าหมดเสมอไป
  const isSoldOut = product.status === 'sold_out';

  // คำนวณราคาตาม variant ที่เลือก (absolute — addendum v1.1)
  const displayPrice = selectedVariant
    ? resolveVariantPrice(product.price, selectedVariant)
    : product.price;
  // variant ON → ไม่มี per-variant compare-at → ไม่โชว์ badge ลด % (addendum v1.1 A3)
  const discPct = product.hasVariants ? 0 : calcDiscount(displayPrice, product.comparePrice);

  // สต็อกที่แสดง: ถ้าเลือก variant ให้ใช้สต็อกของ variant นั้น, ถ้าไม่ใช้รวม
  const displayStock = selectedVariant
    ? selectedVariant.stock
    : product.hasVariants && product.variants?.[0]
      ? product.variants[0].values.reduce((s, v) => s + (v.stock ?? 0), 0)
      : product.stock ?? 0;

  const bg = CAT_BG[product.category] ?? ['#EDE9FE', '#DDD6FE'];
  const catIcon = CAT_ICON[product.category] ?? '📦';
  const images = product.images?.length ? product.images : [];
  const cartQty = items.find(i => i.productId === productId)?.qty ?? 0;
  const shopUrl = `poatung.app/shop/${shop?.name?.toLowerCase().replace(/\s+/g, '') ?? 'shop'}/p/${productId}`;

  async function handleShareProduct() {
    await Share.share({
      message: `🛍️ ${product!.name} ราคา ฿${product!.price.toLocaleString()}\n👉 https://${shopUrl}`,
    });
  }

  function handleCopyLink() {
    Clipboard.setString(`https://${shopUrl}`);
    showSnackbar({ message: '📋 คัดลอกลิงก์แล้ว', variant: 'success' });
  }

  function handleAddToCart() {
    if (isSoldOut) return;
    // validate variant selection
    const prod = product!;
    if (prod.hasVariants && prod.variants?.length && !selectedVariant) {
      showSnackbar({ message: '⚠️ กรุณาเลือกตัวเลือกสินค้าก่อน', variant: 'error' });
      return;
    }
    const finalPrice = selectedVariant
      ? resolveVariantPrice(prod.price, selectedVariant)
      : prod.price;
    const itemName = selectedVariant
      ? `${prod.name} (${prod.variants![0].name}: ${selectedVariant.label})`
      : prod.name;
    // snapshot ต้นทุน: variant ใช้ costPrice ของ variant, ไม่มี variant ใช้ของ product
    // (undefined = ยังไม่ตั้งต้นทุน — ห้ามเดา = 0 → กัน margin ปลอม)
    const finalCost = selectedVariant
      ? selectedVariant.costPrice
      : (prod.costPrice && prod.costPrice > 0 ? prod.costPrice : undefined);
    addItem({
      productId: prod.productId,
      variantId: selectedVariant?.id,
      variantLabel: selectedVariant?.label,
      name: itemName,
      price: finalPrice,
      unitCost: finalCost,
      comparePrice: prod.comparePrice,
      image: images[0],
    }, qty);
    showSnackbar({ message: `🛒 เพิ่ม "${itemName}" x${qty} ลงตะกร้าแล้ว`, variant: 'success' });
  }

  function handleBuyNow() {
    handleAddToCart();
    router.push('/shop-place-order' as any);
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F8F5FF' }}>

      {/* ── Overlay top nav ─────────────────────────────────── */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 8 }}>
        <Pressable onPress={() => router.back()} style={styles.navBtn}>
          <Text style={{ fontSize: 16 }}>←</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable onPress={() => setWishlist(w => !w)} style={styles.navBtn}>
            <Text style={{ fontSize: 16 }}>{wishlist ? '❤️' : '🤍'}</Text>
          </Pressable>
          <Pressable onPress={handleShareProduct} style={styles.navBtn}>
            <Text style={{ fontSize: 16 }}>⋯</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>

        {/* ── Image carousel ──────────────────────────────────── */}
        <View style={{ height: 280, backgroundColor: '#F3F0FF' }}>
          {images.length > 0 ? (
            <>
              <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={e => {
                  setImgIdx(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W));
                }}>
                {images.map((uri, i) => (
                  <Image key={i} source={{ uri }} style={{ width: SCREEN_W, height: 280 }} resizeMode="cover" />
                ))}
              </ScrollView>
              {/* Dots */}
              {images.length > 1 && (
                <View style={{ position: 'absolute', bottom: 12,
                  flexDirection: 'row', gap: 5, alignSelf: 'center' }}>
                  {images.map((_, i) => (
                    <View key={i} style={{
                      height: 6, borderRadius: 3,
                      width: i === imgIdx ? 18 : 6,
                      backgroundColor: i === imgIdx ? '#7C3AED' : 'rgba(124,58,237,0.25)',
                    }} />
                  ))}
                </View>
              )}
              {/* Count badge */}
              <View style={{ position: 'absolute', bottom: 12, right: 16,
                backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 10,
                paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontSize: 11, color: '#fff', fontWeight: '700' }}>
                  {imgIdx + 1} / {images.length}
                </Text>
              </View>
            </>
          ) : (
            <LinearGradient colors={[...bg] as [string, string]}
              style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 80 }}>{catIcon}</Text>
            </LinearGradient>
          )}
        </View>

        {/* ── Price + name ─────────────────────────────────────── */}
        <View style={{ padding: 16, backgroundColor: '#fff',
          borderBottomWidth: 1, borderBottomColor: '#F0EAF8' }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
            <Text style={{ fontSize: 26, fontWeight: '900',
              color: isSoldOut ? '#9CA3AF' : '#7C3AED' }}>
              ฿{displayPrice.toLocaleString()}
            </Text>
            {!product.hasVariants && product.comparePrice && product.comparePrice > displayPrice && (
              <Text style={{ fontSize: 14, color: '#C4B5D8', textDecorationLine: 'line-through' }}>
                ฿{product.comparePrice.toLocaleString()}
              </Text>
            )}
            {discPct > 0 && (
              <View style={{ backgroundColor: 'rgba(236,72,153,0.1)',
                borderWidth: 1.5, borderColor: 'rgba(236,72,153,0.25)',
                borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#BE185D' }}>
                  ลด {discPct}%
                </Text>
              </View>
            )}
          </View>

          <Text style={{ fontSize: 16, fontWeight: '800', color: '#2D1B69', marginBottom: 10 }}>
            {product.name}
          </Text>

          {/* Badges row */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {!isSoldOut && (
              <View style={[styles.badge, { backgroundColor: 'rgba(16,185,129,0.1)',
                borderColor: 'rgba(16,185,129,0.3)' }]}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#059669' }}>✓ พร้อมส่ง</Text>
              </View>
            )}
            {displayStock > 0 && (
              <View style={[styles.badge, { backgroundColor: 'rgba(124,58,237,0.08)',
                borderColor: 'rgba(124,58,237,0.25)' }]}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#6D28D9' }}>
                  เหลือ {displayStock} ชิ้น
                </Text>
              </View>
            )}
            {product.shipping?.free && (
              <View style={[styles.badge, { backgroundColor: 'rgba(59,130,246,0.08)',
                borderColor: 'rgba(59,130,246,0.25)' }]}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#1D4ED8' }}>🚚 ส่งฟรี</Text>
              </View>
            )}
            {product.shipping?.cod && (
              <View style={[styles.badge, { backgroundColor: 'rgba(16,185,129,0.1)',
                borderColor: 'rgba(16,185,129,0.3)' }]}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#059669' }}>รับ COD</Text>
              </View>
            )}
            {isSoldOut && (
              <View style={[styles.badge, { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' }]}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#6B7280' }}>❌ สินค้าหมด</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Share row ────────────────────────────────────────── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8,
          padding: 12, backgroundColor: '#fff',
          borderBottomWidth: 1, borderBottomColor: '#F0EAF8' }}>
          <Text style={{ fontSize: 12, color: '#9B7FC8', flex: 1, fontWeight: '600' }}>
            แชร์สินค้านี้ให้เพื่อน
          </Text>
          <Pressable onPress={handleShareProduct}
            style={{ backgroundColor: '#06C755', borderRadius: 8,
              paddingHorizontal: 10, paddingVertical: 6 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>💬 LINE</Text>
          </Pressable>
          <Pressable onPress={handleCopyLink}
            style={{ backgroundColor: 'rgba(124,58,237,0.1)',
              borderWidth: 1.5, borderColor: 'rgba(124,58,237,0.25)',
              borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#6D28D9' }}>📋 คัดลอกลิงก์</Text>
          </Pressable>
        </View>

        {/* ── Description ─────────────────────────────────────── */}
        {product.description ? (
          <View style={styles.sectionCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <View style={{ width: 26, height: 26, backgroundColor: '#7C3AED',
                borderRadius: 8, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 13 }}>📋</Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#2D1B69' }}>รายละเอียดสินค้า</Text>
            </View>
            <Text style={{ fontSize: 13, color: '#4B3A8A', lineHeight: 20 }}>
              {product.description}
            </Text>

            {/* Shipping details */}
            {(product.shipping?.fixed || product.shipping?.pickup) && (
              <View style={{ marginTop: 12, paddingTop: 12,
                borderTopWidth: 1, borderTopColor: '#F0EAF8' }}>
                {product.shipping.fixed && (
                  <View style={styles.descRow}>
                    <Text style={styles.descKey}>ค่าส่ง</Text>
                    <Text style={styles.descVal}>฿{product.shipping.fixedPrice} (คงที่)</Text>
                  </View>
                )}
                {product.shipping.pickup && (
                  <View style={styles.descRow}>
                    <Text style={styles.descKey}>รับสินค้า</Text>
                    <Text style={styles.descVal}>นัดรับเองได้ · ติดต่อทางร้าน</Text>
                  </View>
                )}
                {product.shipping.cod && (
                  <View style={styles.descRow}>
                    <Text style={styles.descKey}>COD</Text>
                    <Text style={styles.descVal}>เก็บเงินปลายทาง ✓</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        ) : null}

        {/* ── Shop mini card ───────────────────────────────────── */}
        {shop && (
          <View style={styles.sectionCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 44, height: 44, backgroundColor: '#7C3AED',
                borderRadius: 14, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 22 }}>🐷</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#2D1B69' }}>{shop.name}</Text>
                <Text style={{ fontSize: 11, color: '#9B7FC8', marginTop: 1 }}>
                  {shop.hasPhysicalLocation ? `📍 ${shop.address ?? shop.openHours ?? ''}` : '🛒 ขายออนไลน์'}
                  {shop.isOpen ? ' · 🟢 เปิดอยู่' : ' · 🔴 ปิดอยู่'}
                </Text>
              </View>
              <Pressable onPress={() => router.push('/shop-storefront' as any)}
                style={{ backgroundColor: 'rgba(124,58,237,0.1)',
                  borderWidth: 1.5, borderColor: 'rgba(124,58,237,0.25)',
                  borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#6D28D9' }}>ดูร้าน</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ── Variant selector ─────────────────────────────────── */}
        {!isSoldOut && product.hasVariants && product.variants?.[0] && (
          <View style={{ marginHorizontal: 14, marginBottom: 10 }}>
            <VariantSelector
              group={product.variants[0]}
              selectedId={selectedVariant?.id ?? null}
              onSelect={v => {
                setSelectedVariant(v);
                setQty(1);
              }}
              basePrice={product.price}
            />
          </View>
        )}

        {/* ── Flash Sale countdown ─────────────────────────────── */}
        {/* variant ON → ไม่มี discount ต่อ variant → ไม่โชว์ countdown (addendum v1.1 §5) */}
        {!product.hasVariants && product.saleEndsAt && new Date(product.saleEndsAt) > new Date() && (
          <View style={{ marginHorizontal: 14, marginBottom: 10,
            backgroundColor: '#FDF2F8', borderRadius: 12,
            borderWidth: 1.5, borderColor: 'rgba(236,72,153,0.3)',
            padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 20 }}>⚡</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: '#BE185D' }}>Flash Sale!</Text>
              <Text style={{ fontSize: 11, color: '#9B7FC8', marginTop: 1 }}>
                หมดเวลา {new Date(product.saleEndsAt).toLocaleTimeString('th-TH', {
                  hour: '2-digit', minute: '2-digit',
                })} น.
              </Text>
            </View>
            <View style={{ backgroundColor: '#EC4899', borderRadius: 8,
              paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: '900', color: '#fff' }}>
                ลด {discPct}%
              </Text>
            </View>
          </View>
        )}

        {/* ── Qty selector ─────────────────────────────────────── */}
        {!isSoldOut && (
          <View style={[styles.sectionCard, { flexDirection: 'row', alignItems: 'center' }]}>
            <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: '#2D1B69' }}>
              จำนวน
              {cartQty > 0 && (
                <Text style={{ fontSize: 11, color: '#A78BFA' }}> (ในตะกร้า {cartQty} ชิ้น)</Text>
              )}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center',
              borderWidth: 1.5, borderColor: 'rgba(124,58,237,0.3)',
              borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.9)' }}>
              <Pressable onPress={() => setQty(q => Math.max(1, q - 1))}
                style={{ width: 36, height: 36, backgroundColor: 'rgba(124,58,237,0.06)',
                  justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 18, color: '#7C3AED', fontWeight: '700' }}>−</Text>
              </Pressable>
              <Text style={{ width: 40, textAlign: 'center', fontSize: 16,
                fontWeight: '800', color: '#2D1B69' }}>{qty}</Text>
              <Pressable onPress={() => setQty(q => Math.min(displayStock || 999, q + 1))}
                style={{ width: 36, height: 36, backgroundColor: 'rgba(124,58,237,0.06)',
                  justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 18, color: '#7C3AED', fontWeight: '700' }}>+</Text>
              </Pressable>
            </View>
          </View>
        )}

      </ScrollView>

      {/* ── Fixed bottom bar ─────────────────────────────────── */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F0EAF8',
        paddingHorizontal: 16, paddingBottom: insets.bottom + 12, paddingTop: 12,
        flexDirection: 'row', gap: 10,
        elevation: 8, shadowColor: '#6D28D9', shadowOpacity: 0.1,
        shadowRadius: 12, shadowOffset: { width: 0, height: -4 },
      }}>
        {isSoldOut ? (
          <View style={{ flex: 1, paddingVertical: 14, borderRadius: 14,
            backgroundColor: '#F3F4F6', alignItems: 'center' }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#9CA3AF' }}>
              สินค้าหมดแล้ว
            </Text>
          </View>
        ) : (
          <>
            <Pressable onPress={handleAddToCart}
              style={{ flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center',
                backgroundColor: 'rgba(124,58,237,0.08)',
                borderWidth: 2, borderColor: '#7C3AED' }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#6D28D9' }}>
                🛒 เพิ่มในตะกร้า
              </Text>
            </Pressable>

            <Pressable onPress={handleBuyNow}
              style={{ flex: 1.4, borderRadius: 14, overflow: 'hidden' }}>
              <LinearGradient colors={['#7C3AED', '#EC4899']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={{ paddingVertical: 14, alignItems: 'center',
                  elevation: 4, shadowColor: '#7C3AED',
                  shadowOpacity: 0.35, shadowRadius: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff' }}>
                  ⚡ ซื้อเลย
                </Text>
              </LinearGradient>
            </Pressable>
          </>
        )}
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  navBtn: {
    width: 36, height: 36,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 12, justifyContent: 'center', alignItems: 'center',
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4,
  },
  badge: {
    borderWidth: 1.5, borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  sectionCard: {
    margin: 14, marginTop: 0, marginBottom: 10,
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    elevation: 1, shadowColor: '#6430C8', shadowOpacity: 0.05, shadowRadius: 6,
  },
  descRow: {
    flexDirection: 'row', paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: '#F8F5FF',
  },
  descKey: { fontSize: 12, color: '#A78BFA', width: 90 },
  descVal: { fontSize: 12, color: '#4B3A8A', flex: 1, lineHeight: 18 },
});
