import { useState } from 'react';
import { View, Text, Pressable, TextInput, Modal, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Colors from '@/constants/Colors';
import { formatCurrency } from '@/lib/format';
import { WalletAvatar } from '@/components/wallet/WalletAvatar';
import type { Category, Wallet } from '@/db/schema';

type ThemeColors = (typeof Colors)['light'];
type Confidence = 'high' | 'medium' | 'low';

type Props = {
  colors: ThemeColors;
  confidence: Confidence;
  cost: number;
  sale: number;
  /** หมวดธุรกิจที่ผู้ใช้เห็น (income namespace) เช่น "ขายของในตลาด" */
  businessCategory: Category | null;
  /** หมวด income ที่ให้เลือกเป็น business activity */
  incomeCategories: Category[];
  /** ชื่อหมวด expense ที่ leg ต้นทุนจะถูกบันทึก (เก็บแยกภายใน) */
  costCategoryName: string;
  wallet: Wallet | null;
  wallets: Wallet[];
  dateLabel: string;
  isSaving: boolean;
  onSelectBusinessCategory: (category: Category) => void;
  onSelectWallet: (wallet: Wallet) => void;
  onPressDate: () => void;
  onApplyAmounts: (cost: number, sale: number) => void;
  onSplit: () => void;
  onSave: () => void;
};

const CONFIDENCE_META: Record<Confidence, { label: string; bg: string; fg: string }> = {
  high: { label: 'มั่นใจสูง', bg: '#E6F4EA', fg: '#1B7F4B' },
  medium: { label: 'มั่นใจปานกลาง', bg: '#FAEEDA', fg: '#854F0B' },
  low: { label: 'ยังไม่มั่นใจ', bg: '#FDE7E7', fg: '#B3261E' },
};

export function TradeSetReviewCard({
  colors,
  confidence,
  cost,
  sale,
  businessCategory,
  incomeCategories,
  costCategoryName,
  wallet,
  wallets,
  dateLabel,
  isSaving,
  onSelectBusinessCategory,
  onSelectWallet,
  onPressDate,
  onApplyAmounts,
  onSplit,
  onSave,
}: Props) {
  const [expand, setExpand] = useState<'none' | 'category' | 'wallet'>('none');
  const [showEdit, setShowEdit] = useState(false);
  const [editCost, setEditCost] = useState('');
  const [editSale, setEditSale] = useState('');

  const profit = sale - cost;
  const conf = CONFIDENCE_META[confidence];
  const showVerifyHint = confidence !== 'high';

  const openEdit = () => {
    setEditCost(String(cost));
    setEditSale(String(sale));
    setShowEdit(true);
  };

  const applyEdit = () => {
    const c = parseFloat(editCost) || 0;
    const s = parseFloat(editSale) || 0;
    if (c <= 0 || s <= 0) return;
    onApplyAmounts(c, s);
    setShowEdit(false);
  };

  const toggleExpand = (key: 'category' | 'wallet') =>
    setExpand((prev) => (prev === key ? 'none' : key));

  const rowStyle = {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: 9,
  };

  return (
    <View
      style={{
        backgroundColor: colors.cardBackground,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 14,
        gap: 4,
      }}>
      {/* header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>🐷 หมูนุ่นสรุปให้</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ backgroundColor: '#7F77DD22', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#5B52C9' }}>⇄ ชุดซื้อ-ขาย</Text>
          </View>
          <View style={{ backgroundColor: conf.bg, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: conf.fg }}>{conf.label}</Text>
          </View>
        </View>
      </View>
      <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>
        ตรวจพบ 2 รายการ · ซื้อ-ขาย
      </Text>

      {/* 3 บรรทัด: ต้นทุน / ยอดขาย / กำไร */}
      <View style={{ gap: 2 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
          <Text style={{ fontSize: 14, color: colors.textSecondary }}>ต้นทุน (รายจ่าย)</Text>
          <Text style={{ fontSize: 15, fontWeight: '800', color: colors.expense }}>−{formatCurrency(cost)}</Text>
        </View>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingVertical: 4,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            paddingBottom: 8,
          }}>
          <Text style={{ fontSize: 14, color: colors.textSecondary }}>ยอดขาย (รายรับ)</Text>
          <Text style={{ fontSize: 15, fontWeight: '800', color: colors.income }}>+{formatCurrency(sale)}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: profit >= 0 ? '#5B52C9' : colors.expense }}>
            {profit >= 0 ? 'กำไรสุทธิ' : 'ขาดทุน'}
          </Text>
          <Text style={{ fontSize: 22, fontWeight: '900', color: profit >= 0 ? '#5B52C9' : colors.expense }}>
            {profit >= 0 ? '+' : '−'}{formatCurrency(Math.abs(profit))}
          </Text>
        </View>
      </View>

      {/* verify hint — เฉพาะ medium/low */}
      {showVerifyHint ? (
        <View
          style={{
            flexDirection: 'row',
            gap: 7,
            alignItems: 'flex-start',
            backgroundColor: conf.bg,
            borderRadius: 10,
            paddingHorizontal: 11,
            paddingVertical: 9,
            marginTop: 10,
          }}>
          <FontAwesome name="exclamation-triangle" size={13} color={conf.fg} style={{ marginTop: 1 }} />
          <Text style={{ flex: 1, fontSize: 12, lineHeight: 17, color: conf.fg }}>
            ตรวจยอด/ทิศทางอีกนิดก่อนบันทึกนะคะ — กดแก้ได้ถ้าหมูนุ่นจับผิด
          </Text>
        </View>
      ) : null}

      {/* รายละเอียด: หมวด / กระเป๋า / วันที่ */}
      <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: 10, paddingTop: 4 }}>
        {/* หมวดหมู่ (business activity) */}
        <Pressable onPress={() => toggleExpand('category')} style={rowStyle}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <FontAwesome name="th-large" size={14} color={colors.textSecondary} />
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>หมวดหมู่</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>
              {businessCategory ? `${businessCategory.icon} ${businessCategory.name}` : 'เลือกหมวด'}
            </Text>
            <FontAwesome name={expand === 'category' ? 'chevron-up' : 'chevron-down'} size={11} color={colors.textSecondary} />
          </View>
        </Pressable>
        {/* ความโปร่งใส: ต้นทุนเก็บแยกในหมวด expense */}
        <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: -4, marginBottom: 2 }}>
          ต้นทุนบันทึกแยกในหมวด: {costCategoryName}
        </Text>
        {expand === 'category' ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingVertical: 6 }}>
            {incomeCategories.map((cat) => {
              const active = cat.id === businessCategory?.id;
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => {
                    onSelectBusinessCategory(cat);
                    setExpand('none');
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    borderRadius: 999,
                    borderWidth: 1.5,
                    borderColor: active ? colors.income : colors.border,
                    backgroundColor: active ? `${colors.income}1A` : 'transparent',
                    paddingHorizontal: 11,
                    paddingVertical: 7,
                  }}>
                  <Text style={{ fontSize: 12.5, fontWeight: active ? '800' : '600', color: colors.text }}>
                    {cat.icon} {cat.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {/* กระเป๋าเงิน */}
        <Pressable
          onPress={() => toggleExpand('wallet')}
          style={[rowStyle, { borderTopWidth: 1, borderTopColor: colors.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <FontAwesome name="credit-card" size={13} color={colors.textSecondary} />
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>กระเป๋าเงิน</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{wallet?.name ?? 'เลือกกระเป๋า'}</Text>
            <FontAwesome name={expand === 'wallet' ? 'chevron-up' : 'chevron-down'} size={11} color={colors.textSecondary} />
          </View>
        </Pressable>
        {expand === 'wallet' ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingVertical: 6 }}>
            {wallets.map((w) => {
              const active = w.id === wallet?.id;
              return (
                <Pressable
                  key={w.id}
                  onPress={() => {
                    onSelectWallet(w);
                    setExpand('none');
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    borderRadius: 999,
                    borderWidth: 1.5,
                    borderColor: active ? colors.tint : colors.border,
                    backgroundColor: active ? `${colors.tint}1A` : 'transparent',
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                  }}>
                  <WalletAvatar icon={w.icon} size={22} />
                  <Text style={{ fontSize: 12.5, fontWeight: active ? '800' : '600', color: colors.text }}>{w.name}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {/* วันที่ */}
        <Pressable onPress={onPressDate} style={[rowStyle, { borderTopWidth: 1, borderTopColor: colors.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <FontAwesome name="calendar" size={13} color={colors.textSecondary} />
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>วันที่</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{dateLabel}</Text>
            <FontAwesome name="chevron-down" size={11} color={colors.textSecondary} />
          </View>
        </Pressable>
      </View>

      {/* ปุ่มหลัก */}
      <Pressable
        onPress={onSave}
        disabled={isSaving}
        style={({ pressed }) => ({
          marginTop: 12,
          borderRadius: 12,
          alignItems: 'center',
          backgroundColor: pressed || isSaving ? '#1B5E20' : colors.income,
          paddingVertical: 14,
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 8,
        })}>
        <FontAwesome name="save" size={16} color="#FFF" />
        <Text style={{ fontSize: 15, fontWeight: '900', color: '#FFF' }}>
          {isSaving ? 'กำลังบันทึก...' : 'บันทึกชุดซื้อ-ขาย · 2 รายการ'}
        </Text>
      </Pressable>

      {/* ปุ่มรอง — เมื่อมั่นใจสูง (จับ ซื้อ-ขาย ชัด + หมวดชัด) ตัดสินใจเด็ดขาด:
          เหลือแค่ "แก้ไขตัวเลข" เต็มแถว ไม่โชว์ "แยกเป็นรายการปกติ" (กันผู้ใช้ลังเล/สับสน).
          medium/low ยังให้ทางหนี "แยกเป็นรายการปกติ" ไว้เผื่อหมูนุ่นจับผิด */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        <Pressable
          onPress={openEdit}
          disabled={isSaving}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: colors.border,
            backgroundColor: pressed ? colors.background : 'transparent',
            paddingVertical: 10,
          })}>
          <FontAwesome name="pencil" size={13} color={colors.text} />
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>แก้ไขตัวเลข</Text>
        </Pressable>
        {confidence !== 'high' ? (
          <Pressable
            onPress={onSplit}
            disabled={isSaving}
            style={({ pressed }) => ({
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              borderRadius: 12,
              borderWidth: 1.5,
              borderColor: colors.border,
              backgroundColor: pressed ? colors.background : 'transparent',
              paddingVertical: 10,
            })}>
            <FontAwesome name="exchange" size={13} color={colors.text} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>แยกเป็นรายการปกติ</Text>
          </Pressable>
        ) : null}
      </View>

      {/* guide ย่อ */}
      <Text style={{ fontSize: 11, color: colors.textSecondary, textAlign: 'center', marginTop: 10 }}>
        ระบบจะบันทึก 2 รายการพร้อมกัน: ต้นทุน และ ยอดขาย · ผูกเป็นชุดเดียว
      </Text>

      {/* Bottom sheet แก้ไขตัวเลข — KeyboardAvoidingView + ScrollView กัน numpad บังฟอร์ม/ปุ่มยืนยัน */}
      <Modal visible={showEdit} transparent statusBarTranslucent animationType="slide" onRequestClose={() => setShowEdit(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}>
          <Pressable
            onPress={() => setShowEdit(false)}
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={{
                backgroundColor: colors.cardBackground,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                maxHeight: '85%',
              }}>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces={false}
                contentContainerStyle={{ padding: 20, gap: 14 }}>
            <View style={{ alignItems: 'center' }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
            </View>
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>แก้ไขตัวเลข</Text>

            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>ต้นทุน (รายจ่าย)</Text>
              <TextInput
                value={editCost}
                onChangeText={setEditCost}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontSize: 18,
                  fontWeight: '700',
                  color: colors.expense,
                }}
              />
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>ยอดขาย (รายรับ)</Text>
              <TextInput
                value={editSale}
                onChangeText={setEditSale}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontSize: 18,
                  fontWeight: '700',
                  color: colors.income,
                }}
              />
            </View>

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                backgroundColor: colors.background,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 10,
              }}>
              <Text style={{ fontSize: 13.5, fontWeight: '800', color: colors.text }}>กำไรสุทธิ</Text>
              <Text style={{ fontSize: 15, fontWeight: '900', color: '#5B52C9' }}>
                {formatCurrency((parseFloat(editSale) || 0) - (parseFloat(editCost) || 0))}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <Pressable
                onPress={() => setShowEdit(false)}
                style={({ pressed }) => ({
                  flex: 1,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: colors.border,
                  alignItems: 'center',
                  paddingVertical: 13,
                  backgroundColor: pressed ? colors.background : 'transparent',
                })}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>ยกเลิก</Text>
              </Pressable>
              <Pressable
                onPress={applyEdit}
                style={({ pressed }) => ({
                  flex: 1,
                  borderRadius: 12,
                  alignItems: 'center',
                  paddingVertical: 13,
                  backgroundColor: pressed ? colors.tintDark : colors.tint,
                })}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFF' }}>ใช้ตัวเลขนี้</Text>
              </Pressable>
            </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
