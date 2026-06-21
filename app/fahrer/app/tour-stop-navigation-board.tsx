'use client';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, Clock, Navigation, CheckCircle2, Euro, CreditCard } from 'lucide-react';

type StopOrder = {
  id: string;
  bestellnummer: string;
  kunde_name: string;
  kunde_adresse: string | null;
  kunde_plz: string | null;
  kunde_lat: number | null;
  kunde_lng: number | null;
  gesamtbetrag: number;
  zahlungsart?: string | null;
  bezahlt?: boolean | null;
};

type Stop = {
  id: string;
  batch_id: string;
  order_id: string;
  reihenfolge: number;
  angekommen_am: string | null;
  geliefert_am: string | null;
  distanz_zum_vorgaenger_m?: number | null;
  order: StopOrder;
};

type Props = {
  stops: Stop[];
  batchStartedAt: string | null;
  totalEtaMin: number | null;
};

function formatDistance(m: number | null | undefined): string {
  if (!m) return '';
  if (m < 1000) return `${m}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

function openNav(lat: number, lng: number, label: string) {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${encodeURIComponent(label)}&travelmode=driving`;
  window.open(url, '_blank');
}

export function TourStopNavigationBoard({ stops, batchStartedAt, totalEtaMin }: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(iv);
  }, []);

  const sortedStops = [...stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  if (sortedStops.length === 0) return null;

  const completedCount = sortedStops.filter(s => s.geliefert_am).length;
  const remainingCount = sortedStops.length - completedCount;

  // Estimate per-stop ETA based on total batch ETA split evenly
  const perStopEtaMin = totalEtaMin && remainingCount > 0
    ? Math.round(totalEtaMin / Math.max(1, sortedStops.length))
    : null;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-bold text-white">Tour-Stopps</span>
        <span className="text-xs text-blue-300">{completedCount}/{sortedStops.length} geliefert</span>
      </div>

      {/* Stop list */}
      <div className="space-y-2">
        {sortedStops.map((stop, idx) => {
          const done = !!stop.geliefert_am;
          const isCurrent = !done && idx === completedCount;
          const order = stop.order;
          const isCash = order.zahlungsart === 'bar' && !order.bezahlt;
          const isCard = order.zahlungsart === 'ec' || order.zahlungsart === 'karte';

          return (
            <div
              key={stop.id}
              className={cn(
                'rounded-2xl p-4 space-y-2 transition-all',
                done ? 'bg-white/5 opacity-50' : isCurrent ? 'bg-blue-600/30 border border-blue-400/50' : 'bg-white/10',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black',
                    done ? 'bg-matcha-500 text-white' : isCurrent ? 'bg-blue-500 text-white' : 'bg-white/20 text-white',
                  )}>
                    {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : stop.reihenfolge}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{order.kunde_name}</div>
                    <div className="text-xs text-blue-200 truncate">{order.kunde_adresse}{order.kunde_plz ? `, ${order.kunde_plz}` : ''}</div>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-black text-white tabular-nums">{order.gesamtbetrag.toFixed(2)} €</div>
                  <div className={cn('text-[10px] font-semibold', isCash ? 'text-amber-300' : isCard ? 'text-blue-300' : 'text-matcha-300')}>
                    {isCash ? '💵 Bar kassieren' : isCard ? '💳 EC-Karte' : '✓ Bezahlt'}
                  </div>
                </div>
              </div>

              {/* Meta row */}
              <div className="flex items-center gap-3 text-[10px] text-blue-200">
                {stop.distanz_zum_vorgaenger_m && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-2.5 w-2.5" />{formatDistance(stop.distanz_zum_vorgaenger_m)}
                  </span>
                )}
                {perStopEtaMin && !done && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" />~{perStopEtaMin * (idx - completedCount + 1)} Min
                  </span>
                )}
              </div>

              {/* Nav button for current stop */}
              {isCurrent && order.kunde_lat && order.kunde_lng && (
                <button
                  onClick={() => openNav(order.kunde_lat!, order.kunde_lng!, order.kunde_adresse ?? '')}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-500 py-2.5 text-sm font-bold text-white hover:bg-blue-400 active:bg-blue-600 transition-colors"
                >
                  <Navigation className="h-4 w-4" />
                  Navigation starten
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
