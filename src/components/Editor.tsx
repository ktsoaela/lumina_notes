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
        'flex flex-col h-full bg-gray-50 dark:bg-[var(--app-bg)]/85',
        className
      )}
    >
      <textarea
        className="flex-1 resize-none bg-transparent p-8 font-mono text-sm leading-relaxed text-gray-800 placeholder:text-gray-400 focus:outline-none dark:text-[var(--app-fg)] dark:placeholder:text-[var(--app-muted)]"
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
