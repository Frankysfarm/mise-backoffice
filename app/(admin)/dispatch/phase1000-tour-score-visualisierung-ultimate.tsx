'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { euro } from '@/lib/utils';
import { Route, Clock, CheckCircle2, TrendingUp, Zap, ChevronDown, ChevronUp, Target } from 'lucide-react';

/* ── Typen ─────────────────────────────────────────────────────────────── */
interface Stop {
  id: string;
  reihenfolge: number;
  angekommen_am?: string | null;
  geliefert_am?: string | null;
  gesamtbetrag?: number | null;
}

interface Batch {
  id: string;
  status?: string | null;
  fahrer_id?: string | null;
  zone?: string | null;
  startzeit?: string | null;
  total_eta_min?: number | null;
  stops?: Stop[];
}

interface Driver {
  employee_id?: string | null;
  employee?: { vorname?: string | null; nachname?: string | null } | null;
}

interface Props {
  batches: Batch[];
  drivers: Driver[];
  locationId?: string | null;
}

type ScoreLevel = 'exzellent' | 'gut' | 'okay' | 'schlecht' | 'unbekannt';

/* ── Score-Konfiguration ────────────────────────────────────────────────── */
const LEVEL: Record<ScoreLevel, { label: string; bg: string; border: string; text: string; bar: string; min: number }> = {
  exzellent: { label: 'Exzellent', bg: 'bg-matcha-50 dark:bg-matcha-950/30', border: 'border-matcha-200 dark:border-matcha-800', text: 'text-matcha-700', bar: 'bg-matcha-500', min: 85 },
  gut:        { label: 'Gut',       bg: 'bg-green-50 dark:bg-green-950/30',   border: 'border-green-200 dark:border-green-800',   text: 'text-green-700',  bar: 'bg-green-500',  min: 70 },
  okay:       { label: 'OK',        bg: 'bg-amber-50 dark:bg-amber-950/30',   border: 'border-amber-200 dark:border-amber-800',   text: 'text-amber-700',  bar: 'bg-amber-400',  min: 50 },
  schlecht:   { label: 'Kritisch',  bg: 'bg-red-50 dark:bg-red-950/30',       border: 'border-red-200 dark:border-red-800',       text: 'text-red-700',    bar: 'bg-red-500',    min: 0  },
  unbekannt:  { label: 'Unbekannt', bg: 'bg-muted/20',                        border: 'border-border',                            text: 'text-muted-foreground', bar: 'bg-muted-foreground', min: -1 },
};

function scoreToLevel(score: number): ScoreLevel {
  if (score < 0) return 'unbekannt';
  if (score >= 85) return 'exzellent';
  if (score >= 70) return 'gut';
  if (score >= 50) return 'okay';
  return 'schlecht';
}

/* ── Score-Berechnung ───────────────────────────────────────────────────── */
function computeTourScore(batch: Batch): number {
  const now = Date.now();
  const startMs = batch.startzeit ? new Date(batch.startzeit).getTime() : null;
  if (!startMs) return -1;

  const elapsedMin = (now - startMs) / 60_000;
  const etaMin = batch.total_eta_min ?? null;
  const stops = batch.stops ?? [];
  const total = stops.length;
  const done = stops.filter(s => s.geliefert_am).length;

  if (total === 0) return -1;

  const donePct = done / total;
  const timePct = etaMin ? Math.min(1, elapsedMin / etaMin) : 0.5;

  // Pünktlichkeit: wie weit ist der Fahrer verglichen mit dem erwarteten Fortschritt?
  const timingScore = Math.max(0, 1 - Math.max(0, timePct - donePct) * 2);
  // Fortschritts-Score
  const progressScore = donePct;
  // Effizienz-Bonus wenn mehr als erwartet schon erledigt
  const efficiencyBonus = Math.max(0, donePct - timePct) * 0.5;

  return Math.round(Math.min(100, (timingScore * 0.5 + progressScore * 0.35 + efficiencyBonus * 0.15) * 100));
}

/* ── Score-Ring (SVG) ───────────────────────────────────────────────────── */
function ScoreRing({ score, level }: { score: number; level: ScoreLevel }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const pct = score < 0 ? 0 : score / 100;
  const offset = circ * (1 - pct);
  const l = LEVEL[level];

  return (
    <svg width={44} height={44} viewBox="0 0 44 44" className="shrink-0">
      <circle cx={22} cy={22} r={r} fill="none" strokeWidth={4} className="stroke-muted/30" />
      {score >= 0 && (
        <circle
          cx={22} cy={22} r={r} fill="none" strokeWidth={4}
          className={cn('transition-all duration-700', l.bar)}
          style={{ stroke: 'currentColor' }}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 22 22)"
        />
      )}
      <text x={22} y={26} textAnchor="middle" fontSize={11} fontWeight={800} className={l.text}
        style={{ fontVariantNumeric: 'tabular-nums', fill: 'currentColor' }}>
        {score < 0 ? '?' : score}
      </text>
    </svg>
  );
}

