'use client';

// Phase 1125 — Tour-Stopp-Navigations-Hub (Fahrer-App)
// Zeigt aktuellen + nächsten Stopp, ETA-Countdown, Entfernung + Navi-Button

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Clock, MapPin, Navigation, Phone, CheckCircle2, Loader2, Route } from 'lucide-react';

interface Props {
  driverId: string;
  isOnline: boolean;
  activeBatch?: { id: string; stopps?: Stop[] } | null;
}

type StopStatus = 'pending' | 'current' | 'done';
type Stop = {
  id: string;
  nr: number;
  adresse: string;
  kunde: string;
  telefon?: string;
  eta_min?: number;
  distanz_km?: number;
  status: StopStatus;
  notiz?: string;
};

type TourData = {
  batch_id: string;
  stopps: Stop[];
  gesamt_stopps: number;
  abgeschlossen: number;
  aktuelle_laufzeit_min: number;
};

function buildMock(batchId?: string): TourData {
  return {
    batch_id: batchId ?? 'mock-batch',
    gesamt_stopps: 4,
    abgeschlossen: 1,
    aktuelle_laufzeit_min: 22,
    stopps: [
      { id: 's1', nr: 1, adresse: 'Musterstraße 1, 10115 Berlin',  kunde: 'M. Müller',  status: 'done',    eta_min: 0,  distanz_km: 0 },
      { id: 's2', nr: 2, adresse: 'Berliner Allee 42, 10117 Berlin', kunde: 'S. Schulz',  status: 'current', eta_min: 6,  distanz_km: 2.1, telefon: '+49 30 1234567', notiz: 'Klingel defekt, anrufen' },
      { id: 's3', nr: 3, adresse: 'Parkweg 7, 10119 Berlin',         kunde: 'A. Ahmad',   status: 'pending', eta_min: 18, distanz_km: 3.8 },
      { id: 's4', nr: 4, adresse: 'Gartenstraße 99, 10121 Berlin',   kunde: 'K. Klein',   status: 'pending', eta_min: 28, distanz_km: 5.4 },
    ],
  };
}

function openNavigation(adresse: string) {
  const encoded = encodeURIComponent(adresse);
  const url = /android/i.test(navigator.userAgent)
    ? `google.navigation:q=${encoded}`
    : `maps://maps.apple.com/?daddr=${encoded}`;
  window.open(url, '_blank');
}

