import { Stack } from 'expo-router';
import ProPlaceOrderScreen from '@/features/mini-shop/screens/ProPlaceOrderScreen';

export default function ShopPlaceOrderPage() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ProPlaceOrderScreen />
    </>
  );
}
