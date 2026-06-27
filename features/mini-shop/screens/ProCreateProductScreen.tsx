import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView,
  ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, Image, StyleSheet, Switch,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { api } from '@/lib/api/client';
import { useSnackbar } from '@/components/ui/SnackbarProvider';
import { SHOP_TIER_CONFIG } from '../config/shopTierConfig';
import { VariantEditor } from '../components/VariantEditor';
import { resolveVariantPrice } from '@/lib/api/contract';
import type {
  ShopCategory, ProductStatus, ShippingOptions, ProductInput, Product, Shop,
  VariantOptionGroup,
} from '@/lib/api/contract';

// ── Constants ──────────────────────────────────────────────
const MAX_IMAGES = 3;
const MAX_PRODUCTS = SHOP_TIER_CONFIG.pro.maxProducts;

const CATEGORIES: { id: ShopCategory; icon: string; label: string }[] = [
  { id: 'fashion',     icon: '👗', label: 'เสื้อผ้า' },
  { id: 'home',        icon: '🏠', label: 'ของใช้ในบ้าน' },
  { id: 'agriculture', icon: '🌿', label: 'การเกษตร' },
  { id: 'homemade',    icon: '✨', label: 'Homemade' },
  { id: 'secondhand',  icon: '♻️', label: 'มือสอง' },
  { id: 'other',       icon: '⋯',  label: 'อื่น ๆ' },
];

const MAX_CUSTOM_CATEGORY_LEN = 20;

const DEFAULT_SHIPPING: ShippingOptions = {
  free: true, fixed: false, fixedPrice: 40, pickup: false, cod: false,
};

// ── Helpers ────────────────────────────────────────────────
function calcDiscount(sell: number, compare: number): number {
  if (!compare || compare <= sell) return 0;
  return Math.round((1 - sell / compare) * 100);
}

// ── Sub-components ─────────────────────────────────────────
function SectionHeader({ icon, title, badge }: { icon: string; title: string; badge?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8,
      marginBottom: 12, paddingBottom: 8,
      borderBottomWidth: 1.5, borderBottomColor: 'rgba(167,139,250,0.2)' }}>
      <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: '#7C3AED',
        justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 13 }}>{icon}</Text>
      </View>
      <Text style={{ flex: 1, fontSize: 14, fontWeight: '800', color: '#2D1B69' }}>{title}</Text>
      {badge && (
        <View style={{ backgroundColor: 'rgba(124,58,237,0.08)', borderRadius: 6,
          paddingHorizontal: 7, paddingVertical: 2 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: '#9B7FC8' }}>{badge}</Text>
        </View>
      )}
    </View>
  );
}

const LABEL_STYLE = { fontSize: 12.5, fontWeight: '700' as const, color: '#5B21B6', marginBottom: 6 };
const INPUT_STYLE = {
  backgroundColor: 'rgba(255,255,255,0.9)',
  borderWidth: 1.5, borderColor: 'rgba(167,139,250,0.4)',
  borderRadius: 12, padding: 11,
  fontSize: 14, color: '#2D1B69',
  // กันตัวเลขโดน clip บน Android (PKG-05 ข้อ 1)
  includeFontPadding: false, textAlignVertical: 'center' as const,
} as const;

