import { useState, useMemo } from 'react';
import { ScrollView, View, Text, Pressable, Dimensions } from 'react-native';
import { formatCurrency } from '@/lib/format';
import type { EntryWithRelations } from '../types';
import { isSameDay } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DAY_LABELS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

const MOOD_COLORS: Record<string, string> = {
  '😊': '#F59E0B', '🥰': '#EC4899', '😆': '#F97316', '😌': '#059669',
  '🤩': '#7C3AED', '😴': '#4F46E5', '😢': '#3B82F6', '😤': '#EF4444',
  '🥺': '#8B5CF6', '😮': '#14B8A6',
};

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  mood?: string;
  count: number;
}

function buildCalendarDays(year: number, month: number, items: EntryWithRelations[]): CalendarDay[] {
  const entryMap: Record<string, { mood?: string; count: number }> = {};
  for (const item of items) {
    const d = new Date(item.entry.entryDate as unknown as number);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!entryMap[key]) entryMap[key] = { count: 0 };
    entryMap[key].count++;
    if (!entryMap[key].mood && item.entry.mood) entryMap[key].mood = item.entry.mood;
  }

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days: CalendarDay[] = [];

  for (let i = firstDay.getDay() - 1; i >= 0; i--) {
    days.push({ date: new Date(year, month, -i), isCurrentMonth: false, count: 0 });
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const key = `${year}-${month}-${d}`;
    const entry = entryMap[key];
    days.push({ date: new Date(year, month, d), isCurrentMonth: true, mood: entry?.mood, count: entry?.count ?? 0 });
  }
  const rem = (7 - (days.length % 7)) % 7;
  for (let i = 1; i <= rem; i++) {
    days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false, count: 0 });
  }
  return days;
}

function thaiMonthYear(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
}

interface Props {
  items: EntryWithRelations[];
  insets: { bottom: number };
  onDayPress: (date: Date) => void;
}

export function CalendarView({ items, insets, onDayPress }: Props) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const days = useMemo(() => buildCalendarDays(year, month, items), [year, month, items]);
  const today = new Date();

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  const monthItems = items.filter(item => {
    const d = new Date(item.entry.entryDate as unknown as number);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 80 }}>

      {/* Month navigator */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 14,
        elevation: 1, shadowColor: '#7C3AED', shadowOpacity: 0.06, shadowRadius: 4,
      }}>
        <Pressable onPress={prevMonth} style={{ padding: 8 }}>
          <Text style={{ fontSize: 20, color: '#7C3AED' }}>‹</Text>
        </Pressable>
        <Text style={{ fontSize: 16, fontWeight: '800', color: '#1E1B4B' }}>
          {thaiMonthYear(year, month)}
        </Text>
        <Pressable onPress={nextMonth} style={{ padding: 8 }}>
          <Text style={{ fontSize: 20, color: '#7C3AED' }}>›</Text>
        </Pressable>
      </View>

      {/* Day-of-week headers */}
      <View style={{ flexDirection: 'row', marginBottom: 6 }}>
        {DAY_LABELS.map(label => (
          <View key={label} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{
              fontSize: 11, fontWeight: '700',
              color: label === 'อา' ? '#EF4444' : label === 'ส' ? '#3B82F6' : '#9CA3AF',
            }}>
              {label}
            </Text>
          </View>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={{
        flexDirection: 'row', flexWrap: 'wrap',
        backgroundColor: '#fff', borderRadius: 16, padding: 8,
        elevation: 1, shadowColor: '#7C3AED', shadowOpacity: 0.06, shadowRadius: 4,
      }}>
        {days.map((day, idx) => {
          const isToday = isSameDay(day.date, today);
          const moodColor = day.mood ? (MOOD_COLORS[day.mood] ?? '#7C3AED') : '#7C3AED';
          const cellW = (SCREEN_WIDTH - 32 - 16) / 7;
          return (
            <Pressable
              key={idx}
              onPress={() => day.isCurrentMonth && day.count > 0 && onDayPress(day.date)}
              style={{ width: cellW, height: cellW + 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 }}>
              <View style={{
                width: 32, height: 32, borderRadius: 16,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: isToday ? '#7C3AED' : 'transparent',
              }}>
                <Text style={{
                  fontSize: 13,
                  fontWeight: isToday ? '900' : day.count > 0 ? '700' : '400',
                  color: isToday ? '#fff' : !day.isCurrentMonth ? '#D1D5DB' : '#1E1B4B',
                }}>
                  {day.date.getDate()}
                </Text>
              </View>
              {day.isCurrentMonth && day.count > 0 && (
                day.mood ? (
                  <Text style={{ fontSize: 12, marginTop: 1 }}>{day.mood}</Text>
                ) : (
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: moodColor, marginTop: 2 }} />
                )
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Monthly entries summary */}
      {monthItems.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#5B21B6', marginBottom: 8 }}>
            บันทึกเดือนนี้ ({monthItems.length} รายการ)
          </Text>
          {monthItems.map(item => (
            <View
              key={item.entry.id}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 10,
                backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 6,
                borderLeftWidth: 3,
                borderLeftColor: item.entry.mood ? (MOOD_COLORS[item.entry.mood] ?? '#7C3AED') : '#7C3AED',
              }}>
              <Text style={{ fontSize: 18 }}>{item.entry.mood ?? '📝'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E1B4B' }} numberOfLines={1}>
                  {item.entry.title ?? item.entry.content}
                </Text>
                <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>
                  {new Date(item.entry.entryDate as unknown as number)
                    .toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                  {item.totalExpenses > 0 ? `  💰 ${formatCurrency(item.totalExpenses)}฿` : ''}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
