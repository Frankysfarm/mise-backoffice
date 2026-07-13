'use client';

import { useMemo } from 'react';
import { Award, BarChart2, CheckCircle2, Clock, Gauge, MapPin, Route, Star, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1378 — Score-Anzeige + Tour-Visualisierung (Dispatch)
 *
 * Kombiniertes Panel:
 *   1. Score-Übersicht: Ø Dispatch-Score aller aktiven Fahrer (Ampel + Tacho-Ring)
 *   2. Tour-Visualisierung: Jede aktive Tour als Stopp-Timeline mit Fortschrittsbalken
 *
 * Rein props-basiert, kein API-Aufruf notwendig. Nach Phase1373 in dispatch/client.tsx.
 */

interface Driver {
  employee_id: string;
  ist_online: boolean;
  fahrzeug: string;
  aktueller_batch_id: string | null;
  employee: { id: string; vorname: string; nachname: string; telefon: string | null; avatar_url: string | null } | null;
}

interface BatchStop {
  id: string;
  order_id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: { bestellnummer: string; kunde_name: string; kunde_adresse: string | null; eta_earliest: string | null; eta_latest: string | null } | null;
}

interface Batch {
  id: string;
  status: string;
  fahrer_id: string | null;
  startzeit?: string | null;
  total_distance_km: number | null;
  total_eta_min: number | null;
  zone: string | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: BatchStop[];
}

interface ReadyOrder {
  id: string;
  dispatch_score: number | null;
}

interface Props {
  drivers: Driver[];
  batches: Batch[];
  orders?: ReadyOrder[];
}

type ScoreStufe = 'hoch' | 'mittel' | 'niedrig';

function scoreStufe(score: number): ScoreStufe {
  if (score >= 75) return 'hoch';
  if (score >= 45) return 'mittel';
  return 'niedrig';
}

const SCORE_STYLE: Record<ScoreStufe, { ring: string; text: string; label: string; icon: React.ReactNode }> = {
  hoch:     { ring: 'stroke-green-500',  text: 'text-green-600 dark:text-green-400',  label: 'Excellent',  icon: <Star className="h-4 w-4 text-green-500" /> },
  mittel:   { ring: 'stroke-amber-400',  text: 'text-amber-600 dark:text-amber-400',  label: 'Gut',        icon: <BarChart2 className="h-4 w-4 text-amber-500" /> },
  niedrig:  { ring: 'stroke-red-500',    text: 'text-red-600 dark:text-red-400',      label: 'Schwach',    icon: <TrendingDown className="h-4 w-4 text-red-500" /> },
};

function ScoreRing({ score, stufe }: { score: number; stufe: ScoreStufe }) {
  const style = SCORE_STYLE[stufe];
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="relative flex items-center justify-center h-24 w-24">
      <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/20" />
        <circle
          cx="50" cy="50" r="40" fill="none" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn('transition-all duration-700', style.ring)}
        />
      </svg>
      <div className="flex flex-col items-center">
        <span className={cn('text-2xl font-black tabular-nums leading-none', style.text)}>{Math.round(score)}</span>
        <span className="text-[10px] text-muted-foreground font-bold mt-0.5">{style.label}</span>
      </div>
    </div>
  );
}

