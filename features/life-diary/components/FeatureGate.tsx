import React from 'react';
import { useDiaryTier } from '../hooks/useDiaryTier';
import { DIARY_TIER_CONFIG, type DiaryFeatureKey } from '../config/diaryTierConfig';

interface Props {
  feature: DiaryFeatureKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function FeatureGate({ feature, children, fallback = null }: Props) {
  const tier = useDiaryTier();
  return DIARY_TIER_CONFIG[tier][feature] ? <>{children}</> : <>{fallback}</>;
}
