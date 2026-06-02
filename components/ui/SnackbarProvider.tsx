import FontAwesome from '@expo/vector-icons/FontAwesome';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type SnackbarVariant = 'success' | 'error' | 'warning' | 'info';

type SnackbarOptions = {
  title?: string;
  message: string;
  variant?: SnackbarVariant;
  durationMs?: number;
  actionLabel?: string;
  onAction?: () => void;
};

type SnackbarContextValue = {
  showSnackbar: (options: SnackbarOptions) => void;
  hideSnackbar: () => void;
};

type SnackbarState = SnackbarOptions & {
  id: number;
  variant: SnackbarVariant;
  durationMs: number;
};

const SnackbarContext = createContext<SnackbarContextValue | null>(null);

const DEFAULT_DURATION_MS = 3000;

const VARIANT_CONFIG: Record<
  SnackbarVariant,
  { icon: React.ComponentProps<typeof FontAwesome>['name']; bg: string; defaultTitle: string }
> = {
  success: { icon: 'check-circle',        bg: '#1B8A3F', defaultTitle: 'สำเร็จ'          },
  error:   { icon: 'times-circle',        bg: '#C62828', defaultTitle: 'เกิดข้อผิดพลาด'  },
  warning: { icon: 'exclamation-triangle', bg: '#E65100', defaultTitle: 'แจ้งเตือน'       },
  info:    { icon: 'info-circle',         bg: '#1565C0', defaultTitle: 'ข้อมูล'           },
};

export function SnackbarProvider({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState<SnackbarState | null>(null);
  const queueRef      = useRef<SnackbarState[]>([]);
  const hideTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const afterHideRef  = useRef<(() => void) | null>(null);
  const progressRef   = useRef<Animated.CompositeAnimation | null>(null);

  // translateY starts above screen (slides DOWN on enter)
  const opacity      = useRef(new Animated.Value(0)).current;
  const translateY   = useRef(new Animated.Value(-140)).current;
  const progressAnim = useRef(new Animated.Value(1)).current;

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const runHideAnimation = useCallback(() => {
    clearHideTimer();
    progressRef.current?.stop();
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -140,
        duration: 200,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => {
      const cb = afterHideRef.current;
      afterHideRef.current = null;
      setCurrent(null);
      cb?.();
    });
  }, [clearHideTimer, opacity, translateY]);

  const hideSnackbar = useCallback(() => {
    if (!current) return;
    runHideAnimation();
  }, [current, runHideAnimation]);

  const showSnackbar = useCallback(
    (options: SnackbarOptions) => {
      const next: SnackbarState = {
        id: Date.now() + Math.random(),
        title: options.title,
        message: options.message,
        variant: options.variant ?? 'info',
        durationMs: options.durationMs ?? DEFAULT_DURATION_MS,
        actionLabel: options.actionLabel,
        onAction: options.onAction,
      };
      if (current) {
        queueRef.current.push(next);
        queueRef.current = queueRef.current.slice(-5);
        return;
      }
      setCurrent(next);
    },
    [current],
  );

  // Drain queue when slot frees
  useEffect(() => {
    if (!current && queueRef.current.length > 0) {
      setCurrent(queueRef.current.shift() ?? null);
    }
  }, [current]);

  // Main animation effect
  useEffect(() => {
    if (!current) {
      clearHideTimer();
      opacity.setValue(0);
      translateY.setValue(-140);
      progressAnim.setValue(1);
      return;
    }

    opacity.setValue(0);
    translateY.setValue(-140);
    progressAnim.setValue(1);

    // ── Enter: drop down with spring bounce ──────────────────────────────────
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        tension: 70,
        friction: 11,
        useNativeDriver: true,
      }),
    ]).start();

    // ── Progress bar (width → JS thread, can't use native driver) ───────────
    progressRef.current = Animated.timing(progressAnim, {
      toValue: 0,
      duration: current.durationMs - 150,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    progressRef.current.start();

    // ── Auto-hide ────────────────────────────────────────────────────────────
    hideTimerRef.current = setTimeout(runHideAnimation, current.durationMs);
    return clearHideTimer;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  useEffect(() => () => clearHideTimer(), [clearHideTimer]);

  const contextValue = useMemo<SnackbarContextValue>(
    () => ({ showSnackbar, hideSnackbar }),
    [hideSnackbar, showSnackbar],
  );

  const handleActionPress = (e: GestureResponderEvent) => {
    e.stopPropagation();
    if (!current?.onAction) {
      hideSnackbar();
      return;
    }
    afterHideRef.current = current.onAction;
    runHideAnimation();
  };

  const config = current ? VARIANT_CONFIG[current.variant] : VARIANT_CONFIG.info;

  return (
    <SnackbarContext.Provider value={contextValue}>
      {children}

      {/* Overlay — must be LAST child so it renders above everything */}
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        {current ? (
          <Animated.View
            pointerEvents="box-none"
            style={[
              styles.wrapper,
              { top: insets.top + 10, opacity, transform: [{ translateY }] },
            ]}>
            <Pressable
              onPress={hideSnackbar}
              style={[styles.snackbar, { backgroundColor: config.bg }]}>

              {/* Icon */}
              <View style={styles.iconWrap}>
                <FontAwesome name={config.icon} size={22} color="#FFFFFF" />
              </View>

              {/* Text */}
              <View style={styles.content}>
                <Text style={styles.title} numberOfLines={1}>
                  {current.title ?? config.defaultTitle}
                </Text>
                <Text style={styles.message} numberOfLines={2}>
                  {current.message}
                </Text>
              </View>

              {/* Action / Dismiss */}
              {current.actionLabel ? (
                <Pressable onPress={handleActionPress} style={styles.actionButton} hitSlop={8}>
                  <Text style={styles.actionText}>{current.actionLabel}</Text>
                </Pressable>
              ) : (
                <Pressable onPress={hideSnackbar} style={styles.dismissButton} hitSlop={12}>
                  <FontAwesome name="times" size={13} color="rgba(255,255,255,0.72)" />
                </Pressable>
              )}

              {/* Progress bar — counts down to auto-dismiss */}
              <View style={styles.progressTrack}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    {
                      width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>
            </Pressable>
          </Animated.View>
        ) : null}
      </View>
    </SnackbarContext.Provider>
  );
}

export function useSnackbar() {
  const ctx = useContext(SnackbarContext);
  if (!ctx) throw new Error('useSnackbar must be used inside SnackbarProvider');
  return ctx;
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 14,
    right: 14,
  },
  snackbar: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 20,   // extra room for progress bar at bottom
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 16,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  message: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.88)',
    lineHeight: 18,
  },
  actionButton: {
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  dismissButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  progressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  progressFill: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
});
