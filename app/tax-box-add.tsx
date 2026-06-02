import { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { taxBoxService, TAX_DEDUCTION_TYPES } from '@/services/taxBoxService';
import type { TaxDeductionType } from '@/services/taxBoxService';
import { formatCurrency } from '@/lib/format';
import { useSnackbar } from '@/components/ui/SnackbarProvider';

export default function TaxBoxAddScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showSnackbar } = useSnackbar();
  const { taxBoxId, presetTypeId, taxYear } = useLocalSearchParams<{
    taxBoxId: string;
    presetTypeId?: string;
    taxYear: string;
  }>();

  const [selectedType, setSelectedType] = useState<TaxDeductionType | null>(
    presetTypeId ? (TAX_DEDUCTION_TYPES.find((t) => t.id === presetTypeId) ?? null) : null
  );
  const [amountText, setAmountText] = useState('');
  const [docNote, setDocNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [amountError, setAmountError] = useState('');

  const year = parseInt(taxYear ?? String(new Date().getFullYear()));
  const amount = parseFloat(amountText.replace(/,/g, '')) || 0;

  async function handleSave() {
    if (!selectedType) {
      showSnackbar({ message: 'กรุณาเลือกประเภทลดหย่อน', variant: 'warning' });
      return;
    }
    if (amount <= 0) {
      setAmountError('กรุณาระบุจำนวนเงิน');
      return;
    }
    if (amount > 10000000) {
      setAmountError('จำนวนเงินเกิน 10 ล้านบาท กรุณาตรวจสอบอีกครั้ง');
      return;
    }
    setAmountError('');
    setSaving(true);
    try {
      await taxBoxService.addItem(taxBoxId, {
        deductionTypeId: selectedType.id,
        deductionName: selectedType.name,
        amount,
        documentNote: docNote.trim() || undefined,
      });
      showSnackbar({
        title: 'บันทึกแล้ว',
        message: `${selectedType.icon} ${selectedType.name} ${formatCurrency(amount)} บาท`,
        variant: 'success',
      });
      router.back();
    } catch (e: any) {
      showSnackbar({ message: e.message || 'บันทึกไม่สำเร็จ', variant: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ headerShown: false }} />

      <LinearGradient
        colors={['#1B5E20', '#2E7D32', '#43A047']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 8, paddingBottom: 20, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => router.back()} style={{ padding: 6, marginRight: 8 }}>
            <Text style={{ fontSize: 20, color: '#fff' }}>←</Text>
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff', flex: 1 }}>
            เพิ่มรายการลดหย่อน
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>ปี {year + 543}</Text>
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 140 }}>

        {/* เลือกประเภทลดหย่อน */}
        <View>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 10 }}>
            ประเภทลดหย่อน <Text style={{ color: '#E53935' }}>*</Text>
          </Text>
          <View style={{ gap: 8 }}>
            {TAX_DEDUCTION_TYPES.map((type) => {
              const isSelected = selectedType?.id === type.id;
              return (
                <Pressable
                  key={type.id}
                  onPress={() => setSelectedType(type)}
                  style={{
                    backgroundColor: isSelected ? type.color + '12' : '#fff',
                    borderRadius: 12, padding: 12,
                    borderWidth: 1.5, borderColor: isSelected ? type.color : '#E8E8E8',
                    flexDirection: 'row', alignItems: 'center',
                    elevation: 1, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 3,
                  }}>
                  <Text style={{ fontSize: 22, marginRight: 12 }}>{type.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: isSelected ? type.color : '#333' }}>
                      {type.name}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{type.ceilingNote}</Text>
                  </View>
                  {isSelected && (
                    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: type.color, justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>✓</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ใส่จำนวนเงิน */}
        {selectedType && (
          <>
            <View style={{
              backgroundColor: '#fff', borderRadius: 16, padding: 16,
              elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#333' }}>
                  จำนวนเงิน (บาท)
                </Text>
                <Text style={{ color: '#E53935', fontSize: 16, marginLeft: 4 }}>*</Text>
              </View>
              <TextInput
                value={amountText}
                onChangeText={(v) => { setAmountText(v); setAmountError(''); }}
                keyboardType="numeric"
                placeholder="ระบุจำนวนเงิน เช่น 12000"
                placeholderTextColor="#FF8F00"
                style={{
                  fontSize: 26, fontWeight: '800', color: '#333',
                  borderBottomWidth: 2,
                  borderBottomColor: amountError ? '#E53935' : amount > 0 ? selectedType.color : '#DDD',
                  paddingBottom: 8,
                }}
              />
              {amount > 0 && (
                <Text style={{ fontSize: 13, color: selectedType.color, fontWeight: '700', marginTop: 8 }}>
                  = {formatCurrency(amount)} บาท
                </Text>
              )}
              {amountError !== '' && (
                <View style={{ backgroundColor: '#FFEBEE', borderRadius: 10, padding: 10, marginTop: 10 }}>
                  <Text style={{ fontSize: 13, color: '#C62828', fontWeight: '600' }}>⚠️ {amountError}</Text>
                </View>
              )}
              {/* แสดงเพดานและสิ่งที่ต้องรู้ */}
              <View style={{ marginTop: 14, backgroundColor: selectedType.color + '10', borderRadius: 10, padding: 12 }}>
                <Text style={{ fontSize: 12, color: selectedType.color, fontWeight: '700', marginBottom: 4 }}>
                  {selectedType.icon} {selectedType.name}
                </Text>
                <Text style={{ fontSize: 12, color: '#555', lineHeight: 18 }}>{selectedType.description}</Text>
                <Text style={{ fontSize: 12, color: selectedType.color, fontWeight: '700', marginTop: 6 }}>
                  เพดาน: {selectedType.ceilingNote}
                </Text>
              </View>
            </View>

            {/* บันทึกโน้ต/เอกสาร */}
            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 10 }}>
                โน้ต/เอกสารอ้างอิง (ไม่บังคับ)
              </Text>
              <TextInput
                value={docNote}
                onChangeText={setDocNote}
                placeholder="เช่น ใบเสร็จประกัน AIA เลขที่ 12345, สลิปโอน SSF ธ.ค. 2569"
                placeholderTextColor="#BBB"
                multiline
                numberOfLines={3}
                style={{
                  fontSize: 14, color: '#333',
                  borderWidth: 1, borderColor: '#E8E8E8', borderRadius: 10,
                  padding: 12, minHeight: 80, textAlignVertical: 'top',
                }}
              />
            </View>

            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={{
                backgroundColor: saving ? '#A5D6A7' : '#2E7D32',
                borderRadius: 16, paddingVertical: 16, alignItems: 'center',
              }}>
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>💾 บันทึกรายการลดหย่อน</Text>}
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