// ── Main Screen ────────────────────────────────────────────
export default function ProCreateProductScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { productId } = useLocalSearchParams<{ productId?: string }>();
  const { showSnackbar } = useSnackbar();
  const isEdit = !!productId;

  const [shop, setShop] = useState<Shop | null>(null);
  const [existingCount, setExistingCount] = useState(0);
  const [saving, setSaving] = useState(false);

  // Section 1 — รูปภาพ
  const [images, setImages] = useState<string[]>([]);

  // Section 2 — ข้อมูล
  const [name, setName]                       = useState('');
  const [category, setCategory]               = useState<ShopCategory>('fashion');
  const [customCategoryLabel, setCustomCategoryLabel] = useState('');
  const [description, setDescription]         = useState('');

  // Section 3 — ราคา
  const [costPrice, setCostPrice]         = useState('');
  const [wholesalePrice, setWholesalePrice] = useState('');
  const [sellPrice, setSellPrice]         = useState('');
  const [comparePrice, setComparePrice]   = useState('');

  // Section 4 — สต็อก & สถานะ
  const [stock, setStock]             = useState(10);
  const [threshold, setThreshold]     = useState(3);
  const [hideWhenOut, setHideWhenOut] = useState(false);
  const [status, setStatus]           = useState<ProductStatus>('active');

  // Section 5 — จัดส่ง
  const [shipping, setShipping]       = useState<ShippingOptions>(DEFAULT_SHIPPING);

  // Section 6 — Variants
  const [hasVariants, setHasVariants] = useState(false);
  const [variantGroup, setVariantGroup] = useState<VariantOptionGroup | null>(null);

  // Flash sale
  const [hasSale, setHasSale]         = useState(false);

  useFocusEffect(useCallback(() => {
    api.getShop().then(r => { if (r.ok && r.data) setShop(r.data); });
    api.getProducts().then(r => {
      if (r.ok) setExistingCount(r.data.filter(p => !p.status || p.status === 'active').length);
    });
  }, []));

  // ── Pre-fill เมื่อเป็น edit mode ─────────────────────────
  useEffect(() => {
    if (!isEdit || !productId) return;
    api.getProducts().then(r => {
      if (!r.ok) return;
      const prod = r.data.find(p => p.productId === productId);
      if (!prod) return;

      // Section 1 — รูปภาพ
      setImages(prod.images ?? []);
      // Section 2 — ข้อมูล
      setName(prod.name ?? '');
      setCategory(prod.category ?? 'other');
      setCustomCategoryLabel(prod.customCategoryLabel ?? '');
      setDescription(prod.description ?? '');
      // Section 3 — ราคา
      setSellPrice(String(prod.price ?? ''));
      setComparePrice(prod.comparePrice ? String(prod.comparePrice) : '');
      setCostPrice(prod.costPrice ? String(prod.costPrice) : '');
      setWholesalePrice(prod.wholesalePrice ? String(prod.wholesalePrice) : '');
      // Section 4 — สต็อก
      setStock(prod.stock ?? 10);
      setThreshold(prod.lowStockThreshold ?? 3);
      setHideWhenOut(prod.hideWhenOutOfStock ?? false);
      setStatus(prod.status ?? 'active');
      // Section 5 — จัดส่ง (merged จาก local → ได้ค่าที่ user บันทึกไว้จริง)
      if (prod.shipping) setShipping(prod.shipping);
      // Section 6 — Variants
      if (prod.hasVariants && prod.variants?.length) {
        setHasVariants(true);
        // Migrate ข้อมูลเก่า: variant ที่เก็บแค่ extraPrice (delta) → แปลงเป็น price absolute
        // ครั้งเดียวตอนโหลด เพื่อให้แก้ base price ทีหลังไม่กระทบ variant เดิม (addendum v1.1 A1)
        const g = prod.variants[0];
        setVariantGroup({
          ...g,
          values: g.values.map(v => ({
            ...v,
            price: v.price ?? (prod.price + (v.extraPrice ?? 0)),
            extraPrice: undefined,
          })),
        });
      }
    });
  }, [isEdit, productId]);

  // ── Image Picker ─────────────────────────────────────────
  async function handlePickImages() {
    if (images.length >= MAX_IMAGES) {
      Alert.alert('', `เพิ่มได้สูงสุด ${MAX_IMAGES} รูปครับ`); return;
    }
    const { status: perm } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm !== 'granted') {
      Alert.alert('', 'กรุณาอนุญาตการเข้าถึงคลังรูปภาพ'); return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images' as any],
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES - images.length,
      quality: 0.8,
      aspect: [1, 1],
    });
    if (!result.canceled) {
      const uris = result.assets.map(a => a.uri);
      setImages(prev => [...prev, ...uris].slice(0, MAX_IMAGES));
    }
  }

  function handleRemoveImage(idx: number) {
    setImages(prev => prev.filter((_, i) => i !== idx));
  }

  // ── Shipping helper ───────────────────────────────────────
  function toggleShipping(key: keyof ShippingOptions, value?: boolean | number) {
    setShipping(prev => ({ ...prev, [key]: value ?? !prev[key] }));
  }

  // ── Validation ────────────────────────────────────────────
  // PKG-05.2: เปิด variant → ราคาเป็นของ variant (validate ราย variant)
  // ไม่เปิด variant → validate basePrice ตามเดิม · core fix: hasVariants ? validateVariants() : basePrice>0
  function validate(): boolean {
    if (!name.trim()) { Alert.alert('', 'กรุณาใส่ชื่อสินค้า'); return false; }
    if (hasVariants) {
      const values = variantGroup?.values ?? [];
      if (values.length === 0) {
        Alert.alert('', 'กรุณาเพิ่มตัวเลือกสินค้าอย่างน้อย 1 รายการ'); return false;
      }
      // ชี้ตรง variant ที่ราคายังไม่ถูกต้อง (ไม่ใช่ error รวมแบบเดิม)
      const bad = values.find(v => !(v.price != null && v.price > 0));
      if (bad) {
        Alert.alert('', `กรุณาใส่ราคาขายของ "${bad.label}" ให้ถูกต้อง`); return false;
      }
      // stock >= 0 การันตีโดย UI (Math.max(0,…)); cost เว้นว่างได้ตาม PKG-05.1
    } else {
      const sell = parseFloat(sellPrice);
      if (!sell || sell <= 0) { Alert.alert('', 'กรุณาใส่ราคาขายที่ถูกต้อง'); return false; }
    }
    if (!shipping.free && !shipping.fixed && !shipping.pickup) {
      Alert.alert('', 'กรุณาเลือกวิธีจัดส่งอย่างน้อย 1 แบบ'); return false;
    }
    return true;
  }

  // ── Submit ────────────────────────────────────────────────
  async function handleSave(saveStatus: ProductStatus) {
    if (!validate()) return;
    setSaving(true);
    try {
      const variantTotalStock = hasVariants && variantGroup
        ? variantGroup.values.reduce((s, v) => s + v.stock, 0)
        : stock;

      // PKG-05.2: เปิด variant → ราคาประธาน (product.price) = ราคาต่ำสุดของ variant
      // คำนวณใหม่ทุกครั้งที่ save (ไม่ stale) — variant ยังเป็น source of truth จริง
      const basePriceNum = parseFloat(sellPrice) || 0;
      const variantMinPrice = hasVariants && variantGroup && variantGroup.values.length
        ? Math.min(...variantGroup.values.map(v => resolveVariantPrice(basePriceNum, v)))
        : basePriceNum;

      const input: ProductInput = {
        images,
        name: name.trim(),
        category,
        customCategoryLabel: category === 'other' && customCategoryLabel.trim()
          ? customCategoryLabel.trim() : undefined,
        description: description.trim(),
        // variant ON → ต้นทุน/ขายส่ง/ก่อนลด เป็นค่า per-variant ไม่ใช่ base-level
        // จึงไม่ persist ค่า base-level เหล่านี้ กัน badge ลด% / margin ผิด (addendum v1.1 A3)
        costPrice: hasVariants ? 0 : (parseFloat(costPrice) || 0),
        wholesalePrice: hasVariants ? undefined : (parseFloat(wholesalePrice) || undefined),
        price: variantMinPrice,
        comparePrice: hasVariants ? undefined : (parseFloat(comparePrice) || undefined),
        stock: variantTotalStock,
        lowStockThreshold: threshold,
        hideWhenOutOfStock: hideWhenOut,
        status: saveStatus,
        shipping,
        hasVariants,
        variants: hasVariants && variantGroup ? [variantGroup] : undefined,
        saleEndsAt: !hasVariants && hasSale && comparePrice
          ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : undefined,
      };

      const result = isEdit
        ? await api.updateProduct(productId!, input)
        : await api.addProduct(input);

      if (result.ok) {
        showSnackbar({
          message: isEdit
            ? '✅ บันทึกการแก้ไขแล้ว'
            : saveStatus === 'draft' ? '📝 บันทึกร่างแล้ว' : '✅ เพิ่มสินค้าแล้ว!',
          variant: 'success',
        });
        router.back();
      } else {
        showSnackbar({ message: result.message ?? 'เกิดข้อผิดพลาด', variant: 'error' });
      }
    } catch (e: any) {
      showSnackbar({ message: e?.message ?? 'เกิดข้อผิดพลาดที่ไม่คาดคิด', variant: 'error' });
    } finally {
      setSaving(false);
    }
  }

  const discountPct = calcDiscount(parseFloat(sellPrice) || 0, parseFloat(comparePrice) || 0);
  // ผลรวมสต็อกจากทุกตัวเลือก — ใช้แสดงในช่อง "จำนวนในคลัง" เมื่อเปิด variant (sync กับด้านล่าง)
  const variantStockTotal = variantGroup?.values.reduce((s, v) => s + (v.stock ?? 0), 0) ?? 0;
  const slotsFilled = images.length;
  const productProgress = Math.round((existingCount / MAX_PRODUCTS) * 100);

  return (
    <View style={{ flex: 1, backgroundColor: '#F3F0FF' }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <LinearGradient colors={['#6B21A8', '#9333EA', '#EC4899']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 8, paddingBottom: 12, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable onPress={() => router.back()}
              style={{ width: 36, height: 36, backgroundColor: 'rgba(255,255,255,0.18)',
                borderRadius: 12, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 16, color: '#fff' }}>←</Text>
            </Pressable>
            <View>
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#fff' }}>
                {isEdit ? '✏️ แก้ไขสินค้า' : '➕ เพิ่มสินค้าใหม่'}
              </Text>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 1 }}>
                {shop?.name ?? '—'} · สินค้าสูงสุด {MAX_PRODUCTS} ชิ้น
              </Text>
            </View>
          </View>
          <Pressable onPress={() => router.push('/shop-orders' as any)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4,
              backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 10,
              paddingHorizontal: 10, paddingVertical: 6 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>📦 Orders</Text>
          </Pressable>
        </View>
      </LinearGradient>

      {/* Shop status + progress */}
      <View style={{ marginHorizontal: 16, marginTop: 10, marginBottom: 6,
        backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: 16, padding: 12,
        flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 36, height: 36, borderRadius: 10,
          backgroundColor: '#7C3AED', justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 18 }}>🏪</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ fontSize: 11, color: '#7C5CB8', fontWeight: '600' }}>
              สินค้า: {existingCount} / {MAX_PRODUCTS} ชิ้น
            </Text>
            <Text style={{ fontSize: 11, fontWeight: '800', color: '#7C3AED' }}>{productProgress}%</Text>
          </View>
          <View style={{ height: 4, backgroundColor: 'rgba(167,139,250,0.2)', borderRadius: 2 }}>
            <View style={{ height: 4, width: `${productProgress}%`, borderRadius: 2,
              backgroundColor: productProgress >= 100 ? '#EC4899' : '#7C3AED' }} />
          </View>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 120 }}>

          {/* ── Section 1: รูปภาพ ──────────────────────────── */}
          <View style={styles.card}>
            <SectionHeader icon="🖼️" title="รูปภาพสินค้า" badge={`สูงสุด ${MAX_IMAGES} รูป`} />

            {/* Pick button */}
            <Pressable onPress={handlePickImages}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12,
                padding: 14, borderRadius: 14,
                borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(124,58,237,0.35)',
                backgroundColor: 'rgba(124,58,237,0.05)', marginBottom: 10 }}>
              <View style={{ width: 44, height: 44, borderRadius: 12,
                backgroundColor: '#7C3AED', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 22 }}>🖼️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#5B21B6' }}>
                  เลือกรูปจากแกลเลอรี
                </Text>
                <Text style={{ fontSize: 11, color: '#9B7FC8', marginTop: 2 }}>
                  เลือกได้หลายรูปพร้อมกัน ({slotsFilled}/{MAX_IMAGES})
                </Text>
              </View>
              <Text style={{ fontSize: 16, color: '#A78BFA' }}>›</Text>
            </Pressable>

            {/* Image slots */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              {Array.from({ length: MAX_IMAGES }).map((_, i) => {
                const uri = images[i];
                return (
                  <View key={i} style={{
                    flex: 1, aspectRatio: 1, borderRadius: 13, overflow: 'hidden',
                    backgroundColor: uri ? 'transparent' : 'rgba(237,233,254,0.55)',
                    borderWidth: 2, borderStyle: uri ? 'solid' : 'dashed',
                    borderColor: uri ? 'rgba(124,58,237,0.3)' : 'rgba(124,58,237,0.25)',
                    justifyContent: 'center', alignItems: 'center',
                  }}>
                    {uri ? (
                      <>
                        <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                        {i === 0 && (
                          <View style={{ position: 'absolute', top: 4, left: 4,
                            backgroundColor: '#7C3AED', borderRadius: 5,
                            paddingHorizontal: 5, paddingVertical: 2 }}>
                            <Text style={{ fontSize: 8, fontWeight: '800', color: '#fff' }}>★ หน้าปก</Text>
                          </View>
                        )}
                        <Pressable onPress={() => handleRemoveImage(i)}
                          style={{ position: 'absolute', top: 3, right: 3,
                            width: 18, height: 18, borderRadius: 9,
                            backgroundColor: 'rgba(236,72,153,0.85)',
                            justifyContent: 'center', alignItems: 'center' }}>
                          <Text style={{ fontSize: 10, color: '#fff', fontWeight: '700' }}>✕</Text>
                        </Pressable>
                      </>
                    ) : (
                      <>
                        <Text style={{ fontSize: 20, color: '#C4B5D8' }}>＋</Text>
                        <Text style={{ fontSize: 9, color: '#C4B5D8', fontWeight: '600', marginTop: 2 }}>
                          รูปที่ {i + 1}
                        </Text>
                      </>
                    )}
                  </View>
                );
              })}
            </View>
            <Text style={{ fontSize: 11, color: '#A78BFA', textAlign: 'center' }}>
              รูปแรก = หน้าปกสินค้า
            </Text>
          </View>

          {/* ── Section 2: ข้อมูลสินค้า ──────────────────── */}
          <View style={styles.card}>
            <SectionHeader icon="📋" title="ข้อมูลสินค้า" />

            <Text style={LABEL_STYLE}>
              ชื่อสินค้า <Text style={{ color: '#EC4899' }}>*</Text>
            </Text>
            <TextInput value={name} onChangeText={setName}
              placeholder="เช่น เสื้อยืด Oversize สีพาสเทล"
              placeholderTextColor="#C4B5D8"
              style={[INPUT_STYLE, { marginBottom: 14 }]} />

            <Text style={LABEL_STYLE}>
              หมวดหมู่ <Text style={{ color: '#EC4899' }}>*</Text>
              <Text style={{ fontSize: 10, fontWeight: '500', color: '#A78BFA' }}>  ช่วยให้ลูกค้าค้นหาได้</Text>
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {CATEGORIES.map(c => (
                <Pressable key={c.id} onPress={() => setCategory(c.id)}
                  style={{
                    flexDirection: 'column', alignItems: 'center', gap: 3,
                    paddingVertical: 8, paddingHorizontal: 6,
                    borderRadius: 11, borderWidth: 1.5, minWidth: 70,
                    borderColor: category === c.id ? '#7C3AED' : 'rgba(167,139,250,0.3)',
                    backgroundColor: category === c.id ? 'rgba(124,58,237,0.08)' : 'rgba(255,255,255,0.85)',
                  }}>
                  <Text style={{ fontSize: 18 }}>{c.icon}</Text>
                  <Text style={{ fontSize: 11, fontWeight: '600', textAlign: 'center',
                    color: category === c.id ? '#5B21B6' : '#7C5CB8' }}>
                    {c.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Custom category input เมื่อเลือก "อื่น ๆ" */}
            {category === 'other' && (
              <View style={{ marginBottom: 10 }}>
                <Text style={LABEL_STYLE}>
                  ตั้งชื่อหมวดหมู่เอง
                  <Text style={{ fontSize: 10, fontWeight: '500', color: '#A78BFA' }}>
                    {' '}(สูงสุด {MAX_CUSTOM_CATEGORY_LEN} ตัวอักษร)
                  </Text>
                </Text>
                <TextInput
                  value={customCategoryLabel}
                  onChangeText={t => setCustomCategoryLabel(t.slice(0, MAX_CUSTOM_CATEGORY_LEN))}
                  placeholder="เช่น สัตว์เลี้ยง / ตกแต่งสวน / เครื่องมือ"
                  placeholderTextColor="#C4B5D8"
                  maxLength={MAX_CUSTOM_CATEGORY_LEN}
                  style={[INPUT_STYLE, { marginBottom: 4 }]}
                />
                <Text style={{ fontSize: 10, color: '#A78BFA', textAlign: 'right' }}>
                  {customCategoryLabel.length}/{MAX_CUSTOM_CATEGORY_LEN}
                </Text>
              </View>
            )}

            <Text style={LABEL_STYLE}>รายละเอียดสินค้า</Text>
            <TextInput value={description} onChangeText={setDescription}
              placeholder="เช่น ผ้าคอตตอน 100% นุ่มใส่สบาย มีหลายสี Free size"
              placeholderTextColor="#C4B5D8"
              multiline numberOfLines={3}
              style={[INPUT_STYLE, { minHeight: 72, textAlignVertical: 'top' }]} />
          </View>

          {/* ── Section 3: ราคา ────────────────────────────── */}
          {/* PKG-05.2 (P3): เปิด variant → ซ่อนทั้ง section (ไม่ใช่ล็อก/ทำสีเทา) —
              ราคา/ต้นทุนเป็นของ variant, footer ช่วงราคาใน Section 6 ทำหน้าที่นี้แล้ว */}
          {!hasVariants && (
          <View style={styles.card}>
            <SectionHeader
              icon="💰"
              title="ราคาสินค้าราคาเดียว"
            />

            {/* โหมดราคา — บอกให้ชัดว่า section นี้ใช้กับสินค้าแบบไหน (PKG-05 ข้อ 3.2) */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8,
              backgroundColor: hasVariants ? 'rgba(236,72,153,0.07)' : 'rgba(124,58,237,0.06)',
              borderWidth: 1.5,
              borderColor: hasVariants ? 'rgba(236,72,153,0.2)' : 'rgba(124,58,237,0.15)',
              borderRadius: 12, padding: 10, marginBottom: 12 }}>
              <Text style={{ fontSize: 16 }}>{hasVariants ? '🎨' : '🏷️'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '800',
                  color: hasVariants ? '#BE185D' : '#5B21B6' }}>
                  {hasVariants ? 'สินค้ามีตัวเลือก (สี/ขนาด)' : 'สินค้าราคาเดียว'}
                </Text>
                <Text style={{ fontSize: 10.5, color: '#9B7FC8', marginTop: 1 }}>
                  {hasVariants
                    ? 'ตั้งราคา-ต้นทุนจริงแยกในแต่ละตัวเลือกด้านล่าง · ค่าตรงนี้ใช้เป็นค่าตั้งต้น'
                    : 'ตั้งราคาครั้งเดียว ใช้กับสินค้าที่ไม่มีสี/ขนาดให้เลือก'}
                </Text>
              </View>
            </View>

            {/* แถวบน: ราคาขายปลีก + ราคาก่อนลด */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
              {/* ราคาขายปลีก (Retail) */}
              <View style={{ flex: 1 }}>
                <Text style={LABEL_STYLE}>
                  {hasVariants ? 'ราคาตั้งต้น' : 'ราคาขายปลีก'} <Text style={{ color: '#EC4899' }}>*</Text>
                </Text>
                <Text style={{ fontSize: 10, color: '#A78BFA', marginBottom: 5 }}>
                  {hasVariants ? 'ค่าเริ่มต้นของตัวเลือกใหม่' : 'ราคาที่แสดงในร้าน'}
                </Text>
                <View style={{ position: 'relative' }}>
                  <Text style={{ position: 'absolute', left: 12, top: 12,
                    fontSize: 14, fontWeight: '700', color: '#7C3AED', zIndex: 1 }}>฿</Text>
                  <TextInput value={sellPrice} onChangeText={setSellPrice}
                    placeholder="199" keyboardType="decimal-pad" selectTextOnFocus
                    placeholderTextColor="#C4B5D8"
                    style={[INPUT_STYLE, { paddingLeft: 28, fontSize: 16, fontWeight: '800' }]} />
                </View>
              </View>
              {/* ราคาก่อนลด (Compare) — ซ่อนเมื่อมี variant (addendum v1.1 A3):
                  per-variant compare-at ยังไม่มี → badge ลด% ไม่มีฐานคำนวณ */}
              {!hasVariants && (
                <View style={{ flex: 1 }}>
                  <Text style={LABEL_STYLE}>ราคาก่อนลด</Text>
                  <Text style={{ fontSize: 10, color: '#A78BFA', marginBottom: 5 }}>
                    แสดงขีดทับ + % ลด
                  </Text>
                  <View style={{ position: 'relative' }}>
                    <Text style={{ position: 'absolute', left: 12, top: 12,
                      fontSize: 14, fontWeight: '700', color: '#C4B5D8', zIndex: 1 }}>฿</Text>
                    <TextInput value={comparePrice} onChangeText={setComparePrice}
                      placeholder="350" keyboardType="decimal-pad" selectTextOnFocus
                      placeholderTextColor="#C4B5D8"
                      style={[INPUT_STYLE, { paddingLeft: 28 }]} />
                  </View>
                </View>
              )}
            </View>

            {/* แถวล่าง: ต้นทุน + ขายส่ง (private) */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
              {/* ต้นทุน */}
              <View style={{ flex: 1 }}>
                <Text style={LABEL_STYLE}>ราคาต้นทุน</Text>
                <Text style={{ fontSize: 10, color: '#A78BFA', marginBottom: 5 }}>
                  {hasVariants ? '↓ ตั้งแยกในแต่ละตัวเลือก' : '🔒 ส่วนตัว'}
                </Text>
                <View style={{ position: 'relative', opacity: hasVariants ? 0.45 : 1 }}>
                  <Text style={{ position: 'absolute', left: 12, top: 12,
                    fontSize: 14, fontWeight: '700', color: '#C4B5D8', zIndex: 1 }}>฿</Text>
                  <TextInput value={hasVariants ? '' : costPrice} onChangeText={setCostPrice}
                    editable={!hasVariants}
                    placeholder={hasVariants ? 'ดูด้านล่าง' : '80'}
                    keyboardType="decimal-pad" selectTextOnFocus
                    placeholderTextColor="#C4B5D8"
                    style={[INPUT_STYLE, { paddingLeft: 28 }]} />
                </View>
              </View>
              {/* ราคาขายส่ง — ซ่อนเมื่อมี variant (addendum v1.1 A3):
                  เป็นค่า shop-level เดี่ยว ไม่ตรงกับ variant ที่ขายคนละราคา */}
              {!hasVariants && (
                <View style={{ flex: 1 }}>
                  <Text style={LABEL_STYLE}>ราคาขายส่ง</Text>
                  <Text style={{ fontSize: 10, color: '#A78BFA', marginBottom: 5 }}>
                    🔒 ส่วนตัว
                  </Text>
                  <View style={{ position: 'relative' }}>
                    <Text style={{ position: 'absolute', left: 12, top: 12,
                      fontSize: 14, fontWeight: '700', color: '#C4B5D8', zIndex: 1 }}>฿</Text>
                    <TextInput value={wholesalePrice} onChangeText={setWholesalePrice}
                      placeholder="120" keyboardType="decimal-pad" selectTextOnFocus
                      placeholderTextColor="#C4B5D8"
                      style={[INPUT_STYLE, { paddingLeft: 28 }]} />
                  </View>
                </View>
              )}
            </View>

            {/* Discount preview — เฉพาะสินค้าราคาเดียว (addendum v1.1 A3) */}
            {!hasVariants && discountPct > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4,
                alignSelf: 'flex-start', backgroundColor: 'rgba(236,72,153,0.1)',
                borderWidth: 1.5, borderColor: 'rgba(236,72,153,0.25)',
                borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#BE185D' }}>
                  🏷️ แสดงเป็น: ลด {discountPct}% บนหน้าสินค้า
                </Text>
              </View>
            )}

            {/* COGS snapshot note — แก้ต้นทุนไม่ย้อนหลังบิลเก่า (PKG-05 ข้อ 4) */}
            {isEdit && (
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 10,
                backgroundColor: 'rgba(124,58,237,0.05)', borderRadius: 10, padding: 9 }}>
                <Text style={{ fontSize: 12 }}>ℹ️</Text>
                <Text style={{ flex: 1, fontSize: 10.5, color: '#7C5CB8', lineHeight: 15 }}>
                  แก้ต้นทุนมีผลกับ<Text style={{ fontWeight: '800' }}>การขายครั้งถัดไป</Text>เท่านั้น
                  ไม่กระทบยอด/กำไรของบิลที่ขายไปแล้ว
                </Text>
              </View>
            )}
          </View>
          )}

          {/* ── Section 4: สต็อก & สถานะ ─────────────────── */}
          <View style={styles.card}>
            <SectionHeader icon="📦" title="สต็อก & สถานะ" />

            {/* Stock counter */}
            {hasVariants ? (
              /* variant ON → stock = ผลรวมจากทุกตัวเลือก (read-only, source of truth = ที่แต่ละสี) */
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                <View style={{ flex: 1 }}>
                  <Text style={LABEL_STYLE}>จำนวนในคลัง (รวมทุกตัวเลือก)</Text>
                  <Text style={{ fontSize: 11, color: '#A78BFA' }}>
                    🎨 แก้สต็อกแยกที่แต่ละสี/ขนาดด้านล่าง
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5,
                  borderWidth: 1.5, borderColor: 'rgba(124,58,237,0.2)',
                  borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8,
                  backgroundColor: 'rgba(124,58,237,0.05)' }}>
                  <Text style={{ fontSize: 18, fontWeight: '900', color: '#7C3AED' }}>
                    {variantStockTotal.toLocaleString()}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#9B7FC8', fontWeight: '600' }}>ชิ้น</Text>
                </View>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                <View style={{ flex: 1 }}>
                  <Text style={LABEL_STYLE}>
                    จำนวนในคลัง <Text style={{ color: '#EC4899' }}>*</Text>
                  </Text>
                  <Text style={{ fontSize: 11, color: '#A78BFA' }}>
                    ระบบนับออเดอร์ที่จ่ายแล้วอัตโนมัติ
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center',
                  borderWidth: 1.5, borderColor: 'rgba(124,58,237,0.3)',
                  borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.9)' }}>
                  <Pressable onPress={() => setStock(s => Math.max(0, s - 1))}
                    style={{ width: 36, height: 36, backgroundColor: 'rgba(124,58,237,0.06)',
                      justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ fontSize: 18, color: '#7C3AED', fontWeight: '700' }}>−</Text>
                  </Pressable>
                  {/* พิมพ์ตัวเลขได้โดยตรง */}
                  <TextInput
                    value={String(stock)}
                    onChangeText={v => {
                      const n = parseInt(v.replace(/[^0-9]/g, ''), 10);
                      setStock(isNaN(n) ? 0 : Math.max(0, n));
                    }}
                    keyboardType="numeric"
                    selectTextOnFocus
                    style={{ width: 64, textAlign: 'center', fontSize: 16,
                      fontWeight: '800', color: '#2D1B69', paddingVertical: 0 }}
                  />
                  <Pressable onPress={() => setStock(s => s + 1)}
                    style={{ width: 36, height: 36, backgroundColor: 'rgba(124,58,237,0.06)',
                      justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ fontSize: 18, color: '#7C3AED', fontWeight: '700' }}>+</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Threshold */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
              <View style={{ flex: 1 }}>
                <Text style={LABEL_STYLE}>แจ้งเตือนเมื่อสินค้าเหลือน้อย</Text>
                <Text style={{ fontSize: 11, color: '#A78BFA' }}>
                  แจ้งเตือนเมื่อเหลือ ≤ {threshold} ชิ้น
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center',
                borderWidth: 1.5, borderColor: 'rgba(124,58,237,0.3)',
                borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.9)' }}>
                <Pressable onPress={() => setThreshold(t => Math.max(1, t - 1))}
                  style={{ width: 32, height: 32, backgroundColor: 'rgba(124,58,237,0.06)',
                    justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, color: '#7C3AED', fontWeight: '700' }}>−</Text>
                </Pressable>
                <TextInput
                  value={String(threshold)}
                  onChangeText={v => {
                    const n = parseInt(v.replace(/[^0-9]/g, ''), 10);
                    setThreshold(isNaN(n) ? 1 : Math.max(1, n));
                  }}
                  keyboardType="numeric"
                  selectTextOnFocus
                  style={{ width: 48, textAlign: 'center', fontSize: 14,
                    fontWeight: '800', color: '#2D1B69', paddingVertical: 0 }}
                />
                <Pressable onPress={() => setThreshold(t => t + 1)}
                  style={{ width: 32, height: 32, backgroundColor: 'rgba(124,58,237,0.06)',
                    justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, color: '#7C3AED', fontWeight: '700' }}>+</Text>
                </Pressable>
              </View>
            </View>

            {/* Hide when out of stock */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10,
              padding: 12, borderRadius: 12, marginBottom: 14,
              backgroundColor: 'rgba(255,255,255,0.8)',
              borderWidth: 1.5, borderColor: 'rgba(167,139,250,0.25)' }}>
              <Text style={{ fontSize: 18 }}>🙈</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#2D1B69' }}>
                  ซ่อนสินค้าเมื่อสต็อกหมด
                </Text>
                <Text style={{ fontSize: 11, color: '#9B7FC8', marginTop: 1 }}>
                  ซ่อนจากหน้าร้านอัตโนมัติเมื่อ = 0
                </Text>
              </View>
              <Switch
                value={hideWhenOut}
                onValueChange={setHideWhenOut}
                trackColor={{ false: 'rgba(167,139,250,0.3)', true: '#7C3AED' }}
                thumbColor="#fff"
              />
            </View>

            {/* Status radio */}
            <Text style={[LABEL_STYLE, { marginBottom: 8 }]}>สถานะเมื่อบันทึก</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {([
                { id: 'active' as ProductStatus, icon: '🟢', label: 'เปิดขายทันที', desc: 'ลูกค้าเห็นได้เลย' },
                { id: 'draft'  as ProductStatus, icon: '📝', label: 'บันทึกร่าง',    desc: 'ยังไม่แสดงร้าน' },
              ] as const).map(opt => (
                <Pressable key={opt.id} onPress={() => setStatus(opt.id)}
                  style={{ flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10,
                    borderRadius: 12, borderWidth: 2,
                    borderColor: status === opt.id ? '#7C3AED' : 'rgba(167,139,250,0.3)',
                    backgroundColor: status === opt.id ? 'rgba(124,58,237,0.07)' : 'rgba(255,255,255,0.85)' }}>
                  <Text style={{ fontSize: 20 }}>{opt.icon}</Text>
                  <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#2D1B69' }}>{opt.label}</Text>
                  <Text style={{ fontSize: 10, color: '#9B7FC8' }}>{opt.desc}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* ── Section 5: การจัดส่ง ──────────────────────── */}
          <View style={styles.card}>
            <SectionHeader icon="🚚" title="การจัดส่ง" badge="เลือกได้หลายแบบ" />

            {[
              { key: 'free'   as const, icon: '🎁', label: 'ส่งฟรี',              sub: 'ดูดีในสายตาลูกค้า',              hasPrice: false },
              { key: 'fixed'  as const, icon: '📦', label: 'ค่าส่งคงที่',          sub: 'กำหนดราคาตายตัว',                hasPrice: true  },
              { key: 'pickup' as const, icon: '🤝', label: 'นัดรับเอง / ไม่จัดส่ง', sub: 'ติดต่อนัดผ่าน LINE/โทร',         hasPrice: false },
            ].map(opt => (
              <Pressable key={opt.key} onPress={() => toggleShipping(opt.key)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10,
                  padding: 12, borderRadius: 12, marginBottom: 8,
                  backgroundColor: 'rgba(255,255,255,0.8)',
                  borderWidth: 1.5, borderColor: 'rgba(167,139,250,0.25)' }}>
                <View style={{
                  width: 18, height: 18, borderRadius: 5, borderWidth: 2,
                  borderColor: shipping[opt.key] ? '#7C3AED' : '#A78BFA',
                  backgroundColor: shipping[opt.key] ? '#7C3AED' : '#fff',
                  justifyContent: 'center', alignItems: 'center',
                }}>
                  {shipping[opt.key] && <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>✓</Text>}
                </View>
                <Text style={{ fontSize: 18 }}>{opt.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#2D1B69' }}>{opt.label}</Text>
                  <Text style={{ fontSize: 11, color: '#9B7FC8', marginTop: 1 }}>{opt.sub}</Text>
                </View>
                {opt.hasPrice && shipping.fixed && (
                  <TextInput
                    value={String(shipping.fixedPrice || '')}
                    onChangeText={v => toggleShipping('fixedPrice', parseFloat(v) || 0)}
                    keyboardType="decimal-pad" placeholder="฿40"
                    placeholderTextColor="#C4B5D8"
                    style={{ width: 70, padding: 6, textAlign: 'center',
                      backgroundColor: 'rgba(255,255,255,0.9)',
                      borderWidth: 1.5, borderColor: 'rgba(124,58,237,0.3)',
                      borderRadius: 8, fontSize: 13, fontWeight: '700', color: '#2D1B69' }} />
                )}
              </Pressable>
            ))}

            {/* COD */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10,
              padding: 12, borderRadius: 12, marginTop: 4,
              backgroundColor: 'rgba(255,255,255,0.8)',
              borderWidth: 1.5, borderColor: 'rgba(167,139,250,0.25)' }}>
              <Text style={{ fontSize: 18 }}>💵</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#2D1B69' }}>
                  รับชำระเงินปลายทาง (COD)
                </Text>
                <Text style={{ fontSize: 11, color: '#1c0f31', marginTop: 1 }}>
                  ลูกค้าจ่ายเมื่อรับของ
                </Text>
              </View>
              <Switch
                value={shipping.cod}
                onValueChange={v => toggleShipping('cod', v)}
                trackColor={{ false: 'rgba(167,139,250,0.3)', true: '#7C3AED' }}
                thumbColor="#fff"
              />
            </View>
          </View>

          {/* ── Section 6: ตัวเลือกสินค้า (Variants) ─────── */}
          <View style={styles.card}>
            <SectionHeader icon="🎨" title="ราคาตามตัวเลือก (สี/ขนาด)" />
            <Text style={{ fontSize: 13, color: '#9B7FC8', marginBottom: 12, marginTop: -4 }}>
              ใช้เมื่อสินค้ามีสี/ขนาด/น้ำหนักต่างกัน — ตั้งราคา-ต้นทุนแยกแต่ละแบบ
            </Text>
            <VariantEditor
              enabled={hasVariants}
              group={variantGroup}
              baseStock={stock}
              basePrice={parseFloat(sellPrice) || 0}
              onToggle={setHasVariants}
              onChange={setVariantGroup}
            />
          </View>

          {/* ── Flash Sale toggle ────────────────────────────── */}
          {/* gate: เฉพาะสินค้าราคาเดียวที่มีราคาก่อนลด (addendum v1.1 §5) —
              variant ON ไม่มี per-variant compare-at → badge "ลด XX%" ไม่มีฐานคำนวณ */}
          {!hasVariants && (parseFloat(comparePrice) || 0) > 0 && (
            <View style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
              <Text style={{ fontSize: 18 }}>⚡</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#2D1B69' }}>
                  Flash Sale (24 ชม.)
                </Text>
                <Text style={{ fontSize: 11, color: '#9B7FC8', marginTop: 1 }}>
                  แสดง badge "ลด XX%" พร้อม countdown timer บนสินค้า
                </Text>
              </View>
              <Switch
                value={hasSale}
                onValueChange={setHasSale}
                trackColor={{ false: 'rgba(167,139,250,0.3)', true: '#EC4899' }}
                thumbColor="#fff"
              />
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Fixed Bottom Buttons ──────────────────────────── */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        paddingHorizontal: 16, paddingBottom: insets.bottom + 12, paddingTop: 12,
        backgroundColor: 'rgba(243,240,255,0.97)',
        borderTopWidth: 1, borderTopColor: 'rgba(167,139,250,0.2)',
        flexDirection: 'row', gap: 10,
      }}>
        <Pressable onPress={() => handleSave('draft')} disabled={saving}
          style={{ flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center',
            flexDirection: 'row', justifyContent: 'center', gap: 5,
            borderWidth: 1.5, borderColor: 'rgba(167,139,250,0.5)',
            backgroundColor: 'rgba(255,255,255,0.75)' }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#7C3AED' }}>📝 บันทึกร่าง</Text>
        </Pressable>

        <Pressable onPress={() => handleSave('active')} disabled={saving}
          style={{ flex: 2, borderRadius: 14, overflow: 'hidden', opacity: saving ? 0.7 : 1 }}>
          <LinearGradient colors={['#7C3AED', '#A855F7', '#EC4899']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
              flexDirection: 'row', gap: 6 }}>
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>
                  ✅ {isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มสินค้า · เปิดขาย'}
                </Text>}
          </LinearGradient>
        </Pressable>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 20, padding: 16, marginBottom: 12,
  },
});
