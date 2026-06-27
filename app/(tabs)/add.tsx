import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  Platform,
  Keyboard,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Colors from '@/constants/Colors';
import { haptics } from '@/lib/haptics';
import { useSnackbar } from '@/components/ui/SnackbarProvider';
import { useColorScheme } from '@/components/useColorScheme';
import { WalletAvatar } from '@/components/wallet/WalletAvatar';
import { Numpad } from '@/components/transaction/Numpad';
import { TradeSetReviewCard } from '@/components/transaction/TradeSetReviewCard';
import { CategoryGrid } from '@/components/category/CategoryGrid';
import { useTransactionStore } from '@/stores/useTransactionStore';
import { useWalletStore } from '@/stores/useWalletStore';
import { useSummaryStore } from '@/stores/useSummaryStore';
import { categoryService } from '@/services/categoryService';
import { quickAddLearningService } from '@/services/quickAddLearningService';
import { quickAddDraftService } from '@/services/quickAddDraftService';
import {
  quickAddParser,
  type ClarifyOption,
  type QuickAddLearningRuleInput,
  type QuickAddResult,
  type QuickAddStarterProfile,
} from '@/services/quickAddParser';
import { starterTemplateService } from '@/services/starterTemplateService';
import {
  DEFAULT_VOICE_INPUT_CAPABILITIES,
  DEFAULT_VOICE_INPUT_STATUS_EVENT,
  voiceInputService,
  type VoiceInputCapabilities,
  type VoiceInputErrorEvent,
  type VoiceInputStatusEvent,
} from '@/services/voiceInputService';
import { formatCurrency, formatDate } from '@/lib/format';
import { generateId } from '@/lib/uuid';
import type { Category, Wallet } from '@/db/schema';
import type { TransactionType } from '@/types';

type TabType = 'expense' | 'income';
const VOICE_INPUT_LOCALE = 'th-TH';
const SHOW_IN_APP_VOICE_INPUT = false;

