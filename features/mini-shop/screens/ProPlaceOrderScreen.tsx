import { useState, useCallback } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, Image,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '@/lib/api/client';
import { useSnackbar } from '@/components/ui/SnackbarProvider';
import { useCart } from '../context/CartContext';
import { AddressAutocompleteInput } from '../components/AddressAutocompleteInput';
import type { ThaiAddressRow } from '../services/thaiAddressService';
import type { Shop, DeliveryMethod, PaymentMethodOrder, CreateOrderInput } from '@/lib/api/contract';

// ── Sub-components ─────────────────────────────────────────
function CardHeader({ icon, title, right }: { icon: string; title: string; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <View style={{ width: 28, height: 28, backgroundColor: '#7C3AED', borderRadius: 9,
        justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 14 }}>{icon}</Text>
      </View>
      <Text style={{ flex: 1, fontSize: 14, fontWeight: '800', color: '#2D1B69' }}>{title}</Text>
      {right}
    </View>
  );
}

function PriceRow({ label, value, color, bold = false }:
  { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', paddingVertical: 5 }}>
      <Text style={{ fontSize: 13, fontWeight: bold ? '700' : '500', color: '#7C5CB8' }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: bold ? '800' : '500', color: color ?? '#2D1B69' }}>{value}</Text>
    </View>
  );
}

const INPUT = {
  backgroundColor: 'rgba(255,255,255,0.9)',
  borderWidth: 1.5, borderColor: 'rgba(167,139,250,0.35)',
  borderRadius: 11, padding: 10,
  fontSize: 14, color: '#2D1B69',
} as const;

const LABEL = { fontSize: 12, fontWeight: '700' as const, color: '#5B21B6', marginBottom: 5 };

const FIXED_SHIPPING_RATE = 40;

