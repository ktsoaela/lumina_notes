import React from 'react';
import { 
  Book, 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  FileText, 
  Hash, 
  Trash2,
  Edit2,
  Archive,
} from 'lucide-react';
import { Notebook, Section, Page } from '../types';
import { cn } from '../lib/utils';
import { Logo } from './Logo';
import { virtualWindow } from '../lib/virtualWindow';

const NOTEBOOK_ROW_H = 36;

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
  /** Normal click selects the left (primary) page; Shift+click selects the right page when two-notes mode is on */
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
  /** Expansion is independent of selection (like workbook/workbook Sidebar). */
  const [expandedNotebookIds, setExpandedNotebookIds] = React.useState<Set<string>>(() => new Set());
  const [expandedSectionIds, setExpandedSectionIds] = React.useState<Set<string>>(() => new Set());

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
      onRenameNotebook(editTarget.id, v || 'Untitled Notebook');
    } else if (editTarget.kind === 'section') {
      onRenameSection(editTarget.notebookId, editTarget.id, v || 'Untitled Section');
    } else {
      onRenamePage(editTarget.sectionId, editTarget.id, v || 'Untitled');
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

  // ponytail: virtualize only when sidebar has many binders (bookshelf already pages charts)
  const useVirt = notebooks.length > 40;
  const win = useVirt
    ? virtualWindow(notebooks.length, NOTEBOOK_ROW_H, scrollTop, viewportH)
    : { start: 0, end: notebooks.length, offsetY: 0, totalH: 0 };
  const visibleNotebooks = notebooks.slice(win.start, win.end);

  return (
    <div className="flex h-full min-w-0 w-full flex-col select-none border-r border-gray-200 bg-gray-50 text-gray-900 dark:border-[var(--app-border)] dark:bg-[var(--app-bg)] dark:text-[var(--app-fg)]">
      <div className="shrink-0 border-b border-gray-200 bg-gray-50 p-4 dark:border-[var(--app-border)] dark:bg-[var(--app-surface)]">
        <div className="flex items-center justify-between gap-2">
          <h1 className="flex min-w-0 items-center gap-2 truncate text-lg font-semibold text-gray-900 dark:text-[var(--app-fg)]">
            <Logo className="h-7 w-auto shrink-0" />
            <span className="truncate">Lumina Notes</span>
          </h1>
          <button
            type="button"
            onClick={onAddNotebook}
            className="rounded-md p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-[var(--app-muted)] dark:hover:bg-[var(--app-bg)] dark:hover:text-[var(--app-fg)]"
            title="New Notebook"
            aria-label="New notebook"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {dualPageOpen && (
        <div className="mx-4 mb-2 rounded-md border border-gray-200 border-l-4 border-l-[#174a73] bg-gray-50 px-3 py-2 text-[11px] text-gray-900 dark:border-[var(--app-border)] dark:bg-[var(--app-surface)]/80 dark:text-[var(--app-fg)] leading-snug shrink-0">
          <span className="font-semibold">Two notes:</span> click a page for the{' '}
          <span className="font-medium text-[#174a73]">left</span> pane ·{' '}
          <kbd className="rounded border border-gray-200 bg-white px-1 py-0.5 font-mono text-[10px] dark:border-[var(--app-border)] dark:bg-[var(--app-bg)]">
            Shift
          </kbd>
          +click for the <span className="font-medium text-[#174a73]">right</span> pane
        </div>
      )}

      <div
        ref={listRef}
        className="min-h-0 flex-1 overflow-y-auto p-2"
        role="navigation"
        aria-label="Notebooks"
        onScroll={(e) => {
          if (useVirt) setScrollTop(e.currentTarget.scrollTop);
        }}
      >
        {useVirt ? (
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
                  activeSectionId={activeSectionId}
                  activePageId={activePageId}
                  secondaryPageId={secondaryPageId}
                  dualPageOpen={dualPageOpen}
                  expandedSectionIds={expandedSectionIds}
                  setExpandedSectionIds={setExpandedSectionIds}
                  onSelectSection={onSelectSection}
                  onSelectPage={onSelectPage}
                  onAddSection={onAddSection}
                  onAddPage={onAddPage}
                  onArchiveNotebook={onArchiveNotebook}
                  onDeleteSection={onDeleteSection}
                  onDeletePage={onDeletePage}
                  editTarget={editTarget}
                  editDraft={editDraft}
                  setEditDraft={setEditDraft}
                  setEditTarget={setEditTarget}
                  commitRename={commitRename}
                  cancelRename={cancelRename}
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
              activeSectionId={activeSectionId}
              activePageId={activePageId}
              secondaryPageId={secondaryPageId}
              dualPageOpen={dualPageOpen}
              expandedSectionIds={expandedSectionIds}
              setExpandedSectionIds={setExpandedSectionIds}
              onSelectSection={onSelectSection}
              onSelectPage={onSelectPage}
              onAddSection={onAddSection}
              onAddPage={onAddPage}
              onArchiveNotebook={onArchiveNotebook}
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
    </div>
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

  return (
    <div className="mb-2">
      <div
        className={cn(
          'group flex cursor-pointer items-center justify-between rounded-md border p-2 transition-colors',
          isActive
            ? 'border-[#174a73] text-[#174a73] dark:text-[var(--app-fg)]'
            : 'border-transparent text-gray-900 hover:bg-gray-100 dark:text-[var(--app-fg)] dark:hover:bg-[var(--app-surface)]/90'
        )}
        onClick={onNotebookRowClick}
      >
        <div className="flex min-w-0 flex-1 items-center">
          <button
            type="button"
            aria-expanded={isExpanded}
            className="mr-1 shrink-0 p-1 text-gray-500 hover:text-gray-700 dark:text-[var(--app-muted)] dark:hover:text-[var(--app-fg)]"
            onClick={(e) => {
              e.stopPropagation();
              onToggleNotebookExpand();
            }}
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
          <Book
            className={cn(
              'mr-2 h-4 w-4 shrink-0',
              !isActive && 'text-gray-900 dark:text-[var(--app-fg)]'
            )}
          />
          {editingNotebook ? (
            <input
              autoFocus
              className="min-w-0 flex-1 rounded border border-brand-300 bg-white px-1.5 py-0.5 text-sm font-medium text-gray-900 dark:border-brand-500 dark:bg-[var(--app-bg)] dark:text-[var(--app-fg)]"
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
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{notebook.title}</span>
          )}
        </div>
        <div className="flex shrink-0 items-center space-x-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setEditTarget({ kind: 'notebook', id: notebook.id });
              setEditDraft(notebook.title);
            }}
            className="rounded p-1 text-gray-400 opacity-60 transition-opacity hover:text-gray-700 group-hover:opacity-100 dark:hover:text-[var(--app-fg)]"
            title="Rename notebook"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAddSection(notebook.id);
            }}
            className="rounded p-1 text-gray-400 opacity-60 transition-opacity hover:text-gray-700 group-hover:opacity-100 dark:hover:text-[var(--app-fg)]"
            title="Add section"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onArchiveNotebook(notebook.id);
            }}
            className="rounded p-1 text-amber-700 opacity-60 transition-opacity hover:text-amber-900 group-hover:opacity-100 dark:text-amber-400 dark:hover:text-amber-300"
            title="Archive notebook (recover from Bookshelf → Archived)"
          >
            <Archive className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="ml-6 mt-1 space-y-1">
          {notebook.sections.map((section) => (
            <SectionItem
              key={section.id}
              notebookId={notebook.id}
              section={section}
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
          ))}
        </div>
      )}
    </div>
  );
};

