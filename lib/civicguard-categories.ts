import type { Severity } from '@/lib/civicguard-data';

export const CIVIC_ISSUE_CATEGORIES = [
  {
    id: 'pothole',
    label: 'Pothole / Road Damage',
    department: 'Road Maintenance Department',
    severity: 'High',
    confidenceRange: [91, 97],
    keywords: ['pothole', 'hole in the road', 'road damage', 'road crack', 'asphalt'],
    explanation: 'Visual and contextual characteristics are consistent with road surface damage.',
    severityReason:
      'Road surface damage may affect vehicle safety and requires municipal attention.',
  },
  {
    id: 'garbage',
    label: 'Garbage / Litter',
    department: 'Waste Management Department',
    severity: 'Medium',
    confidenceRange: [87, 95],
    keywords: ['garbage', 'litter', 'trash', 'rubbish', 'waste bags'],
    explanation:
      'The evidence is consistent with accumulated litter or household waste in a public area.',
    severityReason: 'Accumulated waste can obstruct public space and create sanitation concerns.',
  },
  {
    id: 'illegal-dumping',
    label: 'Illegal Dumping',
    department: 'Waste Management Department',
    severity: 'High',
    confidenceRange: [85, 94],
    keywords: ['illegal dumping', 'dumped waste', 'huge amount of garbage', 'large pile of waste'],
    explanation: 'The amount and placement of waste suggest unauthorized dumping.',
    severityReason:
      'Large dumped waste can block access and create environmental or health hazards.',
  },
  {
    id: 'fallen-tree',
    label: 'Fallen Tree',
    department: 'Parks / Municipal Services',
    severity: 'High',
    confidenceRange: [92, 98],
    keywords: ['fallen tree', 'tree blocking', 'tree across', 'collapsed tree'],
    explanation: 'The evidence is consistent with a fallen tree affecting a public route.',
    severityReason:
      'A fallen tree can block vehicles or pedestrians and may create an immediate safety risk.',
  },
  {
    id: 'broken-streetlight',
    label: 'Broken Streetlight',
    department: 'Street Lighting / Electricity Department',
    severity: 'Medium',
    confidenceRange: [84, 94],
    keywords: ['broken streetlight', 'streetlight off', 'lamp not working', 'light not working'],
    explanation: 'The reported fixture appears damaged or not operating as intended.',
    severityReason: 'Reduced street lighting can lower visibility and public safety after dark.',
  },
  {
    id: 'fallen-pole',
    label: 'Fallen Streetlight / Utility Pole',
    department: 'Street Lighting / Electricity Department',
    severity: 'Critical',
    confidenceRange: [88, 97],
    keywords: ['fallen pole', 'utility pole down', 'streetlight fell', 'exposed electrical'],
    explanation: 'The evidence suggests a fallen lighting or utility structure.',
    severityReason:
      'A fallen utility structure may expose electrical hazards and requires urgent isolation.',
  },
  {
    id: 'dark-street',
    label: 'Dark Street / Poor Lighting',
    department: 'Street Lighting / Electricity Department',
    severity: 'Medium',
    confidenceRange: [80, 91],
    keywords: ['dark street', 'completely dark', 'poor lighting', 'no lights at night'],
    explanation: 'The description indicates inadequate lighting across a public street area.',
    severityReason:
      'Poor lighting can reduce visibility and increase risk for road users and pedestrians.',
  },
  {
    id: 'illegal-parking',
    label: 'Illegal Parking',
    department: 'Traffic / Enforcement Authority',
    severity: 'Medium',
    confidenceRange: [80, 93],
    keywords: ['illegal parking', 'parked illegally', 'blocking the sidewalk', 'blocking driveway'],
    explanation: 'The vehicle position appears inconsistent with safe or permitted parking.',
    severityReason: 'Illegal parking can obstruct access and create traffic or pedestrian hazards.',
  },
  {
    id: 'double-row-parking',
    label: 'Double-Row Parking',
    department: 'Traffic / Enforcement Authority',
    severity: 'Medium',
    confidenceRange: [82, 93],
    keywords: ['double parked', 'double-row', 'second row parking'],
    explanation: 'Vehicle placement is consistent with double-row parking.',
    severityReason: 'Double-row parking reduces usable road width and disrupts traffic flow.',
  },
  {
    id: 'abandoned-vehicle',
    label: 'Abandoned Vehicle',
    department: 'Traffic / Enforcement Authority',
    severity: 'Medium',
    confidenceRange: [74, 89],
    keywords: ['abandoned vehicle', 'abandoned car', 'car left for weeks'],
    explanation:
      'The available context suggests a vehicle may have been left unattended long-term.',
    severityReason:
      'An abandoned vehicle may occupy public space and require ownership verification.',
  },
  {
    id: 'road-obstruction',
    label: 'Road Obstruction',
    department: 'Road Maintenance Department',
    severity: 'High',
    confidenceRange: [82, 94],
    keywords: ['road obstruction', 'road blocked', 'blocking the road', 'lane blocked'],
    explanation: 'An object or condition appears to restrict normal road access.',
    severityReason: 'A blocked lane can force unsafe maneuvers and disrupt emergency access.',
  },
  {
    id: 'sidewalk-damage',
    label: 'Sidewalk Damage',
    department: 'Road Maintenance Department',
    severity: 'Low',
    confidenceRange: [80, 92],
    keywords: ['sidewalk damage', 'sidewalk crack', 'broken sidewalk', 'footpath damage'],
    explanation: 'The evidence is consistent with localized damage to a pedestrian route.',
    severityReason:
      'Minor sidewalk damage can create a trip hazard and should be scheduled for repair.',
  },
  {
    id: 'broken-pavement',
    label: 'Broken Pavement',
    department: 'Road Maintenance Department',
    severity: 'Medium',
    confidenceRange: [82, 93],
    keywords: ['broken pavement', 'pavement cracked', 'paving blocks broken'],
    explanation: 'The paved public surface appears cracked, displaced, or broken.',
    severityReason:
      'Broken pavement may impede safe pedestrian movement and worsen without repair.',
  },
  {
    id: 'damaged-curb',
    label: 'Damaged Curb',
    department: 'Road Maintenance Department',
    severity: 'Low',
    confidenceRange: [78, 90],
    keywords: ['damaged curb', 'broken curb', 'kerb damage'],
    explanation: 'The curb edge appears chipped, displaced, or structurally damaged.',
    severityReason:
      'Curb damage is generally localized but can affect drainage and pedestrian access.',
  },
  {
    id: 'flooded-street',
    label: 'Flooded Street / Water Accumulation',
    department: 'Water & Utilities Department',
    severity: 'High',
    confidenceRange: [86, 96],
    keywords: ['flooded street', 'street flooded', 'water accumulation', 'standing water'],
    explanation: 'Visible or described standing water is consistent with street flooding.',
    severityReason: 'Deep standing water can restrict traffic and conceal road hazards.',
  },
  {
    id: 'sewage-overflow',
    label: 'Sewage Overflow',
    department: 'Sanitation Department',
    severity: 'High',
    confidenceRange: [86, 96],
    keywords: ['sewage overflow', 'sewer overflow', 'raw sewage', 'sewage water'],
    explanation: 'The reported discharge is consistent with an overflowing sanitation line.',
    severityReason: 'Sewage overflow presents a significant sanitation and public-health concern.',
  },
  {
    id: 'water-leakage',
    label: 'Water Leakage',
    department: 'Water & Utilities Department',
    severity: 'Medium',
    confidenceRange: [83, 94],
    keywords: ['water leak', 'water leakage', 'burst pipe', 'leaking pipe'],
    explanation: 'The evidence suggests an active leak from public water infrastructure.',
    severityReason: 'Ongoing leakage wastes water and may undermine nearby pavement.',
  },
  {
    id: 'broken-manhole',
    label: 'Broken Manhole Cover',
    department: 'Sanitation Department',
    severity: 'High',
    confidenceRange: [88, 96],
    keywords: ['broken manhole cover', 'cracked manhole', 'damaged manhole cover'],
    explanation: 'The manhole cover appears damaged and may not safely support traffic.',
    severityReason: 'A damaged cover can fail under vehicles or create a serious trip hazard.',
  },
  {
    id: 'open-manhole',
    label: 'Open Manhole',
    department: 'Sanitation Department',
    severity: 'Critical',
    confidenceRange: [91, 98],
    keywords: ['open manhole', 'manhole open', 'missing manhole cover', 'uncovered drain'],
    explanation: 'The evidence is consistent with an uncovered manhole opening.',
    severityReason:
      'An open manhole presents an immediate fall and traffic hazard requiring urgent securing.',
  },
  {
    id: 'damaged-sign',
    label: 'Damaged Traffic Sign',
    department: 'Traffic Management Department',
    severity: 'Medium',
    confidenceRange: [84, 94],
    keywords: ['damaged traffic sign', 'broken traffic sign', 'bent sign', 'sign damaged'],
    explanation: 'The traffic sign appears bent, damaged, or difficult to read.',
    severityReason: 'Damaged road signage may reduce guidance and should be inspected.',
  },
  {
    id: 'missing-sign',
    label: 'Missing Traffic Sign',
    department: 'Traffic Management Department',
    severity: 'High',
    confidenceRange: [76, 90],
    keywords: ['missing traffic sign', 'sign missing', 'no stop sign'],
    explanation: 'The context suggests required traffic signage is absent.',
    severityReason:
      'Missing regulatory signage can create uncertainty and increase collision risk.',
  },
  {
    id: 'damaged-signal',
    label: 'Damaged Traffic Signal',
    department: 'Traffic Management Department',
    severity: 'High',
    confidenceRange: [87, 96],
    keywords: ['damaged traffic signal', 'traffic light broken', 'signal not working'],
    explanation: 'The traffic control signal appears damaged or non-operational.',
    severityReason: 'A failed traffic signal can create immediate conflict at an intersection.',
  },
  {
    id: 'construction-debris',
    label: 'Construction Debris',
    department: 'Waste Management Department',
    severity: 'Medium',
    confidenceRange: [86, 95],
    keywords: ['construction debris', 'building rubble', 'broken bricks', 'concrete debris'],
    explanation:
      'The materials are consistent with construction or demolition waste in public space.',
    severityReason:
      'Construction debris can obstruct pedestrian or road access and may contain sharp material.',
  },
  {
    id: 'illegal-vendor',
    label: 'Illegal Street Vendor / Unauthorized Stall',
    department: 'Municipal Enforcement',
    severity: 'Medium',
    confidenceRange: [74, 88],
    keywords: ['illegal vendor', 'unauthorized stall', 'street vendor blocking'],
    explanation: 'The available context suggests an unauthorized stall occupying public space.',
    severityReason: 'Unauthorized stalls may obstruct movement and require permit verification.',
  },
  {
    id: 'street-encroachment',
    label: 'Illegal Cafe / Street Encroachment',
    department: 'Municipal Enforcement',
    severity: 'Medium',
    confidenceRange: [75, 89],
    keywords: ['illegal cafe', 'street encroachment', 'tables blocking sidewalk', 'cafe blocking'],
    explanation: 'Furniture or commercial activity appears to extend into public access space.',
    severityReason:
      'Street encroachment can restrict pedestrian access and requires permit review.',
  },
  {
    id: 'public-property-damage',
    label: 'Public Property Damage',
    department: 'Municipal Services / Public Property Department',
    severity: 'Medium',
    confidenceRange: [78, 91],
    keywords: ['public property damage', 'broken public bench', 'municipal property damaged'],
    explanation: 'The evidence suggests damage to publicly maintained property.',
    severityReason: 'Damaged public assets may be unsafe or unavailable for community use.',
  },
  {
    id: 'graffiti',
    label: 'Graffiti / Vandalism',
    department: 'Municipal Services / Public Property Department',
    severity: 'Low',
    confidenceRange: [88, 96],
    keywords: ['graffiti', 'vandalism', 'spray paint on wall'],
    explanation: 'The marked surface is consistent with graffiti or property vandalism.',
    severityReason:
      'Graffiti primarily affects public property condition and can be scheduled for removal.',
  },
  {
    id: 'fire-smoke',
    label: 'Fire / Smoke Hazard',
    department: 'Civil Protection / Emergency Authority',
    severity: 'Critical',
    confidenceRange: [88, 97],
    keywords: ['fire', 'smoke hazard', 'burning', 'heavy smoke'],
    explanation: 'The evidence suggests visible fire or smoke requiring emergency assessment.',
    severityReason:
      'Fire or dense smoke may threaten life and property and requires immediate emergency response.',
  },
  {
    id: 'building-debris',
    label: 'Dangerous Building Debris',
    department: 'Building Safety / Municipal Engineering',
    severity: 'Critical',
    confidenceRange: [84, 95],
    keywords: ['falling building debris', 'dangerous building debris', 'facade collapsing'],
    explanation: 'Loose or fallen structural material appears to create a public hazard.',
    severityReason:
      'Unstable building material can fall without warning and requires urgent isolation.',
  },
  {
    id: 'other',
    label: 'Other / Unrecognized Civic Issue',
    department: 'Manual Routing',
    severity: 'Low',
    confidenceRange: [45, 69],
    keywords: [],
    explanation:
      'The available image context is not sufficient for a reliable supported classification.',
    severityReason: 'Severity requires review because the issue could not be classified reliably.',
  },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  department: string;
  severity: Severity;
  confidenceRange: readonly [number, number];
  keywords: readonly string[];
  explanation: string;
  severityReason: string;
}>;

export type CivicIssueId = (typeof CIVIC_ISSUE_CATEGORIES)[number]['id'];
export type CivicIssueCategory = (typeof CIVIC_ISSUE_CATEGORIES)[number]['label'];
export type CivicIssueConfig = (typeof CIVIC_ISSUE_CATEGORIES)[number];

export function getCategoryById(id: CivicIssueId): CivicIssueConfig {
  const category = CIVIC_ISSUE_CATEGORIES.find((item) => item.id === id);
  if (!category) throw new Error(`Unknown civic issue category: ${id}`);
  return category;
}

export function getCategoryByLabel(label: CivicIssueCategory) {
  return CIVIC_ISSUE_CATEGORIES.find((category) => category.label === label);
}
