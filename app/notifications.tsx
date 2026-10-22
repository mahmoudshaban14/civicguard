import { useEffect, useState } from 'react';
import { View, ScrollView, TouchableOpacity, Text } from 'react-native';
import { Typography } from 'heroui-native';
import { Bell, CheckCircle2, Clock3, ShieldAlert, Award, Clock } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppHeader } from '@/components/civic/AppHeader';
import { Screen } from '@/components/civic/Screen';
import { useCivicGuard } from '@/lib/civicguard-store';

export default function NotificationsScreen() {
  const { notifications } = useCivicGuard();
  const [lang, setLang] = useState<'ar' | 'en'>('ar');

  useEffect(() => {
    async function loadLang() {
      try {
        const savedLang = await AsyncStorage.getItem('@app_language');
        if (savedLang === 'en' || savedLang === 'ar') {
          setLang(savedLang);
        }
      } catch (e) {
        console.error('Error loading language', e);
      }
    }
    loadLang();
  }, []);

  const isAr = lang === 'ar';

  return (
    <Screen>
      <AppHeader
        title={isAr ? 'الإشعارات والتنبيهات' : 'Notifications'}
        eyebrow={isAr ? 'تحديثات مباشرة' : 'UPDATES'}
        showBack
      />

      <ScrollView showsVerticalScrollIndicator={false} className="px-1 pt-2">
        <View className="gap-3 mb-8">
          {notifications.map((item: any) => {
            // استخراج وتحديد البيانات الإضافية إذا توفرت
            const priority = isAr ? item.priorityAr || item.priority : item.priorityEn || item.priority;
            const estimate = isAr ? item.timeEstimateAr || item.timeEstimate : item.timeEstimateEn || item.timeEstimate;
            const title = isAr ? item.titleAr || 'تحديث جديد للبلاغ' : item.titleEn || 'Report update';

            return (
              <View
                key={item.id}
                className={`border-border bg-surface flex-row rounded-3xl border p-4 shadow-sm ${
                  isAr ? 'flex-row-reverse' : ''
                }`}
              >
                {/* الأيقونة الجانبية */}
                <View
                  className={`size-11 items-center justify-center rounded-2xl ${
                    item.read ? 'bg-default' : 'bg-civic-mint'
                  } ${isAr ? 'ml-3' : 'mr-3'}`}
                >
                  {item.type === 'ai_block' ? (
                    <ShieldAlert size={20} color="#E11D48" />
                  ) : item.type === 'reward' ? (
                    <Award size={20} color="#D97706" />
                  ) : item.read ? (
                    <CheckCircle2 size={20} color="#65736F" />
                  ) : (
                    <Bell size={20} color="#167A62" />
                  )}
                </View>

                {/* التفاصيل والوصف */}
                <View className={`flex-1 ${isAr ? 'items-end' : 'items-start'}`}>
                  <Typography.Paragraph className={`text-sm font-bold text-slate-900 ${isAr ? 'text-right' : 'text-left'}`}>
                    {title}
                  </Typography.Paragraph>

                  <Typography.Paragraph className={`text-muted mt-1 text-sm leading-5 ${isAr ? 'text-right' : 'text-left'}`}>
                    {item.text}
                  </Typography.Paragraph>

                  {/* وقت البلاغ */}
                  <View className={`mt-2 flex-row items-center ${isAr ? 'flex-row-reverse' : ''}`}>
                    <Clock3 size={12} color="#65736F" />
                    <Typography.Paragraph className={`text-muted text-xs ${isAr ? 'mr-1' : 'ml-1'}`}>
                      {item.time}
                    </Typography.Paragraph>
                  </View>

                  {/* درجة الأولوية لو موجودة */}
                  {priority && (
                    <View className={`mt-2 flex-row items-center ${isAr ? 'flex-row-reverse' : ''}`}>
                      <View className="px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200">
                        <Text className="text-[10.5px] font-bold text-slate-700">
                          {priority}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* وقت التنفيذ المتوقع SLA لو متوفر */}
                  {estimate && (
                    <View className={`mt-2 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl w-full ${isAr ? 'items-end' : 'items-start'}`}>
                      <Text className="text-[11px] font-semibold color-blue-800">
                        ⏱️ {estimate}
                      </Text>
                    </View>
                  )}
                </View>

                {/* نقطة الإشعار غير المقروء */}
                {!item.read && (
                  <View className={`bg-civic mt-1 size-2 rounded-full ${isAr ? 'mr-2' : 'ml-2'}`} />
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}