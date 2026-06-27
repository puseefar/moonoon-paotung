import { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  Alert, Modal, Platform, ActivityIndicator, KeyboardAvoidingView,
} from 'react-native';
import { Stack } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { savingsService } from '@/services/savingsService';
import { dreamGoalService, getMilestones, getSavingPlan } from '@/services/dreamGoalService';
import type { GoalContribution, SavingsGoal } from '@/db/schema';
import { formatCurrency, formatDate } from '@/lib/format';
import { useSnackbar } from '@/components/ui/SnackbarProvider';

const GOAL_ICONS = ['🎯', '✈️', '🏠', '🚗', '📱', '💻', '🎓', '💍', '🏖️', '🎮', '👶', '🐶', '🏋️', '🌏', '💰', '🎪'];

// ── Milestone Bar ────────────────────────────────────────────
function MilestoneBar({ current, target }: { current: number; target: number }) {
  const milestones = getMilestones(current, target);
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  return (
    <View style={{ marginVertical: 10 }}>
      <View style={{ height: 10, backgroundColor: '#E8E8E8', borderRadius: 5, overflow: 'hidden' }}>
        <LinearGradient
          colors={pct >= 100 ? ['#FF8F00', '#FFB300'] : ['#FB8C00', '#FFA726']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ width: `${pct}%`, height: 10, borderRadius: 5 }}
        />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        {milestones.map((m) => (
          <View key={m.level} style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 14 }}>{m.reached ? m.icon : '○'}</Text>
            <Text style={{ fontSize: 9, color: m.reached ? m.color : '#CCC', fontWeight: '700' }}>
              {m.level}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Saving Plan Row ──────────────────────────────────────────
function SavingPlanRow({ current, target, deadline }: { current: number; target: number; deadline: Date | null }) {
  const plan = getSavingPlan(current, target, deadline);
  if (!plan || plan.remaining <= 0) return null;
  return (
    <View style={{ backgroundColor: '#FFF8E1', borderRadius: 10, padding: 10, marginTop: 4, flexDirection: 'row', gap: 16 }}>
      {plan.isOverdue ? (
        <Text style={{ fontSize: 12, color: '#E65100', fontWeight: '600' }}>⏰ เลยกำหนดแล้ว เหลือ {formatCurrency(plan.remaining)} บาท</Text>
      ) : (
        <>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 11, color: '#888' }}>ต้องเก็บ/วัน</Text>
            <Text style={{ fontSize: 14, fontWeight: '800', color: '#E65100' }}>{formatCurrency(plan.perDay)}</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 11, color: '#888' }}>ต้องเก็บ/เดือน</Text>
            <Text style={{ fontSize: 14, fontWeight: '800', color: '#E65100' }}>{formatCurrency(plan.perMonth)}</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 11, color: '#888' }}>เหลือเวลา</Text>
            <Text style={{ fontSize: 14, fontWeight: '800', color: '#555' }}>{plan.daysLeft} วัน</Text>
          </View>
        </>
      )}
    </View>
  );
}

