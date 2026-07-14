/** Tiny scroll window — no react-window dependency. */
export type VirtualWindow = {
  start: number;
  end: number;
  offsetY: number;
  totalH: number;
};

export function virtualWindow(
  count: number,
  rowHeight: number,
  scrollTop: number,
  viewportH: number,
  overscan = 4
): VirtualWindow {
  const totalH = Math.max(count, 0) * rowHeight;
  if (count <= 0) return { start: 0, end: 0, offsetY: 0, totalH: 0 };
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const visible = Math.ceil(viewportH / rowHeight) + overscan * 2;
  const end = Math.min(count, start + visible);
  return { start, end, offsetY: start * rowHeight, totalH };
}

// ponytail: self-check
if (typeof process !== "undefined" && process.env?.NODE_ENV === "test") {
  const w = virtualWindow(100, 10, 50, 40, 0);
  if (w.start !== 5 || w.end !== 9) {
    throw new Error(`virtualWindow failed: ${JSON.stringify(w)}`);
  }
}
