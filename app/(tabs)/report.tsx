import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Images, RotateCcw, Check } from 'lucide-react-native';
import { Button, Typography } from 'heroui-native';
import { router } from 'expo-router';

import { AppHeader } from '@/components/civic/AppHeader';
import { SafeAreaView } from '@/components/ui/primitives/SafeAreaView';
import {
  PROTOTYPE_SCENARIOS,
  SAMPLE_IMAGES,
  type PrototypeScenario,
  type SampleImageKey,
} from '@/lib/civicguard-data';
import { useCivicGuard } from '@/lib/civicguard-store';

const samples = PROTOTYPE_SCENARIOS;

export default function ReportScreen() {
  const { updateDraft, resetDraft } = useCivicGuard();
  const [selected, setSelected] = useState<SampleImageKey | null>(null);
  const [customUri, setCustomUri] = useState<string | null>(null);
  const selectSample = (scenario: PrototypeScenario) => {
    setSelected(scenario.imageKey);
    setCustomUri(null);
    updateDraft({
      imageKey: scenario.imageKey,
      scenarioKey: scenario.key,
      imageUri: undefined,
      imageFileName: `${scenario.key}_01.png`,
    });
  };
  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted)
      return Alert.alert(
        'Camera access needed',
        'Allow camera access to capture evidence, or choose a sample below.',
      );
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.75,
      allowsEditing: true,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      setCustomUri(asset.uri);
      setSelected(null);
      updateDraft({
        imageKey: 'pothole',
        scenarioKey: 'custom',
        imageUri: asset.uri,
        imageFileName: asset.fileName ?? 'camera-photo.jpg',
      });
    }
  };
  const choosePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted)
      return Alert.alert('Photo access needed', 'Allow photo access, or choose a sample below.');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      setCustomUri(asset.uri);
      setSelected(null);
      updateDraft({
        imageKey: 'pothole',
        scenarioKey: 'custom',
        imageUri: asset.uri,
        imageFileName: asset.fileName ?? 'gallery-photo.jpg',
      });
    }
  };
  const imageSource = customUri ? { uri: customUri } : selected ? SAMPLE_IMAGES[selected] : null;
  return (
    <SafeAreaView className="bg-background flex-1" edges={['top']}>
      <ScrollView contentContainerClassName="px-5 pb-10" showsVerticalScrollIndicator={false}>
        <AppHeader title="What's happening?" eyebrow="STEP 1 OF 3 · CAPTURE EVIDENCE" />
        {imageSource ? (
          <View className="mb-5">
            <Image
              source={imageSource}
              style={{ width: '100%', height: 255, borderRadius: 28 }}
              resizeMode="cover"
            />
            <View className="absolute top-3 right-3 size-10 items-center justify-center rounded-full bg-white">
              <Check size={20} color="#167A62" />
            </View>
          </View>
        ) : (
          <View className="border-civic/25 bg-civic-mint mb-5 h-52 items-center justify-center rounded-[28px] border-2 border-dashed">
            <Camera size={42} color="#167A62" />
            <Typography.Paragraph className="text-civic-deep mt-3 font-medium">
              Add clear photo evidence
            </Typography.Paragraph>
          </View>
        )}
        <View className="mb-6 flex-row gap-3">
          <Button className="flex-1" onPress={takePhoto}>
            <Camera size={18} color="white" />
            <Button.Label>Take Photo</Button.Label>
          </Button>
          <Button variant="secondary" className="flex-1" onPress={choosePhoto}>
            <Images size={18} color="#167A62" />
            <Button.Label>Gallery</Button.Label>
          </Button>
        </View>
        <Typography.Heading type="h5" className="mb-1">
          Prototype Demonstration Mode
        </Typography.Heading>
        <Typography.Paragraph className="text-muted mb-3 text-xs">
          Choose a predictable civic issue scenario for the presentation.
        </Typography.Paragraph>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-3 pb-4"
        >
          {samples.map((sample) => (
            <Pressable
              key={sample.key}
              onPress={() => selectSample(sample)}
              className={`bg-surface w-28 overflow-hidden rounded-2xl border-2 ${selected === sample.imageKey && !customUri ? 'border-civic' : 'border-transparent'}`}
            >
              <Image
                source={SAMPLE_IMAGES[sample.imageKey]}
                style={{ width: '100%', height: 76 }}
                resizeMode="cover"
              />
              <Typography.Paragraph className="px-2 py-2 text-center text-xs font-medium">
                {sample.label}
              </Typography.Paragraph>
            </Pressable>
          ))}
        </ScrollView>
        {imageSource ? (
          <View className="mt-4 flex-row gap-3">
            <Button
              variant="secondary"
              isIconOnly
              onPress={() => {
                setSelected(null);
                setCustomUri(null);
                resetDraft();
              }}
            >
              <RotateCcw size={19} color="#167A62" />
            </Button>
            <Button className="flex-1" onPress={() => router.push('/report/location')}>
              <Button.Label>Continue</Button.Label>
            </Button>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
