'use client';

import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, YAxis } from 'recharts';
import { BarChart3, TrendingUp, TrendingDown, Target, Users, Clock, Star, Euro, AlertTriangle, CheckCircle2, Bike, Activity } from 'lucide-react';
import { cn, euro } from '@/lib/utils';

interface Stats {
  umsatz_heute: number;
  umsatz_delta_pct: number;
  bestellungen_heute: number;
  bestellungen_delta_pct: number;
  avg_lieferzeit_min: number;
  puenktlichkeit_pct: number;
  fahrer_aktiv: number;
  bewertung_avg: number;
  storno_pct: number;
  profit_margin_pct: number;
  monatsziel_pct: number;
  wochen_umsatz?: number | null;
  wochen_delta_pct?: number | null;
}

interface StundenPunkt { stunde: string; umsatz: number; bestellungen: number; }
interface FahrerRang { name: string; score: number; stopps: number; puenktl: number; umsatz: number; trend: 'up' | 'down' | 'flat'; }
interface ZoneKpi { zone: string; sla_pct: number; avg_min: number; umsatz: number; kapaz_pct: number; }
interface WochenPunkt { tag: string; umsatz: number; }

const MOCK_STATS: Stats = {
  umsatz_heute: 2014.5,  umsatz_delta_pct: 14.2,
  bestellungen_heute: 79, bestellungen_delta_pct: 9.3,
  avg_lieferzeit_min: 25.8, puenktlichkeit_pct: 92,
  fahrer_aktiv: 7, bewertung_avg: 4.7,
  storno_pct: 2.4, profit_margin_pct: 23.5,
  monatsziel_pct: 71,
  wochen_umsatz: 11240, wochen_delta_pct: 8.5,
};

const MOCK_STUNDEN: StundenPunkt[] = [
  { stunde: '10', umsatz: 88,  bestellungen: 4  },
  { stunde: '11', umsatz: 152, bestellungen: 7  },
  { stunde: '12', umsatz: 328, bestellungen: 14 },
  { stunde: '13', umsatz: 292, bestellungen: 12 },
  { stunde: '14', umsatz: 184, bestellungen: 8  },
  { stunde: '15', umsatz: 104, bestellungen: 5  },
  { stunde: '16', umsatz: 138, bestellungen: 6  },
  { stunde: '17', umsatz: 258, bestellungen: 11 },
  { stunde: '18', umsatz: 471, bestellungen: 12 },
];

const MOCK_FAHRER: FahrerRang[] = [
  { name: 'Max K.',  score: 94, stopps: 19, puenktl: 97, umsatz: 441, trend: 'up'   },
  { name: 'Lena S.', score: 81, stopps: 15, puenktl: 89, umsatz: 338, trend: 'flat' },
  { name: 'Tom B.',  score: 63, stopps: 11, puenktl: 79, umsatz: 251, trend: 'down' },
];

const MOCK_ZONEN: ZoneKpi[] = [
  { zone: 'Mitte', sla_pct: 95, avg_min: 23, umsatz: 658, kapaz_pct: 82 },
  { zone: 'Nord',  sla_pct: 89, avg_min: 27, umsatz: 512, kapaz_pct: 68 },
  { zone: 'Süd',   sla_pct: 77, avg_min: 33, umsatz: 401, kapaz_pct: 94 },
  { zone: 'West',  sla_pct: 92, avg_min: 25, umsatz: 332, kapaz_pct: 61 },
];

const MOCK_WOCHEN: WochenPunkt[] = [
  { tag: 'Mo', umsatz: 1540 },
  { tag: 'Di', umsatz: 1820 },
  { tag: 'Mi', umsatz: 1690 },
  { tag: 'Do', umsatz: 2140 },
  { tag: 'Fr', umsatz: 2380 },
  { tag: 'Sa', umsatz: 2890 },
  { tag: 'So', umsatz: 1870 },
];

