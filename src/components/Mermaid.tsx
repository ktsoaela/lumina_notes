import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: true,
  theme: 'default',
  securityLevel: 'loose',
  fontFamily: 'Inter, sans-serif',
});

interface MermaidProps {
  chart: string;
}

const Mermaid: React.FC<MermaidProps> = ({ chart }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && chart) {
      ref.current.removeAttribute('data-processed');
      mermaid.render('mermaid-svg-' + Math.random().toString(36).substr(2, 9), chart).then((result) => {
        if (ref.current) {
          ref.current.innerHTML = result.svg;
        }
      }).catch((err) => {
        console.error('Mermaid rendering error:', err);
        if (ref.current) {
          ref.current.innerHTML = `<div class="p-4 bg-red-50 text-red-500 rounded border border-red-100 text-sm">
            Failed to render diagram: ${err.message}
          </div>`;
        }
      });
    }
  }, [chart]);

  return <div ref={ref} className="flex justify-center my-4 overflow-x-auto" />;
};

export default Mermaid;
