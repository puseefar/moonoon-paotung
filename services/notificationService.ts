import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { appSecureStore } from '@/lib/secureStore';

const REMINDER_KEY = 'poatung_reminder_enabled';
const REMINDER_HOUR_KEY = 'poatung_reminder_hour';
const REMINDER_MINUTE_KEY = 'poatung_reminder_minute';
const REMINDER_NOTIFICATION_ID = 'poatung_daily_reminder';

type NotificationsModule = typeof import('expo-notifications');

const isExpoGo = Constants.appOwnership === 'expo';
let notificationsModule: NotificationsModule | null = null;
let handlerConfigured = false;

async function getNotifications(): Promise<NotificationsModule | null> {
  if (isExpoGo) return null;
  if (!notificationsModule) {
    notificationsModule = await import('expo-notifications');
  }
  if (!handlerConfigured) {
    notificationsModule.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    handlerConfigured = true;
  }
  return notificationsModule;
}

export const notificationService = {
  isLimitedInExpoGo() {
    return isExpoGo;
  },

  async requestPermission(): Promise<boolean> {
    const Notifications = await getNotifications();
    if (!Notifications) return false;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return false;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('reminder', {
        name: 'เตือนบันทึกรายจ่าย',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    return true;
  },

  async scheduleDailyReminder(hour: number = 20, minute: number = 0): Promise<boolean> {
    const Notifications = await getNotifications();
    if (!Notifications) return false;

    const granted = await this.requestPermission();
    if (!granted) return false;

    // ยกเลิกอันเก่าก่อน
    await this.cancelDailyReminder();

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '💰 Poatung เตือนบันทึก',
        body: 'อย่าลืมบันทึกรายรับรายจ่ายวันนี้นะครับ!',
        sound: 'default',
        ...(Platform.OS === 'android' ? { channelId: 'reminder' } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
      identifier: REMINDER_NOTIFICATION_ID,
    });

    await appSecureStore.setItemAsync(REMINDER_KEY, 'true');
    await appSecureStore.setItemAsync(REMINDER_HOUR_KEY, String(hour));
    await appSecureStore.setItemAsync(REMINDER_MINUTE_KEY, String(minute));

    return true;
  },

  async cancelDailyReminder(): Promise<void> {
    const Notifications = await getNotifications();
    if (Notifications) {
      await Notifications.cancelScheduledNotificationAsync(REMINDER_NOTIFICATION_ID).catch(() => {});
    }
    await appSecureStore.setItemAsync(REMINDER_KEY, 'false');
  },

  async isReminderEnabled(): Promise<boolean> {
    const value = await appSecureStore.getItemAsync(REMINDER_KEY);
    return value === 'true';
  },

  async getReminderTime(): Promise<{ hour: number; minute: number }> {
    const hour = await appSecureStore.getItemAsync(REMINDER_HOUR_KEY);
    const minute = await appSecureStore.getItemAsync(REMINDER_MINUTE_KEY);
    return {
      hour: hour ? parseInt(hour, 10) : 20,
      minute: minute ? parseInt(minute, 10) : 0,
    };
  },

  async sendTestNotification(): Promise<boolean> {
    const Notifications = await getNotifications();
    if (!Notifications) return false;

    const granted = await this.requestPermission();
    if (!granted) return false;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '💰 Poatung ทดสอบ',
        body: 'การแจ้งเตือนทำงานปกติ!',
        sound: 'default',
        ...(Platform.OS === 'android' ? { channelId: 'reminder' } : {}),
      },
      trigger: null,
    });

    return true;
  },
};
