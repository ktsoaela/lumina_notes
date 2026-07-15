import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Archive,
  BookOpen,
  FileDown,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import type { Bookshelf, Notebook } from '../types';
import { notebookToMarkdown, downloadText, parseImportedMarkdown } from '../lib/markdownIO';
import { sanitizeFilename } from '../lib/filename';
import { cn } from '../lib/utils';
import { useAppDialogs } from '../context/AppDialogsContext';
import { useToast } from '../context/ToastContext';
import { coerceEntityTitle, validateEntityTitle } from '../lib/validation';

const BOOKS_PER_SHELF = 14;

/** Quiet cloth / board tones — studio palette, not rainbow */
const SPINE_TONES = [
  '#3f5c52',
  '#547f72',
  '#5c6e66',
  '#6b5e52',
  '#4a6358',
  '#7a6b5c',
  '#455a62',
  '#6e7870',
] as const;

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

/** Stable 0–1 from id for width / lean / pattern */
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
  const s = bookSeed(nb.id);
  const width = 22 + Math.min(18, pages * 0.65) + s * 6;
  const height = Math.min(148, 74 + pages * 2.2 + s * 10);
  const lean = (s - 0.5) * 2.4;
  const pattern = Math.floor(s * 3); // 0 cloth, 1 linen bands, 2 soft foil
  return {
    pages,
    width,
    height,
    lean,
    pattern,
    tone: SPINE_TONES[toneIndex % SPINE_TONES.length],
  };
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
  const { confirm, promptText } = useAppDialogs();
  const toast = useToast();
  const [newUnitName, setNewUnitName] = useState('');
  const [openUnitId, setOpenUnitId] = useState<string | null>(activeBookshelfId);
  const [tab, setTab] = useState<'active' | 'archived'>('active');
  const [activeList, setActiveList] = useState<Notebook[]>([]);
  const [archivedList, setArchivedList] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<Notebook | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

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
      placeholder: 'e.g. Intake notes',
      confirmLabel: 'Create',
    });
    if (name === null) return;
    setBusy('new-book');
    try {
      const nbId = `nb-${Date.now()}`;
      const secId = `sec-${Date.now()}`;
      const pageId = `page-${Date.now()}`;
      await api.notebooks.create(nbId, coerceEntityTitle(name, 'notebook').slice(0, 80), openUnitId);
      await api.sections.create(secId, nbId, 'Notes');
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
      await api.sections.create(secId, nbId, 'Notes');
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
            Place
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
                <h2 className="mb-1 font-display text-base font-medium">Storage units</h2>
                <p className="mb-4 text-sm text-[var(--app-muted)]">
                  A place for your books. Open a unit to see its shelves.
                </p>
                <form
                  className="flex flex-col gap-2 sm:flex-row"
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
                <div className="flex flex-col items-center py-20 text-center">
                  <svg
                    width="56"
                    height="48"
                    viewBox="0 0 56 48"
                    aria-hidden
                    className="mb-4 opacity-60"
                  >
                    <rect
                      x="4"
                      y="6"
                      width="48"
                      height="36"
                      rx="4"
                      fill="var(--sage)"
                      stroke="var(--app-border)"
                    />
                    <path
                      d="M10 36h36M10 26h36M10 16h36"
                      stroke="var(--stone)"
                      strokeWidth="1.5"
                      opacity="0.7"
                    />
                    <rect x="14" y="18" width="5" height="7" rx="0.5" fill="var(--spine)" opacity="0.55" />
                    <rect x="21" y="20" width="4" height="5" rx="0.5" fill="#547f72" opacity="0.5" />
                    <rect x="28" y="17" width="5" height="8" rx="0.5" fill="#6b7c75" opacity="0.5" />
                  </svg>
                  <p className="font-display text-lg font-medium">No storage units yet</p>
                  <p className="mt-1 max-w-sm text-sm text-[var(--app-muted)]">
                    Add a unit above, then fill its shelves with books.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {bookshelves.map((unit) => (
                    <button
                      key={unit.id}
                      type="button"
                      onClick={() => setOpenUnitId(unit.id)}
                      className="library-unit group text-left"
                    >
                      <span className="library-unit-face" aria-hidden>
                        <span className="library-unit-rail" />
                        <span className="library-unit-rail" />
                        <span className="library-unit-rail" />
                      </span>
                      <span className="block px-4 pb-4 pt-3">
                        <span className="block text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--app-muted)]">
                          Storage unit
                        </span>
                        <span className="mt-1 block truncate font-display text-lg font-medium tracking-tight">
                          {unit.title || 'Untitled'}
                        </span>
                        <span className="mt-2 block text-xs text-[var(--app-muted)] transition group-hover:text-[var(--spine)]">
                          Open shelves →
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <section className="studio-panel flex flex-wrap items-center gap-2 bg-[var(--paper)] p-3 shadow-sm">
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
                  Import
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
                <h2 className="mb-1 font-display text-base font-medium">Shelves</h2>
                <p className="mb-5 text-sm text-[var(--app-muted)]">
                  Select a book to preview, then open it in Notes to write.
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
                  <div className="space-y-5">
                    {shelves.map((row, ri) => (
                      <div key={ri} className="library-shelf">
                        <div className="library-shelf-back" aria-hidden />
                        <div className="library-shelf-row">
                          {row.map((nb, bi) => {
                            const title = nb.title?.trim() || 'Untitled';
                            const m = bookMetrics(
                              nb,
                              ri * BOOKS_PER_SHELF + bi
                            );
                            return (
                              <button
                                key={nb.id}
                                type="button"
                                title={`${title} · ${m.pages} pages`}
                                aria-label={`${title}, ${m.pages} pages`}
                                aria-pressed={preview?.id === nb.id}
                                onClick={() => setPreview(nb)}
                                className={cn(
                                  'library-book',
                                  `library-book--p${m.pattern}`,
                                  tab === 'archived' && 'library-book--archived',
                                  preview?.id === nb.id && 'library-book-active'
                                )}
                                style={
                                  {
                                    width: `${m.width}px`,
                                    height: `${m.height}px`,
                                    ['--spine-tone' as string]: m.tone,
                                    ['--book-lean' as string]: `${m.lean}deg`,
                                  } as React.CSSProperties
                                }
                              >
                                <span className="library-book-pages" aria-hidden />
                                <span className="library-book-spine">
                                  <span className="library-book-headband" aria-hidden />
                                  <span className="library-book-title">
                                    {title.length > 34 ? `${title.slice(0, 32)}…` : title}
                                  </span>
                                  <span className="library-book-footband" aria-hidden />
                                </span>
                                <span className="library-book-edge" aria-hidden />
                              </button>
                            );
                          })}
                        </div>
                        <div className="library-shelf-board" aria-hidden />
                        <div className="library-shelf-lip" aria-hidden />
                      </div>
                    ))}
                  </div>
                )}

                {preview ? (
                  <div className="mt-6 border-t border-[var(--app-border)] pt-5">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--app-muted)]">
                          Book
                        </p>
                        <h3 className="font-display text-lg font-medium">
                          {preview.title?.trim() || 'Untitled'}
                        </h3>
                        <p className="mt-0.5 text-xs text-[var(--app-muted)]">
                          {sectionCount(preview)} chapters · {pageCount(preview)} pages
                        </p>
                      </div>
                      <button type="button" onClick={() => setPreview(null)} className="studio-btn">
                        <X className="h-3.5 w-3.5" />
                        Close
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {tab === 'active' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              onOpenNotebook(preview.id, openUnit.id);
                              setPreview(null);
                            }}
                            className="studio-btn-primary !px-3 !py-2 !text-xs"
                          >
                            <BookOpen className="h-3.5 w-3.5" />
                            Open in Notes
                          </button>
                          <button
                            type="button"
                            onClick={() => exportNb(preview)}
                            className="studio-btn"
                          >
                            <FileDown className="h-3.5 w-3.5" />
                            Export
                          </button>
                          <button
                            type="button"
                            disabled={busy === preview.id}
                            onClick={() => void archive(preview.id)}
                            className="studio-btn"
                          >
                            <Archive className="h-3.5 w-3.5" />
                            Archive
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={busy === preview.id}
                            onClick={() => void restore(preview)}
                            className="studio-btn-primary !px-3 !py-2 !text-xs"
                          >
                            <BookOpen className="h-3.5 w-3.5" />
                            Restore
                          </button>
                          <button
                            type="button"
                            disabled={busy === preview.id}
                            onClick={() => void removeForever(preview.id)}
                            className="studio-btn text-red-700 dark:text-red-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete forever
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ) : null}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
