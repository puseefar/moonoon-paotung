import { Stack } from 'expo-router';
import ProShopProfileScreen from '@/features/mini-shop/screens/ProShopProfileScreen';

export default function ShopProfilePage() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ProShopProfileScreen />
    </>
  );
}
