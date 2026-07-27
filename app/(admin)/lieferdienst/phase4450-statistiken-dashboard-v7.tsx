'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, YAxis } from 'recharts';
import { TrendingUp, TrendingDown, Euro, Package, Clock, Star, Users, Zap, Target, AlertTriangle } from 'lucide-react';

interface StundenUmsatz { stunde: string; umsatz: number; bestellungen: number; }
interface ZonenKpi { zone: string; umsatz: number; pct_change: number; lieferzeit_min: number; }
interface FahrerKpi { name: string; touren: number; score: number; trinkgeld: number; }

interface DashboardData {
  heute_umsatz: number;
  gestern_umsatz: number;
  umsatz_delta_pct: number;
  heute_bestellungen: number;
  gestern_bestellungen: number;
  avg_lieferzeit_min: number;
  avg_bewertung: number;
  on_time_pct: number;
  storno_pct: number;
  aktive_fahrer: number;
  ziel_umsatz: number;
  ziel_fortschritt_pct: number;
  stunden_umsatz: StundenUmsatz[];
  zonen: ZonenKpi[];
  top_fahrer: FahrerKpi[];
  alerts: { typ: 'warn' | 'ok'; text: string }[];
}

const MOCK: DashboardData = {
  heute_umsatz: 1847.50,
  gestern_umsatz: 1623.00,
  umsatz_delta_pct: 13.8,
  heute_bestellungen: 94,
  gestern_bestellungen: 82,
  avg_lieferzeit_min: 22,
  avg_bewertung: 4.7,
  on_time_pct: 88,
  storno_pct: 2.1,
  aktive_fahrer: 5,
  ziel_umsatz: 2200,
  ziel_fortschritt_pct: 84,
  stunden_umsatz: [
    { stunde: '11', umsatz: 85,  bestellungen: 4  },
    { stunde: '12', umsatz: 220, bestellungen: 11 },
    { stunde: '13', umsatz: 310, bestellungen: 16 },
    { stunde: '14', umsatz: 180, bestellungen: 9  },
    { stunde: '15', umsatz: 95,  bestellungen: 5  },
    { stunde: '16', umsatz: 130, bestellungen: 7  },
    { stunde: '17', umsatz: 195, bestellungen: 10 },
    { stunde: '18', umsatz: 285, bestellungen: 14 },
    { stunde: '19', umsatz: 347, bestellungen: 18 },
  ],
  zonen: [
    { zone: 'Innenstadt',   umsatz: 820,  pct_change: +18, lieferzeit_min: 19 },
    { zone: 'Burtscheid',   umsatz: 510,  pct_change: +7,  lieferzeit_min: 24 },
    { zone: 'Laurensberg',  umsatz: 320,  pct_change: -3,  lieferzeit_min: 28 },
    { zone: 'Haaren',       umsatz: 197,  pct_change: +22, lieferzeit_min: 31 },
  ],
  top_fahrer: [
    { name: 'Marco R.',  touren: 7, score: 94, trinkgeld: 12.50 },
    { name: 'Luisa K.',  touren: 5, score: 88, trinkgeld: 8.20  },
    { name: 'Jan T.',    touren: 4, score: 74, trinkgeld: 5.40  },
  ],
  alerts: [
    { typ: 'warn', text: 'Lieferzeit Haaren >30 min — Fahrer prüfen' },
    { typ: 'ok',   text: 'Umsatz liegt +13.8% über Vortag' },
  ],
};

function euro(v: number) { return `${v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`; }

