const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api';

let csrf: string | null = null;

export async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const tokenResponse = await fetch(`${baseUrl}/auth/csrf`, {
      credentials: 'include',
    });
    const tokenBody = (await tokenResponse.json()) as { csrfToken: string };
    csrf = tokenBody.csrfToken;
    headers['X-CSRF-Token'] = csrf;
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    credentials: 'include',
    ...(options.body === undefined
      ? {}
      : { body: JSON.stringify(options.body) }),
  });
  if (!response.ok) {
    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(result.error ?? `Request failed (${response.status}).`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
