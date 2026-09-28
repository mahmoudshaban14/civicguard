import type { ImageSourcePropType } from 'react-native';

export type Severity = 'Low' | 'Medium' | 'High' | 'Critical';
export type ReportStatus = 'Reported' | 'Assigned' | 'In Progress' | 'Resolved';

export interface CivicReport {
  id: string;
  category: string;
  severity: Severity;
  confidence: number;
  status: ReportStatus;
  department: string;
  area: string;
  latitude: number;
  longitude: number;
  distance: string;
  date: string;
  description: string;
  imageKey: SampleImageKey;
}

export type SampleImageKey = 'pothole' | 'streetlight' | 'garbage';

export const SAMPLE_IMAGES: Record<SampleImageKey, ImageSourcePropType> = {
  pothole: require('@/assets/images/pothole-sample.png'),
  streetlight: require('@/assets/images/streetlight-sample.png'),
  garbage: require('@/assets/images/garbage-sample.png'),
};

export const SAMPLE_OPTIONS: Array<{ key: SampleImageKey; label: string }> = [
  { key: 'pothole', label: 'Pothole' },
  { key: 'streetlight', label: 'Broken Streetlight' },
  { key: 'garbage', label: 'Garbage' },
];

export const NEW_CAIRO_REGION = {
  latitude: 30.0074,
  longitude: 31.4913,
  latitudeDelta: 0.025,
  longitudeDelta: 0.025,
};

export const INITIAL_REPORTS: CivicReport[] = [
  {
    id: 'CG-2026-00127',
    category: 'Pothole',
    severity: 'High',
    confidence: 94,
    status: 'In Progress',
    department: 'Road Maintenance Department',
    area: 'New Cairo',
    latitude: 30.0074,
    longitude: 31.4913,
    distance: '250m',
    date: '28 Sep 2026, 10:24 AM',
    description: 'Deep pothole in the right lane causing cars to swerve.',
    imageKey: 'pothole',
  },
  {
    id: 'CG-2026-00112',
    category: 'Broken Streetlight',
    severity: 'Medium',
    confidence: 89,
    status: 'Resolved',
    department: 'Public Lighting Department',
    area: 'Fifth Settlement',
    latitude: 30.011,
    longitude: 31.486,
    distance: '430m',
    date: '26 Sep 2026, 7:18 PM',
    description: 'Streetlight has been off for three nights.',
    imageKey: 'streetlight',
  },
  {
    id: 'CG-2026-00094',
    category: 'Garbage',
    severity: 'Low',
    confidence: 91,
    status: 'Resolved',
    department: 'Sanitation Department',
    area: 'South 90th Street',
    latitude: 30.002,
    longitude: 31.499,
    distance: '700m',
    date: '22 Sep 2026, 3:40 PM',
    description: 'Garbage bags have accumulated beside the sidewalk.',
    imageKey: 'garbage',
  },
];

export const INITIAL_NOTIFICATIONS = [
  {
    id: 'n1',
    text: 'Your report CG-2026-00127 has been assigned to Road Maintenance.',
    time: '12 min ago',
    read: false,
  },
  { id: 'n2', text: 'Your report is now In Progress.', time: '1 hr ago', read: false },
  {
    id: 'n3',
    text: 'Your reported streetlight has been marked as Resolved.',
    time: '2 days ago',
    read: true,
  },
];

export const SEVERITY_COLORS: Record<Severity, string> = {
  Low: '#16A074',
  Medium: '#D79716',
  High: '#E05B35',
  Critical: '#C73545',
};

export const STATUS_COLORS: Record<ReportStatus, string> = {
  Reported: '#3973D2',
  Assigned: '#6D5BD0',
  'In Progress': '#D79716',
  Resolved: '#16A074',
};
