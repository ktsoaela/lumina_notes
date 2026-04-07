import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Archive,
  BookOpen,
  Loader2,
  Trash2,
  FileDown,
  FileText,
  List,
  Upload,
  Plus,
  Pencil,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import type { Bookshelf, Notebook } from '../types';
import { notebookToMarkdown, downloadText, parseImportedMarkdown } from '../lib/markdownIO';
import { sanitizeFilename } from '../lib/filename';
import { cn } from '../lib/utils';
import { useAppDialogs } from '../context/AppDialogsContext';

const WOOD_BOOK_COLORS = ['#2c7be5', '#e5533d', '#2eb85c', '#f9b115', '#6f42c1'] as const;
/** Books per shelf row: fill row 1 (up to 12), then row 2, etc. */
const BOOKS_PER_ROW = 12;
/** Renders wood shelf frame + spine pixel sizes at 2× base metrics. */
const SHELF_VISUAL_SCALE = 2;

/** Chunk notebooks into rows of at most `perRow` items, in order. */
function chunkIntoRows<T>(items: T[], perRow: number): T[][] {
  if (items.length === 0) return [];
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += perRow) {
    rows.push(items.slice(i, i + perRow));
  }
  return rows;
}

const RAIL_SLOTS = 4;
const CARRIAGE_W = 130;
const CARRIAGE_GAP = 10;
const SECTION_LETTERS = ['A', 'B', 'C', 'D'] as const;
const CARRIAGE_GRADIENTS = [
  'linear-gradient(145deg, #7d6b4a, #5e4b2f)',
  'linear-gradient(145deg, #567d5e, #3b5a43)',
  'linear-gradient(145deg, #9e6b4b, #784f32)',
  'linear-gradient(145deg, #4a6d8c, #2e4e6b)',
] as const;

/** Aisle width (mm-scale proxy): carriages to the right of the selected bay shift right together. */
const AISLE_SHIFT_PX = 130;

function aisleStatusLines(activeSlot: number): { lead: string; rest: string } {
  const L = SECTION_LETTERS[activeSlot];
  const toRight = SECTION_LETTERS.slice(activeSlot + 1);
  if (activeSlot >= RAIL_SLOTS - 1) {
    return {
      lead: `Aisle for bay ${L} · Safety bar deployed.`,
      rest:
        'This is the last bay on the rail: nothing sits to the right to shift. Carriages stay on the support rails; only one aisle is open at a time.',
    };
  }
  const range = toRight.length === 1 ? toRight[0] : `${toRight[0]}–${toRight[toRight.length - 1]}`;
  return {
    lead: `Aisle for bay ${L} · Safety bar deployed.`,
    rest: `Bays ${range} shift together toward the right. Bay A stays at the starting position on the rail. You do not “open aisle 1 to reach aisle 2”—you move the block so the gap sits where you need it (one aisle at a time).`,
  };
}

