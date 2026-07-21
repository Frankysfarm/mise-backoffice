'use client';
import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Activity, AlertTriangle, Clock, Euro, Package, Star, TrendingDown, TrendingUp, Users, Zap } from 'lucide-react';

interface HourPoint { h: string; bestellungen: number; umsatz: number; }

interface ZoneRow { name: string; bestellungen: number; umsatz: number; avg_min: number; }

interface FahrerTop { name: string; touren: number; score: number; }

interface ApiData {
  bestellungen_heute: number;
  umsatz_heute: number;
  lieferzeit_avg: number;
  aktive_fahrer: number;
  sla_quote: number;
  bewertung_avg: number;
  stornoquote: number;
  neukunden_anteil: number;
  touren_gesamt: number;
  avg_bestellwert: number;
  stunden: HourPoint[];
  zonen: ZoneRow[];
  fahrer_top: FahrerTop[];
  alerts: string[];
}

const MOCK: ApiData = {
  bestellungen_heute: 94,
  umsatz_heute: 2870,
  lieferzeit_avg: 27,
  aktive_fahrer: 7,
  sla_quote: 93,
  bewertung_avg: 4.7,
  stornoquote: 2.8,
  neukunden_anteil: 21,
  touren_gesamt: 38,
  avg_bestellwert: 30.5,
  stunden: [
    { h: '10', bestellungen: 5,  umsatz: 152 },
    { h: '11', bestellungen: 8,  umsatz: 244 },
    { h: '12', bestellungen: 17, umsatz: 519 },
    { h: '13', bestellungen: 20, umsatz: 610 },
    { h: '14', bestellungen: 12, umsatz: 366 },
    { h: '15', bestellungen: 9,  umsatz: 274 },
    { h: '16', bestellungen: 10, umsatz: 305 },
    { h: '17', bestellungen: 15, umsatz: 458 },
    { h: '18', bestellungen: 22, umsatz: 671 },
    { h: '19', bestellungen: 24, umsatz: 732 },
    { h: '20', bestellungen: 19, umsatz: 580 },
    { h: '21', bestellungen: 11, umsatz: 335 },
  ],
  zonen: [
    { name: 'Mitte',   bestellungen: 34, umsatz: 1037, avg_min: 24 },
    { name: 'Nord',    bestellungen: 26, umsatz: 793,  avg_min: 29 },
    { name: 'Süd',     bestellungen: 21, umsatz: 640,  avg_min: 31 },
    { name: 'West',    bestellungen: 13, umsatz: 396,  avg_min: 27 },
  ],
  fahrer_top: [
    { name: 'Max M.',  touren: 14, score: 91 },
    { name: 'Anna B.', touren: 12, score: 87 },
    { name: 'Tim W.',  touren: 10, score: 82 },
  ],
  alerts: ['Stornoquote OK', 'SLA ≥90% ✓'],
};

const KPI_DEF = [
  { key: 'bestellungen_heute', label: 'Bestellungen',   icon: <Package size={14} />, fmt: (v: number) => v.toString(),              warn: (v: number) => v < 20,   color: 'blue' },
  { key: 'umsatz_heute',       label: 'Umsatz',         icon: <Euro    size={14} />, fmt: (v: number) => `${v.toFixed(0)} €`,       warn: (v: number) => v < 500,  color: 'green' },
  { key: 'lieferzeit_avg',     label: 'Ø Lieferzeit',   icon: <Clock   size={14} />, fmt: (v: number) => `${v} Min`,                warn: (v: number) => v > 35,   color: 'amber' },
  { key: 'aktive_fahrer',      label: 'Fahrer aktiv',   icon: <Users   size={14} />, fmt: (v: number) => v.toString(),              warn: (v: number) => v < 3,    color: 'blue' },
  { key: 'sla_quote',          label: 'SLA',            icon: <Zap     size={14} />, fmt: (v: number) => `${v}%`,                   warn: (v: number) => v < 90,   color: 'green' },
  { key: 'bewertung_avg',      label: 'Bewertung',      icon: <Star    size={14} />, fmt: (v: number) => `${v.toFixed(1)} ★`,      warn: (v: number) => v < 4.0,  color: 'amber' },
  { key: 'stornoquote',        label: 'Stornoquote',    icon: <AlertTriangle size={14} />, fmt: (v: number) => `${v.toFixed(1)}%`, warn: (v: number) => v > 8,    color: 'rose' },
  { key: 'neukunden_anteil',   label: 'Neukunden',      icon: <Activity size={14} />, fmt: (v: number) => `${v}%`,                 warn: (v: number) => false,    color: 'blue' },
  { key: 'touren_gesamt',      label: 'Touren',         icon: <TrendingUp size={14} />, fmt: (v: number) => v.toString(),          warn: (v: number) => false,    color: 'green' },
  { key: 'avg_bestellwert',    label: 'Ø Bestellwert',  icon: <Euro    size={14} />, fmt: (v: number) => `${v.toFixed(0)} €`,      warn: (v: number) => v < 20,   color: 'amber' },
] as const;

