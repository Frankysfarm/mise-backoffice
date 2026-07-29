'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { BarChart2, TrendingUp, TrendingDown, Minus, AlertTriangle, Trophy, Star } from 'lucide-react';

interface KpiCard {
  label: string;
  value: string;
  ziel: string;
  delta_pct: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  icon: string;
}

interface StundenData {
  stunde: string;
  bestellungen: number;
  umsatz: number;
  ist_jetzt: boolean;
}

interface TopFahrer {
  name: string;
  score: number;
  touren: number;
  trinkgeld: string;
}

interface ZoneRow {
  zone: string;
  sla_pct: number;
  ertrag: string;
}

interface ApiResponse {
  kpis: KpiCard[];
  stunden: StundenData[];
  top_fahrer: TopFahrer[];
  zonen: ZoneRow[];
  gesamt_score: number;
  score_delta: number;
  alert_strip: string[];
  chart_mode: 'bestellungen' | 'umsatz';
}

const MOCK: ApiResponse = {
  gesamt_score: 81,
  score_delta: 3,
  alert_strip: [],
  chart_mode: 'bestellungen',
  kpis: [
    { label: 'Bestellungen', value: '142', ziel: '160', delta_pct: 5.2, ampel: 'gruen', icon: '📦' },
    { label: 'Umsatz', value: '2.840 €', ziel: '3.000 €', delta_pct: 8.1, ampel: 'gruen', icon: '💶' },
    { label: 'Lieferzeit Ø', value: '31 min', ziel: '≤35 min', delta_pct: -4.3, ampel: 'gruen', icon: '⏱' },
    { label: 'Pünktlichkeit', value: '87%', ziel: '≥85%', delta_pct: 1.8, ampel: 'gruen', icon: '✅' },
    { label: 'Bewertung Ø', value: '4.7 ★', ziel: '≥4.5', delta_pct: 0.5, ampel: 'gruen', icon: '⭐' },
    { label: 'Storno-Quote', value: '4.2%', ziel: '≤6%', delta_pct: -0.8, ampel: 'gruen', icon: '🚫' },
    { label: 'Akt. Fahrer', value: '5', ziel: '≥4', delta_pct: 0, ampel: 'gruen', icon: '🚲' },
    { label: 'Trinkgeld Ø', value: '2.80 €', ziel: '≥2.50 €', delta_pct: 3.2, ampel: 'gruen', icon: '💰' },
    { label: 'SLA ≥ 95%', value: '3 / 4 Zonen', ziel: '4 / 4', delta_pct: -5.0, ampel: 'gelb', icon: '📍' },
    { label: 'Km-Effizienz', value: '8.20 €/km', ziel: '≥7 €/km', delta_pct: 2.1, ampel: 'gruen', icon: '🛣' },
    { label: 'Profit-Marge', value: '22%', ziel: '≥20%', delta_pct: 1.5, ampel: 'gruen', icon: '📈' },
    { label: 'Touren', value: '38', ziel: '≥35', delta_pct: 8.6, ampel: 'gruen', icon: '🗺' },
  ],
  stunden: [
    { stunde: '10', bestellungen: 8, umsatz: 160, ist_jetzt: false },
    { stunde: '11', bestellungen: 14, umsatz: 280, ist_jetzt: false },
    { stunde: '12', bestellungen: 22, umsatz: 440, ist_jetzt: false },
    { stunde: '13', bestellungen: 28, umsatz: 560, ist_jetzt: false },
    { stunde: '14', bestellungen: 18, umsatz: 360, ist_jetzt: false },
    { stunde: '15', bestellungen: 12, umsatz: 240, ist_jetzt: false },
    { stunde: '16', bestellungen: 9, umsatz: 180, ist_jetzt: false },
    { stunde: '17', bestellungen: 16, umsatz: 320, ist_jetzt: false },
    { stunde: '18', bestellungen: 24, umsatz: 480, ist_jetzt: false },
    { stunde: '19', bestellungen: 31, umsatz: 620, ist_jetzt: true },
    { stunde: '20', bestellungen: 0, umsatz: 0, ist_jetzt: false },
    { stunde: '21', bestellungen: 0, umsatz: 0, ist_jetzt: false },
  ],
  top_fahrer: [
    { name: 'Kai B.', score: 91, touren: 12, trinkgeld: '38 €' },
    { name: 'Mia S.', score: 85, touren: 10, trinkgeld: '31 €' },
    { name: 'Jonas R.', score: 73, touren: 9, trinkgeld: '22 €' },
  ],
  zonen: [
    { zone: 'Mitte', sla_pct: 97, ertrag: '980 €' },
    { zone: 'Nord', sla_pct: 91, ertrag: '720 €' },
    { zone: 'Ost', sla_pct: 88, ertrag: '640 €' },
    { zone: 'West', sla_pct: 95, ertrag: '500 €' },
  ],
};

const AMPEL_BG = { gruen: 'bg-emerald-900/40', gelb: 'bg-amber-900/40', rot: 'bg-red-900/40' };
const AMPEL_TEXT = { gruen: 'text-emerald-400', gelb: 'text-amber-400', rot: 'text-red-400' };
const AMPEL_BORDER = { gruen: 'border-emerald-700', gelb: 'border-amber-700', rot: 'border-red-700' };

function DeltaIcon({ v }: { v: number }) {
  if (v > 0) return <TrendingUp className="w-3 h-3 text-emerald-400" />;
  if (v < 0) return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-500" />;
}

