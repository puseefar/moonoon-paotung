import React from 'react';
import { Image, ImageSourcePropType, View, Platform, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

const ICONS = {
  home:     require('@/assets/menu-footer/home.png'),
  report:   require('@/assets/menu-footer/report.png'),
  add:      require('@/assets/menu-footer/add.png'),
  history:  require('@/assets/menu-footer/history.png'),
  settings: require('@/assets/menu-footer/settings.png'),
};

// ── Regular tab icon ────────────────────────────────────────────────────────
function TabIcon({ source, focused }: { source: ImageSourcePropType; focused: boolean }) {
  return (
    <View style={[iconStyles.wrap, focused && iconStyles.wrapActive]}>
      <View style={iconStyles.imgWrap}>
        <Image
          source={source}
          style={[iconStyles.img, { opacity: focused ? 1 : 0.5 }]}
          resizeMode="contain"
        />
      </View>
      {focused && <View style={iconStyles.dot} />}
    </View>
  );
}

// ── Center FAB ──────────────────────────────────────────────────────────────
function AddTabIcon() {
  return (
    <View style={iconStyles.fabOuter}>
      <View style={iconStyles.fabInner}>
        <Image source={ICONS.add} style={iconStyles.fabImg} resizeMode="contain" />
      </View>
    </View>
  );
}

const iconStyles = StyleSheet.create({
  // Regular icon container
  wrap: {
    alignItems: 'center',
    gap: 2,
    paddingTop: 2,
    paddingBottom: 4,
  },
  wrapActive: {
    // active state handled by dot + opacity
  },
  imgWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 5,           // padding สม่ำเสมอ — ป้องกัน icon ขนาด canvas ต่างกันล้นกรอบ
    shadowColor: '#1aafeb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 0 ,
    backgroundColor: 'rgba(250, 250, 250, 1)',
  },
  img: {
    width: 32,           // 46 - (5*2) = 36 — รูปจริงอยู่ใน padding box
    height: 32,
    

  },
  // Active dot indicator below icon
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#4b96f7',
    marginTop: -2,
  },

  // Center FAB
  fabOuter: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
   
  },
  fabInner: {
    width: 45,            // ลด 20% จาก 62
    height: 45,
    borderRadius: 25,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EC4899',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 10,
  },
  fabImg: {
    width: 32,             // ลด 20% จาก 44
    height: 32,
  },
});

// ── Tab background — gradient เหมือน DailySnapshot ─────────────────────────
function TabBarBackground() {
  return (
    <LinearGradient
      colors={['rgba(71, 127, 248, 0.555)', 'rgba(255,255,255,1)']}
      locations={[0, 0.5]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={StyleSheet.absoluteFillObject}
    />
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const bottomPadding = Platform.OS === 'android' ? Math.max(insets.bottom, 12) : insets.bottom + 4;
  const tabBarHeight = 66 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#1aafeb',
        tabBarInactiveTintColor: colors.tabIconDefault,
        tabBarBackground: () => <TabBarBackground />,
        tabBarStyle: {
          backgroundColor: 'transparent',
          borderTopColor: 'rgba(26,175,235,0.15)',
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingBottom: bottomPadding,
          paddingTop: 6,
          // Shadow on entire tab bar
          shadowColor: '#1aafeb',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.12,
          shadowRadius: 10,
          elevation: 12,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          marginTop: 6,       // ขยายระยะห่าง icon → label
          marginBottom: 2,
        },
        headerStyle: {
          backgroundColor: colors.tint,
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}>

      <Tabs.Screen
        name="index"
        options={{
          title: 'หน้าหลัก',
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabIcon source={ICONS.home} focused={focused} />,
        }}
      />

      <Tabs.Screen
        name="report-tab"
        options={{
          title: 'รายงาน',
          headerTitle: 'รายงาน',
          tabBarIcon: ({ focused }) => <TabIcon source={ICONS.report} focused={focused} />,
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.push('/report');
          },
        }}
      />

      <Tabs.Screen
        name="add"
        options={{
          title: '',
          headerTitle: 'บันทึกรายการ',
          headerBackground: () => (
            <LinearGradient
              colors={['#7C3AED', '#1565C0']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ flex: 1 }}
            />
          ),
          tabBarIcon: () => <AddTabIcon />,
          tabBarLabel: () => null,
        }}
      />

      <Tabs.Screen
        name="history"
        options={{
          title: 'ประวัติ',
          headerTitle: 'ประวัติรายการ',
          tabBarIcon: ({ focused }) => <TabIcon source={ICONS.history} focused={focused} />,
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: 'ตั้งค่า',
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabIcon source={ICONS.settings} focused={focused} />,
        }}
      />
    </Tabs>
  );
}
