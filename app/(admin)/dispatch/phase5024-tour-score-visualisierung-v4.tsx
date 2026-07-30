'use client';

import { useEffect, useState } from 'react';
import { Bike, Clock, TrendingUp, AlertTriangle, CheckCircle2, MapPin, Target, Star, Zap, Route } from 'lucide-react';

interface FahrerScore {
  fahrer_id: string;
  name: string;
  score: number;
  score_delta: number;
  akt_tour: string | null;
  stopps_heute: number;
  puenktlichkeit_pct: number;
  km_heute: number;
  verdienst_heute: number;
  status: 'aktiv' | 'pause' | 'offline';
  delay_risiko: 'niedrig' | 'mittel' | 'hoch';
}

interface TourVisualisierung {
  tour_id: string;
  fahrer_name: string;
  stopps: Array<{
    nr: number;
    adresse: string;
    status: 'fertig' | 'aktiv' | 'ausstehend';
    eta_min: number | null;
    verspaetet: boolean;
  }>;
  gesamt_km: number;
  eff_score: number;
  profit_eur: number;
}

interface KpiOverview {
  aktive_fahrer: number;
  akt_touren: number;
  durchschnitt_score: number;
  pctg_puenktlich: number;
  kritische_delays: number;
  umsatz_heute: number;
}

interface ApiData {
  fahrer: FahrerScore[];
  aktive_touren: TourVisualisierung[];
  kpis: KpiOverview;
  alert: string | null;
}

const MOCK: ApiData = {
  kpis: {
    aktive_fahrer: 5, akt_touren: 3, durchschnitt_score: 82,
    pctg_puenktlich: 88, kritische_delays: 1, umsatz_heute: 1240,
  },
  alert: null,
  fahrer: [
    { fahrer_id: 'f1', name: 'Jonas M.', score: 94, score_delta: 3, akt_tour: 'T-001', stopps_heute: 12, puenktlichkeit_pct: 97, km_heute: 48, verdienst_heute: 142, status: 'aktiv', delay_risiko: 'niedrig' },
    { fahrer_id: 'f2', name: 'Sara K.', score: 87, score_delta: -1, akt_tour: 'T-002', stopps_heute: 9, puenktlichkeit_pct: 89, km_heute: 36, verdienst_heute: 118, status: 'aktiv', delay_risiko: 'mittel' },
    { fahrer_id: 'f3', name: 'Luca R.', score: 71, score_delta: -5, akt_tour: null, stopps_heute: 7, puenktlichkeit_pct: 72, km_heute: 28, verdienst_heute: 89, status: 'pause', delay_risiko: 'niedrig' },
    { fahrer_id: 'f4', name: 'Anna B.', score: 88, score_delta: 2, akt_tour: 'T-003', stopps_heute: 10, puenktlichkeit_pct: 92, km_heute: 41, verdienst_heute: 126, status: 'aktiv', delay_risiko: 'niedrig' },
    { fahrer_id: 'f5', name: 'Max S.', score: 63, score_delta: -8, akt_tour: null, stopps_heute: 5, puenktlichkeit_pct: 65, km_heute: 22, verdienst_heute: 68, status: 'offline', delay_risiko: 'hoch' },
  ],
  aktive_touren: [
    {
      tour_id: 'T-001', fahrer_name: 'Jonas M.', gesamt_km: 14.2, eff_score: 91, profit_eur: 52.40,
      stopps: [
        { nr: 1, adresse: 'Hauptstr. 12', status: 'fertig', eta_min: null, verspaetet: false },
        { nr: 2, adresse: 'Bahnhofstr. 7', status: 'aktiv', eta_min: 4, verspaetet: false },
        { nr: 3, adresse: 'Pontstr. 22', status: 'ausstehend', eta_min: 18, verspaetet: false },
      ],
    },
    {
      tour_id: 'T-002', fahrer_name: 'Sara K.', gesamt_km: 11.8, eff_score: 78, profit_eur: 38.90,
      stopps: [
        { nr: 1, adresse: 'Mühlenstr. 4', status: 'fertig', eta_min: null, verspaetet: false },
        { nr: 2, adresse: 'Elisabethstr. 9', status: 'aktiv', eta_min: 7, verspaetet: true },
      ],
    },
    {
      tour_id: 'T-003', fahrer_name: 'Anna B.', gesamt_km: 16.0, eff_score: 88, profit_eur: 47.20,
      stopps: [
        { nr: 1, adresse: 'Friedenstr. 5', status: 'aktiv', eta_min: 2, verspaetet: false },
        { nr: 2, adresse: 'Nordstr. 17', status: 'ausstehend', eta_min: 20, verspaetet: false },
        { nr: 3, adresse: 'Westpark 3', status: 'ausstehend', eta_min: 35, verspaetet: false },
      ],
    },
  ],
};

