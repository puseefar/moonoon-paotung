/**
 * Public surface of the unified entitlement system.
 * Import from here, not from internal files:
 *
 *   import { EntitlementGate, useEntitlement, unifiedEntitlementService } from '@/features/entitlement';
 */

export { EntitlementGate } from './EntitlementGate';
export { useEntitlement, type EntitlementState } from './useEntitlement';

export { unifiedEntitlementService } from '@/services/entitlement/unifiedEntitlementService';

export {
  FEATURES,
  ALL_FEATURE_IDS,
  ROUTE_TO_FEATURE,
  owningPackage,
  type FeatureId,
  type FeatureDefinition,
  type FeatureCategory,
} from '@/features/config/featureRegistry';

export {
  TIERS,
  limitsForTier,
  tierUnlocksByDefault,
  type TierId,
  type TierLimits,
  type TierDefinition,
} from '@/features/config/tiers';
