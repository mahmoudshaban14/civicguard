import { describe, it, expect, vi } from 'vitest';
import { normalizeRole, isDepartmentScoped, STAFF_ROLES } from '../src/middleware/roles.js';

describe('role model', () => {
  it('accepts the four approved roles', () => {
    for (const r of ['citizen', 'admin', 'department_manager', 'employee']) expect(normalizeRole(r)).toBe(r);
  });
  it('treats legacy "authority" as employee (transitional) and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(normalizeRole('authority')).toBe('employee');
    warn.mockRestore();
  });
  it('gives unknown or missing roles least privilege', () => {
    expect(normalizeRole('superuser')).toBe('citizen');
    expect(normalizeRole(undefined)).toBe('citizen');
    expect(normalizeRole(null)).toBe('citizen');
  });
  it('staff roles never include citizen; scoping applies to manager and employee only', () => {
    expect(STAFF_ROLES).not.toContain('citizen');
    expect(isDepartmentScoped('employee')).toBe(true);
    expect(isDepartmentScoped('department_manager')).toBe(true);
    expect(isDepartmentScoped('admin')).toBe(false);
    expect(isDepartmentScoped('citizen')).toBe(false);
  });
});
