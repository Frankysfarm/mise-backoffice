'use client';

import { useEffect, useState } from 'react';
import { BarChart2, TrendingUp, TrendingDown, Minus, AlertTriangle, Euro, Clock, Star, Users, Target, Activity, Gauge } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, YAxis } from 'recharts';

interface KpiItem {
  label: string;
  wert: string | number;
  delta_pct: number;
  ziel: number | null;
  ampel: 'gruen' | 'gelb' | 'rot';
  einheit: string;
  vorwoche: number | null;
}

interface StundeData {
  stunde: string;
  bestellungen: number;
  umsatz: number;
  ist_jetzt: boolean;
  puenktlichkeit: number;
}

interface FahrerKpi {
  fahrer_name: string;
  score: number;
  touren: number;
  trinkgeld: number;
  delta: number;
  km: number;
}

interface ZoneKpi {
  zone: string;
  sla_pct: number;
  umsatz: number;
  trend: 'up' | 'down' | 'gleich';
  avg_min: number;
}

interface WochenVergleich {
  tag: string;
  diese_woche: number;
  letzte_woche: number;
}

interface ApiResponse {
  gesamt_score: number;
  score_delta: number;
  score_ziel: number;
  kpis: KpiItem[];
  stunden: StundeData[];
  top_fahrer: FahrerKpi[];
  zonen: ZoneKpi[];
  alerts: string[];
  wochen_vergleich: WochenVergleich[];
}

const MOCK: ApiResponse = {
  gesamt_score: 84,
  score_delta: +6,
  score_ziel: 88,
  alerts: ['Zone Nord: SLA unter 70% — Fahrer neu einteilen?'],
  kpis: [
    { label: 'Bestellungen', wert: 61,     delta_pct: 15,  ziel: 65,   ampel: 'gelb', einheit: '',    vorwoche: 53 },
    { label: 'Umsatz',       wert: '1.640',delta_pct: 12,  ziel: 1800, ampel: 'gelb', einheit: '€',   vorwoche: 1464 },
    { label: 'Ø Lieferzeit', wert: 29,     delta_pct: -8,  ziel: 32,   ampel: 'gruen',einheit: 'min', vorwoche: 32 },
    { label: 'Bewertung',    wert: 4.9,    delta_pct: 2,   ziel: 4.5,  ampel: 'gruen',einheit: '★',   vorwoche: 4.8 },
    { label: 'Pünktlichkeit',wert: 89,     delta_pct: 5,   ziel: 85,   ampel: 'gruen',einheit: '%',   vorwoche: 85 },
    { label: 'SLA',          wert: 82,     delta_pct: -3,  ziel: 90,   ampel: 'gelb', einheit: '%',   vorwoche: 85 },
    { label: 'Stornos',      wert: 1,      delta_pct: -67, ziel: 3,    ampel: 'gruen',einheit: '',    vorwoche: 3 },
    { label: 'Fahrer aktiv', wert: 5,      delta_pct: 25,  ziel: 4,    ampel: 'gruen',einheit: '',    vorwoche: 4 },
  ],
  stunden: [
    { stunde: '11', bestellungen: 5,  umsatz: 120, ist_jetzt: false, puenktlichkeit: 90 },
    { stunde: '12', bestellungen: 11, umsatz: 268, ist_jetzt: false, puenktlichkeit: 88 },
    { stunde: '13', bestellungen: 14, umsatz: 340, ist_jetzt: false, puenktlichkeit: 85 },
    { stunde: '14', bestellungen: 10, umsatz: 248, ist_jetzt: false, puenktlichkeit: 87 },
    { stunde: '15', bestellungen: 7,  umsatz: 162, ist_jetzt: false, puenktlichkeit: 92 },
    { stunde: '16', bestellungen: 9,  umsatz: 218, ist_jetzt: true,  puenktlichkeit: 89 },
    { stunde: '17', bestellungen: 0,  umsatz: 0,   ist_jetzt: false, puenktlichkeit: 0 },
    { stunde: '18', bestellungen: 0,  umsatz: 0,   ist_jetzt: false, puenktlichkeit: 0 },
  ],
  top_fahrer: [
    { fahrer_name: 'M. Schulz', score: 96, touren: 9, trinkgeld: 14.80, delta: 4, km: 42.1 },
    { fahrer_name: 'A. Klein',  score: 84, touren: 8, trinkgeld: 10.40, delta: 0, km: 31.5 },
    { fahrer_name: 'T. Bauer',  score: 77, touren: 7, trinkgeld: 8.20,  delta: -2, km: 28.3 },
  ],
  zonen: [
    { zone: 'Innenstadt', sla_pct: 93, umsatz: 720, trend: 'up',    avg_min: 24 },
    { zone: 'West',        sla_pct: 86, umsatz: 480, trend: 'gleich',avg_min: 28 },
    { zone: 'Nord',        sla_pct: 67, umsatz: 248, trend: 'down',  avg_min: 38 },
    { zone: 'Süd',         sla_pct: 91, umsatz: 192, trend: 'up',    avg_min: 26 },
  ],
  wochen_vergleich: [
    { tag: 'Mo', diese_woche: 42, letzte_woche: 37 },
    { tag: 'Di', diese_woche: 55, letzte_woche: 49 },
    { tag: 'Mi', diese_woche: 61, letzte_woche: 53 },
    { tag: 'Do', diese_woche: 0,  letzte_woche: 58 },
    { tag: 'Fr', diese_woche: 0,  letzte_woche: 72 },
  ],
};

