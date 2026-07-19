'use client';

/**
 * Phase 2483 — Tour-Score Live-Board
 *
 * Score-Ring je Fahrer (0–100), farbkodierte Stop-Dots,
 * Tour-Fortschrittsbalken, ETA-Badge, expandierbare Stop-Liste.
 * Alert wenn Score < 60. 25-Sek-Polling.
 */

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { AlertTriangle, ChevronDown, ChevronUp, Clock, MapPin, Navigation2, TrendingUp } from 'lucide-react';

interface Stop {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  angekommen_am: string | null;
  kunde_name: string | null;
  kunde_adresse: string | null;
}

interface TourRow {
  batchId: string;
  driverName: string;
  score: number;
  stops: Stop[];
  etaMin: number | null;
  zone: string | null;
  startedAt: string | null;
  status: string;
}

function scoreColor(s: number): { ring: string; label: string; bg: string; text: string } {
  if (s >= 80) return { ring: '#6a9e5f', label: 'TOP',  bg: 'bg-matcha-50 dark:bg-matcha-950/30', text: 'text-matcha-700 dark:text-matcha-300' };
  if (s >= 60) return { ring: '#f59e0b', label: 'OK',   bg: 'bg-amber-50  dark:bg-amber-950/30',  text: 'text-amber-700  dark:text-amber-300' };
  return           { ring: '#ef4444', label: 'TIEF', bg: 'bg-red-50    dark:bg-red-950/30',    text: 'text-red-700    dark:text-red-300' };
}

function ScoreRing({ score, size = 48 }: { score: number; size?: number }) {
  const r = size / 2 - 5;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.max(0, Math.min(100, score)) / 100);
  const col = scoreColor(score);
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={4} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={col.ring} strokeWidth={4}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.5s' }}
      />
      <text x={size / 2} y={size / 2 + 4} textAnchor="middle" fontSize={11} fontWeight="900" fill={col.ring} fontFamily="monospace">
        {score}
      </text>
    </svg>
  );
}

function StopDots({ stops }: { stops: Stop[] }) {
  const sorted = [...stops].sort((a, b) => (a.reihenfolge ?? 99) - (b.reihenfolge ?? 99));
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {sorted.map((s, i) => {
        const done = !!s.geliefert_am;
        const arrived = !!s.angekommen_am && !done;
        return (
          <span
            key={s.id}
            className={cn(
              'inline-flex h-2.5 w-2.5 rounded-full',
              done ? 'bg-matcha-500' : arrived ? 'bg-amber-400 ring-1 ring-amber-200' : 'bg-stone-200 dark:bg-stone-700',
            )}
            title={`Stop ${i + 1}${done ? ' ✓' : arrived ? ' ↗' : ''}`}
          />
        );
      })}
    </div>
  );
}

