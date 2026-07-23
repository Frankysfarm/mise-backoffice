'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Clock, MapPin, Navigation, Phone, Zap } from 'lucide-react';

interface Stopp {
  id: string;
  nr: number;
  adresse: string;
  kunde_name: string;
  kunde_telefon: string | null;
  eta_min: number | null;
  distanz_km: number;
  status: 'ausstehend' | 'aktiv' | 'abgeschlossen' | 'problem';
  sonderwunsch: string | null;
  bestellsumme: number;
  trinkgeld: number | null;
}

interface Tour {
  tour_id: string;
  stopps: Stopp[];
  gesamt_km: number;
  gesamt_eta_min: number;
  abgeschlossen: number;
  score: number;
}

const MOCK: Tour = {
  tour_id: 't1',
  gesamt_km: 8.4,
  gesamt_eta_min: 42,
  abgeschlossen: 2,
  score: 87,
  stopps: [
    {
      id: 's1', nr: 1, adresse: 'Hauptstr. 12, Aachen', kunde_name: 'Anna K.', kunde_telefon: null,
      eta_min: null, distanz_km: 1.2, status: 'abgeschlossen', sonderwunsch: null, bestellsumme: 18.90, trinkgeld: 2.00,
    },
    {
      id: 's2', nr: 2, adresse: 'Bahnhofstr. 5, Aachen', kunde_name: 'Tom L.', kunde_telefon: null,
      eta_min: null, distanz_km: 0.8, status: 'abgeschlossen', sonderwunsch: null, bestellsumme: 24.50, trinkgeld: 3.00,
    },
    {
      id: 's3', nr: 3, adresse: 'Marktplatz 3, Aachen', kunde_name: 'Lea W.', kunde_telefon: '+4917612345',
      eta_min: 4, distanz_km: 1.5, status: 'aktiv', sonderwunsch: 'Bitte klingeln!', bestellsumme: 31.20, trinkgeld: null,
    },
    {
      id: 's4', nr: 4, adresse: 'Gartenweg 7, Aachen', kunde_name: 'Ben S.', kunde_telefon: null,
      eta_min: 14, distanz_km: 2.1, status: 'ausstehend', sonderwunsch: null, bestellsumme: 15.80, trinkgeld: null,
    },
    {
      id: 's5', nr: 5, adresse: 'Ringstr. 22, Aachen', kunde_name: 'Mia F.', kunde_telefon: '+4917698765',
      eta_min: 24, distanz_km: 1.9, status: 'ausstehend', sonderwunsch: 'Hinterhof, 2. Klingel', bestellsumme: 42.00, trinkgeld: null,
    },
  ],
};

function statusFarbe(status: Stopp['status']): string {
  switch (status) {
    case 'abgeschlossen': return 'text-green-400';
    case 'aktiv': return 'text-blue-400';
    case 'ausstehend': return 'text-gray-400';
    case 'problem': return 'text-red-400';
  }
}

function statusIcon(status: Stopp['status']) {
  switch (status) {
    case 'abgeschlossen': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'aktiv': return <Navigation className="h-4 w-4 text-blue-400 animate-pulse" />;
    case 'ausstehend': return <Clock className="h-4 w-4 text-gray-500" />;
    case 'problem': return <AlertTriangle className="h-4 w-4 text-red-500" />;
  }
}

