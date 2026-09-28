import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import {
  INITIAL_NOTIFICATIONS,
  INITIAL_REPORTS,
  type CivicReport,
  type ReportStatus,
  type SampleImageKey,
} from '@/lib/civicguard-data';

interface DraftReport {
  imageKey: SampleImageKey;
  imageUri?: string;
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
  updateDraft: (next: Partial<DraftReport>) => void;
  resetDraft: () => void;
  submitDraft: () => CivicReport;
  updateStatus: (id: string, status: ReportStatus) => void;
  advanceReportStatus: (id: string) => void;
  markNotificationsRead: () => void;
  resetDemo: () => void;
}

const DEFAULT_DRAFT: DraftReport = {
  imageKey: 'pothole',
  description: '',
  latitude: 30.0074,
  longitude: 31.4913,
  area: 'New Cairo',
};

const CivicGuardContext = createContext<CivicGuardStore | null>(null);

export function CivicGuardProvider({ children }: PropsWithChildren) {
  const [reports, setReports] = useState(INITIAL_REPORTS);
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const [draft, setDraftState] = useState(DEFAULT_DRAFT);

  const updateDraft = useCallback((next: Partial<DraftReport>) => {
    setDraftState((current) => ({ ...current, ...next }));
  }, []);

  const resetDraft = useCallback(() => {
    setDraftState(DEFAULT_DRAFT);
  }, []);

  const submitDraft = useCallback(() => {
    const report: CivicReport = {
      id: 'CG-2026-00127',
      category: 'Pothole',
      severity: 'High',
      confidence: 94,
      status: 'Reported',
      department: 'Road Maintenance Department',
      area: draft.area,
      latitude: draft.latitude,
      longitude: draft.longitude,
      distance: '250m',
      date: '28 Sep 2026, 10:24 AM',
      description: draft.description || 'Large pothole affecting the right lane.',
      imageKey: draft.imageKey,
    };
    setReports((current) => [report, ...current.filter((item) => item.id !== report.id)]);
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
  }, [draft]);

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
  }, []);

  const value = useMemo(
    () => ({
      reports,
      notifications,
      draft,
      updateDraft,
      resetDraft,
      submitDraft,
      updateStatus,
      advanceReportStatus,
      markNotificationsRead,
      resetDemo,
    }),
    [
      advanceReportStatus,
      draft,
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
