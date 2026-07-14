import React, { useEffect, useRef, useState } from 'react';
import {
  Accessibility,
  ArrowLeft,
  Contrast,
  Database,
  Download,
  FileDown,
  FileUp,
  Loader2,
  Moon,
  Palette,
  Sun,
  Trash2,
  User as UserIcon,
  UserX,
} from 'lucide-react';
import { api } from '../lib/api';
import type { ThemeMode } from '../lib/theme';
import type { A11yPrefs } from '../lib/a11y';
import { downloadText, formatBytes, notebookToMarkdown } from '../lib/markdownIO';
import { sanitizeFilename } from '../lib/filename';
import type { Notebook, User, UserStats } from '../types';
import { writeSession } from '../lib/authCache';
import { cn } from '../lib/utils';
import { useAppDialogs } from '../context/AppDialogsContext';
import { validateProfileInput } from '../lib/validation';

type ProfileSection = 'account' | 'appearance' | 'accessibility' | 'storage' | 'danger';

const NAV: {
  id: ProfileSection;
  label: string;
  icon: React.ReactNode;
  danger?: boolean;
}[] = [
  { id: 'account', label: 'Account', icon: <UserIcon className="w-4 h-4" /> },
  { id: 'appearance', label: 'Appearance', icon: <Palette className="w-4 h-4" /> },
  {
    id: 'accessibility',
    label: 'Accessibility',
    icon: <Accessibility className="w-4 h-4" />,
  },
  { id: 'storage', label: 'Storage', icon: <Database className="w-4 h-4" /> },
  {
    id: 'danger',
    label: 'Danger Zone',
    icon: <Trash2 className="w-4 h-4" />,
    danger: true,
  },
];

