import type { Notebook } from '../types';

export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename.endsWith('.md') ? filename : `${filename}.md`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function pageToMarkdown(title: string, content: string): string {
  const t = title.trim() || 'Untitled';
  return `# ${t}\n\n${content}`;
}

export function notebookToMarkdown(nb: Notebook): string {
  const title = nb.title.trim() || 'Notebook';
  let out = `# ${title}\n\n`;
  for (const sec of nb.sections) {
    out += `## ${sec.title}\n\n`;
    for (const p of sec.pages) {
      out += `### ${p.title}\n\n${p.content}\n\n`;
    }
  }
  return out.trim() + '\n';
}

/** Single-page import: whole file becomes one page body; first line # title optional */
export function parseImportedMarkdown(raw: string): { title: string; content: string } {
  const text = raw.replace(/^\uFEFF/, '').trim();
  const m = /^#\s+(.+)$/m.exec(text);
  if (m) {
    const title = m[1].trim();
    const rest = text.slice(m.index + m[0].length).trim();
    return { title: title || 'Imported', content: rest };
  }
  return { title: 'Imported', content: text };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
