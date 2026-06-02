import * as Haptics from 'expo-haptics';

export const haptics = {
  // เมื่อบันทึกสำเร็จ
  success() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },

  // เมื่อลบ
  warning() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  },

  // เมื่อเกิดข้อผิดพลาด
  error() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  },

  // เมื่อกดปุ่ม
  light() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },

  // เมื่อกดปุ่มสำคัญ
  medium() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  },

  // เมื่อเลือก item
  selection() {
    Haptics.selectionAsync();
  },
};
