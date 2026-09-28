import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { Typography } from 'heroui-native';
import { goBackOrReplace } from '@/lib/navigation';

export function AppHeader({
  title,
  eyebrow,
  action,
  back = false,
  showBack = false,
  right,
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  back?: boolean;
  /** Alias used by routed screens to request the back affordance. */
  showBack?: boolean;
  /** Alias used by detail screens for a trailing header element. */
  right?: ReactNode;
}) {
  return (
    <View className="mb-5 flex-row items-center gap-3 pt-3">
      {back || showBack ? (
        <Pressable
          accessibilityLabel="Go back"
          onPress={() => goBackOrReplace('/(tabs)')}
          className="bg-surface size-10 items-center justify-center rounded-full"
        >
          <ArrowLeft size={20} color="#12362F" />
        </Pressable>
      ) : null}
      <View className="flex-1">
        {eyebrow ? (
          <Typography.Paragraph className="text-accent mb-0.5 text-xs font-semibold">
            {eyebrow}
          </Typography.Paragraph>
        ) : null}
        <Typography.Heading type="h3" className="text-foreground">
          {title}
        </Typography.Heading>
      </View>
      {right ?? action}
    </View>
  );
}
