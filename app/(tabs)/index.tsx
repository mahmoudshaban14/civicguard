import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { FileText, MapPin, ShieldCheck, ArrowRight, ArrowLeft, Camera } from 'lucide-react-native';

import { SafeAreaView } from '@/components/ui/primitives/SafeAreaView';
import { useCivicGuard } from '@/lib/civicguard-store';
import { useLanguage } from '@/lib/LanguageContext';

export default function HomeScreen() {
  const { reports } = useCivicGuard();
  const { lang } = useLanguage();

  const totalReports = reports.length;
  const resolvedReports = reports.filter(r => r.status === 'Resolved').length;
  const inProgressReports = totalReports - resolvedReports;

  const t = {
    ar: {
      appName: 'سويفت كير | CivicGuard',
      welcomeSubtitle: 'منصة بلاغات المواطنين الرسمية',
      heroTitle: 'معاً لبيئة مدنية أذكى وأكثر أماناً بمصر',
      heroDesc: 'قم بتوثيق وإرسال البلاغات المدنية للجهات المختصة بضغطة زر واحدة بكل سهولة وذكاء اصطناعي.',
      reportBtn: 'التقاط وتوثيق',
      myReportsBtn: 'سجل بلاغاتي',
      aiFeatureBtn: 'تحليل الذكاء الاصطناعي',
      statsResolved: 'تم حلها',
      statsInProgress: 'قيد المعالجة',
      statsTotal: 'إجمالي البلاغات',
      nearbyTitle: 'البلاغات القريبة منك',
      nearbyDesc: 'استعراض أحدث المشاكل المبلغ عنها في نطاق منطقتك الجغرافية',
      viewAll: 'عرض الكل',
      noNearby: 'لا توجد بلاغات قريبة حالياً',
      textAlign: 'right' as const,
      flexDirection: 'row-reverse' as const,
    },
    en: {
      appName: 'CivicGuard Egypt',
      welcomeSubtitle: 'Official Citizen Reporting Platform',
      heroTitle: 'Together for a smarter and safer civic Egypt',
      heroDesc: 'Document and submit civic issues to the authorities instantly with AI support.',
      reportBtn: 'Capture & Document',
      myReportsBtn: 'My Reports',
      aiFeatureBtn: 'AI Analysis',
      statsResolved: 'Resolved',
      statsInProgress: 'In Progress',
      statsTotal: 'Total Reports',
      nearbyTitle: 'Nearby Issues',
      nearbyDesc: 'Explore recent reported issues within your geographic range',
      viewAll: 'View All',
      noNearby: 'No nearby reports available',
      textAlign: 'left' as const,
      flexDirection: 'row' as const,
    },
  }[lang];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        
        {/* الهيدر العلوي */}
        <View style={{ flexDirection: t.flexDirection, justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <View>
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#0F172A', textAlign: t.textAlign }}>
              {t.appName}
            </Text>
            <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2, textAlign: t.textAlign }}>
              {t.welcomeSubtitle}
            </Text>
          </View>
          <View style={{ backgroundColor: '#EFF6FF', padding: 10, borderRadius: 14 }}>
            <ShieldCheck size={24} color="#1E3A8A" />
          </View>
        </View>

        {/* الكارت الرئيسي الأزرق (Hero Card) */}
        <View
          style={{
            backgroundColor: '#1E3A8A',
            borderRadius: 24,
            padding: 24,
            marginBottom: 16,
            elevation: 4,
            shadowColor: '#1E3A8A',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
          }}
        >
          <Text style={{ color: '#93C5FD', fontSize: 12, fontWeight: '700', marginBottom: 8, textAlign: t.textAlign, textTransform: 'uppercase' }}>
            {lang === 'ar' ? 'مبادرة تحسين الخدمات المصرية' : 'Egypt Civic Initiative'}
          </Text>
          <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginBottom: 10, textAlign: t.textAlign, lineHeight: 30 }}>
            {t.heroTitle}
          </Text>
          <Text style={{ color: '#E2E8F0', fontSize: 13, marginBottom: 20, textAlign: t.textAlign, lineHeight: 20 }}>
            {t.heroDesc}
          </Text>

          {/* أزرار سريعة جوه الكارت (تيك فوتو، سابميت، والذكاء الاصطناعي) */}
          <View style={{ flexDirection: 'column', gap: 10 }}>
            <View style={{ flexDirection: t.flexDirection, gap: 10 }}>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/report')}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 14,
                  paddingVertical: 12,
                  paddingHorizontal: 12,
                  flex: 1,
                  flexDirection: t.flexDirection,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Camera size={18} color="#1E3A8A" style={{ [lang === 'ar' ? 'marginLeft' : 'marginRight']: 6 }} />
                <Text style={{ color: '#1E3A8A', fontWeight: '700', fontSize: 12.5 }}>
                  {t.reportBtn}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push('/(tabs)/reports')}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  borderRadius: 14,
                  paddingVertical: 12,
                  paddingHorizontal: 12,
                  flex: 1,
                  flexDirection: t.flexDirection,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                }}
              >
                <FileText size={18} color="#FFFFFF" style={{ [lang === 'ar' ? 'marginLeft' : 'marginRight']: 6 }} />
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 12.5 }}>
                  {t.myReportsBtn}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* كارت الإحصائيات السريعة */}
        <View
          style={{
            flexDirection: t.flexDirection,
            backgroundColor: '#FFFFFF',
            borderRadius: 20,
            padding: 16,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: '#E2E8F0',
            justifyContent: 'space-between',
            elevation: 1,
          }}
        >
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#16A34A' }}>{resolvedReports}</Text>
            <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '600', marginTop: 2 }}>{t.statsResolved}</Text>
          </View>
          <View style={{ width: 1, backgroundColor: '#E2E8F0', height: '80%', alignSelf: 'center' }} />
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#D97706' }}>{inProgressReports}</Text>
            <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '600', marginTop: 2 }}>{t.statsInProgress}</Text>
          </View>
          <View style={{ width: 1, backgroundColor: '#E2E8F0', height: '80%', alignSelf: 'center' }} />
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#1E3A8A' }}>{totalReports}</Text>
            <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '600', marginTop: 2 }}>{t.statsTotal}</Text>
          </View>
        </View>

        {/* قسم البلاغات القريبة */}
        <View style={{ marginTop: 5 }}>
          <View style={{ flexDirection: t.flexDirection, justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A', textAlign: t.textAlign }}>
              {t.nearbyTitle}
            </Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/map' as any)}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E3A8A' }}>
                {t.viewAll}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 14, textAlign: t.textAlign }}>
            {t.nearbyDesc}
          </Text>

          {reports.length === 0 ? (
            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 20,
                padding: 24,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: '#E2E8F0',
              }}
            >
              <MapPin size={32} color="#94A3B8" />
              <Text style={{ color: '#64748B', fontWeight: '600', marginTop: 8, fontSize: 13, textAlign: 'center' }}>
                {t.noNearby}
              </Text>
            </View>
          ) : (
            reports.slice(0, 2).map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => router.push({ pathname: '/reports/[id]', params: { id: item.id } })}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  flexDirection: t.flexDirection,
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  elevation: 1,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A', textAlign: t.textAlign, marginBottom: 4 }}>
                    {item.category}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#64748B', textAlign: t.textAlign }} numberOfLines={1}>
                    {item.description}
                  </Text>
                </View>
                {lang === 'ar' ? <ArrowLeft size={18} color="#94A3B8" /> : <ArrowRight size={18} color="#94A3B8" />}
              </TouchableOpacity>
            ))
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}