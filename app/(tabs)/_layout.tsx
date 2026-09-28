import { FilePlus2, Home, Map, UserRound, ClipboardList } from 'lucide-react-native';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useThemeColor } from 'heroui-native';
import type { ColorValue } from 'react-native';

const statusBarStyle = 'dark' as const;
const icon =
  (Icon: typeof Home) =>
  ({ color, size }: { color: ColorValue; size: number }) => (
    <Icon color={color} size={size ?? 23} strokeWidth={2.2} />
  );

export default function TabLayout() {
  const [background, border, accent, muted] = useThemeColor([
    'background',
    'border',
    'accent',
    'muted',
  ]);

  return (
    <>
      <StatusBar style={statusBarStyle} />
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: background },
          tabBarStyle: {
            backgroundColor: background,
            borderTopColor: border,
            height: 72,
            paddingTop: 7,
            paddingBottom: 9,
          },
          tabBarLabelStyle: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
          tabBarActiveTintColor: accent,
          tabBarInactiveTintColor: muted,
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon(Home) }} />
        <Tabs.Screen name="report" options={{ title: 'Report', tabBarIcon: icon(FilePlus2) }} />
        <Tabs.Screen
          name="reports"
          options={{ title: 'My Reports', tabBarIcon: icon(ClipboardList) }}
        />
        <Tabs.Screen name="map" options={{ title: 'Map', tabBarIcon: icon(Map) }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon(UserRound) }} />
      </Tabs>
    </>
  );
}
