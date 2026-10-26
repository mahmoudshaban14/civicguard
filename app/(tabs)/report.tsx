import React, { useState } from 'react';
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
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useCivicGuard } from '@/lib/civicguard-store';
import { useLanguage } from '@/lib/LanguageContext';

export default function ReportScreen() {
  const router = useRouter();
  const { updateDraft, analyzeDraft, submitDraft, fetchReports } = useCivicGuard(); // الربط الحقيقي بـ Supabase Store
  const { lang } = useLanguage();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [locationCoords, setLocationCoords] = useState<{ latitude: number; longitude: number; address: string } | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);

  const t = {
    ar: {
      title: 'تقديم بلاغ جديد',
      subtitle: 'قم بتوثيق المشكلة لمساعدة الجهات المختصة في حلها بسرعة',
      quickFillBtn: 'تعبئة سريعة للنموذج',
      reportTitleLabel: 'عنوان البلاغ',
      reportTitlePlaceholder: 'مثال: حفرة رئيسية في شارع النصر',
      descLabel: 'تفاصيل وماذا يحدث؟',
      descPlaceholder: 'اشرح المشكلة بالتفصيل...',
      locationLabel: 'الموقع الجغرافي (من التليفون)',
      getLocationBtn: 'الحصول على موقعي الحالي عبر الـ GPS',
      locatingText: 'جاري تحديد موقعك الجغرافي...',
      locationSet: 'تم تحديد الموقع بنجاح',
      uploadPhoto: 'إرفاق صورة البلاغ (إلزامي)',
      changePhoto: 'تغيير الصورة المرفقة',
      submitBtn: 'إرسال البلاغ للسيرفر الآن',
      successMsg: 'تم إرسال بلاغك وحفظه في داتابيز Supabase بنجاح وسيظهر في بلاغاتي.',
      errorTitle: 'حقول ناقصة مطلوبة!',
      errorMsg: 'عذراً، لا يمكن الإرسال. تأكد من إدخال العنوان، التفاصيل، الموقع الجغرافي، وإرفاق صورة المشكلة.',
    },
    en: {
      title: 'Submit New Report',
      subtitle: 'Document the issue to help authorities resolve it quickly',
      quickFillBtn: 'Quick Form Auto-Fill',
      reportTitleLabel: 'Report Title',
      reportTitlePlaceholder: 'e.g., Pothole on Al-Nasr street',
      descLabel: 'What is happening?',
      descPlaceholder: 'Describe the issue in detail...',
      locationLabel: 'Geographic Location (From Device)',
      getLocationBtn: 'Get My Current GPS Location',
      locatingText: 'Fetching your location...',
      locationSet: 'Location acquired successfully',
      uploadPhoto: 'Attach Report Photo (Mandatory)',
      changePhoto: 'Change Attached Photo',
      submitBtn: 'Submit Report to Server Now',
      successMsg: 'Your report has been successfully submitted and saved to Supabase.',
      errorTitle: 'Missing Required Fields!',
      errorMsg: 'Cannot submit. Please make sure title, description, GPS location, and photo are provided.',
    },
  }[lang];

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

  const handleQuickFill = () => {
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

    try {
      const draftData = {
        description: `${title.trim()} - ${description.trim()}`,
        latitude: locationCoords.latitude,
        longitude: locationCoords.longitude,
        area: locationCoords.address,
        imageUri: imageUri,
      };

      // 1. تحديث الـ Draft في الـ Store بالبيانات اللي كتبها اليوزر
      updateDraft(draftData);

      // 2. تحليل بالـ AI (اختياري لو متاح)
      await analyzeDraft();

      // 3. الإرسال الفعلي لـ Supabase Database و Storage
      const result = await submitDraft(draftData);

      setLoading(false);

      if (result) {
        setTitle('');
        setDescription('');
        setImageUri(null);
        setLocationCoords(null);
        setCategory('');

        try {
          await fetchReports();
        } catch (e) {
          console.error('Error refreshing reports after submit:', e);
        }

        router.replace('/(tabs)/reports' as any);
      } else {
        Alert.alert(lang === 'ar' ? 'خطأ في الحفظ' : 'Save Error', lang === 'ar' ? 'فشل حفظ البلاغ في السيرفر، تأكد من تسجيل الدخول.' : 'Failed to save report to server.');
      }
    } catch (err) {
      setLoading(false);
      console.error('Submit execution error:', err);
      Alert.alert('Error', 'An unexpected error occurred while submitting.');
    }
  };

  const isRTL = lang === 'ar';
  const textAlignStyle = isRTL ? 'right' : 'left';
  const flexDirectionStyle = isRTL ? 'row-reverse' : 'row';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        
        <View style={{ flexDirection: flexDirectionStyle, justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#0F172A', textAlign: textAlignStyle, flex: 1 }}>
            {t.title}
          </Text>
          <TouchableOpacity
            onPress={handleQuickFill}
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
              {t.quickFillBtn}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={{ fontSize: 13, color: '#64748B', marginBottom: 20, textAlign: textAlignStyle }}>
          {t.subtitle}
        </Text>

        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#E2E8F0', elevation: 2 }}>
          
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6, textAlign: textAlignStyle }}>
              {t.reportTitleLabel}
            </Text>
            <TextInput
              placeholder={t.reportTitlePlaceholder}
              value={title}
              onChangeText={setTitle}
              placeholderTextColor="#94A3B8"
              style={{ backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#CBD5E1', borderRadius: 12, padding: 12, textAlign: textAlignStyle, color: '#0F172A' }}
            />
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6, textAlign: textAlignStyle }}>
              {t.descLabel}
            </Text>
            <TextInput
              placeholder={t.descPlaceholder}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              placeholderTextColor="#94A3B8"
              style={{ backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#CBD5E1', borderRadius: 12, padding: 12, textAlign: textAlignStyle, height: 100, color: '#0F172A' }}
            />
          </View>

          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6, textAlign: textAlignStyle }}>
              {t.locationLabel}
            </Text>

            {locationCoords ? (
              <View style={{ backgroundColor: '#F0FDF4', borderWidth: 1.5, borderColor: '#86EFAC', borderRadius: 12, padding: 14, flexDirection: flexDirectionStyle, alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: flexDirectionStyle, alignItems: 'center', gap: 8, flex: 1 }}>
                  <MapPin size={20} color="#16A34A" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#166534', textAlign: textAlignStyle }}>{t.locationSet}</Text>
                    <Text style={{ fontSize: 11, color: '#4ADE80', textAlign: textAlignStyle }} numberOfLines={1}>{locationCoords.address}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={handleGetLocation}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#1E3A8A', textDecorationLine: 'underline' }}>
                    {isRTL ? 'تحديث' : 'Update'}
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
                  flexDirection: flexDirectionStyle,
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
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6, textAlign: textAlignStyle }}>
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
                  flexDirection: flexDirectionStyle,
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
                <Camera size={24} color="#475569" style={{ [isRTL ? 'marginLeft' : 'marginRight']: 8 }} />
                <Text style={{ color: '#475569', fontWeight: '700', fontSize: 13 }}>
                  {t.uploadPhoto}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading}
            style={{ backgroundColor: '#1E3A8A', borderRadius: 14, paddingVertical: 15, flexDirection: flexDirectionStyle, alignItems: 'center', justifyContent: 'center', elevation: 3 }}
          >
            {loading ? <ActivityIndicator color="#FFF" /> : (
              <>
                <Send size={18} color="#FFF" style={{ [isRTL ? 'marginLeft' : 'marginRight']: 8 }} />
                <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>{t.submitBtn}</Text>
              </>
            )}
          </TouchableOpacity>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}