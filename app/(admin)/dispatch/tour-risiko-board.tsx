'use client';

/**
 * DispatchTourRisikoBoard — Risikobewertungs-Board für den Dispatch.
 *
 * Zeigt Touren nach SLA-Risiko sortiert:
 *  🔴 HOCH   (>90% Elapsed/ETA): kritisch
 *  🟡 MITTEL (70–90%):           aufmerksam beobachten
 *  🟢 GERING (<70%):             im grünen Bereich
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, Bike, CheckCircle2, Clock, Package, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Stop = {
  geliefert_am: string | null;
  reihenfolge: number;
};

type Batch = {
  id: string;
  status: string;
  startzeit?: string | null;
  total_eta_min: number | null;
  total_distance_km: number | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: Stop[];
};

interface Props {
  batches: Batch[];
}

type RiskLevel = 'HOCH' | 'MITTEL' | 'GERING';

interface RisikoEintrag {
  batch: Batch;
  riskScore: number;
  riskLevel: RiskLevel;
  elapsedMin: number;
  completedStops: number;
  totalStops: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function elapsedMin(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
}

function calcRiskScore(elapsed: number, etaMin: number | null): number {
  if (!etaMin || etaMin <= 0) return 50;
  return Math.min(100, Math.round((elapsed / etaMin) * 100));
}

function getRiskLevel(score: number): RiskLevel {
  if (score > 90) return 'HOCH';
  if (score >= 70) return 'MITTEL';
  return 'GERING';
}

const RISK_STYLES: Record<
  RiskLevel,
  { badge: string; bar: string; row: string; label: string; icon: string }
> = {
  HOCH: {
    badge: 'bg-red-500 text-white hover:bg-red-500',
    bar: 'bg-red-500',
    row: 'border-red-200 bg-red-50/60 dark:border-red-800 dark:bg-red-950/30',
    label: 'text-red-700 dark:text-red-400',
    icon: 'text-red-500',
  },
  MITTEL: {
    badge: 'bg-amber-500 text-white hover:bg-amber-500',
    bar: 'bg-amber-500',
    row: 'border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/30',
    label: 'text-amber-700 dark:text-amber-400',
    icon: 'text-amber-500',
  },
  GERING: {
    badge: 'bg-matcha-500 text-white hover:bg-matcha-500',
    bar: 'bg-matcha-500',
    row: 'border-matcha-200 bg-matcha-50/40 dark:border-matcha-700 dark:bg-matcha-950/20',
    label: 'text-matcha-700 dark:text-matcha-400',
    icon: 'text-matcha-500',
  },
};

// ---------------------------------------------------------------------------
// useTick
// ---------------------------------------------------------------------------

function useTick(intervalMs = 10_000) {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT((n) => n + 1), intervalMs);
    return () => clearInterval(iv);
  }, [intervalMs]);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function RisikoZeile({ eintrag }: { eintrag: RisikoEintrag }) {
  const { batch, riskScore, riskLevel, elapsedMin: elapsed, completedStops, totalStops } = eintrag;
  const s = RISK_STYLES[riskLevel];
  const progressPct = totalStops > 0 ? (completedStops / totalStops) * 100 : 0;
  const driverName = batch.fahrer
    ? `${batch.fahrer.vorname} ${batch.fahrer.nachname.charAt(0)}.`
    : 'Kein Fahrer';
  const etaRemain = batch.total_eta_min != null
    ? Math.max(0, batch.total_eta_min - elapsed)
    : null;
  const isHoch = riskLevel === 'HOCH';

  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3 space-y-2.5 transition-all duration-300',
        s.row,
        isHoch && 'animate-pulse',
      )}
    >
      {/* Kopfzeile */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Risiko-Badge */}
        <Badge className={cn('text-[10px] font-black uppercase tracking-wide shrink-0', s.badge)}>
          {riskLevel === 'HOCH' && <AlertTriangle className="h-2.5 w-2.5 mr-1 shrink-0" />}
          {riskLevel}
        </Badge>

        {/* Fahrername */}
        <div className="flex items-center gap-1 text-sm font-bold text-foreground">
          <Bike className={cn('h-3.5 w-3.5 shrink-0', s.icon)} />
          {driverName}
        </div>

        {/* Stopps */}
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground ml-1">
          <Package className="h-3 w-3 shrink-0" />
          <span className="tabular-nums font-bold">
            {completedStops}/{totalStops}
          </span>
          <span>Stopps</span>
        </div>

        {/* Verbleibende Zeit */}
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <Clock className={cn('h-3.5 w-3.5 shrink-0', s.icon)} />
          <span className={cn('font-mono font-black text-sm tabular-nums', s.label)}>
            {elapsed} Min
          </span>
          {etaRemain != null && (
            <span className="text-[10px] text-muted-foreground">
              / noch ~{etaRemain} Min
            </span>
          )}
        </div>
      </div>

      {/* Risikometer (Progress-Balken) */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span className="font-medium">SLA-Risiko</span>
          <span className={cn('font-black tabular-nums', s.label)}>{riskScore}%</span>
        </div>
        <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', s.bar)}
            style={{ width: `${Math.min(100, riskScore)}%` }}
          />
        </div>
      </div>

      {/* Stopp-Kette */}
      {totalStops > 0 && (
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
          {Array.from({ length: totalStops }, (_, i) => {
            const stop = batch.stops.find((st) => st.reihenfolge === i + 1)
              ?? batch.stops[i];
            const done = stop?.geliefert_am != null;
            const current =
              !done &&
              batch.stops
                .slice(0, i)
                .every((st) => st.geliefert_am != null);
            return (
              <div key={i} className="flex items-center gap-1 shrink-0">
                <div
                  className={cn(
                    'h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-black border-2',
                    done
                      ? 'bg-matcha-500 border-matcha-600 text-white'
                      : current
                      ? isHoch
                        ? 'bg-red-500 border-red-600 text-white animate-pulse'
                        : 'bg-blue-500 border-blue-600 text-white animate-pulse'
                      : 'bg-muted border-border text-muted-foreground',
                  )}
                >
                  {done ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
                </div>
                {i < totalStops - 1 && (
                  <div
                    className={cn(
                      'h-0.5 w-3 rounded-full',
                      done ? 'bg-matcha-400' : 'bg-border',
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Zusammenfassung oben
// ---------------------------------------------------------------------------

function RisikoBand({
  hochCount,
  mittelCount,
  geringCount,
}: {
  hochCount: number;
  mittelCount: number;
  geringCount: number;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {[
        { level: 'HOCH' as RiskLevel, count: hochCount },
        { level: 'MITTEL' as RiskLevel, count: mittelCount },
        { level: 'GERING' as RiskLevel, count: geringCount },
      ].map(({ level, count }) => (
        <div
          key={level}
          className={cn(
            'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold transition-opacity',
            count === 0 ? 'opacity-30' : 'opacity-100',
            RISK_STYLES[level].badge,
          )}
        >
          <span className="tabular-nums font-black">{count}</span>
          <span className="hidden sm:inline">{level}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function DispatchTourRisikoBoard({ batches }: Props) {
  useTick();

  const [sortBy, setSortBy] = useState<'risiko' | 'fahrer'>('risiko');

  const ACTIVE_STATUSES = new Set(['unterwegs', 'on_route', 'aktiv', 'assigned']);

  const eintraege: RisikoEintrag[] = batches
    .filter((b) => ACTIVE_STATUSES.has(b.status))
    .map((batch) => {
      const elapsed = elapsedMin(batch.startzeit);
      const score = calcRiskScore(elapsed, batch.total_eta_min);
      const level = getRiskLevel(score);
      const completedStops = batch.stops.filter((s) => s.geliefert_am != null).length;
      return {
        batch,
        riskScore: score,
        riskLevel: level,
        elapsedMin: elapsed,
        completedStops,
        totalStops: batch.stops.length,
      };
    });

  const sorted = [...eintraege].sort((a, b) => {
    if (sortBy === 'risiko') return b.riskScore - a.riskScore;
    const nameA = a.batch.fahrer
      ? `${a.batch.fahrer.nachname} ${a.batch.fahrer.vorname}`
      : 'z';
    const nameB = b.batch.fahrer
      ? `${b.batch.fahrer.nachname} ${b.batch.fahrer.vorname}`
      : 'z';
    return nameA.localeCompare(nameB, 'de');
  });

  const hochCount = sorted.filter((e) => e.riskLevel === 'HOCH').length;
  const mittelCount = sorted.filter((e) => e.riskLevel === 'MITTEL').length;
  const geringCount = sorted.filter((e) => e.riskLevel === 'GERING').length;

  const hasKritisch = hochCount > 0;

  if (eintraege.length === 0) {
    return (
      <Card className="border-border">
        <CardHeader className="flex flex-row items-center gap-2 px-4 py-2.5 border-b space-y-0 bg-muted/30">
          <TrendingUp className="h-4 w-4 text-muted-foreground shrink-0" />
          <CardTitle className="text-xs font-bold uppercase tracking-wider">
            Tour-Risiko-Board
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 text-center text-muted-foreground text-sm">
          Keine aktiven Touren
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        'overflow-hidden transition-all duration-500',
        hasKritisch
          ? 'border-red-400 shadow-[0_0_18px_rgba(239,68,68,0.15)] dark:border-red-700'
          : 'border-border',
      )}
    >
      <CardHeader
        className={cn(
          'flex flex-row items-center gap-2 px-4 py-2.5 border-b space-y-0',
          hasKritisch
            ? 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800'
            : 'bg-muted/30',
        )}
      >
        <TrendingUp
          className={cn(
            'h-4 w-4 shrink-0',
            hasKritisch ? 'text-red-600' : 'text-matcha-600',
          )}
        />
        <CardTitle className="text-xs font-bold uppercase tracking-wider flex-1">
          Tour-Risiko-Board
        </CardTitle>

        {/* Risiko-Zusammenfassung */}
        <RisikoBand
          hochCount={hochCount}
          mittelCount={mittelCount}
          geringCount={geringCount}
        />

        {/* Sortier-Toggle */}
        <div className="flex items-center gap-0.5 rounded-lg border border-border bg-background p-0.5 ml-2 shrink-0">
          {(
            [
              { key: 'risiko', label: 'Risiko' },
              { key: 'fahrer', label: 'Fahrer' },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={cn(
                'rounded-md px-2 py-0.5 text-[10px] font-bold transition-all',
                sortBy === key
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="p-3 space-y-2">
        {sorted.map((eintrag) => (
          <RisikoZeile key={eintrag.batch.id} eintrag={eintrag} />
        ))}

        {/* Legende */}
        <div className="flex items-center gap-3 pt-1 border-t border-border/50 flex-wrap">
          {(
            [
              { level: 'HOCH' as RiskLevel, label: '> 90% der ETA abgelaufen' },
              { level: 'MITTEL' as RiskLevel, label: '70–90%' },
              { level: 'GERING' as RiskLevel, label: '< 70%' },
            ]
          ).map(({ level, label }) => (
            <span key={level} className="flex items-center gap-1 text-[9px] text-muted-foreground">
              <span
                className={cn(
                  'h-2 w-2 rounded-full inline-block shrink-0',
                  RISK_STYLES[level].bar,
                )}
              />
              {level}: {label}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
