import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState<'ar' | 'en'>('ar');

  // State للتحكم في رسائل الأخطاء
  const [identifierError, setIdentifierError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [generalError, setGeneralError] = useState('');

  const t = {
    ar: {
      title: 'تسجيل الدخول',
      subtitle: 'أدخل البريد الإلكتروني، الرقم القومي، أو رقم الهاتف للمتابعة',
      identifierLabel: 'البريد / الرقم القومي / الهاتف',
      identifierPlaceholder: 'إيميل، رقم قومي، أو رقم موبايل',
      passwordLabel: 'كلمة المرور',
      passwordPlaceholder: '••••••••',
      loginBtn: 'تسجيل الدخول',
      forgotBtn: 'نسيت كلمة المرور؟',
      signUpLink: 'ليس لديك حساب؟ إنشاء حساب جديد',
      identifierRequired: 'تحتاج لإدخال البريد الإلكتروني أو الرقم القومي أو الهاتف',
      passwordRequired: 'تحتاج لإدخال كلمة المرور',
      alertErrorMessage: 'بيانات الدخول غير صحيحة. يرجى التأكد من البيانات والمحاولة مجدداً.',
      switchLangText: 'English',
      textAlign: 'center' as const,
      inputTextAlign: 'right' as const,
    },
    en: {
      title: 'Log In',
      subtitle: 'Enter your Email, National ID, or Phone number to continue',
      identifierLabel: 'Email / National ID / Phone',
      identifierPlaceholder: 'Email, National ID, or Phone',
      passwordLabel: 'Password',
      passwordPlaceholder: '••••••••',
      loginBtn: 'Log In',
      forgotBtn: 'Forgot Password?',
      signUpLink: "Don't have an account? Sign Up",
      identifierRequired: 'Please enter Email, National ID, or Phone number',
      passwordRequired: 'Please enter your password',
      alertErrorMessage: 'Invalid credentials. Please check your data and try again.',
      switchLangText: 'عربي',
      textAlign: 'center' as const,
      inputTextAlign: 'left' as const,
    },
  }[lang];

  async function handleLogin() {
    let hasError = false;
    setIdentifierError('');
    setPasswordError('');
    setGeneralError('');

    // التحقق من الحقول الفارغة
    if (!identifier.trim()) {
      setIdentifierError(t.identifierRequired);
      hasError = true;
    }

    if (!password) {
      setPasswordError(t.passwordRequired);
      hasError = true;
    }

    if (hasError) return;

    setLoading(true);

    // محاولة تسجيل الدخول مع Supabase Auth
    const { error } = await supabase.auth.signInWithPassword({
      email: identifier.trim(),
      password: password,
    });

    setLoading(false);

    if (error) {
      setGeneralError(t.alertErrorMessage);
      return;
    }

    // النجاح والتوجيه للواجهة الرئيسية
    router.replace('/(tabs)');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F1F5F9' }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
          paddingTop: 40,
          paddingBottom: 40,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ width: '100%', maxWidth: 440, alignSelf: 'center' }}>
          {/* زر تحويل اللغة */}
          <View style={{ marginBottom: 16, flexDirection: 'row', justifyContent: 'flex-end' }}>
            <TouchableOpacity
              onPress={() => {
                setLang(lang === 'ar' ? 'en' : 'ar');
                setIdentifierError('');
                setPasswordError('');
                setGeneralError('');
              }}
              activeOpacity={0.8}
              style={{
                backgroundColor: '#FFFFFF',
                paddingVertical: 8,
                paddingHorizontal: 16,
                borderRadius: 24,
                borderWidth: 1.5,
                borderColor: '#1E293B',
                shadowColor: '#1E293B',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3,
              }}
            >
              <Text style={{ color: '#1E293B', fontWeight: '800', fontSize: 13 }}>
                {t.switchLangText}
              </Text>
            </TouchableOpacity>
          </View>

          {/* كارت تسجيل الدخول */}
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 24,
              padding: 28,
              shadowColor: '#0F172A',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.08,
              shadowRadius: 20,
              elevation: 5,
              borderWidth: 1,
              borderColor: '#E2E8F0',
            }}
          >
          {/* تم سنترة العنوان والوصف في المنتصف */}
          <Text style={{ fontSize: 26, fontWeight: '800', color: '#0F172A', marginBottom: 6, textAlign: t.textAlign }}>
            {t.title}
          </Text>
          <Text style={{ fontSize: 13, color: '#64748B', marginBottom: 20, textAlign: t.textAlign, lineHeight: 20 }}>
            {t.subtitle}
          </Text>

          {/* تنبيه خطأ الداتابيز أو عدم تطابق الحساب */}
          {generalError ? (
            <View
              style={{
                backgroundColor: '#FEF2F2',
                borderWidth: 1,
                borderColor: '#FCA5A5',
                borderRadius: 14,
                padding: 12,
                marginBottom: 18,
              }}
            >
              <Text style={{ color: '#991B1B', fontSize: 12.5, fontWeight: '600', textAlign: t.textAlign, lineHeight: 18 }}>
                {generalError}
              </Text>
            </View>
          ) : null}

          {/* حقل المعرف (إيميل / رقم قومي / هاتف) */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', marginBottom: 8, textAlign: lang === 'ar' ? 'right' : 'left', color: '#334155' }}>
              {t.identifierLabel}
            </Text>
            <TextInput
              placeholder={t.identifierPlaceholder}
              value={identifier}
              onChangeText={(val) => {
                setIdentifier(val);
                if (val.trim()) setIdentifierError('');
                setGeneralError('');
              }}
              autoCapitalize="none"
              placeholderTextColor="#94A3B8"
              style={{
                backgroundColor: '#F8FAFC',
                borderWidth: 1.5,
                borderColor: identifierError ? '#DC2626' : '#CBD5E1',
                borderRadius: 14,
                paddingVertical: 14,
                paddingHorizontal: 16,
                textAlign: t.inputTextAlign,
                fontSize: 14.5,
                color: '#0F172A',
                fontWeight: '500',
              }}
            />
            {identifierError ? (
              <Text style={{ color: '#DC2626', fontSize: 12, fontWeight: '600', marginTop: 6, textAlign: lang === 'ar' ? 'right' : 'left' }}>
                {identifierError}
              </Text>
            ) : null}
          </View>

          {/* حقل كلمة المرور */}
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', marginBottom: 8, textAlign: lang === 'ar' ? 'right' : 'left', color: '#334155' }}>
              {t.passwordLabel}
            </Text>
            <TextInput
              placeholder={t.passwordPlaceholder}
              value={password}
              onChangeText={(val) => {
                setPassword(val);
                if (val) setPasswordError('');
                setGeneralError('');
              }}
              secureTextEntry
              placeholderTextColor="#94A3B8"
              style={{
                backgroundColor: '#F8FAFC',
                borderWidth: 1.5,
                borderColor: passwordError ? '#DC2626' : '#CBD5E1',
                borderRadius: 14,
                paddingVertical: 14,
                paddingHorizontal: 16,
                textAlign: t.inputTextAlign,
                fontSize: 14.5,
                color: '#0F172A',
                fontWeight: '500',
              }}
            />
            {passwordError ? (
              <Text style={{ color: '#DC2626', fontSize: 12, fontWeight: '600', marginTop: 6, textAlign: lang === 'ar' ? 'right' : 'left' }}>
                {passwordError}
              </Text>
            ) : null}
          </View>

          {/* زر نسيت كلمة المرور */}
          <TouchableOpacity
            onPress={() => router.push('/auth/forgot-password' as any)}
            style={{ alignSelf: lang === 'ar' ? 'flex-start' : 'flex-end', marginBottom: 20 }}
          >
            <Text style={{ color: '#2563EB', fontSize: 12.5, fontWeight: '700' }}>
              {t.forgotBtn}
            </Text>
          </TouchableOpacity>

          {/* زر تسجيل الدخول */}
          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
            style={{
              backgroundColor: '#1E3A8A',
              paddingVertical: 16,
              borderRadius: 14,
              alignItems: 'center',
              marginBottom: 16,
              shadowColor: '#1E3A8A',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>
                {t.loginBtn}
              </Text>
            )}
          </TouchableOpacity>

          {/* رابط إنشاء حساب */}
          <TouchableOpacity onPress={() => router.push('/auth/sign-up' as any)}>
            <Text style={{ textAlign: 'center', color: '#2563EB', fontWeight: '700', fontSize: 13.5, marginTop: 4 }}>
              {t.signUpLink}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  </SafeAreaView>
);
}