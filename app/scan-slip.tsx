import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, ActivityIndicator, Image,
  TextInput,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Colors from '@/constants/Colors';
import { useSnackbar } from '@/components/ui/SnackbarProvider';
import { useColorScheme } from '@/components/useColorScheme';
import { WalletAvatar } from '@/components/wallet/WalletAvatar';
import { Card } from '@/components/ui/Card';
import { haptics } from '@/lib/haptics';
import { formatCurrency } from '@/lib/format';
import { useTransactionStore } from '@/stores/useTransactionStore';
import { useWalletStore } from '@/stores/useWalletStore';
import { useSummaryStore } from '@/stores/useSummaryStore';
import { categoryService } from '@/services/categoryService';
import { slipService, type SlipData } from '@/services/slipService';
import { ocrService } from '@/services/ocrService';
import type { Category, Wallet } from '@/db/schema';

type ScanMode = 'menu' | 'camera' | 'preview' | 'confirm';

type ProcessingStage = 'scanning' | 'ocr' | 'checking' | 'ready';

export default function ScanSlipScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { showSnackbar } = useSnackbar();

  // Scan state
  const [mode, setMode] = useState<ScanMode>('menu');
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedData, setScannedData] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<ProcessingStage>('scanning');
  const scanLock = useRef(false);
  const cameraRef = useRef<CameraView>(null);

  // Step 2: Parsed slip data
  const [slipData, setSlipData] = useState<SlipData | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [duplicateSlipId, setDuplicateSlipId] = useState<string | null>(null);

  // Step 2: Category & Wallet selection for confirm
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [txType, setTxType] = useState<'income' | 'expense'>('income');
  const [isSaving, setIsSaving] = useState(false);
  const [manualAmount, setManualAmount] = useState('');

  // Stores
  const { addTransaction } = useTransactionStore();
  const { wallets, loadWallets, refreshTotalBalance } = useWalletStore();
  const { loadAll: loadSummary } = useSummaryStore();

  // Load categories & wallets on mount
  useEffect(() => {
    async function load() {
      try {
        const [expense, income] = await Promise.all([
          categoryService.getByType('expense'),
          categoryService.getByType('income'),
          loadWallets(),
        ]);
        setExpenseCategories(expense);
        setIncomeCategories(income);
      } catch (e) {
        console.warn('Failed to load categories/wallets:', e);
      }
    }
    load();
  }, []);

  // Auto-select first wallet if none selected
  useEffect(() => {
    if (!selectedWalletId && wallets.length > 0) {
      setSelectedWalletId(wallets[0].id);
    }
  }, [wallets]);

  // ==========================================
  // Step 2: Process QR Data (parse + OCR + dedup)
  // Flow: QR → ref code/dedup → OCR → amount/bank/date
  // ==========================================
  const processQRData = useCallback(async (qrPayload: string, imageUri?: string) => {
    setIsProcessing(true);
    setProcessingStage('scanning');

    try {
      // Stage 1: Parse QR → ได้ ref code, bank (ถ้ามี)
      await new Promise(r => setTimeout(r, 300));
      let parsed = slipService.parseQRPayload(qrPayload);

      // Stage 2: Check duplicate (ใช้ QR hash)
      setProcessingStage('checking');
      await new Promise(r => setTimeout(r, 200));
      const dupResult = await slipService.isDuplicate(qrPayload);
      setIsDuplicate(dupResult.duplicate);
      if (dupResult.existingSlip) {
        setDuplicateSlipId(dupResult.existingSlip.id);
      }

      // Stage 3: ★ OCR — อ่านจำนวนเงิน/ธนาคาร/วันที่ จากภาพสลิป
      if (imageUri) {
        setProcessingStage('ocr');
        try {
          const ocrResult = await ocrService.recognizeSlipFromImage(imageUri);
          console.log('OCR result:', {
            amount: ocrResult.amount,
            bank: ocrResult.bankName,
            date: ocrResult.transferDate,
          });

          // รวมข้อมูล QR + OCR (OCR มี priority สำหรับ amount/bank/date)
          parsed = slipService.mergeQRAndOCR(parsed, ocrResult);
        } catch (ocrErr) {
          console.warn('OCR failed, using QR data only:', ocrErr);
          // OCR ล้มเหลว — ยังใช้ข้อมูลจาก QR ได้ + user กรอกเอง
        }
      }

      setSlipData(parsed);
      setProcessingStage('ready');
      setIsProcessing(false);

      // Auto-set category type
      setTxType('income');
      if (incomeCategories.length > 0 && !selectedCategoryId) {
        setSelectedCategoryId(incomeCategories[0].id);
      }

      if (dupResult.duplicate) {
        haptics.warning();
      } else {
        haptics.success();
      }

      setMode('confirm');
    } catch (e) {
      console.warn('processQRData error:', e);
      setIsProcessing(false);
      showSnackbar({
        message: 'ไม่สามารถประมวลผล QR Code ได้ กรุณาลองใหม่อีกครั้ง',
        variant: 'error',
        durationMs: 3200,
      });
    }
  }, [incomeCategories, selectedCategoryId]);

  // ==========================================
  // Mode A: Real-time Camera QR Scan
  // ==========================================
  const handleOpenCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        showSnackbar({
          title: 'ไม่อนุญาตกล้อง',
          message: 'กรุณาอนุญาตให้แอปเข้าถึงกล้องในตั้งค่าเครื่อง',
          variant: 'warning',
          durationMs: 3200,
        });
        return;
      }
    }
    scanLock.current = false;
    setScannedData(null);
    setSelectedImage(null);
    setSlipData(null);
    setIsDuplicate(false);
    setMode('camera');
  };

  const handleBarcodeScanned = useCallback(async (result: BarcodeScanningResult) => {
    if (scanLock.current) return;
    scanLock.current = true;

    haptics.success();
    setScannedData(result.data);

    // ★ ถ่ายภาพก่อน — ต้องทำก่อน setMode('preview')
    // เพราะ setMode จะ unmount CameraView ทำให้ cameraRef ใช้งานไม่ได้
    let capturedUri: string | undefined;
    try {
      if (cameraRef.current) {
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
        if (photo?.uri) {
          capturedUri = photo.uri;
          setSelectedImage(photo.uri);
        }
      }
    } catch (e) {
      console.warn('Failed to capture photo for OCR:', e);
    }

    setMode('preview');
    processQRData(result.data, capturedUri);
  }, [processQRData]);

  // ==========================================
  // Mode B: Pick image from Gallery
  // ==========================================
  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });

    if (result.canceled) return;

    const imageUri = result.assets[0].uri;
    setScannedData(null);
    setSlipData(null);
    setIsDuplicate(false);
    setDuplicateSlipId(null);
    setSelectedImage(imageUri);
    setIsProcessing(true);
    setProcessingStage('scanning');
    setMode('preview');

    try {
      // Step 1: ลอง scan QR จากรูป
      const qrData = await slipService.scanQRFromImage(imageUri);

      if (qrData) {
        // พบ QR → ใช้ flow เดิม (QR + OCR)
        setScannedData(qrData);
        await processQRData(qrData, imageUri);
      } else {
        // ★ ไม่พบ QR → ยังใช้ OCR อ่านข้อมูลจากภาพได้!
        setProcessingStage('ocr');
        try {
          const ocrResult = await ocrService.recognizeSlipFromImage(imageUri);
          console.log('OCR (no QR) result:', {
            amount: ocrResult.amount,
            bank: ocrResult.bankName,
            date: ocrResult.transferDate,
          });

          if (ocrResult.amount || ocrResult.bankName) {
            // OCR พบข้อมูล → สร้าง SlipData จาก OCR
            const slipFromOCR: SlipData = {
              amount: ocrResult.amount,
              bankName: ocrResult.bankName,
              transferDate: ocrResult.transferDate || new Date().toISOString().split('T')[0],
              senderName: ocrResult.senderName,
              receiverName: ocrResult.receiverName,
              refCode: ocrResult.refCode ?? null,
              rawPayload: `ocr:${imageUri}`,
            };

            setScannedData(`ocr:${Date.now()}`); // ใช้เป็น key สำหรับ dedup
            setSlipData(slipFromOCR);
            setIsProcessing(false);
            setProcessingStage('ready');

            setTxType('income');
            if (incomeCategories.length > 0 && !selectedCategoryId) {
              setSelectedCategoryId(incomeCategories[0].id);
            }

            haptics.success();
            setMode('confirm');
            return;
          }
        } catch (ocrErr) {
          console.warn('OCR fallback failed:', ocrErr);
        }

        // ทั้ง QR และ OCR ไม่พบข้อมูล
        setIsProcessing(false);
        setScannedData(null);
        haptics.warning();
        showSnackbar({
          title: 'อ่านสลิปไม่สำเร็จ',
          message: 'ไม่พบ QR Code หรือจำนวนเงินจากรูปนี้ กรุณาเลือกรูปที่ชัดขึ้น หรือใช้กล้องสแกนแทน',
          variant: 'warning',
          durationMs: 3400,
        });
      }
    } catch (e) {
      console.warn('Image scan error:', e);
      setIsProcessing(false);
      setScannedData(null);
      haptics.warning();
      showSnackbar({
        title: 'อ่านรูปไม่สำเร็จ',
        message: 'ไม่สามารถอ่านรูปสลิปนี้ได้ กรุณาลองเลือกรูปใหม่หรือใช้กล้องสแกนแทน',
        variant: 'warning',
        durationMs: 3400,
      });
    }
  };

  // ==========================================
  // Step 2: Save as Transaction
  // ==========================================
  const handleConfirmSave = async () => {
    if (isDuplicate) {
      showSnackbar({
        title: 'สลิปนี้เคยบันทึกแล้ว',
        message: 'ระบบป้องกันการบันทึกสลิปซ้ำเพื่อไม่ให้ยอดเงินและรายการธุรกรรมซ้ำกัน',
        variant: 'warning',
        durationMs: 3400,
      });
      return;
    }

    if (!slipData || !selectedCategoryId || !selectedWalletId) {
      showSnackbar({
        title: 'ข้อมูลไม่ครบ',
        message: 'กรุณาเลือกหมวดหมู่และกระเป๋าเงิน',
        variant: 'warning',
      });
      return;
    }

    // ใช้ manual amount ถ้าไม่มี amount จาก QR
    const finalAmount = slipData.amount && slipData.amount > 0
      ? slipData.amount
      : parseFloat(manualAmount.replace(/,/g, ''));

    if (!finalAmount || finalAmount <= 0 || isNaN(finalAmount)) {
      showSnackbar({
        title: 'จำนวนเงินไม่ถูกต้อง',
        message: 'กรุณากรอกจำนวนเงินให้ถูกต้อง',
        variant: 'warning',
      });
      return;
    }

    setIsSaving(true);
    try {
      // อัปเดต slipData ด้วย finalAmount
      const updatedSlipData = { ...slipData, amount: finalAmount };

      // 1. Save slip record
      const slipId = await slipService.saveScannedSlip(
        scannedData!,
        updatedSlipData,
        selectedImage || undefined,
      );

      // 2. Create transaction
      const txId = await addTransaction({
        amount: finalAmount,
        type: txType,
        categoryId: selectedCategoryId,
        walletId: selectedWalletId,
        note: buildTransactionNote(),
        date: slipData.transferDate ? new Date(slipData.transferDate) : new Date(),
      });

      // 3. Link slip to transaction
      await slipService.updateSlipStatus(slipId, 'confirmed', txId);

      // 4. Refresh UI stores so home screen shows updated balance
      await Promise.all([
        refreshTotalBalance(),
        loadWallets(),
        loadSummary(),
      ]);

      haptics.success();
      showSnackbar({
        title: 'บันทึกสำเร็จ',
        message: `บันทึกรายการ ${formatCurrency(finalAmount)} เรียบร้อย`,
        variant: 'success',
      });
      setTimeout(() => router.back(), 900);
    } catch (e) {
      console.warn('Save transaction error:', e);
      showSnackbar({
        message: 'ไม่สามารถบันทึกรายการได้ กรุณาลองใหม่',
        variant: 'error',
        durationMs: 3200,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = async () => {
    if (scannedData && slipData) {
      try {
        if (!isDuplicate) {
          const slipId = await slipService.saveScannedSlip(
            scannedData,
            slipData,
            selectedImage || undefined,
          );
          await slipService.updateSlipStatus(slipId, 'skipped');
        }
      } catch (e) {
        // Ignore save errors on skip
      }
    }
    handleReset();
  };

  const buildTransactionNote = (): string => {
    const parts: string[] = [];
    if (slipData?.bankName) parts.push(slipData.bankName);
    if (slipData?.refCode) parts.push(`Ref: ${slipData.refCode}`);
    if (slipData?.senderName) parts.push(`จาก: ${slipData.senderName}`);
    if (slipData?.receiverName) parts.push(`ถึง: ${slipData.receiverName}`);
    return parts.length > 0 ? `สลิป: ${parts.join(' | ')}` : 'สแกนจากสลิป';
  };

  // ==========================================
  // Reset to menu
  // ==========================================
  const handleReset = () => {
    setMode('menu');
    setScannedData(null);
    setSelectedImage(null);
    setIsProcessing(false);
    setSlipData(null);
    setIsDuplicate(false);
    setDuplicateSlipId(null);
    setSelectedCategoryId(null);
    setTxType('income');
    setManualAmount('');
    scanLock.current = false;
  };

  // ==========================================
  // RENDER: Menu (choose mode)
  // ==========================================
  const renderMenu = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ padding: 16, gap: 16 }}
    >
      {/* Header */}
      <View style={{ alignItems: 'center', paddingVertical: 20 }}>
        <View style={{
          width: 80, height: 80, borderRadius: 24,
          backgroundColor: colors.tint + '15',
          justifyContent: 'center', alignItems: 'center', marginBottom: 16,
        }}>
          <FontAwesome name="qrcode" size={40} color={colors.tint} />
        </View>
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>
          สแกนสลิป
        </Text>
        <Text style={{
          fontSize: 14, color: colors.textSecondary,
          textAlign: 'center', marginTop: 8, lineHeight: 22,
        }}>
          ถ่ายรูปสลิปหรือเลือกรูปจาก Gallery{'\n'}เพื่ออ่าน QR Code และบันทึกอัตโนมัติ
        </Text>
      </View>

      {/* Mode A: Camera */}
      <Pressable
        onPress={handleOpenCamera}
        style={({ pressed }) => ({
          borderRadius: 16, overflow: 'hidden',
          opacity: pressed ? 0.9 : 1,
        })}
      >
        <Card variant="elevated" style={{ padding: 0 }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', padding: 20, gap: 16,
          }}>
            <View style={{
              width: 60, height: 60, borderRadius: 18,
              backgroundColor: '#2196F3' + '15',
              justifyContent: 'center', alignItems: 'center',
            }}>
              <FontAwesome name="camera" size={26} color="#2196F3" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>
                ถ่ายรูปสลิป
              </Text>
              <Text style={{
                fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 20,
              }}>
                เปิดกล้อง สแกน QR Code แบบเรียลไทม์{'\n'}เร็วที่สุด แค่ส่องกล้องไปที่สลิป
              </Text>
            </View>
            <FontAwesome name="chevron-right" size={14} color={colors.textSecondary} />
          </View>
        </Card>
      </Pressable>

      {/* Mode B: Gallery */}
      <Pressable
        onPress={handlePickImage}
        style={({ pressed }) => ({
          borderRadius: 16, overflow: 'hidden',
          opacity: pressed ? 0.9 : 1,
        })}
      >
        <Card variant="elevated" style={{ padding: 0 }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', padding: 20, gap: 16,
          }}>
            <View style={{
              width: 60, height: 60, borderRadius: 18,
              backgroundColor: '#4CAF50' + '15',
              justifyContent: 'center', alignItems: 'center',
            }}>
              <FontAwesome name="image" size={26} color="#4CAF50" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>
                เลือกรูปจาก Gallery
              </Text>
              <Text style={{
                fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 20,
              }}>
                เลือกรูปสลิปที่บันทึกไว้ในเครื่อง{'\n'}รองรับสลิปจาก Mobile Banking ทุกธนาคาร
              </Text>
            </View>
            <FontAwesome name="chevron-right" size={14} color={colors.textSecondary} />
          </View>
        </Card>
      </Pressable>

      {/* Tips */}
      <Card variant="elevated">
        <View style={{ padding: 4 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
            เคล็ดลับ
          </Text>
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>
              - QR Code สลิปอยู่มุมขวาล่างของสลิปส่วนใหญ่
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>
              - ถ่ายรูปในที่ที่มีแสงสว่างเพียงพอ
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>
              - รองรับสลิป K Plus, SCB Easy, กรุงไทย, กรุงศรี ฯลฯ
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>
              - ระบบตรวจสอบสลิปซ้ำอัตโนมัติ ไม่ต้องกังวลบันทึกซ้ำ
            </Text>
          </View>
        </View>
      </Card>

      <View style={{ height: 40 }} />
    </ScrollView>
  );

  // ==========================================
  // RENDER: Camera (Mode A)
  // ==========================================
  const renderCamera = () => (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        ref={cameraRef}
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={handleBarcodeScanned}
      />
      {/* Overlay — absolute so it doesn't nest inside CameraView */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'space-between' }}>
        {/* Top Bar */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 20, paddingTop: 50,
        }}>
          <Pressable
            onPress={handleReset}
            style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: 'rgba(0,0,0,0.5)',
              justifyContent: 'center', alignItems: 'center',
            }}
          >
            <FontAwesome name="arrow-left" size={18} color="#FFF" />
          </Pressable>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFF' }}>
            สแกน QR Code
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Scanning Frame */}
        <View style={{ alignItems: 'center' }}>
          <View style={{
            width: 250, height: 250,
            borderWidth: 3, borderColor: '#2196F3',
            borderRadius: 20,
          }}>
            {/* Corner Markers */}
            <View style={{ position: 'absolute', top: -3, left: -3, width: 30, height: 30, borderTopWidth: 5, borderLeftWidth: 5, borderColor: '#FFF', borderTopLeftRadius: 20 }} />
            <View style={{ position: 'absolute', top: -3, right: -3, width: 30, height: 30, borderTopWidth: 5, borderRightWidth: 5, borderColor: '#FFF', borderTopRightRadius: 20 }} />
            <View style={{ position: 'absolute', bottom: -3, left: -3, width: 30, height: 30, borderBottomWidth: 5, borderLeftWidth: 5, borderColor: '#FFF', borderBottomLeftRadius: 20 }} />
            <View style={{ position: 'absolute', bottom: -3, right: -3, width: 30, height: 30, borderBottomWidth: 5, borderRightWidth: 5, borderColor: '#FFF', borderBottomRightRadius: 20 }} />
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 16 }}>
            ส่องกล้องไปที่ QR Code บนสลิป
          </Text>
        </View>

        {/* Bottom Actions */}
        <View style={{
          flexDirection: 'row', justifyContent: 'center',
          paddingBottom: 60, gap: 40,
        }}>
          <Pressable onPress={handlePickImage} style={{ alignItems: 'center', gap: 6 }}>
            <View style={{
              width: 50, height: 50, borderRadius: 25,
              backgroundColor: 'rgba(255,255,255,0.2)',
              justifyContent: 'center', alignItems: 'center',
            }}>
              <FontAwesome name="image" size={22} color="#FFF" />
            </View>
            <Text style={{ color: '#FFF', fontSize: 12 }}>Gallery</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );

  // ==========================================
  // RENDER: Processing / Preview
  // ==========================================
  const renderPreview = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ padding: 16, gap: 16 }}
    >
      {/* Processing Status */}
      <Card variant="elevated">
        <View style={{ alignItems: 'center', padding: 8 }}>
          {isProcessing ? (
            <>
              <ActivityIndicator size="large" color={colors.tint} />
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 16 }}>
                {processingStage === 'scanning' && 'กำลังอ่าน QR Code...'}
                {processingStage === 'checking' && 'กำลังตรวจสอบสลิปซ้ำ...'}
                {processingStage === 'ocr' && 'กำลังอ่านข้อมูลจากภาพสลิป...'}
                {processingStage === 'ready' && 'เตรียมข้อมูลพร้อม...'}
              </Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
                {processingStage === 'scanning' && 'กำลังแปลงข้อมูลจาก QR Code'}
                {processingStage === 'checking' && 'ตรวจสอบว่าเคยสแกนสลิปนี้หรือไม่'}
                {processingStage === 'ocr' && 'ใช้ OCR อ่านจำนวนเงิน, ธนาคาร, วันที่'}
                {processingStage === 'ready' && 'พร้อมแสดงผล'}
              </Text>
            </>
          ) : scannedData ? (
            <>
              <View style={{
                width: 64, height: 64, borderRadius: 32,
                backgroundColor: colors.income + '15',
                justifyContent: 'center', alignItems: 'center', marginBottom: 12,
              }}>
                <FontAwesome name="check-circle" size={32} color={colors.income} />
              </View>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.income }}>
                พบ QR Code!
              </Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
                กำลังนำไปประมวลผล...
              </Text>
            </>
          ) : (
            <>
              <View style={{
                width: 64, height: 64, borderRadius: 32,
                backgroundColor: '#FF9800' + '15',
                justifyContent: 'center', alignItems: 'center', marginBottom: 12,
              }}>
                <FontAwesome name="exclamation-triangle" size={28} color="#FF9800" />
              </View>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>
                ไม่พบ QR Code ในรูป
              </Text>
              <Text style={{
                fontSize: 13, color: colors.textSecondary,
                marginTop: 4, textAlign: 'center', lineHeight: 20,
              }}>
                ลองถ่ายรูปใหม่ให้ชัดขึ้น{'\n'}หรือใช้โหมดกล้องสแกนเรียลไทม์แทน
              </Text>
            </>
          )}
        </View>
      </Card>

      {/* Show selected image */}
      {selectedImage && (
        <Card variant="elevated" style={{ padding: 0, overflow: 'hidden' }}>
          <Image
            source={{ uri: selectedImage }}
            style={{ width: '100%', height: 300 }}
            resizeMode="contain"
          />
        </Card>
      )}

      {/* Action Buttons */}
      <View style={{ gap: 10, marginTop: 8 }}>
        {!scannedData && !isProcessing && (
          <Pressable
            onPress={handleOpenCamera}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              paddingVertical: 16, borderRadius: 14,
              backgroundColor: pressed ? '#1976D2' : '#2196F3',
            })}
          >
            <FontAwesome name="camera" size={18} color="#FFF" />
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFF' }}>
              ใช้กล้องสแกนแทน
            </Text>
          </Pressable>
        )}

        <Pressable
          onPress={handleReset}
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            paddingVertical: 14, borderRadius: 14,
            backgroundColor: pressed ? colors.border : colors.background,
            borderWidth: 1, borderColor: colors.border,
          })}
        >
          <FontAwesome name="refresh" size={16} color={colors.textSecondary} />
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textSecondary }}>
            กลับหน้าเมนู
          </Text>
        </Pressable>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );

  // ==========================================
  // RENDER: Confirm Screen (Step 2 main UI)
  // ==========================================
  const currentCategories = txType === 'income' ? incomeCategories : expenseCategories;
  const isSaveDisabled =
    isSaving ||
    isDuplicate ||
    (!slipData?.amount && !manualAmount) ||
    !selectedCategoryId ||
    !selectedWalletId;

  const renderConfirm = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ padding: 16, gap: 16 }}
    >
      {/* Duplicate Warning */}
      {isDuplicate && (
        <Card variant="elevated" style={{
          backgroundColor: '#FFF3E0',
          borderWidth: 1, borderColor: '#FF9800',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <FontAwesome name="exclamation-triangle" size={24} color="#FF9800" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#E65100' }}>
                สลิปซ้ำ!
              </Text>
              <Text style={{ fontSize: 13, color: '#BF360C', marginTop: 2 }}>
                สลิปนี้เคยถูกสแกนและบันทึกแล้ว{'\n'}ระบบจึงปิดการบันทึกซ้ำเพื่อป้องกันยอดธุรกรรมซ้ำ
              </Text>
              {duplicateSlipId && (
                <Text style={{ fontSize: 11, color: '#8D4A00', marginTop: 6 }}>
                  รหัสสลิปเดิม: {duplicateSlipId}
                </Text>
              )}
            </View>
          </View>
        </Card>
      )}

      {/* Parsed Slip Data */}
      <View>
        <Text style={{
          fontSize: 13, fontWeight: '600', color: colors.textSecondary,
          marginBottom: 8, paddingHorizontal: 4,
        }}>
          ข้อมูลจากสลิป
        </Text>
        <Card variant="elevated">
          {/* Amount */}
          <View style={{ alignItems: 'center', paddingVertical: 8 }}>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>จำนวนเงิน</Text>
            {slipData?.amount ? (
              <Text style={{
                fontSize: 32, fontWeight: '800',
                color: colors.income, marginTop: 4,
              }}>
                {formatCurrency(slipData.amount)}
              </Text>
            ) : (
              <View style={{ alignItems: 'center', marginTop: 8, width: '100%' }}>
                <Text style={{
                  fontSize: 13, color: '#FF9800', marginBottom: 8, textAlign: 'center',
                }}>
                  ไม่พบจำนวนเงินจาก QR — กรุณากรอกด้านล่าง
                </Text>
                <TextInput
                  value={manualAmount}
                  onChangeText={setManualAmount}
                  placeholder="กรอกจำนวนเงิน เช่น 1500.00"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="decimal-pad"
                  style={{
                    fontSize: 24, fontWeight: '800', textAlign: 'center',
                    color: colors.text, borderWidth: 2, borderColor: '#FF9800',
                    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16,
                    width: '80%', backgroundColor: colors.background,
                  }}
                />
              </View>
            )}
          </View>

          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 8 }} />

          {/* Details Grid */}
          <View style={{ gap: 12 }}>
            <DetailRow
              label="ธนาคาร"
              value={slipData?.bankName || 'ไม่ระบุ'}
              icon="university"
              colors={colors}
            />
            <DetailRow
              label="วันที่โอน"
              value={slipData?.transferDate || 'ไม่ระบุ'}
              icon="calendar"
              colors={colors}
            />
            <DetailRow
              label="Ref Code"
              value={slipData?.refCode || 'ไม่มี'}
              icon="tag"
              colors={colors}
            />
            {slipData?.senderName && (
              <DetailRow
                label="ผู้โอน"
                value={slipData.senderName}
                icon="user"
                colors={colors}
              />
            )}
            {slipData?.receiverName && (
              <DetailRow
                label="ผู้รับ"
                value={slipData.receiverName}
                icon="user-o"
                colors={colors}
              />
            )}
          </View>
        </Card>
      </View>

      {/* Transaction Type Toggle */}
      <View>
        <Text style={{
          fontSize: 13, fontWeight: '600', color: colors.textSecondary,
          marginBottom: 8, paddingHorizontal: 4,
        }}>
          ประเภทรายการ
        </Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable
            onPress={() => {
              setTxType('income');
              if (incomeCategories.length > 0) setSelectedCategoryId(incomeCategories[0].id);
              else setSelectedCategoryId(null);
            }}
            style={{
              flex: 1, paddingVertical: 12, borderRadius: 12,
              backgroundColor: txType === 'income' ? colors.income + '15' : colors.cardBackground,
              borderWidth: 2,
              borderColor: txType === 'income' ? colors.income : colors.border,
              alignItems: 'center',
            }}
          >
            <Text style={{
              fontSize: 15, fontWeight: '700',
              color: txType === 'income' ? colors.income : colors.textSecondary,
            }}>
              รายรับ
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setTxType('expense');
              if (expenseCategories.length > 0) setSelectedCategoryId(expenseCategories[0].id);
              else setSelectedCategoryId(null);
            }}
            style={{
              flex: 1, paddingVertical: 12, borderRadius: 12,
              backgroundColor: txType === 'expense' ? colors.expense + '15' : colors.cardBackground,
              borderWidth: 2,
              borderColor: txType === 'expense' ? colors.expense : colors.border,
              alignItems: 'center',
            }}
          >
            <Text style={{
              fontSize: 15, fontWeight: '700',
              color: txType === 'expense' ? colors.expense : colors.textSecondary,
            }}>
              รายจ่าย
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Category Selection */}
      <View>
        <Text style={{
          fontSize: 13, fontWeight: '600', color: colors.textSecondary,
          marginBottom: 8, paddingHorizontal: 4,
        }}>
          หมวดหมู่
        </Text>
        <Card variant="elevated" style={{ padding: 8 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {currentCategories.map((cat) => (
              <Pressable
                key={cat.id}
                onPress={() => setSelectedCategoryId(cat.id)}
                style={{
                  paddingHorizontal: 14, paddingVertical: 10,
                  borderRadius: 10,
                  backgroundColor: selectedCategoryId === cat.id
                    ? (cat.color || colors.tint) + '20'
                    : colors.background,
                  borderWidth: 2,
                  borderColor: selectedCategoryId === cat.id
                    ? (cat.color || colors.tint)
                    : colors.border,
                }}
              >
                <Text style={{
                  fontSize: 13, fontWeight: selectedCategoryId === cat.id ? '700' : '500',
                  color: selectedCategoryId === cat.id
                    ? (cat.color || colors.tint)
                    : colors.textSecondary,
                }}>
                  {cat.icon} {cat.name}
                </Text>
              </Pressable>
            ))}
          </View>
          {currentCategories.length === 0 && (
            <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', padding: 16 }}>
              ไม่มีหมวดหมู่{txType === 'income' ? 'รายรับ' : 'รายจ่าย'}
            </Text>
          )}
        </Card>
      </View>

      {/* Wallet Selection */}
      <View>
        <Text style={{
          fontSize: 13, fontWeight: '600', color: colors.textSecondary,
          marginBottom: 8, paddingHorizontal: 4,
        }}>
          กระเป๋าเงิน
        </Text>
        <Card variant="elevated" style={{ padding: 8 }}>
          <View style={{ gap: 4 }}>
            {wallets.map((wallet) => (
              <Pressable
                key={wallet.id}
                onPress={() => setSelectedWalletId(wallet.id)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  paddingVertical: 10, paddingHorizontal: 12,
                  borderRadius: 10,
                  backgroundColor: selectedWalletId === wallet.id
                    ? colors.tint + '10'
                    : 'transparent',
                  borderWidth: selectedWalletId === wallet.id ? 2 : 0,
                  borderColor: colors.tint,
                }}
              >
                <WalletAvatar
                  icon={wallet.icon}
                  size={34}
                  backgroundColor={selectedWalletId === wallet.id ? colors.tint + '20' : undefined}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{
                    fontSize: 15, fontWeight: '600', color: colors.text,
                  }}>
                    {wallet.name}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    {formatCurrency(wallet.balance ?? 0)}
                  </Text>
                </View>
                {selectedWalletId === wallet.id && (
                  <FontAwesome name="check-circle" size={20} color={colors.tint} />
                )}
              </Pressable>
            ))}
          </View>
        </Card>
      </View>

      {/* Action Buttons */}
      <View style={{ gap: 10, marginTop: 8 }}>
        {/* Confirm Save Button */}
        <Pressable
          onPress={handleConfirmSave}
          disabled={isSaveDisabled}
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            paddingVertical: 16, borderRadius: 14,
            backgroundColor: isSaveDisabled
              ? '#9E9E9E'
              : pressed ? '#388E3C' : '#4CAF50',
            opacity: isSaving ? 0.7 : 1,
          })}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <FontAwesome name="check" size={18} color="#FFF" />
          )}
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFF' }}>
            {isSaving ? 'กำลังบันทึก...' : isDuplicate ? 'สลิปนี้บันทึกแล้ว' : 'ยืนยันบันทึก'}
          </Text>
        </Pressable>

        {/* Skip Button */}
        <Pressable
          onPress={handleSkip}
          disabled={isSaving}
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            paddingVertical: 14, borderRadius: 14,
            backgroundColor: pressed ? '#FFEBEE' : 'transparent',
            borderWidth: 1, borderColor: '#F44336' + '50',
          })}
        >
          <FontAwesome name="times" size={16} color="#F44336" />
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#F44336' }}>
            ข้าม (ไม่บันทึก)
          </Text>
        </Pressable>

        {/* Scan Again */}
        <Pressable
          onPress={handleReset}
          disabled={isSaving}
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            paddingVertical: 14, borderRadius: 14,
            backgroundColor: pressed ? colors.border : colors.background,
            borderWidth: 1, borderColor: colors.border,
          })}
        >
          <FontAwesome name="refresh" size={16} color={colors.textSecondary} />
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textSecondary }}>
            สแกนใหม่
          </Text>
        </Pressable>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );

  // ==========================================
  // MAIN RENDER
  // ==========================================
  return (
    <View style={{ flex: 1, backgroundColor: mode === 'camera' ? '#000' : colors.background }}>
      {mode !== 'camera' && (
        <Stack.Screen
          options={{
            title: mode === 'confirm' ? 'ยืนยันรายการ' : 'สแกนสลิป',
            headerStyle: { backgroundColor: colors.tint },
            headerTintColor: '#FFF',
          }}
        />
      )}
      {mode === 'camera' && (
        <Stack.Screen options={{ headerShown: false }} />
      )}

      {mode === 'menu' && renderMenu()}
      {mode === 'camera' && renderCamera()}
      {mode === 'preview' && renderPreview()}
      {mode === 'confirm' && renderConfirm()}
    </View>
  );
}

// ==========================================
// Helper Component: Detail Row
// ==========================================
function DetailRow({ label, value, icon, colors }: {
  label: string;
  value: string;
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  colors: any;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{
        width: 32, height: 32, borderRadius: 8,
        backgroundColor: colors.tint + '10',
        justifyContent: 'center', alignItems: 'center',
      }}>
        <FontAwesome name={icon} size={14} color={colors.tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 12, color: colors.textSecondary }}>{label}</Text>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }} selectable>
          {value}
        </Text>
      </View>
    </View>
  );
}
