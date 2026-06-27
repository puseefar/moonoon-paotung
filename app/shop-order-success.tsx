import { Stack } from 'expo-router';
import ProOrderSuccessScreen from '@/features/mini-shop/screens/ProOrderSuccessScreen';

export default function ShopOrderSuccessPage() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ProOrderSuccessScreen />
    </>
  );
}
