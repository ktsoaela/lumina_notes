import { afterEach, describe, expect, it, vi } from 'vitest';
import { secondsLeft, startPairing } from './pairing';

function stubStorage(values: Record<string, string>) {
  vi.stubGlobal('window', {});
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (k in values ? values[k] : null),
    setItem: () => undefined,
    removeItem: () => undefined,
  });
}

function stubFetch() {
  const fetchMock = vi.fn(async () =>
    new Response(
      JSON.stringify({
        code: 'AB12CD34',
        expiresAt: '2026-11-16T15:00:00.000Z',
        serverUrl: 'https://notes.example.com',
        deepLink: 'lumina://pair?u=https%3A%2F%2Fnotes.example.com&c=AB12CD34',
        lan: false,
      }),
      { status: 200 }
    )
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('secondsLeft', () => {
  it('floors remaining seconds', () => {
    const now = Date.parse('2026-11-16T15:00:00.000Z');
    expect(secondsLeft('2026-11-16T15:01:30.400Z', now)).toBe(90);
  });
  it('clamps at zero once expired', () => {
    const now = Date.parse('2026-11-16T15:10:00.000Z');
    expect(secondsLeft('2026-11-16T15:00:00.000Z', now)).toBe(0);
  });
});

describe('startPairing', () => {
  it('sends the saved sync URL and bearer token to the saved server', async () => {
    stubStorage({ lumina_token: 'jwt-1', lumina_sync_server: 'https://notes.example.com/' });
    const fetchMock = stubFetch();
    const res = await startPairing();
    expect(res.code).toBe('AB12CD34');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://notes.example.com/api/pair/start');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jwt-1');
    expect(JSON.parse(init.body as string)).toEqual({ serverUrl: 'https://notes.example.com' });
  });

  it('omits serverUrl when using the local API', async () => {
    stubStorage({ lumina_token: 'jwt-1' });
    const fetchMock = stubFetch();
    await startPairing();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/pair/start');
    expect(JSON.parse(init.body as string)).toEqual({});
  });

  it('throws the API error detail', async () => {
    stubStorage({ lumina_token: 'jwt-1' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ detail: 'Invalid server URL' }), { status: 400 }))
    );
    await expect(startPairing()).rejects.toThrow('Invalid server URL');
  });
});
