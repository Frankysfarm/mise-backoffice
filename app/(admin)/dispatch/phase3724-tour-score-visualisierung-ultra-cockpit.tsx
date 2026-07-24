'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trophy, Bike, MapPin, Clock, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

interface TourStop {
  nr: number;
  adresse: string;
  eta_min: number;
  status: 'ausstehend' | 'unterwegs' | 'geliefert';
}

interface FahrerTour {
  fahrer_id: string;
  fahrer_name: string;
  score: number;
  score_delta: number;
  puenktlichkeit: number;
  lieferzeit_avg: number;
  bewertung_avg: number;
  stopps_gesamt: number;
  stopps_erledigt: number;
  stops: TourStop[];
  alert: boolean;
}

interface FleetKpi {
  fleet_score_avg: number;
  touren_aktiv: number;
  eta_accuracy: number;
  alert_count: number;
}

const MOCK_FLEET: FleetKpi = { fleet_score_avg: 79, touren_aktiv: 4, eta_accuracy: 86, alert_count: 1 };

const MOCK_FAHRER: FahrerTour[] = [
  {
    fahrer_id: 'f1', fahrer_name: 'Lukas M.', score: 91, score_delta: 3, puenktlichkeit: 94, lieferzeit_avg: 18.5, bewertung_avg: 4.8,
    stopps_gesamt: 5, stopps_erledigt: 3, alert: false,
    stops: [
      { nr: 1, adresse: 'Hauptstr. 12', eta_min: 0, status: 'geliefert' },
      { nr: 2, adresse: 'Parkweg 7', eta_min: 0, status: 'geliefert' },
      { nr: 3, adresse: 'Marktplatz 3', eta_min: 0, status: 'geliefert' },
      { nr: 4, adresse: 'Bahnhofstr. 45', eta_min: 8, status: 'unterwegs' },
      { nr: 5, adresse: 'Ringstr. 22', eta_min: 18, status: 'ausstehend' },
    ],
  },
  {
    fahrer_id: 'f2', fahrer_name: 'Sarah K.', score: 74, score_delta: -2, puenktlichkeit: 78, lieferzeit_avg: 22.1, bewertung_avg: 4.5,
    stopps_gesamt: 4, stopps_erledigt: 1, alert: false,
    stops: [
      { nr: 1, adresse: 'Lindenallee 8', eta_min: 0, status: 'geliefert' },
      { nr: 2, adresse: 'Kirchgasse 5', eta_min: 5, status: 'unterwegs' },
      { nr: 3, adresse: 'Tulpenweg 11', eta_min: 15, status: 'ausstehend' },
      { nr: 4, adresse: 'Rosengasse 3', eta_min: 25, status: 'ausstehend' },
    ],
  },
  {
    fahrer_id: 'f3', fahrer_name: 'Tom R.', score: 58, score_delta: -8, puenktlichkeit: 62, lieferzeit_avg: 28.4, bewertung_avg: 3.9,
    stopps_gesamt: 3, stopps_erledigt: 0, alert: true,
    stops: [
      { nr: 1, adresse: 'Bergstr. 14', eta_min: 12, status: 'unterwegs' },
      { nr: 2, adresse: 'Talweg 6', eta_min: 24, status: 'ausstehend' },
      { nr: 3, adresse: 'Wiesenstr. 9', eta_min: 36, status: 'ausstehend' },
    ],
  },
  {
    fahrer_id: 'f4', fahrer_name: 'Mia B.', score: 87, score_delta: 5, puenktlichkeit: 90, lieferzeit_avg: 19.8, bewertung_avg: 4.7,
    stopps_gesamt: 6, stopps_erledigt: 5, alert: false,
    stops: [
      { nr: 1, adresse: 'Seestr. 2', eta_min: 0, status: 'geliefert' },
      { nr: 2, adresse: 'Uferweg 18', eta_min: 0, status: 'geliefert' },
      { nr: 3, adresse: 'Strandpromenade 1', eta_min: 0, status: 'geliefert' },
      { nr: 4, adresse: 'Hafenstr. 33', eta_min: 0, status: 'geliefert' },
      { nr: 5, adresse: 'Dammweg 7', eta_min: 0, status: 'geliefert' },
      { nr: 6, adresse: 'Kanalstr. 4', eta_min: 4, status: 'unterwegs' },
    ],
  },
];

function ScoreRing({ score }: { score: number }) {
  const color = score >= 85 ? '#22c55e' : score >= 70 ? '#f59e0b' : '#ef4444';
  const r = 18;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0">
      <circle cx="22" cy="22" r={r} fill="none" stroke="#e5e7eb" strokeWidth="4" />
      <circle
        cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 22 22)"
      />
      <text x="22" y="26" textAnchor="middle" fontSize="10" fontWeight="bold" fill={color}>{score}</text>
    </svg>
  );
}

