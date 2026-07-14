import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  User,
  Bookshelf,
} from './types';
import Sidebar from './components/Sidebar';
import { SearchPanel, useSearchHotkey } from './components/SearchPanel';
import NotePanel, { type EditorViewMode } from './components/NotePanel';
import Auth from './components/Auth';
import {
  Columns, 
  Eye, 
  Edit3, 
  Search,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Menu,
  FileText,
  LogOut,
  User as UserIcon,
  Loader2,
  SquareSplitHorizontal,
  BookOpen,
  Library,
} from 'lucide-react';
import { Logo } from './components/Logo';
import { cn } from './lib/utils';
import { api } from './lib/api';
import {
  clearSession,
  getInitialAuthState,

  readActiveBookshelfId,
  readToken,
  writeActiveBookshelfId,
  writeSession,
} from './lib/authCache';
import { exportMarkdownToPdf } from './lib/exportPdf';
import { openPrintWindow } from './lib/printDocument';
import { sanitizeFilename } from './lib/filename';
import {
  applyTheme,
  getStoredTheme,
  setStoredTheme,
  type ThemeMode,
} from './lib/theme';
import {
  downloadText,
  pageToMarkdown,
  parseImportedMarkdown,
} from './lib/markdownIO';
import { isElectronApp } from './lib/platform';
import { coerceEntityTitle, validatePageContent } from './lib/validation';
import { useAppDialogs } from './context/AppDialogsContext';
import { useToast } from './context/ToastContext';

const LandingPage = React.lazy(() => import('./components/LandingPage'));
const ProfilePage = React.lazy(() => import('./components/ProfilePage'));
const BookshelfPage = React.lazy(() => import('./components/BookshelfPage'));

function findPageInState(state: AppState, pageId: string): Page | undefined {
  for (const nb of state.notebooks) {
    for (const sec of nb.sections) {
      const p = sec.pages.find((x) => x.id === pageId);
      if (p) return p;
    }
  }
  return undefined;
}

function secondaryStillValid(
  prev: AppState,
  mergedNotebooks: Notebook[]
): string | null {
  if (!prev.secondaryPageId) return null;
  const active = mergedNotebooks.filter((n) => !n.archived);
  const ids = new Set(
    active.flatMap((nb) =>
      nb.sections.flatMap((s) => s.pages.map((p) => p.id))
    )
  );
  return ids.has(prev.secondaryPageId) ? prev.secondaryPageId : null;
}

