import { describe, it, expect } from 'vitest';
import { applyRules, manualReviewFallback } from '../src/modules/analysis/rules.js';
import { sniffImageMime } from '../src/modules/analysis/service.js';
import type { CategoryOption, ProviderOutput } from '../src/modules/analysis/types.js';

const cats: CategoryOption[] = [
  { id: 'pothole', label: 'Pothole / Road Damage', department: 'Road Maintenance Department', department_id: 'd1', default_severity: 'High', explanation: null },
  { id: 'graffiti', label: 'Graffiti', department: 'Municipal Services', department_id: 'd2', default_severity: 'Low', explanation: null },
  { id: 'other', label: 'Other', department: 'Manual Routing', department_id: null, default_severity: 'Low', explanation: null },
];

const base: ProviderOutput = {
  image_description: 'A deep pothole in the right lane.',
  is_civic_issue: true,
  category_id: 'pothole',
  confidence: 0.93,
  secondary_category_ids: [],
  severity: 'High',
  severity_reason: 'Deep hole in traffic lane',
  immediate_danger: false,
  recommended_action: 'Fill the pothole.',
};

describe('applyRules', () => {
  it('takes department from the category row, not the model', () => {
    const r = applyRules({ ...base, department: 'Hacked Dept' } as unknown as ProviderOutput, cats);
    expect(r.department).toBe('Road Maintenance Department');
    expect(r.department_id).toBe('d1');
    expect(r.requires_manual_review).toBe(false);
  });

  it('sends unknown categories to manual review', () => {
    const r = applyRules({ ...base, category_id: 'made-up' }, cats);
    expect(r.category_id).toBe('other');
    expect(r.requires_manual_review).toBe(true);
    expect(r.department).toBe('Manual Routing');
  });

  it('flags low confidence for manual review but keeps the category', () => {
    const r = applyRules({ ...base, confidence: 0.5 }, cats);
    expect(r.category_id).toBe('pothole');
    expect(r.requires_manual_review).toBe(true);
  });

  it('treats non-civic photos as Requires Review', () => {
    const r = applyRules({ ...base, is_civic_issue: false }, cats);
    expect(r.category_id).toBe('other');
    expect(r.severity).toBe('Requires Review');
  });

  it('limits severity to one level from the category default', () => {
    expect(applyRules({ ...base, category_id: 'graffiti', severity: 'Critical' }, cats).severity).toBe('Medium');
    expect(applyRules({ ...base, severity: 'Low' }, cats).severity).toBe('Medium');
  });

  it('raises severity to at least High on immediate danger', () => {
    const r = applyRules({ ...base, category_id: 'graffiti', severity: 'Medium', immediate_danger: true }, cats);
    expect(r.severity).toBe('High');
  });

  it('clamps confidence and drops invalid secondary ids', () => {
    const r = applyRules({ ...base, confidence: 7, secondary_category_ids: ['graffiti', 'nope', 'pothole'] }, cats);
    expect(r.confidence).toBe(1);
    expect(r.secondary_issues).toEqual(['graffiti']);
  });

  it('fallback always requires manual review', () => {
    const r = manualReviewFallback(cats);
    expect(r.requires_manual_review).toBe(true);
    expect(r.severity).toBe('Requires Review');
  });
});

describe('sniffImageMime', () => {
  it('detects jpeg / png / webp and rejects others', () => {
    expect(sniffImageMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(sniffImageMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
    expect(sniffImageMime(Buffer.from('RIFF\0\0\0\0WEBP', 'ascii'))).toBe('image/webp');
    expect(sniffImageMime(Buffer.from('%PDF-1.4'))).toBeNull();
  });
});
