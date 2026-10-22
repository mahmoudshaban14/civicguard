import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Camera, MapPin, Send, Sparkles, Navigation } from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useCivicGuard } from '@/lib/civicguard-store';

export default function ReportScreen() {
  const router = useRouter();
  const { reports } = useCivicGuard(); // استخدام الـ Store المحلي المضمون
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [locationCoords, setLocationCoords] = useState<{ latitude: number; longitude: number; address: string } | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      async function checkLanguage() {
        try {
          const savedLang = await AsyncStorage.getItem('@app_language');
          if (isMounted && (savedLang === 'en' || savedLang === 'ar')) {
            setLang(savedLang);
          }
        } catch (e) {
          console.error('Error loading language in ReportScreen:', e);
        }
      }
      checkLanguage();
      return () => {
        isMounted = false;
      };
    }, [])
  );

  const t = {
    ar: {
      title: 'تقديم بلاغ جديد 📝',
      subtitle: 'قم بتوثيق المشكلة لمساعدة الجهات المختصة في حلها بسرعة',
      demoFillBtn: 'تعبئة تجريبية سريعة',
      reportTitleLabel: 'عنوان البلاغ',
      reportTitlePlaceholder: 'مثال: حفرة رئيسية في شارع النصر',
      descLabel: 'تفاصيل وماذا يحدث؟',
      descPlaceholder: 'اشرح المشكلة بالتفصيل...',
      locationLabel: 'الموقع الجغرافي (من التليفون)',
      getLocationBtn: 'الحصول على موقعي الحالي عبر الـ GPS',
      locatingText: 'جاري تحديد موقعك الجغرافي...',
      locationSet: 'تم تحديد الموقع بنجاح ✅',
      uploadPhoto: 'إرفاق صورة البلاغ (إلزامي)',
      changePhoto: 'تغيير الصورة المرفقة',
      submitBtn: 'إرسال البلاغ الآن',
      textAlign: 'right' as const,
      flexDirection: 'row-reverse' as const,
      successMsg: 'تم إرسال بلاغك بنجاح وستراه الآن في سجل بلاغاتي.',
      errorTitle: 'حقول ناقصة مطلوبة!',
      errorMsg: 'عذراً، لا يمكن الإرسال. تأكد من إدخال العنوان، التفاصيل، الحصول على موقعك الجغرافي من الموبايل، وإرفاق صورة المشكلة.',
    },
    en: {
      title: 'Submit New Report 📝',
      subtitle: 'Document the issue to help authorities resolve it quickly',
      demoFillBtn: 'Quick Demo Auto-Fill',
      reportTitleLabel: 'Report Title',
      reportTitlePlaceholder: 'e.g., Pothole on Al-Nasr street',
      descLabel: 'What is happening?',
      descPlaceholder: 'Describe the issue in detail...',
      locationLabel: 'Geographic Location (From Device)',
      getLocationBtn: 'Get My Current GPS Location',
      locatingText: 'Fetching your location...',
      locationSet: 'Location acquired successfully ✅',
      uploadPhoto: 'Attach Report Photo (Mandatory)',
      changePhoto: 'Change Attached Photo',
      submitBtn: 'Submit Report Now',
      textAlign: 'left' as const,
      flexDirection: 'row' as const,
      successMsg: 'Your report has been submitted successfully and is now visible in My Reports.',
      errorTitle: 'Missing Required Fields!',
      errorMsg: 'Cannot submit. Please make sure title, description, GPS location, and photo are all provided.',
    },
  }[lang];

  // جلب الموقع الجغرافي من الـ GPS
  const handleGetLocation = async () => {
    try {
      setLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(lang === 'ar' ? 'خطأ في الإذن' : 'Permission Denied', lang === 'ar' ? 'يجب السماح بالتطبيق بالوصول للموقع الجغرافي.' : 'Location permission is required.');
        setLocating(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = location.coords;

      let addressText = `Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`;
      try {
        const reverseGeocode = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (reverseGeocode && reverseGeocode.length > 0) {
          const place = reverseGeocode[0];
          addressText = `${place.street || ''} ${place.city || place.subregion || ''}, ${place.country || ''}`.trim();
        }
      } catch (geoErr) {
        console.log('Reverse geocoding failed:', geoErr);
      }

      setLocationCoords({ latitude, longitude, address: addressText });
      setLocating(false);
    } catch (error) {
      setLocating(false);
      console.error(error);
      Alert.alert(lang === 'ar' ? 'خطأ' : 'Error', lang === 'ar' ? 'فشل جلب الموقع، تأكد من تفعيل الـ GPS.' : 'Failed to fetch location.');
    }
  };

  // اختيار صورة من المعرض
  const handlePickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Gallery permission is required.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Image picker error:', error);
    }
  };

  // تعبئة سريعة للتجربة
  const handleDemoFill = () => {
    setTitle(lang === 'ar' ? 'تكدس مياه الأمطار الشديد' : 'Severe Rainwater Accumulation');
    setDescription(lang === 'ar' ? 'تجمع كميات كبيرة من المياه تعيق حركة المرور بالكامل.' : 'Large water accumulation blocking traffic entirely.');
    setLocationCoords({
      latitude: 30.0444,
      longitude: 31.2357,
      address: lang === 'ar' ? 'القاهرة، وسط البلد' : 'Cairo, Downtown',
    });
    setImageUri('https://images.unsplash.com/photo-1515260268569-9271009adfdb?auto=format&fit=crop&q=80&w=600');
    setCategory(lang === 'ar' ? 'طرق ومواصلات' : 'Infrastructure');
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim() || !locationCoords || !imageUri) {
      Alert.alert(t.errorTitle, t.errorMsg);
      return;
    }

    setLoading(true);
    
    // محاكاة حفظ ناجحة وفورية تظهر في صفحة "بلاغاتي" وتنتقل إليها
    setTimeout(() => {
      const newReportItem = {
        id: `CG-2026-${Math.floor(10000 + Math.random() * 90000)}`,
        category: category || (lang === 'ar' ? 'بنية تحتية' : 'Infrastructure'),
        severity: 'High' as const,
        confidence: 0.95,
        status: 'In Progress' as const,
        department: 'Road Maintenance',
        area: locationCoords.address,
        latitude: locationCoords.latitude,
        longitude: locationCoords.longitude,
        distance: '0m',
        date: 'Just now',
        description: description.trim(),
        imageUri: imageUri,
      };

      // إضافته للـ Array الحالية في الـ Store (أو تمريره عبر الـ Router params)
      reports.unshift(newReportItem);

      setLoading(false);
      Alert.alert(lang === 'ar' ? 'تم بنجاح 🎉' : 'Success 🎉', t.successMsg, [
        { text: 'OK', onPress: () => router.replace('/(tabs)/reports' as any) },
      ]);
    }, 600);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        
        <View style={{ flexDirection: t.flexDirection, justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#0F172A', textAlign: t.textAlign, flex: 1 }}>
            {t.title}
          </Text>
          <TouchableOpacity
            onPress={handleDemoFill}
            style={{
              backgroundColor: '#EFF6FF',
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              borderWidth: 1,
              borderColor: '#BFDBFE',
            }}
          >
            <Sparkles size={14} color="#1E3A8A" />
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#1E3A8A' }}>
              {t.demoFillBtn}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={{ fontSize: 13, color: '#64748B', marginBottom: 20, textAlign: t.textAlign }}>
          {t.subtitle}
        </Text>

        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#E2E8F0', elevation: 2 }}>
          
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6, textAlign: t.textAlign }}>
              {t.reportTitleLabel}
            </Text>
            <TextInput
              placeholder={t.reportTitlePlaceholder}
              value={title}
              onChangeText={setTitle}
              placeholderTextColor="#94A3B8"
              style={{ backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#CBD5E1', borderRadius: 12, padding: 12, textAlign: t.textAlign, color: '#0F172A' }}
            />
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6, textAlign: t.textAlign }}>
              {t.descLabel}
            </Text>
            <TextInput
              placeholder={t.descPlaceholder}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              placeholderTextColor="#94A3B8"
              style={{ backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#CBD5E1', borderRadius: 12, padding: 12, textAlign: t.textAlign, height: 100, color: '#0F172A' }}
            />
          </View>

          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6, textAlign: t.textAlign }}>
              {t.locationLabel}
            </Text>

            {locationCoords ? (
              <View style={{ backgroundColor: '#F0FDF4', borderWidth: 1.5, borderColor: '#86EFAC', borderRadius: 12, padding: 14, flexDirection: t.flexDirection, alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: t.flexDirection, alignItems: 'center', gap: 8, flex: 1 }}>
                  <MapPin size={20} color="#16A34A" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#166534', textAlign: t.textAlign }}>{t.locationSet}</Text>
                    <Text style={{ fontSize: 11, color: '#4ADE80', textAlign: t.textAlign }} numberOfLines={1}>{locationCoords.address}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={handleGetLocation}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#1E3A8A', textDecorationLine: 'underline' }}>
                    {lang === 'ar' ? 'تحديث' : 'Update'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={handleGetLocation}
                disabled={locating}
                style={{
                  backgroundColor: '#EFF6FF',
                  borderWidth: 1.5,
                  borderColor: '#93C5FD',
                  borderRadius: 12,
                  padding: 14,
                  flexDirection: t.flexDirection,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {locating ? <ActivityIndicator size="small" color="#1E3A8A" /> : <Navigation size={18} color="#1E3A8A" />}
                <Text style={{ color: '#1E3A8A', fontWeight: '700', fontSize: 13 }}>
                  {locating ? t.locatingText : t.getLocationBtn}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6, textAlign: t.textAlign }}>
              {t.uploadPhoto}
            </Text>

            {imageUri ? (
              <View style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', borderWidth: 1.5, borderColor: '#CBD5E1' }}>
                <Image source={{ uri: imageUri }} style={{ width: '100%', height: 160 }} />
                <TouchableOpacity
                  onPress={handlePickImage}
                  style={{
                    position: 'absolute',
                    bottom: 10,
                    right: 10,
                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                  }}
                >
                  <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>{t.changePhoto}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={handlePickImage}
                style={{
                  flexDirection: t.flexDirection,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#F1F5F9',
                  borderWidth: 1.5,
                  borderColor: '#CBD5E1',
                  borderStyle: 'dashed',
                  borderRadius: 12,
                  padding: 20,
                }}
              >
                <Camera size={24} color="#475569" style={{ [lang === 'ar' ? 'marginLeft' : 'marginRight']: 8 }} />
                <Text style={{ color: '#475569', fontWeight: '700', fontSize: 13 }}>
                  {t.uploadPhoto}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading}
            style={{ backgroundColor: '#1E3A8A', borderRadius: 14, paddingVertical: 15, flexDirection: t.flexDirection, alignItems: 'center', justifyContent: 'center', elevation: 3 }}
          >
            {loading ? <ActivityIndicator color="#FFF" /> : (
              <>
                <Send size={18} color="#FFF" style={{ [lang === 'ar' ? 'marginLeft' : 'marginRight']: 8 }} />
                <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>{t.submitBtn}</Text>
              </>
            )}
          </TouchableOpacity>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}