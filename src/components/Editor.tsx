import React from 'react';
import { cn } from '../lib/utils';

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const Editor: React.FC<EditorProps> = ({ value, onChange, className }) => {
  return (
    <div className={cn("flex flex-col h-full bg-gray-50", className)}>
      <textarea
        className="flex-1 p-8 font-mono text-sm bg-transparent resize-none focus:outline-none leading-relaxed text-gray-800"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Start writing in Markdown..."
        spellCheck={false}
      />
      <div className="px-4 py-2 bg-white border-t border-gray-200 flex items-center justify-between text-[10px] uppercase tracking-wider text-gray-400 font-medium">
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
