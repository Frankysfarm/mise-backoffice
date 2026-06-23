'use client';

import { useEffect, useState } from 'react';

type ActiveStop = {
  id: string;
  address: string;
  customer: string;
  order_nr: string;
};

type RemainingStop = {
  id: string;
  address: string;
  order_nr: string;
};

type StopsData = {
  active: ActiveStop;
  remaining: RemainingStop[];
};

const MOCK_DATA: StopsData = {
  active: {
    id: '1',
    address: 'Berliner Str. 42, 10115 Berlin',
    customer: 'M. Schmidt',
    order_nr: '2847',
  },
  remaining: [
    { id: '2', address: 'Hauptstr. 17, 10117 Berlin', order_nr: '2849' },
    { id: '3', address: 'Am Markt 5, 10119 Berlin', order_nr: '2851' },
  ],
};

function distanceLabel(index: number): string {
  const distances = ['0,8 km', '1,4 km', '2,1 km', '3,0 km', '4,2 km'];
  return distances[index % distances.length];
}

export function TourStoppNavigationsHub() {
  const [data, setData] = useState<StopsData | null>(null);

  useEffect(() => {
    fetch('/api/fahrer/tour/stops', { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error('not ok');
        return r.json();
      })
      .then((d: StopsData) => setData(d))
      .catch(() => setData(MOCK_DATA));
  }, []);

  const stops = data ?? MOCK_DATA;
  const { active, remaining } = stops;
  const next3 = remaining.slice(0, 3);

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(active.address)}`;
  const wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(active.address)}`;

  return (
    <section className="rounded-2xl overflow-hidden border border-matcha-700/40 bg-matcha-950/60">
      <div className="bg-matcha-800/70 px-4 py-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-matcha-300">
          Navigations-Hub
        </span>
        <span className="text-xs text-matcha-400">
          Bestellung #{active.order_nr}
        </span>
      </div>

      <div className="p-4 space-y-3 bg-matcha-900/50">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-matcha-400 mb-1">
            Aktueller Stopp
          </div>
          <div className="text-xl font-bold text-white leading-snug">
            {active.address}
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm text-matcha-300 font-medium">{active.customer}</span>
            <span className="text-xs text-matcha-500">·</span>
            <span className="text-sm text-matcha-400">{distanceLabel(0)} entfernt</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 h-12 rounded-xl bg-matcha-600 hover:bg-matcha-500 active:bg-matcha-700 text-white text-sm font-semibold transition-colors"
          >
            <span>🗺️</span>
            Google Maps
          </a>
          <a
            href={wazeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 h-12 rounded-xl bg-matcha-700/80 hover:bg-matcha-600/80 active:bg-matcha-800 border border-matcha-600/50 text-white text-sm font-semibold transition-colors"
          >
            <span>🚗</span>
            Waze
          </a>
        </div>
      </div>

      {next3.length > 0 && (
        <div className="border-t border-matcha-700/30 bg-stone-900/40">
          <div className="px-4 pt-3 pb-1">
            <div className="text-[10px] uppercase tracking-wider text-stone-500 mb-2">
              Nächste Stopps
            </div>
            <ul className="space-y-2">
              {next3.map((stop, idx) => (
                <li key={stop.id} className="flex items-start gap-3">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-stone-700/60 text-stone-400 text-[10px] font-bold flex items-center justify-center mt-0.5">
                    {idx + 2}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm text-stone-300 truncate">{stop.address}</div>
                    <div className="text-[10px] text-stone-500">
                      #{stop.order_nr} · {distanceLabel(idx + 1)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="px-4 py-3 mt-1 border-t border-stone-800/60">
            <span className="text-xs text-stone-400 font-medium">
              {remaining.length} {remaining.length === 1 ? 'Stopp' : 'Stopps'} verbleibend
            </span>
          </div>
        </div>
      )}

      {next3.length === 0 && (
        <div className="px-4 py-3 border-t border-matcha-700/30 bg-stone-900/40">
          <span className="text-xs text-stone-400 font-medium">0 Stopps verbleibend</span>
        </div>
      )}
    </section>
  );
}
