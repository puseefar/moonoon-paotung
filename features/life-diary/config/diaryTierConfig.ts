export type DiaryTier = 'free' | 'pro' | 'premium';

export const DIARY_TIER_CONFIG = {
  free: {
    maxPhotos: 1,
    locationPin: false,
    exportPdf: false,
    aiReflection: false,
    moodTemplates: false,
    activityMode: false,
    bottomSheetComposer: false,
    watercolorTheme: false,
  },
  pro: {
    maxPhotos: 5,
    locationPin: true,
    exportPdf: true,
    aiReflection: false,
    moodTemplates: true,
    activityMode: true,
    bottomSheetComposer: true,
    watercolorTheme: true,
  },
  premium: {
    maxPhotos: 20,
    locationPin: true,
    exportPdf: true,
    aiReflection: true,
    moodTemplates: true,
    activityMode: true,
    bottomSheetComposer: true,
    watercolorTheme: true,
  },
} as const;

export type DiaryFeatureKey = keyof typeof DIARY_TIER_CONFIG['free'];
