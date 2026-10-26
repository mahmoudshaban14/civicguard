import { config } from '../../config.js';
import { GeminiProvider } from './provider.gemini.js';
import type { AiProvider } from './types.js';

let cached: AiProvider | null | undefined;

/** Returns the configured provider, or null when no API key is set. */
export function getAiProvider(): AiProvider | null {
  if (cached !== undefined) return cached;
  cached = config.GEMINI_API_KEY
    ? new GeminiProvider(config.GEMINI_API_KEY, config.GEMINI_MODEL, config.AI_TIMEOUT_MS)
    : null;
  return cached;
}
