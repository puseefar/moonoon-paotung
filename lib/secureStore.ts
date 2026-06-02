import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

type SecureStoreOptions = Parameters<typeof SecureStore.getItemAsync>[1];

const memoryStore = new Map<string, string>();

function canUseNativeSecureStore() {
  return (
    Platform.OS !== 'web' &&
    typeof SecureStore.getItemAsync === 'function' &&
    typeof SecureStore.setItemAsync === 'function' &&
    typeof SecureStore.deleteItemAsync === 'function'
  );
}

function getWebStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export const appSecureStore = {
  async getItemAsync(key: string, options?: SecureStoreOptions): Promise<string | null> {
    if (canUseNativeSecureStore()) {
      return SecureStore.getItemAsync(key, options);
    }

    const storage = getWebStorage();
    if (!storage) {
      return memoryStore.get(key) ?? null;
    }

    return storage.getItem(key);
  },

  async setItemAsync(key: string, value: string, options?: SecureStoreOptions): Promise<void> {
    if (canUseNativeSecureStore()) {
      await SecureStore.setItemAsync(key, value, options);
      return;
    }

    const storage = getWebStorage();
    if (!storage) {
      memoryStore.set(key, value);
      return;
    }

    storage.setItem(key, value);
  },

  async deleteItemAsync(key: string, options?: SecureStoreOptions): Promise<void> {
    if (canUseNativeSecureStore()) {
      await SecureStore.deleteItemAsync(key, options);
      return;
    }

    const storage = getWebStorage();
    if (!storage) {
      memoryStore.delete(key);
      return;
    }

    storage.removeItem(key);
  },
};
