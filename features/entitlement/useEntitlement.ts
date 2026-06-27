/**
 * useEntitlement — the single hook every screen uses to ask about a feature.
 *
 * Replaces the per-feature `useDiaryTier` / `useShopTier` hooks (those remain
 * for now and should be migrated opportunistically — restructure §8.4).
 *
 * Re-resolves on screen focus (catches external changes, same as useShopTier)
 * and on facade `onChange` events (e.g. after an in-session upgrade/refresh, so
 * unlock happens without an app restart — restructure §4.5).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { unifiedEntitlementService } from '@/services/entitlement/unifiedEntitlementService';
import type { FeatureId } from '@/features/config/featureRegistry';
import type { TierId } from '@/features/config/tiers';

export interface EntitlementState {
  /** May the user use this feature now? */
  allowed: boolean;
  /** Downgraded but data preserved — view yes, edit no (ADR-003). */
  readOnly: boolean;
  /** Resolved tier for this feature's domain. */
  tier: TierId;
  /** Still resolving from cache/server. */
  loading: boolean;
}

const INITIAL: EntitlementState = {
  allowed: false,
  readOnly: false,
  tier: 'free',
  loading: true,
};

export function useEntitlement(featureId: FeatureId): EntitlementState {
  const [state, setState] = useState<EntitlementState>(INITIAL);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const resolve = useCallback(async () => {
    const [allowed, tier] = await Promise.all([
      unifiedEntitlementService.can(featureId),
      unifiedEntitlementService.tierForFeature(featureId),
    ]);
    if (!mounted.current) return;
    setState({
      allowed,
      tier,
      readOnly: unifiedEntitlementService.readOnlyMode(featureId),
      loading: false,
    });
  }, [featureId]);

  useFocusEffect(
    useCallback(() => {
      resolve();
    }, [resolve])
  );

  useEffect(() => unifiedEntitlementService.onChange(resolve), [resolve]);

  return state;
}
