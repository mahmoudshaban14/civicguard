import { createClient } from '@supabase/supabase-js';
import { config } from '../../config.js';
import { getSupabaseAdmin } from '../../db/client.js';
import { AppError } from '../../middleware/error-handler.js';
import type { LoginInput } from './schema.js';

type NormalizedIdentifier =
  | { kind: 'email'; value: string }
  | { kind: 'national_id'; value: string }
  | { kind: 'phone_number'; value: string }
  | { kind: 'invalid'; value: '' };

const DIGIT_MAP: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
};

export function normalizeLoginIdentifier(input: string): NormalizedIdentifier {
  const trimmed = input.trim();
  if (trimmed.includes('@')) {
    return { kind: 'email', value: trimmed.toLowerCase() };
  }

  const ascii = trimmed.replace(/[٠-٩۰-۹]/g, (digit) => DIGIT_MAP[digit] ?? digit);
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
