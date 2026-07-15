import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Archive,
  Bookmark,
  BookOpen,
  FileDown,
  FileText,
  List,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import type { Bookshelf, Notebook, Page, Section } from '../types';
import { notebookToMarkdown, downloadText, parseImportedMarkdown } from '../lib/markdownIO';
import { sanitizeFilename } from '../lib/filename';
import { cn } from '../lib/utils';
import { useAppDialogs } from '../context/AppDialogsContext';
import { useToast } from '../context/ToastContext';
import { coerceEntityTitle, validateEntityTitle } from '../lib/validation';

const BOOKS_PER_SHELF = 16;

/** Quiet cloth tones — Lumina studio family (no neon chart colors) */
const SPINE_TONES = [
  '#3f5c52',
  '#547f72',
  '#5c6e66',
  '#6b5e52',
  '#4a6358',
  '#7a6b5c',
  '#455a62',
  '#6e7870',
  '#5a5348',
  '#48605a',
] as const;

type SpinePattern = 'cloth' | 'linen' | 'foil' | 'plain';

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function pageCount(nb: Notebook) {
  return nb.sections.reduce((n, s) => n + s.pages.length, 0);
}

function sectionCount(nb: Notebook) {
  return nb.sections.length;
}

function bookSeed(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0xffffffff;
}

function bookMetrics(nb: Notebook, toneIndex: number) {
  const pages = pageCount(nb);
  const chapters = sectionCount(nb);
  const s = bookSeed(nb.id);
  const width = 28 + Math.min(22, pages * 0.55 + chapters * 1.2) + s * 8;
  const height = Math.min(220, 110 + pages * 2.4 + chapters * 4 + s * 18);
  const depth = 90 + Math.min(70, pages * 1.8);
  const patterns: SpinePattern[] = ['cloth', 'linen', 'foil', 'plain'];
  return {
    pages,
    chapters,
    width,
    height,
    depth,
    pattern: patterns[Math.floor(s * patterns.length)],
    tone: SPINE_TONES[toneIndex % SPINE_TONES.length],
    initials: (nb.title?.trim() || 'LN')
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join(''),
  };
}

