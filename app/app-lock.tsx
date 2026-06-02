import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, Alert, Switch, TextInput,
} from 'react-native';
import { Stack } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Colors from '@/constants/Colors';
import { useSnackbar } from '@/components/ui/SnackbarProvider';
import { useColorScheme } from '@/components/useColorScheme';
import { Card } from '@/components/ui/Card';
import { authService } from '@/services/authService';
import { haptics } from '@/lib/haptics';

export default function AppLockScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { showSnackbar } = useSnackbar();

  const [lockEnabled, setLockEnabled] = useState(false);
  const [hasPIN, setHasPIN] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricName, setBiometricName] = useState('Biometric');
  const [showPINModal, setShowPINModal] = useState(false);
  const [pinStep, setPinStep] = useState<'set' | 'confirm' | 'verify'>('set');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [tempPin, setTempPin] = useState('');

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    const [locked, hasPin, bio, bioName] = await Promise.all([
      authService.isLockEnabled(),
      authService.hasPIN(),
      authService.checkBiometricSupport(),
      authService.getBiometricTypeName(),
    ]);
    setLockEnabled(locked);
    setHasPIN(hasPin);
    setBiometricAvailable(bio.isAvailable);
    setBiometricName(bioName);
  };

  const handleToggleLock = async (enabled: boolean) => {
    if (enabled) {
      // ต้องตั้ง PIN ก่อนเปิด lock
      if (!hasPIN) {
        setPinStep('set');
        setPin('');
        setConfirmPin('');
        setShowPINModal(true);
        return;
      }
      await authService.setLockEnabled(true);
      setLockEnabled(true);
      haptics.success();
    } else {
      // ปิด lock ต้องยืนยัน PIN ก่อน
      if (hasPIN) {
        setPinStep('verify');
        setPin('');
        setShowPINModal(true);
        return;
      }
      await authService.setLockEnabled(false);
      setLockEnabled(false);
    }
  };

  const handlePINSubmit = async () => {
    if (pinStep === 'set') {
      if (pin.length < 4) {
        showSnackbar({ message: 'PIN ต้องมีอย่างน้อย 4 หลัก', variant: 'warning' });
        return;
      }
      setTempPin(pin);
      setPinStep('confirm');
      setPin('');
      return;
    }

    if (pinStep === 'confirm') {
      if (pin !== tempPin) {
        haptics.error();
        showSnackbar({
          title: 'PIN ไม่ตรงกัน',
          message: 'กรุณาลองใหม่อีกครั้ง',
          variant: 'error',
        });
        setPinStep('set');
        setPin('');
        setTempPin('');
        return;
      }
      await authService.setPIN(pin);
      await authService.setLockEnabled(true);
      setHasPIN(true);
      setLockEnabled(true);
      setShowPINModal(false);
      setPin('');
      setTempPin('');
      haptics.success();
      showSnackbar({
        title: 'ตั้งค่า PIN แล้ว',
        message: 'ตั้งค่า PIN เรียบร้อยแล้ว',
        variant: 'success',
      });
      return;
    }

    if (pinStep === 'verify') {
      const valid = await authService.verifyPIN(pin);
      if (!valid) {
        haptics.error();
        showSnackbar({
          title: 'PIN ไม่ถูกต้อง',
          message: 'กรุณาลองใหม่',
          variant: 'error',
        });
        setPin('');
        return;
      }
      await authService.setLockEnabled(false);
      setLockEnabled(false);
      setShowPINModal(false);
      setPin('');
      haptics.success();
    }
  };

  const handleChangePIN = () => {
    setPinStep('set');
    setPin('');
    setConfirmPin('');
    setTempPin('');
    setShowPINModal(true);
  };

  const handleRemovePIN = () => {
    Alert.alert('ลบ PIN', 'ต้องการลบ PIN หรือไม่? การล็อคแอปจะถูกปิด', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ลบ',
        style: 'destructive',
        onPress: async () => {
          await authService.removePIN();
          await authService.setLockEnabled(false);
          setHasPIN(false);
          setLockEnabled(false);
          haptics.success();
        },
      },
    ]);
  };

  const handleTestBiometric = async () => {
    const success = await authService.authenticateWithBiometric();
    if (success) {
      haptics.success();
      showSnackbar({
        title: 'ทดสอบสำเร็จ',
        message: `${biometricName} ใช้งานได้ปกติ`,
        variant: 'success',
      });
    } else {
      haptics.error();
      showSnackbar({
        title: 'ไม่สำเร็จ',
        message: 'การยืนยันตัวตนล้มเหลว',
        variant: 'error',
      });
    }
  };

  const PINDot = ({ filled }: { filled: boolean }) => (
    <View style={{
      width: 16, height: 16, borderRadius: 8, marginHorizontal: 8,
      backgroundColor: filled ? colors.tint : 'transparent',
      borderWidth: 2, borderColor: colors.tint,
    }} />
  );

  const PINButton = ({ label, onPress }: { label: string; onPress: () => void }) => (
    <Pressable
      onPress={() => { haptics.light(); onPress(); }}
      style={({ pressed }) => ({
        width: 72, height: 72, borderRadius: 36,
        justifyContent: 'center', alignItems: 'center',
        backgroundColor: pressed ? colors.border : colors.background,
      })}>
      <Text style={{ fontSize: 28, fontWeight: '600', color: colors.text }}>{label}</Text>
    </Pressable>
  );

  const handlePINInput = (digit: string) => {
    if (pin.length < 6) {
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin.length >= 4) {
        // auto-submit after 4+ digits possible, but let user press confirm
      }
    }
  };

  const handlePINDelete = () => {
    setPin(pin.slice(0, -1));
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          title: 'ล็อคแอป',
          headerStyle: { backgroundColor: colors.tint },
          headerTintColor: '#FFF',
        }}
      />

      {showPINModal ? (
        /* PIN Input Full Screen */
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: colors.tint + '15', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
            <FontAwesome name="lock" size={28} color={colors.tint} />
          </View>

          <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 8 }}>
            {pinStep === 'set' ? 'ตั้งค่า PIN ใหม่' : pinStep === 'confirm' ? 'ยืนยัน PIN อีกครั้ง' : 'กรอก PIN'}
          </Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 32 }}>
            {pinStep === 'set' ? 'กรอก PIN 4-6 หลัก' : pinStep === 'confirm' ? 'กรอก PIN เดิมอีกครั้ง' : 'กรอก PIN เพื่อยืนยัน'}
          </Text>

          {/* PIN Dots */}
          <View style={{ flexDirection: 'row', marginBottom: 40 }}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <PINDot key={i} filled={i < pin.length} />
            ))}
          </View>

          {/* Number Pad */}
          <View style={{ gap: 12 }}>
            {[[1, 2, 3], [4, 5, 6], [7, 8, 9]].map((row, ri) => (
              <View key={ri} style={{ flexDirection: 'row', gap: 20, justifyContent: 'center' }}>
                {row.map((n) => (
                  <PINButton key={n} label={String(n)} onPress={() => handlePINInput(String(n))} />
                ))}
              </View>
            ))}
            <View style={{ flexDirection: 'row', gap: 20, justifyContent: 'center' }}>
              <Pressable
                onPress={() => { setShowPINModal(false); setPin(''); setTempPin(''); }}
                style={{ width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.expense }}>ยกเลิก</Text>
              </Pressable>
              <PINButton label="0" onPress={() => handlePINInput('0')} />
              {pin.length > 0 ? (
                <Pressable
                  onPress={pin.length >= 4 ? handlePINSubmit : handlePINDelete}
                  style={{ width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' }}>
                  {pin.length >= 4 ? (
                    <FontAwesome name="check-circle" size={32} color={colors.income} />
                  ) : (
                    <FontAwesome name="arrow-left" size={22} color={colors.textSecondary} />
                  )}
                </Pressable>
              ) : (
                <View style={{ width: 72, height: 72 }} />
              )}
            </View>
          </View>
        </View>
      ) : (
        /* Settings View */
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 16 }}>
          {/* Lock Toggle */}
          <Card variant="elevated">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: '#F44336' + '15', justifyContent: 'center', alignItems: 'center' }}>
                <FontAwesome name="lock" size={22} color="#F44336" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>ล็อคแอป</Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                  ต้องยืนยันตัวตนก่อนเข้าใช้งาน
                </Text>
              </View>
              <Switch
                value={lockEnabled}
                onValueChange={handleToggleLock}
                trackColor={{ true: colors.tint }}
              />
            </View>
          </Card>

          {/* Biometric */}
          {biometricAvailable && (
            <Card variant="elevated">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: '#4CAF50' + '15', justifyContent: 'center', alignItems: 'center' }}>
                  <FontAwesome name="hand-stop-o" size={22} color="#4CAF50" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{biometricName}</Text>
                  <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                    ใช้ {biometricName} ในการปลดล็อค
                  </Text>
                </View>
                <Pressable
                  onPress={handleTestBiometric}
                  style={({ pressed }) => ({
                    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10,
                    backgroundColor: pressed ? '#388E3C' : '#4CAF50',
                  })}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#FFF' }}>ทดสอบ</Text>
                </Pressable>
              </View>
            </Card>
          )}

          {/* PIN Management */}
          <View>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8, paddingHorizontal: 4 }}>
              รหัส PIN
            </Text>
            <Card variant="elevated" style={{ padding: 0, overflow: 'hidden' }}>
              <Pressable
                onPress={handleChangePIN}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12,
                  backgroundColor: pressed ? colors.border + '40' : 'transparent',
                })}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.tint + '15', justifyContent: 'center', alignItems: 'center' }}>
                  <FontAwesome name="key" size={16} color={colors.tint} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '500', color: colors.text }}>
                    {hasPIN ? 'เปลี่ยน PIN' : 'ตั้งค่า PIN'}
                  </Text>
                </View>
                <FontAwesome name="chevron-right" size={12} color={colors.textSecondary} />
              </Pressable>

              {hasPIN && (
                <>
                  <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 16 }} />
                  <Pressable
                    onPress={handleRemovePIN}
                    style={({ pressed }) => ({
                      flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12,
                      backgroundColor: pressed ? colors.border + '40' : 'transparent',
                    })}>
                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.expense + '15', justifyContent: 'center', alignItems: 'center' }}>
                      <FontAwesome name="trash" size={16} color={colors.expense} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '500', color: colors.expense }}>ลบ PIN</Text>
                    </View>
                  </Pressable>
                </>
              )}
            </Card>
          </View>

          {/* Info */}
          <Card variant="elevated">
            <View style={{ padding: 4 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>ข้อมูล</Text>
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                  • PIN จะถูกเก็บอย่างปลอดภัยใน Secure Store
                </Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                  • {biometricAvailable ? `${biometricName} พร้อมใช้งาน` : 'อุปกรณ์ไม่รองรับ Biometric'}
                </Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                  • ล็อคจะทำงานทุกครั้งที่เปิดแอป
                </Text>
              </View>
            </View>
          </Card>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}
