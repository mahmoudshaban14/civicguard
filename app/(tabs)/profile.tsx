import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
import { UserRound, Globe, Bell, LockKeyhole, LogOut, ChevronRight } from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

export default function ProfileScreen() {
  const router = useRouter();
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const [userName, setUserName] = useState<string>('مواطن');

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      async function loadUserData() {
        try {
          const savedLang = await AsyncStorage.getItem('@app_language');
          if (isMounted && (savedLang === 'en' || savedLang === 'ar')) {
            setLang(savedLang);
          }
        } catch (e) {
          console.error('Error loading language in ProfileScreen:', e);
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (isMounted && user) {
          const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'مواطن';
          setUserName(name);
        }
      }
      loadUserData();
      return () => {
        isMounted = false;
      };
    }, [])
  );

  const toggleLanguage = async () => {
    const newLang = lang === 'ar' ? 'en' : 'ar';
    setLang(newLang);
    try {
      await AsyncStorage.setItem('@app_language', newLang);
    } catch (e) {
      console.error('Error saving language', e);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/auth/login' as any);
  };

  const t = {
    ar: {
      title: 'الملف الشخصي 👤',
      subtitle: 'إدارة حسابك وإعدادات التطبيق الشخصية',
      accountSettings: 'إعدادات الحساب',
      language: 'لغة التطبيق',
      currentLang: 'العربية (Arabic) 🇪🇬',
      notifications: 'الإشعارات والتنبيهات',
      privacy: 'سياسة الخصوصية والأمان',
      logout: 'تسجيل الخروج من الحساب',
      accountType: 'حساب مواطن موثق · Civic Account',
      version: 'CivicGuard App v1.0.4 (Production)',
      textAlign: 'right' as const,
      flexDirection: 'row-reverse' as const,
    },
    en: {
      title: 'Profile 👤',
      subtitle: 'Manage your account and personal app settings',
      accountSettings: 'Account Settings',
      language: 'App Language',
      currentLang: 'English 🌐',
      notifications: 'Notifications & Alerts',
      privacy: 'Privacy & Security Policy',
      logout: 'Log Out of Account',
      accountType: 'Verified Citizen · Civic Account',
      version: 'CivicGuard App v1.0.4 (Production)',
      textAlign: 'left' as const,
      flexDirection: 'row' as const,
    },
  }[lang];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        
        {/* عنوان الصفحة */}
        <Text style={{ fontSize: 24, fontWeight: '800', color: '#0F172A', textAlign: t.textAlign, marginBottom: 4 }}>
          {t.title}
        </Text>
        <Text style={{ fontSize: 13, color: '#64748B', marginBottom: 20, textAlign: t.textAlign }}>
          {t.subtitle}
        </Text>

        {/* كارت البروفايل الرئيسي (بنفس ستايل الكاردات) */}
        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#E2E8F0', elevation: 2, alignItems: 'center', marginBottom: 20 }}>
          <View style={{ backgroundColor: '#EFF6FF', size: 64, width: 64, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#BFDBFE' }}>
            <UserRound size={30} color="#1E3A8A" />
          </View>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 4 }}>
            {userName}
          </Text>
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#2563EB' }}>
            {t.accountType}
          </Text>
        </View>

        {/* خيارات القائمة */}
        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden', marginBottom: 20, elevation: 2 }}>
          
          {/* إعدادات الحساب */}
          <TouchableOpacity
            onPress={() => router.push('/profile/account' as any)}
            style={{ flexDirection: t.flexDirection, alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}
          >
            <View style={{ backgroundColor: '#EFF6FF', padding: 8, borderRadius: 10, [lang === 'ar' ? 'marginLeft' : 'marginRight']: 12 }}>
              <UserRound size={18} color="#1E3A8A" />
            </View>
            <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: '#334155', textAlign: t.textAlign }}>
              {t.accountSettings}
            </Text>
            <ChevronRight size={18} color="#94A3B8" style={{ transform: [{ scaleX: lang === 'ar' ? -1 : 1 }] }} />
          </TouchableOpacity>

          {/* تبديل اللغة */}
          <TouchableOpacity
            onPress={toggleLanguage}
            style={{ flexDirection: t.flexDirection, alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}
          >
            <View style={{ backgroundColor: '#EFF6FF', padding: 8, borderRadius: 10, [lang === 'ar' ? 'marginLeft' : 'marginRight']: 12 }}>
              <Globe size={18} color="#1E3A8A" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#334155', textAlign: t.textAlign }}>
                {t.language}
              </Text>
              <Text style={{ fontSize: 11, color: '#64748B', textAlign: t.textAlign, marginTop: 2 }}>
                {t.currentLang}
              </Text>
            </View>
            <ChevronRight size={18} color="#94A3B8" style={{ transform: [{ scaleX: lang === 'ar' ? -1 : 1 }] }} />
          </TouchableOpacity>

          {/* الإشعارات */}
          <TouchableOpacity
            onPress={() => router.push('/notifications' as any)}
            style={{ flexDirection: t.flexDirection, alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}
          >
            <View style={{ backgroundColor: '#EFF6FF', padding: 8, borderRadius: 10, [lang === 'ar' ? 'marginLeft' : 'marginRight']: 12 }}>
              <Bell size={18} color="#1E3A8A" />
            </View>
            <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: '#334155', textAlign: t.textAlign }}>
              {t.notifications}
            </Text>
            <ChevronRight size={18} color="#94A3B8" style={{ transform: [{ scaleX: lang === 'ar' ? -1 : 1 }] }} />
          </TouchableOpacity>

          {/* سياسة الخصوصية */}
          <TouchableOpacity
            onPress={() => router.push('/profile/privacy' as any)}
            style={{ flexDirection: t.flexDirection, alignItems: 'center', padding: 16 }}
          >
            <View style={{ backgroundColor: '#EFF6FF', padding: 8, borderRadius: 10, [lang === 'ar' ? 'marginLeft' : 'marginRight']: 12 }}>
              <LockKeyhole size={18} color="#1E3A8A" />
            </View>
            <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: '#334155', textAlign: t.textAlign }}>
              {t.privacy}
            </Text>
            <ChevronRight size={18} color="#94A3B8" style={{ transform: [{ scaleX: lang === 'ar' ? -1 : 1 }] }} />
          </TouchableOpacity>

        </View>

        {/* زر تسجيل الخروج */}
        <TouchableOpacity
          onPress={handleLogout}
          style={{ backgroundColor: '#FEF2F2', borderWidth: 1.5, borderColor: '#FCA5A5', borderRadius: 14, paddingVertical: 14, flexDirection: t.flexDirection, alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20 }}
        >
          <LogOut size={18} color="#DC2626" />
          <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 14 }}>{t.logout}</Text>
        </TouchableOpacity>

        {/* رقم الإصدار */}
        <Text style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', fontWeight: '600' }}>
          {t.version}
        </Text>

      </ScrollView>
    </SafeAreaView>
  );
}