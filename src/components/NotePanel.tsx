import React from 'react';
import {
  Group as PanelGroup,
  Panel,
  Separator as PanelResizeHandle,
} from 'react-resizable-panels';
import { Clock, Download, FileDown, Loader2, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { Page } from '../types';
import { cn } from '../lib/utils';
import Editor from './Editor';
import Preview from './Preview';

export type EditorViewMode = 'split' | 'edit' | 'preview';

export type NotePath = {
  bookTitle?: string;
  chapterTitle?: string;
};

interface NotePanelProps {
  page: Page;
  path?: NotePath;
  /** Shown as a small badge above the title; omit in single-note mode */
  paneLabel?: string;
  viewMode: EditorViewMode;
  onTitleChange: (title: string) => void;
  onContentChange: (content: string) => void;
  onPrint: () => void;
  onExportPdf: () => void;
  onExportMarkdown: () => void;
  pdfExporting: boolean;
  className?: string;
}

const NotePanel: React.FC<NotePanelProps> = ({
  page,
  path,
  paneLabel,
  viewMode,
  onTitleChange,
  onContentChange,
  onPrint,
  onExportPdf,
  onExportMarkdown,
  pdfExporting,
  className,
}) => {
  return (
    <div className={cn('flex h-full min-w-0 flex-col', className)}>
      <div className="shrink-0 border-b border-[var(--app-border)] bg-[var(--app-surface)]/80 px-4 py-5 backdrop-blur-sm sm:px-8 lg:px-12">
        {(path?.bookTitle || path?.chapterTitle || paneLabel) && (
          <nav
            className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[var(--app-muted)]"
            aria-label="Location in book"
          >
            {paneLabel ? (
              <span className="rounded-full bg-[color-mix(in_srgb,var(--spine)_12%,var(--paper))] px-2 py-0.5 text-[10px] font-medium text-[var(--spine)]">
                {paneLabel}
              </span>
            ) : null}
            {path?.bookTitle ? (
              <span className="truncate font-medium text-[var(--spine)]">
                {path.bookTitle}
              </span>
            ) : null}
            {path?.bookTitle && path?.chapterTitle ? (
              <span aria-hidden className="opacity-35">
                /
              </span>
            ) : null}
            {path?.chapterTitle ? (
              <span className="truncate">{path.chapterTitle}</span>
            ) : null}
            <span aria-hidden className="opacity-35">
              /
            </span>
            <span className="truncate text-[var(--app-fg)]">Page</span>
          </nav>
        )}

        <input
          type="text"
          value={page.title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="font-display w-full border-none bg-transparent text-3xl font-medium tracking-tight text-[var(--app-fg)] placeholder:text-[var(--app-muted)]/45 focus:outline-none sm:text-[2.35rem]"
          placeholder="Untitled page"
          aria-label="Page title"
        />

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--app-muted)]">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 opacity-70" />
            <span>
              {typeof page.updatedAt === 'number'
                ? format(page.updatedAt, 'MMM d, yyyy · HH:mm')
                : page.updatedAt}
            </span>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => onPrint()} className="studio-btn" title="Print">
              <Printer className="h-3.5 w-3.5" />
              Print
            </button>
            <button
              type="button"
              onClick={onExportMarkdown}
              className="studio-btn"
              title="Download Markdown"
            >
              <Download className="h-3.5 w-3.5" />
              Markdown
            </button>
            <button
              type="button"
              onClick={onExportPdf}
              disabled={pdfExporting}
              className="studio-btn disabled:opacity-50"
              title="Save as PDF"
            >
              {pdfExporting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileDown className="h-3.5 w-3.5" />
              )}
              PDF
            </button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden p-3 sm:p-5 lg:p-6">
        <div className="paper-page h-full min-h-0 overflow-hidden rounded-2xl border border-[var(--app-border)]">
          <PanelGroup orientation="horizontal" className="h-full">
            {(viewMode === 'edit' || viewMode === 'split') && (
              <>
                <Panel defaultSize={viewMode === 'edit' ? '100%' : '50%'}>
                  <div className="h-full font-serif text-[15.5px] leading-[1.75]">
                    <Editor value={page.content} onChange={onContentChange} />
                  </div>
                </Panel>
                {viewMode === 'split' && (
                  <PanelResizeHandle className="w-1.5 shrink-0 cursor-col-resize bg-[var(--gutter)] transition hover:bg-brand-200 dark:hover:bg-brand-800" />
                )}
              </>
            )}
            {(viewMode === 'preview' || viewMode === 'split') && (
              <Panel defaultSize={viewMode === 'preview' ? '100%' : '50%'}>
                <div className="h-full font-serif">
                  <Preview content={page.content} />
                </div>
              </Panel>
            )}
          </PanelGroup>
        </div>
      </div>
    </div>
  );
};

export default NotePanel;
