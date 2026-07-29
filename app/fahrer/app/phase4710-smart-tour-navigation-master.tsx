'use client';

import { useEffect, useState } from 'react';
import {
  MapPin, Navigation2, Phone, CheckCircle2, Clock, AlertTriangle,
  ChevronDown, ChevronUp, Route, Trophy, WifiOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type StopStatus = 'pending' | 'active' | 'done' | 'late';

interface TourStop {
  id: string;
  seq: number;
  nr: string;
  adresse: string;
  status: StopStatus;
  eta_min: number | null;
  kunde_name: string | null;
  kunde_tel: string | null;
  notiz: string | null;
  zahlart: 'bar' | 'karte' | 'online';
  betrag_eur: number;
  lat: number | null;
  lng: number | null;
}

interface TourData {
  tour_id: string;
  stops_total: number;
  stops_done: number;
  score: number;
  elapsed_min: number;
  stops: TourStop[];
}

const MOCK: TourData = {
  tour_id: 't1',
  stops_total: 3,
  stops_done: 1,
  score: 88,
  elapsed_min: 22,
  stops: [
    {
      id: 's1', seq: 1, nr: '0301', adresse: 'Hauptstr. 17, Aachen', status: 'done', eta_min: null,
      kunde_name: 'Max M.',     kunde_tel: '+49170123456', notiz: null,          zahlart: 'online', betrag_eur: 18.50, lat: 50.776, lng: 6.083,
    },
    {
      id: 's2', seq: 2, nr: '0302', adresse: 'Parkweg 4, Aachen',    status: 'active', eta_min: 6,
      kunde_name: 'Anna K.',    kunde_tel: '+49171234567', notiz: 'Klingel kaputt – anrufen!', zahlart: 'bar',    betrag_eur: 24.80, lat: 50.780, lng: 6.090,
    },
    {
      id: 's3', seq: 3, nr: '0303', adresse: 'Bergstr. 8, Aachen',   status: 'pending', eta_min: 18,
      kunde_name: 'Tom B.',     kunde_tel: '+49172345678', notiz: null,          zahlart: 'karte',  betrag_eur: 12.20, lat: 50.783, lng: 6.079,
    },
  ],
};

const STATUS_COLORS: Record<StopStatus, string> = {
  done:    'bg-green-500 text-white',
  active:  'bg-blue-600 text-white ring-2 ring-blue-300',
  pending: 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
  late:    'bg-red-500 text-white animate-pulse',
};

const ZAHLART_LABEL: Record<string, string> = {
  bar: 'Bar', karte: 'Karte', online: 'Online',
};

function openNav(lat: number | null, lng: number | null, adresse: string, app: 'google' | 'waze' | 'apple') {
  if (!lat || !lng) {
    window.open(`https://maps.google.com/?q=${encodeURIComponent(adresse)}`, '_blank');
    return;
  }
  const urls = {
    google: `https://maps.google.com/?q=${lat},${lng}`,
    waze:   `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
    apple:  `maps://maps.apple.com/?daddr=${lat},${lng}`,
  };
  window.open(urls[app], '_blank');
}

export function FahrerPhase4710SmartTourNavigationMaster({ driverId, locationId }: { driverId: string | null; locationId: string | null }) {
  const [data, setData] = useState<TourData | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showNavModal, setShowNavModal] = useState<TourStop | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const params = new URLSearchParams();
        if (driverId)   params.set('driver_id', driverId);
        if (locationId) params.set('location_id', locationId);
        const res = await fetch(`/api/delivery/fahrer/aktive-tour?${params}`);
        if (!res.ok) throw new Error('fetch failed');
        const json: TourData = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData(MOCK);
      }
    }
    load();
    const iv = setInterval(load, 15_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [driverId, locationId]);

  const d = data ?? MOCK;
  const activeStop = d.stops.find((s) => s.status === 'active') ?? null;
  const lateStops  = d.stops.filter((s) => s.status === 'late');
  const progressPct = Math.round((d.stops_done / d.stops_total) * 100);

  if (error) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 flex items-center gap-2 text-gray-400">
        <WifiOff className="w-4 h-4" /><span className="text-xs">Tour-Navigation nicht verfügbar</span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-blue-200 dark:border-blue-900 bg-white dark:bg-gray-900 space-y-3 overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Route className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-bold text-gray-800 dark:text-gray-200">Tour Navigation</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-sm font-extrabold text-amber-600 dark:text-amber-400 tabular-nums">{d.score}</span>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">{d.stops_done}/{d.stops_total} Stopps</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4">
        <div className="h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
          <span>{progressPct}% erledigt</span>
          <span>{d.elapsed_min} Min unterwegs</span>
        </div>
      </div>

      {lateStops.length > 0 && (
        <div className="mx-4 flex items-center gap-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 text-red-500 animate-pulse shrink-0" />
          <span className="text-xs font-semibold text-red-700 dark:text-red-300">
            {lateStops.length} Stopp{lateStops.length > 1 ? 's' : ''} verspätet!
          </span>
        </div>
      )}

      {/* Active stop hero */}
      {activeStop && (
        <div className="mx-4 rounded-xl bg-blue-600 text-white p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[10px] font-semibold text-blue-200 uppercase tracking-wide">Aktueller Stopp</div>
              <div className="text-sm font-bold mt-0.5">#{activeStop.nr} — {activeStop.adresse}</div>
              {activeStop.notiz && (
                <div className="text-[11px] text-blue-100 mt-1 italic">📝 {activeStop.notiz}</div>
              )}
            </div>
            {activeStop.eta_min != null && (
              <div className="text-right shrink-0">
                <div className="text-[10px] text-blue-200">ETA</div>
                <div className="text-lg font-extrabold tabular-nums">~{activeStop.eta_min} Min</div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">{activeStop.betrag_eur.toFixed(2)} € — {ZAHLART_LABEL[activeStop.zahlart]}</span>
            {activeStop.kunde_name && <span className="text-blue-200 text-xs">{activeStop.kunde_name}</span>}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowNavModal(activeStop)}
              className="flex-1 flex items-center justify-center gap-1.5 bg-white/20 hover:bg-white/30 rounded-lg py-2 text-sm font-semibold transition-colors"
            >
              <Navigation2 className="w-4 h-4" />Navigation
            </button>
            {activeStop.kunde_tel && (
              <a
                href={`tel:${activeStop.kunde_tel}`}
                className="flex-1 flex items-center justify-center gap-1.5 bg-white/20 hover:bg-white/30 rounded-lg py-2 text-sm font-semibold transition-colors"
              >
                <Phone className="w-4 h-4" />Anruf
              </a>
            )}
          </div>
        </div>
      )}

      {/* All stops */}
      <div className="px-4 pb-4 space-y-1.5">
        {d.stops.filter((s) => s.status !== 'active').map((s) => (
          <div key={s.id} className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 overflow-hidden">
            <button
              className="w-full flex items-center gap-2.5 px-3 py-2.5"
              onClick={() => setExpanded(expanded === s.id ? null : s.id)}
            >
              <div className={cn('w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0', STATUS_COLORS[s.status])}>
                {s.status === 'done' ? '✓' : s.seq}
              </div>
              <div className="flex-1 text-left">
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">#{s.nr} — {s.adresse}</div>
              </div>
              <div className="text-[10px] text-gray-400 shrink-0">
                {s.status === 'done' ? 'Fertig' : s.eta_min != null ? `~${s.eta_min} Min` : '–'}
              </div>
              {expanded === s.id ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
            </button>

            {expanded === s.id && (
              <div className="px-3 pb-3 space-y-2 border-t border-gray-100 dark:border-gray-700 pt-2">
                <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                  <span>{ZAHLART_LABEL[s.zahlart]}: <strong className="text-gray-800 dark:text-gray-200">{s.betrag_eur.toFixed(2)} €</strong></span>
                  {s.kunde_name && <span>{s.kunde_name}</span>}
                </div>
                {s.notiz && <div className="text-[11px] text-gray-500 dark:text-gray-400 italic">📝 {s.notiz}</div>}
                {s.status !== 'done' && (
                  <button
                    onClick={() => setShowNavModal(s)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <Navigation2 className="w-3.5 h-3.5" />Navigation öffnen
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Navigation Modal */}
      {showNavModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowNavModal(null)}>
          <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-t-2xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-bold text-gray-800 dark:text-gray-200 text-center">Navigation öffnen</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 text-center">{showNavModal.adresse}</div>
            <div className="grid grid-cols-3 gap-2">
              {(['google', 'waze', 'apple'] as const).map((app) => (
                <button
                  key={app}
                  onClick={() => { openNav(showNavModal.lat, showNavModal.lng, showNavModal.adresse, app); setShowNavModal(null); }}
                  className="py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 capitalize"
                >
                  {app === 'apple' ? 'Apple Maps' : app === 'google' ? 'Google Maps' : 'Waze'}
                </button>
              ))}
            </div>
            <button onClick={() => setShowNavModal(null)} className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
