import { useEffect, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import { Button, Spinner, Typography } from 'heroui-native';
import { Check } from 'lucide-react-native';
import { router } from 'expo-router';

import { SafeAreaView } from '@/components/ui/primitives/SafeAreaView';
import type { CivicReport } from '@/lib/civicguard-data';
import { useCivicGuard } from '@/lib/civicguard-store';

export default function ReportSuccessScreen() {
  const { submitDraft, lastSubmittedReport } = useCivicGuard();
  const submitted = useRef(false);
  const [submittedReport, setSubmittedReport] = useState<CivicReport | null>(null);
  const [scale] = useState(() => new Animated.Value(0.7));

  useEffect(() => {
    if (!submitted.current) {
      setSubmittedReport(submitDraft());
      submitted.current = true;
    }
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6 }).start();
  }, [scale, submitDraft]);

  const report = submittedReport ?? lastSubmittedReport;

  if (!report) {
    return (
      <SafeAreaView
        className="bg-background flex-1 items-center justify-center"
        edges={['top', 'bottom']}
      >
        <Spinner />
      </SafeAreaView>
    );
  }

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
          <Row label="Category" value={report.category} />
          <Row label="Severity" value={report.severity} />
          <Row label="Location" value={report.area} />
          <Row label="Department" value={report.department} />
          <Row label="Status" value={report.status} last />
        </View>
      </View>
      <Button
        onPress={() => router.replace({ pathname: '/reports/[id]', params: { id: report.id } })}
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
    <View className={`flex-row justify-between gap-4 p-4 ${last ? '' : 'border-border border-b'}`}>
      <Typography.Paragraph className="text-muted text-sm">{label}</Typography.Paragraph>
      <Typography.Paragraph className="flex-1 text-right text-sm font-semibold">
        {value}
      </Typography.Paragraph>
    </View>
  );
}
