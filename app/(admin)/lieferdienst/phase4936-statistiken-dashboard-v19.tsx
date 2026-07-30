'use client';

import { useEffect, useState } from 'react';
import { BarChart2, TrendingUp, TrendingDown, Clock, CheckCircle2, AlertTriangle, Activity, MapPin, Zap, Users } from 'lucide-react';

interface StundenDaten {
  stunde: number;
  bestellungen: number;
  umsatz: number;
  puenktlichkeit_pct: number;
  ist_jetzt: boolean;
}

interface FahrerLeistung {
  rang: number;
  name: string;
  score: number;
  touren: number;
  trinkgeld: number;
  puenktlichkeit_pct: number;
  score_delta: number;
}

interface ZoneEffizienz {
  zone: string;
  sla_pct: number;
  avg_min: number;
  umsatz: number;
  marge_pct: number;
}

interface ApiResponse {
  bestellungen: number;
  bestellungen_ziel: number;
  umsatz: number;
  umsatz_ziel: number;
  puenktlichkeit_pct: number;
  puenktlichkeit_ziel_pct: number;
  avg_lieferzeit_min: number;
  storno_pct: number;
  bewertung: number;
  score: number;
  score_delta: number;
  alert: string | null;
  stunden: StundenDaten[];
  top_fahrer: FahrerLeistung[];
  zonen: ZoneEffizienz[];
}

function euro(v: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);
}

const MOCK: ApiResponse = {
  bestellungen: 87,
  bestellungen_ziel: 100,
  umsatz: 2340.50,
  umsatz_ziel: 2800,
  puenktlichkeit_pct: 82,
  puenktlichkeit_ziel_pct: 85,
  avg_lieferzeit_min: 27,
  storno_pct: 3.2,
  bewertung: 4.6,
  score: 84,
  score_delta: 2,
  alert: null,
  stunden: [
    { stunde: 11, bestellungen: 8, umsatz: 210, puenktlichkeit_pct: 88, ist_jetzt: false },
    { stunde: 12, bestellungen: 14, umsatz: 390, puenktlichkeit_pct: 85, ist_jetzt: false },
    { stunde: 13, bestellungen: 18, umsatz: 490, puenktlichkeit_pct: 80, ist_jetzt: false },
    { stunde: 14, bestellungen: 12, umsatz: 320, puenktlichkeit_pct: 84, ist_jetzt: false },
    { stunde: 17, bestellungen: 10, umsatz: 280, puenktlichkeit_pct: 86, ist_jetzt: false },
    { stunde: 18, bestellungen: 16, umsatz: 430, puenktlichkeit_pct: 79, ist_jetzt: true },
    { stunde: 19, bestellungen: 9, umsatz: 220, puenktlichkeit_pct: 82, ist_jetzt: false },
  ],
  top_fahrer: [
    { rang: 1, name: 'Jonas M.', score: 96, touren: 12, trinkgeld: 18.50, puenktlichkeit_pct: 92, score_delta: 4 },
    { rang: 2, name: 'Sara K.', score: 88, touren: 10, trinkgeld: 14.20, puenktlichkeit_pct: 85, score_delta: -1 },
    { rang: 3, name: 'Max L.', score: 81, touren: 9, trinkgeld: 11.80, puenktlichkeit_pct: 80, score_delta: 2 },
  ],
  zonen: [
    { zone: 'Innenstadt', sla_pct: 88, avg_min: 24, umsatz: 1100, marge_pct: 32 },
    { zone: 'Nord', sla_pct: 76, avg_min: 30, umsatz: 780, marge_pct: 28 },
    { zone: 'Süd', sla_pct: 92, avg_min: 21, umsatz: 460, marge_pct: 35 },
  ],
};

