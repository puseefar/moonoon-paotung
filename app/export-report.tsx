import { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Colors from '@/constants/Colors';
import { useSnackbar } from '@/components/ui/SnackbarProvider';
import { useColorScheme } from '@/components/useColorScheme';
import { Card } from '@/components/ui/Card';
import { exportService } from '@/services/exportService';
import { haptics } from '@/lib/haptics';

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

export default function ExportReportScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { showSnackbar } = useSnackbar();

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [loading, setLoading] = useState(false);
  const [loadingType, setLoadingType] = useState<string | null>(null);

  const handleExportCSV = async () => {
    try {
      setLoading(true);
      setLoadingType('csv');
      const filePath = await exportService.exportCSV(selectedYear, selectedMonth);
      await exportService.shareFile(filePath, 'text/csv');
      haptics.success();
      showSnackbar({
        title: 'ส่งออก CSV แล้ว',
        message: 'สร้างและแชร์ไฟล์ CSV เรียบร้อย',
        variant: 'success',
      });
    } catch (e: any) {
      haptics.error();
      showSnackbar({
        message: e.message || 'ไม่สามารถส่งออกได้',
        variant: 'error',
        durationMs: 3200,
      });
    } finally {
      setLoading(false);
      setLoadingType(null);
    }
  };

  const handleExportHTML = async () => {
    try {
      setLoading(true);
      setLoadingType('html');
      const filePath = await exportService.exportHTMLReport(selectedYear, selectedMonth);
      await exportService.shareFile(filePath, 'text/html');
      haptics.success();
      showSnackbar({
        title: 'ส่งออก HTML แล้ว',
        message: 'สร้างและแชร์รายงาน HTML เรียบร้อย',
        variant: 'success',
      });
    } catch (e: any) {
      haptics.error();
      showSnackbar({
        message: e.message || 'ไม่สามารถส่งออกได้',
        variant: 'error',
        durationMs: 3200,
      });
    } finally {
      setLoading(false);
      setLoadingType(null);
    }
  };

  const changeMonth = (delta: number) => {
    let m = selectedMonth + delta;
    let y = selectedYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setSelectedMonth(m);
    setSelectedYear(y);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          title: 'ส่งออกรายงาน',
          headerStyle: { backgroundColor: colors.tint },
          headerTintColor: '#FFF',
        }}
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 16 }}>
        {/* Month Selector */}
        <Card variant="elevated">
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 12 }}>
              เลือกเดือนที่ต้องการส่งออก
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
              <Pressable onPress={() => changeMonth(-1)} style={{ padding: 8 }}>
                <FontAwesome name="chevron-left" size={18} color={colors.tint} />
              </Pressable>
              <View style={{ alignItems: 'center', minWidth: 160 }}>
                <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>
                  {THAI_MONTHS[selectedMonth]}
                </Text>
                <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 2 }}>
                  พ.ศ. {selectedYear + 543}
                </Text>
              </View>
              <Pressable onPress={() => changeMonth(1)} style={{ padding: 8 }}>
                <FontAwesome name="chevron-right" size={18} color={colors.tint} />
              </Pressable>
            </View>
          </View>
        </Card>

        {/* CSV Export */}
        <Card variant="elevated">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 }}>
            <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: '#4CAF50' + '15', justifyContent: 'center', alignItems: 'center' }}>
              <FontAwesome name="file-text" size={22} color="#4CAF50" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>CSV (Excel)</Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                เปิดใน Excel, Google Sheets, Numbers
              </Text>
            </View>
          </View>
          <View style={{ backgroundColor: colors.background, borderRadius: 10, padding: 12, marginBottom: 14 }}>
            <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 18 }}>
              📋 คอลัมน์: วันที่, ประเภท, จำนวนเงิน, หมวดหมู่, กระเป๋าเงิน, โน้ต{'\n'}
              ✅ รองรับภาษาไทยใน Excel (BOM UTF-8)
            </Text>
          </View>
          <Pressable
            onPress={handleExportCSV}
            disabled={loading}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              paddingVertical: 14, borderRadius: 14,
              backgroundColor: pressed ? '#388E3C' : '#4CAF50',
              opacity: loading ? 0.6 : 1,
            })}>
            {loadingType === 'csv' ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <FontAwesome name="share-square-o" size={16} color="#FFF" />
            )}
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFF' }}>ส่งออก CSV</Text>
          </Pressable>
        </Card>

        {/* HTML Export */}
        <Card variant="elevated">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 }}>
            <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: '#FF9800' + '15', justifyContent: 'center', alignItems: 'center' }}>
              <FontAwesome name="file-code-o" size={22} color="#FF9800" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>HTML Report</Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                รายงานสวยงาม เปิดในเบราว์เซอร์/พิมพ์ได้
              </Text>
            </View>
          </View>
          <View style={{ backgroundColor: colors.background, borderRadius: 10, padding: 12, marginBottom: 14 }}>
            <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 18 }}>
              📊 สรุปรายรับ/รายจ่าย/คงเหลือ{'\n'}
              📋 ตารางรายการทั้งหมดพร้อมสีแยกประเภท{'\n'}
              🖨️ สามารถพิมพ์หรือบันทึกเป็น PDF
            </Text>
          </View>
          <Pressable
            onPress={handleExportHTML}
            disabled={loading}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              paddingVertical: 14, borderRadius: 14,
              backgroundColor: pressed ? '#E65100' : '#FF9800',
              opacity: loading ? 0.6 : 1,
            })}>
            {loadingType === 'html' ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <FontAwesome name="share-square-o" size={16} color="#FFF" />
            )}
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFF' }}>ส่งออก HTML</Text>
          </Pressable>
        </Card>

        {/* Tips */}
        <Card variant="elevated">
          <View style={{ padding: 4 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>💡 เคล็ดลับ</Text>
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                • ส่ง CSV ไป Google Sheets เพื่อวิเคราะห์เพิ่มเติม
              </Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                • ส่ง HTML ไป Line/Email เพื่อเก็บบันทึก
              </Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                • เปิด HTML ในเบราว์เซอร์ แล้วพิมพ์เป็น PDF
              </Text>
            </View>
          </View>
        </Card>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}
