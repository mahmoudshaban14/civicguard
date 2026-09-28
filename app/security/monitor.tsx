import { useCallback, useEffect, useState } from 'react';
import { Animated, View } from 'react-native';
import { Button, Typography } from 'heroui-native';
import { Activity, ShieldAlert, Zap } from 'lucide-react-native';
import { AppHeader } from '@/components/civic/AppHeader';
import { Screen } from '@/components/civic/Screen';
const levels = [120, 450, 1200, 2500];
export default function SecurityMonitorScreen() {
  const [index, setIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const [pulse] = useState(() => new Animated.Value(1));
  const animatePulse = useCallback(() => {
    Animated.sequence([
      Animated.timing(pulse, { toValue: 1.08, duration: 180, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [pulse]);
  useEffect(() => {
    if (!running) return () => {};
    const timer = setInterval(
      () =>
        setIndex((current) => {
          if (current >= levels.length - 1) {
            setRunning(false);
            clearInterval(timer);
            return current;
          }
          animatePulse();
          return current + 1;
        }),
      650,
    );
    return () => clearInterval(timer);
  }, [animatePulse, running]);
  const triggered = index === 3;
  const simulate = () => {
    animatePulse();
    setIndex(0);
    setRunning(true);
  };
  return (
    <Screen>
      <AppHeader title="API Security Monitor" eyebrow="PROTOTYPE SIMULATION" showBack />
      <View className={`mb-4 rounded-[28px] p-6 ${triggered ? 'bg-danger' : 'bg-civic-deep'}`}>
        <View className="flex-row items-center justify-between">
          <Activity size={26} color="#C8F169" />
          <View className="rounded-full bg-white/10 px-3 py-1">
            <Typography.Paragraph className="text-xs text-white">
              {running ? 'Simulating Traffic' : 'Demo Traffic'}
            </Typography.Paragraph>
          </View>
        </View>
        <Typography.Paragraph className="mt-7 text-xs text-white/60">
          Requests per minute
        </Typography.Paragraph>
        <Animated.View style={{ transform: [{ scale: pulse }] }}>
          <Typography.Heading type="h1" className="mt-1 text-white">
            {levels[index].toLocaleString()}
          </Typography.Heading>
        </Animated.View>
        <View className="mt-5 flex-row gap-2">
          {levels.map((level, i) => (
            <View
              key={level}
              className={`h-2 flex-1 rounded-full ${i <= index ? 'bg-civic-lime' : 'bg-white/15'}`}
            />
          ))}
        </View>
      </View>
      {triggered ? (
        <View className="border-danger/20 bg-danger/10 mb-4 rounded-3xl border p-5">
          <View className="flex-row items-center">
            <ShieldAlert size={24} color="#D34F4F" />
            <Typography.Heading type="h4" className="text-danger ml-3">
              Rate Limit Triggered
            </Typography.Heading>
          </View>
          <View className="mt-5 gap-3">
            <Row label="Response" value="HTTP 429 · Too Many Requests" />
            <Row label="Blocked Requests" value="1,842" />
            <Row label="Status" value="Temporarily Throttled" />
            <Row label="Security Event" value="Request Flooding Detected" />
            <Row label="Action" value="Temporary Request Throttling" />
          </View>
        </View>
      ) : (
        <View className="border-border bg-surface mb-4 rounded-3xl border p-5">
          <Typography.Heading type="h4">Normal traffic</Typography.Heading>
          <Typography.Paragraph className="text-muted mt-2 text-sm">
            Request volume is within the configured demonstration threshold.
          </Typography.Paragraph>
        </View>
      )}
      <Button onPress={simulate} isDisabled={running}>
        <Zap size={18} color="white" />
        <Button.Label>{running ? 'Simulating…' : 'Simulate Suspicious Traffic'}</Button.Label>
      </Button>
      <Typography.Paragraph className="text-muted mt-4 text-center text-xs">
        Simulated telemetry only. No backend rate limiter is connected and no network traffic is
        generated.
      </Typography.Paragraph>
    </Screen>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between gap-4">
      <Typography.Paragraph className="text-muted text-sm">{label}</Typography.Paragraph>
      <Typography.Paragraph className="flex-1 text-right text-sm font-semibold">
        {value}
      </Typography.Paragraph>
    </View>
  );
}
