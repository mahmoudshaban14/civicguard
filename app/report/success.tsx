import { useEffect, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import { Button, Typography } from 'heroui-native';
import { Check } from 'lucide-react-native';
import { router } from 'expo-router';
import { SafeAreaView } from '@/components/ui/primitives/SafeAreaView';
import { useCivicGuard } from '@/lib/civicguard-store';

export default function ReportSuccessScreen() {
  const { submitDraft, reports } = useCivicGuard();
  const submitted = useRef(false);
  const [scale] = useState(() => new Animated.Value(0.7));
  useEffect(() => {
    if (!submitted.current) {
      submitDraft();
      submitted.current = true;
    }
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6 }).start();
  }, [scale, submitDraft]);
  const report = reports.find((item) => item.id === 'CG-2026-00127') ?? reports[0];
  return (
    <SafeAreaView className="bg-background flex-1 px-5" edges={['top', 'bottom']}>
      <View className="flex-1 justify-center">
        <Animated.View
          style={{ transform: [{ scale }] }}
          className="bg-civic mb-6 size-24 items-center justify-center self-center rounded-full"
        >
          <Check size={48} color="white" strokeWidth={3} />
        </Animated.View>
        <Typography.Heading type="h2" className="text-center">
          Report Submitted
        </Typography.Heading>
        <Typography.Paragraph className="text-muted mt-2 text-center">
          Your report is ready to track.
        </Typography.Paragraph>
        <View className="border-border bg-surface mt-8 overflow-hidden rounded-[28px] border">
          <Row label="Report ID" value={report.id} />
          <Row label="Category" value="Pothole" />
          <Row label="Severity" value="High" />
          <Row label="Location" value="New Cairo" />
          <Row label="Department" value="Road Maintenance" />
          <Row label="Status" value="Reported" last />
        </View>
      </View>
      <Button
        onPress={() =>
          router.replace({ pathname: '/reports/[id]', params: { id: 'CG-2026-00127' } })
        }
      >
        <Button.Label>Track Report</Button.Label>
      </Button>
      <Button variant="ghost" className="mt-2" onPress={() => router.replace('/(tabs)')}>
        <Button.Label>Back to Home</Button.Label>
      </Button>
    </SafeAreaView>
  );
}
function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View className={`flex-row justify-between p-4 ${last ? '' : 'border-border border-b'}`}>
      <Typography.Paragraph className="text-muted text-sm">{label}</Typography.Paragraph>
      <Typography.Paragraph className="text-sm font-semibold">{value}</Typography.Paragraph>
    </View>
  );
}
