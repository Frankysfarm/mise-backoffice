'use client';

/**
 * Phase 2511 — Tour-Score Live-Matrix
 * Kompakte Fahrer-Score-Karte + farbkodierte Tour-Stopp-Visualisierung.
 * Zeigt Score-Ring, aktuelle Stopp-Dots und ETA-Badge je aktivem Fahrer.
 * 20-Sek-Polling via Supabase.
 */

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Navigation2, Clock, AlertTriangle, MapPin, Bike, ChevronDown, ChevronUp, Trophy } from 'lucide-react';

interface Stop {
  idx: number;
  done: boolean;
  late: boolean;
  address: string | null;
}

interface DriverTour {
  driverId: string;
  name: string;
  score: number;
  vehicle: string | null;
  stops: Stop[];
  elapsedMin: number;
  state: string;
  batchId: string | null;
}

function ringColor(score: number) {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
}

function ScoreRing({ score }: { score: number }) {
  const r = 16;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.max(0, Math.min(100, score)) / 100);
  const col = ringColor(score);
  return (
    <svg width={38} height={38} className="shrink-0">
      <circle cx={19} cy={19} r={r} fill="none" stroke="#e5e7eb" strokeWidth={4} />
      <circle
        cx={19} cy={19} r={r} fill="none"
        stroke={col} strokeWidth={4}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 19 19)"
        className="transition-all duration-700"
      />
      <text x={19} y={23} textAnchor="middle" fontSize={10} fontWeight="900" fill={col} fontFamily="monospace">
        {score}
      </text>
    </svg>
  );
}

function StopDot({ stop }: { stop: Stop }) {
  return (
    <div
      className={cn(
        'flex h-5 w-5 items-center justify-center rounded-full border text-[9px] font-bold',
        stop.done
          ? 'bg-emerald-500 border-emerald-600 text-white'
          : stop.late
          ? 'bg-red-100 border-red-400 text-red-700'
          : 'bg-gray-100 border-gray-300 text-gray-600'
      )}
      title={stop.address ?? `Stopp ${stop.idx + 1}`}
    >
      {stop.idx + 1}
    </div>
  );
}

function stateLabel(state: string) {
  switch (state) {
    case 'on_route': return { text: 'Unterwegs', cls: 'bg-blue-100 text-blue-700' };
    case 'at_restaurant': return { text: 'Im Restaurant', cls: 'bg-amber-100 text-amber-700' };
    case 'assigned': return { text: 'Zugeteilt', cls: 'bg-purple-100 text-purple-700' };
    case 'idle': return { text: 'Bereit', cls: 'bg-emerald-100 text-emerald-700' };
    default: return { text: state, cls: 'bg-gray-100 text-gray-600' };
  }
}

