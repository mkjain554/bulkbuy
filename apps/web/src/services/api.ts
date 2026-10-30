import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

export async function csrfToken(): Promise<string> {
  const { data } = await api.get<{ csrfToken: string }>('/auth/csrf');
  return data.csrfToken;
}

export async function mutate<T>(
  method: 'post' | 'put' | 'patch' | 'delete',
  path: string,
  body?: unknown,
): Promise<T> {
  const token = await csrfToken();
  const { data } = await api.request<T>({
    method,
    url: path,
    data: body,
    headers: { 'X-CSRF-Token': token },
  });
  return data;
}

export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.details?.[0]?.message;
    if (typeof detail === 'string') return detail;
    const message = error.response?.data?.error;
    if (typeof message === 'string') return message;
    return error.message;
  }
  return error instanceof Error ? error.message : 'Something went wrong.';
}
