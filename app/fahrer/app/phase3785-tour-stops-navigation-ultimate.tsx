'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapPin, Navigation, CheckCircle2, Clock, Package, ChevronRight, AlertCircle } from 'lucide-react';

interface TourStopp {
  index: number;
  bestellnummer: string;
  adresse: string;
  eta_min: number | null;
  status: 'ausstehend' | 'aktiv' | 'geliefert' | 'verpasst';
  trinkgeld_erwartet: boolean;
  etagen: number | null;
  hinweis: string | null;
}

interface NavData {
  stopps: TourStopp[];
  aktiver_stopp_index: number;
  gesamt_min_rest: number;
  km_rest: number;
  on_time: boolean;
}

const MOCK: NavData = {
  aktiver_stopp_index: 1,
  gesamt_min_rest: 28,
  km_rest: 4.2,
  on_time: true,
  stopps: [
    { index: 0, bestellnummer: 'FF-5201', adresse: 'Adenauerallee 42, Aachen', eta_min: null, status: 'geliefert', trinkgeld_erwartet: false, etagen: null, hinweis: null },
    { index: 1, bestellnummer: 'FF-5202', adresse: 'Habsburger Allee 17, Aachen', eta_min: 6, status: 'aktiv', trinkgeld_erwartet: true, etagen: 2, hinweis: 'Klingel kaputt — anrufen' },
    { index: 2, bestellnummer: 'FF-5203', adresse: 'Pontstraße 88, Aachen', eta_min: 16, status: 'ausstehend', trinkgeld_erwartet: false, etagen: null, hinweis: null },
    { index: 3, bestellnummer: 'FF-5204', adresse: 'Jülicher Straße 12, Aachen', eta_min: 28, status: 'ausstehend', trinkgeld_erwartet: true, etagen: 3, hinweis: null },
  ],
};

function statusIcon(s: TourStopp['status']) {
  if (s === 'geliefert') return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (s === 'aktiv')     return <Navigation className="h-4 w-4 text-blue-600 animate-pulse" />;
  if (s === 'verpasst')  return <AlertCircle className="h-4 w-4 text-red-500" />;
  return <Package className="h-4 w-4 text-slate-400" />;
}

function statusBg(s: TourStopp['status']) {
  if (s === 'geliefert') return 'bg-emerald-50 border-emerald-200 opacity-60';
  if (s === 'aktiv')     return 'bg-blue-50 border-blue-300 shadow-sm';
  if (s === 'verpasst')  return 'bg-red-50 border-red-200';
  return 'bg-white border-slate-200';
}

function naviLink(adresse: string) {
  return `https://maps.google.com/?q=${encodeURIComponent(adresse)}`;
}

export function FahrerPhase3785TourStopsNavigationUltimate({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<NavData>(MOCK);

  const load = useCallback(async () => {
    if (!driverId || !locationId) return;
    try {
      const res = await fetch(`/api/delivery/driver/tour-stops?driver_id=${driverId}&location_id=${locationId}`);
      if (res.ok) {
        const d = await res.json();
        if (d.stopps) setData(d);
      }
    } catch { /* Mock-Fallback */ }
  }, [driverId, locationId]);

  useEffect(() => { load(); const id = setInterval(load, 20000); return () => clearInterval(id); }, [load]);

  const aktiv = data.stopps.find(s => s.status === 'aktiv');
  const ausstehend = data.stopps.filter(s => s.status === 'ausstehend').length;
  const geliefert = data.stopps.filter(s => s.status === 'geliefert').length;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-blue-600" />
        <span className="font-semibold text-sm text-slate-800">Tour-Stops & Navigation</span>
        {!isOnline && (
          <span className="ml-auto text-[10px] rounded-full bg-yellow-100 px-2 py-0.5 text-yellow-700">Offline</span>
        )}
      </div>

      {/* Tour-Fortschritt */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-slate-50 p-2 text-center">
          <div className="text-sm font-bold text-emerald-600">{geliefert}</div>
          <div className="text-[10px] text-slate-500">Geliefert</div>
        </div>
        <div className="rounded-lg bg-blue-50 p-2 text-center">
          <div className="text-sm font-bold text-blue-700">{ausstehend}</div>
          <div className="text-[10px] text-slate-500">Ausstehend</div>
        </div>
        <div className="rounded-lg bg-slate-50 p-2 text-center">
          <div className="flex items-center justify-center gap-0.5 text-sm font-bold text-slate-700">
            <Clock className="h-3 w-3 text-slate-400" />{data.gesamt_min_rest}min
          </div>
          <div className="text-[10px] text-slate-500">{data.km_rest}km rest</div>
        </div>
      </div>

      {/* Fortschritts-Balken */}
      <div>
        <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
          <span>{geliefert}/{data.stopps.length} Stopps</span>
          <span className={data.on_time ? 'text-emerald-600 font-medium' : 'text-red-600 font-medium'}>
            {data.on_time ? 'On-Time' : 'Verzögert'}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500 transition-all"
            style={{ width: `${(geliefert / data.stopps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Aktiver Stopp prominent */}
      {aktiv && (
        <a
          href={naviLink(aktiv.adresse)}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-xl border-2 border-blue-400 bg-blue-50 p-3 hover:bg-blue-100 transition-colors"
        >
          <div className="flex items-center gap-2 mb-1">
            <Navigation className="h-4 w-4 text-blue-600 animate-pulse" />
            <span className="text-xs font-bold text-blue-800">Nächster Stopp</span>
            <span className="ml-auto text-xs font-bold text-blue-700">{aktiv.eta_min}min</span>
          </div>
          <div className="text-sm font-semibold text-slate-800">{aktiv.adresse}</div>
          <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500">
            <span>{aktiv.bestellnummer}</span>
            {aktiv.etagen && <span>{aktiv.etagen}. OG</span>}
            {aktiv.trinkgeld_erwartet && <span className="text-amber-600 font-medium">Trinkgeld erwartet</span>}
          </div>
          {aktiv.hinweis && (
            <div className="mt-1.5 rounded-lg bg-amber-50 border border-amber-200 px-2 py-1 text-[10px] text-amber-700 font-medium">
              ⚠ {aktiv.hinweis}
            </div>
          )}
          <div className="flex items-center gap-1 mt-2 text-[10px] text-blue-600 font-medium">
            <Navigation className="h-3 w-3" />Zur Navigation öffnen <ChevronRight className="h-3 w-3 ml-auto" />
          </div>
        </a>
      )}

      {/* Alle Stopps */}
      <div className="space-y-1.5">
        {data.stopps.map(s => (
          <div key={s.index} className={`rounded-lg border p-2 transition-all ${statusBg(s.status)}`}>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 w-4">#{s.index + 1}</span>
              {statusIcon(s.status)}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-slate-700 truncate">{s.adresse}</div>
                <div className="text-[10px] text-slate-400">{s.bestellnummer}</div>
              </div>
              {s.eta_min && s.status !== 'geliefert' && (
                <span className="text-[10px] font-bold text-slate-500 shrink-0">{s.eta_min}min</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="text-[10px] text-slate-400">Live · alle 20 Sek. aktualisiert</div>
    </div>
  );
}
