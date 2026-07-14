import { describe, expect, it } from 'vitest';
import {
  BOOKS_PER_ROW,
  CHARTS_PER_CABINET_PAGE,
  RAIL_VISIBLE_BAYS,
  bayCode,
  cabinetPageForIndex,
  chunkIntoRows,
  densityHint,
  maxRowFootprintPx,
  pageWindow,
  railPageForIndex,
  renderedSpinePx,
  spineSizeFromNotebook,
} from './shelfLayout';

function fakeNotebook(
  id: string,
  title: string,
  pages: number,
  contentLen = 0
) {
  return {
    id,
    title,
    sections: [
      {
        title: 'Notes',
        pages: Array.from({ length: pages }, (_, i) => ({
          title: `Page ${i + 1}`,
          content: 'x'.repeat(contentLen),
        })),
      },
    ],
  };
}

describe('shelfLayout scale', () => {
  it('uses 12 charts per row and 96 per cabinet page', () => {
    expect(BOOKS_PER_ROW).toBe(12);
    expect(CHARTS_PER_CABINET_PAGE).toBe(96);
    expect(RAIL_VISIBLE_BAYS).toBe(8);
  });

  it('pages 1000 charts into cabinet windows', () => {
    const win = pageWindow(1000, CHARTS_PER_CABINET_PAGE, 0);
    expect(win.pageCount).toBe(11);
    expect(win.slice(Array.from({ length: 1000 }, (_, i) => i))).toHaveLength(96);
    expect(cabinetPageForIndex(96)).toBe(1);
  });

  it('pages 100 bays on the rail', () => {
    expect(pageWindow(100, RAIL_VISIBLE_BAYS, 0).pageCount).toBe(13);
    expect(railPageForIndex(8)).toBe(1);
    expect(bayCode(0)).toBe('A01');
    expect(bayCode(99)).toBe('V04');
  });

  it('chunks rows for a dense unit', () => {
    const rows = chunkIntoRows(Array.from({ length: 1000 }, (_, i) => i));
    expect(rows).toHaveLength(84);
    expect(rows[0]).toHaveLength(12);
    expect(rows.at(-1)).toHaveLength(4);
  });

  it('varies spine size by content (not uniform)', () => {
    const small = renderedSpinePx(fakeNotebook('a', 'Short', 1, 10));
    const large = renderedSpinePx(fakeNotebook('b', 'Long', 40, 8000));
    expect(large.width).toBeGreaterThanOrEqual(small.width);
    expect(large.height).toBeGreaterThan(small.height);
    const base = spineSizeFromNotebook(fakeNotebook('c', 'Mid', 5, 100));
    expect(base.width).toBeGreaterThanOrEqual(22);
    expect(base.width).toBeLessThanOrEqual(72);
  });

  it('estimates max row footprint for layout planning', () => {
    expect(maxRowFootprintPx()).toBeGreaterThan(12 * 44);
  });

  it('hints when past soft density guidance', () => {
    expect(densityHint(100)).toBeNull();
    expect(densityHint(500)).toMatch(/soft guidance/i);
  });
});
