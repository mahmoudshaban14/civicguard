import { useState } from 'react';
import { Animated, View } from 'react-native';
import { Button, Typography } from 'heroui-native';
import { Camera, Check, Play, Radio, X } from 'lucide-react-native';
import { AppHeader } from '@/components/civic/AppHeader';
import { Screen } from '@/components/civic/Screen';

export default function CCTVScreen() {
  const [status, setStatus] = useState('Available');
  const [reviewing, setReviewing] = useState(false);
  const [scan] = useState(() => new Animated.Value(0));
  const review = () => {
    setReviewing(true);
    scan.setValue(0);
    Animated.loop(
      Animated.sequence([
        Animated.timing(scan, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(scan, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ]),
      { iterations: 3 },
    ).start(() => setReviewing(false));
  };
  return (
    <Screen>
      <AppHeader title="Incident Verification" eyebrow="CCTV · PROTOTYPE SIMULATION" showBack />
      <View className="border-border bg-surface mb-4 flex-row rounded-3xl border p-4">
        <View className="bg-civic-mint mr-3 size-12 items-center justify-center rounded-2xl">
          <Camera size={22} color="#167A62" />
        </View>
        <View className="flex-1">
          <Typography.Paragraph className="font-semibold">
            Nearby CCTV · CAM-001
          </Typography.Paragraph>
          <Typography.Paragraph className="text-muted mt-1 text-sm">120m away</Typography.Paragraph>
        </View>
        <View className="flex-row items-center">
          <Radio size={14} color="#167A62" />
          <Typography.Paragraph className="text-civic ml-1 text-xs font-semibold">
            Online
          </Typography.Paragraph>
        </View>
      </View>
      <View className="bg-civic-deep relative h-64 overflow-hidden rounded-[28px]">
        <View className="absolute inset-0 items-center justify-center">
          <Camera size={52} color="#48645D" />
          <Typography.Paragraph className="mt-3 text-xs text-white/45">
            CAM-001 · MOCK STREET FEED
          </Typography.Paragraph>
        </View>
        <View className="bg-danger/85 absolute top-4 left-4 rounded-lg px-2 py-1">
          <Typography.Paragraph className="text-[10px] font-bold text-white">
            SIMULATION
          </Typography.Paragraph>
        </View>
        {reviewing ? (
          <Animated.View
            style={{
              transform: [
                { translateY: scan.interpolate({ inputRange: [0, 1], outputRange: [0, 240] }) },
              ],
            }}
            className="bg-civic-lime absolute top-0 right-0 left-0 h-1"
          />
        ) : null}
        <View className="absolute bottom-4 left-4">
          <Typography.Paragraph className="font-mono text-xs text-white/70">
            2026-04-21 10:42:16
          </Typography.Paragraph>
        </View>
      </View>
      <View className="border-border bg-surface my-4 rounded-3xl border p-5">
        <Typography.Paragraph className="text-muted text-xs">
          Verification Status
        </Typography.Paragraph>
        <Typography.Heading type="h4" className="mt-1">
          {status}
        </Typography.Heading>
      </View>
      <Button className="mb-3" onPress={review} isDisabled={reviewing}>
        <Play size={18} color="white" />
        <Button.Label>{reviewing ? 'Reviewing Footage…' : 'Review Footage'}</Button.Label>
      </Button>
      <View className="flex-row gap-3">
        <Button
          variant="secondary"
          className="flex-1"
          onPress={() => setStatus('Incident Confirmed')}
        >
          <Check size={18} color="#167A62" />
          <Button.Label>Confirm</Button.Label>
        </Button>
        <Button variant="secondary" className="flex-1" onPress={() => setStatus('Rejected')}>
          <X size={18} color="#D34F4F" />
          <Button.Label>Reject</Button.Label>
        </Button>
      </View>
    </Screen>
  );
}
