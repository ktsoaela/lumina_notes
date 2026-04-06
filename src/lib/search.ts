import type { AppState } from '../types';

export type SearchScope = 'global' | 'notebook' | 'section' | 'page';

export type SearchResult =
  | {
      kind: 'notebook';
      notebookId: string;
      label: string;
      snippet?: string;
    }
  | {
      kind: 'section';
      notebookId: string;
      sectionId: string;
      label: string;
      breadcrumb: string;
      snippet?: string;
    }
  | {
      kind: 'page';
      notebookId: string;
      sectionId: string;
      pageId: string;
      label: string;
      breadcrumb: string;
      snippet?: string;
    };

function norm(q: string): string {
  return q.trim().toLowerCase();
}

function matches(haystack: string, q: string): boolean {
  if (!q) return false;
  return haystack.toLowerCase().includes(q);
}

/** Short excerpt around first match, for markdown/plain text */
export function matchSnippet(text: string, q: string, maxLen = 100): string {
  const t = q.trim();
  if (!t || !text) return text.slice(0, maxLen) + (text.length > maxLen ? '…' : '');
  const lower = text.toLowerCase();
  const idx = lower.indexOf(t.toLowerCase());
  if (idx < 0) return text.slice(0, maxLen) + (text.length > maxLen ? '…' : '');
  const pad = 48;
  const start = Math.max(0, idx - pad);
  const end = Math.min(text.length, idx + t.length + pad);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return prefix + text.slice(start, end) + suffix;
}

export function searchNotes(
  state: AppState,
  rawQuery: string,
  scope: SearchScope
): SearchResult[] {
  const q = norm(rawQuery);
  if (!q) return [];

  const results: SearchResult[] = [];

  const pushNotebook = (notebookId: string, title: string, extra?: string) => {
    results.push({
      kind: 'notebook',
      notebookId,
      label: title,
      snippet: extra,
    });
  };

  const pushSection = (
    notebookId: string,
    sectionId: string,
    notebookTitle: string,
    sectionTitle: string,
    extra?: string
  ) => {
    results.push({
      kind: 'section',
      notebookId,
      sectionId,
      label: sectionTitle,
      breadcrumb: notebookTitle,
      snippet: extra,
    });
  };

  const pushPage = (
    notebookId: string,
    sectionId: string,
    pageId: string,
    notebookTitle: string,
    sectionTitle: string,
    pageTitle: string,
    content: string,
    q: string
  ) => {
    const snip = matches(pageTitle, q)
      ? pageTitle
      : matchSnippet(content, q);
    results.push({
      kind: 'page',
      notebookId,
      sectionId,
      pageId,
      label: pageTitle,
      breadcrumb: `${notebookTitle} › ${sectionTitle}`,
      snippet: snip,
    });
  };

  if (scope === 'page') {
    if (!state.activePageId || !state.activeSectionId || !state.activeNotebookId) {
      return [];
    }
    const nb = state.notebooks.find((n) => n.id === state.activeNotebookId);
    const sec = nb?.sections.find((s) => s.id === state.activeSectionId);
    const page = sec?.pages.find((p) => p.id === state.activePageId);
    if (!nb || !sec || !page) return [];
    const text = `${page.title}\n${page.content}`;
    if (matches(text, q)) {
      pushPage(
        nb.id,
        sec.id,
        page.id,
        nb.title,
        sec.title,
        page.title,
        page.content,
        q
      );
    }
    return results;
  }

  if (scope === 'section') {
    if (!state.activeSectionId || !state.activeNotebookId) return [];
    const nb = state.notebooks.find((n) => n.id === state.activeNotebookId);
    const sec = nb?.sections.find((s) => s.id === state.activeSectionId);
    if (!nb || !sec) return [];

    if (matches(sec.title, q)) {
      pushSection(nb.id, sec.id, nb.title, sec.title);
    }
    for (const page of sec.pages) {
      if (matches(page.title, q) || matches(page.content, q)) {
        pushPage(
          nb.id,
          sec.id,
          page.id,
          nb.title,
          sec.title,
          page.title,
          page.content,
          q
        );
      }
    }
    return results;
  }

  if (scope === 'notebook') {
    if (!state.activeNotebookId) return [];
    const nb = state.notebooks.find((n) => n.id === state.activeNotebookId);
    if (!nb) return [];

    if (matches(nb.title, q)) {
      pushNotebook(nb.id, nb.title);
    }
    for (const sec of nb.sections) {
      if (matches(sec.title, q)) {
        pushSection(nb.id, sec.id, nb.title, sec.title);
      }
      for (const page of sec.pages) {
        if (matches(page.title, q) || matches(page.content, q)) {
          pushPage(
            nb.id,
            sec.id,
            page.id,
            nb.title,
            sec.title,
            page.title,
            page.content,
            q
          );
        }
      }
    }
    return results;
  }

  // global
  for (const nb of state.notebooks.filter((n) => !n.archived)) {
    if (matches(nb.title, q)) {
      pushNotebook(nb.id, nb.title);
    }
    for (const sec of nb.sections) {
      if (matches(sec.title, q)) {
        pushSection(nb.id, sec.id, nb.title, sec.title);
      }
      for (const page of sec.pages) {
        if (matches(page.title, q) || matches(page.content, q)) {
          pushPage(
            nb.id,
            sec.id,
            page.id,
            nb.title,
            sec.title,
            page.title,
            page.content,
            q
          );
        }
      }
    }
  }

  return results;
}

export function scopeLabel(scope: SearchScope): string {
  switch (scope) {
    case 'global':
      return 'All notebooks';
    case 'notebook':
      return 'This notebook';
    case 'section':
      return 'This section';
    case 'page':
      return 'This page';
    default:
      return '';
  }
}
