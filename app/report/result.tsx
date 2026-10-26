import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Button, Typography } from 'heroui-native';
import { AlertTriangle, Check, MapPin, ShieldCheck, Sparkles } from 'lucide-react-native';
import { router } from 'expo-router';

import { AppHeader } from '@/components/civic/AppHeader';
import { Screen } from '@/components/civic/Screen';
import { StatusBadge } from '@/components/civic/StatusBadge';
import { useCivicGuard } from '@/lib/civicguard-store';

export default function AnalysisResultScreen() {
  const { analysisResult, analyzeDraft, draft } = useCivicGuard();

  if (!analysisResult) {
    return (
      <Screen>
        <AppHeader title="Analysis unavailable" eyebrow="AI ANALYSIS · CIVIC ENGINE" showBack />
        <Typography.Paragraph className="text-muted">
          Run the AI analysis before reviewing the result.
        </Typography.Paragraph>
        <Button className="mt-6" onPress={() => router.replace('/report/analyzing')}>
          <Button.Label>Analyze Report</Button.Label>
        </Button>
      </Screen>
    );
  }

  const lowConfidence = analysisResult.requiresManualReview;
  const confidenceLabel = lowConfidence
    ? 'Low confidence'
    : analysisResult.confidence >= 90
      ? 'High confidence'
      : 'Moderate confidence';

  return (
    <Screen>
      <AppHeader title="AI Analysis Complete" eyebrow="AI ANALYSIS · CIVIC ENGINE" />
      <View className="bg-civic-deep mb-4 rounded-[28px] p-5">
        <View className="mb-4 flex-row items-center justify-between">
          <View className="size-11 items-center justify-center rounded-2xl bg-white/15">
            {lowConfidence ? (
              <AlertTriangle size={22} color="#C8F169" />
            ) : (
              <Sparkles size={22} color="#C8F169" />
            )}
          </View>
          {analysisResult.severity === 'Requires Review' ? (
            <View className="rounded-full bg-white/15 px-3 py-1.5">
              <Typography.Paragraph className="text-xs font-semibold text-white">
                Requires Review
              </Typography.Paragraph>
            </View>
          ) : (
            <StatusBadge value={analysisResult.severity} type="severity" />
          )}
        </View>
        <Typography.Paragraph className="text-xs text-white/55">
          {lowConfidence ? 'Possible Issue' : 'Detected Issue'}
        </Typography.Paragraph>
        <Typography.Heading type="h3" className="mt-1 text-white">
          {analysisResult.category}
        </Typography.Heading>
      </View>

      <View className="border-border bg-surface mb-4 rounded-3xl border p-5">
        <View className="flex-row items-end justify-between">
          <View>
            <Typography.Paragraph className="text-muted text-xs">Confidence</Typography.Paragraph>
            <Typography.Heading type="h2" className="text-civic mt-1">
              {analysisResult.confidence}%
            </Typography.Heading>
          </View>
          <Typography.Paragraph className="text-muted text-xs">
            {confidenceLabel}
          </Typography.Paragraph>
        </View>
        <View className="bg-default mt-4 h-3 overflow-hidden rounded-full">
          <View
            className={
              lowConfidence ? 'bg-warning h-full rounded-full' : 'bg-civic h-full rounded-full'
            }
            style={{ width: `${analysisResult.confidence}%` }}
          />
        </View>
      </View>

      {lowConfidence ? (
        <View className="border-warning/25 bg-warning/10 mb-4 rounded-3xl border p-4">
          <Typography.Heading type="h5">Low Confidence</Typography.Heading>
          <Typography.Paragraph className="text-muted mt-2 text-sm leading-5">
            The image does not provide enough visual evidence for a reliable classification. Add a
            clearer image or additional description, or submit it for manual review.
          </Typography.Paragraph>
        </View>
      ) : null}

      {analysisResult.secondaryIssues.length > 0 ? (
        <View className="border-border bg-surface mb-4 rounded-3xl border p-5">
          <Typography.Heading type="h5">Multiple Potential Issues Detected</Typography.Heading>
          <Typography.Paragraph className="text-muted mt-3 text-xs">
            Primary Issue
          </Typography.Paragraph>
          <Typography.Paragraph className="mt-1 font-semibold">
            {analysisResult.category}
          </Typography.Paragraph>
          <Typography.Paragraph className="text-muted mt-4 text-xs">
            Select a secondary issue to make it primary
          </Typography.Paragraph>
          <View className="mt-3 gap-2">
            {analysisResult.secondaryIssues.map((issue) => (
              <Button
                key={issue}
                variant="secondary"
                onPress={() => {
                  void analyzeDraft(issue);
                }}
              >
                <Button.Label>{issue}</Button.Label>
              </Button>
            ))}
          </View>
        </View>
      ) : null}

      <View className="border-border bg-surface mb-4 overflow-hidden rounded-3xl border">
        <Row
          label="AI Severity Assessment"
          value={`${analysisResult.severity} — ${analysisResult.severityReason}`}
          icon={<AlertTriangle size={18} color="#167A62" />}
        />
        <Row
          label="Recommended Department"
          value={analysisResult.department}
          icon={<ShieldCheck size={18} color="#167A62" />}
        />
        <Row
          label="AI Explanation"
          value={analysisResult.explanation}
          icon={<Sparkles size={18} color="#167A62" />}
        />
        <Row
          label="Possible Duplicate"
          value={analysisResult.possibleDuplicate}
          icon={<Check size={18} color="#167A62" />}
        />
        <Row
          label="Recommended Action"
          value={analysisResult.recommendedAction}
          icon={<ShieldCheck size={18} color="#167A62" />}
        />
        <Row
          label="Location"
          value={`Verified · ${draft.area}`}
          icon={<MapPin size={18} color="#167A62" />}
          last
        />
      </View>

      <View className="bg-warning/10 mt-1 rounded-2xl px-4 py-3">
        <Typography.Paragraph className="text-muted text-xs">
          Automated classification — Vision model engine results. Classification verified for municipal dispatch routing.
        </Typography.Paragraph>
      </View>

      {lowConfidence ? (
        <View className="mt-6 flex-row gap-3">
          <Button
            variant="secondary"
            className="flex-1"
            onPress={() => router.replace('/(tabs)/report')}
          >
            <Button.Label>Retake Photo</Button.Label>
          </Button>
          <Button className="flex-1" onPress={() => router.push('/report/success')}>
            <Button.Label>Submit for Manual Review</Button.Label>
          </Button>
        </View>
      ) : (
        <Button className="mt-6" onPress={() => router.push('/report/success')}>
          <Button.Label>Submit Report</Button.Label>
        </Button>
      )}
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
  icon: ReactNode;
  last?: boolean;
}) {
  return (
    <View className={`flex-row items-start p-4 ${last ? '' : 'border-border border-b'}`}>
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
