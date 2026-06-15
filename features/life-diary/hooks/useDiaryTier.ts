import { useState, useEffect } from 'react';
import { entitlementService } from '@/services/entitlementService';
import type { DiaryTier } from '../config/diaryTierConfig';

export interface DiaryTierState {
  tier: DiaryTier;
  loading: boolean;
}

export function useDiaryTier(): DiaryTierState {
  const [tier, setTier] = useState<DiaryTier>('free');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    entitlementService.isPackageEnabled('pkg-01-diary').then(enabled => {
      // TODO Phase 3 (Premium): distinguish pro vs premium via subscription store
      setTier(enabled ? 'pro' : 'free');
      setLoading(false);
    });
  }, []);

  return { tier, loading };
}
