'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { euro } from '@/lib/utils';
import { AlertCircle, CheckCircle2, Clock, MapPin, Navigation, Phone } from 'lucide-react';

type Stop = {
  id: string;
  order_id: string;
  reihenfolge: number;
  angekommen_am: string | null;
  geliefert_am: string | null;
  order: {
    id: string;
    bestellnummer: string;
    kunde_name: string;
    kunde_adresse: string | null;
    kunde_plz: string | null;
    kunde_telefon: string | null;
    gesamtbetrag: number;
    bezahlt: boolean;
    zahlungsart: string;
    eta_earliest: string | null;
    eta_latest: string | null;
    kunde_notiz: string | null;
    kunde_lieferhinweis: string | null;
  } | null;
};

type ActiveBatch = {
  id: string;
  status: string;
  started_at: string | null;
  stops: Stop[];
};

function EtaChip({ etaLatest }: { etaLatest: string | null }) {
  const [minLeft, setMinLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!etaLatest) return;
    const calc = () => {
      const diff = (new Date(etaLatest).getTime() - Date.now()) / 60_000;
      setMinLeft(Math.max(0, Math.round(diff)));
    };
    calc();
    const t = setInterval(calc, 30_000);
    return () => clearInterval(t);
  }, [etaLatest]);

  if (minLeft === null) return null;
  const color = minLeft <= 5 ? 'bg-red-100 text-red-700' : minLeft <= 15 ? 'bg-amber-100 text-amber-700' : 'bg-matcha-100 text-matcha-700';
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold', color)}>
      <Clock className="w-3 h-3" />
      {minLeft === 0 ? 'Jetzt' : `${minLeft} Min`}
    </span>
  );
}

function openNavigation(address: string) {
  const query = encodeURIComponent(address);
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
    window.open(`maps://maps.apple.com/?q=${query}`);
  } else {
    window.open(`https://maps.google.com/maps?q=${query}`);
  }
}

export function TourStoppPrioritaetsNavigator({ activeBatch, onStopComplete }: {
  activeBatch: ActiveBatch;
  onStopComplete?: (stopId: string) => void;
}) {
  const stops = [...activeBatch.stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const pendingStops = stops.filter(s => !s.geliefert_am);
  const doneStops = stops.filter(s => s.geliefert_am != null);
  const nextStop = pendingStops[0] ?? null;
  const progress = stops.length > 0 ? doneStops.length / stops.length : 0;

  if (stops.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Progress header */}
      <div className="bg-white rounded-2xl shadow-subtle border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-700">Tour-Fortschritt</span>
          <span className="text-xs text-gray-500">{doneStops.length}/{stops.length} Stops</span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-matcha-500 rounded-full transition-all duration-700" style={{ width: `${progress * 100}%` }} />
        </div>
        {pendingStops.length > 0 && (
          <p className="text-xs text-matcha-700 font-semibold mt-2">{pendingStops.length} verbleibend</p>
        )}
        {pendingStops.length === 0 && (
          <p className="text-xs text-matcha-700 font-semibold mt-2 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />Alle Stops erledigt!</p>
        )}
      </div>

      {/* Next stop — highlighted */}
      {nextStop?.order && (
        <div className="bg-matcha-600 text-white rounded-2xl shadow-strong p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center text-xs font-bold">{nextStop.reihenfolge}</span>
                <span className="text-white/80 text-xs font-semibold uppercase tracking-wide">Nächster Stop</span>
              </div>
              <p className="font-bold text-lg leading-tight">{nextStop.order.kunde_name}</p>
              <p className="text-white/80 text-sm">{nextStop.order.kunde_adresse}{nextStop.order.kunde_plz ? `, ${nextStop.order.kunde_plz}` : ''}</p>
            </div>
            <EtaChip etaLatest={nextStop.order.eta_latest} />
          </div>

          {/* Payment info */}
          <div className="flex items-center justify-between bg-white/10 rounded-xl px-3 py-2">
            <span className="text-white/80 text-sm">Betrag</span>
            <span className="font-bold">
              {euro(nextStop.order.gesamtbetrag)}
              {!nextStop.order.bezahlt && (
                <span className="ml-2 text-xs bg-amber-400 text-amber-900 px-2 py-0.5 rounded-full font-semibold">
                  {nextStop.order.zahlungsart === 'karte' ? 'Karte' : 'Bar kassieren'}
                </span>
              )}
              {nextStop.order.bezahlt && <span className="ml-2 text-xs text-green-300">bezahlt</span>}
            </span>
          </div>

          {/* Notes */}
          {(nextStop.order.kunde_notiz || nextStop.order.kunde_lieferhinweis) && (
            <div className="bg-amber-400/20 rounded-xl px-3 py-2 flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-amber-300 flex-shrink-0 mt-0.5" />
              <p className="text-white text-xs leading-snug">{nextStop.order.kunde_lieferhinweis ?? nextStop.order.kunde_notiz}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => nextStop.order?.kunde_adresse && openNavigation(`${nextStop.order.kunde_adresse} ${nextStop.order.kunde_plz ?? ''}`)}
              className="flex-1 flex items-center justify-center gap-1.5 bg-white text-matcha-700 py-2.5 rounded-xl font-semibold text-sm hover:bg-matcha-50 transition-colors">
              <Navigation className="w-4 h-4" />
              Navigation
            </button>
            {nextStop.order.kunde_telefon && (
              <a href={`tel:${nextStop.order.kunde_telefon}`}
                className="flex items-center justify-center gap-1.5 bg-white/20 text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-white/30 transition-colors">
                <Phone className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Upcoming stops */}
      {pendingStops.slice(1).length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-subtle overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Weitere Stops</span>
          </div>
          {pendingStops.slice(1).map((stop, idx) => stop.order && (
            <div key={stop.id} className={cn('flex items-start gap-3 px-4 py-3', idx < pendingStops.slice(1).length - 1 && 'border-b border-gray-50')}>
              <span className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0 mt-0.5">
                {stop.reihenfolge}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-gray-800">{stop.order.kunde_name}</p>
                <p className="text-xs text-gray-500 truncate">{stop.order.kunde_adresse}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <EtaChip etaLatest={stop.order.eta_latest} />
                <p className="text-xs text-gray-500 mt-0.5">{euro(stop.order.gesamtbetrag)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Done stops */}
      {doneStops.length > 0 && (
        <div className="bg-matcha-50 rounded-2xl border border-matcha-100 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-matcha-100">
            <span className="text-xs font-semibold text-matcha-700 uppercase tracking-wide">Erledigt</span>
          </div>
          {doneStops.map((stop, idx) => stop.order && (
            <div key={stop.id} className={cn('flex items-center gap-3 px-4 py-2.5', idx < doneStops.length - 1 && 'border-b border-matcha-100')}>
              <CheckCircle2 className="w-4 h-4 text-matcha-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-matcha-800">{stop.order.kunde_name}</p>
                <p className="text-xs text-matcha-600">{stop.order.kunde_adresse}</p>
              </div>
              <span className="text-xs text-matcha-600">
                {stop.geliefert_am ? new Date(stop.geliefert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
