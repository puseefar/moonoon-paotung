import { Stack } from 'expo-router';
import ProShopOrdersScreen from '@/features/mini-shop/screens/ProShopOrdersScreen';

// Route accessible only from ProShopDashboardScreen (pro-gated via MiniShopRouter)
export default function ShopOrdersPage() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ProShopOrdersScreen />
    </>
  );
}