/* ── Stop-Fortschrittsleiste ────────────────────────────────────────────── */
function StopBar({ stops }: { stops: Stop[] }) {
  const sorted = [...stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  return (
    <div className="flex gap-0.5">
      {sorted.map((s, i) => (
        <div
          key={s.id ?? i}
          className={cn(
            'h-2 flex-1 rounded-sm',
            s.geliefert_am ? 'bg-matcha-500' : s.angekommen_am ? 'bg-amber-400' : 'bg-muted/40',
          )}
        />
      ))}
    </div>
  );
}

/* ── Haupt-Komponente ───────────────────────────────────────────────────── */
export function DispatchPhase1000TourScoreVisualisierungUltimate({ batches, drivers }: Props) {
  const [open, setOpen] = useState(true);

  const rows = useMemo(() => {
    const now = Date.now();
    const active = batches.filter(b =>
      ['unterwegs', 'on_route', 'gestartet', 'aktiv', 'geliefert'].includes(b.status ?? ''),
    );

    return active.map(b => {
      const driver = drivers.find(d => d.employee_id === (b.fahrer_id ?? ''));
      const name = driver?.employee
        ? `${driver.employee.vorname ?? ''} ${(driver.employee.nachname ?? '')[0] ?? ''}.`
        : 'Fahrer';
      const stops = b.stops ?? [];
      const total = stops.length;
      const done = stops.filter(s => s.geliefert_am).length;
      const startMs = b.startzeit ? new Date(b.startzeit).getTime() : null;
      const elapsedMin = startMs ? Math.floor((now - startMs) / 60_000) : 0;
      const etaMin = b.total_eta_min ?? null;
      const remainMin = etaMin ? Math.max(0, etaMin - elapsedMin) : null;
      const score = computeTourScore(b);
      const level = scoreToLevel(score);
      const umsatz = stops.reduce((s, stop) => s + (stop.gesamtbetrag ?? 0), 0);

      return { id: b.id, name, zone: b.zone ?? null, total, done, elapsedMin, etaMin, remainMin, score, level, stops, umsatz };
    }).sort((a, b) => b.score - a.score);
  }, [batches, drivers]);

  const avgScore = rows.length > 0 && rows.some(r => r.score >= 0)
    ? Math.round(rows.filter(r => r.score >= 0).reduce((s, r) => s + r.score, 0) / rows.filter(r => r.score >= 0).length)
    : null;

  return (
    <section className="rounded-2xl border bg-card">
      {/* Header */}
      <button
        className="flex w-full items-center justify-between p-4 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-matcha-100 dark:bg-matcha-900/40">
            <Target className="h-4 w-4 text-matcha-600" />
          </span>
          <div>
            <p className="text-sm font-bold">Tour Score Visualisierung</p>
            <p className="text-[10px] text-muted-foreground">Echtzeit Ø {avgScore ?? '--'} · {rows.length} aktive Touren</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {avgScore !== null && (
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold text-white', LEVEL[scoreToLevel(avgScore)].bar)}>
              Ø {avgScore}
            </span>
          )}
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {rows.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              <Route className="mx-auto mb-2 h-6 w-6 opacity-30" />
              Keine aktiven Touren
            </div>
          ) : (
            rows.map(r => {
              const l = LEVEL[r.level];
              return (
                <div key={r.id} className={cn('rounded-xl border p-3 space-y-2', l.bg, l.border)}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <ScoreRing score={r.score} level={r.level} />
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{r.name}</p>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          {r.zone && <span>{r.zone}</span>}
                          <span className="flex items-center gap-0.5"><CheckCircle2 className="h-3 w-3" />{r.done}/{r.total}</span>
                          <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{r.elapsedMin}min</span>
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-bold text-white', l.bar)}>{l.label}</span>
                      {r.remainMin !== null && (
                        <p className="mt-1 text-[10px] font-bold tabular-nums">
                          {r.remainMin > 0 ? `${r.remainMin}min verbleibend` : 'Überfällig'}
                        </p>
                      )}
                      {r.umsatz > 0 && (
                        <p className="text-[9px] text-muted-foreground">{euro(r.umsatz)}</p>
                      )}
                    </div>
                  </div>
                  {r.stops.length > 0 && <StopBar stops={r.stops} />}
                  <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                    <span>Score: {r.score < 0 ? '—' : r.score}/100</span>
                    {r.etaMin && <span>ETA-Ziel: {r.etaMin}min</span>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </section>
  );
}