type Tab = 'heute' | 'fahrer' | 'zonen' | 'woche';

const BAR_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16'];

export function LieferdienstPhase5111StatistikenDashboardV30({ locationId }: { locationId: string | null }) {
  const [stats, setStats] = useState<Stats>(MOCK_STATS);
  const [stunden, setStunden] = useState<StundenPunkt[]>(MOCK_STUNDEN);
  const [fahrer, setFahrer] = useState<FahrerRang[]>(MOCK_FAHRER);
  const [zonen, setZonen] = useState<ZoneKpi[]>(MOCK_ZONEN);
  const [wochen, setWochen] = useState<WochenPunkt[]>(MOCK_WOCHEN);
  const [tab, setTab] = useState<Tab>('heute');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }
    async function load() {
      try {
        const res = await fetch(`/api/delivery/lieferdienst/stats?location_id=${locationId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.stats)   setStats(data.stats);
          if (data.stunden) setStunden(data.stunden);
          if (data.fahrer)  setFahrer(data.fahrer);
          if (data.zonen)   setZonen(data.zonen);
          if (data.wochen)  setWochen(data.wochen);
        }
      } catch { /* use mock */ }
      finally { setLoading(false); }
    }
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const kpiItems = [
    { icon: Euro,        label: 'Umsatz',     val: euro(stats.umsatz_heute),      delta: stats.umsatz_delta_pct,     color: 'text-emerald-400' },
    { icon: BarChart3,   label: 'Bestellungen',val: String(stats.bestellungen_heute), delta: stats.bestellungen_delta_pct, color: 'text-indigo-400' },
    { icon: Clock,       label: 'Ø Lieferzeit',val: `${stats.avg_lieferzeit_min} min`, delta: null,                    color: 'text-amber-400'   },
    { icon: CheckCircle2,label: 'Pünktlichkeit',val:`${stats.puenktlichkeit_pct}%`, delta: null,                       color: stats.puenktlichkeit_pct >= 90 ? 'text-emerald-400' : 'text-amber-400' },
    { icon: Bike,        label: 'Fahrer aktiv',val: String(stats.fahrer_aktiv),    delta: null,                        color: 'text-blue-400'    },
    { icon: Star,        label: 'Bewertung',   val: `${stats.bewertung_avg}★`,     delta: null,                        color: 'text-yellow-400'  },
    { icon: AlertTriangle,label:'Storno',       val: `${stats.storno_pct}%`,        delta: null,                        color: stats.storno_pct < 5 ? 'text-emerald-400' : 'text-red-400' },
    { icon: TrendingUp,  label: 'Marge',       val: `${stats.profit_margin_pct}%`, delta: null,                        color: 'text-teal-400'    },
  ];

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-teal-400" />
          <span className="text-sm font-semibold text-white">Statistiken-Dashboard V30</span>
        </div>
        {stats.wochen_umsatz != null && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-400">Woche</span>
            <span className="text-sm font-bold text-teal-400">{euro(stats.wochen_umsatz)}</span>
            {stats.wochen_delta_pct != null && (
              <span className={cn('text-[10px]', stats.wochen_delta_pct >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                {stats.wochen_delta_pct >= 0 ? '+' : ''}{stats.wochen_delta_pct.toFixed(1)}%
              </span>
            )}
          </div>
        )}
      </div>

      {/* Monatsziel */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <Target className="h-3 w-3 text-teal-400" />
            <span className="text-slate-400">Monatsziel</span>
          </div>
          <span className="text-teal-400 font-semibold">{stats.monatsziel_pct}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', stats.monatsziel_pct >= 80 ? 'bg-emerald-400' : stats.monatsziel_pct >= 50 ? 'bg-amber-400' : 'bg-red-400')}
            style={{ width: `${stats.monatsziel_pct}%` }}
          />
        </div>
      </div>

      {/* 8-KPI Grid */}
      <div className="grid grid-cols-4 gap-1.5">
        {kpiItems.map(({ icon: Icon, label, val, delta, color }) => (
          <div key={label} className="rounded-lg bg-white/5 p-2">
            <Icon className={cn('h-3 w-3 mb-1', color)} />
            <div className={cn('text-sm font-bold leading-tight truncate', color)}>{val}</div>
            {delta != null && (
              <div className={cn('flex items-center gap-0.5 text-[10px]', delta >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                {delta >= 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                {Math.abs(delta).toFixed(1)}%
              </div>
            )}
            <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{label}</div>
          </div>
        ))}
      </div>

      {/* Tab Nav */}
      <div className="flex gap-1.5">
        {(['heute', 'fahrer', 'zonen', 'woche'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-2.5 py-1 rounded-md text-xs font-medium transition-colors capitalize',
              tab === t
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
            )}
          >
            {t === 'heute' ? 'Heute' : t === 'fahrer' ? 'Fahrer' : t === 'zonen' ? 'Zonen' : 'Woche'}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'heute' && (
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stunden} margin={{ top: 2, right: 2, left: -20, bottom: 0 }}>
              <XAxis dataKey="stunde" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
                formatter={(v: unknown) => [typeof v === 'number' ? euro(v) : String(v), 'Umsatz']}
              />
              <Bar dataKey="umsatz" radius={[3, 3, 0, 0]}>
                {stunden.map((_, i) => (
                  <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {tab === 'fahrer' && (
        <div className="space-y-2">
          {fahrer.map((f, i) => (
            <div key={f.name} className="flex items-center gap-2">
              <span className="text-xs text-slate-500 w-4">#{i + 1}</span>
              <div className="flex-1 space-y-0.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-white">{f.name}</span>
                    {f.trend === 'up' && <TrendingUp className="h-3 w-3 text-emerald-400" />}
                    {f.trend === 'down' && <TrendingDown className="h-3 w-3 text-red-400" />}
                  </div>
                  <span className={cn('text-xs font-bold', f.score >= 80 ? 'text-emerald-400' : f.score >= 60 ? 'text-amber-400' : 'text-red-400')}>
                    {f.score}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', f.score >= 80 ? 'bg-emerald-400' : f.score >= 60 ? 'bg-amber-400' : 'bg-red-400')}
                    style={{ width: `${f.score}%` }}
                  />
                </div>
                <div className="flex gap-2 text-[10px] text-slate-400">
                  <span>{f.stopps} Stopps</span>
                  <span>{f.puenktl}% pünktl.</span>
                  <span>{euro(f.umsatz)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'zonen' && (
        <div className="space-y-2">
          {zonen.map(z => (
            <div key={z.zone} className="rounded-lg bg-white/5 p-2 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white">{z.zone}</span>
                <span className={cn('font-bold', z.sla_pct >= 90 ? 'text-emerald-400' : z.sla_pct >= 75 ? 'text-amber-400' : 'text-red-400')}>
                  SLA {z.sla_pct}%
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={cn('h-full rounded-full', z.kapaz_pct >= 90 ? 'bg-red-400' : z.kapaz_pct >= 70 ? 'bg-amber-400' : 'bg-emerald-400')}
                  style={{ width: `${z.kapaz_pct}%` }}
                />
              </div>
              <div className="flex gap-3 text-[10px] text-slate-400">
                <span>Ø {z.avg_min} Min</span>
                <span>{euro(z.umsatz)}</span>
                <span>Kap. {z.kapaz_pct}%</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'woche' && (
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={wochen} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <XAxis dataKey="tag" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
                formatter={(v: unknown) => [typeof v === 'number' ? euro(v) : String(v), 'Umsatz']}
              />
              <Line type="monotone" dataKey="umsatz" stroke="#2dd4bf" strokeWidth={2} dot={{ r: 3, fill: '#2dd4bf' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="text-[10px] text-slate-600 text-right">30-Sek-Polling · Mock-Fallback</div>
    </div>
  );
}
