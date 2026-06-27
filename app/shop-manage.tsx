import { Stack } from 'expo-router';
import { MiniShopRouter } from '@/features/mini-shop';

export default function ShopManagePage() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <MiniShopRouter />
    </>
  );
}