function TourTimeline({ batch, driverName }: { batch: Batch; driverName: string }) {
  const stops = [...batch.stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const delivered = stops.filter((s) => s.geliefert_am !== null).length;
  const total = stops.length;
  const pct = total > 0 ? Math.round((delivered / total) * 100) : 0;

  const elapsedMin = batch.startzeit
    ? Math.round((Date.now() - new Date(batch.startzeit).getTime()) / 60_000)
    : null;

  const eta = batch.total_eta_min;

  let health: 'ok' | 'warn' | 'late' = 'ok';
  if (elapsedMin !== null && eta !== null) {
    const ratio = elapsedMin / eta;
    if (ratio > 1.1) health = 'late';
    else if (ratio > 0.8) health = 'warn';
  }

  const healthStyle = {
    ok:   { bar: 'bg-green-500', text: 'text-green-600 dark:text-green-400' },
    warn: { bar: 'bg-amber-400', text: 'text-amber-600 dark:text-amber-400' },
    late: { bar: 'bg-red-500',   text: 'text-red-600 dark:text-red-400' },
  }[health];

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Route className="h-3.5 w-3.5 text-matcha-600" />
          <span className="text-xs font-bold text-foreground truncate">{driverName}</span>
          {batch.zone && (
            <span className="rounded-full bg-matcha-100 px-1.5 py-0.5 text-[9px] font-bold text-matcha-700 dark:bg-matcha-900/30 dark:text-matcha-300">
              Zone {batch.zone}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {elapsedMin !== null && (
            <span className={cn('font-bold tabular-nums', healthStyle.text)}>{elapsedMin}m vergangen</span>
          )}
          {eta !== null && <span>/ {eta}m ETA</span>}
        </div>
      </div>

      {/* Fortschrittsbalken */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-700', healthStyle.bar)}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[10px] font-bold text-muted-foreground tabular-nums shrink-0">
          {delivered}/{total}
        </span>
      </div>

      {/* Stopp-Kette */}
      <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
        {stops.map((stop, idx) => {
          const done = stop.geliefert_am !== null;
          const current = !done && idx === delivered;
          return (
            <div key={stop.id} className="flex items-center gap-1 shrink-0">
              <div
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-black border-2',
                  done     ? 'bg-green-500 border-green-500 text-white' :
                  current  ? 'bg-amber-400 border-amber-400 text-white ring-2 ring-amber-300 ring-offset-1' :
                             'bg-muted border-border text-muted-foreground',
                )}
                title={stop.order?.kunde_adresse ?? `Stopp ${stop.reihenfolge}`}
              >
                {done ? <CheckCircle2 className="h-3 w-3" /> : stop.reihenfolge}
              </div>
              {idx < stops.length - 1 && (
                <div className={cn('h-0.5 w-4 rounded-full', done ? 'bg-green-400' : 'bg-muted')} />
              )}
            </div>
          );
        })}
      </div>

      {/* Nächster Stopp */}
      {stops[delivered] && (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <MapPin className="h-3 w-3 text-amber-500 shrink-0" />
          <span className="truncate">
            {stops[delivered].order?.kunde_adresse ?? 'Unbekannte Adresse'}
          </span>
          {stops[delivered].order?.eta_latest && (
            <span className="ml-auto shrink-0 tabular-nums font-bold">
              ETA {new Date(stops[delivered].order!.eta_latest!).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function DispatchPhase1378ScoreAnzeigeTourVisualisierung({ drivers, batches, orders = [] }: Props) {
  const driverMap = useMemo(
    () => new Map(drivers.map((d) => [d.employee_id, d])),
    [drivers],
  );

  const aktiveTours = useMemo(
    () => batches.filter((b) => b.status === 'unterwegs'),
    [batches],
  );

  const scores = useMemo(() => {
    return orders.map((o) => o.dispatch_score ?? 0).filter((s) => s > 0);
  }, [orders]);

  const avgScore = scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : 72;
  const stufe = scoreStufe(avgScore);

  if (aktiveTours.length === 0 && scores.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Gauge className="h-5 w-5 text-matcha-600" />
        <h3 className="font-semibold text-sm text-foreground">Score + Tour-Visualisierung</h3>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {aktiveTours.length} aktive Tour{aktiveTours.length !== 1 ? 'en' : ''}
        </span>
      </div>

      {/* Score-Ring + Stats */}
      <div className="flex items-center gap-4 rounded-xl bg-muted/30 p-3">
        <ScoreRing score={avgScore} stufe={stufe} />
        <div className="flex-1 space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Ø Dispatch-Score</div>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900 px-2 py-1.5 text-center">
              <div className="text-base font-black text-green-700 dark:text-green-300">
                {scores.filter((s) => s >= 75).length}
              </div>
              <div className="text-[9px] text-muted-foreground">Excellent ≥75</div>
            </div>
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900 px-2 py-1.5 text-center">
              <div className="text-base font-black text-amber-700 dark:text-amber-300">
                {scores.filter((s) => s >= 45 && s < 75).length}
              </div>
              <div className="text-[9px] text-muted-foreground">Gut 45–74</div>
            </div>
            <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 px-2 py-1.5 text-center">
              <div className="text-base font-black text-red-700 dark:text-red-300">
                {scores.filter((s) => s < 45).length}
              </div>
              <div className="text-[9px] text-muted-foreground">Schwach &lt;45</div>
            </div>
            <div className="rounded-lg bg-muted border border-border px-2 py-1.5 text-center">
              <div className="text-base font-black text-foreground">{scores.length}</div>
              <div className="text-[9px] text-muted-foreground">Gesamt</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tour-Timelines */}
      {aktiveTours.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Route className="h-3.5 w-3.5 text-matcha-600" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Aktive Touren
            </span>
          </div>
          <div className="space-y-2">
            {aktiveTours.slice(0, 5).map((batch) => {
              const driver = driverMap.get(batch.fahrer_id ?? '');
              const name = driver?.employee
                ? `${driver.employee.vorname} ${driver.employee.nachname}`
                : batch.fahrer
                ? `${batch.fahrer.vorname} ${batch.fahrer.nachname}`
                : 'Unbekannter Fahrer';
              return (
                <TourTimeline key={batch.id} batch={batch} driverName={name} />
              );
            })}
            {aktiveTours.length > 5 && (
              <p className="text-[11px] text-muted-foreground text-center">
                + {aktiveTours.length - 5} weitere Touren
              </p>
            )}
          </div>
        </div>
      )}

      {/* Legende Score */}
      <div className="flex flex-wrap gap-2 border-t pt-2">
        {(Object.entries(SCORE_STYLE) as [ScoreStufe, typeof SCORE_STYLE[ScoreStufe]][]).map(([key, s]) => (
          <span key={key} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            {s.icon} {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
