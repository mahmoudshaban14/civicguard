function getApiBaseUrl(): string {
  const configured =
    process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
  if (typeof window !== 'undefined' && window.location?.hostname) {
    try {
      const url = new URL(configured);
      if (
        (url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
        window.location.hostname
      ) {
        url.hostname = window.location.hostname;
        return url.origin;
      }
    } catch {
      // fallback to configured
    }
  }
  return configured;
}

export interface ApiResponse<T> {
  data?: T;
  error?: {
    code: string;
    message: string;
    requestId?: string;
  };
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, headers = {}, ...rest } = options;
  const baseUrl = getApiBaseUrl();

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };

  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...rest,
    headers: requestHeaders,
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = body?.error?.message || `Request failed with status ${response.status}`;
    const err = new Error(errorMsg);
    (err as { code?: string }).code = body?.error?.code || 'UNKNOWN_ERROR';
    (err as { status?: number }).status = response.status;
    throw err;
  }

  return body as T;
}
