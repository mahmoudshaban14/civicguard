// oxlint-disable-next-line eslint-plugin-import/no-unassigned-import
import '../global.css';

import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform, View, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import { HeroUINativeProvider } from 'heroui-native';
import { Uniwind } from 'uniwind';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ErrorBoundary as ExpoErrorBoundary,
  type ErrorBoundaryProps,
  SplashScreen,
  Stack,
  useRouter,
  useSegments,
} from 'expo-router';

import { initPostHog } from '@/lib/posthog';
import { registerServiceWorker } from '@/lib/registerServiceWorker';
import { reportErrorToParent } from '@/lib/reportPreviewError';
import { InstallPrompt } from '@/components/InstallPrompt';
import { CivicGuardProvider } from '@/lib/civicguard-store';
import { supabase } from '@/lib/supabase';

function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    if (Platform.OS === 'web' && error) {
      const message = [error.message, error.stack].filter(Boolean).join('\n');
      reportErrorToParent(message);
    }
  }, [error]);
  return <ExpoErrorBoundary error={error} retry={retry} />;
}

export { ErrorBoundary };

Uniwind.setTheme('light');

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [session, setSession] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);
  const router = useRouter();
  const segments = useSegments();

  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    async function checkOnboarding() {
      try {
        const value = await AsyncStorage.getItem('@has_seen_onboarding_v1_0_4');
        setHasSeenOnboarding(value === 'true');
      } catch (e) {
        setHasSeenOnboarding(false);
      }
    }
    checkOnboarding();
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setIsAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // توجيه ذكي بدون تكرار اللوب
  useEffect(() => {
    if (isAuthLoading || hasSeenOnboarding === null || (!loaded && !error)) return;

    const currentSegment = segments[0];
    const inAuthGroup = currentSegment === 'auth';
    const inOnboarding = currentSegment === 'onboarding';

    if (!session) {
      if (!hasSeenOnboarding && !inOnboarding && !inAuthGroup) {
        router.replace('/onboarding' as any);
      } else if (hasSeenOnboarding && !inAuthGroup && !inOnboarding) {
        router.replace('/auth/login');
      }
    } else if (session && (inAuthGroup || inOnboarding)) {
      router.replace('/(tabs)');
    }
  }, [session, isAuthLoading, hasSeenOnboarding, loaded, error, segments]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;

    const handleError = (event: ErrorEvent) => {
      const message = event.error?.stack ?? event.message ?? 'Unknown error';
      reportErrorToParent(message);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const err = event.reason;
      const message =
        err instanceof Error ? [err.message, err.stack].filter(Boolean).join('\n') : String(err);
      reportErrorToParent(message);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const existingLink = document.querySelector(
        'link[href*="fonts.googleapis.com/css2?family=Inter"]',
      );

      if (!existingLink) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href =
          'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
      }
    }
  }, []);

  useEffect(() => {
    const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
    if (__DEV__ && Platform.OS !== 'web' && !isExpoGo) {
      try {
        // oxlint-disable-next-line @typescript-eslint/no-require-imports
        const DevClient = require('expo-dev-client');
        const timer = setTimeout(() => {
          DevClient?.closeMenu?.();
          DevClient?.hideMenu?.();
        }, 1000);
        return () => clearTimeout(timer);
      } catch {
        // Ignored if expo-dev-client is not present
      }
    }
    return undefined;
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      initPostHog();
    }
  }, []);

  useEffect(() => {
    registerServiceWorker();
  }, []);

  useEffect(() => {
    if ((loaded || error) && !isAuthLoading && hasSeenOnboarding !== null) {
      void SplashScreen.hideAsync();
    }
  }, [loaded, error, isAuthLoading, hasSeenOnboarding]);

  if ((!loaded && !error) || isAuthLoading || hasSeenOnboarding === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F5F9' }}>
        <ActivityIndicator size="large" color="#1E3A8A" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <HeroUINativeProvider>
        <CivicGuardProvider>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F6FAF8' } }}>
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="auth/login" />
            <Stack.Screen name="auth/sign-up" />
            <Stack.Screen name="(tabs)" />
          </Stack>
          <InstallPrompt />
        </CivicGuardProvider>
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}