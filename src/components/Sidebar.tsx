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
import { motion, AnimatePresence } from 'motion/react';
import { Logo } from './Logo';

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

  return (
    <div className="flex h-full min-w-0 w-full flex-col select-none border-r border-gray-200 bg-white text-gray-900 dark:border-[var(--app-border)] dark:bg-[var(--app-bg)] dark:text-[var(--app-fg)]">
      <div className="shrink-0 p-4 border-b border-gray-200 dark:border-[var(--app-border)] bg-white dark:bg-[var(--app-surface)] flex items-center justify-between gap-2">
        <h1 className="font-bold text-gray-900 dark:text-[var(--app-fg)] flex items-center gap-2 min-w-0 truncate">
          <Logo className="h-7 w-auto shrink-0" />
          <span className="truncate">Lumina Notes</span>
        </h1>
        <button 
          onClick={onAddNotebook}
          className="p-1.5 hover:bg-gray-100 dark:hover:bg-[var(--app-bg)] rounded-md transition-colors text-gray-900 dark:text-[var(--app-fg)]/95"
          title="New Notebook"
        >
          <Plus className="w-4 h-4 text-gray-900 dark:text-[var(--app-muted)]" />
        </button>
      </div>

      {dualPageOpen && (
        <div className="mx-4 mb-2 px-3 py-2 rounded-lg bg-teal-50 dark:bg-teal-950/60 border border-teal-100/80 dark:border-teal-800 text-[11px] text-teal-900 dark:text-teal-100 leading-snug shrink-0">
          <span className="font-semibold">Two notes:</span> click a page for the{' '}
          <span className="text-brand-700 dark:text-brand-300 font-medium">left</span> pane ·{' '}
          <kbd className="px-1 py-0.5 rounded bg-white dark:bg-[var(--app-surface)] border border-teal-200/80 dark:border-teal-700 font-mono text-[10px] text-teal-900 dark:text-teal-100">
            Shift
          </kbd>
          +click for the <span className="text-teal-800 dark:text-teal-200 font-medium">right</span> pane
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-2 min-h-0">
        {notebooks.map((notebook) => (
          <NotebookItem
            key={notebook.id}
            notebook={notebook}
            isActive={activeNotebookId === notebook.id}
            activeSectionId={activeSectionId}
            activePageId={activePageId}
            secondaryPageId={secondaryPageId}
            dualPageOpen={dualPageOpen}
            onSelectNotebook={onSelectNotebook}
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
  );
};

interface NotebookItemProps {
  notebook: Notebook;
  isActive: boolean;
  activeSectionId: string | null;
  activePageId: string | null;
  secondaryPageId: string | null;
  dualPageOpen: boolean;
  onSelectNotebook: (id: string) => void;
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
  activeSectionId,
  activePageId,
  secondaryPageId,
  dualPageOpen,
  onSelectNotebook,
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
  const [isOpen, setIsOpen] = React.useState(isActive);
  const editingNotebook =
    editTarget?.kind === 'notebook' && editTarget.id === notebook.id;

  return (
    <div className="mb-1">
      <div 
        className={cn(
          "group flex items-center px-4 py-2 cursor-pointer text-gray-900 dark:text-[var(--app-fg)] hover:bg-gray-100 dark:hover:bg-[var(--app-surface)]/90 transition-colors",
          isActive && "bg-gray-100 dark:bg-[var(--app-surface)] border-l-4 border-brand-600 font-medium"
        )}
        onClick={() => {
          onSelectNotebook(notebook.id);
          setIsOpen(!isOpen);
        }}
      >
        <div className="mr-2">
          {isOpen ? <ChevronDown className="w-4 h-4 text-gray-700 dark:text-[var(--app-muted)]" /> : <ChevronRight className="w-4 h-4 text-gray-700 dark:text-[var(--app-muted)]" />}
        </div>
        <Book className="w-4 h-4 mr-2 text-gray-900 dark:text-brand-400 opacity-90 dark:opacity-70 shrink-0" />
        {editingNotebook ? (
          <input
            autoFocus
            className="flex-1 min-w-0 text-sm font-medium text-gray-900 dark:text-[var(--app-fg)] bg-white dark:bg-[var(--app-bg)] border border-brand-300 dark:border-brand-500 rounded px-1.5 py-0.5"
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
          <span className="flex-1 text-sm font-medium text-gray-900 dark:text-[var(--app-fg)] truncate">{notebook.title}</span>
        )}
        <div className="hidden group-hover:flex items-center gap-1 shrink-0">
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setEditTarget({ kind: 'notebook', id: notebook.id });
              setEditDraft(notebook.title);
            }}
            className="p-1 hover:bg-gray-200 dark:hover:bg-[var(--app-surface)] rounded text-gray-900 dark:text-[var(--app-fg)]/95"
            title="Rename notebook"
          >
            <Edit2 className="w-3 h-3 text-gray-800 dark:text-[var(--app-muted)]" />
          </button>
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); onAddSection(notebook.id); }}
            className="p-1 hover:bg-gray-200 dark:hover:bg-[var(--app-surface)] rounded text-gray-900 dark:text-[var(--app-fg)]/95"
            title="Add section"
          >
            <Plus className="w-3 h-3 text-gray-800 dark:text-[var(--app-muted)]" />
          </button>
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); onArchiveNotebook(notebook.id); }}
            className="p-1 hover:bg-gray-200 rounded text-amber-800 dark:text-amber-400"
            title="Archive notebook (recover from Bookshelf → Archived)"
          >
            <Archive className="w-3 h-3" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {notebook.sections.map((section) => (
              <SectionItem
                key={section.id}
                notebookId={notebook.id}
                section={section}
                isActive={activeSectionId === section.id}
                activePageId={activePageId}
                secondaryPageId={secondaryPageId}
                dualPageOpen={dualPageOpen}
                onSelectSection={onSelectSection}
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface SectionItemProps {
  notebookId: string;
  section: Section;
  isActive: boolean;
  activePageId: string | null;
  secondaryPageId: string | null;
  dualPageOpen: boolean;
  onSelectSection: (id: string) => void;
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
  activePageId,
  secondaryPageId,
  dualPageOpen,
  onSelectSection,
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
  const [isOpen, setIsOpen] = React.useState(isActive);
  const editingSection =
    editTarget?.kind === 'section' &&
    editTarget.id === section.id &&
    editTarget.notebookId === notebookId;

  return (
    <div className="ml-4">
      <div 
        className={cn(
          "group flex items-center px-4 py-1.5 cursor-pointer hover:bg-gray-100 dark:hover:bg-[var(--app-surface)]/90 transition-colors rounded-l-md text-gray-900 dark:text-[var(--app-fg)]/95",
          isActive && "bg-gray-100 dark:bg-[var(--app-surface)] text-gray-900 dark:text-brand-200 font-semibold"
        )}
        onClick={() => {
          onSelectSection(section.id);
          setIsOpen(!isOpen);
        }}
      >
        <div className="mr-2">
          {isOpen ? <ChevronDown className="w-3 h-3 text-gray-700 dark:text-[var(--app-muted)]" /> : <ChevronRight className="w-3 h-3 text-gray-700 dark:text-[var(--app-muted)]" />}
        </div>
        <Hash className="w-3 h-3 mr-2 text-gray-700 dark:text-[var(--app-muted)] shrink-0" />
        {editingSection ? (
          <input
            autoFocus
            className="flex-1 min-w-0 text-xs bg-white dark:bg-[var(--app-bg)] text-gray-900 dark:text-[var(--app-fg)] border border-brand-300 dark:border-brand-500 rounded px-1.5 py-0.5"
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
          <span
            className={cn(
              'flex-1 text-xs truncate',
              !isActive && 'text-gray-900 dark:text-[var(--app-fg)]/95',
            )}
          >
            {section.title}
          </span>
        )}
        <div className="hidden group-hover:flex items-center gap-1 shrink-0">
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setEditTarget({ kind: 'section', notebookId, id: section.id });
              setEditDraft(section.title);
            }}
            className="p-1 hover:bg-gray-200 dark:hover:bg-[var(--app-surface)] rounded text-gray-900 dark:text-[var(--app-fg)]/95"
            title="Rename section"
          >
            <Edit2 className="w-3 h-3 text-gray-800 dark:text-[var(--app-muted)]" />
          </button>
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); onAddPage(section.id); }}
            className="p-1 hover:bg-gray-200 dark:hover:bg-[var(--app-surface)] rounded text-gray-900 dark:text-[var(--app-fg)]/95"
            title="Add page"
          >
            <Plus className="w-3 h-3 text-gray-800 dark:text-[var(--app-muted)]" />
          </button>
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); onDeleteSection(notebookId, section.id); }}
            className="p-1 hover:bg-gray-200 dark:hover:bg-[var(--app-surface)] rounded text-red-600 dark:text-red-400"
            title="Delete section"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
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
          </motion.div>
        )}
      </AnimatePresence>
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
        'group flex items-center ml-6 px-4 py-1.5 cursor-pointer hover:bg-gray-100 dark:hover:bg-[var(--app-surface)]/90 transition-colors rounded-l-md text-gray-900 dark:text-[var(--app-fg)]/95',
        isActive && 'bg-gray-100 dark:bg-[var(--app-surface)] text-gray-900 dark:text-brand-200 font-medium border-l-2 border-brand-600',
        !isActive &&
          isSecondary &&
          'bg-teal-50/90 dark:bg-teal-950/70 text-teal-900 dark:text-teal-100 border-l-2 border-teal-500 dark:border-teal-400'
      )}
      onClick={(e) => {
        const asSecondary = e.shiftKey;
        onSelectPage(page.id, asSecondary);
      }}
    >
      <FileText className="w-3 h-3 mr-2 text-gray-700 dark:text-[var(--app-muted)] shrink-0" />
      {editingPage ? (
        <input
          autoFocus
          className="flex-1 min-w-0 text-[11px] bg-white dark:bg-[var(--app-bg)] text-gray-900 dark:text-[var(--app-fg)] border border-brand-300 dark:border-brand-500 rounded px-1.5 py-0.5"
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
        <span
          className={cn(
            'flex-1 text-[11px] truncate',
            !isActive && !isSecondary && 'text-gray-900 dark:text-[var(--app-fg)]',
          )}
        >
          {page.title}
        </span>
      )}
      <div className="hidden group-hover:flex items-center gap-1 shrink-0">
        <button 
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setEditTarget({ kind: 'page', sectionId, id: page.id });
            setEditDraft(page.title);
          }}
          className="p-1 hover:bg-gray-200 dark:hover:bg-[var(--app-surface)] rounded text-gray-900 dark:text-[var(--app-fg)]/95"
          title="Rename page"
        >
          <Edit2 className="w-3 h-3 text-gray-800 dark:text-[var(--app-muted)]" />
        </button>
        <button 
          type="button"
          onClick={(e) => { e.stopPropagation(); onDeletePage(sectionId, page.id); }}
          className="p-1 hover:bg-gray-200 dark:hover:bg-[var(--app-surface)] rounded text-red-600 dark:text-red-400"
          title="Delete page"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
