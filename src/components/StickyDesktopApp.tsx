import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Notebook } from '../types';
import { api } from '../lib/api';
import { readActiveBookshelfId, readToken } from '../lib/authCache';
import {
  getStickyStripEdge,
  getStickyStripTarget,
  STICKY_EDGE_EVENT,
  STICKY_TARGET_EVENT,
} from '../lib/stickyStrips';
import { coerceEntityTitle } from '../lib/validation';
import { applyTheme, getStoredTheme } from '../lib/theme';
import { cn } from '../lib/utils';
import Preview from './Preview';

const NEON_KEY = 'lumina_sticky_neon';
const PAGE_PREFIX = 'lumina_sticky_page_';

type NeonId = 'pink' | 'orange' | 'yellow' | 'green' | 'blue';
type EditorTab = 'write' | 'preview';
type StickyEdge = 'left' | 'right' | 'top' | 'bottom';

const NEONS: { id: NeonId; label: string; color: string }[] = [
  { id: 'pink', label: 'Pink', color: 'rgba(255, 20, 147, 0.88)' },
  { id: 'orange', label: 'Orange', color: 'rgba(255, 102, 0, 0.88)' },
  { id: 'yellow', label: 'Yellow', color: 'rgba(255, 215, 0, 0.88)' },
  { id: 'green', label: 'Green', color: 'rgba(50, 205, 50, 0.88)' },
  { id: 'blue', label: 'Blue', color: 'rgba(0, 191, 255, 0.88)' },
];

const MERMAID_SNIPPET = `\`\`\`mermaid
flowchart LR
  A[Start] --> B[Note]
\`\`\`
`;