export function DispatchPhase3724TourScoreVisualisierungUltraCockpit({ locationId }: { locationId: string | null }) {
  const [fahrer, setFahrer] = useState<FahrerTour[]>(MOCK_FAHRER);
  const [fleet, setFleet] = useState<FleetKpi>(MOCK_FLEET);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/tour-score-visualisierung?location_id=${locationId}`);
      if (res.ok) {
        const d = await res.json();
        if (d.fahrer) setFahrer(d.fahrer);
        if (d.fleet) setFleet(d.fleet);
      }
    } catch {
      // Mock-Fallback
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, [load]);

  const sorted = [...fahrer].sort((a, b) => b.score - a.score);
  const fleetColor = fleet.fleet_score_avg >= 85 ? 'text-emerald-600' : fleet.fleet_score_avg >= 70 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          <span className="font-semibold text-gray-900 text-sm">Tour-Score Visualisierung Ultra</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-gray-500">{fleet.touren_aktiv} aktive Touren</span>
          <span className={`font-bold ${fleetColor}`}>Flotte Ø {fleet.fleet_score_avg}</span>
        </div>
      </div>

      {/* Flotten-KPIs */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="bg-gray-50 rounded-lg p-2">
          <div className={`text-base font-black ${fleetColor}`}>{fleet.fleet_score_avg}</div>
          <div className="text-[10px] text-gray-500">Ø Score</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="text-base font-black text-gray-800">{fleet.touren_aktiv}</div>
          <div className="text-[10px] text-gray-500">Aktive</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="text-base font-black text-blue-600">{fleet.eta_accuracy}%</div>
          <div className="text-[10px] text-gray-500">ETA-Genauigkeit</div>
        </div>
        <div className={`rounded-lg p-2 ${fleet.alert_count > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
          <div className={`text-base font-black ${fleet.alert_count > 0 ? 'text-red-600' : 'text-gray-800'}`}>{fleet.alert_count}</div>
          <div className="text-[10px] text-gray-500">Alerts</div>
        </div>
      </div>

      {/* Alert-Strip */}
      {fleet.alert_count > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>{fleet.alert_count} Fahrer mit Score &lt;70 — sofort koordinieren!</span>
        </div>
      )}

      {/* Fahrer-Liste */}
      <div className="space-y-2">
        {sorted.map((f, i) => {
          const isExpanded = expanded === f.fahrer_id;
          const scoreColor = f.score >= 85 ? 'text-emerald-600' : f.score >= 70 ? 'text-yellow-600' : 'text-red-600';
          const borderClass = f.alert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50';

          return (
            <div key={f.fahrer_id} className={`rounded-lg border ${borderClass} overflow-hidden`}>
              <button
                className="w-full flex items-center gap-3 p-2.5 text-left"
                onClick={() => setExpanded(isExpanded ? null : f.fahrer_id)}
              >
                <span className="text-xs font-bold text-gray-400 w-4">#{i + 1}</span>
                <ScoreRing score={f.score} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900 truncate">{f.fahrer_name}</span>
                    {f.score_delta !== 0 && (
                      f.score_delta > 0
                        ? <TrendingUp className="w-3 h-3 text-emerald-500 shrink-0" />
                        : <TrendingDown className="w-3 h-3 text-red-500 shrink-0" />
                    )}
                    {f.alert && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-gray-500 mt-0.5">
                    <span>{f.stopps_erledigt}/{f.stopps_gesamt} Stopps</span>
                    <span>{f.puenktlichkeit}% pünktl.</span>
                    <span>Ø {f.lieferzeit_avg.toFixed(1)}min</span>
                  </div>
                </div>
                {/* Stopp-Dots */}
                <div className="flex gap-1 shrink-0">
                  {f.stops.map(s => (
                    <span key={s.nr} className={`w-2 h-2 rounded-full ${
                      s.status === 'geliefert' ? 'bg-emerald-500' :
                      s.status === 'unterwegs' ? 'bg-blue-500' : 'bg-gray-300'
                    }`} />
                  ))}
                </div>
              </button>

              {/* Score-Balken */}
              <div className="px-2.5 pb-2.5">
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${f.score >= 85 ? 'bg-emerald-500' : f.score >= 70 ? 'bg-yellow-400' : 'bg-red-500'}`}
                    style={{ width: `${f.score}%` }}
                  />
                </div>
              </div>

              {/* Expandiert: Stopp-Details */}
              {isExpanded && (
                <div className="border-t border-gray-200 px-3 py-2 space-y-1.5">
                  <div className="text-[10px] font-bold uppercase text-gray-400 mb-1">Tour-Stopps</div>
                  {f.stops.map(s => (
                    <div key={s.nr} className="flex items-center gap-2 text-xs">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                        s.status === 'geliefert' ? 'bg-emerald-500' :
                        s.status === 'unterwegs' ? 'bg-blue-500' : 'bg-gray-300'
                      }`} />
                      <span className="w-4 text-gray-400 font-mono">#{s.nr}</span>
                      <span className="flex-1 text-gray-700 truncate">{s.adresse}</span>
                      {s.status === 'geliefert' ? (
                        <span className="text-emerald-600 font-medium">geliefert</span>
                      ) : s.status === 'unterwegs' ? (
                        <span className="text-blue-600 font-medium">~{s.eta_min}min</span>
                      ) : (
                        <span className="text-gray-400">~{s.eta_min}min</span>
                      )}
                    </div>
                  ))}
                  <div className="grid grid-cols-3 gap-2 mt-2 text-center text-xs">
                    <div className="bg-white rounded p-1.5">
                      <div className="font-bold text-gray-800">⭐ {f.bewertung_avg.toFixed(1)}</div>
                      <div className="text-[10px] text-gray-500">Bewertung</div>
                    </div>
                    <div className="bg-white rounded p-1.5">
                      <div className="font-bold text-gray-800">{f.puenktlichkeit}%</div>
                      <div className="text-[10px] text-gray-500">Pünktlich</div>
                    </div>
                    <div className="bg-white rounded p-1.5">
                      <div className="font-bold text-gray-800">{f.lieferzeit_avg.toFixed(0)}min</div>
                      <div className="text-[10px] text-gray-500">Ø Lieferzeit</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-[10px] text-gray-400 text-center">Score 0–100 · Farbkodierung grün ≥85 · gelb ≥70 · rot &lt;70 · 20-Sek-Polling</div>
    </div>
  );
}
