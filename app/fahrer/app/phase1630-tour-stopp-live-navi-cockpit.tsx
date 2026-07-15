'use client';

import React, { useCallback, useEffect, useState } from 'react';

interface TourStop {
  id: string;
  sequence_number: number;
  adresse: string;
  customer_name?: string | null;
  eta?: string | null;
  status: 'pending' | 'unterwegs' | 'geliefert' | 'failed';
  lat?: number | null;
  lng?: number | null;
  bestellnummer?: string | null;
  sonderwunsch?: string | null;
}

interface Props {
  driverId: string | null;
  isOnline: boolean;
  batchId?: string | null;
}

type NavApp = 'google' | 'waze' | 'apple';

const STATUS_META: Record<TourStop['status'], { label: string; dot: string; text: string }> = {
  pending:   { label: 'Ausstehend',  dot: 'bg-stone-300', text: 'text-stone-500' },
  unterwegs: { label: 'Unterwegs',   dot: 'bg-blue-500 animate-pulse', text: 'text-blue-700' },
  geliefert: { label: 'Geliefert',   dot: 'bg-emerald-500', text: 'text-emerald-700' },
  failed:    { label: 'Fehlgeschl.', dot: 'bg-red-500', text: 'text-red-700' },
};

const MOCK_STOPS: TourStop[] = [
  { id: 's1', sequence_number: 1, adresse: 'Musterstraße 12, 52062 Aachen', customer_name: 'Max M.', eta: new Date(Date.now() + 8 * 60000).toISOString(), status: 'unterwegs', bestellnummer: '#1042' },
  { id: 's2', sequence_number: 2, adresse: 'Kaiserplatz 3, 52062 Aachen', customer_name: 'Sara K.', eta: new Date(Date.now() + 18 * 60000).toISOString(), status: 'pending', bestellnummer: '#1043', sonderwunsch: 'Kein Koriander' },
  { id: 's3', sequence_number: 3, adresse: 'Pontdriesch 7, 52062 Aachen', customer_name: 'Jonas B.', eta: new Date(Date.now() + 27 * 60000).toISOString(), status: 'pending', bestellnummer: '#1044' },
];

function fmtEta(eta: string | null | undefined): string {
  if (!eta) return '–';
  const d = new Date(eta);
  if (isNaN(d.getTime())) return '–';
  const diff = Math.round((d.getTime() - Date.now()) / 60000);
  if (diff <= 0) return 'Jetzt';
  return `~${diff} Min`;
}

function buildNavUrl(adresse: string, app: NavApp): string {
  const q = encodeURIComponent(adresse);
  switch (app) {
    case 'google': return `https://www.google.com/maps/dir/?api=1&destination=${q}`;
    case 'waze':   return `https://waze.com/ul?q=${q}&navigate=yes`;
    case 'apple':  return `maps://?daddr=${q}`;
  }
}

