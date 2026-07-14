'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, Clock, Check, Truck, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';

// Phase 1493 — Tour-Visualisierung Live (Dispatch)
// Zeigt alle aktiven Touren mit Fahrer-Name, Stopp-Fortschritt, Status-Badge und
// Echtzeit-Countdown zum nächsten Stopp. Supabase-Realtime-Subscription.
// Nach Phase 1488.

interface Stop {
  id: string;
  order_id?: string | null;
  address?: string | null;
  geliefert_am?: string | null;
  estimated_arrival?: string | null;
  sequence?: number | null;
}

interface Tour {
  id: string;
  status: string;
  driver?: { first_name?: string | null; last_name?: string | null } | null;
  stops: Stop[];
  started_at?: string | null;
}

interface Props {
  locationId: string | null;
}

const STATUS_CFG: Record<string, { label: string; dot: string; badge: string }> = {
  active:    { label: 'Aktiv',    dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  returning: { label: 'Rückkehr', dot: 'bg-sky-500',     badge: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
  finished:  { label: 'Fertig',   dot: 'bg-slate-400',   badge: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300' },
};

function driverName(driver: Tour['driver']): string {
  if (!driver) return 'Unbekannt';
  return [driver.first_name, driver.last_name].filter(Boolean).join(' ') || 'Fahrer';
}

function countdownMin(isoStr: string): string {
  const diff = new Date(isoStr).getTime() - Date.now();
  if (diff <= 0) return 'Jetzt';
  const m = Math.floor(diff / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  if (m > 0) return `${m}:${String(s).padStart(2, '0')} Min`;
  return `${s}s`;
}

function buildMockTours(): Tour[] {
  return [
    {
      id: 'tour-1',
      status: 'active',
      driver: { first_name: 'Max', last_name: 'M.' },
      started_at: new Date(Date.now() - 18 * 60_000).toISOString(),
      stops: [
        { id: 's1', address: 'Hauptstr. 12', geliefert_am: new Date(Date.now() - 10 * 60_000).toISOString(), sequence: 1 },
        { id: 's2', address: 'Rosen­weg 4', geliefert_am: null, estimated_arrival: new Date(Date.now() + 5 * 60_000).toISOString(), sequence: 2 },
        { id: 's3', address: 'Bahnhofstr. 99', geliefert_am: null, estimated_arrival: new Date(Date.now() + 14 * 60_000).toISOString(), sequence: 3 },
      ],
    },
    {
      id: 'tour-2',
      status: 'active',
      driver: { first_name: 'Anna', last_name: 'S.' },
      started_at: new Date(Date.now() - 9 * 60_000).toISOString(),
      stops: [
        { id: 's4', address: 'Gartenstr. 7', geliefert_am: null, estimated_arrival: new Date(Date.now() + 3 * 60_000).toISOString(), sequence: 1 },
        { id: 's5', address: 'Lindenallee 22', geliefert_am: null, estimated_arrival: new Date(Date.now() + 12 * 60_000).toISOString(), sequence: 2 },
      ],
    },
    {
      id: 'tour-3',
      status: 'returning',
      driver: { first_name: 'Ben', last_name: 'K.' },
      started_at: new Date(Date.now() - 35 * 60_000).toISOString(),
      stops: [
        { id: 's6', address: 'Kirchweg 1', geliefert_am: new Date(Date.now() - 20 * 60_000).toISOString(), sequence: 1 },
        { id: 's7', address: 'Seestr. 45', geliefert_am: new Date(Date.now() - 8 * 60_000).toISOString(), sequence: 2 },
      ],
    },
  ];
}

export function DispatchPhase1493TourVisualisierungLive({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [tours, setTours] = useState<Tour[]>(buildMockTours);
  const [tick, setTick] = useState(0);

  // Live countdown tick every 10s
  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(iv);
  }, []);

  // Supabase realtime subscription
  useEffect(() => {
    if (!locationId) return;
    const supabase = createClient();

    async function load() {
      const { data } = await supabase
        .from('delivery_batches')
        .select(`
          id, status, started_at,
          driver:fahrer_id ( first_name, last_name ),
          stops:batch_stops ( id, order_id, address, geliefert_am, estimated_arrival, sequence )
        `)
        .eq('location_id', locationId)
        .in('status', ['active', 'returning'])
        .order('started_at', { ascending: false })
        .limit(8);

      if (data && data.length > 0) {
        setTours(
          (data as unknown as Tour[]).map((t) => ({
            ...t,
            stops: [...(t.stops ?? [])].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0)),
          })),
        );
      }
    }

    load();

    const channel = supabase
      .channel(`dispatch-tour-vis-${locationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_batches' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'batch_stops' }, load)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [locationId]);

  const activeTours = tours.filter((t) => ['active', 'returning'].includes(t.status));

  return (
    <Card className="overflow-hidden border border-indigo-200 dark:border-indigo-800">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-2.5 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-200 dark:border-indigo-800 text-left"
      >
        <Truck className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
        <span className="text-xs font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-200 flex-1">
          Tour-Visualisierung Live
        </span>
        <span className="text-[10px] font-semibold text-indigo-500">
          {activeTours.length} aktive Touren
        </span>
        <span className="ml-2 text-[10px] text-indigo-400">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {activeTours.length === 0 && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Keine aktiven Touren
            </div>
          )}
          {activeTours.map((tour) => {
            const done = tour.stops.filter((s) => !!s.geliefert_am).length;
            const total = tour.stops.length;
            const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;
            const nextStop = tour.stops.find((s) => !s.geliefert_am);
            const cfg = STATUS_CFG[tour.status] ?? STATUS_CFG.active!;

            return (
              <div key={tour.id} className="px-4 py-3 space-y-2">
                {/* Driver + status */}
                <div className="flex items-center gap-2">
                  <span className={cn('relative flex h-2 w-2 rounded-full', cfg.dot)}>
                    {tour.status === 'active' && (
                      <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-60', cfg.dot)} />
                    )}
                  </span>
                  <span className="text-[11px] font-bold text-foreground">{driverName(tour.driver)}</span>
                  <span className={cn('ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full', cfg.badge)}>
                    {cfg.label}
                  </span>
                </div>

                {/* Stop dots */}
                <div className="flex items-center gap-1">
                  {tour.stops.map((stop) => {
                    const isDone = !!stop.geliefert_am;
                    const isNext = stop.id === nextStop?.id;
                    return (
                      <div key={stop.id} className="flex items-center gap-1">
                        <div
                          className={cn(
                            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[8px] font-bold transition-all',
                            isDone
                              ? 'bg-emerald-500 border-emerald-600 text-white'
                              : isNext
                              ? 'bg-indigo-500 border-indigo-600 text-white animate-pulse'
                              : 'bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-muted-foreground',
                          )}
                          title={stop.address ?? ''}
                        >
                          {isDone ? <Check className="h-2.5 w-2.5" /> : <MapPin className="h-2.5 w-2.5" />}
                        </div>
                        {/* connector line */}
                        {stop.sequence !== tour.stops[tour.stops.length - 1]?.sequence && (
                          <div className={cn('h-0.5 w-3 rounded', isDone ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-slate-600')} />
                        )}
                      </div>
                    );
                  })}
                  <span className="ml-auto text-[10px] font-semibold tabular-nums text-muted-foreground">
                    {done}/{total}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-1 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all duration-700"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                {/* Next stop ETA */}
                {nextStop?.estimated_arrival && (
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Nächster Stopp:</span>
                    <span className="font-semibold text-foreground truncate max-w-[120px]">
                      {nextStop.address ?? '–'}
                    </span>
                    <span className="ml-auto font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
                      {countdownMin(nextStop.estimated_arrival)}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
