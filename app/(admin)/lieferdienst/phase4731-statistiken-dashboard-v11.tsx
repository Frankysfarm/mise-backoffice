'use client';

import { useEffect, useState } from 'react';
import { BarChart2, TrendingUp, TrendingDown, Minus, AlertTriangle, Euro, Clock, Star, Users, Package, Target } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

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
}

interface FahrerKpi {
  fahrer_name: string;
  score: number;
  touren: number;
  trinkgeld: number;
  delta: number;
}

interface ZoneKpi {
  zone: string;
  sla_pct: number;
  umsatz: number;
  trend: 'up' | 'down' | 'gleich';
}

interface ApiResponse {
  gesamt_score: number;
  score_delta: number;
  kpis: KpiItem[];
  stunden: StundeData[];
  top_fahrer: FahrerKpi[];
  zonen: ZoneKpi[];
  alerts: string[];
  chart_modus: 'bestellungen' | 'umsatz';
}

const MOCK: ApiResponse = {
  gesamt_score: 81,
  score_delta: +4,
  alerts: ['Lieferzeit über Ziel in Zone Nord'],
  chart_modus: 'bestellungen',
  kpis: [
    { label: 'Bestellungen', wert: 54,     delta_pct: 12,  ziel: 60,   ampel: 'gelb', einheit: '',    vorwoche: 48 },
    { label: 'Umsatz',       wert: '1.412',delta_pct: 8,   ziel: 1600, ampel: 'gelb', einheit: '€',   vorwoche: 1307 },
    { label: 'Ø Lieferzeit', wert: 31,     delta_pct: -5,  ziel: 35,   ampel: 'gruen',einheit: 'min', vorwoche: 33 },
    { label: 'Bewertung',    wert: 4.8,    delta_pct: 2,   ziel: 4.5,  ampel: 'gruen',einheit: '★',   vorwoche: 4.7 },
    { label: 'Pünktlichkeit',wert: 87,     delta_pct: 4,   ziel: 85,   ampel: 'gruen',einheit: '%',   vorwoche: 83 },
    { label: 'SLA',          wert: 84,     delta_pct: -2,  ziel: 90,   ampel: 'gelb', einheit: '%',   vorwoche: 86 },
    { label: 'Stornos',      wert: 2,      delta_pct: -50, ziel: 3,    ampel: 'gruen',einheit: '',    vorwoche: 4 },
    { label: 'Fahrer aktiv', wert: 4,      delta_pct: 0,   ziel: 4,    ampel: 'gruen',einheit: '',    vorwoche: 4 },
  ],
  stunden: [
    { stunde: '11', bestellungen: 4,  umsatz: 98,  ist_jetzt: false },
    { stunde: '12', bestellungen: 10, umsatz: 240, ist_jetzt: false },
    { stunde: '13', bestellungen: 12, umsatz: 310, ist_jetzt: false },
    { stunde: '14', bestellungen: 9,  umsatz: 220, ist_jetzt: false },
    { stunde: '15', bestellungen: 6,  umsatz: 142, ist_jetzt: false },
    { stunde: '16', bestellungen: 7,  umsatz: 168, ist_jetzt: true  },
    { stunde: '17', bestellungen: 0,  umsatz: 0,   ist_jetzt: false },
    { stunde: '18', bestellungen: 0,  umsatz: 0,   ist_jetzt: false },
  ],
  top_fahrer: [
    { fahrer_name: 'M. Schulz', score: 94, touren: 8, trinkgeld: 12.50, delta: 3 },
    { fahrer_name: 'A. Klein',  score: 82, touren: 7, trinkgeld: 9.80,  delta: -1 },
    { fahrer_name: 'T. Bauer',  score: 75, touren: 6, trinkgeld: 7.20,  delta: 2 },
  ],
  zonen: [
    { zone: 'Innenstadt', sla_pct: 92, umsatz: 640, trend: 'up' },
    { zone: 'West',        sla_pct: 85, umsatz: 420, trend: 'gleich' },
    { zone: 'Nord',        sla_pct: 68, umsatz: 218, trend: 'down' },
    { zone: 'Süd',         sla_pct: 89, umsatz: 134, trend: 'up' },
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

export function LieferdienstPhase4731StatistikenDashboardV11({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [modus, setModus] = useState<'bestellungen' | 'umsatz'>('bestellungen');

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
  const chartData = data.stunden.map(s => ({ name: `${s.stunde}h`, wert: modus === 'bestellungen' ? s.bestellungen : s.umsatz, ist_jetzt: s.ist_jetzt }));

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4 mb-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <BarChart2 className="w-4 h-4 text-indigo-400" />
        <span className="text-sm font-semibold text-slate-300">Statistiken Dashboard V11</span>
        <span className="ml-auto text-xs text-gray-500">60-Sek</span>
      </div>

      {/* Alerts */}
      {data.alerts.map((a, i) => (
        <div key={i} className="flex items-center gap-2 text-xs text-yellow-300 bg-yellow-900/20 rounded px-3 py-1.5 mb-2">
          <AlertTriangle className="w-3 h-3 shrink-0" />{a}
        </div>
      ))}

      {/* Score */}
      <div className="flex items-center gap-4 bg-black/20 rounded p-3 mb-3">
        <div>
          <div className="text-xs text-gray-400">Gesamt-Score</div>
          <div className={`text-3xl font-bold ${scoreColor}`}>{data.gesamt_score}</div>
        </div>
        <div className="flex items-center gap-1 text-xs">
          {data.score_delta >= 0
            ? <><TrendingUp className="w-3.5 h-3.5 text-green-400" /><span className="text-green-400">+{data.score_delta}</span></>
            : <><TrendingDown className="w-3.5 h-3.5 text-red-400" /><span className="text-red-400">{data.score_delta}</span></>}
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
            {(['bestellungen', 'umsatz'] as const).map(m => (
              <button
                key={m}
                onClick={() => setModus(m)}
                className={`text-xs px-2 py-0.5 rounded ${modus === m ? 'bg-indigo-600 text-white' : 'bg-black/20 text-gray-400'}`}
              >
                {m === 'bestellungen' ? 'Bestellungen' : 'Umsatz'}
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
              itemStyle={{ color: '#a5b4fc' }}
              formatter={((v: number) => modus === 'umsatz' ? [`${v} €`, 'Umsatz'] : [v, 'Bestellungen']) as any}
            />
            <Bar dataKey="wert" radius={[3, 3, 0, 0]}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={d.ist_jetzt ? '#7c3aed' : '#4f46e5'} />
              ))}
            </Bar>
          </BarChart>
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
              <span className="w-5 h-5 rounded-full bg-indigo-900/60 text-indigo-300 flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
              <span className="flex-1 text-slate-300 truncate">{f.fahrer_name}</span>
              <span className={`font-semibold ${f.score >= 85 ? 'text-green-400' : f.score >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>{f.score}</span>
              <span className="text-gray-500">{f.touren} Tour(en)</span>
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
          <Target className="w-3 h-3" /> Zonen-SLA
        </div>
        <div className="space-y-1.5">
          {data.zonen.map(z => (
            <div key={z.zone} className="flex items-center gap-2 text-xs">
              <span className={`w-2 h-2 rounded-full shrink-0 ${z.sla_pct >= 85 ? 'bg-green-500' : z.sla_pct >= 70 ? 'bg-yellow-400' : 'bg-red-500'}`} />
              <span className="flex-1 text-slate-400">{z.zone}</span>
              <div className="w-20 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${z.sla_pct >= 85 ? 'bg-green-500' : z.sla_pct >= 70 ? 'bg-yellow-400' : 'bg-red-500'}`}
                  style={{ width: `${z.sla_pct}%` }}
                />
              </div>
              <span className={`w-8 text-right ${z.sla_pct >= 85 ? 'text-green-400' : z.sla_pct >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>{z.sla_pct}%</span>
              <span className="text-gray-500">{z.umsatz} €</span>
              {z.trend === 'up' ? <TrendingUp className="w-3 h-3 text-green-400 shrink-0" /> : z.trend === 'down' ? <TrendingDown className="w-3 h-3 text-red-400 shrink-0" /> : <Minus className="w-3 h-3 text-gray-500 shrink-0" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
