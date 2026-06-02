import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, Alert, ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Colors from '@/constants/Colors';
import { useSnackbar } from '@/components/ui/SnackbarProvider';
import { useColorScheme } from '@/components/useColorScheme';
import { Card } from '@/components/ui/Card';
import { backupService } from '@/services/backupService';
import { haptics } from '@/lib/haptics';

export default function BackupScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { showSnackbar } = useSnackbar();

  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [syncHistory, setSyncHistory] = useState<any[]>([]);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const history = await backupService.getSyncHistory();
    setSyncHistory(history);
  };

  const handleBackup = async () => {
    try {
      setLoading(true);
      setLoadingAction('backup');
      await backupService.shareBackupFile();
      haptics.success();
      showSnackbar({ title: 'สำรองข้อมูลแล้ว', message: 'สร้างไฟล์ Backup เรียบร้อย', variant: 'success' });
      loadHistory();
    } catch (e: any) {
      haptics.error();
      showSnackbar({
        message: e.message || 'ไม่สามารถสร้าง Backup ได้',
        variant: 'error',
        durationMs: 3200,
      });
      await backupService.logSync('backup', 'failed', undefined, e.message);
    } finally {
      setLoading(false);
      setLoadingAction(null);
    }
  };

  const handleRestore = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      const jsonContent = await FileSystem.readAsStringAsync(file.uri);
      const data = await backupService.importFromJson(jsonContent);

      Alert.alert(
        'ยืนยันกู้คืนข้อมูล',
        `ไฟล์ Backup นี้มี:\n• ${data.stats.totalTransactions} รายการ\n• ${data.stats.totalWallets} กระเป๋าเงิน\n• ${data.stats.totalCategories} หมวดหมู่\n\n⚠️ ข้อมูลปัจจุบันจะถูกลบทั้งหมด`,
        [
          { text: 'ยกเลิก', style: 'cancel' },
          {
            text: 'กู้คืน',
            style: 'destructive',
            onPress: async () => {
              try {
                setLoading(true);
                setLoadingAction('restore');
                await backupService.restoreFromBackup(data);
                haptics.success();
                showSnackbar({
                  title: 'กู้คืนข้อมูลแล้ว',
                  message: 'กู้คืนข้อมูลเรียบร้อยแล้ว กรุณาปิดแอปแล้วเปิดใหม่',
                  variant: 'success',
                  durationMs: 3400,
                });
                loadHistory();
              } catch (e: any) {
                haptics.error();
                showSnackbar({
                  message: e.message || 'ไม่สามารถกู้คืนข้อมูลได้',
                  variant: 'error',
                  durationMs: 3200,
                });
                await backupService.logSync('restore', 'failed', undefined, e.message);
              } finally {
                setLoading(false);
                setLoadingAction(null);
              }
            },
          },
        ],
      );
    } catch (e: any) {
      showSnackbar({
        message: 'ไม่สามารถอ่านไฟล์ได้',
        variant: 'error',
        durationMs: 3000,
      });
    }
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          title: 'สำรองและกู้คืนข้อมูล',
          headerStyle: { backgroundColor: colors.tint },
          headerTintColor: '#FFF',
        }}
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 16 }}>
        {/* Backup */}
        <Card variant="elevated">
          <View style={{ alignItems: 'center', padding: 8 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: '#9C27B0' + '15', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
              <FontAwesome name="cloud-upload" size={28} color="#9C27B0" />
            </View>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>สำรองข้อมูล</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 4, lineHeight: 20 }}>
              Export ข้อมูลทั้งหมดเป็นไฟล์ JSON{'\n'}สามารถแชร์ไปยัง Google Drive, Line, Email
            </Text>
            <Pressable
              onPress={handleBackup}
              disabled={loading}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                marginTop: 16,
                paddingVertical: 14,
                paddingHorizontal: 32,
                borderRadius: 14,
                backgroundColor: pressed ? '#7B1FA2' : '#9C27B0',
                opacity: loading ? 0.6 : 1,
                width: '100%',
              })}>
              {loadingAction === 'backup' ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <FontAwesome name="download" size={16} color="#FFF" />
              )}
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFF' }}>สร้าง Backup</Text>
            </Pressable>
          </View>
        </Card>

        {/* Restore */}
        <Card variant="elevated">
          <View style={{ alignItems: 'center', padding: 8 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: '#00BCD4' + '15', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
              <FontAwesome name="cloud-download" size={28} color="#00BCD4" />
            </View>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>กู้คืนข้อมูล</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 4, lineHeight: 20 }}>
              เลือกไฟล์ JSON Backup เพื่อกู้คืน{'\n'}⚠️ ข้อมูลปัจจุบันจะถูกแทนที่ทั้งหมด
            </Text>
            <Pressable
              onPress={handleRestore}
              disabled={loading}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                marginTop: 16,
                paddingVertical: 14,
                paddingHorizontal: 32,
                borderRadius: 14,
                backgroundColor: pressed ? '#00838F' : '#00BCD4',
                opacity: loading ? 0.6 : 1,
                width: '100%',
              })}>
              {loadingAction === 'restore' ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <FontAwesome name="upload" size={16} color="#FFF" />
              )}
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFF' }}>เลือกไฟล์กู้คืน</Text>
            </Pressable>
          </View>
        </Card>

        {/* Sync History */}
        {syncHistory.length > 0 && (
          <View>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8, paddingHorizontal: 4 }}>
              ประวัติล่าสุด
            </Text>
            <Card variant="elevated" style={{ padding: 0, overflow: 'hidden' }}>
              {syncHistory.map((log, i) => (
                <View key={log.id}>
                  {i > 0 && <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 16 }} />}
                  <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 }}>
                    <View style={{
                      width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center',
                      backgroundColor: log.status === 'success' ? colors.income + '15' : colors.expense + '15',
                    }}>
                      <FontAwesome
                        name={log.status === 'success' ? 'check' : 'times'}
                        size={14}
                        color={log.status === 'success' ? colors.income : colors.expense}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                        {log.action === 'backup' ? 'สำรองข้อมูล' : 'กู้คืนข้อมูล'}
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                        {new Date(log.timestamp).toLocaleString('th-TH')}
                        {log.fileSize ? ` • ${formatFileSize(log.fileSize)}` : ''}
                      </Text>
                    </View>
                    <View style={{
                      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
                      backgroundColor: log.status === 'success' ? colors.income + '15' : colors.expense + '15',
                    }}>
                      <Text style={{
                        fontSize: 11, fontWeight: '600',
                        color: log.status === 'success' ? colors.income : colors.expense,
                      }}>
                        {log.status === 'success' ? 'สำเร็จ' : 'ผิดพลาด'}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </Card>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}