function scoreBadge(s: number) {
  if (s >= 85) return 'bg-green-900/50 text-green-300 border border-green-700/40';
  if (s >= 70) return 'bg-yellow-900/50 text-yellow-300 border border-yellow-700/40';
  return 'bg-red-900/50 text-red-300 border border-red-700/40';
}

function statusDot(st: string) {
  if (st === 'aktiv') return 'bg-green-400';
  if (st === 'pause') return 'bg-yellow-400';
  return 'bg-slate-500';
}

function stoppColor(status: string, verspaetet: boolean) {
  if (status === 'fertig') return 'bg-green-500';
  if (verspaetet) return 'bg-red-500 animate-pulse';
  if (status === 'aktiv') return 'bg-blue-400 animate-pulse';
  return 'bg-slate-600';
}

export function DispatchPhase5024TourScoreVisualisierungV4() {
  const [data, setData] = useState<ApiData>(MOCK);
  const [tab, setTab] = useState<'fahrer' | 'touren'>('fahrer');

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/delivery/admin/tour-score-visualisierung', { cache: 'no-store' });
        if (res.ok) setData(await res.json());
      } catch { /* Mock bleibt */ }
    };
    poll();
    const id = setInterval(poll, 20_000);
    return () => clearInterval(id);
  }, []);

  const kpis = data.kpis;

  return (
    <div className="rounded-xl border border-violet-700/40 bg-gradient-to-b from-slate-900/90 to-violet-950/40 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Route className="w-4 h-4 text-violet-400" />
          <span className="text-xs font-semibold text-violet-300">Tour-Score V4</span>
          {kpis.kritische_delays > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-red-400 animate-pulse">
              <AlertTriangle className="w-3 h-3" /> {kpis.kritische_delays} Delay
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-sm font-bold tabular-nums ${kpis.durchschnitt_score >= 85 ? 'text-green-400' : kpis.durchschnitt_score >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
            Ø{kpis.durchschnitt_score}
          </span>
          <span className="text-[10px] text-slate-500">Score</span>
        </div>
      </div>

      {data.alert && (
        <div className="flex items-center gap-2 rounded-lg border border-red-600/50 bg-red-950/40 px-2.5 py-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
          <span className="text-xs text-red-300">{data.alert}</span>
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-3 gap-1.5">
        {[
          { label: 'Fahrer', v: kpis.aktive_fahrer, unit: '', color: 'text-blue-400' },
          { label: 'Touren', v: kpis.akt_touren, unit: '', color: 'text-violet-400' },
          { label: 'Ø-Score', v: kpis.durchschnitt_score, unit: '', color: kpis.durchschnitt_score >= 80 ? 'text-green-400' : 'text-yellow-400' },
          { label: 'Pünktl.', v: kpis.pctg_puenktlich, unit: '%', color: kpis.pctg_puenktlich >= 85 ? 'text-green-400' : 'text-yellow-400' },
          { label: 'Delays', v: kpis.kritische_delays, unit: '', color: kpis.kritische_delays > 0 ? 'text-red-400' : 'text-green-400' },
          { label: 'Umsatz', v: `${kpis.umsatz_heute}€`, unit: '', color: 'text-amber-400' },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border border-slate-700/50 bg-slate-800/40 px-2 py-1.5 text-center">
            <div className={`text-sm font-bold tabular-nums ${k.color}`}>{k.v}{k.unit}</div>
            <div className="text-[10px] text-slate-500">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {(['fahrer', 'touren'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md py-1 text-xs font-medium transition-colors ${
              tab === t ? 'bg-violet-600 text-white' : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            {t === 'fahrer' ? `Fahrer (${data.fahrer.length})` : `Aktive Touren (${data.aktive_touren.length})`}
          </button>
        ))}
      </div>

      {/* Fahrer Score Tab */}
      {tab === 'fahrer' && (
        <div className="space-y-1.5">
          {[...data.fahrer].sort((a, b) => b.score - a.score).map((f) => (
            <div key={f.fahrer_id} className="rounded-lg border border-slate-700/40 bg-slate-800/30 p-2">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${statusDot(f.status)}`} />
                  <span className="text-xs font-semibold text-slate-100">{f.name}</span>
                  {f.akt_tour && (
                    <span className="text-[10px] text-slate-500">{f.akt_tour}</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${scoreBadge(f.score)}`}>
                    {f.score}
                  </span>
                  <span className={`text-[10px] font-semibold ${f.score_delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {f.score_delta >= 0 ? '▲' : '▼'}{Math.abs(f.score_delta)}
                  </span>
                </div>
              </div>

              {/* Score Bar */}
              <div className="w-full h-1.5 bg-slate-700/60 rounded-full overflow-hidden mb-1.5">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${f.score >= 85 ? 'bg-green-500' : f.score >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${f.score}%` }}
                />
              </div>

              <div className="flex justify-between text-[10px] text-slate-500">
                <span>{f.stopps_heute} Stopps</span>
                <span>{f.km_heute} km</span>
                <span className="text-amber-400">{f.verdienst_heute}€</span>
                <span>{f.puenktlichkeit_pct}% pünktl.</span>
              </div>

              {f.delay_risiko === 'hoch' && (
                <div className="mt-1 flex items-center gap-1 text-[10px] text-red-400">
                  <AlertTriangle className="w-3 h-3" /> Delay-Risiko hoch
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Touren Visualisierung Tab */}
      {tab === 'touren' && (
        <div className="space-y-2">
          {data.aktive_touren.map((tour) => (
            <div key={tour.tour_id} className="rounded-lg border border-violet-700/30 bg-violet-950/25 p-2.5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Bike className="w-3.5 h-3.5 text-violet-400" />
                  <span className="text-xs font-semibold text-violet-200">{tour.fahrer_name}</span>
                  <span className="text-[10px] text-slate-500">{tour.tour_id}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400">{tour.gesamt_km} km</span>
                  <span className="text-[10px] font-semibold text-amber-400">{tour.profit_eur.toFixed(2)}€</span>
                  <span className={`text-[10px] px-1 py-0.5 rounded font-semibold ${tour.eff_score >= 85 ? 'text-green-400' : 'text-yellow-400'}`}>
                    ⭐{tour.eff_score}
                  </span>
                </div>
              </div>

              {/* Stopp-Visualisierung */}
              <div className="flex items-center gap-1">
                {tour.stopps.map((s, i) => (
                  <div key={s.nr} className="flex items-center gap-1">
                    <div className="flex flex-col items-center gap-0.5">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center ${stoppColor(s.status, s.verspaetet)}`}>
                        <span className="text-[8px] font-bold text-white">{s.nr}</span>
                      </div>
                      {s.eta_min !== null && s.status !== 'fertig' && (
                        <span className={`text-[8px] tabular-nums ${s.verspaetet ? 'text-red-400' : 'text-slate-500'}`}>
                          {s.eta_min}m
                        </span>
                      )}
                      {s.status === 'fertig' && <CheckCircle2 className="w-2.5 h-2.5 text-green-500" />}
                    </div>
                    {i < tour.stopps.length - 1 && (
                      <div className={`h-px w-5 ${tour.stopps[i + 1].status === 'fertig' ? 'bg-green-500/60' : 'bg-slate-600/60'}`} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-[9px] text-slate-600 text-right">20s-Polling · Mock-Fallback</div>
    </div>
  );
}
