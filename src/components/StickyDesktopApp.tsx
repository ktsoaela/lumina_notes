import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Notebook } from '../types';
import { api } from '../lib/api';
import { readActiveBookshelfId, readToken } from '../lib/authCache';
import {
  getStickyStripTarget,
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

/**
 * Neon strips stand alone. Click → shared page editor (same content as main app).
 * Write/Preview load from API; Save writes the full page back.
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
  const [loadingPage, setLoadingPage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [writingId, setWritingId] = useState<NeonId | null>(null);
  const [hoveredId, setHoveredId] = useState<NeonId | null>(null);
  const [targetTick, setTargetTick] = useState(0);
  const [reloadTick, setReloadTick] = useState(0);
  const [tab, setTab] = useState<EditorTab>('write');
  const lastLoadedRef = useRef('');
  const pageMetaRef = useRef<{
    sectionId: string;
    pageId: string;
    title: string;
  } | null>(null);

  const neon = NEONS.find((n) => n.id === (writingId ?? neonId)) ?? NEONS[0];
  const books = useMemo(
    () => notebooks.filter((nb) => !nb.archived),
    [notebooks]
  );
  const activeBook = books.find((b) => b.id === bookId) ?? books[0];
  const signedIn = Boolean(readToken());
  const writing = writingId !== null;
  const dirty = draft !== lastLoadedRef.current;

  const syncWindow = useCallback((mode: 'pack' | 'writing') => {
    window.luminaDesktop?.setStickyMode?.(mode);
  }, []);

  const resolveShelf = useCallback(
    () =>
      getStickyStripTarget()?.bookshelfId ?? shelfId ?? readActiveBookshelfId(),
    [shelfId]
  );

  useEffect(() => {
    document.title = "stick'n";
    applyTheme(getStoredTheme());
    document.documentElement.classList.add('sticky-strip-mode');
    document.body.style.background = 'transparent';
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';
    syncWindow('pack');
    return () => document.documentElement.classList.remove('sticky-strip-mode');
  }, [syncWindow]);

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
        };
        lastLoadedRef.current = page.content;
        setDraft(page.content);
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

  const pickFilm = (id: NeonId) => {
    setNeonId(id);
    setDraft('');
    lastLoadedRef.current = '';
    pageMetaRef.current = null;
    setWritingId(id);
    setHoveredId(null);
    setTab('write');
  };

  const backToPack = () => {
    setWritingId(null);
    setTab('write');
    setError(null);
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

  const openInLumina = async (save: boolean) => {
    const shelf = resolveShelf();
    if (!shelf || !activeBook || saving || !writingId) return;
    setSaving(true);
    setError(null);
    try {
      const page = await ensureNeonPage(shelf, writingId);
      const savedTitle = page.title || coerceEntityTitle(neon.label, 'page');
      // Shared document: textarea IS the page (continue writing on both sides)
      const savedContent = draft;

      // New pages always persist current editor text so Open doesn't lose work.
      if (page.isNew) {
        await api.pages.create(
          page.pageId,
          page.sectionId,
          savedTitle,
          savedContent
        );
        lastLoadedRef.current = savedContent;
      } else if (save) {
        await api.pages.update(page.pageId, savedTitle, savedContent);
        lastLoadedRef.current = savedContent;
      }

      const contentForMain = save || page.isNew ? savedContent : page.content;
      writeStore(PAGE_PREFIX + writingId, page.pageId);
      pageMetaRef.current = {
        sectionId: page.sectionId,
        pageId: page.pageId,
        title: savedTitle,
      };

      if (!window.luminaDesktop?.openPageInMain) {
        setError('Desktop bridge missing — restart the app');
        return;
      }
      window.luminaDesktop.openPageInMain({
        bookshelfId: shelf,
        notebookId: page.notebookId,
        sectionId: page.sectionId,
        pageId: page.pageId,
        content: contentForMain,
        title: savedTitle,
      });
    } catch (err) {
      console.error(err);
      setError('Could not save / open page');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={cn('stickn-root', writing && 'is-writing')}
      style={{ ['--film-accent' as string]: neon.color }}
    >
      {!writing ? (
        <div className="film-stand app-region-no-drag">
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
                {dirty ? (
                  <span className="text-[10px] text-[var(--app-muted)]">
                    unsaved
                  </span>
                ) : null}
                <button
                  type="button"
                  className="studio-btn ml-auto"
                  disabled={loadingPage || dirty}
                  title={
                    dirty
                      ? 'Save or discard edits before refresh'
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
                <span>same page as app</span>
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
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                      e.preventDefault();
                      void openInLumina(true);
                    }
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
                className="studio-btn-primary flex-1"
                disabled={saving || loadingPage || !activeBook}
                onClick={() => void openInLumina(true)}
              >
                {saving ? 'Saving…' : 'Save & open'}
              </button>
              <button
                type="button"
                className="studio-btn"
                disabled={saving || loadingPage || !activeBook}
                onClick={() => void openInLumina(false)}
              >
                Open page
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
