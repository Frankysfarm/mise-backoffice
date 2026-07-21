'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, MapPin, Navigation, Phone } from 'lucide-react';

interface TourStop {
  id: string;
  sequence: number;
  address: string;
  customerName: string;
  phone?: string | null;
  eta?: string | null;
  done: boolean;
  orderId: string;
  orderNumber?: string;
}

function fmtMmSs(sec: number) {
  if (sec < 0) return 'überfällig';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m > 60) return `${Math.round(m / 60)}h`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function FahrerPhase2870TourStopSmartKommando({
  stops,
  onConfirm,
  onNavigate,
}: {
  stops: TourStop[];
  onConfirm?: (stopId: string) => void;
  onNavigate?: (address: string) => void;
}) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const pending = stops.filter(s => !s.done).sort((a, b) => a.sequence - b.sequence);
  const done = stops.filter(s => s.done);
  const nextStop = pending[0];

  if (stops.length === 0) return null;

  const now = Date.now();

  function etaSec(etaStr: string | null | undefined): number | null {
    if (!etaStr) return null;
    const diff = (new Date(etaStr).getTime() - now) / 1000;
    return Math.round(diff);
  }

  const nextEtaSec = nextStop?.eta ? etaSec(nextStop.eta) : null;

  return (
    <div className="space-y-3">
      {/* Nächster Stopp - Hero */}
      {nextStop && (
        <div className={cn(
          'rounded-2xl border-2 overflow-hidden',
          nextEtaSec !== null && nextEtaSec < 120
            ? 'border-rose-400 bg-rose-50'
            : nextEtaSec !== null && nextEtaSec < 300
            ? 'border-amber-400 bg-amber-50'
            : 'border-matcha-300 bg-matcha-50',
        )}>
          <div className="px-4 pt-3 pb-1 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className={cn(
                'h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-black text-white',
                nextEtaSec !== null && nextEtaSec < 120 ? 'bg-rose-500' :
                nextEtaSec !== null && nextEtaSec < 300 ? 'bg-amber-500' : 'bg-matcha-600',
              )}>
                {nextStop.sequence}
              </div>
              <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wide">Nächster Stopp</span>
            </div>
            {nextEtaSec !== null && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-stone-400" />
                <span className={cn(
                  'text-[11px] font-black',
                  nextEtaSec < 0 ? 'text-rose-600' : nextEtaSec < 120 ? 'text-rose-600' : 'text-stone-600',
                )}>
                  {fmtMmSs(nextEtaSec)}
                </span>
              </div>
            )}
          </div>

          <div className="px-4 py-2">
            <div className="text-sm font-black text-char leading-tight">{nextStop.customerName}</div>
            <div className="flex items-start gap-1 mt-0.5">
              <MapPin className="h-3 w-3 text-stone-400 mt-0.5 shrink-0" />
              <span className="text-xs text-stone-600 leading-tight">{nextStop.address}</span>
            </div>
            {nextStop.orderNumber && (
              <div className="mt-1 text-[10px] text-stone-400">Bestellung #{nextStop.orderNumber}</div>
            )}
          </div>

          <div className="flex gap-2 px-4 pb-3">
            <button
              onClick={() => onNavigate?.(nextStop.address)}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-matcha-600 py-2.5 text-xs font-bold text-white active:bg-matcha-700"
            >
              <Navigation className="h-3.5 w-3.5" />
              Navigation starten
            </button>
            {nextStop.phone && (
              <a
                href={`tel:${nextStop.phone}`}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100 text-stone-600 active:bg-stone-200 shrink-0"
              >
                <Phone className="h-4 w-4" />
              </a>
            )}
          </div>

          <button
            onClick={() => onConfirm?.(nextStop.id)}
            className="w-full flex items-center justify-center gap-2 bg-matcha-700 py-3 text-sm font-black text-white active:bg-matcha-800"
          >
            <CheckCircle2 className="h-4 w-4" />
            Lieferung bestätigen
          </button>
        </div>
      )}

      {/* Restliche Stopps */}
      {pending.slice(1).length > 0 && (
        <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
          <div className="px-4 py-2 border-b border-stone-100">
            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wide">Weitere Stopps</span>
          </div>
          <div className="divide-y divide-stone-100">
            {pending.slice(1).map(s => {
              const sec = s.eta ? etaSec(s.eta) : null;
              return (
                <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="h-5 w-5 rounded-full bg-stone-200 flex items-center justify-center text-[10px] font-black text-stone-500 shrink-0">
                    {s.sequence}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-char truncate">{s.customerName}</div>
                    <div className="text-[10px] text-stone-400 truncate">{s.address}</div>
                  </div>
                  {sec !== null && (
                    <span className="text-[10px] font-semibold text-stone-500 shrink-0">{fmtMmSs(sec)}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Erledigte Stopps */}
      {done.length > 0 && (
        <div className="flex items-center gap-2 px-1">
          <CheckCircle2 className="h-3.5 w-3.5 text-matcha-500" />
          <span className="text-[11px] text-stone-400">{done.length} Stopp{done.length !== 1 ? 's' : ''} erledigt</span>
          <div className="flex-1 h-px bg-stone-100" />
        </div>
      )}
    </div>
  );
}
