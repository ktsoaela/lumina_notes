import React, { useEffect, useRef, useState } from 'react';
import { cn } from '../lib/utils';

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  /** 0–1 pacing signal for breathing arcs */
  onBreathChange?: (breath: number) => void;
}

type AssistPos = { x: number; y: number; text: string };

const assistActions: { id: string; label: string; apply: (s: string) => string }[] = [
  {
    id: 'soften',
    label: 'Softer',
    apply: (s) => s.replace(/\b(must|should|need to)\b/gi, 'might').replace(/!+/g, '.'),
  },
  {
    id: 'clear',
    label: 'Clearer',
    apply: (s) => s.replace(/\s+/g, ' ').trim(),
  },
  {
    id: 'focus',
    label: 'Shorter',
    apply: (s) => {
      const parts = s.split(/([.!?]+\s*)/);
      return (parts[0] || s).trim();
    },
  },
];

const Editor: React.FC<EditorProps> = ({ value, onChange, className, onBreathChange }) => {
  const words = value.split(/\s+/).filter(Boolean).length;
  const taRef = useRef<HTMLTextAreaElement>(null);
  const stamps = useRef<number[]>([]);
  const [assist, setAssist] = useState<AssistPos | null>(null);

  useEffect(() => {
    if (!onBreathChange) return;
    const id = window.setInterval(() => {
      const now = Date.now();
      stamps.current = stamps.current.filter((t) => now - t < 4000);
      const rate = stamps.current.length / 4; // keystrokes / sec
      const breath = Math.min(1, Math.max(0.15, rate / 6));
      onBreathChange(breath);
    }, 200);
    return () => window.clearInterval(id);
  }, [onBreathChange]);

  const replaceSelection = (next: string) => {
    const el = taRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (start === end) return;
    const merged = value.slice(0, start) + next + value.slice(end);
    onChange(merged);
    setAssist(null);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start, start + next.length);
    });
  };

  return (
    <div className={cn('relative flex h-full flex-col bg-transparent', className)}>
      <textarea
        ref={taRef}
        className={cn(
          'min-h-0 flex-1 resize-none border-0 bg-transparent px-6 py-6 sm:px-10 sm:py-8',
          'font-serif text-[16px] leading-[1.8] text-[var(--app-fg)]',
          'placeholder:text-[var(--app-muted)]/40 focus:outline-none',
          'tracking-[0.01em]'
        )}
        value={value}
        onChange={(e) => {
          stamps.current.push(Date.now());
          onChange(e.target.value);
        }}
        onSelect={() => {
          const el = taRef.current;
          if (!el) return;
          const start = el.selectionStart;
          const end = el.selectionEnd;
          if (end - start < 2 || end - start > 80) {
            setAssist(null);
            return;
          }
          const text = value.slice(start, end);
          if (!text.trim()) {
            setAssist(null);
            return;
          }
          // approximate caret → assist near mid field
          const rect = el.getBoundingClientRect();
          setAssist({
            x: Math.min(rect.width - 200, Math.max(16, rect.width * 0.35)),
            y: 72,
            text,
          });
        }}
        onBlur={() => {
          // delay so assist click registers
          window.setTimeout(() => setAssist(null), 180);
        }}
        placeholder="Begin typing / speak thought…"
        spellCheck
        aria-label="Page content"
      />

      {assist ? (
        <div
          className="radial-assist"
          style={{ left: assist.x, top: assist.y }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {assistActions.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => replaceSelection(a.apply(assist.text))}
            >
              {a.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex items-center justify-between border-t border-[var(--app-border)]/50 px-5 py-2 text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--app-muted)]">
        <span>Quiet spine</span>
        <div className="flex gap-4 normal-case tracking-normal">
          <span>{value.length} chars</span>
          <span>{words} words</span>
        </div>
      </div>
    </div>
  );
};

export default Editor;
