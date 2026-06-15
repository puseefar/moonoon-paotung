import FreeDiaryScreen from './screens/FreeDiaryScreen';
import ProDiaryScreen from './screens/ProDiaryScreen';
import { useDiaryTier } from './hooks/useDiaryTier';

export function LifeDiaryRouter() {
  const tier = useDiaryTier();
  if (tier === 'pro' || tier === 'premium') return <ProDiaryScreen />;
  return <FreeDiaryScreen />;
}
