'use client';

import { useEffect, useState } from 'react';
import { BarChart2, TrendingUp, TrendingDown, Minus, AlertTriangle, Euro, Clock, Star, Users, Package } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface KpiItem {
  label: string;
  wert: string | number;
  delta_pct: number;
  ziel: number | null;
  ampel: 'gruen' | 'gelb' | 'rot';
  einheit: string;
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
}

interface ZoneKpi {
  zone: string;
  sla_pct: number;
  umsatz: number;
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
  gesamt_score: 79,
  score_delta: +3,
  alerts: ['Lieferzeit über Ziel in Zone Mitte'],
  kpis: [
    { label: 'Umsatz', wert: '1.842', delta_pct: +8.2, ziel: 2000, ampel: 'gelb', einheit: '€' },
    { label: 'Bestellungen', wert: 94, delta_pct: +5.1, ziel: 100, ampel: 'gelb', einheit: '' },
    { label: 'Lieferzeit', wert: '28', delta_pct: -3.4, ziel: 30, ampel: 'gruen', einheit: 'min' },
    { label: 'Pünktlichkeit', wert: '84', delta_pct: +2.1, ziel: 85, ampel: 'gelb', einheit: '%' },
    { label: 'Bewertung', wert: '4.6', delta_pct: +0.4, ziel: 4.5, ampel: 'gruen', einheit: '★' },
    { label: 'Stornoquote', wert: '3.2', delta_pct: +0.8, ziel: 3.0, ampel: 'rot', einheit: '%' },
    { label: 'Fahrer aktiv', wert: 5, delta_pct: 0, ziel: 6, ampel: 'gelb', einheit: '' },
    { label: 'Trinkgeld Ø', wert: '2.40', delta_pct: +12, ziel: 2.0, ampel: 'gruen', einheit: '€' },
  ],
  stunden: [
    { stunde: '11', bestellungen: 8, umsatz: 142, ist_jetzt: false },
    { stunde: '12', bestellungen: 18, umsatz: 324, ist_jetzt: false },
    { stunde: '13', bestellungen: 22, umsatz: 398, ist_jetzt: false },
    { stunde: '14', bestellungen: 15, umsatz: 268, ist_jetzt: false },
    { stunde: '15', bestellungen: 10, umsatz: 180, ist_jetzt: false },
    { stunde: '16', bestellungen: 12, umsatz: 212, ist_jetzt: false },
    { stunde: '17', bestellungen: 9, umsatz: 162, ist_jetzt: true },
  ],
  top_fahrer: [
    { fahrer_name: 'Max M.', score: 92, touren: 8, trinkgeld: 3.20 },
    { fahrer_name: 'Sara K.', score: 78, touren: 6, trinkgeld: 2.10 },
    { fahrer_name: 'Tom B.', score: 71, touren: 5, trinkgeld: 1.80 },
  ],
  zonen: [
    { zone: 'Nord', sla_pct: 91, umsatz: 620 },
    { zone: 'Mitte', sla_pct: 74, umsatz: 840 },
    { zone: 'Süd', sla_pct: 88, umsatz: 382 },
  ],
  chart_modus: 'bestellungen',
};

function DeltaIcon({ delta }: { delta: number }) {
  if (delta > 0) return <TrendingUp className="w-3 h-3 text-green-400" />;
  if (delta < 0) return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-400" />;
}

function ampelBorder(a: string) {
  if (a === 'gruen') return 'border-green-800';
  if (a === 'gelb') return 'border-yellow-800';
  return 'border-red-800';
}

function ampelText(a: string) {
  if (a === 'gruen') return 'text-green-400';
  if (a === 'gelb') return 'text-yellow-400';
  return 'text-red-400';
}

