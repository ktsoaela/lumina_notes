import { describe, expect, it } from 'vitest';
import type { Notebook } from '../types';
import { locatePage, movePageLocal, moveSectionLocal } from './moveItems';

const tree = (): Notebook[] => [
  {
    id: 'nb1',
    title: 'Book 1',
    sections: [
      { id: 's1', title: 'Ch 1', pages: [{ id: 'p1', title: 'P1', content: '', updatedAt: 0 }] },
      { id: 's2', title: 'Ch 2', pages: [] },
    ],
  },
  { id: 'nb2', title: 'Book 2', sections: [{ id: 's3', title: 'Ch 3', pages: [] }] },
];

describe('movePageLocal', () => {
  it('moves a page into another chapter of another book', () => {
    const out = movePageLocal(tree(), 'p1', 's3');
    expect(out[0].sections[0].pages).toEqual([]);
    expect(out[1].sections[0].pages.map((p) => p.id)).toEqual(['p1']);
    expect(locatePage(out, 'p1')).toEqual({ notebookId: 'nb2', sectionId: 's3' });
  });

  it('drops the page from view when the target chapter is not loaded', () => {
    const out = movePageLocal(tree(), 'p1', 'elsewhere');
    expect(locatePage(out, 'p1')).toBeNull();
  });
});

describe('moveSectionLocal', () => {
  it('moves a chapter with its pages into another book', () => {
    const out = moveSectionLocal(tree(), 's1', 'nb2');
    expect(out[0].sections.map((s) => s.id)).toEqual(['s2']);
    expect(out[1].sections.map((s) => s.id)).toEqual(['s3', 's1']);
    expect(out[1].sections[1].pages[0].id).toBe('p1');
  });
});