interface KpiCardProps { label: string; value: string; delta?: number; icon: React.ReactNode; color: string; }
function KpiCard({ label, value, delta, icon, color }: KpiCardProps) {
  return (
    <div className={`rounded-xl border p-2.5 space-y-1 ${color}`}>
      <div className="flex items-center justify-between">
        <span className="text-gray-500">{icon}</span>
        {delta !== undefined && (
          <span className={`text-[9px] font-bold flex items-center gap-0.5 ${delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {delta >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-base font-black text-gray-900 leading-none">{value}</p>
      <p className="text-[9px] text-gray-500 font-medium uppercase tracking-wider">{label}</p>
    </div>
  );
}

interface Props { locationId?: string | null; }

export function LieferdienstPhase4450StatistikenDashboardV7({ locationId }: Props) {
  const [data, setData] = useState<DashboardData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/tages-statistiken?location_id=${locationId}`);
      if (res.ok) { const j = await res.json(); if (!j.error) setData(j); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 60_000); return () => clearInterval(id); }, [load]);

  const maxUmsatz = Math.max(...data.stunden_umsatz.map((s) => s.umsatz), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Statistiken-Dashboard V7</h3>
          <p className="text-[9px] text-gray-400">Heute · Live</p>
        </div>
        <div className="flex items-center gap-2">
          {loading && <span className="w-2.5 h-2.5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
          <span className="text-[10px] bg-green-50 text-green-700 border border-green-200 rounded px-1.5 py-0.5 font-medium">
            {data.aktive_fahrer} Fahrer aktiv
          </span>
        </div>
      </div>

      {/* Alerts */}
      {data.alerts.length > 0 && (
        <div className="space-y-1">
          {data.alerts.map((a, i) => (
            <div key={i} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-medium
              ${a.typ === 'warn' ? 'bg-amber-50 border border-amber-200 text-amber-700' : 'bg-green-50 border border-green-200 text-green-700'}`}>
              {a.typ === 'warn' ? <AlertTriangle className="w-3 h-3 flex-shrink-0" /> : <Zap className="w-3 h-3 flex-shrink-0" />}
              {a.text}
            </div>
          ))}
        </div>
      )}

      {/* KPI-Grid */}
      <div className="grid grid-cols-2 gap-1.5">
        <KpiCard label="Umsatz Heute" value={euro(data.heute_umsatz)} delta={data.umsatz_delta_pct} icon={<Euro className="w-3.5 h-3.5" />} color="bg-green-50 border-green-200" />
        <KpiCard label="Bestellungen" value={String(data.heute_bestellungen)} delta={((data.heute_bestellungen - data.gestern_bestellungen) / data.gestern_bestellungen) * 100} icon={<Package className="w-3.5 h-3.5" />} color="bg-blue-50 border-blue-200" />
        <KpiCard label="Ø Lieferzeit" value={`${data.avg_lieferzeit_min} min`} icon={<Clock className="w-3.5 h-3.5" />} color="bg-indigo-50 border-indigo-200" />
        <KpiCard label="Bewertung" value={`${data.avg_bewertung.toFixed(1)} ★`} icon={<Star className="w-3.5 h-3.5" />} color="bg-amber-50 border-amber-200" />
      </div>

      {/* Tagesziel */}
      <div>
        <div className="flex justify-between text-[9px] mb-1">
          <span className="text-gray-500 flex items-center gap-1"><Target className="w-3 h-3" />Tagesziel</span>
          <span className="font-bold text-gray-700">{euro(data.heute_umsatz)} / {euro(data.ziel_umsatz)} ({data.ziel_fortschritt_pct}%)</span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${data.ziel_fortschritt_pct >= 100 ? 'bg-green-500' : data.ziel_fortschritt_pct >= 75 ? 'bg-indigo-500' : 'bg-amber-400'}`}
            style={{ width: `${Math.min(100, data.ziel_fortschritt_pct)}%` }}
          />
        </div>
      </div>

      {/* Stunden-Umsatz-Chart */}
      <div>
        <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Umsatz nach Stunde</p>
        <div className="h-24">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.stunden_umsatz} barSize={14} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
              <XAxis dataKey="stunde" tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <YAxis hide />
              <Tooltip
                contentStyle={{ fontSize: 10, borderRadius: 8, border: '1px solid #e5e7eb', padding: '4px 8px' }}
                formatter={(v: number) => [`${euro(v)}`, 'Umsatz']}
              />
              <Bar dataKey="umsatz" radius={[3, 3, 0, 0]}>
                {data.stunden_umsatz.map((s, i) => (
                  <Cell key={i} fill={s.umsatz === maxUmsatz ? '#4f46e5' : '#a5b4fc'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Zonen-Performance */}
      <div>
        <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Zonen</p>
        <div className="space-y-1">
          {data.zonen.map((z) => (
            <div key={z.zone} className="flex items-center gap-2">
              <p className="text-[10px] font-medium text-gray-700 w-24 truncate">{z.zone}</p>
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${(z.umsatz / Math.max(...data.zonen.map((x) => x.umsatz))) * 100}%` }} />
              </div>
              <p className="text-[9px] text-gray-600 font-medium w-16 text-right">{euro(z.umsatz)}</p>
              <p className={`text-[9px] font-bold w-10 text-right ${z.pct_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {z.pct_change > 0 ? '+' : ''}{z.pct_change}%
              </p>
              <p className="text-[9px] text-gray-400 w-12 text-right">{z.lieferzeit_min}min</p>
            </div>
          ))}
        </div>
      </div>

      {/* Top-Fahrer */}
      <div>
        <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
          <Users className="w-3 h-3 inline mr-1" />Top Fahrer
        </p>
        <div className="space-y-1">
          {data.top_fahrer.map((f, i) => (
            <div key={f.name} className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 py-1.5">
              <span className={`text-[9px] font-black w-4 text-center ${i === 0 ? 'text-amber-500' : 'text-gray-400'}`}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
              </span>
              <p className="text-[10px] font-semibold text-gray-800 flex-1">{f.name}</p>
              <span className="text-[9px] text-gray-500">{f.touren} Touren</span>
              <span className={`text-[9px] font-bold px-1 rounded ${f.score >= 90 ? 'bg-green-100 text-green-700' : f.score >= 75 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                {f.score}
              </span>
              <span className="text-[9px] text-amber-600 font-medium">{euro(f.trinkgeld)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Qualitäts-KPIs */}
      <div className="grid grid-cols-2 gap-1.5">
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <p className="text-[9px] text-gray-500 uppercase">Pünktlichkeit</p>
          <p className={`text-lg font-black ${data.on_time_pct >= 90 ? 'text-green-600' : data.on_time_pct >= 75 ? 'text-yellow-600' : 'text-red-600'}`}>
            {data.on_time_pct}%
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <p className="text-[9px] text-gray-500 uppercase">Stornoquote</p>
          <p className={`text-lg font-black ${data.storno_pct <= 3 ? 'text-green-600' : data.storno_pct <= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
            {data.storno_pct}%
          </p>
        </div>
      </div>
    </div>
  );
}
