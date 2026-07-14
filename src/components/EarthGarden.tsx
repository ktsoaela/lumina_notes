import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import type { Bookshelf, Notebook, Page, Section } from '../types';

type ScaleMode = 'garden' | 'grove' | 'forest';

type Props = {
  beds: Bookshelf[];
  selectedBedId: string | null;
  plants: Notebook[];
  season: number;
  onSeasonChange: (v: number) => void;
  onSelectBed: (id: string) => void;
  onOpenPlant: (nb: Notebook) => void;
  onOpenLeaf: (nb: Notebook, section: Section, page: Page) => void;
};

const SCALE: Record<
  ScaleMode,
  { label: string; bed: string; plant: string; blurb: string }
> = {
  garden: {
    label: 'Garden',
    bed: 'Bed',
    plant: 'Plant',
    blurb: 'Bed · plant · leaf cluster · leaf',
  },
  grove: {
    label: 'Grove',
    bed: 'Grove',
    plant: 'Tree',
    blurb: 'Grove · tree · limb · leaf',
  },
  forest: {
    label: 'Forest',
    bed: 'Stand',
    plant: 'Tree',
    blurb: 'Forest · tree · branch · leaf',
  },
};

function seed(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0xffffffff;
}

function pageCount(nb: Notebook) {
  return nb.sections.reduce((n, s) => n + s.pages.length, 0);
}

function BedMoss({ active, bedId }: { active: boolean; bedId: string }) {
  const soilId = `soil-${bedId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg
      viewBox="0 0 320 88"
      className="h-full w-full"
      aria-hidden
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id={soilId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={active ? '#c5d4c8' : '#d8ddd6'} />
          <stop offset="55%" stopColor={active ? '#9aaf9c' : '#b7beb6'} />
          <stop offset="100%" stopColor={active ? '#6f8674' : '#8a9288'} />
        </linearGradient>
      </defs>
      <rect width="320" height="88" fill={`url(#${soilId})`} />
      <ellipse cx="160" cy="78" rx="150" ry="22" fill="#5c6e5f" opacity="0.28" />
      <path
        d="M0 58 C40 42 80 70 120 52 C160 34 200 60 240 48 C280 36 300 54 320 46 L320 88 L0 88 Z"
        fill="#4d614f"
        opacity="0.35"
      />
      <g fill="none" stroke="#375348" strokeWidth="1.4" strokeLinecap="round" opacity="0.55">
        <path d="M48 64 C50 52 46 44 50 36" />
        <path d="M96 68 C98 58 102 50 99 40" />
        <path d="M168 66 C170 54 166 46 171 38" />
        <path d="M232 70 C234 60 230 50 236 42" />
        <path d="M280 64 C282 54 278 46 283 38" />
      </g>
      <g fill="#547f72" opacity="0.45">
        <ellipse cx="50" cy="36" rx="5" ry="3" transform="rotate(-28 50 36)" />
        <ellipse cx="99" cy="40" rx="5" ry="3" transform="rotate(24 99 40)" />
        <ellipse cx="171" cy="38" rx="6" ry="3.2" transform="rotate(-18 171 38)" />
        <ellipse cx="236" cy="42" rx="5" ry="3" transform="rotate(30 236 42)" />
        <ellipse cx="283" cy="38" rx="5" ry="3" transform="rotate(-22 283 38)" />
      </g>
    </svg>
  );
}

