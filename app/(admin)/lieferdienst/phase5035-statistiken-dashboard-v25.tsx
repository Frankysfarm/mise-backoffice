'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, YAxis, CartesianGrid } from 'recharts';
import {
  TrendingUp, TrendingDown, Users, Euro, Clock, Target, AlertTriangle,
  Star, Route, CheckCircle2, Activity, Award,
} from 'lucide-react';

// Phase 5035 — Statistiken Dashboard V25
// Monatsziel-Fortschritt; Schicht-Bilanz; 8-KPI-Grid Ampel+Δ%; Top-3-Fahrer tier-farbkodiert;
// Stunden-BarChart + 7-Tage-LineChart Tab-Nav; Zonen-SLA-Matrix; 60-Sek-Polling; Mock-Fallback

interface StundeData { stunde: string; bestellungen: number; umsatz: number; ziel: number }
interface WocheData  { tag: string; umsatz: number; bestellungen: number }
interface FahrerData {
  name: string; score: number; stopps: number; puenktl: number;
  umsatz: number; trinkgeld: number; tier: 'platin' | 'gold' | 'gut' | 'schwach';
}
interface ZoneData { zone: string; sla: number; avg_eta: number; umsatz: number; kap: number }
interface ApiData {
  kpis: {
    umsatz: number; umsatz_delta: number;
    bestellungen: number; bestellungen_delta: number;
    fahrer_aktiv: number;
    avg_lieferzeit: number; puenktlichkeit: number;
    bewertung: number; trinkgeld: number; storno: number;
    monat_ziel: number; monat_ist: number;
  };
  stunden: StundeData[];
  woche: WocheData[];
  fahrer: FahrerData[];
  zonen: ZoneData[];
  alert: string | null;
}

const STUNDEN_MOCK: StundeData[] = [
  { stunde: '11h', bestellungen: 4,  umsatz: 84,  ziel: 80  },
  { stunde: '12h', bestellungen: 14, umsatz: 294, ziel: 240 },
  { stunde: '13h', bestellungen: 17, umsatz: 357, ziel: 310 },
  { stunde: '14h', bestellungen: 8,  umsatz: 168, ziel: 190 },
  { stunde: '15h', bestellungen: 6,  umsatz: 126, ziel: 140 },
  { stunde: '16h', bestellungen: 9,  umsatz: 189, ziel: 170 },
  { stunde: '17h', bestellungen: 15, umsatz: 315, ziel: 270 },
  { stunde: '18h', bestellungen: 21, umsatz: 441, ziel: 360 },
  { stunde: '19h', bestellungen: 24, umsatz: 504, ziel: 420 },
  { stunde: '20h', bestellungen: 19, umsatz: 399, ziel: 340 },
];

const WOCHE_MOCK: WocheData[] = [
  { tag: 'Mo', umsatz: 1950, bestellungen: 93  },
  { tag: 'Di', umsatz: 2240, bestellungen: 107 },
  { tag: 'Mi', umsatz: 2060, bestellungen: 98  },
  { tag: 'Do', umsatz: 2430, bestellungen: 116 },
  { tag: 'Fr', umsatz: 2900, bestellungen: 139 },
  { tag: 'Sa', umsatz: 3240, bestellungen: 155 },
  { tag: 'So', umsatz: 2677, bestellungen: 128 },
];

const MOCK: ApiData = {
  kpis: {
    umsatz: 2677, umsatz_delta: 9.2,
    bestellungen: 128, bestellungen_delta: 5,
    fahrer_aktiv: 7,
    avg_lieferzeit: 26, puenktlichkeit: 92,
    bewertung: 4.8, trinkgeld: 162, storno: 1.8,
    monat_ziel: 65000, monat_ist: 47200,
  },
  stunden: STUNDEN_MOCK,
  woche: WOCHE_MOCK,
  fahrer: [
    { name: 'Jonas M.', score: 97, stopps: 17, puenktl: 98, umsatz: 204, trinkgeld: 26, tier: 'platin' },
    { name: 'Anna B.',  score: 91, stopps: 14, puenktl: 94, umsatz: 168, trinkgeld: 19, tier: 'gold'   },
    { name: 'Sara K.',  score: 88, stopps: 13, puenktl: 91, umsatz: 156, trinkgeld: 16, tier: 'gut'    },
  ],
  zonen: [
    { zone: 'Mitte', sla: 96, avg_eta: 23, umsatz: 1080, kap: 82 },
    { zone: 'Nord',  sla: 89, avg_eta: 31, umsatz: 724,  kap: 66 },
    { zone: 'Süd',   sla: 85, avg_eta: 29, umsatz: 648,  kap: 70 },
    { zone: 'West',  sla: 76, avg_eta: 37, umsatz: 325,  kap: 48 },
  ],
  alert: null,
};

