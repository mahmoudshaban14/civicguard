import { Image, Pressable, View } from 'react-native';
import { ChevronRight, MapPin } from 'lucide-react-native';
import { Typography } from 'heroui-native';
import { SAMPLE_IMAGES, type CivicReport } from '@/lib/civicguard-data';
import { StatusBadge } from './StatusBadge';

export function ReportCard({
  report,
  onPress,
  compact = false,
}: {
  report: CivicReport;
  onPress: () => void;
  compact?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="border-border bg-surface mb-3 flex-row overflow-hidden rounded-3xl border p-3 active:opacity-80"
    >
      <Image
        source={report.imageUri ? { uri: report.imageUri } : SAMPLE_IMAGES[report.imageKey]}
        style={{ width: compact ? 70 : 82, height: compact ? 70 : 82, borderRadius: 16 }}
        resizeMode="cover"
      />
      <View className="ml-3 flex-1 justify-center">
        <Typography.Paragraph className="text-muted mb-1 text-xs font-medium">
          {report.id}
        </Typography.Paragraph>
        <Typography.Heading type="h6" className="mb-2">
          {report.category}
        </Typography.Heading>
        <View className="flex-row items-center gap-2">
          <StatusBadge value={report.severity} type="severity" />
          <StatusBadge value={report.status} />
        </View>
        {!compact ? (
          <View className="mt-2 flex-row items-center gap-1">
            <MapPin size={12} color="#74847F" />
            <Typography.Paragraph className="text-muted text-xs">
              {report.area}
            </Typography.Paragraph>
          </View>
        ) : null}
      </View>
      <View className="justify-center">
        <ChevronRight size={20} color="#8A9894" />
      </View>
    </Pressable>
  );
}
