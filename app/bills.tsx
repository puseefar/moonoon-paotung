import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  ActivityIndicator, Modal, Platform, KeyboardAvoidingView, Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { billService } from '@/services/billService';
import type { BillWithMeta, MonthlyBillSummary } from '@/services/billService';
import { categoryService } from '@/services/categoryService';
import { useWalletStore } from '@/stores/useWalletStore';
import { CategoryGrid } from '@/components/category/CategoryGrid';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Category } from '@/db/schema';
import { useSnackbar } from '@/components/ui/SnackbarProvider';

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

const STATUS_META = {
  pending:  { label: 'ค้างจ่าย',   color: '#FF8F00', bg: '#FFF8E1', border: '#FFB300' },
  overdue:  { label: 'เลยกำหนด',   color: '#C62828', bg: '#FFEBEE', border: '#EF5350' },
  paid:     { label: 'จ่ายแล้ว',   color: '#2E7D32', bg: '#E8F5E9', border: '#66BB6A' },
};

// ── Bill Card ────────────────────────────────────────────────
function BillCard({ bill, onPayPress, onDelete }: {
  bill: BillWithMeta;
  onPayPress: () => void;
  onDelete: () => void;
}) {
  const meta = STATUS_META[bill.status];
  const daysText = bill.status === 'paid'
    ? `จ่ายแล้ว ${bill.paidAt ? formatDate(bill.paidAt) : ''}`
    : bill.daysUntilDue < 0
      ? `เลยกำหนดมา ${Math.abs(bill.daysUntilDue)} วัน`
      : bill.daysUntilDue === 0
        ? '⚡ ครบกำหนดวันนี้'
        : `ครบกำหนดใน ${bill.daysUntilDue} วัน`;

  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 16, marginBottom: 10, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6 }}>
      {/* Urgent indicator bar */}
      {bill.isUrgent && bill.status === 'pending' && (
        <View style={{ height: 4, backgroundColor: '#FF8F00' }} />
      )}
      {bill.status === 'overdue' && (
        <View style={{ height: 4, backgroundColor: '#E53935' }} />
      )}
      <View style={{ padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#333' }}>{bill.name}</Text>
              <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: meta.bg, borderWidth: 1, borderColor: meta.border }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: meta.color }}>{meta.label}</Text>
              </View>
              {bill.isUrgent && bill.status === 'pending' && (
                <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: '#FF8F00' }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff' }}>ด่วน!</Text>
                </View>
              )}
            </View>
            <Text style={{ fontSize: 22, fontWeight: '900', color: meta.color, marginTop: 4 }}>
              {formatCurrency(bill.amount)} บาท
            </Text>
            <Text style={{ fontSize: 12, color: '#888', marginTop: 3 }}>
              🗓️ {daysText}
            </Text>
            {bill.categoryIcon && (
              <Text style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                {bill.categoryIcon} {bill.categoryName}
              </Text>
            )}
            {bill.note ? (
              <Text style={{ fontSize: 12, color: '#AAA', marginTop: 2 }} numberOfLines={1}>📝 {bill.note}</Text>
            ) : null}
          </View>
        </View>

        {/* Actions */}
        {bill.status !== 'paid' && (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Pressable
              onPress={onPayPress}
              style={{ flex: 1, borderRadius: 12, overflow: 'hidden' }}>
              <LinearGradient
                colors={['#00695C', '#00897B']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={{ paddingVertical: 11, alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>✅ จ่ายแล้ว</Text>
              </LinearGradient>
            </Pressable>
            <Pressable
              onPress={onDelete}
              style={{ paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: '#FFCDD2', justifyContent: 'center' }}>
              <Text style={{ fontSize: 14, color: '#EF5350' }}>🗑️</Text>
            </Pressable>
          </View>
        )}
        {bill.status === 'paid' && (
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
            <Pressable onPress={onDelete} style={{ padding: 6 }}>
              <Text style={{ fontSize: 12, color: '#CCC' }}>ลบ</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────
export default function BillsScreen() {
  const insets = useSafeAreaInsets();
  const { showSnackbar } = useSnackbar();
  const { wallets, loadWallets } = useWalletStore();

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());

  const [bills, setBills] = useState<BillWithMeta[]>([]);
  const [summary, setSummary] = useState<MonthlyBillSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalUnpaidCount, setTotalUnpaidCount] = useState(0);

  // Create Bill Modal
  const [showModal, setShowModal] = useState(false);
  const [billName, setBillName] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billDueDate, setBillDueDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [billNote, setBillNote] = useState('');
  const [billCategory, setBillCategory] = useState<Category | null>(null);
  const [billWalletId, setBillWalletId] = useState<string | null>(null);
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);

  // Validation errors
  const [billNameError, setBillNameError] = useState('');
  const [billAmountError, setBillAmountError] = useState('');

  // Quick Add parser (voice-compatible)
  const [quickAddText, setQuickAddText] = useState('');

  function parseBillText(text: string): { name: string; amount: number | null } {
    const amountRegex = /(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\s*(?:บาท|฿)?/gi;
    const matches = [...text.matchAll(amountRegex)];
    if (matches.length === 0) return { name: text.trim(), amount: null };
    const best = matches[matches.length - 1];
    const amount = parseFloat(best[1].replace(/,/g, ''));
    const name = (text.slice(0, best.index) + text.slice((best.index ?? 0) + best[0].length))
      .replace(/\s+/g, ' ').trim();
    return { name: name || text.trim(), amount: isNaN(amount) ? null : amount };
  }

  function handleQuickAddChange(text: string) {
    setQuickAddText(text);
    if (!text.trim()) return;
    const parsed = parseBillText(text);
    if (parsed.name) { setBillName(parsed.name); setBillNameError(''); }
    if (parsed.amount && parsed.amount > 0) { setBillAmount(String(parsed.amount)); setBillAmountError(''); }
  }

  function openModal() {
    // ตั้ง due date เป็นวันสุดท้ายของเดือนที่กำลังดูอยู่
    // ถ้าเดือนนั้นผ่านมาแล้ว ให้ใช้สิ้นเดือนหน้า
    const lastDayOfViewedMonth = new Date(selectedYear, selectedMonth + 1, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const defaultDue = lastDayOfViewedMonth >= today
      ? lastDayOfViewedMonth
      : new Date(today.getFullYear(), today.getMonth() + 1, 0);
    setBillDueDate(defaultDue);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setBillName(''); setBillAmount(''); setBillNote('');
    setBillCategory(null); setQuickAddText('');
    setBillNameError(''); setBillAmountError('');
  }

  // Pay Modal
  const [payBill, setPayBill] = useState<BillWithMeta | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payWalletId, setPayWalletId] = useState<string | null>(null);
  const [createTx, setCreateTx] = useState(true);
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    const [monthBills, monthSummary, cats, allUnpaid] = await Promise.all([
      billService.getByMonth(selectedYear, selectedMonth),
      billService.getMonthlySummary(selectedYear, selectedMonth),
      categoryService.getByType('expense'),
      billService.getAllUnpaid(),
      loadWallets(),
    ]);

    setTotalUnpaidCount(allUnpaid.length);
    setExpenseCategories(cats);

    // ถ้าเดือนปัจจุบันไม่มีบิล แต่มีบิลค้างจ่ายในเดือนอื่น → ข้ามไปยังเดือนที่มีบิลค้างเร็วที่สุด
    if (monthBills.length === 0 && allUnpaid.length > 0) {
      const earliest = [...allUnpaid].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];
      const newYear = earliest.dueDate.getFullYear();
      const newMonth = earliest.dueDate.getMonth();
      if (newYear !== selectedYear || newMonth !== selectedMonth) {
        setSelectedYear(newYear);
        setSelectedMonth(newMonth);
        // คง loading=true ไว้ รอ load() รอบถัดไปทำงานเสร็จ
        return;
      }
    }

    setBills(monthBills.sort((a, b) => {
      const order = { overdue: 0, pending: 1, paid: 2 };
      return order[a.status] - order[b.status] || a.daysUntilDue - b.daysUntilDue;
    }));
    setSummary(monthSummary);
    if (wallets.length > 0 && !billWalletId) setBillWalletId(wallets[0].id);
    if (wallets.length > 0 && !payWalletId) setPayWalletId(wallets[0].id);
    setLoading(false);
  }, [selectedYear, selectedMonth]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  // Re-load เมื่อเปลี่ยนเดือน (รองรับกรณีที่ useFocusEffect ไม่ fire ขณะ screen focused อยู่แล้ว)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    setLoading(true);
    load();
  }, [selectedYear, selectedMonth]);

  function changeMonth(delta: number) {
    let m = selectedMonth + delta;
    let y = selectedYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setSelectedMonth(m);
    setSelectedYear(y);
  }

  async function handleSaveBill() {
    // Inline validation
    let hasError = false;
    if (!billName.trim()) { setBillNameError('กรุณาระบุชื่อบิล'); hasError = true; }
    else setBillNameError('');
    const amount = parseFloat(billAmount.replace(/,/g, ''));
    if (!billAmount.trim()) { setBillAmountError('กรุณาระบุยอดเงิน'); hasError = true; }
    else if (isNaN(amount) || amount <= 0) { setBillAmountError('ยอดเงินต้องมากกว่า 0'); hasError = true; }
    else setBillAmountError('');
    if (hasError) return;

    setSaving(true);
    try {
      await billService.create({
        name: billName.trim(),
        amount,
        dueDate: billDueDate,
        status: 'pending',
        categoryId: billCategory?.id ?? null,
        walletId: billWalletId,
        note: billNote.trim() || null,
        paidAt: null, paidAmount: null, paidTransactionId: null, recurringRuleId: null,
      });
      showSnackbar({ title: 'เพิ่มบิลแล้ว', message: billName.trim(), variant: 'success' });
      // Jump ไปเดือนของบิลที่เพิ่งบันทึก
      setSelectedYear(billDueDate.getFullYear());
      setSelectedMonth(billDueDate.getMonth());
      closeModal();
      load();
    } finally {
      setSaving(false);
    }
  }

  async function handlePay() {
    if (!payBill) return;
    const amount = parseFloat(payAmount.replace(/,/g, '')) || payBill.amount;
    setPaying(true);
    try {
      await billService.markAsPaid(payBill.id, {
        createTransaction: createTx,
        walletId: payWalletId ?? undefined,
        paidAmount: amount,
      });
      setPayBill(null); setPayAmount('');
      showSnackbar({ title: '✅ จ่ายบิลแล้ว', message: `${payBill.name} — ${formatCurrency(amount)} บาท${createTx ? ' (บันทึก transaction แล้ว)' : ''}`, variant: 'success', durationMs: 3500 });
      load();
    } finally {
      setPaying(false);
    }
  }

  function handleDelete(bill: BillWithMeta) {
    Alert.alert('ลบบิล', `ต้องการลบ "${bill.name}" หรือไม่?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'ลบ', style: 'destructive', onPress: async () => { await billService.delete(bill.id); load(); } },
    ]);
  }

  const overdueBills = bills.filter((b) => b.status === 'overdue');
  const pendingBills = bills.filter((b) => b.status === 'pending');
  const paidBills = bills.filter((b) => b.status === 'paid');

  return (
    <View style={{ flex: 1, backgroundColor: '#F0F7FF' }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Gradient Header */}
      <LinearGradient
        colors={['#006064', '#00838F', '#00ACC1']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 8, paddingBottom: 20, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#fff' }}>🗂️ ติดตามบิล</Text>
            {totalUnpaidCount > 0 && (
              <View style={{ backgroundColor: '#FF8F00', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#fff' }}>{totalUnpaidCount} ค้าง</Text>
              </View>
            )}
          </View>
          <Pressable
            onPress={() => openModal()}
            style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>+ เพิ่มบิล</Text>
          </Pressable>
        </View>

        {/* Month Selector */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <Pressable onPress={() => changeMonth(-1)} style={{ padding: 8 }}>
            <Text style={{ fontSize: 20, color: 'rgba(255,255,255,0.8)' }}>‹</Text>
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff' }}>
            {THAI_MONTHS[selectedMonth]} {selectedYear + 543}
          </Text>
          <Pressable onPress={() => changeMonth(1)} style={{ padding: 8 }}>
            <Text style={{ fontSize: 20, color: 'rgba(255,255,255,0.8)' }}>›</Text>
          </Pressable>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#00838F" />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>

          {/* Summary + "ขาด/พอ" */}
          {summary && (
            <View style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                <View style={{ flex: 1, backgroundColor: '#FFF8E1', borderRadius: 14, padding: 12, alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>ค้างจ่าย ({summary.countPending})</Text>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#E65100' }}>{formatCurrency(summary.totalPending)}</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: '#FFEBEE', borderRadius: 14, padding: 12, alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>เลยกำหนด ({summary.countOverdue})</Text>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#C62828' }}>{formatCurrency(summary.totalOverdue)}</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: '#E8F5E9', borderRadius: 14, padding: 12, alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>จ่ายแล้ว ({summary.countPaid})</Text>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#2E7D32' }}>{formatCurrency(summary.totalPaid)}</Text>
                </View>
              </View>

              {/* ขาด/พอ card */}
              <View style={{
                borderRadius: 14, padding: 14,
                backgroundColor: summary.isSufficient ? '#E8F5E9' : '#FFEBEE',
                borderWidth: 1.5,
                borderColor: summary.isSufficient ? '#66BB6A' : '#EF5350',
                flexDirection: 'row', alignItems: 'center', gap: 12,
              }}>
                <Text style={{ fontSize: 28 }}>{summary.isSufficient ? '✅' : '⚠️'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: summary.isSufficient ? '#2E7D32' : '#C62828' }}>
                    {summary.isSufficient ? 'เงินพอสำหรับบิลทั้งหมด' : `เงินไม่พอ ขาดอีก ${formatCurrency(summary.shortfall)} บาท`}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                    ยอดรวมในกระเป๋า {formatCurrency(summary.walletBalance)} บาท
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* No bills */}
          {bills.length === 0 && (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Text style={{ fontSize: 52, marginBottom: 12 }}>🗂️</Text>
              <Text style={{ fontSize: 17, fontWeight: '800', color: '#333', marginBottom: 8 }}>ไม่มีบิลในเดือนนี้</Text>
              {totalUnpaidCount > 0 ? (
                <>
                  <View style={{ backgroundColor: '#FFF8E1', borderRadius: 14, borderWidth: 1.5, borderColor: '#FFB300', paddingHorizontal: 20, paddingVertical: 12, marginBottom: 20, alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, color: '#E65100', fontWeight: '700', textAlign: 'center' }}>
                      ⚠️ คุณมีบิลค้างจ่ายในเดือนอื่น {totalUnpaidCount} รายการ
                    </Text>
                    <Text style={{ fontSize: 12, color: '#888', marginTop: 4, textAlign: 'center' }}>กดลูกศร ‹ › เพื่อย้อนกลับไปดูบิลที่ค้างอยู่</Text>
                  </View>
                </>
              ) : (
                <Text style={{ fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 22, marginBottom: 24 }}>
                  เพิ่มบิลเพื่อติดตาม{'\n'}ค่าน้ำ ค่าไฟ บัตรเครดิต ค่างวดรถ ฯลฯ
                </Text>
              )}
              <Pressable onPress={() => openModal()} style={{ backgroundColor: '#00838F', borderRadius: 16, paddingHorizontal: 24, paddingVertical: 14 }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>+ เพิ่มบิล</Text>
              </Pressable>
            </View>
          )}

          {/* Overdue */}
          {overdueBills.length > 0 && (
            <>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#C62828', marginBottom: 8 }}>⚠️ เลยกำหนด ({overdueBills.length})</Text>
              {overdueBills.map((b) => <BillCard key={b.id} bill={b} onPayPress={() => { setPayBill(b); setPayAmount(String(b.amount)); }} onDelete={() => handleDelete(b)} />)}
            </>
          )}

          {/* Pending */}
          {pendingBills.length > 0 && (
            <>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#E65100', marginBottom: 8, marginTop: overdueBills.length > 0 ? 8 : 0 }}>
                📅 ค้างจ่าย ({pendingBills.length})
              </Text>
              {pendingBills.map((b) => <BillCard key={b.id} bill={b} onPayPress={() => { setPayBill(b); setPayAmount(String(b.amount)); }} onDelete={() => handleDelete(b)} />)}
            </>
          )}

          {/* Paid */}
          {paidBills.length > 0 && (
            <>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#2E7D32', marginBottom: 8, marginTop: 8 }}>✅ จ่ายแล้ว ({paidBills.length})</Text>
              {paidBills.map((b) => <BillCard key={b.id} bill={b} onPayPress={() => {}} onDelete={() => handleDelete(b)} />)}
            </>
          )}
        </ScrollView>
      )}

      {/* ── Add Bill Modal ── */}
      <Modal visible={showModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' }} />
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#333' }}>🗂️ เพิ่มบิล</Text>
                <Pressable onPress={closeModal}><Text style={{ fontSize: 22, color: '#BBB' }}>✕</Text></Pressable>
              </View>

              {/* Quick Add — Voice compatible */}
              <View style={{ backgroundColor: '#E0F7FA', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ fontSize: 16 }}>🎙️</Text>
                <TextInput
                  value={quickAddText}
                  onChangeText={handleQuickAddChange}
                  placeholder='พิมพ์หรือพูดว่า "ค่าไฟ 1500" หรือ "Netflix 219 บาท"'
                  placeholderTextColor="#80DEEA"
                  returnKeyType="done"
                  style={{ flex: 1, fontSize: 14, color: '#00838F', fontWeight: '600' }}
                />
                {quickAddText ? (
                  <Pressable onPress={() => { setQuickAddText(''); }}>
                    <Text style={{ fontSize: 16, color: '#80DEEA' }}>✕</Text>
                  </Pressable>
                ) : null}
              </View>
              {quickAddText && (billName || billAmount) && (
                <View style={{ backgroundColor: '#E0F2F1', borderRadius: 10, padding: 10, marginBottom: 10, flexDirection: 'row', gap: 8 }}>
                  {billName ? <Text style={{ fontSize: 12, color: '#00695C', fontWeight: '700' }}>📋 {billName}</Text> : null}
                  {billAmount ? <Text style={{ fontSize: 12, color: '#00695C', fontWeight: '700' }}>💰 {billAmount} บาท</Text> : null}
                </View>
              )}

              {/* ชื่อบิล */}
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#888', marginBottom: 6 }}>ชื่อบิล <Text style={{ color: '#E53935' }}>*</Text></Text>
              <TextInput
                value={billName}
                onChangeText={(v) => { setBillName(v); if (billNameError) setBillNameError(''); }}
                placeholder="เช่น ค่าไฟ, Netflix, ค่างวดรถ"
                placeholderTextColor="#00ACC120"
                style={{ backgroundColor: '#F0FDFE', borderRadius: 12, padding: 14, fontSize: 15, color: '#333', marginBottom: billNameError ? 4 : 14, borderWidth: 1.5, borderColor: billNameError ? '#E53935' : '#B2EBF2' }}
              />
              {billNameError ? <Text style={{ fontSize: 12, color: '#E53935', marginBottom: 10, marginLeft: 4 }}>⚠️ {billNameError}</Text> : null}

              {/* ยอดเงิน */}
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#888', marginBottom: 6 }}>ยอดเงิน (บาท) <Text style={{ color: '#E53935' }}>*</Text></Text>
              <TextInput
                value={billAmount}
                onChangeText={(v) => { setBillAmount(v); if (billAmountError) setBillAmountError(''); }}
                placeholder="ระบุจำนวนเงิน เช่น 1500"
                keyboardType="decimal-pad"
                selectTextOnFocus
                placeholderTextColor="#00ACC120"
                style={{ backgroundColor: '#F0FDFE', borderRadius: 12, padding: 14, fontSize: 20, fontWeight: '800', color: '#333', marginBottom: billAmountError ? 4 : 14, borderWidth: 1.5, borderColor: billAmountError ? '#E53935' : '#B2EBF2' }}
              />
              {billAmountError ? <Text style={{ fontSize: 12, color: '#E53935', marginBottom: 10, marginLeft: 4 }}>⚠️ {billAmountError}</Text> : null}

              <Pressable onPress={() => setShowDatePicker(true)} style={{ backgroundColor: '#F0FDFE', borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#B2EBF2', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ fontSize: 16 }}>📅</Text>
                <View>
                  <Text style={{ fontSize: 12, color: '#888' }}>วันครบกำหนด</Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#006064' }}>{formatDate(billDueDate)}</Text>
                </View>
              </Pressable>
              {showDatePicker && (
                <DateTimePicker value={billDueDate} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(e: DateTimePickerEvent, d?: Date) => { setShowDatePicker(false); if (d) setBillDueDate(d); }} />
              )}

              <Text style={{ fontSize: 12, fontWeight: '700', color: '#888', marginBottom: 6 }}>โน้ต</Text>
              <TextInput value={billNote} onChangeText={setBillNote} placeholder="รายละเอียดเพิ่มเติม" placeholderTextColor="#CCC" style={{ backgroundColor: '#F5F5F5', borderRadius: 12, padding: 12, fontSize: 14, color: '#333', marginBottom: 14 }} />

              <Text style={{ fontSize: 12, fontWeight: '700', color: '#888', marginBottom: 8 }}>หมวดหมู่ (ไม่บังคับ)</Text>
              <CategoryGrid categories={expenseCategories} selectedId={billCategory?.id ?? null} onSelect={setBillCategory} />

              <Pressable onPress={handleSaveBill} disabled={saving} style={{ backgroundColor: saving ? '#B2EBF2' : '#00838F', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 16 }}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ fontSize: 15, fontWeight: '800', color: '#fff' }}>💾 บันทึกบิล</Text>}
              </Pressable>
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Pay Bill Modal ── */}
      <Modal visible={!!payBill} animationType="fade" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '88%' }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#333', marginBottom: 4 }}>✅ จ่ายบิล</Text>
              <Text style={{ fontSize: 14, color: '#888', marginBottom: 16 }}>🗂️ {payBill?.name}</Text>

              <Text style={{ fontSize: 12, fontWeight: '700', color: '#888', marginBottom: 6 }}>ยอดที่จ่าย (บาท)</Text>
              <TextInput value={payAmount} onChangeText={setPayAmount} keyboardType="decimal-pad" selectTextOnFocus placeholder={String(payBill?.amount ?? '0')} placeholderTextColor="#CCC" style={{ backgroundColor: '#F0FDFE', borderRadius: 12, padding: 14, fontSize: 22, fontWeight: '800', color: '#333', marginBottom: 14, borderWidth: 1, borderColor: '#B2EBF2', textAlign: 'center' }} autoFocus />

              {/* Create Transaction Toggle */}
              <Pressable onPress={() => setCreateTx(!createTx)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14, paddingVertical: 8 }}>
                <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: createTx ? '#00838F' : '#DDD', backgroundColor: createTx ? '#00838F' : '#fff', justifyContent: 'center', alignItems: 'center' }}>
                  {createTx && <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900' }}>✓</Text>}
                </View>
                <Text style={{ fontSize: 14, color: '#333', fontWeight: '600' }}>บันทึกเป็น Transaction อัตโนมัติ</Text>
              </Pressable>

              {/* Wallet selector (only if createTx) */}
              {createTx && wallets.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 14 }}>
                  {wallets.map((w) => (
                    <Pressable key={w.id} onPress={() => setPayWalletId(w.id)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: payWalletId === w.id ? '#00838F' : '#F5F5F5', borderWidth: 1, borderColor: payWalletId === w.id ? '#00838F' : '#E0E0E0' }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: payWalletId === w.id ? '#fff' : '#333' }}>{w.icon} {w.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable onPress={() => { setPayBill(null); setPayAmount(''); }} style={{ flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#DDD', alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#888' }}>ยกเลิก</Text>
                </Pressable>
                <Pressable onPress={handlePay} disabled={paying} style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: paying ? '#B2EBF2' : '#00838F', alignItems: 'center' }}>
                  {paying ? <ActivityIndicator color="#fff" /> : <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff' }}>ยืนยัน</Text>}
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
