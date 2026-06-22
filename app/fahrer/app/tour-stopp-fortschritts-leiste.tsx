'use client';

import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, MapPin, Navigation } from 'lucide-react';

type StopOrder = {
  kunde_name: string;
  kunde_adresse: string | null;
  eta_earliest: string | null;
};

type Stop = {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  angekommen_am: string | null;
  order: StopOrder | null;
};

interface Props {
  stops: Stop[];
  onMarkDelivered?: (stopId: string) => void;
  onMarkArrived?: (stopId: string) => void;
}

function etaCountdown(iso: string | null): string | null {
  if (!iso) return null;
  const secs = Math.floor((new Date(iso).getTime() - Date.now()) / 1000);
  if (secs < -120) return 'überfällig';
  const abs = Math.abs(secs);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const sign = secs < 0 ? '+' : '';
  return `${sign}${m}:${String(s).padStart(2, '0')}`;
}

function isOverdue(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now() - 120_000;
}

export function TourStoppFortschrittsLeiste({ stops, onMarkDelivered, onMarkArrived }: Props) {
  const sorted = [...stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  if (sorted.length === 0) return null;

  // Find active stop: all previous must be completed
  const activeIdx = sorted.findIndex(
    (s, idx) => s.geliefert_am == null && sorted.slice(0, idx).every((p) => p.geliefert_am != null),
  );

  const activeStop = activeIdx >= 0 ? sorted[activeIdx] : null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-matcha-900/5">
        <Navigation className="h-3.5 w-3.5 text-matcha-400" />
        <span className="text-[10px] font-black uppercase tracking-widest text-matcha-200">
          Tour-Fortschritt
        </span>
        <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-matcha-200">
          {sorted.filter((s) => s.geliefert_am != null).length}/{sorted.length} Stopps
        </span>
      </div>

      {/* Horizontal stop chain */}
      <div className="px-4 py-3">
        <div className="flex items-start gap-0 overflow-x-auto pb-1">
          {sorted.map((stop, idx) => {
            const done = stop.geliefert_am != null;
            const isActive = idx === activeIdx;
            const isUpcoming = !done && !isActive;
            const isConnectorDone = idx < sorted.length - 1 && done;

            return (
              <div key={stop.id} className="flex items-start shrink-0">
                {/* Node */}
                <div className="flex flex-col items-center gap-0.5">
                  <div
                    className={cn(
                      'h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-black border-2 transition-all',
                      done
                        ? 'bg-matcha-500 border-matcha-600 text-white'
                        : isActive
                        ? 'bg-blue-500 border-blue-400 text-white animate-pulse shadow-lg shadow-blue-500/30'
                        : 'bg-white/10 border-white/20 text-white/50',
                    )}
                  >
                    {done ? <CheckCircle2 size={13} /> : idx + 1}
                  </div>
                  {/* Stop label below node */}
                  <span className={cn(
                    'text-[8px] font-bold truncate max-w-[40px] text-center mt-0.5',
                    done ? 'text-matcha-400' : isActive ? 'text-blue-300' : 'text-white/30',
                  )}>
                    {stop.order?.kunde_name?.split(' ')[0] ?? `${idx + 1}`}
                  </span>
                </div>

                {/* Connector line */}
                {idx < sorted.length - 1 && (
                  <div className={cn(
                    'h-0.5 w-8 self-start mt-4 rounded-full mx-0.5',
                    isConnectorDone ? 'bg-matcha-500' : 'bg-white/15',
                  )} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Active stop detail */}
      {activeStop && (
        <div className="mx-3 mb-3 rounded-xl border border-blue-400/40 bg-blue-500/10 p-3">
          {/* Stop header */}
          <div className="flex items-center gap-1.5 mb-2">
            <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center text-[9px] font-black text-white shrink-0">
              {activeIdx + 1}
            </div>
            <span className="text-xs font-bold text-blue-200 truncate">
              {activeStop.order?.kunde_name ?? `Stopp ${activeIdx + 1}`}
            </span>
            {/* ETA */}
            {activeStop.order?.eta_earliest && (
              <span className={cn(
                'ml-auto flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums shrink-0',
                isOverdue(activeStop.order.eta_earliest)
                  ? 'bg-red-500/30 text-red-300'
                  : 'bg-blue-500/30 text-blue-200',
              )}>
                <Clock size={8} />
                {etaCountdown(activeStop.order.eta_earliest)}
              </span>
            )}
          </div>

          {/* Address */}
          {activeStop.order?.kunde_adresse && (
            <div className="flex items-start gap-1 mb-3">
              <MapPin size={10} className="text-blue-400 shrink-0 mt-0.5" />
              <span className="text-[10px] text-blue-200/80 leading-tight">
                {activeStop.order.kunde_adresse}
              </span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            {!activeStop.angekommen_am && onMarkArrived && (
              <button
                onClick={() => onMarkArrived(activeStop.id)}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-blue-500/20 border border-blue-400/40 py-2 text-[11px] font-bold text-blue-200 active:scale-95 transition-transform"
              >
                <MapPin size={11} />
                Angekommen
              </button>
            )}
            {onMarkDelivered && (
              <button
                onClick={() => onMarkDelivered(activeStop.id)}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-matcha-500 border border-matcha-400 py-2 text-[11px] font-bold text-white active:scale-95 transition-transform"
              >
                <CheckCircle2 size={11} />
                Zugestellt
              </button>
            )}
          </div>
        </div>
      )}

      {/* All stops done */}
      {activeStop === null && sorted.every((s) => s.geliefert_am != null) && (
        <div className="mx-3 mb-3 rounded-xl border border-matcha-400/40 bg-matcha-500/10 px-4 py-3 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-matcha-400 shrink-0" />
          <span className="text-xs font-bold text-matcha-200">
            Alle {sorted.length} Stopps abgeschlossen!
          </span>
        </div>
      )}
    </div>
  );
}
