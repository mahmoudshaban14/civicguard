import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Camera, ShieldCheck, HeartHandshake, ArrowRight } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    title: 'وثّق المشكلة في ثوانٍ',
    titleEn: 'Report Issues Instantly',
    description: 'التقط صورة للخلل أو الخطر في منطقتك وسيقوم النظام بتحديد الموقع تلقائياً.',
    icon: Camera,
    color: '#2563EB',
    bgColor: '#EFF6FF',
  },
  {
    id: '2',
    title: 'صوتك يصل للجهة المختصة',
    titleEn: 'Direct to Authorities',
    description: 'توجيه بلاغك مباشرة لفرق المتابعة والسلامة مع إمكانية تتبع حالة الطلب.',
    icon: ShieldCheck,
    color: '#0D5C46',
    bgColor: '#ECFDF5',
  },
  {
    id: '3',
    title: 'معاً لبناء مجتمع أفضل',
    titleEn: 'Shape Your City Future',
    description: 'مشاركتك ووعيك هما الأساس في تطوير المدينة والحفاظ على أمانها.',
    icon: HeartHandshake,
    color: '#D97706',
    bgColor: '#FFFBEB',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const finishOnboarding = async () => {
    try {
      await AsyncStorage.setItem('@has_seen_onboarding_v1_0_4', 'true');
    } catch (e) {
      console.error('Error saving onboarding state:', e);
    }
    // التوجيه المباشر لشاشة تسجيل الدخول
    router.replace('/auth/login');
  };

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      flatListRef.current?.scrollToOffset({
        offset: nextIndex * SCREEN_WIDTH,
        animated: true,
      });
    } else {
      finishOnboarding();
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      {/* زر تخطي */}
      <View style={{ paddingHorizontal: 24, paddingTop: 16, flexDirection: 'row', justifyContent: 'flex-end', zIndex: 10 }}>
        <TouchableOpacity onPress={finishOnboarding} style={{ padding: 8 }}>
          <Text style={{ color: '#64748B', fontWeight: '700', fontSize: 14 }}>
            تخطي (Skip)
          </Text>
        </TouchableOpacity>
      </View>

      {/* السلايدز */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        scrollEnabled={Platform.OS !== 'web'}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setCurrentIndex(index);
        }}
        keyExtractor={(item) => item.id}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
        renderItem={({ item }) => {
          const IconComponent = item.icon;
          return (
            <View style={{ width: SCREEN_WIDTH, padding: 32, alignItems: 'center', justifyContent: 'center' }}>
              <View
                style={{
                  width: 140,
                  height: 140,
                  borderRadius: 70,
                  backgroundColor: item.bgColor,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 40,
                  borderWidth: 2,
                  borderColor: item.color + '30',
                }}
              >
                <IconComponent size={64} color={item.color} />
              </View>

              <Text style={{ fontSize: 24, fontWeight: '800', color: '#0F172A', textAlign: 'center', marginBottom: 8 }}>
                {item.title}
              </Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: item.color, textAlign: 'center', marginBottom: 16 }}>
                {item.titleEn}
              </Text>
              <Text style={{ fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 22, paddingHorizontal: 10 }}>
                {item.description}
              </Text>
            </View>
          );
        }}
      />

      {/* الشريط السفلي */}
      <View style={{ paddingHorizontal: 32, paddingBottom: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {SLIDES.map((_, index) => (
            <View
              key={index}
              style={{
                height: 8,
                borderRadius: 4,
                backgroundColor: currentIndex === index ? '#1E3A8A' : '#CBD5E1',
                width: currentIndex === index ? 24 : 8,
                marginRight: 6,
              }}
            />
          ))}
        </View>

        <TouchableOpacity
          onPress={handleNext}
          activeOpacity={0.8}
          style={{
            backgroundColor: '#1E3A8A',
            paddingVertical: 14,
            paddingHorizontal: 24,
            borderRadius: 16,
            flexDirection: 'row',
            alignItems: 'center',
            shadowColor: '#1E3A8A',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15, marginRight: 8 }}>
            {currentIndex === SLIDES.length - 1 ? 'ابدأ الآن' : 'التالي'}
          </Text>
          <ArrowRight size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}