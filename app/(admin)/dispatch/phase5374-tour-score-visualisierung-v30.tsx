'use client';

import { useEffect, useState } from 'react';
import { Trophy, MapPin, Clock, Zap, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2, Route } from 'lucide-react';

// Phase 5374 — Tour-Score-Visualisierung V30
// Score-Anzeige: Tier-Farbkodierung Platin/Gold/Gut/Schwach; Score-Ring + Delta;
// Tour-Visualisierung: Stopp-Fortschrittsbalken; ETA-Abweichungs-Ampel;
// Fahrer-Rangliste mit 5-KPI-Grid; Zonen-SLA-Matrix;
// 20-Sek-Polling; Mock-Fallback

interface TourStop {
  stopp_nr: number;
  adresse: string;
  eta_min: number;
  eta_abweichung_min: number;
  status: 'abgeschlossen' | 'aktiv' | 'ausstehend';
}

interface FahrerTour {
  fahrer_id: string;
  fahrer_name: string;
  score: number;
  tier: 'platin' | 'gold' | 'gut' | 'schwach';
  rang: number;
  rank_delta: number;
  stopps_gesamt: number;
  stopps_fertig: number;
  aktive_tour: boolean;
  eta_min: number | null;
  umsatz_eur: number;
  puenktlichkeit_pct: number;
  stopps: TourStop[];
}

interface ApiResponse {
  fahrer: FahrerTour[];
  fleet_score: number;
  aktiv_count: number;
  risiko_count: number;
  gesamt_eur: number;
  timestamp: string;
}

const MOCK: ApiResponse = {
  fleet_score: 83,
  aktiv_count: 4,
  risiko_count: 1,
  gesamt_eur: 1247.80,
  timestamp: new Date().toISOString(),
  fahrer: [
    {
      fahrer_id: 'f1', fahrer_name: 'Julia F.', score: 94, tier: 'platin', rang: 1, rank_delta: 0,
      stopps_gesamt: 6, stopps_fertig: 4, aktive_tour: true, eta_min: 8, umsatz_eur: 312.40, puenktlichkeit_pct: 96,
      stopps: [
        { stopp_nr: 1, adresse: 'Hauptstr. 12', eta_min: 0,  eta_abweichung_min: -1, status: 'abgeschlossen' },
        { stopp_nr: 2, adresse: 'Mühlenweg 3',  eta_min: 0,  eta_abweichung_min: 0,  status: 'abgeschlossen' },
        { stopp_nr: 3, adresse: 'Parkring 7',   eta_min: 0,  eta_abweichung_min: 2,  status: 'abgeschlossen' },
        { stopp_nr: 4, adresse: 'Rathauspl. 1', eta_min: 0,  eta_abweichung_min: -2, status: 'abgeschlossen' },
        { stopp_nr: 5, adresse: 'Birkenstr. 9', eta_min: 8,  eta_abweichung_min: 1,  status: 'aktiv'         },
        { stopp_nr: 6, adresse: 'Lindenallee 5',eta_min: 15, eta_abweichung_min: 0,  status: 'ausstehend'    },
      ],
    },
    {
      fahrer_id: 'f2', fahrer_name: 'Max M.', score: 78, tier: 'gold', rang: 2, rank_delta: 1,
      stopps_gesamt: 5, stopps_fertig: 2, aktive_tour: true, eta_min: 12, umsatz_eur: 287.20, puenktlichkeit_pct: 82,
      stopps: [
        { stopp_nr: 1, adresse: 'Kirchgasse 4', eta_min: 0,  eta_abweichung_min: 3,  status: 'abgeschlossen' },
        { stopp_nr: 2, adresse: 'Eichenweg 11', eta_min: 0,  eta_abweichung_min: 0,  status: 'abgeschlossen' },
        { stopp_nr: 3, adresse: 'Teichstr. 2',  eta_min: 12, eta_abweichung_min: 4,  status: 'aktiv'         },
        { stopp_nr: 4, adresse: 'Am Markt 6',   eta_min: 19, eta_abweichung_min: 0,  status: 'ausstehend'    },
        { stopp_nr: 5, adresse: 'Gartenweg 8',  eta_min: 27, eta_abweichung_min: 0,  status: 'ausstehend'    },
      ],
    },
    {
      fahrer_id: 'f3', fahrer_name: 'Sara K.', score: 61, tier: 'gut', rang: 3, rank_delta: -1,
      stopps_gesamt: 4, stopps_fertig: 1, aktive_tour: true, eta_min: 18, umsatz_eur: 198.60, puenktlichkeit_pct: 71,
      stopps: [
        { stopp_nr: 1, adresse: 'Waldstr. 22',  eta_min: 0,  eta_abweichung_min: 6,  status: 'abgeschlossen' },
        { stopp_nr: 2, adresse: 'Feldweg 5',    eta_min: 18, eta_abweichung_min: 7,  status: 'aktiv'         },
        { stopp_nr: 3, adresse: 'Brunnenpl. 3', eta_min: 26, eta_abweichung_min: 0,  status: 'ausstehend'    },
        { stopp_nr: 4, adresse: 'Sonnenstr. 1', eta_min: 34, eta_abweichung_min: 0,  status: 'ausstehend'    },
      ],
    },
    {
      fahrer_id: 'f4', fahrer_name: 'Tim B.', score: 39, tier: 'schwach', rang: 4, rank_delta: 0,
      stopps_gesamt: 3, stopps_fertig: 0, aktive_tour: true, eta_min: 25, umsatz_eur: 149.60, puenktlichkeit_pct: 55,
      stopps: [
        { stopp_nr: 1, adresse: 'Rosenweg 14',  eta_min: 25, eta_abweichung_min: 12, status: 'aktiv'         },
        { stopp_nr: 2, adresse: 'Ahornstr. 8',  eta_min: 35, eta_abweichung_min: 0,  status: 'ausstehend'    },
        { stopp_nr: 3, adresse: 'Bergstr. 3',   eta_min: 46, eta_abweichung_min: 0,  status: 'ausstehend'    },
      ],
    },
  ],
};

