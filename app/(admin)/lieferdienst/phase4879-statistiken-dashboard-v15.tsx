'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, YAxis, PieChart, Pie } from 'recharts';
import { BarChart2, TrendingUp, TrendingDown, AlertTriangle, Star, Clock, Euro, Bike, Target, Zap, CheckCircle2, Package, Leaf, Map } from 'lucide-react';

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
  co2_kg: number;
}

interface ZoneKpi {
  zone: string;
  umsatz: number;
  sla_pct: number;
  avg_min: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  gewinn_pct: number;
}

interface ArtikelKpi {
  artikel: string;
  bestellungen: number;
  anteil_pct: number;
}

interface SchichtVergleich {
  schicht: string;
  heute: number;
  vorwoche: number;
}

interface ZoneProfitability {
  zone: string;
  umsatz: number;
  kosten: number;
  gewinn: number;
  marge_pct: number;
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
  top_artikel: ArtikelKpi[];
  schichtvergleich: SchichtVergleich[];
  zonen: ZoneKpi[];
  zonen_profit: ZoneProfitability[];
  co2_gesamt_kg: number;
}

function ampelBg(a: string) {
  if (a === 'gruen') return 'bg-green-500';
  if (a === 'gelb') return 'bg-yellow-500';
  return 'bg-red-500';
}

function ampelColor(a: string) {
  if (a === 'gruen') return 'text-green-400';
  if (a === 'gelb') return 'text-yellow-400';
  return 'text-red-400';
}

const MOCK: ApiResponse = {
  score: 87, score_delta: 3, score_ziel: 85,
  alerts: [],
  co2_gesamt_kg: 22.4,
  kpis: [
    { label: 'Umsatz heute', wert: '1.842 €', delta_pct: 8,  ziel: '2.000 €', ampel: 'gelb' },
    { label: 'Bestellungen', wert: 68,         delta_pct: 12, ziel: 80,        ampel: 'gelb' },
    { label: 'Pünktlichkeit', wert: '88%',     delta_pct: 2,  ziel: '90%',     ampel: 'gelb' },
    { label: 'SLA ≤30m',    wert: '91%',      delta_pct: 4,  ziel: '95%',     ampel: 'gelb' },
    { label: 'Avg. Lieferzeit', wert: '26m',  delta_pct: -5, ziel: '30m',     ampel: 'gruen' },
    { label: 'Fahrer online',  wert: 5,        delta_pct: 0,  ziel: 6,         ampel: 'gelb' },
  ],
  stundenverlauf: [
    { stunde: '11', bestellungen: 4,  umsatz: 88,  puenktlichkeit: 100, jetzt: false },
    { stunde: '12', bestellungen: 11, umsatz: 242, puenktlichkeit: 95,  jetzt: false },
    { stunde: '13', bestellungen: 14, umsatz: 308, puenktlichkeit: 90,  jetzt: false },
    { stunde: '14', bestellungen: 9,  umsatz: 198, puenktlichkeit: 88,  jetzt: false },
    { stunde: '15', bestellungen: 7,  umsatz: 154, puenktlichkeit: 86,  jetzt: true  },
    { stunde: '16', bestellungen: 0,  umsatz: 0,   puenktlichkeit: 0,   jetzt: false },
  ],
  wochenvergleich: [
    { tag: 'Mo', heute: 1200, vorwoche: 1100 },
    { tag: 'Di', heute: 1400, vorwoche: 1300 },
    { tag: 'Mi', heute: 1842, vorwoche: 1700 },
  ],
  top_artikel: [
    { artikel: 'Falafel Wrap', bestellungen: 22, anteil_pct: 32 },
    { artikel: 'Hummus Teller', bestellungen: 18, anteil_pct: 26 },
    { artikel: 'Shawarma', bestellungen: 14, anteil_pct: 21 },
    { artikel: 'Veggie Bowl', bestellungen: 10, anteil_pct: 15 },
  ],
  schichtvergleich: [
    { schicht: 'Mittag', heute: 38, vorwoche: 34 },
    { schicht: 'Nachmittag', heute: 22, vorwoche: 28 },
    { schicht: 'Abend', heute: 8, vorwoche: 0 },
  ],
  top_fahrer: [
    { fahrer_name: 'M. Schulz', score: 97, touren: 12, trinkgeld: 9.4, km: 42.1, puenktlichkeit_pct: 97, co2_kg: 2.2 },
    { fahrer_name: 'A. Klein',  score: 80, touren: 9,  trinkgeld: 5.8, km: 31.4, puenktlichkeit_pct: 81, co2_kg: 1.8 },
    { fahrer_name: 'T. Bauer',  score: 63, touren: 7,  trinkgeld: 3.2, km: 25.0, puenktlichkeit_pct: 64, co2_kg: 1.4 },
  ],
  zonen: [
    { zone: 'Aachen Mitte',   umsatz: 820, sla_pct: 94, avg_min: 23, ampel: 'gruen', gewinn_pct: 62 },
    { zone: 'Burtscheid',     umsatz: 540, sla_pct: 88, avg_min: 29, ampel: 'gelb',  gewinn_pct: 48 },
    { zone: 'Brand',          umsatz: 320, sla_pct: 80, avg_min: 35, ampel: 'rot',   gewinn_pct: 31 },
    { zone: 'Forst',          umsatz: 162, sla_pct: 91, avg_min: 26, ampel: 'gruen', gewinn_pct: 55 },
  ],
  zonen_profit: [
    { zone: 'Aachen Mitte', umsatz: 820, kosten: 312, gewinn: 508, marge_pct: 62 },
    { zone: 'Burtscheid',   umsatz: 540, kosten: 281, gewinn: 259, marge_pct: 48 },
    { zone: 'Brand',        umsatz: 320, kosten: 221, gewinn: 99,  marge_pct: 31 },
    { zone: 'Forst',        umsatz: 162, kosten: 73,  gewinn: 89,  marge_pct: 55 },
  ],
};

