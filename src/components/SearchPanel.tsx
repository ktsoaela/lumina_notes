import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, X, Book, Hash, FileText, Globe } from 'lucide-react';
import type { AppState } from '../types';
import {
  searchNotes,
  scopeLabel,
  type SearchScope,
  type SearchResult,
} from '../lib/search';
import { cn } from '../lib/utils';

interface SearchPanelProps {
  open: boolean;
  onClose: () => void;
  state: AppState;
  onNavigate: (n: {
    notebookId: string;
    sectionId: string | null;
    pageId: string | null;
  }) => void;
}

const SCOPES: { id: SearchScope; icon: React.ReactNode }[] = [
  { id: 'global', icon: <Globe className="w-3.5 h-3.5" /> },
  { id: 'notebook', icon: <Book className="w-3.5 h-3.5" /> },
  { id: 'section', icon: <Hash className="w-3.5 h-3.5" /> },
  { id: 'page', icon: <FileText className="w-3.5 h-3.5" /> },
];

export function SearchPanel({ open, onClose, state, onNavigate }: SearchPanelProps) {
  const [query, setQuery] = React.useState('');
  const [scope, setScope] = React.useState<SearchScope>('global');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setScope('global');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const scopeDisabled = (s: SearchScope): string | null => {
    if (s === 'global') return null;
    if (s === 'notebook' && !state.activeNotebookId) {
      return 'Open or select a notebook first';
    }
    if (s === 'section' && (!state.activeNotebookId || !state.activeSectionId)) {
      return 'Select a section in the sidebar first';
    }
    if (
      s === 'page' &&
      (!state.activeNotebookId || !state.activeSectionId || !state.activePageId)
    ) {
      return 'Open a page first';
    }
    return null;
  };

  const results = useMemo(
    () => searchNotes(state, query, scope),
    [state, query, scope]
  );

  const [selected, setSelected] = React.useState(0);
  React.useEffect(() => {
    setSelected(0);
  }, [query, scope, results.length]);

  const applyResult = useCallback(
    (r: SearchResult) => {
      if (r.kind === 'notebook') {
        onNavigate({
          notebookId: r.notebookId,
          sectionId: null,
          pageId: null,
        });
      } else if (r.kind === 'section') {
        onNavigate({
          notebookId: r.notebookId,
          sectionId: r.sectionId,
          pageId: null,
        });
      } else {
        onNavigate({
          notebookId: r.notebookId,
          sectionId: r.sectionId,
          pageId: r.pageId,
        });
      }
      onClose();
    },
    [onNavigate, onClose]
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close search"
            className="fixed inset-0 z-[100] bg-black/30 backdrop-blur-[1px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Search notes"
            className="fixed left-1/2 top-[12vh] z-[101] w-[min(100%,560px)] -translate-x-1/2 px-4"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          >
            <div className="rounded-2xl border border-gray-200 bg-white shadow-2xl shadow-purple-900/10 overflow-hidden">
              <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
                <Search className="w-4 h-4 shrink-0 text-gray-400" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setSelected((i) =>
                        Math.min(i + 1, Math.max(0, results.length - 1))
                      );
                    }
                    if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setSelected((i) => Math.max(0, i - 1));
                    }
                    if (e.key === 'Enter' && results[selected]) {
                      e.preventDefault();
                      applyResult(results[selected]);
                    }
                  }}
                  placeholder="Search notebook, section, or page…"
                  className="min-w-0 flex-1 bg-transparent py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 bg-gray-50/80 border-b border-gray-100">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mr-1">
                  Scope
                </span>
                {SCOPES.map(({ id, icon }) => {
                  const hint = scopeDisabled(id);
                  const active = scope === id;
                  const disabled = !!hint;
                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={disabled}
                      title={hint || scopeLabel(id)}
                      onClick={() => setScope(id)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors',
                        active
                          ? 'bg-purple-600 text-white'
                          : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50',
                        disabled && 'opacity-40 cursor-not-allowed'
                      )}
                    >
                      {icon}
                      {scopeLabel(id)}
                    </button>
                  );
                })}
              </div>

              <div className="max-h-[min(50vh,360px)] overflow-y-auto py-1">
                {!query.trim() && (
                  <p className="px-4 py-8 text-center text-xs text-gray-400">
                    Type a query to search {scopeLabel(scope).toLowerCase()}.
                  </p>
                )}
                {query.trim() && results.length === 0 && (
                  <p className="px-4 py-8 text-center text-xs text-gray-500">
                    No matches.
                  </p>
                )}
                {results.map((r, i) => (
                  <button
                    key={`${r.kind}-${i}-${r.kind === 'notebook' ? r.notebookId : r.kind === 'section' ? r.sectionId : r.pageId}`}
                    type="button"
                    onClick={() => applyResult(r)}
                    className={cn(
                      'flex w-full flex-col gap-0.5 px-4 py-2.5 text-left text-sm transition-colors border-b border-gray-50 last:border-0',
                      i === selected ? 'bg-purple-100' : 'hover:bg-purple-50'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {r.kind === 'notebook' && (
                        <Book className="w-3.5 h-3.5 shrink-0 text-purple-600" />
                      )}
                      {r.kind === 'section' && (
                        <Hash className="w-3.5 h-3.5 shrink-0 text-purple-600" />
                      )}
                      {r.kind === 'page' && (
                        <FileText className="w-3.5 h-3.5 shrink-0 text-purple-600" />
                      )}
                      <span className="font-medium text-gray-900 truncate">{r.label}</span>
                    </div>
                    {'breadcrumb' in r && r.breadcrumb && (
                      <span className="pl-5 text-[10px] text-gray-500 truncate">
                        {r.breadcrumb}
                      </span>
                    )}
                    {r.snippet && r.kind === 'page' && (
                      <span className="pl-5 text-[11px] text-gray-500 line-clamp-2 font-mono">
                        {r.snippet}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2 text-[10px] text-gray-400 bg-gray-50/50">
                <span>
                  <kbd className="rounded border border-gray-200 bg-white px-1 font-mono">↑</kbd>
                  <kbd className="rounded border border-gray-200 bg-white px-1 font-mono">↓</kbd> move ·{' '}
                  <kbd className="rounded border border-gray-200 bg-white px-1 font-mono">Enter</kbd> open
                </span>
                <span>
                  <kbd className="rounded border border-gray-200 bg-white px-1 font-mono">Esc</kbd> close
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/** Hook parent uses for Ctrl/Cmd+K */
export function useSearchHotkey(onOpen: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpen();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onOpen, enabled]);
}
