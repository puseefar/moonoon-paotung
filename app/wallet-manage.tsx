import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Stack, useRouter } from 'expo-router';
import { useSnackbar } from '@/components/ui/SnackbarProvider';
import { useColorScheme } from '@/components/useColorScheme';
import { WalletAvatar } from '@/components/wallet/WalletAvatar';
import { Card } from '@/components/ui/Card';
import Colors from '@/constants/Colors';
import {
  GENERIC_WALLET_ICONS,
  WALLET_BRAND_PRESETS,
  getWalletBrandPreset,
  getWalletDisplayType,
  makeWalletBrandIcon,
} from '@/constants/walletBrands';
import type { Wallet } from '@/db/schema';
import { formatCurrency } from '@/lib/format';
import { useWalletStore } from '@/stores/useWalletStore';

export default function WalletManageScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const { wallets, totalBalance, loadWallets, addWallet, updateWallet, deleteWallet } =
    useWalletStore();

  const [showModal, setShowModal] = useState(false);
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);
  const [walletName, setWalletName] = useState('');
  const [walletIcon, setWalletIcon] = useState('💵');
  const [walletBalance, setWalletBalance] = useState('');

  useEffect(() => {
    loadWallets();
  }, [loadWallets]);

  const resetForm = () => {
    setEditingWallet(null);
    setWalletName('');
    setWalletIcon('💵');
    setWalletBalance('');
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (wallet: Wallet) => {
    setEditingWallet(wallet);
    setWalletName(wallet.name);
    setWalletIcon(wallet.icon ?? '💵');
    setWalletBalance(String(wallet.balance ?? 0));
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!walletName.trim()) {
      showSnackbar({ message: 'กรุณาใส่ชื่อกระเป๋าเงิน', variant: 'warning' });
      return;
    }

    if (editingWallet) {
      await updateWallet(editingWallet.id, {
        name: walletName.trim(),
        icon: walletIcon,
      });
    } else {
      await addWallet({
        name: walletName.trim(),
        icon: walletIcon,
        balance: parseFloat(walletBalance) || 0,
        currency: 'THB',
        isActive: true,
      });
    }

    setShowModal(false);
    resetForm();
    showSnackbar({
      title: editingWallet ? 'อัปเดตกระเป๋าแล้ว' : 'เพิ่มกระเป๋าแล้ว',
      message: editingWallet ? 'บันทึกการแก้ไขกระเป๋าเรียบร้อย' : 'สร้างกระเป๋าเงินเรียบร้อย',
      variant: 'success',
    });
  };

  const handleDelete = (wallet: Wallet) => {
    Alert.alert(
      'ลบกระเป๋าเงิน',
      `ต้องการลบ "${wallet.name}" หรือไม่?\nกระเป๋าจะถูกซ่อน แต่ประวัติรายการยังคงอยู่`,
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ลบ',
          style: 'destructive',
          onPress: () => deleteWallet(wallet.id),
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          title: 'กระเป๋าเงินหลายใบ',
          headerStyle: { backgroundColor: colors.tint },
          headerTintColor: '#FFF',
        }}
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        <View
          style={{
            backgroundColor: colors.tint,
            paddingHorizontal: 20,
            paddingVertical: 20,
            alignItems: 'center',
          }}>
          <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 14 }}>
            ยอดรวมทุกกระเป๋า
          </Text>
          <Text style={{ color: '#FFF', fontSize: 28, fontWeight: '800', marginTop: 4 }}>
            {formatCurrency(totalBalance)} บาท
          </Text>
        </View>

        <View style={{ padding: 16, gap: 12 }}>
          {wallets.map((wallet) => {
            const brand = getWalletBrandPreset(wallet.icon);
            return (
              <Card key={wallet.id} variant="elevated">
                <Pressable
                  onPress={() => router.push(`/wallet/${wallet.id}` as any)}
                  style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <WalletAvatar icon={wallet.icon} size={52} />
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                      {wallet.name}
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                      {brand?.name ?? getWalletDisplayType(wallet.icon)}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                      แตะเพื่อดูรายการในกระเป๋า
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', marginLeft: 10 }}>
                    <Text
                      style={{
                        fontSize: 17,
                        fontWeight: '700',
                        color: (wallet.balance ?? 0) >= 0 ? colors.income : colors.expense,
                      }}>
                      {formatCurrency(wallet.balance ?? 0)}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 16, marginTop: 10 }}>
                      <Pressable onPress={() => openEditModal(wallet)} hitSlop={8}>
                        <FontAwesome name="pencil" size={16} color={colors.tint} />
                      </Pressable>
                      <Pressable onPress={() => handleDelete(wallet)} hitSlop={8}>
                        <FontAwesome name="trash" size={16} color={colors.expense} />
                      </Pressable>
                    </View>
                  </View>
                </Pressable>
              </Card>
            );
          })}

          <Pressable
            onPress={openAddModal}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 16,
              borderRadius: 16,
              borderWidth: 2,
              borderStyle: 'dashed',
              borderColor: colors.tint,
              gap: 8,
            }}>
            <FontAwesome name="plus-circle" size={20} color={colors.tint} />
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.tint }}>
              เพิ่มกระเป๋าเงิน
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/wallet-transfer' as any)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 16,
              borderRadius: 16,
              backgroundColor: colors.transfer + '15',
              borderWidth: 1,
              borderColor: colors.transfer,
              gap: 8,
            }}>
            <FontAwesome name="exchange" size={18} color={colors.transfer} />
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.transfer }}>
              โอนเงินระหว่างกระเป๋า
            </Text>
          </Pressable>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={showModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' }}
            onPress={() => setShowModal(false)} />
          <View
            style={{
              backgroundColor: colors.cardBackground,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              maxHeight: '90%',
            }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>
                {editingWallet ? 'แก้ไขกระเป๋าเงิน' : 'เพิ่มกระเป๋าเงินใหม่'}
              </Text>
              <Pressable onPress={() => setShowModal(false)}>
                <FontAwesome name="times" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '700',
                  color: colors.textSecondary,
                  marginBottom: 10,
                }}>
                ธนาคารหลักของไทย
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
                {WALLET_BRAND_PRESETS.map((brand) => {
                  const selected = walletIcon === makeWalletBrandIcon(brand.key);
                  return (
                    <Pressable
                      key={brand.key}
                      onPress={() => setWalletIcon(makeWalletBrandIcon(brand.key))}
                      style={{
                        width: '31%',
                        minWidth: 94,
                        borderRadius: 16,
                        paddingVertical: 10,
                        paddingHorizontal: 8,
                        borderWidth: selected ? 2 : 1,
                        borderColor: selected ? colors.tint : colors.border,
                        backgroundColor: selected ? colors.tint + '10' : colors.background,
                        alignItems: 'center',
                        gap: 8,
                      }}>
                      <WalletAvatar icon={makeWalletBrandIcon(brand.key)} size={52} />
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '600',
                          color: colors.text,
                          textAlign: 'center',
                        }}>
                        {brand.shortName}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '700',
                  color: colors.textSecondary,
                  marginBottom: 10,
                }}>
                ไอคอนทั่วไป
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                {GENERIC_WALLET_ICONS.map((icon) => {
                  const selected = walletIcon === icon;
                  return (
                    <Pressable
                      key={icon}
                      onPress={() => setWalletIcon(icon)}
                      style={{
                        width: 60,
                        height: 60,
                        borderRadius: 16,
                        justifyContent: 'center',
                        alignItems: 'center',
                        backgroundColor: selected ? colors.tint + '12' : colors.background,
                        borderWidth: selected ? 2 : 1,
                        borderColor: selected ? colors.tint : colors.border,
                      }}>
                      <WalletAvatar icon={icon} size={36} backgroundColor="transparent" />
                    </Pressable>
                  );
                })}
              </View>

              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '700',
                  color: colors.textSecondary,
                  marginBottom: 8,
                }}>
                ชื่อกระเป๋า
              </Text>
              <TextInput
                value={walletName}
                onChangeText={setWalletName}
                placeholder="เช่น เงินสด, กรุงไทย, กสิกรเงินออม"
                placeholderTextColor={colors.textSecondary}
                style={{
                  backgroundColor: colors.background,
                  borderRadius: 12,
                  padding: 14,
                  fontSize: 15,
                  color: colors.text,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              />

              {!editingWallet && (
                <>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '700',
                      color: colors.textSecondary,
                      marginBottom: 8,
                    }}>
                    ยอดเงินเริ่มต้น
                  </Text>
                  <TextInput
                    value={walletBalance}
                    onChangeText={setWalletBalance}
                    placeholder="0.00"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="decimal-pad"
                    selectTextOnFocus
                    style={{
                      backgroundColor: colors.background,
                      borderRadius: 12,
                      padding: 14,
                      fontSize: 15,
                      color: colors.text,
                      marginBottom: 18,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  />
                </>
              )}

              <Pressable
                onPress={handleSave}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? '#1565C0' : colors.tint,
                  paddingVertical: 16,
                  borderRadius: 14,
                  alignItems: 'center',
                })}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFF' }}>
                  {editingWallet ? 'บันทึกการแก้ไข' : 'เพิ่มกระเป๋าเงิน'}
                </Text>
              </Pressable>
              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
