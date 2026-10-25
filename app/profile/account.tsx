import { useState, useEffect } from 'react';
import { View, TextInput, Alert, ScrollView } from 'react-native';
import { Button, Typography } from 'heroui-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Screen } from '@/components/civic/Screen';
import { AppHeader } from '@/components/civic/AppHeader';
import { supabase } from '@/lib/supabase';
import { User, Mail, Phone, Save } from 'lucide-react-native';

export default function AccountScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState<'ar' | 'en'>('ar');

  useEffect(() => {
    async function getUserData() {
      // جلب اللغة المحفوظة
      try {
        const savedLang = await AsyncStorage.getItem('@app_language');
        if (savedLang === 'en' || savedLang === 'ar') {
          setLang(savedLang);
        }
      } catch (e) {
        console.error('Error loading language', e);
      }

      // جلب بيانات المستخدم من Supabase
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setEmail(user.email || '');
        setFullName(user.user_metadata?.full_name || user.email?.split('@')[0] || '');
        setPhone(user.user_metadata?.phone || '');
      }
    }
    getUserData();
  }, []);

  const handleUpdateProfile = async () => {
    if (!fullName.trim()) {
      Alert.alert(
        lang === 'ar' ? 'تنبيه' : 'Notice',
        lang === 'ar' ? 'يرجى إدخال الاسم الكامل' : 'Please enter your full name'
      );
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({
      data: { full_name: fullName.trim(), phone: phone.trim() },
    });

    setLoading(false);
    if (error) {
      Alert.alert(
        lang === 'ar' ? 'خطأ' : 'Error',
        (lang === 'ar' ? 'حدث خطأ أثناء تحديث البيانات: ' : 'Error updating profile: ') + error.message
      );
    } else {
      Alert.alert(
        lang === 'ar' ? 'تم بنجاح' : 'Success',
        lang === 'ar' ? 'تم حفظ بيانات الحساب بنجاح!' : 'Account updated successfully!',
        [{ text: lang === 'ar' ? 'موافق' : 'OK', onPress: () => router.back() }]
      );
    }
  };

  const isAr = lang === 'ar';

  return (
    <Screen>
      <AppHeader title={isAr ? 'إعدادات الحساب' : 'Account Settings'} showBack />
      <ScrollView showsVerticalScrollIndicator={false} className="px-1">
        
        {/* هيدر الصفحة */}
        <View className="mb-6 mt-2">
          <Typography.Heading type="h3" className={`text-civic-deep ${isAr ? 'text-right' : 'text-left'}`}>
            {isAr ? 'تعديل البيانات الشخصية' : 'Edit Personal Profile'}
          </Typography.Heading>
          <Typography.Paragraph className={`text-gray-500 mt-1 text-sm ${isAr ? 'text-right' : 'text-left'}`}>
            {isAr ? 'يمكنك مراجعة وتحديث بياناتك المسجلة في المنظومة' : 'Review and update your registered account details'}
          </Typography.Paragraph>
        </View>

        {/* حقول إدخال البيانات */}
        <View className="space-y-4">
          
          {/* الاسم الكامل */}
          <View>
            <Typography.Paragraph className={`mb-1.5 font-medium text-gray-700 ${isAr ? 'text-right' : 'text-left'}`}>
              {isAr ? 'الاسم بالكامل' : 'Full Name'}
            </Typography.Paragraph>
            <View className={`flex-row items-center border border-gray-300 bg-white rounded-2xl px-4 py-3 shadow-sm ${isAr ? '' : 'flex-row-reverse'}`}>
              <User size={20} color="#167A62" />
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder={isAr ? 'مثال: يوسف تامر' : 'e.g., Youssef Tamer'}
                placeholderTextColor="#A0AEC0"
                className={`flex-1 text-base text-gray-800 ${isAr ? 'text-right ml-2' : 'text-left mr-2'}`}
              />
            </View>
          </View>

          {/* البريد الإلكتروني (غير قابل للتعديل) */}
          <View className="mt-4">
            <Typography.Paragraph className={`mb-1.5 font-medium text-gray-700 ${isAr ? 'text-right' : 'text-left'}`}>
              {isAr ? 'البريد الإلكتروني' : 'Email Address'}
            </Typography.Paragraph>
            <View className={`flex-row items-center border border-gray-200 bg-gray-100 rounded-2xl px-4 py-3 ${isAr ? '' : 'flex-row-reverse'}`}>
              <Mail size={20} color="#8A9894" />
              <TextInput
                value={email}
                editable={false}
                placeholder="email@example.com"
                className={`flex-1 text-base text-gray-500 ${isAr ? 'text-right ml-2' : 'text-left mr-2'}`}
              />
            </View>
          </View>

          {/* رقم الهاتف */}
          <View className="mt-4">
            <Typography.Paragraph className={`mb-1.5 font-medium text-gray-700 ${isAr ? 'text-right' : 'text-left'}`}>
              {isAr ? 'رقم الهاتف' : 'Phone Number'}
            </Typography.Paragraph>
            <View className={`flex-row items-center border border-gray-300 bg-white rounded-2xl px-4 py-3 shadow-sm ${isAr ? '' : 'flex-row-reverse'}`}>
              <Phone size={20} color="#167A62" />
              <TextInput
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder={isAr ? 'مثال: 01012345678' : 'e.g., 01012345678'}
                placeholderTextColor="#A0AEC0"
                className={`flex-1 text-base text-gray-800 ${isAr ? 'text-right ml-2' : 'text-left mr-2'}`}
              />
            </View>
          </View>

        </View>

        {/* أزرار الحفظ والإلغاء */}
        <View className="mt-8 mb-6 space-y-3">
          <Button
            className="bg-civic-deep rounded-2xl py-3.5 flex-row justify-center items-center"
            onPress={handleUpdateProfile}
            isDisabled={loading}
          >
            <Save size={20} color="#FFF" />
            <Button.Label className="text-white text-base font-bold ml-2">
              {loading ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ التغيرات' : 'Save Changes')}
            </Button.Label>
          </Button>

          <Button
            variant="ghost"
            className="mt-2 rounded-2xl py-3 flex-row justify-center items-center"
            onPress={() => router.back()}
          >
            <Button.Label className="text-gray-600 font-medium">
              {isAr ? 'إلغاء' : 'Cancel'}
            </Button.Label>
          </Button>
        </View>

      </ScrollView>
    </Screen>
  );
}