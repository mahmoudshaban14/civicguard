import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function SignUpScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignUp() {
    if (!email || !password || !fullName) {
      Alert.alert('تنبيه', 'يرجى إدخال جميع البيانات المطلوبة');
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: password,
      options: {
        data: {
          full_name: fullName.trim(),
        },
      },
    });

    if (error) {
      Alert.alert('خطأ في التسجيل', error.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').insert([
        {
          id: data.user.id,
          full_name: fullName.trim(),
          role: 'citizen',
        },
      ]);

      if (profileError) {
        console.log('Profile Sync Error:', profileError.message);
      }
    }

    setLoading(false);
    Alert.alert('تم بنجاح', 'تم إنشاء الحساب بنجاح!', [
      { text: 'موافق', onPress: () => router.replace('/(tabs)') },
    ]);
  }

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#F6FAF8' }}>
      <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#111827', marginBottom: 8, textAlign: 'right' }}>
        إنشاء حساب جديد
      </Text>
      <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 32, textAlign: 'right' }}>
        قم بإنشاء حسابك للإبلاغ عن المشاكل وتتبعها
      </Text>

      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 8, textAlign: 'right' }}>الاسم الكامل</Text>
        <TextInput
          placeholder="أدخل اسمك الكامل"
          value={fullName}
          onChangeText={setFullName}
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

      <TouchableOpacity
        onPress={handleSignUp}
        disabled={loading}
        style={{
          backgroundColor: '#059669',
          padding: 16,
          borderRadius: 12,
          alignItems: 'center',
        }}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>إنشاء الحساب</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}