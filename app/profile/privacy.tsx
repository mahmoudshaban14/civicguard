import { View } from 'react-native';
import { Typography } from 'heroui-native';
import { EyeOff, HardDrive, LockKeyhole, Trash2 } from 'lucide-react-native';
import { AppHeader } from '@/components/civic/AppHeader';
import { Screen } from '@/components/civic/Screen';
const items = [
  ['Local demo data', 'Reports are stored on this device for the prototype.', HardDrive],
  ['Location use', 'Mock or device location is attached only when you confirm.', EyeOff],
  [
    'Secure concept',
    'Production encryption and access controls are architecture concepts.',
    LockKeyhole,
  ],
  ['Clear data', 'Reset Demo Mode from Profile to restore sample data.', Trash2],
] as const;
export default function PrivacyScreen() {
  return (
    <Screen>
      <AppHeader title="Privacy" eyebrow="DEMO MODE" showBack />
      <View className="gap-3">
        {items.map(([title, copy, Icon]) => (
          <View key={title} className="border-border bg-surface flex-row rounded-3xl border p-4">
            <View className="bg-civic-mint mr-3 size-11 items-center justify-center rounded-2xl">
              <Icon size={20} color="#167A62" />
            </View>
            <View className="flex-1">
              <Typography.Paragraph className="font-semibold">{title}</Typography.Paragraph>
              <Typography.Paragraph className="text-muted mt-1 text-sm leading-5">
                {copy}
              </Typography.Paragraph>
            </View>
          </View>
        ))}
      </View>
      <Typography.Paragraph className="text-muted mt-5 text-xs">
        Prototype notice: CivicGuard is not connected to government databases or production
        infrastructure.
      </Typography.Paragraph>
    </Screen>
  );
}
