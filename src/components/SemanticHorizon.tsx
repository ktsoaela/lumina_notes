import React, { useMemo, useState } from 'react';
import { BookMarked, DoorOpen } from 'lucide-react';
import { cn } from '../lib/utils';
import type { Bookshelf, Notebook } from '../types';

type Props = {
  bookshelves: Bookshelf[];
  selectedShelfId: string | null;
  notebooks: Notebook[];
  chrono: number;
  onChronoChange: (v: number) => void;
  onSelectShelf: (id: string) => void;
  onOpenNotebook: (nb: Notebook) => void;
};

const ROOM_HUES = [
  '142 22% 42%',
  '200 28% 42%',
  '32 35% 48%',
  '280 18% 45%',
  '170 25% 40%',
  '15 30% 48%',
] as const;

function roomHue(id: string, i: number) {
  let h = 0;
  for (let c = 0; c < id.length; c++) h = (h + id.charCodeAt(c) * (c + 1)) % 997;
  return ROOM_HUES[(h + i) % ROOM_HUES.length];
}

function notebookTime(nb: Notebook) {
  let m = 0;
  for (const s of nb.sections) {
    for (const p of s.pages) {
      const t = typeof p.updatedAt === 'number' ? p.updatedAt : 0;
      if (t > m) m = t;
    }
  }
  return m;
}

function pageCount(nb: Notebook) {
  return nb.sections.reduce((n, s) => n + s.pages.length, 0);
}

export default function SemanticHorizon({
  bookshelves,
  selectedShelfId,
  notebooks,
  chrono,
  onChronoChange,
  onSelectShelf,
  onOpenNotebook,
}: Props) {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [pulse, setPulse] = useState(false);

  const sorted = useMemo(() => {
    const list = [...notebooks];
    list.sort((a, b) => {
      const ta = notebookTime(a);
      const tb = notebookTime(b);
      return chrono < 0.5 ? ta - tb : tb - ta;
    });
    return list;
  }, [notebooks, chrono]);

  const focusRoom = bookshelves.find((s) => s.id === (hoverId || selectedShelfId));
  const summary = focusRoom
    ? `${focusRoom.title} · ${notebooks.length} memor${notebooks.length === 1 ? 'y' : 'ies'} on the shelves`
    : bookshelves.length === 0
      ? 'Your mind is quiet — open the first room'
      : 'Step into a room. Memories wait as books.';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-[var(--app-muted)]">
            The mind
          </p>
          <h2 className="mt-1 font-display text-xl font-medium tracking-tight">
            Rooms of memory
          </h2>
        </div>
        <p className="max-w-md text-right text-xs leading-relaxed text-[var(--app-muted)]">
          Each room is a wing of your mind. Inside, memories live as books you can open, write,
          and return to.
        </p>
      </div>

      <div
        className={cn('mind-palace', pulse && 'horizon-vibrate')}
        onAnimationEnd={() => setPulse(false)}
      >
        <div className="mind-palace-glow" aria-hidden />

        {bookshelves.length === 0 ? (
          <div className="relative z-[1] flex min-h-[380px] flex-col items-center justify-center px-6 text-center">
            <DoorOpen className="mb-3 h-9 w-9 text-[var(--spine)] opacity-70" />
            <p className="font-display text-2xl font-medium tracking-tight">No rooms yet</p>
            <p className="mt-2 max-w-sm text-sm text-[var(--app-muted)]">
              Create a room for work, journaling, projects — then fill it with memory books.
            </p>
          </div>
        ) : (
          <div className="relative z-[1] grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 lg:p-6">
            {bookshelves.map((room, i) => {
              const active = selectedShelfId === room.id;
              const hue = roomHue(room.id, i);
              const memCount =
                selectedShelfId === room.id ? notebooks.length : undefined;
              return (
                <button
                  key={room.id}
                  type="button"
                  className="mind-room"
                  data-active={active ? 'true' : 'false'}
                  style={{ ['--room-hue' as string]: hue }}
                  onMouseEnter={() => {
                    setHoverId(room.id);
                    setPulse(true);
                  }}
                  onMouseLeave={() => setHoverId(null)}
                  onFocus={() => {
                    setHoverId(room.id);
                    setPulse(true);
                  }}
                  onBlur={() => setHoverId(null)}
                  onClick={() => onSelectShelf(room.id)}
                >
                  <span className="mind-room-door" aria-hidden />
                  <span className="mind-room-label">
                    <span className="block text-[10px] font-medium uppercase tracking-[0.2em] opacity-70">
                      Room
                    </span>
                    <span className="mt-1 block font-display text-lg font-medium tracking-tight">
                      {room.title}
                    </span>
                    {memCount != null ? (
                      <span className="mt-2 block text-[11px] opacity-75">
                        {memCount} memor{memCount === 1 ? 'y' : 'ies'}
                      </span>
                    ) : (
                      <span className="mt-2 block text-[11px] opacity-60">Enter</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Memory books floating in the selected room */}
        {selectedShelfId && sorted.length > 0 ? (
          <div className="relative z-[2] border-t border-[color-mix(in_srgb,var(--stone)_70%,transparent)] px-4 py-5 sm:px-6">
            <div className="mb-3 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--app-muted)]">
              <BookMarked className="h-3.5 w-3.5 text-[var(--spine)]" />
              Memories in this room
            </div>
            <div className="memory-shelf flex flex-wrap content-end items-end gap-2.5">
              {sorted.slice(0, 24).map((nb, i) => {
                const pages = pageCount(nb);
                const h = 72 + Math.min(56, pages * 4) + (i % 3) * 8;
                const hue = roomHue(nb.id, i);
                return (
                  <button
                    key={nb.id}
                    type="button"
                    title={nb.title}
                    onClick={() => onOpenNotebook(nb)}
                    className="memory-book"
                    style={{
                      height: h,
                      ['--book-hue' as string]: hue,
                    }}
                  >
                    <span className="memory-book-title">
                      {(nb.title?.trim() || 'Untitled').slice(0, 42)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="horizon-summary">{summary}</div>
      </div>

      <div className="chrono-rib px-1">
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(chrono * 100)}
          onChange={(e) => onChronoChange(Number(e.target.value) / 100)}
          aria-label="Memory timeline"
        />
      </div>
      <div className="flex justify-between px-1 text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--app-muted)]">
        <span>Older memories</span>
        <span>Timeline</span>
        <span>Fresh thoughts</span>
      </div>
    </div>
  );
}
