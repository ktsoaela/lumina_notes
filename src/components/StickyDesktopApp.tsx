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
import { applyA11y, getStoredA11y } from '../lib/a11y';
import { cn } from '../lib/utils';
import Preview from './Preview';
import {
  Bold,
  CheckSquare,
  ExternalLink,
  Eye,
  Italic,
  List,
  Pencil,
  RotateCw,
  Strikethrough,
  Workflow,
  X,
} from 'lucide-react';

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

/** How long the note takes to tuck back into the strip (matches CSS). */
const TUCK_MS = 220;

function prefersReducedMotion(): boolean {
  try {
    if (document.documentElement.classList.contains('reduce-motion')) return true;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

const PLACEHOLDER = `Take a note…

Markdown works here:
# Heading
- a list item
- [ ] a to-do
**bold**  _italic_`;

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
  const screen = window.screen as Screen & { availLeft?: number; availTop?: number };
  const left = screen.availLeft ?? 0;
  const top = screen.availTop ?? 0;
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
  /** Note is tucking back into its strip (close animation running). */
  const [closing, setClosing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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
    applyA11y(getStoredA11y()); // honour Profile → Accessibility → Reduce motion
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

  // Clicking away: collapse hover + ask Electron to clear Win11 white ghost bar.
  useEffect(() => {
    const onBlur = () => {
      setHoveredId(null);
      const active = document.activeElement;
      if (active instanceof HTMLElement) active.blur();
      window.luminaDesktop?.refreshStickyChrome?.();
      if (!writingId) syncWindow('pack');
    };
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [writingId, syncWindow]);

  useEffect(() => {
    const refresh = () => setTargetTick((n) => n + 1);
    const syncTheme = () => applyTheme(getStoredTheme());
    const onFocus = () => {
      syncTheme();
      window.luminaDesktop?.refreshStickyChrome?.();
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
      await api.pages.update(
        meta.pageId,
        coerceEntityTitle(meta.title || '', 'page'),
        content
      );
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

  const pickFilm = useCallback(
    (id: NeonId) => {
      void (async () => {
        // Switching colour from inside a note: save the current one first.
        if (writingId && draftRef.current !== lastLoadedRef.current) await persistDraft();
        setNeonId(id);
        setDraft('');
        lastLoadedRef.current = '';
        pageMetaRef.current = null;
        setSaveState('idle');
        setClosing(false);
        setWritingId(id);
        setHoveredId(null);
        setTab('write');
      })();
    },
    [writingId, persistDraft]
  );

  /** Save, tuck the note back into its strip, then shrink the window. */
  const closeNote = useCallback(() => {
    if (!writingId || closing) return;
    setClosing(true);
    const saved =
      draftRef.current !== lastLoadedRef.current ? persistDraft() : Promise.resolve(true);
    const tucked = new Promise((r) =>
      window.setTimeout(r, prefersReducedMotion() ? 0 : TUCK_MS)
    );
    void Promise.all([saved, tucked]).then(() => {
      setWritingId(null);
      setClosing(false);
      setTab('write');
      setError(null);
      setSaveState('idle');
    });
  }, [writingId, closing, persistDraft]);

  // Esc closes the note (like Sticky Notes).
  useEffect(() => {
    if (!writingId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeNote();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [writingId, closeNote]);

  // Tray → “Sticky notes › Pink note” opens that colour directly.
  useEffect(() => {
    return window.luminaDesktop?.onStickyOpenFilm?.((id) => {
      if (NEONS.some((n) => n.id === id)) pickFilm(id as NeonId);
    });
  }, [pickFilm]);

  /** Wrap the selection (or a placeholder word) in Markdown markers. */
  const wrapSelection = (before: string, after = before, fallback = 'text') => {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b, value } = el;
    const picked = value.slice(a, b) || fallback;
    const next = value.slice(0, a) + before + picked + after + value.slice(b);
    setDraft(next);
    setTab('write');
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + before.length, a + before.length + picked.length);
    });
  };

  /** Prefix the current line(s) — lists and to-dos. */
  const prefixLines = (prefix: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b, value } = el;
    const lineStart = value.lastIndexOf('\n', a - 1) + 1;
    const block = value.slice(lineStart, b);
    const replaced = block
      .split('\n')
      .map((l) => (l.startsWith(prefix) ? l : prefix + l))
      .join('\n');
    const next = value.slice(0, lineStart) + replaced + value.slice(b);
    setDraft(next);
    setTab('write');
    requestAnimationFrame(() => {
      el.focus();
      const end = lineStart + replaced.length;
      el.setSelectionRange(end, end);
    });
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
        <div
          className={cn('film-note', closing ? 'is-tucking' : 'is-pulling')}
          style={{ ['--film-color' as string]: neon.color }}
          role="dialog"
          aria-label={`${neon.label} sticky note`}
        >
          <header className="film-note-head app-region-drag">
            <div
              className="film-note-swatches app-region-no-drag"
              role="radiogroup"
              aria-label="Note colour"
            >
              {NEONS.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  role="radio"
                  aria-checked={n.id === writingId}
                  aria-label={`${n.label} note`}
                  title={`${n.label} note`}
                  className={cn('film-note-dot', n.id === writingId && 'is-current')}
                  style={{ backgroundColor: n.color }}
                  onClick={() => n.id !== writingId && pickFilm(n.id)}
                />
              ))}
            </div>
            <span className="film-note-title">{neon.label}</span>
            <div className="film-note-actions app-region-no-drag">
              <button
                type="button"
                className="film-note-icon"
                disabled={loadingPage || dirty || saving}
                title={dirty ? 'Saving first…' : 'Reload from app'}
                aria-label="Reload from app"
                onClick={() => setReloadTick((n) => n + 1)}
              >
                <RotateCw className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="film-note-icon"
                disabled={saving || loadingPage || !activeBook}
                title="Open in Lumina"
                aria-label="Open in Lumina"
                onClick={() => void openInApp()}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="film-note-icon film-note-close"
                title="Close (Esc) — saves automatically"
                aria-label="Close note"
                onClick={closeNote}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div className="film-note-mode" role="tablist" aria-label="Editor mode">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'write'}
              className={cn('film-note-tab', tab === 'write' && 'is-active')}
              onClick={() => setTab('write')}
            >
              <Pencil className="h-3 w-3" /> Write
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'preview'}
              className={cn('film-note-tab', tab === 'preview' && 'is-active')}
              onClick={() => setTab('preview')}
            >
              <Eye className="h-3 w-3" /> Preview
            </button>
            <span className="film-note-status" aria-live="polite">
              {loadingPage
                ? 'Loading…'
                : saveState === 'saving' || saving
                  ? 'Saving…'
                  : saveState === 'dirty'
                    ? 'Editing…'
                    : saveState === 'saved'
                      ? 'Saved'
                      : ''}
            </span>
          </div>

          <div className="film-note-body">
            {loadingPage ? (
              <p className="film-note-empty">Loading page…</p>
            ) : tab === 'write' ? (
              <textarea
                ref={textareaRef}
                className="strip-textarea"
                placeholder={PLACEHOLDER}
                aria-label={`${neon.label} note text`}
                value={draft}
                autoFocus
                spellCheck
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => {
                  if (dirty) void persistDraft();
                }}
              />
            ) : draft.trim() ? (
              <Preview content={draft} className="strip-preview-inner" />
            ) : (
              <p className="film-note-empty">Nothing to preview yet — switch to Write.</p>
            )}
          </div>

          {error ? <p className="film-note-error">{error}</p> : null}

          <footer className="film-note-foot">
            <div className="film-note-format" role="toolbar" aria-label="Formatting">
              <button type="button" className="film-note-icon" title="Bold" aria-label="Bold" onClick={() => wrapSelection('**')}>
                <Bold className="h-3.5 w-3.5" />
              </button>
              <button type="button" className="film-note-icon" title="Italic" aria-label="Italic" onClick={() => wrapSelection('_')}>
                <Italic className="h-3.5 w-3.5" />
              </button>
              <button type="button" className="film-note-icon" title="Strikethrough" aria-label="Strikethrough" onClick={() => wrapSelection('~~')}>
                <Strikethrough className="h-3.5 w-3.5" />
              </button>
              <button type="button" className="film-note-icon" title="Bulleted list" aria-label="Bulleted list" onClick={() => prefixLines('- ')}>
                <List className="h-3.5 w-3.5" />
              </button>
              <button type="button" className="film-note-icon" title="To-do" aria-label="To-do" onClick={() => prefixLines('- [ ] ')}>
                <CheckSquare className="h-3.5 w-3.5" />
              </button>
              <button type="button" className="film-note-icon" title="Insert Mermaid diagram" aria-label="Insert Mermaid diagram" onClick={insertMermaid}>
                <Workflow className="h-3.5 w-3.5" />
              </button>
            </div>
            <span className="film-note-book" title="Saves to this book">
              {activeBook?.title ?? 'No book selected'}
            </span>
          </footer>
        </div>
      )}
    </div>
  );
}