function AmpelDot({ ampel }: { ampel: 'gruen' | 'gelb' | 'rot' }) {
  const colors = { gruen: 'bg-green-500', gelb: 'bg-yellow-400', rot: 'bg-red-500' };
  return <span className={`w-2 h-2 rounded-full shrink-0 ${colors[ampel]}`} />;
}

function DeltaBadge({ delta }: { delta: number }) {
  if (delta > 0) return <span className="flex items-center gap-0.5 text-green-400"><TrendingUp className="w-2.5 h-2.5" />+{delta}%</span>;
  if (delta < 0) return <span className="flex items-center gap-0.5 text-red-400"><TrendingDown className="w-2.5 h-2.5" />{delta}%</span>;
  return <span className="flex items-center gap-0.5 text-gray-400"><Minus className="w-2.5 h-2.5" />0%</span>;
}

type ChartModus = 'bestellungen' | 'umsatz' | 'puenktlichkeit';

export function LieferdienstPhase4735StatistikenDashboardV12({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [modus, setModus] = useState<ChartModus>('bestellungen');

  async function load() {
    const url = locationId
      ? `/api/delivery/admin/statistiken-live?location_id=${locationId}`
      : '/api/delivery/admin/statistiken-live';
    try {
      const res = await fetch(url);
      if (res.ok) setData(await res.json());
      else setData(MOCK);
    } catch {
      setData(MOCK);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!data) return null;

  const scoreColor = data.gesamt_score >= 85 ? 'text-green-400' : data.gesamt_score >= 70 ? 'text-yellow-400' : 'text-red-400';
  const zielPct = Math.min(100, (data.gesamt_score / data.score_ziel) * 100);

  const chartData = data.stunden.map(s => ({
    name: `${s.stunde}h`,
    wert: modus === 'bestellungen' ? s.bestellungen : modus === 'umsatz' ? s.umsatz : s.puenktlichkeit,
    ist_jetzt: s.ist_jetzt,
  }));

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4 mb-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <BarChart2 className="w-4 h-4 text-emerald-400" />
        <span className="text-sm font-semibold text-slate-300">Statistiken Dashboard V12</span>
        <span className="ml-auto text-xs text-gray-500">60-Sek</span>
      </div>

      {/* Alerts */}
      {data.alerts.map((a, i) => (
        <div key={i} className="flex items-center gap-2 text-xs text-yellow-300 bg-yellow-900/20 rounded px-3 py-1.5 mb-2">
          <AlertTriangle className="w-3 h-3 shrink-0" />{a}
        </div>
      ))}

      {/* Score Header */}
      <div className="flex items-center gap-4 bg-black/20 rounded p-3 mb-3">
        <div>
          <div className="text-xs text-gray-400">Gesamt-Score</div>
          <div className={`text-3xl font-bold ${scoreColor}`}>{data.gesamt_score}</div>
          <div className="flex items-center gap-1 text-xs mt-0.5">
            {data.score_delta >= 0
              ? <><TrendingUp className="w-3.5 h-3.5 text-green-400" /><span className="text-green-400">+{data.score_delta}</span></>
              : <><TrendingDown className="w-3.5 h-3.5 text-red-400" /><span className="text-red-400">{data.score_delta}</span></>}
          </div>
        </div>
        <div className="flex-1">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">Ziel {data.score_ziel}</span>
            <span className={scoreColor}>{zielPct.toFixed(0)}%</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${data.gesamt_score >= 85 ? 'bg-green-500' : data.gesamt_score >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${zielPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {data.kpis.map(k => (
          <div key={k.label} className="bg-black/20 rounded p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <AmpelDot ampel={k.ampel} />
              <span className="text-xs text-gray-400 truncate">{k.label}</span>
              <span className="ml-auto text-xs"><DeltaBadge delta={k.delta_pct} /></span>
            </div>
            <div className="flex items-end gap-1.5">
              <span className={`text-base font-bold ${k.ampel === 'gruen' ? 'text-green-400' : k.ampel === 'gelb' ? 'text-yellow-400' : 'text-red-400'}`}>
                {k.wert}{k.einheit}
              </span>
              {k.vorwoche !== null && (
                <span className="text-xs text-gray-500 mb-0.5">Vw: {k.vorwoche}{k.einheit}</span>
              )}
            </div>
            {k.ziel !== null && (
              <div className="mt-1.5 h-1 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${k.ampel === 'gruen' ? 'bg-green-500' : k.ampel === 'gelb' ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(100, (Number(k.wert) / k.ziel) * 100)}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400">Stundenverlauf</span>
          <div className="flex gap-1">
            {(['bestellungen', 'umsatz', 'puenktlichkeit'] as const).map(m => (
              <button
                key={m}
                onClick={() => setModus(m)}
                className={`text-xs px-1.5 py-0.5 rounded ${modus === m ? 'bg-emerald-700 text-white' : 'bg-black/20 text-gray-400'}`}
              >
                {m === 'bestellungen' ? 'Best.' : m === 'umsatz' ? 'Ums.' : 'Pünktl.'}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={80}>
          <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, fontSize: 11 }}
              labelStyle={{ color: '#94a3b8' }}
              itemStyle={{ color: '#6ee7b7' }}
              formatter={((v: number) => {
                if (modus === 'umsatz') return [`${v} €`, 'Umsatz'];
                if (modus === 'puenktlichkeit') return [`${v}%`, 'Pünktlichkeit'];
                return [v, 'Bestellungen'];
              }) as any}
            />
            <Bar dataKey="wert" radius={[3, 3, 0, 0]}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={d.ist_jetzt ? '#059669' : '#10b981'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Wochenvergleich */}
      <div className="mb-3">
        <div className="text-xs text-gray-400 mb-2 flex items-center gap-1">
          <Activity className="w-3 h-3" /> Wochenvergleich Bestellungen
        </div>
        <ResponsiveContainer width="100%" height={60}>
          <LineChart data={data.wochen_vergleich} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="tag" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, fontSize: 11 }}
              labelStyle={{ color: '#94a3b8' }}
            />
            <Line type="monotone" dataKey="diese_woche" stroke="#10b981" strokeWidth={2} dot={false} name="Diese Wo." />
            <Line type="monotone" dataKey="letzte_woche" stroke="#6b7280" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="Letzte Wo." />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Top Fahrer */}
      <div className="mb-3">
        <div className="text-xs text-gray-400 mb-2 flex items-center gap-1">
          <Users className="w-3 h-3" /> Top-Fahrer
        </div>
        <div className="space-y-1.5">
          {data.top_fahrer.map((f, i) => (
            <div key={f.fahrer_name} className="flex items-center gap-2 text-xs">
              <span className="w-5 h-5 rounded-full bg-emerald-900/60 text-emerald-300 flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
              <span className="flex-1 text-slate-300 truncate">{f.fahrer_name}</span>
              <span className={`font-semibold ${f.score >= 85 ? 'text-green-400' : f.score >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>{f.score}</span>
              <span className="text-gray-500">{f.touren}T</span>
              <span className="text-gray-500">{f.km.toFixed(0)}km</span>
              <span className="text-green-400">+{f.trinkgeld.toFixed(2).replace('.', ',')} €</span>
              {f.delta > 0
                ? <TrendingUp className="w-3 h-3 text-green-400 shrink-0" />
                : f.delta < 0
                  ? <TrendingDown className="w-3 h-3 text-red-400 shrink-0" />
                  : <Minus className="w-3 h-3 text-gray-500 shrink-0" />}
            </div>
          ))}
        </div>
      </div>

      {/* Zonen */}
      <div>
        <div className="text-xs text-gray-400 mb-2 flex items-center gap-1">
          <Target className="w-3 h-3" /> Zonen-Performance
        </div>
        <div className="space-y-1.5">
          {data.zonen.map(z => (
            <div key={z.zone} className="flex items-center gap-2 text-xs">
              <span className={`w-2 h-2 rounded-full shrink-0 ${z.sla_pct >= 85 ? 'bg-green-500' : z.sla_pct >= 70 ? 'bg-yellow-400' : 'bg-red-500'}`} />
              <span className="w-20 text-slate-400 truncate">{z.zone}</span>
              <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${z.sla_pct >= 85 ? 'bg-green-500' : z.sla_pct >= 70 ? 'bg-yellow-400' : 'bg-red-500'}`}
                  style={{ width: `${z.sla_pct}%` }}
                />
              </div>
              <span className={`w-8 text-right ${z.sla_pct >= 85 ? 'text-green-400' : z.sla_pct >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>{z.sla_pct}%</span>
              <span className="text-gray-500 w-10 text-right">{z.avg_min}min</span>
              <span className="text-gray-500 w-12 text-right">{z.umsatz} €</span>
              {z.trend === 'up' ? <TrendingUp className="w-3 h-3 text-green-400 shrink-0" /> : z.trend === 'down' ? <TrendingDown className="w-3 h-3 text-red-400 shrink-0" /> : <Minus className="w-3 h-3 text-gray-500 shrink-0" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
