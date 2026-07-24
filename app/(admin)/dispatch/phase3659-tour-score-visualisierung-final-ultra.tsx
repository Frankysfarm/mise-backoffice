'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trophy, MapPin, Clock, TrendingUp, TrendingDown, Minus, AlertTriangle, ChevronDown, ChevronUp, Star, Route } from 'lucide-react';

interface TourStop {
  stopp_nr: number;
  adresse: string;
  status: 'ausstehend' | 'unterwegs' | 'geliefert' | 'problem';
  eta_min: number | null;
}

interface SubScore {
  puenktlichkeit: number;
  abschluss: number;
  speed: number;
}

interface FahrerTour {
  fahrer_id: string;
  fahrer_name: string;
  score: number;
  score_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  rang: number;
  stopps: TourStop[];
  sub: SubScore;
  aktive_stopps: number;
  gesamt_stopps: number;
  avg_lieferzeit_min: number;
  bewertung: number;
}

interface ApiResponse {
  touren: FahrerTour[];
  flotten_avg: number;
  alert_count: number;
}

const MOCK: ApiResponse = {
  flotten_avg: 79,
  alert_count: 1,
  touren: [
    {
      fahrer_id: '1', fahrer_name: 'Thomas W.', score: 91, score_delta: 6, ampel: 'gruen', rang: 1,
      aktive_stopps: 2, gesamt_stopps: 7, avg_lieferzeit_min: 24, bewertung: 4.9,
      sub: { puenktlichkeit: 96, abschluss: 100, speed: 88 },
      stopps: [
        { stopp_nr: 1, adresse: 'Aachener Str. 44', status: 'geliefert', eta_min: null },
        { stopp_nr: 2, adresse: 'Moltkestr. 12', status: 'geliefert', eta_min: null },
        { stopp_nr: 3, adresse: 'Roermonder Str. 8', status: 'unterwegs', eta_min: 6 },
        { stopp_nr: 4, adresse: 'Trierer Str. 3', status: 'ausstehend', eta_min: 18 },
        { stopp_nr: 5, adresse: 'Viktoriaallee 22', status: 'ausstehend', eta_min: 31 },
      ],
    },
    {
      fahrer_id: '2', fahrer_name: 'Mia S.', score: 76, score_delta: -2, ampel: 'gelb', rang: 2,
      aktive_stopps: 3, gesamt_stopps: 5, avg_lieferzeit_min: 34, bewertung: 4.6,
      sub: { puenktlichkeit: 81, abschluss: 80, speed: 72 },
      stopps: [
        { stopp_nr: 1, adresse: 'Franzstr. 19', status: 'geliefert', eta_min: null },
        { stopp_nr: 2, adresse: 'Pontstr. 56', status: 'unterwegs', eta_min: 9 },
        { stopp_nr: 3, adresse: 'Büchel 7', status: 'ausstehend', eta_min: 23 },
      ],
    },
    {
      fahrer_id: '3', fahrer_name: 'Kerem A.', score: 61, score_delta: -9, ampel: 'rot', rang: 3,
      aktive_stopps: 2, gesamt_stopps: 4, avg_lieferzeit_min: 47, bewertung: 3.9,
      sub: { puenktlichkeit: 65, abschluss: 75, speed: 55 },
      stopps: [
        { stopp_nr: 1, adresse: 'Aureliusstr. 2', status: 'problem', eta_min: null },
        { stopp_nr: 2, adresse: 'Lombardenstr. 14', status: 'unterwegs', eta_min: 21 },
        { stopp_nr: 3, adresse: 'Zollernstr. 5', status: 'ausstehend', eta_min: 38 },
      ],
    },
  ],
};

const DOT_STYLE: Record<string, string> = {
  geliefert: 'bg-emerald-500',
  unterwegs: 'bg-blue-500 animate-pulse',
  ausstehend: 'bg-gray-300 dark:bg-gray-600',
  problem: 'bg-red-500',
};
const AMPEL_BG: Record<string, string> = {
  gruen: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800',
  gelb: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800',
  rot: 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800',
};
const AMPEL_BAR: Record<string, string> = { gruen: 'bg-emerald-500', gelb: 'bg-yellow-400', rot: 'bg-red-500' };
const RANK_EMOJI: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function ScoreRing({ score, ampel }: { score: number; ampel: string }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const strokeColor = ampel === 'gruen' ? '#10b981' : ampel === 'gelb' ? '#f59e0b' : '#ef4444';
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" className="flex-shrink-0">
      <circle cx="26" cy="26" r={r} fill="none" stroke="#e5e7eb" strokeWidth="5" />
      <circle
        cx="26" cy="26" r={r} fill="none"
        stroke={strokeColor} strokeWidth="5"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform="rotate(-90 26 26)"
      />
      <text x="26" y="30" textAnchor="middle" fontSize="12" fontWeight="bold" fill={strokeColor}>{score}</text>
    </svg>
  );
}

