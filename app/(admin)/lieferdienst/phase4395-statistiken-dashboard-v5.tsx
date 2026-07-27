'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Clock, Euro, Target, AlertTriangle, CheckCircle2, Zap, Users, Star } from 'lucide-react';

interface ZoneKpi {
  zone: string;
  sla_pct: number;
  avg_lieferzeit_min: number;
  bestellungen: number;
}

interface StundenDaten {
  stunde: string;
  bestellungen: number;
  umsatz_eur: number;
}

interface KpiTile {
  label: string;
  wert: string | number;
  delta_pct: number | null;
  ziel: string | number | null;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface DashboardData {
  schicht_score: number;
  alert_count: number;
  kpis: KpiTile[];
  stunden: StundenDaten[];
  zonen: ZoneKpi[];
  top_fahrer: { name: string; score: number; touren: number }[];
  schicht_umsatz_eur: number;
  schicht_profit_eur: number;
}

const MOCK: DashboardData = {
  schicht_score: 84,
  alert_count: 2,
  schicht_umsatz_eur: 1240,
  schicht_profit_eur: 186,
  kpis: [
    { label: 'Umsatz',       wert: '1.240 €', delta_pct: 8,    ziel: '1.500 €', ampel: 'gelb'  },
    { label: 'Bestellungen', wert: 58,         delta_pct: 12,   ziel: 70,        ampel: 'gelb'  },
    { label: 'Pünktlichkeit',wert: '89%',      delta_pct: 3,    ziel: '90%',     ampel: 'gelb'  },
    { label: 'Ø Lieferzeit', wert: '22m',      delta_pct: -5,   ziel: '25m',     ampel: 'gruen' },
    { label: 'Stornos',      wert: 3,          delta_pct: -40,  ziel: 5,         ampel: 'gruen' },
    { label: 'Fahrer aktiv', wert: 4,          delta_pct: null, ziel: null,      ampel: 'gruen' },
    { label: 'Ø Score',      wert: 81,         delta_pct: 2,    ziel: 85,        ampel: 'gelb'  },
    { label: 'SLA Zone A',   wert: '92%',      delta_pct: 1,    ziel: '90%',     ampel: 'gruen' },
    { label: 'Trinkgeld Ø', wert: '1,80 €',   delta_pct: 15,   ziel: null,      ampel: 'gruen' },
    { label: 'Überfällig',   wert: 1,          delta_pct: null, ziel: 0,         ampel: 'rot'   },
    { label: 'Profit',       wert: '186 €',    delta_pct: 6,    ziel: '200 €',   ampel: 'gelb'  },
    { label: 'Bewertung Ø', wert: '4,6 ★',    delta_pct: 2,    ziel: '4,5',     ampel: 'gruen' },
  ],
  stunden: [
    { stunde: '11', bestellungen: 4,  umsatz_eur: 85  },
    { stunde: '12', bestellungen: 12, umsatz_eur: 260 },
    { stunde: '13', bestellungen: 10, umsatz_eur: 215 },
    { stunde: '14', bestellungen: 6,  umsatz_eur: 130 },
    { stunde: '17', bestellungen: 5,  umsatz_eur: 110 },
    { stunde: '18', bestellungen: 11, umsatz_eur: 240 },
    { stunde: '19', bestellungen: 7,  umsatz_eur: 155 },
    { stunde: '20', bestellungen: 3,  umsatz_eur: 65  },
  ],
  zonen: [
    { zone: 'Nord',  sla_pct: 92, avg_lieferzeit_min: 19, bestellungen: 22 },
    { zone: 'Mitte', sla_pct: 88, avg_lieferzeit_min: 23, bestellungen: 18 },
    { zone: 'Süd',   sla_pct: 82, avg_lieferzeit_min: 27, bestellungen: 12 },
    { zone: 'West',  sla_pct: 95, avg_lieferzeit_min: 17, bestellungen: 6  },
  ],
  top_fahrer: [
    { name: 'Max M.',  score: 91, touren: 8 },
    { name: 'Sara L.', score: 87, touren: 7 },
    { name: 'Tom K.',  score: 81, touren: 6 },
  ],
};

type ChartMode = 'bestellungen' | 'umsatz';

function ampelBg(a: string) {
  return a === 'gruen' ? 'bg-green-50' : a === 'gelb' ? 'bg-yellow-50' : 'bg-red-50';
}
function ampelText(a: string) {
  return a === 'gruen' ? 'text-green-700' : a === 'gelb' ? 'text-yellow-700' : 'text-red-600';
}
function ampelDot(a: string) {
  return a === 'gruen' ? 'bg-green-400' : a === 'gelb' ? 'bg-yellow-400' : 'bg-red-500';
}

interface Props { locationId: string | null }

export function LieferdienstPhase4395StatistikDashboardV5({ locationId }: Props) {
  const [data, setData] = useState<DashboardData>(MOCK);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<ChartMode>('bestellungen');

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/statistiken-dashboard?location_id=${locationId}`);
      if (r.ok) { const j = await r.json(); if (!j.error) setData(j); }
    } catch { /* Mock-Fallback */ }
    finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const iv = setInterval(load, 60_000); return () => clearInterval(iv); }, [load]);

  const scoreColor = data.schicht_score >= 85 ? 'text-green-600' : data.schicht_score >= 70 ? 'text-yellow-600' : 'text-red-500';
  const chartData = data.stunden.map((s) => ({ name: s.stunde, wert: mode === 'bestellungen' ? s.bestellungen : s.umsatz_eur }));
  const maxVal = Math.max(...chartData.map((d) => d.wert), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 space-y-3">

      {/* Alerts */}
      {data.alert_count > 0 && (
        <div className="flex items-center gap-1.5 px-2 py-1.5 bg-red-50 border border-red-200 rounded-lg">
          <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
          <span className="text-[10px] font-bold text-red-700">{data.alert_count} aktive Alerts — bitte prüfen</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5 text-violet-500" />
          <span className="text-xs font-semibold text-gray-900">Statistiken V5</span>
          {loading && <span className="w-2 h-2 border-2 border-violet-300 border-t-transparent rounded-full animate-spin" />}
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className="text-[8px] text-gray-400 font-bold uppercase">Score</p>
            <p className={`text-sm font-bold ${scoreColor}`}>{data.schicht_score}</p>
          </div>
        </div>
      </div>

      {/* Profit + Umsatz Summary */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-violet-50 rounded-xl p-2.5 text-center">
          <p className="text-[9px] text-violet-400 font-bold uppercase tracking-wide">Schicht-Umsatz</p>
          <p className="text-lg font-bold text-violet-700">{data.schicht_umsatz_eur.toLocaleString('de-DE')} €</p>
        </div>
        <div className="bg-green-50 rounded-xl p-2.5 text-center">
          <p className="text-[9px] text-green-500 font-bold uppercase tracking-wide">Profit</p>
          <p className="text-lg font-bold text-green-700">{data.schicht_profit_eur.toLocaleString('de-DE')} €</p>
        </div>
      </div>

      {/* 12 KPI Tiles */}
      <div className="grid grid-cols-4 gap-1">
        {data.kpis.map((kpi) => (
          <div key={kpi.label} className={`${ampelBg(kpi.ampel)} rounded-lg p-1.5 relative overflow-hidden`}>
            <span className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${ampelDot(kpi.ampel)}`} />
            <p className="text-[7px] text-gray-400 font-bold uppercase leading-tight truncate pr-2">{kpi.label}</p>
            <p className={`text-[11px] font-bold ${ampelText(kpi.ampel)} mt-0.5`}>{kpi.wert}</p>
            {kpi.delta_pct != null && (
              <p className={`text-[8px] flex items-center gap-0.5 ${kpi.delta_pct >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {kpi.delta_pct >= 0
                  ? <TrendingUp className="w-2 h-2" />
                  : <TrendingDown className="w-2 h-2" />
                }
                {kpi.delta_pct > 0 ? '+' : ''}{kpi.delta_pct}%
              </p>
            )}
            {kpi.ziel != null && (
              <p className="text-[7px] text-gray-400 truncate">Ziel: {kpi.ziel}</p>
            )}
          </div>
        ))}
      </div>

      {/* Chart */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold text-gray-600">Stundenverlauf</span>
          <div className="flex rounded-lg overflow-hidden border border-gray-200">
            <button
              onClick={() => setMode('bestellungen')}
              className={`text-[9px] px-2 py-0.5 font-medium transition-colors ${mode === 'bestellungen' ? 'bg-violet-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              Bestellungen
            </button>
            <button
              onClick={() => setMode('umsatz')}
              className={`text-[9px] px-2 py-0.5 font-medium transition-colors ${mode === 'umsatz' ? 'bg-violet-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              Umsatz €
            </button>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={60}>
          <BarChart data={chartData} barCategoryGap="20%">
            <XAxis dataKey="name" tick={{ fontSize: 8, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ fontSize: 10, padding: '4px 8px', border: '1px solid #e5e7eb', borderRadius: 8 }}
              formatter={(v: number) => [mode === 'umsatz' ? `${v} €` : v, mode === 'umsatz' ? 'Umsatz' : 'Bestellungen']}
            />
            <Bar dataKey="wert" radius={[3, 3, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.wert >= maxVal * 0.8 ? '#7c3aed' : entry.wert >= maxVal * 0.5 ? '#a78bfa' : '#ddd6fe'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Zonen-Ranking */}
      <div>
        <p className="text-[10px] font-semibold text-gray-600 mb-1">Zonen-Ranking</p>
        <div className="space-y-1">
          {data.zonen.map((z) => {
            const slaColor = z.sla_pct >= 90 ? 'text-green-600' : z.sla_pct >= 80 ? 'text-yellow-600' : 'text-red-500';
            const slaBg = z.sla_pct >= 90 ? 'bg-green-500' : z.sla_pct >= 80 ? 'bg-yellow-500' : 'bg-red-500';
            return (
              <div key={z.zone} className="flex items-center gap-2">
                <span className="text-[10px] text-gray-600 font-medium w-10">{z.zone}</span>
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${slaBg}`} style={{ width: `${z.sla_pct}%` }} />
                </div>
                <span className={`text-[10px] font-bold w-8 text-right ${slaColor}`}>{z.sla_pct}%</span>
                <span className="text-[9px] text-gray-400 w-12">{z.avg_lieferzeit_min}m Ø</span>
                <span className="text-[9px] text-gray-400">{z.bestellungen} Bestellungen</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Fahrer */}
      <div>
        <p className="text-[10px] font-semibold text-gray-600 mb-1 flex items-center gap-1">
          <Star className="w-3 h-3 text-amber-500" />Top-Fahrer
        </p>
        <div className="flex gap-2">
          {data.top_fahrer.map((f, i) => (
            <div key={f.name} className={`flex-1 rounded-lg p-1.5 text-center ${i === 0 ? 'bg-amber-50' : 'bg-gray-50'}`}>
              <p className="text-[9px] text-gray-400 font-medium">{i + 1}.</p>
              <p className="text-[10px] font-bold text-gray-700 truncate">{f.name}</p>
              <p className={`text-xs font-bold ${f.score >= 85 ? 'text-green-600' : 'text-yellow-600'}`}>{f.score}</p>
              <p className="text-[8px] text-gray-400">{f.touren} Touren</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between text-[8px] text-gray-400 pt-1 border-t border-gray-100">
        <span>Schicht-Statistiken Live</span>
        <span className="flex items-center gap-0.5"><Clock className="w-2 h-2" />60s</span>
      </div>
    </div>
  );
}