export function LieferdienstPhase4730StatistikenDashboardV10({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [chartModus, setChartModus] = useState<'bestellungen' | 'umsatz'>('bestellungen');

  async function load() {
    const url = locationId
      ? `/api/delivery/lieferdienst/statistiken-dashboard?location_id=${locationId}`
      : '/api/delivery/lieferdienst/statistiken-dashboard';
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
  const chartData = data.stunden.map(s => ({
    stunde: s.stunde,
    wert: chartModus === 'bestellungen' ? s.bestellungen : s.umsatz,
    ist_jetzt: s.ist_jetzt,
  }));

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4 mb-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <BarChart2 className="w-4 h-4 text-indigo-400" />
        <span className="text-sm font-semibold text-slate-300">Statistiken Dashboard V10</span>
        <span className="ml-auto text-xs text-gray-500">60-Sek-Polling</span>
      </div>

      {/* Alerts */}
      {data.alerts.map((a, i) => (
        <div key={i} className="flex items-center gap-2 text-xs text-red-300 bg-red-900/30 rounded px-3 py-1.5 mb-2">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          {a}
        </div>
      ))}

      {/* Score Header */}
      <div className="flex items-center gap-4 bg-black/20 rounded p-3 mb-3">
        <div>
          <div className="text-xs text-gray-400">Gesamt-Score</div>
          <div className="flex items-center gap-1.5">
            <span className={`text-4xl font-bold ${scoreColor}`}>{data.gesamt_score}</span>
            <DeltaIcon delta={data.score_delta} />
            <span className={`text-sm ${data.score_delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {data.score_delta >= 0 ? '+' : ''}{data.score_delta}
            </span>
          </div>
        </div>
        <div className="flex-1">
          <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${data.gesamt_score >= 85 ? 'bg-green-500' : data.gesamt_score >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${data.gesamt_score}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 mt-1">Ziel: 85 Punkte</div>
        </div>
      </div>

      {/* 8-KPI-Grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {data.kpis.map((kpi, i) => (
          <div key={i} className={`border rounded p-2 ${ampelBorder(kpi.ampel)}`}>
            <div className="text-xs text-gray-400">{kpi.label}</div>
            <div className="flex items-center gap-1.5">
              <span className={`text-base font-bold ${ampelText(kpi.ampel)}`}>
                {kpi.wert}{kpi.einheit}
              </span>
              <DeltaIcon delta={kpi.delta_pct} />
              <span className={`text-xs ${kpi.delta_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {kpi.delta_pct > 0 ? '+' : ''}{kpi.delta_pct.toFixed(1)}%
              </span>
            </div>
            {kpi.ziel !== null && (
              <div className="mt-1 h-1 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${kpi.ampel === 'gruen' ? 'bg-green-500' : kpi.ampel === 'gelb' ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(100, (Number(kpi.wert) / kpi.ziel) * 100)}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-black/20 rounded p-3 mb-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-gray-400">Stundenverlauf</span>
          <div className="ml-auto flex gap-1">
            {(['bestellungen', 'umsatz'] as const).map(m => (
              <button
                key={m}
                onClick={() => setChartModus(m)}
                className={`text-xs px-2 py-0.5 rounded ${chartModus === m ? 'bg-indigo-700 text-white' : 'bg-gray-800 text-gray-400'}`}
              >
                {m === 'bestellungen' ? 'Bestellungen' : 'Umsatz'}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={70}>
          <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="stunde" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, fontSize: 11 }}
              formatter={(v: number) => chartModus === 'umsatz' ? [`${v}€`, 'Umsatz'] : [v, 'Bestellungen']}
            />
            <Bar dataKey="wert" radius={[2, 2, 0, 0]}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={d.ist_jetzt ? '#7c3aed' : '#3b82f6'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top Fahrer */}
      <div className="bg-black/20 rounded p-3 mb-3">
        <div className="text-xs text-gray-400 mb-2 flex items-center gap-1"><Users className="w-3 h-3" /> Top-3 Fahrer</div>
        <div className="space-y-1.5">
          {data.top_fahrer.map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-3">{i + 1}.</span>
              <span className="text-xs text-slate-300 flex-1 truncate">{f.fahrer_name}</span>
              <div className="h-1.5 w-16 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${f.score}%` }} />
              </div>
              <span className="text-xs text-indigo-300 w-6">{f.score}</span>
              <span className="text-xs text-gray-500 flex items-center gap-0.5">
                <Package className="w-3 h-3" />{f.touren}
              </span>
              <span className="text-xs text-green-400 flex items-center gap-0.5">
                <Euro className="w-3 h-3" />{f.trinkgeld.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Zonen */}
      <div className="space-y-1.5">
        {data.zonen.map((z, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-10">{z.zone}</span>
            <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${z.sla_pct >= 85 ? 'bg-green-500' : z.sla_pct >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${z.sla_pct}%` }}
              />
            </div>
            <span className={`text-xs w-8 text-right ${z.sla_pct >= 85 ? 'text-green-400' : z.sla_pct >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>{z.sla_pct}%</span>
            <span className="text-xs text-gray-500 w-14 text-right">{z.umsatz}€</span>
          </div>
        ))}
      </div>
    </div>
  );
}
