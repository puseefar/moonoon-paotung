import { useState, useEffect } from 'react';
import { entitlementService } from '@/services/entitlementService';
import type { DiaryTier } from '../config/diaryTierConfig';

export function useDiaryTier(): DiaryTier {
  const [tier, setTier] = useState<DiaryTier>('free');

  useEffect(() => {
    entitlementService.isPackageEnabled('pkg-01-diary').then(enabled => {
      // TODO Phase 3 (Premium): distinguish pro vs premium via subscription store
      setTier(enabled ? 'pro' : 'free');
    });
  }, []);

  return tier;
}
