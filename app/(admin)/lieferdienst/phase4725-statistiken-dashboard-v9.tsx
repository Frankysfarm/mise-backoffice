'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, YAxis } from 'recharts';
import { BarChart2, TrendingUp, TrendingDown, Minus, AlertTriangle, Euro, Bike, Clock, Star, Target } from 'lucide-react';

interface KpiCard {
  label: string;
  value: string;
  ziel: string;
  delta: string;
  delta_positiv: boolean;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface StundenPunkt {
  stunde: string;
  bestellungen: number;
  umsatz: number;
  ist_jetzt: boolean;
}

interface TopFahrer {
  rang: number;
  name: string;
  score: number;
  touren: number;
  trinkgeld: string;
}

interface ZoneKpi {
  zone: string;
  sla_pct: number;
  umsatz: string;
  avg_min: number;
}

interface ApiResponse {
  kpis: KpiCard[];
  stunden: StundenPunkt[];
  top_fahrer: TopFahrer[];
  zonen: ZoneKpi[];
  gesamt_score: number;
  score_ampel: 'gruen' | 'gelb' | 'rot';
  alerts: string[];
  chart_modus: 'bestellungen' | 'umsatz';
}

const AMP_BAR = { gruen: '#22c55e', gelb: '#eab308', rot: '#ef4444' };

const MOCK: ApiResponse = {
  gesamt_score: 83,
  score_ampel: 'gruen',
  alerts: [],
  chart_modus: 'bestellungen',
  kpis: [
    { label: 'Umsatz heute', value: '1.240 €', ziel: '1.200 €', delta: '+40 €', delta_positiv: true, ampel: 'gruen' },
    { label: 'Bestellungen', value: '47', ziel: '45', delta: '+2', delta_positiv: true, ampel: 'gruen' },
    { label: 'Ø Lieferzeit', value: '28 Min', ziel: '30 Min', delta: '-2 Min', delta_positiv: true, ampel: 'gruen' },
    { label: 'Pünktlichkeit', value: '84%', ziel: '85%', delta: '-1%', delta_positiv: false, ampel: 'gelb' },
    { label: 'Storno-Quote', value: '2.1%', ziel: '<5%', delta: '-0.3%', delta_positiv: true, ampel: 'gruen' },
    { label: 'Ø Trinkgeld', value: '1.80 €', ziel: '1.50 €', delta: '+0.30 €', delta_positiv: true, ampel: 'gruen' },
  ],
  stunden: [
    { stunde: '11', bestellungen: 8, umsatz: 210, ist_jetzt: false },
    { stunde: '12', bestellungen: 14, umsatz: 380, ist_jetzt: false },
    { stunde: '13', bestellungen: 11, umsatz: 290, ist_jetzt: false },
    { stunde: '14', bestellungen: 6, umsatz: 160, ist_jetzt: true },
    { stunde: '15', bestellungen: 0, umsatz: 0, ist_jetzt: false },
    { stunde: '16', bestellungen: 0, umsatz: 0, ist_jetzt: false },
  ],
  top_fahrer: [
    { rang: 1, name: 'Schmidt', score: 94, touren: 8, trinkgeld: '16.50 €' },
    { rang: 2, name: 'Weber', score: 82, touren: 7, trinkgeld: '12.20 €' },
    { rang: 3, name: 'Müller', score: 71, touren: 6, trinkgeld: '8.80 €' },
  ],
  zonen: [
    { zone: 'Mitte', sla_pct: 91, umsatz: '520 €', avg_min: 24 },
    { zone: 'Nord', sla_pct: 78, umsatz: '380 €', avg_min: 31 },
    { zone: 'Süd', sla_pct: 85, umsatz: '340 €', avg_min: 27 },
  ],
};

function DeltaIcon({ positiv }: { positiv: boolean }) {
  return positiv
    ? <TrendingUp className="w-3 h-3 text-green-400 shrink-0" />
    : <TrendingDown className="w-3 h-3 text-red-400 shrink-0" />;
}

function ampelBadge(a: string) {
  return a === 'gruen' ? 'bg-green-900/40 text-green-300 border-green-800'
    : a === 'gelb' ? 'bg-yellow-900/40 text-yellow-300 border-yellow-800'
    : 'bg-red-900/40 text-red-300 border-red-800';
}

export function LieferdienstPhase4725StatistikenDashboardV9({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [chartModus, setChartModus] = useState<'bestellungen' | 'umsatz'>('bestellungen');

  async function load() {
    try {
      const params = new URLSearchParams();
      if (locationId) params.set('location_id', locationId);
      const res = await fetch(`/api/delivery/lieferdienst/statistiken-dashboard?${params}`);
      if (res.ok) {
        setData(await res.json());
      } else {
        setData(MOCK);
      }
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

  const scoreColor = data.score_ampel === 'gruen' ? 'text-green-400' : data.score_ampel === 'gelb' ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="rounded-xl border border-emerald-800 bg-emerald-950/20 p-4 mb-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <BarChart2 className="w-4 h-4 text-emerald-400" />
        <span className="text-sm font-semibold text-emerald-300">Statistiken Dashboard V9</span>
        <div className={`ml-auto text-lg font-bold ${scoreColor}`}>{data.gesamt_score}</div>
        <span className="text-xs text-gray-500">Score</span>
      </div>

      {/* Alerts */}
      {data.alerts.map((a, i) => (
        <div key={i} className="flex items-center gap-2 bg-red-900/30 border border-red-700 rounded px-3 py-1.5 mb-3 text-xs text-red-300">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {a}
        </div>
      ))}

      {/* KPI-Grid */}
      <div className="grid grid-cols-3 gap-1.5 mb-3">
        {data.kpis.map((k, i) => (
          <div key={i} className={`rounded-lg border p-2 ${ampelBadge(k.ampel)}`}>
            <div className="text-[10px] text-gray-400 truncate">{k.label}</div>
            <div className="text-sm font-bold mt-0.5">{k.value}</div>
            <div className="flex items-center gap-1 mt-0.5">
              <DeltaIcon positiv={k.delta_positiv} />
              <span className={`text-[10px] ${k.delta_positiv ? 'text-green-400' : 'text-red-400'}`}>{k.delta}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Chart Modus Toggle */}
      <div className="flex gap-1 mb-2">
        {(['bestellungen', 'umsatz'] as const).map(m => (
          <button
            key={m}
            onClick={() => setChartModus(m)}
            className={`flex-1 rounded py-1 text-xs font-medium ${chartModus === m ? 'bg-emerald-700 text-white' : 'bg-black/20 text-gray-400 hover:text-gray-300'}`}
          >
            {m === 'bestellungen' ? 'Bestellungen' : 'Umsatz (€)'}
          </button>
        ))}
      </div>

      {/* Stunden-Chart */}
      <div className="h-28 mb-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.stunden} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
            <XAxis dataKey="stunde" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: 11 }}
              labelStyle={{ color: '#9ca3af' }}
              itemStyle={{ color: '#d1fae5' }}
            />
            <Bar dataKey={chartModus} radius={[3, 3, 0, 0]}>
              {data.stunden.map((s, i) => (
                <Cell key={i} fill={s.ist_jetzt ? '#34d399' : '#065f46'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top-Fahrer */}
      <div className="mb-3">
        <div className="text-xs text-gray-400 mb-2 flex items-center gap-1">
          <Star className="w-3 h-3 text-yellow-400" />
          Top-Fahrer heute
        </div>
        <div className="space-y-1.5">
          {data.top_fahrer.map(f => (
            <div key={f.rang} className="flex items-center gap-2">
              <span className={`text-xs font-bold w-4 ${f.rang === 1 ? 'text-yellow-400' : f.rang === 2 ? 'text-gray-300' : 'text-orange-700'}`}>
                #{f.rang}
              </span>
              <span className="text-xs text-gray-200 flex-1">{f.name}</span>
              <span className="text-xs text-gray-400">{f.touren} T</span>
              <span className="text-xs text-emerald-400">{f.trinkgeld}</span>
              <div className="w-8 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${f.score}%` }} />
              </div>
              <span className="text-xs text-gray-300 w-8 text-right">{f.score}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Zonen-KPIs */}
      <div>
        <div className="text-xs text-gray-400 mb-2 flex items-center gap-1">
          <Target className="w-3 h-3 text-emerald-400" />
          Zonen-Performance
        </div>
        <div className="space-y-1.5">
          {data.zonen.map((z, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-gray-300 w-12 truncate">{z.zone}</span>
              <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${z.sla_pct}%`, background: z.sla_pct >= 85 ? '#22c55e' : z.sla_pct >= 70 ? '#eab308' : '#ef4444' }}
                />
              </div>
              <span className={`text-xs w-8 text-right ${z.sla_pct >= 85 ? 'text-green-400' : z.sla_pct >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                {z.sla_pct}%
              </span>
              <span className="text-xs text-gray-400 w-10 text-right">{z.avg_min} Min</span>
              <span className="text-xs text-emerald-400 w-14 text-right">{z.umsatz}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2 text-[10px] text-gray-600 text-center">1-Min-Polling · Mock-Fallback</div>
    </div>
  );
}