const TIER_COLORS: Record<FahrerData['tier'], string> = {
  platin: 'bg-slate-700 text-white',
  gold:   'bg-amber-500 text-white',
  gut:    'bg-emerald-600 text-white',
  schwach:'bg-red-600 text-white',
};

const TIER_MEDALS: Record<FahrerData['tier'], string> = {
  platin: '🥇', gold: '🥈', gut: '🥉', schwach: '',
};

export function LieferdienstPhase5035StatistikenDashboardV25({ locationId }: { locationId?: string | null }) {
  const [data, setData]     = useState<ApiData | null>(null);
  const [tab, setTab]       = useState<'stunden' | 'woche'>('stunden');

  async function fetchData() {
    try {
      const params = locationId ? `?locationId=${locationId}` : '';
      const r = await fetch(`/api/delivery/admin/analytics${params}`, { cache: 'no-store' });
      if (!r.ok) throw new Error();
      setData(await r.json());
    } catch {
      setData(MOCK);
    }
  }

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 60_000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const d = data ?? MOCK;
  const k = d.kpis;
  const monatPct = Math.round((k.monat_ist / k.monat_ziel) * 100);

  const kpis = [
    { label: 'Umsatz',       val: `${(k.umsatz / 1000).toFixed(1)}k €`,  delta: k.umsatz_delta,      icon: <Euro className="h-3.5 w-3.5 text-emerald-600" />, warn: false },
    { label: 'Bestellungen', val: k.bestellungen,                          delta: k.bestellungen_delta, icon: <Route className="h-3.5 w-3.5 text-indigo-600" />,  warn: false },
    { label: 'Ø Lieferzeit', val: `${k.avg_lieferzeit} min`,              delta: null,                 icon: <Clock className="h-3.5 w-3.5 text-amber-500" />,   warn: k.avg_lieferzeit > 35 },
    { label: 'Pünktlichkeit',val: `${k.puenktlichkeit}%`,                 delta: null,                 icon: <Target className="h-3.5 w-3.5 text-green-600" />,   warn: k.puenktlichkeit < 80 },
    { label: 'Aktive Fahrer',val: k.fahrer_aktiv,                          delta: null,                 icon: <Users className="h-3.5 w-3.5 text-violet-600" />,   warn: false },
    { label: 'Bewertung',    val: `${k.bewertung} ★`,                     delta: null,                 icon: <Star className="h-3.5 w-3.5 text-amber-400" />,     warn: k.bewertung < 4.0 },
    { label: 'Trinkgeld',    val: `${k.trinkgeld} €`,                     delta: null,                 icon: <Award className="h-3.5 w-3.5 text-teal-600" />,     warn: false },
    { label: 'Storno',       val: `${k.storno}%`,                         delta: null,                 icon: <AlertTriangle className="h-3.5 w-3.5 text-red-500" />, warn: k.storno > 4 },
  ];

  return (
    <div className="rounded-2xl border border-emerald-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-emerald-700 text-white">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-emerald-300" />
          <span className="font-bold text-sm">Statistiken V25</span>
        </div>
        <div className="text-xs opacity-80">Live · 60 Sek</div>
      </div>

      {d.alert && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-b border-red-200 text-red-700 text-xs font-medium">
          <AlertTriangle className="h-4 w-4 shrink-0" />{d.alert}
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* Monatsziel */}
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-emerald-800">Monatsziel</span>
            <span className="text-xs font-bold text-emerald-700">
              {(k.monat_ist / 1000).toFixed(1)}k / {(k.monat_ziel / 1000).toFixed(0)}k € · {monatPct}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-emerald-200">
            <div
              className={`h-2 rounded-full transition-all ${monatPct >= 80 ? 'bg-emerald-500' : monatPct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min(monatPct, 100)}%` }}
            />
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-4 gap-2">
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              className={`rounded-xl border p-2.5 ${kpi.warn ? 'border-red-200 bg-red-50' : 'border-border bg-muted/20'}`}
            >
              <div className="mb-1">{kpi.icon}</div>
              <div className={`font-black text-sm leading-tight ${kpi.warn ? 'text-red-600' : 'text-foreground'}`}>
                {kpi.val}
              </div>
              <div className="text-[10px] text-muted-foreground leading-tight">{kpi.label}</div>
              {kpi.delta != null && (
                <div className={`flex items-center gap-0.5 text-[10px] font-semibold mt-0.5 ${kpi.delta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {kpi.delta > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                  {kpi.delta > 0 ? '+' : ''}{kpi.delta}{typeof kpi.delta === 'number' && String(kpi.label).includes('Umsatz') ? '%' : ''}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Chart */}
        <div>
          <div className="flex gap-2 mb-2">
            {(['stunden', 'woche'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${tab === t ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground'}`}
              >
                {t === 'stunden' ? 'Heute stündlich' : '7 Tage Trend'}
              </button>
            ))}
          </div>
          <div className="h-36">
            {tab === 'stunden' ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.stunden} barGap={2}>
                  <XAxis dataKey="stunde" tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number, n: string) => [n === 'umsatz' ? `${v} €` : v, n === 'umsatz' ? 'Umsatz' : 'Bestellungen']} />
                  <Bar dataKey="umsatz" radius={[3, 3, 0, 0]}>
                    {d.stunden.map((s, i) => (
                      <Cell key={i} fill={s.umsatz >= s.ziel ? '#10b981' : '#f59e0b'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={d.woche}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="tag" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={38} />
                  <Tooltip formatter={(v: number | undefined) => [`${v ?? 0} €`, 'Umsatz']} />
                  <Line dataKey="umsatz" stroke="#059669" strokeWidth={2} dot={{ r: 3, fill: '#059669' }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top Fahrer */}
        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />Top Fahrer
          </div>
          <div className="space-y-1.5">
            {d.fahrer.map((f, i) => (
              <div key={f.name} className="flex items-center gap-3 rounded-xl bg-muted/20 border border-border px-3 py-2">
                <span className="text-sm w-4">{TIER_MEDALS[f.tier] || (i + 1) + '.'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm truncate">{f.name}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${TIER_COLORS[f.tier]}`}>
                      {f.tier.charAt(0).toUpperCase() + f.tier.slice(1)}
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {f.stopps} Stopps · {f.puenktl}% pünktl. · {f.trinkgeld} € Trinkgeld
                  </div>
                </div>
                <div className={`text-sm font-black ${f.score >= 90 ? 'text-emerald-600' : f.score >= 75 ? 'text-amber-600' : 'text-red-600'}`}>
                  {f.score}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Zonen */}
        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />Zonen-SLA
          </div>
          <div className="grid grid-cols-4 gap-2">
            {d.zonen.map((z) => (
              <div key={z.zone} className="rounded-xl border border-border bg-muted/20 p-2 text-center">
                <div className="text-xs font-bold text-muted-foreground">{z.zone}</div>
                <div className={`text-sm font-black mt-0.5 ${z.sla >= 90 ? 'text-emerald-600' : z.sla >= 80 ? 'text-amber-600' : 'text-red-600'}`}>
                  {z.sla}%
                </div>
                <div className="text-[10px] text-muted-foreground">{z.avg_eta} min</div>
                <div className="mt-1 h-1 rounded-full bg-muted">
                  <div className="h-1 rounded-full bg-emerald-500" style={{ width: `${z.kap}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
