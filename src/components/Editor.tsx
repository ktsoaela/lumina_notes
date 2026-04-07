import React from 'react';
import { cn } from '../lib/utils';

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const Editor: React.FC<EditorProps> = ({ value, onChange, className }) => {
  return (
    <div
      className={cn(
        'flex flex-col h-full bg-[#dceaf4] dark:bg-[var(--app-bg)]/85',
        className
      )}
    >
      <textarea
        className={cn(
          'flex-1 resize-none rounded-md border border-brand-300 bg-transparent p-8',
          'font-mono text-sm leading-relaxed text-gray-800 placeholder:text-gray-400',
          'focus:outline-none focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 focus-visible:ring-offset-[#dceaf4]',
          'dark:border-[var(--app-border)] dark:text-[var(--app-fg)] dark:placeholder:text-[var(--app-muted)]',
          'dark:focus-visible:border-brand-400 dark:focus-visible:ring-brand-400 dark:focus-visible:ring-offset-[var(--app-bg)]'
        )}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Start writing in Markdown..."
        spellCheck={false}
      />
      <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:border-[var(--app-border)] dark:bg-[var(--app-surface)] dark:text-[var(--app-muted)]">
        <span>Markdown Editor</span>
        <div className="flex gap-4">
          <span>{value.length} characters</span>
          <span>{value.split(/\s+/).filter(Boolean).length} words</span>
        </div>
      </div>
    </div>
  );
};

export default Editor;
