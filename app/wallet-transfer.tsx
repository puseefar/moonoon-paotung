import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Stack, useRouter } from 'expo-router';
import { useSnackbar } from '@/components/ui/SnackbarProvider';
import { useColorScheme } from '@/components/useColorScheme';
import { Numpad } from '@/components/transaction/Numpad';
import { WalletAvatar } from '@/components/wallet/WalletAvatar';
import Colors from '@/constants/Colors';
import type { Wallet } from '@/db/schema';
import { formatCurrency } from '@/lib/format';
import { useSummaryStore } from '@/stores/useSummaryStore';
import { useWalletStore } from '@/stores/useWalletStore';

const SOURCE_ACCENT = '#1E88E5';

export default function WalletTransferScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { showSnackbar } = useSnackbar();

  const { wallets, loadWallets, transfer } = useWalletStore();
  const { loadAll } = useSummaryStore();

  const [fromWallet, setFromWallet] = useState<Wallet | null>(null);
  const [toWallet, setToWallet] = useState<Wallet | null>(null);
  const [amount, setAmount] = useState('0');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadWallets();
  }, [loadWallets]);

  useEffect(() => {
    if (wallets.length >= 2 && !fromWallet) {
      setFromWallet(wallets[0]);
      setToWallet(wallets[1]);
    }
  }, [fromWallet, wallets]);

  const handleNumPress = (key: string) => {
    setAmount((prev) => {
      if (prev === '0' && key !== '.') return key;
      if (key === '.' && prev.includes('.')) return prev;
      if (prev.includes('.') && prev.split('.')[1].length >= 2) return prev;
      if (prev.length >= 12) return prev;
      return prev + key;
    });
  };

  const handleDelete = () => {
    setAmount((prev) => (prev.length <= 1 ? '0' : prev.slice(0, -1)));
  };

  const handleSwap = () => {
    setFromWallet(toWallet);
    setToWallet(fromWallet);
  };

  const handleTransfer = async () => {
    const numAmount = parseFloat(amount);

    if (numAmount <= 0) {
      showSnackbar({ message: 'กรุณาใส่จำนวนเงิน', variant: 'warning' });
      return;
    }
    if (!fromWallet || !toWallet) {
      showSnackbar({ message: 'กรุณาเลือกกระเป๋าเงินต้นทางและปลายทาง', variant: 'warning' });
      return;
    }
    if (fromWallet.id === toWallet.id) {
      showSnackbar({ message: 'กรุณาเลือกกระเป๋าคนละใบ', variant: 'warning' });
      return;
    }
    if ((fromWallet.balance ?? 0) < numAmount) {
      showSnackbar({
        title: 'ยอดเงินไม่พอ',
        message: `กระเป๋า ${fromWallet.name} มียอด ${formatCurrency(fromWallet.balance ?? 0)} บาท`,
        variant: 'error',
        durationMs: 3000,
      });
      return;
    }

    setIsSaving(true);
    try {
      await transfer(fromWallet.id, toWallet.id, numAmount);
      await loadAll();
      showSnackbar({
        title: 'โอนเงินสำเร็จ',
        message: `โอน ${formatCurrency(numAmount)} บาท เรียบร้อย`,
        variant: 'success',
      });
      setTimeout(() => router.back(), 900);
    } catch (error) {
      const message =
        error instanceof Error && error.message === 'Insufficient wallet balance'
          ? 'ยอดเงินในกระเป๋าต้นทางไม่พอสำหรับการโอน'
          : 'ไม่สามารถโอนเงินได้';
      showSnackbar({
        message,
        variant: 'error',
        durationMs: 3000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const renderWalletSelector = (
    label: string,
    selected: Wallet | null,
    onSelect: (wallet: Wallet) => void,
    exclude?: string
  ) => (
    <View>
      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: 8 }}>
        {label}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {wallets
          .filter((wallet) => wallet.id !== exclude)
          .map((wallet) => {
            const isSelected = wallet.id === selected?.id;
            return (
              <Pressable
                key={wallet.id}
                onPress={() => onSelect(wallet)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 14,
                  backgroundColor: isSelected ? colors.tint : colors.cardBackground,
                  borderWidth: 1,
                  borderColor: isSelected ? colors.tint : colors.border,
                  alignItems: 'center',
                  minWidth: 98,
                }}>
                <WalletAvatar
                  icon={wallet.icon}
                  size={34}
                  backgroundColor={isSelected ? 'rgba(255,255,255,0.16)' : undefined}
                />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: isSelected ? '#FFF' : colors.text,
                    marginTop: 6,
                  }}
                  numberOfLines={1}>
                  {wallet.name}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: isSelected ? 'rgba(255,255,255,0.78)' : colors.textSecondary,
                    marginTop: 2,
                  }}>
                  {formatCurrency(wallet.balance ?? 0)}
                </Text>
              </Pressable>
            );
          })}
      </ScrollView>
    </View>
  );

  const numAmount = parseFloat(amount) || 0;
  const hasInsufficientBalance = !!fromWallet && numAmount > (fromWallet.balance ?? 0);
  const fromAfter = fromWallet ? (fromWallet.balance ?? 0) - numAmount : 0;
  const toAfter = toWallet ? (toWallet.balance ?? 0) + numAmount : 0;
  const transferRouteText =
    fromWallet && toWallet
      ? `คุณกำลังโอนเงินจาก ${fromWallet.name} ไป ${toWallet.name}`
      : 'เลือกกระเป๋าต้นทางและปลายทาง';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          title: 'โอนเงิน',
          headerStyle: { backgroundColor: colors.transfer },
          headerTintColor: '#FFF',
        }}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 28 }}>
        <View style={{ alignItems: 'center', paddingTop: 4, paddingBottom: 2 }}>
          <Text style={{ fontSize: 14, color: colors.textSecondary }}>จำนวนเงินโอน (บาท)</Text>
          <Text style={{ fontSize: 34, fontWeight: '800', color: colors.transfer, marginTop: 4 }}>
            {numAmount > 0 ? formatCurrency(numAmount) : '0.00'}
          </Text>
        </View>

        {renderWalletSelector('จากกระเป๋า', fromWallet, setFromWallet, toWallet?.id)}

        <View style={{ alignItems: 'center', marginVertical: -2 }}>
          <Pressable
            onPress={handleSwap}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.transfer + '15',
              justifyContent: 'center',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: colors.transfer,
            }}>
            <FontAwesome
              name="exchange"
              size={16}
              color={colors.transfer}
              style={{ transform: [{ rotate: '90deg' }] }}
            />
          </Pressable>
        </View>

        {renderWalletSelector('ไปยังกระเป๋า', toWallet, setToWallet, fromWallet?.id)}

        <View
          style={{
            backgroundColor: colors.cardBackground,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: hasInsufficientBalance ? colors.expense : colors.border,
            padding: 14,
            minHeight: 150,
            justifyContent: 'center',
            gap: 10,
          }}>
          <View
            style={{
              backgroundColor: colors.transfer + '12',
              borderRadius: 12,
              paddingVertical: 10,
              paddingHorizontal: 12,
              alignItems: 'center',
            }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary }}>
              ยอดโอนตอนนี้
            </Text>
            <Text style={{ fontSize: 28, fontWeight: '800', color: colors.transfer, marginTop: 2 }}>
              {formatCurrency(numAmount)}
            </Text>
          </View>

          <Text
            style={{
              fontSize: 13,
              fontWeight: '700',
              color: hasInsufficientBalance ? colors.expense : colors.textSecondary,
            }}>
            {transferRouteText}
          </Text>

          {fromWallet && toWallet ? (
            <>
              <Text style={{ fontSize: 14, color: SOURCE_ACCENT, fontWeight: '700' }}>
                {fromWallet.name}: {formatCurrency(fromWallet.balance ?? 0)} → {formatCurrency(fromAfter)}
              </Text>
              <Text style={{ fontSize: 14, color: colors.income, fontWeight: '700' }}>
                {toWallet.name}: {formatCurrency(toWallet.balance ?? 0)} → {formatCurrency(toAfter)}
              </Text>
            </>
          ) : (
            <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 20 }}>
              กรอกจำนวนเงินที่ต้องการโอน แล้วตรวจสอบยอดก่อนกดยืนยัน
            </Text>
          )}

          {hasInsufficientBalance && (
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.expense }}>
              ยอดเงินในกระเป๋าต้นทางไม่พอสำหรับการโอน
            </Text>
          )}
        </View>

        <Numpad onPress={handleNumPress} onDelete={handleDelete} onClear={() => setAmount('0')} />

        <Pressable
          onPress={handleTransfer}
          disabled={isSaving || hasInsufficientBalance}
          style={({ pressed }) => ({
            backgroundColor:
              isSaving || hasInsufficientBalance
                ? '#9E9E9E'
                : pressed
                ? '#E65100'
                : colors.transfer,
            paddingVertical: 16,
            borderRadius: 14,
            alignItems: 'center',
            opacity: isSaving ? 0.7 : 1,
          })}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: '#FFF' }}>
            {isSaving ? 'กำลังโอน...' : hasInsufficientBalance ? 'ยอดเงินไม่พอ' : 'ยืนยันการโอน'}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
