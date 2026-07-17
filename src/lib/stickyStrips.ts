/** Desktop stick'n neon strips — which book they write into. */

export const STICKY_BOOK_KEY = 'lumina_sticky_book';
export const STICKY_SHELF_KEY = 'lumina_sticky_bookshelf';
export const STICKY_EDGE_KEY = 'lumina_sticky_edge';

export type StickyStripEdge = 'left' | 'right' | 'top' | 'bottom';

export type StickyStripTarget = {
  bookshelfId: string;
  notebookId: string;
};

export function getStickyStripEdge(): StickyStripEdge {
  try {
    const v = localStorage.getItem(STICKY_EDGE_KEY);
    if (v === 'left' || v === 'right' || v === 'top' || v === 'bottom') return v;
  } catch {
    /* ignore */
  }
  return 'right';
}

export function setStickyStripEdge(edge: StickyStripEdge): void {
  try {
    localStorage.setItem(STICKY_EDGE_KEY, edge);
  } catch {
    /* ignore */
  }
}

export function getStickyStripTarget(): StickyStripTarget | null {
  try {
    const notebookId = localStorage.getItem(STICKY_BOOK_KEY)?.trim() || '';
    const bookshelfId = localStorage.getItem(STICKY_SHELF_KEY)?.trim() || '';
    if (!notebookId || !bookshelfId) return null;
    return { notebookId, bookshelfId };
  } catch {
    return null;
  }
}

export function setStickyStripTarget(target: StickyStripTarget | null): void {
  try {
    if (!target) {
      localStorage.removeItem(STICKY_BOOK_KEY);
      localStorage.removeItem(STICKY_SHELF_KEY);
      return;
    }
    localStorage.setItem(STICKY_BOOK_KEY, target.notebookId);
    localStorage.setItem(STICKY_SHELF_KEY, target.bookshelfId);
  } catch {
    /* ignore */
  }
}

/** Fired in same tab after Profile saves (storage event only fires cross-tab). */
export const STICKY_TARGET_EVENT = 'lumina-sticky-target';

export function notifyStickyStripTargetChanged(): void {
  try {
    window.dispatchEvent(new Event(STICKY_TARGET_EVENT));
  } catch {
    /* ignore */
  }
  try {
    window.luminaDesktop?.notifyStickyTargetChanged?.();
  } catch {
    /* ignore */
  }
}

export const STICKY_EDGE_EVENT = 'lumina-sticky-edge-pref';

export function notifyStickyEdgeChanged(edge?: StickyStripEdge): void {
  const next = edge ?? getStickyStripEdge();
  try {
    window.dispatchEvent(new Event(STICKY_EDGE_EVENT));
  } catch {
    /* ignore */
  }
  try {
    window.luminaDesktop?.setStickyEdge?.(next);
  } catch {
    /* ignore */
  }
}
