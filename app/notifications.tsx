import { View } from 'react-native';
import { Typography } from 'heroui-native';
import { Bell, CheckCircle2, Clock3 } from 'lucide-react-native';
import { AppHeader } from '@/components/civic/AppHeader';
import { Screen } from '@/components/civic/Screen';
import { useCivicGuard } from '@/lib/civicguard-store';

export default function NotificationsScreen() {
  const { notifications } = useCivicGuard();
  return (
    <Screen>
      <AppHeader title="Notifications" eyebrow="UPDATES" showBack />
      <View className="gap-3">
        {notifications.map((item) => (
          <View key={item.id} className="border-border bg-surface flex-row rounded-3xl border p-4">
            <View
              className={`mr-3 size-11 items-center justify-center rounded-2xl ${item.read ? 'bg-default' : 'bg-civic-mint'}`}
            >
              {item.read ? (
                <CheckCircle2 size={20} color="#65736F" />
              ) : (
                <Bell size={20} color="#167A62" />
              )}
            </View>
            <View className="flex-1">
              <Typography.Paragraph className="text-sm font-semibold">
                Report update
              </Typography.Paragraph>
              <Typography.Paragraph className="text-muted mt-1 text-sm leading-5">
                {item.text}
              </Typography.Paragraph>
              <View className="mt-2 flex-row items-center">
                <Clock3 size={12} color="#65736F" />
                <Typography.Paragraph className="text-muted ml-1 text-xs">
                  {item.time}
                </Typography.Paragraph>
              </View>
            </View>
            {!item.read ? <View className="bg-civic mt-1 ml-2 size-2 rounded-full" /> : null}
          </View>
        ))}
      </View>
    </Screen>
  );
}
