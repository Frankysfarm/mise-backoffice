'use client';

import { useState } from 'react';
import { MapPin, Navigation, CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Stopp = {
  id: string;
  reihenfolge: number | null;
  geliefert_am: string | null;
  adresse?: string | null;
  lat?: number | null;
  lng?: number | null;
};

type Props = {
  stopps: Stopp[];
  fahrerLat?: number | null;
  fahrerLng?: number | null;
  className?: string;
};

function normalize(val: number, min: number, max: number, svgMin: number, svgMax: number): number {
  if (max === min) return (svgMin + svgMax) / 2;
  return svgMin + ((val - min) / (max - min)) * (svgMax - svgMin);
}

const COLORS = {
  done: '#4ade80',
  next: '#f97316',
  pending: '#94a3b8',
  fahrer: '#6366f1',
  line: '#cbd5e1',
};

export function FahrerPhase1076LiveTourKartenMinimap({ stopps, fahrerLat, fahrerLng, className }: Props) {
  const [open, setOpen] = useState(false);

  // Build coordinate list; fall back to synthetic grid if no real coords
  const hasCoords = stopps.some((s) => s.lat != null && s.lng != null);

  const stoppsSorted = [...stopps].sort((a, b) => (a.reihenfolge ?? 99) - (b.reihenfolge ?? 99));

  const nextIdx = stoppsSorted.findIndex((s) => !s.geliefert_am);

  const allPoints: Array<{ x: number; y: number; is_fahrer?: boolean; stopp?: Stopp }> = [];

  if (hasCoords) {
    const lats = stoppsSorted.map((s) => s.lat ?? 0).filter(Boolean);
    const lngs = stoppsSorted.map((s) => s.lng ?? 0).filter(Boolean);
    if (fahrerLat != null) lats.push(fahrerLat);
    if (fahrerLng != null) lngs.push(fahrerLng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    for (const s of stoppsSorted) {
      if (s.lat == null || s.lng == null) continue;
      allPoints.push({
        x: normalize(s.lng, minLng, maxLng, 16, 184),
        y: normalize(maxLat - (s.lat - minLat), minLat, maxLat, 16, 104),
        stopp: s,
      });
    }
    if (fahrerLat != null && fahrerLng != null) {
      allPoints.push({
        x: normalize(fahrerLng, minLng, maxLng, 16, 184),
        y: normalize(maxLat - (fahrerLat - minLat), minLat, maxLat, 16, 104),
        is_fahrer: true,
      });
    }
  } else {
    // Synthetic grid layout
    const cols = Math.ceil(Math.sqrt(stoppsSorted.length));
    stoppsSorted.forEach((s, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      allPoints.push({
        x: 24 + col * (160 / Math.max(cols - 1, 1)),
        y: 20 + row * 70 / Math.max(Math.ceil(stoppsSorted.length / cols) - 1, 1),
        stopp: s,
      });
    });
    if (fahrerLat == null) {
      const nx = nextIdx >= 0 ? allPoints[nextIdx]?.x ?? 100 : 100;
      const ny = nextIdx >= 0 ? allPoints[nextIdx]?.y ?? 60 : 60;
      allPoints.push({ x: nx - 12, y: ny - 12, is_fahrer: true });
    }
  }

  const stoppPoints = allPoints.filter((p) => !p.is_fahrer);
  const fahrerPoint = allPoints.find((p) => p.is_fahrer);

  return (
    <div className={cn('rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/20 overflow-hidden', className)}>
      <button
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-indigo-100/50 dark:hover:bg-indigo-900/20 transition"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <MapPin size={13} className="text-indigo-600 dark:text-indigo-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-200">
            Tour-Karten-Minimap
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
            {stoppsSorted.filter((s) => s.geliefert_am).length}/{stoppsSorted.length} Stopps
          </span>
          <span className="text-[10px] text-muted-foreground">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-indigo-200 dark:border-indigo-800">
          {/* SVG Minimap */}
          <div className="p-2">
            <svg viewBox="0 0 200 120" className="w-full rounded-lg bg-white dark:bg-gray-900 border border-indigo-100 dark:border-indigo-900">
              {/* Route lines */}
              {stoppPoints.length > 1 && stoppPoints.map((p, i) => {
                if (i === 0) return null;
                const prev = stoppPoints[i - 1];
                return (
                  <line
                    key={i}
                    x1={prev.x} y1={prev.y}
                    x2={p.x} y2={p.y}
                    stroke={COLORS.line}
                    strokeWidth="1.5"
                    strokeDasharray="3 2"
                  />
                );
              })}

              {/* Fahrer to next stop line */}
              {fahrerPoint && nextIdx >= 0 && stoppPoints[nextIdx] && (
                <line
                  x1={fahrerPoint.x} y1={fahrerPoint.y}
                  x2={stoppPoints[nextIdx].x} y2={stoppPoints[nextIdx].y}
                  stroke={COLORS.fahrer}
                  strokeWidth="1.5"
                  strokeOpacity={0.6}
                />
              )}

              {/* Stop markers */}
              {stoppPoints.map((p, i) => {
                const s = p.stopp!;
                const isDone = !!s.geliefert_am;
                const isNext = i === nextIdx;
                const fill = isDone ? COLORS.done : isNext ? COLORS.next : COLORS.pending;
                const r = isNext ? 7 : 5;
                return (
                  <g key={s.id}>
                    {isNext && <circle cx={p.x} cy={p.y} r={r + 3} fill={COLORS.next} fillOpacity={0.2} />}
                    <circle cx={p.x} cy={p.y} r={r} fill={fill} stroke="white" strokeWidth="1.5" />
                    <text x={p.x} y={p.y + 1} textAnchor="middle" dominantBaseline="middle"
                      fontSize={isDone ? '5' : '6'} fontWeight="900" fill="white">
                      {isDone ? '✓' : (s.reihenfolge ?? i + 1)}
                    </text>
                  </g>
                );
              })}

              {/* Fahrer marker */}
              {fahrerPoint && (
                <g>
                  <circle cx={fahrerPoint.x} cy={fahrerPoint.y} r={6} fill={COLORS.fahrer} stroke="white" strokeWidth="1.5" />
                  <text x={fahrerPoint.x} y={fahrerPoint.y + 0.5} textAnchor="middle" dominantBaseline="middle"
                    fontSize="7" fill="white">▲</text>
                </g>
              )}
            </svg>
          </div>

          {/* Stop list */}
          <div className="px-3 pb-3 space-y-1">
            {stoppsSorted.map((s, i) => {
              const isDone = !!s.geliefert_am;
              const isNext = i === nextIdx;
              return (
                <div
                  key={s.id}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-2 py-1.5',
                    isNext ? 'bg-orange-100 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-700' : 'bg-transparent',
                  )}
                >
                  {isDone
                    ? <CheckCircle2 size={12} className="text-matcha-500 shrink-0" />
                    : isNext
                    ? <Navigation size={12} className="text-orange-500 shrink-0" />
                    : <Circle size={12} className="text-muted-foreground shrink-0" />
                  }
                  <span className={cn(
                    'text-[10px] flex-1 truncate',
                    isDone ? 'line-through text-muted-foreground' : isNext ? 'font-bold text-orange-700 dark:text-orange-300' : 'text-foreground',
                  )}>
                    {s.adresse ?? `Stopp ${s.reihenfolge ?? i + 1}`}
                  </span>
                  {isNext && (
                    <span className="text-[9px] font-bold text-orange-600 dark:text-orange-400 shrink-0">Nächster</span>
                  )}
                  {isDone && (
                    <span className="text-[9px] text-matcha-600 dark:text-matcha-400 shrink-0">Erledigt</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 px-3 pb-2.5 text-[9px] text-muted-foreground">
            {[
              { color: 'bg-matcha-400', label: 'Erledigt' },
              { color: 'bg-orange-400', label: 'Nächster' },
              { color: 'bg-gray-400', label: 'Ausstehend' },
              { color: 'bg-indigo-500', label: 'Fahrer' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1">
                <div className={cn('w-2 h-2 rounded-full shrink-0', color)} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