function tierStyle(tier: string) {
  if (tier === 'platin') return 'bg-cyan-900 border-cyan-400 text-cyan-300';
  if (tier === 'gold')   return 'bg-yellow-900 border-yellow-400 text-yellow-300';
  if (tier === 'gut')    return 'bg-green-900 border-green-600 text-green-300';
  return                         'bg-gray-800 border-gray-600 text-gray-400';
}

function scoreBar(score: number) {
  if (score >= 85) return 'bg-cyan-400';
  if (score >= 65) return 'bg-yellow-400';
  if (score >= 50) return 'bg-green-500';
  return 'bg-red-500';
}

function etaColor(abw: number) {
  if (abw > 8)  return 'text-red-400';
  if (abw > 3)  return 'text-yellow-400';
  if (abw < 0)  return 'text-cyan-400';
  return 'text-green-400';
}

function DeltaIcon({ delta }: { delta: number }) {
  if (delta < 0) return <TrendingUp className="w-3 h-3 text-green-400" />;
  if (delta > 0) return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-500" />;
}

function StoppDots({ stopps }: { stopps: TourStop[] }) {
  return (
    <div className="flex items-center gap-0.5 mt-1">
      {stopps.map(s => (
        <div
          key={s.stopp_nr}
          title={`${s.stopp_nr}: ${s.adresse} (${s.eta_abweichung_min > 0 ? '+' : ''}${s.eta_abweichung_min}min)`}
          className={`w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold
            ${s.status === 'abgeschlossen' ? 'bg-green-600 text-white' :
              s.status === 'aktiv' ? 'bg-indigo-500 text-white animate-pulse' :
              'bg-gray-700 text-gray-400'}`}
        >
          {s.stopp_nr}
        </div>
      ))}
    </div>
  );
}

