import { useState, useEffect } from 'react';
import {
  View, Text, Pressable, Image, StyleSheet, StatusBar,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useSnackbar } from '@/components/ui/SnackbarProvider';
import { authService } from '@/services/authService';
import { haptics } from '@/lib/haptics';
import { theme } from '@/lib/theme';

const LOGO = require('../../assets/logo/logo-moonoon-paotung-padded.png') as number;

type Mode = 'unlock' | 'setup' | 'confirm';

type Props = {
  onUnlock: () => void;
};

export function LockScreen({ onUnlock }: Props) {
  const { showSnackbar } = useSnackbar();
  const [mode, setMode]       = useState<Mode>('unlock');
  const [pin, setPin]         = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [bioAvail, setBioAvail] = useState(false);
  const [bioName, setBioName]   = useState('Biometric');
  const [shake, setShake]       = useState(false);

  const MAX = 6;

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const hasPin = await authService.hasPIN();
    if (!hasPin) {
      setMode('setup');
      return;
    }
    const bio = await authService.checkBiometricSupport();
    setBioAvail(bio.isAvailable);
    const name = await authService.getBiometricTypeName();
    setBioName(name);
    if (bio.isAvailable) {
      const ok = await authService.authenticateWithBiometric();
      if (ok) { haptics.success(); onUnlock(); }
    }
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  const handleDigit = async (d: string) => {
    if (pin.length >= MAX) return;
    haptics.light();
    const next = pin + d;
    setPin(next);

    if (next.length === MAX) {
      // small delay to show last dot filled
      setTimeout(() => processPin(next), 100);
    }
  };

  const processPin = async (entered: string) => {
    if (mode === 'setup') {
      setFirstPin(entered);
      setPin('');
      setMode('confirm');
      return;
    }
    if (mode === 'confirm') {
      if (entered === firstPin) {
        await authService.setPIN(entered);
        await authService.setLockEnabled(true);
        haptics.success();
        onUnlock();
      } else {
        haptics.error();
        triggerShake();
        setPin('');
        setFirstPin('');
        setMode('setup');
        showSnackbar({
          title: 'PIN ไม่ตรงกัน',
          message: 'กรุณาตั้งใหม่อีกครั้ง',
          variant: 'error',
        });
      }
      return;
    }
    // unlock mode
    const ok = await authService.verifyPIN(entered);
    if (ok) {
      haptics.success();
      setPin('');
      setAttempts(0);
      onUnlock();
    } else {
      haptics.error();
      triggerShake();
      const next = attempts + 1;
      setAttempts(next);
      setPin('');
      if (next >= 5) {
        showSnackbar({
          message: 'กรอก PIN ผิด 5 ครั้ง กรุณารอสักครู่',
          variant: 'warning',
          durationMs: 3200,
        });
      }
    }
  };

  const handleDelete = () => {
    haptics.light();
    setPin(p => p.slice(0, -1));
  };

  const handleBioRetry = async () => {
    const ok = await authService.authenticateWithBiometric();
    if (ok) { haptics.success(); onUnlock(); }
  };

  const title = mode === 'setup' ? 'ตั้งรหัส PIN 6 หลัก' :
                mode === 'confirm' ? 'ยืนยัน PIN อีกครั้ง' :
                'ใส่รหัสผ่าน';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      <Image source={LOGO} style={styles.logo} resizeMode="contain" />
      <Text style={styles.appName}>หมูนุ่น + เป๋าตุง</Text>
      <Text style={styles.sub}>{title}</Text>

      {/* PIN dots */}
      <View style={[styles.dotsRow, shake && styles.dotsShake]}>
        {Array.from({ length: MAX }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i < pin.length && styles.dotFilled,
            ]}
          />
        ))}
      </View>

      {/* Keypad */}
      <View style={styles.keypad}>
        {[[1, 2, 3], [4, 5, 6], [7, 8, 9]].map((row, ri) => (
          <View key={ri} style={styles.row}>
            {row.map(n => (
              <KeyButton key={n} label={String(n)} onPress={() => handleDigit(String(n))} />
            ))}
          </View>
        ))}
        <View style={styles.row}>
          {mode === 'unlock' && bioAvail ? (
            <Pressable style={styles.btn} onPress={handleBioRetry}>
              <FontAwesome name="hand-stop-o" size={22} color="#fff" />
              <Text style={styles.bioLabel}>{bioName}</Text>
            </Pressable>
          ) : (
            <View style={styles.btn} />
          )}
          <KeyButton label="0" onPress={() => handleDigit('0')} />
          {pin.length > 0 ? (
            <Pressable style={styles.btn} onPress={handleDelete}>
              <FontAwesome name="arrow-left" size={22} color="rgba(255,255,255,0.8)" />
            </Pressable>
          ) : (
            <View style={styles.btn} />
          )}
        </View>
      </View>

      {attempts > 0 && mode === 'unlock' && (
        <Text style={styles.errorText}>PIN ไม่ถูกต้อง ({attempts} ครั้ง)</Text>
      )}
    </View>
  );
}

function KeyButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.btn, { backgroundColor: pressed ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.12)' }]}>
      <Text style={styles.keyText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.xl,
    backgroundColor: theme.color.primary,
  },
  logo: {
    width: 116,
    height: 116,
    borderRadius: theme.radius.lg,
    marginBottom: theme.space.sm,
  },
  appName: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.color.white,
    marginBottom: 4,
  },
  sub: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 32,
  },
  dotsRow: {
    flexDirection: 'row',
    marginBottom: 40,
    gap: 16,
  },
  dotsShake: {
    // React Native doesn't support CSS shake natively; handled by shake state toggle styling
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: theme.color.white,
  },
  keypad: {
    gap: 12,
    width: '100%',
    maxWidth: 280,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  btn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontSize: 28,
    fontWeight: '600',
    color: theme.color.white,
  },
  bioLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  errorText: {
    color: '#FFCDD2',
    fontSize: 13,
    marginTop: 20,
  },
});
