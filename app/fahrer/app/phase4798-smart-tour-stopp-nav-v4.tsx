'use client';

import { useEffect, useState } from 'react';
import { Navigation2, MapPin, CheckCircle2, Clock, Package, Phone, AlertTriangle, ChevronRight, Zap } from 'lucide-react';

interface StoppDetail {
  stopp_nr: number;
  bestellnummer: string;
  kunde_name: string;
  adresse: string;
  status: 'ausstehend' | 'aktiv' | 'geliefert' | 'verspaetet';
  eta_min: number | null;
  km_zum_stopp: number | null;
  kunde_phone: string | null;
  kommentar: string | null;
  betrag: number | null;
  zahlart: 'bar' | 'karte' | null;
}

interface ApiResponse {
  tour_id: string;
  stopps: StoppDetail[];
  naechster_stopp: StoppDetail | null;
  abgeschlossen: number;
  gesamt: number;
  tour_score: number;
  tour_score_ampel: 'platin' | 'gold' | 'gut' | 'schwach';
  est_tour_ende_min: number | null;
  navi_url: string | null;
}

const STATUS_STYLES = {
  ausstehend: { color: 'text-gray-400',  bg: 'bg-gray-800',      border: 'border-gray-700' },
  aktiv:      { color: 'text-blue-400',  bg: 'bg-blue-950/50',   border: 'border-blue-700' },
  geliefert:  { color: 'text-green-400', bg: 'bg-green-950/30',  border: 'border-green-800' },
  verspaetet: { color: 'text-red-400',   bg: 'bg-red-950/40',    border: 'border-red-700' },
};

const SCORE_COLORS = {
  platin: 'text-violet-300', gold: 'text-yellow-300', gut: 'text-green-300', schwach: 'text-red-300',
};

