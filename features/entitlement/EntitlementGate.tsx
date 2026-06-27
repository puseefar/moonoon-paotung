/**
 * EntitlementGate — declarative, tier-agnostic gating for any feature.
 *
 * Supersedes the life-diary-specific `FeatureGate` and the `Pro*Screen` /
 * `Free*Screen` filename split (restructure §7). One screen file, gated inside:
 *
 *   <EntitlementGate feature="mini_shop">
 *     <ShopDashboard />
 *     <EntitlementGate feature="mini_shop.orders" mode="preview">
 *       <OrdersSection />
 *     </EntitlementGate>
 *   </EntitlementGate>
 *
 * Modes (restructure §4.3):
 *   - 'hard'    → not allowed ⇒ render `fallback` (default: an upsell card). Used
 *                 for backend/cost features (checkout, PromptPay, LINE).
 *   - 'preview' → not allowed ⇒ still render children (visual upsell); the screen
 *                 disables the action via `useEntitlement().allowed`.
 */

import React, { type ReactNode } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useEntitlement } from './useEntitlement';
import { FEATURES, type FeatureId } from '@/features/config/featureRegistry';

type Mode = 'hard' | 'preview';

interface Props {
  feature: FeatureId;
  mode?: Mode;
  children: ReactNode;
  /** Override the default locked UI in `hard` mode (e.g. a real UpgradeSheet). */
  fallback?: ReactNode;
  /** Override the default loading indicator. */
  loadingFallback?: ReactNode;
}

export function EntitlementGate({
  feature,
  mode = 'hard',
  children,
  fallback,
  loadingFallback,
}: Props) {
  const { allowed, loading } = useEntitlement(feature);

  if (loading) return <>{loadingFallback ?? <GateSpinner />}</>;
  if (allowed) return <>{children}</>;
  if (mode === 'preview') return <>{children}</>;
  return <>{fallback ?? <DefaultUpgradeFallback feature={feature} />}</>;
}

function GateSpinner() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#9333EA" />
    </View>
  );
}

/**
 * Minimal, self-contained locked card. Intentionally has no navigation so it is
 * safe to drop anywhere; pass a real `fallback` (UpgradeSheet) for production
 * upsell with a CTA to the package screen.
 */
function DefaultUpgradeFallback({ feature }: { feature: FeatureId }) {
  const name = FEATURES[feature]?.displayName.th ?? 'ฟีเจอร์นี้';
  return (
    <View style={styles.card}>
      <Text style={styles.lock}>🔒</Text>
      <Text style={styles.title}>{name}</Text>
      <Text style={styles.body}>ฟีเจอร์นี้สำหรับเวอร์ชัน Pro</Text>
      <Text style={styles.hint}>อัปเกรดเพื่อปลดล็อกการใช้งาน</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: '#FAF5FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    margin: 16,
    padding: 24,
    borderRadius: 20,
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    alignItems: 'center',
  },
  lock: { fontSize: 40, marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '700', color: '#6B21A8', marginBottom: 4 },
  body: { fontSize: 14, color: '#7C3AED', marginBottom: 2 },
  hint: { fontSize: 12, color: '#A78BFA' },
});
