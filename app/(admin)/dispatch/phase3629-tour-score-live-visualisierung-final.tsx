'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trophy, TrendingUp, TrendingDown, Minus, AlertTriangle, ChevronDown, ChevronUp, MapPin } from 'lucide-react';

interface FahrerTourScore {
  fahrer_id: string;
  fahrer_name: string;
  score: number;
  score_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  rang: number;
  aktive_stopps: number;
  gesamt_stopps: number;
  puenktlichkeit_pct: number;
  ø_lieferzeit_min: number;
  bewertung: number;
}

interface ApiResponse {
  fahrer: FahrerTourScore[];
  flotten_avg_score: number;
  alert_count: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: '1', fahrer_name: 'Max M.', score: 94, score_delta: 3, ampel: 'gruen', rang: 1, aktive_stopps: 2, gesamt_stopps: 5, puenktlichkeit_pct: 96, ø_lieferzeit_min: 28, bewertung: 4.9 },
    { fahrer_id: '2', fahrer_name: 'Anna K.', score: 81, score_delta: -2, ampel: 'gelb', rang: 2, aktive_stopps: 3, gesamt_stopps: 4, puenktlichkeit_pct: 88, ø_lieferzeit_min: 34, bewertung: 4.6 },
    { fahrer_id: '3', fahrer_name: 'Leon B.', score: 62, score_delta: -5, ampel: 'rot', rang: 3, aktive_stopps: 1, gesamt_stopps: 3, puenktlichkeit_pct: 72, ø_lieferzeit_min: 41, bewertung: 4.1 },
  ],
  flotten_avg_score: 79,
  alert_count: 1,
};

const AMPEL_BG: Record<string, string> = { gruen: 'bg-emerald-50 border-emerald-200', gelb: 'bg-yellow-50 border-yellow-200', rot: 'bg-red-50 border-red-200' };
const AMPEL_BAR: Record<string, string> = { gruen: 'bg-emerald-500', gelb: 'bg-yellow-400', rot: 'bg-red-500' };
const RANK_BADGE: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export function DispatchPhase3629TourScoreLiveVisualisierungFinal({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/tour-score-live?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) { const d = await r.json(); if (d?.fahrer) setData(d); }
    } catch {}
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 20_000); return () => clearInterval(id); }, [load]);

  return (
    <div className="border rounded-xl bg-white shadow-sm mb-3">
      <button className="w-full flex items-center justify-between p-3 text-left" onClick={() => setOpen(o => !o)}>
        <span className="flex items-center gap-2 font-semibold text-sm">
          <Trophy className="w-4 h-4 text-amber-500" />
          Tour-Score Live Visualisierung
          {data.alert_count > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-xs font-bold">{data.alert_count} ⚠</span>
          )}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3">
          <div className="flex items-center gap-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
            <Trophy className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div>
              <div className="text-xs text-gray-500">Flotten-Ø Score</div>
              <div className={`text-xl font-black ${data.flotten_avg_score >= 85 ? 'text-emerald-600' : data.flotten_avg_score >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                {data.flotten_avg_score}
              </div>
            </div>
          </div>

          {data.alert_count > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{data.alert_count} Fahrer mit Score &lt;70 — Eingriff empfohlen</span>
            </div>
          )}

          <div className="space-y-2">
            {data.fahrer.map(f => (
              <div key={f.fahrer_id} className={`rounded-lg border ${AMPEL_BG[f.ampel]}`}>
                <button
                  className="w-full flex items-center gap-2 p-2 text-left"
                  onClick={() => setExpanded(expanded === f.fahrer_id ? null : f.fahrer_id)}
                >
                  <span className="text-xs font-bold text-gray-500 w-6">{RANK_BADGE[f.rang] ?? `#${f.rang}`}</span>
                  <span className="flex-1 text-sm font-medium text-gray-900 truncate">{f.fahrer_name}</span>
                  <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden mr-1">
                    <div className={`h-2 rounded-full ${AMPEL_BAR[f.ampel]}`} style={{ width: `${f.score}%` }} />
                  </div>
                  <span className={`text-sm font-black w-8 text-right ${f.ampel === 'gruen' ? 'text-emerald-700' : f.ampel === 'gelb' ? 'text-yellow-700' : 'text-red-700'}`}>{f.score}</span>
                  {f.score_delta > 0 ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : f.score_delta < 0 ? <TrendingDown className="w-3 h-3 text-red-400" /> : <Minus className="w-3 h-3 text-gray-300" />}
                </button>

                {expanded === f.fahrer_id && (
                  <div className="px-3 pb-2 pt-1 border-t border-gray-100 grid grid-cols-3 gap-2 text-xs text-center">
                    <div>
                      <div className="font-bold text-gray-800">{f.puenktlichkeit_pct}%</div>
                      <div className="text-gray-400">Pünktlichkeit</div>
                    </div>
                    <div>
                      <div className="font-bold text-gray-800">{f.ø_lieferzeit_min} Min</div>
                      <div className="text-gray-400">Ø Lieferzeit</div>
                    </div>
                    <div>
                      <div className="font-bold text-gray-800">{f.bewertung.toFixed(1)} ★</div>
                      <div className="text-gray-400">Bewertung</div>
                    </div>
                    <div className="col-span-3 flex items-center gap-1 justify-center text-gray-500 pt-1">
                      <MapPin className="w-3 h-3" />
                      <span>{f.aktive_stopps}/{f.gesamt_stopps} Stopps aktiv</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="text-xs text-gray-400 text-center">Score 0–100 · Alert &lt;70 · 20-Sek-Polling</div>
        </div>
      )}
    </div>
  );
}
