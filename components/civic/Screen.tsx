import type { PropsWithChildren, ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from '@/components/ui/primitives/SafeAreaView';

export function Screen({
  children,
  scroll = true,
  footer,
}: PropsWithChildren<{ scroll?: boolean; footer?: ReactNode }>) {
  const body = scroll ? (
    <ScrollView
      className="flex-1"
      contentContainerClassName="px-5 pb-8"
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View className="flex-1">{children}</View>
  );

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {body}
        {footer ? (
          <View className="border-border bg-background pb-safe-or-4 border-t px-5 pt-3">
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
