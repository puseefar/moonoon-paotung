import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput, Alert, Modal, Switch,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Stack } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Colors from '@/constants/Colors';
import { useSnackbar } from '@/components/ui/SnackbarProvider';
import { useColorScheme } from '@/components/useColorScheme';
import { WalletAvatar } from '@/components/wallet/WalletAvatar';
import { Card } from '@/components/ui/Card';
import { CategoryGrid } from '@/components/category/CategoryGrid';
import { recurringService } from '@/services/recurringService';
import { categoryService } from '@/services/categoryService';
import { useWalletStore } from '@/stores/useWalletStore';
import { formatCurrency, formatDate } from '@/lib/format';
import type { RecurringRule, Category } from '@/db/schema';

const FREQ_OPTIONS = [
  { key: 'daily', label: 'ทุกวัน' },
  { key: 'weekly', label: 'ทุกสัปดาห์' },
  { key: 'monthly', label: 'ทุกเดือน' },
  { key: 'yearly', label: 'ทุกปี' },
] as const;

export default function RecurringScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { showSnackbar } = useSnackbar();

  const { wallets, loadWallets } = useWalletStore();
  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [frequency, setFrequency] = useState<string>('monthly');
  const [dayOfMonth, setDayOfMonth] = useState('1');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [r, cats] = await Promise.all([
      recurringService.getAll(),
      categoryService.getAll(),
      loadWallets(),
    ]);
    setRules(r);
    setCategories(cats);
    if (wallets.length > 0 && !selectedWalletId) setSelectedWalletId(wallets[0].id);
  };

  const handleSave = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || !selectedCategory || !selectedWalletId) {
      showSnackbar({ message: 'กรุณากรอกข้อมูลให้ครบ', variant: 'warning' });
      return;
    }
    const nextDate = new Date();
    if (frequency === 'monthly') nextDate.setDate(parseInt(dayOfMonth) || 1);

    await recurringService.create({
      amount: numAmount,
      type,
      categoryId: selectedCategory.id,
      walletId: selectedWalletId,
      note: note.trim() || null,
      frequency: frequency as 'daily' | 'weekly' | 'monthly' | 'yearly',
      dayOfMonth: frequency === 'monthly' ? parseInt(dayOfMonth) || 1 : null,
      nextDate,
      isActive: true,
    });

    setShowModal(false);
    setAmount('');
    setNote('');
    setSelectedCategory(null);
    loadData();
    showSnackbar({
      title: 'เพิ่มรายการประจำแล้ว',
      message: 'บันทึกรายการประจำเรียบร้อย',
      variant: 'success',
    });
  };

  const handleDelete = (id: string) => {
    Alert.alert('ลบรายจ่ายประจำ', 'ต้องการลบหรือไม่?', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ลบ', style: 'destructive',
        onPress: async () => { await recurringService.delete(id); loadData(); },
      },
    ]);
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await recurringService.toggleActive(id, isActive);
    loadData();
  };

  const handleProcess = async () => {
    const count = await recurringService.processDueRecurring();
    showSnackbar({
      title: 'ตรวจสอบเสร็จแล้ว',
      message: count > 0 ? `สร้าง ${count} รายการอัตโนมัติ` : 'ไม่มีรายการที่ครบกำหนด',
      variant: count > 0 ? 'success' : 'info',
      durationMs: 2800,
    });
    loadData();
  };

  const filteredCategories = categories.filter((c) => c.type === type);
  const freqLabel = (f: string) => FREQ_OPTIONS.find((o) => o.key === f)?.label ?? f;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: 'รายจ่ายประจำ', headerStyle: { backgroundColor: colors.tint }, headerTintColor: '#FFF' }} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 12 }}>
        {/* Process Button */}
        <Pressable onPress={handleProcess} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12, backgroundColor: colors.tint + '10', borderWidth: 1, borderColor: colors.tint + '30', gap: 8 }}>
          <FontAwesome name="refresh" size={14} color={colors.tint} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.tint }}>ตรวจสอบรายการที่ครบกำหนด</Text>
        </Pressable>

        {/* Rules List */}
        {rules.map((rule) => (
          <Card key={rule.id} variant="elevated">
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{rule.note || 'รายจ่ายประจำ'}</Text>
                  <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: rule.type === 'expense' ? colors.expense + '15' : colors.income + '15' }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: rule.type === 'expense' ? colors.expense : colors.income }}>{rule.type === 'expense' ? 'รายจ่าย' : 'รายรับ'}</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 18, fontWeight: '700', color: rule.type === 'expense' ? colors.expense : colors.income, marginTop: 4 }}>
                  {formatCurrency(rule.amount)} บาท
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
                  {freqLabel(rule.frequency)} | ครั้งถัดไป: {formatDate(new Date(rule.nextDate))}
                </Text>
              </View>
              <View style={{ alignItems: 'center', gap: 8 }}>
                <Switch value={rule.isActive ?? true} onValueChange={(v) => handleToggle(rule.id, v)} trackColor={{ true: colors.tint }} />
                <Pressable onPress={() => handleDelete(rule.id)}>
                  <FontAwesome name="trash" size={16} color={colors.expense} />
                </Pressable>
              </View>
            </View>
          </Card>
        ))}

        {rules.length === 0 && (
          <View style={{ alignItems: 'center', padding: 40 }}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>🔄</Text>
            <Text style={{ fontSize: 15, color: colors.textSecondary, textAlign: 'center' }}>ยังไม่มีรายจ่ายประจำ{'\n'}เช่น ค่าเช่า, Netflix, ค่าโทรศัพท์</Text>
          </View>
        )}

        {/* Add Button */}
        <Pressable onPress={() => setShowModal(true)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 14, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.tint, gap: 8 }}>
          <FontAwesome name="plus-circle" size={20} color={colors.tint} />
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.tint }}>เพิ่มรายจ่ายประจำ</Text>
        </Pressable>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Add Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => setShowModal(false)} />
          <View style={{ backgroundColor: colors.cardBackground, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>เพิ่มรายจ่ายประจำ</Text>
              <Pressable onPress={() => setShowModal(false)}><FontAwesome name="times" size={22} color={colors.textSecondary} /></Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
              {/* Type Toggle */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                {(['expense', 'income'] as const).map((t) => (
                  <Pressable key={t} onPress={() => { setType(t); setSelectedCategory(null); }} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: type === t ? (t === 'expense' ? colors.expense : colors.income) : 'transparent', borderWidth: 1, borderColor: t === 'expense' ? colors.expense : colors.income, alignItems: 'center' }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: type === t ? '#FFF' : colors.textSecondary }}>{t === 'expense' ? 'รายจ่าย' : 'รายรับ'}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Amount */}
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>จำนวนเงิน</Text>
              <TextInput value={amount} onChangeText={setAmount} placeholder="0.00" keyboardType="decimal-pad" selectTextOnFocus placeholderTextColor={colors.textSecondary} style={{ backgroundColor: colors.background, borderRadius: 12, padding: 14, fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 16, borderWidth: 1, borderColor: colors.border }} />

              {/* Frequency */}
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>ความถี่</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                {FREQ_OPTIONS.map((opt) => (
                  <Pressable key={opt.key} onPress={() => setFrequency(opt.key)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: frequency === opt.key ? colors.tint : colors.background, borderWidth: 1, borderColor: frequency === opt.key ? colors.tint : colors.border }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: frequency === opt.key ? '#FFF' : colors.textSecondary }}>{opt.label}</Text>
                  </Pressable>
                ))}
              </View>

              {frequency === 'monthly' && (
                <>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>วันที่ของเดือน</Text>
                  <TextInput value={dayOfMonth} onChangeText={setDayOfMonth} keyboardType="number-pad" selectTextOnFocus placeholderTextColor={colors.textSecondary} style={{ backgroundColor: colors.background, borderRadius: 12, padding: 14, fontSize: 15, color: colors.text, marginBottom: 16, borderWidth: 1, borderColor: colors.border }} />
                </>
              )}

              {/* Note */}
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>โน้ต</Text>
              <TextInput value={note} onChangeText={setNote} placeholder="เช่น ค่าเช่า, Netflix" placeholderTextColor={colors.textSecondary} style={{ backgroundColor: colors.background, borderRadius: 12, padding: 14, fontSize: 15, color: colors.text, marginBottom: 16, borderWidth: 1, borderColor: colors.border }} />

              {/* Category */}
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>หมวดหมู่</Text>
              <CategoryGrid categories={filteredCategories} selectedId={selectedCategory?.id ?? null} onSelect={setSelectedCategory} />

              {/* Wallet */}
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginTop: 16, marginBottom: 8 }}>กระเป๋าเงิน</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 20 }}>
                {wallets.map((w) => (
                  <Pressable key={w.id} onPress={() => setSelectedWalletId(w.id)} style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: selectedWalletId === w.id ? colors.tint : colors.background, borderWidth: 1, borderColor: selectedWalletId === w.id ? colors.tint : colors.border, flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    <WalletAvatar
                      icon={w.icon}
                      size={24}
                      backgroundColor={selectedWalletId === w.id ? 'rgba(255,255,255,0.18)' : undefined}
                    />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: selectedWalletId === w.id ? '#FFF' : colors.text }}>{w.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* Save */}
              <Pressable onPress={handleSave} style={({ pressed }) => ({ backgroundColor: pressed ? '#1565C0' : colors.tint, paddingVertical: 16, borderRadius: 14, alignItems: 'center' })}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFF' }}>บันทึก</Text>
              </Pressable>
              <View style={{ height: 30 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
