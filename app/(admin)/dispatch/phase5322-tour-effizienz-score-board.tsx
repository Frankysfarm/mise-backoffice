'use client';

import { useEffect, useState } from 'react';
import { Route, TrendingUp, TrendingDown, Euro, MapPin, Clock, Zap, AlertTriangle, Trophy } from 'lucide-react';

// Phase 5322 — Tour-Effizienz-Score-Board
// Neu: Gesamtflotten-Score-Ring; €/km-Profitabilität je aktiver Tour;
// Fahrer-Score-Delta (vs. Durchschnitt); SLA-Ampel je Tour;
// Strecken-Effizienz-Balken; Verspätungs-Risiko-Badge;
// 20-Sek-Polling; Mock-Fallback

interface TourScore {
  id: string;
  fahrer_name: string;
  zone: string;
  score: number;
  score_delta: number;
  euro_per_km: number;
  sla_pct: number;
  stopps_gesamt: number;
  stopps_erledigt: number;
  eta_min: number | null;
  verzoegerungs_risiko: 'niedrig' | 'mittel' | 'hoch';
  km_gesamt: number;
  umsatz: number;
}

interface FleetData {
  fleet_score: number;
  fleet_score_delta: number;
  touren_aktiv: number;
  avg_euro_per_km: number;
  avg_sla: number;
  touren: TourScore[];
  timestamp: string;
}

const MOCK: FleetData = {
  fleet_score: 83,
  fleet_score_delta: 4.2,
  touren_aktiv: 4,
  avg_euro_per_km: 3.8,
  avg_sla: 87,
  timestamp: new Date().toISOString(),
  touren: [
    {
      id: 't1', fahrer_name: 'Tim B.',   zone: 'Nord',  score: 94, score_delta: 11,
      euro_per_km: 5.2, sla_pct: 96, stopps_gesamt: 4, stopps_erledigt: 3, eta_min: 8,
      verzoegerungs_risiko: 'niedrig', km_gesamt: 14, umsatz: 73,
    },
    {
      id: 't2', fahrer_name: 'Julia F.', zone: 'Mitte', score: 81, score_delta: -2,
      euro_per_km: 3.6, sla_pct: 85, stopps_gesamt: 3, stopps_erledigt: 1, eta_min: 22,
      verzoegerungs_risiko: 'mittel', km_gesamt: 18, umsatz: 65,
    },
    {
      id: 't3', fahrer_name: 'Kemal A.', zone: 'Süd',   score: 72, score_delta: -8,
      euro_per_km: 2.4, sla_pct: 74, stopps_gesamt: 5, stopps_erledigt: 2, eta_min: 34,
      verzoegerungs_risiko: 'hoch', km_gesamt: 22, umsatz: 53,
    },
    {
      id: 't4', fahrer_name: 'Sara M.',  zone: 'West',  score: 88, score_delta: 5,
      euro_per_km: 4.1, sla_pct: 91, stopps_gesamt: 3, stopps_erledigt: 2, eta_min: 11,
      verzoegerungs_risiko: 'niedrig', km_gesamt: 11, umsatz: 45,
    },
  ],
};

const RISIKO_STYLE: Record<TourScore['verzoegerungs_risiko'], { bg: string; text: string; border: string; label: string }> = {
  niedrig: { bg: 'bg-green-950/30',  text: 'text-green-400',  border: 'border-green-800/50',  label: 'Niedrig' },
  mittel:  { bg: 'bg-yellow-950/30', text: 'text-yellow-400', border: 'border-yellow-700/50', label: 'Mittel'  },
  hoch:    { bg: 'bg-red-950/30',    text: 'text-red-400',    border: 'border-red-700/50',    label: 'Hoch'    },
};

