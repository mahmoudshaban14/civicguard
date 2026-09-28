import { View } from 'react-native';
import { Button, Typography } from 'heroui-native';
import { router } from 'expo-router';
import { AppHeader } from '@/components/civic/AppHeader';
import { Screen } from '@/components/civic/Screen';
import { StatusBadge } from '@/components/civic/StatusBadge';
import { useCivicGuard } from '@/lib/civicguard-store';
export default function AuthorityScreen() {
  const { reports } = useCivicGuard();
  return (
    <Screen>
      <AppHeader title="Authority View" eyebrow="GOVERNMENT CONCEPT · PROTOTYPE" showBack />
      <View className="bg-civic-mint mb-4 rounded-2xl p-4">
        <Typography.Paragraph className="text-civic-deep text-sm">
          Concept-only triage view using the same local report data as the citizen application.
        </Typography.Paragraph>
      </View>
      <View className="gap-3">
        {reports.map((report) => (
          <Button
            key={report.id}
            variant="ghost"
            className="border-border bg-surface h-auto items-stretch rounded-3xl border p-4"
            onPress={() => router.push({ pathname: '/reports/[id]', params: { id: report.id } })}
          >
            <View className="flex-row items-center justify-between">
              <View>
                <Typography.Paragraph className="text-civic text-xs font-semibold">
                  {report.id}
                </Typography.Paragraph>
                <Typography.Heading type="h5" className="mt-1">
                  {report.category}
                </Typography.Heading>
              </View>
              <StatusBadge value={report.severity} type="severity" />
            </View>
            <View className="mt-4 flex-row">
              <Cell label="Location" value={report.area} />
              <Cell label="AI Confidence" value={`${report.confidence}%`} />
            </View>
            <View className="mt-3 flex-row">
              <Cell label="Status" value={report.status} />
              <Cell label="Department" value={report.department.replace(' Department', '')} />
            </View>
          </Button>
        ))}
      </View>
    </Screen>
  );
}
function Cell({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 pr-2">
      <Typography.Paragraph className="text-muted text-[11px]">{label}</Typography.Paragraph>
      <Typography.Paragraph className="mt-1 text-xs font-semibold" numberOfLines={2}>
        {value}
      </Typography.Paragraph>
    </View>
  );
}
