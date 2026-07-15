import { describe, expect, it } from 'vitest';
import {
  formatBytes,
  notebookToMarkdown,
  pageToMarkdown,
  parseImportedMarkdown,
} from './markdownIO';
import { coerceEntityTitle, validateEntityTitle } from './validation';
import { searchNotes, matchSnippet } from './search';
import { sanitizeFilename, buildExportFilename } from './filename';
import type { AppState } from '../types';

describe('notes markdown IO', () => {
  it('builds and parses page markdown', () => {
    expect(pageToMarkdown('  Hello ', 'body')).toBe('# Hello\n\nbody');
    expect(parseImportedMarkdown('# Title\n\nBody text')).toEqual({
      title: 'Title',
      content: 'Body text',
    });
    expect(parseImportedMarkdown('plain only')).toEqual({
      title: 'Imported',
      content: 'plain only',
    });
  });

  it('exports a notebook hierarchy', () => {
    const md = notebookToMarkdown({
      id: 'nb-1',
      title: 'Ward notes',
      sections: [
        {
          id: 'sec-1',
          title: 'Intake',
          pages: [{ id: 'p1', title: 'Day 1', content: 'ok', updatedAt: 1 }],
        },
      ],
    });
    expect(md).toContain('# Ward notes');
    expect(md).toContain('## Intake');
    expect(md).toContain('### Day 1');
  });

  it('formats storage bytes', () => {
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
  });
});

describe('notes search', () => {
  const state: AppState = {
    notebooks: [
      {
        id: 'nb-1',
        title: 'Cardiology',
        sections: [
          {
            id: 'sec-1',
            title: 'Rounds',
            pages: [
              {
                id: 'p1',
                title: 'Patient A',
                content: 'Elevated heart rate noted',
                updatedAt: 1,
              },
            ],
          },
        ],
      },
    ],
    activeNotebookId: 'nb-1',
    activeSectionId: 'sec-1',
    activePageId: 'p1',
    secondaryPageId: null,
  };

  it('returns empty for blank query and finds pages in scope', () => {
    expect(searchNotes(state, '   ', 'global')).toEqual([]);
    const hits = searchNotes(state, 'heart', 'global');
    expect(hits.some((h) => h.kind === 'page' && h.label === 'Patient A')).toBe(
      true
    );
  });

  it('builds snippets around matches', () => {
    const snip = matchSnippet('aaa heart rate bbb', 'heart', 40);
    expect(snip.toLowerCase()).toContain('heart');
  });
});

describe('notes filename + title coercion', () => {
  it('sanitizes export names', () => {
    expect(sanitizeFilename('a/b:c*')).toBe('abc');
    expect(sanitizeFilename('Ward / Notes')).toBe('Ward Notes');
    expect(sanitizeFilename('???')).toBe('note');
  });

  it('builds book_chapter_page export stems', () => {
    expect(
      buildExportFilename({
        book: 'AWS Notes',
        chapter: 'AWS Modules',
        page: 'Security: How to implement',
      })
    ).toBe('AWS-Notes_AWS-Modules_Security-How-to-implement');
    expect(buildExportFilename({ page: 'Day 1' })).toBe('Day-1');
    expect(buildExportFilename({ book: 'Work', page: 'Inbox' })).toBe('Work_Inbox');
    expect(
      buildExportFilename({
        book: 'AWS Notes',
        chapter: 'AWS Modules',
        page: '',
      })
    ).toBe('AWS-Notes_AWS-Modules_untitled');
    expect(buildExportFilename({ page: '   ' })).toBe('untitled');
  });

  it('keeps rename paths production-safe', () => {
    expect(coerceEntityTitle('  Cover letter ', 'page')).toBe('Cover letter');
    expect(validateEntityTitle('', 'section').ok).toBe(true);
  });
});
