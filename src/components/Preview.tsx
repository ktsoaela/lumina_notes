import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Mermaid from './Mermaid';
import PlotlyChart from './PlotlyChart';
import { cn } from '../lib/utils';

interface PreviewProps {
  content: string;
  className?: string;
}

const Preview: React.FC<PreviewProps> = ({ content, className }) => {
  return (
    <div
      className={cn(
        'prose prose-slate dark:prose-invert max-w-none h-full overflow-y-auto bg-white p-8 dark:bg-[var(--app-surface)]',
        className
      )}
    >
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ inline, className, children, ...props }: {
            inline?: boolean;
            className?: string;
            children?: React.ReactNode;
          }) {
            const match = /language-(\w+)/.exec(className || '');
            const lang = match ? match[1] : '';
            const codeContent = String(children).replace(/\n$/, '');

            if (!inline && lang === 'mermaid') {
              return <Mermaid chart={codeContent} />;
            }

            if (!inline && lang === 'plotly') {
              return <PlotlyChart data={codeContent} />;
            }

            return (
              <code
                className={cn(
                  className,
                  'rounded bg-gray-100 px-1 py-0.5 font-mono text-sm text-gray-800 dark:bg-[var(--app-bg)] dark:text-[var(--app-fg)]'
                )}
                {...props}
              >
                {children}
              </code>
            );
          },
          pre({ children }) {
            return <div className="not-prose my-4">{children}</div>;
          },
          h1: ({ children }) => (
            <h1 className="mb-4 border-b border-gray-200 pb-2 text-3xl font-bold text-gray-900 dark:border-[var(--app-border)] dark:text-[var(--app-fg)]">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-3 mt-6 text-2xl font-semibold text-gray-800 dark:text-[var(--app-fg)]">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-4 text-xl font-medium text-gray-800 dark:text-[var(--app-fg)]/95">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="mb-4 leading-relaxed text-gray-700 dark:text-[var(--app-fg)]/90">{children}</p>
          ),
          ul: ({ children }) => <ul className="list-disc pl-6 mb-4 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 space-y-1">{children}</ol>,
          li: ({ children }) => (
            <li className="text-gray-700 dark:text-[var(--app-fg)]/90">{children}</li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-4 border-l-4 border-gray-200 pl-4 italic text-gray-600 dark:border-[var(--app-border)] dark:text-[var(--app-muted)]">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full border-collapse border border-gray-200 dark:border-[var(--app-border)]">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-gray-200 bg-gray-50 px-4 py-2 text-left font-semibold text-gray-900 dark:border-[var(--app-border)] dark:bg-[var(--app-bg)] dark:text-[var(--app-fg)]">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-gray-200 px-4 py-2 text-gray-800 dark:border-[var(--app-border)] dark:text-[var(--app-fg)]/95">
              {children}
            </td>
          ),
        }}
      >
        {content}
      </Markdown>
    </div>
  );
};

export default Preview;
