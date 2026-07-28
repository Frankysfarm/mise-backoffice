'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapPin, Navigation, CheckCircle, AlertTriangle, Clock, Package, Phone, ChevronDown, ChevronUp, Zap } from 'lucide-react';

interface TourStopp {
  id: string;
  stopp_nr: number;
  adresse: string;
  kunden_name: string;
  kunden_telefon: string | null;
  bestellnummer: string;
  status: 'ausstehend' | 'unterwegs' | 'geliefert' | 'problem';
  eta_min: number | null;
  notiz: string | null;
  lat: number | null;
  lng: number | null;
  zahlungsart: 'bar' | 'karte' | 'online';
  betrag_eur: number;
}

interface ApiData {
  tour_id: string;
  stops: TourStopp[];
  aktueller_stopp_idx: number;
  score: number;
  puenktlichkeit_pct: number;
  eta_depot_min: number | null;
}

const MOCK: ApiData = {
  tour_id: 'tour-abc',
  aktueller_stopp_idx: 1,
  score: 88,
  puenktlichkeit_pct: 91,
  eta_depot_min: 42,
  stops: [
    {
      id: 's1', stopp_nr: 1, adresse: 'Habsburgerallee 12, Aachen', kunden_name: 'Anna M.', kunden_telefon: '+49 241 1234567',
      bestellnummer: 'FF-2041', status: 'geliefert', eta_min: null, notiz: null, lat: 50.7753, lng: 6.0839,
      zahlungsart: 'online', betrag_eur: 18.50,
    },
    {
      id: 's2', stopp_nr: 2, adresse: 'Pontstraße 47, Aachen', kunden_name: 'Ben K.', kunden_telefon: '+49 241 9876543',
      bestellnummer: 'FF-2042', status: 'unterwegs', eta_min: 5, notiz: '3. Etage, kein Aufzug', lat: 50.7745, lng: 6.0919,
      zahlungsart: 'bar', betrag_eur: 24.00,
    },
    {
      id: 's3', stopp_nr: 3, adresse: 'Jülicher Str. 3, Aachen', kunden_name: 'Clara S.', kunden_telefon: null,
      bestellnummer: 'FF-2043', status: 'ausstehend', eta_min: 16, notiz: null, lat: 50.7821, lng: 6.0750,
      zahlungsart: 'karte', betrag_eur: 31.80,
    },
    {
      id: 's4', stopp_nr: 4, adresse: 'Boxgraben 80, Aachen', kunden_name: 'David R.', kunden_telefon: '+49 241 1112233',
      bestellnummer: 'FF-2044', status: 'ausstehend', eta_min: 28, notiz: 'Bitte klingeln: Schmidt', lat: 50.7698, lng: 6.0901,
      zahlungsart: 'online', betrag_eur: 15.20,
    },
  ],
};