interface SectionItemProps {
  notebookId: string;
  section: Section;
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
          'group flex cursor-pointer items-center justify-between rounded-md border p-2 transition-colors',
          isActive
            ? 'border-[#174a73] text-[#174a73] dark:text-[var(--app-fg)]'
            : 'border-transparent text-gray-900 hover:bg-gray-100 dark:text-[var(--app-fg)] dark:hover:bg-[var(--app-surface)]/90'
        )}
        onClick={onSectionRowClick}
      >
        <div className="flex min-w-0 flex-1 items-center">
          <button
            type="button"
            aria-expanded={isExpanded}
            className="mr-1 shrink-0 p-1 text-gray-500 hover:text-gray-700 dark:text-[var(--app-muted)] dark:hover:text-[var(--app-fg)]"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSectionExpand();
            }}
            title={isExpanded ? 'Collapse section' : 'Expand section'}
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
          <Hash
            className={cn(
              'mr-2 h-3.5 w-3.5 shrink-0',
              !isActive && 'text-gray-600 dark:text-[var(--app-muted)]'
            )}
          />
          {editingSection ? (
            <input
              autoFocus
              className="min-w-0 flex-1 rounded border border-brand-300 bg-white px-1.5 py-0.5 text-sm text-gray-900 dark:border-brand-500 dark:bg-[var(--app-bg)] dark:text-[var(--app-fg)]"
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
            <span className="min-w-0 flex-1 truncate text-sm">{section.title}</span>
          )}
        </div>
        <div className="flex shrink-0 items-center space-x-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setEditTarget({ kind: 'section', notebookId, id: section.id });
              setEditDraft(section.title);
            }}
            className="rounded p-1 text-gray-400 opacity-60 transition-opacity hover:text-gray-700 group-hover:opacity-100 dark:hover:text-[var(--app-fg)]"
            title="Rename section"
          >
            <Edit2 className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAddPage(section.id);
            }}
            className="rounded p-1 text-gray-400 opacity-60 transition-opacity hover:text-gray-700 group-hover:opacity-100 dark:hover:text-[var(--app-fg)]"
            title="Add page"
          >
            <Plus className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteSection(notebookId, section.id);
            }}
            className="rounded p-1 text-red-500 opacity-60 transition-opacity hover:text-red-700 group-hover:opacity-100 dark:text-red-400 dark:hover:text-red-300"
            title="Delete section"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="ml-6 mt-1 space-y-1">
          {section.pages.map((page) => (
            <PageRow
              key={page.id}
              sectionId={section.id}
              page={page}
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
          ))}
        </div>
      )}
    </div>
  );
};

