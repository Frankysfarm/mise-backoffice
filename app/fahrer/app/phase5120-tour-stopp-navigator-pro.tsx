'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  Navigation, MapPin, Phone, CheckCircle2, Clock, ChevronRight,
  Package, AlertCircle, Bike, ExternalLink, Route,
} from 'lucide-react';

type StopStatus = 'pending' | 'active' | 'done';

interface TourStop {
  id: string;
  sequence: number;
  status: StopStatus;
  adresse?: string | null;
  kunde_name?: string | null;
  telefon?: string | null;
  eta_min?: number | null;
  betrag?: number | null;
  bezahlt?: boolean | null;
  notiz?: string | null;
  lat?: number | null;
  lng?: number | null;
  geliefert_am?: string | null;
}

interface Props {
  driverId: string;
  stops?: TourStop[];
  onComplete?: (stopId: string) => void;
  className?: string;
}

const MOCK_STOPS: TourStop[] = [
  { id: 's1', sequence: 1, status: 'done',    adresse: 'Jülicher Str. 77, Aachen',     kunde_name: 'Max Muster',   telefon: '+49 241 999001', eta_min: 0,  betrag: 28.50, bezahlt: true,  lat: 50.7726, lng: 6.0927, geliefert_am: new Date(Date.now() - 18 * 60_000).toISOString() },
  { id: 's2', sequence: 2, status: 'active',  adresse: 'Adalbertsteinweg 12, Aachen',  kunde_name: 'Lisa Schmitt', telefon: '+49 241 999002', eta_min: 4,  betrag: 19.00, bezahlt: false, lat: 50.7680, lng: 6.0802, notiz: 'Bitte klingeln – 3. OG' },
  { id: 's3', sequence: 3, status: 'pending', adresse: 'Theaterstr. 41, Aachen',       kunde_name: 'Tom Braun',    telefon: '+49 241 999003', eta_min: 12, betrag: 34.00, bezahlt: true,  lat: 50.7740, lng: 6.0880 },
  { id: 's4', sequence: 4, status: 'pending', adresse: 'Pontdriesch 14–20, Aachen',    kunde_name: 'Nina Wolf',    telefon: '+49 241 999004', eta_min: 21, betrag: 22.50, bezahlt: false, lat: 50.7758, lng: 6.0857 },
];

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(iv);
  }, []);
  return now;
}

function CountdownRing({ etaMin, className }: { etaMin: number | null; className?: string }) {
  const totalMin = 30;
  const pct = etaMin != null ? Math.max(0, Math.min(1, 1 - etaMin / totalMin)) : 0;
  const r = 28;
  const circ = 2 * Math.PI * r;
  const color = etaMin != null ? (etaMin <= 3 ? '#EF4444' : etaMin <= 8 ? '#F59E0B' : '#3B82F6') : '#64748b';

  if (etaMin == null) return (
    <div className={cn('flex h-16 w-16 items-center justify-center rounded-full border-2 border-slate-200 shrink-0', className)}>
      <Clock className="w-6 h-6 text-slate-400" />
    </div>
  );

  return (
    <div className={cn('relative shrink-0', className)}>
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#e2e8f0" strokeWidth="4" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={`${pct * circ} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 32 32)" style={{ transition: 'stroke-dasharray 1s ease' }} />
        <text x="32" y="27" textAnchor="middle" fontSize="16" fontWeight="800" fill={color}>{etaMin}</text>
        <text x="32" y="42" textAnchor="middle" fontSize="9" fill="#94a3b8">min</text>
      </svg>
    </div>
  );
}

function buildNavUrl(stop: TourStop) {
  if (stop.lat && stop.lng) return `https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stop.adresse ?? '')}`;
}