const STATUS_STYLE: Record<TourStopp['status'], { dot: string; label: string; card: string }> = {
  ausstehend: { dot: 'bg-gray-300 dark:bg-gray-600',    label: 'Ausstehend', card: 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900' },
  unterwegs:  { dot: 'bg-blue-500 animate-pulse',       label: 'Aktiv',      card: 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30' },
  geliefert:  { dot: 'bg-emerald-500',                  label: 'Geliefert',  card: 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 opacity-70' },
  problem:    { dot: 'bg-red-500 animate-pulse',        label: 'Problem',    card: 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30' },
};

const ZAHLUNG: Record<TourStopp['zahlungsart'], { icon: string; color: string }> = {
  bar:    { icon: '💵', color: 'text-green-600 dark:text-green-400' },
  karte:  { icon: '💳', color: 'text-blue-600 dark:text-blue-400' },
  online: { icon: '✅', color: 'text-gray-400' },
};

function openNavigation(stopp: TourStopp) {
  const query = encodeURIComponent(stopp.adresse);
  if (stopp.lat && stopp.lng) {
    window.open(`https://maps.google.com/?q=${stopp.lat},${stopp.lng}`, '_blank');
  } else {
    window.open(`https://maps.google.com/?q=${query}`, '_blank');
  }
}

interface Props { fahrerToken: string | null; locationId: string | null }

export function Phase4613SmartTourStoppNavigator({ fahrerToken, locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [expandedId, setExpandedId] = useState<string | null>(MOCK.stops[1]?.id ?? null);

  const load = useCallback(async () => {
    if (!fahrerToken) return;
    try {
      const res = await fetch(`/api/delivery/fahrer/aktive-tour?token=${fahrerToken}`, { cache: 'no-store' });
      if (res.ok) {
        const j = await res.json();
        if (j.stops?.length) setData(j);
      }
    } catch { /* Mock-Fallback */ }
  }, [fahrerToken]);

  useEffect(() => { load(); const iv = setInterval(load, 30_000); return () => clearInterval(iv); }, [load]);

  const pending = data.stops.filter(s => s.status !== 'geliefert');
  const done    = data.stops.filter(s => s.status === 'geliefert').length;

  const scoreColor = data.score >= 80 ? 'text-emerald-600 dark:text-emerald-400' : data.score >= 65 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400';

  return (
    <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="bg-indigo-600 dark:bg-indigo-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation className="h-5 w-5 text-white" />
          <span className="font-semibold text-white text-sm">Tour-Navigation</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-indigo-200">{done}/{data.stops.length} geliefert</span>
          <span className={`font-bold text-sm ${scoreColor}`}>{data.score}pt</span>
        </div>
      </div>

      {/* Fortschrittsbalken */}
      <div className="h-1.5 bg-gray-200 dark:bg-gray-700">
        <div
          className="h-full bg-indigo-500 transition-all duration-500"
          style={{ width: `${data.stops.length > 0 ? (done / data.stops.length) * 100 : 0}%` }}
        />
      </div>

      {/* Timeline */}
      <div className="p-3 space-y-2">
        {data.stops.map((s, i) => {
          const st = STATUS_STYLE[s.status];
          const isExpanded = expandedId === s.id;
          const isAktiv = s.status === 'unterwegs';
          const z = ZAHLUNG[s.zahlungsart];

          return (
            <div key={s.id} className={`rounded-lg border ${st.card} overflow-hidden`}>
              <button
                className="w-full text-left p-3 flex items-center gap-3"
                onClick={() => setExpandedId(isExpanded ? null : s.id)}
              >
                {/* Stop-Nummer mit Verbindungslinie */}
                <div className="flex flex-col items-center flex-shrink-0">
                  <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${isAktiv ? 'bg-blue-600 text-white' : s.status === 'geliefert' ? 'bg-emerald-500 text-white' : s.status === 'problem' ? 'bg-red-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                    {s.status === 'geliefert' ? '✓' : s.stopp_nr}
                  </span>
                  {i < data.stops.length - 1 && (
                    <div className={`w-0.5 h-4 mt-1 ${s.status === 'geliefert' ? 'bg-emerald-300 dark:bg-emerald-700' : 'bg-gray-200 dark:bg-gray-700'}`} />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{s.kunden_name}</span>
                    {isAktiv && <span className="text-xs rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 font-medium">Aktiv</span>}
                    <span className={`text-xs ${z.color}`}>{z.icon}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{s.adresse}</p>
                </div>

                <div className="flex flex-col items-end gap-1">
                  {s.eta_min !== null && s.status !== 'geliefert' && (
                    <span className="text-xs font-mono font-semibold text-gray-600 dark:text-gray-300">~{s.eta_min}min</span>
                  )}
                  {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-gray-400" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
                </div>
              </button>

              {/* Aufgeklappte Details */}
              {isExpanded && (
                <div className="border-t border-gray-100 dark:border-gray-800 px-3 pb-3 pt-2 space-y-2 bg-gray-50/80 dark:bg-gray-800/30">
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                    <span><Package className="h-3 w-3 inline mr-0.5" />{s.bestellnummer}</span>
                    <span className={z.color}>{z.icon} {s.betrag_eur.toFixed(2)} €</span>
                  </div>
                  {s.notiz && (
                    <p className="text-xs rounded bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300 px-2 py-1">
                      📝 {s.notiz}
                    </p>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    {s.status !== 'geliefert' && (
                      <button
                        onClick={() => openNavigation(s)}
                        className="flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-3 py-1.5 active:scale-95 transition-all"
                      >
                        <Navigation className="h-3.5 w-3.5" /> Navigieren
                      </button>
                    )}
                    {s.kunden_telefon && (
                      <a
                        href={`tel:${s.kunden_telefon}`}
                        className="flex items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-medium px-3 py-1.5 active:scale-95 transition-all"
                      >
                        <Phone className="h-3.5 w-3.5" /> Anrufen
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Depot-Rückkehr */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-2.5 flex items-center gap-2">
          <span className="h-5 w-5 rounded-full bg-gray-700 dark:bg-gray-300 flex-shrink-0" />
          <span className="text-xs text-gray-600 dark:text-gray-300 font-medium flex-1">Depot</span>
          {data.eta_depot_min && (
            <span className="text-xs text-gray-400 font-mono">~{data.eta_depot_min}min</span>
          )}
        </div>
      </div>

      {/* Score-Leiste */}
      <div className="border-t border-gray-100 dark:border-gray-800 px-3 py-2 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/20">
        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          <Zap className="h-3 w-3 text-indigo-400" />
          Schicht-Score
        </div>
        <div className="flex items-center gap-2">
          <div className="w-20 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${data.score >= 80 ? 'bg-emerald-500' : data.score >= 65 ? 'bg-yellow-400' : 'bg-red-500'}`}
              style={{ width: `${data.score}%` }}
            />
          </div>
          <span className={`text-xs font-bold ${scoreColor}`}>{data.score}/100</span>
        </div>
      </div>
    </div>
  );
}