interface PageRowProps {
  sectionId: string;
  page: Page;
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
        'group relative flex cursor-pointer items-center justify-between rounded-md border p-2 transition-colors',
        isActive || isSecondary
          ? 'border-[#174a73] text-[#174a73] dark:text-[var(--app-fg)]'
          : 'border-transparent text-gray-900 hover:bg-gray-100 dark:text-[var(--app-fg)] dark:hover:bg-[var(--app-surface)]/90'
      )}
      onClick={(e) => {
        const asSecondary = e.shiftKey;
        onSelectPage(page.id, asSecondary);
      }}
    >
      <div className="flex min-w-0 flex-1 items-center">
        <FileText
          className={cn(
            'mr-2 h-3 w-3 shrink-0',
            !(isActive || isSecondary) && 'text-gray-600 dark:text-[var(--app-muted)]'
          )}
        />
        {editingPage ? (
          <input
            autoFocus
            className="min-w-0 flex-1 rounded border border-brand-300 bg-white px-1.5 py-0.5 text-sm text-gray-900 dark:border-brand-500 dark:bg-[var(--app-bg)] dark:text-[var(--app-fg)]"
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
          <span className="min-w-0 flex-1 truncate text-sm">{page.title}</span>
        )}
      </div>
      <div className="flex shrink-0 items-center space-x-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setEditTarget({ kind: 'page', sectionId, id: page.id });
            setEditDraft(page.title);
          }}
          className="rounded p-1 text-gray-400 opacity-60 transition-opacity hover:text-gray-700 group-hover:opacity-100 dark:hover:text-[var(--app-fg)]"
          title="Rename page"
        >
          <Edit2 className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDeletePage(sectionId, page.id);
          }}
          className="rounded p-1 text-red-500 opacity-60 transition-opacity hover:text-red-700 group-hover:opacity-100 dark:text-red-400 dark:hover:text-red-300"
          title="Delete page"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
