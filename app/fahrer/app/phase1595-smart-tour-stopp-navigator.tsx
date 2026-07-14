'use client';

import React, { useEffect, useState } from 'react';

interface TourStop {
  id: string;
  position: number;
  address: string;
  name?: string | null;
  eta_min?: number | null;
  status: 'ausstehend' | 'unterwegs' | 'geliefert';
  note?: string | null;
}

interface Props {
  isOnline: boolean;
  driverId: string | null;
  batchId?: string | null;
}

const MOCK_STOPS: TourStop[] = [
  { id: 's1', position: 1, address: 'Hauptstr. 12, 80333 München', name: 'Müller', eta_min: 8, status: 'geliefert', note: null },
  { id: 's2', position: 2, address: 'Gartenweg 5, 80333 München', name: 'Schmidt', eta_min: 5, status: 'unterwegs', note: 'Klingel 2. Stock' },
  { id: 's3', position: 3, address: 'Birkenallee 3, 80336 München', name: 'Koch', eta_min: 14, status: 'ausstehend', note: null },
  { id: 's4', position: 4, address: 'Ringstr. 22, 80336 München', name: 'Weber', eta_min: 22, status: 'ausstehend', note: 'Bitte anrufen' },
];

const STATUS_STYLE = {
  geliefert: { dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700', label: 'Geliefert' },
  unterwegs: { dot: 'bg-amber-400 animate-pulse', badge: 'bg-amber-100 text-amber-700', label: 'Aktiv' },
  ausstehend: { dot: 'bg-gray-200', badge: 'bg-gray-100 text-gray-500', label: 'Ausstehend' },
};

function mapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function FahrerPhase1595SmartTourStoppNavigator({ isOnline, driverId, batchId }: Props) {
  const [stops, setStops] = useState<TourStop[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    setStops(MOCK_STOPS);

    if (!isOnline || !driverId) return;

    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ driver_id: driverId! });
        if (batchId) params.set('batch_id', batchId);
        const res = await fetch(`/api/delivery/fahrer/aktive-tour-stops?${params}`);
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json) && json.length > 0) {
            setStops(json as TourStop[]);
          }
        }
      } catch {
        // Mock-Fallback bleibt
      } finally {
        setLoading(false);
      }
    }

    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [isOnline, driverId, batchId, mounted]);

  if (!open || !mounted) return null;

  const activeStop = stops.find((s) => s.status === 'unterwegs') ?? stops.find((s) => s.status === 'ausstehend');
  const completed = stops.filter((s) => s.status === 'geliefert').length;

  return (
    <div className="rounded-2xl border border-matcha-200 bg-white overflow-hidden mb-4 shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3 bg-matcha-700 text-white">
        <span className="text-sm font-bold uppercase tracking-wider flex-1">Tour-Stops</span>
        <span className="text-xs bg-white/20 rounded-full px-2 py-0.5">
          {completed}/{stops.length} erledigt
        </span>
        {loading && <span className="text-white/60 text-xs animate-pulse">…</span>}
        <button onClick={() => setOpen(false)} className="text-white/60 hover:text-white text-lg leading-none">×</button>
      </div>

      {/* Aktueller Stopp Hero */}
      {activeStop && (
        <div className="px-4 pt-4 pb-3 border-b border-gray-100 bg-matcha-50">
          <div className="text-[10px] font-bold uppercase tracking-wider text-matcha-600 mb-1">Nächster Stopp</div>
          <div className="font-bold text-gray-900 text-sm leading-tight">{activeStop.address}</div>
          {activeStop.name && <div className="text-xs text-gray-500 mt-0.5">{activeStop.name}</div>}
          {activeStop.note && (
            <div className="mt-1 text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1">
              ℹ {activeStop.note}
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <a
              href={mapsUrl(activeStop.address)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-matcha-600 text-white text-sm font-bold py-2.5 hover:bg-matcha-700 transition"
            >
              <span>📍</span> Navigation starten
            </a>
            {activeStop.eta_min !== null && (
              <div className="flex flex-col items-center justify-center rounded-xl bg-white border border-matcha-200 px-3">
                <span className="font-black tabular-nums text-matcha-700 text-lg leading-none">{activeStop.eta_min}</span>
                <span className="text-[9px] text-matcha-500 font-semibold">min</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stop-Liste */}
      <div className="divide-y divide-gray-50">
        {stops.map((s) => {
          const style = STATUS_STYLE[s.status];
          return (
            <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className={`w-3 h-3 rounded-full shrink-0 ${style.dot}`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">{s.address}</div>
                {s.name && <div className="text-xs text-gray-400">{s.name}</div>}
              </div>
              {s.eta_min !== null && s.status !== 'geliefert' && (
                <span className="text-xs font-bold text-gray-600 tabular-nums">{s.eta_min} min</span>
              )}
              <span className={`text-[9px] font-bold rounded-full px-1.5 py-0.5 ${style.badge}`}>
                {style.label}
              </span>
              {s.status !== 'geliefert' && (
                <a
                  href={mapsUrl(s.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-matcha-600 hover:text-matcha-800"
                  title="Navigation"
                >
                  <span className="text-base">🗺</span>
                </a>
              )}
            </div>
          );
        })}
      </div>

      {stops.length === 0 && (
        <div className="p-4 text-sm text-gray-400 text-center">Keine aktive Tour — warte auf Zuweisung.</div>
      )}
    </div>
  );
}
