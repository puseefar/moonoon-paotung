import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import Constants from 'expo-constants';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, LogBox, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

// ── Suppress known dev-mode noise ───────────────────────────────────────────
// expo-keep-awake throws when Activity isn't ready during fast-reload.
// This is harmless in dev and never occurs in production builds.
LogBox.ignoreLogs([
  'Unable to activate keep awake',
  'Uncaught (in promise)',
]);
import '../global.css';
import { BrandedLoadingScreen } from '@/components/splash/BrandedLoadingScreen';
import { theme } from '@/lib/theme';

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useColorScheme } from '@/components/useColorScheme';
import { WebUiPreviewApp } from '@/components/web-preview/WebUiPreviewApp';
import { SnackbarProvider } from '@/components/ui/SnackbarProvider';
import { DatabaseProvider } from '@/db/provider';
import { isWebUiPreviewEnabled } from '@/lib/webPreview';
import { LockScreen } from '@/components/auth/LockScreen';
import { authService } from '@/services/authService';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore if splash is already managed by the platform.
});

const FONT_LOAD_TIMEOUT_MS = 4000;
const isExpoGoRuntime =
  Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';

export default function RootLayout() {
  const [loaded, fontError] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });
  const [fontLoadTimedOut, setFontLoadTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFontLoadTimedOut(true);
    }, FONT_LOAD_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (fontError) {
      console.error('Font loading failed, continuing with fallback fonts:', fontError);
    }
  }, [fontError]);

  const canRenderApp = loaded || !!fontError || fontLoadTimedOut;

  useEffect(() => {
    if (canRenderApp) {
      SplashScreen.hideAsync().catch(() => {
        // Ignore hide failures; app can still continue rendering.
      });
    }
  }, [canRenderApp]);

  if (!canRenderApp) {
    return <BrandedLoadingScreen message="กำลังโหลดทรัพยากร..." />;
  }

  if (isWebUiPreviewEnabled) {
    return (
      <SafeAreaProvider>
        <WebUiPreviewApp />
      </SafeAreaProvider>
    );
  }

  if (isExpoGoRuntime) {
    return (
      <SafeAreaProvider>
        <ExpoGoUnsupportedScreen />
      </SafeAreaProvider>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SnackbarProvider>
          <RootLayoutNav />
        </SnackbarProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function ExpoGoUnsupportedScreen() {
  return (
    <View
      style={{
        flex: 1,
        paddingHorizontal: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.color.bgSoft,
        gap: 16,
      }}>
      <Text
        style={{
          fontSize: 26,
          fontWeight: '800',
          color: theme.color.text,
          textAlign: 'center',
        }}>
        ใช้แอปเวอร์ชันเดียว
      </Text>
      <Text
        style={{
          fontSize: 15,
          lineHeight: 24,
          color: theme.color.sub,
          textAlign: 'center',
        }}>
        เวอร์ชันที่เปิดจาก Expo Go ถูกปิดไว้แล้ว เพื่อไม่ให้สับสนกับแอปที่มี Voice Input
        แบบออฟไลน์
      </Text>
      <View
        style={{
          width: '100%',
          borderRadius: 18,
          backgroundColor: '#FFF',
          paddingHorizontal: 18,
          paddingVertical: 16,
          gap: 10,
          borderWidth: 1,
          borderColor: '#F4D7E7',
        }}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: theme.color.primary }}>
          ให้เปิดแอปที่ติดตั้งจาก Android build เท่านั้น
        </Text>
        <Text style={{ fontSize: 14, lineHeight: 22, color: theme.color.sub }}>
          1. เปิด Metro ด้วย `npx.cmd expo start --dev-client`
        </Text>
        <Text style={{ fontSize: 14, lineHeight: 22, color: theme.color.sub }}>
          2. กลับไปเปิดแอป `หมูนุ่น-เป๋าตุง` ที่ติดตั้งบนมือถือ
        </Text>
        <Text style={{ fontSize: 14, lineHeight: 22, color: theme.color.sub }}>
          3. ถ้าต้อง build ใหม่ ให้ใช้ `npx.cmd expo run:android`
        </Text>
      </View>
    </View>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const [isLocked, setIsLocked] = useState(false);
  const [checkingLock, setCheckingLock] = useState(true);
  const appState = useRef(AppState.currentState);

  const checkLockStatus = useCallback(async () => {
    try {
      const enabled = await authService.isLockEnabled();
      const hasPin = await authService.hasPIN();
      if (enabled && hasPin) {
        setIsLocked(true);
      }
    } finally {
      setCheckingLock(false);
    }
  }, []);

  useEffect(() => {
    checkLockStatus();
  }, [checkLockStatus]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        const enabled = await authService.isLockEnabled();
        const hasPin = await authService.hasPIN();
        if (enabled && hasPin) {
          setIsLocked(true);
        }
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, []);

  if (checkingLock) {
    return <BrandedLoadingScreen message="กำลังตรวจสอบความปลอดภัย..." />;
  }

  if (isLocked) {
    return <LockScreen onUnlock={() => setIsLocked(false)} />;
  }

  return (
    <DatabaseProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
          <Stack.Screen name="wallet-manage" options={{ presentation: 'card' }} />
          <Stack.Screen name="wallet-transfer" options={{ presentation: 'card' }} />
          <Stack.Screen name="wallet/[id]" options={{ presentation: 'card' }} />
          <Stack.Screen name="report" options={{ presentation: 'card' }} />
          <Stack.Screen name="recurring" options={{ presentation: 'card' }} />
          <Stack.Screen name="savings" options={{ presentation: 'card' }} />
          <Stack.Screen name="category-manage" options={{ presentation: 'card' }} />
          <Stack.Screen name="starter-templates" options={{ presentation: 'card' }} />
          <Stack.Screen name="tax-readiness" options={{ presentation: 'card' }} />
          <Stack.Screen name="slip-inbox" options={{ presentation: 'card' }} />
          <Stack.Screen name="backup" options={{ presentation: 'card' }} />
          <Stack.Screen name="app-lock" options={{ presentation: 'card' }} />
          <Stack.Screen name="export-report" options={{ presentation: 'card' }} />
          <Stack.Screen name="notification-settings" options={{ presentation: 'card' }} />
          <Stack.Screen name="scan-slip" options={{ presentation: 'card' }} />
          <Stack.Screen name="diary" options={{ presentation: 'card' }} />
          <Stack.Screen name="diary-write" options={{ presentation: 'card' }} />
          <Stack.Screen name="diary-entry" options={{ presentation: 'card' }} />
          <Stack.Screen name="payment-qr" options={{ presentation: 'card' }} />
          <Stack.Screen name="slip-verify" options={{ presentation: 'card' }} />
          <Stack.Screen name="line-connect" options={{ presentation: 'card' }} />
          <Stack.Screen name="shop-manage" options={{ presentation: 'card' }} />
          <Stack.Screen name="shop-orders" options={{ presentation: 'card' }} />
        </Stack>
      </ThemeProvider>
    </DatabaseProvider>
  );
}
