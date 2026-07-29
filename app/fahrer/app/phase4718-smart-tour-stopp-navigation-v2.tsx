'use client';

import { useEffect, useState } from 'react';
import { MapPin, Navigation, Clock, CheckCircle2, Package, Zap, WifiOff, ChevronRight, AlertTriangle } from 'lucide-react';

interface TourStop {
  stop_id: string;
  rang: number;
  adresse: string;
  stadtteil: string;
  eta_min: number;
  fahrzeit_min: number;
  status: 'ausstehend' | 'angefahren' | 'geliefert' | 'fehlgeschlagen';
  ist_batch: boolean;
  batch_partner: string | null;
  kundennotiz: string | null;
  entfernung_km: number;
}

interface TourInfo {
  tour_id: string;
  aktiver_stop_rang: number;
  gesamt_stops: number;
  touren_effizienz_pct: number;
  restzeit_min: number;
  storno_risiko: boolean;
}

interface ApiResponse {
  tour: TourInfo | null;
  stops: TourStop[];
}

const MOCK: ApiResponse = {
  tour: { tour_id: 't1', aktiver_stop_rang: 2, gesamt_stops: 4, touren_effizienz_pct: 87, restzeit_min: 22, storno_risiko: false },
  stops: [
    { stop_id: 's1', rang: 1, adresse: 'Hauptstraße 12', stadtteil: 'Mitte', eta_min: 0, fahrzeit_min: 6, status: 'geliefert', ist_batch: false, batch_partner: null, kundennotiz: null, entfernung_km: 1.2 },
    { stop_id: 's2', rang: 2, adresse: 'Gartenweg 45', stadtteil: 'Nord', eta_min: 8, fahrzeit_min: 8, status: 'angefahren', ist_batch: true, batch_partner: 'Stop 3', kundennotiz: 'Klingel kaputt – anrufen!', entfernung_km: 2.1 },
    { stop_id: 's3', rang: 3, adresse: 'Rosenstraße 7', stadtteil: 'Nord', eta_min: 15, fahrzeit_min: 4, status: 'ausstehend', ist_batch: true, batch_partner: 'Stop 2', kundennotiz: null, entfernung_km: 0.8 },
    { stop_id: 's4', rang: 4, adresse: 'Bahnhofsplatz 3', stadtteil: 'West', eta_min: 22, fahrzeit_min: 7, status: 'ausstehend', ist_batch: false, batch_partner: null, kundennotiz: null, entfernung_km: 3.4 },
  ],
};

const statusConfig = {
  geliefert:     { color: 'text-emerald-400', bg: 'bg-emerald-900/30', icon: CheckCircle2, label: 'Geliefert' },
  angefahren:    { color: 'text-amber-400',   bg: 'bg-amber-900/40',   icon: Navigation,  label: 'Aktiv' },
  ausstehend:    { color: 'text-slate-400',   bg: 'bg-slate-800',      icon: MapPin,      label: 'Ausstehend' },
  fehlgeschlagen:{ color: 'text-red-400',     bg: 'bg-red-900/30',     icon: AlertTriangle, label: 'Fehlgeschlagen' },
};

export function FahrerPhase4718SmartTourStoppNavigationV2({
  locationId,
  driverId,
  isOnline,
}: {
  locationId: string | null;
  driverId: string;
  isOnline: boolean;
}) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    if (!locationId || !driverId) { setData(MOCK); return; }
    try {
      const r = await fetch(`/api/delivery/fahrer/tour-stops?location_id=${locationId}&driver_id=${driverId}`);
      if (r.ok) setData(await r.json());
      else setData(MOCK);
    } catch { setData(MOCK); }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [locationId, driverId]);

  if (!isOnline) return (
    <div className="rounded-2xl bg-slate-800 p-4 flex items-center gap-3 text-slate-400">
      <WifiOff className="w-5 h-5 shrink-0" />
      <span className="text-sm">Offline — Tour-Navigation nicht verfügbar</span>
    </div>
  );

  if (!data || !data.tour) return (
    <div className="rounded-2xl bg-slate-900 p-4 text-slate-400 text-sm animate-pulse">
      Lade Tour-Stops…
    </div>
  );

  const { tour, stops } = data;

  function openNavi(adresse: string) {
    const encoded = encodeURIComponent(adresse);
    window.open(`https://www.google.com/maps/search/?api=1&query=${encoded}`, '_blank');
  }

  return (
    <div className="rounded-2xl bg-slate-900 text-white p-4 space-y-4">
      {/* Tour Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation className="w-5 h-5 text-amber-400" />
          <span className="font-semibold text-slate-100">Tour-Navigation</span>
        </div>
        <div className="text-xs text-slate-400">
          Stop {tour.aktiver_stop_rang} / {tour.gesamt_stops}
        </div>
      </div>

      {/* Tour KPIs */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-slate-800 p-2">
          <p className="text-slate-500 text-[10px]">Restzeit</p>
          <p className="font-bold text-amber-400">{tour.restzeit_min} min</p>
        </div>
        <div className="rounded-lg bg-slate-800 p-2">
          <p className="text-slate-500 text-[10px]">Effizienz</p>
          <p className={`font-bold ${tour.touren_effizienz_pct >= 80 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {tour.touren_effizienz_pct}%
          </p>
        </div>
        <div className="rounded-lg bg-slate-800 p-2">
          <p className="text-slate-500 text-[10px]">Stops</p>
          <p className="font-bold text-slate-200">{stops.filter(s => s.status === 'geliefert').length}/{tour.gesamt_stops}</p>
        </div>
      </div>

      {tour.storno_risiko && (
        <div className="flex items-center gap-2 rounded-lg bg-red-900/50 border border-red-700 px-3 py-2 text-red-300 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Storno-Risiko erkannt — Kundenrückruf empfohlen
        </div>
      )}

      {/* Stop List */}
      <div className="space-y-2">
        {stops.map(stop => {
          const cfg = statusConfig[stop.status];
          const StopIcon = cfg.icon;
          const isActive = stop.status === 'angefahren';
          return (
            <div key={stop.stop_id} className={`rounded-xl border p-3 space-y-2 ${cfg.bg} ${isActive ? 'border-amber-600' : 'border-slate-700'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${isActive ? 'bg-amber-500 text-black' : 'bg-slate-700 text-slate-300'}`}>
                    {stop.rang}
                  </span>
                  <StopIcon className={`w-3.5 h-3.5 ${cfg.color}`} />
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{stop.adresse}</p>
                    <p className="text-[10px] text-slate-400">{stop.stadtteil} · {stop.entfernung_km} km</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {stop.eta_min > 0 && (
                    <span className={`text-xs flex items-center gap-0.5 ${isActive ? 'text-amber-400 font-bold' : 'text-slate-400'}`}>
                      <Clock className="w-3 h-3" />
                      {stop.eta_min}′
                    </span>
                  )}
                  {isActive && (
                    <button
                      onClick={() => openNavi(stop.adresse)}
                      className="flex items-center gap-1 rounded-lg bg-amber-500 text-black text-xs font-bold px-2 py-1"
                    >
                      <Navigation className="w-3 h-3" />
                      Navi
                    </button>
                  )}
                </div>
              </div>

              {stop.ist_batch && (
                <div className="flex items-center gap-1 text-[10px] text-amber-300">
                  <Zap className="w-3 h-3" />
                  Batch mit {stop.batch_partner}
                </div>
              )}
              {stop.kundennotiz && (
                <div className="flex items-center gap-1 text-[10px] text-red-300 bg-red-900/20 rounded px-2 py-1">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  {stop.kundennotiz}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
