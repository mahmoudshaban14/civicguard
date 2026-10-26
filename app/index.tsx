import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Index() {
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkOnboardingStatus() {
      try {
        // فحص المفتاح الخاص بالإصدار الحالي v1.0.4
        const value = await AsyncStorage.getItem('@has_seen_onboarding_v1_0_4');
        setHasSeenOnboarding(value === 'true');
      } catch (_e) {
        setHasSeenOnboarding(false);
      }
    }
    void checkOnboardingStatus();
  }, []);

  // شاشة تحميل بسيطة أثناء قراءة الـ Memory
  if (hasSeenOnboarding === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F5F9' }}>
        <ActivityIndicator size="large" color="#1E3A8A" />
      </View>
    );
  }

  // لو تخطاها من قبل يروح لشاشة الدخول مباشرة، لو أول مرة يفتح Onboarding
  if (hasSeenOnboarding) {
    return <Redirect href="/auth/login" />;
  }

  return <Redirect href="/onboarding" />;
}