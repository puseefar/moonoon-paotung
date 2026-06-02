import { Platform } from 'react-native';

export const isWebUiPreviewEnabled =
  Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_UI_ONLY === '1';
