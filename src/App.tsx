import React, { useState, useEffect, useCallback } from 'react';
import { 
  Group as PanelGroup, 
  Panel, 
  Separator as PanelResizeHandle 
} from 'react-resizable-panels';
import { 
  Notebook, 
  Section, 
  Page, 
  AppState,
  AuthState,
  User
} from './types';
import Sidebar from './components/Sidebar';
import { SearchPanel, useSearchHotkey } from './components/SearchPanel';
import Editor from './components/Editor';
import Preview from './components/Preview';
import LandingPage from './components/LandingPage';
import Auth from './components/Auth';
import { 
  Columns, 
  Eye, 
  Edit3, 
  Save,
  Search,
  Settings,
  HelpCircle,
  Clock,
  ChevronRight,
  Menu,
  FileText,
  LogOut,
  User as UserIcon,
  Loader2
} from 'lucide-react';
import { Logo } from './components/Logo';
import { cn } from './lib/utils';
import { format } from 'date-fns';
import { api } from './lib/api';
import {
  clearSession,
  getInitialAuthState,
  readToken,
  writeSession,
} from './lib/authCache';

export default function App() {
  const [auth, setAuth] = useState<AuthState>(getInitialAuthState);

  const [state, setState] = useState<AppState>({
    notebooks: [],
    activeNotebookId: null,
    activeSectionId: null,
    activePageId: null
  });

  const [viewMode, setViewMode] = useState<'split' | 'edit' | 'preview'>('split');
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [isAppLoading, setIsAppLoading] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  useSearchHotkey(openSearch, !!auth.user);

  // Re-validate JWT on load; signed-in users with a cached profile skip the landing/sign-in flow
  useEffect(() => {
    const token = readToken();
    if (!token) return;

    let cancelled = false;
    (async () => {
      try {
        const user = await api.auth.me();
        if (cancelled) return;
        writeSession(user, token);
        setAuth({ user, token, isLoading: false });
      } catch {
        if (cancelled) return;
        clearSession();
        setAuth({ user: null, token: null, isLoading: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch data when authenticated
  useEffect(() => {
    if (auth.user) {
      fetchData();
    }
  }, [auth.user]);

  const fetchData = async () => {
    setIsAppLoading(true);
    try {
      const notebooks = await api.notebooks.list();
      setState(prev => ({
        ...prev,
        notebooks,
        activeNotebookId: notebooks[0]?.id || null,
        activeSectionId: notebooks[0]?.sections[0]?.id || null,
        activePageId: notebooks[0]?.sections[0]?.pages[0]?.id || null
      }));
    } catch (err) {
      console.error('Failed to fetch data', err);
    } finally {
      setIsAppLoading(false);
    }
  };

  const handleAuthSuccess = (user: User, token: string) => {
    writeSession(user, token);
    setAuth({ user, token, isLoading: false });
    setShowAuth(false);
  };

  const handleLogout = () => {
    clearSession();
    setAuth({ user: null, token: null, isLoading: false });
    setState({
      notebooks: [],
      activeNotebookId: null,
      activeSectionId: null,
      activePageId: null
    });
  };

  const activePage = state.notebooks
    .flatMap(nb => nb.sections)
    .flatMap(sec => sec.pages)
    .find(p => p.id === state.activePageId);

  const updatePageContent = useCallback(async (content: string) => {
    if (!state.activePageId) return;

    // Optimistic update
    setState(prev => ({
      ...prev,
      notebooks: prev.notebooks.map(nb => ({
        ...nb,
        sections: nb.sections.map(sec => ({
          ...sec,
          pages: sec.pages.map(p => 
            p.id === prev.activePageId 
              ? { ...p, content, updatedAt: Date.now() } 
              : p
          )
        }))
      }))
    }));

    try {
      await api.pages.update(state.activePageId, activePage?.title || '', content);
    } catch (err) {
      console.error('Failed to save page content', err);
    }
  }, [state.activePageId, activePage?.title]);

  const updatePageTitle = useCallback(async (title: string) => {
    if (!state.activePageId) return;

    // Optimistic update
    setState(prev => ({
      ...prev,
      notebooks: prev.notebooks.map(nb => ({
        ...nb,
        sections: nb.sections.map(sec => ({
          ...sec,
          pages: sec.pages.map(p => 
            p.id === prev.activePageId 
              ? { ...p, title, updatedAt: Date.now() } 
              : p
          )
        }))
      }))
    }));

    try {
      await api.pages.update(state.activePageId, title, activePage?.content || '');
    } catch (err) {
      console.error('Failed to save page title', err);
    }
  }, [state.activePageId, activePage?.content]);

  const handleAddNotebook = async () => {
    const id = `nb-${Date.now()}`;
    const name = 'New Notebook';
    try {
      await api.notebooks.create(id, name);
      const newNotebook: Notebook = { id, title: name, sections: [] };
      setState(prev => ({
        ...prev,
        notebooks: [...prev.notebooks, newNotebook],
        activeNotebookId: id,
        activeSectionId: null,
        activePageId: null
      }));
    } catch (err) {
      console.error('Failed to add notebook', err);
    }
  };

  const handleAddSection = async (notebookId: string) => {
    const id = `sec-${Date.now()}`;
    const name = 'New Section';
    try {
      await api.sections.create(id, notebookId, name);
      const newSection: Section = { id, title: name, pages: [] };
      setState(prev => ({
        ...prev,
        notebooks: prev.notebooks.map(nb => 
          nb.id === notebookId 
            ? { ...nb, sections: [...nb.sections, newSection] } 
            : nb
        ),
        activeSectionId: id,
        activePageId: null
      }));
    } catch (err) {
      console.error('Failed to add section', err);
    }
  };

  const handleAddPage = async (sectionId: string) => {
    const id = `page-${Date.now()}`;
    const title = 'Untitled Page';
    const content = '';
    try {
      await api.pages.create(id, sectionId, title, content);
      const newPage: Page = { id, title, content, updatedAt: Date.now() };
      setState(prev => ({
        ...prev,
        notebooks: prev.notebooks.map(nb => ({
          ...nb,
          sections: nb.sections.map(sec => 
            sec.id === sectionId 
              ? { ...sec, pages: [...sec.pages, newPage] } 
              : sec
          )
        })),
        activePageId: id
      }));
    } catch (err) {
      console.error('Failed to add page', err);
    }
  };

  const handleRenameNotebook = async (id: string, name: string) => {
    const trimmed = name.trim() || 'Untitled Notebook';
    try {
      await api.notebooks.update(id, trimmed);
      setState(prev => ({
        ...prev,
        notebooks: prev.notebooks.map(nb =>
          nb.id === id ? { ...nb, title: trimmed } : nb
        ),
      }));
    } catch (err) {
      console.error('Failed to rename notebook', err);
    }
  };

  const handleRenameSection = async (notebookId: string, sectionId: string, name: string) => {
    const trimmed = name.trim() || 'Untitled Section';
    try {
      await api.sections.update(sectionId, trimmed);
      setState(prev => ({
        ...prev,
        notebooks: prev.notebooks.map(nb =>
          nb.id === notebookId
            ? {
                ...nb,
                sections: nb.sections.map(sec =>
                  sec.id === sectionId ? { ...sec, title: trimmed } : sec
                ),
              }
            : nb
        ),
      }));
    } catch (err) {
      console.error('Failed to rename section', err);
    }
  };

  const handleRenamePage = async (sectionId: string, pageId: string, title: string) => {
    const trimmed = title.trim() || 'Untitled';
    const page = state.notebooks
      .flatMap(nb => nb.sections)
      .flatMap(sec => sec.pages)
      .find(p => p.id === pageId);
    if (!page) return;
    try {
      await api.pages.update(pageId, trimmed, page.content);
      setState(prev => ({
        ...prev,
        notebooks: prev.notebooks.map(nb => ({
          ...nb,
          sections: nb.sections.map(sec =>
            sec.id === sectionId
              ? {
                  ...sec,
                  pages: sec.pages.map(p =>
                    p.id === pageId ? { ...p, title: trimmed } : p
                  ),
                }
              : sec
          ),
        })),
      }));
    } catch (err) {
      console.error('Failed to rename page', err);
    }
  };

  const handleDeleteNotebook = async (id: string) => {
    try {
      await api.notebooks.delete(id);
      setState(prev => {
        const idx = prev.notebooks.findIndex(nb => nb.id === id);
        const remaining = prev.notebooks.filter(nb => nb.id !== id);
        const wasActive = prev.activeNotebookId === id;
        const fallback = remaining[idx] ?? remaining[idx - 1] ?? remaining[0] ?? null;
        return {
          ...prev,
          notebooks: remaining,
          activeNotebookId: wasActive ? (fallback?.id ?? null) : prev.activeNotebookId,
          activeSectionId: wasActive ? (fallback?.sections[0]?.id ?? null) : prev.activeSectionId,
          activePageId: wasActive ? (fallback?.sections[0]?.pages[0]?.id ?? null) : prev.activePageId,
        };
      });
    } catch (err) {
      console.error('Failed to delete notebook', err);
    }
  };

  const handleDeleteSection = async (notebookId: string, sectionId: string) => {
    try {
      await api.sections.delete(sectionId);
      setState(prev => {
        const nb = prev.notebooks.find(n => n.id === notebookId);
        const secIdx = nb?.sections.findIndex(s => s.id === sectionId) ?? -1;
        const remainingSecs = nb ? nb.sections.filter(s => s.id !== sectionId) : [];
        const fallbackSec =
          remainingSecs[secIdx] ?? remainingSecs[secIdx - 1] ?? remainingSecs[0] ?? null;
        const wasActive = prev.activeSectionId === sectionId;
        return {
          ...prev,
          notebooks: prev.notebooks.map(n =>
            n.id === notebookId ? { ...n, sections: remainingSecs } : n
          ),
          activeSectionId: wasActive ? (fallbackSec?.id ?? null) : prev.activeSectionId,
          activePageId: wasActive ? (fallbackSec?.pages[0]?.id ?? null) : prev.activePageId,
        };
      });
    } catch (err) {
      console.error('Failed to delete section', err);
    }
  };

  const handleDeletePage = async (sectionId: string, pageId: string) => {
    try {
      await api.pages.delete(pageId);
      setState(prev => {
        const nb = prev.notebooks.find(n => n.sections.some(s => s.id === sectionId));
        const sec = nb?.sections.find(s => s.id === sectionId);
        const pIdx = sec?.pages.findIndex(p => p.id === pageId) ?? -1;
        const remainingPages = sec ? sec.pages.filter(p => p.id !== pageId) : [];
        const fallbackPage =
          remainingPages[pIdx] ?? remainingPages[pIdx - 1] ?? remainingPages[0] ?? null;
        const wasActive = prev.activePageId === pageId;
        return {
          ...prev,
          notebooks: prev.notebooks.map(n => ({
            ...n,
            sections: n.sections.map(s =>
              s.id === sectionId ? { ...s, pages: remainingPages } : s
            ),
          })),
          activePageId: wasActive ? (fallbackPage?.id ?? null) : prev.activePageId,
        };
      });
    } catch (err) {
      console.error('Failed to delete page', err);
    }
  };

  if (auth.isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
      </div>
    );
  }

  if (!auth.user) {
    if (showAuth) {
      return <Auth onAuthSuccess={handleAuthSuccess} onBack={() => setShowAuth(false)} />;
    }
    return <LandingPage onGetStarted={() => setShowAuth(true)} />;
  }

  return (
    <div className="flex flex-col h-screen bg-white text-gray-900 font-sans overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="h-12 bg-[#80397b] text-white flex items-center px-4 justify-between shrink-0 select-none">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsSidebarVisible(!isSidebarVisible)}
            className="p-1.5 hover:bg-white/10 rounded-md transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 font-semibold">
            <Logo variant="mono" className="h-7 w-auto" />
            <span className="text-sm">Lumina Notes</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button 
            onClick={() => setViewMode('edit')}
            className={cn("p-2 hover:bg-white/10 rounded-md transition-colors", viewMode === 'edit' && "bg-white/20")}
            title="Edit Mode"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setViewMode('split')}
            className={cn("p-2 hover:bg-white/10 rounded-md transition-colors", viewMode === 'split' && "bg-white/20")}
            title="Split View"
          >
            <Columns className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setViewMode('preview')}
            className={cn("p-2 hover:bg-white/10 rounded-md transition-colors", viewMode === 'preview' && "bg-white/20")}
            title="Preview Mode"
          >
            <Eye className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-white/20 mx-2" />

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-white/90 hover:bg-white/10 transition-colors"
            title="Search (Ctrl+K)"
          >
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden sm:inline rounded border border-white/20 bg-white/10 px-1 font-mono text-[10px]">
              {typeof navigator !== 'undefined' &&
              /Mac|iPhone|iPod|iPad/i.test(navigator.platform)
                ? '⌘K'
                : 'Ctrl+K'}
            </kbd>
          </button>
          
          <div className="flex items-center gap-2 px-2 py-1 hover:bg-white/10 rounded-md transition-colors cursor-default group relative">
            <UserIcon className="w-4 h-4" />
            <span className="text-xs font-medium max-w-[100px] truncate">{auth.user.name}</span>
            <div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-xl shadow-xl border border-gray-100 hidden group-hover:block z-50 p-1">
              <div className="px-3 py-2 border-b border-gray-50">
                <div className="text-xs font-bold text-gray-900 truncate">{auth.user.name}</div>
                <div className="text-[10px] text-gray-500 truncate">{auth.user.email}</div>
              </div>
              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut className="w-3 h-3" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <SearchPanel
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        state={state}
        onNavigate={({ notebookId, sectionId, pageId }) => {
          setState((s) => ({
            ...s,
            activeNotebookId: notebookId,
            activeSectionId: sectionId,
            activePageId: pageId,
          }));
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative">
        {isAppLoading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-50 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
          </div>
        )}
        <PanelGroup orientation="horizontal" className="h-full">
          {isSidebarVisible && (
            <>
              {/* 4/12 default; min/max are % — numeric props are interpreted as px by react-resizable-panels */}
              <Panel
                defaultSize="33.333%"
                minSize="15%"
                maxSize="50%"
                className="min-w-0"
              >
                <Sidebar 
                  notebooks={state.notebooks}
                  activeNotebookId={state.activeNotebookId}
                  activeSectionId={state.activeSectionId}
                  activePageId={state.activePageId}
                  onSelectNotebook={(id) => setState(s => ({ ...s, activeNotebookId: id }))}
                  onSelectSection={(id) => setState(s => ({ ...s, activeSectionId: id }))}
                  onSelectPage={(id) => setState(s => ({ ...s, activePageId: id }))}
                  onAddNotebook={handleAddNotebook}
                  onAddSection={handleAddSection}
                  onAddPage={handleAddPage}
                  onDeleteNotebook={handleDeleteNotebook}
                  onDeleteSection={handleDeleteSection}
                  onDeletePage={handleDeletePage}
                  onRenameNotebook={handleRenameNotebook}
                  onRenameSection={handleRenameSection}
                  onRenamePage={handleRenamePage}
                />
              </Panel>
              <PanelResizeHandle className="w-1 bg-gray-100 hover:bg-purple-200 transition-colors cursor-col-resize shrink-0" />
            </>
          )}

          {/* 8/12 default when sidebar is visible */}
          <Panel
            defaultSize={isSidebarVisible ? "66.667%" : "100%"}
            minSize={isSidebarVisible ? "45%" : "100%"}
            className="min-w-0"
          >
            {activePage ? (
              <div className="flex flex-col h-full">
                {/* Page Header */}
                <div className="px-8 py-6 border-b border-gray-100 bg-white shrink-0">
                  <input 
                    type="text"
                    value={activePage.title}
                    onChange={(e) => updatePageTitle(e.target.value)}
                    className="text-4xl font-bold text-gray-900 border-none focus:outline-none w-full placeholder:text-gray-300"
                    placeholder="Page Title"
                  />
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 font-medium uppercase tracking-wider">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>Last updated: {typeof activePage.updatedAt === 'number' ? format(activePage.updatedAt, 'MMM d, yyyy HH:mm') : activePage.updatedAt}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Save className="w-3 h-3" />
                      <span>Synced to Cloud</span>
                    </div>
                  </div>
                </div>

                {/* Editor/Preview Split */}
                <div className="flex-1 overflow-hidden">
                  <PanelGroup orientation="horizontal">
                    {(viewMode === 'edit' || viewMode === 'split') && (
                      <>
                        <Panel defaultSize={viewMode === 'edit' ? "100%" : "50%"}>
                          <Editor 
                            value={activePage.content}
                            onChange={updatePageContent}
                          />
                        </Panel>
                        {viewMode === 'split' && (
                          <PanelResizeHandle className="w-1 bg-gray-50 hover:bg-purple-100 transition-colors cursor-col-resize" />
                        )}
                      </>
                    )}
                    {(viewMode === 'preview' || viewMode === 'split') && (
                      <Panel defaultSize={viewMode === 'preview' ? "100%" : "50%"}>
                        <Preview content={activePage.content} />
                      </Panel>
                    )}
                  </PanelGroup>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 bg-gray-50">
                <div className="p-8 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center max-w-md text-center">
                  <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mb-6">
                    <FileText className="w-8 h-8 text-purple-600" />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-800 mb-2">No Page Selected</h2>
                  <p className="text-sm leading-relaxed mb-6">
                    Select a page from the sidebar or create a new one to start taking notes. 
                    Lumina supports Markdown, Mermaid diagrams, and Plotly charts.
                  </p>
                  <div className="flex flex-col gap-2 w-full">
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-500 justify-center">
                      <ChevronRight className="w-3 h-3" />
                      <span>Markdown Editor</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-500 justify-center">
                      <ChevronRight className="w-3 h-3" />
                      <span>Mermaid Diagrams</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-500 justify-center">
                      <ChevronRight className="w-3 h-3" />
                      <span>Plotly Charts</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Panel>
        </PanelGroup>
      </main>

      {/* Footer / Status Bar */}
      <footer className="h-6 bg-[#f3f2f1] border-t border-gray-200 flex items-center px-4 justify-between text-[10px] text-gray-500 uppercase tracking-widest font-semibold shrink-0 select-none">
        <div className="flex items-center gap-4">
          <span>Ready</span>
          <span>Cloud Connected</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <HelpCircle className="w-3 h-3" />
            <span>Help</span>
          </div>
          <span>v2.0.0 (SaaS)</span>
        </div>
      </footer>
    </div>
  );
}
