import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  CORS_ORIGIN: z.string().default('*'),
  // Gemini image analysis. If GEMINI_API_KEY is empty the analyze endpoint
  // still works but returns a "manual review" fallback instead of calling AI.
  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_MODEL: z.string().default('gemini-3.8-flash'),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(15000),
  AI_ANALYSES_PER_HOUR: z.coerce.number().int().min(1).max(1000).default(10),
});

function loadConfig() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    if (process.env.NODE_ENV !== 'test') {
      const errorDetails = parsed.error.issues
        .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
        .join('\n');
      console.error(`Invalid backend environment configuration:\n${errorDetails}`);
      process.exit(1);
    }
    // Fallback for isolated test runs
    return {
      PORT: 3000,
      NODE_ENV: 'test' as const,
      SUPABASE_URL: 'https://placeholder.supabase.co',
      SUPABASE_ANON_KEY: 'test-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
      CORS_ORIGIN: '*',
      GEMINI_API_KEY: '',
      GEMINI_MODEL: 'gemini-3.8-flash',
      AI_TIMEOUT_MS: 15000,
      AI_ANALYSES_PER_HOUR: 10,
    };
  }

  return parsed.data;
}

export const config = loadConfig();
export type Config = typeof config;
