/** Desktop stick'n neon strips — which book they write into. */

export const STICKY_BOOK_KEY = 'lumina_sticky_book';
export const STICKY_SHELF_KEY = 'lumina_sticky_bookshelf';

export type StickyStripTarget = {
  bookshelfId: string;
  notebookId: string;
};

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
