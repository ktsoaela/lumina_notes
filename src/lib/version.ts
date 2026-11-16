/** App version + GitHub release update checks (web, desktop, Android). */

declare const __APP_VERSION__: string | undefined;

export const APP_VERSION: string =
  typeof __APP_VERSION__ === 'string' && __APP_VERSION__ ? __APP_VERSION__ : '0.0.0';

export const RELEASES_REPO = 'ktsoaela/lumina_notes';
export const RELEASES_PAGE = `https://github.com/${RELEASES_REPO}/releases`;
const LATEST_API = `https://api.github.com/repos/${RELEASES_REPO}/releases/latest`;

export type ReleaseAsset = { name: string; url: string; size: number };

export type LatestRelease = {
  version: string;
  name: string;
  htmlUrl: string;
  publishedAt: string;
  notes: string;
  assets: ReleaseAsset[];
};

export type DownloadTarget = 'windows' | 'mac' | 'linux' | 'android';

/** Parse "v1.2.3" / "1.2.3-beta" → [1,2,3]. Non-numeric parts count as 0. */
function parts(v: string): number[] {
  return v
    .trim()
    .replace(/^v/i, '')
    .split(/[-+]/)[0]
    .split('.')
    .map((p) => Number.parseInt(p, 10) || 0);
}

/** >0 when a is newer than b, <0 when older, 0 when equal. */
export function compareVersions(a: string, b: string): number {
  const pa = parts(a);
  const pb = parts(b);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export function isNewer(latest: string, current: string = APP_VERSION): boolean {
  return compareVersions(latest, current) > 0;
}

export async function fetchLatestRelease(signal?: AbortSignal): Promise<LatestRelease> {
  const res = await fetch(LATEST_API, {
    headers: { Accept: 'application/vnd.github+json' },
    signal,
  });
  if (!res.ok) throw new Error(`Update check failed (${res.status})`);
  const data = (await res.json()) as {
    tag_name?: string;
    name?: string;
    html_url?: string;
    published_at?: string;
    body?: string;
    assets?: { name: string; browser_download_url: string; size: number }[];
  };
  const version = String(data.tag_name || '').replace(/^v/i, '');
  if (!version) throw new Error('Latest release has no version tag');
  return {
    version,
    name: data.name || `v${version}`,
    htmlUrl: data.html_url || RELEASES_PAGE,
    publishedAt: data.published_at || '',
    notes: data.body || '',
    assets: (data.assets || []).map((a) => ({
      name: a.name,
      url: a.browser_download_url,
      size: a.size,
    })),
  };
}

/** Which installer the current device wants. */
export function detectDownloadTarget(): DownloadTarget {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  if (/Android/i.test(ua)) return 'android';
  if (/Mac/i.test(ua)) return 'mac';
  if (/Linux/i.test(ua)) return 'linux';
  return 'windows';
}

export function pickAsset(
  assets: ReleaseAsset[],
  target: DownloadTarget
): ReleaseAsset | null {
  const by = (re: RegExp) => assets.find((a) => re.test(a.name)) ?? null;
  switch (target) {
    case 'windows':
      return by(/\.exe$/i);
    case 'mac': {
      const arm = typeof navigator !== 'undefined' && /arm|aarch64/i.test(navigator.userAgent);
      return (arm ? by(/arm64.*\.dmg$/i) : null) ?? by(/\.dmg$/i) ?? by(/mac.*\.zip$/i);
    }
    case 'linux':
      return by(/\.AppImage$/i);
    case 'android':
      return by(/\.apk$/i);
  }
}

export const TARGET_LABEL: Record<DownloadTarget, string> = {
  windows: 'Windows',
  mac: 'macOS',
  linux: 'Linux',
  android: 'Android',
};

/* ---------- Update preferences (per device) ---------- */

const UPDATE_KEY = 'lumina_update_prefs';
const LAST_CHECK_KEY = 'lumina_update_last_check';

export type UpdatePrefs = {
  /** Check on launch and show a notice when a newer version exists. */
  notify: boolean;
  /** Desktop only: download the new build in the background. */
  autoDownload: boolean;
};

export const DEFAULT_UPDATE_PREFS: UpdatePrefs = { notify: true, autoDownload: false };

export function getUpdatePrefs(): UpdatePrefs {
  try {
    const raw = localStorage.getItem(UPDATE_KEY);
    if (!raw) return { ...DEFAULT_UPDATE_PREFS };
    const p = JSON.parse(raw) as Partial<UpdatePrefs>;
    return {
      notify: p.notify !== false,
      autoDownload: Boolean(p.autoDownload),
    };
  } catch {
    return { ...DEFAULT_UPDATE_PREFS };
  }
}

export function setUpdatePrefs(prefs: UpdatePrefs): void {
  try {
    localStorage.setItem(UPDATE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

/** Throttle launch checks so we don't hit the GitHub API on every reload. */
export function shouldAutoCheck(intervalMs = 6 * 60 * 60 * 1000): boolean {
  try {
    const last = Number(localStorage.getItem(LAST_CHECK_KEY) || 0);
    return Date.now() - last > intervalMs;
  } catch {
    return true;
  }
}

const DOWNLOADED_KEY = 'lumina_update_downloaded';

/** Desktop: the installer we already fetched, so we don't download it twice. */
export function getDownloadedUpdate(): { version: string; path: string } | null {
  try {
    const raw = localStorage.getItem(DOWNLOADED_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { version?: string; path?: string };
    if (!p.version || !p.path || !isNewer(p.version)) return null;
    return { version: p.version, path: p.path };
  } catch {
    return null;
  }
}

export function setDownloadedUpdate(v: { version: string; path: string }): void {
  try {
    localStorage.setItem(DOWNLOADED_KEY, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

export function markChecked(): void {
  try {
    localStorage.setItem(LAST_CHECK_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}
