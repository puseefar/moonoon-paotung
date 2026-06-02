import { View, Text } from 'react-native';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

// หน้านี้เป็น placeholder — จะถูก redirect ไปหน้า report จริง (Stack)
// ผ่าน tabPress listener ใน _layout.tsx
export default function ReportTabPlaceholder() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 40 }}>📊</Text>
      <Text style={{ fontSize: 15, color: colors.textSecondary, marginTop: 8 }}>กำลังโหลดรายงาน...</Text>
    </View>
  );
}