export function FahrerPhase5120TourStoppNavigatorPro({ driverId, stops: propStops, onComplete, className }: Props) {
  const [stops, setStops] = useState<TourStop[]>(propStops ?? MOCK_STOPS);
  const [completing, setCompleting] = useState<string | null>(null);
  const now = useNow();

  useEffect(() => { if (propStops?.length) setStops(propStops); }, [propStops]);

  const sorted = [...stops].sort((a, b) => a.sequence - b.sequence);
  const currentStop = sorted.find(s => s.status === 'active') ?? sorted.find(s => s.status === 'pending') ?? null;
  const nextStops = currentStop ? sorted.filter(s => s.status === 'pending' && s.id !== currentStop.id) : [];
  const doneCount = sorted.filter(s => s.status === 'done').length;
  const totalCount = sorted.length;

  const handleComplete = useCallback(async (stopId: string) => {
    setCompleting(stopId);
    try {
      onComplete?.(stopId);
      setStops(prev => prev.map(s => s.id === stopId ? { ...s, status: 'done' as const, geliefert_am: new Date().toISOString() } : s));
    } finally { setCompleting(null); }
  }, [onComplete]);

  return (
    <div className={cn('bg-white rounded-2xl border border-gray-200 overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Route className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-semibold text-gray-900">Tour-Navigator Pro</span>
        </div>
        <span className="text-xs text-gray-500">{doneCount}/{totalCount} Stopps</span>
      </div>

      {/* Progress bar */}
      <div className="px-4 pt-3 pb-1">
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full transition-all duration-500"
            style={{ width: totalCount > 0 ? `${(doneCount / totalCount) * 100}%` : '0%' }} />
        </div>
      </div>

      {/* Current stop */}
      {currentStop ? (
        <div className="mx-4 my-3 rounded-2xl border-2 border-blue-200 bg-blue-50 overflow-hidden">
          <div className="flex items-start gap-4 p-4">
            <CountdownRing etaMin={currentStop.eta_min ?? null} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600">Aktueller Stopp</span>
                <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">#{currentStop.sequence}</span>
              </div>
              <div className="font-semibold text-gray-900 text-sm leading-snug">{currentStop.kunde_name}</div>
              <div className="flex items-start gap-1.5 mt-1">
                <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                <span className="text-xs text-gray-600 leading-snug">{currentStop.adresse}</span>
              </div>
              {currentStop.notiz && (
                <div className="mt-1.5 text-[10px] bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-2 py-1">
                  💡 {currentStop.notiz}
                </div>
              )}
              {currentStop.betrag != null && (
                <div className={cn('mt-1.5 text-xs', currentStop.bezahlt ? 'text-emerald-600' : 'text-red-600')}>
                  {currentStop.bezahlt ? '✓ Bezahlt' : `☆ Bar: ${currentStop.betrag.toFixed(2)} €`}
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 px-4 pb-4">
            <a
              href={buildNavUrl(currentStop)} target="_blank" rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 active:scale-95 text-white rounded-xl py-2.5 text-sm font-semibold transition-all"
            >
              <Navigation className="w-4 h-4" />
              Navigieren
              <ExternalLink className="w-3 h-3 opacity-70" />
            </a>
            {currentStop.telefon && (
              <a
                href={`tel:${currentStop.telefon}`}
                className="w-11 flex items-center justify-center bg-gray-100 hover:bg-gray-200 active:scale-95 rounded-xl transition-all"
              >
                <Phone className="w-4 h-4 text-gray-600" />
              </a>
            )}
            <button
              onClick={() => handleComplete(currentStop.id)}
              disabled={completing === currentStop.id}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 active:scale-95 disabled:opacity-60 text-white rounded-xl py-2.5 text-sm font-semibold transition-all"
            >
              {completing === currentStop.id
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <CheckCircle2 className="w-4 h-4" />}
              Geliefert
            </button>
          </div>
        </div>
      ) : (
        <div className="m-4 rounded-2xl bg-emerald-50 border border-emerald-200 p-6 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <div className="text-sm font-semibold text-emerald-800">Tour abgeschlossen!</div>
          <div className="text-xs text-emerald-600 mt-1">Alle {totalCount} Stopps erledigt 🎉</div>
        </div>
      )}

      {/* Upcoming stops */}
      {nextStops.length > 0 && (
        <div className="px-4 pb-4 space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Nächste Stopps</div>
          {nextStops.map(stop => (
            <div key={stop.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
              <span className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600 shrink-0">
                {stop.sequence}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-700 truncate">{stop.kunde_name}</div>
                <div className="text-[10px] text-gray-400 truncate">{stop.adresse}</div>
              </div>
              {stop.eta_min != null && (
                <div className="flex items-center gap-1 text-[10px] text-gray-500 shrink-0">
                  <Clock className="w-2.5 h-2.5" />
                  ~{stop.eta_min} min
                </div>
              )}
              <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
            </div>
          ))}
        </div>
      )}

      {/* Done stops */}
      {sorted.filter(s => s.status === 'done').length > 0 && (
        <div className="px-4 pb-4 space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-300 mb-1.5">Erledigt</div>
          {sorted.filter(s => s.status === 'done').map(stop => (
            <div key={stop.id} className="flex items-center gap-2 text-[10px] text-gray-400 line-through">
              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 no-underline" style={{ textDecoration: 'none' }} />
              <span className="no-underline" style={{ textDecoration: 'none' }}>{stop.sequence}.</span>
              <span>{stop.kunde_name} – {stop.adresse}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