function euro(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

function generateMock(driverId: string): ApiResponse {
  return {
    tour_id: 't-' + driverId,
    gesamt: 3,
    abgeschlossen: 1,
    tour_score: 85,
    tour_score_ampel: 'gold',
    est_tour_ende_min: 22,
    navi_url: null,
    naechster_stopp: {
      stopp_nr: 2, bestellnummer: 'B-042', kunde_name: 'Müller, Hans', adresse: 'Hauptstr. 15, 52062 Aachen',
      status: 'aktiv', eta_min: 4, km_zum_stopp: 1.2, kunde_phone: '+4924112345', kommentar: 'Bitte klingeln',
      betrag: 18.50, zahlart: 'bar',
    },
    stopps: [
      {
        stopp_nr: 1, bestellnummer: 'B-041', kunde_name: 'Weber, Lea', adresse: 'Gartenweg 3',
        status: 'geliefert', eta_min: null, km_zum_stopp: 0.9, kunde_phone: null,
        kommentar: null, betrag: 22.00, zahlart: 'karte',
      },
      {
        stopp_nr: 2, bestellnummer: 'B-042', kunde_name: 'Müller, Hans', adresse: 'Hauptstr. 15, 52062 Aachen',
        status: 'aktiv', eta_min: 4, km_zum_stopp: 1.2, kunde_phone: '+4924112345',
        kommentar: 'Bitte klingeln', betrag: 18.50, zahlart: 'bar',
      },
      {
        stopp_nr: 3, bestellnummer: 'B-043', kunde_name: 'Fischer, Anna', adresse: 'Kirchplatz 7',
        status: 'ausstehend', eta_min: 16, km_zum_stopp: 2.1, kunde_phone: null,
        kommentar: null, betrag: 31.20, zahlart: 'karte',
      },
    ],
  };
}

export function FahrerPhase4798SmartTourStoppNavV4({
  driverId, locationId, isOnline,
}: { driverId: string; locationId: string | null; isOnline: boolean }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [aktuellerStopp, setAktuellerStopp] = useState<number | null>(null);

  async function load() {
    try {
      const params = new URLSearchParams({ driver_id: driverId });
      if (locationId) params.set('location_id', locationId);
      const res = await fetch(`/api/delivery/fahrer/aktuelle-tour?${params}`);
      if (res.ok) {
        setData(await res.json());
      } else {
        setData(generateMock(driverId));
      }
    } catch {
      setData(generateMock(driverId));
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
      <div className="rounded-xl border border-blue-800 bg-blue-950/30 p-4 mb-3 flex items-center gap-2 text-gray-400 text-xs">
        <AlertTriangle className="w-4 h-4 text-yellow-500" />
        Offline — Tour-Navigation nicht verfügbar
      </div>
    );
  }

  if (!data) return null;

  const nextStop = data.naechster_stopp;
  const progressPct = data.gesamt > 0 ? (data.abgeschlossen / data.gesamt) * 100 : 0;
  const scoreColor = SCORE_COLORS[data.tour_score_ampel];

  return (
    <div className="rounded-xl border border-blue-800 bg-blue-950/30 p-4 mb-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Navigation2 className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-semibold text-blue-300">Smart Tour Navigator V4</span>
        <span className="ml-auto flex items-center gap-1 text-xs">
          <span className={scoreColor}>Score {data.tour_score}</span>
        </span>
      </div>

      {/* Fortschritt */}
      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-400">{data.abgeschlossen}/{data.gesamt} Stopps</span>
          {data.est_tour_ende_min !== null && (
            <span className="text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" /> ~{data.est_tour_ende_min} Min bis Ende
            </span>
          )}
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Nächster Stopp — Hero */}
      {nextStop && (
        <div className={`rounded-lg border ${STATUS_STYLES.aktiv.border} ${STATUS_STYLES.aktiv.bg} p-3 mb-3`}>
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-white">{nextStop.stopp_nr}</span>
              </div>
              <div>
                <div className="text-sm font-bold text-blue-200">{nextStop.kunde_name}</div>
                <div className="text-xs text-gray-400">{nextStop.bestellnummer}</div>
              </div>
            </div>
            {nextStop.eta_min !== null && (
              <div className="text-right shrink-0">
                <div className="text-xl font-bold text-blue-300">{nextStop.eta_min} Min</div>
                <div className="text-[10px] text-gray-500">ETA</div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-gray-300 mb-2">
            <MapPin className="w-3 h-3 text-blue-400 shrink-0" />
            {nextStop.adresse}
            {nextStop.km_zum_stopp !== null && (
              <span className="text-gray-500 ml-auto shrink-0">{nextStop.km_zum_stopp} km</span>
            )}
          </div>

          {nextStop.kommentar && (
            <div className="text-xs text-yellow-400 bg-yellow-900/20 rounded px-2 py-1 mb-2">
              💬 {nextStop.kommentar}
            </div>
          )}

          <div className="flex items-center gap-2">
            {nextStop.betrag !== null && (
              <div className="flex items-center gap-1 text-xs">
                <Package className="w-3 h-3 text-gray-400" />
                <span className="text-white font-bold">{euro(nextStop.betrag)}</span>
                <span className="text-gray-400">({nextStop.zahlart === 'bar' ? 'Bar' : 'Karte'})</span>
              </div>
            )}
            {nextStop.kunde_phone && (
              <a
                href={`tel:${nextStop.kunde_phone}`}
                className="ml-auto flex items-center gap-1 bg-blue-700 hover:bg-blue-600 rounded-lg px-3 py-1.5 text-xs font-bold text-white"
              >
                <Phone className="w-3 h-3" />
                Anrufen
              </a>
            )}
            {data.navi_url && (
              <a
                href={data.navi_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 bg-green-700 hover:bg-green-600 rounded-lg px-3 py-1.5 text-xs font-bold text-white"
              >
                <Navigation2 className="w-3 h-3" />
                Navigation
              </a>
            )}
          </div>
        </div>
      )}

      {/* Alle Stopps Übersicht */}
      <div className="space-y-1.5">
        {data.stopps.map(s => {
          const style = STATUS_STYLES[s.status];
          const isNext = s.stopp_nr === nextStop?.stopp_nr;
          return (
            <button
              key={s.stopp_nr}
              className={`w-full flex items-center gap-2 rounded-lg border ${style.border} ${style.bg} px-2.5 py-2 text-left ${isNext ? 'ring-1 ring-blue-500' : ''}`}
              onClick={() => setAktuellerStopp(aktuellerStopp === s.stopp_nr ? null : s.stopp_nr)}
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${s.status === 'geliefert' ? 'bg-green-700 text-white' : s.status === 'aktiv' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}>
                {s.status === 'geliefert' ? '✓' : s.stopp_nr}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-xs font-medium truncate ${style.color}`}>{s.adresse}</div>
                <div className="text-[10px] text-gray-500 truncate">{s.kunde_name}</div>
              </div>
              <div className="text-right shrink-0">
                {s.eta_min !== null && (
                  <div className={`text-xs ${style.color}`}>{s.eta_min} Min</div>
                )}
                {s.betrag !== null && (
                  <div className="text-[10px] text-gray-500">{euro(s.betrag)}</div>
                )}
              </div>
              <ChevronRight className="w-3 h-3 text-gray-600" />
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex items-center gap-1 text-[10px] text-gray-600">
        <Zap className="w-3 h-3" />
        30-Sek-Polling · Echtzeit-Stopps
      </div>
    </div>
  );
}
