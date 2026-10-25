import crypto from 'node:crypto';
import { getSupabaseAdmin } from '../../db/client.js';
import { AppError } from '../../middleware/error-handler.js';
import type { AuthUser } from '../../middleware/auth.js';
import type { SignUploadInput } from './schema.js';

const STORAGE_BUCKET = 'report-images';

const EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export async function createSignedUploadUrl(user: AuthUser, input: SignUploadInput) {
  const ext = EXTENSION_MAP[input.contentType] || 'jpg';
  const fileUuid = crypto.randomUUID();
  const filePath = `${user.id}/${fileUuid}.${ext}`;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUploadUrl(filePath);

  if (error || !data) {
    throw new AppError(
      500,
      'STORAGE_ERROR',
      `Failed to generate signed upload URL: ${error?.message || 'Unknown error'}`,
    );
  }

  return {
    bucket: STORAGE_BUCKET,
    path: filePath,
    signedUrl: data.signedUrl,
    token: data.token,
    expiresIn: 3600,
  };
}
