import { View, Text, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useRouter } from 'expo-router';

const PRO_FEATURES = [
  { icon: '🏪', title: 'เปิดร้านออนไลน์', desc: 'สร้างหน้าร้านสาธารณะ แชร์ลิงก์ได้ทันที' },
  { icon: '📦', title: 'จัดการสินค้า 5 ชิ้น', desc: 'รูปสินค้า ราคา สต็อก ราคาต้นทุน ครบ' },
  { icon: '💳', title: 'รับชำระ PromptPay', desc: 'QR อัตโนมัติ ยืนยันสลิปทันที' },
  { icon: '📋', title: 'จัดการออเดอร์', desc: 'ติดตามสถานะ ใส่เลขพัสดุ ยกเลิก-คืนเงิน' },
  { icon: '💬', title: 'แจ้งเตือนทาง LINE', desc: 'มีออเดอร์ใหม่แจ้งผ่าน LINE OA ทันที' },
  { icon: '🔗', title: 'ลิงก์ติดตามออเดอร์', desc: 'ลูกค้าเช็กสถานะเองได้ผ่าน Browser' },
  { icon: '📊', title: 'บันทึกบัญชีอัตโนมัติ', desc: 'ขายแล้วรายรับ-กำไรไหลเข้าเป๋าตุงเอง' },
];

export default function FreeShopScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: '#FAF5FF' }}>
      <LinearGradient
        colors={['#6B21A8', '#9333EA', '#EC4899']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 8, paddingBottom: 28, paddingHorizontal: 20 }}>
        <Pressable onPress={() => router.back()} style={{ padding: 6, marginBottom: 16, alignSelf: 'flex-start' }}>
          <Text style={{ fontSize: 20, color: '#fff' }}>←</Text>
        </Pressable>
        <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '700',
          textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
          Pro Package #5
        </Text>
        <Text style={{ fontSize: 28, fontWeight: '900', color: '#fff', lineHeight: 34 }}>
          🏪 Mini Shop Pro
        </Text>
        <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.85)', marginTop: 8, lineHeight: 22 }}>
          เปิดร้านออนไลน์ · ขายสินค้า · รับเงิน{'\n'}บัญชีอัปเดตอัตโนมัติ — ไม่ต้องคีย์ซ้ำ
        </Text>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}>

        {/* Lock badge */}
        <View style={{ backgroundColor: '#F3E8FF', borderRadius: 16, padding: 16,
          marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 12,
          borderWidth: 1.5, borderColor: '#D8B4FE' }}>
          <Text style={{ fontSize: 28 }}>🔒</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: '#6B21A8' }}>
              ฟีเจอร์นี้สำหรับ Pro Package
            </Text>
            <Text style={{ fontSize: 12, color: '#9333EA', marginTop: 2, lineHeight: 18 }}>
              ต้องการเปิดใช้งาน ติดต่อทีม SEVENDOG DEV
            </Text>
          </View>
        </View>

        {/* Feature list */}
        <Text style={{ fontSize: 13, fontWeight: '800', color: '#6B21A8',
          letterSpacing: 0.5, marginBottom: 12 }}>
          สิ่งที่คุณจะได้รับ
        </Text>
        {PRO_FEATURES.map((f, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12,
            backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8,
            elevation: 1, shadowColor: '#9333EA', shadowOpacity: 0.06, shadowRadius: 4 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12,
              backgroundColor: '#F3E8FF', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 20 }}>{f.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#1F2937' }}>{f.title}</Text>
              <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2, lineHeight: 18 }}>{f.desc}</Text>
            </View>
            <Text style={{ fontSize: 16, color: '#A855F7', marginTop: 8 }}>✓</Text>
          </View>
        ))}

        {/* USP callout */}
        <View style={{ backgroundColor: '#FDF4FF', borderRadius: 16, padding: 16, marginTop: 8,
          borderLeftWidth: 4, borderLeftColor: '#A855F7' }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: '#6B21A8', marginBottom: 4 }}>
            💡 จุดเด่นที่แตกต่าง
          </Text>
          <Text style={{ fontSize: 13, color: '#374151', lineHeight: 20 }}>
            ขายสินค้าแล้ว <Text style={{ fontWeight: '800', color: '#9333EA' }}>รายรับ · ต้นทุน · กำไร · สต็อก</Text> ไหลเข้าเป๋าตุงโดยอัตโนมัติ — ไม่ต้องกลับมาคีย์บัญชีซ้ำอีกครั้ง
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
