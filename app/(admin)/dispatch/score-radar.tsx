'use client';

/**
 * ScoreRadarChart — Phase 98
 * SVG-Spinnen-Diagramm für die 10 Dispatch-Score-Faktoren.
 * Zeigt die relative Stärke jedes Faktors auf einen Blick.
 */

import { cn } from '@/lib/utils';

type ScoreFactors = {
  f_distance: number;
  f_load: number;
  f_vehicle: number;
  f_experience: number;
  f_zone: number;
  f_prep_time: number;
  f_time_of_day: number;
  f_priority: number;
  f_bundle_fit: number;
  f_history: number;
  total: number;
};

const FACTORS: { key: keyof ScoreFactors; label: string; short: string }[] = [
  { key: 'f_distance',    label: 'Distanz',       short: 'Dist' },
  { key: 'f_load',        label: 'Fahrerlast',    short: 'Last' },
  { key: 'f_vehicle',     label: 'Fahrzeug',      short: 'Fzg' },
  { key: 'f_experience',  label: 'Erfahrung',     short: 'Erf' },
  { key: 'f_zone',        label: 'Zone',          short: 'Zone' },
  { key: 'f_prep_time',   label: 'Küchen-Timing', short: 'Koch' },
  { key: 'f_time_of_day', label: 'Tageszeit',     short: 'Zeit' },
  { key: 'f_priority',    label: 'Priorität',     short: 'Prio' },
  { key: 'f_bundle_fit',  label: 'Bündelbar',     short: 'Bndl' },
  { key: 'f_history',     label: 'Historie',      short: 'Hist' },
];

const SIZE = 160;
const CENTER = SIZE / 2;
const RINGS = [2, 4, 6, 8, 10];
const N = FACTORS.length;

function polarToXY(angleDeg: number, radius: number): [number, number] {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return [CENTER + radius * Math.cos(rad), CENTER + radius * Math.sin(rad)];
}

function maxRadius(val: number): number {
  return (val / 10) * (CENTER - 22);
}

export function ScoreRadarChart({ score }: { score: ScoreFactors }) {
  const angleStep = 360 / N;
  const outerR = CENTER - 22;

  // Build polygon path for the score values
  const scorePoints = FACTORS.map((f, i) => {
    const angle = i * angleStep;
    const r = maxRadius(Math.min(10, Math.max(0, score[f.key] as number)));
    return polarToXY(angle, r);
  });
  const scorePath = scorePoints.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ') + ' Z';

  // Grid ring paths
  const ringPaths = RINGS.map((ring) => {
    const r = maxRadius(ring);
    const pts = Array.from({ length: N }, (_, i) => polarToXY(i * angleStep, r));
    return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ') + ' Z';
  });

  const total = Math.round(score.total);
  const totalColor =
    total >= 80 ? '#16a34a' :
    total >= 60 ? '#3b82f6' :
    total >= 40 ? '#f97316' : '#ef4444';

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="overflow-visible">
        {/* Grid rings */}
        {ringPaths.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={0.75} />
        ))}

        {/* Axis lines */}
        {FACTORS.map((_, i) => {
          const [x, y] = polarToXY(i * angleStep, outerR);
          return (
            <line key={i} x1={CENTER} y1={CENTER} x2={x.toFixed(2)} y2={y.toFixed(2)}
              stroke="rgba(0,0,0,0.10)" strokeWidth={0.75} />
          );
        })}

        {/* Score polygon fill */}
        <path d={scorePath} fill={`${totalColor}22`} stroke={totalColor} strokeWidth={2} strokeLinejoin="round" />

        {/* Score dots */}
        {scorePoints.map(([x, y], i) => (
          <circle key={i} cx={x.toFixed(2)} cy={y.toFixed(2)} r={3} fill={totalColor} />
        ))}

        {/* Center dot */}
        <circle cx={CENTER} cy={CENTER} r={3} fill="rgba(0,0,0,0.15)" />

        {/* Labels */}
        {FACTORS.map((f, i) => {
          const angle = i * angleStep;
          const [lx, ly] = polarToXY(angle, outerR + 12);
          const anchor =
            lx < CENTER - 2 ? 'end' :
            lx > CENTER + 2 ? 'start' : 'middle';
          const val = score[f.key] as number;
          return (
            <text
              key={f.key}
              x={lx.toFixed(2)}
              y={(ly + 3).toFixed(2)}
              textAnchor={anchor}
              fontSize={7.5}
              fontWeight={600}
              fill={val >= 8 ? '#16a34a' : val >= 5 ? '#6b7280' : '#ef4444'}
            >
              {f.short}
            </text>
          );
        })}
      </svg>

      {/* Total badge below chart */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">Gesamt:</span>
        <span
          className="font-display font-black text-sm px-2 py-0.5 rounded-full text-white"
          style={{ backgroundColor: totalColor }}
        >
          {total}
        </span>
      </div>
    </div>
  );
}