export function LieferdienstPhase4879StatistikenDashboardV15({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);

  useEffect(() => {
    if (!locationId) return;
    const load = async () => {
      try {
        const r = await fetch(`/api/delivery/lieferdienst/statistiken?location_id=${locationId}`);
        if (r.ok) { const j = await r.json(); if (!j.error) setData(j); }
      } catch { /* mock */ }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [locationId]);

  const maxSchicht = Math.max(...data.schichtvergleich.map(s => Math.max(s.heute, s.vorwoche)), 1);
  const maxProfit  = Math.max(...data.zonen_profit.map(z => z.umsatz), 1);

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 bg-emerald-950/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-semibold text-emerald-300">Statistiken Dashboard V15</span>
          <span className="text-[10px] px-1.5 py-0.5 bg-lime-900/50 text-lime-300 rounded-full flex items-center gap-1">
            <Leaf className="w-2.5 h-2.5" /> Zonen-Profit
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Target className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-400">Ziel {data.score_ziel}</span>
          <span className={`text-xl font-extrabold ${data.score >= data.score_ziel ? 'text-green-400' : 'text-yellow-400'}`}>{data.score}</span>
          <span className={`text-xs ${data.score_delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {data.score_delta >= 0 ? '+' : ''}{data.score_delta}
          </span>
        </div>
      </div>

      {/* Alerts */}
      {data.alerts.map((a, i) => (
        <div key={i} className="px-4 py-2 border-b border-red-800/40 bg-red-950/30 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <span className="text-xs text-red-300">{a}</span>
        </div>
      ))}

      {/* CO2 Banner */}
      <div className="px-4 py-2 border-b border-lime-800/40 bg-lime-950/20 flex items-center gap-2">
        <Leaf className="w-3.5 h-3.5 text-lime-400 shrink-0" />
        <span className="text-xs text-lime-300">CO₂-Ausstoß heute gesamt: <strong>{data.co2_gesamt_kg} kg</strong></span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-px border-b border-slate-700 bg-slate-700">
        {data.kpis.map(k => (
          <div key={k.label} className="bg-slate-900 px-3 py-2.5">
            <div className="text-[10px] text-slate-400 mb-0.5">{k.label}</div>
            <div className="flex items-center gap-1.5">
              <span className={`text-sm font-bold ${ampelColor(k.ampel)}`}>{k.wert}</span>
              <span className={`text-[9px] ${k.delta_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {k.delta_pct >= 0 ? '+' : ''}{k.delta_pct}%
              </span>
            </div>
            <div className="text-[9px] text-slate-600">Ziel: {k.ziel}</div>
          </div>
        ))}
      </div>

      {/* Stundenverlauf */}
      <div className="px-4 py-3 border-b border-slate-700">
        <div className="text-xs font-semibold text-slate-300 mb-2">Stundenverlauf (Bestellungen)</div>
        <div className="h-20">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.stundenverlauf} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="stunde" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="bestellungen" radius={[2, 2, 0, 0]}>
                {data.stundenverlauf.map((s, i) => (
                  <Cell key={i} fill={s.jetzt ? '#6366f1' : '#334155'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Zonen-Profitabilität (NEU in V15) */}
      <div className="px-4 py-3 border-b border-slate-700">
        <div className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
          <Map className="w-3.5 h-3.5 text-emerald-400" />
          Zonen-Profitabilität
        </div>
        <div className="space-y-2">
          {data.zonen_profit.map(z => (
            <div key={z.zone}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-slate-400 w-28 truncate">{z.zone}</span>
                <div className="flex gap-1 flex-1">
                  <div className="flex-1 h-3 bg-slate-700 rounded-sm overflow-hidden relative">
                    <div className="h-full bg-emerald-600/70 rounded-sm" style={{ width: `${(z.umsatz / maxProfit) * 100}%` }} />
                    <div className="absolute inset-0 flex items-center px-1">
                      <span className="text-[9px] text-emerald-300 font-semibold">{z.umsatz} €</span>
                    </div>
                  </div>
                </div>
                <span className={`text-xs font-bold w-10 text-right ${z.marge_pct >= 50 ? 'text-green-400' : z.marge_pct >= 35 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {z.marge_pct}%
                </span>
              </div>
              <div className="h-1 bg-slate-800 rounded-full overflow-hidden ml-28">
                <div
                  className={`h-full rounded-full ${z.marge_pct >= 50 ? 'bg-green-500' : z.marge_pct >= 35 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${z.marge_pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top-Artikel */}
      <div className="px-4 py-3 border-b border-slate-700">
        <div className="text-xs font-semibold text-slate-300 mb-2">Top-Artikel heute</div>
        <div className="space-y-1.5">
          {data.top_artikel.map((a, i) => (
            <div key={a.artikel} className="flex items-center gap-2">
              <span className="text-xs text-slate-500 w-4">{i + 1}.</span>
              <Package className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="text-xs text-slate-300 flex-1 truncate">{a.artikel}</span>
              <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${a.anteil_pct}%` }} />
              </div>
              <span className="text-xs text-slate-400 w-8 text-right">{a.bestellungen}×</span>
            </div>
          ))}
        </div>
      </div>

      {/* Schichtvergleich */}
      <div className="px-4 py-3 border-b border-slate-700">
        <div className="text-xs font-semibold text-slate-300 mb-2">Schichtvergleich (Bestellungen)</div>
        <div className="space-y-2">
          {data.schichtvergleich.map(s => {
            const max = Math.max(s.heute, s.vorwoche, 1);
            return (
              <div key={s.schicht}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-slate-400 w-20">{s.schicht}</span>
                  <span className="text-emerald-400 text-xs font-semibold">Heute {s.heute}</span>
                  <span className="text-slate-500 text-xs">Vw. {s.vorwoche}</span>
                </div>
                <div className="space-y-0.5">
                  <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(s.heute / maxSchicht) * 100}%` }} />
                  </div>
                  <div className="h-1 rounded-full bg-slate-700 overflow-hidden">
                    <div className="h-full bg-slate-500 rounded-full" style={{ width: `${(s.vorwoche / maxSchicht) * 100}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Fahrer */}
      <div className="px-4 py-3 border-b border-slate-700">
        <div className="text-xs font-semibold text-slate-300 mb-2">Top-3 Fahrer</div>
        <div className="space-y-2">
          {data.top_fahrer.map((f, i) => (
            <div key={f.fahrer_name} className="flex items-center gap-2">
              <span className="text-sm shrink-0">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
              <span className="text-xs text-slate-300 flex-1 truncate">{f.fahrer_name}</span>
              <div className="flex gap-2 text-[10px] text-slate-500">
                <span className="text-yellow-400 font-semibold">{f.score}</span>
                <span>{f.touren} T.</span>
                <span className="text-green-400">{f.trinkgeld} €</span>
                <span className={f.puenktlichkeit_pct >= 80 ? 'text-green-400' : 'text-yellow-400'}>{f.puenktlichkeit_pct}%</span>
                <span className="text-lime-400 flex items-center gap-0.5">
                  <Leaf className="w-2.5 h-2.5" />{f.co2_kg}kg
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Wochenvergleich */}
      <div className="px-4 py-3 border-b border-slate-700">
        <div className="text-xs font-semibold text-slate-300 mb-2">Wochenvergleich (Umsatz €)</div>
        <div className="h-20">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.wochenvergleich} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="tag" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
              <Line type="monotone" dataKey="vorwoche" stroke="#475569" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="heute" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Zonen SLA */}
      <div className="px-4 py-3 border-b border-slate-700">
        <div className="text-xs font-semibold text-slate-300 mb-2">Zonen-SLA</div>
        <div className="space-y-2">
          {data.zonen.map(z => (
            <div key={z.zone} className="flex items-center gap-2">
              <span className="text-xs text-slate-400 w-24 truncate">{z.zone}</span>
              <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${ampelBg(z.ampel)}`} style={{ width: `${z.sla_pct}%` }} />
              </div>
              <span className={`text-xs w-10 text-right ${ampelColor(z.ampel)}`}>{z.sla_pct}%</span>
              <span className="text-[10px] text-slate-500 w-14 text-right">{z.umsatz} €</span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 py-2 flex items-center justify-between bg-slate-800/20">
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <Zap className="w-3 h-3" />
          <span>60-Sek-Polling</span>
        </div>
        <span className="text-[10px] text-slate-500">{locationId ?? 'Demo'}</span>
      </div>
    </div>
  );
}
