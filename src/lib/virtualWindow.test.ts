import { describe, expect, it } from 'vitest';
import { virtualWindow } from './virtualWindow';

describe('virtualWindow', () => {
  it('windows a long list', () => {
    const w = virtualWindow(200, 20, 100, 100, 1);
    expect(w.start).toBe(4);
    expect(w.end).toBe(11);
    expect(w.offsetY).toBe(80);
    expect(w.totalH).toBe(4000);
  });
});
