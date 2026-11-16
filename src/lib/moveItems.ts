import type { Notebook } from '../types';

/**
 * Move a page into another chapter in the local tree. If the target chapter
 * isn't loaded (another bookshelf), the page simply leaves the current view.
 */
export function movePageLocal(
  notebooks: Notebook[],
  pageId: string,
  toSectionId: string
): Notebook[] {
  const page = notebooks
    .flatMap((n) => n.sections)
    .flatMap((s) => s.pages)
    .find((p) => p.id === pageId);
  if (!page) return notebooks;
  return notebooks.map((n) => ({
    ...n,
    sections: n.sections.map((s) => {
      const without = s.pages.filter((p) => p.id !== pageId);
      if (s.id === toSectionId) {
        return { ...s, pages: [...without, page] };
      }
      return without.length === s.pages.length ? s : { ...s, pages: without };
    }),
  }));
}

/** Move a chapter (with its pages) to another book in the local tree. */
export function moveSectionLocal(
  notebooks: Notebook[],
  sectionId: string,
  toNotebookId: string
): Notebook[] {
  const section = notebooks.flatMap((n) => n.sections).find((s) => s.id === sectionId);
  if (!section) return notebooks;
  return notebooks.map((n) => {
    const without = n.sections.filter((s) => s.id !== sectionId);
    if (n.id === toNotebookId) {
      return { ...n, sections: [...without, section] };
    }
    return without.length === n.sections.length ? n : { ...n, sections: without };
  });
}

/** Where a page lives now (notebook + section ids), if it is loaded. */
export function locatePage(
  notebooks: Notebook[],
  pageId: string
): { notebookId: string; sectionId: string } | null {
  for (const n of notebooks) {
    for (const s of n.sections) {
      if (s.pages.some((p) => p.id === pageId)) return { notebookId: n.id, sectionId: s.id };
    }
  }
  return null;
}

/** Drag payload shared by sidebar rows. */
export type DragItem =
  | { kind: 'page'; id: string; sectionId: string }
  | { kind: 'section'; id: string; notebookId: string };
