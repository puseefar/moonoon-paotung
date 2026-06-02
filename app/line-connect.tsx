import { useState, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert, ScrollView, Switch } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { api } from '@/lib/api/client';
import type { LineConnection, LineNotificationSettings } from '@/lib/api/contract';
import { useSnackbar } from '@/components/ui/SnackbarProvider';

export default function LineConnectScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showSnackbar } = useSnackbar();

  const [conn, setConn] = useState<LineConnection | null>(null);
  const [settings, setSettings] = useState<LineNotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    const [connRes, settingsRes] = await Promise.all([
      api.getLineConnection(),
      api.getLineSettings(),
    ]);
    if (connRes.ok) setConn(connRes.data);
    if (settingsRes.ok) setSettings(settingsRes.data);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  async function handleConnect() {
    setConnecting(true);
    try {
      // Mock: simulate LINE OA connect flow
      const result = await api.mockConnectLine();
      if (result.ok) {
        setConn(result.data);
        showSnackbar({ message: '✅ เชื่อมต่อ LINE สำเร็จ', variant: 'success' });
      }
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    Alert.alert('ยกเลิกการเชื่อมต่อ', 'ต้องการยกเลิกการเชื่อมต่อ LINE หรือไม่?', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ยืนยัน', style: 'destructive', onPress: async () => {
          const result = await api.disconnectLine();
          if (result.ok) {
            const connRes = await api.getLineConnection();
            if (connRes.ok) setConn(connRes.data);
            showSnackbar({ message: 'ยกเลิกการเชื่อมต่อ LINE แล้ว', variant: 'info' });
          }
        },
      },
    ]);
  }

  async function toggleSetting(key: keyof LineNotificationSettings, value: boolean) {
    if (!settings) return;
    setUpdating(true);
    try {
      const result = await api.updateLineSettings({ [key]: value });
      if (result.ok) setSettings(result.data);
    } finally {
      setUpdating(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F0FDF4' }}>
      <Stack.Screen options={{ headerShown: false }} />

      <LinearGradient colors={['#065F46', '#059669', '#34D399']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 8, paddingBottom: 20, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => router.back()} style={{ padding: 6, marginRight: 8 }}>
            <Text style={{ fontSize: 20, color: '#fff' }}>←</Text>
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff' }}>💬 LINE แจ้งเตือน</Text>
        </View>
        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 4, marginLeft: 38 }}>
          รับการแจ้งเตือนสถานะผ่าน LINE OA
        </Text>
      </LinearGradient>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#059669" />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 80 }}>

          {/* Connection status */}
          <View style={{ backgroundColor: '#fff', borderRadius: 18, padding: 20, marginBottom: 16,
            elevation: 1, shadowColor: '#059669', shadowOpacity: 0.08, shadowRadius: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ width: 56, height: 56, borderRadius: 28,
                backgroundColor: conn?.connected ? '#DCFCE7' : '#F3F4F6',
                justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 28 }}>💬</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#111' }}>
                  {conn?.connected ? (conn.displayName ?? 'LINE Connected') : 'ยังไม่ได้เชื่อมต่อ'}
                </Text>
                <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>
                  {conn?.connected
                    ? `ID: ${conn.lineUserId?.slice(0, 12)}...`
                    : 'เชื่อมต่อ LINE OA เพื่อรับแจ้งเตือน'}
                </Text>
              </View>
              <View style={{ backgroundColor: conn?.connected ? '#DCFCE7' : '#FEF2F2',
                borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: '700',
                  color: conn?.connected ? '#065F46' : '#7F1D1D' }}>
                  {conn?.connected ? '● เชื่อมแล้ว' : '○ ยังไม่เชื่อม'}
                </Text>
              </View>
            </View>

            <View style={{ marginTop: 16 }}>
              {!conn?.connected ? (
                <Pressable onPress={handleConnect} disabled={connecting}
                  style={{ backgroundColor: connecting ? '#A7F3D0' : '#059669',
                    borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}>
                  {connecting
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>
                        เชื่อมต่อ LINE OA
                      </Text>}
                </Pressable>
              ) : (
                <Pressable onPress={handleDisconnect}
                  style={{ borderRadius: 14, paddingVertical: 12, alignItems: 'center',
                    borderWidth: 1.5, borderColor: '#FCA5A5' }}>
                  <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 14 }}>
                    ยกเลิกการเชื่อมต่อ
                  </Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* Notification settings (แสดงเมื่อเชื่อมแล้ว) */}
          {conn?.connected && settings && (
            <View style={{ backgroundColor: '#fff', borderRadius: 18, padding: 20,
              elevation: 1, shadowColor: '#059669', shadowOpacity: 0.08, shadowRadius: 8 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#111', marginBottom: 16 }}>
                ⚙️ ตั้งค่าการแจ้งเตือน
              </Text>

              {([
                { key: 'enabled' as const, label: 'เปิดรับการแจ้งเตือน', icon: '🔔' },
                { key: 'paymentAlerts' as const, label: 'แจ้งเตือนการชำระเงิน', icon: '💳' },
                { key: 'orderAlerts' as const, label: 'แจ้งเตือน order ใหม่', icon: '📦' },
                { key: 'dailyDigest' as const, label: 'สรุปรายวัน', icon: '📊' },
              ] as const).map(item => (
                <View key={item.key}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
                    borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
                  <Text style={{ fontSize: 20, marginRight: 12 }}>{item.icon}</Text>
                  <Text style={{ flex: 1, fontSize: 14, color: '#374151', fontWeight: '500' }}>
                    {item.label}
                  </Text>
                  <Switch
                    value={settings[item.key]}
                    onValueChange={(v) => toggleSetting(item.key, v)}
                    disabled={updating || (item.key !== 'enabled' && !settings.enabled)}
                    trackColor={{ false: '#E5E7EB', true: '#6EE7B7' }}
                    thumbColor={settings[item.key] ? '#059669' : '#9CA3AF'}
                  />
                </View>
              ))}

              <View style={{ marginTop: 12, backgroundColor: '#F0FDF4',
                borderRadius: 10, padding: 12, flexDirection: 'row', gap: 8 }}>
                <Text>ℹ️</Text>
                <Text style={{ flex: 1, fontSize: 11, color: '#065F46', lineHeight: 18 }}>
                  การแจ้งเตือนถูกส่งผ่าน LINE OA ไม่เกิน 2 ครั้ง/วัน เพื่อควบคุมต้นทุน
                </Text>
              </View>
            </View>
          )}

          {/* Info box */}
          <View style={{ backgroundColor: '#FFFBEB', borderRadius: 14, padding: 16,
            marginTop: 16, flexDirection: 'row', gap: 10 }}>
            <Text style={{ fontSize: 20 }}>⚠️</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#92400E', marginBottom: 4 }}>
                LINE Messaging API (ไม่ใช่ LINE Notify)
              </Text>
              <Text style={{ fontSize: 12, color: '#92400E', lineHeight: 18 }}>
                LINE Notify ถูกยุติแล้ว (เม.ย. 2025) ระบบนี้ใช้ LINE Messaging API ผ่าน LINE OA แทน
              </Text>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}
