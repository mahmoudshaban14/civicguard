import { useCallback } from 'react';
import {
  ChevronRight,
  Bell,
  LockKeyhole,
  ShieldCheck,
  Building2,
  RotateCcw,
  LogOut,
  UserRound,
  UserPlus,
} from 'lucide-react-native';
import { Pressable, View, Alert } from 'react-native';
import { Button, Typography } from 'heroui-native';
import { router } from 'expo-router';
import { AppHeader } from '@/components/civic/AppHeader';
import { Screen } from '@/components/civic/Screen';
import { useCivicGuard } from '@/lib/civicguard-store';
import { supabase } from '@/lib/supabase';

const items = [
  { label: 'Login / Sign Up', icon: UserPlus, route: '/auth/login' },
  { label: 'Profile', icon: UserRound, route: '/profile/account' },
  { label: 'My Reports', icon: UserRound, route: '/(tabs)/reports' },
  { label: 'Notifications', icon: Bell, route: '/notifications' },
  { label: 'Privacy', icon: LockKeyhole, route: '/profile/privacy' },
  { label: 'Security Center', icon: ShieldCheck, route: '/security' },
  { label: 'Authority View', icon: Building2, route: '/authority' },
] as const;

export default function ProfileScreen() {
  const { resetDemo } = useCivicGuard();

  const handleLogout = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('خطأ', error.message);
    } else {
      Alert.alert('تم', 'تم تسجيل الخروج بنجاح!');
      router.replace('/auth/login');
    }
  }, []);

  return (
    <Screen>
      <AppHeader title="Profile" />
      <View className="bg-civic-deep mb-6 items-center rounded-[28px] p-6">
        <View className="mb-3 size-20 items-center justify-center rounded-full bg-white/15">
          <Typography.Heading type="h2" className="text-white">
            DC
          </Typography.Heading>
        </View>
        <Typography.Heading type="h4" className="text-white">
          Demo Citizen
        </Typography.Heading>
        <Typography.Paragraph className="mt-1 text-sm text-white/70">
          Citizen account · Demo Mode
        </Typography.Paragraph>
      </View>
      <View className="border-border bg-surface overflow-hidden rounded-3xl border">
        {items.map(({ label, icon: Icon, route }, index) => (
          <Pressable
            key={label}
            onPress={() => router.push(route)}
            className={`active:bg-default flex-row items-center px-4 py-4 ${
              index < items.length - 1 ? 'border-border border-b' : ''
            }`}
          >
            <View className="bg-civic-mint mr-3 size-10 items-center justify-center rounded-xl">
              <Icon size={19} color="#167A62" />
            </View>
            <Typography.Paragraph className="flex-1 font-medium">{label}</Typography.Paragraph>
            <ChevronRight size={18} color="#8A9894" />
          </Pressable>
        ))}
      </View>
      <Button variant="secondary" className="mt-5" onPress={resetDemo}>
        <RotateCcw size={18} color="#167A62" />
        <Button.Label>Reset Demo Data</Button.Label>
      </Button>
      <Button variant="ghost" className="mt-2" onPress={handleLogout}>
        <LogOut size={18} color="#C73545" />
        <Button.Label className="text-danger">Logout</Button.Label>
      </Button>
    </Screen>
  );
}