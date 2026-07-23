'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapPin, Phone, CheckCircle2, Clock, Navigation, ChevronDown, ChevronUp, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { euro } from '@/lib/utils';

interface Stop {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  angekommen_am: string | null;
  order: {
    bestellnummer: string;
    kunde_name: string;
    kunde_adresse: string | null;
    kunde_plz: string | null;
    kunde_lat: number | null;
    kunde_lng: number | null;
    gesamtbetrag: number;
    zahlungsart?: string;
    bezahlt?: boolean;
    kunde_notiz?: string | null;
    kunde_telefon?: string | null;
  };
  eta_min?: number | null;
}

interface Props {
  stops: Stop[];
  driverLat?: number | null;
  driverLng?: number | null;
}

function openNav(lat: number | null, lng: number | null, address: string | null) {
  if (lat && lng) {
    window.open(`https://maps.google.com/?daddr=${lat},${lng}`, '_blank');
  } else if (address) {
    window.open(`https://maps.google.com/?daddr=${encodeURIComponent(address)}`, '_blank');
  }
}

function StatusDot({ stop }: { stop: Stop }) {
  if (stop.geliefert_am) return <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />;
  if (stop.angekommen_am) return <div className="w-5 h-5 rounded-full bg-amber-400 shrink-0 flex items-center justify-center"><Clock className="w-3 h-3 text-white" /></div>;
  return <div className="w-5 h-5 rounded-full border-2 border-blue-400 bg-blue-50 shrink-0 flex items-center justify-center text-[10px] font-bold text-blue-600">{stop.reihenfolge}</div>;
}

export function FahrerPhase3553TourStopsNavigatorMaster({ stops, driverLat, driverLng }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (!stops || stops.length === 0) return null;

  const nextStop = stops.find(s => !s.geliefert_am);
  const doneCount = stops.filter(s => !!s.geliefert_am).length;
  const progressPct = Math.round((doneCount / stops.length) * 100);

  return (
    <div className="rounded-2xl bg-gray-900 text-white overflow-hidden shadow-xl">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-400" />
            <span className="font-bold text-base">Tour-Stops</span>
          </div>
          <span className="text-xs text-gray-400">{doneCount}/{stops.length} geliefert</span>
        </div>

        {/* Progress Bar */}
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Next Stop Hero */}
      {nextStop && (
        <div className="mx-3 mb-3 rounded-xl bg-blue-600 p-3">
          <div className="text-[10px] uppercase tracking-wide text-blue-200 mb-1">Nächster Stopp</div>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="font-bold text-base">{nextStop.order.kunde_name}</div>
              <div className="text-sm text-blue-200 truncate">{nextStop.order.kunde_adresse}</div>
              {nextStop.order.kunde_plz && (
                <div className="text-xs text-blue-300">{nextStop.order.kunde_plz}</div>
              )}
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs font-bold bg-blue-500/60 rounded px-1.5 py-0.5">
                  {euro(nextStop.order.gesamtbetrag)}
                </span>
                {nextStop.order.bezahlt === false && (
                  <span className="text-xs text-amber-300 font-semibold">Bar kassieren</span>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <button
                onClick={() => openNav(nextStop.order.kunde_lat, nextStop.order.kunde_lng, nextStop.order.kunde_adresse)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white text-blue-700 rounded-xl text-xs font-bold hover:bg-blue-50 transition-colors"
              >
                <Navigation className="w-3.5 h-3.5" /> Navi
              </button>
              {nextStop.order.kunde_telefon && (
                <a
                  href={`tel:${nextStop.order.kunde_telefon}`}
                  className="flex items-center gap-1.5 px-3 py-2 bg-blue-500/60 rounded-xl text-xs font-semibold hover:bg-blue-500/80 transition-colors text-center justify-center"
                >
                  <Phone className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>

          {/* Customer note */}
          {nextStop.order.kunde_notiz && (
            <div className="mt-2 text-xs text-blue-200 bg-blue-500/40 rounded-lg px-2 py-1.5">
              📝 {nextStop.order.kunde_notiz}
            </div>
          )}

          {/* ETA */}
          {nextStop.eta_min != null && (
            <div className="mt-2 flex items-center gap-1 text-xs text-blue-200">
              <Clock className="w-3 h-3" />
              ETA: ca. {nextStop.eta_min} Min
            </div>
          )}
        </div>
      )}

      {/* All Stops List */}
      <div className="divide-y divide-gray-800">
        {stops.map(stop => {
          const isDone = !!stop.geliefert_am;
          const isNext = stop.id === nextStop?.id;
          const isOpen = expanded === stop.id;

          return (
            <div key={stop.id} className={cn(isNext ? 'hidden' : '', isDone ? 'opacity-50' : '')}>
              <button
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800/50 transition-colors text-left"
                onClick={() => setExpanded(isOpen ? null : stop.id)}
              >
                <StatusDot stop={stop} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn('text-sm font-semibold', isDone ? 'line-through text-gray-500' : '')}>
                      {stop.order.kunde_name}
                    </span>
                    <span className="text-xs text-gray-400 shrink-0">{euro(stop.order.gesamtbetrag)}</span>
                  </div>
                  <div className="text-xs text-gray-400 truncate">{stop.order.kunde_adresse}</div>
                </div>
                {!isDone && (
                  isOpen ? <ChevronUp className="w-4 h-4 text-gray-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
                )}
              </button>

              {isOpen && !isDone && (
                <div className="px-4 pb-3 bg-gray-800/30 flex items-center gap-2">
                  <button
                    onClick={() => openNav(stop.order.kunde_lat, stop.order.kunde_lng, stop.order.kunde_adresse)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 rounded-lg text-xs font-semibold hover:bg-blue-500 transition-colors"
                  >
                    <Navigation className="w-3 h-3" /> Navigieren
                  </button>
                  {stop.order.kunde_telefon && (
                    <a
                      href={`tel:${stop.order.kunde_telefon}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-600 transition-colors"
                    >
                      <Phone className="w-3 h-3" /> Anrufen
                    </a>
                  )}
                  {stop.order.bezahlt === false && (
                    <span className="text-xs text-amber-300 font-semibold ml-auto">Bar: {euro(stop.order.gesamtbetrag)}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {doneCount === stops.length && (
        <div className="p-4 text-center">
          <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-1" />
          <div className="text-green-400 font-bold">Tour abgeschlossen! 🎉</div>
        </div>
      )}
    </div>
  );
}
