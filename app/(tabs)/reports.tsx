import { router } from 'expo-router';
import { Typography } from 'heroui-native';
import { FlatList, RefreshControl, View } from 'react-native';
import { useState } from 'react';
import { AppHeader } from '@/components/civic/AppHeader';
import { ReportCard } from '@/components/civic/ReportCard';
import { SafeAreaView } from '@/components/ui/primitives/SafeAreaView';
import { useCivicGuard } from '@/lib/civicguard-store';

export default function ReportsScreen() {
  const { reports } = useCivicGuard();
  const [refreshing, setRefreshing] = useState(false);
  return (
    <SafeAreaView className="bg-background flex-1" edges={['top']}>
      <FlatList
        data={reports}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-5 pb-8"
        ListHeaderComponent={
          <>
            <AppHeader title="My Reports" />
            <Typography.Paragraph className="text-muted mb-5 text-sm">
              {reports.length} reports in Demo Mode
            </Typography.Paragraph>
          </>
        }
        renderItem={({ item }) => (
          <ReportCard
            report={item}
            onPress={() => router.push({ pathname: '/reports/[id]', params: { id: item.id } })}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              setTimeout(() => setRefreshing(false), 600);
            }}
            tintColor="#167A62"
          />
        }
        ListEmptyComponent={
          <View className="items-center py-20">
            <Typography.Heading type="h5">No reports yet</Typography.Heading>
          </View>
        }
      />
    </SafeAreaView>
  );
}
