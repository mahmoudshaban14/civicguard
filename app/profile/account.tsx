import { View } from 'react-native';
import { Typography } from 'heroui-native';
import { Mail, MapPin, User } from 'lucide-react-native';
import { AppHeader } from '@/components/civic/AppHeader';
import { Screen } from '@/components/civic/Screen';
export default function AccountScreen() {
  return (
    <Screen>
      <AppHeader title="Profile" eyebrow="DEMO ACCOUNT" showBack />
      <View className="border-border bg-surface items-center rounded-[28px] border p-6">
        <View className="bg-civic-mint size-20 items-center justify-center rounded-full">
          <User size={36} color="#167A62" />
        </View>
        <Typography.Heading type="h3" className="mt-4">
          Demo Citizen
        </Typography.Heading>
        <Typography.Paragraph className="text-muted mt-1 text-sm">
          Citizen account · Demo Mode
        </Typography.Paragraph>
      </View>
      <View className="border-border bg-surface mt-4 overflow-hidden rounded-3xl border">
        <Row icon={<Mail size={18} color="#167A62" />} label="Email" value="demo@civicguard.app" />
        <Row icon={<MapPin size={18} color="#167A62" />} label="Primary area" value="New Cairo" />
      </View>
    </Screen>
  );
}
function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View className="border-border flex-row items-center border-b p-4">
      <View className="mr-3">{icon}</View>
      <View>
        <Typography.Paragraph className="text-muted text-xs">{label}</Typography.Paragraph>
        <Typography.Paragraph className="mt-1 text-sm font-semibold">{value}</Typography.Paragraph>
      </View>
    </View>
  );
}
