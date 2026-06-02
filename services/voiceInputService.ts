import {
  NativeEventEmitter,
  NativeModules,
  PermissionsAndroid,
  Platform,
  type EmitterSubscription,
} from 'react-native';

export type VoiceInputEngine = 'android_on_device' | 'android_prefer_offline' | 'unavailable';

export type VoiceInputCapabilityMode = 'on_device' | 'prefer_offline' | 'unavailable';

export type VoiceInputCapabilities = {
  apiLevel: number | null;
  isNativeModuleAvailable: boolean;
  isRecognitionAvailable: boolean;
  isOnDeviceRecognitionAvailable: boolean;
  supportsBiasPhrases: boolean;
  supportsOfflineRecognition: boolean;
  mode: VoiceInputCapabilityMode;
  platform: string;
  reason: string | null;
};

export type VoiceInputStatus = 'idle' | 'ready' | 'listening' | 'processing' | 'stopped' | 'error';

export type VoiceInputStatusEvent = {
  engine: VoiceInputEngine;
  isOfflineGuaranteed: boolean;
  message: string | null;
  status: VoiceInputStatus;
};

export type VoiceInputResultEvent = {
  engine: VoiceInputEngine;
  isFinal: boolean;
  isOfflineGuaranteed: boolean;
  locale: string | null;
  text: string;
};

export type VoiceInputErrorEvent = {
  code: string;
  message: string;
  recoverable: boolean;
};

export type VoiceInputStartOptions = {
  biasPhrases?: string[];
  locale?: string;
  partialResults?: boolean;
  prompt?: string;
  requireOnDevice?: boolean;
};

type NativeVoiceInputModule = {
  addListener(eventName: string): void;
  cancelListening(): Promise<boolean>;
  getCapabilities(locale?: string): Promise<VoiceInputCapabilities>;
  removeListeners(count: number): void;
  startListening(options: VoiceInputStartOptions): Promise<VoiceInputStatusEvent>;
  stopListening(): Promise<boolean>;
};

const STATUS_EVENT_NAME = 'poatungVoiceInputStatus';
const RESULT_EVENT_NAME = 'poatungVoiceInputResult';
const ERROR_EVENT_NAME = 'poatungVoiceInputError';

const nativeVoiceInputModule = NativeModules.PoatungVoiceInput as NativeVoiceInputModule | undefined;

const nativeEventEmitter =
  Platform.OS === 'android' && nativeVoiceInputModule
    ? new NativeEventEmitter(nativeVoiceInputModule)
    : null;

export const DEFAULT_VOICE_INPUT_CAPABILITIES: VoiceInputCapabilities = {
  apiLevel: Platform.OS === 'android' ? null : null,
  isNativeModuleAvailable: false,
  isRecognitionAvailable: false,
  isOnDeviceRecognitionAvailable: false,
  supportsBiasPhrases: false,
  supportsOfflineRecognition: false,
  mode: 'unavailable',
  platform: Platform.OS,
  reason: Platform.OS === 'android' ? 'native_module_missing' : 'platform_not_supported',
};

export const DEFAULT_VOICE_INPUT_STATUS_EVENT: VoiceInputStatusEvent = {
  engine: 'unavailable',
  isOfflineGuaranteed: false,
  message: null,
  status: 'idle',
};

function createUnavailableCapabilities(reason: string): VoiceInputCapabilities {
  return {
    ...DEFAULT_VOICE_INPUT_CAPABILITIES,
    platform: Platform.OS,
    reason,
  };
}

function ensureNativeModule(): NativeVoiceInputModule {
  if (!nativeVoiceInputModule) {
    throw new Error(
      Platform.OS === 'android'
        ? 'Voice Input ต้องใช้ development build หรือแอปเวอร์ชันที่ build native module นี้แล้ว'
        : 'Voice Input ในแอปยังเปิดใช้เฉพาะ Android ใน Phase 1'
    );
  }

  return nativeVoiceInputModule;
}

async function ensureMicrophonePermission() {
  if (Platform.OS !== 'android') return true;

  const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  if (granted) return true;

  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
    title: 'อนุญาตใช้ไมโครโฟน',
    message: 'Poatung ต้องใช้ไมโครโฟนเพื่อฟังเสียงและกรอก Quick Add ให้คุณ',
    buttonPositive: 'อนุญาต',
    buttonNegative: 'ไม่อนุญาต',
  });

  return result === PermissionsAndroid.RESULTS.GRANTED;
}

function subscribe<T>(eventName: string, listener: (event: T) => void) {
  if (!nativeEventEmitter) {
    return () => undefined;
  }

  const subscription: EmitterSubscription = nativeEventEmitter.addListener(eventName, listener);
  return () => subscription.remove();
}

export const voiceInputService = {
  async getCapabilities(locale = 'th-TH'): Promise<VoiceInputCapabilities> {
    if (Platform.OS !== 'android') {
      return createUnavailableCapabilities('platform_not_supported');
    }

    if (!nativeVoiceInputModule) {
      return createUnavailableCapabilities('native_module_missing');
    }

    try {
      return await nativeVoiceInputModule.getCapabilities(locale);
    } catch {
      return createUnavailableCapabilities('capability_check_failed');
    }
  },

  async startListening(options: VoiceInputStartOptions = {}) {
    const nativeModule = ensureNativeModule();
    const permissionGranted = await ensureMicrophonePermission();

    if (!permissionGranted) {
      const error = new Error('ไม่ได้รับอนุญาตใช้ไมโครโฟน');
      (error as Error & { code?: string }).code = 'audio_permission_denied';
      throw error;
    }

    return nativeModule.startListening({
      locale: options.locale ?? 'th-TH',
      partialResults: options.partialResults ?? true,
      prompt: options.prompt ?? 'พูดรายการ เช่น ขายทุเรียน 450',
      requireOnDevice: options.requireOnDevice ?? true,
      biasPhrases: options.biasPhrases?.slice(0, 24),
    });
  },

  async stopListening() {
    if (!nativeVoiceInputModule) return false;
    return nativeVoiceInputModule.stopListening();
  },

  async cancelListening() {
    if (!nativeVoiceInputModule) return false;
    return nativeVoiceInputModule.cancelListening();
  },

  addStatusListener(listener: (event: VoiceInputStatusEvent) => void) {
    return subscribe<VoiceInputStatusEvent>(STATUS_EVENT_NAME, listener);
  },

  addResultListener(listener: (event: VoiceInputResultEvent) => void) {
    return subscribe<VoiceInputResultEvent>(RESULT_EVENT_NAME, listener);
  },

  addErrorListener(listener: (event: VoiceInputErrorEvent) => void) {
    return subscribe<VoiceInputErrorEvent>(ERROR_EVENT_NAME, listener);
  },
};
