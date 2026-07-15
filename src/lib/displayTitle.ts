import { format } from 'date-fns';
import type { Page } from '../types';

function asDate(value: number | string | undefined): Date | null {
  if (value == null || value === '') return null;
  const d = typeof value === 'number' ? new Date(value) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Human label when a page has no title — dated, not a blank "2." */
export function displayPageTitle(page: Pick<Page, 'title' | 'updatedAt'>): {
  text: string;
  untitled: boolean;
} {
  const trimmed = page.title?.trim() ?? '';
  if (trimmed) return { text: trimmed, untitled: false };
  const d = asDate(page.updatedAt);
  if (d) {
    return { text: `Untitled · ${format(d, 'MMM d')}`, untitled: true };
  }
  return { text: 'Untitled page', untitled: true };
}

export function displaySectionTitle(title: string | undefined, chapterIndex?: number): {
  text: string;
  untitled: boolean;
} {
  const trimmed = title?.trim() ?? '';
  if (trimmed) return { text: trimmed, untitled: false };
  if (chapterIndex != null) {
    return { text: `Untitled chapter ${chapterIndex}`, untitled: true };
  }
  return { text: 'Untitled chapter', untitled: true };
}

export function displayBookTitle(title: string | undefined): {
  text: string;
  untitled: boolean;
} {
  const trimmed = title?.trim() ?? '';
  if (trimmed) return { text: trimmed, untitled: false };
  return { text: 'Untitled book', untitled: true };
}

/** Scale page-title input with length so long names stay readable. */
export function pageTitleSizeClass(title: string): string {
  const n = title.trim().length;
  if (n > 72) return 'text-lg sm:text-xl md:text-2xl';
  if (n > 48) return 'text-xl sm:text-2xl md:text-3xl';
  if (n > 28) return 'text-2xl sm:text-3xl md:text-[2.15rem]';
  return 'text-3xl sm:text-[2.5rem]';
}
