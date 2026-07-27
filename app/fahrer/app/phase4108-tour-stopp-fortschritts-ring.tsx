'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapPin, CheckCircle2, Package, Clock } from 'lucide-react';

interface TourStopp { nr: number; adresse: string; status: 'geliefert' | 'aktuell' | 'ausstehend'; eta_min: number | null; }
interface ApiData { stopps: TourStopp[]; abgeschlossen: number; gesamt: number; naechster_stopp: string; eta_naechster_min: number | null; km_gesamt: number; km_absolviert: number; }

const MOCK: ApiData = {
  abgeschlossen: 2,
  gesamt: 5,
  naechster_stopp: 'Jülicher Str. 77',
  eta_naechster_min: 6,
  km_gesamt: 14.2,
  km_absolviert: 6.8,
  stopps: [
    { nr: 1, adresse: 'Aachener Str. 12', status: 'geliefert', eta_min: null },
    { nr: 2, adresse: 'Hauptmarkt 5', status: 'geliefert', eta_min: null },
    { nr: 3, adresse: 'Jülicher Str. 77', status: 'aktuell', eta_min: 6 },
    { nr: 4, adresse: 'Ponttor Pl. 1', status: 'ausstehend', eta_min: 22 },
    { nr: 5, adresse: 'Dom-Platz 1', status: 'ausstehend', eta_min: 35 },
  ],
};

interface Props { driverId: string; locationId: string | null; isOnline: boolean; }

export function FahrerPhase4108TourStoppFortschrittsRing({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!driverId || !locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/driver/tour-stopps?driver_id=${driverId}&location_id=${locationId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [driverId, locationId]);

  useEffect(() => { load(); const id = setInterval(load, 15_000); return () => clearInterval(id); }, [load]);

  const pct = Math.round((data.abgeschlossen / data.gesamt) * 100);
  const circumference = 2 * Math.PI * 32;
  const offset = circumference * (1 - pct / 100);

  if (!isOnline) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 text-center text-gray-400 text-sm">
        Tour offline nicht verfügbar
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-semibold text-gray-900">Tour-Fortschritt</span>
        </div>
        {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-shrink-0">
          <svg width="80" height="80" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="32" fill="none" stroke="#f3f4f6" strokeWidth="7" />
            <circle cx="40" cy="40" r="32" fill="none" stroke="#3b82f6" strokeWidth="7"
              strokeDasharray={circumference} strokeDashoffset={offset}
              strokeLinecap="round" transform="rotate(-90 40 40)" style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
            <text x="40" y="38" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#1d4ed8">{pct}%</text>
            <text x="40" y="52" textAnchor="middle" fontSize="9" fill="#9ca3af">{data.abgeschlossen}/{data.gesamt}</text>
          </svg>
        </div>
        <div className="flex-1 space-y-1.5">
          <div className="bg-blue-50 rounded-lg p-2">
            <div className="text-[9px] text-gray-500">Nächster Stopp</div>
            <div className="text-xs font-semibold text-blue-700 truncate">{data.naechster_stopp}</div>
            {data.eta_naechster_min !== null && (
              <div className="flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3 text-blue-400" />
                <span className="text-[10px] text-blue-600 font-medium">{data.eta_naechster_min} min</span>
              </div>
            )}
          </div>
          <div className="flex justify-between text-[10px] text-gray-500">
            <span>km absolviert</span>
            <span className="font-semibold text-gray-700">{data.km_absolviert} / {data.km_gesamt} km</span>
          </div>
          <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-400 rounded-full" style={{ width: `${(data.km_absolviert / data.km_gesamt) * 100}%` }} />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        {data.stopps.map((stopp) => {
          const isGeliefert = stopp.status === 'geliefert';
          const isAktuell = stopp.status === 'aktuell';
          return (
            <div key={stopp.nr} className={`flex items-center gap-2 p-2 rounded-lg ${isAktuell ? 'bg-blue-50 border border-blue-200' : isGeliefert ? 'bg-emerald-50 border border-emerald-100' : 'bg-gray-50 border border-transparent'}`}>
              {isGeliefert ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" /> : isAktuell ? <MapPin className="w-4 h-4 text-blue-500 flex-shrink-0" /> : <Package className="w-4 h-4 text-gray-300 flex-shrink-0" />}
              <span className={`text-xs flex-1 truncate ${isAktuell ? 'text-blue-700 font-semibold' : isGeliefert ? 'text-emerald-700 line-through' : 'text-gray-500'}`}>{stopp.nr}. {stopp.adresse}</span>
              {stopp.eta_min !== null && !isGeliefert && <span className="text-[10px] text-gray-400">{stopp.eta_min} min</span>}
            </div>
          );
        })}
      </div>

      <div className="text-[9px] text-gray-400 text-center border-t border-gray-100 pt-0.5">
        Tour-Tracking · 15-Sek-Polling
      </div>
    </div>
  );
}
