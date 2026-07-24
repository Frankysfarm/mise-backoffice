'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trophy, TrendingUp, TrendingDown, Minus, AlertTriangle, ChevronDown, ChevronUp, MapPin, Clock, Star, Route } from 'lucide-react';

interface TourStopp {
  stopp_nr: number;
  adresse: string;
  status: 'ausstehend' | 'unterwegs' | 'geliefert';
  eta_min: number | null;
}

interface FahrerScore {
  fahrer_id: string;
  fahrer_name: string;
  score: number;
  score_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  rang: number;
  aktive_stopps: number;
  gesamt_stopps: number;
  puenktlichkeit_pct: number;
  avg_lieferzeit_min: number;
  bewertung: number;
  stopps: TourStopp[];
}

interface ApiResponse {
  fahrer: FahrerScore[];
  flotten_avg_score: number;
  alert_count: number;
  updated_at: string;
}

const MOCK: ApiResponse = {
  fahrer: [
    {
      fahrer_id: '1', fahrer_name: 'Max M.', score: 92, score_delta: 4, ampel: 'gruen', rang: 1,
      aktive_stopps: 2, gesamt_stopps: 6, puenktlichkeit_pct: 95, avg_lieferzeit_min: 27, bewertung: 4.9,
      stopps: [
        { stopp_nr: 1, adresse: 'Hauptstr. 12', status: 'geliefert', eta_min: null },
        { stopp_nr: 2, adresse: 'Bahnhofstr. 5', status: 'unterwegs', eta_min: 8 },
        { stopp_nr: 3, adresse: 'Marktplatz 3', status: 'ausstehend', eta_min: 22 },
      ],
    },
    {
      fahrer_id: '2', fahrer_name: 'Anna K.', score: 78, score_delta: -3, ampel: 'gelb', rang: 2,
      aktive_stopps: 3, gesamt_stopps: 5, puenktlichkeit_pct: 84, avg_lieferzeit_min: 35, bewertung: 4.5,
      stopps: [
        { stopp_nr: 1, adresse: 'Ringstr. 7', status: 'geliefert', eta_min: null },
        { stopp_nr: 2, adresse: 'Parkweg 11', status: 'unterwegs', eta_min: 12 },
        { stopp_nr: 3, adresse: 'Lindenallee 9', status: 'ausstehend', eta_min: 28 },
      ],
    },
    {
      fahrer_id: '3', fahrer_name: 'Leon B.', score: 58, score_delta: -7, ampel: 'rot', rang: 3,
      aktive_stopps: 1, gesamt_stopps: 4, puenktlichkeit_pct: 69, avg_lieferzeit_min: 44, bewertung: 4.0,
      stopps: [
        { stopp_nr: 1, adresse: 'Gartenstr. 2', status: 'geliefert', eta_min: null },
        { stopp_nr: 2, adresse: 'Feldweg 18', status: 'unterwegs', eta_min: 19 },
      ],
    },
  ],
  flotten_avg_score: 76,
  alert_count: 1,
  updated_at: new Date().toISOString(),
};

