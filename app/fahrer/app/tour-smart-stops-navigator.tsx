'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapPin, Navigation, Clock, CheckCircle2, Circle, ChevronRight, Phone, AlertCircle, Bike } from 'lucide-react';

export type StopState = 'ausstehend' | 'aktiv' | 'geliefert' | 'problem';

export interface SmartStop {
  stop_id: string;
  order_number: string;
  position: number;
  adresse: string;
  adresse_kurz: string;
  eta_min: number | null;
  kundenname: string;
  kunden_tel: string | null;
  besonderes: string | null;
  status: StopState;
  lieferzeit_min: number | null;
  google_maps_url: string | null;
  apple_maps_url: string | null;
}

interface Props {
  stops?: SmartStop[];
  onStopSelect?: (stopId: string) => void;
  className?: string;
}

const DEMO_STOPS: SmartStop[] = [
  {
    stop_id: 's1', order_number: '#1041', position: 1,
    adresse: 'Pontstraße 42, 52062 Aachen', adresse_kurz: 'Pontstr. 42',
    eta_min: 4, kundenname: 'Max M.', kunden_tel: '+49 160 123', besonderes: 'Klingel 3. Stock',
    status: 'aktiv', lieferzeit_min: null,
    google_maps_url: 'https://maps.google.com/?q=Pontstra%C3%9Fe+42+Aachen',
    apple_maps_url: 'maps://maps.apple.com/?q=Pontstra%C3%9Fe+42+Aachen',
  },
  {
    stop_id: 's2', order_number: '#1042', position: 2,
    adresse: 'Ludwigstraße 7, 52064 Aachen', adresse_kurz: 'Ludwigstr. 7',
    eta_min: 12, kundenname: 'Sara K.', kunden_tel: null, besonderes: null,
    status: 'ausstehend', lieferzeit_min: null,
    google_maps_url: 'https://maps.google.com/?q=Ludwigstra%C3%9Fe+7+Aachen',
    apple_maps_url: null,
  },
  {
    stop_id: 's3', order_number: '#1040', position: 0,
    adresse: 'Kaiserplatz 3, 52062 Aachen', adresse_kurz: 'Kaiserpl. 3',
    eta_min: null, kundenname: 'Tim B.', kunden_tel: null, besonderes: null,
    status: 'geliefert', lieferzeit_min: 21,
    google_maps_url: null, apple_maps_url: null,
  },
];

const statusConfig: Record<StopState, { dot: string; bg: string; label: string; icon: React.ReactNode }> = {
  geliefert: { dot: 'bg-emerald-500', bg: 'bg-emerald-50 border-emerald-200', label: 'Geliefert', icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" /> },
  aktiv: { dot: 'bg-blue-500 animate-pulse', bg: 'bg-blue-50 border-blue-300 shadow-sm', label: 'Aktiv', icon: <Navigation className="w-4 h-4 text-blue-500" /> },
  ausstehend: { dot: 'bg-gray-300', bg: 'bg-white border-gray-200', label: 'Ausstehend', icon: <Circle className="w-4 h-4 text-gray-400" /> },
  problem: { dot: 'bg-red-500', bg: 'bg-red-50 border-red-300', label: 'Problem', icon: <AlertCircle className="w-4 h-4 text-red-500" /> },
};

export function TourSmartStopsNavigator({ stops = DEMO_STOPS, onStopSelect, className }: Props) {
  const sorted = [...stops].sort((a, b) => a.position - b.position);
  const aktiv = sorted.find((s) => s.status === 'aktiv');
  const ausstehend = sorted.filter((s) => s.status === 'ausstehend');
  const geliefert = sorted.filter((s) => s.status === 'geliefert');

  const [expandedStop, setExpandedStop] = useState<string | null>(aktiv?.stop_id ?? null);

  useEffect(() => {
    if (aktiv) setExpandedStop(aktiv.stop_id);
  }, [aktiv?.stop_id]);

  return (
    <div className={`space-y-2 ${className ?? ''}`}>
      {/* Progress summary */}
      <div className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
        <div className="flex items-center gap-2">
          <Bike className="w-4 h-4 text-blue-500" />
          <span className="text-xs font-semibold text-gray-800">
            {geliefert.length}/{sorted.length} Stopps
          </span>
        </div>
        <div className="flex gap-1">
          {sorted.map((s) => (
            <div
              key={s.stop_id}
              className={`w-2.5 h-2.5 rounded-full ${statusConfig[s.status].dot}`}
            />
          ))}
        </div>
        {aktiv?.eta_min !== null && aktiv?.eta_min !== undefined && (
          <div className="flex items-center gap-1 text-xs text-blue-600 font-semibold">
            <Clock className="w-3.5 h-3.5" />
            <span>{aktiv.eta_min} min</span>
          </div>
        )}
      </div>

      {/* Stop list */}
      {sorted.map((stop) => {
        const cfg = statusConfig[stop.status];
        const isExpanded = expandedStop === stop.stop_id;

        return (
          <div
            key={stop.stop_id}
            className={`rounded-xl border overflow-hidden transition-all ${cfg.bg}`}
          >
            <button
              className="w-full text-left px-3 py-2.5 flex items-center gap-3"
              onClick={() => {
                setExpandedStop(isExpanded ? null : stop.stop_id);
                onStopSelect?.(stop.stop_id);
              }}
            >
              {/* Position indicator */}
              <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                {cfg.icon}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900">{stop.order_number}</span>
                  <span className="text-[11px] text-gray-500 truncate">{stop.adresse_kurz}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-gray-600">{stop.kundenname}</span>
                  {stop.besonderes && (
                    <span className="text-[10px] text-amber-600 bg-amber-50 px-1 rounded">{stop.besonderes}</span>
                  )}
                  {stop.lieferzeit_min !== null && (
                    <span className="text-[10px] text-emerald-600 ml-auto">✓ {stop.lieferzeit_min} min</span>
                  )}
                </div>
              </div>

              <div className="flex-shrink-0">
                {stop.eta_min !== null && stop.status !== 'geliefert' && (
                  <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{stop.eta_min} min</span>
                )}
                <ChevronRight className={`w-4 h-4 text-gray-400 ml-1 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
              </div>
            </button>

            {/* Expanded: Navigation buttons */}
            {isExpanded && stop.status !== 'geliefert' && (
              <div className="px-3 pb-3 space-y-2 border-t border-gray-100/60">
                <div className="text-[11px] text-gray-500 mt-2 flex items-start gap-1">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-gray-400" />
                  <span>{stop.adresse}</span>
                </div>

                <div className="flex gap-2">
                  {stop.google_maps_url && (
                    <a
                      href={stop.google_maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg active:bg-blue-700 transition-colors"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      Google Maps
                    </a>
                  )}
                  {stop.apple_maps_url && (
                    <a
                      href={stop.apple_maps_url}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-gray-800 text-white text-xs font-semibold rounded-lg active:bg-gray-900 transition-colors"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      Apple Maps
                    </a>
                  )}
                  {stop.kunden_tel && (
                    <a
                      href={`tel:${stop.kunden_tel}`}
                      className="flex items-center justify-center gap-1 py-2 px-3 bg-emerald-600 text-white text-xs font-semibold rounded-lg active:bg-emerald-700 transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {ausstehend.length === 0 && geliefert.length > 0 && (
        <div className="text-center py-3 text-sm text-emerald-600 font-semibold bg-emerald-50 rounded-xl border border-emerald-200">
          <CheckCircle2 className="w-5 h-5 inline mr-1.5" />
          Tour abgeschlossen!
        </div>
      )}
    </div>
  );
}