/** Bulk filer / high-density rail: selected bay stays; bays to its right translate +aisle to open access. */
function CompactMobileRail({
  railMotion,
  bookshelves,
  selectedShelfId,
  busyShelfId,
  onSelectCarriage,
  onOpenShelfForNotes,
  onRenameShelf,
  onDeleteShelf,
}: {
  railMotion: boolean;
  bookshelves: Bookshelf[];
  selectedShelfId: string | null;
  busyShelfId: string | null;
  onSelectCarriage: (index: number) => void;
  onOpenShelfForNotes: (shelfId: string) => void;
  onRenameShelf: (shelfId: string, title: string) => void;
  onDeleteShelf: (shelfId: string) => void;
}) {
  const selectedIdx = bookshelves.findIndex((s) => s.id === selectedShelfId);
  const activeSlot = selectedIdx >= 0 && selectedIdx < RAIL_SLOTS ? selectedIdx : null;
  const aisleCopy = activeSlot !== null ? aisleStatusLines(activeSlot) : null;

  const showAisleColumn = railMotion && activeSlot !== null;
  const selectedBayLetter = activeSlot !== null ? SECTION_LETTERS[activeSlot] : null;
  const aisleShelf =
    showAisleColumn && activeSlot !== null ? bookshelves[activeSlot] : undefined;

  return (
    <div className="mx-auto w-full max-w-[980px]">
      <div className="grid grid-cols-12 items-start gap-3">
        <div className={showAisleColumn ? 'col-span-10' : 'col-span-12'}>
          <div className="rounded-[48px] rounded-b-[28px] bg-[#cfdde6] px-4 py-6 shadow-[inset_0_0_0_2px_#eef3fc,0_12px_24px_rgba(0,0,0,0.1)] dark:bg-slate-800/90 dark:shadow-[inset_0_0_0_1px_var(--app-border)]">
        <div
          className="relative mx-auto h-[220px] w-full max-w-[900px] overflow-x-hidden overflow-y-visible rounded-3xl bg-[#b7c7d4] pr-2 shadow-[inset_0_4px_8px_rgba(0,0,0,0.1),0_6px_12px_rgba(0,0,0,0.1)] dark:bg-slate-700/90 sm:h-[260px] sm:pr-4"
          style={{ paddingRight: AISLE_SHIFT_PX + 8 }}
        >
          {Array.from({ length: RAIL_SLOTS }, (_, i) => {
            const shelf = bookshelves[i];
            const disabled = !shelf;
            const selected = Boolean(shelf && selectedShelfId === shelf.id);
            /** High-density rule: only carriages with index > selectedSlot shift right; bay A never leaves the start rail. */
            const shiftsRight = Boolean(
              railMotion && activeSlot !== null && i > activeSlot
            );
            return (
              <button
                key={i}
                type="button"
                disabled={disabled}
                onClick={() => shelf && onSelectCarriage(i)}
                className={cn(
                  'absolute top-0 z-10 flex h-full max-w-none flex-col items-center justify-center border border-black/20 px-2 text-center text-white shadow-[4px_0_12px_rgba(0,0,0,0.3),inset_-1px_0_0_rgba(255,255,255,0.2)] transition-[transform,box-shadow,filter] duration-[550ms]',
                  'rounded-r-lg rounded-l-2xl hover:brightness-105 hover:ring-2 hover:ring-[#ffd966] disabled:cursor-not-allowed disabled:opacity-40',
                  shiftsRight && 'z-20 translate-x-[130px]',
                  selected &&
                    'shadow-[0_0_0_3px_#f5b042,0_0_0_6px_rgba(245,176,66,0.3)] ring-0'
                )}
                style={{
                  left: `${i * (CARRIAGE_W + CARRIAGE_GAP)}px`,
                  width: CARRIAGE_W,
                  background: disabled ? '#4c5e6e' : CARRIAGE_GRADIENTS[i],
                  transitionTimingFunction: 'cubic-bezier(0.2, 0.9, 0.3, 1.1)',
                }}
                title={shelf?.title ?? 'Empty slot'}
              >
                <span className="pointer-events-none absolute bottom-3 right-3 text-lg opacity-70" aria-hidden>
                  ⚙️
                </span>
                <span className="font-mono text-2xl font-bold leading-none drop-shadow sm:text-3xl">
                  {SECTION_LETTERS[i]}
                </span>
                <span className="mt-2 line-clamp-3 max-w-[6.5rem] text-[10px] font-bold leading-snug sm:text-[11px]">
                  {shelf ? shelf.title : '—'}
                </span>
              </button>
            );
          })}

          <div
            className={cn(
              'absolute -bottom-2 left-0 z-[25] h-2.5 w-full origin-left rounded-2xl border border-[#a12218] shadow-[0_-2px_4px_rgba(0,0,0,0.4)] transition-transform duration-[450ms] ease-out',
              'bg-[repeating-linear-gradient(90deg,#dd3b2e_0,#dd3b2e_12px,#ff7e5e_12px,#ff7e5e_24px)]',
              railMotion ? 'scale-x-100' : 'scale-x-0'
            )}
            aria-hidden
          />
          <div
            className={cn(
              'pointer-events-none absolute -bottom-5 left-0 h-5 w-full rounded-xl bg-[repeating-linear-gradient(90deg,#e0aa3e_0,#e0aa3e_20px,#f7d98c_20px,#f7d98c_40px)] transition-opacity duration-300',
              railMotion ? 'opacity-80' : 'opacity-0'
            )}
            aria-hidden
          />
        </div>

        <p
          className={cn(
            'mx-auto mt-8 max-w-[900px] rounded-[28px] px-3 py-3 text-center text-xs font-medium leading-relaxed',
            railMotion
              ? 'bg-[#e3f0e8] text-[#1e4d3a] dark:bg-emerald-950/40 dark:text-emerald-100'
              : 'bg-[#fff2df] text-[#aa6f3c] dark:bg-amber-950/30 dark:text-amber-100'
          )}
        >
          {railMotion && aisleCopy ? (
            <>
              <span className="font-semibold text-[#143d2e] dark:text-emerald-100">
                {aisleCopy.lead}
              </span>{' '}
              {aisleCopy.rest}
            </>
          ) : (
            <>
              Select a bay (A–D). Bay A stays at the start rail; bays to the right shift together to
              open <span className="font-semibold">one</span> aisle for access. Safety bar extends
              when the aisle is active.
            </>
          )}
        </p>
      </div>
        </div>

        {aisleShelf && selectedBayLetter !== null ? (
          <div className="col-span-2 min-w-0">
            <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-3 text-center shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--app-muted)]">
                Aisle
              </p>
              <p className="mt-1 font-mono text-2xl font-bold text-[var(--app-fg)]">
                Bay {selectedBayLetter}
              </p>
              <p className="mt-2 line-clamp-4 text-left text-xs leading-snug text-[var(--app-fg)]">
                {aisleShelf.title}
              </p>
              <div className="mt-3 flex w-full flex-col gap-1.5 border-t border-[var(--app-border)] pt-3 text-left">
                <button
                  type="button"
                  onClick={() => onOpenShelfForNotes(aisleShelf.id)}
                  className="inline-flex items-center justify-center gap-1 rounded-md bg-brand-700 px-1.5 py-1.5 text-[10px] font-medium text-white hover:bg-brand-800"
                >
                  <BookOpen className="h-3 w-3 shrink-0" />
                  Open
                </button>
                <button
                  type="button"
                  disabled={busyShelfId === aisleShelf.id}
                  onClick={() => onRenameShelf(aisleShelf.id, aisleShelf.title)}
                  className="inline-flex items-center justify-center gap-1 rounded-md border border-[var(--app-border)] px-1.5 py-1.5 text-[10px] font-medium hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-[var(--app-surface)]"
                >
                  {busyShelfId === aisleShelf.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Pencil className="h-3 w-3" />
                  )}
                  Rename
                </button>
                <button
                  type="button"
                  disabled={busyShelfId === aisleShelf.id}
                  onClick={() => onDeleteShelf(aisleShelf.id)}
                  className="inline-flex items-center justify-center gap-1 rounded-md border border-red-200 px-1.5 py-1.5 text-[10px] font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Stable hash so spine “noise” does not change on re-render. */
function hashStringToInt(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function countMarkdownImagesInNotebook(nb: Notebook): number {
  let n = 0;
  for (const sec of nb.sections) {
    for (const p of sec.pages) {
      const c = p.content ?? '';
      const md = c.match(/!\[[^\]]*\]\([^)]+\)/g);
      if (md) n += md.length;
      n += (c.match(/<img\s[^>]*>/gi) ?? []).length;
    }
  }
  return n;
}

