import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('تنبيه', 'يرجى إدخال البريد الإلكتروني وكلمة المرور');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password,
    });

    setLoading(false);

    if (error) {
      Alert.alert('خطأ في الدخول', 'البريد الإلكتروني أو كلمة المرور غير صحيحة');
      return;
    }

    Alert.alert('مرحباً بك', 'تم تسجيل الدخول بنجاح!', [
      { text: 'موافق', onPress: () => router.replace('/(tabs)') },
    ]);
  }

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#F6FAF8' }}>
      <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#111827', marginBottom: 8, textAlign: 'right' }}>
        تسجيل الدخول
      </Text>
      <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 32, textAlign: 'right' }}>
        أدخل بياناتك للمتابعة إلى حسابك
      </Text>

      {/* البريد الإلكتروني */}
      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 8, textAlign: 'right' }}>البريد الإلكتروني</Text>
        <TextInput
          placeholder="example@domain.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          style={{
            backgroundColor: '#FFFFFF',
            borderWidth: 1,
            borderColor: '#E5E7EB',
            borderRadius: 12,
            padding: 14,
            textAlign: 'right',
          }}
        />
      </View>

      {/* كلمة المرور */}
      <View style={{ marginBottom: 24 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 8, textAlign: 'right' }}>كلمة المرور</Text>
        <TextInput
          placeholder="••••••••"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={{
            backgroundColor: '#FFFFFF',
            borderWidth: 1,
            borderColor: '#E5E7EB',
            borderRadius: 12,
            padding: 14,
            textAlign: 'right',
          }}
        />
      </View>

      {/* زر تسجيل الدخول */}
      <TouchableOpacity
        onPress={handleLogin}
        disabled={loading}
        style={{
          backgroundColor: '#059669',
          padding: 16,
          borderRadius: 12,
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>تسجيل الدخول</Text>
        )}
      </TouchableOpacity>

      {/* رابط للتحويل لشاشة إنشاء حساب */}
      <TouchableOpacity onPress={() => router.push('/auth/sign-up')}>
        <Text style={{ textAlign: 'center', color: '#059669', fontWeight: '600' }}>
          ليس لديك حساب؟ إنشاء حساب جديد
        </Text>
      </TouchableOpacity>
    </View>
  );
}