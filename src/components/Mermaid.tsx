import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import { escapeText, sanitizeSvg } from '../lib/sanitize';

interface MermaidProps {
  chart: string;
}

const Mermaid: React.FC<MermaidProps> = ({ chart }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !chart) return;

    const dark = document.documentElement.classList.contains('dark');
    mermaid.initialize({
      startOnLoad: true,
      theme: dark ? 'dark' : 'default',
      securityLevel: 'strict',
      fontFamily: 'Inter, sans-serif',
    });

    ref.current.removeAttribute('data-processed');
    mermaid
      .render('mermaid-svg-' + Math.random().toString(36).substr(2, 9), chart)
      .then((result) => {
        if (ref.current) {
          ref.current.innerHTML = sanitizeSvg(result.svg);
        }
      })
      .catch((err) => {
        console.error('Mermaid rendering error:', err);
        if (ref.current) {
          const message =
            err && typeof err === 'object' && 'message' in err
              ? String((err as { message: unknown }).message)
              : 'Unknown error';
          ref.current.innerHTML = `<div class="p-4 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded border border-red-100 dark:border-red-900 text-sm">
            Failed to render diagram: ${escapeText(message)}
          </div>`;
        }
      });
  }, [chart]);

  return <div ref={ref} className="flex justify-center my-4 overflow-x-auto" />;
};

export default Mermaid;
