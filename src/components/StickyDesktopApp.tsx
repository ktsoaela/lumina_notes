import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Notebook, Page } from '../types';
import { api } from '../lib/api';
import { readActiveBookshelfId, readToken } from '../lib/authCache';
import {
  getStickyStripTarget,
  STICKY_TARGET_EVENT,
} from '../lib/stickyStrips';
import { coerceEntityTitle } from '../lib/validation';
import { cn } from '../lib/utils';

const NEON_KEY = 'lumina_sticky_neon';
const DRAFT_PREFIX = 'lumina_sticky_draft_';
const PAGE_PREFIX = 'lumina_sticky_page_';

type NeonId = 'pink' | 'orange' | 'yellow' | 'green' | 'blue';

const NEONS: { id: NeonId; label: string; color: string }[] = [
  { id: 'pink', label: 'Pink', color: 'rgba(255, 20, 147, 0.88)' },
  { id: 'orange', label: 'Orange', color: 'rgba(255, 102, 0, 0.88)' },
  { id: 'yellow', label: 'Yellow', color: 'rgba(255, 215, 0, 0.88)' },
  { id: 'green', label: 'Green', color: 'rgba(50, 205, 50, 0.88)' },
  { id: 'blue', label: 'Blue', color: 'rgba(0, 191, 255, 0.88)' },
];

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
 * Neon strips stand alone at ~30% width (no labels).
 * Hover one → full width + name. Click → write / save & open / open page.
 * Book target: Profile → Sticky note strips.
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
  const [draft, setDraft] = useState(() => readStore(DRAFT_PREFIX + readNeon()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [writingId, setWritingId] = useState<NeonId | null>(null);
  const [hoveredId, setHoveredId] = useState<NeonId | null>(null);
  const [targetTick, setTargetTick] = useState(0);

  const neon = NEONS.find((n) => n.id === (writingId ?? neonId)) ?? NEONS[0];
  const books = useMemo(
    () => notebooks.filter((nb) => !nb.archived),
    [notebooks]
  );
  const activeBook = books.find((b) => b.id === bookId) ?? books[0];
  const signedIn = Boolean(readToken());
  const writing = writingId !== null;

  const syncWindow = useCallback((mode: 'pack' | 'writing') => {
    window.luminaDesktop?.setStickyMode?.(mode);
  }, []);

  useEffect(() => {
    document.title = "stick'n";
    document.documentElement.classList.remove('dark', 'contrast');
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
    window.addEventListener(STICKY_TARGET_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(STICKY_TARGET_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

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
    // bookId intentionally omitted — only re-fetch on shelf/target change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, shelfId, targetTick]);

  useEffect(() => {
    writeStore(NEON_KEY, neonId);
    writeStore(DRAFT_PREFIX + neonId, draft);
  }, [neonId, draft]);

  const pickFilm = (id: NeonId) => {
    writeStore(DRAFT_PREFIX + neonId, draft);
    setNeonId(id);
    setDraft(readStore(DRAFT_PREFIX + id));
    setWritingId(id);
    setHoveredId(null);
  };

  const backToPack = () => {
    writeStore(DRAFT_PREFIX + neonId, draft);
    setWritingId(null);
  };

  const ensureNeonPage = async (): Promise<{
    sectionId: string;
    pageId: string;
    page: Page | undefined;
  }> => {
    if (!activeBook) throw new Error('No book');
    const pages = activeBook.sections.flatMap((sec) =>
      sec.pages.map((p) => ({
        id: p.id,
        title: p.title,
        sectionId: sec.id,
      }))
    );
    const storedId = readStore(PAGE_PREFIX + neonId);
    let hit = storedId ? pages.find((p) => p.id === storedId) : undefined;
    if (!hit) {
      hit = pages.find(
        (p) => p.title.trim().toLowerCase() === neon.label.toLowerCase()
      );
    }

    let sectionId = hit?.sectionId ?? activeBook.sections[0]?.id;
    if (!sectionId) {
      sectionId = `sec-${Date.now()}`;
      await api.sections.create(sectionId, activeBook.id, "stick'n");
    }

    if (hit) {
      const page = activeBook.sections
        .flatMap((s) => s.pages)
        .find((p) => p.id === hit!.id);
      return { sectionId: hit.sectionId, pageId: hit.id, page };
    }

    const pageId = `page-${Date.now()}`;
    const title = coerceEntityTitle(neon.label, 'page');
    await api.pages.create(pageId, sectionId, title, '');
    writeStore(PAGE_PREFIX + neonId, pageId);
    return { sectionId, pageId, page: undefined };
  };

  const openInLumina = async (withDraft: boolean) => {
    const shelf =
      getStickyStripTarget()?.bookshelfId ?? shelfId ?? readActiveBookshelfId();
    if (!shelf || !activeBook || saving) return;
    setSaving(true);
    setError(null);
    try {
      const { sectionId, pageId, page } = await ensureNeonPage();
      const text = draft.trim();
      if (withDraft && text) {
        const next = page?.content
          ? `${page.content.trimEnd()}\n\n${text}`
          : text;
        await api.pages.update(
          pageId,
          page?.title || coerceEntityTitle(neon.label, 'page'),
          next
        );
        setDraft('');
        writeStore(DRAFT_PREFIX + neonId, '');
      }
      writeStore(PAGE_PREFIX + neonId, pageId);
      window.luminaDesktop?.openPageInMain?.({
        bookshelfId: shelf,
        notebookId: activeBook.id,
        sectionId,
        pageId,
      });
      setWritingId(null);
    } catch {
      setError('Could not open page');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cn('stickn-root', writing && 'is-writing')}>
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
                <span className="sheet-count">24×25</span>
              </button>
            ))}
          </div>
          {!signedIn ? (
            <p className="pack-hint stand-hint">Sign in first</p>
          ) : !activeBook ? (
            <p className="pack-hint stand-hint">
              Set a book in Profile → Sticky note strips
            </p>
          ) : null}
        </div>
      ) : (
        <div className="dispenser-pack film-writer-shell app-region-drag">
          <div className="film-writer app-region-no-drag">
            <button type="button" className="film-back" onClick={backToPack}>
              ← Films
            </button>
            <h3>
              <span
                className="neon-swatch"
                style={{ backgroundColor: neon.color }}
              />
              {neon.label}
            </h3>
            <p
              className="stand-hint"
              style={{ textAlign: 'left', maxWidth: 'none' }}
            >
              Book: {activeBook?.title ?? '—'}
            </p>
            <textarea
              className="strip-textarea"
              style={{
                borderColor: neon.color,
                boxShadow: `inset 3px 0 0 ${neon.color}`,
              }}
              placeholder="One line or a short paragraph…"
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
            {error ? <p className="strip-error">{error}</p> : null}
            <div className="strip-actions">
              <button
                type="button"
                className="strip-save"
                disabled={saving || !activeBook}
                onClick={() => void openInLumina(true)}
              >
                {saving ? 'Opening…' : 'Save & open page'}
              </button>
              <button
                type="button"
                className="strip-open-page"
                disabled={saving || !activeBook}
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
