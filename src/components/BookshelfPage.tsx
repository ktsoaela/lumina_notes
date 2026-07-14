import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Archive,
  BookMarked,
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
  DoorOpen,
  FolderOpen,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../lib/api';
import type { Bookshelf, Notebook } from '../types';
import { notebookToMarkdown, downloadText, parseImportedMarkdown } from '../lib/markdownIO';
import { sanitizeFilename } from '../lib/filename';
import { cn } from '../lib/utils';
import { useAppDialogs } from '../context/AppDialogsContext';
import {
  AISLE_SHIFT_PX,
  BOOKS_PER_ROW,
  CARRIAGE_GAP,
  CARRIAGE_W,
  CHARTS_PER_CABINET_PAGE,
  RAIL_VISIBLE_BAYS,
  SHELF_VISUAL_SCALE,
  bayCode,
  chunkIntoRows,
  densityHint,
  pageWindow,
  railPageForIndex,
  spineSizeFromNotebook,
} from '../lib/shelfLayout';

const CHART_SPINE_COLORS = [
  '#0e7490',
  '#b45309',
  '#047857',
  '#be123c',
  '#4338ca',
  '#0369a1',
  '#a16207',
  '#6d28d9',
] as const;

/** Hospital mobile shelving rail — carriages shift to open one aisle. */
function CompactMobileRail({
  railMotion,
  bookshelves,
  globalOffset,
  totalBays,
  railPage,
  railPageCount,
  selectedShelfId,
  onSelectCarriage,
  onRailPageChange,
}: {
  railMotion: boolean;
  bookshelves: Bookshelf[];
  /** Absolute index of first bay in this window. */
  globalOffset: number;
  totalBays: number;
  railPage: number;
  railPageCount: number;
  selectedShelfId: string | null;
  onSelectCarriage: (globalIndex: number) => void;
  onRailPageChange: (page: number) => void;
}) {
  const selectedIdx = bookshelves.findIndex((s) => s.id === selectedShelfId);
  const activeLocal =
    selectedIdx >= 0
      ? selectedIdx
      : null;
  const trackWidth = Math.max(
    bookshelves.length * (CARRIAGE_W + CARRIAGE_GAP) + AISLE_SHIFT_PX + 48,
    640
  );

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-400/40 bg-gradient-to-b from-slate-300 via-slate-400 to-slate-500 p-1 shadow-[0_24px_60px_-20px_rgba(15,23,42,0.55)] dark:border-slate-600 dark:from-slate-700 dark:via-slate-800 dark:to-slate-900">
      <div className="rounded-[1.35rem] bg-[linear-gradient(180deg,#94a3b8_0%,#64748b_18%,#475569_100%)] p-4 dark:bg-[linear-gradient(180deg,#334155_0%,#1e293b_100%)]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'h-2.5 w-2.5 rounded-full shadow-[0_0_12px_currentColor]',
                railMotion ? 'bg-emerald-400 text-emerald-400' : 'bg-amber-400 text-amber-400'
              )}
              aria-hidden
            />
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-slate-100/90">
              {railMotion && activeLocal !== null
                ? `Aisle open · Bay ${bayCode(globalOffset + activeLocal)}`
                : 'Select a carriage to deploy aisle'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-[10px] text-slate-200/70">
              Bays {globalOffset + 1}–
              {Math.min(globalOffset + bookshelves.length, totalBays)} of {totalBays}
            </p>
            {railPageCount > 1 ? (
              <div className="inline-flex items-center gap-1">
                <button
                  type="button"
                  disabled={railPage <= 0}
                  onClick={() => onRailPageChange(railPage - 1)}
                  className="rounded-md border border-slate-200/40 bg-slate-900/20 px-2 py-0.5 font-mono text-[10px] text-white disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="font-mono text-[10px] text-slate-100/80">
                  {railPage + 1}/{railPageCount}
                </span>
                <button
                  type="button"
                  disabled={railPage >= railPageCount - 1}
                  onClick={() => onRailPageChange(railPage + 1)}
                  className="rounded-md border border-slate-200/40 bg-slate-900/20 px-2 py-0.5 font-mono text-[10px] text-white disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:thin]">
          <div
            className="relative mx-auto h-[240px] rounded-2xl bg-[radial-gradient(ellipse_at_top,#cbd5e1_0%,#94a3b8_45%,#64748b_100%)] shadow-[inset_0_8px_24px_rgba(15,23,42,0.35)] dark:bg-[radial-gradient(ellipse_at_top,#475569_0%,#1e293b_70%)] sm:h-[280px]"
            style={{ width: trackWidth, minWidth: '100%' }}
          >
            <div
              className="pointer-events-none absolute inset-x-4 bottom-10 h-1.5 rounded-full bg-slate-700/50 shadow-[0_1px_0_rgba(255,255,255,0.2)]"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-x-4 bottom-6 h-1 rounded-full bg-slate-800/40"
              aria-hidden
            />

            {bookshelves.map((shelf, i) => {
              const globalIndex = globalOffset + i;
              const selected = selectedShelfId === shelf.id;
              const shiftsRight = Boolean(
                railMotion && activeLocal !== null && i > activeLocal
              );
              return (
                <button
                  key={shelf.id}
                  type="button"
                  onClick={() => onSelectCarriage(globalIndex)}
                  className={cn(
                    'group absolute top-3 z-10 flex h-[calc(100%-3.25rem)] flex-col overflow-hidden rounded-t-lg border border-slate-900/40 text-left shadow-[6px_0_18px_rgba(15,23,42,0.35),inset_0_1px_0_rgba(255,255,255,0.25)] transition-[transform,box-shadow,filter] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]',
                    'bg-[linear-gradient(135deg,#e2e8f0_0%,#94a3b8_42%,#64748b_100%)] hover:brightness-105',
                    'dark:bg-[linear-gradient(135deg,#64748b_0%,#334155_55%,#1e293b_100%)]',
                    shiftsRight && 'z-20',
                    selected &&
                      'ring-2 ring-cyan-300 ring-offset-2 ring-offset-slate-500/40'
                  )}
                  style={{
                    left: `${24 + i * (CARRIAGE_W + CARRIAGE_GAP)}px`,
                    width: CARRIAGE_W,
                    transform: shiftsRight
                      ? `translateX(${AISLE_SHIFT_PX}px)`
                      : 'translateX(0)',
                  }}
                  title={`${bayCode(globalIndex)} · ${shelf.title}`}
                >
                  <span
                    className="absolute inset-y-3 left-1 w-1.5 rounded-full bg-slate-500/80 shadow-inner"
                    aria-hidden
                  />
                  <span
                    className="absolute right-2 top-3 h-2 w-2 rounded-full bg-slate-600/70"
                    aria-hidden
                  />
                  <span
                    className="absolute bottom-8 right-2 h-2 w-2 rounded-full bg-slate-600/70"
                    aria-hidden
                  />

                  <div className="flex flex-1 flex-col items-center justify-center px-3 pt-4 text-center">
                    <span className="font-mono text-[11px] font-semibold tracking-[0.2em] text-slate-700 dark:text-slate-200">
                      {bayCode(globalIndex)}
                    </span>
                    <span className="mt-2 line-clamp-3 text-[11px] font-bold leading-snug text-slate-900 dark:text-slate-50">
                      {shelf.title}
                    </span>
                  </div>

                  <div className="border-t border-slate-900/20 bg-slate-900/10 px-2 py-2 text-center dark:bg-black/20">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      {selected && railMotion ? 'Access' : 'Locked'}
                    </span>
                  </div>
                </button>
              );
            })}

            <div
              className={cn(
                'absolute bottom-3 left-4 z-30 h-2 origin-left rounded-full border border-rose-900/50 transition-transform duration-500 ease-out',
                'bg-[repeating-linear-gradient(90deg,#e11d48_0,#e11d48_10px,#fda4af_10px,#fda4af_20px)] shadow-[0_0_16px_rgba(225,29,72,0.45)]',
                railMotion ? 'scale-x-100' : 'scale-x-0'
              )}
              style={{ width: Math.min(trackWidth - 48, 520) }}
              aria-hidden
            />
          </div>
        </div>

        <p className="mt-3 text-center text-xs leading-relaxed text-slate-100/85">
          {railMotion && activeLocal !== null ? (
            <>
              Safety bar deployed. Units to the right of{' '}
              <span className="font-semibold text-cyan-100">
                {bayCode(globalOffset + activeLocal)}
              </span>{' '}
              on this rail page shift as one block.
            </>
          ) : (
            <>
              Rail shows {RAIL_VISIBLE_BAYS} bays at a time (paginated). Click a carriage to open
              one aisle — classic medical kompakt access.
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function BookDetailView({
  notebook,
  shelfTitle,
  bayLabel,
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
  bayLabel: string;
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
  const accent =
    CHART_SPINE_COLORS[notebook.title.length % CHART_SPINE_COLORS.length];
  const pages = pageCount(notebook);
  const sections = sectionCount(notebook);
  const busy = busyNotebookId === notebook.id;

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.45)] backdrop-blur-md dark:border-[var(--app-border)] dark:bg-[var(--app-surface)]/95">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-[var(--app-border)] dark:bg-[var(--app-bg)]/60">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-[var(--app-border)] dark:bg-[var(--app-surface)] dark:text-[var(--app-fg)] dark:hover:bg-[var(--app-bg)]"
          >
            <X className="h-3.5 w-3.5" />
            Close chart
          </button>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500 dark:text-[var(--app-muted)]">
            {bayLabel} · chart preview
          </span>
        </div>
        <button
          type="button"
          onClick={onOpenInNotes}
          className="inline-flex items-center gap-2 rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-cyan-800"
        >
          <BookOpen className="h-4 w-4" />
          Open in Notes
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 p-5 md:grid-cols-12 md:gap-8 md:p-6">
        <div className="md:col-span-5">
          <div
            className="mx-auto flex aspect-[3/4] max-h-[min(400px,52vh)] w-full max-w-sm flex-col justify-between rounded-r-xl rounded-l-md border-l-[7px] border-black/30 p-6 text-white shadow-2xl"
            style={{
              background: `linear-gradient(155deg, ${accent} 0%, ${accent}cc 48%, #0f172a 100%)`,
            }}
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/70">
              Medical chart binder
            </span>
            <div>
              <h2 className="text-balance text-2xl font-bold leading-tight drop-shadow-md">
                {notebook.title?.trim() || 'Untitled'}
              </h2>
              <p className="mt-2 text-sm text-white/85">
                {bayLabel} · {shelfTitle || 'Unit'}
              </p>
            </div>
            <div className="rounded-lg bg-black/25 px-3 py-2 text-xs backdrop-blur-sm">
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

          <div className="mt-4 flex flex-wrap gap-2">
            {tab === 'active' ? (
              <>
                <button
                  type="button"
                  onClick={onOpenInNotes}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 dark:border-[var(--app-border)] dark:bg-[var(--app-bg)] dark:text-[var(--app-fg)]"
                >
                  <BookOpen className="h-3.5 w-3.5" /> Open
                </button>
                <button
                  type="button"
                  onClick={() => onExportNotebook(notebook)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 dark:border-[var(--app-border)] dark:bg-[var(--app-bg)] dark:text-[var(--app-fg)]"
                >
                  <FileDown className="h-3.5 w-3.5" /> Export
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onArchiveNotebook(notebook.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-[var(--app-border)] dark:bg-[var(--app-bg)] dark:text-[var(--app-fg)]"
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
                  onClick={() => onRestoreNotebook(notebook)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 dark:border-[var(--app-border)] dark:bg-[var(--app-bg)] dark:text-[var(--app-fg)]"
                >
                  <BookOpen className="h-3.5 w-3.5" /> Restore
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onDeleteNotebookForever(notebook.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete forever
                </button>
              </>
            )}
          </div>
        </div>

        <div className="md:col-span-7">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-[var(--app-fg)]">
            <List className="h-4 w-4 text-cyan-700 dark:text-cyan-400" />
            Chart contents
          </div>
          <div className="max-h-[min(55vh,480px)] space-y-3 overflow-y-auto pr-1">
            {notebook.sections.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-[var(--app-muted)]">
                No sections yet.
              </p>
            ) : (
              notebook.sections.map((sec) => (
                <div
                  key={sec.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-[var(--app-border)] dark:bg-[var(--app-bg)]"
                >
                  <h4 className="font-medium text-slate-900 dark:text-[var(--app-fg)]">
                    {sec.title || 'Untitled section'}
                  </h4>
                  {sec.pages.length === 0 ? (
                    <p className="mt-1 text-xs text-slate-500 dark:text-[var(--app-muted)]">
                      No pages
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-1.5 border-t border-slate-200/80 pt-2 dark:border-[var(--app-border)]">
                      {sec.pages.map((p) => (
                        <li
                          key={p.id}
                          className="flex items-start gap-2 text-sm text-slate-600 dark:text-[var(--app-muted)]"
                        >
                          <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" />
                          <span className="text-slate-800 dark:text-[var(--app-fg)]">
                            {p.title?.trim() || 'Untitled page'}
                          </span>
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

function ChartCabinetVisualization({
  shelfTitle,
  bayLabel,
  notebooks,
  totalCharts,
  cabinetPage,
  cabinetPageCount,
  onCabinetPageChange,
  tab,
  pageCount,
  sectionCount,
  previewBookId,
  onSpineClick,
}: {
  shelfTitle: string;
  bayLabel: string;
  notebooks: Notebook[];
  totalCharts: number;
  cabinetPage: number;
  cabinetPageCount: number;
  onCabinetPageChange: (page: number) => void;
  tab: 'active' | 'archived';
  pageCount: (nb: Notebook) => number;
  sectionCount: (nb: Notebook) => number;
  previewBookId: string | null;
  onSpineClick: (nb: Notebook) => void;
}) {
  const rows = chunkIntoRows(notebooks, BOOKS_PER_ROW);
  const hint = densityHint(totalCharts);
  const rangeStart =
    totalCharts === 0 ? 0 : cabinetPage * CHARTS_PER_CABINET_PAGE + 1;
  const rangeEnd = Math.min(
    totalCharts,
    (cabinetPage + 1) * CHARTS_PER_CABINET_PAGE
  );

  return (
    <div className="mx-auto w-full max-w-[min(100%,1800px)]">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-cyan-800/80 dark:text-cyan-300/80">
            Open bay {bayLabel}
          </p>
          <h3 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-[var(--app-fg)]">
            {shelfTitle || 'Storage unit'}
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-[var(--app-muted)]">
          <span>
            {totalCharts === 0
              ? '0 charts'
              : `Charts ${rangeStart}–${rangeEnd} of ${totalCharts} · ${BOOKS_PER_ROW}/row`}
          </span>
          {cabinetPageCount > 1 ? (
            <div className="inline-flex items-center gap-1">
              <button
                type="button"
                disabled={cabinetPage <= 0}
                onClick={() => onCabinetPageChange(cabinetPage - 1)}
                className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono text-[10px] disabled:opacity-40 dark:border-[var(--app-border)] dark:bg-[var(--app-bg)]"
              >
                Prev
              </button>
              <span className="font-mono text-[10px]">
                {cabinetPage + 1}/{cabinetPageCount}
              </span>
              <button
                type="button"
                disabled={cabinetPage >= cabinetPageCount - 1}
                onClick={() => onCabinetPageChange(cabinetPage + 1)}
                className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono text-[10px] disabled:opacity-40 dark:border-[var(--app-border)] dark:bg-[var(--app-bg)]"
              >
                Next
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {hint ? (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          {hint}
        </p>
      ) : null}

      <div className="relative overflow-hidden rounded-2xl border border-slate-500/30 bg-[linear-gradient(180deg,#cbd5e1_0%,#94a3b8_12%,#64748b_100%)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_18px_40px_-20px_rgba(15,23,42,0.5)] dark:border-slate-600 dark:bg-[linear-gradient(180deg,#475569_0%,#1e293b_100%)]">
        <div className="rounded-xl bg-[linear-gradient(180deg,#e2e8f0_0%,#cbd5e1_100%)] px-3 py-5 shadow-[inset_0_6px_18px_rgba(15,23,42,0.12)] dark:bg-[linear-gradient(180deg,#334155_0%,#1e293b_100%)]">
          {notebooks.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <FolderOpen className="h-10 w-10 text-slate-500/70" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                This bay is empty
              </p>
              <p className="max-w-sm text-xs text-slate-500 dark:text-slate-400">
                Create a chart binder or import Markdown to stock this unit.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {rows.map((row, ri) => (
                <div
                  key={ri}
                  className="relative flex min-h-[9rem] flex-nowrap content-end items-end justify-start gap-x-2 overflow-x-auto border-b-[5px] border-slate-500/70 pb-4 pt-2 dark:border-slate-600 after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-1.5 after:h-1.5 after:bg-black/15"
                >
                  {row.map((nb, bi) => {
                    const pages = pageCount(nb);
                    const sections = sectionCount(nb);
                    const { width, height } = spineSizeFromNotebook(nb);
                    const w = width * SHELF_VISUAL_SCALE;
                    const h = height * SHELF_VISUAL_SCALE;
                    const bg =
                      CHART_SPINE_COLORS[
                        (ri * BOOKS_PER_ROW + bi + nb.title.length) %
                          CHART_SPINE_COLORS.length
                      ];
                    const title = nb.title?.trim() || 'Untitled';
                    return (
                      <button
                        key={nb.id}
                        type="button"
                        title={`${title} · ${pages} pages · ${sections} sections`}
                        onClick={() => onSpineClick(nb)}
                        className={cn(
                          'relative flex shrink-0 flex-col items-center justify-between overflow-hidden rounded-md border border-black/25 px-1 py-2 shadow-md transition-transform hover:-translate-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400',
                          tab === 'archived' && 'opacity-65 saturate-75',
                          previewBookId === nb.id &&
                            'ring-2 ring-cyan-300 ring-offset-2 ring-offset-slate-300'
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
                    );
                  })}
                </div>
              ))}
            </div>
          )}
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
  const [railMotion, setRailMotion] = useState(false);
  const [previewBook, setPreviewBook] = useState<Notebook | null>(null);
  const [railPage, setRailPage] = useState(0);
  const [cabinetPage, setCabinetPage] = useState(0);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPreviewBook(null);
    setCabinetPage(0);
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

  const selectedIndex = useMemo(
    () => bookshelves.findIndex((b) => b.id === manageShelfId),
    [bookshelves, manageShelfId]
  );
  const selectedShelf = selectedIndex >= 0 ? bookshelves[selectedIndex] : null;
  const selectedBay = selectedIndex >= 0 ? bayCode(selectedIndex) : '—';

  const railWin = useMemo(
    () => pageWindow(bookshelves.length, RAIL_VISIBLE_BAYS, railPage),
    [bookshelves.length, railPage]
  );
  const railWindowShelves = useMemo(
    () => railWin.slice(bookshelves),
    [railWin, bookshelves]
  );

  useEffect(() => {
    if (selectedIndex >= 0) {
      setRailPage(railPageForIndex(selectedIndex));
    }
  }, [selectedIndex]);

  const list = tab === 'active' ? activeList : archivedList;
  const cabinetWin = useMemo(
    () => pageWindow(list.length, CHARTS_PER_CABINET_PAGE, cabinetPage),
    [list.length, cabinetPage]
  );
  const visibleCharts = useMemo(
    () => cabinetWin.slice(list),
    [cabinetWin, list]
  );

  const createShelf = async () => {
    const name = newShelfName.trim() || 'New storage unit';
    const id = `bs-${Date.now()}`;
    setBusy('new-shelf');
    try {
      await api.bookshelves.create(id, name);
      setNewShelfName('');
      await onRefreshBookshelves();
      setManageShelfId(id);
      setRailMotion(true);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(null);
    }
  };

  const renameShelf = async (id: string, currentTitle: string) => {
    const name = await promptText({
      title: 'Rename storage unit',
      label: 'Unit name',
      defaultValue: currentTitle,
      placeholder: 'e.g. Ward 3 · Outpatients',
      confirmLabel: 'Save',
    });
    if (name === null) return;
    const trimmed = name.trim() || 'Untitled unit';
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
      title: 'Decommission storage unit?',
      message: `“${shelf?.title?.trim() || 'Unit'}” will be removed. It must be empty (no chart binders). This cannot be undone.`,
      confirmLabel: 'Delete unit',
      variant: 'danger',
    });
    if (!ok) return;
    setBusy(id);
    try {
      await api.bookshelves.delete(id);
      setRailMotion(false);
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

  const createNotebook = async () => {
    if (!manageShelfId) return;
    const name = await promptText({
      title: 'New chart binder',
      label: 'Notebook title',
      placeholder: 'e.g. Intake notes',
      confirmLabel: 'Create',
    });
    if (name === null) return;
    const title = name.trim() || 'Untitled chart';
    setBusy('new-notebook');
    try {
      const nbId = `nb-${Date.now()}`;
      const secId = `sec-${Date.now()}`;
      const pageId = `page-${Date.now()}`;
      await api.notebooks.create(nbId, title.slice(0, 80), manageShelfId);
      await api.sections.create(secId, nbId, 'Notes');
      await api.pages.create(pageId, secId, 'Untitled page', '');
      await loadNotebooks();
      onLibraryChanged();
      setTab('active');
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(null);
    }
  };

  const sectionCount = (nb: Notebook) => nb.sections.length;
  const pageCount = (nb: Notebook) =>
    nb.sections.reduce((n, s) => n + s.pages.length, 0);

  const archive = async (id: string) => {
    const nb = [...activeList, ...archivedList].find((n) => n.id === id);
    const ok = await confirm({
      title: 'Archive chart binder?',
      message: `“${nb?.title?.trim() || 'Notebook'}” will move to Archived. You can restore it later.`,
      confirmLabel: 'Archive',
      variant: 'default',
    });
    if (!ok) return;
    setBusy(id);
    try {
      await api.notebooks.setArchive(id, true);
      await loadNotebooks();
      onLibraryChanged();
      setPreviewBook(null);
    } finally {
      setBusy(null);
    }
  };

  const removeForever = async (id: string) => {
    const nb = archivedList.find((n) => n.id === id);
    const ok = await confirm({
      title: 'Delete chart forever?',
      message: `“${nb?.title?.trim() || 'Notebook'}” and all sections/pages will be permanently removed.`,
      confirmLabel: 'Delete forever',
      variant: 'danger',
    });
    if (!ok) return;
    setBusy(id);
    try {
      await api.notebooks.delete(id);
      await loadNotebooks();
      onLibraryChanged();
      setPreviewBook(null);
    } finally {
      setBusy(null);
    }
  };

  const exportNb = (nb: Notebook) => {
    downloadText(
      `${sanitizeFilename(nb.title || 'notebook')}.md`,
      notebookToMarkdown(nb)
    );
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
        f.name.replace(/\.md$/i, '').replace(/[^\w\s-]+/g, '').trim() || 'Imported';
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
    <div className="flex h-full min-h-0 flex-col bg-[radial-gradient(ellipse_at_top,#e8eef5_0%,#f8fafc_42%,#eef2f7_100%)] text-slate-900 dark:bg-[radial-gradient(ellipse_at_top,#132238_0%,#0a1628_55%,#07101c_100%)] dark:text-[var(--app-fg)]">
      <header className="shrink-0 border-b border-slate-200/80 bg-white/80 px-5 py-4 backdrop-blur-xl dark:border-[var(--app-border)] dark:bg-[var(--app-surface)]/80">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-2 text-sm font-medium text-cyan-800 hover:underline dark:text-cyan-300"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to notes
            </button>
            <div className="h-8 w-px bg-slate-200 dark:bg-[var(--app-border)]" />
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-800/70 dark:text-cyan-300/70">
                Records vault
              </p>
              <h1 className="text-lg font-semibold tracking-tight">
                High-density storage units
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-600 dark:border-[var(--app-border)] dark:bg-[var(--app-bg)] dark:text-[var(--app-muted)]">
            <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
            One aisle open at a time
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-7xl space-y-8 p-5 sm:p-6">
          {/* Unit CRUD + rail */}
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-[var(--app-border)] dark:bg-[var(--app-surface)]/90">
                <div className="mb-4 flex items-center gap-2">
                  <BookMarked className="h-4 w-4 text-cyan-700 dark:text-cyan-400" />
                  <h2 className="text-sm font-semibold">Unit registry</h2>
                </div>
                <p className="mb-4 text-xs leading-relaxed text-slate-500 dark:text-[var(--app-muted)]">
                  Create and manage physical-style storage carriages. Select a bay on the rail to
                  open the aisle and work charts inside.
                </p>

                <form
                  className="mb-4 flex flex-col gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void createShelf();
                  }}
                >
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-[var(--app-muted)]">
                    Commission new unit
                  </label>
                  <input
                    type="text"
                    value={newShelfName}
                    onChange={(e) => setNewShelfName(e.target.value)}
                    placeholder="e.g. Ward 4 · Clinic A"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 dark:border-[var(--app-border)] dark:bg-[var(--app-bg)] dark:text-[var(--app-fg)]"
                  />
                  <button
                    type="submit"
                    disabled={busy === 'new-shelf'}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-800 disabled:opacity-50"
                  >
                    {busy === 'new-shelf' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Add storage unit
                  </button>
                </form>

                <ul className="max-h-[280px] space-y-1.5 overflow-y-auto">
                  {bookshelves.length === 0 ? (
                    <li className="rounded-xl border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-500 dark:border-[var(--app-border)] dark:text-[var(--app-muted)]">
                      No units yet — commission one above.
                    </li>
                  ) : (
                    bookshelves.map((s, i) => {
                      const active = manageShelfId === s.id;
                      return (
                        <li key={s.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setManageShelfId(s.id);
                              setRailMotion(true);
                            }}
                            className={cn(
                              'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                              active
                                ? 'border-cyan-300 bg-cyan-50 shadow-sm dark:border-cyan-800 dark:bg-cyan-950/30'
                                : 'border-transparent hover:border-slate-200 hover:bg-slate-50 dark:hover:border-[var(--app-border)] dark:hover:bg-[var(--app-bg)]'
                            )}
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800 font-mono text-[11px] font-bold text-cyan-200">
                              {bayCode(i)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">
                                {s.title}
                              </span>
                              <span className="block text-[10px] text-slate-500 dark:text-[var(--app-muted)]">
                                {active && railMotion ? 'Aisle open' : 'On rail'}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            </div>

            <div className="lg:col-span-8 space-y-4">
              {bookshelves.length > 0 ? (
                <CompactMobileRail
                  railMotion={railMotion}
                  bookshelves={railWindowShelves}
                  globalOffset={railWin.start}
                  totalBays={bookshelves.length}
                  railPage={railWin.page}
                  railPageCount={railWin.pageCount}
                  selectedShelfId={manageShelfId}
                  onSelectCarriage={(globalIndex) => {
                    const s = bookshelves[globalIndex];
                    if (!s) return;
                    setManageShelfId(s.id);
                    setRailMotion(true);
                    setRailPage(railPageForIndex(globalIndex));
                  }}
                  onRailPageChange={setRailPage}
                />
              ) : (
                <div className="flex min-h-[240px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white/50 text-center dark:border-[var(--app-border)] dark:bg-[var(--app-surface)]/40">
                  <DoorOpen className="mb-3 h-10 w-10 text-slate-400" />
                  <p className="text-sm font-medium text-slate-700 dark:text-[var(--app-fg)]">
                    Rail is offline
                  </p>
                  <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-[var(--app-muted)]">
                    Add a storage unit to mount carriages on the mobile track.
                  </p>
                </div>
              )}

              {selectedShelf ? (
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/90 bg-white/90 p-3 shadow-sm dark:border-[var(--app-border)] dark:bg-[var(--app-surface)]/90">
                  <div className="mr-auto min-w-0 px-1">
                    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500 dark:text-[var(--app-muted)]">
                      Active bay {selectedBay}
                    </p>
                    <p className="truncate text-sm font-semibold">{selectedShelf.title}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenShelfForNotes(selectedShelf.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-cyan-700 dark:hover:bg-cyan-800"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    Open in Notes
                  </button>
                  <button
                    type="button"
                    disabled={busy === selectedShelf.id}
                    onClick={() => renameShelf(selectedShelf.id, selectedShelf.title)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium hover:bg-slate-50 disabled:opacity-50 dark:border-[var(--app-border)] dark:bg-[var(--app-bg)] dark:hover:bg-[var(--app-surface)]"
                  >
                    {busy === selectedShelf.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Pencil className="h-3.5 w-3.5" />
                    )}
                    Rename
                  </button>
                  <button
                    type="button"
                    disabled={busy === selectedShelf.id}
                    onClick={() => deleteShelf(selectedShelf.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              ) : null}
            </div>
          </section>

          {/* Charts in open bay */}
          <section className="rounded-3xl border border-slate-200/90 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-[var(--app-border)] dark:bg-[var(--app-surface)]/70 sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold tracking-tight">
                  Charts in open bay
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-[var(--app-muted)]">
                  Binders on the steel shelves — create, import, archive, or open.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={importRef}
                  type="file"
                  accept=".md,.markdown,text/markdown"
                  className="hidden"
                  onChange={onImportFile}
                />
                <button
                  type="button"
                  disabled={!manageShelfId || busy === 'new-notebook'}
                  onClick={() => void createNotebook()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-700 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-800 disabled:opacity-50"
                >
                  {busy === 'new-notebook' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  New chart
                </button>
                <button
                  type="button"
                  disabled={busy === 'import' || !manageShelfId}
                  onClick={() => importRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium hover:bg-slate-50 disabled:opacity-50 dark:border-[var(--app-border)] dark:bg-[var(--app-bg)] dark:hover:bg-[var(--app-surface)]"
                >
                  {busy === 'import' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  Import Markdown
                </button>
                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-[var(--app-border)] dark:bg-[var(--app-bg)]">
                  <button
                    type="button"
                    onClick={() => setTab('active')}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-xs font-medium',
                      tab === 'active'
                        ? 'bg-white text-slate-900 shadow dark:bg-[var(--app-surface)] dark:text-[var(--app-fg)]'
                        : 'text-slate-500 dark:text-[var(--app-muted)]'
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
                        ? 'bg-white text-slate-900 shadow dark:bg-[var(--app-surface)] dark:text-[var(--app-fg)]'
                        : 'text-slate-500 dark:text-[var(--app-muted)]'
                    )}
                  >
                    Archived ({archivedList.length})
                  </button>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-cyan-700" />
              </div>
            ) : !manageShelfId ? (
              <p className="py-16 text-center text-sm text-slate-500 dark:text-[var(--app-muted)]">
                Commission a storage unit to stock charts.
              </p>
            ) : (
              <div className="space-y-6">
                <ChartCabinetVisualization
                  shelfTitle={selectedShelf?.title?.slice(0, 64) || ''}
                  bayLabel={selectedBay}
                  notebooks={visibleCharts}
                  totalCharts={list.length}
                  cabinetPage={cabinetWin.page}
                  cabinetPageCount={cabinetWin.pageCount}
                  onCabinetPageChange={setCabinetPage}
                  tab={tab}
                  pageCount={pageCount}
                  sectionCount={sectionCount}
                  previewBookId={previewBook?.id ?? null}
                  onSpineClick={setPreviewBook}
                />
                {previewBook ? (
                  <BookDetailView
                    notebook={previewBook}
                    shelfTitle={selectedShelf?.title?.slice(0, 80) || ''}
                    bayLabel={selectedBay}
                    tab={tab}
                    pageCount={pageCount}
                    sectionCount={sectionCount}
                    busyNotebookId={busy}
                    onClose={() => setPreviewBook(null)}
                    onOpenInNotes={() => {
                      openAndFocus(previewBook);
                      setPreviewBook(null);
                    }}
                    onExportNotebook={exportNb}
                    onArchiveNotebook={archive}
                    onRestoreNotebook={restoreAndOpen}
                    onDeleteNotebookForever={removeForever}
                  />
                ) : null}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
