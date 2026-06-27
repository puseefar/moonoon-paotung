import { Stack } from 'expo-router';
import ProAnalyticsScreen from '@/features/mini-shop/screens/ProAnalyticsScreen';

export default function ShopAnalyticsPage() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ProAnalyticsScreen />
    </>
  );
}