function buildVoiceBiasPhrases(profile: QuickAddStarterProfile | null, categories: Category[]) {
  const seen = new Set<string>();

  return [
    ...(profile?.helperTags ?? []),
    ...(profile?.sampleEntries ?? []),
    ...(profile?.preferredExpenseCategories ?? []),
    ...(profile?.preferredIncomeCategories ?? []),
    ...categories.map((category) => category.name),
  ]
    .map((value) => value.trim())
    .filter((value) => {
      if (value.length < 2) return false;
      const normalized = value.toLowerCase();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .slice(0, 24);
}

function getVoiceCapabilityMessage(capabilities: VoiceInputCapabilities) {
  if (Platform.OS !== 'android') {
    return 'Voice Input ในแอปจะเริ่มเปิดใช้กับ Android ก่อนใน Phase นี้';
  }

  if (!capabilities.isNativeModuleAvailable) {
    return 'ปุ่มไมค์ในแอปต้องทดสอบบน development build หรือแอปเวอร์ชันที่ build native module นี้แล้ว';
  }

  if (capabilities.supportsOfflineRecognition) {
    return 'พร้อมใช้ Voice Input แบบออฟไลน์ในเครื่อง Android';
  }

  if (capabilities.reason === 'language_model_not_downloaded') {
    return 'เครื่องนี้รองรับ Voice Input ออฟไลน์ แต่ยังไม่ได้ดาวน์โหลดภาษาไทยออฟไลน์ในเครื่อง';
  }

  if (capabilities.reason === 'language_model_pending') {
    return 'เครื่องนี้กำลังดาวน์โหลดภาษาไทยออฟไลน์อยู่ เปิดอินเทอร์เน็ตไว้ก่อนแล้วค่อยลองใหม่';
  }

  if (capabilities.reason === 'language_not_supported') {
    return 'บริการฟังเสียงในเครื่องนี้ยังไม่รองรับภาษาไทยออฟไลน์';
  }

  if (capabilities.isRecognitionAvailable) {
    return 'เครื่องนี้มี speech recognizer แต่ยังไม่มี on-device model สำหรับ fallback ออฟไลน์จริง';
  }

  return 'อุปกรณ์นี้ยังไม่มีบริการรู้จำเสียงที่ใช้กับแอปได้';
}

function getVoiceErrorMessage(error: VoiceInputErrorEvent) {
  switch (error.code) {
    case 'audio_permission_denied':
      return 'ยังไม่ได้รับสิทธิ์ใช้ไมโครโฟน';
    case 'on_device_unavailable':
      return 'เครื่องนี้ยังไม่มีระบบรู้จำเสียงออฟไลน์ในตัว';
    case 'language_model_not_downloaded':
      return 'ภาษาไทยออฟไลน์ยังไม่ได้ดาวน์โหลดในเครื่อง เปิดอินเทอร์เน็ตไว้ก่อนแล้วกดไมค์อีกครั้ง';
    case 'language_model_pending':
      return 'กำลังดาวน์โหลดภาษาไทยออฟไลน์อยู่ ลองใหม่อีกครั้งหลังดาวน์โหลดเสร็จ';
    case 'language_not_supported':
      return 'บริการฟังเสียงในเครื่องนี้ยังไม่รองรับภาษาไทยออฟไลน์';
    case 'no_match':
      return 'ได้ยินเสียงแล้ว แต่ยังแปลงเป็นข้อความไม่ชัดพอ';
    case 'speech_timeout':
      return 'ยังไม่ได้ยินคำพูดชัดเจนในช่วงเวลาที่กำหนด';
    default:
      return error.message;
  }
}

const AUTO_RETURN_SECONDS = 15;       // นับถอยหลัง 15 วิ
const IDLE_BEFORE_COUNTDOWN_MS = 20000; // รอ 20 วิ idle ก่อนเริ่ม countdown

export default function AddTransactionScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { showSnackbar } = useSnackbar();
  const router = useRouter();

  // ── Countdown กลับหน้าหลักอัตโนมัติ ──────────────────────────────────────
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRef = useRef(false); // true หลังบันทึกสำเร็จ

  function clearCountdown() {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdown(null);
  }

  function clearIdleTimer() {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }

  function startCountdown() {
    clearCountdown();
    setCountdown(AUTO_RETURN_SECONDS);
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);
  }

  // เรียกทุกครั้งที่ user แตะ / เลื่อนจอ
  function onUserInteraction() {
    if (!savedRef.current) return;
    // ถ้า countdown กำลังรัน → หยุด
    if (countdownIntervalRef.current) clearCountdown();
    // restart idle timer
    clearIdleTimer();
    idleTimerRef.current = setTimeout(() => {
      startCountdown();
    }, IDLE_BEFORE_COUNTDOWN_MS);
  }

  // เริ่ม idle detection หลังบันทึกสำเร็จ
  function startIdleDetection() {
    savedRef.current = true;
    clearCountdown();
    clearIdleTimer();
    idleTimerRef.current = setTimeout(() => {
      startCountdown();
    }, IDLE_BEFORE_COUNTDOWN_MS);
  }

  function cancelAutoReturn() {
    savedRef.current = false;
    clearCountdown();
    clearIdleTimer();
  }

  // navigate เมื่อ countdown ถึง 0
  useEffect(() => {
    if (countdown === 0) {
      clearCountdown();
      router.navigate('/(tabs)/');
    }
  }, [countdown]);

  const { addTransaction } = useTransactionStore();
  const { wallets, loadWallets, refreshTotalBalance } = useWalletStore();
  const { loadAll } = useSummaryStore();

  // Form state
  const [activeTab, setActiveTab] = useState<TabType>('expense');
  const [amount, setAmount] = useState('0');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [quickAddText, setQuickAddText] = useState('');
  const [quickAddPreview, setQuickAddPreview] = useState<QuickAddResult | null>(null);
  const [quickAddLearningRules, setQuickAddLearningRules] = useState<QuickAddLearningRuleInput[]>([]);
  const [activeQuickAddProfile, setActiveQuickAddProfile] = useState<QuickAddStarterProfile | null>(null);
  const [manualTypeOverride, setManualTypeOverride] = useState<TabType | null>(null);
  const [voiceInputCapabilities, setVoiceInputCapabilities] = useState<VoiceInputCapabilities>(
    DEFAULT_VOICE_INPUT_CAPABILITIES
  );
  const [voiceInputStatus, setVoiceInputStatus] = useState<VoiceInputStatusEvent>(
    DEFAULT_VOICE_INPUT_STATUS_EVENT
  );
  const [voiceInputError, setVoiceInputError] = useState<string | null>(null);
  const quickAddInputRef = useRef<TextInput>(null);
  const noteInputRef = useRef<TextInput>(null);
  const amountEditedManuallyRef = useRef(false);
  const currentAmountRef = useRef('0');
  const lastAutoFilledAmountRef = useRef<string | null>(null);
  // ── Draft persistence (มติทีม): กัน UX เสียตอน abstain/ถามกลับ แล้วถูกขัดจังหวะ ──
  const draftRestoredRef = useRef(false);   // ฟื้นร่างครั้งเดียวต่อการเข้าหน้า
  const draftHydratedRef = useRef(false);    // จริงหลังพยายามฟื้นแล้ว — กันเขียนทับร่างด้วย state ว่าง
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Categories
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<Category[]>([]);
  const [showTradeAlts, setShowTradeAlts] = useState(false); // escape hatch ของ trade-set card
  // Trade Set Review Mode — override ยอด/หมวดที่ผู้ใช้แก้บนการ์ด (รีเซ็ตเมื่อพิมพ์ข้อความใหม่)
  const [editedCost, setEditedCost] = useState<number | null>(null);
  const [editedRevenue, setEditedRevenue] = useState<number | null>(null);
  const [tradeBusinessCategory, setTradeBusinessCategory] = useState<Category | null>(null);
  const [quickAddInputHeight, setQuickAddInputHeight] = useState(0); // auto-grow ช่อง input
  const [showCategoryGrid, setShowCategoryGrid] = useState(false); // กางหมวดเต็มแผงเมื่อกดเลือกเอง

  const categories = activeTab === 'expense' ? expenseCategories : incomeCategories;
  const allCategories = [...expenseCategories, ...incomeCategories];

  const loadData = useCallback(async () => {
    const [expCats, incCats, learningRules, , quickAddProfile, capabilities] = await Promise.all([
      categoryService.getByType('expense'),
      categoryService.getByType('income'),
      quickAddLearningService.getAll(),
      loadWallets(),
      starterTemplateService.getActiveQuickAddProfile(),
      SHOW_IN_APP_VOICE_INPUT
        ? voiceInputService.getCapabilities(VOICE_INPUT_LOCALE)
        : Promise.resolve(DEFAULT_VOICE_INPUT_CAPABILITIES),
    ]);
    setExpenseCategories(expCats);
    setIncomeCategories(incCats);
    setQuickAddLearningRules(learningRules);
    setActiveQuickAddProfile(quickAddProfile);
    setVoiceInputCapabilities(capabilities);

    // ฟื้นฉบับร่างครั้งเดียวตอนเข้าหน้า — ตอน mount แรกฟอร์มยัง pristine เสมอ จึงฟื้นได้ปลอดภัย
    if (!draftRestoredRef.current) {
      draftRestoredRef.current = true;
      try {
        const draft = await quickAddDraftService.load();
        if (draft) {
          const list = draft.type === 'expense' ? expCats : incCats;
          const restoredCategory = draft.categoryId
            ? list.find((c) => c.id === draft.categoryId) ?? null
            : null;
          setActiveTab(draft.type);
          setManualTypeOverride(draft.type);
          setNote(draft.note);
          const restoredDate = new Date(draft.dateISO);
          if (!Number.isNaN(restoredDate.getTime())) setDate(restoredDate);
          if (restoredCategory) setSelectedCategory(restoredCategory);
          if (parseFloat(draft.amount) > 0) {
            setAmount(draft.amount);
            amountEditedManuallyRef.current = true; // กันยอดที่ฟื้นถูก auto-fill จากพรีวิวทับ
          }
          // ตั้งข้อความท้ายสุด → trigger parser effect ให้ derive พรีวิวใหม่ตามข้อความที่ฟื้น
          setQuickAddText(draft.quickAddText);
        }
      } catch {
        // ฟื้นร่างไม่สำเร็จไม่ใช่เรื่องคอขาดบาดตาย — ปล่อยฟอร์มว่างตามปกติ
      } finally {
        draftHydratedRef.current = true;
      }
    }
  }, [loadWallets]);

  // บันทึกฉบับร่างแบบ debounce ทุกครั้งที่ฟอร์มเปลี่ยน (service จะลบให้เองเมื่อฟอร์มว่าง)
  useEffect(() => {
    if (!draftHydratedRef.current || isSaving) return;
    if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    draftSaveTimerRef.current = setTimeout(() => {
      void quickAddDraftService.save({
        quickAddText,
        amount,
        type: activeTab,
        categoryId: selectedCategory?.id ?? null,
        note,
        dateISO: date.toISOString(),
      });
    }, 600);
    return () => {
      if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    };
  }, [quickAddText, amount, activeTab, selectedCategory, note, date, isSaving]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useFocusEffect(
    useCallback(() => {
      if (!SHOW_IN_APP_VOICE_INPUT) {
        return undefined;
      }

      return () => {
        void voiceInputService.cancelListening().catch(() => undefined);
      };
    }, [])
  );

  // clear countdown เมื่อออกจากหน้านี้
  useFocusEffect(
    useCallback(() => {
      return () => { clearCountdown(); clearIdleTimer(); savedRef.current = false; };
    }, [])
  );

  // (ทีม 3) กัน auto-return ตอนมีรายการค้าง/กำลัง review — จอที่รอยืนยันไม่ควรเด้งกลับเอง
  useEffect(() => {
    const hasPendingEntry =
      quickAddText.trim().length > 0 ||
      quickAddPreview !== null ||
      (parseFloat(amount) || 0) > 0;
    if (hasPendingEntry) {
      cancelAutoReturn();
    }
  }, [quickAddText, quickAddPreview, amount]);

  // reset escape hatch ของ trade-set เมื่อออกจากพรีวิวซื้อ-ขาย
  useEffect(() => {
    if (quickAddPreview?.clarify?.kind !== 'dual_entry') setShowTradeAlts(false);
  }, [quickAddPreview]);

  // ข้อความ source เปลี่ยน = parse ใหม่ → ล้าง override ยอด/หมวดที่แก้ไว้บนการ์ด
  useEffect(() => {
    setEditedCost(null);
    setEditedRevenue(null);
    setTradeBusinessCategory(null);
  }, [quickAddText]);

  useEffect(() => {
    if (!SHOW_IN_APP_VOICE_INPUT) {
      return undefined;
    }

    const removeStatusListener = voiceInputService.addStatusListener((event) => {
      setVoiceInputStatus(event);
      if (event.status !== 'error') {
        setVoiceInputError(null);
      }
    });
    const removeResultListener = voiceInputService.addResultListener((event) => {
      setVoiceInputError(null);
      setManualTypeOverride(null);
      setQuickAddText(event.text);
    });
    const removeErrorListener = voiceInputService.addErrorListener((event) => {
      const message = getVoiceErrorMessage(event);
      setVoiceInputError(message);
      setVoiceInputStatus((prev) => ({
        ...prev,
        status: 'error',
        message,
      }));
      showSnackbar({
        title: 'Voice Input มีสะดุด',
        message,
        variant: event.recoverable ? 'warning' : 'error',
        durationMs: 2800,
      });
    });

    return () => {
      removeStatusListener();
      removeResultListener();
      removeErrorListener();
      void voiceInputService.cancelListening().catch(() => undefined);
    };
  }, [showSnackbar]);

  // เลือก wallet แรกเป็นค่าเริ่มต้น
  useEffect(() => {
    if (wallets.length > 0 && !selectedWallet) {
      setSelectedWallet(wallets[0]);
    }
  }, [wallets]);

  useEffect(() => {
    currentAmountRef.current = amount;
  }, [amount]);

  const dismissInlineKeyboard = useCallback(() => {
    quickAddInputRef.current?.blur();
    noteInputRef.current?.blur();
    Keyboard.dismiss();
  }, []);

  const tryAutoFillParsedAmount = useCallback((parsed: QuickAddResult | null, force = false) => {
    if (!parsed?.amount) return;

    const formattedAmount = parsed.amount.toFixed(2);
    const currentAmount = currentAmountRef.current;
    const canAutoFill =
      force ||
      !amountEditedManuallyRef.current ||
      currentAmount === '0' ||
      currentAmount === '0.00' ||
      currentAmount === '' ||
      currentAmount === lastAutoFilledAmountRef.current;

    if (!canAutoFill) return;

    if (currentAmount !== formattedAmount) {
      setAmount(formattedAmount);
    }

    lastAutoFilledAmountRef.current = formattedAmount;
    amountEditedManuallyRef.current = false;
  }, []);

  // Numpad handlers
  const handleNumPress = (key: string) => {
    dismissInlineKeyboard();
    amountEditedManuallyRef.current = true;
    setAmount((prev) => {
      if (prev === '0' && key !== '.') return key;
      if (key === '.' && prev.includes('.')) return prev;
      if (prev.includes('.') && prev.split('.')[1].length >= 2) return prev;
      if (prev.length >= 12) return prev;
      return prev + key;
    });
  };

  const handleDelete = () => {
    dismissInlineKeyboard();
    amountEditedManuallyRef.current = true;
    setAmount((prev) => (prev.length <= 1 ? '0' : prev.slice(0, -1)));
  };

  const handleClear = () => {
    dismissInlineKeyboard();
    amountEditedManuallyRef.current = true;
    setAmount('0');
  };

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) setDate(selectedDate);
  };

  // Phase 2 — ผู้ใช้เลือกการตีความจากคำถามกลับ
  const handleClarifyChoice = async (option: ClarifyOption) => {
    haptics.selection();

    // บันทึกคู่ (double-entry): สร้าง 2 รายการพร้อมกัน (ขาย + ต้นทุน) → สรุปกำไรเอง
    if (option.pair) {
      if (!selectedWallet) {
        showSnackbar({ message: 'กรุณาเลือกกระเป๋าเงินก่อน', variant: 'warning' });
        return;
      }
      // หมวดเดียวกันทั้ง 2 ขา (business context) — แยกด้วย tradeRole cost/revenue (มติ 2 ทีม)
      //   ลำดับ: หมวดที่ผู้ใช้เลือก → หมวดที่หมูนุ่นเดา → หมวดค้าขายตามคีย์เวิร์ด (ทั้งหมดฝั่งรายรับ)
      const findCat = (list: Category[], ...keys: string[]) =>
        list.find((c) => keys.some((k) => c.name.includes(k))) ?? null;
      const businessCat =
        (selectedCategory?.type === 'income' ? selectedCategory : null) ??
        (quickAddPreview?.category?.type === 'income' ? quickAddPreview.category : null) ??
        findCat(incomeCategories, 'ตลาด', 'ขาย', 'ธุรกิจ');
      const sharedCatId = businessCat?.id ?? null;
      const baseNote = quickAddPreview?.note || quickAddText.trim() || null;
      // ผูก 2 ขาด้วย trade_group_id เดียว — กำไร derive จากกลุ่มนี้ (ไม่เก็บกำไรเป็น row)
      const tradeGroupId = generateId();

      setIsSaving(true);
      try {
        await addTransaction({
          amount: option.pair.expenseAmount,
          type: 'expense',
          categoryId: sharedCatId,
          walletId: selectedWallet.id,
          tradeGroupId,
          tradeRole: 'cost',
          walletNameSnapshot: selectedWallet.name,
          sourceType: 'trade_set',
          sourceRef: tradeGroupId,
          note: baseNote ? `${baseNote} (ต้นทุน)` : 'ต้นทุน',
          date,
        });
        await addTransaction({
          amount: option.pair.incomeAmount,
          type: 'income',
          categoryId: sharedCatId,
          walletId: selectedWallet.id,
          tradeGroupId,
          tradeRole: 'revenue',
          walletNameSnapshot: selectedWallet.name,
          sourceType: 'trade_set',
          sourceRef: tradeGroupId,
          note: baseNote ? `${baseNote} (ยอดขาย)` : 'ยอดขาย',
          date,
        });
        await Promise.all([refreshTotalBalance(), loadAll(), loadWallets()]);
        haptics.success();
        const profit = option.pair.incomeAmount - option.pair.expenseAmount;
        setAmount('0');
        setSelectedCategory(null);
        setNote('');
        setQuickAddText('');
        setQuickAddPreview(null);
        setManualTypeOverride(null);
        void quickAddDraftService.clear();
        showSnackbar({
          title: 'บันทึก 2 รายการแล้ว ✅',
          message: `ขาย ${option.pair.incomeAmount.toLocaleString()} · ต้นทุน ${option.pair.expenseAmount.toLocaleString()} · กำไร ${profit.toLocaleString()} บาท`,
          variant: 'success',
          durationMs: 3500,
        });
        startIdleDetection();
      } catch {
        showSnackbar({ message: 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง', variant: 'error' });
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // ตัวเลือกเดี่ยว → เซ็ตยอด/ประเภทลงฟอร์ม ให้ผู้ใช้กดบันทึกเอง
    setActiveTab(option.type);
    setManualTypeOverride(option.type);
    setSelectedCategory((prev) => (prev?.type === option.type ? prev : null));
    setAmount(String(option.amount));
    setQuickAddPreview((prev) =>
      prev
        ? { ...prev, action: 'review', amount: option.amount, type: option.type, clarify: null, confidence: 'medium' }
        : prev
    );
  };

  const handleTabChange = (tab: TabType) => {
    setManualTypeOverride(tab);
    setActiveTab(tab);
    setSelectedCategory((prev) => (prev?.type === tab ? prev : null));
    setQuickAddPreview((prev) =>
      prev
        ? {
            ...prev,
            type: tab,
            category: prev.category?.type === tab ? prev.category : null,
          }
        : prev
    );
  };

  const applyQuickAddResult = useCallback((parsed: QuickAddResult, shouldApplyAmount: boolean, forcedType?: TabType | null) => {
    const resolvedType = forcedType ?? parsed.type;
    const resolvedCategory = parsed.category?.type === resolvedType ? parsed.category : null;

    setActiveTab(resolvedType);
    if (shouldApplyAmount && parsed.amount) {
      setAmount(parsed.amount.toFixed(2));
    }
    // abstain เมื่อไม่มั่นใจ (low): ไม่ pre-select หมวด — ให้โชว์เป็น "แนะนำ" ให้ผู้ใช้ยืนยันเอง
    // กัน confidently-wrong ที่ทำข้อมูลภาษีเพี้ยนเงียบ ๆ
    const shouldAutoSelect = parsed.confidence !== 'low';
    setSelectedCategory((prev) =>
      shouldAutoSelect
        ? resolvedCategory ?? (prev?.type === resolvedType ? prev : null)
        : prev?.type === resolvedType
          ? prev
          : null
    );
    setNote(parsed.note);
    setQuickAddPreview({
      ...parsed,
      type: resolvedType,
      category: resolvedCategory,
    });
  }, []);

  const handleQuickAddTextChange = useCallback((text: string) => {
    setManualTypeOverride(null);
    setQuickAddText(text);
  }, []);

  useEffect(() => {
    const parsed = quickAddParser.parse(quickAddText, allCategories, {
      preferredType: activeTab,
      learningRules: quickAddLearningRules,
      starterProfile: activeQuickAddProfile,
    });

    if (!parsed) {
      setQuickAddPreview(null);
      if (!quickAddText.trim() && !amountEditedManuallyRef.current && lastAutoFilledAmountRef.current) {
        setAmount('0');
        lastAutoFilledAmountRef.current = null;
      }
      return;
    }

    applyQuickAddResult(parsed, false, manualTypeOverride);
    tryAutoFillParsedAmount(parsed, parsed.amount !== null);
  }, [quickAddText, expenseCategories, incomeCategories, activeTab, quickAddLearningRules, activeQuickAddProfile, applyQuickAddResult, tryAutoFillParsedAmount, manualTypeOverride]);

  const handleApplyQuickAdd = () => {
    const parsed = quickAddParser.parse(quickAddText, allCategories, {
      preferredType: activeTab,
      learningRules: quickAddLearningRules,
      starterProfile: activeQuickAddProfile,
    });

    if (!parsed) {
      showSnackbar({
        title: 'ยังอ่านไม่ได้',
        message: 'ลองพิมพ์ เช่น "กาแฟ 45", "ฟรีแลนซ์ 3000" หรือ "ขายของ 890"',
        variant: 'warning',
        durationMs: 3000,
      });
      return;
    }

    applyQuickAddResult(parsed, true, manualTypeOverride);
    tryAutoFillParsedAmount(parsed, true);
    haptics.light();

    if (!parsed.amount) {
      showSnackbar({
        title: 'เติมข้อมูลให้แล้ว',
        message: 'ระบบเดาประเภทและหมวดหมู่ให้แล้ว กรุณาใส่จำนวนเงินก่อนบันทึก',
        variant: 'info',
        durationMs: 2800,
      });
    }
  };

  const handleVoiceInputPress = useCallback(async () => {
    if (!SHOW_IN_APP_VOICE_INPUT) {
      return;
    }

    dismissInlineKeyboard();

    if (voiceInputStatus.status === 'listening' || voiceInputStatus.status === 'processing') {
      await voiceInputService.stopListening();
      return;
    }

    const capabilities = await voiceInputService.getCapabilities(VOICE_INPUT_LOCALE);
    setVoiceInputCapabilities(capabilities);
    setVoiceInputError(null);

    if (!capabilities.isNativeModuleAvailable) {
      showSnackbar({
        title: 'ต้องใช้ development build',
        message: getVoiceCapabilityMessage(capabilities),
        variant: 'warning',
        durationMs: 3200,
      });
      return;
    }

    if (!capabilities.isRecognitionAvailable) {
      showSnackbar({
        title: 'ยังใช้ Voice Input ไม่ได้',
        message: getVoiceCapabilityMessage(capabilities),
        variant: 'warning',
        durationMs: 3200,
      });
      return;
    }

    if (
      !capabilities.supportsOfflineRecognition &&
      (capabilities.reason === 'on_device_not_installed' ||
        capabilities.reason === 'language_not_supported')
    ) {
      showSnackbar({
        title: 'เครื่องนี้ยังไม่พร้อมออฟไลน์',
        message: getVoiceCapabilityMessage(capabilities),
        variant: 'info',
        durationMs: 3200,
      });
      return;
    }

    try {
      const status = await voiceInputService.startListening({
        locale: VOICE_INPUT_LOCALE,
        partialResults: true,
        prompt: 'พูดรายการ เช่น ขายทุเรียน 450',
        requireOnDevice: true,
        biasPhrases: buildVoiceBiasPhrases(activeQuickAddProfile, allCategories),
      });
      setVoiceInputStatus(status);
      haptics.light();
    } catch (error) {
      const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : 'unknown';
      const message =
        error instanceof Error
          ? error.message
          : 'ไม่สามารถเริ่ม Voice Input ในแอปได้ตอนนี้';
      const resolvedMessage = getVoiceErrorMessage({
        code,
        message,
        recoverable: true,
      });

      setVoiceInputError(resolvedMessage);
      setVoiceInputStatus((prev) => ({
        ...prev,
        status: 'error',
        message: resolvedMessage,
      }));
      showSnackbar({
        title: 'เริ่มฟังเสียงไม่สำเร็จ',
        message: resolvedMessage,
        variant: 'warning',
        durationMs: 3200,
      });
    }
  }, [activeQuickAddProfile, allCategories, dismissInlineKeyboard, showSnackbar, voiceInputStatus.status]);

  // Save transaction
  const handleSave = async () => {
    // กันพลาด: ถ้ากำลังอยู่ในโหมดชุดซื้อ-ขาย (Card Set) ห้ามบันทึกเป็นรายการเดี่ยว
    // ต้องให้ผู้ใช้กดปุ่ม "บันทึกชุดซื้อ-ขาย · 2 รายการ" ในการ์ดเท่านั้น
    if (
      quickAddPreview &&
      quickAddPreview.action === 'ask' &&
      quickAddPreview.clarify?.kind === 'dual_entry'
    ) {
      showSnackbar({
        title: 'นี่คือชุดซื้อ-ขาย 🔗',
        message: 'กรุณากดปุ่ม “บันทึกชุดซื้อ-ขาย · 2 รายการ” ในการ์ดด้านบน เพื่อบันทึกทั้งต้นทุนและยอดขาย',
        variant: 'warning',
        durationMs: 3200,
      });
      return;
    }

    const parsedQuickAdd = quickAddText.trim()
      ? quickAddParser.parse(quickAddText, allCategories, {
          preferredType: activeTab,
          learningRules: quickAddLearningRules,
          starterProfile: activeQuickAddProfile,
        })
      : null;

    let amountForSave = parseFloat(amount);
    if (amountForSave <= 0 && parsedQuickAdd?.amount) {
      amountForSave = parsedQuickAdd.amount;
      applyQuickAddResult(parsedQuickAdd, true, manualTypeOverride);
      tryAutoFillParsedAmount(parsedQuickAdd, true);
    }

    if (amountForSave <= 0) {
      showSnackbar({ message: 'กรุณาใส่จำนวนเงิน', variant: 'warning' });
      return;
    }
    let categoryForSave = selectedCategory;
    let typeForSave = activeTab;
    if (!categoryForSave && parsedQuickAdd) {
      if (parsedQuickAdd.category && parsedQuickAdd.category.type === typeForSave) {
        categoryForSave = parsedQuickAdd.category;
        applyQuickAddResult(parsedQuickAdd, amount === '0', typeForSave);
      }
    }

    if (!categoryForSave) {
      showSnackbar({ message: 'กรุณาเลือกหมวดหมู่', variant: 'warning' });
      return;
    }
    if (!selectedWallet) {
      showSnackbar({ message: 'กรุณาเลือกกระเป๋าเงิน', variant: 'warning' });
      return;
    }

    setIsSaving(true);
    try {
      const learningSource =
        quickAddPreview &&
        (quickAddPreview.type !== typeForSave || quickAddPreview.category?.id !== categoryForSave.id)
          ? 'user_correction'
          : 'user_confirmation';

      await addTransaction({
        amount: amountForSave,
        type: typeForSave as TransactionType,
        categoryId: categoryForSave.id,
        walletId: selectedWallet.id,
        walletNameSnapshot: selectedWallet.name,
        sourceType: 'manual',
        note: note.trim() || null,
        date,
      });

      if (quickAddText.trim()) {
        await quickAddLearningService.learn({
          rawText: quickAddText,
          type: typeForSave,
          categoryId: categoryForSave.id,
          source: learningSource,
        });
        const latestLearningRules = await quickAddLearningService.getAll();
        setQuickAddLearningRules(latestLearningRules);
      }

      await Promise.all([refreshTotalBalance(), loadAll(), loadWallets()]);
      haptics.success();

      // Reset form
      setAmount('0');
      setSelectedCategory(null);
      setShowCategoryGrid(false);
      setNote('');
      setDate(new Date());
      setQuickAddText('');
      setQuickAddPreview(null);
      setManualTypeOverride(null);
      void quickAddDraftService.clear();
      showSnackbar({
        title: 'บันทึกรายการแล้ว ✅',
        message: 'บันทึกเรียบร้อย',
        variant: 'success',
        durationMs: 3000,
      });
      startIdleDetection(); // countdown เริ่มหลัง idle 20 วิ ไม่ใช่ทันที
      return;
    } catch (error) {
      showSnackbar({
        message: 'ไม่สามารถบันทึกได้ กรุณาลองใหม่',
        variant: 'error',
        durationMs: 3000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const numAmount = parseFloat(amount) || 0;
  const previewAmount = quickAddPreview?.amount ?? (numAmount > 0 ? numAmount : null);
  const canQuickSaveFromPreview = Boolean(
    quickAddPreview &&
    quickAddPreview.confidence === 'high' &&
    previewAmount &&
    quickAddPreview.category &&
    selectedWallet
  );
  const previewConfidenceLabel = quickAddPreview
    ? quickAddPreview.confidence === 'high'
      ? 'มั่นใจสูง'
      : quickAddPreview.confidence === 'medium'
        ? 'มั่นใจปานกลาง'
        : 'ยังไม่มั่นใจ'
    : '';
  const previewConfidenceColor = quickAddPreview
    ? quickAddPreview.confidence === 'high'
      ? colors.income
      : quickAddPreview.confidence === 'medium'
        ? colors.transfer
        : colors.expense
    : colors.textSecondary;
  // (ทีม 1/2) ข้อความคาแรกเตอร์หมูนุ่น — (ทีม 3) แต่ยังบอก confidence ตรงไปตรงมา
  const previewMascotText = (() => {
    if (!quickAddPreview) return '';
    const typeText = quickAddPreview.type === 'income' ? 'รายรับ' : 'รายจ่าย';
    const cat = quickAddPreview.category?.name;
    const tail = cat ? ` → ${cat}` : '';
    switch (quickAddPreview.confidence) {
      case 'high':
        return `หมูนุ่นจัดให้เป็น${typeText}ค่ะ${tail}`;
      case 'medium':
        return `หมูนุ่นคิดว่าน่าจะเป็น${typeText}ค่ะ ลองเช็กอีกนิดนะคะ${tail}`;
      default:
        return 'หมูนุ่นยังไม่แน่ใจ ลองเลือกประเภท/หมวดให้หน่อยนะคะ';
    }
  })();

  // (ทุกทีม) Explain Calculation — โชว์ที่มาของยอดเมื่อมี % หรือหน่วยซับซ้อน
  const previewBreakdown = (() => {
    const p = quickAddPreview;
    if (!p || p.amount == null) return null;
    if (p.modifier && p.baseAmount != null) {
      const base = formatCurrency(p.baseAmount);
      const result = formatCurrency(p.amount);
      const diff = formatCurrency(Math.abs(p.baseAmount - p.amount));
      switch (p.modifier) {
        case 'commission':
          return `ค่านายหน้า ${base} × ${p.percent}% = ${result} บาท`;
        case 'profit':
          return `กำไร ${base} × ${p.percent}% = ${result} บาท`;
        case 'discount':
          return p.percent != null
            ? `${base} ลด ${p.percent}% = ${result} บาท`
            : `${base} − ลด ${diff} = ${result} บาท`;
        case 'addition':
          return `${base} + ${diff} = ${result} บาท`;
        case 'change':
          return `จ่าย ${base} − ทอน ${diff} = ${result} บาท`;
        default:
          break;
      }
    }
    if (p.quantity != null && p.unitPrice != null) {
      const priceUnitLabel = p.priceUnit ?? p.unit ?? 'หน่วย';
      return `${p.quantity} ${p.unit ?? ''} · ${priceUnitLabel}ละ ${formatCurrency(p.unitPrice)} = ${formatCurrency(p.amount)} บาท`;
    }
    return null;
  })();

  // Trade-set (ซื้อ-ขาย) — รวมเป็นการ์ดเดียว: ต้นทุน/ยอดขาย/กำไร (กำไร = derived)
  const tradeSet = (() => {
    const cl = quickAddPreview?.clarify;
    if (!cl || cl.kind !== 'dual_entry') return null;
    const pairOpt = cl.options.find((o) => o.pair);
    if (!pairOpt?.pair) return null;
    const cost = pairOpt.pair.expenseAmount;
    const sale = pairOpt.pair.incomeAmount;
    return { pairOpt, cost, sale, profit: sale - cost, alts: cl.options.filter((o) => !o.pair) };
  })();

  // โหมดชุดซื้อ-ขาย (Card Set) กำลังแสดงอยู่ → ปุ่มบันทึกล่างต้องถูก disable
  // เพราะปุ่มล่างบันทึกเป็น "รายการเดี่ยว" จาก numpad เท่านั้น จะได้ข้อมูลคนละชุดกับการ์ด
  // showTradeAlts (กด "แยกเป็นรายการปกติ") → ออกจาก Review Mode กลับไปจอเต็มเพื่อแยก/แก้รายการ
  const isTradeSetActive = Boolean(
    quickAddPreview && quickAddPreview.action === 'ask' && quickAddPreview.clarify && tradeSet && !showTradeAlts
  );

  // ── Trade Set: แยก category namespace (4.3) ──────────────────────────────
  // revenue leg → หมวด income (business activity ที่ผู้ใช้เห็น) · cost leg → หมวด expense "ต้นทุนขาย"
  const findIncomeCat = (...keys: string[]) =>
    incomeCategories.find((c) => keys.some((k) => c.name.includes(k))) ?? null;
  const parsedTradeSetBusinessCategory =
    quickAddPreview?.tradeSet?.businessActivity ??
    quickAddPreview?.tradeSet?.revenue.category ??
    null;
  const defaultBusinessCategory =
    (selectedCategory?.type === 'income' ? selectedCategory : null) ??
    (parsedTradeSetBusinessCategory?.type === 'income' ? parsedTradeSetBusinessCategory : null) ??
    (quickAddPreview?.category?.type === 'income' ? quickAddPreview.category : null) ??
    findIncomeCat('ตลาด', 'ขาย', 'ธุรกิจ') ??
    incomeCategories[0] ??
    null;
  const businessCategory = tradeBusinessCategory ?? defaultBusinessCategory;
  const costCategory =
    quickAddPreview?.tradeSet?.cost.category ??
    expenseCategories.find((c) => c.name.includes('ต้นทุน')) ??
    expenseCategories.find((c) => c.name.includes('ธุรกิจ')) ??
    null;
  const effectiveCost = editedCost ?? tradeSet?.cost ?? 0;
  const effectiveSale = editedRevenue ?? tradeSet?.sale ?? 0;

  // หมวดที่หมูนุ่นเดาได้ (ตรงประเภทปัจจุบัน) แต่ยังไม่ถูกเลือก → โชว์เป็น "แนะนำ"
  const categorySuggestion =
    quickAddPreview?.category && quickAddPreview.category.type === activeTab
      ? quickAddPreview.category
      : null;

  // ฟอร์มมีข้อมูลค้างที่ยังไม่บันทึก (draft) — ใช้โชว์ indicator
  const isFormDirty =
    !isSaving &&
    ((parseFloat(amount) || 0) > 0 ||
      quickAddText.trim().length > 0 ||
      note.trim().length > 0 ||
      selectedCategory !== null);

  // บันทึกชุดซื้อ-ขาย — 2 transaction ผูก tradeGroupId เดียว, แยกหมวด cost/revenue
  const handleSaveTradeSet = async () => {
    if (!tradeSet) return;
    if (!selectedWallet) {
      showSnackbar({ message: 'กรุณาเลือกกระเป๋าเงินก่อน', variant: 'warning' });
      return;
    }
    if (effectiveCost <= 0 || effectiveSale <= 0) {
      showSnackbar({ message: 'ยอดต้นทุน/ยอดขายต้องมากกว่า 0', variant: 'warning' });
      return;
    }
    const baseNote = quickAddPreview?.note || quickAddText.trim() || null;
    const tradeGroupId = generateId();

    setIsSaving(true);
    try {
      await addTransaction({
        amount: effectiveCost,
        type: 'expense',
        categoryId: costCategory?.id ?? null,
        walletId: selectedWallet.id,
        tradeGroupId,
        tradeRole: 'cost',
        walletNameSnapshot: selectedWallet.name,
        sourceType: 'trade_set',
        sourceRef: tradeGroupId,
        note: baseNote ? `${baseNote} (ต้นทุน)` : 'ต้นทุน',
        date,
      });
      await addTransaction({
        amount: effectiveSale,
        type: 'income',
        categoryId: businessCategory?.id ?? null,
        walletId: selectedWallet.id,
        tradeGroupId,
        tradeRole: 'revenue',
        walletNameSnapshot: selectedWallet.name,
        sourceType: 'trade_set',
        sourceRef: tradeGroupId,
        note: baseNote ? `${baseNote} (ยอดขาย)` : 'ยอดขาย',
        date,
      });
      await Promise.all([refreshTotalBalance(), loadAll(), loadWallets()]);
      // จำหมวดธุรกิจ (ฝั่งขาย) ที่ผู้ใช้ยืนยัน/แก้ → ครั้งหน้าเดาหมวดชุดซื้อ-ขายแม่นขึ้น
      //   (เดิม trade-set ไม่เคย learn เลย — ผู้ใช้แก้หมวดซ้ำ ๆ ระบบก็ไม่จำ)
      if (quickAddText.trim() && businessCategory) {
        await quickAddLearningService.learn({
          rawText: quickAddText,
          type: 'income',
          categoryId: businessCategory.id,
          source: tradeBusinessCategory ? 'user_correction' : 'user_confirmation',
        });
        setQuickAddLearningRules(await quickAddLearningService.getAll());
      }
      haptics.success();
      const profit = effectiveSale - effectiveCost;
      setAmount('0');
      setSelectedCategory(null);
      setNote('');
      setQuickAddText('');
      setQuickAddPreview(null);
      setManualTypeOverride(null);
      setEditedCost(null);
      setEditedRevenue(null);
      setTradeBusinessCategory(null);
      void quickAddDraftService.clear();
      showSnackbar({
        title: 'บันทึก 2 รายการแล้ว ✅',
        message: `ขาย ${effectiveSale.toLocaleString()} · ต้นทุน ${effectiveCost.toLocaleString()} · กำไร ${profit.toLocaleString()} บาท`,
        variant: 'success',
        durationMs: 3500,
      });
      startIdleDetection();
    } catch {
      showSnackbar({ message: 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง', variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const isVoiceSessionActive =
    voiceInputStatus.status === 'listening' || voiceInputStatus.status === 'processing';
  const voiceStatusBadgeText = isVoiceSessionActive
    ? voiceInputStatus.isOfflineGuaranteed
      ? 'กำลังฟังเสียงในเครื่อง'
      : 'กำลังฟังเสียง'
    : voiceInputCapabilities.supportsOfflineRecognition
      ? 'เสียงออฟไลน์พร้อมใช้'
      : voiceInputCapabilities.reason === 'language_model_not_downloaded'
        ? 'ต้องดาวน์โหลดภาษาไทยออฟไลน์'
        : voiceInputCapabilities.reason === 'language_model_pending'
          ? 'กำลังโหลดภาษาไทยออฟไลน์'
      : 'Voice Input Phase 1';
  const voiceStatusColor = isVoiceSessionActive
    ? voiceInputStatus.isOfflineGuaranteed
      ? colors.income
      : colors.transfer
    : voiceInputCapabilities.supportsOfflineRecognition
      ? colors.income
      : voiceInputCapabilities.reason === 'language_model_not_downloaded' ||
          voiceInputCapabilities.reason === 'language_model_pending'
        ? colors.transfer
      : colors.textSecondary;
  const voiceStatusMessage =
    voiceInputError ??
    voiceInputStatus.message ??
    getVoiceCapabilityMessage(voiceInputCapabilities);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={() => { dismissInlineKeyboard(); onUserInteraction(); }}
        onTouchStart={onUserInteraction}>
        {/* Draft indicator — สื่อสารว่ายังไม่บันทึก (non-blocking, ไม่ขัดจังหวะ) */}
        {isFormDirty && (
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 7,
            alignSelf: 'center', marginTop: 12, marginBottom: -4,
            backgroundColor: '#FFF3E0', borderColor: '#FFB74D', borderWidth: 1,
            borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5,
          }}>
            <FontAwesome name="pencil-square-o" size={12} color="#E65100" />
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#E65100' }}>
              ฉบับร่าง · ยังไม่บันทึก
            </Text>
          </View>
        )}
        {/* Tab: รายจ่าย / รายรับ — ซ่อนในโหมดชุดซื้อ-ขาย (เป็น 2 ทิศทาง toggle เลยขัด concept) */}
        {!isTradeSetActive && (
        <View
          style={{
            flexDirection: 'row',
            margin: 16,
            backgroundColor: colors.cardBackground,
            borderRadius: 16,
            padding: 4,
            borderWidth: 1,
            borderColor: colors.border,
          }}>
          <Pressable
            onPress={() => handleTabChange('expense')}
            style={{ flex: 1, borderRadius: 12, overflow: 'hidden' }}>
            {activeTab === 'expense' ? (
              <LinearGradient
                colors={['#E53935', '#EC407A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ paddingVertical: 12, alignItems: 'center' }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#FFF' }}>รายจ่าย</Text>
              </LinearGradient>
            ) : (
              <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textSecondary }}>รายจ่าย</Text>
              </View>
            )}
          </Pressable>
          <Pressable
            onPress={() => handleTabChange('income')}
            style={{ flex: 1, borderRadius: 12, overflow: 'hidden' }}>
            {activeTab === 'income' ? (
              <LinearGradient
                colors={['#1B8A3F', '#4CAF50']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ paddingVertical: 12, alignItems: 'center' }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#FFF' }}>รายรับ</Text>
              </LinearGradient>
            ) : (
              <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textSecondary }}>รายรับ</Text>
              </View>
            )}
          </Pressable>
        </View>
        )}

        <View style={{ paddingHorizontal: 16, marginBottom: 12, marginTop: isTradeSetActive ? 16 : 0 }}>
          {/* Input bar เดียว (chat-style): multiline auto-grow + ปุ่ม morph ไมค์↔เพิ่ม */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              backgroundColor: colors.cardBackground,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              paddingLeft: 12,
              paddingRight: 6,
              paddingVertical: 6,
              gap: 4,
            }}>
            <FontAwesome name="magic" size={16} color="#42A5F5" style={{ marginBottom: 12 }} />
            <TextInput
              ref={quickAddInputRef}
              value={quickAddText}
              onChangeText={handleQuickAddTextChange}
              placeholder='พิมพ์รายการ เช่น "กาแฟ 45" หรือ "ขายของได้ 900"'
              placeholderTextColor={colors.textSecondary}
              multiline
              textAlignVertical="top"
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={handleApplyQuickAdd}
              onContentSizeChange={(e) => setQuickAddInputHeight(e.nativeEvent.contentSize.height)}
              style={{
                flex: 1,
                fontSize: 15,
                color: colors.text,
                paddingTop: 9,
                paddingBottom: 9,
                paddingHorizontal: 8,
                // auto-grow 1→~4 บรรทัด แล้วค่อย scroll ภายใน (กันข้อความยาวเลื่อนหายต้นประโยค)
                height: Math.min(Math.max(40, quickAddInputHeight + 18), 112),
              }}
            />
            {/* ปุ่ม ↑ โผล่เฉพาะตอนมีข้อความ (เติมฟอร์ม) — mic ซ่อนไว้จนกว่าจะ wire STT + ล็อก tier */}
            {quickAddText.trim().length > 0 && (
              <Pressable
                onPress={handleApplyQuickAdd}
                hitSlop={6}
                style={({ pressed }) => ({
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  opacity: pressed ? 0.85 : 1,
                })}>
                <LinearGradient
                  colors={['#7C3AED', '#1565C0']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFillObject}
                />
                <FontAwesome name="arrow-up" size={18} color="#FFF" />
              </Pressable>
            )}
          </View>
          {SHOW_IN_APP_VOICE_INPUT ? (
            <View
              style={{
                marginTop: 8,
                backgroundColor: `${voiceStatusColor}10`,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: `${voiceStatusColor}22`,
                paddingHorizontal: 12,
                paddingVertical: 10,
                gap: 4,
              }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <FontAwesome
                  name={isVoiceSessionActive ? 'microphone' : 'wifi'}
                  size={12}
                  color={voiceStatusColor}
                />
                <Text style={{ fontSize: 12, fontWeight: '800', color: voiceStatusColor }}>
                  {voiceStatusBadgeText}
                </Text>
              </View>
              <Text style={{ fontSize: 12, lineHeight: 18, color: colors.textSecondary }}>
                {voiceStatusMessage}
              </Text>
            </View>
          ) : null}
          {activeQuickAddProfile ? (
            <View
              style={{
                marginTop: 8,
                backgroundColor: colors.tint + '10',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.tint + '22',
                paddingHorizontal: 12,
                paddingVertical: 10,
                gap: 4,
              }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: colors.tint }}>
                โหมดช่วยเดา: {activeQuickAddProfile.name}
              </Text>
              <Text style={{ fontSize: 12, lineHeight: 18, color: colors.textSecondary }}>
                Quick Add จะให้น้ำหนักกับหมวดและคำที่ใกล้กับชุดเริ่มต้นนี้มากขึ้น
              </Text>
              <Text style={{ fontSize: 12, lineHeight: 18, color: colors.text }}>
                ตัวอย่าง: {activeQuickAddProfile.sampleEntries.slice(0, 2).join(' • ')}
              </Text>
            </View>
          ) : null}
          {quickAddPreview && (
            isTradeSetActive && tradeSet ? (
              <View style={{ marginTop: 8 }}>
                <TradeSetReviewCard
                  colors={colors}
                  confidence={quickAddPreview.confidence}
                  cost={effectiveCost}
                  sale={effectiveSale}
                  businessCategory={businessCategory}
                  incomeCategories={incomeCategories}
                  costCategoryName={costCategory?.name ?? 'ต้นทุนขาย'}
                  wallet={selectedWallet}
                  wallets={wallets}
                  dateLabel={formatDate(date)}
                  isSaving={isSaving}
                  onSelectBusinessCategory={setTradeBusinessCategory}
                  onSelectWallet={setSelectedWallet}
                  onPressDate={() => setShowDatePicker(true)}
                  onApplyAmounts={(c, s) => { setEditedCost(c); setEditedRevenue(s); }}
                  onSplit={() => setShowTradeAlts(true)}
                  onSave={handleSaveTradeSet}
                />
              </View>
            ) : (
            <View
              style={{
                marginTop: 8,
                backgroundColor: colors.cardBackground,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 12,
                gap: 8,
              }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <Text style={{ fontSize: 12, color: colors.textSecondary, fontWeight: '700' }}>
                  🐷 หมูนุ่นสรุปให้
                </Text>
                <View
                  style={{
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    backgroundColor: `${previewConfidenceColor}14`,
                    borderWidth: 1,
                    borderColor: `${previewConfidenceColor}40`,
                  }}>
                  <Text style={{ fontSize: 11, color: previewConfidenceColor, fontWeight: '800' }}>
                    {previewConfidenceLabel}
                  </Text>
                </View>
              </View>
              {quickAddPreview.action === 'ask' && quickAddPreview.clarify && tradeSet ? (
                // ── Trade-set card (ซื้อ-ขาย) — การ์ดชุดใบเดียว + ปุ่มหลักเดียว + escape hatch ──
                <View style={{ gap: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 13.5, fontWeight: '800', color: colors.income }}>✅ ตรวจพบ 2 รายการ</Text>
                    <View style={{ backgroundColor: '#7F77DD22', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#5B52C9' }}>🔗 ชุดซื้อ-ขาย</Text>
                    </View>
                  </View>
                  {/* 3 บรรทัด: ต้นทุน / ยอดขาย / กำไร (กำไร = derived) — แก้ P4 ไม่มีเลขเดี่ยวลวงตา */}
                  <View style={{ borderLeftWidth: 3, borderLeftColor: '#7F77DD', paddingLeft: 10, gap: 5, paddingVertical: 2 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 13, color: colors.textSecondary }}>ต้นทุน (รายจ่าย)</Text>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: colors.expense }}>−{formatCurrency(tradeSet.cost)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 13, color: colors.textSecondary }}>ยอดขาย (รายรับ)</Text>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: colors.income }}>+{formatCurrency(tradeSet.sale)}</Text>
                    </View>
                    <View style={{ height: 1, backgroundColor: colors.border }} />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 13.5, fontWeight: '800', color: tradeSet.profit >= 0 ? '#5B52C9' : colors.expense }}>
                        {tradeSet.profit >= 0 ? 'กำไรสุทธิ' : 'ขาดทุน'}
                      </Text>
                      <Text style={{ fontSize: 16, fontWeight: '900', color: tradeSet.profit >= 0 ? '#5B52C9' : colors.expense }}>
                        {tradeSet.profit >= 0 ? '+' : '−'}{formatCurrency(Math.abs(tradeSet.profit))}
                      </Text>
                    </View>
                  </View>
                  {/* ปุ่ม primary เดียว — ใช้ handleSaveTradeSet (แยกหมวด cost/revenue ถูกต้อง) */}
                  <Pressable
                    onPress={handleSaveTradeSet}
                    disabled={isSaving}
                    style={({ pressed }) => ({
                      borderRadius: 12,
                      alignItems: 'center',
                      backgroundColor: pressed || isSaving ? '#1B5E20' : colors.income,
                      paddingVertical: 13,
                    })}>
                    <Text style={{ fontSize: 14.5, fontWeight: '900', color: '#FFF' }}>
                      💾 บันทึกชุดซื้อ-ขาย · 2 รายการ
                    </Text>
                  </Pressable>
                  {/* escape hatch */}
                  <Pressable onPress={() => setShowTradeAlts((v) => !v)} hitSlop={6} style={{ alignItems: 'center', paddingVertical: 2 }}>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, fontWeight: '600' }}>
                      ⚙ ไม่ใช่ซื้อ-ขาย? แยก/แก้ไขรายการ {showTradeAlts ? '▲' : '▾'}
                    </Text>
                  </Pressable>
                  {showTradeAlts
                    ? tradeSet.alts.map((opt, i) => {
                        const c = opt.type === 'income' ? colors.income : colors.expense;
                        return (
                          <Pressable
                            key={i}
                            onPress={() => handleClarifyChoice(opt)}
                            disabled={isSaving}
                            style={({ pressed }) => ({
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              borderRadius: 10,
                              borderWidth: 1.5,
                              borderColor: c,
                              backgroundColor: pressed ? `${c}1A` : 'transparent',
                              paddingHorizontal: 12,
                              paddingVertical: 9,
                            })}>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, flexShrink: 1 }}>
                              {opt.type === 'income' ? '🟢 รายรับ · ' : '🔴 รายจ่าย · '}{opt.label}
                            </Text>
                            <Text style={{ fontSize: 14, fontWeight: '800', color: c, marginLeft: 8 }}>
                              {formatCurrency(opt.amount)}
                            </Text>
                          </Pressable>
                        );
                      })
                    : null}
                </View>
              ) : quickAddPreview.action === 'ask' && quickAddPreview.clarify ? (
                // ── Ambiguous (เช่น ยืม+ดอกเบี้ย) — เมนูเลือกแบบเดิม ──
                <View style={{ gap: 8 }}>
                  <Text style={{ fontSize: 13.5, fontWeight: '800', color: colors.text }}>
                    🤔 {quickAddPreview.clarify.question}
                  </Text>
                  {quickAddPreview.clarify.options.map((opt, i) => {
                    const c = opt.type === 'income' ? colors.income : colors.expense;
                    return (
                      <Pressable
                        key={i}
                        onPress={() => handleClarifyChoice(opt)}
                        disabled={isSaving}
                        style={({ pressed }) => ({
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderRadius: 10,
                          borderWidth: 1.5,
                          borderColor: c,
                          backgroundColor: pressed ? `${c}1A` : 'transparent',
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                        })}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, flexShrink: 1 }}>
                          {opt.type === 'income' ? '🟢 รายรับ · ' : '🔴 รายจ่าย · '}{opt.label}
                        </Text>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: c, marginLeft: 8 }}>
                          {formatCurrency(opt.amount)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <Text style={{ fontSize: 13, color: quickAddPreview.type === 'income' ? colors.income : colors.expense, fontWeight: '700' }}>
                    {quickAddPreview.type === 'income' ? 'รายรับ' : 'รายจ่าย'}
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.text, fontWeight: '700' }}>
                    {previewAmount ? `${formatCurrency(previewAmount)} บาท` : 'รอใส่ยอดเงิน'}
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                    {quickAddPreview.category ? `${quickAddPreview.category.icon} ${quickAddPreview.category.name}` : 'ยังไม่พบหมวด'}
                  </Text>
                </View>
              )}
              {previewBreakdown ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EEF2FF', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#3730A3' }}>
                    🧮 {previewBreakdown}
                  </Text>
                </View>
              ) : null}
              {quickAddPreview.quantity ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E8F5E9', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#2E7D32' }}>
                      🌾 ปริมาณ {quickAddPreview.quantity} {quickAddPreview.unit ?? ''}
                    </Text>
                  </View>
                  {quickAddPreview.unitPrice ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFF3E0', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
                      <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#E65100' }}>
                        💴 {quickAddPreview.priceUnit ?? quickAddPreview.unit ?? 'หน่วย'}ละ {formatCurrency(quickAddPreview.unitPrice)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
              <Text style={{ fontSize: 12.5, color: previewConfidenceColor, fontWeight: '700' }}>
                🐷 {previewMascotText}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                กระเป๋า: {selectedWallet?.name ?? 'ยังไม่เลือก'} · โน้ต: {quickAddPreview.note || '-'}
              </Text>
              {quickAddPreview.confidence !== 'high' ? (
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  ถ้าหมูนุ่นจัดผิด เลือกหมวดใหม่ 1 ครั้ง แล้วครั้งต่อไปหมูนุ่นจะจำให้เองค่ะ
                </Text>
              ) : null}
              {canQuickSaveFromPreview && (
                <Pressable
                  onPress={handleSave}
                  disabled={isSaving}
                  style={({ pressed }) => ({
                    alignSelf: 'flex-start',
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 9,
                    backgroundColor: pressed || isSaving ? colors.tintDark : colors.tint,
                  })}>
                  <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '800' }}>
                    บันทึกเลย
                  </Text>
                </Pressable>
              )}
            </View>
            )
          )}
        </View>

        {/* แสดงจำนวนเงิน — ซ่อนในโหมดชุดซื้อ-ขาย (ยอดอยู่บนการ์ดแล้ว) */}
        {!isTradeSetActive && (
        <>
        <View style={{ alignItems: 'center', paddingVertical: 8 }}>
          <Text
            style={{
              fontSize: 14,
              color: colors.textSecondary,
              marginBottom: 4,
            }}>
            จำนวนเงิน (บาท)
          </Text>
          <Text
            style={{
              fontSize: 40,
              fontWeight: '800',
              color: activeTab === 'expense' ? colors.expense : colors.income,
            }}>
            {numAmount > 0 ? formatCurrency(numAmount) : '0.00'}
          </Text>
        </View>

        {/* Numpad */}
        <Numpad
          onPress={handleNumPress}
          onDelete={handleDelete}
          onClear={handleClear}
        />
        </>
        )}

        {/* หมวดหมู่ — ซ่อนในโหมดชุดซื้อ-ขาย; โหมดปกติ collapse ไว้ (ไม่เปิดทั้งแผง) */}
        {!isTradeSetActive && (
        <>
        <View style={{ marginTop: 20, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>หมวดหมู่</Text>
          {(selectedCategory || showCategoryGrid) && (
            <Pressable onPress={() => setShowCategoryGrid((v) => !v)} hitSlop={6}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.tint }}>
                {showCategoryGrid ? 'ปิด' : 'เปลี่ยน'}
              </Text>
            </Pressable>
          )}
        </View>

        {!showCategoryGrid && (
          <View style={{ paddingHorizontal: 16, marginBottom: 4 }}>
            {selectedCategory ? (
              // หมวดที่เลือก/เดาแล้ว (มั่นใจ) — chip เดียวสะอาดตา
              <Pressable
                onPress={() => setShowCategoryGrid(true)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 8,
                  alignSelf: 'flex-start',
                  backgroundColor: `${colors.tint}14`,
                  borderColor: colors.tint, borderWidth: 1.5,
                  borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9,
                }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                  {selectedCategory.icon} {selectedCategory.name}
                </Text>
                <FontAwesome name="check-circle" size={14} color={colors.tint} />
              </Pressable>
            ) : categorySuggestion ? (
              // เดาได้แต่ไม่มั่นใจ (abstain) — โชว์เป็น "แนะนำ" กดยืนยัน 1 ครั้ง
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <Pressable
                  onPress={() => setSelectedCategory(categorySuggestion)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 8,
                    backgroundColor: colors.cardBackground,
                    borderColor: colors.transfer, borderWidth: 1.5, borderStyle: 'dashed',
                    borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9,
                  }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: colors.transfer }}>แนะนำ</Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                    {categorySuggestion.icon} {categorySuggestion.name}
                  </Text>
                </Pressable>
                <Pressable onPress={() => setShowCategoryGrid(true)} hitSlop={6}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>เลือกอื่น ▾</Text>
                </Pressable>
              </View>
            ) : (
              // ไม่รู้จริง — ปุ่มเลือกเดี่ยว ไม่เปิดทั้งแผง
              <Pressable
                onPress={() => setShowCategoryGrid(true)}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  backgroundColor: colors.cardBackground,
                  borderColor: colors.border, borderWidth: 1,
                  borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
                }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <FontAwesome name="th-large" size={16} color="#42A5F5" />
                  <Text style={{ fontSize: 15, color: colors.textSecondary }}>เลือกหมวดหมู่</Text>
                </View>
                <FontAwesome name="chevron-down" size={12} color={colors.textSecondary} />
              </Pressable>
            )}
          </View>
        )}

        {showCategoryGrid && (
          <CategoryGrid
            categories={categories}
            selectedId={selectedCategory?.id ?? null}
            onSelect={(c) => { setSelectedCategory(c); setShowCategoryGrid(false); }}
          />
        )}
        </>
        )}

        {/* กระเป๋าเงิน + วันที่/โน้ต — ซ่อนในโหมดชุดซื้อ-ขาย (ย่อไว้บนการ์ดแล้ว) */}
        {!isTradeSetActive && (
        <>
        <View style={{ marginTop: 20, paddingHorizontal: 16 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: '700',
              color: colors.text,
              marginBottom: 12,
            }}>
            กระเป๋าเงิน
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}>
            {wallets.map((wallet) => {
              const isSelected = wallet.id === selectedWallet?.id;
              return (
                <Pressable
                  key={wallet.id}
                  onPress={() => setSelectedWallet(wallet)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    overflow: 'hidden',
                    borderWidth: 1,
                    borderColor: isSelected ? 'transparent' : colors.border,
                    backgroundColor: isSelected ? 'transparent' : colors.cardBackground,
                    gap: 8,
                  }}>
                  {isSelected && (
                    <LinearGradient
                      colors={['#7C3AED', '#1565C0']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={StyleSheet.absoluteFillObject}
                    />
                  )}
                  <WalletAvatar
                    icon={wallet.icon}
                    size={28}
                    backgroundColor={isSelected ? 'rgba(255,255,255,0.18)' : undefined}
                  />
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: isSelected ? '#FFF' : colors.text,
                    }}>
                    {wallet.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* วันที่ & โน้ต */}
        <View style={{ marginTop: 20, paddingHorizontal: 16, gap: 12 }}>
          {/* วันที่ */}
          <Pressable
            onPress={() => setShowDatePicker(true)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.cardBackground,
              borderRadius: 12,
              padding: 14,
              borderWidth: 1,
              borderColor: colors.border,
              gap: 12,
            }}>
            <FontAwesome name="calendar" size={18} color="#42A5F5" />
            <Text style={{ fontSize: 15, color: colors.text, flex: 1 }}>
              {formatDate(date)}
            </Text>
            <FontAwesome
              name="chevron-right"
              size={12}
              color={colors.textSecondary}
            />
          </Pressable>

          {/* โน้ต */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.cardBackground,
              borderRadius: 12,
              padding: 14,
              borderWidth: 1,
              borderColor: colors.border,
              gap: 12,
            }}>
            <FontAwesome name="pencil" size={18} color="#42A5F5" />
            <TextInput
              ref={noteInputRef}
              value={note}
              onChangeText={setNote}
              placeholder="บันทึกโน้ต (ไม่บังคับ)"
              placeholderTextColor={colors.textSecondary}
              style={{
                flex: 1,
                fontSize: 15,
                color: colors.text,
              }}
            />
          </View>
        </View>
        </>
        )}

        {/* DateTimePicker — render นอก gate เพื่อให้เปิดได้ทั้งโหมดปกติและการ์ดชุดซื้อ-ขาย */}
        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateChange}
            maximumDate={new Date()}
          />
        )}

        {/* Countdown Banner — แสดงเฉพาะเมื่อ idle เกิน 20 วิ */}
        {countdown !== null && countdown > 0 && (
          <View style={{
            marginHorizontal: 16, marginTop: 16, marginBottom: 4,
            backgroundColor: '#FFF3E0', borderRadius: 16,
            borderWidth: 1.5, borderColor: '#FF9800',
            padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
          }}>
            <View style={{
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: '#FF9800', justifyContent: 'center', alignItems: 'center',
            }}>
              <Text style={{ fontSize: 17, fontWeight: '900', color: '#fff' }}>{countdown}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#E65100' }}>
                ไม่มีการใช้งาน — กลับหน้าหลักอัตโนมัติ
              </Text>
              <Text style={{ fontSize: 12, color: '#FF9800', marginTop: 2 }}>
                แตะหน้าจอเพื่อยกเลิก
              </Text>
            </View>
            <Pressable
              onPress={cancelAutoReturn}
              style={({ pressed }) => ({
                backgroundColor: pressed ? '#FFE0B2' : '#FFB74D',
                borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
              })}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#BF360C' }}>ยกเลิก</Text>
            </Pressable>
          </View>
        )}

        {/* ปุ่มบันทึก — ซ่อนในโหมดชุดซื้อ-ขาย (การ์ดมีปุ่มบันทึกของตัวเองแล้ว) */}
        {!isTradeSetActive && (
        <View style={{ paddingHorizontal: 16, marginTop: 24, marginBottom: 40 }}>
          <Pressable
            onPress={handleSave}
            disabled={isSaving}
            style={({ pressed }) => ({
              borderRadius: 16,
              overflow: 'hidden',
              opacity: pressed || isSaving ? 0.75 : 1,
            })}>
            <LinearGradient
              colors={['#7C3AED', '#1565C0']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ paddingVertical: 17, alignItems: 'center' }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 }}>
                {isSaving ? 'กำลังบันทึก...' : 'บันทึกรายการ'}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
        )}
      </ScrollView>
    </View>
  );
}
