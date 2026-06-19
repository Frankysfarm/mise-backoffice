'use client';

import { useState, useEffect } from 'react';
import { Route, Target, Bike, Clock, CheckCircle2, AlertTriangle, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BatchStop {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: {
    bestellnummer: string;
    dispatch_score?: number | null;
    eta_latest: string | null;
  } | null;
}

interface Batch {
  id: string;
  status: string;
  fahrer: { vorname: string; nachname: string } | null;
  total_eta_min: number | null;
  total_distance_km: number | null;
  zone: string | null;
  stops: BatchStop[];
}

interface Props {
  batches: Batch[];
}

type ScoreLevel = 'green' | 'amber' | 'red';

function scoreLevel(score: number): ScoreLevel {
  if (score >= 80) return 'green';
  if (score >= 60) return 'amber';
  return 'red';
}

function progressLevel(pct: number): ScoreLevel {
  if (pct >= 75) return 'green';
  if (pct >= 50) return 'amber';
  return 'red';
}

const SCORE_BADGE: Record<ScoreLevel, string> = {
  green: 'bg-matcha-100 text-matcha-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
};

const PROGRESS_BAR: Record<ScoreLevel, string> = {
  green: 'bg-matcha-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
};

function driverLabel(fahrer: Batch['fahrer']): string {
  if (!fahrer) return 'Unbekannt';
  return `${fahrer.vorname} ${fahrer.nachname}`;
}

function avgDispatchScore(stops: BatchStop[]): number | null {
  const scores = stops
    .map((s) => s.order?.dispatch_score)
    .filter((v): v is number => v != null);
  if (scores.length === 0) return null;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

function nextEtaLatest(stops: BatchStop[]): string | null {
  const sorted = [...stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const next = sorted.find((s) => s.geliefert_am == null && s.order?.eta_latest != null);
  return next?.order?.eta_latest ?? null;
}

function EtaBadge({ eta }: { eta: string }) {
  const ms = new Date(eta).getTime() - Date.now();
  const overdue = ms < 0;
  const minLeft = Math.round(ms / 60_000);

  if (overdue) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-black animate-pulse">
        <AlertTriangle className="h-3 w-3 shrink-0" />
        Überfällig
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[10px] font-bold tabular-nums">
      <Clock className="h-3 w-3 shrink-0" />
      {minLeft}&nbsp;Min
    </span>
  );
}

function TourCard({ batch }: { batch: Batch }) {
  const total = batch.stops.length;
  const completed = batch.stops.filter((s) => s.geliefert_am != null).length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const progLevel = progressLevel(pct);

  const avg = avgDispatchScore(batch.stops);
  const avgLevel = avg != null ? scoreLevel(avg) : null;

  const etaStr = nextEtaLatest(batch.stops);

  return (
    <div className="rounded-lg border border-border/60 bg-card px-3 py-2.5 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 text-xs font-bold text-foreground flex-1 min-w-0 truncate">
          <Bike className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          {driverLabel(batch.fahrer)}
        </span>

        {batch.zone && (
          <span className="inline-flex items-center gap-0.5 rounded border border-border/60 px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground shrink-0">
            <Route className="h-2.5 w-2.5" />
            {batch.zone}
          </span>
        )}

        {batch.total_distance_km != null && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[9px] font-bold tabular-nums shrink-0">
            {batch.total_distance_km.toFixed(1)}&nbsp;km
          </span>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1 font-bold">
            <CheckCircle2 className="h-3 w-3 shrink-0" />
            {completed}/{total}&nbsp;Stopps
          </span>
          <span>{pct}&nbsp;%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-black/10 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', PROGRESS_BAR[progLevel])}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {avg != null && avgLevel != null && (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums shrink-0',
              SCORE_BADGE[avgLevel],
            )}
          >
            <Target className="h-3 w-3 shrink-0" />
            Score&nbsp;{avg}
          </span>
        )}

        {etaStr && <EtaBadge eta={etaStr} />}
      </div>
    </div>
  );
}

function useDispatchRefresh(initialBatches: Batch[]) {
  const [batches, setBatches] = useState<Batch[]>(initialBatches);

  useEffect(() => {
    setBatches(initialBatches);
  }, [initialBatches]);

  useEffect(() => {
    const iv = setInterval(async () => {
      try {
        const res = await fetch('/api/delivery/dispatch');
        if (!res.ok) return;
        const data: { batches?: Batch[] } = await res.json();
        if (Array.isArray(data.batches)) {
          setBatches(data.batches);
        }
      } catch {
        // silently ignore
      }
    }, 30_000);
    return () => clearInterval(iv);
  }, []);

  return batches;
}

export function DispatchTourScoreSummaryPanel({ batches: initialBatches }: Props) {
  const batches = useDispatchRefresh(initialBatches);

  const active = batches
    .filter((b) => b.status === 'unterwegs')
    .slice(0, 5);

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b bg-muted/20 flex-wrap">
        <Zap className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-xs font-black uppercase tracking-wider text-foreground/80">
          Tour-Score Übersicht
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground shrink-0">
          {active.length}&nbsp;{active.length === 1 ? 'Tour' : 'Touren'}&nbsp;aktiv
        </span>
      </div>

      {active.length === 0 ? (
        <div className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Keine aktiven Touren
        </div>
      ) : (
        <div className="p-3 space-y-2">
          {active.map((batch) => (
            <TourCard key={batch.id} batch={batch} />
          ))}
        </div>
      )}
    </div>
  );
}
