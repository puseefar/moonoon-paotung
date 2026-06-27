// ── AddressAutocompleteInput ─────────────────────────────────────────────────
// ช่องค้นหาที่อยู่ไทยแบบออฟไลน์ (ตำบล / รหัสไปรษณีย์)
// เมื่อเลือก → auto-fill ตำบล/อำเภอ/จังหวัด/รหัสไปรษณีย์

import { useState, useRef } from 'react';
import {
  View, Text, TextInput, Pressable, FlatList,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { searchAddress, type ThaiAddressRow } from '../services/thaiAddressService';

interface Props {
  onSelect: (row: ThaiAddressRow) => void;
  selected?: ThaiAddressRow | null;
  onClear: () => void;
}

export function AddressAutocompleteInput({ onSelect, selected, onClear }: Props) {
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState<ThaiAddressRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [focused, setFocused]   = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(text: string) {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(() => {
      const found = searchAddress(text, 8);
      setResults(found);
      setSearching(false);
    }, 180);
  }

  function handleSelect(row: ThaiAddressRow) {
    setQuery('');
    setResults([]);
    setFocused(false);
    onSelect(row);
  }

  function handleClear() {
    setQuery('');
    setResults([]);
    onClear();
  }

  // ── แสดงที่อยู่ที่เลือกแล้ว ──────────────────────────────
  if (selected) {
    return (
      <View style={styles.selectedCard}>
        <View style={styles.selectedIcon}>
          <Text style={{ fontSize: 16 }}>📍</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.selectedSub}>
            ตำบล{selected.subDistrict}
          </Text>
          <Text style={styles.selectedDetail}>
            อำเภอ{selected.district} · จังหวัด{selected.province} · {selected.zip}
          </Text>
        </View>
        <Pressable onPress={handleClear} style={styles.clearBtn}>
          <Text style={{ fontSize: 12, color: '#7C3AED', fontWeight: '700' }}>เปลี่ยน</Text>
        </Pressable>
      </View>
    );
  }

  // ── ช่องค้นหา ─────────────────────────────────────────────
  return (
    <View>
      <View style={[styles.searchBox, focused && styles.searchBoxFocused]}>
        <Text style={{ fontSize: 15, marginRight: 6 }}>🔍</Text>
        <TextInput
          value={query}
          onChangeText={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          placeholder="พิมพ์ชื่อตำบล หรือ รหัสไปรษณีย์"
          placeholderTextColor="#C4B5D8"
          style={styles.searchInput}
          returnKeyType="search"
          autoCorrect={false}
        />
        {searching && <ActivityIndicator size="small" color="#A78BFA" style={{ marginLeft: 6 }} />}
        {query.length > 0 && !searching && (
          <Pressable onPress={() => { setQuery(''); setResults([]); }} style={{ padding: 4 }}>
            <Text style={{ fontSize: 13, color: '#C4B5D8', fontWeight: '700' }}>✕</Text>
          </Pressable>
        )}
      </View>

      {/* Dropdown results */}
      {focused && results.length > 0 && (
        <View style={styles.dropdown}>
          <FlatList
            data={results}
            keyExtractor={(r, i) => `${r.zip}-${r.subDistrict}-${i}`}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={results.length > 4}
            style={{ maxHeight: 260 }}
            ItemSeparatorComponent={() => (
              <View style={{ height: 1, backgroundColor: '#F0EAF8', marginHorizontal: 12 }} />
            )}
            renderItem={({ item: r }) => (
              <Pressable onPress={() => handleSelect(r)} style={styles.dropdownRow}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.subDistrictText}>ต.{r.subDistrict}</Text>
                    <Text style={styles.districtText}>อ.{r.district}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <Text style={styles.provinceText}>{r.province}</Text>
                  </View>
                </View>
                <View style={styles.zipBadge}>
                  <Text style={styles.zipText}>{r.zip}</Text>
                </View>
              </Pressable>
            )}
          />
        </View>
      )}

      {/* No result hint */}
      {focused && query.length >= 2 && !searching && results.length === 0 && (
        <View style={styles.dropdown}>
          <View style={{ padding: 16, alignItems: 'center' }}>
            <Text style={{ fontSize: 13, color: '#C4B5D8' }}>
              ไม่พบ "{query}" — ลองพิมพ์ใหม่ครับ
            </Text>
          </View>
        </View>
      )}

      <Text style={styles.hint}>
        💡 ค้นหาด้วยชื่อตำบล หรือรหัสไปรษณีย์ (เช่น "ลาดพร้าว" หรือ "10230")
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1.5, borderColor: 'rgba(167,139,250,0.4)',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
  },
  searchBoxFocused: {
    borderColor: '#7C3AED',
    backgroundColor: '#fff',
  },
  searchInput: {
    flex: 1, fontSize: 14, color: '#2D1B69', padding: 0,
  },
  dropdown: {
    backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: 'rgba(124,58,237,0.2)',
    borderRadius: 12, marginTop: 4,
    elevation: 8, shadowColor: '#7C3AED',
    shadowOpacity: 0.12, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    overflow: 'hidden',
  },
  dropdownRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 11, paddingHorizontal: 14,
  },
  subDistrictText: {
    fontSize: 13, fontWeight: '700', color: '#2D1B69',
  },
  districtText: {
    fontSize: 12, color: '#7C5CB8',
  },
  provinceText: {
    fontSize: 11, color: '#9B7FC8',
  },
  zipBadge: {
    backgroundColor: 'rgba(124,58,237,0.08)',
    borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(124,58,237,0.15)',
  },
  zipText: {
    fontSize: 12, fontWeight: '800', color: '#7C3AED',
  },
  hint: {
    fontSize: 10.5, color: '#C4B5D8', marginTop: 5, marginLeft: 4,
  },
  // ── Selected state ───────────────────────────────────────
  selectedCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(124,58,237,0.05)',
    borderWidth: 1.5, borderColor: 'rgba(124,58,237,0.25)',
    borderRadius: 12, padding: 12,
  },
  selectedIcon: {
    width: 36, height: 36, backgroundColor: '#EDE9FE',
    borderRadius: 10, justifyContent: 'center', alignItems: 'center',
  },
  selectedSub: {
    fontSize: 13, fontWeight: '700', color: '#2D1B69',
  },
  selectedDetail: {
    fontSize: 11, color: '#7C5CB8', marginTop: 2,
  },
  clearBtn: {
    backgroundColor: 'rgba(124,58,237,0.08)',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(124,58,237,0.2)',
  },
});
