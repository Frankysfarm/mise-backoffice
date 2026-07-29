'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, YAxis } from 'recharts';
import { BarChart2, TrendingUp, TrendingDown, AlertTriangle, Star, Clock, Euro, Bike, Target, Zap, CheckCircle2, Package } from 'lucide-react';

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
  top_artikel: ArtikelKpi[];
  schicht_vergleich: SchichtVergleich[];
  modus: 'bestellungen' | 'umsatz' | 'puenktlichkeit';
}

const MOCK: ApiResponse = {
  score: 91,
  score_delta: +4,
  score_ziel: 85,
  alerts: [],
  modus: 'umsatz',
  kpis: [
    { label: 'Umsatz heute', wert: '1.384 €', delta_pct: 14, ziel: '1.200 €', ampel: 'gruen' },
    { label: 'Bestellungen', wert: 74, delta_pct: 10, ziel: 65, ampel: 'gruen' },
    { label: 'Pünktlichkeit', wert: '87%', delta_pct: 4, ziel: '80%', ampel: 'gruen' },
    { label: 'Ø Lieferzeit', wert: '25 Min', delta_pct: -8, ziel: '30 Min', ampel: 'gruen' },
    { label: 'Storno-Quote', wert: '2.8%', delta_pct: -2, ziel: '<5%', ampel: 'gruen' },
    { label: 'Trinkgeld/Tour', wert: '2.70 €', delta_pct: 18, ziel: '2.00 €', ampel: 'gruen' },
    { label: 'Ø Bestellwert', wert: '18.70 €', delta_pct: 5, ziel: '16 €', ampel: 'gruen' },
    { label: 'Aktive Fahrer', wert: 6, delta_pct: 0, ziel: 5, ampel: 'gruen' },
  ],
  stundenverlauf: [
    { stunde: '11', bestellungen: 4, umsatz: 72, puenktlichkeit: 100, jetzt: false },
    { stunde: '12', bestellungen: 11, umsatz: 198, puenktlichkeit: 91, jetzt: false },
    { stunde: '13', bestellungen: 16, umsatz: 285, puenktlichkeit: 81, jetzt: false },
    { stunde: '14', bestellungen: 12, umsatz: 218, puenktlichkeit: 84, jetzt: false },
    { stunde: '15', bestellungen: 7, umsatz: 126, puenktlichkeit: 100, jetzt: false },
    { stunde: '16', bestellungen: 5, umsatz: 89, puenktlichkeit: 80, jetzt: false },
    { stunde: '17', bestellungen: 9, umsatz: 168, puenktlichkeit: 89, jetzt: false },
    { stunde: '18', bestellungen: 10, umsatz: 228, puenktlichkeit: 90, jetzt: true },
  ],
  wochenvergleich: [
    { tag: 'Mo', heute: 890, vorwoche: 780 },
    { tag: 'Di', heute: 960, vorwoche: 840 },
    { tag: 'Mi', heute: 1100, vorwoche: 920 },
    { tag: 'Do', heute: 1050, vorwoche: 970 },
    { tag: 'Fr', heute: 1384, vorwoche: 1210 },
    { tag: 'Sa', heute: 0, vorwoche: 1580 },
    { tag: 'So', heute: 0, vorwoche: 1340 },
  ],
  top_fahrer: [
    { fahrer_name: 'M. Schulz', score: 97, touren: 14, trinkgeld: 38, km: 52, puenktlichkeit_pct: 96 },
    { fahrer_name: 'S. Klein',  score: 89, touren: 12, trinkgeld: 30, km: 44, puenktlichkeit_pct: 88 },
    { fahrer_name: 'T. Bauer',  score: 81, touren: 10, trinkgeld: 24, km: 38, puenktlichkeit_pct: 82 },
  ],
  zonen: [
    { zone: 'Innenstadt',   umsatz: 620, sla_pct: 92, avg_min: 22, ampel: 'gruen' },
    { zone: 'Südviertel',   umsatz: 410, sla_pct: 84, avg_min: 27, ampel: 'gelb'  },
    { zone: 'Westpark',     umsatz: 290, sla_pct: 78, avg_min: 31, ampel: 'rot'   },
    { zone: 'Nördliche Bf', umsatz: 64,  sla_pct: 100, avg_min: 18, ampel: 'gruen' },
  ],
  top_artikel: [
    { artikel: 'Klassik Burger', bestellungen: 38, anteil_pct: 51 },
    { artikel: 'Crispy Chicken', bestellungen: 22, anteil_pct: 30 },
    { artikel: 'Vegan Bowl',     bestellungen: 14, anteil_pct: 19 },
  ],
  schicht_vergleich: [
    { schicht: 'Mittag (11-14)', heute: 525, vorwoche: 455 },
    { schicht: 'Nachmittag',    heute: 305, vorwoche: 260 },
    { schicht: 'Abend (17-22)', heute: 554, vorwoche: 495 },
  ],
};