function BookContentsPanel({
  notebook,
  unitTitle,
  tab,
  busyId,
  onClose,
  onOpenInNotes,
  onOpenPage,
  onExport,
  onArchive,
  onRestore,
  onDeleteForever,
}: {
  notebook: Notebook;
  unitTitle: string;
  tab: 'active' | 'archived';
  busyId: string | null;
  onClose: () => void;
  onOpenInNotes: () => void;
  onOpenPage: (section: Section, page: Page) => void;
  onExport: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDeleteForever: () => void;
}) {
  const pages = pageCount(notebook);
  const chapters = sectionCount(notebook);
  const busy = busyId === notebook.id;
  const tone = SPINE_TONES[notebook.title.length % SPINE_TONES.length];

  return (
    <div className="studio-panel mt-5 overflow-hidden bg-[var(--paper)] shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--app-border)] bg-[var(--gutter)]/40 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <button type="button" onClick={onClose} className="studio-btn !px-2.5 !py-1.5 !text-xs">
            <X className="h-3.5 w-3.5" />
            Close
          </button>
          <span className="truncate text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--app-muted)]">
            {unitTitle} · book contents
          </span>
        </div>
        {tab === 'active' ? (
          <button
            type="button"
            onClick={onOpenInNotes}
            className="studio-btn-primary !px-3 !py-1.5 !text-xs"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Open in Notes
          </button>
        ) : null}
      </div>

      <div className="grid gap-6 p-4 sm:p-6 md:grid-cols-12">
        <div className="md:col-span-4">
          <div
            className="mx-auto flex aspect-[3/4] max-h-[min(340px,48vh)] w-full max-w-xs flex-col justify-between rounded-r-[var(--radius-ui)] rounded-l-md border-l-[6px] border-black/25 p-5 text-white shadow-[var(--shadow-soft)]"
            style={{
              background: `linear-gradient(155deg, ${tone} 0%, color-mix(in srgb, ${tone} 75%, #1a1a1a) 55%, #1a221e 100%)`,
            }}
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-white/70">
              Book
            </p>
            <div>
              <h2 className="font-display text-2xl font-medium leading-tight tracking-tight">
                {notebook.title?.trim() || 'Untitled'}
              </h2>
              <p className="mt-2 text-sm text-white/80">{unitTitle || 'Storage unit'}</p>
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg bg-black/25 px-3 py-2 text-xs backdrop-blur-sm">
              <dt className="text-white/65">Chapters</dt>
              <dd className="font-medium">{chapters}</dd>
              <dt className="text-white/65">Pages</dt>
              <dd className="font-medium">{pages}</dd>
              <dt className="text-white/65">Status</dt>
              <dd className="font-medium">{tab === 'archived' ? 'Archived' : 'Active'}</dd>
            </dl>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {tab === 'active' ? (
              <>
                <button type="button" onClick={onOpenInNotes} className="studio-btn !text-xs">
                  <BookOpen className="h-3.5 w-3.5" />
                  Open
                </button>
                <button type="button" onClick={onExport} className="studio-btn !text-xs">
                  <FileDown className="h-3.5 w-3.5" />
                  Export MD
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onArchive}
                  className="studio-btn !text-xs disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Archive className="h-3.5 w-3.5" />
                  )}
                  Archive
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onRestore}
                  className="studio-btn-primary !text-xs disabled:opacity-50"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  Restore
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onDeleteForever}
                  className="studio-btn !text-xs text-red-700 disabled:opacity-50 dark:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete forever
                </button>
              </>
            )}
          </div>
        </div>

        <div className="md:col-span-8">
          <div className="mb-3 flex items-center gap-2">
            <List className="h-4 w-4 text-[var(--spine)]" />
            <h3 className="font-display text-base font-medium">Book contents</h3>
          </div>
          <p className="mb-3 text-xs text-[var(--app-muted)]">
            Book · chapter · page — open any page in Notes.
          </p>
          <div className="max-h-[min(55vh,480px)] space-y-2 overflow-y-auto pr-1">
            {notebook.sections.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--app-muted)]">No chapters yet.</p>
            ) : (
              notebook.sections.map((sec, si) => (
                <div
                  key={sec.id}
                  className="rounded-[var(--radius-ui)] border border-[var(--app-border)] bg-[var(--gutter)]/30 p-3"
                >
                  <div className="flex items-center gap-2">
                    <Bookmark className="h-3.5 w-3.5 shrink-0 text-[var(--spine)]" />
                    <h4 className="min-w-0 truncate text-sm font-medium">
                      {sec.title?.trim() || `Chapter ${si + 1}`}
                    </h4>
                    <span className="ml-auto text-[10px] uppercase tracking-wide text-[var(--app-muted)]">
                      {sec.pages.length} pg
                    </span>
                  </div>
                  {sec.pages.length === 0 ? (
                    <p className="mt-2 text-xs text-[var(--app-muted)]">No pages</p>
                  ) : (
                    <ul className="mt-2 space-y-1 border-t border-[var(--app-border)] pt-2">
                      {sec.pages.map((pg) => (
                        <li key={pg.id}>
                          <button
                            type="button"
                            onClick={() => onOpenPage(sec, pg)}
                            className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-[var(--sage)]"
                          >
                            <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--app-muted)]" />
                            <span className="min-w-0 truncate text-[var(--app-fg)]">
                              {pg.title?.trim() || 'Untitled page'}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface BookshelfPageProps {
  bookshelves: Bookshelf[];
  activeBookshelfId: string | null;
  onBack: () => void;
  onOpenShelfForNotes: (shelfId: string) => void;
  onOpenNotebook: (
    notebookId: string,
    bookshelfId: string,
    sectionId?: string,
    pageId?: string
  ) => void;
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
  const { confirm, promptText } = useAppDialogs();
  const toast = useToast();
  const [newUnitName, setNewUnitName] = useState('');
  const [unitQuery, setUnitQuery] = useState('');
  const [openUnitId, setOpenUnitId] = useState<string | null>(null);
  const [tab, setTab] = useState<'active' | 'archived'>('active');
  const [activeList, setActiveList] = useState<Notebook[]>([]);
  const [archivedList, setArchivedList] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<Notebook | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const contentsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (openUnitId && !bookshelves.some((b) => b.id === openUnitId)) {
      setOpenUnitId(null);
    }
  }, [bookshelves, openUnitId]);

  useEffect(() => {
    setPreview(null);
    setTab('active');
  }, [openUnitId]);

  const loadNotebooks = useCallback(async () => {
    if (!openUnitId) {
      setActiveList([]);
      setArchivedList([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [a, ar] = await Promise.all([
        api.notebooks.list(false, openUnitId),
        api.notebooks.list(true, openUnitId),
      ]);
      setActiveList(a);
      setArchivedList(ar);
    } catch (e) {
      console.error(e);
      toast.error('Could not load books');
    } finally {
      setLoading(false);
    }
  }, [openUnitId, toast]);

  useEffect(() => {
    void loadNotebooks();
  }, [loadNotebooks]);

  const openUnit = useMemo(
    () => bookshelves.find((b) => b.id === openUnitId) ?? null,
    [bookshelves, openUnitId]
  );

  const filteredUnits = useMemo(() => {
    const q = unitQuery.trim().toLowerCase();
    if (!q) return bookshelves;
    return bookshelves.filter((u) => (u.title || '').toLowerCase().includes(q));
  }, [bookshelves, unitQuery]);

  const list = tab === 'active' ? activeList : archivedList;
  const shelves = useMemo(() => chunk(list, BOOKS_PER_SHELF), [list]);

  const createUnit = async () => {
    const checked = validateEntityTitle(newUnitName || 'Storage unit', 'bookshelf', {
      allowEmptyFallback: 'Storage unit',
    });
    if (!checked.ok) return;
    const id = `bs-${Date.now()}`;
    setBusy('new-unit');
    try {
      await api.bookshelves.create(id, checked.value);
      setNewUnitName('');
      await onRefreshBookshelves();
      setOpenUnitId(id);
    } catch (e) {
      console.error(e);
      toast.error('Could not create storage unit');
    } finally {
      setBusy(null);
    }
  };

  const renameUnit = async () => {
    if (!openUnit) return;
    const name = await promptText({
      title: 'Rename storage unit',
      label: 'Name',
      defaultValue: openUnit.title,
      placeholder: 'e.g. Work · Journal · Projects',
      confirmLabel: 'Save',
    });
    if (name === null) return;
    setBusy(openUnit.id);
    try {
      await api.bookshelves.update(openUnit.id, name.trim() || 'Untitled unit');
      await onRefreshBookshelves();
    } finally {
      setBusy(null);
    }
  };

  const deleteUnit = async () => {
    if (!openUnit) return;
    const ok = await confirm({
      title: 'Remove this storage unit?',
      message: `“${openUnit.title.trim() || 'Unit'}” must be empty. This cannot be undone.`,
      confirmLabel: 'Delete unit',
      variant: 'danger',
    });
    if (!ok) return;
    setBusy(openUnit.id);
    try {
      await api.bookshelves.delete(openUnit.id);
      setOpenUnitId(null);
      await onRefreshBookshelves();
      onLibraryChanged();
    } catch (e) {
      await confirm({
        title: 'Could not delete unit',
        message: e instanceof Error ? e.message : 'Could not delete',
        confirmLabel: 'OK',
        variant: 'default',
      });
    } finally {
      setBusy(null);
    }
  };

  const createBook = async () => {
    if (!openUnitId) return;
    const name = await promptText({
      title: 'New book',
      label: 'Title',
      placeholder: 'e.g. Project notes',
      confirmLabel: 'Create',
    });
    if (name === null) return;
    setBusy('new-book');
    try {
      const nbId = `nb-${Date.now()}`;
      const secId = `sec-${Date.now()}`;
      const pageId = `page-${Date.now()}`;
      await api.notebooks.create(nbId, coerceEntityTitle(name, 'notebook').slice(0, 80), openUnitId);
      await api.sections.create(secId, nbId, 'Chapter 1');
      await api.pages.create(pageId, secId, 'Untitled page', '');
      await loadNotebooks();
      onLibraryChanged();
      setTab('active');
    } catch (e) {
      console.error(e);
      toast.error('Could not create book');
    } finally {
      setBusy(null);
    }
  };

  const archive = async (id: string) => {
    const nb = [...activeList, ...archivedList].find((n) => n.id === id);
    const ok = await confirm({
      title: 'Archive this book?',
      message: `“${nb?.title?.trim() || 'Book'}” will move to Archived.`,
      confirmLabel: 'Archive',
      variant: 'default',
    });
    if (!ok) return;
    setBusy(id);
    try {
      await api.notebooks.setArchive(id, true);
      await loadNotebooks();
      onLibraryChanged();
      setPreview(null);
    } finally {
      setBusy(null);
    }
  };

  const removeForever = async (id: string) => {
    const nb = archivedList.find((n) => n.id === id);
    const ok = await confirm({
      title: 'Delete this book forever?',
      message: `“${nb?.title?.trim() || 'Book'}” and all pages will be permanently removed.`,
      confirmLabel: 'Delete forever',
      variant: 'danger',
    });
    if (!ok) return;
    setBusy(id);
    try {
      await api.notebooks.delete(id);
      await loadNotebooks();
      onLibraryChanged();
      setPreview(null);
    } finally {
      setBusy(null);
    }
  };

  const restore = async (nb: Notebook) => {
    setBusy(nb.id);
    try {
      await api.notebooks.setArchive(nb.id, false);
      await loadNotebooks();
      onLibraryChanged();
      if (openUnitId) onOpenNotebook(nb.id, openUnitId);
    } finally {
      setBusy(null);
    }
  };

  const exportNb = (nb: Notebook) => {
    downloadText(`${sanitizeFilename(nb.title || 'notebook')}.md`, notebookToMarkdown(nb));
  };

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || !openUnitId) return;
    setBusy('import');
    try {
      const text = await f.text();
      const { title, content } = parseImportedMarkdown(text);
      const base =
        f.name.replace(/\.md$/i, '').replace(/[^\w\s-]+/g, '').trim() || 'Imported';
      const nbId = `nb-${Date.now()}`;
      const secId = `sec-${Date.now()}`;
      const pageId = `page-${Date.now()}`;
      await api.notebooks.create(nbId, base.slice(0, 80), openUnitId);
      await api.sections.create(secId, nbId, 'Chapter 1');
      await api.pages.create(pageId, secId, title, content);
      await loadNotebooks();
      onLibraryChanged();
      onOpenNotebook(nbId, openUnitId);
    } catch (err) {
      console.error(err);
      toast.error('Import failed');
    } finally {
      setBusy(null);
    }
  };

  const selectBook = (nb: Notebook) => {
    setPreview(nb);
    requestAnimationFrame(() => {
      contentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col studio-shell text-[var(--app-fg)]">
      <header className="app-topbar flex shrink-0 items-center gap-4 px-6 py-4">
        <button
          type="button"
          onClick={() => (openUnit ? setOpenUnitId(null) : onBack())}
          className="studio-btn"
        >
          <ArrowLeft className="h-4 w-4" />
          {openUnit ? 'Library' : 'Notes'}
        </button>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-[var(--app-muted)]">
            Quiet place
          </p>
          <h1 className="font-display text-lg font-medium text-[var(--app-fg)]">
            {openUnit ? openUnit.title || 'Storage unit' : 'Library'}
          </h1>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-8">
          {!openUnit ? (
            <>
              <section className="studio-panel bg-[var(--paper)] p-6 shadow-sm">
                <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--app-muted)]">
                  Collection
                </p>
                <h2 className="mt-1 font-display text-xl font-medium tracking-tight">
                  Storage units
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--app-muted)]">
                  Units hold your books. Open one for shelves — then write chapters and pages in
                  Notes.
                </p>
                <form
                  className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void createUnit();
                  }}
                >
                  <input
                    type="text"
                    value={newUnitName}
                    onChange={(e) => setNewUnitName(e.target.value)}
                    placeholder="e.g. Work · Journal · Projects"
                    className="studio-input sm:flex-1"
                    aria-label="New storage unit name"
                  />
                  <button
                    type="submit"
                    disabled={busy === 'new-unit'}
                    className="studio-btn-primary disabled:opacity-50"
                  >
                    {busy === 'new-unit' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Add unit
                  </button>
                </form>
              </section>

              {bookshelves.length === 0 ? (
                <div className="studio-panel flex flex-col items-center bg-[var(--paper)] px-6 py-16 text-center shadow-sm">
                  <p className="font-display text-lg font-medium">No storage units yet</p>
                  <p className="mt-1 max-w-sm text-sm text-[var(--app-muted)]">
                    Add a unit above, then put books on its shelves.
                  </p>
                </div>
              ) : (
                <section className="studio-panel overflow-hidden bg-[var(--paper)] shadow-sm">
                  <div className="flex flex-wrap items-center gap-3 border-b border-[var(--app-border)] px-4 py-3">
                    <div className="relative min-w-0 flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--app-muted)]" />
                      <input
                        type="search"
                        value={unitQuery}
                        onChange={(e) => setUnitQuery(e.target.value)}
                        placeholder="Find a storage unit…"
                        className="studio-input !pl-9"
                        aria-label="Search storage units"
                      />
                    </div>
                    <p className="text-xs tabular-nums text-[var(--app-muted)]">
                      {filteredUnits.length}
                      {unitQuery.trim() ? ` of ${bookshelves.length}` : ''} unit
                      {filteredUnits.length === 1 ? '' : 's'}
                    </p>
                  </div>

                  {filteredUnits.length === 0 ? (
                    <p className="px-4 py-12 text-center text-sm text-[var(--app-muted)]">
                      No units match “{unitQuery.trim()}”.
                    </p>
                  ) : (
                    <ul className="max-h-[min(62vh,640px)] divide-y divide-[var(--app-border)] overflow-y-auto">
                      {filteredUnits.map((unit) => {
                        const inNotes = activeBookshelfId === unit.id;
                        return (
                          <li key={unit.id}>
                            <button
                              type="button"
                              onClick={() => setOpenUnitId(unit.id)}
                              className={cn(
                                'flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[var(--sage)]/50',
                                inNotes && 'bg-[var(--sage)]/35'
                              )}
                            >
                              <span
                                className="library-unit-mark shrink-0"
                                aria-hidden
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium tracking-tight">
                                  {unit.title || 'Untitled'}
                                </span>
                                <span className="mt-0.5 block text-[11px] text-[var(--app-muted)]">
                                  Storage unit
                                  {inNotes ? ' · open in Notes' : ''}
                                </span>
                              </span>
                              <span className="shrink-0 text-xs text-[var(--app-muted)]">
                                Open →
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              )}
            </>
          ) : (
            <>
              <section className="studio-panel flex flex-wrap items-center gap-2 bg-[var(--paper)] p-3 shadow-sm">
                <button
                  type="button"
                  onClick={() => setOpenUnitId(null)}
                  className="studio-btn !px-3 !py-2 !text-xs"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  All units
                </button>
                <button
                  type="button"
                  onClick={() => onOpenShelfForNotes(openUnit.id)}
                  className="studio-btn-primary !px-3 !py-2 !text-xs"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  Write in Notes
                </button>
                <button
                  type="button"
                  disabled={!openUnitId || busy === 'new-book'}
                  onClick={() => void createBook()}
                  className="studio-btn"
                >
                  {busy === 'new-book' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  Add book
                </button>
                <input
                  ref={importRef}
                  type="file"
                  accept=".md,.markdown,text/markdown"
                  className="hidden"
                  onChange={onImportFile}
                />
                <button
                  type="button"
                  disabled={busy === 'import'}
                  onClick={() => importRef.current?.click()}
                  className="studio-btn"
                >
                  {busy === 'import' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  Import MD
                </button>
                <button
                  type="button"
                  disabled={busy === openUnit.id}
                  onClick={() => void renameUnit()}
                  className="studio-btn"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Rename
                </button>
                <button
                  type="button"
                  disabled={busy === openUnit.id}
                  onClick={() => void deleteUnit()}
                  className="studio-btn text-red-700 dark:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </button>
                <div className="ml-auto inline-flex rounded-full bg-[var(--gutter)] p-0.5">
                  <button
                    type="button"
                    onClick={() => setTab('active')}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-xs font-medium transition',
                      tab === 'active'
                        ? 'bg-[var(--paper)] text-[var(--app-fg)] shadow-sm'
                        : 'text-[var(--app-muted)]'
                    )}
                  >
                    Active ({activeList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab('archived')}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-xs font-medium transition',
                      tab === 'archived'
                        ? 'bg-[var(--paper)] text-[var(--app-fg)] shadow-sm'
                        : 'text-[var(--app-muted)]'
                    )}
                  >
                    Archived ({archivedList.length})
                  </button>
                </div>
              </section>

              <section className="studio-panel bg-[var(--paper)] p-5 shadow-sm sm:p-6">
                <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--app-muted)]">
                  Shelves
                </p>
                <h2 className="mt-1 font-display text-base font-medium">Books in this unit</h2>
                <p className="mt-1 mb-5 text-sm text-[var(--app-muted)]">
                  Hover to lift a book · click for contents (chapters &amp; pages).
                </p>

                {loading ? (
                  <div className="flex justify-center py-16">
                    <Loader2 className="h-7 w-7 animate-spin text-[var(--spine)]" />
                  </div>
                ) : list.length === 0 ? (
                  <p className="py-16 text-center text-sm text-[var(--app-muted)]">
                    This unit is empty. Add a book or import Markdown.
                  </p>
                ) : (
                  <div className="space-y-6">
                    {shelves.map((row, ri) => (
                      <div key={ri} className="vb-shelf">
                        <div className="vb-shelf-plank" aria-hidden />
                        <div className="vb-bookshelf">
                          {row.map((nb, bi) => {
                            const title = nb.title?.trim() || 'Untitled';
                            const m = bookMetrics(nb, ri * BOOKS_PER_SHELF + bi);
                            return (
                              <button
                                key={nb.id}
                                type="button"
                                title={`${title} · ${m.chapters} ch · ${m.pages} pg`}
                                aria-label={`${title}, ${m.chapters} chapters, ${m.pages} pages`}
                                aria-pressed={preview?.id === nb.id}
                                onClick={() => selectBook(nb)}
                                className={cn(
                                  'vb-book',
                                  `vb-book--${m.pattern}`,
                                  tab === 'archived' && 'vb-book--archived',
                                  preview?.id === nb.id && 'vb-book--active'
                                )}
                                style={
                                  {
                                    width: `${m.width}px`,
                                    height: `${m.height}px`,
                                    ['--spine-tone' as string]: m.tone,
                                    ['--book-depth' as string]: `${m.depth}px`,
                                  } as React.CSSProperties
                                }
                              >
                                <span className="vb-side vb-spine">
                                  <span className="vb-spine-title">
                                    {title.length > 42 ? `${title.slice(0, 40)}…` : title}
                                  </span>
                                  <span className="vb-spine-meta">{m.initials || '·'}</span>
                                </span>
                                <span className="vb-side vb-top" aria-hidden />
                                <span className="vb-side vb-cover" aria-hidden>
                                  <span className="vb-cover-mark" />
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div ref={contentsRef}>
                  {preview ? (
                    <BookContentsPanel
                      notebook={preview}
                      unitTitle={openUnit.title}
                      tab={tab}
                      busyId={busy}
                      onClose={() => setPreview(null)}
                      onOpenInNotes={() => {
                        onOpenNotebook(preview.id, openUnit.id);
                        setPreview(null);
                      }}
                      onOpenPage={(sec, pg) => {
                        onOpenNotebook(preview.id, openUnit.id, sec.id, pg.id);
                        setPreview(null);
                      }}
                      onExport={() => exportNb(preview)}
                      onArchive={() => void archive(preview.id)}
                      onRestore={() => void restore(preview)}
                      onDeleteForever={() => void removeForever(preview.id)}
                    />
                  ) : null}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