export function DispatchPhase2511TourScoreLiveMatrix() {
  const supabase = createClient();
  const [tours, setTours] = useState<DriverTour[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const scoreResp = await fetch('/api/delivery/dispatch/scores');
      const scoreData = scoreResp.ok ? await scoreResp.json() : [];
      const scoreMap = new Map<string, number>(
        (scoreData as any[]).map((d: any) => [d.id ?? d.driver_id, d.score ?? 70])
      );

      const { data: statuses } = await supabase
        .from('driver_status')
        .select('driver_id, status, aktueller_batch_id, last_update')
        .in('status', ['on_route', 'at_restaurant', 'assigned', 'idle']);

      if (!statuses?.length) { setTours([]); setLoading(false); return; }

      const activeBatchIds = statuses
        .map((s: any) => s.aktueller_batch_id)
        .filter(Boolean) as string[];

      const [{ data: drivers }, { data: batches }, { data: stops }] = await Promise.all([
        supabase
          .from('employees')
          .select('id, vorname, nachname, fahrzeug:driver_status(fahrzeug)')
          .in('id', statuses.map((s: any) => s.driver_id)),
        activeBatchIds.length
          ? supabase
            .from('mise_delivery_batches')
            .select('id, driver_id, state, started_at')
            .in('id', activeBatchIds)
          : Promise.resolve({ data: [] }),
        activeBatchIds.length
          ? supabase
            .from('mise_delivery_batch_stops')
            .select('id, batch_id, sequence, arrived_at, completed_at, type, address')
            .in('batch_id', activeBatchIds)
            .eq('type', 'dropoff')
            .order('sequence', { ascending: true })
          : Promise.resolve({ data: [] }),
      ]);

      const driverMap = new Map<string, any>((drivers ?? []).map((d: any) => [d.id, d]));

      const result: DriverTour[] = statuses.map((s: any) => {
        const driver = driverMap.get(s.driver_id);
        const name = driver
          ? `${driver.vorname ?? ''} ${driver.nachname ?? ''}`.trim()
          : s.driver_id.slice(-6);
        const vehicle = (driver?.fahrzeug as any)?.[0]?.fahrzeug ?? null;
        const batch = (batches ?? []).find((b: any) => b.driver_id === s.driver_id);
        const batchId = batch?.id ?? null;
        const batchStops = batchId
          ? (stops ?? []).filter((st: any) => st.batch_id === batchId)
          : [];

        const now = Date.now();
        const startedAt = batch?.started_at ? new Date(batch.started_at).getTime() : now;
        const elapsedMin = Math.floor((now - startedAt) / 60_000);

        const stopRows: Stop[] = batchStops.map((st: any, i: number) => ({
          idx: i,
          done: !!st.completed_at,
          late: !st.completed_at && elapsedMin > (i + 1) * 12,
          address: (st as any).address ?? null,
        }));

        const baseScore = scoreMap.get(s.driver_id) ?? 70;

        return {
          driverId: s.driver_id,
          name,
          score: baseScore,
          vehicle,
          stops: stopRows,
          elapsedMin,
          state: s.status,
          batchId,
        };
      }).sort((a: DriverTour, b: DriverTour) => b.score - a.score);

      setTours(result);
    } catch {}
    finally { setLoading(false); }
  }, [supabase]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 20_000);
    return () => clearInterval(iv);
  }, [load]);

  const alertCount = tours.filter(t => t.score < 60).length;
  const avgScore = tours.length
    ? Math.round(tours.reduce((s, t) => s + t.score, 0) / tours.length)
    : 0;

  if (loading) return null;
  if (tours.length === 0) return null;

  return (
    <div className="rounded-xl border border-blue-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-blue-50 hover:bg-blue-100 transition"
      >
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-bold text-blue-800">Tour-Score Live-Matrix</span>
          {alertCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
              <AlertTriangle className="h-3 w-3" /> {alertCount} niedrig
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className={cn(
            'text-xs font-bold',
            avgScore >= 80 ? 'text-emerald-600' : avgScore >= 60 ? 'text-amber-600' : 'text-red-600'
          )}>
            Ø {avgScore}
          </span>
          <span className="text-xs text-gray-500">{tours.length} Fahrer</span>
          {open ? <ChevronUp className="h-4 w-4 text-blue-400" /> : <ChevronDown className="h-4 w-4 text-blue-400" />}
        </div>
      </button>

      {open && (
        <div className="p-3 space-y-2">
          {tours.map(tour => {
            const st = stateLabel(tour.state);
            const isExpanded = expandedId === tour.driverId;
            const doneCount = tour.stops.filter(s => s.done).length;
            const progress = tour.stops.length > 0 ? doneCount / tour.stops.length : 0;

            return (
              <div key={tour.driverId} className="rounded-lg border border-gray-100 overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : tour.driverId)}
                  className="w-full flex items-center gap-3 p-2.5 hover:bg-gray-50 transition text-left"
                >
                  <ScoreRing score={tour.score} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="truncate text-sm font-bold">{tour.name}</span>
                      {tour.vehicle && (
                        <span className="text-[10px] text-gray-400 shrink-0">({tour.vehicle})</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-bold', st.cls)}>
                        {st.text}
                      </span>
                      {tour.stops.length > 0 && (
                        <>
                          <div className="flex gap-1">
                            {tour.stops.map((s, i) => <StopDot key={i} stop={s} />)}
                          </div>
                          <span className="text-[10px] text-gray-400 tabular-nums">
                            {doneCount}/{tour.stops.length}
                          </span>
                        </>
                      )}
                    </div>
                    {tour.stops.length > 0 && (
                      <div className="mt-1.5 h-1 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all duration-700',
                            tour.score >= 80 ? 'bg-emerald-500' : tour.score >= 60 ? 'bg-amber-400' : 'bg-red-400'
                          )}
                          style={{ width: `${Math.round(progress * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Clock className="h-3 w-3 text-gray-400" />
                    <span className="text-[10px] text-gray-500 tabular-nums">{tour.elapsedMin}min</span>
                    {isExpanded ? <ChevronUp className="h-3 w-3 text-gray-400" /> : <ChevronDown className="h-3 w-3 text-gray-400" />}
                  </div>
                </button>

                {isExpanded && tour.stops.length > 0 && (
                  <div className="border-t border-gray-100 bg-gray-50 px-3 py-2 space-y-1">
                    {tour.stops.map((stop, i) => (
                      <div key={i} className={cn('flex items-center gap-2 text-xs', stop.done ? 'opacity-40' : '')}>
                        <StopDot stop={stop} />
                        <MapPin className="h-3 w-3 text-gray-400 shrink-0" />
                        <span className="truncate text-gray-600">
                          {stop.address ?? `Stopp ${stop.idx + 1}`}
                        </span>
                        {stop.done && <span className="ml-auto text-emerald-500 text-[10px] font-bold shrink-0">✓</span>}
                        {stop.late && !stop.done && <span className="ml-auto text-red-500 text-[10px] font-bold shrink-0">SPÄT</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
