import { Stack } from 'expo-router';
import ProCreateProductScreen from '@/features/mini-shop/screens/ProCreateProductScreen';

export default function ShopCreateProductPage() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ProCreateProductScreen />
    </>
  );
}