// ── Main Screen ────────────────────────────────────────────
export default function ProPlaceOrderScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const { items, updateQty, clearCart, totalPrice } = useCart();

  const [shop, setShop] = useState<Shop | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ── ข้อมูลผู้รับ ──────────────────────────────────────────
  const [addrName, setAddrName]     = useState('');
  const [addrPhone, setAddrPhone]   = useState('');

  // ── ที่อยู่แบบละเอียด (กรอกเอง) ─────────────────────────
  const [houseNo, setHouseNo]       = useState(''); // บ้านเลขที่
  const [moo, setMoo]               = useState(''); // หมู่ที่
  const [village, setVillage]       = useState(''); // หมู่บ้าน / อาคาร
  const [soi, setSoi]               = useState(''); // ซอย
  const [road, setRoad]             = useState(''); // ถนน

  // ── auto-fill จาก AddressAutocomplete ────────────────────
  const [selectedArea, setSelectedArea] = useState<ThaiAddressRow | null>(null);
  // subDistrict / district / province / zip → มาจาก selectedArea

  // ── หมายเหตุจัดส่ง ───────────────────────────────────────
  const [landmark, setLandmark]     = useState(''); // จุดสังเกต

  // ── วิธีจัดส่ง + ชำระเงิน ─────────────────────────────────
  const [delivery, setDelivery]     = useState<DeliveryMethod>('free');
  const [payment, setPayment]       = useState<PaymentMethodOrder>('promptpay');
  const [note, setNote]             = useState('');

  useFocusEffect(useCallback(() => {
    api.getShop().then(r => { if (r.ok && r.data) setShop(r.data); });
  }, []));

  // ── Price calculations ─────────────────────────────────────
  const totalQty       = items.reduce((s, i) => s + i.qty, 0);
  const subtotal       = totalPrice;
  const originalSubtotal = items.reduce((s, i) => {
    const orig = (i.comparePrice && i.comparePrice > i.price) ? i.comparePrice : i.price;
    return s + orig * i.qty;
  }, 0);
  const productDiscount   = originalSubtotal - subtotal;
  const actualShipping    = delivery === 'fixed' ? FIXED_SHIPPING_RATE : 0;
  const shippingDiscount  = delivery === 'free' ? FIXED_SHIPPING_RATE : 0;
  const grandTotal        = subtotal + actualShipping;

  // ── Build full address string ──────────────────────────────
  function buildFullAddress(): string {
    if (delivery === 'pickup') return 'นัดรับเอง';
    const parts = [
      houseNo && `${houseNo}`,
      moo && `หมู่ ${moo}`,
      village,
      soi && `ซอย${soi}`,
      road && `ถนน${road}`,
      selectedArea && `ตำบล${selectedArea.subDistrict}`,
      selectedArea && `อำเภอ${selectedArea.district}`,
      selectedArea && `จังหวัด${selectedArea.province}`,
      selectedArea?.zip,
      landmark && `(${landmark})`,
    ];
    return parts.filter(Boolean).join(' ');
  }

  function validate(): boolean {
    if (items.length === 0) { Alert.alert('', 'ตะกร้าว่างเปล่า'); return false; }
    if (!addrName.trim()) { Alert.alert('', 'กรุณาใส่ชื่อผู้รับ'); return false; }
    if (!addrPhone.trim()) { Alert.alert('', 'กรุณาใส่เบอร์โทร'); return false; }
    if (delivery !== 'pickup') {
      if (!houseNo.trim()) { Alert.alert('', 'กรุณาใส่บ้านเลขที่'); return false; }
      if (!selectedArea) { Alert.alert('', 'กรุณาค้นหาและเลือกตำบล'); return false; }
    }
    return true;
  }

  async function handlePlaceOrder() {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const input: CreateOrderInput = {
        items: items.map(i => ({
          productId: i.productId,
          qty: i.qty,
          unitPrice: i.price,   // ราคา variant ที่เลือก (รวม extraPrice แล้ว)
          name: i.name,         // ชื่อ + label variant
          image: i.image,
          variantId: i.variantId,       // ใช้ตัดสต็อก variant ฝั่ง device
          variantLabel: i.variantLabel,
          unitCost: i.unitCost,         // snapshot ต้นทุน → รายงานกำไรขั้นต้น (PKG-05.1)
        })),
        customer: {
          name:    addrName.trim(),
          phone:   addrPhone.trim(),
          address: buildFullAddress(),
        },
        deliveryMethod: delivery,
        paymentMethod:  payment,
        note: note.trim() || undefined,
      };
      const result = await api.createOrder(input);
      if (result.ok) {
        clearCart();
        router.replace({ pathname: '/shop-checkout' as any, params: { orderId: result.data.orderId } });
      } else {
        showSnackbar({ message: result.message, variant: 'error' });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F8F5FF' }}>

      {/* Header */}
      <LinearGradient colors={['#6B21A8', '#9333EA']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{ paddingTop: insets.top + 8, paddingBottom: 14, paddingHorizontal: 16,
          flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={() => router.back()}
          style={{ width: 36, height: 36, backgroundColor: 'rgba(255,255,255,0.18)',
            borderRadius: 12, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 16, color: '#fff' }}>←</Text>
        </Pressable>
        <View>
          <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>ยืนยันคำสั่งซื้อ</Text>
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 1 }}>
            ตรวจสอบข้อมูลก่อนกดยืนยันสั่งซื้อ
          </Text>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
          contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 130, gap: 10 }}>

          {/* ── 1. ข้อมูลผู้รับ ──────────────────────────── */}
          <View style={styles.card}>
            <CardHeader icon="👤" title="ข้อมูลผู้รับ" />
            <View style={{ gap: 8 }}>
              <View>
                <Text style={LABEL}>ชื่อ-นามสกุล ผู้รับ *</Text>
                <TextInput value={addrName} onChangeText={setAddrName}
                  placeholder="เช่น สมชาย ใจดี" placeholderTextColor="#C4B5D8"
                  style={INPUT} />
              </View>
              <View>
                <Text style={LABEL}>เบอร์โทรศัพท์ *</Text>
                <TextInput value={addrPhone} onChangeText={setAddrPhone}
                  placeholder="เช่น 0812345678" placeholderTextColor="#C4B5D8"
                  keyboardType="phone-pad" style={INPUT} />
              </View>
            </View>
          </View>

          {/* ── 2. ที่อยู่จัดส่ง ─────────────────────────── */}
          {delivery !== 'pickup' && (
            <View style={styles.card}>
              <CardHeader icon="📍" title="ที่อยู่จัดส่ง"
                right={
                  <View style={{ backgroundColor: 'rgba(239,68,68,0.08)',
                    borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 10, color: '#DC2626', fontWeight: '700' }}>⚠️ ตรวจสอบก่อนยืนยัน</Text>
                  </View>
                }
              />

              {/* บ้านเลขที่ + หมู่ */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                <View style={{ flex: 3 }}>
                  <Text style={LABEL}>บ้านเลขที่ *</Text>
                  <TextInput value={houseNo} onChangeText={setHouseNo}
                    placeholder="เช่น 123/45" placeholderTextColor="#C4B5D8"
                    style={INPUT} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={LABEL}>หมู่ที่</Text>
                  <TextInput value={moo} onChangeText={setMoo}
                    placeholder="5" placeholderTextColor="#C4B5D8"
                    keyboardType="numeric" style={INPUT} />
                </View>
              </View>

              {/* หมู่บ้าน / อาคาร */}
              <View style={{ marginBottom: 8 }}>
                <Text style={LABEL}>หมู่บ้าน / อาคาร</Text>
                <TextInput value={village} onChangeText={setVillage}
                  placeholder="เช่น หมู่บ้านสุขใจ / คอนโดพาร์ค ชั้น 3 ห้อง 301"
                  placeholderTextColor="#C4B5D8" style={INPUT} />
              </View>

              {/* ซอย + ถนน */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={LABEL}>ซอย</Text>
                  <TextInput value={soi} onChangeText={setSoi}
                    placeholder="ลาดพร้าว 71" placeholderTextColor="#C4B5D8"
                    style={INPUT} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={LABEL}>ถนน</Text>
                  <TextInput value={road} onChangeText={setRoad}
                    placeholder="ลาดพร้าว" placeholderTextColor="#C4B5D8"
                    style={INPUT} />
                </View>
              </View>

              {/* ── ค้นหาตำบล / รหัสไปรษณีย์ ── */}
              <View style={{ marginBottom: 4 }}>
                <Text style={[LABEL, { marginBottom: 8 }]}>
                  ตำบล / อำเภอ / จังหวัด / รหัสไปรษณีย์ *
                </Text>
                <AddressAutocompleteInput
                  selected={selectedArea}
                  onSelect={row => setSelectedArea(row)}
                  onClear={() => setSelectedArea(null)}
                />
              </View>

              {/* จุดสังเกต */}
              <View style={{ marginTop: 8 }}>
                <Text style={LABEL}>จุดสังเกต / หมายเหตุการจัดส่ง</Text>
                <TextInput value={landmark} onChangeText={setLandmark}
                  placeholder="เช่น บ้านสีชมพู ใกล้ 7-11 / โทรก่อนส่ง"
                  placeholderTextColor="#C4B5D8" style={INPUT} />
              </View>
            </View>
          )}

          {/* ── 3. รายการสินค้า ──────────────────────────── */}
          <View style={styles.card}>
            <CardHeader icon="🛍️" title="รายการสินค้า"
              right={
                <View style={{ backgroundColor: 'rgba(124,58,237,0.08)',
                  borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 10, color: '#7C3AED', fontWeight: '700' }}>
                    {items.length} รายการ · {totalQty} ชิ้น
                  </Text>
                </View>
              }
            />
            {items.length === 0 ? (
              <Text style={{ color: '#9B7FC8', textAlign: 'center', paddingVertical: 16 }}>ตะกร้าว่างเปล่า</Text>
            ) : items.map(item => {
              const hasDiscount = !!item.comparePrice && item.comparePrice > item.price;
              return (
                <View key={`${item.productId}::${item.variantId ?? ''}`}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10,
                    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0EAF8' }}>
                  {/* รูปสินค้า */}
                  <View style={{ width: 56, height: 56, borderRadius: 12,
                    overflow: 'hidden', backgroundColor: '#EDE9FE', flexShrink: 0 }}>
                    {item.image ? (
                      <Image source={{ uri: item.image }}
                        style={{ width: 56, height: 56 }} resizeMode="cover" />
                    ) : (
                      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ fontSize: 26 }}>📦</Text>
                      </View>
                    )}
                  </View>
                  {/* ข้อมูล */}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#2D1B69' }}
                      numberOfLines={2}>{item.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 3 }}>
                      <Text style={{ fontSize: 14, fontWeight: '900', color: '#7C3AED' }}>
                        ฿{item.price.toLocaleString()}
                      </Text>
                      {hasDiscount && (
                        <Text style={{ fontSize: 11, color: '#C4B5D8', textDecorationLine: 'line-through' }}>
                          ฿{item.comparePrice!.toLocaleString()}
                        </Text>
                      )}
                    </View>
                  </View>
                  {/* Qty */}
                  <View style={{ flexDirection: 'row', alignItems: 'center',
                    borderWidth: 1.5, borderColor: 'rgba(124,58,237,0.3)',
                    borderRadius: 10, overflow: 'hidden' }}>
                    <Pressable onPress={() => updateQty(item.productId, item.qty - 1, item.variantId)}
                      style={{ width: 30, height: 30, backgroundColor: 'rgba(124,58,237,0.06)',
                        justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ color: '#7C3AED', fontWeight: '700', fontSize: 16 }}>−</Text>
                    </Pressable>
                    <Text style={{ width: 32, textAlign: 'center', fontSize: 14,
                      fontWeight: '800', color: '#2D1B69' }}>{item.qty}</Text>
                    <Pressable onPress={() => updateQty(item.productId, item.qty + 1, item.variantId)}
                      style={{ width: 30, height: 30, backgroundColor: 'rgba(124,58,237,0.06)',
                        justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ color: '#7C3AED', fontWeight: '700', fontSize: 16 }}>+</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>

          {/* ── 4. วิธีจัดส่ง ─────────────────────────────── */}
          <View style={styles.card}>
            <CardHeader icon="🚚" title="วิธีจัดส่ง" />
            {([
              { id: 'free'   as DeliveryMethod, icon: '🎁', label: 'ส่งฟรี',
                sub: `ร้านออกให้ · รับสินค้าภายใน 1–3 วันทำการ`, priceLabel: 'ฟรี!', priceColor: '#059669' },
              { id: 'fixed'  as DeliveryMethod, icon: '📦', label: 'ค่าส่งคงที่',
                sub: `฿${FIXED_SHIPPING_RATE} · รับสินค้าภายใน 1–3 วันทำการ`, priceLabel: `฿${FIXED_SHIPPING_RATE}`, priceColor: '#2D1B69' },
              { id: 'pickup' as DeliveryMethod, icon: '🤝', label: 'นัดรับเอง / ไม่จัดส่ง',
                sub: 'ติดต่อร้านเพื่อนัดรับสินค้า', priceLabel: 'ฟรี', priceColor: '#059669' },
            ] as const).map(opt => (
              <Pressable key={opt.id} onPress={() => setDelivery(opt.id)}
                style={[styles.optionRow, delivery === opt.id && styles.optionRowActive]}>
                <View style={[styles.radio, delivery === opt.id && styles.radioActive]}>
                  {delivery === opt.id && <View style={styles.radioDot} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#2D1B69' }}>{opt.label}</Text>
                  <Text style={{ fontSize: 11, color: '#9B7FC8', marginTop: 1 }}>{opt.sub}</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '800', color: opt.priceColor }}>{opt.priceLabel}</Text>
              </Pressable>
            ))}
          </View>

          {/* ── 5. วิธีชำระเงิน ──────────────────────────── */}
          <View style={styles.card}>
            <CardHeader icon="💳" title="วิธีชำระเงิน" />
            {([
              { id: 'promptpay' as PaymentMethodOrder, icon: '🏦', label: 'PromptPay QR',
                sub: 'สร้าง QR พร้อมยอดเงิน · ตรวจสลิปอัตโนมัติ', recommended: true },
              { id: 'bank' as PaymentMethodOrder, icon: '🏧', label: 'Mobile Banking / โอนเงิน',
                sub: 'โอนแล้วแนบสลิปให้ร้านค้า', recommended: false },
            ] as const).map(opt => (
              <Pressable key={opt.id} onPress={() => setPayment(opt.id)}
                style={[styles.optionRow, payment === opt.id && styles.optionRowActive]}>
                <View style={{ width: 36, height: 36, backgroundColor: 'rgba(124,58,237,0.08)',
                  borderRadius: 10, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontSize: 20 }}>{opt.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#2D1B69' }}>{opt.label}</Text>
                    {opt.recommended && (
                      <View style={{ backgroundColor: '#7C3AED', borderRadius: 5,
                        paddingHorizontal: 5, paddingVertical: 1 }}>
                        <Text style={{ fontSize: 9, fontWeight: '800', color: '#fff' }}>แนะนำ</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontSize: 11, color: '#9B7FC8', marginTop: 1 }}>{opt.sub}</Text>
                </View>
                <View style={[styles.radio, payment === opt.id && styles.radioActive]}>
                  {payment === opt.id && <View style={styles.radioDot} />}
                </View>
              </Pressable>
            ))}
          </View>

          {/* ── 6. หมายเหตุ ──────────────────────────────── */}
          <View style={styles.card}>
            <CardHeader icon="✏️" title="หมายเหตุถึงร้านค้า"
              right={<Text style={{ fontSize: 11, color: '#C4B5D8' }}>ไม่จำเป็น</Text>} />
            <TextInput value={note} onChangeText={setNote}
              placeholder="เช่น เลือกสีม่วงถ้าชมพูหมด / ฝากนิติ condo"
              placeholderTextColor="#C4B5D8" multiline numberOfLines={2}
              style={[INPUT, { minHeight: 56, textAlignVertical: 'top' }]} />
          </View>

          {/* ── 7. สรุปยอด ───────────────────────────────── */}
          <View style={styles.card}>
            <CardHeader icon="🧾" title="สรุปยอดชำระ" />

            <PriceRow label={`ราคาสินค้า (${totalQty} ชิ้น)`}
              value={`฿${subtotal.toLocaleString()}`} />
            {productDiscount > 0 && (
              <>
                <PriceRow label="ราคาเดิม (ก่อนลด)"
                  value={`฿${originalSubtotal.toLocaleString()}`} color="#9B7FC8" />
                <PriceRow label="ส่วนลดสินค้า"
                  value={`-฿${productDiscount.toLocaleString()}`} color="#059669" />
              </>
            )}

            <View style={{ height: 1, backgroundColor: '#F0EAF8', marginVertical: 6 }} />

            {delivery === 'pickup' ? (
              <PriceRow label="ค่าจัดส่ง" value="นัดรับเอง" color="#9B7FC8" />
            ) : (
              <>
                <PriceRow label="ค่าจัดส่งปกติ"
                  value={`฿${FIXED_SHIPPING_RATE.toLocaleString()}`} />
                {shippingDiscount > 0 && (
                  <PriceRow label="ส่วนลดค่าจัดส่ง (ส่งฟรี)"
                    value={`-฿${shippingDiscount.toLocaleString()}`} color="#059669" />
                )}
                <PriceRow label="ยอดรวมค่าจัดส่ง"
                  value={actualShipping === 0 ? '฿0 (ฟรี!)' : `฿${actualShipping.toLocaleString()}`}
                  color={actualShipping === 0 ? '#059669' : '#2D1B69'} />
              </>
            )}

            <View style={{ height: 1.5, backgroundColor: 'rgba(124,58,237,0.15)', marginVertical: 8 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#2D1B69' }}>รวมสุทธิ</Text>
              <Text style={{ fontSize: 24, fontWeight: '900', color: '#7C3AED' }}>
                ฿{grandTotal.toLocaleString()}
              </Text>
            </View>
            {(productDiscount + shippingDiscount) > 0 && (
              <View style={{ backgroundColor: 'rgba(5,150,105,0.06)', borderRadius: 8,
                padding: 8, marginTop: 8, borderWidth: 1, borderColor: 'rgba(5,150,105,0.15)' }}>
                <Text style={{ fontSize: 11, color: '#059669', fontWeight: '600', textAlign: 'center' }}>
                  🎉 ประหยัดไป ฿{(productDiscount + shippingDiscount).toLocaleString()} จากราคาปกติ
                </Text>
              </View>
            )}
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Fixed bottom */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F0EAF8',
        paddingHorizontal: 16, paddingBottom: insets.bottom + 12, paddingTop: 10,
        elevation: 8, shadowColor: '#6D28D9', shadowOpacity: 0.1,
        shadowRadius: 12, shadowOffset: { width: 0, height: -4 } }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ fontSize: 11, color: '#9B7FC8' }}>
              {items.length} รายการ · {totalQty} ชิ้น{(productDiscount + shippingDiscount) > 0
                ? ` · ประหยัด ฿${(productDiscount + shippingDiscount).toLocaleString()}` : ''}
            </Text>
            <Text style={{ fontSize: 20, fontWeight: '900', color: '#7C3AED' }}>
              ฿{grandTotal.toLocaleString()}
            </Text>
          </View>
          <Pressable onPress={handlePlaceOrder} disabled={submitting}
            style={{ borderRadius: 14, overflow: 'hidden', opacity: submitting ? 0.7 : 1 }}>
            <LinearGradient colors={['#7C3AED', '#EC4899']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center', gap: 3 }}>
              {submitting ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: '#fff' }}>✅ ยืนยันสั่งซื้อ</Text>
                  <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)' }}>→ ไปหน้าชำระเงิน</Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        </View>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    elevation: 2, shadowColor: '#6430C8', shadowOpacity: 0.05, shadowRadius: 8,
  },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderRadius: 12, marginBottom: 8, borderWidth: 1.5,
    borderColor: 'rgba(167,139,250,0.25)', backgroundColor: 'rgba(255,255,255,0.8)',
  },
  optionRowActive: { borderColor: '#7C3AED', backgroundColor: 'rgba(124,58,237,0.04)' },
  radio: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#C4B5D8',
    justifyContent: 'center', alignItems: 'center',
  },
  radioActive: { borderColor: '#7C3AED', backgroundColor: '#7C3AED' },
  radioDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' },
});
