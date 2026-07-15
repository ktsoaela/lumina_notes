import { describe, expect, it } from 'vitest';
import { apiUrl, normalizeSyncServerUrl } from './syncServer';

describe('syncServer', () => {
  it('normalizes URLs', () => {
    expect(normalizeSyncServerUrl('https://notes.example.com/')).toBe(
      'https://notes.example.com'
    );
    expect(normalizeSyncServerUrl('notes.example.com')).toBe(
      'https://notes.example.com'
    );
    expect(normalizeSyncServerUrl('')).toBe('');
  });

  it('builds api paths', () => {
    expect(apiUrl('/api/health')).toMatch(/\/api\/health$/);
  });
});
