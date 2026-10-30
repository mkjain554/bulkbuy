import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from './api';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('mobile API client', () => {
  it('sends a GET request with cookie credentials without a CSRF lookup', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ pools: [] }), { status: 200 }),
    );

    await expect(request<{ pools: unknown[] }>('/pools')).resolves.toEqual({
      pools: [],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'GET',
      credentials: 'include',
    });
  });

  it('fetches a CSRF token before sending a state-changing request', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ joined: true }), { status: 201 }),
      );

    await expect(
      request('/pools/123/join', {
        method: 'POST',
        body: { responses: { color: 'Black' } },
      }),
    ).resolves.toEqual({ joined: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': 'csrf-token',
      },
      body: JSON.stringify({ responses: { color: 'Black' } }),
    });
  });

  it('surfaces API errors to the caller', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Pool is full.' }), {
          status: 409,
        }),
      );

    await expect(
      request('/pools/123/join', { method: 'POST' }),
    ).rejects.toThrow('Pool is full.');
  });
});
