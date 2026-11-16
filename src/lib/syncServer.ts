/**
 * Free multi-device sync without Supabase:
 * Point every client (desktop / phone / tablet) at the same Lumina FastAPI URL
 * (Docker on Render/Fly/Railway free tier, or a PC on your LAN).
 *
 * Empty = same-origin `/api` (local Electron backend or Vite proxy).
 */

const STORAGE_KEY = 'lumina_sync_server';

/** True for bind-all hosts Chromium cannot open (0.0.0.0 / ::). */
function isUnspecifiedHost(hostname: string): boolean {
  const h = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');
  return h === '0.0.0.0' || h === '::' || h === '[::]';
}

export function normalizeSyncServerUrl(raw: string): string {
  let u = (raw || '').trim().replace(/\/+$/, '');
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) {
    u = `https://${u}`;
  }
  u = u.replace(/\/+$/, '');
  try {
    const host = new URL(u).hostname;
    // 0.0.0.0 is a listen address, not a client URL — treat as "use local API".
    if (isUnspecifiedHost(host)) return '';
  } catch {
    return '';
  }
  return u;
}

export function getSyncServerUrl(): string {
  if (typeof window === 'undefined') {
    return normalizeSyncServerUrl(
      (import.meta.env.VITE_API_URL as string | undefined) || ''
    );
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored != null && stored.trim() !== '') {
      const clean = normalizeSyncServerUrl(stored);
      // Drop a previously saved bind address so the desktop stops trying 0.0.0.0.
      if (!clean && stored.trim()) {
        localStorage.removeItem(STORAGE_KEY);
      }
      return clean;
    }
  } catch {
    /* ignore */
  }
  return normalizeSyncServerUrl(
    (import.meta.env.VITE_API_URL as string | undefined) || ''
  );
}

/** Persist sync base URL. Pass empty string to clear (use local/same-origin API). */
export function setSyncServerUrl(url: string): void {
  const clean = normalizeSyncServerUrl(url);
  try {
    if (clean) localStorage.setItem(STORAGE_KEY, clean);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Absolute or relative URL for an API path like `/api/auth/me`. */
export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  const base = getSyncServerUrl();
  return base ? `${base}${p}` : p;
}

export async function probeSyncServer(
  baseUrl: string
): Promise<{ ok: boolean; detail: string }> {
  const base = normalizeSyncServerUrl(baseUrl);
  if (!base) {
    return { ok: false, detail: 'Enter a server URL first.' };
  }
  try {
    const res = await fetch(`${base}/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      return { ok: false, detail: `Server responded ${res.status}` };
    }
    return { ok: true, detail: 'Connected — use the same account on every device.' };
  } catch (e) {
    return {
      ok: false,
      detail:
        e instanceof Error
          ? e.message
          : 'Could not reach server (HTTPS / CORS / offline).',
    };
  }
}
