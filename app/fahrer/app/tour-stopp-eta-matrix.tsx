'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, CheckCircle2, Clock, Navigation, AlertTriangle } from 'lucide-react';

type Stop = {
  id: string;
  reihenfolge: number;
  angekommen_am: string | null;
  geliefert_am: string | null;
  distanz_zum_vorgaenger_m?: number | null;
  order: {
    id: string;
    bestellnummer: string;
    kunde_name: string;
    kunde_adresse: string | null;
    eta_earliest?: string | null;
    eta_latest?: string | null;
  };
};

interface Props {
  stops: Stop[];
  batchStartedAt: string | null;
  totalEtaMin: number | null;
}

function useTick() {
  const [, setN] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setN((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function EtaDisplay({ stop, now, baseMs, perStopMin }: {
  stop: Stop; now: number; baseMs: number; perStopMin: number;
}) {
  if (stop.geliefert_am) {
    return (
      <span className="text-[10px] text-matcha-600 font-bold flex items-center gap-0.5">
        <CheckCircle2 size={10} />
        {fmtTime(stop.geliefert_am)}
      </span>
    );
  }
  if (stop.order.eta_latest) {
    const secs = Math.floor((new Date(stop.order.eta_latest).getTime() - now) / 1000);
    const overdue = secs < 0;
    const tight = secs < 300;
    return (
      <span className={cn('font-mono text-[11px] font-black tabular-nums', overdue ? 'text-red-600 animate-pulse' : tight ? 'text-amber-600' : 'text-matcha-600')}>
        {overdue ? 'Überfällig' : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`}
      </span>
    );
  }
  const estimatedMs = baseMs + stop.reihenfolge * perStopMin * 60_000;
  const secs = Math.floor((estimatedMs - now) / 1000);
  if (secs < 0) return <span className="text-[10px] text-red-500 font-bold">Überfällig</span>;
  return (
    <span className="font-mono text-[11px] font-black tabular-nums text-muted-foreground">
      ~{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}
    </span>
  );
}

export function TourStoppEtaMatrix({ stops, batchStartedAt, totalEtaMin }: Props) {
  useTick();
  const now = Date.now();

  const sorted = [...stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  if (sorted.length === 0) return null;

  const baseMs = batchStartedAt ? new Date(batchStartedAt).getTime() : now;
  const perStopMin = totalEtaMin != null ? totalEtaMin / Math.max(1, sorted.length) : 15;

  const done = sorted.filter((s) => s.geliefert_am).length;
  const nextStop = sorted.find((s) => !s.geliefert_am);

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-card">
      <div className="flex items-center gap-2 px-3 py-2 bg-matcha-600">
        <Navigation className="h-4 w-4 text-white" />
        <span className="text-xs font-black uppercase tracking-wider text-white">
          Stopp-ETA-Matrix
        </span>
        <span className="ml-auto text-[10px] font-bold text-white bg-white/20 rounded-full px-2 py-0.5">
          {done}/{sorted.length} erledigt
        </span>
      </div>

      <div className="divide-y divide-border">
        {sorted.map((stop, idx) => {
          const isDone = !!stop.geliefert_am;
          const isNext = nextStop?.id === stop.id;
          const distKm = stop.distanz_zum_vorgaenger_m != null
            ? (stop.distanz_zum_vorgaenger_m / 1000).toFixed(1)
            : null;

          return (
            <div
              key={stop.id}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 transition-colors',
                isDone ? 'opacity-50 bg-muted/20' : isNext ? 'bg-matcha-50 border-l-2 border-l-matcha-500' : 'bg-card',
              )}
            >
              {/* Step number */}
              <div className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black',
                isDone ? 'bg-matcha-500 text-white' : isNext ? 'bg-matcha-600 text-white' : 'bg-muted text-muted-foreground',
              )}>
                {isDone ? <CheckCircle2 size={13} /> : stop.reihenfolge}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-mono text-muted-foreground">#{stop.order.bestellnummer}</span>
                  {isNext && (
                    <span className="text-[9px] bg-matcha-100 text-matcha-700 rounded-full px-1.5 py-0.5 font-bold">
                      Nächster Stopp
                    </span>
                  )}
                </div>
                <div className="text-[12px] font-semibold truncate">{stop.order.kunde_name}</div>
                {stop.order.kunde_adresse && (
                  <div className="text-[10px] text-muted-foreground flex items-center gap-0.5 truncate">
                    <MapPin size={8} />
                    {stop.order.kunde_adresse}
                    {distKm && <span className="ml-1 text-muted-foreground">· {distKm} km</span>}
                  </div>
                )}
              </div>

              {/* ETA */}
              <div className="shrink-0 text-right">
                <EtaDisplay stop={stop} now={now} baseMs={baseMs} perStopMin={perStopMin} />
                {isNext && !stop.geliefert_am && (
                  <div className="text-[9px] text-matcha-600 font-semibold mt-0.5">jetzt liefern</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer summary */}
      {totalEtaMin != null && batchStartedAt && (
        <div className="px-3 py-2 bg-muted/30 flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock size={10} />
            Tour gestartet {Math.round((now - new Date(batchStartedAt).getTime()) / 60_000)} Min
          </span>
          <span className="font-mono font-bold text-foreground">
            Gesamt ~{totalEtaMin} Min
          </span>
        </div>
      )}
    </div>
  );
}
