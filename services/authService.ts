import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';
import { appSecureStore } from '@/lib/secureStore';

const PIN_KEY = 'poatung_pin';
const LOCK_ENABLED_KEY = 'poatung_lock_enabled';

export type AuthMethod = 'biometric' | 'pin' | 'none';

export const authService = {
  // ตรวจสอบว่าเครื่องรองรับ biometric ไหม
  async checkBiometricSupport(): Promise<{
    isAvailable: boolean;
    types: LocalAuthentication.AuthenticationType[];
  }> {
    if (Platform.OS === 'web') {
      return {
        isAvailable: false,
        types: [],
      };
    }

    const isAvailable = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

    return {
      isAvailable: isAvailable && isEnrolled,
      types,
    };
  },

  // ยืนยันตัวตนด้วย biometric
  async authenticateWithBiometric(): Promise<boolean> {
    if (Platform.OS === 'web') {
      return false;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'ยืนยันตัวตนเพื่อเข้าใช้งาน Poatung',
      cancelLabel: 'ใช้ PIN',
      disableDeviceFallback: false,
      fallbackLabel: 'ใช้ PIN',
    });

    return result.success;
  },

  // ตั้งค่า PIN
  async setPIN(pin: string): Promise<void> {
    await appSecureStore.setItemAsync(PIN_KEY, pin);
  },

  // ตรวจสอบ PIN
  async verifyPIN(pin: string): Promise<boolean> {
    const storedPIN = await appSecureStore.getItemAsync(PIN_KEY);
    return storedPIN === pin;
  },

  // ตรวจสอบว่ามี PIN หรือไม่
  async hasPIN(): Promise<boolean> {
    const pin = await appSecureStore.getItemAsync(PIN_KEY);
    return pin !== null;
  },

  // ลบ PIN
  async removePIN(): Promise<void> {
    await appSecureStore.deleteItemAsync(PIN_KEY);
  },

  // เปิด/ปิด lock
  async setLockEnabled(enabled: boolean): Promise<void> {
    await appSecureStore.setItemAsync(LOCK_ENABLED_KEY, enabled ? 'true' : 'false');
  },

  // ตรวจสอบว่า lock เปิดอยู่หรือไม่
  async isLockEnabled(): Promise<boolean> {
    const value = await appSecureStore.getItemAsync(LOCK_ENABLED_KEY);
    return value === 'true';
  },

  // ยืนยันตัวตน (biometric หรือ PIN)
  async authenticate(): Promise<boolean> {
    const isLocked = await this.isLockEnabled();
    if (!isLocked) return true;

    // ลอง biometric ก่อน
    const { isAvailable } = await this.checkBiometricSupport();
    if (isAvailable) {
      const success = await this.authenticateWithBiometric();
      if (success) return true;
    }

    // ถ้าไม่มี biometric หรือ fail ให้ใช้ PIN
    return false; // UI จะแสดง PIN input
  },

  // ดึงชื่อ biometric type
  async getBiometricTypeName(): Promise<string> {
    if (Platform.OS === 'web') {
      return 'Biometric';
    }

    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return 'Face ID';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return 'ลายนิ้วมือ';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      return 'สแกนม่านตา';
    }
    return 'Biometric';
  },
};
