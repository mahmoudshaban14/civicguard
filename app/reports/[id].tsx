import { Image, View } from 'react-native';
import { Button, Typography } from 'heroui-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Camera, Map } from 'lucide-react-native';
import { AppHeader } from '@/components/civic/AppHeader';
import { Screen } from '@/components/civic/Screen';
import { StatusBadge } from '@/components/civic/StatusBadge';
import { Timeline } from '@/components/civic/Timeline';
import { SAMPLE_IMAGES } from '@/lib/civicguard-data';
import { useCivicGuard } from '@/lib/civicguard-store';

export default function ReportDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { reports } = useCivicGuard();
  const report = reports.find((item) => item.id === id);
  if (!report)
    return (
      <Screen>
        <AppHeader title="Report not found" showBack />
        <Typography.Paragraph>This report is currently unavailable.</Typography.Paragraph>
      </Screen>
    );
  return (
    <Screen>
      <AppHeader
        title="Report Details"
        eyebrow={report.id}
        showBack
        right={<StatusBadge value={report.status} />}
      />
      <Image
        source={report.imageUri ? { uri: report.imageUri } : SAMPLE_IMAGES[report.imageKey]}
        style={{ width: '100%', height: 220, borderRadius: 28 }}
        resizeMode="cover"
      />
      <View className="border-border bg-surface my-4 rounded-3xl border p-5">
        <View className="mb-4 flex-row items-center justify-between">
          <View>
            <Typography.Paragraph className="text-muted text-xs">Category</Typography.Paragraph>
            <Typography.Heading type="h3" className="mt-1">
              {report.category}
            </Typography.Heading>
          </View>
          <StatusBadge value={report.severity} type="severity" />
        </View>
        <View className="flex-row">
          <Stat label="AI Confidence" value={`${report.confidence}%`} />
          <Stat label="Location" value={report.area} />
        </View>
        <View className="mt-4 flex-row">
          <Stat label="Date" value={report.date} />
          <Stat label="Department" value={report.department.replace(' Department', '')} />
        </View>
      </View>
      <View className="border-border bg-surface mb-4 rounded-3xl border p-5">
        <Typography.Heading type="h5" className="mb-5">
          Tracking Timeline
        </Typography.Heading>
        <Timeline status={report.status} />
      </View>
      <View className="bg-civic-mint mb-5 rounded-2xl p-4">
        <Typography.Paragraph className="text-civic-deep text-sm">
          Your report is currently being handled by the {report.department}.
        </Typography.Paragraph>
      </View>
      <View className="flex-row gap-3">
        <Button variant="secondary" className="flex-1" onPress={() => router.push('/(tabs)/map')}>
          <Map size={18} color="#167A62" />
          <Button.Label>View Location</Button.Label>
        </Button>
        <Button
          variant="secondary"
          className="flex-1"
          onPress={() => router.push({ pathname: '/reports/[id]/cctv', params: { id: report.id } })}
        >
          <Camera size={18} color="#167A62" />
          <Button.Label>CCTV</Button.Label>
        </Button>
      </View>
    </Screen>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 pr-2">
      <Typography.Paragraph className="text-muted text-xs">{label}</Typography.Paragraph>
      <Typography.Paragraph className="mt-1 text-sm font-semibold" numberOfLines={2}>
        {value}
      </Typography.Paragraph>
    </View>
  );
}