interface ProfilePageProps {
  user: User;
  theme: ThemeMode;
  onThemeChange: (t: ThemeMode) => void;
  a11y: A11yPrefs;
  onA11yChange: (p: A11yPrefs) => void;
  onBack: () => void;
  onUserUpdated: (user: User, token: string) => void;
  /** After delete-data / import: refresh notes UI state */
  onLibraryChanged: () => void;
  /** After close account */
  onAccountClosed: () => void;
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename.endsWith('.json') ? filename : `${filename}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function confirmPhrase(user: User): string {
  return (user.username || user.email || '').trim();
}

const fieldClass = 'studio-input';

const labelClass =
  'mb-1 block text-xs font-medium text-[var(--app-muted)]';

const sectionClass = 'studio-panel bg-[var(--paper)] p-6 shadow-sm';

const mutedText = 'text-sm text-[var(--app-muted)]';


function A11yToggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-ui)] border border-[var(--app-border)] bg-[var(--gutter)]/40 px-4 py-3">
      <input
        type="checkbox"
        checked={checked}
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

export default function ProfilePage({
  user,
  theme,
  onThemeChange,
  a11y,
  onA11yChange,
  onBack,
  onUserUpdated,
  onLibraryChanged,
  onAccountClosed,
}: ProfilePageProps) {
  const { confirm, promptText } = useAppDialogs();
  const importRef = useRef<HTMLInputElement>(null);
  const [section, setSection] = useState<ProfileSection>('account');
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [username, setUsername] = useState(user.username ?? '');
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [zoneErr, setZoneErr] = useState<string | null>(null);

  const refreshStats = async () => {
    try {
      const s = await api.user.stats();
      setStats(s);
    } catch {
      setStats(null);
    }
  };

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const s = await api.user.stats();
        if (!c) setStats(s);
      } catch {
        if (!c) setStats(null);
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  useEffect(() => {
    setName(user.name);
    setEmail(user.email);
    setUsername(user.username ?? '');
  }, [user.name, user.email, user.username]);

  const requireTypeConfirm = async (
    title: string,
    message: string,
    confirmLabel: string
  ): Promise<boolean> => {
    const phrase = confirmPhrase(user);
    if (!phrase) {
      setZoneErr('Set a username or email on your account before continuing.');
      return false;
    }
    const first = await confirm({
      title,
      message,
      confirmLabel: 'Continue',
      variant: 'danger',
    });
    if (!first) return false;
    const typed = await promptText({
      title: 'Confirm with your account',
      label: `Type ${phrase} to confirm`,
      placeholder: phrase,
      confirmLabel,
    });
    if (!typed) return false;
    if (typed.trim().toLowerCase() !== phrase.toLowerCase()) {
      setZoneErr(`Confirmation text must match exactly: ${phrase}`);
      return false;
    }
    return true;
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const checked = validateProfileInput({ name, email, username });
    if (checked.ok === false) {
      setErr(checked.error);
      return;
    }
    const nameChanged = checked.data.name !== user.name.trim();
    const emailChanged = checked.data.email !== user.email.trim().toLowerCase();
    const usernameChanged =
      (checked.data.username ?? '') !== (user.username ?? '').trim().toLowerCase();
    if (!nameChanged && !emailChanged && !usernameChanged) return;
    const ok = await confirm({
      title: 'Save profile changes?',
      message:
        'Your name, email, and username will be updated on your account. Continue?',
      confirmLabel: 'Save changes',
      variant: 'default',
    });
    if (!ok) return;
    setSaving(true);
    try {
      const { token: newToken, user: u } = await api.auth.updateProfile({
        name: checked.data.name,
        email: checked.data.email,
        username: checked.data.username,
      });
      writeSession(u, newToken);
      onUserUpdated(u, newToken);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const backupData = async () => {
    setZoneErr(null);
    setBusy('backup');
    try {
      const data = await api.user.backup();
      const day = new Date().toISOString().slice(0, 10);
      downloadJson(`lumina-backup-${day}.json`, data);
    } catch (e2) {
      setZoneErr(e2 instanceof Error ? e2.message : 'Backup failed');
    } finally {
      setBusy(null);
    }
  };

  const exportFiles = async () => {
    setZoneErr(null);
    setBusy('export');
    try {
      const shelves = await api.bookshelves.list();
      const parts: string[] = [
        `# Lumina Notes export\n\nExported ${new Date().toISOString()}\n`,
      ];
      for (const shelf of shelves) {
        parts.push(`\n# Bookshelf: ${shelf.title}\n`);
        const active = await api.notebooks.list(false, shelf.id);
        const archived = await api.notebooks.list(true, shelf.id);
        for (const nb of [...active, ...archived] as Notebook[]) {
          parts.push(notebookToMarkdown(nb));
          parts.push('\n---\n');
        }
      }
      const day = new Date().toISOString().slice(0, 10);
      downloadText(
        `${sanitizeFilename(`lumina-notes-${day}`)}.md`,
        parts.join('\n')
      );
    } catch (e2) {
      setZoneErr(e2 instanceof Error ? e2.message : 'Export failed');
    } finally {
      setBusy(null);
    }
  };

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setZoneErr(null);
    const ok = await requireTypeConfirm(
      'Replace all library data?',
      'Importing a backup replaces every bookshelf, notebook, section, and page on this account. This cannot be undone.',
      'Replace data'
    );
    if (!ok) return;
    setBusy('import');
    try {
      const text = await f.text();
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(text) as Record<string, unknown>;
      } catch {
        throw new Error('Backup must be a valid Lumina JSON file');
      }
      const result = await api.user.importBackup(payload);
      if (result.stats) setStats(result.stats);
      else await refreshStats();
      onLibraryChanged();
    } catch (e2) {
      setZoneErr(e2 instanceof Error ? e2.message : 'Import failed');
    } finally {
      setBusy(null);
    }
  };

  const deleteData = async () => {
    setZoneErr(null);
    const ok = await requireTypeConfirm(
      'Delete all notebook data?',
      'This permanently deletes all bookshelves, notebooks, sections, and pages. Your account login will remain. A fresh empty bookshelf will be created.',
      'Delete all data'
    );
    if (!ok) return;
    setBusy('delete-data');
    try {
      await api.user.deleteData();
      await refreshStats();
      onLibraryChanged();
    } catch (e2) {
      setZoneErr(e2 instanceof Error ? e2.message : 'Delete failed');
    } finally {
      setBusy(null);
    }
  };

  const closeAccount = async () => {
    setZoneErr(null);
    const ok = await requireTypeConfirm(
      'Close your account?',
      'This permanently deletes your account and all notebooks. You will be signed out and cannot undo this.',
      'Close account'
    );
    if (!ok) return;
    setBusy('close');
    try {
      await api.auth.closeAccount();
      onAccountClosed();
    } catch (e2) {
      setZoneErr(e2 instanceof Error ? e2.message : 'Could not close account');
      setBusy(null);
    }
  };

  const dangerBtn =
    'inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-red-400/60 bg-[var(--paper)] px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40';

  const storageBtn =
    'studio-btn shrink-0 text-sm text-[var(--spine)]';

  return (
    <div className="flex h-full min-h-0 flex-col studio-shell text-[var(--app-fg)]">
      <div className="flex shrink-0 items-center gap-4 border-b border-[var(--app-border)] bg-[var(--app-surface)]/90 px-6 py-4 backdrop-blur-xl">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--spine)] hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to notes
        </button>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--spine)]/70">
            Account
          </p>
          <h1 className="font-display text-lg font-semibold text-[var(--app-fg)]">
            Profile & settings
          </h1>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* col-4 sidebar */}
            <aside className="lg:col-span-4">
              <div className="studio-panel bg-[var(--paper)] p-3 shadow-sm lg:sticky lg:top-4">
                <div className="mb-3 flex items-center gap-3 border-b border-[var(--app-border)] px-2 pb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--spine)_15%,var(--paper))] text-sm font-bold text-[var(--spine)]">
                    {(user.name || user.email || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--app-fg)]">
                      {user.name}
                    </p>
                    <p className="truncate text-xs text-[var(--app-muted)]">
                      {user.username ? `@${user.username}` : user.email}
                    </p>
                  </div>
                </div>
                <nav className="flex flex-row gap-1 overflow-x-auto lg:flex-col" aria-label="Settings">
                  {NAV.map((item) => {
                    const active = section === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSection(item.id)}
                        className={cn(
                          'inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          active && !item.danger &&
                            'bg-[color-mix(in_srgb,var(--spine)_12%,var(--paper))] text-[var(--spine)]',
                          active && item.danger &&
                            'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400',
                          !active && !item.danger &&
                            'text-[var(--app-muted)] hover:bg-[var(--gutter)]',
                          !active && item.danger &&
                            'text-red-600 hover:bg-red-50/70 dark:text-red-400 dark:hover:bg-red-950/20'
                        )}
                      >
                        {item.icon}
                        {item.label}
                      </button>
                    );
                  })}
                </nav>
              </div>
            </aside>

            {/* col-8 fields */}
            <main className="min-w-0 lg:col-span-8">
              {section === 'account' ? (
                <section className={sectionClass}>
                  <h2 className="mb-1 font-display text-base font-semibold text-[var(--app-fg)]">Account</h2>
                  <p className={cn(mutedText, 'mb-6')}>
                    Details used when you sign in and write Markdown notebooks.
                  </p>
                  <form onSubmit={save} className="space-y-5">
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-12 sm:items-start">
                      <label className={cn(labelClass, 'sm:col-span-4 sm:pt-2')}>Name</label>
                      <div className="sm:col-span-8">
                        <input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className={fieldClass}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-12 sm:items-start">
                      <label className={cn(labelClass, 'sm:col-span-4 sm:pt-2')}>Username</label>
                      <div className="sm:col-span-8">
                        <input
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          autoComplete="username"
                          placeholder="letters, numbers, underscore (3–32)"
                          className={fieldClass}
                        />
                        <p className="mt-1.5 text-xs text-[var(--app-muted)]">
                          Used for sign-in and Danger Zone confirmation.
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-12 sm:items-start">
                      <label className={cn(labelClass, 'sm:col-span-4 sm:pt-2')}>Email</label>
                      <div className="sm:col-span-8">
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className={fieldClass}
                        />
                      </div>
                    </div>
                    {err ? (
                      <p className="text-sm text-red-600 dark:text-red-400">{err}</p>
                    ) : null}
                    <div className="flex justify-end border-t border-[var(--app-border)] pt-4">
                      <button
                        type="submit"
                        disabled={saving}
                        className="studio-btn-primary disabled:opacity-50"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Save changes
                      </button>
                    </div>
                  </form>
                </section>
              ) : null}

              {section === 'appearance' ? (
                <section className={sectionClass}>
                  <h2 className="mb-1 font-display text-base font-medium text-[var(--app-fg)]">
                    Appearance
                  </h2>
                  <p className={cn(mutedText, 'mb-6')}>
                    One calm theme everywhere — Notes, Library, and Profile. Choose light or dark for
                    everyday writing; use Accessibility for high contrast and other vision help.
                  </p>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-12 sm:items-center">
                    <span className={cn(labelClass, 'mb-0 sm:col-span-4')}>Theme</span>
                    <div className="sm:col-span-8">
                      <div className="inline-flex flex-wrap rounded-lg border border-[var(--app-border)] bg-[var(--gutter)] p-0.5">
                        <button
                          type="button"
                          onClick={() => onThemeChange('light')}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                            theme === 'light'
                              ? 'bg-[var(--paper)] text-[var(--spine)] shadow-sm'
                              : 'text-[var(--app-muted)]'
                          )}
                        >
                          <Sun className="w-3.5 h-3.5" />
                          Light
                        </button>
                        <button
                          type="button"
                          onClick={() => onThemeChange('dark')}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                            theme === 'dark'
                              ? 'bg-[var(--paper)] text-[var(--spine)] shadow-sm'
                              : 'text-[var(--app-muted)]'
                          )}
                        >
                          <Moon className="w-3.5 h-3.5" />
                          Dark
                        </button>
                      </div>
                    </div>
                  </div>
                </section>
              ) : null}

              {section === 'accessibility' ? (
                <section className={sectionClass}>
                  <h2 className="mb-1 font-display text-base font-medium text-[var(--app-fg)]">
                    Accessibility
                  </h2>
                  <p className={cn(mutedText, 'mb-6')}>
                    Options for vision, motion sensitivity, and clearer reading while you write
                    Markdown.
                  </p>

                  <div className="mb-6">
                    <p className={cn(labelClass, 'mb-2')}>Contrast</p>
                    <div className="inline-flex flex-wrap rounded-lg border border-[var(--app-border)] bg-[var(--gutter)] p-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (theme === 'contrast') onThemeChange('light');
                        }}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                          theme !== 'contrast'
                            ? 'bg-[var(--paper)] text-[var(--spine)] shadow-sm'
                            : 'text-[var(--app-muted)]'
                        )}
                      >
                        Standard
                      </button>
                      <button
                        type="button"
                        onClick={() => onThemeChange('contrast')}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                          theme === 'contrast'
                            ? 'bg-[var(--paper)] text-[var(--spine)] shadow-sm'
                            : 'text-[var(--app-muted)]'
                        )}
                      >
                        <Contrast className="w-3.5 h-3.5" />
                        High contrast
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-[var(--app-muted)]">
                      High contrast uses strong borders and bright text for low-vision comfort.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <A11yToggle
                      checked={a11y.largeText}
                      onChange={(largeText) => onA11yChange({ ...a11y, largeText })}
                      label="Larger text"
                      description="Increase base type size across Notes, Library, and Profile."
                    />
                    <A11yToggle
                      checked={a11y.reduceMotion}
                      onChange={(reduceMotion) => onA11yChange({ ...a11y, reduceMotion })}
                      label="Reduce motion"
                      description="Minimize animations (including the storage rail aisle motion)."
                    />
                    <A11yToggle
                      checked={a11y.underlineLinks}
                      onChange={(underlineLinks) => onA11yChange({ ...a11y, underlineLinks })}
                      label="Underline links"
                      description="Always underline links in preview and settings for clearer navigation."
                    />
                  </div>
                </section>
              ) : null}

              {section === 'storage' ? (
                <div className="space-y-6">
                  <section className="studio-panel bg-[var(--paper)] p-6 shadow-sm">
                    <h2 className="mb-1 text-base font-semibold text-[var(--app-fg)]">
                      Storage & library
                    </h2>
                    <p className="mb-6 text-sm text-[var(--app-muted)]">
                      Overview of space used by your notebooks and pages.
                    </p>
                    {loading ? (
                      <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
                    ) : stats ? (
                      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--gutter)] p-4">
                          <dt className="text-xs text-[var(--app-muted)]">
                            Estimated storage
                          </dt>
                          <dd className="mt-1 text-xl font-semibold text-[var(--app-fg)]">
                            {formatBytes(stats.storageBytes)}
                          </dd>
                        </div>
                        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--gutter)] p-4">
                          <dt className="text-xs text-[var(--app-muted)]">
                            Active notebooks
                          </dt>
                          <dd className="mt-1 text-xl font-semibold text-[var(--app-fg)]">
                            {stats.notebooksActive}
                          </dd>
                        </div>
                        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--gutter)] p-4">
                          <dt className="text-xs text-[var(--app-muted)]">
                            Archived notebooks
                          </dt>
                          <dd className="mt-1 text-xl font-semibold text-[var(--app-fg)]">
                            {stats.notebooksArchived}
                          </dd>
                        </div>
                        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--gutter)] p-4">
                          <dt className="text-xs text-[var(--app-muted)]">
                            Sections (active)
                          </dt>
                          <dd className="mt-1 text-xl font-semibold text-[var(--app-fg)]">
                            {stats.sectionsActive}
                          </dd>
                        </div>
                        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--gutter)] p-4">
                          <dt className="text-xs text-[var(--app-muted)]">
                            Pages (active)
                          </dt>
                          <dd className="mt-1 text-xl font-semibold text-[var(--app-fg)]">
                            {stats.pagesActive}
                          </dd>
                        </div>
                        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--gutter)] p-4">
                          <dt className="text-xs text-[var(--app-muted)]">
                            Pages (archived)
                          </dt>
                          <dd className="mt-1 text-xl font-semibold text-[var(--app-fg)]">
                            {stats.pagesArchived}
                          </dd>
                        </div>
                      </dl>
                    ) : (
                      <p className="text-sm text-[var(--app-muted)]">
                        Could not load stats.
                      </p>
                    )}
                  </section>

                  <section className="overflow-hidden studio-panel bg-[var(--paper)] shadow-sm">
                    <div className="border-b border-[var(--app-border)] px-6 py-4">
                      <h2 className="text-base font-semibold text-[var(--app-fg)]">
                        Backup & transfer
                      </h2>
                      <p className="mt-1 text-sm text-[var(--app-muted)]">
                        Download backups, export Markdown, or restore from a Lumina JSON file.
                        Import replaces all current library data — confirm by typing your username
                        {user.username ? '' : ' (or email)'} when prompted.
                      </p>
                    </div>
                    <ul className="divide-y divide-[var(--app-border)]">
                      <li className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 sm:max-w-[60%]">
                          <p className="text-sm font-semibold text-[var(--app-fg)]">Backup data</p>
                          <p className="text-xs text-[var(--app-muted)]">
                            Download a full JSON backup of bookshelves, notebooks, and pages.
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={!!busy}
                          onClick={backupData}
                          className={storageBtn}
                        >
                          {busy === 'backup' ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                          Backup data
                        </button>
                      </li>
                      <li className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 sm:max-w-[60%]">
                          <p className="text-sm font-semibold text-[var(--app-fg)]">Export files</p>
                          <p className="text-xs text-[var(--app-muted)]">
                            Export your library as a single Markdown file.
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={!!busy}
                          onClick={exportFiles}
                          className={storageBtn}
                        >
                          {busy === 'export' ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <FileDown className="w-4 h-4" />
                          )}
                          Export files
                        </button>
                      </li>
                      <li className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 sm:max-w-[60%]">
                          <p className="text-sm font-semibold text-[var(--app-fg)]">Import file</p>
                          <p className="text-xs text-[var(--app-muted)]">
                            Restore from a Lumina JSON backup. Replaces all current library data.
                          </p>
                        </div>
                        <div>
                          <input
                            ref={importRef}
                            type="file"
                            accept="application/json,.json"
                            className="hidden"
                            onChange={onImportFile}
                          />
                          <button
                            type="button"
                            disabled={!!busy}
                            onClick={() => importRef.current?.click()}
                            className={storageBtn}
                          >
                            {busy === 'import' ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <FileUp className="w-4 h-4" />
                            )}
                            Import file
                          </button>
                        </div>
                      </li>
                    </ul>
                    {zoneErr ? (
                      <div className="border-t border-[var(--app-border)] px-6 py-3 text-sm text-red-600 dark:text-red-400">
                        {zoneErr}
                      </div>
                    ) : null}
                  </section>
                </div>
              ) : null}

              {section === 'danger' ? (
                <section
                  className="studio-panel overflow-hidden border-red-400/70 bg-[var(--paper)] shadow-sm dark:border-red-900/70"
                  aria-labelledby="danger-zone-heading"
                >
                  <div className="border-b border-red-200 bg-red-50/80 px-6 py-4 dark:border-red-900/50 dark:bg-red-950/30">
                    <h2
                      id="danger-zone-heading"
                      className="text-sm font-semibold uppercase tracking-wide text-red-700 dark:text-red-400"
                    >
                      Danger Zone
                    </h2>
                    <p className="mt-1 text-xs text-red-700/80 dark:text-red-400/80">
                      Destructive or irreversible actions. Confirm by typing your username
                      {user.username ? '' : ' (or email)'} when prompted.
                    </p>
                  </div>

                  <ul className="divide-y divide-red-100 dark:divide-red-900/40">
                    <li className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 sm:max-w-[60%]">
                        <p className="text-sm font-semibold text-[var(--app-fg)]">Delete data</p>
                        <p className="text-xs text-[var(--app-muted)]">
                          Permanently erase all notebooks. Keeps your login. Cannot be undone.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={!!busy}
                        onClick={deleteData}
                        className={dangerBtn}
                      >
                        {busy === 'delete-data' ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                        Delete data
                      </button>
                    </li>

                    <li className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 sm:max-w-[60%]">
                        <p className="text-sm font-semibold text-[var(--app-fg)]">Close account</p>
                        <p className="text-xs text-[var(--app-muted)]">
                          Delete your account and all data permanently. You will be signed out.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={!!busy}
                        onClick={closeAccount}
                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-red-600 bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 dark:border-red-500 dark:bg-red-700 dark:hover:bg-red-600"
                      >
                        {busy === 'close' ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <UserX className="w-4 h-4" />
                        )}
                        Close account
                      </button>
                    </li>
                  </ul>

                  {zoneErr ? (
                    <div className="border-t border-red-200 px-6 py-3 text-sm text-red-600 dark:border-red-900/50 dark:text-red-400">
                      {zoneErr}
                    </div>
                  ) : null}
                </section>
              ) : null}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
