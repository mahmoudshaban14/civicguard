import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { analyzeCivicImage, type CivicAnalysisResult } from '@/lib/civicguard-ai';
import {
  CIVIC_ISSUE_CATEGORIES,
  type CivicIssueCategory,
  type CivicIssueId,
} from '@/lib/civicguard-categories';
import {
  type CivicReport,
  type ReportStatus,
  type SampleImageKey,
  type Severity,
} from '@/lib/civicguard-data';
import { supabase } from '@/lib/supabase';

export interface DraftReport {
  imageKey: SampleImageKey;
  scenarioKey: CivicIssueId | 'custom';
  imageUri?: string;
  imageFileName?: string;
  description: string;
  latitude: number;
  longitude: number;
  area: string;
}

export interface NotificationItem {
  id: string;
  type?: 'ai_block' | 'in_progress' | 'resolved' | 'reward' | 'info';
  titleAr?: string;
  titleEn?: string;
  text: string;
  textEn?: string;
  priorityAr?: string;
  priorityEn?: string;
  priorityColor?: string;
  timeEstimateAr?: string;
  timeEstimateEn?: string;
  time: string;
  read: boolean;
}

interface CivicGuardStore {
  reports: CivicReport[];
  notifications: NotificationItem[];
  draft: DraftReport;
  analysisResult: CivicAnalysisResult | null;
  lastSubmittedReport: CivicReport | null;
  loading: boolean;
  updateDraft: (next: Partial<DraftReport>) => void;
  resetDraft: () => void;
  analyzeDraft: (preferredCategory?: CivicIssueCategory) => Promise<CivicAnalysisResult>;
  submitDraft: () => Promise<CivicReport | null>;
  fetchReports: () => Promise<void>;
  updateStatus: (id: string, status: ReportStatus) => void;
  advanceReportStatus: (id: string) => void;
  markNotificationsRead: () => void;
  resetDemo: () => void;
}

const DEFAULT_DRAFT: DraftReport = {
  imageKey: 'pothole',
  scenarioKey: 'pothole',
  description: '',
  latitude: 30.0074,
  longitude: 31.4913,
  area: 'New Cairo',
};

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: '1',
    type: 'in_progress',
    titleAr: 'جاري العمل على البلاغ 🛠️',
    titleEn: 'Report In Progress 🛠️',
    text: 'تم استلام بلاغك رقم #CG-2026-1042 وتحويله لطاقم صيانة الطرق.',
    textEn: 'Your report #CG-2026-1042 has been assigned to the Road Maintenance Team.',
    priorityAr: 'أولوية عالية (High Priority)',
    priorityEn: 'High Priority',
    priorityColor: '#DC2626',
    timeEstimateAr: 'الوقت المتوقع للحل: 3 - 5 أيام',
    timeEstimateEn: 'Est. Resolution: 3 - 5 days',
    time: 'منذ ساعتين',
    read: false,
  },
  {
    id: '2',
    type: 'reward',
    titleAr: 'تهانينا! كسبت +50 نقطة 🏆',
    titleEn: 'Congrats! +50 Civic Points 🏆',
    text: 'تم إغلاق البلاغ رقم #CG-2026-0980 بنجاح. شكراً لمساهمتك الإيجابية!',
    textEn: 'Report #CG-2026-0980 resolved successfully. Thank you for your contribution!',
    time: 'أمس',
    read: false,
  },
  {
    id: '3',
    type: 'ai_block',
    titleAr: 'تنبيه ذكاء اصطناعي 🤖',
    titleEn: 'AI Safety Alert 🤖',
    text: 'تم رفض الصورة المرفقة بواسطة الـ AI نظراً لعدم وضوح المعالم أو مخالفة الشروط.',
    textEn: 'Image rejected by AI safety filter due to low quality or non-compliance.',
    priorityAr: 'مرفوض آلياً (AI Rejected)',
    priorityEn: 'AI Rejected',
    priorityColor: '#E11D48',
    time: 'منذ يومين',
    read: true,
  },
  {
    id: '4',
    type: 'resolved',
    titleAr: 'تم حل المشكلة بالكامل ✅',
    titleEn: 'Issue Resolved ✅',
    text: 'إنهاء أعمال صيانة أعمدة الإنارة المقطوعة في شارع النصر.',
    textEn: 'Emergency team completed streetlight repairs at Al-Nasr St.',
    priorityAr: 'أولوية متوسطة (Medium Priority)',
    priorityEn: 'Medium Priority',
    priorityColor: '#D97706',
    time: 'منذ 3 أيام',
    read: true,
  },
];