export default function App() {
  const { confirm } = useAppDialogs();
  const toast = useToast();
  const desktopShell = isElectronApp();
  const [auth, setAuth] = useState<AuthState>(getInitialAuthState);

  const [state, setState] = useState<AppState>({
    notebooks: [],
    activeNotebookId: null,
    activeSectionId: null,
    activePageId: null,
    secondaryPageId: null,
  });

  const [dualPageOpen, setDualPageOpen] = useState(false);
  const [viewMode, setViewMode] = useState<EditorViewMode>('split');
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [isAppLoading, setIsAppLoading] = useState(false);
  // Desktop app skips the marketing landing page and opens Sign In.
  const [showAuth, setShowAuth] = useState(desktopShell);
  const [demoPrefill, setDemoPrefill] = useState(false);
  const [demoLoginLoading, setDemoLoginLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  useSearchHotkey(openSearch, !!auth.user);

  const [theme, setTheme] = useState<ThemeMode>(() => getStoredTheme());
  useEffect(() => {
    applyTheme(theme);
    setStoredTheme(theme);
  }, [theme]);

  const [bookshelves, setBookshelves] = useState<Bookshelf[]>([]);
  const [activeBookshelfId, setActiveBookshelfId] = useState<string | null>(() =>
    readActiveBookshelfId()
  );
  const skipNextFetchRef = useRef(false);

  useEffect(() => {
    writeActiveBookshelfId(activeBookshelfId);
  }, [activeBookshelfId]);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(e.target as Node)
      ) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [profileMenuOpen]);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setProfileMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [profileMenuOpen]);

  type MainView = 'notes' | 'profile' | 'bookshelf';
  const [mainView, setMainView] = useState<MainView>('notes');

  useEffect(() => {
    setProfileMenuOpen(false);
  }, [mainView]);

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

  useEffect(() => {
    if (!auth.user) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await api.bookshelves.list();
        if (cancelled) return;
        setBookshelves(list);
        setActiveBookshelfId((prev) => {
          const stored = readActiveBookshelfId();
          if (stored && list.some((b) => b.id === stored)) return stored;
          if (prev && list.some((b) => b.id === prev)) return prev;
          return list[0]?.id ?? null;
        });
      } catch (e) {
        console.error(e);
        toast.error('Could not load bookshelves');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth.user]);

  const fetchData = useCallback(async () => {
    if (!auth.user) return;
    if (!activeBookshelfId) {
      setState((prev) => ({
        ...prev,
        notebooks: [],
        activeNotebookId: null,
        activeSectionId: null,
        activePageId: null,
        secondaryPageId: null,
      }));
      return;
    }
    setIsAppLoading(true);
    try {
      const [active, archived] = await Promise.all([
        api.notebooks.list(false, activeBookshelfId),
        api.notebooks.list(true, activeBookshelfId),
      ]);
      const notebooks = [...active, ...archived];
      setState((prev) => {
        const cur = prev.activeNotebookId
          ? notebooks.find((n) => n.id === prev.activeNotebookId)
          : null;
        if (cur && !cur.archived) {
          return {
            ...prev,
            notebooks,
            secondaryPageId: secondaryStillValid(prev, notebooks),
          };
        }
        const first = notebooks.find((n) => !n.archived);
        return {
          ...prev,
          notebooks,
          activeNotebookId: first?.id ?? null,
          activeSectionId: first?.sections[0]?.id ?? null,
          activePageId: first?.sections[0]?.pages[0]?.id ?? null,
          secondaryPageId: null,
        };
      });
    } catch (err) {
      console.error('Failed to fetch data', err);
      toast.error('Could not load notebooks');
    } finally {
      setIsAppLoading(false);
    }
  }, [auth.user, activeBookshelfId, toast]);

  useEffect(() => {
    if (!auth.user) return;
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }
    fetchData();
  }, [auth.user, fetchData]);

  const refreshBookshelves = useCallback(async () => {
    const list = await api.bookshelves.list();
    setBookshelves(list);
    setActiveBookshelfId((prev) => {
      if (prev && list.some((b) => b.id === prev)) return prev;
      return list[0]?.id ?? null;
    });
  }, []);

  const handleAuthSuccess = (user: User, token: string) => {
    writeSession(user, token);
    setAuth({ user, token, isLoading: false });
    setShowAuth(false);
    setDemoPrefill(false);
  };

  const handleViewDemo = async () => {
    setDemoLoginLoading(true);
    try {
      const { user, token } = await api.auth.login({
        identifier: 'demo_user',
        password: 'demo_user',
      });
      handleAuthSuccess(user, token);
    } catch {
      setDemoPrefill(true);
      setShowAuth(true);
    } finally {
      setDemoLoginLoading(false);
    }
  };

  const handleLogout = () => {
    clearSession();
    setAuth({ user: null, token: null, isLoading: false });
    setBookshelves([]);
    setActiveBookshelfId(null);
    setState({
      notebooks: [],
      activeNotebookId: null,
      activeSectionId: null,
      activePageId: null,
      secondaryPageId: null,
    });
  };

  const activePage = findPageInState(state, state.activePageId ?? '');
  const secondaryPage = state.secondaryPageId
    ? findPageInState(state, state.secondaryPageId)
    : undefined;

  const activeNotebook = state.notebooks.find((n) => n.id === state.activeNotebookId);
  const activeSection = activeNotebook?.sections.find(
    (s) => s.id === state.activeSectionId
  );
  const notePath = {
    bookTitle: activeNotebook?.title,
    chapterTitle: activeSection?.title,
  };
  const secondarySection = activeNotebook?.sections.find((s) =>
    s.pages.some((p) => p.id === state.secondaryPageId)
  );
  const secondaryPath = {
    bookTitle: activeNotebook?.title,
    chapterTitle: secondarySection?.title,
  };

  const [pdfExportingPrimary, setPdfExportingPrimary] = useState(false);
  const [pdfExportingSecondary, setPdfExportingSecondary] = useState(false);

  const handlePrintPrimary = useCallback(() => {
    if (!activePage) return;
    openPrintWindow(activePage.title, activePage.content);
  }, [activePage]);

  const handlePrintSecondary = useCallback(() => {
    if (!secondaryPage) return;
    openPrintWindow(secondaryPage.title, secondaryPage.content);
  }, [secondaryPage]);

  const handleExportPdfPrimary = useCallback(async () => {
    if (!activePage) return;
    setPdfExportingPrimary(true);
    try {
      await exportMarkdownToPdf(
        activePage.title,
        activePage.content,
        sanitizeFilename(activePage.title)
      );
    } catch (err) {
      console.error('PDF export failed', err);
      toast.error('PDF export failed');
    } finally {
      setPdfExportingPrimary(false);
    }
  }, [activePage, toast]);

  const handleExportPdfSecondary = useCallback(async () => {
    if (!secondaryPage) return;
    setPdfExportingSecondary(true);
    try {
      await exportMarkdownToPdf(
        secondaryPage.title,
        secondaryPage.content,
        sanitizeFilename(secondaryPage.title)
      );
    } catch (err) {
      console.error('PDF export failed', err);
      toast.error('PDF export failed');
    } finally {
      setPdfExportingSecondary(false);
    }
  }, [secondaryPage, toast]);

  const updatePageContentById = useCallback(async (pageId: string, content: string) => {
    const contentCheck = validatePageContent(content);
    if (contentCheck.ok === false) {
      console.error(contentCheck.error);
      toast.error(contentCheck.error);
      return;
    }
    let titleForApi = '';
    setState(prev => {
      const page = findPageInState(prev, pageId);
      if (!page) return prev;
      titleForApi = page.title || '';
      return {
        ...prev,
        notebooks: prev.notebooks.map(nb => ({
          ...nb,
          sections: nb.sections.map(sec => ({
            ...sec,
            pages: sec.pages.map(p =>
              p.id === pageId
                ? { ...p, content: contentCheck.value, updatedAt: Date.now() }
                : p
            ),
          })),
        })),
      };
    });
    try {
      await api.pages.update(pageId, titleForApi, contentCheck.value);
    } catch (err) {
      console.error('Failed to save page content', err);
      toast.error('Failed to save page');
    }
  }, [toast]);

  const updatePageTitleById = useCallback(async (pageId: string, title: string) => {
    const trimmed = coerceEntityTitle(title, 'page');
    let contentForApi = '';
    setState(prev => {
      const page = findPageInState(prev, pageId);
      if (!page) return prev;
      contentForApi = page.content || '';
      return {
        ...prev,
        notebooks: prev.notebooks.map(nb => ({
          ...nb,
          sections: nb.sections.map(sec => ({
            ...sec,
            pages: sec.pages.map(p =>
              p.id === pageId ? { ...p, title: trimmed, updatedAt: Date.now() } : p
            ),
          })),
        })),
      };
    });
    try {
      await api.pages.update(pageId, trimmed, contentForApi);
    } catch (err) {
      console.error('Failed to save page title', err);
      toast.error('Failed to save page title');
    }
  }, [toast]);

  const handleAddNotebook = async () => {
    if (!activeBookshelfId) return;
    const id = `nb-${Date.now()}`;
    const name = 'New book';
    try {
      await api.notebooks.create(id, name, activeBookshelfId);
      const newNotebook: Notebook = {
        id,
        title: name,
        sections: [],
        bookshelfId: activeBookshelfId,
      };
      setState(prev => ({
        ...prev,
        notebooks: [...prev.notebooks, newNotebook],
        activeNotebookId: id,
        activeSectionId: null,
        activePageId: null
      }));
    } catch (err) {
      console.error('Failed to add notebook', err);
      toast.error('Failed to add notebook');
    }
  };

  const handleAddSection = async (notebookId: string) => {
    const id = `sec-${Date.now()}`;
    const name = 'New chapter';
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
      toast.error('Failed to add section');
    }
  };

  const handleAddPage = async (sectionId: string) => {
    const id = `page-${Date.now()}`;
    const title = 'Untitled page';
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
      toast.error('Failed to add page');
    }
  };

  const handleRenameNotebook = async (id: string, name: string) => {
    const trimmed = coerceEntityTitle(name, 'notebook');
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
      toast.error('Failed to rename notebook');
    }
  };

  const handleRenameSection = async (notebookId: string, sectionId: string, name: string) => {
    const trimmed = coerceEntityTitle(name, 'section');
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
      toast.error('Failed to rename section');
    }
  };

  const handleRenamePage = async (sectionId: string, pageId: string, title: string) => {
    const trimmed = coerceEntityTitle(title, 'page');
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
      toast.error('Failed to rename page');
    }
  };

  const handleArchiveNotebook = async (id: string) => {
    const nb = state.notebooks.find((n) => n.id === id);
    const ok = await confirm({
      title: 'Archive notebook?',
      message: `“${nb?.title?.trim() || 'Notebook'}” will move to Archived. You can restore it from Bookshelf → Archived.`,
      confirmLabel: 'Archive',
      variant: 'default',
    });
    if (!ok) return;
    try {
      await api.notebooks.setArchive(id, true);
      await fetchData();
    } catch (err) {
      console.error('Failed to archive notebook', err);
      toast.error('Failed to archive notebook');
    }
  };

  const handleOpenNotebookFromShelf = async (
    notebookId: string,
    bookshelfId: string
  ) => {
    setMainView('notes');
    setIsAppLoading(true);
    try {
      if (bookshelfId !== activeBookshelfId) {
        skipNextFetchRef.current = true;
        setActiveBookshelfId(bookshelfId);
      }
      const [active, archived] = await Promise.all([
        api.notebooks.list(false, bookshelfId),
        api.notebooks.list(true, bookshelfId),
      ]);
      const notebooks = [...active, ...archived];
      const nb = notebooks.find((n) => n.id === notebookId);
      setState((prev) => ({
        ...prev,
        notebooks,
        activeNotebookId: notebookId,
        activeSectionId: nb?.sections[0]?.id ?? null,
        activePageId: nb?.sections[0]?.pages[0]?.id ?? null,
        secondaryPageId: null,
      }));
    } catch (err) {
      console.error(err);
      toast.error('Could not open notebook');
    } finally {
      setIsAppLoading(false);
    }
  };

  const handleOpenShelfForNotes = (shelfId: string) => {
    setActiveBookshelfId(shelfId);
    setMainView('notes');
  };

  const handleExportMarkdownPage = useCallback((title: string, content: string) => {
    downloadText(sanitizeFilename(title), pageToMarkdown(title, content));
  }, []);

  const handleUserUpdated = (user: User, token: string) => {
    writeSession(user, token);
    setAuth((a) => ({ ...a, user, token }));
  };

  const handleDeleteSection = async (notebookId: string, sectionId: string) => {
    const nb = state.notebooks.find((n) => n.id === notebookId);
    const sec = nb?.sections.find((s) => s.id === sectionId);
    const ok = await confirm({
      title: 'Remove section?',
      message: `“${sec?.title?.trim() || 'Section'}” and all pages inside it will be permanently deleted.`,
      confirmLabel: 'Remove section',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api.sections.delete(sectionId);
      setState(prev => {
        const nb = prev.notebooks.find(n => n.id === notebookId);
        const secIdx = nb?.sections.findIndex(s => s.id === sectionId) ?? -1;
        const remainingSecs = nb ? nb.sections.filter(s => s.id !== sectionId) : [];
        const fallbackSec =
          remainingSecs[secIdx] ?? remainingSecs[secIdx - 1] ?? remainingSecs[0] ?? null;
        const wasActive = prev.activeSectionId === sectionId;
        const nextNotebooks = prev.notebooks.map(n =>
          n.id === notebookId ? { ...n, sections: remainingSecs } : n
        );
        return {
          ...prev,
          notebooks: nextNotebooks,
          activeSectionId: wasActive ? (fallbackSec?.id ?? null) : prev.activeSectionId,
          activePageId: wasActive ? (fallbackSec?.pages[0]?.id ?? null) : prev.activePageId,
          secondaryPageId: secondaryStillValid(prev, nextNotebooks),
        };
      });
    } catch (err) {
      console.error('Failed to delete section', err);
      toast.error('Failed to delete section');
    }
  };

  const handleDeletePage = async (sectionId: string, pageId: string) => {
    const page = state.notebooks
      .flatMap((n) => n.sections)
      .find((s) => s.id === sectionId)
      ?.pages.find((p) => p.id === pageId);
    const ok = await confirm({
      title: 'Remove page?',
      message: `“${page?.title?.trim() || 'Page'}” will be permanently deleted.`,
      confirmLabel: 'Remove page',
      variant: 'danger',
    });
    if (!ok) return;
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
        const wasSecondary = prev.secondaryPageId === pageId;
        return {
          ...prev,
          notebooks: prev.notebooks.map(n => ({
            ...n,
            sections: n.sections.map(s =>
              s.id === sectionId ? { ...s, pages: remainingPages } : s
            ),
          })),
          activePageId: wasActive ? (fallbackPage?.id ?? null) : prev.activePageId,
          secondaryPageId: wasSecondary ? null : prev.secondaryPageId,
        };
      });
    } catch (err) {
      console.error('Failed to delete page', err);
      toast.error('Failed to delete page');
    }
  };

  if (auth.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--app-bg)]">
        <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
      </div>
    );
  }

  if (!auth.user) {
    if (showAuth || desktopShell) {
      return (
        <Auth
          onAuthSuccess={handleAuthSuccess}
          onBack={
            desktopShell
              ? undefined
              : () => {
                  setDemoPrefill(false);
                  setShowAuth(false);
                }
          }
          prefillDemo={demoPrefill}
        />
      );
    }
    return (
      <React.Suspense
        fallback={
          <div className="flex h-screen items-center justify-center bg-[var(--app-bg)]">
            <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
          </div>
        }
      >
        <LandingPage
          onGetStarted={() => {
            setDemoPrefill(false);
            setShowAuth(true);
          }}
          onViewDemo={handleViewDemo}
          viewDemoLoading={demoLoginLoading}
        />
      </React.Suspense>
    );
  }

  const activeShelfTitle =
    activeBookshelfId != null
      ? bookshelves.find((b) => b.id === activeBookshelfId)?.title
      : undefined;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--app-bg)] font-sans text-[var(--app-fg)] notes-atelier">
      <header className="h-12 bg-brand-700 text-white flex items-center px-3 sm:px-4 justify-between shrink-0 select-none gap-2">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          {mainView === 'notes' && (
            <button
              type="button"
              onClick={() => setIsSidebarVisible(!isSidebarVisible)}
              className="p-1.5 hover:bg-white/10 rounded-md transition-colors shrink-0"
              title="Toggle sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-2 font-semibold shrink-0 min-w-0">
            <Logo variant="mono" className="h-7 w-auto" />
            <span className="text-sm hidden sm:inline">Lumina Notes</span>
            {mainView === 'notes' && activeShelfTitle && (
              <span
                className="hidden lg:inline text-xs font-normal text-white/75 truncate max-w-[160px]"
                title={activeShelfTitle}
              >
                · {activeShelfTitle}
              </span>
            )}
          </div>
          <nav className="hidden md:flex items-center gap-0.5 ml-1">
            <button
              type="button"
              onClick={() => setMainView('notes')}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                mainView === 'notes' ? 'bg-white/20' : 'hover:bg-white/10'
              )}
            >
              <BookOpen className="w-4 h-4" />
              Notes
            </button>
            <button
              type="button"
              onClick={() => setMainView('bookshelf')}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                mainView === 'bookshelf' ? 'bg-white/20' : 'hover:bg-white/10'
              )}
            >
              <Library className="w-4 h-4" />
              Library
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          {mainView === 'notes' && (
            <>
              <button
                type="button"
                onClick={() => setViewMode('edit')}
                className={cn(
                  'p-2 hover:bg-white/10 rounded-md transition-colors',
                  viewMode === 'edit' && 'bg-white/20'
                )}
                title="Edit Mode"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={cn(
                  'p-2 hover:bg-white/10 rounded-md transition-colors',
                  viewMode === 'split' && 'bg-white/20'
                )}
                title="Split View"
              >
                <Columns className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                className={cn(
                  'p-2 hover:bg-white/10 rounded-md transition-colors',
                  viewMode === 'preview' && 'bg-white/20'
                )}
                title="Preview Mode"
              >
                <Eye className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setDualPageOpen((v) => !v)}
                className={cn(
                  'p-2 hover:bg-white/10 rounded-md transition-colors',
                  dualPageOpen && 'bg-white/20'
                )}
                title="Two notes side by side — Shift+click a page for the right pane"
              >
                <SquareSplitHorizontal className="w-4 h-4" />
              </button>
              <div className="w-px h-4 bg-white/20 mx-1 hidden sm:block" />
            </>
          )}

          {mainView === 'notes' && (
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-white/90 hover:bg-white/10 transition-colors"
              title="Search (Ctrl+K)"
            >
              <Search className="w-4 h-4" />
              <span className="hidden lg:inline">Search</span>
              <kbd className="hidden lg:inline rounded border border-white/20 bg-white/10 px-1 font-mono text-[10px]">
                {typeof navigator !== 'undefined' &&
                /Mac|iPhone|iPod|iPad/i.test(navigator.platform)
                  ? '⌘K'
                  : 'Ctrl+K'}
              </kbd>
            </button>
          )}

          <div className="relative" ref={profileMenuRef}>
            <button
              type="button"
              onClick={() => setProfileMenuOpen((o) => !o)}
              aria-expanded={profileMenuOpen}
              aria-haspopup="menu"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-700"
            >
              <UserIcon className="w-4 h-4 shrink-0" aria-hidden />
              <span className="text-xs font-medium max-w-[80px] sm:max-w-[120px] truncate hidden sm:inline">
                {auth.user.name}
              </span>
              <ChevronDown
                className={cn(
                  'hidden h-3.5 w-3.5 shrink-0 opacity-80 transition-transform sm:block',
                  profileMenuOpen && 'rotate-180'
                )}
                aria-hidden
              />
            </button>
            {profileMenuOpen ? (
              <div
                className="absolute top-full right-0 z-50 mt-1 w-48 rounded-xl border border-gray-100 bg-white p-1 text-gray-900 shadow-xl dark:border-[var(--app-border)] dark:bg-[var(--app-surface)] dark:text-[var(--app-fg)]"
                role="menu"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMainView('profile');
                    setProfileMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs hover:bg-gray-50 dark:hover:bg-[var(--app-bg)]"
                >
                  <UserIcon className="w-4 h-4 shrink-0 opacity-80" />
                  Profile
                </button>
                <div className="border-t border-gray-100 px-3 py-2 dark:border-[var(--app-border)]">
                  <div className="truncate text-xs font-bold">{auth.user.name}</div>
                  <div className="truncate text-[10px] text-gray-500 dark:text-[var(--app-muted)]">
                    {auth.user.email}
                  </div>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    handleLogout();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                >
                  <LogOut className="w-3 h-3 shrink-0" />
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <SearchPanel
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        state={state}
        onNavigate={({ notebookId, sectionId, pageId }) => {
          setMainView('notes');
          setState((s) => ({
            ...s,
            activeNotebookId: notebookId,
            activeSectionId: sectionId,
            activePageId: pageId,
            secondaryPageId: null,
          }));
        }}
      />

      <main className="flex-1 overflow-hidden relative min-h-0">
        {isAppLoading && (
          <div className="absolute inset-0 bg-white/80 dark:bg-[var(--app-bg)]/80 backdrop-blur-[1px] z-50 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
          </div>
        )}
        {mainView === 'profile' && auth.user ? (
          <React.Suspense
            fallback={
              <div className="flex h-full items-center justify-center">
                <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
              </div>
            }
          >
            <ProfilePage
              user={auth.user}
              theme={theme}
              onThemeChange={setTheme}
              onBack={() => setMainView('notes')}
              onUserUpdated={handleUserUpdated}
              onLibraryChanged={() => {
                void fetchData();
                void refreshBookshelves();
              }}
              onAccountClosed={() => {
                setMainView('notes');
                handleLogout();
              }}
            />
          </React.Suspense>
        ) : mainView === 'bookshelf' ? (
          <React.Suspense
            fallback={
              <div className="flex h-full items-center justify-center">
                <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
              </div>
            }
          >
            <BookshelfPage
              bookshelves={bookshelves}
              activeBookshelfId={activeBookshelfId}
              onBack={() => setMainView('notes')}
              onOpenShelfForNotes={handleOpenShelfForNotes}
              onOpenNotebook={handleOpenNotebookFromShelf}
              onLibraryChanged={fetchData}
              onRefreshBookshelves={refreshBookshelves}
            />
          </React.Suspense>
        ) : !activeBookshelfId ? (
          <div className="flex h-full flex-col items-center justify-center bg-[var(--app-bg)] px-6 text-gray-500 dark:text-[var(--app-muted)]">
            <Library className="w-12 h-12 mb-4 text-brand-400" />
            <p className="text-center text-sm max-w-md mb-4">
              {bookshelves.length === 0
                ? 'Create a bookshelf first, then add notebooks and open them here.'
                : 'Choose a bookshelf from the Bookshelves tab to load your notes.'}
            </p>
            <button
              type="button"
              onClick={() => setMainView('bookshelf')}
              className="rounded-lg bg-brand-700 hover:bg-brand-800 text-white text-sm font-medium px-4 py-2"
            >
              Open Bookshelves
            </button>
          </div>
        ) : (
          <PanelGroup orientation="horizontal" className="h-full">
            {isSidebarVisible && (
              <>
                <Panel
                  defaultSize="33.333%"
                  minSize="15%"
                  maxSize="50%"
                  className="min-w-0"
                >
                  <Sidebar
                    notebooks={state.notebooks.filter((nb) => !nb.archived)}
                    activeNotebookId={state.activeNotebookId}
                    activeSectionId={state.activeSectionId}
                    activePageId={state.activePageId}
                    secondaryPageId={state.secondaryPageId}
                    dualPageOpen={dualPageOpen}
                    onSelectNotebook={(id) =>
                      setState((s) => ({ ...s, activeNotebookId: id }))
                    }
                    onSelectSection={(id) =>
                      setState((s) => ({ ...s, activeSectionId: id }))
                    }
                    onSelectPage={(id, asSecondary) => {
                      setState((s) => {
                        if (dualPageOpen && asSecondary && id !== s.activePageId) {
                          return { ...s, secondaryPageId: id };
                        }
                        return { ...s, activePageId: id };
                      });
                    }}
                    onAddNotebook={handleAddNotebook}
                    onAddSection={handleAddSection}
                    onAddPage={handleAddPage}
                    onArchiveNotebook={handleArchiveNotebook}
                    onDeleteSection={handleDeleteSection}
                    onDeletePage={handleDeletePage}
                    onRenameNotebook={handleRenameNotebook}
                    onRenameSection={handleRenameSection}
                    onRenamePage={handleRenamePage}
                  />
                </Panel>
                <PanelResizeHandle className="w-1.5 shrink-0 cursor-col-resize bg-[var(--gutter)] transition-colors hover:bg-brand-200 dark:hover:bg-brand-800" />
              </>
            )}

            <Panel
              defaultSize={isSidebarVisible ? '66.667%' : '100%'}
              minSize={isSidebarVisible ? '45%' : '100%'}
              className="min-w-0"
            >
              {activePage && state.activePageId ? (
                dualPageOpen ? (
                  <PanelGroup orientation="horizontal" className="h-full">
                    <Panel defaultSize="50%" minSize="22%" className="min-w-0">
                      <NotePanel
                        page={activePage}
                        path={notePath}
                        paneLabel="Left"
                        viewMode={viewMode}
                        onTitleChange={(t) => updatePageTitleById(state.activePageId!, t)}
                        onContentChange={(c) =>
                          updatePageContentById(state.activePageId!, c)
                        }
                        onPrint={() => handlePrintPrimary()}
                        onExportPdf={handleExportPdfPrimary}
                        onExportMarkdown={() =>
                          handleExportMarkdownPage(activePage.title, activePage.content)
                        }
                        pdfExporting={pdfExportingPrimary}
                      />
                    </Panel>
                    <PanelResizeHandle className="w-1.5 shrink-0 cursor-col-resize bg-[var(--gutter)] transition-colors hover:bg-brand-200 dark:hover:bg-brand-800" />
                    <Panel defaultSize="50%" minSize="22%" className="min-w-0">
                      {secondaryPage && state.secondaryPageId ? (
                        <NotePanel
                          page={secondaryPage}
                          path={secondaryPath}
                          paneLabel="Right"
                          viewMode={viewMode}
                          onTitleChange={(t) =>
                            updatePageTitleById(state.secondaryPageId!, t)
                          }
                          onContentChange={(c) =>
                            updatePageContentById(state.secondaryPageId!, c)
                          }
                          onPrint={() => handlePrintSecondary()}
                          onExportPdf={handleExportPdfSecondary}
                          onExportMarkdown={() =>
                            handleExportMarkdownPage(
                              secondaryPage.title,
                              secondaryPage.content
                            )
                          }
                          pdfExporting={pdfExportingSecondary}
                        />
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center border-l border-[var(--app-border)] bg-gray-50 px-6 text-center text-gray-500 dark:bg-[var(--app-surface)]/80 dark:text-[var(--app-muted)]">
                          <SquareSplitHorizontal className="w-12 h-12 text-brand-300 dark:text-brand-600 mb-4" />
                          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-[var(--app-fg)]">
                            Second page
                          </p>
                          <p className="text-xs leading-relaxed max-w-[260px]">
                            Hold{' '}
                            <kbd className="rounded border border-gray-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-gray-800 dark:border-[var(--app-border)] dark:bg-[var(--app-surface)] dark:text-[var(--app-fg)]">
                              Shift
                            </kbd>{' '}
                            and click a page in the sidebar to open it here — compare
                            notes, questions vs answers, or two related topics at once.
                          </p>
                        </div>
                      )}
                    </Panel>
                  </PanelGroup>
                ) : (
                  <NotePanel
                    page={activePage}
                    path={notePath}
                    viewMode={viewMode}
                    onTitleChange={(t) => updatePageTitleById(state.activePageId!, t)}
                    onContentChange={(c) =>
                      updatePageContentById(state.activePageId!, c)
                    }
                    onPrint={() => handlePrintPrimary()}
                    onExportPdf={handleExportPdfPrimary}
                    onExportMarkdown={() =>
                      handleExportMarkdownPage(activePage.title, activePage.content)
                    }
                    pdfExporting={pdfExportingPrimary}
                  />
                )
              ) : (
                <div className="flex h-full flex-col items-center justify-center px-6 text-[var(--app-muted)]">
                  <div className="paper-page flex max-w-md flex-col items-center rounded-2xl border border-[var(--app-border)] p-10 text-center">
                    <BookOpen className="mb-4 h-10 w-10 text-[var(--spine)]" />
                    <h2 className="font-display text-2xl text-[var(--app-fg)]">
                      Open a page
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed">
                      Choose a book in the table of contents, open a chapter, then
                      pick a page — or create a new book to begin writing.
                    </p>
                  </div>
                </div>
              )}
            </Panel>
          </PanelGroup>
        )}
      </main>

      {/* Footer / Status Bar */}
      <footer className="flex h-6 shrink-0 select-none items-center justify-between border-t border-[var(--app-border)] bg-[var(--app-surface)] px-4 text-[10px] font-semibold uppercase tracking-widest text-[var(--app-muted)]">
        <div className="flex items-center gap-4">
          <span>Ready</span>
          {activeNotebook ? (
            <span className="normal-case tracking-normal font-medium">
              {activeNotebook.title}
              {activeSection ? ` · ${activeSection.title}` : ''}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-4">
          <span>Book studio</span>
        </div>
      </footer>

    </div>
  );
}
