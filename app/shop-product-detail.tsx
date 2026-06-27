import { Stack } from 'expo-router';
import ProProductDetailScreen from '@/features/mini-shop/screens/ProProductDetailScreen';

export default function ShopProductDetailPage() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ProProductDetailScreen />
    </>
  );
}
