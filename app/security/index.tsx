import { View } from 'react-native';
import { Button, Typography } from 'heroui-native';
import { router } from 'expo-router';
import { Check, Gauge, LockKeyhole, Server, ShieldCheck, UploadCloud } from 'lucide-react-native';
import { AppHeader } from '@/components/civic/AppHeader';
import { Screen } from '@/components/civic/Screen';
const safeguards = [
  ['Account Security', 'Protected', LockKeyhole],
  ['API Protection', 'Active', Server],
  ['Rate Limiting', 'Active', Gauge],
  ['Secure Upload', 'Active', UploadCloud],
] as const;
export default function SecurityScreen() {
  return (
    <Screen>
      <AppHeader title="Security Center" eyebrow="SECURITY SAFEGUARDS" showBack />
      <View className="bg-civic-deep mb-4 rounded-[28px] p-5">
        <ShieldCheck size={32} color="#C8F169" />
        <Typography.Heading type="h3" className="mt-4 text-white">
          Security safeguards active
        </Typography.Heading>
        <Typography.Paragraph className="mt-2 text-sm leading-5 text-white/65">
          CivicGuard enforces adaptive rate-limiting, edge anomaly detection, and automated spam filtering across municipal endpoints.
        </Typography.Paragraph>
      </View>
      <View className="border-border bg-surface mb-5 overflow-hidden rounded-3xl border">
        {safeguards.map(([label, value, Icon], index) => (
          <View
            key={label}
            className={`flex-row items-center p-4 ${index < safeguards.length - 1 ? 'border-border border-b' : ''}`}
          >
            <View className="bg-civic-mint mr-3 size-10 items-center justify-center rounded-xl">
              <Icon size={19} color="#167A62" />
            </View>
            <Typography.Paragraph className="flex-1 font-semibold">{label}</Typography.Paragraph>
            <View className="flex-row items-center">
              <Check size={15} color="#167A62" />
              <Typography.Paragraph className="text-civic ml-1 text-xs font-semibold">
                {value}
              </Typography.Paragraph>
            </View>
          </View>
        ))}
      </View>
      <Button onPress={() => router.push('/security/monitor')}>
        <Button.Label>Open API Security Monitor</Button.Label>
      </Button>
      <Typography.Paragraph className="text-muted mt-4 text-center text-xs">
        System Security — Live traffic protection and municipal audit safeguards active.
      </Typography.Paragraph>
    </Screen>
  );
}
