'use client';

/**
 * Phase 2490 — Score + Tour-Visualisierung Board V2
 * Score-Ring je Fahrer, farbkodierte Stop-Dots mit Nummern,
 * Fortschrittsbalken, ETA-Badge, expandierbare Stop-Liste. 25-Sek-Polling.
 */

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Navigation2, Clock, AlertTriangle, MapPin, ChevronDown, ChevronUp, Bike } from 'lucide-react';

interface StopInfo {
  idx: number;
  done: boolean;
  late: boolean;
  address: string | null;
  etaMin: number | null;
}

interface TourData {
  batchId: string;
  driverName: string;
  score: number;
  stops: StopInfo[];
  elapsedMin: number;
  nextEtaMin: number | null;
  zone: string | null;
  state: string;
}

function scoreColor(s: number) {
  if (s >= 80) return { ring: '#22c55e', badge: 'bg-emerald-500', label: 'TOP' };
  if (s >= 60) return { ring: '#f59e0b', badge: 'bg-amber-500', label: 'OK' };
  return { ring: '#ef4444', badge: 'bg-red-500', label: 'TIEF' };
}

function ScoreRing({ score }: { score: number }) {
  const r = 19;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.max(0, Math.min(100, score)) / 100);
  const col = scoreColor(score);
  return (
    <svg width={46} height={46} className="shrink-0">
      <circle cx={23} cy={23} r={r} fill="none" stroke="#e5e7eb" strokeWidth={4} />
      <circle
        cx={23} cy={23} r={r} fill="none"
        stroke={col.ring} strokeWidth={4}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 23 23)"
        className="transition-all duration-700"
      />
      <text x={23} y={28} textAnchor="middle" fontSize={11} fontWeight="900" fill={col.ring} fontFamily="monospace">
        {score}
      </text>
    </svg>
  );
}

function StopDot({ stop }: { stop: StopInfo }) {
  return (
    <div className="relative flex flex-col items-center gap-0.5">
      <div className={cn(
        'h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white',
        stop.done
          ? stop.late ? 'bg-amber-400' : 'bg-emerald-500'
          : 'bg-stone-200 text-stone-500'
      )}>
        {stop.idx + 1}
      </div>
      {stop.etaMin !== null && !stop.done && (
        <span className="text-[8px] text-muted-foreground tabular-nums">{stop.etaMin}m</span>
      )}
    </div>
  );
}

