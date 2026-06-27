import { Stack } from 'expo-router';
import ProCheckoutScreen from '@/features/mini-shop/screens/ProCheckoutScreen';

export default function ShopCheckoutPage() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ProCheckoutScreen />
    </>
  );
}