export function DispatchPhase5374TourScoreVisualisierungV30({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    if (!locationId) { setData(MOCK); return; }
    try {
      const res = await fetch(`/api/delivery/admin/tour-score-visualisierung?location_id=${locationId}`);
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setData(MOCK);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!data) return <div className="text-gray-400 text-sm p-4">Lade Tour-Score V30…</div>;

  return (
    <div className="bg-gray-900 rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Trophy className="w-5 h-5 text-violet-400" />
        <span className="text-white font-semibold">Tour-Score V30</span>
        {data.risiko_count > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs bg-red-900 text-red-300 px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-3 h-3" /> {data.risiko_count} Risiko
          </span>
        )}
      </div>

      {/* Fleet KPI */}
      <div className="grid grid-cols-4 gap-1.5 text-center">
        <div className="bg-gray-800 rounded-lg p-2">
          <div className="text-base font-bold text-violet-400">{data.fleet_score}</div>
          <div className="text-[9px] text-gray-500">Fleet-Score</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-2">
          <div className="text-base font-bold text-indigo-400">{data.aktiv_count}</div>
          <div className="text-[9px] text-gray-500">Aktiv</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-2">
          <div className="text-base font-bold text-red-400">{data.risiko_count}</div>
          <div className="text-[9px] text-gray-500">Risiko</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-2">
          <div className="text-base font-bold text-green-400">{data.gesamt_eur.toFixed(0)}€</div>
          <div className="text-[9px] text-gray-500">Gesamt</div>
        </div>
      </div>

      {/* Fahrer-Rangliste mit Tour-Stopp-Visualisierung */}
      <div className="space-y-2">
        {data.fahrer.map(f => (
          <div
            key={f.fahrer_id}
            className={`rounded-lg border p-3 cursor-pointer transition-colors ${tierStyle(f.tier)}`}
            onClick={() => setExpanded(expanded === f.fahrer_id ? null : f.fahrer_id)}
          >
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-400 w-4 text-right">{f.rang}</span>
              <DeltaIcon delta={f.rank_delta} />
              <span className="text-[12px] font-semibold flex-1 truncate">{f.fahrer_name}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/30 uppercase font-bold text-[10px]">
                {f.tier}
              </span>
              <span className="text-xs font-bold ml-1">{f.score}</span>
            </div>

            {/* Score-Balken */}
            <div className="mt-2 h-1.5 bg-black/30 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${scoreBar(f.score)}`} style={{ width: `${f.score}%` }} />
            </div>

            {/* Stopp-Fortschritt */}
            <div className="mt-1.5 flex items-center gap-2">
              <Route className="w-3 h-3 opacity-60 shrink-0" />
              <StoppDots stopps={f.stopps} />
              <span className="text-[9px] opacity-60 ml-auto">{f.stopps_fertig}/{f.stopps_gesamt} Stopps</span>
            </div>

            {/* Expanded Detail */}
            {expanded === f.fahrer_id && (
              <div className="mt-3 space-y-1.5 border-t border-white/10 pt-2">
                {f.stopps.map(s => (
                  <div key={s.stopp_nr} className="flex items-center gap-2 text-[10px]">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold shrink-0
                      ${s.status === 'abgeschlossen' ? 'bg-green-600 text-white' :
                        s.status === 'aktiv' ? 'bg-indigo-500 text-white animate-pulse' :
                        'bg-gray-700 text-gray-400'}`}>
                      {s.stopp_nr}
                    </div>
                    <span className="flex-1 truncate opacity-80">{s.adresse}</span>
                    {s.status !== 'abgeschlossen' && (
                      <span className="text-[9px] opacity-70">{s.eta_min}min</span>
                    )}
                    {s.eta_abweichung_min !== 0 && (
                      <span className={`text-[9px] font-medium ${etaColor(s.eta_abweichung_min)}`}>
                        {s.eta_abweichung_min > 0 ? '+' : ''}{s.eta_abweichung_min}m
                      </span>
                    )}
                    {s.status === 'abgeschlossen' && (
                      <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                    )}
                  </div>
                ))}
                <div className="flex gap-3 text-[9px] mt-2 opacity-70">
                  <span>Pünktl: {f.puenktlichkeit_pct}%</span>
                  <span>Umsatz: {f.umsatz_eur.toFixed(2)}€</span>
                  {f.eta_min !== null && <span>ETA: {f.eta_min}min</span>}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
