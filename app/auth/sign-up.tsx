import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

const parseDigits = (str: string) => {
  return str.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
};

const validateFullName = (name: string) => {
  const nameRegex = /^[a-zA-Z\u0600-\u06FF\s]+$/;
  return nameRegex.test(name.trim());
};

const validateEgyptianPhone = (phoneStr: string) => {
  const cleanPhone = parseDigits(phoneStr.trim());
  const egPhoneRegex = /^01[0125]\d{8}$/;
  return egPhoneRegex.test(cleanPhone);
};

const validateEmail = (emailStr: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(emailStr.trim());
};

export default function SignUpScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState<'ar' | 'en'>('ar');

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const t = {
    ar: {
      title: 'إنشاء حساب مواطن 🇪🇬',
      subtitle: 'قم بالتسجيل في المنظومة الوطنية لتوثيق البلاغات',
      fullNameLabel: 'الاسم بالكامل',
      fullNamePlaceholder: 'مثال: يوسف تامر',
      nationalIdLabel: 'الرقم القومي (14 رقم)',
      nationalIdPlaceholder: 'مثال: 29901011234567',
      phoneLabel: 'رقم الهاتف المحمول',
      phonePlaceholder: 'مثال: 01012345678',
      emailLabel: 'البريد الإلكتروني',
      emailPlaceholder: 'example@gmail.com',
      passwordLabel: 'كلمة المرور',
      passwordPlaceholder: '••••••••',
      signUpBtn: 'إنشاء الحساب',
      loadingBtn: 'جاري إنشاء الحساب...',
      loginLink: 'لديك حساب بالفعل؟ تسجيل الدخول',
      switchLangText: 'English 🌐',
      textAlign: 'right' as const,
      errFullName: 'الاسم يفضل أن يحتوي على حروف فقط وبدون أرقام أو رموز',
      errNationalId: 'الرقم القومي يجب أن يتكون من 14 رقم فقط',
      errPhone: 'يرجى إدخال رقم موبايل مصري صحيح مكون من 11 رقم يبدأ بـ (010, 011, 012, 015)',
      errEmail: 'يرجى إدخال بريد إلكتروني صحيح (مثال: example@gmail.com)',
      errPassword: 'كلمة المرور ضعيفة جدًا، يفضل إضافة أرقام ورموز وحروف',
      alertSuccessTitle: 'تم بنجاح 🎉',
      alertSuccessMsg: 'تم إنشاء حسابك القومي بنجاح!',
      alertOk: 'الانتقال للتطبيق',
      weak: 'ضعيفة',
      medium: 'متوسطة',
      strong: 'قوية جداً',
    },
    en: {
      title: 'Create Account 🇪🇬',
      subtitle: 'Register in the national platform for civic reporting',
      fullNameLabel: 'Full Name',
      fullNamePlaceholder: 'e.g., Youssef Tamer',
      nationalIdLabel: 'National ID (14 digits)',
      nationalIdPlaceholder: 'e.g., 29901011234567',
      phoneLabel: 'Mobile Phone Number',
      phonePlaceholder: 'e.g., 01012345678',
      emailLabel: 'Email Address',
      emailPlaceholder: 'example@gmail.com',
      passwordLabel: 'Password',
      passwordPlaceholder: '••••••••',
      signUpBtn: 'Create Account',
      loadingBtn: 'Creating Account...',
      loginLink: 'Already have an account? Log In',
      switchLangText: 'عربي 🇪🇬',
      textAlign: 'left' as const,
      errFullName: 'Full name must contain letters and spaces only',
      errNationalId: 'National ID must be exactly 14 digits',
      errPhone: 'Please enter a valid 11-digit Egyptian phone number starting with (010, 011, 012, 015)',
      errEmail: 'Please enter a valid email address (e.g., example@gmail.com)',
      errPassword: 'Password is too weak. Add numbers, symbols, and letters',
      alertSuccessTitle: 'Success 🎉',
      alertSuccessMsg: 'Your national account has been created successfully!',
      alertOk: 'Proceed to App',
      weak: 'Weak',
      medium: 'Medium',
      strong: 'Strong',
    },
  }[lang];

  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: '', color: '#E2E8F0' };
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;

    if (score <= 2) return { score: 1, label: t.weak, color: '#DC2626' };
    if (score === 3) return { score: 2, label: t.medium, color: '#D97706' };
    return { score: 3, label: t.strong, color: '#2563EB' };
  };

  const passwordStrength = getPasswordStrength(password);

  const handleSignUp = async () => {
    let newErrors: { [key: string]: string } = {};

    const cleanNationalId = parseDigits(nationalId.trim());
    const cleanPhone = parseDigits(phone.trim());

    if (!fullName.trim() || !validateFullName(fullName)) {
      newErrors.fullName = t.errFullName;
    }
    if (!cleanNationalId || !/^\d{14}$/.test(cleanNationalId)) {
      newErrors.nationalId = t.errNationalId;
    }
    if (!cleanPhone || !validateEgyptianPhone(cleanPhone)) {
      newErrors.phone = t.errPhone;
    }
    if (!email.trim() || !validateEmail(email)) {
      newErrors.email = t.errEmail;
    }
    if (!password || password.length < 6) {
      newErrors.password = t.errPassword;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            full_name: fullName.trim(),
            national_id: cleanNationalId,
            phone: cleanPhone,
          },
        },
      });

      if (error) {
        Alert.alert(lang === 'ar' ? 'خطأ في التسجيل' : 'Registration Error', error.message);
        setLoading(false);
        return;
      }

      setLoading(false);

      Alert.alert(t.alertSuccessTitle, t.alertSuccessMsg, [
        { text: t.alertOk, onPress: () => router.replace('/(tabs)') },
      ]);
    } catch (err: unknown) {
      setLoading(false);
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      Alert.alert(lang === 'ar' ? 'خطأ' : 'Error', message);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F1F5F9' }}>
      <ScrollView
        contentContainerStyle={{
          padding: 24,
          paddingTop: 36,
          paddingBottom: 40,
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100%',
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ width: '100%', maxWidth: 480, alignSelf: 'center' }}>
          {/* زر تحويل اللغة */}
          <View style={{ marginBottom: 16, flexDirection: 'row', justifyContent: 'flex-end' }}>
          <TouchableOpacity
            onPress={() => {
              setLang(lang === 'ar' ? 'en' : 'ar');
              setErrors({});
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

        {/* الكارت الرئيسي */}
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 24,
            padding: 24,
            shadowColor: '#0F172A',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.08,
            shadowRadius: 20,
            elevation: 5,
            borderWidth: 1,
            borderColor: '#E2E8F0',
          }}
        >
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#0F172A', marginBottom: 4, textAlign: t.textAlign }}>
            {t.title}
          </Text>
          <Text style={{ fontSize: 13, color: '#64748B', marginBottom: 20, textAlign: t.textAlign, lineHeight: 20 }}>
            {t.subtitle}
          </Text>

          {/* الاسم الكامل */}
          <View style={{ marginBottom: 14 }}>
            <Text style={{ fontSize: 12.5, fontWeight: '700', marginBottom: 6, textAlign: t.textAlign, color: '#334155' }}>
              {t.fullNameLabel}
            </Text>
            <TextInput
              placeholder={t.fullNamePlaceholder}
              value={fullName}
              maxLength={50}
              onChangeText={(val) => {
                const filtered = val.replace(/[^a-zA-Z\u0600-\u06FF\s]/g, '');
                setFullName(filtered);
                setErrors((prev) => ({ ...prev, fullName: '' }));
              }}
              placeholderTextColor="#94A3B8"
              style={{
                backgroundColor: '#F8FAFC',
                borderWidth: 1.5,
                borderColor: errors.fullName ? '#DC2626' : '#CBD5E1',
                borderRadius: 14,
                paddingVertical: 12,
                paddingHorizontal: 16,
                textAlign: t.textAlign,
                fontSize: 14,
                color: '#0F172A',
              }}
            />
            {errors.fullName ? <Text style={{ color: '#DC2626', fontSize: 11.5, marginTop: 4, textAlign: t.textAlign }}>⚠️ {errors.fullName}</Text> : null}
          </View>

          {/* الرقم القومي */}
          <View style={{ marginBottom: 14 }}>
            <Text style={{ fontSize: 12.5, fontWeight: '700', marginBottom: 6, textAlign: t.textAlign, color: '#334155' }}>
              {t.nationalIdLabel}
            </Text>
            <TextInput
              placeholder={t.nationalIdPlaceholder}
              value={nationalId}
              keyboardType="numeric"
              maxLength={14}
              onChangeText={(val) => {
                const filtered = val.replace(/[^0-9٠-٩]/g, '');
                setNationalId(filtered);
                setErrors((prev) => ({ ...prev, nationalId: '' }));
              }}
              placeholderTextColor="#94A3B8"
              style={{
                backgroundColor: '#F8FAFC',
                borderWidth: 1.5,
                borderColor: errors.nationalId ? '#DC2626' : '#CBD5E1',
                borderRadius: 14,
                paddingVertical: 12,
                paddingHorizontal: 16,
                textAlign: t.textAlign,
                fontSize: 14,
                color: '#0F172A',
              }}
            />
            {errors.nationalId ? <Text style={{ color: '#DC2626', fontSize: 11.5, marginTop: 4, textAlign: t.textAlign }}>⚠️ {errors.nationalId}</Text> : null}
          </View>

          {/* رقم الموبايل */}
          <View style={{ marginBottom: 14 }}>
            <Text style={{ fontSize: 12.5, fontWeight: '700', marginBottom: 6, textAlign: t.textAlign, color: '#334155' }}>
              {t.phoneLabel}
            </Text>
            <TextInput
              placeholder={t.phonePlaceholder}
              value={phone}
              keyboardType="phone-pad"
              maxLength={11}
              onChangeText={(val) => {
                const filtered = val.replace(/[^0-9٠-٩]/g, '');
                setPhone(filtered);
                setErrors((prev) => ({ ...prev, phone: '' }));
              }}
              placeholderTextColor="#94A3B8"
              style={{
                backgroundColor: '#F8FAFC',
                borderWidth: 1.5,
                borderColor: errors.phone ? '#DC2626' : '#CBD5E1',
                borderRadius: 14,
                paddingVertical: 12,
                paddingHorizontal: 16,
                textAlign: t.textAlign,
                fontSize: 14,
                color: '#0F172A',
              }}
            />
            {errors.phone ? <Text style={{ color: '#DC2626', fontSize: 11.5, marginTop: 4, textAlign: t.textAlign }}>⚠️ {errors.phone}</Text> : null}
          </View>

          {/* البريد الإلكتروني */}
          <View style={{ marginBottom: 14 }}>
            <Text style={{ fontSize: 12.5, fontWeight: '700', marginBottom: 6, textAlign: t.textAlign, color: '#334155' }}>
              {t.emailLabel}
            </Text>
            <TextInput
              placeholder={t.emailPlaceholder}
              value={email}
              keyboardType="email-address"
              autoCapitalize="none"
              onChangeText={(val) => {
                setEmail(val);
                setErrors((prev) => ({ ...prev, email: '' }));
              }}
              placeholderTextColor="#94A3B8"
              style={{
                backgroundColor: '#F8FAFC',
                borderWidth: 1.5,
                borderColor: errors.email ? '#DC2626' : '#CBD5E1',
                borderRadius: 14,
                paddingVertical: 12,
                paddingHorizontal: 16,
                textAlign: t.textAlign,
                fontSize: 14,
                color: '#0F172A',
              }}
            />
            {errors.email ? <Text style={{ color: '#DC2626', fontSize: 11.5, marginTop: 4, textAlign: t.textAlign }}>⚠️ {errors.email}</Text> : null}
          </View>

          {/* كلمة المرور */}
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 12.5, fontWeight: '700', marginBottom: 6, textAlign: t.textAlign, color: '#334155' }}>
              {t.passwordLabel}
            </Text>
            <TextInput
              placeholder={t.passwordPlaceholder}
              value={password}
              secureTextEntry
              onChangeText={(val) => {
                setPassword(val);
                setErrors((prev) => ({ ...prev, password: '' }));
              }}
              placeholderTextColor="#94A3B8"
              style={{
                backgroundColor: '#F8FAFC',
                borderWidth: 1.5,
                borderColor: errors.password ? '#DC2626' : '#CBD5E1',
                borderRadius: 14,
                paddingVertical: 12,
                paddingHorizontal: 16,
                textAlign: t.textAlign,
                fontSize: 14,
                color: '#0F172A',
              }}
            />

            {password ? (
              <View style={{ marginTop: 8 }}>
                <View style={{ flexDirection: 'row', height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: '#E2E8F0' }}>
                  <View style={{ flex: 1, backgroundColor: passwordStrength.score >= 1 ? passwordStrength.color : '#E2E8F0', marginRight: 2 }} />
                  <View style={{ flex: 1, backgroundColor: passwordStrength.score >= 2 ? passwordStrength.color : '#E2E8F0', marginRight: 2 }} />
                  <View style={{ flex: 1, backgroundColor: passwordStrength.score >= 3 ? passwordStrength.color : '#E2E8F0' }} />
                </View>
                <Text style={{ color: passwordStrength.color, fontSize: 11.5, fontWeight: '700', marginTop: 4, textAlign: t.textAlign }}>
                  قوة كلمة المرور: {passwordStrength.label}
                </Text>
              </View>
            ) : null}

            {errors.password ? <Text style={{ color: '#DC2626', fontSize: 11.5, marginTop: 4, textAlign: t.textAlign }}>⚠️ {errors.password}</Text> : null}
          </View>

          {/* زر إنشاء الحساب */}
          <TouchableOpacity
            onPress={handleSignUp}
            disabled={loading}
            activeOpacity={0.8}
            style={{
              backgroundColor: loading ? '#60A5FA' : '#1E3A8A',
              paddingVertical: 16,
              borderRadius: 14,
              alignItems: 'center',
              marginBottom: 16,
              shadowColor: '#1E3A8A',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: loading ? 0.1 : 0.3,
              shadowRadius: 8,
              elevation: loading ? 1 : 4,
            }}
          >
            {loading ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color="#FFFFFF" size="small" style={{ marginHorizontal: 8 }} />
                <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>
                  {t.loadingBtn}
                </Text>
              </View>
            ) : (
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>
                {t.signUpBtn}
              </Text>
            )}
          </TouchableOpacity>

          {/* رابط تسجيل الدخول */}
          <TouchableOpacity onPress={() => router.push('/auth/login')}>
            <Text style={{ textAlign: 'center', color: '#2563EB', fontWeight: '700', fontSize: 13.5, marginTop: 4 }}>
              {t.loginLink}
            </Text>
          </TouchableOpacity>

          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}