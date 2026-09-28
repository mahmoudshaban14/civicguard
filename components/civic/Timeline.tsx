import { View } from 'react-native';
import { Check } from 'lucide-react-native';
import { Typography } from 'heroui-native';
import type { ReportStatus } from '@/lib/civicguard-data';

const STEPS = [
  'Reported',
  'AI Analysis',
  'Assigned to Department',
  'In Progress',
  'Resolved',
] as const;

function activeIndex(status: ReportStatus) {
  if (status === 'Reported') return 1;
  if (status === 'Assigned') return 2;
  if (status === 'In Progress') return 3;
  return 4;
}

export function Timeline({ status }: { status: ReportStatus }) {
  const current = activeIndex(status);
  return (
    <View>
      {STEPS.map((step, index) => {
        const complete = index < current || status === 'Resolved';
        const active = index === current && status !== 'Resolved';
        return (
          <View key={step} className="flex-row">
            <View className="items-center">
              <View
                className={`size-7 items-center justify-center rounded-full ${complete ? 'bg-accent' : active ? 'border-accent bg-accent-soft border-2' : 'border-border bg-background border'}`}
              >
                {complete ? (
                  <Check size={15} color="#FFFFFF" strokeWidth={3} />
                ) : active ? (
                  <View className="bg-accent size-2 rounded-full" />
                ) : null}
              </View>
              {index < STEPS.length - 1 ? (
                <View className={`h-9 w-0.5 ${index < current ? 'bg-accent' : 'bg-border'}`} />
              ) : null}
            </View>
            <Typography.Paragraph
              className={`ml-3 pt-1 text-sm ${complete || active ? 'text-foreground font-semibold' : 'text-muted'}`}
            >
              {step}
            </Typography.Paragraph>
          </View>
        );
      })}
    </View>
  );
}
