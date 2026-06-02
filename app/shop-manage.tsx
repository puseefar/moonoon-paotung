import { useState, useCallback } from 'react';
import {
  View, Text, Pressable, TextInput, ActivityIndicator,
  Alert, ScrollView, Platform, KeyboardAvoidingView,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { api } from '@/lib/api/client';
import type { Shop, Product } from '@/lib/api/contract';
import { formatCurrency } from '@/lib/format';
import { useSnackbar } from '@/components/ui/SnackbarProvider';

const MAX_PRODUCTS = 5;

export default function ShopManageScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showSnackbar } = useSnackbar();

  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Create shop form
  const [showShopForm, setShowShopForm] = useState(false);
  const [shopName, setShopName] = useState('');
  const [shopDesc, setShopDesc] = useState('');
  const [shopPhone, setShopPhone] = useState('');
  const [saving, setSaving] = useState(false);

  // Add product form
  const [showProductForm, setShowProductForm] = useState(false);
  const [prodName, setProdName] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [addingProd, setAddingProd] = useState(false);

  const load = useCallback(async () => {
    const [shopRes, prodRes] = await Promise.all([
      api.getShop(),
      api.getProducts(),
    ]);
    if (shopRes.ok) setShop(shopRes.data);
    if (prodRes.ok) setProducts(prodRes.data);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  async function handleCreateShop() {
    if (!shopName.trim()) { Alert.alert('', 'กรุณาใส่ชื่อร้าน'); return; }
    if (!shopPhone.trim()) { Alert.alert('', 'กรุณาใส่เบอร์โทร'); return; }
    setSaving(true);
    try {
      const result = await api.createShop({ name: shopName.trim(), description: shopDesc.trim(), phone: shopPhone.trim() });
      if (result.ok) {
        setShop(result.data);
        setShowShopForm(false);
        showSnackbar({ message: '✅ เปิดร้านสำเร็จ', variant: 'success' });
      } else {
        showSnackbar({ message: result.message, variant: 'error' });
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleOpen() {
    if (!shop) return;
    const result = await api.updateShop({ isOpen: !shop.isOpen });
    if (result.ok) setShop(result.data);
  }

  async function handleAddProduct() {
    if (!prodName.trim()) { Alert.alert('', 'กรุณาใส่ชื่อสินค้า'); return; }
    const price = parseFloat(prodPrice.replace(/,/g, ''));
    if (!price || price <= 0) { Alert.alert('', 'กรุณาใส่ราคาที่ถูกต้อง'); return; }
    setAddingProd(true);
    try {
      const result = await api.addProduct({ name: prodName.trim(), price, description: prodDesc.trim() });
      if (result.ok) {
        setProducts(prev => [...prev, result.data]);
        if (shop) setShop({ ...shop, productCount: products.length + 1 });
        setProdName(''); setProdPrice(''); setProdDesc('');
        setShowProductForm(false);
        showSnackbar({ message: `เพิ่ม "${result.data.name}" แล้ว`, variant: 'success' });
      } else {
        showSnackbar({ message: result.message, variant: 'error' });
      }
    } finally {
      setAddingProd(false);
    }
  }

  async function handleDeleteProduct(product: Product) {
    Alert.alert('ลบสินค้า', `ลบ "${product.name}"?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ลบ', style: 'destructive', onPress: async () => {
          const result = await api.deleteProduct(product.productId);
          if (result.ok) {
            setProducts(prev => prev.filter(p => p.productId !== product.productId));
            if (shop) setShop({ ...shop, productCount: Math.max(0, shop.productCount - 1) });
          }
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFBEB' }}>
      <Stack.Screen options={{ headerShown: false }} />

      <LinearGradient colors={['#78350F', '#B45309', '#F59E0B']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 8, paddingBottom: 20, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => router.back()} style={{ padding: 6, marginRight: 8 }}>
            <Text style={{ fontSize: 20, color: '#fff' }}>←</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff' }}>🏪 Mini Shop</Text>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
              1 ร้าน · สินค้าสูงสุด {MAX_PRODUCTS} ชิ้น
            </Text>
          </View>
          {shop && (
            <Pressable onPress={() => router.push('/shop-orders' as any)}
              style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12,
                paddingHorizontal: 12, paddingVertical: 7 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>📦 Orders</Text>
            </Pressable>
          )}
        </View>
      </LinearGradient>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#B45309" />
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 100 }}>

            {!shop ? (
              /* ── สร้างร้าน ── */
              !showShopForm ? (
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                  <Text style={{ fontSize: 60, marginBottom: 16 }}>🏪</Text>
                  <Text style={{ fontSize: 20, fontWeight: '800', color: '#333', marginBottom: 8 }}>
                    เปิดร้านของคุณ
                  </Text>
                  <Text style={{ fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 22, marginBottom: 28 }}>
                    ขายสินค้าออนไลน์ได้ง่ายๆ{'\n'}รับชำระผ่าน PromptPay · แจ้งเตือนทาง LINE
                  </Text>
                  <Pressable onPress={() => setShowShopForm(true)}
                    style={{ backgroundColor: '#B45309', borderRadius: 16,
                      paddingHorizontal: 28, paddingVertical: 14 }}>
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>
                      🏪 เปิดร้านเลย
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <View style={{ backgroundColor: '#fff', borderRadius: 18, padding: 20,
                  elevation: 1, shadowColor: '#B45309', shadowOpacity: 0.1, shadowRadius: 8 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#333', marginBottom: 16 }}>
                    ข้อมูลร้าน
                  </Text>
                  {[
                    { label: 'ชื่อร้าน *', value: shopName, setter: setShopName, placeholder: 'เช่น ร้านหมูนุ่น', keyboard: 'default' },
                    { label: 'รายละเอียดร้าน', value: shopDesc, setter: setShopDesc, placeholder: 'เช่น จำหน่ายอาหารและขนม', keyboard: 'default' },
                    { label: 'เบอร์ติดต่อ *', value: shopPhone, setter: setShopPhone, placeholder: '0812345678', keyboard: 'phone-pad' },
                  ].map(f => (
                    <View key={f.label} style={{ marginBottom: 14 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#888', marginBottom: 6 }}>{f.label}</Text>
                      <TextInput value={f.value} onChangeText={f.setter as (v: string) => void}
                        placeholder={f.placeholder} placeholderTextColor="#CCC"
                        keyboardType={f.keyboard as any}
                        style={{ backgroundColor: '#FFFBEB', borderRadius: 12, padding: 12,
                          fontSize: 15, color: '#333', borderWidth: 1, borderColor: '#FDE68A' }} />
                    </View>
                  ))}
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Pressable onPress={() => setShowShopForm(false)}
                      style={{ flex: 1, paddingVertical: 14, borderRadius: 12,
                        borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' }}>
                      <Text style={{ color: '#888', fontWeight: '600' }}>ยกเลิก</Text>
                    </Pressable>
                    <Pressable onPress={handleCreateShop} disabled={saving}
                      style={{ flex: 2, paddingVertical: 14, borderRadius: 12,
                        backgroundColor: saving ? '#FDE68A' : '#B45309', alignItems: 'center' }}>
                      {saving ? <ActivityIndicator color="#fff" />
                        : <Text style={{ color: '#fff', fontWeight: '800' }}>เปิดร้าน 🏪</Text>}
                    </Pressable>
                  </View>
                </View>
              )
            ) : (
              /* ── จัดการร้าน ── */
              <>
                {/* Shop info card */}
                <View style={{ backgroundColor: '#fff', borderRadius: 18, padding: 18, marginBottom: 16,
                  elevation: 1, shadowColor: '#B45309', shadowOpacity: 0.1, shadowRadius: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 48, height: 48, borderRadius: 14,
                      backgroundColor: shop.isOpen ? '#FEF3C7' : '#F3F4F6',
                      justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ fontSize: 24 }}>🏪</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: '#111' }}>{shop.name}</Text>
                      <Text style={{ fontSize: 12, color: '#6B7280' }}>📞 {shop.phone}</Text>
                    </View>
                    <Pressable onPress={handleToggleOpen}
                      style={{ backgroundColor: shop.isOpen ? '#DCFCE7' : '#FEF2F2',
                        borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}>
                      <Text style={{ fontSize: 13, fontWeight: '800',
                        color: shop.isOpen ? '#065F46' : '#7F1D1D' }}>
                        {shop.isOpen ? '● เปิดร้าน' : '● ปิดร้าน'}
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {/* Products */}
                <View style={{ flexDirection: 'row', alignItems: 'center',
                  justifyContent: 'space-between', marginBottom: 10 }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: '#333' }}>
                    สินค้า ({products.length}/{MAX_PRODUCTS})
                  </Text>
                  {products.length < MAX_PRODUCTS && (
                    <Pressable onPress={() => setShowProductForm(true)}
                      style={{ backgroundColor: '#B45309', borderRadius: 10,
                        paddingHorizontal: 12, paddingVertical: 6 }}>
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>+ เพิ่มสินค้า</Text>
                    </Pressable>
                  )}
                  {products.length >= MAX_PRODUCTS && (
                    <View style={{ backgroundColor: '#FEF2F2', borderRadius: 10,
                      paddingHorizontal: 10, paddingVertical: 5 }}>
                      <Text style={{ fontSize: 11, color: '#7F1D1D', fontWeight: '700' }}>ครบ 5 ชิ้นแล้ว</Text>
                    </View>
                  )}
                </View>

                {products.map(prod => (
                  <View key={prod.productId} style={{ backgroundColor: '#fff', borderRadius: 14,
                    padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center',
                    elevation: 1, shadowColor: '#B45309', shadowOpacity: 0.06, shadowRadius: 4 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 10,
                      backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center',
                      marginRight: 12 }}>
                      <Text style={{ fontSize: 20 }}>📦</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#111' }}>{prod.name}</Text>
                      <Text style={{ fontSize: 13, color: '#B45309', fontWeight: '700' }}>
                        {formatCurrency(prod.price)}฿
                      </Text>
                    </View>
                    <Pressable onPress={() => handleDeleteProduct(prod)} style={{ padding: 8 }}>
                      <Text style={{ fontSize: 16, color: '#FECACA' }}>✕</Text>
                    </Pressable>
                  </View>
                ))}

                {products.length === 0 && (
                  <View style={{ alignItems: 'center', paddingVertical: 24,
                    backgroundColor: '#fff', borderRadius: 14 }}>
                    <Text style={{ fontSize: 36, marginBottom: 8 }}>📦</Text>
                    <Text style={{ fontSize: 14, color: '#888' }}>ยังไม่มีสินค้า เพิ่มได้สูงสุด {MAX_PRODUCTS} ชิ้น</Text>
                  </View>
                )}

                {/* Add product form (inline) */}
                {showProductForm && (
                  <View style={{ backgroundColor: '#fff', borderRadius: 18, padding: 18,
                    marginTop: 8, elevation: 1, shadowColor: '#B45309', shadowOpacity: 0.1, shadowRadius: 8 }}>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: '#333', marginBottom: 14 }}>
                      เพิ่มสินค้าใหม่
                    </Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#888', marginBottom: 6 }}>ชื่อสินค้า *</Text>
                    <TextInput value={prodName} onChangeText={setProdName}
                      placeholder="เช่น ผัดไทย, ขนมจีน"
                      placeholderTextColor="#CCC"
                      style={{ backgroundColor: '#FFFBEB', borderRadius: 12, padding: 12,
                        fontSize: 15, color: '#333', borderWidth: 1, borderColor: '#FDE68A', marginBottom: 12 }} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#888', marginBottom: 6 }}>ราคา (บาท) *</Text>
                    <TextInput value={prodPrice} onChangeText={setProdPrice}
                      keyboardType="decimal-pad" placeholder="0.00" selectTextOnFocus
                      placeholderTextColor="#CCC"
                      style={{ backgroundColor: '#FFFBEB', borderRadius: 12, padding: 12,
                        fontSize: 20, fontWeight: '800', color: '#B45309', textAlign: 'center',
                        borderWidth: 1, borderColor: '#FDE68A', marginBottom: 12 }} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#888', marginBottom: 6 }}>รายละเอียด</Text>
                    <TextInput value={prodDesc} onChangeText={setProdDesc}
                      placeholder="คำอธิบายสินค้า (ไม่บังคับ)"
                      placeholderTextColor="#CCC"
                      style={{ backgroundColor: '#FFFBEB', borderRadius: 12, padding: 12,
                        fontSize: 14, color: '#333', borderWidth: 1, borderColor: '#FDE68A', marginBottom: 16 }} />
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <Pressable onPress={() => setShowProductForm(false)}
                        style={{ flex: 1, paddingVertical: 12, borderRadius: 12,
                          borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' }}>
                        <Text style={{ color: '#888' }}>ยกเลิก</Text>
                      </Pressable>
                      <Pressable onPress={handleAddProduct} disabled={addingProd}
                        style={{ flex: 2, paddingVertical: 12, borderRadius: 12,
                          backgroundColor: addingProd ? '#FDE68A' : '#B45309', alignItems: 'center' }}>
                        {addingProd ? <ActivityIndicator color="#fff" />
                          : <Text style={{ color: '#fff', fontWeight: '800' }}>เพิ่มสินค้า</Text>}
                      </Pressable>
                    </View>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}
