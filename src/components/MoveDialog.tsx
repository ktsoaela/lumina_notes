import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, Bookmark, Check, Loader2, Search, X } from 'lucide-react';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import { displayBookTitle, displaySectionTitle } from '../lib/displayTitle';
import type { DragItem } from '../lib/moveItems';
import type { Bookshelf, Notebook } from '../types';

type Dest = {
  /** section id (moving a page) or notebook id (moving a chapter) */
  id: string;
  label: string;
  sub: string;
  shelf: string;
  current: boolean;
};

interface MoveDialogProps {
  item: DragItem;
  itemLabel: string;
  onClose: () => void;
  onMove: (destId: string, destLabel: string) => Promise<void> | void;
}

/** “Move to…” picker: every chapter (for pages) or book (for chapters) across all shelves. */
export function MoveDialog({ item, itemLabel, onClose, onMove }: MoveDialogProps) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [dests, setDests] = useState<Dest[]>([]);
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const shelves: Bookshelf[] = await api.bookshelves.list();
        const rows: Dest[] = [];
        for (const shelf of shelves) {
          const books: Notebook[] = await api.notebooks.list(false, shelf.id);
          for (const nb of books) {
            const book = displayBookTitle(nb.title).text;
            if (item.kind === 'section') {
              rows.push({
                id: nb.id,
                label: book,
                sub: `${nb.sections.length} chapters`,
                shelf: shelf.title,
                current: nb.id === item.notebookId,
              });
            } else {
              nb.sections.forEach((s, i) =>
                rows.push({
                  id: s.id,
                  label: displaySectionTitle(s.title, i + 1).text,
                  sub: book,
                  shelf: shelf.title,
                  current: s.id === item.sectionId,
                })
              );
            }
          }
        }
        if (!cancelled) setDests(rows);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Could not load books');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [item]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return dests;
    return dests.filter((d) =>
      `${d.label} ${d.sub} ${d.shelf}`.toLowerCase().includes(q)
    );
  }, [dests, query]);

  const grouped = useMemo(() => {
    const m = new Map<string, Dest[]>();
    for (const d of filtered) {
      const list = m.get(d.shelf) ?? [];
      list.push(d);
      m.set(d.shelf, list);
    }
    return [...m.entries()];
  }, [filtered]);

  const pick = async (d: Dest) => {
    if (d.current || busyId) return;
    setBusyId(d.id);
    try {
      await onMove(d.id, d.label);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Move failed');
      setBusyId(null);
    }
  };

  const Icon = item.kind === 'page' ? Bookmark : BookOpen;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/35"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="move-dialog-title"
        className="studio-panel relative flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden bg-[var(--paper)] shadow-xl sm:rounded-[var(--radius-ui)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--app-border)] px-5 py-4">
          <div className="min-w-0">
            <h2 id="move-dialog-title" className="font-display text-base font-medium">
              Move {item.kind === 'page' ? 'page' : 'chapter'}
            </h2>
            <p className="truncate text-xs text-[var(--app-muted)]">
              “{itemLabel}” → choose a {item.kind === 'page' ? 'chapter' : 'book'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-[var(--gutter)]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="border-b border-[var(--app-border)] px-5 py-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--app-muted)]" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={item.kind === 'page' ? 'Find a chapter or book…' : 'Find a book…'}
              className="studio-input !pl-8"
            />
          </label>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--spine)]" />
            </div>
          ) : grouped.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-[var(--app-muted)]">
              {item.kind === 'page' ? 'No chapters found.' : 'No books found.'}
            </p>
          ) : (
            grouped.map(([shelf, list]) => (
              <div key={shelf} className="mb-2">
                <p className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--app-muted)]">
                  {shelf}
                </p>
                {list.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    disabled={d.current || !!busyId}
                    onClick={() => void pick(d)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition',
                      d.current
                        ? 'cursor-default opacity-60'
                        : 'hover:bg-[var(--gutter)]'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-[var(--spine)]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{d.label}</span>
                      <span className="block truncate text-xs text-[var(--app-muted)]">{d.sub}</span>
                    </span>
                    {busyId === d.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-[var(--spine)]" />
                    ) : d.current ? (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-[var(--app-muted)]">
                        <Check className="h-3 w-3" /> Here
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            ))
          )}
          {err ? <p className="px-3 py-2 text-xs text-[var(--danger)]">{err}</p> : null}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default MoveDialog;
