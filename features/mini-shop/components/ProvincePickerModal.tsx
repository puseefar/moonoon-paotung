import { useState, useMemo } from 'react';
import {
  Modal, View, Text, Pressable, TextInput, FlatList, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THAI_PROVINCES } from '../config/thaiProvinces';

interface Props {
  visible: boolean;
  selected: string;
  onSelect: (province: string) => void;
  onClose: () => void;
}

export function ProvincePickerModal({ visible, selected, onSelect, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() =>
    search.trim()
      ? THAI_PROVINCES.filter(p => p.includes(search.trim()))
      : THAI_PROVINCES,
    [search]
  );

  function handleSelect(province: string) {
    onSelect(province);
    setSearch('');
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#F8F5FF' }}>

        {/* Header */}
        <View style={{ paddingTop: insets.top + 12, paddingBottom: 12, paddingHorizontal: 16,
          backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0EAF8',
          flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#2D1B69' }}>เลือกจังหวัด</Text>
            <Text style={{ fontSize: 11, color: '#9B7FC8', marginTop: 1 }}>
              {THAI_PROVINCES.length} จังหวัด
            </Text>
          </View>
          <Pressable onPress={onClose}
            style={{ backgroundColor: '#F3F0FF', borderRadius: 10,
              paddingHorizontal: 12, paddingVertical: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#7C3AED' }}>ปิด</Text>
          </Pressable>
        </View>

        {/* Search */}
        <View style={{ padding: 12, backgroundColor: '#fff',
          borderBottomWidth: 1, borderBottomColor: '#F0EAF8' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8,
            backgroundColor: '#F8F5FF', borderRadius: 12, paddingHorizontal: 12,
            borderWidth: 1.5, borderColor: 'rgba(124,58,237,0.2)' }}>
            <Text style={{ fontSize: 14, opacity: 0.5 }}>🔍</Text>
            <TextInput
              value={search} onChangeText={setSearch}
              placeholder="ค้นหาจังหวัด..." placeholderTextColor="#C4B5D8"
              style={{ flex: 1, paddingVertical: 10, fontSize: 14, color: '#2D1B69' }}
              autoFocus
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')}>
                <Text style={{ fontSize: 14, color: '#9B7FC8' }}>✕</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Province list */}
        <FlatList
          data={filtered}
          keyExtractor={item => item}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          renderItem={({ item }) => {
            const isSelected = item === selected;
            return (
              <Pressable onPress={() => handleSelect(item)}
                style={[styles.item, isSelected && styles.itemActive]}>
                <Text style={[styles.itemText, isSelected && styles.itemTextActive]}>
                  {item}
                </Text>
                {isSelected && (
                  <Text style={{ fontSize: 16, color: '#7C3AED' }}>✓</Text>
                )}
              </Pressable>
            );
          }}
          ItemSeparatorComponent={() => (
            <View style={{ height: 1, backgroundColor: '#F0EAF8', marginHorizontal: 16 }} />
          )}
          ListEmptyComponent={() => (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Text style={{ fontSize: 36, marginBottom: 8 }}>🗺️</Text>
              <Text style={{ fontSize: 14, color: '#9B7FC8' }}>ไม่พบจังหวัด "{search}"</Text>
            </View>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 20,
    backgroundColor: '#fff',
  },
  itemActive: {
    backgroundColor: 'rgba(124,58,237,0.05)',
  },
  itemText: {
    fontSize: 15, color: '#2D1B69', fontWeight: '500',
  },
  itemTextActive: {
    fontWeight: '800', color: '#7C3AED',
  },
});
