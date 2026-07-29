'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, YAxis } from 'recharts';
import { TrendingUp, TrendingDown, Euro, Clock, Star, Route, AlertTriangle, Zap } from 'lucide-react';

interface StundenDaten {
  stunde: number;
  umsatz: number;
  touren: number;
  puenktlichkeit: number;
}

interface FahrerKpi {
  fahrer_name: string;
  score: number;
  touren: number;
  puenktlichkeit_pct: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface Anomalie {
  typ: 'spike' | 'drop' | 'delay';
  beschreibung: string;
}

interface ApiResponse {
  umsatz_heute: number;
  umsatz_gestern: number;
  touren_heute: number;
  touren_gestern: number;
  puenktlichkeit_pct: number;
  bewertung_avg: number;
  stunden_verlauf: StundenDaten[];
  top_fahrer: FahrerKpi[];
  anomalien: Anomalie[];
}

const MOCK: ApiResponse = {
  umsatz_heute: 1847.5,
  umsatz_gestern: 1620.0,
  touren_heute: 64,
  touren_gestern: 58,
  puenktlichkeit_pct: 81,
  bewertung_avg: 4.6,
  anomalien: [{ typ: 'spike', beschreibung: 'Umsatz-Spike um 12:00 (+38% über Durchschnitt)' }],
  stunden_verlauf: [
    { stunde: 11, umsatz: 120, touren: 4, puenktlichkeit: 90 },
    { stunde: 12, umsatz: 285, touren: 9, puenktlichkeit: 78 },
    { stunde: 13, umsatz: 310, touren: 11, puenktlichkeit: 74 },
    { stunde: 14, umsatz: 195, touren: 7, puenktlichkeit: 83 },
    { stunde: 15, umsatz: 160, touren: 6, puenktlichkeit: 88 },
    { stunde: 16, umsatz: 175, touren: 6, puenktlichkeit: 85 },
    { stunde: 17, umsatz: 220, touren: 8, puenktlichkeit: 80 },
    { stunde: 18, umsatz: 382, touren: 13, puenktlichkeit: 72 },
  ],
  top_fahrer: [
    { fahrer_name: 'Lukas M.', score: 93, touren: 11, puenktlichkeit_pct: 94, ampel: 'gruen' },
    { fahrer_name: 'Jana K.', score: 86, touren: 9, puenktlichkeit_pct: 88, ampel: 'gruen' },
    { fahrer_name: 'Kemal D.', score: 74, touren: 8, puenktlichkeit_pct: 75, ampel: 'gelb' },
  ],
};

const ampelColor: Record<string, string> = { gruen: '#34d399', gelb: '#fbbf24', rot: '#f87171' };

function Delta({ current, prev, unit = '' }: { current: number; prev: number; unit?: string }) {
  const pct = prev > 0 ? ((current - prev) / prev * 100).toFixed(1) : '—';
  const up = current >= prev;
  return (
    <span className={`text-xs flex items-center gap-0.5 ${up ? 'text-emerald-400' : 'text-red-400'}`}>
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {up ? '+' : ''}{pct}{unit}
    </span>
  );
}

export function LieferdienstPhase4715StatistikenTagesPerformanceBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    if (!locationId) { setData(MOCK); return; }
    try {
      const r = await fetch(`/api/delivery/admin/statistiken-tages-performance?location_id=${locationId}`);
      if (r.ok) setData(await r.json());
      else setData(MOCK);
    } catch { setData(MOCK); }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return <div className="rounded-2xl bg-slate-900 p-4 text-slate-400 text-sm animate-pulse">Lade Tages-Performance…</div>;

  const umsatzDelta = data.umsatz_heute - data.umsatz_gestern;

  return (
    <div className="rounded-2xl bg-slate-900 text-white p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-400" />
          <span className="font-semibold text-slate-100">Tages-Performance</span>
        </div>
        <span className="text-xs text-slate-500">Live · 5-Min-Refresh</span>
      </div>

      {/* Anomalien */}
      {data.anomalien.map((a, i) => (
        <div key={i} className="flex items-center gap-2 rounded-lg bg-amber-900/40 border border-amber-700 px-3 py-2 text-amber-300 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {a.beschreibung}
        </div>
      ))}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-800 p-3">
          <div className="flex items-center gap-1 text-xs text-slate-400 mb-1"><Euro className="w-3 h-3" /> Umsatz heute</div>
          <div className="text-xl font-black text-white">€{data.umsatz_heute.toFixed(0)}</div>
          <Delta current={data.umsatz_heute} prev={data.umsatz_gestern} unit="%" />
        </div>
        <div className="rounded-xl bg-slate-800 p-3">
          <div className="flex items-center gap-1 text-xs text-slate-400 mb-1"><Route className="w-3 h-3" /> Touren</div>
          <div className="text-xl font-black text-white">{data.touren_heute}</div>
          <Delta current={data.touren_heute} prev={data.touren_gestern} />
        </div>
        <div className="rounded-xl bg-slate-800 p-3">
          <div className="flex items-center gap-1 text-xs text-slate-400 mb-1"><Clock className="w-3 h-3" /> Pünktlichkeit</div>
          <div className={`text-xl font-black ${data.puenktlichkeit_pct >= 80 ? 'text-emerald-400' : data.puenktlichkeit_pct >= 65 ? 'text-amber-400' : 'text-red-400'}`}>
            {data.puenktlichkeit_pct}%
          </div>
        </div>
        <div className="rounded-xl bg-slate-800 p-3">
          <div className="flex items-center gap-1 text-xs text-slate-400 mb-1"><Star className="w-3 h-3" /> Bewertung</div>
          <div className="text-xl font-black text-amber-400">★ {data.bewertung_avg.toFixed(1)}</div>
        </div>
      </div>

      {/* Stundenverlauf Chart */}
      <div>
        <p className="text-xs text-slate-400 mb-2">Umsatz-Verlauf (€)</p>
        <div className="h-28">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.stunden_verlauf} barSize={18}>
              <XAxis dataKey="stunde" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={h => `${h}h`} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: 11 }}
                formatter={(v: number) => [`€${v}`, 'Umsatz']}
                labelFormatter={l => `${l}:00`}
              />
              <Bar dataKey="umsatz" radius={[3, 3, 0, 0]}>
                {data.stunden_verlauf.map((d, i) => (
                  <Cell key={i} fill={d.umsatz > 250 ? '#f59e0b' : '#6366f1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pünktlichkeit Trendlinie */}
      <div>
        <p className="text-xs text-slate-400 mb-2">Pünktlichkeit-Trend (%)</p>
        <div className="h-20">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.stunden_verlauf}>
              <YAxis domain={[60, 100]} hide />
              <XAxis dataKey="stunde" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={h => `${h}h`} />
              <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: 11 }} formatter={(v: number) => [`${v}%`, 'Pünktlichkeit']} />
              <Line type="monotone" dataKey="puenktlichkeit" stroke="#34d399" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Fahrer */}
      <div>
        <p className="text-xs text-slate-400 mb-2">Top Fahrer heute</p>
        <div className="space-y-2">
          {data.top_fahrer.map((f, i) => (
            <div key={f.fahrer_name} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 w-4">#{i + 1}</span>
                <div className="w-2 h-2 rounded-full" style={{ background: ampelColor[f.ampel] }} />
                <span className="text-slate-100">{f.fahrer_name}</span>
                <span className="text-slate-500">{f.touren} Touren</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-slate-400">{f.puenktlichkeit_pct}%</span>
                <span className="font-bold text-white">{f.score}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