const COLOR_CLS = {
  green: { bg: 'bg-matcha-50',  border: 'border-matcha-200',  text: 'text-matcha-700'  },
  amber: { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700'   },
  rose:  { bg: 'bg-rose-50',    border: 'border-rose-200',    text: 'text-rose-700'    },
  blue:  { bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-700'    },
};

type ChartMode = 'bestellungen' | 'umsatz';

export function LieferdienstPhase2610StatistikLiveSynthesisCockpit({
  bestellungen = 0, umsatz = 0, locationId,
}: {
  bestellungen?: number; umsatz?: number; locationId?: string | null;
}) {
  const [data,  setData]  = useState<ApiData | null>(null);
  const [mode,  setMode]  = useState<ChartMode>('bestellungen');

  useEffect(() => {
    const load = () => {
      if (!locationId) { setData(MOCK); return; }
      fetch(`/api/delivery/lieferdienst/statistiken-synthesis?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData({ ...MOCK, bestellungen_heute: bestellungen, umsatz_heute: umsatz }));
    };
    load();
    const t = setInterval(load, 3 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId, bestellungen, umsatz]);

  if (!data) return null;

  const d = data as ApiData & Record<string, number>;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-matcha-600" />
          <span className="text-sm font-bold text-gray-900">Statistiken · Live Synthesis</span>
        </div>
        <span className="text-[10px] text-gray-400">3-Min-Polling</span>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {KPI_DEF.map(kpi => {
          const val = d[kpi.key] ?? 0;
          const warn = kpi.warn(val as number);
          const cls = warn ? COLOR_CLS.rose : COLOR_CLS[kpi.color as keyof typeof COLOR_CLS];
          return (
            <div key={kpi.key} className={`rounded-xl border ${cls.border} ${cls.bg} p-2`}>
              <div className={`flex items-center gap-1 ${cls.text}`}>
                {kpi.icon}
                <span className="text-[9px] font-semibold">{kpi.label}</span>
              </div>
              <div className={`mt-0.5 text-base font-black tabular-nums ${warn ? 'text-rose-700' : 'text-gray-900'}`}>
                {kpi.fmt(val as number)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart */}
      <div>
        <div className="mb-1.5 flex gap-2">
          {(['bestellungen', 'umsatz'] as ChartMode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                mode === m ? 'bg-matcha-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {m === 'bestellungen' ? 'Bestellungen' : 'Umsatz (€)'}
            </button>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={80}>
          <BarChart data={data.stunden} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <XAxis dataKey="h" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v: number) => mode === 'umsatz' ? [`${v} €`, 'Umsatz'] : [v, 'Bestellungen']}
              contentStyle={{ fontSize: 10, padding: '2px 6px' }}
            />
            <Bar dataKey={mode} radius={[3, 3, 0, 0]}>
              {data.stunden.map((_, i) => (
                <Cell key={i} fill={mode === 'umsatz' ? '#7f9c6e' : '#4f80a0'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Zonen Ranking */}
      <div>
        <div className="mb-1 text-[10px] font-bold text-gray-600 uppercase tracking-wide">Top Zonen</div>
        <div className="space-y-1">
          {data.zonen.slice(0, 4).map((z, i) => (
            <div key={z.name} className="flex items-center gap-2 text-[11px]">
              <span className="w-4 text-center text-[9px] font-bold text-gray-400">{i + 1}</span>
              <span className="flex-1 truncate font-medium text-gray-700">{z.name}</span>
              <span className="text-gray-500">{z.bestellungen} Best.</span>
              <span className="font-semibold text-matcha-700">{z.umsatz} €</span>
              <span className={`text-[9px] ${z.avg_min > 30 ? 'text-amber-600' : 'text-green-600'}`}>
                {z.avg_min} Min
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Fahrer Top */}
      <div>
        <div className="mb-1 text-[10px] font-bold text-gray-600 uppercase tracking-wide">Top Fahrer</div>
        <div className="flex gap-2">
          {data.fahrer_top.map((f, i) => (
            <div key={f.name} className="flex-1 rounded-lg bg-matcha-50 border border-matcha-200 p-1.5 text-center">
              <div className="text-[8px] text-gray-400 mb-0.5">#{i + 1}</div>
              <div className="text-[10px] font-bold text-gray-800 truncate">{f.name}</div>
              <div className="text-[10px] font-black text-matcha-700">{f.score} Pkt</div>
              <div className="text-[9px] text-gray-500">{f.touren} Touren</div>
            </div>
          ))}
        </div>
      </div>

      {/* Alert Strip */}
      {data.alerts.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {data.alerts.map((a, i) => (
            <span key={i} className="rounded-full bg-gray-100 border border-gray-200 px-2 py-0.5 text-[9px] text-gray-600">
              {a}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