function TourRow({ tour }: { tour: TourData }) {
  const [expanded, setExpanded] = useState(false);
  const col = scoreColor(tour.score);
  const completed = tour.stops.filter(s => s.done).length;
  const total = tour.stops.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const lateCount = tour.stops.filter(s => s.late).length;

  return (
    <div className="border-b last:border-b-0">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <ScoreRing score={tour.score} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold truncate">{tour.driverName}</span>
            {tour.zone && (
              <span className="text-[9px] rounded-full bg-muted border px-1.5 py-0.5 font-semibold shrink-0">
                Zone {tour.zone}
              </span>
            )}
            <span className={cn('ml-auto text-[9px] font-black text-white px-1.5 py-0.5 rounded-full shrink-0', col.badge)}>
              {col.label}
            </span>
          </div>

          {/* Stop dots row */}
          <div className="flex items-end gap-1 flex-wrap mb-1.5">
            {tour.stops.map(s => <StopDot key={s.idx} stop={s} />)}
          </div>

          {/* Progress bar */}
          <div className="h-1.5 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-700',
                tour.score >= 80 ? 'bg-emerald-400' : tour.score >= 60 ? 'bg-amber-400' : 'bg-red-500'
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="shrink-0 text-right ml-1">
          <div className="text-sm font-black tabular-nums">{tour.elapsedMin}m</div>
          {tour.nextEtaMin !== null && (
            <div className="flex items-center gap-0.5 text-[9px] text-muted-foreground justify-end">
              <MapPin className="h-2.5 w-2.5" />~{tour.nextEtaMin}m
            </div>
          )}
          <div className="text-[9px] text-muted-foreground mt-0.5">
            {completed}/{total} Stopps
          </div>
        </div>

        <div className="shrink-0">
          {expanded
            ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
            : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          }
        </div>
      </div>

      {/* Expanded stop list */}
      {expanded && (
        <div className="px-4 pb-3 space-y-1 bg-muted/20">
          {tour.stops.map(s => (
            <div key={s.idx} className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs',
              s.done
                ? s.late ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700' : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700'
                : 'bg-white dark:bg-card border'
            )}>
              <div className={cn(
                'h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-black text-white shrink-0',
                s.done ? s.late ? 'bg-amber-400' : 'bg-emerald-500' : 'bg-stone-300 text-stone-600'
              )}>
                {s.idx + 1}
              </div>
              <span className="truncate flex-1 font-medium">
                {s.address ?? `Stopp ${s.idx + 1}`}
              </span>
              {s.done ? (
                <span className="text-[10px] font-bold shrink-0">{s.late ? 'Verspätet' : 'Zugestellt'}</span>
              ) : s.etaMin !== null ? (
                <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">~{s.etaMin} min</span>
              ) : null}
            </div>
          ))}
          {lateCount > 0 && (
            <div className="flex items-center gap-1.5 text-[10px] text-amber-600 font-semibold pt-1">
              <AlertTriangle className="h-3 w-3" />
              {lateCount} Stopp{lateCount > 1 ? 's' : ''} verspätet
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function DispatchPhase2490ScoreTourVisualisierungBoardV2({
  locationId,
}: {
  locationId?: string;
}) {
  const [tours, setTours] = useState<TourData[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const sb = createClient();

    // Try mise_delivery_batches first, fall back to delivery_batches
    const { data: miseBatches } = await sb
      .from('mise_delivery_batches')
      .select(`
        id,
        driver_id,
        state,
        started_at,
        mise_delivery_batch_stops(
          id, sequence, type, arrived_at, completed_at,
          customer_orders(lieferadresse)
        ),
        employees!driver_id(vorname, nachname)
      `)
      .in('state', ['assigned', 'at_restaurant', 'on_route'])
      .order('started_at', { ascending: true })
      .limit(8);

    if (miseBatches && miseBatches.length > 0) {
      const now = Date.now();
      setTours(miseBatches.map((b: any) => {
        const rawStops = ((b.mise_delivery_batch_stops ?? []) as any[])
          .filter((s: any) => s.type === 'dropoff')
          .sort((a: any, c: any) => a.sequence - c.sequence);

        const stops: StopInfo[] = rawStops.map((s: any, i: number) => {
          const isDone = !!s.completed_at;
          const isLate = isDone && s.arrived_at && b.started_at
            ? (new Date(s.arrived_at).getTime() - new Date(b.started_at).getTime()) / 60_000 > 20
            : false;
          return {
            idx: i,
            done: isDone,
            late: isLate,
            address: s.customer_orders?.lieferadresse ?? null,
            etaMin: !isDone ? (rawStops.length - i) * 7 : null,
          };
        });

        const doneCount = stops.filter(s => s.done).length;
        const lateCount = stops.filter(s => s.late).length;
        const score = stops.length === 0 ? 75 : Math.max(0, Math.min(100,
          Math.round(90 - (lateCount / Math.max(1, stops.length)) * 40 + (doneCount / Math.max(1, stops.length)) * 10)
        ));
        const elapsedMin = b.started_at ? Math.round((now - new Date(b.started_at).getTime()) / 60_000) : 0;
        const remaining = stops.filter(s => !s.done).length;

        return {
          batchId: b.id,
          driverName: b.employees ? `${b.employees.vorname} ${b.employees.nachname[0]}.` : 'Fahrer',
          score,
          stops,
          elapsedMin,
          nextEtaMin: remaining > 0 ? remaining * 7 : null,
          zone: null,
          state: b.state,
        };
      }));
    } else {
      // Legacy dispatch_batches fallback
      const { data: legacyBatches } = await sb
        .from('dispatch_batches')
        .select(`
          id, zone, abfahrt_zeit,
          employees!inner(vorname, nachname),
          dispatch_stops(id, status, geplante_ankunft, tatsaechliche_ankunft, lieferadresse)
        `)
        .eq('status', 'unterwegs')
        .order('abfahrt_zeit', { ascending: true })
        .limit(8);

      const now = Date.now();
      setTours((legacyBatches ?? []).map((b: any) => {
        const rawStops = ((b.dispatch_stops ?? []) as any[]);
        const stops: StopInfo[] = rawStops.map((s: any, i: number) => {
          const isDone = ['angekomm', 'zugestellt', 'done'].includes(s.status ?? '');
          const isLate = isDone && s.tatsaechliche_ankunft && s.geplante_ankunft
            ? new Date(s.tatsaechliche_ankunft) > new Date(s.geplante_ankunft)
            : false;
          return { idx: i, done: isDone, late: isLate, address: s.lieferadresse ?? null, etaMin: !isDone ? (rawStops.length - i) * 8 : null };
        });
        const doneCount = stops.filter(s => s.done).length;
        const lateCount = stops.filter(s => s.late).length;
        const score = stops.length === 0 ? 75 : Math.max(0, Math.min(100,
          Math.round(90 - (lateCount / Math.max(1, stops.length)) * 40 + (doneCount / Math.max(1, stops.length)) * 10)
        ));
        const abfahrt = b.abfahrt_zeit ? new Date(b.abfahrt_zeit).getTime() : now;
        return {
          batchId: b.id,
          driverName: b.employees ? `${b.employees.vorname} ${b.employees.nachname[0]}.` : 'Fahrer',
          score,
          stops,
          elapsedMin: Math.round((now - abfahrt) / 60_000),
          nextEtaMin: stops.filter(s => !s.done).length * 8 || null,
          zone: b.zone ?? null,
          state: 'unterwegs',
        };
      }));
    }
    setLoading(false);
  }, [locationId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 25_000);
    return () => clearInterval(iv);
  }, [load]);

  const alerts = tours.filter(t => t.score < 60);
  const avgScore = tours.length > 0
    ? Math.round(tours.reduce((a, t) => a + t.score, 0) / tours.length)
    : 0;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Bike className="h-4 w-4 text-matcha-600" />
          <span className="text-xs font-bold uppercase tracking-wider">Tour-Score · Visualisierung</span>
        </div>
        <div className="flex items-center gap-2">
          {alerts.length > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
              <AlertTriangle className="h-3 w-3" /> {alerts.length} &lt;60
            </span>
          )}
          {tours.length > 0 && (
            <span className="text-[10px] font-black text-muted-foreground">
              Ø {avgScore} Score · {tours.length} Touren
            </span>
          )}
        </div>
      </div>

      {/* Tour list */}
      <div className="divide-y max-h-[460px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 animate-pulse" /> Lade…
          </div>
        ) : tours.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Navigation2 className="h-4 w-4 text-matcha-500" /> Keine aktiven Touren
          </div>
        ) : tours.map(t => <TourRow key={t.batchId} tour={t} />)}
      </div>
    </div>
  );
}
