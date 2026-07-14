import React from 'react';
import {
  BookOpen,
  ChevronRight,
  ChevronDown,
  Plus,
  FileText,
  Bookmark,
  Trash2,
  Pencil,
  Archive,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Notebook, Section, Page } from '../types';
import { cn } from '../lib/utils';
import { virtualWindow } from '../lib/virtualWindow';

const NOTEBOOK_ROW_H = 44;

type EditTarget =
  | { kind: 'notebook'; id: string }
  | { kind: 'section'; notebookId: string; id: string }
  | { kind: 'page'; sectionId: string; id: string };

interface SidebarProps {
  notebooks: Notebook[];
  activeNotebookId: string | null;
  activeSectionId: string | null;
  activePageId: string | null;
  secondaryPageId: string | null;
  dualPageOpen: boolean;
  onSelectNotebook: (id: string) => void;
  onSelectSection: (id: string) => void;
  onSelectPage: (id: string, asSecondary?: boolean) => void;
  onAddNotebook: () => void;
  onAddSection: (notebookId: string) => void;
  onAddPage: (sectionId: string) => void;
  onArchiveNotebook: (id: string) => void;
  onDeleteSection: (notebookId: string, sectionId: string) => void;
  onDeletePage: (sectionId: string, pageId: string) => void;
  onRenameNotebook: (id: string, name: string) => void;
  onRenameSection: (notebookId: string, sectionId: string, name: string) => void;
  onRenamePage: (sectionId: string, pageId: string, title: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  notebooks,
  activeNotebookId,
  activeSectionId,
  activePageId,
  secondaryPageId,
  dualPageOpen,
  onSelectNotebook,
  onSelectSection,
  onSelectPage,
  onAddNotebook,
  onAddSection,
  onAddPage,
  onArchiveNotebook,
  onDeleteSection,
  onDeletePage,
  onRenameNotebook,
  onRenameSection,
  onRenamePage,
}) => {
  const [editTarget, setEditTarget] = React.useState<EditTarget | null>(null);
  const [editDraft, setEditDraft] = React.useState('');
  const [expandedNotebookIds, setExpandedNotebookIds] = React.useState<Set<string>>(
    () => new Set()
  );
  const [expandedSectionIds, setExpandedSectionIds] = React.useState<Set<string>>(
    () => new Set()
  );

  React.useEffect(() => {
    if (activeNotebookId) {
      setExpandedNotebookIds((prev) => new Set(prev).add(activeNotebookId));
    }
  }, [activeNotebookId]);

  React.useEffect(() => {
    if (activeSectionId) {
      setExpandedSectionIds((prev) => new Set(prev).add(activeSectionId));
    }
  }, [activeSectionId]);

  const commitRename = React.useCallback(() => {
    if (!editTarget) return;
    const v = editDraft;
    if (editTarget.kind === 'notebook') {
      onRenameNotebook(editTarget.id, v || 'Untitled book');
    } else if (editTarget.kind === 'section') {
      onRenameSection(editTarget.notebookId, editTarget.id, v || 'Untitled chapter');
    } else {
      onRenamePage(editTarget.sectionId, editTarget.id, v || 'Untitled page');
    }
    setEditTarget(null);
  }, [editTarget, editDraft, onRenameNotebook, onRenameSection, onRenamePage]);

  const cancelRename = React.useCallback(() => {
    setEditTarget(null);
  }, []);

  const listRef = React.useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = React.useState(0);
  const [viewportH, setViewportH] = React.useState(480);

  React.useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const measure = () => setViewportH(el.clientHeight || 480);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const useVirt = notebooks.length > 40;
  const win = useVirt
    ? virtualWindow(notebooks.length, NOTEBOOK_ROW_H, scrollTop, viewportH)
    : { start: 0, end: notebooks.length, offsetY: 0, totalH: 0 };
  const visibleNotebooks = notebooks.slice(win.start, win.end);

  const itemProps = {
    activeSectionId,
    activePageId,
    secondaryPageId,
    dualPageOpen,
    expandedSectionIds,
    setExpandedSectionIds,
    onSelectSection,
    onSelectPage,
    onAddSection,
    onAddPage,
    onArchiveNotebook,
    onDeleteSection,
    onDeletePage,
    editTarget,
    editDraft,
    setEditDraft,
    setEditTarget,
    commitRename,
    cancelRename,
  };

  return (
    <aside className="flex h-full min-w-0 w-full flex-col select-none border-r border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-fg)]">
      <div className="shrink-0 border-b border-[var(--app-border)] px-4 pb-4 pt-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--app-muted)]">
              Table of contents
            </p>
            <h2 className="mt-1 font-display text-xl font-medium tracking-tight text-[var(--app-fg)]">
              Your book
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[var(--app-muted)]">
              Book → chapter → page. Open anywhere, write in Markdown.
            </p>
          </div>
          <button
            type="button"
            onClick={onAddNotebook}
            className="studio-btn-primary !px-3 !py-1.5 !text-xs"
            title="New book"
            aria-label="New book"
          >
            <Plus className="h-3.5 w-3.5" />
            Book
          </button>
        </div>
      </div>

      {dualPageOpen && (
        <div className="mx-3 mt-3 rounded-[var(--radius-ui)] border border-[var(--app-border)] bg-[var(--gutter)]/50 px-3 py-2 text-[11px] leading-snug text-[var(--app-fg)]">
          <span className="font-medium text-[var(--spine)]">Compare pages:</span> click
          left ·{' '}
          <kbd className="rounded border border-[var(--app-border)] bg-[var(--paper)] px-1 font-mono text-[10px]">
            Shift
          </kbd>
          +click right
        </div>
      )}

      <div
        ref={listRef}
        className="min-h-0 flex-1 overflow-y-auto px-2 py-3"
        role="navigation"
        aria-label="Books and chapters"
        onScroll={(e) => {
          if (useVirt) setScrollTop(e.currentTarget.scrollTop);
        }}
      >
        {notebooks.length === 0 ? (
          <div className="mx-2 rounded-xl border border-dashed border-[var(--app-border)] bg-[var(--gutter)]/40 px-4 py-8 text-center">
            <BookOpen className="mx-auto mb-3 h-8 w-8 text-[var(--spine)] opacity-70" />
            <p className="font-display text-base text-[var(--app-fg)]">Start a book</p>
            <p className="mt-1 text-xs text-[var(--app-muted)]">
              Create a notebook, then chapters and pages inside it.
            </p>
            <button
              type="button"
              onClick={onAddNotebook}
              className="mt-4 text-xs font-semibold text-[var(--spine)] underline-offset-2 hover:underline"
            >
              New book
            </button>
          </div>
        ) : useVirt ? (
          <div style={{ height: win.totalH, position: 'relative' }}>
            <div style={{ transform: `translateY(${win.offsetY}px)` }}>
              {visibleNotebooks.map((notebook) => (
                <NotebookItem
                  key={notebook.id}
                  notebook={notebook}
                  isActive={activeNotebookId === notebook.id}
                  isExpanded={expandedNotebookIds.has(notebook.id)}
                  onToggleNotebookExpand={() => {
                    setExpandedNotebookIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(notebook.id)) next.delete(notebook.id);
                      else next.add(notebook.id);
                      return next;
                    });
                  }}
                  onNotebookRowClick={() => {
                    onSelectNotebook(notebook.id);
                    setExpandedNotebookIds((prev) => new Set(prev).add(notebook.id));
                  }}
                  {...itemProps}
                />
              ))}
            </div>
          </div>
        ) : (
          notebooks.map((notebook) => (
            <NotebookItem
              key={notebook.id}
              notebook={notebook}
              isActive={activeNotebookId === notebook.id}
              isExpanded={expandedNotebookIds.has(notebook.id)}
              onToggleNotebookExpand={() => {
                setExpandedNotebookIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(notebook.id)) next.delete(notebook.id);
                  else next.add(notebook.id);
                  return next;
                });
              }}
              onNotebookRowClick={() => {
                onSelectNotebook(notebook.id);
                setExpandedNotebookIds((prev) => new Set(prev).add(notebook.id));
              }}
              {...itemProps}
            />
          ))
        )}
      </div>
    </aside>
  );
};