const CivicGuardContext = createContext<CivicGuardStore | null>(null);

function formatReportDate(dateString?: string) {
  const d = dateString ? new Date(dateString) : new Date();
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
  }).format(d);
}

export function CivicGuardProvider({ children }: PropsWithChildren) {
  const [reports, setReports] = useState<CivicReport[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [draft, setDraftState] = useState(DEFAULT_DRAFT);
  const [analysisResult, setAnalysisResult] = useState<CivicAnalysisResult | null>(null);
  const [lastSubmittedReport, setLastSubmittedReport] = useState<CivicReport | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching reports:', error);
      } else if (data) {
        const formattedReports: CivicReport[] = data.map((item) => ({
          id: item.report_code || item.id,
          category: item.category || 'Other / Unrecognized Civic Issue',
          severity: (item.severity as Severity) || 'Medium',
          confidence: item.confidence || 0,
          status: (item.status as ReportStatus) || 'Reported',
          department: item.department || 'Manual Routing',
          area: 'Current Location',
          latitude: item.latitude || 30.0074,
          longitude: item.longitude || 31.4913,
          distance: '250m',
          date: formatReportDate(item.created_at),
          description: item.description || '',
          imageKey: 'pothole',
          imageUri: item.image_path || undefined,
        }));
        setReports(formattedReports);
      }
    } catch (err) {
      console.error('Fetch exception:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const updateDraft = useCallback((next: Partial<DraftReport>) => {
    setDraftState((current) => ({ ...current, ...next }));
    setAnalysisResult(null);
    setLastSubmittedReport(null);
  }, []);

  const resetDraft = useCallback(() => {
    setDraftState(DEFAULT_DRAFT);
    setAnalysisResult(null);
    setLastSubmittedReport(null);
  }, []);

  const analyzeDraft = useCallback(
    async (preferredCategory?: CivicIssueCategory) => {
      const result = await analyzeCivicImage(
        {
          imageKey: draft.imageKey,
          scenarioKey: draft.scenarioKey,
          uri: draft.imageUri,
          fileName: draft.imageFileName,
        },
        draft.description,
        { latitude: draft.latitude, longitude: draft.longitude, area: draft.area },
        preferredCategory,
      );
      setAnalysisResult(result);
      return result;
    },
    [draft],
  );

  const submitDraft = useCallback(async () => {
    const analysis = analysisResult;
    const rawSeverity = analysis?.severity ?? 'Medium';
    const safeSeverity = rawSeverity === 'Requires Review' ? 'Medium' : rawSeverity;
    const category = analysis?.category ?? 'Other / Unrecognized Civic Issue';
    const department = analysis?.department ?? 'Manual Routing';

    const rawConfidence = analysis?.confidence ?? 0.54;
    const safeConfidence = rawConfidence > 1 ? rawConfidence / 100 : rawConfidence;

    const isLowConfidence = safeConfidence < 0.70 || department === 'Manual Routing';
    const needsManualReview = isLowConfidence || category.includes('Unrecognized');
    const dbStatus = needsManualReview ? 'manual_review_required' : 'submitted';

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('User not logged in');
        return null;
      }

      let publicImageUrl: string | null = null;

      if (draft.imageUri) {
        try {
          const fileExt = draft.imageUri.split('.').pop() || 'jpg';
          const fileName = `${user.id}/${Date.now()}.${fileExt}`;

          const response = await fetch(draft.imageUri);
          const blob = await response.blob();

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('reports')
            .upload(fileName, blob, {
              contentType: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
              upsert: true,
            });

          if (!uploadError && uploadData) {
            const { data: publicUrlData } = supabase.storage
              .from('reports')
              .getPublicUrl(fileName);

            publicImageUrl = publicUrlData.publicUrl;
          }
        } catch (imgErr) {
          console.error('Image upload exception:', imgErr);
        }
      }

      const generatedCode = `CG-2026-${String(Math.floor(10000 + Math.random() * 90000))}`;

      const { data, error } = await supabase
        .from('reports')
        .insert([
          {
            user_id: user.id,
            report_code: generatedCode,
            category: category,
            severity: safeSeverity,
            confidence: safeConfidence,
            department: department,
            latitude: draft.latitude,
            longitude: draft.longitude,
            description: draft.description || analysis?.explanation || 'Submitted for manual review.',
            image_path: publicImageUrl || draft.imageUri || null,
            explanation: analysis?.explanation || '',
            requires_manual_review: needsManualReview,
            status: dbStatus,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error('Supabase Insert Error:', error);
        return null;
      }

      const newReport: CivicReport = {
        id: data.report_code || data.id,
        category: data.category,
        severity: data.severity as Severity,
        confidence: data.confidence,
        status: data.status as ReportStatus,
        department: data.department,
        area: draft.area,
        latitude: draft.latitude,
        longitude: draft.longitude,
        distance: '250m',
        date: formatReportDate(data.created_at),
        description: data.description,
        imageKey: draft.imageKey,
        imageUri: publicImageUrl || draft.imageUri,
      };

      setReports((current) => [newReport, ...current]);
      setLastSubmittedReport(newReport);

      setNotifications((current) => [
        {
          id: `submitted-${Date.now()}`,
          type: 'info',
          titleAr: 'تم تقديم البلاغ بنجاح 📝',
          titleEn: 'Report Submitted Successfully 📝',
          text: `تم استلام بلاغك رقم ${newReport.id} وهو قيد المراجعة الآن.`,
          textEn: `Report ${newReport.id} was submitted successfully and is under review.`,
          priorityAr: 'قيد المراجعة (Under Review)',
          priorityEn: 'Under Review',
          priorityColor: '#2563EB',
          time: 'الآن (Just now)',
          read: false,
        },
        ...current,
      ]);

      return newReport;
    } catch (err) {
      console.error('Submit exception:', err);
      return null;
    }
  }, [analysisResult, draft]);

  const updateStatus = useCallback((id: string, status: ReportStatus) => {
    setReports((current) =>
      current.map((report) => (report.id === id ? { ...report, status } : report)),
    );
    setNotifications((current) => [
      {
        id: `status-${Date.now()}`,
        type: status === 'Resolved' ? 'resolved' : 'in_progress',
        titleAr: `تحديث حالة البلاغ #${id}`,
        titleEn: `Status Updated for #${id}`,
        text: `تغيرت حالة البلاغ رقم ${id} إلى: ${status}.`,
        textEn: `Your report ${id} is now ${status}.`,
        time: 'الآن (Just now)',
        read: false,
      },
      ...current,
    ]);
  }, []);

  const advanceReportStatus = useCallback(
    (id: string) => {
      const statuses: ReportStatus[] = ['Reported', 'Assigned', 'In Progress', 'Resolved'];
      const report = reports.find((item) => item.id === id);
      if (!report) return;
      const nextStatus =
        statuses[Math.min(statuses.indexOf(report.status) + 1, statuses.length - 1)];
      if (nextStatus !== report.status) updateStatus(id, nextStatus);
    },
    [reports, updateStatus],
  );

  const markNotificationsRead = useCallback(() => {
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
  }, []);

  const resetDemo = useCallback(() => {
    fetchReports();
    setDraftState(DEFAULT_DRAFT);
    setAnalysisResult(null);
    setLastSubmittedReport(null);
  }, [fetchReports]);

  const value = useMemo(
    () => ({
      reports,
      notifications,
      draft,
      analysisResult,
      lastSubmittedReport,
      loading,
      updateDraft,
      resetDraft,
      analyzeDraft,
      submitDraft,
      fetchReports,
      updateStatus,
      advanceReportStatus,
      markNotificationsRead,
      resetDemo,
    }),
    [
      advanceReportStatus,
      analysisResult,
      analyzeDraft,
      draft,
      fetchReports,
      lastSubmittedReport,
      loading,
      markNotificationsRead,
      notifications,
      refreshReports,
      reports,
      resetDemo,
      resetDraft,
      submitDraft,
      updateDraft,
      updateStatus,
    ],
  );

  return <CivicGuardContext.Provider value={value}>{children}</CivicGuardContext.Provider>;
}

export function useCivicGuard() {
  const store = useContext(CivicGuardContext);
  if (!store) throw new Error('useCivicGuard must be used inside CivicGuardProvider');
  return store;
}