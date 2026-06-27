import { Stack } from 'expo-router';
import ProStorefrontScreen from '@/features/mini-shop/screens/ProStorefrontScreen';

export default function ShopStorefrontPage() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ProStorefrontScreen />
    </>
  );
}
