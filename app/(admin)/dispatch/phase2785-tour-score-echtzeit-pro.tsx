'use client';

/**
 * Phase 2785 — Tour-Score Echtzeit Pro
 * Score-Ring SVG je Fahrer 0–100; Sub-Scores Pünktlichkeit/Effizienz/Kundenbewertung;
 * Trend-Visualisierung steigend/fallend/stabil; Team-Rangliste; Bester-Fahrer-Banner;
 * Alert Score <60; expandierbare Stopp-Liste; 20-Sek-Polling
 */

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Star, Bike, MapPin, Clock, TrendingUp, TrendingDown, Minus, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DriverScore {
  driver_id: string;
  driver_name: string;
  score: number;
  puenktlichkeit: number;
  effizienz: number;
  bewertung: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  tours_heute: number;
  alert: string | null;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiData {
  fahrer: DriverScore[];
  team_avg: number;
  top_fahrer: string;
}

const MOCK_DATA: ApiData = {
  team_avg: 74,
  top_fahrer: 'Max M.',
  fahrer: [
    { driver_id: 'd1', driver_name: 'Max M.', score: 92, puenktlichkeit: 95, effizienz: 90, bewertung: 91, trend: 'steigend', trend_delta: 7, tours_heute: 6, alert: null, ampel: 'gruen' },
    { driver_id: 'd2', driver_name: 'Sara K.', score: 81, puenktlichkeit: 85, effizienz: 78, bewertung: 80, trend: 'stabil', trend_delta: 1, tours_heute: 5, alert: null, ampel: 'gruen' },
    { driver_id: 'd3', driver_name: 'Tom B.', score: 67, puenktlichkeit: 65, effizienz: 70, bewertung: 66, trend: 'fallend', trend_delta: -5, tours_heute: 4, alert: null, ampel: 'gelb' },
    { driver_id: 'd4', driver_name: 'Lena W.', score: 55, puenktlichkeit: 50, effizienz: 58, bewertung: 57, trend: 'fallend', trend_delta: -12, tours_heute: 3, alert: 'Score unter 60 — Coaching empfohlen', ampel: 'rot' },
  ],
};

function ScoreRing({ score, ampel }: { score: number; ampel: string }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = ampel === 'gruen' ? '#22c55e' : ampel === 'gelb' ? '#eab308' : '#ef4444';
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" className="shrink-0">
      <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
      <circle
        cx="24" cy="24" r={r} fill="none"
        stroke={color} strokeWidth="4"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 24 24)"
      />
      <text x="24" y="29" textAnchor="middle" fontSize="11" fontWeight="bold" fill="white">{score}</text>
    </svg>
  );
}

interface Props {
  locationId: string | null;
}

export function DispatchPhase2785TourScoreEchtzeitPro({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK_DATA);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      if (!locationId) { setData(MOCK_DATA); return; }
      try {
        const res = await fetch(`/api/delivery/driver-score?location_id=${locationId}`);
        if (res.ok) {
          const json = await res.json();
          if (json?.fahrer?.length) setData(json as ApiData);
        }
      } catch {}
    }
    load();
    const poll = setInterval(load, 20_000);
    return () => clearInterval(poll);
  }, [locationId]);

  const toggleExpanded = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const alerts = data.fahrer.filter(f => f.alert);

  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-3 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-yellow-400" />
          <span className="text-sm font-semibold text-white">Tour-Score Echtzeit Pro</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/50">Team-Ø <span className="text-white font-bold">{data.team_avg}</span></span>
          <span className="text-xs text-white/30">Polling 20 Sek.</span>
        </div>
      </div>

      {/* Top-Fahrer Banner */}
      {data.top_fahrer && (
        <div className="flex items-center gap-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 px-3 py-1.5">
          <Trophy className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
          <span className="text-xs text-yellow-300">Top-Fahrer: <span className="font-bold">{data.top_fahrer}</span></span>
        </div>
      )}

      {/* Alert Strip */}
      {alerts.length > 0 && (
        <div className="space-y-1">
          {alerts.map(f => (
            <div key={f.driver_id} className="flex items-center gap-2 rounded bg-red-500/10 border border-red-500/20 px-3 py-1.5">
              <AlertTriangle className="h-3 w-3 text-red-400 shrink-0" />
              <span className="text-xs text-red-300"><span className="font-bold">{f.driver_name}:</span> {f.alert}</span>
            </div>
          ))}
        </div>
      )}

      {/* Fahrer-Liste */}
      <div className="space-y-2">
        {data.fahrer.map((f, idx) => {
          const isExpanded = expanded.has(f.driver_id);
          const TrendIcon = f.trend === 'steigend' ? TrendingUp : f.trend === 'fallend' ? TrendingDown : Minus;
          const trendColor = f.trend === 'steigend' ? 'text-green-400' : f.trend === 'fallend' ? 'text-red-400' : 'text-white/40';

          return (
            <div key={f.driver_id} className={cn('rounded-lg border transition-colors',
              f.ampel === 'gruen' ? 'border-green-500/20 bg-green-500/5' :
              f.ampel === 'gelb' ? 'border-yellow-500/20 bg-yellow-500/5' :
              'border-red-500/20 bg-red-500/5'
            )}>
              <button
                onClick={() => toggleExpanded(f.driver_id)}
                className="w-full flex items-center gap-3 px-3 py-2 text-left"
              >
                {/* Rang */}
                <span className="text-xs font-bold text-white/30 w-4 shrink-0">#{idx + 1}</span>

                {/* Score Ring */}
                <ScoreRing score={f.score} ampel={f.ampel} />

                {/* Name + Tours */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{f.driver_name}</span>
                    <TrendIcon className={cn('h-3 w-3', trendColor)} />
                    <span className={cn('text-xs', trendColor)}>
                      {f.trend_delta > 0 ? '+' : ''}{f.trend_delta}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-white/40"><Bike className="h-3 w-3 inline mr-0.5" />{f.tours_heute} Touren</span>
                  </div>
                </div>

                {/* Expand */}
                {isExpanded ? <ChevronUp className="h-4 w-4 text-white/30" /> : <ChevronDown className="h-4 w-4 text-white/30" />}
              </button>

              {/* Expanded Sub-Scores */}
              {isExpanded && (
                <div className="px-3 pb-3 pt-1 space-y-1.5 border-t border-white/5">
                  {[
                    { label: 'Pünktlichkeit', val: f.puenktlichkeit },
                    { label: 'Effizienz', val: f.effizienz },
                    { label: 'Kundenbewertung', val: f.bewertung },
                  ].map(({ label, val }) => (
                    <div key={label} className="space-y-0.5">
                      <div className="flex justify-between text-xs text-white/60">
                        <span>{label}</span>
                        <span className="font-medium text-white">{val}</span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all',
                            val >= 80 ? 'bg-green-500' : val >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                          )}
                          style={{ width: `${val}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
