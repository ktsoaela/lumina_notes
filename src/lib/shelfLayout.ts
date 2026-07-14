/**
 * High-density storage layout rules (hospital kompakt shelving metaphor).
 *
 * Scale design:
 * - Unlimited units/charts in the DB
 * - UI windows the rail and cabinet so 100 bays / 1000 charts stay responsive
 * - Spine width/height vary by notebook content (not uniform “same size” stubs)
 */

export const BOOKS_PER_ROW = 12;
/** Rows shown at once in the open-bay cabinet (pagination pages beyond this). */
export const MAX_VISIBLE_ROWS = 8;
/** Charts visible per cabinet page (= BOOKS_PER_ROW * MAX_VISIBLE_ROWS). */
export const CHARTS_PER_CABINET_PAGE = BOOKS_PER_ROW * MAX_VISIBLE_ROWS; // 96
/** Soft UX guidance — above this we show a density hint, but still allow paging. */
export const SOFT_MAX_CHARTS_PER_UNIT = 480;
/** Carriages visible on the rail track at once. */
export const RAIL_VISIBLE_BAYS = 8;
/** Visual multiplier applied to computed spine px. */
export const SHELF_VISUAL_SCALE = 2;
export const CARRIAGE_W = 112;
export const CARRIAGE_GAP = 14;
export const AISLE_SHIFT_PX = 148;
/** Horizontal gap between spines on a row (px). */
export const SPINE_GAP_PX = 8;

export type SpineMetricsInput = {
  id: string;
  title: string;
  sections: Array<{ title: string; pages: Array<{ title: string; content?: string }> }>;
};

export function bayCode(index: number): string {
  if (index < 0) return '??';
  const letter = String.fromCharCode(65 + (index % 26));
  const n = Math.floor(index / 26) + 1;
  return `${letter}${String(n).padStart(2, '0')}`;
}

export function chunkIntoRows<T>(items: T[], perRow: number = BOOKS_PER_ROW): T[][] {
  if (perRow <= 0) throw new Error('perRow must be > 0');
  if (items.length === 0) return [];
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += perRow) {
    rows.push(items.slice(i, i + perRow));
  }
  return rows;
}

export function hashStringToInt(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function countMarkdownImages(content: string): number {
  const c = content ?? '';
  const md = c.match(/!\[[^\]]*\]\([^)]+\)/g);
  let n = md ? md.length : 0;
  n += (c.match(/<img\s[^>]*>/gi) ?? []).length;
  return n;
}

export function notebookContentMetrics(nb: SpineMetricsInput) {
  let chars = nb.title.length;
  let pages = 0;
  let images = 0;
  for (const sec of nb.sections) {
    chars += sec.title.length;
    for (const p of sec.pages) {
      pages += 1;
      chars += p.title.length + (p.content?.length ?? 0);
      images += countMarkdownImages(p.content ?? '');
    }
  }
  return { chars, pages, sections: nb.sections.length, images };
}

/** Base spine size (before SHELF_VISUAL_SCALE). Width/height vary by content. */
export function spineSizeFromNotebook(nb: SpineMetricsInput): {
  width: number;
  height: number;
} {
  const { chars, pages, sections, images } = notebookContentMetrics(nb);
  const approxMB = Math.min(52, chars / 18000);
  let w = 12 + approxMB * 0.62 + sections * 1.15 + images * 1.35;
  w = Math.min(72, Math.max(22, w));
  const contentLift = Math.min(32, chars / 14000);
  let h =
    38 + pages * 0.07 + contentLift + Math.min(images * 2.4, 36) + sections * 0.35;
  h = Math.min(188, Math.max(46, h));
  const jitter = hashStringToInt(nb.id);
  w = Math.min(72, Math.max(22, w + ((jitter % 11) - 5) * 0.45));
  h = Math.min(188, Math.max(46, h + (((jitter >> 5) % 11) - 5) * 0.5));
  return { width: Math.round(w), height: Math.round(h) };
}

export function renderedSpinePx(nb: SpineMetricsInput): {
  width: number;
  height: number;
} {
  const base = spineSizeFromNotebook(nb);
  return {
    width: base.width * SHELF_VISUAL_SCALE,
    height: base.height * SHELF_VISUAL_SCALE,
  };
}

/** Approximate px width a full row needs (12 max-width spines + gaps). */
export function maxRowFootprintPx(): number {
  const maxSpineW = 72 * SHELF_VISUAL_SCALE;
  return BOOKS_PER_ROW * maxSpineW + (BOOKS_PER_ROW - 1) * SPINE_GAP_PX;
}

export type PageWindow = {
  page: number;
  pageCount: number;
  start: number;
  end: number;
  slice: <T>(items: T[]) => T[];
};

export function pageWindow(total: number, pageSize: number, page: number): PageWindow {
  if (pageSize <= 0) throw new Error('pageSize must be > 0');
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(0, page), pageCount - 1);
  const start = safePage * pageSize;
  const end = Math.min(total, start + pageSize);
  return {
    page: safePage,
    pageCount,
    start,
    end,
    slice: <T,>(items: T[]) => items.slice(start, end),
  };
}

export function cabinetPageForIndex(index: number): number {
  if (index < 0) return 0;
  return Math.floor(index / CHARTS_PER_CABINET_PAGE);
}

export function railPageForIndex(index: number): number {
  if (index < 0) return 0;
  return Math.floor(index / RAIL_VISIBLE_BAYS);
}

export function densityHint(chartCount: number): string | null {
  if (chartCount <= SOFT_MAX_CHARTS_PER_UNIT) return null;
  return `This bay has ${chartCount} charts (soft guidance is ${SOFT_MAX_CHARTS_PER_UNIT}). Paging keeps the UI responsive.`;
}
