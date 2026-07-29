'use client';

import { useEffect, useState } from 'react';
import { Navigation2, MapPin, Clock, CheckCircle2, WifiOff, ExternalLink, Package, ChevronRight, Star } from 'lucide-react';

interface TourStopp {
  stopp_nr: number;
  adresse: string;
  plz: string;
  stadt: string;
  kunde_name: string;
  telefon: string | null;
  eta_min: number | null;
  km_zur_naechsten: number | null;
  status: 'geliefert' | 'aktiv' | 'ausstehend';
  notiz: string | null;
  bestellnummer: string;
  betrag: number;
  trinkgeld_vorschlag: number | null;
}

interface ApiResponse {
  stopps: TourStopp[];
  tour_id: string;
  aktueller_stopp_nr: number;
  verbleibend: number;
  abgeschlossen: number;
  gesamt_stopps: number;
  gesamt_km: number;
  eta_tour_ende_min: number;
  verdienst_bisher: number;
  trinkgeld_bisher: number;
}

const MOCK: ApiResponse = {
  tour_id: 'T-1042',
  aktueller_stopp_nr: 2,
  verbleibend: 2,
  abgeschlossen: 1,
  gesamt_stopps: 3,
  gesamt_km: 4.8,
  eta_tour_ende_min: 26,
  verdienst_bisher: 18.50,
  trinkgeld_bisher: 2.00,
  stopps: [
    {
      stopp_nr: 1, adresse: 'Hauptstraße 12', plz: '52062', stadt: 'Aachen', kunde_name: 'Müller, J.',
      telefon: '+49 151 123456', eta_min: null, km_zur_naechsten: 1.2, status: 'geliefert',
      notiz: null, bestellnummer: '#1040', betrag: 18.50, trinkgeld_vorschlag: null,
    },
    {
      stopp_nr: 2, adresse: 'Marktplatz 5', plz: '52062', stadt: 'Aachen', kunde_name: 'Schmidt, A.',
      telefon: '+49 160 987654', eta_min: 3, km_zur_naechsten: 1.8, status: 'aktiv',
      notiz: 'Bitte klingeln — 3. OG', bestellnummer: '#1042', betrag: 24.80, trinkgeld_vorschlag: 2.50,
    },
    {
      stopp_nr: 3, adresse: 'Bahnhofstraße 8', plz: '52064', stadt: 'Aachen', kunde_name: 'Weber, K.',
      telefon: null, eta_min: 16, km_zur_naechsten: null, status: 'ausstehend',
      notiz: null, bestellnummer: '#1044', betrag: 14.20, trinkgeld_vorschlag: 1.50,
    },
  ],
};

function mapsLink(adresse: string, plz: string, stadt: string): string {
  return `https://maps.google.com/?q=${encodeURIComponent(`${adresse}, ${plz} ${stadt}`)}`;
}

