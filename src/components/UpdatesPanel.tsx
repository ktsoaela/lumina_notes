import React, { useEffect, useState } from 'react';
import { CheckCircle2, Download, ExternalLink, FolderOpen, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';
import { formatBytes } from '../lib/markdownIO';
import { isElectronApp } from '../lib/platform';
import {
  APP_VERSION,
  RELEASES_PAGE,
  TARGET_LABEL,
  detectDownloadTarget,
  fetchLatestRelease,
  getDownloadedUpdate,
  getUpdatePrefs,
  isNewer,
  markChecked,
  pickAsset,
  setDownloadedUpdate,
  setUpdatePrefs,
  type DownloadTarget,
  type LatestRelease,
  type UpdatePrefs,
} from '../lib/version';

const labelClass = 'mb-1 block text-xs font-medium text-[var(--app-muted)]';

function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-[var(--radius-ui)] border border-[var(--app-border)] bg-[var(--gutter)]/40 px-4 py-3',
        disabled && 'cursor-not-allowed opacity-60'
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 accent-[var(--spine)]"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-[var(--app-fg)]">{label}</span>
        <span className="mt-0.5 block text-xs text-[var(--app-muted)]">{description}</span>
      </span>
    </label>
  );
}

/** Profile → About & updates: version, update check, in-app download. */
export function UpdatesPanel({ className }: { className?: string }) {
  const desktop = isElectronApp() && !!window.luminaDesktop?.downloadUpdate;
  const target: DownloadTarget = detectDownloadTarget();
  const [prefs, setPrefs] = useState<UpdatePrefs>(() => getUpdatePrefs());
  const [checking, setChecking] = useState(false);
  const [latest, setLatest] = useState<LatestRelease | null>(null);
  const [checkErr, setCheckErr] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ received: number; total: number } | null>(null);
  const [downloaded, setDownloaded] = useState(() => getDownloadedUpdate());
  const [dlErr, setDlErr] = useState<string | null>(null);

  const check = async () => {
    setChecking(true);
    setCheckErr(null);
    try {
      const rel = await fetchLatestRelease();
      markChecked();
      setLatest(rel);
    } catch (e) {
      setCheckErr(e instanceof Error ? e.message : 'Could not check for updates');
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    void check();
  }, []);

  useEffect(() => {
    return window.luminaDesktop?.onUpdateProgress?.((p) => {
      if (p.error) {
        setProgress(null);
        return;
      }
      if (p.done) {
        setProgress(null);
        return;
      }
      if (typeof p.received === 'number') {
        setProgress({ received: p.received, total: p.total ?? 0 });
      }
    });
  }, []);

  const updatePrefs = (next: UpdatePrefs) => {
    setPrefs(next);
    setUpdatePrefs(next);
  };

  const hasUpdate = latest ? isNewer(latest.version) : false;
  const asset = latest ? pickAsset(latest.assets, target) : null;
  const alreadyDownloaded = downloaded && latest && downloaded.version === latest.version;

  const download = async () => {
    if (!latest || !asset) return;
    setDlErr(null);
    if (!desktop) {
      // Browser / phone: hand the file to the browser's own downloader.
      window.open(asset.url, '_blank', 'noopener');
      return;
    }
    setProgress({ received: 0, total: asset.size });
    const res = await window.luminaDesktop!.downloadUpdate!({
      url: asset.url,
      name: asset.name,
      size: asset.size,
    });
    setProgress(null);
    if (res.ok && res.path) {
      const v = { version: latest.version, path: res.path };
      setDownloadedUpdate(v);
      setDownloaded(v);
    } else {
      setDlErr(res.error || 'Download failed');
    }
  };

  const pct =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.received / progress.total) * 100))
      : null;

  return (
    <section className={cn('studio-panel bg-[var(--paper)] p-6 shadow-sm', className)}>
      <h2 className="mb-1 font-display text-base font-medium text-[var(--app-fg)]">
        About &amp; updates
      </h2>
      <p className="mb-6 text-sm text-[var(--app-muted)]">
        Your installed version and the newest Lumina Notes release.
      </p>

      <dl className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--gutter)] p-4">
          <dt className="text-xs text-[var(--app-muted)]">Installed version</dt>
          <dd className="mt-1 text-xl font-semibold text-[var(--app-fg)]" data-testid="app-version">
            v{APP_VERSION}
          </dd>
          <dd className="mt-0.5 text-xs text-[var(--app-muted)]">
            {desktop ? `Desktop app · ${TARGET_LABEL[target]}` : 'Web app'}
          </dd>
        </div>
        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--gutter)] p-4">
          <dt className="text-xs text-[var(--app-muted)]">Latest release</dt>
          <dd className="mt-1 text-xl font-semibold text-[var(--app-fg)]">
            {checking ? (
              <Loader2 className="h-5 w-5 animate-spin text-[var(--spine)]" />
            ) : latest ? (
              `v${latest.version}`
            ) : (
              '—'
            )}
          </dd>
          <dd className="mt-0.5 text-xs text-[var(--app-muted)]">
            {latest?.publishedAt
              ? `Published ${new Date(latest.publishedAt).toLocaleDateString()}`
              : checkErr ?? ' '}
          </dd>
        </div>
      </dl>

      {latest && !checking ? (
        hasUpdate ? (
          <div className="mb-6 rounded-xl border border-[color-mix(in_srgb,var(--spine)_40%,var(--app-border))] bg-[color-mix(in_srgb,var(--spine)_8%,var(--paper))] p-4">
            <p className="text-sm font-medium text-[var(--app-fg)]">
              Lumina Notes v{latest.version} is available.
            </p>
            <p className="mt-1 text-xs text-[var(--app-muted)]">
              {asset
                ? `${TARGET_LABEL[target]} download: ${asset.name} (${formatBytes(asset.size)})`
                : `No ${TARGET_LABEL[target]} build in this release — see the release page.`}
            </p>
            {pct !== null || progress ? (
              <div className="mt-3">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--gutter)]">
                  <div
                    className="h-full rounded-full bg-[var(--spine)] transition-[width]"
                    style={{ width: `${pct ?? 5}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-[var(--app-muted)]">
                  Downloading… {pct !== null ? `${pct}%` : formatBytes(progress?.received ?? 0)}
                </p>
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {alreadyDownloaded && desktop ? (
                <button
                  type="button"
                  className="studio-btn-primary !px-4 !py-2 !text-xs"
                  onClick={() => void window.luminaDesktop?.showUpdateFile?.(downloaded!.path)}
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  Show downloaded file
                </button>
              ) : asset ? (
                <button
                  type="button"
                  disabled={!!progress}
                  className="studio-btn-primary !px-4 !py-2 !text-xs disabled:opacity-50"
                  onClick={() => void download()}
                >
                  {progress ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  {desktop ? 'Download update' : `Download for ${TARGET_LABEL[target]}`}
                </button>
              ) : null}
              <a
                href={latest.htmlUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="studio-btn !px-4 !py-2 !text-xs"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Release notes
              </a>
            </div>
            {alreadyDownloaded && desktop ? (
              <p className="mt-2 text-xs text-[var(--app-muted)]">
                Saved to your Downloads → “Lumina Notes updates”. Close Lumina and run the new
                file to finish updating{target === 'windows' ? ' (replace your old Lumina-Notes.exe)' : ''}.
              </p>
            ) : null}
            {dlErr ? <p className="mt-2 text-xs text-[var(--danger)]">{dlErr}</p> : null}
          </div>
        ) : (
          <p className="mb-6 inline-flex items-center gap-2 text-sm text-[var(--spine)]">
            <CheckCircle2 className="h-4 w-4" />
            You&apos;re on the latest version.
          </p>
        )
      ) : null}

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={checking}
          onClick={() => void check()}
          className="studio-btn !text-xs disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', checking && 'animate-spin')} />
          Check for updates
        </button>
        <a
          href={RELEASES_PAGE}
          target="_blank"
          rel="noreferrer noopener"
          className="studio-btn !text-xs"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          All releases
        </a>
      </div>

      <p className={cn(labelClass, 'mb-2')}>Update preferences</p>
      <div className="space-y-3">
        <Toggle
          checked={prefs.notify}
          onChange={(notify) => updatePrefs({ ...prefs, notify })}
          label="Tell me about new versions"
          description="Check for a newer release when Lumina opens and show a notice."
        />
        <Toggle
          checked={prefs.autoDownload}
          disabled={!desktop}
          onChange={(autoDownload) => updatePrefs({ ...prefs, autoDownload })}
          label="Download new versions automatically"
          description={
            desktop
              ? 'Fetch the new build in the background so it is ready to install.'
              : 'Available in the desktop app. The web app updates itself when you reload.'
          }
        />
      </div>
    </section>
  );
}

export default UpdatesPanel;
