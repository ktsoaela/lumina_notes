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

type HastNode = {
  type?: string;
  tagName?: string;
  properties?: { className?: unknown };
  children?: HastNode[];
};

/** Language of a fenced block: <pre><code class="language-x"> → "x". */
function fenceLang(node: HastNode | undefined): string {
  const code = node?.children?.find((c) => c.type === 'element' && c.tagName === 'code');
  const cls = code?.properties?.className;
  const list = Array.isArray(cls) ? cls.map(String) : typeof cls === 'string' ? [cls] : [];
  const hit = list.find((c) => c.startsWith('language-'));
  return hit ? hit.slice('language-'.length) : '';
}

const DIAGRAM_LANGS = new Set(['mermaid', 'plotly']);

/**
 * Markdown reader styled after VS Code's preview — see `.md-reader` in index.css.
 * Font, size and colour come from Profile → Reading & writing (CSS variables).
 */
const Preview: React.FC<PreviewProps> = ({ content, className }) => {
  return (
    <div className={cn('md-reader h-full overflow-y-auto', className)}>
      <div className="md-reader-body">
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{
            pre({ node, children }) {
              // Diagrams render as their own block, without the code-block chrome.
              if (DIAGRAM_LANGS.has(fenceLang(node as HastNode))) {
                return <div className="md-diagram">{children}</div>;
              }
              return <pre>{children}</pre>;
            },
            code({ className: cls, children, ...props }) {
              const lang = /language-(\w+)/.exec(cls || '')?.[1] ?? '';
              const text = String(children).replace(/\n$/, '');
              if (lang === 'mermaid') return <Mermaid chart={text} />;
              if (lang === 'plotly') return <PlotlyChart data={text} />;
              return (
                <code className={cls} {...props}>
                  {children}
                </code>
              );
            },
            table: ({ children }) => (
              <div className="md-table-wrap">
                <table>{children}</table>
              </div>
            ),
            a: ({ children, href }) => (
              <a href={href} target="_blank" rel="noreferrer noopener">
                {children}
              </a>
            ),
          }}
        >
          {content}
        </Markdown>
      </div>
    </div>
  );
};

export default Preview;
