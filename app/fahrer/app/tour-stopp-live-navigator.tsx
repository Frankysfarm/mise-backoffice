'use client';

import { useState, useEffect } from 'react';
import {
  MapPin,
  Navigation,
  Phone,
  Package,
  Clock,
  CheckCircle2,
  User,
  Euro,
} from 'lucide-react';
import { cn, euro } from '@/lib/utils';

type TourStop = {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: {
    id: string;
    bestellnummer: string;
    kunde_name: string;
    kunde_adresse: string;
    kunde_plz: string;
    kunde_lat: number | null;
    kunde_lng: number | null;
    gesamtbetrag: number;
    zahlungsart: string;
    bezahlt: boolean;
    kunde_telefon: string | null;
    eta_earliest: string | null;
    eta_latest: string | null;
    kunde_notiz: string | null;
  } | null;
};

function useEtaCountdown(etaEarliest: string | null) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!etaEarliest) {
      setSecondsLeft(null);
      return;
    }

    const target = new Date(etaEarliest).getTime();

    const tick = () => {
      const diff = Math.floor((target - Date.now()) / 1000);
      setSecondsLeft(diff);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [etaEarliest]);

  return secondsLeft;
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return 'Jetzt';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function openGoogleMaps(order: NonNullable<TourStop['order']>) {
  const base = 'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=';
  if (order.kunde_lat != null && order.kunde_lng != null) {
    window.open(`${base}${order.kunde_lat},${order.kunde_lng}`, '_blank');
  } else {
    const addr = encodeURIComponent(`${order.kunde_adresse}, ${order.kunde_plz}`);
    window.open(`${base}${addr}`, '_blank');
  }
}

function CurrentStopCard({ stop, totalCount }: { stop: TourStop; totalCount: number }) {
  const order = stop.order;
  const secondsLeft = useEtaCountdown(order?.eta_earliest ?? null);

  if (!order) return null;

  const isLate = secondsLeft !== null && secondsLeft < 0;

  return (
    <div className="rounded-2xl bg-[#4a7c59]/20 border border-[#6aab7c]/40 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-[#8fcca0]">
          Stop {stop.reihenfolge} von {totalCount}
        </span>
        {order.bezahlt ? (
          <span className="flex items-center gap-1 text-xs text-[#8fcca0] font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Bezahlt
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-amber-400 font-medium">
            <Euro className="w-3.5 h-3.5" />
            {order.zahlungsart === 'bar' ? 'Barzahlung' : order.zahlungsart}
          </span>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-[#8fcca0] shrink-0" />
          <span className="text-white font-bold text-lg leading-tight">{order.kunde_name}</span>
        </div>
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-[#8fcca0] shrink-0 mt-0.5" />
          <span className="text-neutral-300 text-sm">
            {order.kunde_adresse}, {order.kunde_plz}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 bg-neutral-800 rounded-xl px-3 py-1.5">
          <Package className="w-4 h-4 text-[#8fcca0]" />
          <span className="text-white font-bold text-base">{euro(order.gesamtbetrag)}</span>
        </div>

        {secondsLeft !== null && (
          <div
            className={cn(
              'flex items-center gap-1.5 rounded-xl px-3 py-1.5',
              isLate ? 'bg-red-900/40 border border-red-600/40' : 'bg-neutral-800'
            )}
          >
            <Clock className={cn('w-4 h-4', isLate ? 'text-red-400' : 'text-[#8fcca0]')} />
            <span className={cn('font-mono font-bold text-sm', isLate ? 'text-red-400' : 'text-white')}>
              {isLate ? 'Überfällig' : formatCountdown(secondsLeft)}
            </span>
          </div>
        )}
      </div>

      {order.kunde_notiz && (
        <div className="bg-amber-950/40 border border-amber-600/30 rounded-xl px-3 py-2 text-amber-300 text-sm">
          <span className="font-semibold text-amber-400">Hinweis: </span>
          {order.kunde_notiz}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => openGoogleMaps(order)}
          className="flex-1 flex items-center justify-center gap-2 bg-[#4a7c59] hover:bg-[#5a9c6e] active:scale-95 transition-all rounded-xl py-3 text-white font-bold text-base"
        >
          <Navigation className="w-5 h-5" />
          Navigieren
        </button>

        {order.kunde_telefon && (
          <a
            href={`tel:${order.kunde_telefon}`}
            className="flex items-center justify-center gap-2 bg-neutral-700 hover:bg-neutral-600 active:scale-95 transition-all rounded-xl px-4 py-3 text-white font-semibold"
          >
            <Phone className="w-5 h-5" />
          </a>
        )}
      </div>
    </div>
  );
}

function RemainingStopRow({ stop, index }: { stop: TourStop; index: number }) {
  const order = stop.order;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-neutral-800 last:border-0">
      <div className="w-6 h-6 rounded-full bg-neutral-700 flex items-center justify-center text-xs font-bold text-neutral-300 shrink-0">
        {stop.reihenfolge}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-neutral-200 text-sm font-medium truncate">
          {order ? order.kunde_name : '—'}
        </p>
        {order && (
          <p className="text-neutral-500 text-xs truncate">
            {order.kunde_adresse}, {order.kunde_plz}
          </p>
        )}
      </div>
      {order && (
        <span className="text-neutral-400 text-sm shrink-0">{euro(order.gesamtbetrag)}</span>
      )}
    </div>
  );
}

export function TourStoppLiveNavigator({
  stops,
  currentStopIndex,
}: {
  stops: TourStop[];
  currentStopIndex: number;
}) {
  if (!stops || stops.length === 0) return null;

  const pendingStops = stops.filter((s) => !s.geliefert_am);
  const currentStop = pendingStops[currentStopIndex] ?? pendingStops[0];

  if (!currentStop) return null;

  const remainingStops = pendingStops.filter((s) => s.id !== currentStop.id);
  const deliveredCount = stops.length - pendingStops.length;
  const totalCount = stops.length;

  return (
    <div className="bg-neutral-900 min-h-screen p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-[#8fcca0]" />
          <h1 className="text-white font-bold text-lg">Jetzt liefern</h1>
        </div>
        <div className="flex items-center gap-1.5 bg-neutral-800 rounded-full px-3 py-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#8fcca0]" />
          <span className="text-neutral-300 text-xs font-medium">
            {deliveredCount}/{totalCount} geliefert
          </span>
        </div>
      </div>

      <div className="w-full bg-neutral-800 rounded-full h-1.5">
        <div
          className="bg-[#6aab7c] h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${(deliveredCount / totalCount) * 100}%` }}
        />
      </div>

      <CurrentStopCard stop={currentStop} totalCount={totalCount} />

      {remainingStops.length > 0 && (
        <div className="bg-neutral-800/50 rounded-2xl px-4 py-1">
          <p className="text-neutral-500 text-xs font-semibold uppercase tracking-wider pt-3 pb-1">
            Weitere Stopps ({remainingStops.length})
          </p>
          {remainingStops.map((stop, i) => (
            <RemainingStopRow key={stop.id} stop={stop} index={i} />
          ))}
        </div>
      )}

      {pendingStops.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
          <CheckCircle2 className="w-12 h-12 text-[#8fcca0]" />
          <p className="text-white font-bold text-xl">Tour abgeschlossen!</p>
          <p className="text-neutral-400 text-sm">Alle {totalCount} Stopps wurden geliefert.</p>
        </div>
      )}
    </div>
  );
}
