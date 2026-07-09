'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  CheckCircle2, Clock, MapPin, Navigation, Package,
  ExternalLink, ChevronRight, AlertTriangle,
} from 'lucide-react';

export type TourStop900 = {
  id: string;
  sequence: number;
  address: string;
  customer_name: string;
  order_number?: string;
  eta_min?: number | null;       // minutes from now
  done: boolean;
  notes?: string | null;
  lat?: number | null;
  lng?: number | null;
};

function openNavigation(lat: number, lng: number, address: string) {
  const encoded = encodeURIComponent(address);
  if (lat && lng) {
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
      '_blank',
    );
  } else {
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${encoded}`,
      '_blank',
    );
  }
}

function StopCard({
  stop,
  isCurrent,
  isNext,
}: {
  stop: TourStop900;
  isCurrent: boolean;
  isNext: boolean;
}) {
  const isOverdue = !stop.done && stop.eta_min != null && stop.eta_min < -2;
  const isTight   = !stop.done && stop.eta_min != null && stop.eta_min >= -2 && stop.eta_min <= 5;

  return (
    <div className={cn(
      'rounded-2xl border-2 p-3.5 space-y-2 transition-all',
      stop.done
        ? 'border-matcha-200 bg-matcha-50/50 opacity-60'
        : isCurrent
        ? 'border-blue-500 bg-blue-950/40 shadow-[0_0_16px_rgba(59,130,246,0.25)]'
        : isNext
        ? 'border-amber-400 bg-amber-900/20'
        : isOverdue
        ? 'border-red-500 bg-red-950/30 animate-pulse'
        : 'border-white/10 bg-white/5',
    )}>
      {/* Top row: sequence + status badge */}
      <div className="flex items-center gap-2">
        <div className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black',
          stop.done
            ? 'bg-matcha-500/20 text-matcha-400'
            : isCurrent
            ? 'bg-blue-500 text-white'
            : isNext
            ? 'bg-amber-400 text-white'
            : isOverdue
            ? 'bg-red-500 text-white'
            : 'bg-white/10 text-white/70',
        )}>
          {stop.done ? <CheckCircle2 className="h-4 w-4" /> : stop.sequence}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white truncate">{stop.customer_name}</div>
          {stop.order_number && (
            <div className="text-[9px] text-white/50 font-mono">{stop.order_number}</div>
          )}
        </div>
        {/* Status pill */}
        {stop.done ? (
          <span className="shrink-0 rounded-full bg-matcha-500/20 text-matcha-400 px-2 py-0.5 text-[9px] font-black">
            ✓ Geliefert
          </span>
        ) : isCurrent ? (
          <span className="shrink-0 rounded-full bg-blue-500 text-white px-2 py-0.5 text-[9px] font-black animate-pulse">
            Aktuell
          </span>
        ) : isNext ? (
          <span className="shrink-0 rounded-full bg-amber-400 text-white px-2 py-0.5 text-[9px] font-black">
            Nächster
          </span>
        ) : isOverdue ? (
          <span className="shrink-0 flex items-center gap-0.5 rounded-full bg-red-500/20 text-red-400 px-2 py-0.5 text-[9px] font-black">
            <AlertTriangle className="h-2.5 w-2.5" /> Spät
          </span>
        ) : null}
      </div>

      {/* Address */}
      <div className="flex items-start gap-1.5">
        <MapPin className="h-3 w-3 text-white/40 mt-0.5 shrink-0" />
        <span className="text-xs text-white/70 leading-tight">{stop.address}</span>
      </div>

      {/* ETA + notes */}
      <div className="flex items-center gap-2 flex-wrap">
        {!stop.done && stop.eta_min != null && (
          <span className={cn(
            'flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black',
            isOverdue
              ? 'bg-red-500/20 text-red-400'
              : isTight
              ? 'bg-amber-400/20 text-amber-300'
              : 'bg-blue-500/20 text-blue-300',
          )}>
            <Clock className="h-2.5 w-2.5" />
            {isOverdue
              ? `${Math.abs(stop.eta_min)} Min überfällig`
              : `in ~${stop.eta_min} Min`}
          </span>
        )}
        {stop.notes && (
          <span className="text-[9px] text-white/40 italic truncate flex-1">{stop.notes}</span>
        )}
      </div>

      {/* Navigation button (only for current/next) */}
      {!stop.done && (isCurrent || isNext) && (
        <button
          onClick={() => openNavigation(stop.lat ?? 0, stop.lng ?? 0, stop.address)}
          className={cn(
            'w-full flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-bold transition-colors',
            isCurrent
              ? 'bg-blue-500 hover:bg-blue-400 text-white'
              : 'bg-amber-400/20 hover:bg-amber-400/30 text-amber-300',
          )}
        >
          <Navigation className="h-3.5 w-3.5" />
          Navigieren
          <ExternalLink className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

export function FahrerPhase900TourStopsPrioritaet({
  stops,
  currentStopId,
}: {
  stops: TourStop900[];
  currentStopId?: string | null;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  if (stops.length === 0) return null;

  const sorted = [...stops].sort((a, b) => a.sequence - b.sequence);
  const doneCount = sorted.filter(s => s.done).length;
  const remaining = sorted.filter(s => !s.done);
  const progressPct = stops.length > 0 ? Math.round((doneCount / stops.length) * 100) : 0;

  // Determine current and next stop
  const currentIdx = currentStopId
    ? sorted.findIndex(s => s.id === currentStopId)
    : sorted.findIndex(s => !s.done);
  const nextIdx = currentIdx >= 0
    ? sorted.slice(currentIdx + 1).findIndex(s => !s.done)
    : -1;
  const nextStopId = nextIdx >= 0 ? sorted[currentIdx + 1 + nextIdx]?.id : null;

  // Show: all remaining + last done for context
  const lastDone = sorted.filter(s => s.done).slice(-1)[0];
  const displayStops = [
    ...(lastDone ? [lastDone] : []),
    ...remaining.slice(0, 6),
  ];

  return (
    <div className="space-y-3">
      {/* Progress header */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 space-y-2">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-blue-400 shrink-0" />
          <span className="text-sm font-bold text-white">Tour-Stops</span>
          <span className="ml-auto text-xs text-white/60 font-bold tabular-nums">
            {doneCount}/{stops.length} erledigt
          </span>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {remaining.length > 0 && (
          <div className="flex items-center gap-2 text-[10px] text-white/50">
            <ChevronRight className="h-3 w-3" />
            <span>{remaining.length} Stops verbleibend</span>
            {remaining[0]?.eta_min != null && (
              <span className="ml-auto text-blue-400 font-bold">
                Nächster in ~{remaining[0].eta_min} Min
              </span>
            )}
          </div>
        )}
      </div>

      {/* Stop cards */}
      <div className="space-y-2">
        {displayStops.map(stop => (
          <StopCard
            key={stop.id}
            stop={stop}
            isCurrent={stop.id === (currentStopId ?? sorted.find(s => !s.done)?.id)}
            isNext={stop.id === nextStopId}
          />
        ))}
      </div>

      {remaining.length > 6 && (
        <div className="text-center text-[10px] text-white/40 py-1">
          +{remaining.length - 6} weitere Stops
        </div>
      )}

      {remaining.length === 0 && (
        <div className="rounded-2xl border border-matcha-500/30 bg-matcha-500/10 p-4 text-center space-y-1">
          <CheckCircle2 className="h-6 w-6 text-matcha-400 mx-auto" />
          <div className="text-sm font-bold text-matcha-400">Tour abgeschlossen!</div>
          <div className="text-[10px] text-white/50">Alle {doneCount} Stops erledigt</div>
        </div>
      )}
    </div>
  );
}
