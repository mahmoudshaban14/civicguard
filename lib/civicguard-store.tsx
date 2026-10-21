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
import {
  CIVIC_ISSUE_CATEGORIES,
  type CivicIssueCategory,
  type CivicIssueId,
} from '@/lib/civicguard-categories';
import {
  INITIAL_NOTIFICATIONS,
  INITIAL_REPORTS,
  type CivicReport,
  type ReportStatus,
  type SampleImageKey,
  type Severity,
} from '@/lib/civicguard-data';
import { apiClient } from '@/lib/api-client';
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

interface NotificationItem {
  id: string;
  text: string;
  time: string;
  read: boolean;
}

interface CivicGuardStore {
  reports: CivicReport[];
  notifications: NotificationItem[];
  draft: DraftReport;
  analysisResult: CivicAnalysisResult | null;
  lastSubmittedReport: CivicReport | null;
  isLoading: boolean;
  refreshReports: () => Promise<void>;
  updateDraft: (next: Partial<DraftReport>) => void;
  resetDraft: () => void;
  analyzeDraft: (preferredCategory?: CivicIssueCategory) => Promise<CivicAnalysisResult>;
  submitDraft: () => Promise<CivicReport>;
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

const CivicGuardContext = createContext<CivicGuardStore | null>(null);

function mapDbStatusToUi(dbStatus: string): ReportStatus {
  switch (dbStatus) {
    case 'submitted':
    case 'ai_analyzed':
      return 'Reported';
    case 'assigned':
    case 'under_review':
      return 'Assigned';
    case 'in_progress':
    case 'escalated':
      return 'In Progress';
    case 'resolved':
      return 'Resolved';
    default:
      return 'Reported';
  }
}

function formatReportDate(isoDate?: string) {
  const d = isoDate ? new Date(isoDate) : new Date();
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

export function CivicGuardProvider({ children }: PropsWithChildren) {
  const [reports, setReports] = useState<CivicReport[]>(INITIAL_REPORTS);
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const [draft, setDraftState] = useState(DEFAULT_DRAFT);
  const [analysisResult, setAnalysisResult] = useState<CivicAnalysisResult | null>(null);
  const [lastSubmittedReport, setLastSubmittedReport] = useState<CivicReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load user's real reports and notifications from API
  const refreshReports = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;

      setIsLoading(true);

      // Fetch reports
      const reportsResponse = await apiClient<{ reports: Array<Record<string, unknown>> }>(
        '/v1/reports?mine=1',
        { token },
      ).catch(() => null);

      if (reportsResponse?.reports) {
        const mappedReports: CivicReport[] = reportsResponse.reports.map((r) => {
          const categoryObj = CIVIC_ISSUE_CATEGORIES.find((c) => c.id === r.category_id);
          return {
            id: String(r.report_code || r.id),
            category: String(r.category || categoryObj?.label || 'Other / Unrecognized Civic Issue'),
            severity: (r.severity as Severity) || 'Requires Review',
            confidence: r.confidence ? Math.round(Number(r.confidence) * 100) : 0,
            status: mapDbStatusToUi(String(r.status)),
            department: String(r.department || categoryObj?.department || 'Manual Routing'),
            area: String(r.area_name || 'New Cairo'),
            latitude: Number(r.latitude) || 30.0074,
            longitude: Number(r.longitude) || 31.4913,
            distance: '250m',
            date: formatReportDate(String(r.created_at)),
            description: String(r.description || ''),
            imageKey: (categoryObj?.id as SampleImageKey) || 'pothole',
            imageUri: r.image_path ? String(r.image_path) : undefined,
          };
        });

        if (mappedReports.length > 0) {
          setReports(mappedReports);
        }
      }

      // Fetch notifications
      const notifResponse = await apiClient<{
        notifications: Array<{ id: string; title: string; body: string; read: boolean; created_at: string }>;
      }>('/v1/notifications', { token }).catch(() => null);

      if (notifResponse?.notifications && notifResponse.notifications.length > 0) {
        setNotifications(
          notifResponse.notifications.map((n) => ({
            id: n.id,
            text: n.body || n.title,
            time: formatReportDate(n.created_at),
            read: n.read,
          })),
        );
      }
    } catch {
      // Keep existing reports on offline/network failure
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshReports();
  }, [refreshReports]);

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

  const submitDraft = useCallback(async (): Promise<CivicReport> => {
    const analysis = analysisResult;
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    // Resolve category id
    const matchedCategory = CIVIC_ISSUE_CATEGORIES.find(
      (c) => c.label === analysis?.category || c.id === draft.scenarioKey,
    );
    const categoryId = matchedCategory?.id || 'other';

    let apiReport: Record<string, unknown> | null = null;

    if (token) {
      try {
        const res = await apiClient<{ report: Record<string, unknown> }>('/v1/reports', {
          method: 'POST',
          token,
          body: JSON.stringify({
            category_id: categoryId,
            description: draft.description || analysis?.explanation || 'Submitted report',
            latitude: draft.latitude,
            longitude: draft.longitude,
            area_name: draft.area,
            image_path: draft.imageUri ? `user-upload/${draft.imageFileName || 'image.jpg'}` : undefined,
          }),
        });
        apiReport = res.report;
      } catch (err) {
        console.warn('API report submission error, falling back to local state:', err);
      }
    }

    const reportCode = apiReport?.report_code ? String(apiReport.report_code) : `CG-${Date.now().toString().slice(-6)}`;
    const severity: Severity = (apiReport?.severity as Severity) || analysis?.severity || 'Requires Review';
    const department: string = (apiReport?.department as string) || analysis?.department || 'Manual Routing';

    const newReport: CivicReport = {
      id: reportCode,
      category: (apiReport?.category as string) || analysis?.category || 'Other / Unrecognized Civic Issue',
      severity,
      confidence: analysis?.confidence ?? 0,
      status: 'Reported',
      department,
      area: draft.area,
      latitude: draft.latitude,
      longitude: draft.longitude,
      distance: '250m',
      date: formatReportDate(),
      description: draft.description || analysis?.explanation || 'Submitted for manual review.',
      imageKey: draft.imageKey,
      imageUri: draft.imageUri,
    };

    setReports((current) => [newReport, ...current.filter((r) => r.id !== newReport.id)]);
    setLastSubmittedReport(newReport);
    setNotifications((current) => [
      {
        id: `submitted-${Date.now()}`,
        text: `Report ${newReport.id} was submitted successfully.`,
        time: 'Just now',
        read: false,
      },
      ...current,
    ]);

    return newReport;
  }, [analysisResult, draft]);

  const updateStatus = useCallback((id: string, status: ReportStatus) => {
    setReports((current) =>
      current.map((report) => (report.id === id ? { ...report, status } : report)),
    );
    setNotifications((current) => [
      {
        id: `status-${Date.now()}`,
        text: `Your report ${id} is now ${status}.`,
        time: 'Just now',
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
    setReports(INITIAL_REPORTS);
    setNotifications(INITIAL_NOTIFICATIONS);
    setDraftState(DEFAULT_DRAFT);
    setAnalysisResult(null);
    setLastSubmittedReport(null);
  }, []);

  const value = useMemo(
    () => ({
      reports,
      notifications,
      draft,
      analysisResult,
      lastSubmittedReport,
      isLoading,
      refreshReports,
      updateDraft,
      resetDraft,
      analyzeDraft,
      submitDraft,
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
      isLoading,
      lastSubmittedReport,
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
