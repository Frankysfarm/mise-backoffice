'use client';

import { CheckCircle2, Circle, Navigation, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

type Stop = {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  angekommen_am: string | null;
  order: {
    id: string;
    bestellnummer: string;
    kunde_name: string;
    kunde_adresse: string | null;
    kunde_lat: number | null;
    kunde_lng: number | null;
    eta_earliest: string | null;
    eta_latest: string | null;
    gesamtbetrag: number;
  } | null;
};

interface Props {
  stops: Stop[];
  className?: string;
}

function openNav(lat: number | null, lng: number | null, address: string | null) {
  if (lat && lng) {
    window.open(`https://maps.google.com/?daddr=${lat},${lng}`, '_blank');
  } else if (address) {
    window.open(`https://maps.google.com/?daddr=${encodeURIComponent(address)}`, '_blank');
  }
}

function fmtEta(eta: string | null): string | null {
  if (!eta) return null;
  const d = new Date(eta);
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function fmtEur(v: number): string {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export function TourStoppListe({ stops, className }: Props) {
  const sorted = [...stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const currentIdx = sorted.findIndex(s => !s.geliefert_am);

  if (sorted.length === 0) return null;

  return (
    <div className={cn('rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
        <Navigation className="h-4 w-4 text-blue-300 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-white">
          Tour-Stopps · {sorted.length} gesamt
        </span>
        <span className="ml-auto text-[10px] font-bold text-blue-300">
          {sorted.filter(s => s.geliefert_am).length}/{sorted.length} erledigt
        </span>
      </div>

      {/* Stop List */}
      <div className="divide-y divide-white/10">
        {sorted.map((stop, i) => {
          const isDone = stop.geliefert_am != null;
          const isCurrent = i === currentIdx;
          const order = stop.order;
          const etaStr = fmtEta(order?.eta_latest ?? null);

          return (
            <div
              key={stop.id}
              className={cn(
                'flex items-start gap-3 px-4 py-3 transition-colors',
                isDone && 'opacity-50',
                isCurrent && 'bg-white/10',
              )}
            >
              {/* Step indicator */}
              <div className="flex flex-col items-center gap-1 shrink-0 mt-0.5">
                {isDone ? (
                  <CheckCircle2 className="h-5 w-5 text-matcha-400" />
                ) : isCurrent ? (
                  <div className="relative">
                    <Circle className="h-5 w-5 text-amber-400" />
                    <div className="absolute inset-0 rounded-full border-2 border-amber-400 animate-ping opacity-60" />
                  </div>
                ) : (
                  <div className="h-5 w-5 rounded-full border-2 border-white/30 flex items-center justify-center">
                    <span className="text-[9px] font-black text-white/50">{stop.reihenfolge}</span>
                  </div>
                )}
                {i < sorted.length - 1 && (
                  <div className={cn('w-px flex-1 min-h-[12px]', isDone ? 'bg-matcha-400/40' : 'bg-white/20')} />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white truncate">
                      {order?.kunde_name ?? `Stop ${stop.reihenfolge}`}
                    </div>
                    {order?.kunde_adresse && (
                      <div className="text-[11px] text-white/60 truncate mt-0.5">
                        {order.kunde_adresse}
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 text-right">
                    {order?.gesamtbetrag != null && (
                      <div className="text-xs font-black text-white/90 tabular-nums">
                        {fmtEur(order.gesamtbetrag)}
                      </div>
                    )}
                    {etaStr && (
                      <div className="flex items-center gap-0.5 mt-0.5 text-[10px] text-white/50">
                        <Clock className="h-2.5 w-2.5" />
                        {etaStr}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action button for current stop */}
                {isCurrent && !isDone && (
                  <button
                    onClick={() => openNav(
                      order?.kunde_lat ?? null,
                      order?.kunde_lng ?? null,
                      order?.kunde_adresse ?? null,
                    )}
                    className="mt-2 flex items-center gap-1.5 rounded-lg bg-blue-500/80 hover:bg-blue-500 px-3 py-1.5 text-[11px] font-bold text-white transition-colors"
                  >
                    <Navigation className="h-3 w-3" />
                    Navigation starten
                  </button>
                )}

                {isDone && stop.geliefert_am && (
                  <div className="mt-1 text-[10px] text-matcha-400 font-semibold">
                    Geliefert {new Date(stop.geliefert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