function readStore(key: string) {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function writeStore(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function readNeon(): NeonId {
  const v = readStore(NEON_KEY) as NeonId;
  return NEONS.some((n) => n.id === v) ? v : 'pink';
}

function readStickyEdge(): StickyEdge {
  const x = window.screenX;
  const y = window.screenY;
  const w = window.outerWidth;
  const h = window.outerHeight;
  const left = window.screen.availLeft;
  const top = window.screen.availTop;
  const right = left + window.screen.availWidth;
  const bottom = top + window.screen.availHeight;
  const dLeft = x - left;
  const dRight = right - (x + w);
  const dTop = y - top;
  const dBottom = bottom - (y + h);

  // Horizontal pack (280×150) → top or bottom; vertical pack → left or right
  if (w > h) {
    return dTop <= dBottom ? 'top' : 'bottom';
  }

  const min = Math.min(dLeft, dRight, dTop, dBottom);
  if (min === dLeft) return 'left';
  if (min === dRight) return 'right';
  if (min === dTop) return 'top';
  return 'bottom';
}

/**
 * Neon strips stand alone. Click → shared page editor (same content as main app).
 * Autosaves like Sticky Notes — no need to open the file after typing.
 */
export default function StickyDesktopApp() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [shelfId, setShelfId] = useState<string | null>(
    () => getStickyStripTarget()?.bookshelfId ?? readActiveBookshelfId()
  );
  const [bookId, setBookId] = useState(
    () => getStickyStripTarget()?.notebookId ?? ''
  );
  const [neonId, setNeonId] = useState<NeonId>(readNeon);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'dirty' | 'saving' | 'saved'>(
    'idle'
  );
  const [loadingPage, setLoadingPage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [writingId, setWritingId] = useState<NeonId | null>(null);
  const [hoveredId, setHoveredId] = useState<NeonId | null>(null);
  const [targetTick, setTargetTick] = useState(0);
  const [reloadTick, setReloadTick] = useState(0);
  const [tab, setTab] = useState<EditorTab>('write');
  const [edge, setEdge] = useState<StickyEdge>(() => readStickyEdge());
  const lastLoadedRef = useRef('');
  const draftRef = useRef('');
  const localEditAtRef = useRef(0);
  const pageMetaRef = useRef<{
    sectionId: string;
    pageId: string;
    title: string;
    notebookId: string;
  } | null>(null);
  const AUTOSAVE_MS = 450;

  const neon = NEONS.find((n) => n.id === (writingId ?? neonId)) ?? NEONS[0];
  const books = useMemo(
    () => notebooks.filter((nb) => !nb.archived),
    [notebooks]
  );
  const activeBook = books.find((b) => b.id === bookId) ?? books[0];
  const signedIn = Boolean(readToken());
  const writing = writingId !== null;
  const dirty = draft !== lastLoadedRef.current;
  draftRef.current = draft;

  const syncWindow = useCallback((mode: 'pack' | 'writing') => {
    window.luminaDesktop?.setStickyMode?.(mode);
  }, []);

  const resolveShelf = useCallback(
    () =>
      getStickyStripTarget()?.bookshelfId ?? shelfId ?? readActiveBookshelfId(),
    [shelfId]
  );

  useEffect(() => {
    document.title = '\u200b';
    applyTheme(getStoredTheme());
    document.documentElement.classList.add('sticky-strip-mode');
    document.body.style.background = 'transparent';
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';
    syncWindow('pack');
    window.luminaDesktop?.setStickyEdge?.(getStickyStripEdge());
    return () => document.documentElement.classList.remove('sticky-strip-mode');
  }, [syncWindow]);

  useEffect(() => {
    const onEdgePref = () => {
      window.luminaDesktop?.setStickyEdge?.(getStickyStripEdge());
    };
    window.addEventListener(STICKY_EDGE_EVENT, onEdgePref);
    return () => window.removeEventListener(STICKY_EDGE_EVENT, onEdgePref);
  }, []);

  useEffect(() => {
    const syncEdge = () => setEdge(readStickyEdge());
    syncEdge();
    window.addEventListener('resize', syncEdge);
    const timer = window.setInterval(syncEdge, 240);
    const unsubEdge = window.luminaDesktop?.onStickyEdge?.((next) => {
      if (next === 'left' || next === 'right' || next === 'top' || next === 'bottom') {
        setEdge(next);
      }
    });
    return () => {
      window.removeEventListener('resize', syncEdge);
      window.clearInterval(timer);
      unsubEdge?.();
    };
  }, []);

  useEffect(() => {
    syncWindow(writing ? 'writing' : 'pack');
  }, [writing, syncWindow]);

  useEffect(() => {
    const refresh = () => setTargetTick((n) => n + 1);
    const syncTheme = () => applyTheme(getStoredTheme());
    const onFocus = () => {
      syncTheme();
      // Reload shared page if widget has no unsaved edits
      if (writingId && draft === lastLoadedRef.current) {
        setReloadTick((n) => n + 1);
      }
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'lumina_theme' || e.key === null) syncTheme();
      refresh();
    };
    window.addEventListener(STICKY_TARGET_EVENT, refresh);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    const unsub = window.luminaDesktop?.onStickyTargetChanged?.(refresh);
    return () => {
      window.removeEventListener(STICKY_TARGET_EVENT, refresh);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
      unsub?.();
    };
  }, [writingId, draft]);

  useEffect(() => {
    const target = getStickyStripTarget();
    const nextShelf = target?.bookshelfId ?? readActiveBookshelfId();
    const nextBook = target?.notebookId ?? '';
    setShelfId(nextShelf);
    if (nextBook) setBookId(nextBook);
  }, [targetTick]);

  useEffect(() => {
    if (!signedIn || !shelfId) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await api.notebooks.list(false, shelfId);
        if (cancelled) return;
        setNotebooks(list);
        setError(null);
        const target = getStickyStripTarget();
        if (target?.notebookId && list.some((n) => n.id === target.notebookId)) {
          setBookId(target.notebookId);
        } else if (!list.some((n) => n.id === bookId) && list[0]) {
          setBookId(list[0].id);
        }
      } catch {
        if (!cancelled) setError('Could not load books');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, shelfId, targetTick]);

  useEffect(() => {
    writeStore(NEON_KEY, neonId);
  }, [neonId]);

  const ensureSticknSectionId = async (book: Notebook): Promise<string> => {
    const existing = book.sections.find(
      (s) => s.title.trim().toLowerCase() === "stick'n"
    );
    if (existing) return existing.id;
    const sectionId = `sec-stickn-${book.id}`;
    try {
      await api.sections.create(sectionId, book.id, "stick'n");
    } catch {
      /* may already exist */
    }
    return sectionId;
  };

  /** Resolve film page from API (shared with main app). */
  const ensureNeonPage = useCallback(
    async (
      bookshelfId: string,
      filmId: NeonId
    ): Promise<{
      sectionId: string;
      pageId: string;
      title: string;
      content: string;
      isNew: boolean;
      notebookId: string;
    }> => {
      const film = NEONS.find((n) => n.id === filmId) ?? NEONS[0];
      const [active, archived] = await Promise.all([
        api.notebooks.list(false, bookshelfId),
        api.notebooks.list(true, bookshelfId),
      ]);
      const preferredId =
        getStickyStripTarget()?.notebookId || bookId || active[0]?.id;
      const book =
        active.find((n) => n.id === preferredId) ??
        archived.find((n) => n.id === preferredId) ??
        active[0];
      if (!book) throw new Error('No book');
      setNotebooks(active);
      setBookId(book.id);

      const index = book.sections.flatMap((sec) =>
        sec.pages.map((p) => ({
          id: p.id,
          title: p.title,
          content: p.content ?? '',
          sectionId: sec.id,
        }))
      );
      const storedId = readStore(PAGE_PREFIX + filmId);
      let hit = storedId ? index.find((p) => p.id === storedId) : undefined;
      if (!hit) {
        hit = index.find(
          (p) => p.title.trim().toLowerCase() === film.label.toLowerCase()
        );
      }

      if (hit) {
        const live = await api.pages.list(hit.sectionId);
        const page = live.find((p) => p.id === hit!.id);
        writeStore(PAGE_PREFIX + filmId, hit.id);
        return {
          sectionId: hit.sectionId,
          pageId: hit.id,
          title: page?.title || hit.title,
          content: page?.content ?? hit.content ?? '',
          isNew: false,
          notebookId: book.id,
        };
      }

      const sectionId = await ensureSticknSectionId(book);
      const pageId = `page-${Date.now()}`;
      const title = coerceEntityTitle(film.label, 'page');
      writeStore(PAGE_PREFIX + filmId, pageId);
      return {
        sectionId,
        pageId,
        title,
        content: '',
        isNew: true,
        notebookId: book.id,
      };
    },
    [bookId]
  );

  // Load shared page into Write/Preview whenever a film opens (or clean focus reload)
  useEffect(() => {
    if (!writingId) return;
    const shelf = resolveShelf();
    if (!shelf || !signedIn) return;
    let cancelled = false;
    (async () => {
      setLoadingPage(true);
      setError(null);
      try {
        const page = await ensureNeonPage(shelf, writingId);
        if (cancelled) return;
        if (page.isNew) {
          await api.pages.create(
            page.pageId,
            page.sectionId,
            page.title,
            ''
          );
        }
        pageMetaRef.current = {
          sectionId: page.sectionId,
          pageId: page.pageId,
          title: page.title,
          notebookId: page.notebookId,
        };
        lastLoadedRef.current = page.content;
        setDraft(page.content);
        setSaveState('saved');
      } catch (err) {
        console.error(err);
        if (!cancelled) setError('Could not load page from app');
      } finally {
        if (!cancelled) setLoadingPage(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [writingId, reloadTick, signedIn, resolveShelf, ensureNeonPage]);

  const persistDraft = useCallback(async (): Promise<boolean> => {
    const meta = pageMetaRef.current;
    if (!meta || !writingId) return false;
    const content = draftRef.current;
    if (content === lastLoadedRef.current) {
      setSaveState('saved');
      return true;
    }
    setSaving(true);
    setSaveState('saving');
    setError(null);
    try {
      await api.pages.update(meta.pageId, meta.title, content);
      if (draftRef.current === content) {
        lastLoadedRef.current = content;
        setSaveState('saved');
      }
      return true;
    } catch (err) {
      console.error(err);
      setError('Could not save note');
      setSaveState('dirty');
      return false;
    } finally {
      setSaving(false);
    }
  }, [writingId]);

  // Live mirror to main window — every keystroke (don't wait for API).
  useEffect(() => {
    if (!writingId || loadingPage) return;
    const meta = pageMetaRef.current;
    if (!meta) return;
    localEditAtRef.current = Date.now();
    window.luminaDesktop?.publishPageSync?.({
      pageId: meta.pageId,
      content: draft,
      title: meta.title,
      sectionId: meta.sectionId,
      notebookId: meta.notebookId,
      at: localEditAtRef.current,
    });
  }, [draft, writingId, loadingPage]);

  // Mirror main → sticky (last-write-wins by timestamp).
  useEffect(() => {
    const desktop = window.luminaDesktop;
    if (!desktop?.onPageSync) return;
    return desktop.onPageSync((patch) => {
      const meta = pageMetaRef.current;
      if (!meta || meta.pageId !== patch.pageId) return;
      if ((patch.at ?? 0) <= localEditAtRef.current) return;
      if (draftRef.current === patch.content) return;
      lastLoadedRef.current = patch.content;
      setDraft(patch.content);
      if (patch.title !== undefined) {
        pageMetaRef.current = { ...meta, title: patch.title };
      }
      setSaveState('saved');
    });
  }, []);

  // Autosave to API in the background
  useEffect(() => {
    if (!writingId || loadingPage || !pageMetaRef.current) return;
    if (draft === lastLoadedRef.current) return;
    setSaveState('dirty');
    const t = window.setTimeout(() => {
      void persistDraft();
    }, AUTOSAVE_MS);
    return () => window.clearTimeout(t);
  }, [draft, writingId, loadingPage, persistDraft]);

  const pickFilm = (id: NeonId) => {
    setNeonId(id);
    setDraft('');
    lastLoadedRef.current = '';
    pageMetaRef.current = null;
    setSaveState('idle');
    setWritingId(id);
    setHoveredId(null);
    setTab('write');
  };

  const backToPack = () => {
    void (async () => {
      if (dirty) await persistDraft();
      setWritingId(null);
      setTab('write');
      setError(null);
      setSaveState('idle');
    })();
  };

  const insertMermaid = () => {
    setDraft((prev) => {
      const next = prev.trim()
        ? `${prev.trimEnd()}\n\n${MERMAID_SNIPPET}`
        : MERMAID_SNIPPET;
      return next;
    });
    setTab('write');
  };

  /** Optional — open in main app (autosave first). */
  const openInApp = async () => {
    const shelf = resolveShelf();
    const meta = pageMetaRef.current;
    if (!shelf || !meta || !writingId) return;
    const ok = await persistDraft();
    if (!ok) return;
    if (!window.luminaDesktop?.openPageInMain) {
      setError('Desktop bridge missing — restart the app');
      return;
    }
    window.luminaDesktop.openPageInMain({
      bookshelfId: shelf,
      notebookId: meta.notebookId,
      sectionId: meta.sectionId,
      pageId: meta.pageId,
      content: draftRef.current,
      title: meta.title,
    });
  };

  return (
    <div
      className={cn('stickn-root', writing && 'is-writing')}
      style={{ ['--film-accent' as string]: neon.color }}
      data-edge={edge}
    >
      {!writing ? (
        <div
          className={cn(
            'film-stand app-region-no-drag',
            edge === 'left' && 'film-stand--from-left',
            edge === 'top' && 'film-stand--from-top',
            edge === 'bottom' && 'film-stand--from-bottom'
          )}
        >
          <div className="film-stand-drag app-region-drag" title="Drag" />
          <div className="tabs-dispenser-grid">
            {NEONS.map((n) => (
              <button
                key={n.id}
                type="button"
                className={cn(
                  'neon-film-stack',
                  hoveredId === n.id && 'is-expanded'
                )}
                style={{ backgroundColor: n.color }}
                aria-label={n.label}
                onMouseEnter={() => setHoveredId(n.id)}
                onMouseLeave={() => setHoveredId(null)}
                onFocus={() => setHoveredId(n.id)}
                onBlur={() => setHoveredId(null)}
                onClick={() => pickFilm(n.id)}
              >
                <span className="neon-film-shine" />
                <span className="neon-film-name">{n.label}</span>
              </button>
            ))}
          </div>
          {!signedIn ? (
            <p className="stand-hint">Sign in first</p>
          ) : !activeBook ? (
            <p className="stand-hint">
              Set a book in Profile → Sticky note strips
            </p>
          ) : null}
        </div>
      ) : (
        <div className="studio-shell film-writer-shell">
          <div className="film-writer-drag app-region-drag" title="Drag" />
          <div className="acoustic-pillar film-writer app-region-no-drag">
            <div className="film-writer-top">
              <div className="film-writer-toolbar">
                <button
                  type="button"
                  className="studio-btn"
                  onClick={backToPack}
                >
                  ← Films
                </button>
                <span
                  className="neon-swatch"
                  style={{ backgroundColor: neon.color }}
                  title={neon.label}
                />
                <span className="font-display text-sm font-medium tracking-tight text-[var(--app-fg)]">
                  {neon.label}
                </span>
                <span
                  className="text-[10px] text-[var(--app-muted)]"
                  aria-live="polite"
                >
                  {loadingPage
                    ? ''
                    : saveState === 'saving' || saving
                      ? 'Saving…'
                      : saveState === 'dirty'
                        ? 'Editing…'
                        : saveState === 'saved'
                          ? 'Saved'
                          : ''}
                </span>
                <button
                  type="button"
                  className="studio-btn ml-auto"
                  disabled={loadingPage || dirty || saving}
                  title={
                    dirty
                      ? 'Wait for autosave before refresh'
                      : 'Reload from app'
                  }
                  onClick={() => setReloadTick((n) => n + 1)}
                >
                  Refresh
                </button>
              </div>
              <nav
                className="film-writer-path text-[11px] tracking-[0.04em] text-[var(--app-muted)]"
                aria-label="Target book"
              >
                <span className="font-medium text-[var(--spine)]">
                  {activeBook?.title ?? 'No book selected'}
                </span>
                <span aria-hidden className="opacity-30">
                  ·
                </span>
                <span>autosaves to the same page</span>
              </nav>
            </div>

            <div
              className="film-tabs"
              role="tablist"
              aria-label="Editor mode"
            >
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'write'}
                className={cn('studio-btn', tab === 'write' && 'is-active-tab')}
                onClick={() => setTab('write')}
              >
                Write
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'preview'}
                className={cn(
                  'studio-btn',
                  tab === 'preview' && 'is-active-tab'
                )}
                onClick={() => setTab('preview')}
              >
                Preview
              </button>
              <button
                type="button"
                className="studio-btn ml-auto"
                onClick={insertMermaid}
                title="Insert mermaid block"
              >
                + Mermaid
              </button>
            </div>

            <div className="paper-page film-writer-paper">
              {loadingPage ? (
                <p className="px-6 py-8 text-center text-sm text-[var(--app-muted)]">
                  Loading page…
                </p>
              ) : tab === 'write' ? (
                <textarea
                  className="strip-textarea"
                  placeholder={
                    'Continue this note — same page as the main app…\n\n# Heading\n- list\n\n```mermaid\nflowchart LR\n  A --> B\n```'
                  }
                  value={draft}
                  autoFocus
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => {
                    if (dirty) void persistDraft();
                  }}
                />
              ) : draft.trim() ? (
                <Preview content={draft} className="strip-preview-inner" />
              ) : (
                <p className="px-6 py-8 text-center text-sm text-[var(--app-muted)]">
                  Nothing to preview yet.
                </p>
              )}
            </div>

            {error ? (
              <p className="text-xs text-[var(--danger-fg)]">{error}</p>
            ) : null}
            <div className="strip-actions">
              <button
                type="button"
                className="studio-btn flex-1"
                disabled={saving || loadingPage || !activeBook}
                onClick={() => void openInApp()}
              >
                Open in app
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
