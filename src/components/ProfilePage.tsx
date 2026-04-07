import React, { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, Moon, Sun } from 'lucide-react';
import { api } from '../lib/api';
import type { ThemeMode } from '../lib/theme';
import { formatBytes } from '../lib/markdownIO';
import type { User, UserStats } from '../types';
import { writeSession } from '../lib/authCache';
import { cn } from '../lib/utils';
import { useAppDialogs } from '../context/AppDialogsContext';

interface ProfilePageProps {
  user: User;
  theme: ThemeMode;
  onThemeChange: (t: ThemeMode) => void;
  onBack: () => void;
  onUserUpdated: (user: User, token: string) => void;
}

export default function ProfilePage({
  user,
  theme,
  onThemeChange,
  onBack,
  onUserUpdated,
}: ProfilePageProps) {
  const { confirm } = useAppDialogs();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
  }, [user.name, user.email]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const nameChanged = name.trim() !== user.name.trim();
    const emailChanged = email.trim() !== user.email.trim();
    if (!nameChanged && !emailChanged) return;
    const ok = await confirm({
      title: 'Save profile changes?',
      message:
        'Your name and email will be updated on your account. Continue?',
      confirmLabel: 'Save changes',
      variant: 'default',
    });
    if (!ok) return;
    setSaving(true);
    try {
      const { token: newToken, user: u } = await api.auth.updateProfile({
        name: name.trim(),
        email: email.trim(),
      });
      writeSession(u, newToken);
      onUserUpdated(u, newToken);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--app-bg)] text-[var(--app-fg)]">
      <div className="shrink-0 border-b border-gray-200 dark:border-[var(--app-border)] px-6 py-4 flex items-center gap-4 bg-white dark:bg-[var(--app-surface)]">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to notes
        </button>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-[var(--app-fg)]">Profile & settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full space-y-8">
        <section className="rounded-2xl border border-gray-200 dark:border-[var(--app-border)] bg-white dark:bg-[var(--app-surface)] p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-[var(--app-muted)]">
            Appearance
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-gray-600 dark:text-[var(--app-fg)]/90">Theme</span>
            <div className="inline-flex rounded-lg border border-[var(--app-border)] bg-gray-50 p-0.5 dark:bg-[var(--app-bg)]">
              <button
                type="button"
                onClick={() => onThemeChange('light')}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  theme === 'light'
                    ? 'bg-white text-brand-800 shadow dark:bg-[var(--app-surface)] dark:text-[var(--app-fg)]'
                    : 'text-gray-600 dark:text-[var(--app-muted)]'
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
                    ? 'bg-white text-brand-800 shadow dark:bg-[var(--app-surface)] dark:text-[var(--app-fg)]'
                    : 'text-gray-600 dark:text-[var(--app-muted)]'
                )}
              >
                <Moon className="w-3.5 h-3.5" />
                Dark
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 dark:border-[var(--app-border)] bg-white dark:bg-[var(--app-surface)] p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-[var(--app-muted)]">
            Account
          </h2>
          <form onSubmit={save} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-[var(--app-muted)]">
                Name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-[var(--app-border)] dark:bg-[var(--app-bg)] dark:text-[var(--app-fg)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-[var(--app-muted)]">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-[var(--app-border)] dark:bg-[var(--app-bg)] dark:text-[var(--app-fg)]"
              />
            </div>
            {err ? (
              <p className="text-sm text-red-600 dark:text-red-400">{err}</p>
            ) : null}
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-700 hover:bg-brand-800 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Save changes
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-gray-200 dark:border-[var(--app-border)] bg-white dark:bg-[var(--app-surface)] p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-[var(--app-muted)]">
            Storage & library
          </h2>
          {loading ? (
            <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
          ) : stats ? (
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-gray-500 dark:text-[var(--app-muted)]">Estimated storage</dt>
                <dd className="font-semibold text-lg text-[var(--app-fg)]">{formatBytes(stats.storageBytes)}</dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-[var(--app-muted)]">Active notebooks</dt>
                <dd className="font-semibold text-[var(--app-fg)]">{stats.notebooksActive}</dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-[var(--app-muted)]">Archived notebooks</dt>
                <dd className="font-semibold text-[var(--app-fg)]">{stats.notebooksArchived}</dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-[var(--app-muted)]">Sections (active)</dt>
                <dd className="font-semibold text-[var(--app-fg)]">{stats.sectionsActive}</dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-[var(--app-muted)]">Pages (active)</dt>
                <dd className="font-semibold text-[var(--app-fg)]">{stats.pagesActive}</dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-[var(--app-muted)]">Pages (archived)</dt>
                <dd className="font-semibold text-[var(--app-fg)]">{stats.pagesArchived}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-gray-500 dark:text-[var(--app-muted)]">Could not load stats.</p>
          )}
        </section>
      </div>
    </div>
  );
}
