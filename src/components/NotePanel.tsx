import React, { useState } from 'react';
import {
  Group as PanelGroup,
  Panel,
  Separator as PanelResizeHandle,
} from 'react-resizable-panels';
import { Clock, Download, FileDown, Loader2, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { Page } from '../types';
import { cn } from '../lib/utils';
import { pageTitleSizeClass } from '../lib/displayTitle';
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
  const [breath, setBreath] = useState(0.35);
  const titleEmpty = !page.title?.trim();

  return (
    <div
      className={cn('acoustic-pillar @container/note flex h-full min-w-0 flex-col', className)}
      style={{ ['--pillar-breath' as string]: String(breath) }}
    >
      <div className="breathing-arcs" aria-hidden>
        <span />
        <span />
        <span />
      </div>

      <div className="relative z-[1] shrink-0 px-3 py-4 sm:px-6 sm:py-5 lg:px-10">
        {(path?.bookTitle || path?.chapterTitle || paneLabel) && (
          <nav
            className="mb-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] tracking-[0.04em] text-[var(--app-muted)]"
            aria-label="Location in book"
          >
            {paneLabel ? (
              <span className="rounded-full bg-[var(--sage)] px-2 py-0.5 text-[10px] font-medium text-[var(--spine)]">
                {paneLabel}
              </span>
            ) : null}
            {path?.bookTitle ? (
              <span className="max-w-[40%] truncate font-medium text-[var(--spine)] sm:max-w-none">
                {path.bookTitle}
              </span>
            ) : null}
            {path?.bookTitle && path?.chapterTitle ? (
              <span aria-hidden className="opacity-30">
                ·
              </span>
            ) : null}
            {path?.chapterTitle ? (
              <span className="max-w-[40%] truncate sm:max-w-none">{path.chapterTitle}</span>
            ) : null}
          </nav>
        )}

        <input
          type="text"
          value={page.title}
          onChange={(e) => onTitleChange(e.target.value)}
          className={cn(
            'font-display mx-auto block w-full max-w-5xl border-none bg-transparent text-center font-medium tracking-tight text-[var(--app-fg)] focus:outline-none',
            'placeholder:italic placeholder:text-[var(--app-muted)]/45',
            pageTitleSizeClass(page.title),
            titleEmpty && 'italic text-[var(--app-muted)]'
          )}
          placeholder="Untitled thought — give this page a name"
          aria-label="Page title"
        />

        <div className="mx-auto mt-3 flex w-full max-w-5xl flex-wrap items-center justify-center gap-2 text-xs text-[var(--app-muted)] sm:mt-4 sm:gap-3">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 opacity-60" />
            <span>
              {typeof page.updatedAt === 'number'
                ? format(page.updatedAt, 'MMM d, yyyy · HH:mm')
                : page.updatedAt}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <button type="button" onClick={() => onPrint()} className="studio-btn" title="Print">
              <Printer className="h-3.5 w-3.5" />
              <span className="hidden @[28rem]/note:inline sm:inline">Print</span>
            </button>
            <button
              type="button"
              onClick={onExportMarkdown}
              className="studio-btn"
              title="Download Markdown"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden @[28rem]/note:inline sm:inline">Markdown</span>
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
              <span className="hidden @[28rem]/note:inline sm:inline">PDF</span>
            </button>
          </div>
        </div>
      </div>

      <div className="relative z-[1] min-h-0 w-full min-w-0 flex-1 overflow-hidden px-2 pb-3 sm:px-4 sm:pb-4 lg:px-6">
        <div className="paper-page mx-auto h-full min-h-0 w-full max-w-5xl overflow-hidden border border-[var(--app-border)]/80 @[40rem]/note:max-w-6xl">
          <PanelGroup orientation="horizontal" className="h-full w-full">
            {(viewMode === 'edit' || viewMode === 'split') && (
              <>
                <Panel defaultSize={viewMode === 'edit' ? '100%' : '50%'}>
                  <div className="h-full min-w-0">
                    <Editor
                      value={page.content}
                      onChange={onContentChange}
                      onBreathChange={setBreath}
                    />
                  </div>
                </Panel>
                {viewMode === 'split' && (
                  <PanelResizeHandle className="quiet-spine-rail w-px shrink-0 cursor-col-resize bg-transparent hover:bg-[var(--sage)]" />
                )}
              </>
            )}
            {(viewMode === 'preview' || viewMode === 'split') && (
              <Panel defaultSize={viewMode === 'preview' ? '100%' : '50%'}>
                <div className="h-full min-w-0 font-serif">
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
