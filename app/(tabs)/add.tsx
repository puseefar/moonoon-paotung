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
import { CategoryGrid } from '@/components/category/CategoryGrid';
import { useTransactionStore } from '@/stores/useTransactionStore';
import { useWalletStore } from '@/stores/useWalletStore';
import { useSummaryStore } from '@/stores/useSummaryStore';
import { categoryService } from '@/services/categoryService';
import { quickAddLearningService } from '@/services/quickAddLearningService';
import {
  quickAddParser,
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

const AUTO_RETURN_SECONDS = 15;

export default function AddTransactionScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { showSnackbar } = useSnackbar();
  const router = useRouter();

  // ── Countdown กลับหน้าหลักอัตโนมัติ ──────────────────────────────────────
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function clearCountdown() {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdown(null);
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

  // Categories
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<Category[]>([]);

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
  }, [loadWallets]);

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
      return () => { clearCountdown(); };
    }, [])
  );

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
    setSelectedCategory((prev) => resolvedCategory ?? (prev?.type === resolvedType ? prev : null));
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
      setNote('');
      setDate(new Date());
      setQuickAddText('');
      setQuickAddPreview(null);
      setManualTypeOverride(null);
      showSnackbar({
        title: 'บันทึกรายการแล้ว ✅',
        message: `กำลังกลับหน้าหลักใน ${AUTO_RETURN_SECONDS} วินาที`,
        variant: 'success',
        durationMs: 4000,
      });
      startCountdown();
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
  const previewGuessText = quickAddPreview
    ? `${quickAddPreview.type === 'income' ? 'รายรับ' : 'รายจ่าย'} > ${quickAddPreview.category?.name ?? 'ยังไม่พบหมวด'}`
    : '';

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
        onScrollBeginDrag={dismissInlineKeyboard}>
        {/* Tab: รายจ่าย / รายรับ */}
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

        <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.cardBackground,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              paddingLeft: 14,
              overflow: 'hidden',
            }}>
            <FontAwesome name="magic" size={16} color="#42A5F5" />
            <TextInput
              ref={quickAddInputRef}
              value={quickAddText}
              onChangeText={handleQuickAddTextChange}
              placeholder='พิมพ์รายการ หรือกดไมค์บนคีย์บอร์ด เช่น "กาแฟ 45"'
              placeholderTextColor={colors.textSecondary}
              returnKeyType="done"
              onSubmitEditing={handleApplyQuickAdd}
              style={{
                flex: 1,
                fontSize: 15,
                color: colors.text,
                paddingVertical: 13,
                paddingHorizontal: 10,
              }}
            />
            {/* ปุ่มไมค์ — กดเพื่อเปิดคีย์บอร์ด แล้วใช้ไมค์บนคีย์บอร์ด Android */}
            <Pressable
              onPress={() => quickAddInputRef.current?.focus()}
              style={({ pressed }) => ({
                alignSelf: 'stretch',
                justifyContent: 'center',
                paddingHorizontal: 12,
                borderLeftWidth: 1,
                borderLeftColor: colors.border,
                backgroundColor: pressed ? '#42A5F518' : 'transparent',
              })}>
              <FontAwesome name="microphone" size={17} color="#42A5F5" />
            </Pressable>
            <Pressable
              onPress={handleApplyQuickAdd}
              style={({ pressed }) => ({
                alignSelf: 'stretch',
                justifyContent: 'center',
                overflow: 'hidden',
                opacity: pressed ? 0.85 : 1,
                paddingHorizontal: 16,
              })}>
              <LinearGradient
                colors={['#7C3AED', '#1565C0']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFillObject}
              />
              <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700' }}>
                เพิ่ม
              </Text>
            </Pressable>
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
                  Preview
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
              <Text style={{ fontSize: 12, color: previewConfidenceColor, fontWeight: '700' }}>
                ระบบเดาว่า: {previewGuessText}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                กระเป๋า: {selectedWallet?.name ?? 'ยังไม่เลือก'} · โน้ต: {quickAddPreview.note || '-'}
              </Text>
              {quickAddPreview.confidence !== 'high' ? (
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  ถ้าระบบเดาผิด เลือกหมวดใหม่ 1 ครั้ง แล้วครั้งต่อไปแอปจะจำให้เอง
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
          )}
        </View>

        {/* แสดงจำนวนเงิน */}
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

        {/* หมวดหมู่ */}
        <View style={{ marginTop: 20, paddingHorizontal: 16 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: '700',
              color: colors.text,
              marginBottom: 12,
            }}>
            หมวดหมู่
          </Text>
        </View>
        <CategoryGrid
          categories={categories}
          selectedId={selectedCategory?.id ?? null}
          onSelect={setSelectedCategory}
        />

        {/* กระเป๋าเงิน */}
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

          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
              maximumDate={new Date()}
            />
          )}

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

        {/* Countdown Banner */}
        {countdown !== null && countdown > 0 && (
          <View style={{
            marginHorizontal: 16, marginTop: 16, marginBottom: 4,
            backgroundColor: '#E8F5E9', borderRadius: 16,
            borderWidth: 1.5, borderColor: '#4CAF50',
            padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
          }}>
            {/* Progress arc indicator */}
            <View style={{
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: '#4CAF50', justifyContent: 'center', alignItems: 'center',
            }}>
              <Text style={{ fontSize: 17, fontWeight: '900', color: '#fff' }}>{countdown}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#2E7D32' }}>
                บันทึกแล้ว! กลับหน้าหลักอัตโนมัติ
              </Text>
              <Text style={{ fontSize: 12, color: '#4CAF50', marginTop: 2 }}>
                กดยกเลิกถ้าต้องการบันทึกต่อ
              </Text>
            </View>
            <Pressable
              onPress={clearCountdown}
              style={({ pressed }) => ({
                backgroundColor: pressed ? '#C8E6C9' : '#A5D6A7',
                borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
              })}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#1B5E20' }}>ยกเลิก</Text>
            </Pressable>
          </View>
        )}

        {/* ปุ่มบันทึก */}
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
      </ScrollView>
    </View>
  );
}