function ScoreRing({ score, size = 48 }: { score: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 85 ? '#22c55e' : score >= 70 ? '#eab308' : '#ef4444';
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1f2937" strokeWidth={6} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={6}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function DispatchPhase5322TourEffizienzScoreBoard({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<FleetData>(MOCK);

  useEffect(() => {
    const load = async () => {
      try {
        const url = locationId
          ? `/api/delivery/dispatch/tour-score?locationId=${locationId}`
          : '/api/delivery/dispatch/tour-score';
        const r = await fetch(url);
        if (r.ok) setData(await r.json());
      } catch { /* mock */ }
    };
    load();
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, [locationId]);

  const hochRisiko = data.touren.filter(t => t.verzoegerungs_risiko === 'hoch').length;

  return (
    <div className="bg-gray-950 border border-matcha-900/40 rounded-2xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Route className="w-5 h-5 text-matcha-400" />
          <span className="font-semibold text-white text-sm">Tour-Effizienz-Board</span>
          <span className="text-xs text-gray-500">Score + Profitabilität</span>
        </div>
        <div className="flex items-center gap-2">
          {data.fleet_score_delta >= 0
            ? <TrendingUp className="w-4 h-4 text-green-400" />
            : <TrendingDown className="w-4 h-4 text-red-400" />}
          <span className={`text-xs font-medium ${data.fleet_score_delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {data.fleet_score_delta >= 0 ? '+' : ''}{data.fleet_score_delta}%
          </span>
        </div>
      </div>

      {/* Fleet-KPI-Grid */}
      <div className="flex items-center gap-4">
        <div className="relative flex items-center justify-center shrink-0">
          <ScoreRing score={data.fleet_score} size={64} />
          <div className="absolute text-center">
            <div className="text-lg font-bold text-white leading-none">{data.fleet_score}</div>
            <div className="text-xs text-gray-500">Fleet</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 flex-1 text-center">
          {[
            { label: 'Touren',    value: data.touren_aktiv, color: 'text-white'        },
            { label: '€/km',      value: data.avg_euro_per_km.toFixed(1), color: 'text-green-400' },
            { label: 'SLA Ø',     value: `${data.avg_sla}%`, color: data.avg_sla >= 85 ? 'text-green-400' : 'text-yellow-400' },
          ].map(k => (
            <div key={k.label} className="bg-gray-900/60 rounded-lg p-2">
              <div className={`text-base font-bold ${k.color}`}>{k.value}</div>
              <div className="text-xs text-gray-500">{k.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Hoch-Risiko-Alert */}
      {hochRisiko > 0 && (
        <div className="flex items-center gap-2 bg-red-950/40 border border-red-700/50 rounded-lg px-3 py-1.5">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span className="text-xs text-red-200">
            <strong>{hochRisiko}</strong> Tour{hochRisiko !== 1 ? 'en' : ''} mit hohem Verspätungsrisiko
          </span>
        </div>
      )}

      {/* Tour-Cards */}
      <div className="space-y-2">
        {data.touren
          .sort((a, b) => b.score - a.score)
          .map((t, i) => {
            const r = RISIKO_STYLE[t.verzoegerungs_risiko];
            const scoreColor = t.score >= 85 ? 'text-green-400' : t.score >= 70 ? 'text-yellow-400' : 'text-red-400';
            const slaColor   = t.sla_pct >= 90 ? 'text-green-400' : t.sla_pct >= 80 ? 'text-yellow-400' : 'text-red-400';
            const stopsPct   = t.stopps_gesamt > 0 ? (t.stopps_erledigt / t.stopps_gesamt) * 100 : 0;

            return (
              <div key={t.id} className={`${r.bg} border ${r.border} rounded-xl p-3 space-y-2`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {i === 0 && <Trophy className="w-3.5 h-3.5 text-yellow-400" />}
                    <span className="text-sm font-semibold text-white">{t.fahrer_name}</span>
                    <span className="text-xs text-gray-500 flex items-center gap-0.5">
                      <MapPin className="w-3 h-3" />{t.zone}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${r.text}`}>{r.label}</span>
                    <span className={`text-lg font-bold ${scoreColor}`}>{t.score}</span>
                  </div>
                </div>

                {/* Score-Delta + €/km + SLA */}
                <div className="grid grid-cols-4 gap-2 text-xs text-center">
                  <div>
                    <div className={`font-semibold ${t.score_delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {t.score_delta >= 0 ? '+' : ''}{t.score_delta}
                    </div>
                    <div className="text-gray-500">Δ Score</div>
                  </div>
                  <div>
                    <div className="text-white font-semibold flex items-center justify-center gap-0.5">
                      <Euro className="w-3 h-3 text-green-400" />{t.euro_per_km.toFixed(1)}
                    </div>
                    <div className="text-gray-500">€/km</div>
                  </div>
                  <div>
                    <div className={`font-semibold ${slaColor}`}>{t.sla_pct}%</div>
                    <div className="text-gray-500">SLA</div>
                  </div>
                  <div>
                    <div className="text-white font-semibold flex items-center justify-center gap-0.5">
                      <Clock className="w-3 h-3 text-gray-400" />
                      {t.eta_min !== null ? `${t.eta_min}m` : '—'}
                    </div>
                    <div className="text-gray-500">ETA</div>
                  </div>
                </div>

                {/* Stopp-Fortschritt */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Stopps {t.stopps_erledigt}/{t.stopps_gesamt}</span>
                    <span>{t.km_gesamt} km · {t.umsatz} €</span>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        t.verzoegerungs_risiko === 'hoch' ? 'bg-red-500' :
                        t.verzoegerungs_risiko === 'mittel' ? 'bg-yellow-500' : 'bg-matcha-500'
                      }`}
                      style={{ width: `${stopsPct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      <div className="text-xs text-gray-600 text-right">
        {new Date(data.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>
    </div>
  );
}