function notebookContentMetrics(nb: Notebook) {
  let chars = nb.title.length;
  let pages = 0;
  for (const sec of nb.sections) {
    chars += sec.title.length;
    for (const p of sec.pages) {
      pages += 1;
      chars += p.title.length + (p.content?.length ?? 0);
    }
  }
  const sections = nb.sections.length;
  const images = countMarkdownImagesInNotebook(nb);
  return { chars, pages, sections, images };
}

/**
 * Spine size from content: width tracks approximate “bulk” (text + structure + images),
 * height tracks page count and media (similar to shelf HTML prototype).
 * Values are deterministic for a given notebook.
 */
function spineSizeFromNotebook(nb: Notebook): { width: number; height: number } {
  const { chars, pages, sections, images } = notebookContentMetrics(nb);
  // ~MB proxy from stored text (no server file size — chars are a stand-in)
  const approxMB = Math.min(52, chars / 18000);
  // Prototype-style width: 12 + mb*0.6, plus spine thickness for sections & embedded images
  let w = 12 + approxMB * 0.62 + sections * 1.15 + images * 1.35;
  w = Math.min(72, Math.max(22, w));
  // Height: prototype uses 38 + pages*0.07 (short spines); we add growth for text volume & images
  const contentLift = Math.min(32, chars / 14000);
  let h =
    38 +
    pages * 0.07 +
    contentLift +
    Math.min(images * 2.4, 36) +
    sections * 0.35;
  h = Math.min(188, Math.max(46, h));
  // Small stable variation so near-identical stats still look distinct
  const jitter = hashStringToInt(nb.id);
  const wNudge = ((jitter % 11) - 5) * 0.45;
  const hNudge = (((jitter >> 5) % 11) - 5) * 0.5;
  w = Math.min(72, Math.max(22, w + wNudge));
  h = Math.min(188, Math.max(46, h + hNudge));
  return { width: Math.round(w), height: Math.round(h) };
}