export function LieferdienstPhase4936StatistikenDashboardV19() {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [mode, setMode] = useState<'bestellungen' | 'umsatz' | 'puenktlichkeit'>('bestellungen');

  useEffect(() => {
    async function load() {
      try {
        const r = await fetch('/api/delivery/lieferdienst/statistiken?v=19', { cache: 'no-store' });
        if (r.ok) setData(await r.json());
      } catch {}
    }
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, []);

  const maxVal = Math.max(...data.stunden.map(s => {
    if (mode === 'bestellungen') return s.bestellungen;
    if (mode === 'umsatz') return s.umsatz;
    return s.puenktlichkeit_pct;
  }), 1);

  return (
    <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 space-y-4 text-white font-sans">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-violet-400" />
          <span className="font-bold text-base text-violet-200">Statistiken V19</span>
          <span className="text-xs text-slate-500">Zonen-Effizienz</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-lg font-bold tabular-nums ${data.score_delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>{data.score}</span>
          <span className={`text-xs ${data.score_delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {data.score_delta >= 0 ? '+' : ''}{data.score_delta}
          </span>
        </div>
      </div>

      {/* Alert */}
      {data.alert && (
        <div className="flex items-center gap-2 bg-red-900/30 border border-red-700/50 rounded-lg px-3 py-2 text-xs text-red-300 animate-pulse">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          {data.alert}
        </div>
      )}

      {/* 6-KPI-Grid */}
      <div className="grid grid-cols-3 gap-2">
        {[
          {
            label: 'Bestellungen',
            value: `${data.bestellungen}`,
            sub: `/${data.bestellungen_ziel} Ziel`,
            color: data.bestellungen >= data.bestellungen_ziel ? 'text-green-400' : 'text-yellow-400',
            pct: Math.min(100, Math.round((data.bestellungen / data.bestellungen_ziel) * 100)),
            bar: 'bg-violet-500',
          },
          {
            label: 'Umsatz',
            value: euro(data.umsatz),
            sub: `/${euro(data.umsatz_ziel)}`,
            color: data.umsatz >= data.umsatz_ziel ? 'text-green-400' : 'text-yellow-400',
            pct: Math.min(100, Math.round((data.umsatz / data.umsatz_ziel) * 100)),
            bar: 'bg-emerald-500',
          },
          {
            label: 'Pünktlichkeit',
            value: `${data.puenktlichkeit_pct}%`,
            sub: `/${data.puenktlichkeit_ziel_pct}% Ziel`,
            color: data.puenktlichkeit_pct >= data.puenktlichkeit_ziel_pct ? 'text-green-400' : 'text-yellow-400',
            pct: data.puenktlichkeit_ziel_pct > 0 ? Math.min(100, Math.round((data.puenktlichkeit_pct / data.puenktlichkeit_ziel_pct) * 100)) : 0,
            bar: 'bg-blue-500',
          },
          {
            label: 'Ø Lieferzeit',
            value: `${data.avg_lieferzeit_min} min`,
            sub: '',
            color: data.avg_lieferzeit_min <= 30 ? 'text-green-400' : 'text-orange-400',
            pct: null,
            bar: '',
          },
          {
            label: 'Storno',
            value: `${data.storno_pct}%`,
            sub: '',
            color: data.storno_pct < 5 ? 'text-green-400' : 'text-red-400',
            pct: null,
            bar: '',
          },
          {
            label: 'Bewertung',
            value: `★ ${data.bewertung.toFixed(1)}`,
            sub: '',
            color: data.bewertung >= 4.5 ? 'text-yellow-400' : 'text-slate-400',
            pct: null,
            bar: '',
          },
        ].map(kpi => (
          <div key={kpi.label} className="bg-slate-900/60 rounded-lg p-2 border border-slate-800">
            <div className={`text-sm font-bold tabular-nums ${kpi.color}`}>{kpi.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{kpi.label}</div>
            {kpi.sub && <div className="text-xs text-slate-600">{kpi.sub}</div>}
            {kpi.pct !== null && (
              <div className="mt-1.5 h-1 bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${kpi.bar}`} style={{ width: `${kpi.pct}%` }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Stundenverlauf */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1">
            <Activity className="w-3 h-3 text-slate-400" />
            <span className="text-xs text-slate-400 font-medium">Stundenverlauf</span>
          </div>
          <div className="flex gap-1">
            {(['bestellungen', 'umsatz', 'puenktlichkeit'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`text-xs px-2 py-0.5 rounded-full transition-colors ${mode === m ? 'bg-violet-700 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
              >
                {m === 'bestellungen' ? 'Bestellg.' : m === 'umsatz' ? 'Umsatz' : 'Pünktl.'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-end gap-1 h-16">
          {data.stunden.map(s => {
            const val = mode === 'bestellungen' ? s.bestellungen : mode === 'umsatz' ? s.umsatz : s.puenktlichkeit_pct;
            const pct = Math.round((val / maxVal) * 100);
            return (
              <div key={s.stunde} className="flex-1 flex flex-col items-center gap-0.5">
                <div
                  className={`w-full rounded-t transition-all ${s.ist_jetzt ? 'bg-violet-500' : 'bg-slate-700'}`}
                  style={{ height: `${Math.max(4, pct * 0.56)}px` }}
                />
                <span className="text-xs text-slate-600">{s.stunde}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Zonen-Effizienz-Matrix */}
      <div>
        <div className="flex items-center gap-1 mb-2">
          <MapPin className="w-3 h-3 text-slate-400" />
          <span className="text-xs text-slate-400 font-medium">Zonen-Effizienz</span>
        </div>
        <div className="space-y-2">
          {data.zonen.map(z => (
            <div key={z.zone} className="bg-slate-900/60 rounded-lg px-3 py-2 border border-slate-800">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-300">{z.zone}</span>
                <div className="flex items-center gap-3 text-xs">
                  <span className={`font-bold ${z.sla_pct >= 85 ? 'text-green-400' : z.sla_pct >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                    SLA {z.sla_pct}%
                  </span>
                  <span className="text-slate-500">{z.avg_min} min</span>
                  <span className="text-emerald-400">{euro(z.umsatz)}</span>
                  <span className={`font-medium ${z.marge_pct >= 30 ? 'text-green-400' : 'text-yellow-400'}`}>{z.marge_pct}%</span>
                </div>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${z.sla_pct >= 85 ? 'bg-green-500' : z.sla_pct >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${z.sla_pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top-Fahrer */}
      <div>
        <div className="flex items-center gap-1 mb-2">
          <Users className="w-3 h-3 text-slate-400" />
          <span className="text-xs text-slate-400 font-medium">Top-Fahrer</span>
        </div>
        <div className="space-y-1.5">
          {data.top_fahrer.map(f => (
            <div key={f.rang} className="flex items-center gap-3 bg-slate-900/60 rounded-lg px-3 py-2 border border-slate-800">
              <span className={`text-sm font-bold w-5 text-center ${f.rang === 1 ? 'text-yellow-400' : f.rang === 2 ? 'text-slate-300' : 'text-orange-700'}`}>
                {f.rang === 1 ? '🥇' : f.rang === 2 ? '🥈' : '🥉'}
              </span>
              <span className="text-sm font-medium text-slate-300 flex-1">{f.name}</span>
              <div className="flex items-center gap-3 text-xs">
                <span className={`font-bold ${f.score >= 90 ? 'text-cyan-400' : f.score >= 80 ? 'text-green-400' : 'text-yellow-400'}`}>
                  {f.score}
                  <span className={`ml-0.5 ${f.score_delta >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {f.score_delta >= 0 ? '+' : ''}{f.score_delta}
                  </span>
                </span>
                <span className="text-slate-500">{f.touren}T</span>
                <span className="text-yellow-400">{euro(f.trinkgeld)}</span>
                <span className="text-blue-400">{f.puenktlichkeit_pct}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-xs text-slate-600 text-right">Live · 60s Polling · Mock-Fallback</div>
    </div>
  );
}
