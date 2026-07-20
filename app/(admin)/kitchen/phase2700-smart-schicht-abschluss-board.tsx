'use client';
import { useEffect, useState } from 'react';
import { Award, TrendingUp, TrendingDown, Minus, Clock, Truck, CheckCircle, Star } from 'lucide-react';

interface SchichtKpi {
  label: string;
  wert: string;
  ziel: string;
  ampel: 'gruen' | 'gelb' | 'rot';
  trend: 'steigend' | 'fallend' | 'stabil';
}

interface TopFahrer {
  rang: number;
  name: string;
  score: number;
}

interface ApiData {
  schicht_datum: string;
  schicht_ende: string;
  gesamt_touren: number;
  on_time_rate: number;
  team_avg_abholzeit_min: number;
  team_avg_liefertreue_pct: number;
  kpis: SchichtKpi[];
  top_fahrer: TopFahrer[];
  schicht_note: 'A' | 'B' | 'C' | 'D';
}

function ampelBorder(a: string) {
  if (a === 'rot')  return 'border-red-200 bg-red-50';
  if (a === 'gelb') return 'border-amber-200 bg-amber-50';
  return 'border-green-200 bg-green-50';
}

function ampelText(a: string) {
  if (a === 'rot')  return 'text-red-700';
  if (a === 'gelb') return 'text-amber-700';
  return 'text-green-700';
}

function noteCls(n: string) {
  if (n === 'A') return 'bg-green-500 text-white';
  if (n === 'B') return 'bg-blue-500 text-white';
  if (n === 'C') return 'bg-amber-500 text-white';
  return 'bg-red-500 text-white';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={12} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={12} className="text-red-500"   />;
  return                           <Minus        size={12} className="text-gray-400"  />;
}

const MOCK: ApiData = {
  schicht_datum: 'Heute',
  schicht_ende: '22:00 Uhr',
  gesamt_touren: 84,
  on_time_rate: 92,
  team_avg_abholzeit_min: 4.2,
  team_avg_liefertreue_pct: 92,
  schicht_note: 'B',
  kpis: [
    { label: 'Pünktlichkeit',    wert: '92 %',  ziel: '≥95 %', ampel: 'gelb',  trend: 'steigend' },
    { label: 'Abholwartezeit',   wert: '4,2 Min', ziel: '≤4 Min', ampel: 'gelb', trend: 'fallend'  },
    { label: 'Liefertreue',      wert: '92 %',  ziel: '≥95 %', ampel: 'gelb',  trend: 'steigend' },
    { label: 'Touren gesamt',    wert: '84',    ziel: '≥80',   ampel: 'gruen', trend: 'steigend' },
  ],
  top_fahrer: [
    { rang: 1, name: 'Max M.',   score: 98 },
    { rang: 2, name: 'Julia F.', score: 95 },
    { rang: 3, name: 'Tim B.',   score: 90 },
  ],
};

export function KitchenPhase2700SmartSchichtAbschlussBoard({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    fetch(`/api/delivery/admin/schicht-abschluss?location_id=${locationId}`)
      .then(r => r.json())
      .then((d: ApiData) => setData(d))
      .catch(() => setData(MOCK));
  }, [locationId]);

  if (!data) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-md mb-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Award size={18} className="text-amber-500" />
          <span className="font-bold text-base text-gray-800">Schichtabschluss</span>
          <span className="text-xs text-gray-400">{data.schicht_datum} · {data.schicht_ende}</span>
        </div>
        <span className={`text-2xl font-black px-3 py-1 rounded-lg ${noteCls(data.schicht_note)}`}>
          {data.schicht_note}
        </span>
      </div>

      {/* KPI-Grid */}
      <div className="grid grid-cols-2 gap-2 p-4">
        {data.kpis.map(kpi => (
          <div key={kpi.label} className={`rounded-lg border px-3 py-2 ${ampelBorder(kpi.ampel)}`}>
            <div className="flex items-center justify-between mb-0.5">
              <p className="text-xs text-gray-500">{kpi.label}</p>
              <TrendIcon trend={kpi.trend} />
            </div>
            <p className={`text-lg font-black ${ampelText(kpi.ampel)}`}>{kpi.wert}</p>
            <p className="text-xs text-gray-400">Ziel {kpi.ziel}</p>
          </div>
        ))}
      </div>

      {/* Quick stats */}
      <div className="flex gap-3 px-4 pb-3">
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <Truck size={13} className="text-gray-400" />
          <span>{data.gesamt_touren} Touren</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <Clock size={13} className="text-gray-400" />
          <span>{data.team_avg_abholzeit_min.toFixed(1)} Min Abholzeit</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <CheckCircle size={13} className="text-gray-400" />
          <span>{data.on_time_rate} % on-time</span>
        </div>
      </div>

      {/* Top-Fahrer toggle */}
      <button
        onClick={() => setExpanded((e: boolean) => !e)}
        className="w-full flex items-center justify-between px-4 py-2 border-t border-gray-100 text-xs text-gray-500 hover:bg-gray-50"
      >
        <div className="flex items-center gap-1.5">
          <Star size={13} className="text-amber-400" />
          <span>Top-Fahrer</span>
        </div>
        <span>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          {data.top_fahrer.map(f => (
            <div key={f.rang} className="flex items-center gap-3">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                f.rang === 1 ? 'bg-amber-100 text-amber-700' : f.rang === 2 ? 'bg-gray-100 text-gray-600' : 'bg-orange-50 text-orange-600'
              }`}>
                {f.rang}
              </span>
              <span className="text-sm text-gray-700 flex-1">{f.name}</span>
              <span className="text-sm font-bold text-green-700">{f.score} Pkt</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
