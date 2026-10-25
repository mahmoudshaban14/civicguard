import { useMemo, useState, useCallback } from 'react';
import { View } from 'react-native';
import { BottomSheet, Button, Typography } from 'heroui-native';
import { router, useFocusEffect } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import MapView, { type MapMarker } from '@/components/MapView';
import { AppHeader } from '@/components/civic/AppHeader';
import { StatusBadge } from '@/components/civic/StatusBadge';
import { SafeAreaView } from '@/components/ui/primitives/SafeAreaView';
import { NEW_CAIRO_REGION, SEVERITY_COLORS, type CivicReport } from '@/lib/civicguard-data';
import { useCivicGuard } from '@/lib/civicguard-store';

export default function IssuesMapScreen() {
  const { reports } = useCivicGuard();
  const [selected, setSelected] = useState<CivicReport | null>(null);
  const [lang, setLang] = useState<'ar' | 'en'>('ar');

  // جلب وتحديث اللغة فوراً عند فتح أو التركيز على الشاشة
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      async function checkLanguage() {
        try {
          const savedLang = await AsyncStorage.getItem('@app_language');
          if (isMounted && (savedLang === 'en' || savedLang === 'ar')) {
            setLang(savedLang);
          }
        } catch (e) {
          console.error('Error loading language in IssuesMapScreen:', e);
        }
      }
      checkLanguage();
      return () => {
        isMounted = false;
      };
    }, [])
  );

  const t = {
    ar: {
      title: 'خريطة البلاغات',
      eyebrow: 'القاهرة الجديدة · وضع العرض التجريبي',
      tapPrompt: 'اضغط على العلامة لعرض التفاصيل',
      distanceLabel: 'المسافة',
      statusLabel: 'الحالة',
      viewReportBtn: 'عرض البلاغ',
      levels: {
        Low: 'منخفض',
        Medium: 'متوسط',
        High: 'مرتفع',
        Critical: 'حرج',
      },
    },
    en: {
      title: 'Issue Map',
      eyebrow: 'NEW CAIRO · DEMO MODE',
      tapPrompt: 'Tap a marker to view details',
      distanceLabel: 'Distance',
      statusLabel: 'Status',
      viewReportBtn: 'View Report',
      levels: {
        Low: 'Low',
        Medium: 'Medium',
        High: 'High',
        Critical: 'Critical',
      },
    },
  }[lang];

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
        <AppHeader title={t.title} eyebrow={t.eyebrow} />
      </View>
      
      {/* مستويات الخطورة */}
      <View className="mx-5 mb-4 flex-row gap-2 flex-wrap">
        {(['Low', 'Medium', 'High', 'Critical'] as const).map((level) => (
          <View key={level} className="flex-row items-center gap-1.5">
            <View
              className="size-2.5 rounded-full"
              style={{ backgroundColor: SEVERITY_COLORS[level] }}
            />
            <Typography.Paragraph className="text-muted text-[10px]">
              {t.levels[level]}
            </Typography.Paragraph>
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
          {t.tapPrompt}
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
                  <Info label={t.distanceLabel} value={selected.distance} />
                  <Info label={t.statusLabel} value={selected.status} />
                </View>
                <Button
                  onPress={() => {
                    setSelected(null);
                    router.push({ pathname: '/reports/[id]', params: { id: selected.id } });
                  }}
                >
                  <Button.Label>{t.viewReportBtn}</Button.Label>
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