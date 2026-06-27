import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput, Alert, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Stack } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Colors from '@/constants/Colors';
import { useSnackbar } from '@/components/ui/SnackbarProvider';
import { useColorScheme } from '@/components/useColorScheme';
import { Card } from '@/components/ui/Card';
import { categoryService } from '@/services/categoryService';
import type { Category } from '@/db/schema';

const EMOJI_LIST = [
  '🍜', '🚗', '🏠', '⚡', '📱', '🛒', '🏥', '🎓', '🎮', '👕',
  '📦', '💰', '💼', '🏦', '🎁', '🍺', '☕', '🎬', '✂️', '🏋️',
  '🐶', '💊', '📚', '🎵', '🛫', '🎂', '🔧', '🧹', '👶', '💄',
];

const COLOR_LIST = [
  '#FF5722', '#2196F3', '#9C27B0', '#FF9800', '#00BCD4', '#E91E63',
  '#4CAF50', '#3F51B5', '#673AB7', '#795548', '#607D8B', '#F44336',
  '#8BC34A', '#CDDC39', '#FFC107', '#009688',
];

export default function CategoryManageScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { showSnackbar } = useSnackbar();

  const [categories, setCategories] = useState<Category[]>([]);
  const [activeType, setActiveType] = useState<'expense' | 'income'>('expense');
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Form
  const [catName, setCatName] = useState('');
  const [catIcon, setCatIcon] = useState('📦');
  const [catColor, setCatColor] = useState('#607D8B');

  useEffect(() => { loadCategories(); }, []);

  const loadCategories = async () => {
    const all = await categoryService.getAll();
    setCategories(all);
  };

  const filtered = categories.filter((c) => c.type === activeType);

  const openAddModal = () => {
    setEditingCategory(null);
    setCatName(''); setCatIcon('📦'); setCatColor('#607D8B');
    setShowModal(true);
  };

  const openEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setCatName(cat.name);
    setCatIcon(cat.icon);
    setCatColor(cat.color ?? '#607D8B');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!catName.trim()) {
      showSnackbar({ message: 'กรุณาใส่ชื่อหมวดหมู่', variant: 'warning' });
      return;
    }

    if (editingCategory) {
      await categoryService.update(editingCategory.id, {
        name: catName.trim(),
        icon: catIcon,
        color: catColor,
      });
    } else {
      await categoryService.create({
        name: catName.trim(),
        icon: catIcon,
        type: activeType,
        color: catColor,
        sortOrder: filtered.length + 1,
        isDefault: false,
      });
    }

    setShowModal(false);
    loadCategories();
    showSnackbar({
      title: editingCategory ? 'อัปเดตหมวดหมู่แล้ว' : 'เพิ่มหมวดหมู่แล้ว',
      message: editingCategory ? 'บันทึกการแก้ไขหมวดหมู่เรียบร้อย' : 'สร้างหมวดหมู่ใหม่เรียบร้อย',
      variant: 'success',
    });
  };

  const handleDelete = (cat: Category) => {
    if (cat.isDefault) {
      showSnackbar({
        title: 'ไม่สามารถลบได้',
        message: 'หมวดหมู่เริ่มต้นไม่สามารถลบได้',
        variant: 'warning',
        durationMs: 3000,
      });
      return;
    }
    Alert.alert('ลบหมวดหมู่', `ต้องการลบ "${cat.name}" หรือไม่?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'ลบ', style: 'destructive', onPress: async () => { await categoryService.delete(cat.id); loadCategories(); } },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: 'จัดการหมวดหมู่', headerStyle: { backgroundColor: '#FF9800' }, headerTintColor: '#FFF' }} />

      {/* Type Toggle */}
      <View style={{ flexDirection: 'row', padding: 16, gap: 8, backgroundColor: colors.cardBackground, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        {(['expense', 'income'] as const).map((t) => (
          <Pressable key={t} onPress={() => setActiveType(t)} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: activeType === t ? (t === 'expense' ? colors.expense : colors.income) : 'transparent', borderWidth: 1, borderColor: t === 'expense' ? colors.expense : colors.income, alignItems: 'center' }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: activeType === t ? '#FFF' : colors.textSecondary }}>{t === 'expense' ? 'รายจ่าย' : 'รายรับ'}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 8 }}>
        {filtered.map((cat) => (
          <Card key={cat.id} variant="elevated" style={{ padding: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: (cat.color ?? '#607D8B') + '20', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 22 }}>{cat.icon}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{cat.name}</Text>
                {cat.isDefault && <Text style={{ fontSize: 11, color: colors.textSecondary }}>ค่าเริ่มต้น</Text>}
              </View>
              <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: cat.color ?? '#607D8B', marginRight: 12 }} />
              <Pressable onPress={() => openEditModal(cat)} style={{ padding: 8 }}>
                <FontAwesome name="pencil" size={14} color={colors.tint} />
              </Pressable>
              {!cat.isDefault && (
                <Pressable onPress={() => handleDelete(cat)} style={{ padding: 8 }}>
                  <FontAwesome name="trash" size={14} color={colors.expense} />
                </Pressable>
              )}
            </View>
          </Card>
        ))}

        <Pressable onPress={openAddModal} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 14, borderWidth: 2, borderStyle: 'dashed', borderColor: '#FF9800', gap: 8, marginTop: 4 }}>
          <FontAwesome name="plus-circle" size={18} color="#FF9800" />
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#FF9800' }}>เพิ่มหมวดหมู่ใหม่</Text>
        </Pressable>
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => setShowModal(false)} />
          <View style={{ backgroundColor: colors.cardBackground, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>{editingCategory ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่ใหม่'}</Text>
              <Pressable onPress={() => setShowModal(false)}><FontAwesome name="times" size={22} color={colors.textSecondary} /></Pressable>
            </View>

            {/* Emoji Picker */}
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>ไอคอน</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {EMOJI_LIST.map((em) => (
                <Pressable key={em} onPress={() => setCatIcon(em)} style={{ width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: catIcon === em ? catColor + '20' : colors.background, borderWidth: catIcon === em ? 2 : 0, borderColor: catColor }}>
                  <Text style={{ fontSize: 20 }}>{em}</Text>
                </Pressable>
              ))}
            </View>

            {/* Name */}
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>ชื่อหมวดหมู่</Text>
            <TextInput value={catName} onChangeText={setCatName} placeholder="เช่น สัตว์เลี้ยง" placeholderTextColor={colors.textSecondary} style={{ backgroundColor: colors.background, borderRadius: 12, padding: 14, fontSize: 15, color: colors.text, marginBottom: 16, borderWidth: 1, borderColor: colors.border }} />

            {/* Color Picker */}
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>สี</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {COLOR_LIST.map((c) => (
                <Pressable key={c} onPress={() => setCatColor(c)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c, borderWidth: catColor === c ? 3 : 0, borderColor: '#FFF', shadowColor: catColor === c ? c : 'transparent', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 4, elevation: catColor === c ? 4 : 0 }}>
                  {catColor === c && <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><FontAwesome name="check" size={14} color="#FFF" /></View>}
                </Pressable>
              ))}
            </View>

            <Pressable onPress={handleSave} style={({ pressed }) => ({ backgroundColor: pressed ? '#E65100' : '#FF9800', paddingVertical: 16, borderRadius: 14, alignItems: 'center' })}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFF' }}>{editingCategory ? 'บันทึก' : 'เพิ่มหมวดหมู่'}</Text>
            </Pressable>
            <View style={{ height: 20 }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
