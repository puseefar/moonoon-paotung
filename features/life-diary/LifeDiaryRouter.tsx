import { View, ActivityIndicator } from 'react-native';
import FreeDiaryScreen from './screens/FreeDiaryScreen';
import ProDiaryScreen from './screens/ProDiaryScreen';
import { useDiaryTier } from './hooks/useDiaryTier';

export function LifeDiaryRouter() {
  const { tier, loading } = useDiaryTier();
  if (loading) return <DiaryTierSkeleton />;
  if (tier === 'pro' || tier === 'premium') return <ProDiaryScreen />;
  return <FreeDiaryScreen />;
}

function DiaryTierSkeleton() {
  return (
    <View style={{ flex: 1, backgroundColor: '#FBF8F3', justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#D14F86" />
    </View>
  );
}
