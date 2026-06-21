'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Route, Clock, MapPin, CheckCircle2, Loader2, AlertTriangle, Bike, ChevronDown, ChevronUp } from 'lucide-react';

interface TourStop {
  reihenfolge: number;
  angekommen_am: string | null;
  geliefert_am: string | null;
  order: {
    bestellnummer: string;
    kunde_name: string;
    kunde_adresse: string | null;
    eta_latest: string | null;
  } | null;
}

interface Tour {
  id: string;
  fahrer_name: string;
  status: string;
  started_at: string | null;
  estimated_end: string | null;
  stop_count: number;
  stops_done: number;
  stops: TourStop[];
  score?: number | null;
}

interface Props {
  locationId: string;
}

function pct(done: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((done / total) * 100);
}

function scoreColor(score: number | null | undefined): string {
  if (score == null) return 'text-stone-400';
  if (score >= 80) return 'text-matcha-600';
  if (score >= 60) return 'text-amber-500';
  return 'text-red-500';
}

function TourRow({ tour, now }: { tour: Tour; now: number }) {
  const [expanded, setExpanded] = useState(false);
  const progress = pct(tour.stops_done, tour.stop_count);
  const etaMs = tour.estimated_end ? new Date(tour.estimated_end).getTime() - now : null;
  const etaMin = etaMs != null ? Math.round(etaMs / 60_000) : null;
  const isLate = etaMin != null && etaMin < -5;
  const isTight = etaMin != null && etaMin < 10;

  return (
    <div className="border-b border-stone-100 last:border-0">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-stone-50 transition text-left"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-matcha-600 text-white">
          <Bike size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-stone-800 truncate">{tour.fahrer_name}</span>
            {tour.score != null && (
              <span className={cn('text-[10px] font-black', scoreColor(tour.score))}>
                {Math.round(tour.score)}P
              </span>
            )}
            {isLate && <AlertTriangle className="h-3 w-3 text-red-500 animate-pulse" />}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-stone-100 overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', progress === 100 ? 'bg-matcha-500' : isTight ? 'bg-amber-400' : 'bg-matcha-600')}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[10px] text-stone-500 shrink-0 tabular-nums">
              {tour.stops_done}/{tour.stop_count}
            </span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          {etaMin != null && (
            <span className={cn('text-xs font-black tabular-nums', isLate ? 'text-red-500' : isTight ? 'text-amber-500' : 'text-matcha-600')}>
              {etaMin < 0 ? `−${Math.abs(etaMin)}` : `~${etaMin}`} Min
            </span>
          )}
          {expanded ? <ChevronUp size={12} className="text-stone-400 mt-0.5" /> : <ChevronDown size={12} className="text-stone-400 mt-0.5" />}
        </div>
      </button>

      {expanded && tour.stops.length > 0 && (
        <div className="px-4 pb-3 space-y-1.5 bg-stone-50/60">
          {tour.stops.map(stop => {
            const done = !!stop.geliefert_am;
            const eta = stop.order?.eta_latest;
            const lateStop = eta && !done && new Date(eta).getTime() < now;
            return (
              <div key={stop.reihenfolge} className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-xs',
                done ? 'bg-matcha-50 border border-matcha-100' : lateStop ? 'bg-red-50 border border-red-100' : 'bg-white border border-stone-100',
              )}>
                {done
                  ? <CheckCircle2 size={12} className="text-matcha-500 shrink-0" />
                  : <MapPin size={12} className={cn('shrink-0', lateStop ? 'text-red-400' : 'text-stone-400')} />}
                <span className={cn('font-bold truncate', done ? 'text-matcha-700' : 'text-stone-700')}>
                  #{stop.reihenfolge} {stop.order?.bestellnummer ?? '—'}
                </span>
                {stop.order?.kunde_name && (
                  <span className="text-stone-400 truncate">{stop.order.kunde_name}</span>
                )}
                {lateStop && <AlertTriangle size={10} className="text-red-400 ml-auto shrink-0 animate-pulse" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function DispatchTourZeitliniePanel({ locationId }: Props) {
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!locationId) return;
    const load = () => {
      fetch(`/api/delivery/admin/tours?location_id=${locationId}&status=active&include_stops=true`, { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          const list: Tour[] = Array.isArray(d?.tours) ? d.tours : Array.isArray(d) ? d : [];
          setTours(list.slice(0, 10));
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    };
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const lateCount = tours.filter(t => {
    const etaMs = t.estimated_end ? new Date(t.estimated_end).getTime() - now : null;
    return etaMs != null && etaMs < -5 * 60_000;
  }).length;

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-50 transition"
      >
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider text-stone-800">
            Tour-Zeitlinie
          </span>
          {lateCount > 0 && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white animate-pulse">
              {lateCount} zu spät
            </span>
          )}
          {!loading && (
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-600">
              {tours.length} Touren aktiv
            </span>
          )}
        </div>
        <span className="text-stone-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-stone-100">
          {loading && (
            <div className="flex items-center gap-2 px-4 py-4 text-sm text-stone-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Lade Touren…
            </div>
          )}
          {!loading && tours.length === 0 && (
            <div className="flex items-center gap-2 px-4 py-4 text-sm text-stone-400">
              <Clock className="h-4 w-4" /> Keine aktiven Touren
            </div>
          )}
          {!loading && tours.map(t => (
            <TourRow key={t.id} tour={t} now={now} />
          ))}
        </div>
      )}
    </div>
  );
}