export function DispatchPhase3659TourScoreVisualisierungFinalUltra({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/tour-score-live?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) { const d = await r.json(); if (d?.touren?.length) setData(d); }
    } catch {}
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 20_000); return () => clearInterval(id); }, [load]);

  const delta = (d: number) => d > 0
    ? <span className="text-xs text-emerald-600 flex items-center"><TrendingUp className="w-3 h-3" />+{d}</span>
    : d < 0
    ? <span className="text-xs text-red-500 flex items-center"><TrendingDown className="w-3 h-3" />{d}</span>
    : <span className="text-xs text-gray-400"><Minus className="w-3 h-3" /></span>;

  return (
    <div className="border rounded-xl bg-white dark:bg-gray-900 shadow-sm mb-3">
      <button
        className="w-full flex items-center justify-between p-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex items-center gap-2 font-semibold text-sm text-gray-900 dark:text-gray-100">
          <Trophy className="w-4 h-4 text-amber-500" />
          Tour-Score &amp; Visualisierung Final Ultra
          {data.alert_count > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 text-xs font-bold">
              {data.alert_count} ⚠
            </span>
          )}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 dark:text-gray-400">Ø <b className="text-gray-700 dark:text-gray-200">{data.flotten_avg}</b></span>
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3">
          {/* Fleet KPI */}
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: 'Flotten-Ø', val: data.flotten_avg, color: 'text-amber-600' },
              { label: 'Top-Score', val: Math.max(...data.touren.map(t => t.score)), color: 'text-emerald-600' },
              { label: 'Alerts', val: data.alert_count, color: 'text-red-600' },
            ].map(k => (
              <div key={k.label} className="p-2 border border-gray-100 dark:border-gray-800 rounded-lg bg-gray-50 dark:bg-gray-800">
                <div className="text-xs text-gray-500 dark:text-gray-400">{k.label}</div>
                <div className={`text-xl font-black ${k.color}`}>{k.val}</div>
              </div>
            ))}
          </div>

          {/* Alert */}
          {data.alert_count > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-400">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              {data.touren.filter(t => t.ampel === 'rot').map(t => t.fahrer_name).join(', ')} unter Ziel-Score (70)
            </div>
          )}

          {/* Fahrer-Touren */}
          {data.touren.map(t => (
            <div key={t.fahrer_id} className={`border rounded-xl overflow-hidden ${AMPEL_BG[t.ampel]}`}>
              <button
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                onClick={() => setExpanded(e => e === t.fahrer_id ? null : t.fahrer_id)}
              >
                <ScoreRing score={t.score} ampel={t.ampel} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-base">{RANK_EMOJI[t.rang] ?? `#${t.rang}`}</span>
                      <span className="font-semibold text-sm truncate text-gray-900 dark:text-gray-100">{t.fahrer_name}</span>
                    </div>
                    {delta(t.score_delta)}
                  </div>
                  {/* Stopp-Timeline */}
                  <div className="flex items-center gap-1 mt-1.5">
                    {t.stopps.map(s => (
                      <div
                        key={s.stopp_nr}
                        className={`w-3 h-3 rounded-full flex-shrink-0 ${DOT_STYLE[s.status]}`}
                        title={`${s.adresse} – ${s.status}`}
                      />
                    ))}
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                      {t.aktive_stopps}/{t.gesamt_stopps}
                    </span>
                  </div>
                  {/* Score-Bar */}
                  <div className="mt-1.5 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${AMPEL_BAR[t.ampel]}`}
                      style={{ width: `${t.score}%` }}
                    />
                  </div>
                </div>
                {expanded === t.fahrer_id
                  ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
              </button>

              {/* Detail-Panel */}
              {expanded === t.fahrer_id && (
                <div className="border-t border-gray-100 dark:border-gray-800 px-3 py-2.5 space-y-2">
                  {/* Sub-Scores */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    {[
                      { label: 'Pünktlichkeit', val: t.sub.puenktlichkeit, unit: '%' },
                      { label: 'Abschluss', val: t.sub.abschluss, unit: '%' },
                      { label: 'Speed', val: t.sub.speed, unit: '' },
                    ].map(s => (
                      <div key={s.label} className="bg-white dark:bg-gray-800 rounded-lg p-1.5 border border-gray-100 dark:border-gray-700">
                        <div className="text-gray-400">{s.label}</div>
                        <div className={`font-bold ${s.val >= 85 ? 'text-emerald-600' : s.val >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {s.val}{s.unit}
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* KPIs */}
                  <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-300">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Ø {t.avg_lieferzeit_min} min</span>
                    <span className="flex items-center gap-1"><Star className="w-3 h-3 text-yellow-500" />{t.bewertung.toFixed(1)} ★</span>
                  </div>
                  {/* Stopp-Liste */}
                  <div className="space-y-1">
                    {t.stopps.map(s => (
                      <div key={s.stopp_nr} className="flex items-center gap-2 text-xs">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${DOT_STYLE[s.status]}`} />
                        <span className="flex-1 truncate text-gray-700 dark:text-gray-300">{s.adresse}</span>
                        {s.status === 'unterwegs' && s.eta_min !== null && (
                          <span className="text-blue-600 dark:text-blue-400 font-medium">{s.eta_min} min</span>
                        )}
                        {s.status === 'ausstehend' && s.eta_min !== null && (
                          <span className="text-gray-400">~{s.eta_min} min</span>
                        )}
                        {s.status === 'geliefert' && <span className="text-emerald-600">✓</span>}
                        {s.status === 'problem' && <span className="text-red-600">⚠</span>}
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
