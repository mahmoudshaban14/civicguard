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

  it('normalizes Persian digits in a National ID', () => {
    expect(normalizeLoginIdentifier('\u06F2\u06F9\u06F9\u06F0\u06F1\u06F0\u06F1\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7')).toEqual({
      kind: 'national_id',
      value: '29901011234567',
    });
  });

  it('keeps Western digits unchanged', () => {
    expect(normalizeLoginIdentifier('29901011234567')).toEqual({ kind: 'national_id', value: '29901011234567' });
  });

  it('handles mixed Western, Arabic-Indic and Persian digits', () => {
    expect(normalizeLoginIdentifier('2990101\u0661\u0662\u0663\u06F4\u06F5\u06F6\u06F7')).toEqual({
      kind: 'national_id',
      value: '29901011234567',
    });
  });

  it('normalizes Arabic-Indic and Persian mobile numbers', () => {
    expect(normalizeLoginIdentifier('\u0660\u0661\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668')).toEqual({
      kind: 'phone_number',
      value: '+201012345678',
    });
    expect(normalizeLoginIdentifier('\u06F0\u06F1\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8')).toEqual({
      kind: 'phone_number',
      value: '+201012345678',
    });
  });

  it('still rejects letters mixed into digits', () => {
    expect(normalizeLoginIdentifier('2990101123456a')).toEqual({ kind: 'invalid', value: '' });
  });
});