export function FahrerPhase1125TourStoppNavigationsHub({ driverId, isOnline, activeBatch }: Props) {
  const [data, setData] = useState<TourData | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  const load = useCallback(() => {
    const bId = activeBatch?.id;
    if (!bId || !isOnline) { setData(buildMock(bId)); return; }
    setLoading(true);
    fetch(`/api/delivery/tours/${bId}/route`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d?.stopps ? d : buildMock(bId)))
      .catch(() => setData(buildMock(bId)))
      .finally(() => setLoading(false));
  }, [driverId, isOnline, activeBatch]);

  useEffect(() => { load(); const iv = setInterval(load, 30_000); return () => clearInterval(iv); }, [load]);

  if (!data) return null;

  const currentStop = data.stopps.find(s => s.status === 'current');
  const nextStop    = data.stopps.find(s => s.status === 'pending');
  const progressPct = data.gesamt_stopps > 0
    ? Math.round((data.abgeschlossen / data.gesamt_stopps) * 100)
    : 0;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-stone-600" />
          <span className="font-bold text-sm">Tour-Navigation</span>
          <span className="text-[9px] font-bold text-stone-400 uppercase tracking-wide">Phase 1125</span>
          {loading && <Loader2 className="h-3 w-3 animate-spin text-stone-400" />}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-stone-500">
            {data.abgeschlossen}/{data.gesamt_stopps} Stopps
          </span>
          {open ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
        </div>
      </button>

      {/* Progress */}
      <div className="h-1.5 w-full bg-stone-100 overflow-hidden">
        <div
          className="h-full bg-emerald-500 transition-all duration-700"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {open && (
        <div className="p-4 space-y-3">
          {/* Current stop */}
          {currentStop && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="h-5 w-5 rounded-full bg-amber-500 text-white text-[10px] font-black flex items-center justify-center">
                    {currentStop.nr}
                  </span>
                  <span className="text-xs font-black text-amber-800 uppercase tracking-wide">Jetzt liefern</span>
                </div>
                {currentStop.eta_min !== undefined && currentStop.eta_min > 0 && (
                  <div className="flex items-center gap-1 bg-amber-100 rounded-full px-2.5 py-0.5">
                    <Clock className="h-3 w-3 text-amber-700" />
                    <span className="text-[11px] font-black text-amber-700 tabular-nums">{currentStop.eta_min} min</span>
                  </div>
                )}
              </div>

              <div>
                <div className="text-sm font-bold text-stone-800 leading-tight">{currentStop.adresse}</div>
                <div className="text-xs text-stone-500 mt-0.5">{currentStop.kunde}</div>
                {currentStop.notiz && (
                  <div className="mt-1.5 text-[10px] font-bold text-amber-700 bg-amber-100/70 rounded-lg px-2 py-1">
                    ⚠ {currentStop.notiz}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => openNavigation(currentStop.adresse)}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl py-2.5 transition"
                >
                  <Navigation className="h-3.5 w-3.5" />
                  Navigation starten
                </button>
                {currentStop.telefon && (
                  <a
                    href={`tel:${currentStop.telefon}`}
                    className="flex items-center justify-center gap-1 bg-white border border-amber-300 text-amber-700 text-xs font-bold rounded-xl px-3 py-2.5 hover:bg-amber-50 transition"
                  >
                    <Phone className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Next stop preview */}
          {nextStop && (
            <div className="rounded-xl bg-stone-50 border border-stone-200 p-3 flex items-center gap-3">
              <div className="shrink-0">
                <span className="h-7 w-7 rounded-full bg-stone-200 text-stone-600 text-[11px] font-black flex items-center justify-center">
                  {nextStop.nr}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold text-stone-500 uppercase tracking-wide mb-0.5">Nächster Stopp</div>
                <div className="text-sm font-bold text-stone-700 truncate">{nextStop.adresse}</div>
                <div className="text-xs text-stone-400">{nextStop.kunde}</div>
              </div>
              <div className="shrink-0 text-right">
                {nextStop.distanz_km && (
                  <div className="text-sm font-black tabular-nums text-stone-700">{nextStop.distanz_km.toFixed(1)} km</div>
                )}
                {nextStop.eta_min && (
                  <div className="text-[10px] text-stone-400 tabular-nums">~{nextStop.eta_min} min</div>
                )}
              </div>
            </div>
          )}

          {/* All stops list (compact) */}
          <div className="space-y-1">
            {data.stopps.map(s => (
              <div key={s.id} className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg transition',
                s.status === 'done'    ? 'opacity-50' :
                s.status === 'current' ? 'bg-amber-50/50' : 'hover:bg-stone-50'
              )}>
                <div className={cn('h-5 w-5 rounded-full text-[9px] font-black flex items-center justify-center shrink-0',
                  s.status === 'done'    ? 'bg-emerald-100 text-emerald-600' :
                  s.status === 'current' ? 'bg-amber-400 text-white' :
                  'bg-stone-100 text-stone-500'
                )}>
                  {s.status === 'done' ? <CheckCircle2 className="h-3 w-3" /> : s.nr}
                </div>
                <span className={cn('text-xs flex-1 truncate', s.status === 'done' ? 'line-through text-stone-400' : 'text-stone-700')}>
                  {s.adresse}
                </span>
                {s.eta_min !== undefined && s.status !== 'done' && (
                  <span className="text-[10px] font-bold text-stone-400 tabular-nums shrink-0">{s.eta_min}m</span>
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between text-[10px] text-stone-400 border-t border-stone-100 pt-2">
            <span>Laufzeit: <span className="font-bold tabular-nums">{data.aktuelle_laufzeit_min} min</span></span>
            <span>Fortschritt: <span className="font-bold">{progressPct}%</span></span>
          </div>
        </div>
      )}
    </div>
  );
}