export function FahrerPhase3320TourStoppNavigationHubUltimate({ tourId }: { tourId?: string | null }) {
  const [tour, setTour] = useState<Tour | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const load = () =>
      fetch(`/api/delivery/fahrer/aktive-tour?tour_id=${tourId ?? ''}`)
        .then(r => r.json())
        .then((d: Tour) => setTour(d))
        .catch(() => setTour(MOCK));
    if (tourId) load(); else setTour(MOCK);
    const poll = setInterval(load, 20_000);
    return () => clearInterval(poll);
  }, [tourId]);

  const t = tour ?? MOCK;
  const aktiverStopp = t.stopps.find(s => s.status === 'aktiv');
  const fortschritt = Math.round((t.abgeschlossen / t.stopps.length) * 100);

  return (
    <div className="rounded-xl bg-gray-900 border border-gray-700 overflow-hidden shadow-lg">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-blue-400" />
          <span className="text-sm font-bold text-white">Tour-Stopps Navigator</span>
          <span className="rounded-full bg-blue-800 px-2 py-0.5 text-[10px] font-bold text-blue-200">
            {t.abgeschlossen}/{t.stopps.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400">{t.gesamt_km.toFixed(1)} km</span>
          <span className="text-[10px] text-gray-500">•</span>
          <span className="text-[10px] text-gray-400">~{t.gesamt_eta_min}min</span>
          <div className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${
            t.score >= 80 ? 'bg-green-800 text-green-200' : t.score >= 65 ? 'bg-amber-800 text-amber-200' : 'bg-red-800 text-red-200'
          }`}>
            Score {t.score}
          </div>
        </div>
      </div>

      {/* Fortschrittsbalken */}
      <div className="px-4 py-2 border-b border-gray-700/50">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full bg-gray-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
              style={{ width: `${fortschritt}%` }}
            />
          </div>
          <span className="text-[10px] text-gray-400 shrink-0">{fortschritt}%</span>
        </div>
      </div>

      {/* Aktiver Stopp Banner */}
      {aktiverStopp && (
        <div className="mx-3 mt-3 rounded-lg bg-blue-900/40 border border-blue-500/50 px-3 py-2.5">
          <div className="flex items-center gap-2 mb-1">
            <Navigation className="h-3.5 w-3.5 text-blue-400 animate-pulse" />
            <span className="text-[11px] font-bold text-blue-300">Aktueller Stopp #{aktiverStopp.nr}</span>
            {aktiverStopp.eta_min !== null && (
              <span className="ml-auto text-[11px] font-bold text-blue-200">{aktiverStopp.eta_min} min</span>
            )}
          </div>
          <div className="flex items-start gap-1.5">
            <MapPin className="h-3 w-3 text-blue-400 mt-0.5 shrink-0" />
            <span className="text-xs text-white font-medium">{aktiverStopp.adresse}</span>
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-[10px] text-blue-300">{aktiverStopp.kunde_name}</span>
            {aktiverStopp.sonderwunsch && (
              <span className="flex items-center gap-1 text-[10px] text-yellow-300">
                <Zap className="h-2.5 w-2.5" />{aktiverStopp.sonderwunsch}
              </span>
            )}
            {aktiverStopp.kunde_telefon && (
              <a href={`tel:${aktiverStopp.kunde_telefon}`} className="ml-auto">
                <Phone className="h-3.5 w-3.5 text-green-400" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Alle Stopps */}
      <div className="p-3 space-y-1.5">
        {t.stopps.map(stopp => {
          const isExpanded = expanded === stopp.id;
          const isAktiv = stopp.status === 'aktiv';

          return (
            <div
              key={stopp.id}
              className={`rounded-lg border overflow-hidden transition-all ${
                isAktiv ? 'border-blue-600/60 bg-blue-950/20' : 'border-gray-700 bg-gray-800/40'
              } ${stopp.status === 'abgeschlossen' ? 'opacity-60' : ''}`}
            >
              <button
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-800/40 transition-colors"
                onClick={() => setExpanded(isExpanded ? null : stopp.id)}
              >
                <span className="text-[10px] text-gray-500 w-4 shrink-0">{stopp.nr}.</span>
                {statusIcon(stopp.status)}
                <div className="flex-1 text-left min-w-0">
                  <div className="text-xs text-white font-medium truncate">{stopp.adresse}</div>
                  <div className="text-[10px] text-gray-500 truncate">{stopp.kunde_name}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {stopp.eta_min !== null && (
                    <span className={`text-[10px] font-bold ${statusFarbe(stopp.status)}`}>{stopp.eta_min}min</span>
                  )}
                  {stopp.status === 'abgeschlossen' && stopp.trinkgeld && (
                    <span className="text-[10px] text-yellow-400">+{stopp.trinkgeld.toFixed(2)}€</span>
                  )}
                  {isExpanded ? <ChevronUp className="h-3 w-3 text-gray-600" /> : <ChevronDown className="h-3 w-3 text-gray-600" />}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-gray-700/50 px-3 py-2 space-y-1">
                  <div className="flex items-center gap-2 text-[10px] text-gray-400">
                    <MapPin className="h-2.5 w-2.5" />
                    <span>{stopp.distanz_km.toFixed(1)} km entfernt</span>
                    <span>•</span>
                    <span>{stopp.bestellsumme.toFixed(2)} €</span>
                  </div>
                  {stopp.sonderwunsch && (
                    <div className="flex items-center gap-1 text-[10px] text-yellow-300">
                      <Zap className="h-2.5 w-2.5" />
                      <span>{stopp.sonderwunsch}</span>
                    </div>
                  )}
                  {stopp.kunde_telefon && (
                    <a
                      href={`tel:${stopp.kunde_telefon}`}
                      className="flex items-center gap-1 text-[10px] text-green-400 hover:underline"
                    >
                      <Phone className="h-2.5 w-2.5" />{stopp.kunde_telefon}
                    </a>
                  )}
                  {stopp.status !== 'abgeschlossen' && (
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(stopp.adresse)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] text-blue-400 hover:underline"
                    >
                      <Navigation className="h-2.5 w-2.5" />In Google Maps öffnen
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="px-4 pb-3 flex items-center justify-between text-[9px] text-gray-600">
        <Clock className="h-2.5 w-2.5" />
        <span>20-Sek-Polling</span>
      </div>
    </div>
  );
}
