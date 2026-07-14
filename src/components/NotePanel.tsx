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

  return (
    <div
      className={cn('acoustic-pillar flex h-full min-w-0 flex-col', className)}
      style={{ ['--pillar-breath' as string]: String(breath) }}
    >
      <div className="breathing-arcs" aria-hidden>
        <span />
        <span />
        <span />
      </div>

      <div className="relative z-[1] shrink-0 px-4 py-5 sm:px-10 lg:px-16">
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
              <span className="truncate font-medium text-[var(--spine)]">{path.bookTitle}</span>
            ) : null}
            {path?.bookTitle && path?.chapterTitle ? (
              <span aria-hidden className="opacity-30">
                ·
              </span>
            ) : null}
            {path?.chapterTitle ? <span className="truncate">{path.chapterTitle}</span> : null}
          </nav>
        )}

        <input
          type="text"
          value={page.title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="font-display mx-auto block w-full max-w-3xl border-none bg-transparent text-center text-3xl font-medium tracking-tight text-[var(--app-fg)] placeholder:text-[var(--app-muted)]/35 focus:outline-none sm:text-[2.5rem]"
          placeholder="Untitled thought"
          aria-label="Page title"
        />

        <div className="mx-auto mt-4 flex max-w-3xl flex-wrap items-center justify-center gap-3 text-xs text-[var(--app-muted)]">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 opacity-60" />
            <span>
              {typeof page.updatedAt === 'number'
                ? format(page.updatedAt, 'MMM d, yyyy · HH:mm')
                : page.updatedAt}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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

      <div className="relative z-[1] min-h-0 flex-1 overflow-hidden px-3 pb-4 sm:px-6 lg:px-10">
        <div className="paper-page mx-auto h-full min-h-0 max-w-3xl overflow-hidden border border-[var(--app-border)]/80">
          <PanelGroup orientation="horizontal" className="h-full">
            {(viewMode === 'edit' || viewMode === 'split') && (
              <>
                <Panel defaultSize={viewMode === 'edit' ? '100%' : '50%'}>
                  <div className="h-full">
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