/** Full-width book preview: cover + metadata (6) | chapters (6). */
function BookDetailView({
  notebook,
  shelfTitle,
  tab,
  pageCount,
  sectionCount,
  busyNotebookId,
  onClose,
  onOpenInNotes,
  onExportNotebook,
  onArchiveNotebook,
  onRestoreNotebook,
  onDeleteNotebookForever,
}: {
  notebook: Notebook;
  shelfTitle: string;
  tab: 'active' | 'archived';
  pageCount: (nb: Notebook) => number;
  sectionCount: (nb: Notebook) => number;
  busyNotebookId: string | null;
  onClose: () => void;
  onOpenInNotes: () => void;
  onExportNotebook: (nb: Notebook) => void;
  onArchiveNotebook: (id: string) => void;
  onRestoreNotebook: (nb: Notebook) => void;
  onDeleteNotebookForever: (id: string) => void;
}) {
  const idx =
    notebook.title.length % WOOD_BOOK_COLORS.length;
  const accent = WOOD_BOOK_COLORS[idx];
  const pages = pageCount(notebook);
  const sections = sectionCount(notebook);
  const busy = busyNotebookId === notebook.id;

  return (
    <div className="w-full max-w-6xl rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] p-4 shadow-xl md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-xs font-medium text-[var(--app-fg)] hover:bg-gray-50 dark:hover:bg-[var(--app-surface)]"
        >
          <X className="h-3.5 w-3.5" />
          Close preview
        </button>
        <button
          type="button"
          onClick={onOpenInNotes}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
        >
          <BookOpen className="h-4 w-4" />
          Open in Notes
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-12 md:gap-8">
        <div className="md:col-span-6">
          <div
            className="mx-auto flex aspect-[3/4] max-h-[min(420px,55vh)] w-full max-w-sm flex-col justify-between rounded-r-lg rounded-l-sm border-l-[6px] border-black/25 p-6 text-white shadow-2xl"
            style={{
              background: `linear-gradient(155deg, ${accent} 0%, ${accent}99 45%, #0f172a 100%)`,
            }}
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/70">
              Notebook
            </span>
            <div>
              <h2 className="text-balance text-2xl font-bold leading-tight drop-shadow-md">
                {notebook.title?.trim() || 'Untitled'}
              </h2>
              {shelfTitle ? (
                <p className="mt-2 text-sm text-white/85">Shelf · {shelfTitle}</p>
              ) : null}
            </div>
            <div className="rounded-md bg-black/25 px-3 py-2 text-xs backdrop-blur-sm">
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
                <dt className="text-white/65">Sections</dt>
                <dd className="font-semibold">{sections}</dd>
                <dt className="text-white/65">Pages</dt>
                <dd className="font-semibold">{pages}</dd>
                <dt className="text-white/65">Status</dt>
                <dd className="font-semibold">
                  {tab === 'archived' ? 'Archived' : 'Active'}
                </dd>
              </dl>
            </div>
          </div>

          <dl className="mt-4 space-y-2 text-sm text-[var(--app-fg)]">
            <div className="flex justify-between gap-4 border-b border-[var(--app-border)] py-2">
              <dt className="text-[var(--app-muted)]">Notebook</dt>
              <dd className="truncate font-medium">{notebook.title || 'Untitled'}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-[var(--app-border)] py-2">
              <dt className="text-[var(--app-muted)]">Shelf</dt>
              <dd className="truncate">{shelfTitle || '—'}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-[var(--app-border)] py-2">
              <dt className="text-[var(--app-muted)]">Structure</dt>
              <dd>
                {sections} sections · {pages} pages
              </dd>
            </div>
            <div className="flex flex-wrap items-center gap-1 border-b border-[var(--app-border)] py-2">
              <span className="sr-only">Notebook actions</span>
              {tab === 'active' ? (
                <>
                  <button
                    type="button"
                    title="Open in Notes"
                    onClick={onOpenInNotes}
                    className="rounded border border-[var(--app-border)] bg-[var(--app-surface)] p-1.5 text-[var(--app-fg)] shadow-sm hover:bg-gray-50 dark:hover:bg-[var(--app-bg)]"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Export Markdown"
                    onClick={() => onExportNotebook(notebook)}
                    className="rounded border border-[var(--app-border)] bg-[var(--app-surface)] p-1.5 text-[var(--app-fg)] shadow-sm hover:bg-gray-50 dark:hover:bg-[var(--app-bg)]"
                  >
                    <FileDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Archive"
                    disabled={busy}
                    onClick={() => onArchiveNotebook(notebook.id)}
                    className="rounded border border-[var(--app-border)] bg-[var(--app-surface)] p-1.5 text-[var(--app-fg)] shadow-sm hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-[var(--app-bg)]"
                  >
                    {busy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Archive className="h-3.5 w-3.5" />
                    )}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    title="Restore"
                    onClick={() => onRestoreNotebook(notebook)}
                    className="rounded border border-[var(--app-border)] bg-[var(--app-surface)] p-1.5 text-[var(--app-fg)] shadow-sm hover:bg-gray-50 dark:hover:bg-[var(--app-bg)]"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Delete forever"
                    disabled={busy}
                    onClick={() => onDeleteNotebookForever(notebook.id)}
                    className="rounded border border-[var(--app-border)] bg-[var(--app-surface)] p-1.5 text-[var(--app-fg)] shadow-sm hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-[var(--app-bg)]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          </dl>
        </div>

        <div className="md:col-span-6">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--app-fg)]">
            <List className="h-4 w-4 text-brand-600 dark:text-brand-400" />
            Chapters
          </div>
          <div className="max-h-[min(55vh,480px)] space-y-4 overflow-y-auto pr-1">
            {notebook.sections.length === 0 ? (
              <p className="text-sm text-[var(--app-muted)]">No sections yet.</p>
            ) : (
              notebook.sections.map((sec) => (
                <div
                  key={sec.id}
                  className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-3"
                >
                  <h4 className="font-medium text-[var(--app-fg)]">{sec.title || 'Untitled section'}</h4>
                  {sec.pages.length === 0 ? (
                    <p className="mt-1 text-xs text-[var(--app-muted)]">No pages</p>
                  ) : (
                    <ul className="mt-2 space-y-1.5 border-t border-[var(--app-border)] pt-2">
                      {sec.pages.map((p) => (
                        <li
                          key={p.id}
                          className="flex items-start gap-2 text-sm text-[var(--app-muted)]"
                        >
                          <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" />
                          <span className="text-[var(--app-fg)]">{p.title?.trim() || 'Untitled page'}</span>
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

/** Wooden shelf frame with book spines (title on spine; preview opens detail with actions). */
function WoodBookshelfVisualization({
  shelfTitle,
  notebooks,
  tab,
  pageCount,
  sectionCount,
  previewBookId,
  onSpineClick,
}: {
  shelfTitle: string;
  notebooks: Notebook[];
  tab: 'active' | 'archived';
  pageCount: (nb: Notebook) => number;
  sectionCount: (nb: Notebook) => number;
  previewBookId: string | null;
  onSpineClick: (nb: Notebook) => void;
}) {
  const rows = chunkIntoRows(notebooks, BOOKS_PER_ROW);

  return (
    <div className="mx-auto mt-2 w-full max-w-[min(100%,1800px)] overflow-hidden">
      <p className="mb-4 text-center text-lg font-bold text-slate-800 dark:text-[var(--app-fg)]">
        {shelfTitle ? shelfTitle : 'Bookshelf'}
      </p>
      <div
        className="relative overflow-hidden border-[12px] border-[#8b5a2b] bg-[#d2a679] px-3 py-6 shadow-[inset_0_0_10px_rgba(0,0,0,0.25)] dark:border-amber-950 dark:bg-[#4a3424] dark:shadow-[inset_0_0_14px_rgba(0,0,0,0.45)]"
      >
        <span
          className="pointer-events-none absolute inset-y-0 -left-[12px] w-3 bg-[#6e4621] dark:bg-amber-950"
          aria-hidden
        />
        <span
          className="pointer-events-none absolute inset-y-0 -right-[12px] w-3 bg-[#6e4621] dark:bg-amber-950"
          aria-hidden
        />
        {notebooks.length === 0 ? (
          <p className="py-20 text-center text-base text-[#5c3d28] dark:text-[var(--app-muted)]">
            No notebooks on this shelf yet.
          </p>
        ) : (
          <div className="space-y-4">
            {rows.map((row, ri) => (
                <div
                  key={ri}
                  className="relative flex min-h-[9rem] flex-nowrap content-end items-end justify-start gap-x-2 overflow-x-auto border-b-[6px] border-[#8b5a2b] pb-4 pt-2 dark:border-amber-950 after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-2 after:h-2 after:bg-black/15"
                >
                  {row.map((nb, bi) => {
                    const pages = pageCount(nb);
                    const sections = sectionCount(nb);
                    const { width, height } = spineSizeFromNotebook(nb);
                    const w = width * SHELF_VISUAL_SCALE;
                    const h = height * SHELF_VISUAL_SCALE;
                    const bg =
                      WOOD_BOOK_COLORS[
                        (ri * BOOKS_PER_ROW + bi + nb.title.length) % WOOD_BOOK_COLORS.length
                      ];
                    const muted = tab === 'archived';
                    const title = nb.title?.trim() || 'Untitled';
                    return (
                      <div
                        key={nb.id}
                        className="flex flex-col items-center gap-2"
                      >
                        <button
                          type="button"
                          title={`${title} · ${pages} pages · ${sections} sections — click for preview`}
                          onClick={() => onSpineClick(nb)}
                          className={cn(
                            'relative flex shrink-0 flex-col items-center justify-between overflow-hidden rounded-md border border-black/25 px-1 py-2 shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                            muted && 'opacity-65 saturate-75',
                            previewBookId === nb.id && 'ring-2 ring-amber-300 ring-offset-2'
                          )}
                          style={{
                            width: `${w}px`,
                            height: `${h}px`,
                            backgroundColor: bg,
                          }}
                        >
                          <span
                            className="max-h-[calc(100%-8px)] flex-1 overflow-hidden px-1 text-center text-[13px] font-semibold leading-snug tracking-wide text-white drop-shadow-sm sm:text-[14px]"
                            style={{
                              writingMode: 'vertical-rl',
                              textOrientation: 'mixed',
                            }}
                          >
                            {title.length > 56 ? `${title.slice(0, 54)}…` : title}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
            ))}
          </div>
        )}
      </div>
    </div>
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
  const { confirm, promptText } = useAppDialogs();
  const [newShelfName, setNewShelfName] = useState('');
  const [tab, setTab] = useState<'active' | 'archived'>('active');
  const [manageShelfId, setManageShelfId] = useState<string | null>(null);
  const [activeList, setActiveList] = useState<Notebook[]>([]);
  const [archivedList, setArchivedList] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  /** True after clicking a carriage — drives rail translate + red safety strip (HTML prototype). */
  const [railMotion, setRailMotion] = useState(false);
  const [previewBook, setPreviewBook] = useState<Notebook | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPreviewBook(null);
  }, [manageShelfId, tab]);

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
    const name = await promptText({
      title: 'Rename bookshelf',
      label: 'Shelf name',
      defaultValue: currentTitle,
      placeholder: 'Bookshelf title',
      confirmLabel: 'Save',
    });
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
    const shelf = bookshelves.find((b) => b.id === id);
    const ok = await confirm({
      title: 'Delete bookshelf?',
      message: `“${shelf?.title?.trim() || 'Bookshelf'}” will be removed. It must be empty (no notebooks). This cannot be undone.`,
      confirmLabel: 'Delete bookshelf',
      variant: 'danger',
    });
    if (!ok) return;
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
    const nb = [...activeList, ...archivedList].find((n) => n.id === id);
    const ok = await confirm({
      title: 'Archive notebook?',
      message: `“${nb?.title?.trim() || 'Notebook'}” will move to Archived. You can restore it from the Archived tab.`,
      confirmLabel: 'Archive',
      variant: 'default',
    });
    if (!ok) return;
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
    const nb = archivedList.find((n) => n.id === id);
    const ok = await confirm({
      title: 'Delete notebook forever?',
      message: `“${nb?.title?.trim() || 'Notebook'}” and all its sections and pages will be permanently removed. This cannot be undone.`,
      confirmLabel: 'Delete forever',
      variant: 'danger',
    });
    if (!ok) return;
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

  const handleSpineClick = (nb: Notebook) => {
    setPreviewBook(nb);
  };

  const closeBookPreview = () => {
    setPreviewBook(null);
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
            Add units, then use the carriage rail to pick a shelf (first four appear on the rail).
            After you open a bay, use Open, Rename, or Delete in the aisle panel beside the rail.
          </p>
          <div className="flex flex-wrap gap-2 mb-6">
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
          {bookshelves.length > 0 && (
            <CompactMobileRail
              railMotion={railMotion}
              bookshelves={bookshelves}
              selectedShelfId={manageShelfId}
              busyShelfId={busy}
              onSelectCarriage={(i) => {
                const s = bookshelves[i];
                if (!s) return;
                setManageShelfId(s.id);
                setRailMotion(true);
              }}
              onOpenShelfForNotes={onOpenShelfForNotes}
              onRenameShelf={renameShelf}
              onDeleteShelf={deleteShelf}
            />
          )}
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
                Active bay · notebooks on shelf
              </h2>
              <p className="mt-0.5 font-mono text-[9px] uppercase tracking-widest text-slate-500 dark:text-[var(--app-muted)]">
                Up to 12 books per row (row 1 fills, then row 2…); spine size follows sections & pages
              </p>
            </div>
            {bookshelves.length > 0 && (
              <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-[var(--app-muted)]">
                <span>Shelf:</span>
                <select
                  value={manageShelfId ?? ''}
                  onChange={(e) => {
                    setManageShelfId(e.target.value || null);
                    setRailMotion(false);
                  }}
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
          ) : (
            <div className="mx-auto max-w-6xl space-y-6">
              {list.length === 0 && (
                <p className="text-center text-sm text-gray-500 dark:text-[var(--app-muted)]">
                  {tab === 'active'
                    ? 'No notebooks in this shelf yet. Create one from the sidebar in Notes.'
                    : 'No archived notebooks in this shelf.'}
                </p>
              )}
              <p className="text-center font-mono text-[10px] uppercase tracking-[0.2em] text-slate-600 dark:text-[var(--app-muted)]">
                {list.length > 0
                  ? 'Click a spine for cover & chapters · export & archive under Structure in the preview'
                  : 'Choose a shelf from the rail above or the menu here'}
              </p>

              <div className="overflow-hidden">
                {manageShelfId && (
                  <>
                    <WoodBookshelfVisualization
                      shelfTitle={
                        bookshelves.find((b) => b.id === manageShelfId)?.title?.slice(0, 48) || ''
                      }
                      notebooks={list}
                      tab={tab}
                      pageCount={pageCount}
                      sectionCount={sectionCount}
                      previewBookId={previewBook?.id ?? null}
                      onSpineClick={handleSpineClick}
                    />
                    {previewBook && (
                      <div className="mt-6 w-full">
                        <BookDetailView
                          notebook={previewBook}
                          shelfTitle={
                            bookshelves.find((b) => b.id === manageShelfId)?.title?.slice(0, 80) || ''
                          }
                          tab={tab}
                          pageCount={pageCount}
                          sectionCount={sectionCount}
                          busyNotebookId={busy}
                          onClose={closeBookPreview}
                          onOpenInNotes={() => {
                            openAndFocus(previewBook);
                            closeBookPreview();
                          }}
                          onExportNotebook={exportNb}
                          onArchiveNotebook={archive}
                          onRestoreNotebook={restoreAndOpen}
                          onDeleteNotebookForever={removeForever}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
