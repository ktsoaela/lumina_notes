import React from 'react';
import { 
  Book, 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  FileText, 
  Hash, 
  Trash2,
  Edit2
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
  onSelectNotebook: (id: string) => void;
  onSelectSection: (id: string) => void;
  onSelectPage: (id: string) => void;
  onAddNotebook: () => void;
  onAddSection: (notebookId: string) => void;
  onAddPage: (sectionId: string) => void;
  onDeleteNotebook: (id: string) => void;
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
  onSelectNotebook,
  onSelectSection,
  onSelectPage,
  onAddNotebook,
  onAddSection,
  onAddPage,
  onDeleteNotebook,
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
    <div className="flex flex-col h-full min-w-0 bg-[#f3f2f1] border-r border-gray-200 w-full select-none">
      <div className="shrink-0 p-4 border-b border-gray-200 flex items-center justify-between gap-2">
        <h1 className="font-bold text-gray-800 flex items-center gap-2 min-w-0 truncate">
          <Logo className="h-7 w-auto shrink-0" />
          <span className="truncate">Lumina Notes</span>
        </h1>
        <button 
          onClick={onAddNotebook}
          className="p-1.5 hover:bg-gray-200 rounded-md transition-colors"
          title="New Notebook"
        >
          <Plus className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {notebooks.map((notebook) => (
          <NotebookItem
            key={notebook.id}
            notebook={notebook}
            isActive={activeNotebookId === notebook.id}
            activeSectionId={activeSectionId}
            activePageId={activePageId}
            onSelectNotebook={onSelectNotebook}
            onSelectSection={onSelectSection}
            onSelectPage={onSelectPage}
            onAddSection={onAddSection}
            onAddPage={onAddPage}
            onDeleteNotebook={onDeleteNotebook}
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
  onSelectNotebook: (id: string) => void;
  onSelectSection: (id: string) => void;
  onSelectPage: (id: string) => void;
  onAddSection: (notebookId: string) => void;
  onAddPage: (sectionId: string) => void;
  onDeleteNotebook: (id: string) => void;
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
  onSelectNotebook,
  onSelectSection,
  onSelectPage,
  onAddSection,
  onAddPage,
  onDeleteNotebook,
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
          "group flex items-center px-4 py-2 cursor-pointer hover:bg-gray-200 transition-colors",
          isActive && "bg-white border-l-4 border-purple-600"
        )}
        onClick={() => {
          onSelectNotebook(notebook.id);
          setIsOpen(!isOpen);
        }}
      >
        <div className="mr-2">
          {isOpen ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
        </div>
        <Book className="w-4 h-4 mr-2 text-purple-600 opacity-70 shrink-0" />
        {editingNotebook ? (
          <input
            autoFocus
            className="flex-1 min-w-0 text-sm font-medium text-gray-700 bg-white border border-purple-300 rounded px-1.5 py-0.5"
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
          <span className="flex-1 text-sm font-medium text-gray-700 truncate">{notebook.title}</span>
        )}
        <div className="hidden group-hover:flex items-center gap-1 shrink-0">
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setEditTarget({ kind: 'notebook', id: notebook.id });
              setEditDraft(notebook.title);
            }}
            className="p-1 hover:bg-gray-300 rounded"
            title="Rename notebook"
          >
            <Edit2 className="w-3 h-3 text-gray-500" />
          </button>
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); onAddSection(notebook.id); }}
            className="p-1 hover:bg-gray-300 rounded"
            title="Add section"
          >
            <Plus className="w-3 h-3 text-gray-500" />
          </button>
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); onDeleteNotebook(notebook.id); }}
            className="p-1 hover:bg-gray-300 rounded text-red-500"
            title="Delete notebook"
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
            {notebook.sections.map((section) => (
              <SectionItem
                key={section.id}
                notebookId={notebook.id}
                section={section}
                isActive={activeSectionId === section.id}
                activePageId={activePageId}
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
  onSelectSection: (id: string) => void;
  onSelectPage: (id: string) => void;
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
          "group flex items-center px-4 py-1.5 cursor-pointer hover:bg-gray-200 transition-colors rounded-l-md",
          isActive && "bg-white text-purple-700 font-semibold"
        )}
        onClick={() => {
          onSelectSection(section.id);
          setIsOpen(!isOpen);
        }}
      >
        <div className="mr-2">
          {isOpen ? <ChevronDown className="w-3 h-3 text-gray-400" /> : <ChevronRight className="w-3 h-3 text-gray-400" />}
        </div>
        <Hash className="w-3 h-3 mr-2 text-gray-400 shrink-0" />
        {editingSection ? (
          <input
            autoFocus
            className="flex-1 min-w-0 text-xs bg-white border border-purple-300 rounded px-1.5 py-0.5"
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
          <span className="flex-1 text-xs truncate">{section.title}</span>
        )}
        <div className="hidden group-hover:flex items-center gap-1 shrink-0">
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setEditTarget({ kind: 'section', notebookId, id: section.id });
              setEditDraft(section.title);
            }}
            className="p-1 hover:bg-gray-300 rounded"
            title="Rename section"
          >
            <Edit2 className="w-3 h-3 text-gray-500" />
          </button>
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); onAddPage(section.id); }}
            className="p-1 hover:bg-gray-300 rounded"
            title="Add page"
          >
            <Plus className="w-3 h-3 text-gray-500" />
          </button>
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); onDeleteSection(notebookId, section.id); }}
            className="p-1 hover:bg-gray-300 rounded text-red-500"
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
  onSelectPage: (id: string) => void;
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
        "group flex items-center ml-6 px-4 py-1.5 cursor-pointer hover:bg-gray-200 transition-colors rounded-l-md",
        isActive && "bg-white text-purple-700 font-medium"
      )}
      onClick={() => onSelectPage(page.id)}
    >
      <FileText className="w-3 h-3 mr-2 text-gray-400 shrink-0" />
      {editingPage ? (
        <input
          autoFocus
          className="flex-1 min-w-0 text-[11px] bg-white border border-purple-300 rounded px-1.5 py-0.5"
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
        <span className="flex-1 text-[11px] truncate">{page.title}</span>
      )}
      <div className="hidden group-hover:flex items-center gap-1 shrink-0">
        <button 
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setEditTarget({ kind: 'page', sectionId, id: page.id });
            setEditDraft(page.title);
          }}
          className="p-1 hover:bg-gray-300 rounded"
          title="Rename page"
        >
          <Edit2 className="w-3 h-3 text-gray-500" />
        </button>
        <button 
          type="button"
          onClick={(e) => { e.stopPropagation(); onDeletePage(sectionId, page.id); }}
          className="p-1 hover:bg-gray-300 rounded text-red-500"
          title="Delete page"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