function TourCard({ tour }: { tour: TourRow }) {
  const [expanded, setExpanded] = useState(false);
  const col = scoreColor(tour.score);
  const sorted = [...tour.stops].sort((a, b) => (a.reihenfolge ?? 99) - (b.reihenfolge ?? 99));
  const doneCount = sorted.filter(s => !!s.geliefert_am).length;
  const pct = sorted.length > 0 ? Math.round((doneCount / sorted.length) * 100) : 0;
  const elapsedMin = tour.startedAt
    ? Math.floor((Date.now() - new Date(tour.startedAt).getTime()) / 60_000)
    : null;

  return (
    <div className={cn('rounded-xl border p-3 transition-all', col.bg, tour.score < 60 ? 'border-red-300 dark:border-red-700 shadow-[0_0_10px_rgba(239,68,68,0.15)]' : 'border-border')}>
      <div className="flex items-center gap-2.5">
        <ScoreRing score={tour.score} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-bold text-foreground truncate">{tour.driverName}</span>
            <span className={cn('text-[9px] font-black rounded-full px-1.5 py-0.5', col.bg, col.text)}>
              {col.label}
            </span>
            {tour.zone && (
              <span className="text-[10px] text-muted-foreground bg-muted rounded px-1">
                {tour.zone}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            <StopDots stops={tour.stops} />
            <span className="text-[10px] text-muted-foreground shrink-0">
              {doneCount}/{sorted.length} Stopps
            </span>
          </div>
          {/* Progress bar */}
          <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-700', tour.score >= 80 ? 'bg-matcha-500' : tour.score >= 60 ? 'bg-amber-400' : 'bg-red-500')}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {tour.etaMin !== null && (
            <div className="flex items-center gap-1 text-[11px] font-black text-foreground">
              <Clock className="h-3 w-3 text-muted-foreground" />
              {tour.etaMin}m
            </div>
          )}
          {elapsedMin !== null && (
            <div className="text-[10px] text-muted-foreground">{elapsedMin}m aktiv</div>
          )}
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-[10px] text-muted-foreground hover:text-foreground transition flex items-center gap-0.5"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* Alert */}
      {tour.score < 60 && (
        <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 px-2.5 py-1.5 text-[10px] font-semibold text-red-700 dark:text-red-300">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          Score unter Zielwert — Coaching empfohlen
        </div>
      )}

      {/* Expanded stop list */}
      {expanded && sorted.length > 0 && (
        <div className="mt-2 space-y-1.5 border-t border-border pt-2">
          {sorted.map((s, i) => {
            const done = !!s.geliefert_am;
            const arrived = !!s.angekommen_am && !done;
            return (
              <div key={s.id} className={cn('flex items-center gap-2 rounded-lg px-2 py-1.5 text-[10px]', done ? 'bg-matcha-50 dark:bg-matcha-950/20' : 'bg-muted/30')}>
                <span className={cn('h-2 w-2 rounded-full shrink-0', done ? 'bg-matcha-500' : arrived ? 'bg-amber-400' : 'bg-stone-300')}>
                </span>
                <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="flex-1 truncate font-medium text-foreground">
                  {s.kunde_adresse ?? s.kunde_name ?? `Stop ${i + 1}`}
                </span>
                <span className={cn('font-black', done ? 'text-matcha-600' : arrived ? 'text-amber-600' : 'text-muted-foreground')}>
                  {done ? '✓' : arrived ? '↗' : `#${i + 1}`}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function DispatchPhase2483TourScoreLiveBoard({ locationId }: { locationId?: string }) {
  const [tours, setTours] = useState<TourRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const supabase = createClient();

  const load = useCallback(async () => {
    // Try mise_delivery_batches first, fall back to delivery_batches
    const { data: mise } = await supabase
      .from('mise_delivery_batches')
      .select(`
        id, state, driver_id, started_at, total_eta_min, zone,
        driver:mise_drivers(id, name),
        stops:mise_delivery_batch_stops(id, order_id, sequence, completed_at, arrived_at, type,
          order:customer_orders(kunde_name, kunde_adresse))
      `)
      .in('state', ['assigned', 'at_restaurant', 'on_route'])
      .order('started_at', { ascending: false })
      .limit(10);

    const { data: legacy } = await supabase
      .from('delivery_batches')
      .select(`
        id, status, fahrer_id, startzeit, total_eta_min, zone,
        fahrer:employees(vorname, nachname),
        stops:delivery_batch_stops(id, order_id, reihenfolge, geliefert_am, angekommen_am,
          order:customer_orders(kunde_name, kunde_adresse))
      `)
      .in('status', ['unterwegs', 'pickup'])
      .order('created_at', { ascending: false })
      .limit(10);

    const rows: TourRow[] = [];

    // Process mise batches
    for (const b of (mise ?? []) as any[]) {
      const driverName = b.driver?.name ?? 'Fahrer';
      const stops: Stop[] = ((b.stops ?? []) as any[])
        .filter((s: any) => s.type === 'dropoff')
        .map((s: any) => ({
          id: s.id,
          reihenfolge: s.sequence ?? 0,
          geliefert_am: s.completed_at ?? null,
          angekommen_am: s.arrived_at ?? null,
          kunde_name: s.order?.kunde_name ?? null,
          kunde_adresse: s.order?.kunde_adresse ?? null,
        }));
      const doneCount = stops.filter(s => !!s.geliefert_am).length;
      const total = stops.length || 1;
      const pct = doneCount / total;
      const score = Math.round(60 + pct * 40);
      rows.push({
        batchId: b.id,
        driverName,
        score,
        stops,
        etaMin: b.total_eta_min ?? null,
        zone: b.zone ?? null,
        startedAt: b.started_at ?? null,
        status: b.state,
      });
    }

    // Process legacy batches
    for (const b of (legacy ?? []) as any[]) {
      const fahrer = b.fahrer;
      const driverName = fahrer ? `${fahrer.vorname ?? ''} ${fahrer.nachname ?? ''}`.trim() : 'Fahrer';
      const stops: Stop[] = ((b.stops ?? []) as any[]).map((s: any) => ({
        id: s.id,
        reihenfolge: s.reihenfolge ?? 0,
        geliefert_am: s.geliefert_am ?? null,
        angekommen_am: s.angekommen_am ?? null,
        kunde_name: s.order?.kunde_name ?? null,
        kunde_adresse: s.order?.kunde_adresse ?? null,
      }));
      const doneCount = stops.filter(s => !!s.geliefert_am).length;
      const total = stops.length || 1;
      const score = Math.round(55 + (doneCount / total) * 45);
      rows.push({
        batchId: b.id,
        driverName,
        score,
        stops,
        etaMin: b.total_eta_min ?? null,
        zone: b.zone ?? null,
        startedAt: b.startzeit ?? null,
        status: b.status,
      });
    }

    rows.sort((a, b) => a.score - b.score);
    setTours(rows);
    setLoading(false);
  }, [locationId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(load, 25_000);
    return () => clearInterval(t);
  }, [load]);

  const alertCount = tours.filter(t => t.score < 60).length;
  const avgScore = tours.length > 0 ? Math.round(tours.reduce((s, t) => s + t.score, 0) / tours.length) : 0;

  if (loading) {
    return (
      <div className="rounded-2xl border bg-card p-4 animate-pulse">
        <div className="h-5 w-48 bg-muted rounded mb-3" />
        <div className="space-y-2">
          {[1, 2].map(i => <div key={i} className="h-20 bg-muted rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (tours.length === 0) return null;

  return (
    <div className="rounded-2xl border bg-card shadow-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 rounded-t-2xl transition"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-matcha-100 dark:bg-matcha-900">
            <Navigation2 className="h-3.5 w-3.5 text-matcha-700 dark:text-matcha-300" />
          </div>
          <span className="text-sm font-bold text-foreground">Tour-Score Live-Board</span>
          {alertCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-[10px] font-black text-red-700 dark:text-red-300">
              <AlertTriangle className="h-3 w-3" />
              {alertCount} Alarm
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[11px] font-black text-muted-foreground">
            <TrendingUp className="h-3 w-3" />
            Ø {avgScore}
          </span>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {tours.map(t => <TourCard key={t.batchId} tour={t} />)}
        </div>
      )}
    </div>
  );
}