const AMPEL_BG: Record<string, string> = {
  gruen: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800',
  gelb: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800',
  rot: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800',
};
const AMPEL_BAR: Record<string, string> = { gruen: 'bg-emerald-500', gelb: 'bg-yellow-400', rot: 'bg-red-500' };
const AMPEL_TEXT: Record<string, string> = { gruen: 'text-emerald-600', gelb: 'text-yellow-600', rot: 'text-red-600' };
const STOPP_DOT: Record<string, string> = {
  geliefert: 'bg-emerald-500',
  unterwegs: 'bg-blue-500 animate-pulse',
  ausstehend: 'bg-gray-300',
};
const RANK_BADGE: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export function DispatchPhase3654TourScoreCommandCenter({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/tour-score-live?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) { const d = await r.json(); if (d?.fahrer?.length) setData(d); }
    } catch {}
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 20_000); return () => clearInterval(id); }, [load]);

  const scoreColor = (s: number) => s >= 85 ? 'text-emerald-600' : s >= 70 ? 'text-yellow-600' : 'text-red-600';
  const delta = (d: number) => d > 0
    ? <span className="text-emerald-600 flex items-center gap-0.5 text-xs"><TrendingUp className="w-3 h-3" />+{d}</span>
    : d < 0
    ? <span className="text-red-500 flex items-center gap-0.5 text-xs"><TrendingDown className="w-3 h-3" />{d}</span>
    : <span className="text-gray-400 text-xs"><Minus className="w-3 h-3" /></span>;

  return (
    <div className="border rounded-xl bg-white dark:bg-gray-900 shadow-sm mb-3">
      <button
        className="w-full flex items-center justify-between p-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex items-center gap-2 font-semibold text-sm">
          <Trophy className="w-4 h-4 text-amber-500" />
          Tour-Score Command Center
          {data.alert_count > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-xs font-bold">
              {data.alert_count} ⚠
            </span>
          )}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3">
          {/* Flotten-KPI-Row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="text-xs text-gray-500 dark:text-gray-400">Flotten-Ø</div>
              <div className={`text-2xl font-black ${scoreColor(data.flotten_avg_score)}`}>{data.flotten_avg_score}</div>
            </div>
            <div className="text-center p-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg">
              <div className="text-xs text-gray-500 dark:text-gray-400">Top-Score</div>
              <div className="text-2xl font-black text-emerald-600">{Math.max(...data.fahrer.map(f => f.score))}</div>
            </div>
            <div className="text-center p-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="text-xs text-gray-500 dark:text-gray-400">Alerts</div>
              <div className="text-2xl font-black text-red-600">{data.alert_count}</div>
            </div>
          </div>

          {/* Alert */}
          {data.alert_count > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {data.fahrer.filter(f => f.ampel === 'rot').map(f => f.fahrer_name).join(', ')} unter Score-Ziel (70)
            </div>
          )}

          {/* Fahrer-Liste */}
          {data.fahrer.map(f => (
            <div key={f.fahrer_id} className={`border rounded-lg overflow-hidden ${AMPEL_BG[f.ampel]}`}>
              <button
                className="w-full flex items-center gap-3 px-3 py-2 text-left"
                onClick={() => setExpanded(e => e === f.fahrer_id ? null : f.fahrer_id)}
              >
                <span className="text-base">{RANK_BADGE[f.rang] ?? `#${f.rang}`}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm truncate">{f.fahrer_name}</span>
                    <div className="flex items-center gap-2">
                      {delta(f.score_delta)}
                      <span className={`text-lg font-black ${AMPEL_TEXT[f.ampel]}`}>{f.score}</span>
                    </div>
                  </div>
                  {/* Score-Bar */}
                  <div className="mt-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${AMPEL_BAR[f.ampel]}`}
                      style={{ width: `${f.score}%` }}
                    />
                  </div>
                  {/* Stopp-Dots */}
                  <div className="flex items-center gap-1 mt-1">
                    {f.stopps.map(s => (
                      <div key={s.stopp_nr} className={`w-2 h-2 rounded-full ${STOPP_DOT[s.status]}`} title={s.adresse} />
                    ))}
                    <span className="text-xs text-gray-500 ml-1">{f.aktive_stopps}/{f.gesamt_stopps} Stopps</span>
                  </div>
                </div>
                {expanded === f.fahrer_id ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
              </button>

              {/* Sub-KPIs + Stopp-Liste */}
              {expanded === f.fahrer_id && (
                <div className="border-t border-gray-100 dark:border-gray-700 px-3 py-2 space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div>
                      <div className="text-gray-400">Pünktlichkeit</div>
                      <div className={`font-bold ${f.puenktlichkeit_pct >= 90 ? 'text-emerald-600' : f.puenktlichkeit_pct >= 75 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {f.puenktlichkeit_pct}%
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400">Ø Lieferzeit</div>
                      <div className={`font-bold ${f.avg_lieferzeit_min <= 30 ? 'text-emerald-600' : f.avg_lieferzeit_min <= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {f.avg_lieferzeit_min} min
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400">Bewertung</div>
                      <div className={`font-bold ${f.bewertung >= 4.5 ? 'text-emerald-600' : f.bewertung >= 4.0 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {f.bewertung.toFixed(1)} ★
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {f.stopps.map(s => (
                      <div key={s.stopp_nr} className="flex items-center gap-2 text-xs">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${STOPP_DOT[s.status]}`} />
                        <span className="flex-1 truncate text-gray-700 dark:text-gray-300">{s.adresse}</span>
                        {s.status === 'unterwegs' && s.eta_min !== null && (
                          <span className="text-blue-600 font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3" />{s.eta_min} min
                          </span>
                        )}
                        {s.status === 'ausstehend' && s.eta_min !== null && (
                          <span className="text-gray-400">{s.eta_min} min</span>
                        )}
                        {s.status === 'geliefert' && (
                          <span className="text-emerald-600 font-medium">✓</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          <div className="text-right text-xs text-gray-400">20-Sek-Polling · Mock-Fallback aktiv</div>
        </div>
      )}
    </div>
  );
}
