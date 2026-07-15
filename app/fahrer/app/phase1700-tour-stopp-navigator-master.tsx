'use client';

import { useState } from 'react';
import { MapPin, Navigation, Phone, CheckCircle2, Clock, ChevronDown, ChevronUp, Map } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TourStoppMaster = {
  id: string;
  reihenfolge: number;
  adresse: string;
  name: string | null;
  telefon: string | null;
  lat: number | null;
  lng: number | null;
  eta_min: number | null;
  status: 'offen' | 'unterwegs' | 'erledigt';
  notiz: string | null;
};

type Props = {
  stops: TourStoppMaster[];
  onComplete?: (stopId: string) => void;
};

function openGoogleMaps(addr: string) {
  const q = encodeURIComponent(addr);
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${q}`, '_blank');
}

function openWaze(addr: string) {
  const q = encodeURIComponent(addr);
  window.open(`https://www.waze.com/ul?q=${q}&navigate=yes`, '_blank');
}

export function Phase1700TourStoppNavigatorMaster({ stops, onComplete }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const offen = stops.filter((s) => s.status !== 'erledigt');
  const erledigt = stops.filter((s) => s.status === 'erledigt');

  if (stops.length === 0) return null;

  const current = offen[0] ?? null;
  const next = offen[1] ?? null;

  return (
    <div className="space-y-3">
      {/* Aktueller Stopp */}
      {current && (
        <div className="rounded-2xl border-2 border-matcha-400 bg-matcha-50 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 bg-matcha-500 text-white">
            <Navigation className="h-4 w-4 shrink-0" />
            <span className="text-xs font-black uppercase tracking-wider">Jetzt: Stopp {current.reihenfolge}</span>
            {current.eta_min !== null && (
              <span className="ml-auto text-[10px] font-bold bg-matcha-600 rounded-full px-2 py-0.5">
                ~{current.eta_min} Min
              </span>
            )}
          </div>

          <div className="p-4">
            <div className="flex items-start gap-2 mb-3">
              <MapPin className="h-4 w-4 text-matcha-600 mt-0.5 shrink-0" />
              <div>
                {current.name && <div className="text-sm font-bold">{current.name}</div>}
                <div className="text-sm text-foreground">{current.adresse}</div>
                {current.notiz && (
                  <div className="mt-1 text-[11px] italic text-amber-700 bg-amber-50 rounded-lg px-2 py-1">
                    {current.notiz}
                  </div>
                )}
              </div>
            </div>

            {/* Navigation buttons */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => openGoogleMaps(current.adresse)}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 text-white py-2.5 text-sm font-bold active:scale-95 transition"
              >
                <Map className="h-4 w-4" />
                Google Maps
              </button>
              <button
                onClick={() => openWaze(current.adresse)}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-sky-500 text-white py-2.5 text-sm font-bold active:scale-95 transition"
              >
                <Navigation className="h-4 w-4" />
                Waze
              </button>
            </div>

            <div className="flex gap-2">
              {current.telefon && (
                <a
                  href={`tel:${current.telefon}`}
                  className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-bold text-foreground active:scale-95 transition"
                >
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  Anrufen
                </a>
              )}
              {onComplete && (
                <button
                  onClick={() => onComplete(current.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-matcha-600 text-white py-2 text-sm font-bold active:scale-95 transition"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Abgeschlossen
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Nächster Stopp Preview */}
      {next && (
        <div className="rounded-xl border border-stone-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-100 text-[10px] font-black text-stone-600">
              {next.reihenfolge}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-muted-foreground">Nächster Stopp</div>
              <div className="text-sm font-medium truncate">{next.adresse}</div>
            </div>
            {next.eta_min !== null && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                <Clock className="h-3 w-3" />
                ~{next.eta_min} Min
              </div>
            )}
          </div>
        </div>
      )}

      {/* Alle Stopps Liste */}
      {stops.length > 1 && (
        <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
          <button
            onClick={() => setExpanded(expanded ? null : 'list')}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-muted-foreground hover:bg-stone-50 transition"
          >
            <span>Alle {stops.length} Stopps</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-matcha-600 font-bold">{erledigt.length}/{stops.length} erledigt</span>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </button>

          {expanded && (
            <div className="border-t border-stone-100 divide-y divide-stone-100">
              {stops.map((stop) => (
                <div
                  key={stop.id}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2.5',
                    stop.status === 'erledigt' ? 'opacity-50' : '',
                    stop.id === current?.id ? 'bg-matcha-50' : '',
                  )}
                >
                  <div className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black',
                    stop.status === 'erledigt' ? 'bg-matcha-100 text-matcha-700' :
                    stop.id === current?.id ? 'bg-matcha-500 text-white' :
                    'bg-stone-100 text-stone-600',
                  )}>
                    {stop.status === 'erledigt' ? '✓' : stop.reihenfolge}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={cn('text-sm truncate', stop.status === 'erledigt' ? 'line-through' : 'font-medium')}>
                      {stop.adresse}
                    </div>
                    {stop.name && (
                      <div className="text-[10px] text-muted-foreground">{stop.name}</div>
                    )}
                  </div>
                  {stop.eta_min !== null && stop.status !== 'erledigt' && (
                    <div className="text-[10px] text-muted-foreground shrink-0">~{stop.eta_min}m</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
