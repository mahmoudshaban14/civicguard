import { View } from 'react-native';
import { Button, Typography } from 'heroui-native';
import { Check, MapPin, ShieldCheck, Sparkles } from 'lucide-react-native';
import { router } from 'expo-router';
import { AppHeader } from '@/components/civic/AppHeader';
import { Screen } from '@/components/civic/Screen';
import { StatusBadge } from '@/components/civic/StatusBadge';

export default function AnalysisResultScreen() {
  return (
    <Screen>
      <AppHeader title="Analysis Complete" eyebrow="AI ANALYSIS · PROTOTYPE" />
      <View className="bg-civic-deep mb-4 rounded-[28px] p-5">
        <View className="mb-4 flex-row items-center justify-between">
          <View className="size-11 items-center justify-center rounded-2xl bg-white/15">
            <Sparkles size={22} color="#C8F169" />
          </View>
          <StatusBadge value="High" type="severity" />
        </View>
        <Typography.Paragraph className="text-xs text-white/55">
          Detected Issue
        </Typography.Paragraph>
        <Typography.Heading type="h2" className="mt-1 text-white">
          POTHOLE
        </Typography.Heading>
      </View>
      <View className="border-border bg-surface mb-4 rounded-3xl border p-5">
        <View className="flex-row items-end justify-between">
          <View>
            <Typography.Paragraph className="text-muted text-xs">Confidence</Typography.Paragraph>
            <Typography.Heading type="h2" className="text-civic mt-1">
              94%
            </Typography.Heading>
          </View>
          <Typography.Paragraph className="text-muted text-xs">
            High confidence
          </Typography.Paragraph>
        </View>
        <View className="bg-default mt-4 h-3 overflow-hidden rounded-full">
          <View className="bg-civic h-full w-[94%] rounded-full" />
        </View>
      </View>
      <View className="border-border bg-surface overflow-hidden rounded-3xl border">
        <Row
          label="Responsible Department"
          value="Road Maintenance Department"
          icon={<ShieldCheck size={18} color="#167A62" />}
        />
        <Row
          label="Duplicate Check"
          value="No matching active report found"
          icon={<Check size={18} color="#167A62" />}
        />
        <Row
          label="Location"
          value="Verified · New Cairo"
          icon={<MapPin size={18} color="#167A62" />}
          last
        />
      </View>
      <View className="bg-warning/10 mt-4 rounded-2xl px-4 py-3">
        <Typography.Paragraph className="text-muted text-xs">
          Prototype Simulation — results are generated locally for demonstration and are not
          production AI findings.
        </Typography.Paragraph>
      </View>
      <Button className="mt-6" onPress={() => router.push('/report/success')}>
        <Button.Label>Submit Report</Button.Label>
      </Button>
    </Screen>
  );
}
function Row({
  label,
  value,
  icon,
  last,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  last?: boolean;
}) {
  return (
    <View className={`flex-row items-center p-4 ${last ? '' : 'border-border border-b'}`}>
      <View className="bg-civic-mint mr-3 size-9 items-center justify-center rounded-xl">
        {icon}
      </View>
      <View className="flex-1">
        <Typography.Paragraph className="text-muted text-xs">{label}</Typography.Paragraph>
        <Typography.Paragraph className="mt-0.5 text-sm font-semibold">
          {value}
        </Typography.Paragraph>
      </View>
    </View>
  );
}
