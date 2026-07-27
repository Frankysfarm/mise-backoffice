'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Bike, CheckCircle2, ChevronDown, ChevronUp, Clock, MapPin, Route,
  TrendingDown, TrendingUp, Trophy, Zap,
} from 'lucide-react';

/**
 * Phase 1000 — Tour-Score-Live-Board (Dispatch)
 *
 * Kombiniert Fahrer-Score-Anzeige + Tour-Visualisierung in einem Board.
 * Fortschrittsbalken je Tour; Pünktlichkeits-Score 0–100; farbkodiert;
 * Stopp-Timeline als Mini-Punkte-Sequenz. 20-Sek-Polling mit Mock-Fallback.
 */

interface Stop {
  id: string;
  reihenfolge?: number | null;
  geliefert_am?: string | null;
  angekommen_am?: string | null;
}

interface Batch {
  id: string;
  status?: string | null;
  fahrer_id?: string | null;
  startzeit?: string | null;
  total_eta_min?: number | null;
  zone?: string | null;
  stops?: Stop[];
}

interface Driver {
  employee_id?: string | null;
  employee?: { vorname?: string | null; nachname?: string | null } | null;
  score?: number | null;
  puenktlichkeit_pct?: number | null;
}

interface Props {
  batches: Batch[];
  drivers: Driver[];
  locationId?: string | null;
}

type Tier = 'great' | 'good' | 'warn' | 'late';

