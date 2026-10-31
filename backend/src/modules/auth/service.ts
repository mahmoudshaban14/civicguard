import { createClient } from '@supabase/supabase-js';
import { config } from '../../config.js';
import { getSupabaseAdmin } from '../../db/client.js';
import { AppError } from '../../middleware/error-handler.js';
import { toWesternDigits } from '../../utils/digits.js';
import type { LoginInput } from './schema.js';

type NormalizedIdentifier =
  | { kind: 'email'; value: string }
  | { kind: 'national_id'; value: string }
  | { kind: 'phone_number'; value: string }
  | { kind: 'invalid'; value: '' };

export function normalizeLoginIdentifier(input: string): NormalizedIdentifier {
  const trimmed = input.trim();
  if (trimmed.includes('@')) {
    return { kind: 'email', value: trimmed.toLowerCase() };
  }

  const ascii = toWesternDigits(trimmed);
  if (!/^[+\d\s().-]+$/.test(ascii)) {
    return { kind: 'invalid', value: '' };
  }

  const digits = ascii.replace(/\D/g, '');

  // Check international Egyptian phone format first.
  if (/^00201[0125]\d{8}$/.test(digits)) {
    return { kind: 'phone_number', value: `+${digits.slice(2)}` };
  }

  if (/^201[0125]\d{8}$/.test(digits)) {
    return { kind: 'phone_number', value: `+${digits}` };
  }

  if (/^01[0125]\d{8}$/.test(digits)) {
    return { kind: 'phone_number', value: `+2${digits}` };
  }

  // Check National ID after phone formats.
  if (/^\d{14}$/.test(digits)) {
    return { kind: 'national_id', value: digits };
  }

  return { kind: 'invalid', value: '' };
}

async function resolveEmail(identifier: NormalizedIdentifier): Promise<string | null> {
  if (identifier.kind === 'email') return identifier.value;
  if (identifier.kind === 'invalid') return null;

  const column = identifier.kind === 'national_id' ? 'national_id' : 'phone_number';
  const { data, error } = await getSupabaseAdmin()
    .from('profiles')
    .select('email')
    .eq(column, identifier.value)
    .maybeSingle();

  if (error) {
    // Do not expose database details to the client.
    throw new AppError(503, 'AUTH_UNAVAILABLE', 'Unable to sign in right now. Please try again.');
  }

  const email = data?.email;
  return typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null;
}

export async function loginWithIdentifier(input: LoginInput) {
  const identifier = normalizeLoginIdentifier(input.identifier);
  const email = await resolveEmail(identifier);

  // Use the public/anon key for password authentication. The service-role
  // client is used only for the restricted server-side identifier lookup.
  if (!email) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid identifier or password.');
  }

  const authClient = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await authClient.auth.signInWithPassword({
    email,
    password: input.password,
  });

  if (error || !data.session) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid identifier or password.');
  }

  return { session: data.session };
}


export async function createManagedUser(input: import('./schema.js').CreateUserInput) {
  const supabase = getSupabaseAdmin();

  // Staff accounts must belong to an existing department (checked before any account exists).
  if (input.role !== 'admin') {
    const { data: department, error: departmentError } = await supabase
      .from('departments')
      .select('id')
      .eq('id', input.department_id as string)
      .maybeSingle();
    if (departmentError) {
      throw new AppError(503, 'DEPARTMENT_LOOKUP_FAILED', 'Unable to verify the department right now.');
    }
    if (!department) {
      throw new AppError(400, 'INVALID_DEPARTMENT', 'The selected department does not exist.');
    }
  }

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      full_name: input.full_name,
    },
  });

  if (createError || !created.user) {
    const message = createError?.message ?? '';
    if (/already registered|already exists|duplicate/i.test(message)) {
      throw new AppError(409, 'USER_ALREADY_EXISTS', 'An account with this email already exists.');
    }
    throw new AppError(400, 'USER_CREATION_FAILED', 'Unable to create this user account.');
  }

  // The database trigger creates the initial profile. Update that row rather
  // than inserting another profile for the same auth user.
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      email: input.email,
      full_name: input.full_name,
      display_name: input.full_name,
      role: input.role,
      department_id: input.role === 'admin' ? null : input.department_id,
      national_id: input.national_id,
    })
    .eq('id', created.user.id);

  if (profileError) {
    // Remove the Auth account if its profile update failed.
    await supabase.auth.admin.deleteUser(created.user.id);

    if (
      profileError.code === '23505' ||
      /national_id/i.test(profileError.message)
    ) {
      throw new AppError(
        409,
        'NATIONAL_ID_ALREADY_EXISTS',
        'This national ID is already registered.'
      );
    }

    throw new AppError(
      500,
      'PROFILE_CREATION_FAILED',
      'The user profile could not be configured.'
    );
  }

  return {
    user: {
      id: created.user.id,
      email: input.email,
      full_name: input.full_name,
      role: input.role,
      department_id: input.role === 'admin' ? null : (input.department_id ?? null),
    },
  };
}

export async function promoteUser(targetUserId: string, _input: import('./schema.js').PromoteUserInput) {
  const supabase = getSupabaseAdmin();

  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('id, role, department_id, email, full_name')
    .eq('id', targetUserId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Failed to fetch user profile: ${fetchError.message}`);
  }

  if (!profile) {
    throw new AppError(404, 'NOT_FOUND', 'User not found');
  }

  if (profile.role !== 'employee') {
    throw new AppError(
      400,
      'INVALID_PROMOTION',
      `Only employees can be promoted to department managers (current role: '${profile.role}')`,
    );
  }

  if (!profile.department_id) {
    throw new AppError(
      400,
      'INVALID_PROMOTION',
      'Cannot promote an employee without an assigned department',
    );
  }

  const { data: updated, error: updateError } = await supabase
    .from('profiles')
    .update({
      role: 'department_manager',
      updated_at: new Date().toISOString(),
    })
    .eq('id', targetUserId)
    .select('id, email, full_name, role, department_id')
    .single();

  if (updateError) {
    throw new Error(`Failed to promote user: ${updateError.message}`);
  }

  return { user: updated };
}
