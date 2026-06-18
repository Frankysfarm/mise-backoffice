'use client';

import { cn } from '@/lib/utils';
import { Navigation, Phone, MapPin } from 'lucide-react';

interface StopOrder {
  bestellnummer: string;
  kunde_name: string;
  kunde_adresse: string | null;
  kunde_lat: number | null;
  kunde_lng: number | null;
  kunde_telefon: string | null;
}

interface Stop {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: StopOrder;
}

interface FahrerNaviStripProps {
  stops: Stop[];
  currentStopIdx: number;
}

function buildMapsUrl(stop: Stop): string {
  const { kunde_lat, kunde_lng, kunde_adresse } = stop.order;
  if (kunde_lat && kunde_lng) {
    return `https://www.google.com/maps/dir/?api=1&destination=${kunde_lat},${kunde_lng}`;
  }
  if (kunde_adresse) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(kunde_adresse)}`;
  }
  return '#';
}

export function FahrerNaviStrip({ stops, currentStopIdx }: FahrerNaviStripProps) {
  const sorted = [...stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const undelivered = sorted.filter(s => s.geliefert_am === null);
  const nextStop = undelivered[0] ?? null;
  const upcomingStops = undelivered.slice(1, 4);

  if (!nextStop) {
    return (
      <div className="rounded-lg bg-zinc-900 text-white px-4 py-4 text-center text-sm">
        Alle Stops abgeschlossen
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-zinc-900 overflow-hidden">
      <div className="px-4 pt-3 pb-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Nächster Stop</span>
      </div>

      <div className="px-4 pb-3">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <div className="text-white font-bold text-base leading-tight truncate">
              {nextStop.order.kunde_name}
            </div>
            {nextStop.order.kunde_adresse && (
              <div className="flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3 text-zinc-400 shrink-0" />
                <span className="text-zinc-300 text-xs truncate">{nextStop.order.kunde_adresse}</span>
              </div>
            )}
            <div className="text-[10px] text-zinc-500 mt-0.5">#{nextStop.order.bestellnummer}</div>
          </div>
        </div>

        <div className="flex gap-2">
          <a
            href={buildMapsUrl(nextStop)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-lg py-2.5 text-sm font-bold transition-colors"
          >
            <Navigation className="h-4 w-4" />
            Maps öffnen
          </a>

          {nextStop.order.kunde_telefon && (
            <a
              href={`tel:${nextStop.order.kunde_telefon}`}
              className="flex items-center justify-center gap-1.5 bg-zinc-700 hover:bg-zinc-600 active:bg-zinc-800 text-white rounded-lg px-4 py-2.5 text-sm font-bold transition-colors"
            >
              <Phone className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>

      {upcomingStops.length > 0 && (
        <div className="border-t border-zinc-800 px-4 py-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
            Weitere Stops ({upcomingStops.length})
          </div>
          <div className="space-y-1">
            {upcomingStops.map((stop, i) => (
              <div key={stop.id} className="flex items-center gap-2">
                <span className="text-[10px] font-black text-zinc-500 w-4 shrink-0">{i + 2}</span>
                <span className="text-xs text-zinc-300 truncate">{stop.order.kunde_name}</span>
                {stop.order.kunde_adresse && (
                  <span className="text-[10px] text-zinc-500 truncate hidden sm:block">{stop.order.kunde_adresse}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
