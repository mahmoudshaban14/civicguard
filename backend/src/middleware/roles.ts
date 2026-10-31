/**
 * Approved role model: citizen, admin, department_manager, employee.
 * `authority` is no longer a role. Old profile rows that still say 'authority'
 * are treated as 'employee' until the database migration has converted them
 * (see normalizeRole). Remove LEGACY_ROLE_MAP once no such rows remain.
 */
export const ROLES = ['citizen', 'admin', 'department_manager', 'employee'] as const;
export type Role = (typeof ROLES)[number];

/** Roles that can use the staff (formerly "authority") endpoints. */
export const STAFF_ROLES: Role[] = ['employee', 'department_manager', 'admin'];

/** Roles that may only see and change data of their own department. */
export function isDepartmentScoped(role: Role): boolean {
  return role === 'employee' || role === 'department_manager';
}

const LEGACY_ROLE_MAP: Record<string, Role> = { authority: 'employee' };
let legacyWarned = false;

/** Converts a raw profiles.role value to a valid Role. Unknown values get least privilege. */
export function normalizeRole(raw: unknown): Role {
  if (typeof raw === 'string') {
    if ((ROLES as readonly string[]).includes(raw)) return raw as Role;
    const legacy = LEGACY_ROLE_MAP[raw];
    if (legacy) {
      if (!legacyWarned) {
        legacyWarned = true;
        console.warn(`[roles] profile role '${raw}' is deprecated and treated as '${legacy}'. Migrate the data.`);
      }
      return legacy;
    }
  }
  return 'citizen';
}
