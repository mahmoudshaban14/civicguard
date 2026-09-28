import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { analyzeCivicImage, type CivicAnalysisResult } from '@/lib/civicguard-ai';
import type { CivicIssueCategory, CivicIssueId } from '@/lib/civicguard-categories';
import {
  INITIAL_NOTIFICATIONS,
  INITIAL_REPORTS,
  type CivicReport,
  type ReportStatus,
  type SampleImageKey,
  type Severity,
} from '@/lib/civicguard-data';

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
  updateDraft: (next: Partial<DraftReport>) => void;
  resetDraft: () => void;
  analyzeDraft: (preferredCategory?: CivicIssueCategory) => Promise<CivicAnalysisResult>;
  submitDraft: () => CivicReport;
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

function nextReportId(reports: CivicReport[]) {
  const highestSequence = reports.reduce((highest, report) => {
    const sequence = Number(report.id.split('-').at(-1));
    return Number.isFinite(sequence) ? Math.max(highest, sequence) : highest;
  }, 127);
  return `CG-2026-${String(highestSequence + 1).padStart(5, '0')}`;
}

function formatReportDate() {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date());
}

export function CivicGuardProvider({ children }: PropsWithChildren) {
  const [reports, setReports] = useState(INITIAL_REPORTS);
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const [draft, setDraftState] = useState(DEFAULT_DRAFT);
  const [analysisResult, setAnalysisResult] = useState<CivicAnalysisResult | null>(null);
  const [lastSubmittedReport, setLastSubmittedReport] = useState<CivicReport | null>(null);

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

  const submitDraft = useCallback(() => {
    const analysis = analysisResult;
    const severity: Severity = analysis?.severity ?? 'Requires Review';
    const report: CivicReport = {
      id: nextReportId(reports),
      category: analysis?.category ?? 'Other / Unrecognized Civic Issue',
      severity,
      confidence: analysis?.confidence ?? 0,
      status: 'Reported',
      department: analysis?.department ?? 'Manual Routing',
      area: draft.area,
      latitude: draft.latitude,
      longitude: draft.longitude,
      distance: '250m',
      date: formatReportDate(),
      description: draft.description || analysis?.explanation || 'Submitted for manual review.',
      imageKey: draft.imageKey,
      imageUri: draft.imageUri,
    };
    setReports((current) => [report, ...current]);
    setLastSubmittedReport(report);
    setNotifications((current) => [
      {
        id: `submitted-${Date.now()}`,
        text: `Report ${report.id} was submitted successfully.`,
        time: 'Just now',
        read: false,
      },
      ...current,
    ]);
    return report;
  }, [analysisResult, draft, reports]);

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
      lastSubmittedReport,
      markNotificationsRead,
      notifications,
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
