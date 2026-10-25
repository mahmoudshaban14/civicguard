const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:3000';

export async function adminApiClient<T>(
  endpoint: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, headers = {}, ...rest } = options;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };

  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...rest,
    headers: requestHeaders,
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg =
      body?.error?.message || `Request failed with status ${response.status}`;
    const err = new Error(errorMsg);
    (err as { code?: string }).code = body?.error?.code || 'UNKNOWN_ERROR';
    (err as { status?: number }).status = response.status;
    throw err;
  }

  return body as T;
}
