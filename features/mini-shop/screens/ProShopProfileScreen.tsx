import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Switch,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { api } from '@/lib/api/client';
import { useSnackbar } from '@/components/ui/SnackbarProvider';
import type {
  ShopCategory, PaymentMethod, PromptPayType, PaymentVisibility, ShopInput,
} from '@/lib/api/contract';

// ── Constants ────────────────────────────────────────────────
const TOTAL_STEPS = 4;

const CATEGORIES: { id: ShopCategory; icon: string; label: string }[] = [
  { id: 'fashion',    icon: '👗', label: 'เสื้อผ้า / แฟชั่น' },
  { id: 'home',       icon: '🏠', label: 'ของใช้บ้าน' },
  { id: 'agriculture',icon: '🌿', label: 'เกษตร / สวน' },
  { id: 'homemade',   icon: '✨', label: 'Homemade' },
  { id: 'secondhand', icon: '♻️', label: 'สินค้ามือสอง' },
  { id: 'other',      icon: '⋯',  label: 'อื่น ๆ' },
];

// ── Step Progress Bar ────────────────────────────────────────
function StepBar({ current, total }: { current: number; total: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 20 }}>
      {Array.from({ length: total }).map((_, i) => {
        const done = i + 1 < current;
        const active = i + 1 === current;
        return (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <View style={{
              flex: 1, height: 4, borderRadius: 2,
              backgroundColor: done || active ? '#7C3AED' : '#E9D5FF',
            }} />
            {i < total - 1 && (
              <View style={{
                width: 4, height: 4, borderRadius: 2,
                backgroundColor: done ? '#7C3AED' : '#E9D5FF', marginLeft: 4,
              }} />
            )}
          </View>
        );
      })}
    </View>
  );
}

function SectionHeader({ icon, title, step, badge }: {
  icon: string; title: string; step: number; badge?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8,
      marginBottom: 16, paddingBottom: 10,
      borderBottomWidth: 1.5, borderBottomColor: 'rgba(167,139,250,0.2)' }}>
      <View style={{ width: 30, height: 30, borderRadius: 9,
        backgroundColor: '#7C3AED', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 15 }}>{icon}</Text>
      </View>
      <Text style={{ flex: 1, fontSize: 15, fontWeight: '800', color: '#2D1B69' }}>{title}</Text>
      <View style={{ backgroundColor: 'rgba(124,58,237,0.08)',
        borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
        <Text style={{ fontSize: 10, fontWeight: '700', color: '#9B7FC8' }}>
          {badge ?? `ขั้น ${step}`}
        </Text>
      </View>
    </View>
  );
}

function FieldLabel({ label, required, tag }: {
  label: string; required?: boolean; tag?: { text: string; color: string; bg: string };
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
      <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#5B21B6' }}>
        {label}{required && <Text style={{ color: '#EC4899' }}> *</Text>}
      </Text>
      {tag && (
        <View style={{ marginLeft: 'auto', backgroundColor: tag.bg,
          borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: tag.color }}>{tag.text}</Text>
        </View>
      )}
    </View>
  );
}

const INPUT_STYLE = {
  backgroundColor: 'rgba(255,255,255,0.9)',
  borderWidth: 1.5, borderColor: 'rgba(167,139,250,0.4)',
  borderRadius: 12, padding: 12,
  fontSize: 14, color: '#2D1B69',
} as const;

const PUBLIC_TAG  = { text: '👁 ลูกค้าเห็น', color: '#059669', bg: 'rgba(16,185,129,0.1)' };
const PRIVATE_TAG = { text: '🔒 ระบบเท่านั้น', color: '#6D28D9', bg: 'rgba(124,58,237,0.08)' };
const OPTIONAL_TAG = { text: 'ไม่จำเป็น', color: '#6B7280', bg: 'rgba(156,163,175,0.12)' };