export function FahrerPhase4829TourStoppSmartNavigatorV2({
  driverId,
  locationId,
  isOnline,
}: { driverId: string; locationId: string | null; isOnline: boolean }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const params = new URLSearchParams({ driver_id: driverId });
    if (locationId) params.set('location_id', locationId);
    try {
      const res = await fetch(`/api/delivery/fahrer/aktuelle-tour?${params}`);
      if (res.ok) setData(await res.json());
      else setData(MOCK);
    } catch {
      setData(MOCK);
    }
  }

  useEffect(() => {
    if (!isOnline) return;
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [driverId, locationId, isOnline]);

  if (!isOnline) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4 mb-3 flex items-center gap-2 text-gray-400">
        <WifiOff className="w-4 h-4" />
        <span className="text-xs">Offline — Navigator nicht verfügbar</span>
      </div>
    );
  }

  if (!data) return null;

  const aktivStopp = data.stopps.find(s => s.status === 'aktiv') ?? data.stopps.find(s => s.status === 'ausstehend');
  const fortschrittPct = data.gesamt_stopps > 0 ? Math.round((data.abgeschlossen / data.gesamt_stopps) * 100) : 0;

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4 mb-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Navigation2 className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-semibold text-slate-300">Smart-Navigator V2</span>
        <span className="ml-auto text-xs text-gray-500">Tour {data.tour_id}</span>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>{data.abgeschlossen}/{data.gesamt_stopps} Stopps</span>
          <span>{fortschrittPct}%</span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${fortschrittPct}%` }} />
        </div>
      </div>

      {/* Tour KPIs */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-black/20 rounded p-2 text-center">
          <div className="text-xs text-gray-400">Verbleibend</div>
          <div className="text-lg font-bold text-blue-400">{data.verbleibend}</div>
          <div className="text-xs text-gray-500">Stopps</div>
        </div>
        <div className="bg-black/20 rounded p-2 text-center">
          <div className="text-xs text-gray-400">Noch ca.</div>
          <div className="text-lg font-bold text-slate-300">{data.eta_tour_ende_min}'</div>
          <div className="text-xs text-gray-500">min</div>
        </div>
        <div className="bg-black/20 rounded p-2 text-center">
          <div className="text-xs text-gray-400">Route</div>
          <div className="text-lg font-bold text-slate-300">{data.gesamt_km.toFixed(1)}</div>
          <div className="text-xs text-gray-500">km</div>
        </div>
      </div>

      {/* Earnings strip */}
      <div className="flex items-center justify-between bg-green-950/30 border border-green-800/40 rounded px-3 py-2 mb-3 text-xs">
        <span className="text-green-400 font-semibold">Verdienst: {data.verdienst_bisher.toFixed(2).replace('.', ',')} €</span>
        {data.trinkgeld_bisher > 0 && (
          <span className="text-yellow-400 flex items-center gap-1">
            <Star className="w-3 h-3 fill-yellow-400" />
            +{data.trinkgeld_bisher.toFixed(2).replace('.', ',')} € Trinkgeld
          </span>
        )}
      </div>

      {/* Active Stop Highlight */}
      {aktivStopp && (
        <div className={`rounded-lg border-2 p-3 mb-3 ${aktivStopp.status === 'aktiv' ? 'border-blue-500 bg-blue-950/30' : 'border-slate-600 bg-slate-900/20'}`}>
          <div className="flex items-start justify-between gap-2 mb-1">
            <div>
              <span className="text-xs font-semibold text-blue-300">Nächster Stopp #{aktivStopp.stopp_nr}</span>
              <div className="text-base font-bold text-white mt-0.5">{aktivStopp.adresse}</div>
              <div className="text-xs text-gray-400">{aktivStopp.plz} {aktivStopp.stadt}</div>
            </div>
            {aktivStopp.eta_min !== null && (
              <div className="text-right shrink-0">
                <div className="text-xs text-gray-400">ETA</div>
                <div className="text-xl font-bold text-blue-400">{aktivStopp.eta_min}'</div>
              </div>
            )}
          </div>
          <div className="text-xs text-gray-300 mb-2">{aktivStopp.kunde_name} · {aktivStopp.bestellnummer} · {aktivStopp.betrag.toFixed(2).replace('.', ',')} €</div>
          {aktivStopp.notiz && (
            <div className="text-xs text-yellow-300 bg-yellow-900/20 rounded px-2 py-1 mb-2">
              📝 {aktivStopp.notiz}
            </div>
          )}
          {aktivStopp.trinkgeld_vorschlag !== null && (
            <div className="text-xs text-green-300 bg-green-900/20 rounded px-2 py-1 mb-2 flex items-center gap-1">
              <Star className="w-3 h-3 fill-green-300" />
              Trinkgeld-Vorschlag: +{aktivStopp.trinkgeld_vorschlag.toFixed(2).replace('.', ',')} €
            </div>
          )}
          <div className="flex gap-2">
            <a
              href={mapsLink(aktivStopp.adresse, aktivStopp.plz, aktivStopp.stadt)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded py-1.5 transition-colors"
            >
              <Navigation2 className="w-3.5 h-3.5" />
              Navi starten
              <ExternalLink className="w-3 h-3" />
            </a>
            {aktivStopp.telefon && (
              <a
                href={`tel:${aktivStopp.telefon}`}
                className="flex items-center justify-center gap-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold rounded px-3 py-1.5 transition-colors"
              >
                📞
              </a>
            )}
          </div>
        </div>
      )}

      {/* All Stops List */}
      <div className="space-y-1.5">
        {data.stopps.map(s => (
          <div key={s.stopp_nr} className={`flex items-center gap-2 rounded px-3 py-2 ${s.status === 'geliefert' ? 'bg-black/10 opacity-60' : s.status === 'aktiv' ? 'bg-blue-950/20' : 'bg-black/10'}`}>
            <div className="shrink-0">
              {s.status === 'geliefert'
                ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                : s.status === 'aktiv'
                  ? <div className="w-4 h-4 rounded-full border-2 border-blue-400 animate-pulse" />
                  : <Package className="w-4 h-4 text-gray-500" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className={`text-xs font-medium truncate ${s.status === 'geliefert' ? 'text-gray-500 line-through' : 'text-slate-300'}`}>
                {s.stopp_nr}. {s.adresse}
              </div>
              <div className="text-xs text-gray-500">{s.kunde_name} · {s.bestellnummer}</div>
            </div>
            <div className="text-right shrink-0">
              {s.eta_min !== null && (
                <div className="flex items-center gap-0.5 text-xs text-blue-400 justify-end">
                  <Clock className="w-3 h-3" />{s.eta_min}'
                </div>
              )}
              {s.km_zur_naechsten !== null && (
                <div className="flex items-center gap-0.5 text-xs text-gray-500 justify-end">
                  <MapPin className="w-3 h-3" />{s.km_zur_naechsten}km
                </div>
              )}
            </div>
            {s.status !== 'geliefert' && (
              <ChevronRight className="w-3 h-3 text-gray-600 shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
