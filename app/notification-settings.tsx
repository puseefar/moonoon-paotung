import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Colors from '@/constants/Colors';
import { Card } from '@/components/ui/Card';
import { useSnackbar } from '@/components/ui/SnackbarProvider';
import { useColorScheme } from '@/components/useColorScheme';
import { haptics } from '@/lib/haptics';
import { notificationService } from '@/services/notificationService';

const HOUR_OPTIONS = [
  { label: '07:00 น.', hour: 7, minute: 0 },
  { label: '08:00 น.', hour: 8, minute: 0 },
  { label: '12:00 น.', hour: 12, minute: 0 },
  { label: '18:00 น.', hour: 18, minute: 0 },
  { label: '19:00 น.', hour: 19, minute: 0 },
  { label: '20:00 น.', hour: 20, minute: 0 },
  { label: '21:00 น.', hour: 21, minute: 0 },
  { label: '22:00 น.', hour: 22, minute: 0 },
];

export default function NotificationSettingsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { showSnackbar } = useSnackbar();

  const [enabled, setEnabled] = useState(false);
  const [selectedHour, setSelectedHour] = useState(20);
  const [selectedMinute, setSelectedMinute] = useState(0);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    const isEnabled = await notificationService.isReminderEnabled();
    const time = await notificationService.getReminderTime();
    setEnabled(isEnabled);
    setSelectedHour(time.hour);
    setSelectedMinute(time.minute);
  };

  const handleToggle = async (value: boolean) => {
    if (value && notificationService.isLimitedInExpoGo()) {
      showSnackbar({
        title: 'ต้องใช้ Development Build',
        message: 'Expo Go บน Android ยังไม่รองรับการแจ้งเตือนจริง กรุณาใช้ development build',
        variant: 'warning',
        durationMs: 3400,
      });
      return;
    }

    if (value) {
      const success = await notificationService.scheduleDailyReminder(selectedHour, selectedMinute);
      if (!success) {
        showSnackbar({
          title: 'ยังไม่ได้รับอนุญาต',
          message: 'กรุณาอนุญาตการแจ้งเตือนในตั้งค่าเครื่อง',
          variant: 'error',
        });
        return;
      }

      haptics.success();
      setEnabled(true);
      showSnackbar({
        title: 'เปิดแจ้งเตือนแล้ว',
        message: `จะเตือนทุกวันเวลา ${String(selectedHour).padStart(2, '0')}:${String(selectedMinute).padStart(2, '0')} น.`,
        variant: 'success',
      });
      return;
    }

    await notificationService.cancelDailyReminder();
    setEnabled(false);
    haptics.light();
    showSnackbar({
      title: 'ปิดแจ้งเตือนแล้ว',
      message: 'ยกเลิกการแจ้งเตือนรายวันเรียบร้อย',
      variant: 'info',
    });
  };

  const handleTimeSelect = async (hour: number, minute: number) => {
    setSelectedHour(hour);
    setSelectedMinute(minute);

    if (!enabled) return;

    await notificationService.scheduleDailyReminder(hour, minute);
    haptics.success();
    showSnackbar({
      title: 'อัปเดตเวลาแล้ว',
      message: `ระบบจะเตือนเวลา ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} น.`,
      variant: 'success',
    });
  };

  const handleTest = async () => {
    const success = await notificationService.sendTestNotification();
    if (!success) {
      showSnackbar({
        title: 'ต้องใช้ Development Build',
        message: 'Expo Go บน Android ยังไม่รองรับ notification ของ SDK รุ่นนี้',
        variant: 'warning',
        durationMs: 3200,
      });
      return;
    }

    haptics.success();
    showSnackbar({
      title: 'ส่งแล้ว',
      message: 'ส่งการแจ้งเตือนทดสอบแล้ว',
      variant: 'success',
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          title: 'การแจ้งเตือน',
          headerStyle: { backgroundColor: colors.tint },
          headerTintColor: '#FFF',
        }}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Card variant="elevated">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                backgroundColor: '#FF5722' + '15',
                justifyContent: 'center',
                alignItems: 'center',
              }}>
              <FontAwesome name="bell" size={22} color="#FF5722" />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                เตือนบันทึกรายจ่าย
              </Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                แจ้งเตือนทุกวัน เวลา {String(selectedHour).padStart(2, '0')}:
                {String(selectedMinute).padStart(2, '0')} น.
              </Text>
            </View>

            <Switch value={enabled} onValueChange={handleToggle} trackColor={{ true: colors.tint }} />
          </View>
        </Card>

        <View>
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: colors.textSecondary,
              marginBottom: 8,
              paddingHorizontal: 4,
            }}>
            เวลาแจ้งเตือน
          </Text>

          <Card variant="elevated">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {HOUR_OPTIONS.map((opt) => {
                const isSelected = opt.hour === selectedHour && opt.minute === selectedMinute;
                return (
                  <Pressable
                    key={opt.label}
                    onPress={() => handleTimeSelect(opt.hour, opt.minute)}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 10,
                      backgroundColor: isSelected ? colors.tint : colors.background,
                      borderWidth: 1,
                      borderColor: isSelected ? colors.tint : colors.border,
                    }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: '600',
                        color: isSelected ? '#FFF' : colors.textSecondary,
                      }}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        </View>

        <Pressable
          onPress={handleTest}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: 14,
            borderRadius: 14,
            backgroundColor: pressed ? '#E64A19' : '#FF5722',
          })}>
          <FontAwesome name="bell-o" size={16} color="#FFF" />
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFF' }}>ส่งแจ้งเตือนทดสอบ</Text>
        </Pressable>

        <Card variant="elevated">
          <View style={{ padding: 4 }}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: colors.textSecondary,
                marginBottom: 8,
              }}>
              ข้อมูล
            </Text>

            <View style={{ gap: 6 }}>
              {notificationService.isLimitedInExpoGo() && (
                <Text style={{ fontSize: 13, color: '#FF5722' }}>
                  • Expo Go บน Android ยังใช้ทดสอบ notification จริงไม่ได้ กรุณาใช้ development build
                </Text>
              )}
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                • แจ้งเตือนจะส่งทุกวันตามเวลาที่ตั้งไว้
              </Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                • ต้องอนุญาตการแจ้งเตือนในตั้งค่าเครื่องก่อน
              </Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                • ปิดการแจ้งเตือนได้ตลอดเวลา
              </Text>
            </View>
          </View>
        </Card>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}