export function FahrerPhase1630TourStoppLiveNaviCockpit({ driverId, isOnline, batchId }: Props) {
  const [stops, setStops] = useState<TourStop[]>([]);
  const [loading, setLoading] = useState(true);
  const [navApp, setNavApp] = useState<NavApp>('google');
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!driverId) { setLoading(false); return; }

    const params = new URLSearchParams({ driver_id: driverId });
    if (batchId) params.set('batch_id', batchId);

    fetch(`/api/delivery/fahrer/tour-stops?${params}`, { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.stops?.length) {
          setStops(d.stops);
        } else {
          setStops(MOCK_STOPS);
        }
      })
      .catch(() => setStops(MOCK_STOPS))
      .finally(() => setLoading(false));
  }, [driverId, batchId]);

  const currentStop = stops.find((s) => s.status === 'unterwegs') ?? stops.find((s) => s.status === 'pending');
  const delivered = stops.filter((s) => s.status === 'geliefert').length;
  const total = stops.length;

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4 mb-4 animate-pulse">
        <div className="h-4 w-48 bg-stone-100 rounded mb-3" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-stone-100 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (stops.length === 0) return null;

  return (
    <div className="rounded-2xl border border-blue-200 bg-white overflow-hidden shadow-sm mb-4">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-blue-700 text-white">
        <span className="text-sm font-bold uppercase tracking-wider flex-1">
          Tour-Stopps · Live Navigation
        </span>
        <span className="text-xs bg-white/20 rounded-full px-2 py-0.5 tabular-nums">
          {delivered}/{total} geliefert
        </span>
      </div>

      {/* Fortschritts-Leiste */}
      <div className="h-1.5 bg-stone-100">
        <div
          className="h-full bg-blue-500 transition-all"
          style={{ width: total > 0 ? `${(delivered / total) * 100}%` : '0%' }}
        />
      </div>

      {/* Navi-App Wahl */}
      <div className="flex gap-2 px-4 py-2 border-b border-stone-100 bg-stone-50">
        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider self-center">Navi:</span>
        {(['google', 'waze', 'apple'] as NavApp[]).map((app) => (
          <button
            key={app}
            onClick={() => setNavApp(app)}
            className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition ${
              navApp === app
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-stone-200 text-stone-600'
            }`}
          >
            {app === 'google' ? 'Google Maps' : app === 'waze' ? 'Waze' : 'Apple Maps'}
          </button>
        ))}
      </div>

      {/* Stop-Liste */}
      <div className="divide-y divide-stone-50">
        {stops
          .slice()
          .sort((a, b) => a.sequence_number - b.sequence_number)
          .map((stop) => {
            const sm = STATUS_META[stop.status];
            const isActive = stop.status === 'unterwegs';
            const isDone = stop.status === 'geliefert';

            return (
              <div
                key={stop.id}
                className={`flex items-start gap-3 px-4 py-3 ${isActive ? 'bg-blue-50' : isDone ? 'bg-stone-50 opacity-60' : ''}`}
              >
                {/* Sequence + Status */}
                <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                  <div
                    className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-black ${
                      isDone
                        ? 'bg-emerald-500 text-white'
                        : isActive
                        ? 'bg-blue-600 text-white'
                        : 'bg-stone-200 text-stone-500'
                    }`}
                  >
                    {isDone ? '✓' : stop.sequence_number}
                  </div>
                </div>

                {/* Stop Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-stone-800 truncate">
                      {stop.customer_name ?? `Stopp ${stop.sequence_number}`}
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-wide ${sm.text}`}>
                      {sm.label}
                    </span>
                    {stop.bestellnummer && (
                      <span className="text-[10px] text-stone-400">{stop.bestellnummer}</span>
                    )}
                  </div>
                  <div className="text-xs text-stone-500 truncate mt-0.5">{stop.adresse}</div>
                  {stop.sonderwunsch && (
                    <div className="text-[11px] text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 mt-1 inline-block">
                      ⚠ {stop.sonderwunsch}
                    </div>
                  )}
                </div>

                {/* ETA + Nav Button */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-xs font-bold tabular-nums text-blue-700">
                    {fmtEta(stop.eta)}
                  </span>
                  {!isDone && (
                    <a
                      href={buildNavUrl(stop.adresse, navApp)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-bold bg-blue-600 text-white rounded-lg px-2 py-1 hover:bg-blue-700 transition"
                    >
                      Navi →
                    </a>
                  )}
                </div>
              </div>
            );
          })}
      </div>

      {/* Nächster Stopp CTA */}
      {currentStop && (
        <div className="px-4 pb-4 pt-2">
          <a
            href={buildNavUrl(currentStop.adresse, navApp)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-blue-600 text-white font-bold rounded-xl py-3 text-sm hover:bg-blue-700 transition active:scale-95"
          >
            <span>🗺</span>
            <span>Nächsten Stopp navigieren · {currentStop.adresse.split(',')[0]}</span>
          </a>
        </div>
      )}
    </div>
  );
}