function PlantGlyph({
  mode,
  growth,
  variant,
  gid,
}: {
  mode: ScaleMode;
  growth: number;
  variant: number;
  gid: string;
}) {
  const lean = (variant - 0.5) * 8;
  const h = 42 + growth * 38;
  const isTree = mode !== 'garden';
  const canopyR = isTree ? 14 + growth * 10 : 10 + growth * 8;
  const stemGrad = `stem-${gid}`;
  const canopyGrad = `canopy-${gid}`;

  return (
    <svg
      viewBox="0 0 64 96"
      width="64"
      height={56 + growth * 40}
      className="overflow-visible transition-[height] duration-500 ease-out"
      aria-hidden
    >
      <defs>
        <linearGradient id={stemGrad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6b8f71" />
          <stop offset="100%" stopColor="#3d5c45" />
        </linearGradient>
        <radialGradient id={canopyGrad} cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#8fad92" />
          <stop offset="55%" stopColor="#547f72" />
          <stop offset="100%" stopColor="#375348" />
        </radialGradient>
      </defs>
      <ellipse cx="32" cy="90" rx="14" ry="4" fill="#8a9288" opacity="0.35" />
      <path
        d={`M32 88 C ${32 + lean * 0.3} ${88 - h * 0.45}, ${32 - lean * 0.2} ${88 - h * 0.75}, ${32 + lean * 0.15} ${88 - h}`}
        fill="none"
        stroke={`url(#${stemGrad})`}
        strokeWidth={isTree ? 2.6 : 2}
        strokeLinecap="round"
      />
      {isTree ? (
        <>
          <path
            d={`M${32 + lean * 0.1} ${88 - h * 0.55} C ${40 + lean} ${88 - h * 0.7}, ${46} ${88 - h * 0.62}, ${48} ${88 - h * 0.5}`}
            fill="none"
            stroke="#4a6b55"
            strokeWidth="1.4"
            strokeLinecap="round"
            opacity="0.85"
          />
          <path
            d={`M${32 - lean * 0.05} ${88 - h * 0.48} C ${22 - lean} ${88 - h * 0.65}, ${16} ${88 - h * 0.58}, ${14} ${88 - h * 0.46}`}
            fill="none"
            stroke="#4a6b55"
            strokeWidth="1.4"
            strokeLinecap="round"
            opacity="0.85"
          />
        </>
      ) : null}
      <g transform={`translate(${32 + lean * 0.15} ${88 - h})`}>
        {mode === 'garden' ? (
          <>
            <ellipse
              cx="-7"
              cy="2"
              rx={canopyR * 0.55}
              ry={canopyR * 0.32}
              fill={`url(#${canopyGrad})`}
              transform="rotate(-32)"
            />
            <ellipse
              cx="8"
              cy="1"
              rx={canopyR * 0.55}
              ry={canopyR * 0.32}
              fill={`url(#${canopyGrad})`}
              transform="rotate(28)"
            />
            <ellipse cx="0" cy="-4" rx={canopyR * 0.42} ry={canopyR * 0.28} fill="#6f9480" />
          </>
        ) : (
          <>
            <circle cx="0" cy="-2" r={canopyR} fill={`url(#${canopyGrad})`} />
            <circle cx="-6" cy="4" r={canopyR * 0.55} fill="#6a9078" opacity="0.85" />
            <circle cx="7" cy="3" r={canopyR * 0.5} fill="#4f7460" opacity="0.8" />
            {mode === 'forest' ? (
              <circle cx="1" cy="-8" r={canopyR * 0.4} fill="#8fad92" opacity="0.75" />
            ) : null}
          </>
        )}
      </g>
    </svg>
  );
}

function LeafGlyph({
  title,
  onOpen,
}: {
  title: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onOpen}
      className="group inline-flex items-center gap-2 rounded-full border border-[var(--app-border)] bg-[var(--paper)] px-2.5 py-1.5 text-left transition hover:border-[var(--spine)]/40 hover:bg-[var(--sage)]"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="shrink-0">
        <path d="M3 12 C3 6 7 2 13 2 C13 8 9 12 3 12 Z" fill="#547f72" />
        <path
          d="M4.2 11.2 C7 9 10 6 12.4 3.4"
          fill="none"
          stroke="var(--paper)"
          strokeWidth="0.7"
          strokeLinecap="round"
          opacity="0.7"
        />
      </svg>
      <span className="max-w-[9rem] truncate text-[11px] font-medium tracking-wide text-[var(--app-fg)]">
        {title || 'Untitled page'}
      </span>
    </button>
  );
}

