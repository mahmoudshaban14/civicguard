import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { BottomSheet, Button, Typography } from 'heroui-native';
import { router } from 'expo-router';
import { MapPin } from 'lucide-react-native';

import MapView, { type MapMarker } from '@/components/MapView';
import { AppHeader } from '@/components/civic/AppHeader';
import { StatusBadge } from '@/components/civic/StatusBadge';
import { SafeAreaView } from '@/components/ui/primitives/SafeAreaView';
import { NEW_CAIRO_REGION, SEVERITY_COLORS, type CivicReport } from '@/lib/civicguard-data';
import { useCivicGuard } from '@/lib/civicguard-store';

export default function IssuesMapScreen() {
  const { reports } = useCivicGuard();
  const [selected, setSelected] = useState<CivicReport | null>(null);
  const markers = useMemo<MapMarker[]>(
    () =>
      reports.map((report) => ({
        id: report.id,
        coordinate: { latitude: report.latitude, longitude: report.longitude },
        title: report.category,
        description: `${report.severity} · ${report.status}`,
        color: SEVERITY_COLORS[report.severity],
        onPress: () => setSelected(report),
      })),
    [reports],
  );

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top']}>
      <View className="px-5">
        <AppHeader title="Issue Map" eyebrow="NEW CAIRO · DEMO MODE" />
      </View>
      <View className="mx-5 mb-4 flex-row gap-2">
        {(['Low', 'Medium', 'High', 'Critical'] as const).map((level) => (
          <View key={level} className="flex-row items-center gap-1.5">
            <View
              className="size-2.5 rounded-full"
              style={{ backgroundColor: SEVERITY_COLORS[level] }}
            />
            <Typography.Paragraph className="text-muted text-[10px]">{level}</Typography.Paragraph>
          </View>
        ))}
      </View>
      <View className="border-border mx-5 flex-1 overflow-hidden rounded-[28px] border">
        <MapView
          initialRegion={NEW_CAIRO_REGION}
          markers={markers}
          showsUserLocation
          loadingEnabled
          style={{ flex: 1 }}
        />
      </View>
      <View className="bg-surface mx-5 my-3 flex-row items-center justify-center gap-2 rounded-full py-2">
        <MapPin size={14} color="#167A62" />
        <Typography.Paragraph className="text-muted text-xs">
          Tap a marker to view details
        </Typography.Paragraph>
      </View>

      <BottomSheet
        isOpen={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <BottomSheet.Portal>
          <BottomSheet.Overlay />
          <BottomSheet.Content>
            {selected ? (
              <View className="gap-4 px-1 pb-3">
                <View className="flex-row items-start justify-between">
                  <View>
                    <BottomSheet.Title>{selected.category}</BottomSheet.Title>
                    <BottomSheet.Description>{selected.id}</BottomSheet.Description>
                  </View>
                  <StatusBadge value={selected.severity} type="severity" />
                </View>
                <View className="bg-default flex-row rounded-2xl p-4">
                  <Info label="Distance" value={selected.distance} />
                  <Info label="Status" value={selected.status} />
                </View>
                <Button
                  onPress={() => {
                    setSelected(null);
                    router.push({ pathname: '/reports/[id]', params: { id: selected.id } });
                  }}
                >
                  <Button.Label>View Report</Button.Label>
                </Button>
              </View>
            ) : null}
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>
    </SafeAreaView>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1">
      <Typography.Paragraph className="text-muted text-xs">{label}</Typography.Paragraph>
      <Typography.Paragraph className="mt-1 text-sm font-semibold">{value}</Typography.Paragraph>
    </View>
  );
}
