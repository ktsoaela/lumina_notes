import React, { forwardRef } from 'react';
import Preview from './Preview';

export interface PrintableNoteProps {
  title: string;
  content: string;
}

/**
 * Rendered off-screen for print / PDF; mirrors preview styling (Markdown → HTML).
 */
const PrintableNote = forwardRef<HTMLDivElement, PrintableNoteProps>(
  function PrintableNote({ title, content }, ref) {
    return (
      <div
        ref={ref}
        className="fixed left-0 top-0 z-[-1] bg-white text-gray-900 opacity-0 pointer-events-none"
        style={{ width: '210mm', boxSizing: 'border-box' }}
      >
        <div className="px-10 pt-10 pb-8">
          <h1 className="text-3xl font-bold text-gray-900 border-b border-gray-200 pb-3 mb-6 print:mb-4">
            {title}
          </h1>
          <Preview
            content={content}
            className="p-0 h-auto min-h-0 overflow-visible bg-white max-w-none"
          />
        </div>
      </div>
    );
  }
);

export default PrintableNote;