function ampelColor(a: string) {
  if (a === 'gruen') return 'text-green-400';
  if (a === 'gelb') return 'text-yellow-400';
  return 'text-red-400';
}

function ampelBg(a: string) {
  if (a === 'gruen') return 'bg-green-500';
  if (a === 'gelb') return 'bg-yellow-500';
  return 'bg-red-500';
}

const MODI: ('bestellungen' | 'umsatz' | 'puenktlichkeit')[] = ['bestellungen', 'umsatz', 'puenktlichkeit'];

export function LieferdienstPhase4870StatistikenDashboardV14({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [modus, setModus] = useState<ApiResponse['modus']>('umsatz');

  useEffect(() => {
    if (!locationId) return;
    const load = async () => {
      try {
        const r = await fetch(`/api/delivery/admin/statistiken-v14?location_id=${locationId}`);
        if (r.ok) { const j = await r.json(); if (!j.error) setData(j); }
      } catch { /* mock */ }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [locationId]);

  const scorePct = Math.min(100, data.score);

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 bg-emerald-950/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-semibold text-emerald-300">Statistiken Dashboard V14</span>
          <span className="text-[10px] px-1.5 py-0.5 bg-emerald-900/50 text-emerald-300 rounded-full">Top-Artikel + Schicht-Vgl.</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-lg font-extrabold ${data.score >= 85 ? 'text-green-400' : data.score >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
            {data.score}
          </span>
          <span className={`text-xs font-semibold ${data.score_delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {data.score_delta >= 0 ? '+' : ''}{data.score_delta}
          </span>
        </div>
      </div>

      {/* Score Arc */}
      <div className="px-4 py-3 border-b border-slate-700/60 flex items-center gap-4">
        <div className="relative w-14 h-14 shrink-0">
          <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="22" fill="none" stroke="#1e293b" strokeWidth="6" />
            <circle cx="28" cy="28" r="22" fill="none"
              stroke={data.score >= 85 ? '#10b981' : data.score >= 70 ? '#eab308' : '#ef4444'}
              strokeWidth="6" strokeDasharray={`${scorePct * 1.382} 138.2`} strokeLinecap="round" />
            <circle cx="28" cy="28" r="22" fill="none" stroke="#6366f1" strokeWidth="2"
              strokeDasharray={`1 ${136 - data.score_ziel * 1.382}`} strokeDashoffset={-(data.score_ziel * 1.382)} />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-sm font-extrabold ${data.score >= 85 ? 'text-green-400' : 'text-yellow-400'}`}>{data.score}</span>
          </div>
        </div>
        <div className="flex-1">
          <div className="text-xs text-slate-400 mb-1.5">Ziel: {data.score_ziel}</div>
          <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(data.score_ziel / 100) * 100}%` }} />
          </div>
        </div>
      </div>

      {/* Alerts */}
      {data.alerts.map((a, i) => (
        <div key={i} className="px-4 py-2 bg-red-950/30 border-b border-red-800/30 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span className="text-xs text-red-300">{a}</span>
        </div>
      ))}

      {/* 8-KPI Grid */}
      <div className="grid grid-cols-2 gap-px bg-slate-700/40 border-b border-slate-700">
        {data.kpis.map(k => (
          <div key={k.label} className="bg-slate-900 px-3 py-2">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] text-slate-500">{k.label}</span>
              <span className={`text-[10px] font-semibold ${k.delta_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {k.delta_pct >= 0 ? '+' : ''}{k.delta_pct}%
              </span>
            </div>
            <div className={`text-sm font-bold ${ampelColor(k.ampel)}`}>{k.wert}</div>
            <div className="text-[10px] text-slate-600">Ziel: {k.ziel}</div>
          </div>
        ))}
      </div>

      {/* Stundenverlauf */}
      <div className="px-4 py-3 border-b border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-300">Stundenverlauf</span>
          <div className="flex gap-1">
            {MODI.map(m => (
              <button key={m} onClick={() => setModus(m)}
                className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${modus === m ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                {m === 'bestellungen' ? 'Best.' : m === 'umsatz' ? 'Umsatz' : 'Pünktl.'}
              </button>
            ))}
          </div>
        </div>
        <div className="h-28">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.stundenverlauf} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="stunde" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey={modus} radius={[3, 3, 0, 0]}>
                {data.stundenverlauf.map((h, i) => (
                  <Cell key={i} fill={h.jetzt ? '#a855f7' : modus === 'puenktlichkeit' ? '#22c55e' : '#10b981'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Schicht-Vergleich (neu in V14) */}
      <div className="px-4 py-3 border-b border-slate-700">
        <div className="text-xs font-semibold text-slate-300 mb-2">Schicht-Vergleich (Umsatz €)</div>
        <div className="space-y-2">
          {data.schicht_vergleich.map(s => {
            const max = Math.max(s.heute, s.vorwoche, 1);
            return (
              <div key={s.schicht}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">{s.schicht}</span>
                  <div className="flex gap-3 text-[10px]">
                    <span className="text-emerald-400">Heute {s.heute} €</span>
                    <span className="text-slate-500">Vw. {s.vorwoche} €</span>
                  </div>
                </div>
                <div className="space-y-0.5">
                  <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(s.heute / max) * 100}%` }} />
                  </div>
                  <div className="h-1 rounded-full bg-slate-700 overflow-hidden">
                    <div className="h-full bg-slate-500 rounded-full" style={{ width: `${(s.vorwoche / max) * 100}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Wochenvergleich */}
      <div className="px-4 py-3 border-b border-slate-700">
        <div className="text-xs font-semibold text-slate-300 mb-2">Wochenvergleich (Umsatz €)</div>
        <div className="h-24">
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

      {/* Top-Artikel (neu in V14) */}
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

      {/* Top Fahrer */}
      <div className="px-4 py-3 border-b border-slate-700">
        <div className="text-xs font-semibold text-slate-300 mb-2">Top-3 Fahrer</div>
        <div className="space-y-2">
          {data.top_fahrer.map((f, i) => (
            <div key={f.fahrer_name} className="flex items-center gap-2">
              <span className={`text-sm shrink-0 ${i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}`}>{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
              <span className="text-xs text-slate-300 flex-1 truncate">{f.fahrer_name}</span>
              <div className="flex gap-2 text-[10px] text-slate-500">
                <span className="text-yellow-400 font-semibold">{f.score}</span>
                <span>{f.touren} T.</span>
                <span className="text-green-400">{f.trinkgeld} €</span>
                <span className={f.puenktlichkeit_pct >= 80 ? 'text-green-400' : 'text-yellow-400'}>{f.puenktlichkeit_pct}%</span>
              </div>
            </div>
          ))}
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
              <span className="text-[10px] text-slate-500 w-12 text-right">Ø {z.avg_min} Min</span>
              <span className="text-[10px] text-slate-500 w-14 text-right">{z.umsatz} €</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
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
