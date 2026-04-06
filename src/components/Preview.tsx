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
    <div className={cn("prose prose-slate max-w-none p-8 overflow-y-auto h-full bg-white", className)}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, inline, className, children, ...props }: any) {
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
              <code className={cn(className, "bg-gray-100 rounded px-1 py-0.5 font-mono text-sm")} {...props}>
                {children}
              </code>
            );
          },
          pre({ children }) {
            return <div className="not-prose my-4">{children}</div>;
          },
          h1: ({ children }) => <h1 className="text-3xl font-bold border-b pb-2 mb-4 text-gray-900">{children}</h1>,
          h2: ({ children }) => <h2 className="text-2xl font-semibold mt-6 mb-3 text-gray-800">{children}</h2>,
          h3: ({ children }) => <h3 className="text-xl font-medium mt-4 mb-2 text-gray-800">{children}</h3>,
          p: ({ children }) => <p className="mb-4 leading-relaxed text-gray-700">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-6 mb-4 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="text-gray-700">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-gray-200 pl-4 italic text-gray-600 my-4">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full border-collapse border border-gray-200">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => <th className="border border-gray-200 bg-gray-50 px-4 py-2 text-left font-semibold">{children}</th>,
          td: ({ children }) => <td className="border border-gray-200 px-4 py-2">{children}</td>,
        }}
      >
        {content}
      </Markdown>
    </div>
  );
};

export default Preview;
