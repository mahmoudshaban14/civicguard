import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { analyzeCivicImage, type CivicAnalysisResult } from '@/lib/civicguard-ai';
import { analyzeWithGemini, getAccessToken, uploadReportImage } from '@/lib/civicguard-ai-remote';
import { apiClient } from '@/lib/api-client';
import { type CivicIssueCategory, type CivicIssueId } from '@/lib/civicguard-categories';
import { type CivicReport, type ReportStatus, type SampleImageKey } from '@/lib/civicguard-data';
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
  submitDraft: (overrideDraft?: Partial<DraftReport>) => Promise<CivicReport | null>;
  fetchReports: () => Promise<void>;
  refreshReports: () => Promise<void>;
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
}

function mapDbStatusToReportStatus(status?: string | null): ReportStatus {
  switch (status) {
    case 'assigned':
    case 'under_review': {
      return 'Assigned';
    }
    case 'escalated':
    case 'in_progress': {
      return 'In Progress';
    }
    case 'resolved': {
      return 'Resolved';
    }
    default: {
      return 'Reported';
    }
  }
}

export function CivicGuardProvider({ children }: PropsWithChildren) {
  const [reports, setReports] = useState<CivicReport[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [draft, setDraftState] = useState(DEFAULT_DRAFT);
  const [analysisResult, setAnalysisResult] = useState<CivicAnalysisResult | null>(null);
  const [lastSubmittedReport, setLastSubmittedReport] = useState<CivicReport | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      setLoading(true);

      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching reports:', error);
      } else if (data) {
        const signedUrlMap = new Map<string, string>();
        const pathsToSign = data
          .map((item) => item.image_path)
          .filter((p): p is string => Boolean(p && !p.startsWith('http')));

        if (pathsToSign.length > 0) {
          try {
            const { data: signedList, error: signError } = await supabase.storage
              .from('report-images')
              .createSignedUrls(pathsToSign, 86400);

            if (!signError && signedList) {
              for (const s of signedList) {
                if (s.path && s.signedUrl) {
                  signedUrlMap.set(s.path, s.signedUrl);
                }
              }
            }
          } catch (signErr) {
            console.error('Error generating signed URLs:', signErr);
          }
        }

        const formattedReports: CivicReport[] = data.map((item) => {
          let resolvedImageUri: string | undefined = undefined;
          if (item.image_path) {
            if (item.image_path.startsWith('http')) {
              resolvedImageUri = item.image_path;
            } else {
              resolvedImageUri = signedUrlMap.get(item.image_path);
            }
          }

          return {
            id: item.report_code || item.id,
            category: item.category || 'Other / Unrecognized Civic Issue',
            severity: item.severity ?? 'Medium',
            confidence: item.confidence || 0,
            status: mapDbStatusToReportStatus(item.status),
            department: item.department || 'Manual Routing',
            area: 'Current Location',
            latitude: item.latitude || 30.0074,
            longitude: item.longitude || 31.4913,
            distance: '250m',
            date: formatReportDate(item.created_at),
            description: item.description || '',
            imageKey: 'pothole',
            imageUri: resolvedImageUri,
          };
        });
        setReports(formattedReports);
      }
    } catch (err) {
      console.error('Fetch exception:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial load synchronizes with Supabase (an external system); loading state
    // is only touched after the first `await` inside fetchReports.
    // oxlint-disable-next-line react/set-state-in-effect
    void fetchReports();
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
      const location = { latitude: draft.latitude, longitude: draft.longitude, area: draft.area };
      const localInput = {
        imageKey: draft.imageKey,
        scenarioKey: draft.scenarioKey,
        uri: draft.imageUri,
        fileName: draft.imageFileName,
      };

      // Citizen overrode the category: no new Gemini call, but keep the uploaded photo.
      if (preferredCategory && analysisResult?.imagePath) {
        const local = await analyzeCivicImage(localInput, draft.description, location, preferredCategory);
        const overridden = { ...local, imagePath: analysisResult.imagePath };
        setAnalysisResult(overridden);
        return overridden;
      }

      // Real photo -> Gemini through the backend. Any failure -> offline prototype.
      if (draft.imageUri && !preferredCategory) {
        try {
          const remote = await analyzeWithGemini({
            imageUri: draft.imageUri,
            description: draft.description,
            ...location,
          });
          setAnalysisResult(remote);
          return remote;
        } catch (err) {
          console.warn('Gemini analysis unavailable, using local classifier:', err);
        }
      }

      const result = await analyzeCivicImage(localInput, draft.description, location, preferredCategory);
      setAnalysisResult(result);
      return result;
    },
    [draft, analysisResult],
  );

  const submitDraft = useCallback(
    async (overrideDraft?: Partial<DraftReport>) => {
      const activeDraft = { ...draft, ...overrideDraft };
      const analysis = analysisResult;
      const rawSeverity = analysis?.severity ?? 'Medium';
      const safeSeverity = rawSeverity === 'Requires Review' ? 'Medium' : rawSeverity;
      const category = analysis?.category ?? 'Other / Unrecognized Civic Issue';
      const department = analysis?.department ?? 'Manual Routing';

      const rawConfidence = analysis?.confidence ?? 0.54;
      const safeConfidence = rawConfidence > 1 ? rawConfidence / 100 : rawConfidence;

      try {
        const token = await getAccessToken();
        if (!token) {
          console.error('No session token');
          return null;
        }

        // Reuse the photo uploaded during analysis; otherwise upload it now.
        let uploadedImagePath: string | null = analysis?.imagePath ?? null;
        const previewImageUri: string | undefined = activeDraft.imageUri;
        if (!uploadedImagePath && activeDraft.imageUri) {
          try {
            uploadedImagePath = await uploadReportImage(activeDraft.imageUri, token);
          } catch (imgErr) {
            console.error('Image upload exception:', imgErr);
          }
        }

        // The backend recomputes department/status; with analysisId it also
        // stores Gemini's severity, confidence and explanation.
        const { report: data } = await apiClient<{ report: Record<string, any> }>('/v1/reports', {
          method: 'POST',
          token,
          body: JSON.stringify({
            category_id: analysis?.categoryId ?? 'other',
            description: activeDraft.description || undefined,
            latitude: activeDraft.latitude,
            longitude: activeDraft.longitude,
            area_name: activeDraft.area || undefined,
            image_path: uploadedImagePath ?? undefined,
            analysis_id: analysis?.analysisId,
          }),
        });

        const newReport: CivicReport = {
          id: data.report_code || data.id,
          category: data.category ?? category,
          severity: data.severity ?? safeSeverity,
          confidence: data.confidence ?? safeConfidence,
          status: mapDbStatusToReportStatus(data.status),
          department: data.department ?? department,
          area: activeDraft.area,
          latitude: data.latitude ?? activeDraft.latitude,
          longitude: data.longitude ?? activeDraft.longitude,
          distance: '250m',
          date: formatReportDate(data.created_at),
          description: data.description ?? activeDraft.description,
          imageKey: activeDraft.imageKey,
          imageUri: previewImageUri,
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
    },
    [analysisResult, draft],
  );

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
    void fetchReports();
    setDraftState(DEFAULT_DRAFT);
    setAnalysisResult(null);
    setLastSubmittedReport(null);
  }, [fetchReports]);

  const refreshReports = fetchReports;

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
      refreshReports,
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