const TIER_MAP: Record<Tier, { label: string; bar: string; text: string; bg: string; border: string }> = {
  great: { label: 'Sehr gut', bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50/50 dark:bg-emerald-950/10', border: 'border-emerald-200 dark:border-emerald-800' },
  good:  { label: 'Gut',      bar: 'bg-matcha-500',  text: 'text-matcha-700',  bg: 'bg-matcha-50/50 dark:bg-matcha-950/10',  border: 'border-matcha-200 dark:border-matcha-800'  },
  warn:  { label: 'Knapp',    bar: 'bg-amber-400',   text: 'text-amber-700',   bg: 'bg-amber-50/50 dark:bg-amber-950/10',    border: 'border-amber-200 dark:border-amber-800'    },
  late:  { label: 'Verspätet',bar: 'bg-red-500',     text: 'text-red-700',     bg: 'bg-red-50/50 dark:bg-red-950/10',        border: 'border-red-200 dark:border-red-800'        },
};

function tier(score: number): Tier {
  if (score >= 85) return 'great';
  if (score >= 65) return 'good';
  if (score >= 40) return 'warn';
  return 'late';
}

function calcScore(elapsedMin: number, etaMin: number | null, done: number, total: number): number {
  if (total === 0) return 100;
  const donePct = done / total;
  const usedPct = etaMin ? elapsedMin / Math.max(etaMin, 1) : 0;
  const timingScore = Math.max(0, 1 - Math.max(0, usedPct - donePct));
  return Math.round((timingScore * 0.6 + donePct * 0.4) * 100);
}

const MOCK_BATCHES: Batch[] = [
  { id: 'mock-1', status: 'unterwegs', fahrer_id: 'drv-1', startzeit: new Date(Date.now() - 12 * 60_000).toISOString(), total_eta_min: 30, zone: 'Mitte', stops: [{ id: 's1', reihenfolge: 1, geliefert_am: new Date(Date.now() - 8 * 60_000).toISOString() }, { id: 's2', reihenfolge: 2 }, { id: 's3', reihenfolge: 3 }] },
  { id: 'mock-2', status: 'unterwegs', fahrer_id: 'drv-2', startzeit: new Date(Date.now() - 25 * 60_000).toISOString(), total_eta_min: 28, zone: 'Nord',  stops: [{ id: 's4', reihenfolge: 1, geliefert_am: new Date(Date.now() - 20 * 60_000).toISOString() }, { id: 's5', reihenfolge: 2, geliefert_am: new Date(Date.now() - 10 * 60_000).toISOString() }] },
  { id: 'mock-3', status: 'unterwegs', fahrer_id: 'drv-3', startzeit: new Date(Date.now() - 5 * 60_000).toISOString(),  total_eta_min: 25, zone: 'Süd',   stops: [{ id: 's6', reihenfolge: 1 }, { id: 's7', reihenfolge: 2 }, { id: 's8', reihenfolge: 3 }, { id: 's9', reihenfolge: 4 }] },
];

const MOCK_DRIVERS: Driver[] = [
  { employee_id: 'drv-1', employee: { vorname: 'Lukas', nachname: 'Meier' }, score: 87, puenktlichkeit_pct: 91 },
  { employee_id: 'drv-2', employee: { vorname: 'Ali', nachname: 'Kazan' }, score: 62, puenktlichkeit_pct: 78 },
  { employee_id: 'drv-3', employee: { vorname: 'Tina', nachname: 'Wolf' }, score: 95, puenktlichkeit_pct: 96 },
];

export function DispatchPhase1000TourScoreLiveBoard({ batches, drivers, locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(iv);
  }, []);

  const src = locationId && batches.length > 0 ? batches : MOCK_BATCHES;
  const drvSrc = locationId && drivers.length > 0 ? drivers : MOCK_DRIVERS;

  const rows = useMemo(() => {
    const active = src.filter((b) =>
      ['unterwegs', 'on_route', 'gestartet', 'aktiv'].includes(b.status ?? ''),
    );
    return active.map((b) => {
      const drv = drvSrc.find((d) => d.employee_id === b.fahrer_id);
      const name = drv?.employee
        ? `${drv.employee.vorname ?? ''} ${(drv.employee.nachname ?? '')[0] ?? ''}.`
        : 'Fahrer';
      const startMs = b.startzeit ? new Date(b.startzeit).getTime() : now;
      const elapsedMin = Math.floor((now - startMs) / 60_000);
      const total = b.stops?.length ?? 0;
      const done = b.stops?.filter((s) => !!s.geliefert_am).length ?? 0;
      const remainStops = total - done;
      const etaMin = b.total_eta_min ?? null;
      const remainMin = etaMin ? Math.max(0, etaMin - elapsedMin) : null;
      const score = calcScore(elapsedMin, etaMin, done, total);
      const donePct = total > 0 ? done / total : 0;
      const drvScore = drv?.score ?? null;
      const t = tier(score);
      return { b, name, score, drvScore, done, total, remainStops, donePct, elapsedMin, remainMin, t, zone: b.zone ?? '' };
    }).sort((a, b) => a.score - b.score);
  }, [src, drvSrc, now]);

  const avgScore = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length) : null;
  const avgTier = avgScore !== null ? tier(avgScore) : 'good';

  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card overflow-hidden" data-dispatch-phase="1000">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <Route className="h-4 w-4 text-blue-600 shrink-0" />
        <span className="font-bold text-sm flex-1">Tour-Score-Live-Board</span>
        {avgScore !== null && (
          <span className={cn('text-xs font-black px-2 py-0.5 rounded-full border', TIER_MAP[avgTier].bg, TIER_MAP[avgTier].border, TIER_MAP[avgTier].text)}>
            Ø {avgScore} Score
          </span>
        )}
        <span className="text-[10px] text-muted-foreground">{rows.length} aktiv</span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="border-t space-y-2 p-3">
          {rows.map(({ b, name, score, drvScore, done, total, remainStops, donePct, elapsedMin, remainMin, t, zone }) => {
            const tm = TIER_MAP[t];
            return (
              <div key={b.id} className={cn('rounded-xl border p-3', tm.bg, tm.border)}>
                {/* Row header */}
                <div className="flex items-center gap-2 mb-2">
                  <Bike className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="font-semibold text-sm flex-1 truncate">{name}</span>
                  {zone && (
                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {zone}
                    </span>
                  )}
                  {/* Tour score */}
                  <span className={cn('text-xs font-black px-2 py-0.5 rounded-full', tm.text, tm.bg, 'border', tm.border)}>
                    {score}
                  </span>
                  {/* Driver career score */}
                  {drvScore !== null && (
                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      <Trophy className="h-3 w-3 text-amber-500" /> {drvScore}
                    </span>
                  )}
                </div>

                {/* Stop timeline */}
                <div className="flex items-center gap-1 mb-2">
                  {Array.from({ length: total }).map((_, i) => {
                    const s = b.stops?.[i];
                    const isDelivered = !!s?.geliefert_am;
                    const isCurrent = !isDelivered && b.stops?.slice(0, i).every((prev) => !!prev.geliefert_am);
                    return (
                      <span
                        key={i}
                        className={cn(
                          'h-2.5 flex-1 rounded-full transition-all',
                          isDelivered ? 'bg-emerald-500' : isCurrent ? cn(tm.bar, 'animate-pulse') : 'bg-muted',
                        )}
                      />
                    );
                  })}
                </div>

                {/* KPI row */}
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-0.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    {done}/{total} Stopps
                  </span>
                  <span className="flex items-center gap-0.5">
                    <Clock className="h-3 w-3" />
                    {elapsedMin} Min unterwegs
                  </span>
                  {remainMin !== null && (
                    <span className={cn('flex items-center gap-0.5 font-semibold', tm.text)}>
                      <Zap className="h-3 w-3" />
                      noch ~{remainMin} Min
                    </span>
                  )}
                  {remainStops > 0 && (
                    <span className="ml-auto flex items-center gap-0.5">
                      <MapPin className="h-3 w-3" />
                      {remainStops} verbleibend
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                <div className="mt-2 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', tm.bar)}
                    style={{ width: `${Math.round(donePct * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}

          <div className="text-[10px] text-muted-foreground text-center pt-1 flex items-center justify-center gap-3">
            <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3 text-emerald-500" /> Score = Timing × 60% + Fortschritt × 40%</span>
            <span>· 20-Sek-Update</span>
          </div>
        </div>
      )}
    </div>
  );
}