export function LieferdienstPhase4720StatistikenDashboardV8({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [chartMode, setChartMode] = useState<'bestellungen' | 'umsatz'>('bestellungen');

  async function load() {
    if (!locationId) { setData(MOCK); return; }
    try {
      const r = await fetch(`/api/delivery/admin/statistiken-dashboard-v8?location_id=${locationId}`);
      if (r.ok) setData(await r.json());
      else setData(MOCK);
    } catch { setData(MOCK); }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return <div className="rounded-2xl bg-gray-900 p-4 text-gray-400 text-sm animate-pulse">Lade Statistiken V8…</div>;

  const scoreColor = data.gesamt_score >= 80 ? 'text-emerald-400' : data.gesamt_score >= 65 ? 'text-amber-400' : 'text-red-400';
  const scoreDeltaColor = data.score_delta >= 0 ? 'text-emerald-400' : 'text-red-400';

  return (
    <div className="rounded-2xl bg-gray-900 text-white p-4 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-indigo-400" />
          <span className="font-semibold text-gray-100">Statistiken Dashboard</span>
          <span className="text-[10px] text-gray-500">V8</span>
        </div>
        <div className="text-right">
          <p className={`text-2xl font-black ${scoreColor}`}>{data.gesamt_score}</p>
          <p className={`text-[10px] ${scoreDeltaColor}`}>{data.score_delta >= 0 ? '+' : ''}{data.score_delta} vs. gestern</p>
        </div>
      </div>

      {/* Alert Strip */}
      {data.alert_strip.map((a, i) => (
        <div key={i} className="flex items-center gap-2 rounded-lg bg-red-900/50 border border-red-700 px-3 py-2 text-red-300 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {a}
        </div>
      ))}

      {/* Score Progress Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-gray-400">
          <span>Gesamt-Score</span>
          <span className={scoreColor}>{data.gesamt_score}/100</span>
        </div>
        <div className="h-2 rounded-full bg-gray-700">
          <div
            className={`h-full rounded-full transition-all duration-700 ${data.gesamt_score >= 80 ? 'bg-emerald-500' : data.gesamt_score >= 65 ? 'bg-amber-400' : 'bg-red-500'}`}
            style={{ width: `${data.gesamt_score}%` }}
          />
        </div>
      </div>

      {/* 12-KPI Grid */}
      <div className="grid grid-cols-3 gap-2">
        {data.kpis.map(k => (
          <div key={k.label} className={`rounded-xl border p-2.5 ${AMPEL_BG[k.ampel]} ${AMPEL_BORDER[k.ampel]}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm">{k.icon}</span>
              <DeltaIcon v={k.delta_pct} />
            </div>
            <p className={`text-base font-black ${AMPEL_TEXT[k.ampel]}`}>{k.value}</p>
            <p className="text-[9px] text-gray-500 leading-tight">{k.label}</p>
            <p className="text-[9px] text-gray-600">Ziel: {k.ziel}</p>
          </div>
        ))}
      </div>

      {/* Stunden Chart */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400 font-semibold">Stundenverlauf</p>
          <div className="flex gap-1">
            {(['bestellungen', 'umsatz'] as const).map(m => (
              <button
                key={m}
                onClick={() => setChartMode(m)}
                className={`text-[10px] px-2 py-0.5 rounded-full font-semibold transition-colors ${chartMode === m ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-400'}`}
              >
                {m === 'bestellungen' ? 'Bestellungen' : 'Umsatz'}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={80}>
          <BarChart data={data.stunden} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <XAxis dataKey="stunde" tick={{ fontSize: 9, fill: '#6B7280' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#111827', border: 'none', borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: '#9CA3AF' }}
              itemStyle={{ color: '#E5E7EB' }}
            />
            <Bar dataKey={chartMode} radius={[3, 3, 0, 0]}>
              {data.stunden.map((s, i) => (
                <Cell key={i} fill={s.ist_jetzt ? '#6366F1' : chartMode === 'umsatz' ? '#10B981' : '#3B82F6'} opacity={s.ist_jetzt ? 1 : 0.7} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top Fahrer */}
      <div className="space-y-2">
        <p className="text-xs text-gray-400 font-semibold flex items-center gap-1.5">
          <Trophy className="w-3.5 h-3.5 text-amber-400" />
          Top-Fahrer
        </p>
        {data.top_fahrer.map((f, i) => (
          <div key={f.name} className="flex items-center gap-3 rounded-xl bg-gray-800 px-3 py-2">
            <span className="text-[11px] font-black text-gray-500 w-4">{i + 1}</span>
            <span className="flex-1 text-xs font-semibold text-gray-200">{f.name}</span>
            <span className="text-[10px] text-gray-400">{f.touren} Touren</span>
            <span className="text-[10px] text-emerald-400">{f.trinkgeld}</span>
            <span className={`text-xs font-bold ${f.score >= 80 ? 'text-emerald-400' : f.score >= 65 ? 'text-amber-400' : 'text-red-400'}`}>{f.score}</span>
          </div>
        ))}
      </div>

      {/* Zonen SLA */}
      <div className="space-y-2">
        <p className="text-xs text-gray-400 font-semibold">Zonen-SLA</p>
        {data.zonen.map(z => (
          <div key={z.zone} className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-gray-300 font-semibold">{z.zone}</span>
              <div className="flex gap-3">
                <span className="text-gray-500">{z.ertrag}</span>
                <span className={z.sla_pct >= 95 ? 'text-emerald-400' : z.sla_pct >= 85 ? 'text-amber-400' : 'text-red-400'}>{z.sla_pct}%</span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-gray-700">
              <div
                className={`h-full rounded-full transition-all duration-500 ${z.sla_pct >= 95 ? 'bg-emerald-500' : z.sla_pct >= 85 ? 'bg-amber-400' : 'bg-red-500'}`}
                style={{ width: `${z.sla_pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
