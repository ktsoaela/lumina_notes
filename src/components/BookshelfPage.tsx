import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Archive,
  BookOpen,
  Folder,
  Loader2,
  Trash2,
  FileDown,
  Upload,
  Library,
  Plus,
  Pencil,
} from 'lucide-react';
import { api } from '../lib/api';
import type { Bookshelf, Notebook } from '../types';
import { notebookToMarkdown, downloadText, parseImportedMarkdown } from '../lib/markdownIO';
import { sanitizeFilename } from '../lib/filename';
import { cn } from '../lib/utils';

/** Industrial mobile-shelving bay (Kompakt-style): steel frame, perforated back, rail floor */
function KompaktStorageBay({
  children,
  bayLabel,
}: {
  children: React.ReactNode;
  bayLabel: string;
}) {
  return (
    <div className="mx-auto max-w-6xl overflow-hidden rounded-sm shadow-xl shadow-slate-900/25 ring-1 ring-slate-500/50 dark:shadow-black/40 dark:ring-[var(--app-border)]">
      {/* Crossbeam / system header */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-600/80 bg-gradient-to-b from-slate-400 via-slate-500 to-slate-600 px-3 py-2 text-slate-900 dark:from-[var(--app-surface)] dark:via-[#152a45] dark:to-[var(--app-bg)] dark:text-[var(--app-fg)]">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="hidden sm:inline h-6 w-px bg-slate-700/50 dark:bg-white/20"
            aria-hidden
          />
          <span className="truncate font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-slate-800 dark:text-[var(--app-fg)]">
            Kompakt<span className="font-normal opacity-80">®</span> Mobile Storage
          </span>
        </div>
        <span className="shrink-0 rounded border border-slate-700/30 bg-slate-800/10 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-widest text-slate-900 dark:border-white/10 dark:bg-black/25 dark:text-[var(--app-fg)]">
          {bayLabel}
        </span>
      </div>

      <div className="flex min-h-[14rem] bg-slate-300/30 dark:bg-[var(--app-bg)]/90">
        {/* Left upright + rivets */}
        <div
          className="relative w-4 shrink-0 bg-gradient-to-r from-slate-600 via-slate-500 to-slate-400 shadow-[inset_-3px_0_6px_rgba(0,0,0,0.15)] dark:from-[#1e3a5f] dark:via-[#152a45] dark:to-[var(--app-surface)]"
          aria-hidden
        >
          {[16, 44, 72, 100].map((top) => (
            <span
              key={top}
              className="absolute left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-slate-800/40 shadow-inner dark:bg-black/40"
              style={{ top: `${top}%` }}
            />
          ))}
        </div>

        {/* Bay interior — perforated steel + wash */}
        <div className="relative min-w-0 flex-1 border-y border-slate-500/30">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-25 bg-[radial-gradient(circle,_#64748b_0.55px,_transparent_0.65px)] [background-size:7px_7px]"
            aria-hidden
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-200/95 via-slate-100/90 to-slate-200/95 dark:from-[var(--app-surface)] dark:via-[var(--app-bg)] dark:to-[var(--app-surface)]" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/50 to-transparent dark:from-white/[0.04] dark:to-transparent" />
          <div className="relative px-4 pt-5 pb-0 sm:px-6">{children}</div>
        </div>

        {/* Right upright + crank motif */}
        <div
          className="relative w-4 shrink-0 bg-gradient-to-l from-slate-600 via-slate-500 to-slate-400 shadow-[inset_3px_0_6px_rgba(0,0,0,0.15)] dark:from-[#1e3a5f] dark:via-[#152a45] dark:to-[var(--app-surface)]"
          aria-hidden
        >
          {[16, 44, 72, 100].map((top) => (
            <span
              key={top}
              className="absolute left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-slate-800/40 shadow-inner dark:bg-black/40"
              style={{ top: `${top}%` }}
            />
          ))}
          <span className="absolute bottom-8 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border-2 border-slate-700/50 bg-slate-800/30 shadow-inner dark:border-[var(--app-border)] dark:bg-[var(--app-surface)]/60">
            <span className="h-3 w-3 rounded-full border border-slate-600/80 bg-slate-500/50 dark:border-[var(--app-border)] dark:bg-[#3b4f6b]" />
          </span>
        </div>
      </div>

      {/* Shelf steel deck (books rest on this) */}
      <div className="h-3 bg-gradient-to-b from-slate-500 via-slate-600 to-slate-700 shadow-[inset_0_3px_8px_rgba(0,0,0,0.35)] dark:from-[#1e3a5f] dark:via-[var(--app-surface)] dark:to-[var(--app-bg)]" />

      {/* Floor track — mobile rail system */}
      <div className="relative border-t-2 border-slate-800 bg-gradient-to-b from-slate-700 to-slate-900 py-2 dark:border-[var(--app-border)] dark:from-[var(--app-bg)] dark:to-[#050a12]">
        <div
          className="mx-3 h-2 rounded-sm bg-[repeating-linear-gradient(90deg,transparent_0,transparent_10px,rgba(0,0,0,0.35)_10px,rgba(0,0,0,0.35)_11px)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]"
          aria-hidden
        />
        <p className="mt-1.5 text-center font-mono text-[8px] uppercase tracking-[0.35em] text-slate-500 dark:text-[var(--app-muted)]">
          Floor-mounted rail · high-density mobile shelving
        </p>
      </div>
    </div>
  );
}

/** Narrow vertical “spine” with title — books standing on a shelf */
function BookSpine({
  title,
  onOpen,
  paletteIndex,
  muted,
}: {
  title: string;
  onOpen: () => void;
  paletteIndex: number;
  muted?: boolean;
}) {
  const palettes = [
    'from-[#174a73] via-[#143c5e] to-[#0c2838]',
    'from-[#5c4033] via-[#4a3328] to-[#35241c]',
    'from-[#2d5a4a] via-[#234638] to-[#152b24]',
    'from-[#4a3d6b] via-[#3a3155] to-[#252038]',
    'from-[#6b5344] via-[#554335] to-[#3a2e25]',
    'from-[#1e4d6b] via-[#174a73] to-[#0f3550]',
  ] as const;
  const grad = palettes[paletteIndex % palettes.length];

  return (
    <button
      type="button"
      onClick={onOpen}
      title={title}
      className={cn(
        'group relative flex h-52 w-11 shrink-0 cursor-pointer flex-col rounded-sm border border-black/15 shadow-md transition-all duration-200',
        'hover:-translate-y-2 hover:shadow-xl hover:ring-2 hover:ring-brand-400/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
        muted ? 'opacity-70 saturate-50' : '',
        'bg-gradient-to-b',
        grad
      )}
    >
      {/* Spine highlight (edge) */}
      <span
        className="pointer-events-none absolute inset-y-2 left-0.5 w-px rounded-full bg-white/25"
        aria-hidden
      />
      <span
        className="pointer-events-none absolute inset-y-3 right-0.5 w-px rounded-full bg-black/20"
        aria-hidden
      />
      <span
        className="mx-auto mt-3 mb-2 max-h-[10.5rem] flex-1 overflow-hidden px-0.5 text-center text-[10px] font-semibold uppercase leading-snug tracking-wider text-white/95 drop-shadow-sm"
        style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
      >
        {title || 'Untitled'}
      </span>
      <span
        className="mb-2 h-5 w-8 rounded-sm border border-white/10 bg-black/15"
        aria-hidden
      />
    </button>
  );
}

interface BookshelfPageProps {
  bookshelves: Bookshelf[];
  activeBookshelfId: string | null;
  onBack: () => void;
  onOpenShelfForNotes: (shelfId: string) => void;
  onOpenNotebook: (notebookId: string, bookshelfId: string) => void;
  onLibraryChanged: () => void;
  onRefreshBookshelves: () => Promise<void>;
}

export default function BookshelfPage({
  bookshelves,
  activeBookshelfId,
  onBack,
  onOpenShelfForNotes,
  onOpenNotebook,
  onLibraryChanged,
  onRefreshBookshelves,
}: BookshelfPageProps) {
  const [newShelfName, setNewShelfName] = useState('');
  const [tab, setTab] = useState<'active' | 'archived'>('active');
  const [manageShelfId, setManageShelfId] = useState<string | null>(null);
  const [activeList, setActiveList] = useState<Notebook[]>([]);
  const [archivedList, setArchivedList] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeBookshelfId && bookshelves.some((b) => b.id === activeBookshelfId)) {
      setManageShelfId(activeBookshelfId);
    } else if (bookshelves.length) {
      setManageShelfId(bookshelves[0].id);
    } else {
      setManageShelfId(null);
    }
  }, [bookshelves, activeBookshelfId]);

  const loadNotebooks = useCallback(async () => {
    if (!manageShelfId) {
      setActiveList([]);
      setArchivedList([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [a, ar] = await Promise.all([
        api.notebooks.list(false, manageShelfId),
        api.notebooks.list(true, manageShelfId),
      ]);
      setActiveList(a);
      setArchivedList(ar);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [manageShelfId]);

  useEffect(() => {
    loadNotebooks();
  }, [loadNotebooks]);

  const createShelf = async () => {
    const name = newShelfName.trim() || 'New bookshelf';
    const id = `bs-${Date.now()}`;
    setBusy('new-shelf');
    try {
      await api.bookshelves.create(id, name);
      setNewShelfName('');
      await onRefreshBookshelves();
      setManageShelfId(id);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(null);
    }
  };

  const renameShelf = async (id: string, currentTitle: string) => {
    const name = window.prompt('Shelf name', currentTitle);
    if (name === null) return;
    const trimmed = name.trim() || 'Untitled';
    setBusy(id);
    try {
      await api.bookshelves.update(id, trimmed);
      await onRefreshBookshelves();
    } finally {
      setBusy(null);
    }
  };

  const deleteShelf = async (id: string) => {
    if (!window.confirm('Delete this bookshelf? It must be empty (no notebooks).')) return;
    setBusy(id);
    try {
      await api.bookshelves.delete(id);
      await onRefreshBookshelves();
      onLibraryChanged();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Could not delete');
    } finally {
      setBusy(null);
    }
  };

  const list = tab === 'active' ? activeList : archivedList;

  const sectionCount = (nb: Notebook) => nb.sections.length;
  const pageCount = (nb: Notebook) =>
    nb.sections.reduce((n, s) => n + s.pages.length, 0);

  const archive = async (id: string) => {
    setBusy(id);
    try {
      await api.notebooks.setArchive(id, true);
      await loadNotebooks();
      onLibraryChanged();
    } finally {
      setBusy(null);
    }
  };

  const removeForever = async (id: string) => {
    if (
      !window.confirm(
        'Permanently delete this notebook and all sections and pages? This cannot be undone.'
      )
    ) {
      return;
    }
    setBusy(id);
    try {
      await api.notebooks.delete(id);
      await loadNotebooks();
      onLibraryChanged();
    } finally {
      setBusy(null);
    }
  };

  const exportNb = (nb: Notebook) => {
    const md = notebookToMarkdown(nb);
    downloadText(`${sanitizeFilename(nb.title || 'notebook')}.md`, md);
  };

  const openAndFocus = (nb: Notebook) => {
    if (manageShelfId) onOpenNotebook(nb.id, manageShelfId);
  };

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || !manageShelfId) return;
    setBusy('import');
    try {
      const text = await f.text();
      const { title, content } = parseImportedMarkdown(text);
      const base =
        f.name.replace(/\.md$/i, '').replace(/[^\w\s-]+/g, '').trim() ||
        'Imported';
      const nbId = `nb-${Date.now()}`;
      const secId = `sec-${Date.now()}`;
      const pageId = `page-${Date.now()}`;
      await api.notebooks.create(nbId, base.slice(0, 80) || 'Imported', manageShelfId);
      await api.sections.create(secId, nbId, 'Notes');
      await api.pages.create(pageId, secId, title, content);
      await loadNotebooks();
      onLibraryChanged();
      onOpenNotebook(nbId, manageShelfId);
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(null);
    }
  };

  const restoreAndOpen = async (nb: Notebook) => {
    setBusy(nb.id);
    try {
      await api.notebooks.setArchive(nb.id, false);
      await loadNotebooks();
      onLibraryChanged();
      if (manageShelfId) onOpenNotebook(nb.id, manageShelfId);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--app-bg)] text-[var(--app-fg)]">
      <div className="shrink-0 border-b border-slate-300/80 bg-gradient-to-r from-slate-100 via-white to-slate-100 px-6 py-4 dark:border-[var(--app-border)] dark:from-[var(--app-surface)] dark:via-[var(--app-bg)] dark:to-[var(--app-surface)]">
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to notes
          </button>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-[var(--app-fg)]">
              Kompakt storage
            </h1>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500 dark:text-[var(--app-muted)]">
              Mobile high-density shelving · bookshelves
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-10">
        <section>
          <h2 className="mb-1 text-sm font-semibold text-slate-800 dark:text-[var(--app-fg)]">
            Storage units (bookshelves)
          </h2>
          <p className="mb-4 max-w-xl text-xs text-slate-600 dark:text-[var(--app-muted)]">
            Each unit is a shelf bay—open it in Notes to work, or load a bay below to arrange
            books on the Kompakt rail system.
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            <input
              type="text"
              value={newShelfName}
              onChange={(e) => setNewShelfName(e.target.value)}
              placeholder="New bookshelf name"
              className="min-w-[200px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 dark:border-[var(--app-border)] dark:bg-[var(--app-surface)] dark:text-[var(--app-fg)] dark:placeholder:text-[var(--app-muted)]"
            />
            <button
              type="button"
              disabled={busy === 'new-shelf'}
              onClick={createShelf}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 hover:bg-brand-800 text-white text-sm font-medium px-4 py-2 disabled:opacity-50"
            >
              {busy === 'new-shelf' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Add bookshelf
            </button>
          </div>
          <div className="grid max-w-6xl gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {bookshelves.map((s) => (
              <div
                key={s.id}
                className="flex flex-col gap-3 rounded-sm border-2 border-slate-400/70 bg-gradient-to-b from-slate-100/95 to-slate-200/90 p-4 shadow-md ring-1 ring-slate-500/25 dark:border-[var(--app-border)] dark:from-[var(--app-surface)] dark:to-[var(--app-bg)] dark:ring-[var(--app-border)]/50"
              >
                <div className="flex items-start gap-3 border-b border-slate-300/60 pb-3 dark:border-[var(--app-border)]">
                  <div className="rounded border border-slate-400/50 bg-slate-300/50 p-2 text-slate-700 dark:border-[var(--app-border)] dark:bg-[var(--app-bg)]/80 dark:text-[var(--app-fg)]">
                    <Library className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500 dark:text-[var(--app-muted)]">
                      Unit
                    </p>
                    <h3 className="truncate font-semibold text-slate-900 dark:text-[var(--app-fg)]">
                      {s.title}
                    </h3>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onOpenShelfForNotes(s.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 hover:bg-brand-800 text-white text-xs font-medium px-3 py-1.5"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    Open in Notes
                  </button>
                  <button
                    type="button"
                    disabled={busy === s.id}
                    onClick={() => renameShelf(s.id, s.title)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-xs font-medium hover:bg-gray-50 dark:hover:bg-[var(--app-surface)]"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Rename
                  </button>
                  <button
                    type="button"
                    disabled={busy === s.id}
                    onClick={() => deleteShelf(s.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 text-red-700 dark:border-red-900 dark:text-red-300 text-xs font-medium px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 ml-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
          {bookshelves.length === 0 && (
            <p className="py-8 text-center text-gray-500 dark:text-[var(--app-muted)]">
              No bookshelves yet. Add one above.
            </p>
          )}
        </section>

        <section className="border-t border-slate-200 pt-8 dark:border-[var(--app-border)]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-800 dark:text-[var(--app-fg)]">
                Active bay · books on rail
              </h2>
              <p className="mt-0.5 font-mono text-[9px] uppercase tracking-widest text-slate-500 dark:text-[var(--app-muted)]">
                Kompakt mobile shelving layout
              </p>
            </div>
            {bookshelves.length > 0 && (
              <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-[var(--app-muted)]">
                <span>Shelf:</span>
                <select
                  value={manageShelfId ?? ''}
                  onChange={(e) => setManageShelfId(e.target.value || null)}
                  className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1.5 text-xs text-[var(--app-fg)]"
                >
                  {bookshelves.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <input
              ref={importRef}
              type="file"
              accept=".md,.markdown,text/markdown"
              className="hidden"
              onChange={onImportFile}
            />
            <button
              type="button"
              disabled={busy === 'import' || !manageShelfId}
              onClick={() => importRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5 text-xs font-medium text-[var(--app-fg)] hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-[var(--app-bg)]"
            >
              {busy === 'import' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              Import Markdown
            </button>
            <div className="inline-flex rounded-lg border border-[var(--app-border)] bg-gray-50 p-0.5 dark:bg-[var(--app-bg)]">
              <button
                type="button"
                onClick={() => setTab('active')}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium',
                  tab === 'active'
                    ? 'bg-white shadow dark:bg-[var(--app-surface)] dark:text-[var(--app-fg)]'
                    : 'text-gray-600 dark:text-[var(--app-muted)]'
                )}
              >
                Active ({activeList.length})
              </button>
              <button
                type="button"
                onClick={() => setTab('archived')}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium',
                  tab === 'archived'
                    ? 'bg-white shadow dark:bg-[var(--app-surface)] dark:text-[var(--app-fg)]'
                    : 'text-gray-600 dark:text-[var(--app-muted)]'
                )}
              >
                Archived ({archivedList.length})
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
            </div>
          ) : !manageShelfId ? (
            <p className="py-16 text-center text-gray-500 dark:text-[var(--app-muted)]">
              Create a bookshelf to add notebooks.
            </p>
          ) : list.length === 0 ? (
            <p className="py-16 text-center text-gray-500 dark:text-[var(--app-muted)]">
              {tab === 'active'
                ? 'No notebooks in this shelf yet. Create one from the sidebar in Notes.'
                : 'No archived notebooks in this shelf.'}
            </p>
          ) : (
            <div className="mx-auto max-w-6xl">
              <p className="mb-4 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-slate-600 dark:text-[var(--app-muted)]">
                Kompakt bay · click spine to open · use row actions for export / archive
              </p>
              <KompaktStorageBay
                bayLabel={
                  bookshelves.find((b) => b.id === manageShelfId)?.title?.slice(0, 32) ||
                  'Storage bay'
                }
              >
                <div className="flex min-h-[13rem] flex-wrap items-end justify-center gap-5 pb-2 sm:gap-6">
                  {list.map((nb, i) => (
                    <div
                      key={nb.id}
                      className="flex flex-col items-center gap-2"
                    >
                      <BookSpine
                        title={nb.title}
                        paletteIndex={i}
                        muted={tab === 'archived'}
                        onOpen={() => openAndFocus(nb)}
                      />
                      <p
                        className="max-w-[5.5rem] text-center text-[10px] leading-tight text-slate-600 dark:text-[var(--app-muted)]"
                        title={`${sectionCount(nb)} sections · ${pageCount(nb)} pages`}
                      >
                        <span className="inline-flex items-center gap-0.5 justify-center">
                          <Folder className="h-3 w-3 shrink-0 opacity-70" />
                          {sectionCount(nb)} · {pageCount(nb)} pg
                        </span>
                      </p>
                      <div className="flex flex-wrap justify-center gap-1">
                        {tab === 'active' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openAndFocus(nb)}
                              className="inline-flex items-center gap-0.5 rounded border border-slate-400/60 bg-slate-700/90 px-2 py-1 text-[10px] font-medium text-white hover:bg-slate-600 dark:border-[var(--app-border)] dark:bg-[var(--app-surface)] dark:text-[var(--app-fg)] dark:hover:bg-[var(--app-bg)]"
                            >
                              <BookOpen className="h-3 w-3" />
                              Open
                            </button>
                            <button
                              type="button"
                              onClick={() => exportNb(nb)}
                              className="inline-flex items-center gap-0.5 rounded border border-slate-400/70 bg-white/90 px-2 py-1 text-[10px] font-medium text-slate-800 hover:bg-white dark:border-[var(--app-border)] dark:bg-[var(--app-surface)] dark:text-[var(--app-fg)] dark:hover:bg-[var(--app-bg)]"
                              title="Export Markdown"
                            >
                              <FileDown className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              disabled={busy === nb.id}
                              onClick={() => archive(nb.id)}
                              className="inline-flex items-center gap-0.5 rounded border border-amber-600/50 bg-amber-50/95 px-2 py-1 text-[10px] font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/60"
                              title="Archive"
                            >
                              {busy === nb.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Archive className="h-3 w-3" />
                              )}
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => restoreAndOpen(nb)}
                              className="inline-flex items-center gap-0.5 rounded border border-slate-400/60 bg-slate-700/90 px-2 py-1 text-[10px] font-medium text-white hover:bg-slate-600 dark:border-[var(--app-border)] dark:bg-[var(--app-surface)] dark:text-[var(--app-fg)] dark:hover:bg-[var(--app-bg)]"
                            >
                              <BookOpen className="h-3 w-3" />
                              Restore
                            </button>
                            <button
                              type="button"
                              disabled={busy === nb.id}
                              onClick={() => removeForever(nb.id)}
                              className="inline-flex items-center gap-0.5 rounded border border-red-300/80 bg-red-50/95 px-2 py-1 text-[10px] font-medium text-red-800 hover:bg-red-100 disabled:opacity-50 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200"
                              title="Delete forever"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </KompaktStorageBay>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
