'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, YAxis } from 'recharts';
import { BarChart2, TrendingUp, TrendingDown, AlertTriangle, Star, Clock, Euro, Bike, Target, Zap, CheckCircle2 } from 'lucide-react';

interface KpiItem {
  label: string;
  wert: string | number;
  delta_pct: number;
  ziel: string | number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface StundeItem {
  stunde: string;
  bestellungen: number;
  umsatz: number;
  puenktlichkeit: number;
  jetzt: boolean;
}

interface FahrerKpi {
  fahrer_name: string;
  score: number;
  touren: number;
  trinkgeld: number;
  km: number;
  puenktlichkeit_pct: number;
}

interface ZoneKpi {
  zone: string;
  umsatz: number;
  sla_pct: number;
  avg_min: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiResponse {
  score: number;
  score_delta: number;
  score_ziel: number;
  alerts: string[];
  kpis: KpiItem[];
  stundenverlauf: StundeItem[];
  wochenvergleich: { tag: string; heute: number; vorwoche: number }[];
  top_fahrer: FahrerKpi[];
  zonen: ZoneKpi[];
  modus: 'bestellungen' | 'umsatz' | 'puenktlichkeit';
}

const MOCK: ApiResponse = {
  score: 89,
  score_delta: +5,
  score_ziel: 85,
  alerts: [],
  modus: 'umsatz',
  kpis: [
    { label: 'Umsatz heute', wert: '1.248 €', delta_pct: 12, ziel: '1.100 €', ampel: 'gruen' },
    { label: 'Bestellungen', wert: 67, delta_pct: 8, ziel: 60, ampel: 'gruen' },
    { label: 'Pünktlichkeit', wert: '84%', delta_pct: 3, ziel: '80%', ampel: 'gruen' },
    { label: 'Ø Lieferzeit', wert: '27 Min', delta_pct: -5, ziel: '30 Min', ampel: 'gruen' },
    { label: 'Storno-Quote', wert: '3.2%', delta_pct: -1, ziel: '<5%', ampel: 'gruen' },
    { label: 'Trinkgeld/Tour', wert: '2.40 €', delta_pct: 15, ziel: '2.00 €', ampel: 'gruen' },
    { label: 'Ø Bestellwert', wert: '18.60 €', delta_pct: 4, ziel: '16 €', ampel: 'gruen' },
    { label: 'Aktive Fahrer', wert: 5, delta_pct: 0, ziel: 4, ampel: 'gruen' },
  ],
  stundenverlauf: [
    { stunde: '11', bestellungen: 3, umsatz: 58, puenktlichkeit: 100, jetzt: false },
    { stunde: '12', bestellungen: 9, umsatz: 167, puenktlichkeit: 89, jetzt: false },
    { stunde: '13', bestellungen: 14, umsatz: 261, puenktlichkeit: 79, jetzt: false },
    { stunde: '14', bestellungen: 11, umsatz: 204, puenktlichkeit: 82, jetzt: false },
    { stunde: '15', bestellungen: 6, umsatz: 111, puenktlichkeit: 100, jetzt: false },
    { stunde: '16', bestellungen: 4, umsatz: 74, puenktlichkeit: 75, jetzt: false },
    { stunde: '17', bestellungen: 8, umsatz: 149, puenktlichkeit: 88, jetzt: false },
    { stunde: '18', bestellungen: 12, umsatz: 224, puenktlichkeit: 83, jetzt: true },
  ],
  wochenvergleich: [
    { tag: 'Mo', heute: 810, vorwoche: 720 },
    { tag: 'Di', heute: 950, vorwoche: 890 },
    { tag: 'Mi', heute: 1100, vorwoche: 980 },
    { tag: 'Do', heute: 1248, vorwoche: 1070 },
    { tag: 'Fr', heute: 0, vorwoche: 1340 },
    { tag: 'Sa', heute: 0, vorwoche: 1560 },
    { tag: 'So', heute: 0, vorwoche: 1420 },
  ],
  top_fahrer: [
    { fahrer_name: 'M. Schulz', score: 96, touren: 9, trinkgeld: 3.10, km: 38.2, puenktlichkeit_pct: 95 },
    { fahrer_name: 'A. Klein', score: 79, touren: 7, trinkgeld: 2.20, km: 29.6, puenktlichkeit_pct: 81 },
    { fahrer_name: 'T. Bauer', score: 62, touren: 5, trinkgeld: 1.80, km: 22.1, puenktlichkeit_pct: 64 },
  ],
  zonen: [
    { zone: 'Innenstadt', umsatz: 524, sla_pct: 91, avg_min: 24, ampel: 'gruen' },
    { zone: 'Süd', umsatz: 312, sla_pct: 78, avg_min: 31, ampel: 'gelb' },
    { zone: 'Nord', umsatz: 412, sla_pct: 85, avg_min: 27, ampel: 'gruen' },
  ],
};

function ampelColor(a: string) {
  if (a === 'gruen') return 'text-green-400';
  if (a === 'gelb') return 'text-yellow-400';
  return 'text-red-400';
}

function ampelBg(a: string) {
  if (a === 'gruen') return 'bg-green-500/10 border-green-700/30';
  if (a === 'gelb') return 'bg-yellow-500/10 border-yellow-700/30';
  return 'bg-red-500/10 border-red-700/30';
}

type ChartModus = 'bestellungen' | 'umsatz' | 'puenktlichkeit';

export function LieferdienstPhase4740StatistikenDashboardV13({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [modus, setModus] = useState<ChartModus>('umsatz');

  useEffect(() => {
    if (!locationId) return;
    const load = async () => {
      try {
        const r = await fetch(`/api/delivery/stats/dashboard?location_id=${locationId}`);
        if (r.ok) { const j = await r.json(); if (!j.error) setData(j); }
      } catch { /* mock */ }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [locationId]);

  const scorePct = Math.min(100, data.score);
  const zielPct = Math.min(100, data.score_ziel);

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 bg-emerald-950/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-semibold text-emerald-300">Statistiken Dashboard V13</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-2xl font-extrabold ${data.score >= 85 ? 'text-green-400' : data.score >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
            {data.score}
          </span>
          <span className={`text-sm font-semibold ${data.score_delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {data.score_delta >= 0 ? '+' : ''}{data.score_delta}
          </span>
        </div>
      </div>

      {/* Score bar */}
      <div className="px-4 pt-3 pb-2">
        <div className="relative h-2 rounded-full bg-slate-700 overflow-hidden">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${scorePct}%` }} />
          <div className="absolute top-0 bottom-0 w-0.5 bg-indigo-400" style={{ left: `${zielPct}%` }} />
        </div>
        <div className="flex justify-between mt-1 text-[10px] text-slate-500">
          <span>0</span>
          <span className="text-indigo-400">Ziel {data.score_ziel}</span>
          <span>100</span>
        </div>
      </div>

      {/* Alerts */}
      {data.alerts.map((a, i) => (
        <div key={i} className="mx-4 mb-2 flex items-center gap-2 bg-red-950/30 border border-red-800/30 rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <span className="text-xs text-red-300">{a}</span>
        </div>
      ))}

      {/* KPI Grid */}
      <div className="px-4 pb-3">
        <div className="grid grid-cols-2 gap-2">
          {data.kpis.map(k => (
            <div key={k.label} className={`border rounded-xl px-3 py-2 ${ampelBg(k.ampel)}`}>
              <div className="flex items-start justify-between">
                <span className="text-[10px] text-slate-400 leading-tight">{k.label}</span>
                {k.delta_pct !== 0 && (
                  <span className={`text-[10px] font-semibold ${k.delta_pct > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {k.delta_pct > 0 ? '+' : ''}{k.delta_pct}%
                  </span>
                )}
              </div>
              <div className={`text-base font-extrabold mt-0.5 ${ampelColor(k.ampel)}`}>{k.wert}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Ziel: {k.ziel}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Stundenverlauf */}
      <div className="border-t border-slate-700/60 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-300">Stundenverlauf</span>
          <div className="flex gap-1">
            {(['bestellungen', 'umsatz', 'puenktlichkeit'] as const).map(m => (
              <button
                key={m}
                onClick={() => setModus(m)}
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${modus === m ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
              >
                {m === 'bestellungen' ? 'Orders' : m === 'umsatz' ? 'Umsatz' : 'Pünktl.'}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={80}>
          <BarChart data={data.stundenverlauf} barSize={14}>
            <XAxis dataKey="stunde" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: '#94a3b8' }}
            />
            <Bar dataKey={modus} radius={[3, 3, 0, 0]}>
              {data.stundenverlauf.map((d, i) => (
                <Cell key={i} fill={d.jetzt ? '#6366f1' : '#10b981'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Wochenvergleich */}
      <div className="border-t border-slate-700/60 px-4 py-3">
        <div className="text-xs font-semibold text-slate-300 mb-3">Wochenvergleich Umsatz</div>
        <ResponsiveContainer width="100%" height={60}>
          <LineChart data={data.wochenvergleich}>
            <XAxis dataKey="tag" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
            <Line type="monotone" dataKey="vorwoche" stroke="#475569" strokeWidth={1.5} dot={false} name="Vorwoche" />
            <Line type="monotone" dataKey="heute" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: '#10b981' }} name="Heute" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Top Fahrer */}
      <div className="border-t border-slate-700/60 px-4 py-3">
        <div className="text-xs font-semibold text-slate-300 mb-2">Top Fahrer</div>
        <div className="space-y-2">
          {data.top_fahrer.map((f, i) => (
            <div key={f.fahrer_name} className="flex items-center gap-2">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                i === 0 ? 'bg-yellow-600 text-yellow-100' : i === 1 ? 'bg-slate-500 text-white' : 'bg-orange-800 text-orange-200'
              }`}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white truncate">{f.fahrer_name}</span>
                  <span className={`text-xs font-bold ${f.score >= 85 ? 'text-green-400' : f.score >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>{f.score}</span>
                </div>
                <div className="mt-0.5 h-1 rounded-full bg-slate-700/60 overflow-hidden">
                  <div className={`h-full rounded-full ${f.score >= 85 ? 'bg-green-500' : f.score >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${f.score}%` }} />
                </div>
                <div className="flex gap-2 mt-0.5 text-[10px] text-slate-500">
                  <span>{f.touren} Touren</span>
                  <span>+{f.trinkgeld.toFixed(2)}€ TG</span>
                  <span>{f.puenktlichkeit_pct}% pünktl.</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Zonen */}
      <div className="border-t border-slate-700/60 px-4 py-3">
        <div className="text-xs font-semibold text-slate-300 mb-2">Zonen-Performance</div>
        <div className="space-y-2">
          {data.zonen.map(z => (
            <div key={z.zone} className={`border rounded-lg px-3 py-2 ${ampelBg(z.ampel)}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200">{z.zone}</span>
                <span className={`text-xs font-bold ${ampelColor(z.ampel)}`}>SLA {z.sla_pct}%</span>
              </div>
              <div className="mt-1 flex gap-3 text-[10px] text-slate-400">
                <span className="flex items-center gap-0.5"><Euro className="w-2.5 h-2.5" />{z.umsatz} €</span>
                <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />Ø {z.avg_min} Min</span>
              </div>
              <div className="mt-1.5 h-1 rounded-full bg-slate-700/60 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${z.ampel === 'gruen' ? 'bg-green-500' : z.ampel === 'gelb' ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${z.sla_pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-slate-700 flex items-center justify-between bg-slate-800/20">
        <span className="text-[10px] text-slate-500">60-Sek-Polling · Mock-Fallback</span>
        <span className="text-[10px] text-slate-500">{locationId ?? 'Demo'}</span>
      </div>
    </div>
  );
}
