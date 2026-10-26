import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [step, setStep] = useState<'request' | 'otp' | 'new_password'>('request');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [lang, setLang] = useState<'ar' | 'en'>('ar');

  const t = {
    ar: {
      titleRequest: 'استعادة كلمة المرور 🔐',
      subtitleRequest: 'أدخل البريد الإلكتروني، الرقم القومي، أو رقم الموبايل المرتبط بحسابك لاستعادة الحساب.',
      titleOtp: 'أدخل كود التحقق (OTP) 📱',
      subtitleOtp: 'تم إرسال كود مكون من 6 أرقام لرقم هاتف الحساب المسجل.',
      titleNewPass: 'تعيين كلمة مرور جديدة 🔑',
      subtitleNewPass: 'أدخل كلمة المرور الجديدة المكونة من 6 أحرف أو أكثر لتأمين حسابك.',
      
      labelIdentifier: 'البريد / الرقم القومي / الموبايل',
      placeholderIdentifier: 'إيميل، رقم قومي 14 رقم، أو موبايل',
      submitBtnRequest: 'إرسال كود الاستعادة',
      
      labelOtp: 'كود التحقق (OTP)',
      placeholderOtp: '• • • • • •',
      verifyBtnOtp: 'تأكيد الكود ومتابعة',
      
      labelNewPass: 'كلمة المرور الجديدة',
      labelConfirmPass: 'تأكيد كلمة المرور الجديدة',
      placeholderPass: '••••••••',
      savePassBtn: 'حفظ وتغيير كلمة المرور',

      backToLogin: 'العودة لتسجيل الدخول',
      switchLangText: 'English 🌐',
      textAlign: 'right' as const,
      
      errRequired: 'يرجى إدخال البريد الإلكتروني، الرقم القومي، أو رقم الهاتف',
      errOtp: 'يرجى إدخال كود التحقق المكون من 6 أرقام',
      errPassMatch: 'كلمتا المرور غير متطابقتين',
      errPassLength: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
      
      successEmail: 'تم إرسال رابط وإرشادات إعادة تعيين كلمة المرور إلى بريدك الإلكتروني المسجل بنجاح.',
      successSMS: 'تم إرسال كود التحقق (OTP) في رسالة نصية إلى رقم الموبايل المرتبط بحسابك.',
      successPassChanged: 'تم تغيير كلمة المرور بنجاح! جاري تحويلك لشاشة تسجيل الدخول...',
      
      weak: 'ضعيفة',
      medium: 'متوسطة',
      strong: 'قوية جداً',
    },
    en: {
      titleRequest: 'Reset Password 🔐',
      subtitleRequest: 'Enter your registered Email, National ID, or Mobile number to recover your account.',
      titleOtp: 'Enter Verification Code (OTP) 📱',
      subtitleOtp: 'A 6-digit code was sent to your registered mobile phone.',
      titleNewPass: 'Set New Password 🔑',
      subtitleNewPass: 'Enter a new password with at least 6 characters to secure your account.',
      
      labelIdentifier: 'Email / National ID / Mobile',
      placeholderIdentifier: 'Email, 14-digit ID, or Phone',
      submitBtnRequest: 'Send Recovery Code',
      
      labelOtp: 'Verification Code (OTP)',
      placeholderOtp: '• • • • • •',
      verifyBtnOtp: 'Verify Code & Proceed',
      
      labelNewPass: 'New Password',
      labelConfirmPass: 'Confirm New Password',
      placeholderPass: '••••••••',
      savePassBtn: 'Save & Update Password',

      backToLogin: 'Back to Login',
      switchLangText: 'عربي 🇪🇬',
      textAlign: 'left' as const,
      
      errRequired: 'Please enter Email, National ID, or Mobile number',
      errOtp: 'Please enter the 6-digit OTP code',
      errPassMatch: 'Passwords do not match',
      errPassLength: 'Password must be at least 6 characters',
      
      successEmail: 'Password reset link has been sent to your registered email successfully.',
      successSMS: 'Verification code (OTP) has been sent to your registered phone number.',
      successPassChanged: 'Password changed successfully! Redirecting to login...',
      
      weak: 'Weak',
      medium: 'Medium',
      strong: 'Strong',
    },
  }[lang];

  const parseDigits = (str: string) => {
    return str.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
  };

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

  const passwordStrength = getPasswordStrength(newPassword);

  // 1. طلب الاستعادة
  const handleResetRequest = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    const cleanInput = parseDigits(identifier.trim());

    if (!cleanInput) {
      setErrorMsg(t.errRequired);
      return;
    }

    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      if (cleanInput.includes('@')) {
        setSuccessMsg(t.successEmail);
      } else {
        setSuccessMsg(t.successSMS);
        setStep('otp');
      }
    }, 1000);
  };

  // 2. تأكيد كود OTP
  const handleVerifyOtp = async () => {
    setErrorMsg('');
    if (!otpCode.trim() || otpCode.trim().length < 6) {
      setErrorMsg(t.errOtp);
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSuccessMsg('');
      setStep('new_password'); // الانتقال لخطوة إدخال الباسورد الجديد
    }, 800);
  };

  // 3. حفظ كلمة المرور الجديدة
  const handleSaveNewPassword = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (!newPassword || newPassword.length < 6) {
      setErrorMsg(t.errPassLength);
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg(t.errPassMatch);
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSuccessMsg(t.successPassChanged);
      setTimeout(() => {
        router.replace('/auth/login' as any);
      }, 1500);
    }, 1000);
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
        <View style={{ width: '100%', maxWidth: 460, alignSelf: 'center' }}>
          {/* زر تحويل اللغة */}
          <View style={{ marginBottom: 16, flexDirection: 'row', justifyContent: 'flex-end' }}>
          <TouchableOpacity
            onPress={() => {
              setLang(lang === 'ar' ? 'en' : 'ar');
              setErrorMsg('');
              setSuccessMsg('');
            }}
            activeOpacity={0.8}
            style={{
              backgroundColor: '#FFFFFF',
              paddingVertical: 8,
              paddingHorizontal: 16,
              borderRadius: 24,
              borderWidth: 1.5,
              borderColor: '#1E293B',
              elevation: 2,
            }}
          >
            <Text style={{ color: '#1E293B', fontWeight: '800', fontSize: 13 }}>
              {t.switchLangText}
            </Text>
          </TouchableOpacity>
        </View>

        {/* الكارت الرئيسي المطابق لتصميم باقي صفحات الـ Auth */}
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
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#0F172A', marginBottom: 6, textAlign: t.textAlign }}>
            {step === 'request' ? t.titleRequest : step === 'otp' ? t.titleOtp : t.titleNewPass}
          </Text>
          <Text style={{ fontSize: 13, color: '#64748B', marginBottom: 20, textAlign: t.textAlign, lineHeight: 20 }}>
            {step === 'request' ? t.subtitleRequest : step === 'otp' ? t.subtitleOtp : t.subtitleNewPass}
          </Text>

          {/* تنبيه الخطأ */}
          {errorMsg ? (
            <View style={{ backgroundColor: '#FEF2F2', padding: 12, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#FCA5A5' }}>
              <Text style={{ color: '#DC2626', fontSize: 12.5, fontWeight: '600', textAlign: t.textAlign }}>
                ⚠️ {errorMsg}
              </Text>
            </View>
          ) : null}

          {/* تنبيه النجاح */}
          {successMsg ? (
            <View style={{ backgroundColor: '#ECFDF5', padding: 14, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#A7F3D0' }}>
              <Text style={{ color: '#065F46', fontSize: 13, fontWeight: '700', textAlign: t.textAlign, lineHeight: 20 }}>
                ✅ {successMsg}
              </Text>
            </View>
          ) : null}

          {/* الخطوة 1: طلب الكود / الرابط */}
          {step === 'request' && (
            <>
              <View style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', marginBottom: 8, textAlign: t.textAlign, color: '#334155' }}>
                  {t.labelIdentifier}
                </Text>
                <TextInput
                  placeholder={t.placeholderIdentifier}
                  value={identifier}
                  onChangeText={(val) => {
                    setIdentifier(val);
                    setErrorMsg('');
                  }}
                  autoCapitalize="none"
                  placeholderTextColor="#94A3B8"
                  style={{
                    backgroundColor: '#F8FAFC',
                    borderWidth: 1.5,
                    borderColor: errorMsg ? '#DC2626' : '#CBD5E1',
                    borderRadius: 14,
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    textAlign: t.textAlign,
                    fontSize: 14.5,
                    color: '#0F172A',
                    fontWeight: '500',
                  }}
                />
              </View>

              <TouchableOpacity
                onPress={handleResetRequest}
                disabled={loading}
                activeOpacity={0.8}
                style={{
                  backgroundColor: '#1E3A8A',
                  paddingVertical: 16,
                  borderRadius: 14,
                  alignItems: 'center',
                  marginBottom: 16,
                  elevation: 4,
                }}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>
                    {t.submitBtnRequest}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* الخطوة 2: إدخال كود OTP */}
          {step === 'otp' && (
            <>
              <View style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', marginBottom: 8, textAlign: t.textAlign, color: '#334155' }}>
                  {t.labelOtp}
                </Text>
                <TextInput
                  placeholder={t.placeholderOtp}
                  value={otpCode}
                  keyboardType="numeric"
                  maxLength={6}
                  onChangeText={(val) => {
                    const filtered = parseDigits(val);
                    setOtpCode(filtered);
                    setErrorMsg('');
                  }}
                  style={{
                    backgroundColor: '#F8FAFC',
                    borderWidth: 1.5,
                    borderColor: errorMsg ? '#DC2626' : '#CBD5E1',
                    borderRadius: 14,
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    textAlign: 'center',
                    fontSize: 20,
                    letterSpacing: 6,
                    fontWeight: '800',
                    color: '#0F172A',
                  }}
                />
              </View>

              <TouchableOpacity
                onPress={handleVerifyOtp}
                disabled={loading}
                activeOpacity={0.8}
                style={{
                  backgroundColor: '#1E3A8A',
                  paddingVertical: 16,
                  borderRadius: 14,
                  alignItems: 'center',
                  marginBottom: 16,
                  elevation: 4,
                }}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>
                    {t.verifyBtnOtp}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* الخطوة 3: كتابة الباسورد الجديد وتاكيده */}
          {step === 'new_password' && (
            <>
              <View style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', marginBottom: 8, textAlign: t.textAlign, color: '#334155' }}>
                  {t.labelNewPass}
                </Text>
                <TextInput
                  placeholder={t.placeholderPass}
                  value={newPassword}
                  secureTextEntry
                  onChangeText={(val) => {
                    setNewPassword(val);
                    setErrorMsg('');
                  }}
                  placeholderTextColor="#94A3B8"
                  style={{
                    backgroundColor: '#F8FAFC',
                    borderWidth: 1.5,
                    borderColor: errorMsg ? '#DC2626' : '#CBD5E1',
                    borderRadius: 14,
                    paddingVertical: 13,
                    paddingHorizontal: 16,
                    textAlign: t.textAlign,
                    fontSize: 14.5,
                    color: '#0F172A',
                  }}
                />

                {/* مؤشر قوة الباسورد الجديد */}
                {newPassword ? (
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
              </View>

              <View style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', marginBottom: 8, textAlign: t.textAlign, color: '#334155' }}>
                  {t.labelConfirmPass}
                </Text>
                <TextInput
                  placeholder={t.placeholderPass}
                  value={confirmPassword}
                  secureTextEntry
                  onChangeText={(val) => {
                    setConfirmPassword(val);
                    setErrorMsg('');
                  }}
                  placeholderTextColor="#94A3B8"
                  style={{
                    backgroundColor: '#F8FAFC',
                    borderWidth: 1.5,
                    borderColor: errorMsg ? '#DC2626' : '#CBD5E1',
                    borderRadius: 14,
                    paddingVertical: 13,
                    paddingHorizontal: 16,
                    textAlign: t.textAlign,
                    fontSize: 14.5,
                    color: '#0F172A',
                  }}
                />
              </View>

              <TouchableOpacity
                onPress={handleSaveNewPassword}
                disabled={loading}
                activeOpacity={0.8}
                style={{
                  backgroundColor: '#1E3A8A',
                  paddingVertical: 16,
                  borderRadius: 14,
                  alignItems: 'center',
                  marginBottom: 16,
                  elevation: 4,
                }}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>
                    {t.savePassBtn}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* زر العودة لتسجيل الدخول */}
          <TouchableOpacity onPress={() => router.push('/auth/login' as any)}>
            <Text style={{ textAlign: 'center', color: '#2563EB', fontWeight: '700', fontSize: 13.5, marginTop: 4 }}>
              {t.backToLogin}
            </Text>
          </TouchableOpacity>

          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}