import { useCallback, useEffect, useState } from 'react';
import {
  ChevronRight,
  Bell,
  LockKeyhole,
  LogOut,
  UserRound,
  Globe,
} from 'lucide-react-native';
import { Pressable, View, Alert, Text } from 'react-native';
import { Button, Typography } from 'heroui-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppHeader } from '@/components/civic/AppHeader';
import { Screen } from '@/components/civic/Screen';
import { supabase } from '@/lib/supabase';

export default function ProfileScreen() {
  const [userName, setUserName] = useState<string>('مواطن');
  const [userEmail, setUserEmail] = useState<string>('');
  const [lang, setLang] = useState<'ar' | 'en'>('ar');

  useEffect(() => {
    async function loadUserData() {
      // جلب اللغة المحفوظة
      try {
        const savedLang = await AsyncStorage.getItem('@app_language');
        if (savedLang === 'en' || savedLang === 'ar') {
          setLang(savedLang);
        }
      } catch (e) {
        console.error('Error reading language', e);
      }

      // جلب بيانات المستخدم من Supabase
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'مواطن';
        setUserName(name);
        setUserEmail(user.email || '');
      }
    }
    loadUserData();
  }, []);

  // دالة تبديل اللغة
  const toggleLanguage = async () => {
    const newLang = lang === 'ar' ? 'en' : 'ar';
    setLang(newLang);
    try {
      await AsyncStorage.setItem('@app_language', newLang);
      Alert.alert(
        newLang === 'ar' ? 'تغيير اللغة' : 'Language Changed',
        newLang === 'ar' ? 'تم تغيير لغة التطبيق إلى العربية' : 'App language changed to English'
      );
    } catch (e) {
      console.error('Error saving language', e);
    }
  };

  // حساب الحروف الأولى للاسم
  const initials = userName
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'CG';

  const handleLogout = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert(lang === 'ar' ? 'خطأ في الخروج' : 'Logout Error', error.message);
    }
  }, [lang]);

  // قاموس النصوص بناءً على اللغة المختارة
  const t = {
    ar: {
      header: 'الملف الشخصي',
      accountSettings: 'إعدادات الحساب',
      language: 'لغة التطبيق',
      currentLang: 'العربية (Arabic) 🇪🇬',
      notifications: 'الإشعارات',
      privacy: 'سياسة الخصوصية',
      logout: 'تسجيل الخروج',
      accountType: 'حساب مواطن · Civic Account',
      version: 'CivicGuard App v1.0.4 (Production Build)',
      copyright: 'جميع الحقوق محفوظة © 2026',
    },
    en: {
      header: 'Profile',
      accountSettings: 'Profile Settings',
      language: 'App Language',
      currentLang: 'English 🌐',
      notifications: 'Notifications',
      privacy: 'Privacy Policy',
      logout: 'Logout',
      accountType: 'Citizen Account · Civic Account',
      version: 'CivicGuard App v1.0.4 (Production Build)',
      copyright: 'All Rights Reserved © 2026',
    },
  }[lang];

  return (
    <Screen>
      <AppHeader title={t.header} />
      
      {/* الكارت الأخضر لعرض بيانات المستخدم */}
      <View className="bg-civic-deep mb-6 items-center rounded-[28px] p-6 shadow-md">
        <View className="mb-3 size-20 items-center justify-center rounded-full bg-white/20 border-2 border-white/30">
          <Typography.Heading type="h2" className="text-white font-bold">
            {initials}
          </Typography.Heading>
        </View>
        <Typography.Heading type="h4" className="text-white font-semibold">
          {userName}
        </Typography.Heading>
        <Typography.Paragraph className="mt-1 text-sm text-white/80">
          {userEmail || t.accountType}
        </Typography.Paragraph>
      </View>

      {/* خيارات القائمة */}
      <View className="border-border bg-surface overflow-hidden rounded-3xl border mb-4">
        
        {/* إعدادات الحساب */}
        <Pressable
          onPress={() => router.push('/profile/account' as any)}
          className="active:bg-default flex-row items-center px-4 py-4 border-b border-border"
        >
          <View className="bg-civic-mint mr-3 size-10 items-center justify-center rounded-xl">
            <UserRound size={19} color="#167A62" />
          </View>
          <Typography.Paragraph className={`flex-1 font-medium ${lang === 'ar' ? 'text-right mr-2' : 'text-left ml-2'}`}>
            {t.accountSettings}
          </Typography.Paragraph>
          <ChevronRight size={18} color="#8A9894" />
        </Pressable>

        {/* خيار تغيير اللغة */}
        <Pressable
          onPress={toggleLanguage}
          className="active:bg-default flex-row items-center px-4 py-4 border-b border-border"
        >
          <View className="bg-blue-100 mr-3 size-10 items-center justify-center rounded-xl">
            <Globe size={19} color="#1E3A8A" />
          </View>
          <View className="flex-1">
            <Typography.Paragraph className={`font-medium ${lang === 'ar' ? 'text-right mr-2' : 'text-left ml-2'}`}>
              {t.language}
            </Typography.Paragraph>
            <Text className={`text-xs text-gray-400 mt-0.5 ${lang === 'ar' ? 'text-right mr-2' : 'text-left ml-2'}`}>
              {t.currentLang}
            </Text>
          </View>
          <ChevronRight size={18} color="#8A9894" />
        </Pressable>

        {/* الإشعارات */}
        <Pressable
          onPress={() => router.push('/notifications' as any)}
          className="active:bg-default flex-row items-center px-4 py-4 border-b border-border"
        >
          <View className="bg-civic-mint mr-3 size-10 items-center justify-center rounded-xl">
            <Bell size={19} color="#167A62" />
          </View>
          <Typography.Paragraph className={`flex-1 font-medium ${lang === 'ar' ? 'text-right mr-2' : 'text-left ml-2'}`}>
            {t.notifications}
          </Typography.Paragraph>
          <ChevronRight size={18} color="#8A9894" />
        </Pressable>

        {/* سياسة الخصوصية */}
        <Pressable
          onPress={() => router.push('/profile/privacy' as any)}
          className="active:bg-default flex-row items-center px-4 py-4"
        >
          <View className="bg-civic-mint mr-3 size-10 items-center justify-center rounded-xl">
            <LockKeyhole size={19} color="#167A62" />
          </View>
          <Typography.Paragraph className={`flex-1 font-medium ${lang === 'ar' ? 'text-right mr-2' : 'text-left ml-2'}`}>
            {t.privacy}
          </Typography.Paragraph>
          <ChevronRight size={18} color="#8A9894" />
        </Pressable>

      </View>

      {/* زر تسجيل الخروج */}
      <Button variant="ghost" className="mt-2 border border-red-200 rounded-2xl" onPress={handleLogout}>
        <LogOut size={18} color="#C73545" />
        <Button.Label className="text-danger font-semibold">{t.logout}</Button.Label>
      </Button>

      {/* رقم الإصدار */}
      <View className="mt-6 items-center justify-center mb-6">
        <Typography.Paragraph className="text-xs text-gray-400 font-medium">
          {t.version}
        </Typography.Paragraph>
        <Typography.Paragraph className="text-[10px] text-gray-300 mt-0.5">
          {t.copyright}
        </Typography.Paragraph>
      </View>
    </Screen>
  );
}