// ── Goal Card ────────────────────────────────────────────────
function GoalCard({
  goal, onContribute, onEdit, onDelete,
}: {
  goal: SavingsGoal;
  onContribute: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<GoalContribution[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const { showSnackbar } = useSnackbar();

  const current = goal.currentAmount ?? 0;
  const pct = goal.targetAmount > 0 ? Math.min((current / goal.targetAmount) * 100, 100) : 0;

  async function toggleHistory() {
    if (!showHistory && history.length === 0) {
      setLoadingHistory(true);
      const rows = await dreamGoalService.getContributions(goal.id);
      setHistory(rows);
      setLoadingHistory(false);
    }
    setShowHistory((v) => !v);
  }

  async function handleDeleteContribution(c: GoalContribution) {
    Alert.alert('ลบรายการ', `ลบการออม ${formatCurrency(c.amount)} บาท?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ลบ', style: 'destructive', onPress: async () => {
          await dreamGoalService.deleteContribution(c.id, goal.id, c.amount);
          const rows = await dreamGoalService.getContributions(goal.id);
          setHistory(rows);
          showSnackbar({ message: 'ลบรายการแล้ว', variant: 'success' });
        },
      },
    ]);
  }

  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 18, marginBottom: 14, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 8 }}>
      {/* Completed Banner */}
      {goal.isCompleted && (
        <LinearGradient colors={['#FF8F00', '#FFB300']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 6, alignItems: 'center' }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff' }}>🏆 สำเร็จแล้ว! ยินดีด้วย!</Text>
        </LinearGradient>
      )}

      <View style={{ padding: 16 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <Text style={{ fontSize: 36, marginRight: 12 }}>{goal.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#333' }}>{goal.name}</Text>
            {goal.deadline && (
              <Text style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                🗓️ กำหนด: {formatDate(new Date(goal.deadline))}
              </Text>
            )}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 20, fontWeight: '900', color: '#E65100' }}>{pct.toFixed(0)}%</Text>
          </View>
        </View>

        {/* Amounts */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#FB8C00' }}>
            {formatCurrency(current)}
          </Text>
          <Text style={{ fontSize: 13, color: '#888' }}>
            เป้า {formatCurrency(goal.targetAmount)}
          </Text>
        </View>

        {/* Milestone Bar */}
        <MilestoneBar current={current} target={goal.targetAmount} />

        {/* Saving Plan */}
        {!goal.isCompleted && (
          <SavingPlanRow current={current} target={goal.targetAmount} deadline={goal.deadline ? new Date(goal.deadline) : null} />
        )}

        {/* Actions */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          {!goal.isCompleted && (
            <Pressable
              onPress={onContribute}
              style={{ flex: 1, borderRadius: 12, overflow: 'hidden' }}>
              <LinearGradient colors={['#E65100', '#FF9800']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 12, alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>💰 หยอดกระปุก</Text>
              </LinearGradient>
            </Pressable>
          )}
          <Pressable
            onPress={toggleHistory}
            style={{ paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#FFB300', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 13, color: '#E65100', fontWeight: '700' }}>{showHistory ? '▲ ปิด' : '📋 ประวัติ'}</Text>
          </Pressable>
          <Pressable
            onPress={onEdit}
            style={{ paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#B3E5FC', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 14, color: '#0288D1' }}>✏️</Text>
          </Pressable>
          <Pressable
            onPress={onDelete}
            style={{ paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#FFCDD2', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 14, color: '#EF5350' }}>🗑️</Text>
          </Pressable>
        </View>

        {/* Contribution History */}
        {showHistory && (
          <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: '#F5F5F5', paddingTop: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#555', marginBottom: 8 }}>ประวัติการออม</Text>
            {loadingHistory ? (
              <ActivityIndicator size="small" color="#FF9800" />
            ) : history.length === 0 ? (
              <Text style={{ fontSize: 13, color: '#BBB', textAlign: 'center', paddingVertical: 8 }}>ยังไม่มีประวัติ</Text>
            ) : (
              history.map((c) => (
                <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#FAF0E6' }}>
                  <Text style={{ fontSize: 13, color: '#888', marginRight: 10, flex: 0, width: 86 }}>
                    {formatDate(new Date(c.createdAt))}
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#FB8C00', flex: 1 }}>+{formatCurrency(c.amount)}</Text>
                  {c.note ? <Text style={{ fontSize: 12, color: '#888', flex: 1 }} numberOfLines={1}>{c.note}</Text> : null}
                  <Pressable onPress={() => handleDeleteContribution(c)} style={{ padding: 6 }}>
                    <Text style={{ fontSize: 14, color: '#FFCDD2' }}>✕</Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>
        )}
      </View>
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────
export default function SavingsScreen() {
  const insets = useSafeAreaInsets();
  const { showSnackbar } = useSnackbar();

  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);

  // Create / Edit Goal Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null); // null = create mode
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [icon, setIcon] = useState('🎯');
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  function openEditModal(goal: SavingsGoal) {
    setEditingGoal(goal);
    setName(goal.name);
    setTargetAmount(String(goal.targetAmount));
    setIcon(goal.icon ?? '🎯');
    setDeadline(goal.deadline ? new Date(goal.deadline) : null);
    setShowCreateModal(true);
  }

  function closeModal() {
    setShowCreateModal(false);
    setEditingGoal(null);
    setName(''); setTargetAmount(''); setIcon('🎯'); setDeadline(null);
  }

  // Contribute Modal
  const [contributeGoal, setContributeGoal] = useState<SavingsGoal | null>(null);
  const [contributeAmount, setContributeAmount] = useState('');
  const [contributeNote, setContributeNote] = useState('');
  const [contributing, setContributing] = useState(false);

  const loadGoals = useCallback(async () => {
    const all = await savingsService.getAll();
    setGoals(all);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { loadGoals(); }, [loadGoals]));

  async function handleSaveGoal() {
    if (!name.trim()) { showSnackbar({ message: 'กรุณาระบุชื่อเป้าหมาย', variant: 'warning' }); return; }
    const target = parseFloat(targetAmount.replace(/,/g, ''));
    if (!target || target <= 0) { showSnackbar({ message: 'กรุณาระบุยอดเป้าหมาย', variant: 'warning' }); return; }
    setSaving(true);
    try {
      if (editingGoal) {
        // Edit mode
        await savingsService.update(editingGoal.id, {
          name: name.trim(),
          targetAmount: target,
          icon,
          deadline,
          // อัพเดทสถานะ isCompleted ตามยอดปัจจุบันด้วย
          isCompleted: (editingGoal.currentAmount ?? 0) >= target,
        });
        showSnackbar({ title: 'แก้ไขแล้ว', message: `${icon} ${name.trim()}`, variant: 'success' });
      } else {
        // Create mode
        await savingsService.create({ name: name.trim(), targetAmount: target, currentAmount: 0, icon, deadline, isCompleted: false });
        showSnackbar({ title: 'สร้างเป้าหมายแล้ว', message: `${icon} ${name.trim()}`, variant: 'success' });
      }
    } finally {
      setSaving(false);
    }
    closeModal();
    loadGoals();
  }

  async function handleContribute() {
    if (!contributeGoal) return;
    const amount = parseFloat(contributeAmount.replace(/,/g, ''));
    if (!amount || amount <= 0) { showSnackbar({ message: 'กรุณาระบุจำนวนเงิน', variant: 'warning' }); return; }
    setContributing(true);
    try {
      const result = await dreamGoalService.addContribution(contributeGoal.id, amount, contributeNote.trim() || undefined);
      setContributeGoal(null); setContributeAmount(''); setContributeNote('');
      loadGoals();
      if (result.encouragement) {
        showSnackbar({ title: result.crossedMilestone ? `🎉 ${result.crossedMilestone}% แล้ว!` : 'หยอดกระปุกแล้ว', message: result.encouragement, variant: 'success', durationMs: 4000 });
      } else {
        showSnackbar({ title: 'หยอดกระปุกแล้ว', message: `+${formatCurrency(amount)} บาท`, variant: 'success' });
      }
    } finally {
      setContributing(false);
    }
  }

  function handleDelete(goal: SavingsGoal) {
    Alert.alert('ลบเป้าหมาย', `ต้องการลบ "${goal.name}" หรือไม่?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'ลบ', style: 'destructive', onPress: async () => { await savingsService.delete(goal.id); loadGoals(); } },
    ]);
  }

  const activeGoals = goals.filter((g) => !g.isCompleted);
  const completedGoals = goals.filter((g) => g.isCompleted);

  return (
    <View style={{ flex: 1, backgroundColor: '#FFF8F0' }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Gradient Header */}
      <LinearGradient
        colors={['#BF360C', '#E64A19', '#FF6D00']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 8, paddingBottom: 20, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff', flex: 1 }}>🎯 Dream Goals</Text>
          <Pressable
            onPress={() => setShowCreateModal(true)}
            style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>+ เป้าหมายใหม่</Text>
          </Pressable>
        </View>
        {/* Summary */}
        {!loading && (
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 12, alignItems: 'center' }}>
              <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff' }}>{activeGoals.length}</Text>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>กำลังออม</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 12, alignItems: 'center' }}>
              <Text style={{ fontSize: 22, fontWeight: '800', color: '#FFD54F' }}>{completedGoals.length}</Text>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>สำเร็จแล้ว</Text>
            </View>
          </View>
        )}
      </LinearGradient>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#FF6D00" />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
          {goals.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 48 }}>
              <Text style={{ fontSize: 56, marginBottom: 12 }}>🎯</Text>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#333', marginBottom: 8 }}>ยังไม่มีเป้าหมาย</Text>
              <Text style={{ fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 22, marginBottom: 24 }}>
                ตั้งเป้าหมายแรกของคุณเลย{'\n'}เช่น เที่ยวญี่ปุ่น, ซื้อรถ, ดาวน์บ้าน
              </Text>
              <Pressable onPress={() => setShowCreateModal(true)} style={{ backgroundColor: '#FF6D00', borderRadius: 16, paddingHorizontal: 28, paddingVertical: 14 }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>สร้างเป้าหมายแรก</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {activeGoals.length > 0 && (
                <>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#E65100', marginBottom: 10 }}>กำลังออม ({activeGoals.length})</Text>
                  {activeGoals.map((g) => (
                    <GoalCard key={g.id} goal={g} onContribute={() => setContributeGoal(g)} onEdit={() => openEditModal(g)} onDelete={() => handleDelete(g)} />
                  ))}
                </>
              )}
              {completedGoals.length > 0 && (
                <>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#FF8F00', marginBottom: 10, marginTop: 8 }}>🏆 สำเร็จแล้ว ({completedGoals.length})</Text>
                  {completedGoals.map((g) => (
                    <GoalCard key={g.id} goal={g} onContribute={() => setContributeGoal(g)} onEdit={() => openEditModal(g)} onDelete={() => handleDelete(g)} />
                  ))}
                </>
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* ── Create Goal Modal ── */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: 'rgba(0,0,0,0.5)', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#333' }}>
                {editingGoal ? '✏️ แก้ไขเป้าหมาย' : '🎯 เป้าหมายใหม่'}
              </Text>
              <Pressable onPress={closeModal}>
                <Text style={{ fontSize: 22, color: '#BBB' }}>✕</Text>
              </Pressable>
            </View>

            {/* Icon Picker */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#888', marginBottom: 8 }}>ไอคอน</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
              {GOAL_ICONS.map((ic) => (
                <Pressable key={ic} onPress={() => setIcon(ic)} style={{ width: 46, height: 46, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: icon === ic ? '#FFF3E0' : '#F5F5F5', borderWidth: icon === ic ? 2 : 0, borderColor: '#FF6D00' }}>
                  <Text style={{ fontSize: 24 }}>{ic}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={{ fontSize: 12, fontWeight: '700', color: '#888', marginBottom: 6 }}>ชื่อเป้าหมาย <Text style={{ color: '#E53935' }}>*</Text></Text>
            <TextInput value={name} onChangeText={setName} placeholder="เช่น เที่ยวญี่ปุ่น, ซื้อรถ..." placeholderTextColor="#FF8F00" style={{ backgroundColor: '#FFF8F0', borderRadius: 12, padding: 14, fontSize: 15, color: '#333', marginBottom: 14, borderWidth: 1.5, borderColor: '#FFB74D' }} />

            <Text style={{ fontSize: 12, fontWeight: '700', color: '#888', marginBottom: 6 }}>ยอดเป้าหมาย (บาท) <Text style={{ color: '#E53935' }}>*</Text></Text>
            <TextInput value={targetAmount} onChangeText={setTargetAmount} placeholder="เช่น 50000" keyboardType="decimal-pad" selectTextOnFocus placeholderTextColor="#FF8F00" style={{ backgroundColor: '#FFF8F0', borderRadius: 12, padding: 14, fontSize: 20, fontWeight: '800', color: '#333', marginBottom: 14, borderWidth: 1.5, borderColor: '#FFB74D' }} />

            <Pressable onPress={() => setShowDatePicker(true)} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF8F0', borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: '#FFB74D', gap: 10 }}>
              <Text style={{ fontSize: 16 }}>📅</Text>
              <Text style={{ fontSize: 14, color: deadline ? '#333' : '#FF8F00' }}>
                {deadline ? `กำหนด: ${formatDate(deadline)}` : 'ตั้งกำหนดเส้นตาย (ไม่บังคับ)'}
              </Text>
            </Pressable>
            {showDatePicker && (
              <DateTimePicker value={deadline ?? new Date()} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={(e: DateTimePickerEvent, d?: Date) => { setShowDatePicker(false); if (d) setDeadline(d); }} minimumDate={new Date()} />
            )}

            <Pressable onPress={handleSaveGoal} disabled={saving} style={{ backgroundColor: saving ? '#FFB74D' : editingGoal ? '#0288D1' : '#FF6D00', paddingVertical: 16, borderRadius: 14, alignItems: 'center' }}>
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>
                    {editingGoal ? '💾 บันทึกการแก้ไข' : 'สร้างเป้าหมาย'}
                  </Text>}
            </Pressable>
            <View style={{ height: insets.bottom + 8 }} />
          </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Contribute Modal ── */}
      <Modal visible={!!contributeGoal} animationType="fade" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '88%' }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#333', marginBottom: 4 }}>💰 หยอดกระปุก</Text>
            <Text style={{ fontSize: 14, color: '#888', marginBottom: 16 }}>
              {contributeGoal?.icon} {contributeGoal?.name}
            </Text>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#888', marginBottom: 6 }}>จำนวนเงิน (บาท) <Text style={{ color: '#E53935' }}>*</Text></Text>
            <TextInput value={contributeAmount} onChangeText={setContributeAmount} placeholder="0.00" keyboardType="decimal-pad" selectTextOnFocus placeholderTextColor="#FF8F00" style={{ backgroundColor: '#FFF8F0', borderRadius: 12, padding: 14, fontSize: 22, fontWeight: '800', color: '#333', marginBottom: 12, borderWidth: 1.5, borderColor: '#FFB74D', textAlign: 'center' }} autoFocus />
            <TextInput value={contributeNote} onChangeText={setContributeNote} placeholder="โน้ต เช่น ออมจากเงินเดือน (ไม่บังคับ)" placeholderTextColor="#BBB" style={{ backgroundColor: '#F5F5F5', borderRadius: 12, padding: 12, fontSize: 14, color: '#333', marginBottom: 16 }} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable onPress={() => { setContributeGoal(null); setContributeAmount(''); setContributeNote(''); }} style={{ flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#DDD', alignItems: 'center' }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#888' }}>ยกเลิก</Text>
              </Pressable>
              <Pressable onPress={handleContribute} disabled={contributing} style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: contributing ? '#FFB74D' : '#FF6D00', alignItems: 'center' }}>
                {contributing ? <ActivityIndicator color="#fff" /> : <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>หยอดกระปุก</Text>}
              </Pressable>
            </View>
          </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
