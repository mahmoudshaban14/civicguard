import React from 'react';
import { FilePlus2, Home, Map, UserRound, ClipboardList } from 'lucide-react-native';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useThemeColor } from 'heroui-native';
import type { ColorValue } from 'react-native';
import { useLanguage } from '@/lib/LanguageContext';

const statusBarStyle = 'dark' as const;
const icon =
  (Icon: typeof Home) =>
    ({ color, size }: { color: ColorValue; size: number }) => (
      <Icon color={color} size={size ?? 23} strokeWidth={2.2} />
    );

export default function TabLayout() {
  // استخدام سياق اللغة التفاعلي بدلاً من الـ Polling والـ setInterval
  const { lang } = useLanguage();

  const [background, border, accent, muted] = useThemeColor([
    'background',
    'border',
    'accent',
    'muted',
  ]);

  const isRTL = lang === 'ar';

  const t = {
    ar: {
      home: 'الرئيسية',
      report: 'إبلاغ',
      reports: 'بلاغاتي',
      map: 'الخريطة',
      profile: 'الملف الشخصي',
    },
    en: {
      home: 'Home',
      report: 'Report',
      reports: 'My Reports',
      map: 'Map',
      profile: 'Profile',
    },
  }[lang];

  // تعريف كروت الـ Tabs
  const screens = [
    <Tabs.Screen key="index" name="index" options={{ title: t.home, tabBarIcon: icon(Home) }} />,
    <Tabs.Screen key="report" name="report" options={{ title: t.report, tabBarIcon: icon(FilePlus2) }} />,
    <Tabs.Screen key="reports" name="reports" options={{ title: t.reports, tabBarIcon: icon(ClipboardList) }} />,
    <Tabs.Screen key="map" name="map" options={{ title: t.map, tabBarIcon: icon(Map) }} />,
    <Tabs.Screen key="profile" name="profile" options={{ title: t.profile, tabBarIcon: icon(UserRound) }} />,
  ];

  return (
    <>
      <StatusBar style={statusBarStyle} />
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: background },
          tabBarStyle: {
            backgroundColor: background,
            borderTopColor: border,
            height: 72,
            paddingTop: 7,
            paddingBottom: 9,
          },
          tabBarLabelStyle: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
          tabBarActiveTintColor: accent,
          tabBarInactiveTintColor: muted,
        }}
      >
        {/* في حالة العربي يتم تعكيس ترتيب العناصر مصفوفياً ليصبح Home أقصى اليمين فورا */}
        {isRTL ? [...screens].reverse() : screens}
      </Tabs>
    </>
  );
}