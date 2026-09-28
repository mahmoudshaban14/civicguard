import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Button, TextArea, Typography } from 'heroui-native';
import { Sparkles } from 'lucide-react-native';
import { router } from 'expo-router';
import { AppHeader } from '@/components/civic/AppHeader';
import { SafeAreaView } from '@/components/ui/primitives/SafeAreaView';
import { useCivicGuard } from '@/lib/civicguard-store';

export default function DescriptionScreen() {
  const { draft, updateDraft } = useCivicGuard();
  return (
    <SafeAreaView className="bg-background flex-1" edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerClassName="flex-grow px-5 pb-6"
          keyboardShouldPersistTaps="handled"
        >
          <AppHeader title="Tell us more" eyebrow="STEP 3 OF 3 · DETAILS" showBack />
          <Typography.Paragraph className="mb-3 font-medium">
            Description{' '}
            <Typography.Paragraph className="text-muted">(optional)</Typography.Paragraph>
          </Typography.Paragraph>
          <TextArea
            value={draft.description}
            onChangeText={(description) => updateDraft({ description })}
            placeholder="Describe the problem..."
            className="min-h-36"
          />
          <View className="border-civic/15 bg-civic-mint mt-6 rounded-3xl border p-5">
            <View className="mb-3 size-10 items-center justify-center rounded-2xl bg-white">
              <Sparkles size={20} color="#167A62" />
            </View>
            <Typography.Heading type="h5">Category</Typography.Heading>
            <Typography.Paragraph className="text-muted mt-2 text-sm">
              AI will automatically identify the problem.
            </Typography.Paragraph>
            <View className="mt-4 self-start rounded-full bg-white px-3 py-2">
              <Typography.Paragraph className="text-civic text-xs font-semibold">
                AI Analysis · Prototype
              </Typography.Paragraph>
            </View>
          </View>
          <View className="flex-1" />
          <Button className="mt-8" onPress={() => router.push('/report/analyzing')}>
            <Sparkles size={18} color="white" />
            <Button.Label>Analyze Report</Button.Label>
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
