import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { Bell, ChevronRight, MapPin, Plus, ShieldCheck } from 'lucide-react-native';
import { Button, Typography } from 'heroui-native';
import { router } from 'expo-router';

import { SafeAreaView } from '@/components/ui/primitives/SafeAreaView';
import { LinearGradient } from '@/components/ui/primitives/LinearGradient';
import { ReportCard } from '@/components/civic/ReportCard';
import { useCivicGuard } from '@/lib/civicguard-store';

export default function HomeScreen() {
  const { reports, notifications, refreshReports, isLoading } = useCivicGuard();
  const [refreshing, setRefreshing] = useState(false);
  const unread = notifications.filter((item) => !item.read).length;

  const refresh = async () => {
    setRefreshing(true);
    await refreshReports().catch(() => {});
    setRefreshing(false);
  };

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top']}>
      <ScrollView
        contentContainerClassName="px-5 pb-8"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#167A62" />
        }
      >
        <View className="flex-row items-center justify-between pt-3 pb-5">
          <View>
            <Typography.Heading type="h2" className="text-civic-deep">
              CivicGuard
            </Typography.Heading>
            <Typography.Paragraph className="text-muted mt-1 text-sm">
              Report. Track. Improve your street.
            </Typography.Paragraph>
          </View>
          <Button
            isIconOnly
            variant="secondary"
            onPress={() => router.push('/notifications')}
            className="rounded-full"
          >
            <Bell size={20} color="#167A62" />
            {unread ? (
              <View className="bg-civic-orange absolute top-2 right-2 size-2 rounded-full" />
            ) : null}
          </Button>
        </View>

        <LinearGradient
          colors={['#12362F', '#1D6B59']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="mb-6 overflow-hidden rounded-[28px] p-5"
        >
          <View className="mb-7 size-11 items-center justify-center rounded-2xl bg-white/15">
            <MapPin size={23} color="#FFFFFF" />
          </View>
          <Typography.Heading type="h3" className="max-w-[260px] text-white">
            Make your street safer in minutes.
          </Typography.Heading>
          <Button
            className="mt-5 self-start bg-white"
            onPress={() => router.push('/(tabs)/report')}
          >
            <Plus size={18} color="#12362F" />
            <Button.Label className="text-civic-deep">Report a Problem</Button.Label>
          </Button>
        </LinearGradient>

        <View className="mb-6 flex-row gap-3">
          {[
            ['My Reports', reports.length],
            ['Resolved', reports.filter((r) => r.status === 'Resolved').length],
            ['In Progress', reports.filter((r) => r.status === 'In Progress').length],
          ].map(([label, value]) => (
            <View
              key={String(label)}
              className="border-border bg-surface flex-1 rounded-2xl border px-3 py-4"
            >
              <Typography.Heading type="h4" className="text-civic-deep">
                {value}
              </Typography.Heading>
              <Typography.Paragraph className="text-muted mt-1 text-xs">
                {label}
              </Typography.Paragraph>
            </View>
          ))}
        </View>

        <View className="mb-3 flex-row items-center justify-between">
          <Typography.Heading type="h4">Nearby Issues</Typography.Heading>
          <Button size="sm" variant="ghost" onPress={() => router.push('/(tabs)/map')}>
            <Button.Label>View map</Button.Label>
            <ChevronRight size={16} color="#167A62" />
          </Button>
        </View>
        {reports.slice(0, 3).map((report) => (
          <ReportCard
            key={report.id}
            report={report}
            compact
            onPress={() => router.push({ pathname: '/reports/[id]', params: { id: report.id } })}
          />
        ))}

        <Button variant="secondary" className="mt-2" onPress={() => router.push('/security')}>
          <ShieldCheck size={19} color="#167A62" />
          <Button.Label>Open Security Center</Button.Label>
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