// ── Main Screen ──────────────────────────────────────────────
export default function ProShopProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { shopId } = useLocalSearchParams<{ shopId?: string }>();
  const { showSnackbar } = useSnackbar();
  const isEdit = !!shopId;

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // ── Step 1: ข้อมูลร้าน
  const [name, setName]                   = useState('');
  const [category, setCategory]           = useState<ShopCategory>('fashion');
  const [description, setDescription]     = useState('');
  const [phone, setPhone]                 = useState('');
  const [lineId, setLineId]               = useState('');
  const [facebookPage, setFacebookPage]   = useState('');

  // ── Step 2: ที่ตั้งร้าน
  const [hasPhysical, setHasPhysical]     = useState(false);
  const [address, setAddress]             = useState('');
  const [openHours, setOpenHours]         = useState('');

  // ── Step 3: ข้อมูลรับเงิน
  const [paymentMethod, setPaymentMethod]       = useState<PaymentMethod>('promptpay');
  const [promptPayType, setPromptPayType]       = useState<PromptPayType>('phone');
  const [promptPayNumber, setPromptPayNumber]   = useState('');
  const [accountName, setAccountName]           = useState('');
  const [bankName, setBankName]                 = useState('');
  const [accountNumber, setAccountNumber]       = useState('');
  const [paymentVisibility, setPaymentVisibility] = useState<PaymentVisibility>('qr_only');

  // ── Step 4: consent (auto-checked on edit)
  const [consentOwner, setConsentOwner]   = useState(false);
  const [consentPublic, setConsentPublic] = useState(false);
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [loadingShop, setLoadingShop]     = useState(isEdit);

  // ── Pre-fill on edit ────────────────────────────────────
  useEffect(() => {
    if (!isEdit) return;
    api.getShop().then(r => {
      if (r.ok && r.data) {
        const s = r.data;
        setName(s.name ?? '');
        setCategory(s.category ?? 'fashion');
        setDescription(s.description ?? '');
        setPhone(s.phone ?? '');
        setLineId(s.lineId ?? '');
        setFacebookPage(s.facebookPage ?? '');
        setHasPhysical(s.hasPhysicalLocation ?? false);
        setAddress(s.address ?? '');
        setOpenHours(s.openHours ?? '');
        setPaymentMethod(s.paymentMethod ?? 'promptpay');
        setPromptPayType(s.promptPayType ?? 'phone');
        setPromptPayNumber(s.promptPayNumber ?? '');
        setAccountName(s.accountName ?? '');
        setBankName(s.bankName ?? '');
        setAccountNumber(s.accountNumber ?? '');
        setPaymentVisibility(s.paymentVisibility ?? 'qr_only');
        // Auto-check consent on edit
        setConsentOwner(true);
        setConsentPublic(true);
        setConsentPrivacy(true);
      }
      setLoadingShop(false);
    });
  }, [isEdit]);

  // ── Validation per step ──────────────────────────────────
  function validateStep1() {
    if (!name.trim()) { Alert.alert('', 'กรุณาใส่ชื่อร้าน'); return false; }
    if (!phone.trim()) { Alert.alert('', 'กรุณาใส่เบอร์ติดต่อ'); return false; }
    return true;
  }

  function validateStep3() {
    if (paymentMethod === 'promptpay' && !promptPayNumber.trim()) {
      Alert.alert('', 'กรุณาใส่เบอร์ที่ผูก PromptPay'); return false;
    }
    if (paymentMethod === 'bank' && !accountName.trim()) {
      Alert.alert('', 'กรุณาใส่ชื่อบัญชีรับเงิน'); return false;
    }
    return true;
  }

  function validateStep4() {
    if (!consentOwner || !consentPublic || !consentPrivacy) {
      Alert.alert('', 'กรุณายืนยันข้อมูลทุกข้อก่อนเปิดร้าน'); return false;
    }
    return true;
  }

  function handleNext() {
    if (step === 1 && !validateStep1()) return;
    if (step === 3 && !validateStep3()) return;
    setStep(s => s + 1);
  }

  function handleBack() {
    if (step === 1) { router.back(); return; }
    setStep(s => s - 1);
  }

  async function handleSubmit() {
    if (!validateStep4()) return;
    setSaving(true);
    try {
      const input: ShopInput = {
        name: name.trim(),
        category,
        description: description.trim(),
        phone: phone.trim(),
        lineId: lineId.trim() || undefined,
        facebookPage: facebookPage.trim() || undefined,
        hasPhysicalLocation: hasPhysical,
        address: address.trim() || undefined,
        openHours: openHours.trim() || undefined,
        paymentMethod,
        promptPayType: paymentMethod === 'promptpay' ? promptPayType : undefined,
        promptPayNumber: paymentMethod === 'promptpay' ? promptPayNumber.trim() : undefined,
        accountName: accountName.trim() || undefined,
        bankName: bankName.trim() || undefined,
        accountNumber: accountNumber.trim() || undefined,
        paymentVisibility,
      };

      const result = isEdit
        ? await api.updateShop(input)
        : await api.createShop(input);

      if (result.ok) {
        showSnackbar({ message: isEdit ? '✅ อัปเดตร้านแล้ว' : '🏪 เปิดร้านสำเร็จ!', variant: 'success' });
        router.back();
      } else {
        showSnackbar({ message: result.message, variant: 'error' });
      }
    } finally {
      setSaving(false);
    }
  }

  const stepTitles = ['ข้อมูลร้าน', 'ที่ตั้งร้าน', 'ข้อมูลรับเงิน', 'ยืนยันและเปิดร้าน'];

  if (loadingShop) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F3F0FF', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#9333EA" />
        <Text style={{ fontSize: 13, color: '#9B7FC8', marginTop: 12 }}>โหลดข้อมูลร้าน...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F3F0FF' }}>
      {/* Header */}
      <LinearGradient colors={['#6B21A8', '#9333EA', '#EC4899']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 8, paddingBottom: 16, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <Pressable onPress={handleBack} style={{ padding: 6, marginRight: 8 }}>
            <Text style={{ fontSize: 20, color: '#fff' }}>←</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>
              {isEdit ? '✏️ แก้ไขข้อมูลร้าน' : '🏪 ตั้งค่าร้านของคุณ'}
            </Text>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
              ขั้น {step} / {TOTAL_STEPS} · {stepTitles[step - 1]}
            </Text>
          </View>
        </View>
        <StepBar current={step} total={TOTAL_STEPS} />
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 120 }}>

          {/* ── Step 1: ข้อมูลร้าน ─────────────────────────── */}
          {step === 1 && (
            <View style={{ backgroundColor: 'rgba(255,255,255,0.72)', borderRadius: 20, padding: 18 }}>
              <SectionHeader icon="🏪" title="ข้อมูลร้าน" step={1} />

              {/* ชื่อร้าน */}
              <View style={{ marginBottom: 16 }}>
                <FieldLabel label="ชื่อร้าน" required tag={PUBLIC_TAG} />
                <TextInput
                  value={name} onChangeText={setName}
                  placeholder="เช่น ร้านหมูนุ่นเป๋าตุง"
                  placeholderTextColor="#C4B5D8"
                  style={INPUT_STYLE} />
              </View>

              {/* ประเภทร้าน */}
              <View style={{ marginBottom: 16 }}>
                <FieldLabel label="ประเภทร้าน" required tag={PUBLIC_TAG} />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {CATEGORIES.map(c => (
                    <Pressable key={c.id} onPress={() => setCategory(c.id)}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 6,
                        paddingVertical: 9, paddingHorizontal: 12, borderRadius: 11,
                        borderWidth: 1.5,
                        borderColor: category === c.id ? '#7C3AED' : 'rgba(167,139,250,0.35)',
                        backgroundColor: category === c.id ? 'rgba(124,58,237,0.08)' : 'rgba(255,255,255,0.85)',
                      }}>
                      <Text style={{ fontSize: 16 }}>{c.icon}</Text>
                      <Text style={{ fontSize: 12, fontWeight: '600',
                        color: category === c.id ? '#5B21B6' : '#7C5CB8' }}>
                        {c.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* รายละเอียด */}
              <View style={{ marginBottom: 16 }}>
                <FieldLabel label="รายละเอียดร้าน" tag={PUBLIC_TAG} />
                <TextInput
                  value={description} onChangeText={setDescription}
                  placeholder="เช่น ร้านจำหน่ายเสื้อผ้า Oversize คุณภาพดี ราคาถูก"
                  placeholderTextColor="#C4B5D8"
                  multiline numberOfLines={3}
                  style={[INPUT_STYLE, { minHeight: 72, textAlignVertical: 'top' }]} />
              </View>

              {/* ช่องทางติดต่อ */}
              <View>
                <FieldLabel label="ช่องทางติดต่อ" tag={PUBLIC_TAG} />
                {[
                  { icon: '📞', value: phone, setter: setPhone, placeholder: 'เบอร์โทรติดต่อ *', keyboard: 'phone-pad', required: true },
                  { icon: '💬', value: lineId, setter: setLineId, placeholder: 'LINE ID (ไม่จำเป็น)', keyboard: 'default' },
                  { icon: '📘', value: facebookPage, setter: setFacebookPage, placeholder: 'Facebook Page (ไม่จำเป็น)', keyboard: 'default' },
                ].map((f, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 10,
                      backgroundColor: 'rgba(124,58,237,0.08)',
                      justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ fontSize: 18 }}>{f.icon}</Text>
                    </View>
                    <TextInput
                      value={f.value} onChangeText={f.setter as (v: string) => void}
                      placeholder={f.placeholder} placeholderTextColor="#C4B5D8"
                      keyboardType={f.keyboard as any}
                      style={[INPUT_STYLE, { flex: 1 }]} />
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── Step 2: ที่ตั้งร้าน ─────────────────────────── */}
          {step === 2 && (
            <View style={{ backgroundColor: 'rgba(255,255,255,0.72)', borderRadius: 20, padding: 18 }}>
              <SectionHeader icon="📍" title="ที่ตั้งร้าน" step={2} badge="B · ไม่จำเป็น" />

              {/* มีหน้าร้าน toggle */}
              <View style={{ marginBottom: 16 }}>
                <FieldLabel label="ลักษณะร้าน" tag={PUBLIC_TAG} />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {[
                    { val: false, icon: '🛒', label: 'ขายออนไลน์\nไม่มีหน้าร้าน' },
                    { val: true,  icon: '🏪', label: 'มีหน้าร้านจริง' },
                  ].map(opt => (
                    <Pressable key={String(opt.val)} onPress={() => setHasPhysical(opt.val)}
                      style={{
                        flex: 1, alignItems: 'center', justifyContent: 'center',
                        gap: 4, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5,
                        borderColor: hasPhysical === opt.val ? '#7C3AED' : 'rgba(167,139,250,0.35)',
                        backgroundColor: hasPhysical === opt.val ? 'rgba(124,58,237,0.08)' : 'rgba(255,255,255,0.85)',
                      }}>
                      <Text style={{ fontSize: 22 }}>{opt.icon}</Text>
                      <Text style={{ fontSize: 11, fontWeight: '700', textAlign: 'center',
                        color: hasPhysical === opt.val ? '#5B21B6' : '#7C5CB8' }}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* ที่อยู่ */}
              <View style={{ marginBottom: 16 }}>
                <FieldLabel label="ที่อยู่ร้าน (ข้อความ)" tag={OPTIONAL_TAG} />
                <TextInput
                  value={address} onChangeText={setAddress}
                  placeholder={hasPhysical
                    ? 'เช่น 12/3 ถ.หลัก อ.เมือง จ.สุรินทร์ 32000'
                    : 'เช่น จัดส่งทั่วประเทศ · ฐานที่สุรินทร์'}
                  placeholderTextColor="#C4B5D8"
                  multiline numberOfLines={2}
                  style={[INPUT_STYLE, { minHeight: 60, textAlignVertical: 'top' }]} />
              </View>

              {/* เวลา */}
              {hasPhysical && (
                <View style={{ marginBottom: 16 }}>
                  <FieldLabel label="เวลาเปิด-ปิด" tag={OPTIONAL_TAG} />
                  <TextInput
                    value={openHours} onChangeText={setOpenHours}
                    placeholder="เช่น จ.–ศ. 09:00–18:00 น. หรือ ทุกวัน"
                    placeholderTextColor="#C4B5D8"
                    style={INPUT_STYLE} />
                </View>
              )}

              {/* info box */}
              <View style={{ backgroundColor: 'rgba(59,130,246,0.07)',
                borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(59,130,246,0.25)',
                padding: 10 }}>
                <Text style={{ fontSize: 12, color: '#1D4ED8', lineHeight: 18 }}>
                  💡 ขั้นตอนนี้ไม่จำเป็น กด <Text style={{ fontWeight: '800' }}>ถัดไป</Text> เพื่อข้ามได้เลย
                </Text>
              </View>
            </View>
          )}

          {/* ── Step 3: ข้อมูลรับเงิน ───────────────────────── */}
          {step === 3 && (
            <View style={{ backgroundColor: 'rgba(255,255,255,0.72)', borderRadius: 20, padding: 18 }}>
              <SectionHeader icon="💳" title="ข้อมูลรับเงิน" step={3} />

              {/* warning */}
              <View style={{ backgroundColor: 'rgba(59,130,246,0.07)',
                borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(59,130,246,0.25)',
                padding: 10, marginBottom: 16 }}>
                <Text style={{ fontSize: 12, color: '#1D4ED8', lineHeight: 18 }}>
                  🔒 ข้อมูลส่วนนี้ใช้เพื่อสร้าง QR รับชำระเงิน และแสดงให้ลูกค้าตรวจสอบก่อนโอนเท่านั้น
                </Text>
              </View>

              {/* Payment method */}
              <View style={{ marginBottom: 16 }}>
                <FieldLabel label="วิธีรับเงินหลัก" required />
                {([
                  { id: 'promptpay' as PaymentMethod, icon: '🏦', label: 'PromptPay', sub: 'สร้าง QR อัตโนมัติ · ตรวจสลิปได้ทันที' },
                  { id: 'bank'      as PaymentMethod, icon: '🏧', label: 'บัญชีธนาคาร', sub: 'แสดงเลขบัญชีให้ลูกค้าโอน' },
                ] as const).map(opt => (
                  <Pressable key={opt.id} onPress={() => setPaymentMethod(opt.id)}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 10,
                      padding: 12, borderRadius: 12, marginBottom: 8, borderWidth: 1.5,
                      borderColor: paymentMethod === opt.id ? '#7C3AED' : 'rgba(167,139,250,0.35)',
                      backgroundColor: paymentMethod === opt.id ? 'rgba(124,58,237,0.06)' : 'rgba(255,255,255,0.85)',
                    }}>
                    <View style={{
                      width: 18, height: 18, borderRadius: 9, borderWidth: 2,
                      borderColor: paymentMethod === opt.id ? '#7C3AED' : '#C4B5D8',
                      backgroundColor: paymentMethod === opt.id ? '#7C3AED' : 'transparent',
                      justifyContent: 'center', alignItems: 'center',
                    }}>
                      {paymentMethod === opt.id && (
                        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' }} />
                      )}
                    </View>
                    <Text style={{ fontSize: 20 }}>{opt.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#2D1B69' }}>{opt.label}</Text>
                      <Text style={{ fontSize: 11, color: '#9B7FC8', marginTop: 1 }}>{opt.sub}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>

              {/* PromptPay fields */}
              {paymentMethod === 'promptpay' && (
                <>
                  <View style={{ marginBottom: 16 }}>
                    <FieldLabel label="ประเภท PromptPay" required tag={PRIVATE_TAG} />
                    <View style={{ flexDirection: 'row', gap: 8,
                      padding: 10, backgroundColor: 'rgba(124,58,237,0.04)',
                      borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(124,58,237,0.15)' }}>
                      {([
                        { id: 'phone'       as PromptPayType, icon: '📱', label: 'เบอร์โทรศัพท์', sub: '10 หลัก · แนะนำ' },
                        { id: 'national_id' as PromptPayType, icon: '🪪', label: 'เลขบัตรปชช.', sub: '13 หลัก' },
                      ] as const).map(opt => (
                        <Pressable key={opt.id} onPress={() => setPromptPayType(opt.id)}
                          style={{
                            flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8,
                            borderWidth: 1.5,
                            borderColor: promptPayType === opt.id ? '#7C3AED' : 'rgba(167,139,250,0.35)',
                            backgroundColor: promptPayType === opt.id ? 'rgba(124,58,237,0.09)' : '#fff',
                          }}>
                          <Text style={{ fontSize: 18 }}>{opt.icon}</Text>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#5B21B6', marginTop: 2 }}>{opt.label}</Text>
                          <Text style={{ fontSize: 10, color: '#9B7FC8' }}>{opt.sub}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View style={{ marginBottom: 16 }}>
                    <FieldLabel
                      label={promptPayType === 'phone' ? 'เบอร์ที่ผูก PromptPay' : 'เลขบัตรประชาชน'}
                      required tag={PRIVATE_TAG} />
                    <TextInput
                      value={promptPayNumber} onChangeText={setPromptPayNumber}
                      placeholder={promptPayType === 'phone' ? 'เช่น 0812345678' : 'เช่น 1234567890123'}
                      placeholderTextColor="#C4B5D8"
                      keyboardType="phone-pad" maxLength={promptPayType === 'phone' ? 10 : 13}
                      style={INPUT_STYLE} />
                    <Text style={{ fontSize: 11, color: '#9B7FC8', marginTop: 4 }}>
                      ✅ ใช้เบอร์ที่ผูก PromptPay แล้ว เพื่อให้ระบบสร้าง QR ได้ถูกต้อง
                    </Text>
                  </View>
                </>
              )}

              {/* ชื่อบัญชี */}
              <View style={{ marginBottom: 16 }}>
                <FieldLabel label="ชื่อบัญชีรับเงิน"
                  required={paymentMethod === 'bank'} tag={PUBLIC_TAG} />
                <TextInput
                  value={accountName} onChangeText={setAccountName}
                  placeholder="ชื่อ-นามสกุล เจ้าของบัญชี"
                  placeholderTextColor="#C4B5D8"
                  style={INPUT_STYLE} />
                <View style={{ marginTop: 6, backgroundColor: 'rgba(234,179,8,0.09)',
                  borderRadius: 8, borderWidth: 1, borderColor: 'rgba(234,179,8,0.3)',
                  padding: 8 }}>
                  <Text style={{ fontSize: 11, color: '#92400E', lineHeight: 16 }}>
                    ⚠️ ชื่อบัญชีจะแสดงให้ลูกค้าตรวจสอบก่อนโอน กรอกให้ตรงกับบัญชีจริง
                  </Text>
                </View>
              </View>

              {/* Bank (optional) */}
              <View style={{ marginBottom: 16 }}>
                <FieldLabel label="ธนาคาร" tag={OPTIONAL_TAG} />
                <TextInput
                  value={bankName} onChangeText={setBankName}
                  placeholder="เช่น KBank, SCB, KTB (ถ้ามีบัญชีสำรอง)"
                  placeholderTextColor="#C4B5D8"
                  style={INPUT_STYLE} />
              </View>

              <View style={{ marginBottom: 16 }}>
                <FieldLabel label="เลขที่บัญชีธนาคาร" tag={OPTIONAL_TAG} />
                <TextInput
                  value={accountNumber} onChangeText={setAccountNumber}
                  placeholder="เช่น 123-4-56789-0"
                  placeholderTextColor="#C4B5D8"
                  keyboardType="numeric"
                  style={INPUT_STYLE} />
              </View>

              {/* Payment visibility */}
              <View>
                <FieldLabel label="แสดงข้อมูลรับเงินให้ลูกค้าเห็น" />
                {([
                  { id: 'qr_only'       as PaymentVisibility, label: 'แสดง QR PromptPay เท่านั้น (แนะนำ)' },
                  { id: 'qr_name'       as PaymentVisibility, label: 'แสดง QR + ชื่อบัญชี' },
                  { id: 'qr_name_account' as PaymentVisibility, label: 'แสดง QR + ชื่อบัญชี + เลขบัญชี' },
                ] as const).map(opt => (
                  <Pressable key={opt.id} onPress={() => setPaymentVisibility(opt.id)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8,
                      padding: 9, borderRadius: 9, marginBottom: 6, borderWidth: 1.5,
                      borderColor: paymentVisibility === opt.id ? '#7C3AED' : 'rgba(167,139,250,0.3)',
                      backgroundColor: paymentVisibility === opt.id ? 'rgba(124,58,237,0.06)' : 'rgba(255,255,255,0.85)' }}>
                    <View style={{
                      width: 15, height: 15, borderRadius: 8, borderWidth: 2,
                      borderColor: paymentVisibility === opt.id ? '#7C3AED' : '#C4B5D8',
                      backgroundColor: paymentVisibility === opt.id ? '#7C3AED' : 'transparent',
                      justifyContent: 'center', alignItems: 'center',
                    }}>
                      {paymentVisibility === opt.id && (
                        <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#fff' }} />
                      )}
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#5B21B6' }}>{opt.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* ── Step 4: ยืนยันและเปิดร้าน ───────────────────── */}
          {step === 4 && (
            <View>
              {/* Summary card */}
              <View style={{ backgroundColor: 'rgba(255,255,255,0.72)', borderRadius: 20,
                padding: 18, marginBottom: 12 }}>
                <SectionHeader icon="✅" title="สรุปข้อมูลร้าน" step={4} badge="ตรวจสอบก่อนเปิด" />

                {[
                  { label: 'ชื่อร้าน', value: name },
                  { label: 'ประเภท', value: CATEGORIES.find(c => c.id === category)?.label },
                  { label: 'เบอร์ติดต่อ', value: phone },
                  { label: 'LINE ID', value: lineId || '—' },
                  { label: 'ที่ตั้ง', value: hasPhysical ? 'มีหน้าร้าน' : 'ขายออนไลน์' },
                  { label: 'รับเงินผ่าน', value: paymentMethod === 'promptpay' ? `PromptPay (${promptPayType === 'phone' ? 'เบอร์โทร' : 'บัตรปชช.'})` : 'บัญชีธนาคาร' },
                  { label: 'ชื่อบัญชี', value: accountName || '—' },
                ].map((row, i) => (
                  <View key={i} style={{ flexDirection: 'row', paddingVertical: 7,
                    borderBottomWidth: i < 6 ? 1 : 0, borderBottomColor: 'rgba(167,139,250,0.15)' }}>
                    <Text style={{ fontSize: 12, color: '#9B7FC8', width: 100 }}>{row.label}</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#2D1B69', flex: 1 }}>
                      {row.value}
                    </Text>
                  </View>
                ))}

                <Pressable onPress={() => setStep(1)}
                  style={{ marginTop: 12, alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, color: '#7C3AED', fontWeight: '700' }}>
                    ✏️ กลับไปแก้ไข
                  </Text>
                </Pressable>
              </View>

              {/* Consent */}
              <View style={{ backgroundColor: 'rgba(237,233,254,0.5)',
                borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(124,58,237,0.2)',
                padding: 16, marginBottom: 12 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#2D1B69', marginBottom: 12 }}>
                  🔐 ยืนยันข้อมูลและความเป็นส่วนตัว
                </Text>
                {[
                  { state: consentOwner,   setter: setConsentOwner,   text: 'ฉันยืนยันว่าข้อมูลรับเงิน (PromptPay / บัญชีธนาคาร) เป็นของฉัน หรือได้รับอนุญาตให้ใช้' },
                  { state: consentPublic,  setter: setConsentPublic,  text: 'ฉันเข้าใจว่าข้อมูลบางส่วน เช่น ชื่อบัญชีและ QR Code จะถูกแสดงบนหน้าชำระเงินให้ลูกค้าเห็น' },
                  { state: consentPrivacy, setter: setConsentPrivacy, text: 'ฉันได้อ่านและยอมรับ นโยบายความเป็นส่วนตัว (Privacy Policy) เกี่ยวกับการเก็บข้อมูลร้านค้า' },
                ].map((item, i) => (
                  <Pressable key={i} onPress={() => item.setter(!item.state)}
                    style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                    <View style={{
                      width: 20, height: 20, borderRadius: 5, marginTop: 1,
                      borderWidth: 2, borderColor: item.state ? '#7C3AED' : '#A78BFA',
                      backgroundColor: item.state ? '#7C3AED' : '#fff',
                      justifyContent: 'center', alignItems: 'center', flexShrink: 0,
                    }}>
                      {item.state && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>✓</Text>}
                    </View>
                    <Text style={{ fontSize: 12, color: '#4B3A8A', lineHeight: 18, flex: 1 }}>
                      {item.text}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Fixed Bottom Buttons ─────────────────────────────── */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        paddingHorizontal: 20, paddingBottom: insets.bottom + 12, paddingTop: 12,
        backgroundColor: 'rgba(243,240,255,0.95)',
        borderTopWidth: 1, borderTopColor: 'rgba(167,139,250,0.2)',
        flexDirection: 'row', gap: 12,
      }}>
        <Pressable onPress={handleBack}
          style={{ flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center',
            borderWidth: 1.5, borderColor: 'rgba(167,139,250,0.5)',
            backgroundColor: 'rgba(255,255,255,0.7)' }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#7C3AED' }}>
            {step === 1 ? 'ยกเลิก' : '← ย้อนกลับ'}
          </Text>
        </Pressable>

        {step < TOTAL_STEPS ? (
          <Pressable onPress={handleNext}
            style={{ flex: 2, paddingVertical: 14, borderRadius: 14, alignItems: 'center',
              overflow: 'hidden' }}>
            <LinearGradient colors={['#7C3AED', '#A855F7', '#EC4899']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ ...StyleSheet.absoluteFillObject }} />
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>
              {step === 2 ? 'ถัดไป (ข้ามได้)' : 'ถัดไป →'}
            </Text>
          </Pressable>
        ) : (
          <Pressable onPress={handleSubmit} disabled={saving}
            style={{ flex: 2, paddingVertical: 14, borderRadius: 14, alignItems: 'center',
              overflow: 'hidden', opacity: saving ? 0.7 : 1 }}>
            <LinearGradient colors={['#7C3AED', '#A855F7', '#EC4899']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ ...StyleSheet.absoluteFillObject }} />
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>
                  🏪 {isEdit ? 'บันทึกการแก้ไข' : 'เปิดร้านเลย!'}
                </Text>}
          </Pressable>
        )}
      </View>
    </View>
  );
}

// StyleSheet import needed for absoluteFillObject
import { StyleSheet } from 'react-native';
