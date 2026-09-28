import { View } from 'react-native';
import { Typography } from 'heroui-native';
import {
  SEVERITY_COLORS,
  STATUS_COLORS,
  type ReportStatus,
  type Severity,
} from '@/lib/civicguard-data';

export function StatusBadge(
  props: { value: ReportStatus; type?: 'status' } | { value: Severity; type: 'severity' },
) {
  const color =
    props.type === 'severity' ? SEVERITY_COLORS[props.value] : STATUS_COLORS[props.value];
  return (
    <View className="self-start rounded-full px-2.5 py-1" style={{ backgroundColor: `${color}18` }}>
      <Typography.Paragraph className="text-xs font-semibold" style={{ color }}>
        {props.value}
      </Typography.Paragraph>
    </View>
  );
}
