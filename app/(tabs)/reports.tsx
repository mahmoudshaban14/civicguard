import { router } from 'expo-router';
import { FlatList, RefreshControl, View, Text } from 'react-native';
import { useState } from 'react';
import { ClipboardList } from 'lucide-react-native';

import { ReportCard } from '@/components/civic/ReportCard';
import { SafeAreaView } from '@/components/ui/primitives/SafeAreaView';
import { useCivicGuard } from '@/lib/civicguard-store';
import { useLanguage } from '@/lib/LanguageContext';

export default function ReportsScreen() {
   const { reports, refreshReports, fetchError } = useCivicGuard();
   const [refreshing, setRefreshing] = useState(false);
   const { lang } = useLanguage();

  const t = {
    ar: {
      title: 'بلاغاتي',
      subtitle: `${reports.length} بلاغات مسجلة`,
      noReports: 'لا توجد بلاغات حتى الآن',
      loadError: 'تعذّر تحميل البلاغات. اسحب للأسفل لإعادة المحاولة.',
      textAlign: 'right' as const,
    },
    en: {
      title: 'My Reports',
      subtitle: `${reports.length} reports registered`,
      noReports: 'No reports yet',
      loadError: 'Could not load reports. Pull down to retry.',
      textAlign: 'left' as const,
    },
  }[lang];

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top']}>
      <FlatList
        data={reports}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        ListHeaderComponent={
          <View style={{ marginBottom: 20, width: '100%' }}>
            {/* العنوان الرئيسي محاذاته تتغير تماماً حسب اللغة */}
            <Text
              style={{
                fontSize: 26,
                fontWeight: '800',
                color: '#0F172A',
                textAlign: t.textAlign,
                marginBottom: 4,
              }}
            >
              {t.title}
            </Text>
            {/* النص الفرعي */}
            <Text
              style={{
                fontSize: 13,
                color: '#64748B',
                textAlign: t.textAlign,
              }}
            >
              {t.subtitle}
            </Text>
          </View>
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
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await refreshReports();
              } finally {
                setRefreshing(false);
              }
            }}
            tintColor="#1E3A8A"
          />
        }
        ListEmptyComponent={
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 20,
              padding: 30,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: '#E2E8F0',
              marginTop: 10,
              elevation: 2,
            }}
          >
            <ClipboardList size={42} color="#1E3A8A" />
            <Text
              style={{
                color: '#0F172A',
                fontWeight: '700',
                marginTop: 12,
                fontSize: 15,
                textAlign: 'center',
              }}
            >
              {fetchError ? t.loadError : t.noReports}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}