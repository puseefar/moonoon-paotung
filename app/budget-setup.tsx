import { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { budgetService, PERSONAS } from '@/services/budgetService';
import type { AllocationRule, PersonaTemplate } from '@/services/budgetService';
import { categoryService } from '@/services/categoryService';
import type { Category } from '@/db/schema';
import { formatCurrency } from '@/lib/format';
import { useSnackbar } from '@/components/ui/SnackbarProvider';

interface BudgetItem {
  categoryId: string | null;
  categoryName: string;
  categoryIcon: string;
  allocatedAmount: number;  // ค่าที่ผู้ใช้กำหนด (committed) — เริ่มที่ 0 เสมอ
  suggestedAmount: number;  // ค่าแนะนำจาก persona — แสดงเป็น ghost text ไม่นับจนกว่าจะกด "ใช้ค่าแนะนำ"
}

const ALLOCATION_RULES: { id: AllocationRule; label: string; desc: string }[] = [
  { id: '50-30-20', label: '50/30/20', desc: 'ความจำเป็น 50% / ต้องการ 30% / ออม 20%' },
  { id: 'daily-allowance', label: 'งบรายวัน', desc: 'คำนวณวงเงินใช้ได้ต่อวัน' },
  { id: 'envelope', label: 'ซองเงิน', desc: 'แยกซองรายหมวดเข้มงวด' },
  { id: 'custom', label: 'กำหนดเอง', desc: 'ตั้งรายหมวดเองทั้งหมด' },
];

// Custom persona sentinel
const CUSTOM_PERSONA_ID = 'custom';

export default function BudgetSetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showSnackbar } = useSnackbar();
  const { yearMonth } = useLocalSearchParams<{ yearMonth: string }>();

  const [step, setStep] = useState<'persona' | 'income' | 'categories'>('persona');
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>(PERSONAS[0].id);
  const [customOccupation, setCustomOccupation] = useState('');
  const [allocationRule, setAllocationRule] = useState<AllocationRule>('custom');
  const [incomeText, setIncomeText] = useState('');
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(true);

  // validation error states
  const [personaError, setPersonaError] = useState('');
  const [incomeError, setIncomeError] = useState('');

  const scrollRef = useRef<ScrollView>(null);
  const customInputRef = useRef<TextInput>(null);

  function scrollToCustomInput() {
    // รอ keyboard animate เสร็จ (~300ms) แล้วค่อย scroll ลงไปหา input
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 320);
  }

  const ym = yearMonth ?? budgetService.toYearMonth(new Date().getFullYear(), new Date().getMonth());
  const { year, month } = budgetService.parseYearMonth(ym);
  const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

  useEffect(() => {
    async function loadData() {
      const [cats, existing] = await Promise.all([
        categoryService.getByType('expense'),
        budgetService.getBudget(ym),
      ]);
      setExpenseCategories(cats);

      if (existing) {
        setIncomeText(String(existing.totalPlannedIncome ?? ''));
        setAllocationRule((existing.allocationRule as AllocationRule) ?? 'custom');
        const budgetCats = await budgetService.getBudgetCategories(existing.id);
        const iconMap: Record<string, string> = {};
        for (const c of cats) iconMap[c.id] = c.icon;
        setItems(budgetCats.map((bc) => ({
          categoryId: bc.categoryId,
          categoryName: bc.categoryName,
          categoryIcon: bc.categoryId ? (iconMap[bc.categoryId] ?? '📦') : '📦',
          allocatedAmount: bc.allocatedAmount ?? 0,
          suggestedAmount: 0,
        })));
        setStep('categories');
      } else {
        setItems(cats.map((c) => ({
          categoryId: c.id,
          categoryName: c.name,
          categoryIcon: c.icon,
          allocatedAmount: 0,
          suggestedAmount: 0,
        })));
      }
      setLoadingExisting(false);
    }
    loadData();
  }, [ym]);

  const income = parseFloat(incomeText.replace(/,/g, '')) || 0;
  const isCustomPersona = selectedPersonaId === CUSTOM_PERSONA_ID;
  const selectedPersona = PERSONAS.find((p) => p.id === selectedPersonaId) ?? PERSONAS[4]; // fallback general

  // คำนวณ "ค่าแนะนำ" จาก persona แล้วเก็บไว้ใน suggestedAmount (ไม่แตะ allocatedAmount)
  // คีย์ template ตรงกับชื่อหมวดจริงแล้ว จึงจับคู่เข้าหมวดเดิม ไม่สร้างแถวซ้ำ
  function computeSuggestions(persona: PersonaTemplate) {
    if (income <= 0) {
      setItems((prev) => prev.map((item) => ({ ...item, suggestedAmount: 0 })));
      return;
    }
    const template = budgetService.generatePersonaTemplate(persona, income);
    setItems((prev) => prev.map((item) => {
      const match = template.find((t) => t.categoryName === item.categoryName)
        ?? template.find((t) => item.categoryName.includes(t.categoryName) || t.categoryName.includes(item.categoryName));
      return { ...item, suggestedAmount: match?.allocatedAmount ?? 0 };
    }));
  }

  // ผู้ใช้เลือกเอง: เติมค่าแนะนำลงทุกช่อง (เฉพาะหมวดที่มีค่าแนะนำ)
  function applySuggestions() {
    setItems((prev) => prev.map((item) =>
      item.suggestedAmount > 0 ? { ...item, allocatedAmount: item.suggestedAmount } : item
    ));
  }

  // ล้างค่าทั้งหมดกลับไปเริ่มจากศูนย์
  function clearAllAmounts() {
    setItems((prev) => prev.map((item) => ({ ...item, allocatedAmount: 0 })));
  }

  function updateItemAmount(idx: number, val: string) {
    const num = parseFloat(val.replace(/,/g, '')) || 0;
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, allocatedAmount: num } : item));
  }

  // ── Step 1 → 2 Validation ────────────────────────────────────────────────
  function handleNextFromPersona() {
    if (isCustomPersona && customOccupation.trim().length < 2) {
      setPersonaError('กรุณาระบุอาชีพ/กิจกรรมของคุณ (อย่างน้อย 2 ตัวอักษร)');
      return;
    }
    setPersonaError('');
    setStep('income');
  }

  // ── Step 2 → 3 Validation ────────────────────────────────────────────────
  function handleNextFromIncome() {
    if (income <= 0) {
      setIncomeError('กรุณาระบุจำนวนรายรับต่อเดือน');
      return;
    }
    if (income < 100) {
      setIncomeError('รายรับต้องมากกว่า 100 บาท');
      return;
    }
    setIncomeError('');
    // เตรียม "ค่าแนะนำ" ไว้ให้ (แสดงเป็น ghost text) แต่ไม่กรอกให้อัตโนมัติ
    // ผู้ใช้เป็นคนตัดสินใจเองว่าจะใช้ค่าแนะนำหรือกรอกเอง
    if (!isCustomPersona) {
      computeSuggestions(selectedPersona);
    }
    setStep('categories');
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    const validItems = items.filter((i) => i.allocatedAmount > 0);
    if (validItems.length === 0) {
      showSnackbar({ message: 'กรุณาตั้งงบอย่างน้อย 1 หมวด', variant: 'warning' });
      return;
    }
    setSaving(true);
    try {
      const budget = await budgetService.createBudget(ym, income, allocationRule);
      await budgetService.updateBudget(budget.id, { totalPlannedIncome: income, allocationRule });
      await budgetService.saveBudgetCategories(budget.id, validItems);
      showSnackbar({
        title: 'บันทึกงบแล้ว',
        message: `ตั้งงบ ${THAI_MONTHS[month]} ${year + 543} เรียบร้อย`,
        variant: 'success',
      });
      router.back();
    } catch (e: any) {
      showSnackbar({ message: e.message || 'บันทึกไม่สำเร็จ', variant: 'error' });
    } finally {
      setSaving(false);
    }
  }

  const totalAllocated = items.reduce((s, i) => s + i.allocatedAmount, 0);
  const totalSuggested = items.reduce((s, i) => s + i.suggestedAmount, 0);
  const hasSuggestions = totalSuggested > 0;
  // ค่าแนะนำถูกเติมครบแล้วหรือยัง (เทียบเฉพาะหมวดที่มีค่าแนะนำ)
  const suggestionsApplied = hasSuggestions &&
    items.every((i) => i.suggestedAmount === 0 || i.allocatedAmount === i.suggestedAmount);

  if (loadingExisting) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F6FA' }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  const stepTitles = { persona: 'เลือกแบบ', income: 'รายรับ & กฎ', categories: 'ตั้งงบรายหมวด' };
  const steps = ['persona', 'income', 'categories'] as const;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Gradient Header */}
      <LinearGradient
        colors={['#7C3AED', '#9D4FBF', '#B06CD0']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 8, paddingBottom: 20, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable
            onPress={() => {
              if (step === 'persona') router.back();
              else if (step === 'income') setStep('persona');
              else setStep('income');
            }}
            style={{ padding: 6, marginRight: 8 }}>
            <Text style={{ fontSize: 20, color: '#fff' }}>←</Text>
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff', flex: 1 }}>
            {stepTitles[step]}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
            {THAI_MONTHS[month]} {year + 543}
          </Text>
        </View>

        {/* Step indicator */}
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 14 }}>
          {steps.map((s, i) => (
            <View key={s} style={{
              flex: 1, height: 4, borderRadius: 2,
              backgroundColor:
                step === s ? '#fff'
                  : steps.indexOf(step) > i ? 'rgba(255,255,255,0.6)'
                    : 'rgba(255,255,255,0.25)',
            }} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', marginTop: 6 }}>
          {steps.map((s, i) => (
            <Text key={s} style={{ flex: 1, textAlign: 'center', fontSize: 10, color: step === s ? '#fff' : 'rgba(255,255,255,0.5)' }}>
              {i + 1}. {stepTitles[s]}
            </Text>
          ))}
        </View>
      </LinearGradient>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 180 }}>

        {/* ════════════════════════════════════════════════════
            STEP 1: Persona
        ════════════════════════════════════════════════════ */}
        {step === 'persona' && (
          <>
            <View>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#333' }}>
                เลือกแบบการใช้เงินของคุณ
                <Text style={{ color: '#E53935' }}> *</Text>
              </Text>
              <Text style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
                ระบบจะแนะนำสัดส่วนงบเริ่มต้น (แก้ไขได้ภายหลัง)
              </Text>
            </View>

            {/* Built-in personas */}
            {PERSONAS.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => { setSelectedPersonaId(p.id); setPersonaError(''); }}
                style={{
                  backgroundColor: selectedPersonaId === p.id ? '#F3E8FF' : '#fff',
                  borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center',
                  borderWidth: 2,
                  borderColor: selectedPersonaId === p.id ? '#7C3AED' : '#E8E8E8',
                  elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4,
                }}>
                <Text style={{ fontSize: 30, marginRight: 14 }}>{p.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: selectedPersonaId === p.id ? '#7C3AED' : '#333' }}>
                    {p.name}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{p.description}</Text>
                </View>
                {selectedPersonaId === p.id && <Text style={{ fontSize: 18, color: '#7C3AED' }}>✓</Text>}
              </Pressable>
            ))}

            {/* Custom persona option */}
            <Pressable
              onPress={() => {
                setSelectedPersonaId(CUSTOM_PERSONA_ID);
                setPersonaError('');
                // focus input และ scroll ไปหาหลัง animation เสร็จ
                setTimeout(() => {
                  customInputRef.current?.focus();
                }, 100);
              }}
              style={{
                backgroundColor: isCustomPersona ? '#FFF3E0' : '#fff',
                borderRadius: 14, padding: 16,
                borderWidth: 2,
                borderColor: isCustomPersona ? '#FF8F00' : '#E8E8E8',
                elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4,
              }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 30, marginRight: 14 }}>✏️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: isCustomPersona ? '#E65100' : '#333' }}>
                    อาชีพ/กิจกรรมอื่นๆ
                  </Text>
                  <Text style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                    ระบุเองเช่น สาวโรงงาน, วิศวกร, Creator, คนขับรถ ฯลฯ
                  </Text>
                </View>
                {isCustomPersona && <Text style={{ fontSize: 18, color: '#E65100' }}>✓</Text>}
              </View>

              {/* Input แสดงเมื่อเลือก Custom */}
              {isCustomPersona && (
                <View style={{ marginTop: 12 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#E65100', marginBottom: 6 }}>
                    ระบุอาชีพ/กิจกรรมของคุณ <Text style={{ color: '#E53935' }}>*</Text>
                  </Text>
                  <TextInput
                    ref={customInputRef}
                    value={customOccupation}
                    onChangeText={(v) => { setCustomOccupation(v); setPersonaError(''); }}
                    onFocus={scrollToCustomInput}
                    placeholder="เช่น สาวโรงงาน, วิศวกร, Creator..."
                    placeholderTextColor="#FFAB40"
                    returnKeyType="done"
                    blurOnSubmit
                    style={{
                      backgroundColor: '#FFF8E1',
                      borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
                      fontSize: 15, fontWeight: '600', color: '#333',
                      borderWidth: 1.5,
                      borderColor: personaError ? '#E53935' : '#FFB300',
                    }}
                  />
                </View>
              )}
            </Pressable>

            {/* Error */}
            {personaError !== '' && (
              <View style={{ backgroundColor: '#FFEBEE', borderRadius: 10, padding: 12 }}>
                <Text style={{ fontSize: 13, color: '#C62828', fontWeight: '600' }}>⚠️ {personaError}</Text>
              </View>
            )}

            <Pressable
              onPress={handleNextFromPersona}
              style={{ backgroundColor: '#7C3AED', borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 4 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>ถัดไป →</Text>
            </Pressable>
          </>
        )}

        {/* ════════════════════════════════════════════════════
            STEP 2: Income + Allocation Rule
        ════════════════════════════════════════════════════ */}
        {step === 'income' && (
          <>
            {/* Show selected persona */}
            <View style={{ backgroundColor: '#F3E8FF', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ fontSize: 22 }}>
                {isCustomPersona ? '✏️' : (PERSONAS.find((p) => p.id === selectedPersonaId)?.icon ?? '😊')}
              </Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#7C3AED' }}>
                {isCustomPersona ? customOccupation : (PERSONAS.find((p) => p.id === selectedPersonaId)?.name ?? '')}
              </Text>
            </View>

            {/* Income Input */}
            <View style={{
              backgroundColor: '#fff', borderRadius: 16, padding: 16,
              elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#333' }}>
                  รายรับที่วางแผนต่อเดือน (บาท)
                </Text>
                <Text style={{ color: '#E53935', fontSize: 16, marginLeft: 4, fontWeight: '800' }}>*</Text>
              </View>

              <TextInput
                value={incomeText}
                onChangeText={(v) => { setIncomeText(v); setIncomeError(''); }}
                keyboardType="numeric"
                selectTextOnFocus
                placeholder="ระบุจำนวนรายรับ เช่น 25000"
                placeholderTextColor="#FF8F00"
                style={{
                  fontSize: 26, fontWeight: '800', color: '#333',
                  borderBottomWidth: 2,
                  borderBottomColor: incomeError ? '#E53935' : income > 0 ? '#7C3AED' : '#DDD',
                  paddingBottom: 8, paddingTop: 4,
                }}
              />

              {income > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 }}>
                  <Text style={{ fontSize: 13, color: '#7C3AED', fontWeight: '700' }}>
                    = {formatCurrency(income)} บาท/เดือน
                  </Text>
                  {allocationRule === 'daily-allowance' && (
                    <Text style={{ fontSize: 12, color: '#888' }}>
                      (≈ {formatCurrency(income / 30)} / วัน)
                    </Text>
                  )}
                </View>
              )}

              {/* Error */}
              {incomeError !== '' && (
                <View style={{ backgroundColor: '#FFEBEE', borderRadius: 10, padding: 10, marginTop: 10 }}>
                  <Text style={{ fontSize: 13, color: '#C62828', fontWeight: '600' }}>⚠️ {incomeError}</Text>
                </View>
              )}
            </View>

            {/* Allocation Rule */}
            <View style={{
              backgroundColor: '#fff', borderRadius: 16, padding: 16,
              elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8,
            }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 12 }}>
                กฎจัดสรรงบ
              </Text>
              {ALLOCATION_RULES.map((rule) => (
                <Pressable
                  key={rule.id}
                  onPress={() => setAllocationRule(rule.id)}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' }}>
                  <View style={{
                    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
                    borderColor: allocationRule === rule.id ? '#7C3AED' : '#CCC',
                    backgroundColor: allocationRule === rule.id ? '#7C3AED' : 'transparent',
                    marginRight: 12, justifyContent: 'center', alignItems: 'center',
                  }}>
                    {allocationRule === rule.id && <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: '#fff' }} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: allocationRule === rule.id ? '#7C3AED' : '#333' }}>
                      {rule.label}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#888' }}>{rule.desc}</Text>
                  </View>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={handleNextFromIncome}
              style={{ backgroundColor: '#7C3AED', borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>ถัดไป → ตั้งงบรายหมวด</Text>
            </Pressable>
          </>
        )}

        {/* ════════════════════════════════════════════════════
            STEP 3: Category Budgets
        ════════════════════════════════════════════════════ */}
        {step === 'categories' && (
          <>
            {/* Income + allocated summary */}
            <View style={{ backgroundColor: '#F3E8FF', borderRadius: 14, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={{ fontSize: 11, color: '#7C3AED', fontWeight: '600' }}>รายรับที่วางแผน</Text>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#7C3AED' }}>{formatCurrency(income)}</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 11, color: '#888', fontWeight: '600' }}>คงเหลือไม่ได้ตั้งงบ</Text>
                <Text style={{ fontSize: 16, fontWeight: '800', color: totalAllocated > income ? '#E53935' : '#2E7D32' }}>
                  {formatCurrency(income - totalAllocated)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 11, color: totalAllocated > income ? '#E53935' : '#555', fontWeight: '600' }}>ตั้งงบรวม</Text>
                <Text style={{ fontSize: 18, fontWeight: '800', color: totalAllocated > income ? '#E53935' : '#333' }}>
                  {formatCurrency(totalAllocated)}
                </Text>
              </View>
            </View>

            {totalAllocated > income && (
              <View style={{ backgroundColor: '#FFEBEE', borderRadius: 12, padding: 12, borderLeftWidth: 4, borderLeftColor: '#E53935' }}>
                <Text style={{ fontSize: 13, color: '#C62828', fontWeight: '700' }}>
                  ⚠️ งบตั้งเกินรายรับ {formatCurrency(totalAllocated - income)}
                </Text>
                <Text style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                  แนะนำให้ปรับลดงบบางหมวดเพื่อไม่ให้แผนขาดดุล
                </Text>
              </View>
            )}

            {/* แถบค่าแนะนำ — ผู้ใช้เลือกเองว่าจะเริ่มจากค่าแนะนำหรือกรอกเอง */}
            {hasSuggestions && (
              <View style={{ backgroundColor: '#F3E8FF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#D9C2F0' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ fontSize: 14, marginRight: 6 }}>💡</Text>
                  <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: '#7C3AED' }}>
                    ค่าแนะนำตามแบบ "{PERSONAS.find((p) => p.id === selectedPersonaId)?.name ?? ''}"
                  </Text>
                </View>
                <Text style={{ fontSize: 12, color: '#7A5BA0', lineHeight: 18, marginBottom: 12 }}>
                  ช่องด้านล่างเว้นว่างไว้ให้คุณกำหนดเอง — ตัวเลขจางๆ คือค่าที่เราแนะนำ (รวม {formatCurrency(totalSuggested)})
                  จะแตะปุ่มเติมให้ครบ หรือพิมพ์เองทีละหมวดก็ได้
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    onPress={applySuggestions}
                    disabled={suggestionsApplied}
                    style={{
                      flex: 1, backgroundColor: suggestionsApplied ? '#E0D4F0' : '#7C3AED',
                      borderRadius: 12, paddingVertical: 11, alignItems: 'center',
                    }}>
                    <Text style={{ color: suggestionsApplied ? '#9B86B8' : '#fff', fontWeight: '700', fontSize: 13 }}>
                      {suggestionsApplied ? '✓ ใช้ค่าแนะนำแล้ว' : '📥 ใช้ค่าแนะนำทั้งหมด'}
                    </Text>
                  </Pressable>
                  {totalAllocated > 0 && (
                    <Pressable
                      onPress={clearAllAmounts}
                      style={{ backgroundColor: '#fff', borderRadius: 12, paddingVertical: 11, paddingHorizontal: 16, alignItems: 'center', borderWidth: 1, borderColor: '#D9C2F0' }}>
                      <Text style={{ color: '#7C3AED', fontWeight: '700', fontSize: 13 }}>🔄 ล้างค่า</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            )}

            <View style={{
              backgroundColor: '#fff', borderRadius: 16, padding: 16,
              elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#333', flex: 1 }}>
                  งบรายหมวด
                </Text>
                <Text style={{ fontSize: 11, color: '#888' }}>0 = ไม่จำกัด</Text>
              </View>
              {items.map((item, idx) => (
                <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' }}>
                  <Text style={{ fontSize: 20, marginRight: 10 }}>{item.categoryIcon}</Text>
                  <Text style={{ flex: 1, fontSize: 14, color: '#333' }}>{item.categoryName}</Text>
                  <TextInput
                    value={item.allocatedAmount > 0 ? String(item.allocatedAmount) : ''}
                    onChangeText={(v) => updateItemAmount(idx, v)}
                    keyboardType="numeric"
                    selectTextOnFocus
                    placeholder={item.suggestedAmount > 0 ? `แนะนำ ${formatCurrency(item.suggestedAmount)}` : '0'}
                    placeholderTextColor={item.suggestedAmount > 0 ? '#B79AD4' : '#CCC'}
                    style={{
                      width: 120, textAlign: 'right', fontSize: 15, fontWeight: '700',
                      color: '#333', borderBottomWidth: 1.5,
                      borderBottomColor: item.allocatedAmount > 0 ? '#7C3AED' : '#DDD',
                      paddingBottom: 4,
                    }}
                  />
                </View>
              ))}
            </View>

            {/* Hint */}
            <View style={{ backgroundColor: '#E3F2FD', borderRadius: 12, padding: 12 }}>
              <Text style={{ fontSize: 12, color: '#1565C0' }}>
                💡 ตั้งงบอย่างน้อย 1 หมวดก่อนบันทึก · หมวดที่ไม่ตั้งงบจะไม่แสดงใน overview
              </Text>
            </View>

            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={{
                backgroundColor: saving ? '#B0B0B0' : '#7C3AED',
                borderRadius: 16, paddingVertical: 16, alignItems: 'center',
              }}>
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>💾 บันทึกงบประมาณ</Text>}
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