interface NotebookItemProps {
  notebook: Notebook;
  isActive: boolean;
  isExpanded: boolean;
  onToggleNotebookExpand: () => void;
  onNotebookRowClick: () => void;
  activeSectionId: string | null;
  activePageId: string | null;
  secondaryPageId: string | null;
  dualPageOpen: boolean;
  expandedSectionIds: Set<string>;
  setExpandedSectionIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  onSelectSection: (id: string) => void;
  onSelectPage: (id: string, asSecondary?: boolean) => void;
  onAddSection: (notebookId: string) => void;
  onAddPage: (sectionId: string) => void;
  onArchiveNotebook: (id: string) => void;
  onDeleteSection: (notebookId: string, sectionId: string) => void;
  onDeletePage: (sectionId: string, pageId: string) => void;
  editTarget: EditTarget | null;
  editDraft: string;
  setEditDraft: (v: string) => void;
  setEditTarget: React.Dispatch<React.SetStateAction<EditTarget | null>>;
  commitRename: () => void;
  cancelRename: () => void;
}

const actionBtn =
  'rounded-md p-1.5 text-[var(--app-muted)] opacity-0 transition group-hover:opacity-100 focus:opacity-100 hover:bg-[var(--gutter)] hover:text-[var(--app-fg)]';

const NotebookItem: React.FC<NotebookItemProps> = ({
  notebook,
  isActive,
  isExpanded,
  onToggleNotebookExpand,
  onNotebookRowClick,
  activeSectionId,
  activePageId,
  secondaryPageId,
  dualPageOpen,
  expandedSectionIds,
  setExpandedSectionIds,
  onSelectSection,
  onSelectPage,
  onAddSection,
  onAddPage,
  onArchiveNotebook,
  onDeleteSection,
  onDeletePage,
  editTarget,
  editDraft,
  setEditDraft,
  setEditTarget,
  commitRename,
  cancelRename,
}) => {
  const editingNotebook =
    editTarget?.kind === 'notebook' && editTarget.id === notebook.id;
  const chapterCount = notebook.sections.length;
  const pageCount = notebook.sections.reduce((n, s) => n + s.pages.length, 0);

  return (
    <div className="mb-3">
      <div
        className={cn(
          'group relative flex cursor-pointer items-center gap-1 rounded-xl border px-1.5 py-2 transition',
          isActive
            ? 'border-[var(--spine)]/40 bg-[var(--paper)] shadow-sm'
            : 'border-transparent hover:border-[var(--app-border)] hover:bg-[var(--gutter)]/50'
        )}
        onClick={onNotebookRowClick}
      >
        {isActive && (
          <span
            className="absolute inset-y-2 left-0 w-1 rounded-full bg-[var(--spine)]"
            aria-hidden
          />
        )}
        <button
          type="button"
          aria-expanded={isExpanded}
          className="shrink-0 rounded-md p-1 text-[var(--app-muted)] hover:text-[var(--app-fg)]"
          onClick={(e) => {
            e.stopPropagation();
            onToggleNotebookExpand();
          }}
          title={isExpanded ? 'Close book' : 'Open book'}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
        <BookOpen
          className={cn(
            'h-4 w-4 shrink-0',
            isActive ? 'text-[var(--spine)]' : 'text-[var(--app-muted)]'
          )}
        />
        <div className="min-w-0 flex-1 pl-1">
          {editingNotebook ? (
            <input
              autoFocus
              className="w-full rounded-md border border-brand-300 bg-[var(--paper)] px-2 py-0.5 font-display text-sm font-semibold"
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitRename();
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  cancelRename();
                }
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <>
              <div className="truncate font-display text-sm font-semibold tracking-tight">
                {notebook.title}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--app-muted)]">
                Book · {chapterCount} ch · {pageCount} pg
              </div>
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setEditTarget({ kind: 'notebook', id: notebook.id });
              setEditDraft(notebook.title);
            }}
            className={actionBtn}
            title="Rename book"
            aria-label="Rename book"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAddSection(notebook.id);
            }}
            className={actionBtn}
            title="Add chapter"
            aria-label="Add chapter"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onArchiveNotebook(notebook.id);
            }}
            className={cn(actionBtn, 'hover:text-amber-800 dark:hover:text-amber-300')}
            title="Archive book"
            aria-label="Archive book"
          >
            <Archive className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="relative ml-4 mt-1 space-y-1 border-l border-[var(--app-border)] pl-3">
              {notebook.sections.length === 0 ? (
                <button
                  type="button"
                  onClick={() => onAddSection(notebook.id)}
                  className="w-full rounded-lg px-2 py-2 text-left text-xs text-[var(--app-muted)] hover:bg-[var(--gutter)] hover:text-[var(--spine)]"
                >
                  + First chapter
                </button>
              ) : (
                notebook.sections.map((section, idx) => (
                  <SectionItem
                    key={section.id}
                    notebookId={notebook.id}
                    section={section}
                    chapterIndex={idx + 1}
                    isActive={activeSectionId === section.id}
                    isExpanded={expandedSectionIds.has(section.id)}
                    onToggleSectionExpand={() => {
                      setExpandedSectionIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(section.id)) next.delete(section.id);
                        else next.add(section.id);
                        return next;
                      });
                    }}
                    onSectionRowClick={() => {
                      onSelectSection(section.id);
                      setExpandedSectionIds((prev) => new Set(prev).add(section.id));
                    }}
                    activePageId={activePageId}
                    secondaryPageId={secondaryPageId}
                    dualPageOpen={dualPageOpen}
                    onSelectPage={onSelectPage}
                    onAddPage={onAddPage}
                    onDeleteSection={onDeleteSection}
                    onDeletePage={onDeletePage}
                    editTarget={editTarget}
                    editDraft={editDraft}
                    setEditDraft={setEditDraft}
                    setEditTarget={setEditTarget}
                    commitRename={commitRename}
                    cancelRename={cancelRename}
                  />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface SectionItemProps {
  notebookId: string;
  section: Section;
  chapterIndex: number;
  isActive: boolean;
  isExpanded: boolean;
  onToggleSectionExpand: () => void;
  onSectionRowClick: () => void;
  activePageId: string | null;
  secondaryPageId: string | null;
  dualPageOpen: boolean;
  onSelectPage: (id: string, asSecondary?: boolean) => void;
  onAddPage: (sectionId: string) => void;
  onDeleteSection: (notebookId: string, sectionId: string) => void;
  onDeletePage: (sectionId: string, pageId: string) => void;
  editTarget: EditTarget | null;
  editDraft: string;
  setEditDraft: (v: string) => void;
  setEditTarget: React.Dispatch<React.SetStateAction<EditTarget | null>>;
  commitRename: () => void;
  cancelRename: () => void;
}

const SectionItem: React.FC<SectionItemProps> = ({
  notebookId,
  section,
  chapterIndex,
  isActive,
  isExpanded,
  onToggleSectionExpand,
  onSectionRowClick,
  activePageId,
  secondaryPageId,
  dualPageOpen,
  onSelectPage,
  onAddPage,
  onDeleteSection,
  onDeletePage,
  editTarget,
  editDraft,
  setEditDraft,
  setEditTarget,
  commitRename,
  cancelRename,
}) => {
  const editingSection =
    editTarget?.kind === 'section' &&
    editTarget.id === section.id &&
    editTarget.notebookId === notebookId;

  return (
    <div className="mb-1">
      <div
        className={cn(
          'group flex cursor-pointer items-center gap-1 rounded-lg px-1.5 py-1.5 transition',
          isActive
            ? 'bg-[var(--gutter)] text-[var(--spine)]'
            : 'hover:bg-[var(--gutter)]/70'
        )}
        onClick={onSectionRowClick}
      >
        <button
          type="button"
          aria-expanded={isExpanded}
          className="shrink-0 rounded p-0.5 text-[var(--app-muted)]"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSectionExpand();
          }}
          title={isExpanded ? 'Collapse chapter' : 'Expand chapter'}
        >
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>
        <Bookmark className="h-3.5 w-3.5 shrink-0 opacity-70" />
        <div className="min-w-0 flex-1">
          {editingSection ? (
            <input
              autoFocus
              className="w-full rounded border border-brand-300 bg-[var(--paper)] px-1.5 py-0.5 text-sm"
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitRename();
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  cancelRename();
                }
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <>
              <div className="truncate text-sm font-medium">{section.title}</div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--app-muted)]">
                Chapter {chapterIndex}
              </div>
            </>
          )}
        </div>
        <div className="flex shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setEditTarget({ kind: 'section', notebookId, id: section.id });
              setEditDraft(section.title);
            }}
            className={actionBtn}
            title="Rename chapter"
            aria-label="Rename chapter"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAddPage(section.id);
            }}
            className={actionBtn}
            title="Add page"
            aria-label="Add page"
          >
            <Plus className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteSection(notebookId, section.id);
            }}
            className={cn(actionBtn, 'hover:text-red-700 dark:hover:text-red-300')}
            title="Delete chapter"
            aria-label="Delete chapter"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="ml-5 mt-0.5 space-y-0.5 border-l border-dashed border-[var(--app-border)] pl-2">
              {section.pages.length === 0 ? (
                <button
                  type="button"
                  onClick={() => onAddPage(section.id)}
                  className="w-full rounded-md px-2 py-1.5 text-left text-[11px] text-[var(--app-muted)] hover:text-[var(--spine)]"
                >
                  + First page
                </button>
              ) : (
                section.pages.map((page, pIdx) => (
                  <PageRow
                    key={page.id}
                    sectionId={section.id}
                    page={page}
                    pageIndex={pIdx + 1}
                    isActive={activePageId === page.id}
                    isSecondary={dualPageOpen && secondaryPageId === page.id}
                    onSelectPage={onSelectPage}
                    onDeletePage={onDeletePage}
                    editTarget={editTarget}
                    editDraft={editDraft}
                    setEditDraft={setEditDraft}
                    setEditTarget={setEditTarget}
                    commitRename={commitRename}
                    cancelRename={cancelRename}
                  />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface PageRowProps {
  sectionId: string;
  page: Page;
  pageIndex: number;
  isActive: boolean;
  isSecondary: boolean;
  onSelectPage: (id: string, asSecondary?: boolean) => void;
  onDeletePage: (sectionId: string, pageId: string) => void;
  editTarget: EditTarget | null;
  editDraft: string;
  setEditDraft: (v: string) => void;
  setEditTarget: React.Dispatch<React.SetStateAction<EditTarget | null>>;
  commitRename: () => void;
  cancelRename: () => void;
}

const PageRow: React.FC<PageRowProps> = ({
  sectionId,
  page,
  pageIndex,
  isActive,
  isSecondary,
  onSelectPage,
  onDeletePage,
  editTarget,
  editDraft,
  setEditDraft,
  setEditTarget,
  commitRename,
  cancelRename,
}) => {
  const editingPage =
    editTarget?.kind === 'page' &&
    editTarget.id === page.id &&
    editTarget.sectionId === sectionId;

  return (
    <div
      className={cn(
        'group flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 transition',
        isActive && 'bg-[var(--spine)] text-white shadow-sm',
        isSecondary && !isActive && 'bg-brand-100 text-[var(--spine)] dark:bg-brand-900/40',
        !isActive && !isSecondary && 'hover:bg-[var(--gutter)]'
      )}
      onClick={(e) => onSelectPage(page.id, e.shiftKey)}
    >
      <FileText
        className={cn(
          'h-3 w-3 shrink-0',
          isActive ? 'opacity-90' : 'text-[var(--app-muted)]'
        )}
      />
      {editingPage ? (
        <input
          autoFocus
          className="min-w-0 flex-1 rounded border border-brand-200 bg-white px-1 py-0.5 text-xs text-gray-900"
          value={editDraft}
          onChange={(e) => setEditDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitRename();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              cancelRename();
            }
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="min-w-0 flex-1 truncate text-xs">
          <span className={cn('mr-1 tabular-nums opacity-60', isActive && 'opacity-80')}>
            {pageIndex}.
          </span>
          {page.title}
        </span>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setEditTarget({ kind: 'page', sectionId, id: page.id });
          setEditDraft(page.title);
        }}
        className={cn(
          'rounded p-1 opacity-0 transition group-hover:opacity-100 focus:opacity-100',
          isActive ? 'hover:bg-white/15' : 'hover:bg-[var(--paper)]'
        )}
        title="Rename page"
        aria-label="Rename page"
      >
        <Pencil className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDeletePage(sectionId, page.id);
        }}
        className={cn(
          'rounded p-1 opacity-0 transition group-hover:opacity-100 focus:opacity-100',
          isActive ? 'hover:bg-white/15' : 'hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40'
        )}
        title="Delete page"
        aria-label="Delete page"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
};

export default Sidebar;