export default function EarthGarden({
  beds,
  selectedBedId,
  plants,
  season,
  onSeasonChange,
  onSelectBed,
  onOpenPlant,
  onOpenLeaf,
}: Props) {
  const [scale, setScale] = useState<ScaleMode>('garden');
  const [openPlantId, setOpenPlantId] = useState<string | null>(null);
  const [openChapterId, setOpenChapterId] = useState<string | null>(null);
  const meta = SCALE[scale];

  const sortedPlants = useMemo(() => {
    const list = [...plants];
    list.sort((a, b) => pageCount(a) - pageCount(b));
    return list;
  }, [plants]);

  const selectedBed = beds.find((b) => b.id === selectedBedId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-[var(--app-muted)]">
            Earth archive
          </p>
          <h2 className="mt-1 font-display text-xl font-medium tracking-tight">Mind garden</h2>
          <p className="mt-1 text-xs text-[var(--app-muted)]">{meta.blurb}</p>
        </div>
        <div className="inline-flex rounded-full border border-[var(--app-border)] bg-[var(--gutter)]/60 p-0.5">
          {(Object.keys(SCALE) as ScaleMode[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setScale(id)}
              className={cn(
                'rounded-full px-3 py-1.5 text-[11px] font-medium tracking-wide transition',
                scale === id
                  ? 'bg-[var(--paper)] text-[var(--app-fg)] shadow-sm'
                  : 'text-[var(--app-muted)] hover:text-[var(--app-fg)]'
              )}
            >
              {SCALE[id].label}
            </button>
          ))}
        </div>
      </div>

      <section className="studio-panel overflow-hidden p-4 sm:p-5">
        {beds.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-center">
            <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden className="mb-3 opacity-70">
              <ellipse cx="24" cy="38" rx="16" ry="5" fill="#c5d4c8" />
              <path
                d="M24 36 C24 28 22 22 24 14"
                stroke="#547f72"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
              />
              <ellipse cx="20" cy="16" rx="6" ry="3.5" fill="#6f9480" transform="rotate(-30 20 16)" />
              <ellipse cx="28" cy="15" rx="6" ry="3.5" fill="#547f72" transform="rotate(28 28 15)" />
            </svg>
            <p className="font-display text-lg font-medium">Empty soil</p>
            <p className="mt-1 max-w-sm text-sm text-[var(--app-muted)]">
              Add a garden bed below, then plant books inside.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {beds.map((bed) => {
              const active = selectedBedId === bed.id;
              const countLabel =
                plants.length === 1
                  ? meta.plant.toLowerCase()
                  : `${meta.plant.toLowerCase()}s`;
              return (
                <button
                  key={bed.id}
                  type="button"
                  onClick={() => {
                    onSelectBed(bed.id);
                    setOpenPlantId(null);
                    setOpenChapterId(null);
                  }}
                  className={cn(
                    'overflow-hidden rounded-[var(--radius-ui)] border text-left transition',
                    active
                      ? 'border-[var(--spine)] bg-[var(--sage)]/35 shadow-[var(--shadow-micro)]'
                      : 'border-[var(--app-border)] bg-[var(--paper)] hover:border-[var(--spine)]/35'
                  )}
                >
                  <div className="h-[72px] overflow-hidden">
                    <BedMoss active={active} bedId={bed.id} />
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--app-muted)]">
                      {meta.bed}
                    </p>
                    <p className="mt-0.5 truncate font-display text-base font-medium tracking-tight">
                      {bed.title}
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--app-muted)]">
                      {active ? `${plants.length} ${countLabel}` : 'Select to enter'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <div className="studio-panel flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-6">
        <div className="shrink-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--app-muted)]">
            Season
          </p>
          <p className="text-xs text-[var(--app-muted)]">Growth of foliage</p>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(season * 100)}
          onChange={(e) => onSeasonChange(Number(e.target.value) / 100)}
          aria-label="Season growth"
          className="earth-season-slider min-w-0 flex-1"
        />
        <div className="flex gap-4 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--app-muted)] sm:w-36 sm:justify-between">
          <span>Dormant</span>
          <span>Bloom</span>
        </div>
      </div>

      {selectedBed ? (
        <section className="studio-panel overflow-hidden">
          <div className="border-b border-[var(--app-border)] px-4 py-4 sm:px-5">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--app-muted)]">
              Growing in {selectedBed.title}
            </p>
            <p className="mt-1 text-sm text-[var(--app-muted)]">
              Open a {meta.plant.toLowerCase()} for chapters, then a leaf for a page.
            </p>
          </div>

          {sortedPlants.length === 0 ? (
            <p className="px-4 py-14 text-center text-sm text-[var(--app-muted)]">
              This bed is quiet — plant a book below.
            </p>
          ) : (
            <div className="earth-plot-stage relative px-3 pb-10 pt-6 sm:px-6">
              <div className="earth-horizon" aria-hidden />
              <div className="relative z-[1] flex min-h-[220px] flex-wrap items-end justify-center gap-x-5 gap-y-12 sm:gap-x-10">
                {sortedPlants.map((nb) => {
                  const open = openPlantId === nb.id;
                  const growth = Math.min(
                    1,
                    0.35 + season * 0.45 + Math.min(pageCount(nb), 24) / 40
                  );
                  const v = seed(nb.id);
                  return (
                    <div
                      key={nb.id}
                      className="relative flex w-[4.75rem] flex-col items-center sm:w-24"
                    >
                      <AnimatePresence>
                        {open ? (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 8 }}
                            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                            className="absolute bottom-[calc(100%+0.4rem)] z-20 w-[min(18rem,82vw)] rounded-[var(--radius-ui)] border border-[var(--app-border)] bg-[var(--paper)] p-3 shadow-[var(--shadow-soft)]"
                          >
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <p className="truncate text-xs font-medium tracking-wide">
                                {nb.title || 'Untitled'}
                              </p>
                              <button
                                type="button"
                                className="studio-btn !px-2 !py-1 !text-[10px]"
                                onClick={() => onOpenPlant(nb)}
                              >
                                Open book
                              </button>
                            </div>
                            <ul className="max-h-52 space-y-1.5 overflow-y-auto">
                              {nb.sections.length === 0 ? (
                                <li className="text-[11px] text-[var(--app-muted)]">
                                  No chapters yet
                                </li>
                              ) : (
                                nb.sections.map((sec, si) => {
                                  const chapOpen = openChapterId === sec.id;
                                  return (
                                    <li key={sec.id}>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setOpenChapterId(chapOpen ? null : sec.id)
                                        }
                                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] transition hover:bg-[var(--sage)]"
                                      >
                                        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                                          <path
                                            d="M2 9 C2 5 5 2 10 2 C10 6 7 9 2 9 Z"
                                            fill="#547f72"
                                          />
                                        </svg>
                                        <span className="truncate font-medium">
                                          {sec.title || `Chapter ${si + 1}`}
                                        </span>
                                        <span className="ml-auto text-[var(--app-muted)]">
                                          {sec.pages.length}
                                        </span>
                                      </button>
                                      <AnimatePresence>
                                        {chapOpen ? (
                                          <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden"
                                          >
                                            <div className="flex flex-wrap gap-1.5 px-1 py-1.5">
                                              {sec.pages.map((pg) => (
                                                <LeafGlyph
                                                  key={pg.id}
                                                  title={pg.title}
                                                  onOpen={() => onOpenLeaf(nb, sec, pg)}
                                                />
                                              ))}
                                            </div>
                                          </motion.div>
                                        ) : null}
                                      </AnimatePresence>
                                    </li>
                                  );
                                })
                              )}
                            </ul>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>

                      <button
                        type="button"
                        className={cn(
                          'flex flex-col items-center rounded-xl px-1 pb-1 pt-1 transition',
                          open && 'bg-[var(--sage)]/45'
                        )}
                        onClick={() => {
                          setOpenPlantId(open ? null : nb.id);
                          setOpenChapterId(null);
                        }}
                        title={nb.title}
                      >
                        <span className={cn(!open && 'earth-sway')}>
                          <PlantGlyph
                            mode={scale}
                            growth={growth}
                            variant={v}
                            gid={nb.id.replace(/[^a-zA-Z0-9_-]/g, '')}
                          />
                        </span>
                        <span className="mt-1 max-w-[5.5rem] truncate text-center text-[10px] font-medium tracking-wide text-[var(--app-muted)]">
                          {nb.title || 'Untitled'}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
