import { useEffect, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { Check, Cpu } from 'lucide-react-native';
import { Typography } from 'heroui-native';
import { router } from 'expo-router';
import { SafeAreaView } from '@/components/ui/primitives/SafeAreaView';
import { useCivicGuard } from '@/lib/civicguard-store';

const steps = [
  'Analyzing image...',
  'Detecting problem...',
  'Checking location...',
  'Checking duplicate reports...',
  'Determining responsible department...',
];
export default function AnalyzingScreen() {
  const { analyzeDraft } = useCivicGuard();
  const [active, setActive] = useState(0);
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut((v) => Easing.ease(v)),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut((v) => Easing.ease(v)),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);
  useEffect(() => {
    void analyzeDraft();
    const interval = setInterval(
      () => setActive((value) => Math.min(value + 1, steps.length)),
      650,
    );
    const done = setTimeout(() => {
      void analysis.then(() => router.replace('/report/result'));
    }, 3900);
    return () => {
      clearInterval(interval);
      clearTimeout(done);
    };
  }, [analyzeDraft]);
  return (
    <SafeAreaView className="bg-civic-deep flex-1 px-6" edges={['top', 'bottom']}>
      <View className="flex-1 items-center justify-center">
        <Animated.View
          style={{
            transform: [
              { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) },
            ],
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }),
          }}
          className="mb-8 size-24 items-center justify-center rounded-[32px] bg-white/15"
        >
          <Cpu size={42} color="white" />
        </Animated.View>
        <Typography.Heading type="h3" className="text-center text-white">
          AI Analysis — Vision Model
        </Typography.Heading>
        <Typography.Paragraph className="mt-2 text-center text-sm text-white/60">
          Municipal Vision Analysis
        </Typography.Paragraph>
        <View className="mt-10 w-full gap-4">
          {steps.map((step, index) => (
            <View key={step} className="flex-row items-center">
              <View
                className={`mr-3 size-7 items-center justify-center rounded-full ${index < active ? 'bg-civic-lime' : index === active ? 'bg-white' : 'bg-white/10'}`}
              >
                {index < active ? (
                  <Check size={15} color="#12362F" />
                ) : (
                  <View
                    className={`size-2 rounded-full ${index === active ? 'bg-civic' : 'bg-white/25'}`}
                  />
                )}
              </View>
              <Typography.Paragraph className={index <= active ? 'text-white' : 'text-white/35'}>
                {step}
              </Typography.Paragraph>
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}
