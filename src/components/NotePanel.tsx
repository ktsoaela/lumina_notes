import React from 'react';
import {
  Group as PanelGroup,
  Panel,
  Separator as PanelResizeHandle,
} from 'react-resizable-panels';
import { Clock, FileDown, FileText, Loader2, Printer, Save } from 'lucide-react';
import { format } from 'date-fns';
import { Page } from '../types';
import { cn } from '../lib/utils';
import Editor from './Editor';
import Preview from './Preview';

export type EditorViewMode = 'split' | 'edit' | 'preview';

interface NotePanelProps {
  page: Page;
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
    <div className={cn('flex flex-col h-full min-w-0', className)}>
      <div className="px-4 sm:px-6 lg:px-8 py-4 border-b border-gray-100 dark:border-[var(--app-border)] bg-white dark:bg-[var(--app-surface)] shrink-0">
        {paneLabel ? (
          <div className="flex items-center gap-2 mb-2">
            <span className="rounded bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-700 dark:bg-[var(--app-bg)] dark:text-brand-300">
              {paneLabel}
            </span>
          </div>
        ) : null}
        <input
          type="text"
          value={page.title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="w-full border-none bg-transparent text-2xl font-bold text-gray-900 placeholder:text-gray-300 focus:outline-none dark:text-[var(--app-fg)] dark:placeholder:text-[var(--app-muted)] sm:text-3xl lg:text-4xl"
          placeholder="Page Title"
        />
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-[var(--app-muted)]">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>
              Last updated:{' '}
              {typeof page.updatedAt === 'number'
                ? format(page.updatedAt, 'MMM d, yyyy HH:mm')
                : page.updatedAt}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Save className="w-3 h-3" />
            <span>Synced to Cloud</span>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2 normal-case">
            <button
              type="button"
              onClick={() => onPrint()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-gray-700 transition-colors hover:border-brand-300 hover:bg-gray-50 dark:border-[var(--app-border)] dark:bg-[var(--app-surface)] dark:text-[var(--app-fg)] dark:hover:border-brand-600 dark:hover:bg-[var(--app-bg)]"
              title="Print this page (rendered Markdown)"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
            <button
              type="button"
              onClick={onExportMarkdown}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-gray-700 transition-colors hover:border-brand-300 hover:bg-gray-50 dark:border-[var(--app-border)] dark:bg-[var(--app-surface)] dark:text-[var(--app-fg)] dark:hover:bg-[var(--app-bg)]"
              title="Download this page as a Markdown file"
            >
              <FileText className="w-3.5 h-3.5" />
              Markdown
            </button>
            <button
              type="button"
              onClick={onExportPdf}
              disabled={pdfExporting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-gray-700 transition-colors hover:border-brand-300 hover:bg-gray-50 disabled:opacity-50 dark:border-[var(--app-border)] dark:bg-[var(--app-surface)] dark:text-[var(--app-fg)] dark:hover:bg-[var(--app-bg)]"
              title="Save as PDF (from preview rendering)"
            >
              {pdfExporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileDown className="w-3.5 h-3.5" />
              )}
              PDF
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden min-h-0">
        <PanelGroup orientation="horizontal" className="h-full">
          {(viewMode === 'edit' || viewMode === 'split') && (
            <>
              <Panel defaultSize={viewMode === 'edit' ? '100%' : '50%'}>
                <Editor value={page.content} onChange={onContentChange} />
              </Panel>
              {viewMode === 'split' && (
                <PanelResizeHandle className="w-1 shrink-0 cursor-col-resize bg-gray-50 transition-colors hover:bg-brand-100 dark:bg-[var(--app-bg)] dark:hover:bg-[var(--app-border)]" />
              )}
            </>
          )}
          {(viewMode === 'preview' || viewMode === 'split') && (
            <Panel defaultSize={viewMode === 'preview' ? '100%' : '50%'}>
              <Preview content={page.content} />
            </Panel>
          )}
        </PanelGroup>
      </div>
    </div>
  );
};

export default NotePanel;
