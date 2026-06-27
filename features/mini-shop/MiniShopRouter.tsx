import { View, ActivityIndicator } from 'react-native';
import { useShopTier } from './hooks/useShopTier';
import FreeShopScreen from './screens/FreeShopScreen';
import ProShopDashboardScreen from './screens/ProShopDashboardScreen';

export function MiniShopRouter() {
  const { tier, loading } = useShopTier();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FAF5FF', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#9333EA" />
      </View>
    );
  }

  if (tier === 'pro' || tier === 'premium') return <ProShopDashboardScreen />;
  return <FreeShopScreen />;
}
