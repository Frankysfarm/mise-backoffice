'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Bike, CheckCircle2, Clock, MapPin, TrendingDown, TrendingUp } from 'lucide-react';

type Batch = {
  id: string;
  status: string;
  fahrer_id: string | null;
  startzeit?: string | null;
  total_eta_min: number | null;
  total_distance_km: number | null;
  zone: string | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: {
    id: string;
    order_id: string;
    reihenfolge: number;
    geliefert_am: string | null;
    order: {
      bestellnummer: string;
      kunde_name: string;
      kunde_adresse: string | null;
      eta_earliest: string | null;
      eta_latest: string | null;
    } | null;
  }[];
};

function fmtMin(ms: number): string {
  const m = Math.round(ms / 60_000);
  if (m <= 0) return 'jetzt';
  if (m < 60) return `${m} Min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function DispatchTourStopMatrix({ batches }: { batches: Batch[] }) {
  const activeTours = useMemo(() => {
    const now = Date.now();
    return batches
      .filter((b) => b.status === 'unterwegs' || b.status === 'on_route')
      .map((b) => {
        const totalStops = b.stops.length;
        const delivered = b.stops.filter((s) => !!s.geliefert_am).length;
        const pending = totalStops - delivered;

        const etaMs = b.startzeit && b.total_eta_min != null
          ? new Date(b.startzeit).getTime() + b.total_eta_min * 60_000
          : null;
        const etaMin = etaMs ? (etaMs - now) / 60_000 : null;

        // Find the current (next undelivered) stop
        const currentStop = b.stops
          .filter((s) => !s.geliefert_am)
          .sort((a, x) => a.reihenfolge - x.reihenfolge)[0] ?? null;

        // ETA deviation: compare eta_earliest of current stop vs now
        let etaDev: number | null = null;
        if (currentStop?.order?.eta_earliest) {
          const target = new Date(currentStop.order.eta_earliest).getTime();
          etaDev = (now - target) / 60_000; // positive = late
        }

        const pct = totalStops > 0 ? Math.round((delivered / totalStops) * 100) : 0;
        const health: 'green' | 'amber' | 'red' =
          etaDev == null ? 'green' : etaDev < 5 ? 'green' : etaDev < 15 ? 'amber' : 'red';

        return { batch: b, totalStops, delivered, pending, etaMin, currentStop, etaDev, pct, health };
      })
      .sort((a, b) => (b.pending) - (a.pending));
  }, [batches]);

  if (activeTours.length === 0) return null;

  const healthColor = {
    green: { border: 'border-matcha-500/40', bg: 'bg-matcha-900/40', text: 'text-matcha-300', dot: 'bg-matcha-400' },
    amber: { border: 'border-amber-500/40', bg: 'bg-amber-950/30', text: 'text-amber-300', dot: 'bg-amber-400' },
    red:   { border: 'border-red-500/40',   bg: 'bg-red-950/30',   text: 'text-red-300',   dot: 'bg-red-500 animate-pulse' },
  };

  return (
    <div className="rounded-xl border border-matcha-700/40 bg-matcha-900/30 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-matcha-700/40 bg-matcha-900/60">
        <Bike className="h-3.5 w-3.5 text-accent shrink-0" />
        <span className="text-[10px] font-black uppercase tracking-widest text-matcha-300">
          Tour-Stop-Matrix · {activeTours.length} aktive Tour{activeTours.length !== 1 ? 'en' : ''}
        </span>
        <div className="ml-auto flex items-center gap-2 text-[9px] text-matcha-500">
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-matcha-400 inline-block" />Im Plan</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-400 inline-block" />Leicht spät</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-red-500 inline-block" />Verspätet</span>
        </div>
      </div>

      <div className="divide-y divide-matcha-800/40">
        {activeTours.map(({ batch, totalStops, delivered, pending, etaMin, currentStop, etaDev, pct, health }) => {
          const c = healthColor[health];
          const fahrerName = batch.fahrer
            ? `${batch.fahrer.vorname} ${batch.fahrer.nachname[0]}.`
            : 'Fahrer';

          return (
            <div key={batch.id} className={cn('flex items-start gap-3 px-3 py-2.5 border-l-2', c.border, c.bg)}>
              {/* Status dot */}
              <div className="flex flex-col items-center gap-1 shrink-0 mt-1">
                <span className={cn('h-2 w-2 rounded-full', c.dot)} />
              </div>

              {/* Main info */}
              <div className="flex-1 min-w-0">
                {/* Driver + Zone */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-black text-white">{fahrerName}</span>
                  {batch.zone && (
                    <span className="text-[9px] font-bold text-matcha-400 bg-matcha-800/60 rounded px-1.5 py-0.5">
                      {batch.zone}
                    </span>
                  )}
                  {etaMin != null && (
                    <span className={cn('ml-auto text-[10px] font-bold tabular-nums', c.text)}>
                      {etaMin <= 0 ? 'überfällig' : `zurück in ${fmtMin(etaMin * 60_000)}`}
                    </span>
                  )}
                </div>

                {/* Stop progress bar */}
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-matcha-800/80 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700',
                        health === 'green' ? 'bg-matcha-400' : health === 'amber' ? 'bg-amber-400' : 'bg-red-500')}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[9px] tabular-nums text-matcha-400 shrink-0">
                    {delivered}/{totalStops}
                  </span>
                </div>

                {/* Stop details */}
                <div className="mt-1.5 flex items-center gap-3 flex-wrap">
                  {currentStop?.order && (
                    <span className="flex items-center gap-1 text-[10px] text-matcha-400">
                      <MapPin className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate max-w-[160px]">
                        #{currentStop.order.bestellnummer.slice(-4)} {currentStop.order.kunde_adresse ?? currentStop.order.kunde_name}
                      </span>
                    </span>
                  )}
                  {etaDev != null && etaDev >= 5 && (
                    <span className={cn(
                      'flex items-center gap-0.5 text-[10px] font-bold shrink-0',
                      etaDev < 15 ? 'text-amber-400' : 'text-red-400',
                    )}>
                      {etaDev < 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                      {etaDev < 0 ? `${Math.abs(Math.round(etaDev))} Min früher` : `+${Math.round(etaDev)} Min Verzug`}
                    </span>
                  )}
                  {pending > 0 && (
                    <span className="ml-auto text-[9px] text-matcha-500 tabular-nums shrink-0">
                      {pending} ausstehend
                    </span>
                  )}
                </div>

                {/* Individual stop dots */}
                <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                  {batch.stops
                    .sort((a, b) => a.reihenfolge - b.reihenfolge)
                    .map((stop, i) => (
                      <span
                        key={stop.id}
                        className={cn(
                          'inline-flex items-center justify-center h-4 w-4 rounded-full text-[8px] font-black border',
                          stop.geliefert_am
                            ? 'bg-matcha-700/60 border-matcha-600/40 text-matcha-400'
                            : stop.id === currentStop?.id
                            ? 'bg-accent border-accent/60 text-matcha-900 animate-pulse'
                            : 'bg-matcha-800/60 border-matcha-700/40 text-matcha-500',
                        )}
                        title={stop.order?.kunde_name ?? `Stop ${i + 1}`}
                      >
                        {stop.geliefert_am ? <CheckCircle2 className="h-2.5 w-2.5" /> : i + 1}
                      </span>
                    ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-3 py-1.5 border-t border-matcha-800/40 bg-matcha-900/60 flex items-center gap-1">
        <Clock className="h-2.5 w-2.5 text-matcha-600" />
        <span className="text-[8px] text-matcha-600">Live · aktualisiert automatisch</span>
      </div>
    </div>
  );
}
