import { describe, expect, it } from 'vitest';
import { normalizeLoginIdentifier } from '../src/modules/auth/service.js';

describe('normalizeLoginIdentifier', () => {
  it('normalizes email casing and surrounding whitespace', () => {
    expect(normalizeLoginIdentifier('  USER@Example.COM ')).toEqual({
      kind: 'email',
      value: 'user@example.com',
    });
  });

  it('accepts 14-digit National IDs, including Arabic-Indic digits', () => {
    expect(normalizeLoginIdentifier('٢٩٩٠١٠١١٢٣٤٥٦٧')).toEqual({
      kind: 'national_id',
      value: '29901011234567',
    });
  });

  it('normalizes Egyptian mobile numbers to E.164', () => {
    expect(normalizeLoginIdentifier('01012345678')).toEqual({
      kind: 'phone_number',
      value: '+201012345678',
    });
    expect(normalizeLoginIdentifier('+201012345678')).toEqual({
      kind: 'phone_number',
      value: '+201012345678',
    });
    expect(normalizeLoginIdentifier('00201012345678')).toEqual({
      kind: 'phone_number',
      value: '+201012345678',
    });
  });

  it('rejects malformed non-email identifiers', () => {
    expect(normalizeLoginIdentifier('not-a-phone')).toEqual({
      kind: 'invalid',
      value: '',
    });
  });
});
