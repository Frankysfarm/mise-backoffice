'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, MapPin, Navigation, Phone, StickyNote, Package } from 'lucide-react';

type Stop = {
  id: string;
  reihenfolge: number;
  angekommen_am: string | null;
  geliefert_am: string | null;
  order: {
    id: string;
    bestellnummer: string;
    kunde_name: string;
    kunde_adresse: string | null;
    kunde_plz: string | null;
    gesamtbetrag: number;
    kunde_notiz?: string | null;
    kunde_lieferhinweis?: string | null;
    kunde_telefon?: string | null;
  };
};

interface Props {
  stops: Stop[];
  batchStartedAt: string | null;
  onMarkDelivered?: (stopId: string) => void;
  onMarkArrived?: (stopId: string) => void;
}

function fmtEur(n: number) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function elapsedSec(iso: string | null): number {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
}

export function TourAktuellerStopFokus({ stops, batchStartedAt, onMarkDelivered, onMarkArrived }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 1_000);
    return () => clearInterval(iv);
  }, []);

  const pending = stops
    .filter(s => !s.geliefert_am)
    .sort((a, b) => a.reihenfolge - b.reihenfolge);

  if (pending.length === 0) return null;

  const current = pending[0];
  const nextStop = pending[1] ?? null;
  const order = current.order;

  const hasArrived = !!current.angekommen_am;
  const arrivedSec = hasArrived ? elapsedSec(current.angekommen_am) : null;
  const completedCount = stops.filter(s => s.geliefert_am).length;
  const totalCount = stops.length;

  const navUrl = order.kunde_adresse
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((order.kunde_adresse ?? '') + ' ' + (order.kunde_plz ?? ''))}`
    : null;

  const wazeUrl = order.kunde_adresse
    ? `https://waze.com/ul?q=${encodeURIComponent((order.kunde_adresse ?? '') + ' ' + (order.kunde_plz ?? ''))}&navigate=yes`
    : null;

  return (
    <div className="space-y-3">
      {/* Progress indicator */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1.5">
          {stops.map((s, i) => (
            <div
              key={s.id}
              className={cn(
                'h-2 rounded-full transition-all duration-300',
                s.geliefert_am ? 'bg-matcha-500 w-4' :
                s.id === current.id ? 'bg-white w-6 animate-pulse' :
                'bg-white/30 w-2',
              )}
            />
          ))}
        </div>
        <span className="text-[10px] font-bold text-white/60 ml-auto">
          {completedCount}/{totalCount} Stopps
        </span>
      </div>

      {/* Current stop card */}
      <div className="rounded-2xl bg-white/10 border border-white/20 overflow-hidden">
        {/* Stop header */}
        <div className={cn(
          'px-4 py-3 flex items-center gap-3',
          hasArrived ? 'bg-matcha-500/30' : 'bg-white/10',
        )}>
          <div className={cn(
            'h-10 w-10 rounded-xl flex items-center justify-center font-black text-lg',
            hasArrived ? 'bg-matcha-500 text-white' : 'bg-white/20 text-white',
          )}>
            {completedCount + 1}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white font-bold truncate">{order.kunde_name}</div>
            <div className="text-white/60 text-[10px] font-mono">#{order.bestellnummer}</div>
          </div>
          {hasArrived && arrivedSec !== null && (
            <div className="shrink-0 text-right">
              <div className="text-matcha-300 text-[10px] font-semibold">Angekommen</div>
              <div className="text-white/70 text-[11px] tabular-nums font-mono">
                {Math.floor(arrivedSec / 60)}:{String(arrivedSec % 60).padStart(2, '0')} vor
              </div>
            </div>
          )}
        </div>

        {/* Address */}
        <div className="px-4 py-3 border-b border-white/10">
          <div className="flex items-start gap-2.5">
            <MapPin size={14} className="text-white/50 shrink-0 mt-0.5" />
            <div>
              <div className="text-white font-semibold text-sm leading-snug">
                {order.kunde_adresse ?? '—'}
              </div>
              {order.kunde_plz && (
                <div className="text-white/60 text-[11px] mt-0.5">{order.kunde_plz}</div>
              )}
            </div>
          </div>

          {(order.kunde_notiz || order.kunde_lieferhinweis) && (
            <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-500/20 border border-amber-400/30 px-3 py-2">
              <StickyNote size={12} className="text-amber-300 shrink-0 mt-0.5" />
              <div className="text-amber-200 text-[11px] leading-snug">
                {order.kunde_lieferhinweis ?? order.kunde_notiz}
              </div>
            </div>
          )}
        </div>

        {/* Betrag + Navigation */}
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="flex-1">
            <div className="text-white/50 text-[10px]">Betrag</div>
            <div className="text-white font-black text-lg">{fmtEur(order.gesamtbetrag)}</div>
          </div>

          {navUrl && (
            <a
              href={navUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-xl bg-blue-500 px-3 py-2 text-white text-[11px] font-bold active:scale-95 transition"
            >
              <Navigation size={12} /> Maps
            </a>
          )}
          {wazeUrl && (
            <a
              href={wazeUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-xl bg-blue-600/50 border border-blue-400/50 px-3 py-2 text-white text-[11px] font-bold active:scale-95 transition"
            >
              <Navigation size={12} /> Waze
            </a>
          )}
          {order.kunde_telefon && (
            <a
              href={`tel:${order.kunde_telefon}`}
              className="flex items-center justify-center h-9 w-9 rounded-xl bg-white/10 border border-white/20 text-white active:scale-95 transition"
            >
              <Phone size={14} />
            </a>
          )}
        </div>

        {/* Action buttons */}
        <div className="px-4 pb-4 grid grid-cols-2 gap-2">
          {!hasArrived && onMarkArrived && (
            <button
              onClick={() => onMarkArrived(current.id)}
              className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-white font-bold text-sm active:scale-95 transition"
            >
              <MapPin size={15} /> Angekommen
            </button>
          )}
          {onMarkDelivered && (
            <button
              onClick={() => onMarkDelivered(current.id)}
              className={cn(
                'flex items-center justify-center gap-2 rounded-xl py-3 text-white font-bold text-sm active:scale-95 transition',
                hasArrived ? 'bg-matcha-500 col-span-2' : 'bg-matcha-600',
              )}
            >
              <CheckCircle2 size={15} /> Geliefert
            </button>
          )}
        </div>
      </div>

      {/* Next stop preview */}
      {nextStop && (
        <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 flex items-center gap-3">
          <Package size={14} className="text-white/30 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-white/40 text-[10px] font-bold uppercase tracking-wider">Nächster Stopp</div>
            <div className="text-white/70 text-sm font-semibold truncate">{nextStop.order.kunde_name}</div>
            <div className="text-white/40 text-[10px] truncate">{nextStop.order.kunde_adresse ?? '—'}</div>
          </div>
          <div className="shrink-0 text-white/30 text-xs font-bold">#{completedCount + 2}</div>
        </div>
      )}
    </div>
  );
}
