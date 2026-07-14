import React from 'react';
import { cn } from '../lib/utils';

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const Editor: React.FC<EditorProps> = ({ value, onChange, className }) => {
  const words = value.split(/\s+/).filter(Boolean).length;

  return (
    <div className={cn('flex h-full flex-col bg-transparent', className)}>
      <textarea
        className={cn(
          'min-h-0 flex-1 resize-none border-0 bg-transparent px-6 py-5 sm:px-8 sm:py-6',
          'font-serif text-[15.5px] leading-[1.75] text-[var(--app-fg)]',
          'placeholder:text-[var(--app-muted)]/45 focus:outline-none'
        )}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Write this page… Markdown welcome."
        spellCheck
        aria-label="Page content"
      />
      <div className="flex items-center justify-between border-t border-[var(--app-border)]/70 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--app-muted)]">
        <span>Writing desk</span>
        <div className="flex gap-4 normal-case tracking-normal">
          <span>{value.length} chars</span>
          <span>{words} words</span>
        </div>
      </div>
    </div>
  );
};

export default Editor;
