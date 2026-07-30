'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, YAxis, CartesianGrid } from 'recharts';
import {
  TrendingUp, TrendingDown, Users, Euro, Clock, Target, AlertTriangle,
  Star, Route, CheckCircle2, Activity, Award, Zap, BarChart3,
} from 'lucide-react';

// Phase 5036 — Statistiken Dashboard V26
// Monatsziel-Fortschritt; Revenue-Velocity-Tracker; Storno-Analyse;
// Echtzeit-Profit-Metriken; 8-KPI-Grid Ampel+Δ%; Top-Fahrer; Zonen-SLA; 45-Sek-Polling; Mock-Fallback

interface StundeData  { stunde: string; bestellungen: number; umsatz: number; ziel: number }
interface WocheData   { tag: string; umsatz: number; bestellungen: number }
interface FahrerData  { name: string; score: number; stopps: number; puenktl: number; umsatz: number; trinkgeld: number; tier: 'platin' | 'gold' | 'gut' | 'schwach' }
interface ZoneData    { zone: string; sla: number; avg_eta: number; umsatz: number; kap: number }
interface VelocityData { label: string; umsatz_pro_h: number; ziel: number }

interface ApiData {
  kpis: {
    umsatz: number; umsatz_delta: number;
    bestellungen: number; bestellungen_delta: number;
    fahrer_aktiv: number;
    avg_lieferzeit: number; puenktlichkeit: number;
    bewertung: number; trinkgeld: number; storno: number;
    monat_ziel: number; monat_ist: number;
    profit_heute: number; profit_delta: number;
  };
  velocity: VelocityData[];
  stunden: StundeData[];
  woche: WocheData[];
  fahrer: FahrerData[];
  zonen: ZoneData[];
  storno_grund: { grund: string; anzahl: number }[];
  alert: string | null;
}

const VELOCITY_MOCK: VelocityData[] = [
  { label: '11h', umsatz_pro_h: 84,  ziel: 120 },
  { label: '12h', umsatz_pro_h: 294, ziel: 240 },
  { label: '13h', umsatz_pro_h: 357, ziel: 310 },
  { label: '14h', umsatz_pro_h: 168, ziel: 200 },
  { label: '15h', umsatz_pro_h: 210, ziel: 200 },
  { label: '16h', umsatz_pro_h: 252, ziel: 240 },
];

const MOCK: ApiData = {
  kpis: {
    umsatz: 2980, umsatz_delta: 11.4,
    bestellungen: 142, bestellungen_delta: 7,
    fahrer_aktiv: 8,
    avg_lieferzeit: 25, puenktlichkeit: 94,
    bewertung: 4.9, trinkgeld: 178, storno: 1.6,
    monat_ziel: 65000, monat_ist: 49800,
    profit_heute: 892, profit_delta: 8.3,
  },
  velocity: VELOCITY_MOCK,
  stunden: [
    { stunde: '11h', bestellungen: 4,  umsatz: 84,  ziel: 80  },
    { stunde: '12h', bestellungen: 14, umsatz: 294, ziel: 240 },
    { stunde: '13h', bestellungen: 17, umsatz: 357, ziel: 310 },
    { stunde: '14h', bestellungen: 8,  umsatz: 168, ziel: 190 },
    { stunde: '16h', bestellungen: 9,  umsatz: 189, ziel: 170 },
    { stunde: '17h', bestellungen: 15, umsatz: 315, ziel: 270 },
    { stunde: '18h', bestellungen: 22, umsatz: 462, ziel: 360 },
    { stunde: '19h', bestellungen: 25, umsatz: 525, ziel: 420 },
    { stunde: '20h', bestellungen: 21, umsatz: 441, ziel: 340 },
  ],
  woche: [
    { tag: 'Mo', umsatz: 2150, bestellungen: 103 },
    { tag: 'Di', umsatz: 2440, bestellungen: 117 },
    { tag: 'Mi', umsatz: 2260, bestellungen: 108 },
    { tag: 'Do', umsatz: 2630, bestellungen: 126 },
    { tag: 'Fr', umsatz: 3100, bestellungen: 149 },
    { tag: 'Sa', umsatz: 3440, bestellungen: 165 },
    { tag: 'So', umsatz: 2980, bestellungen: 142 },
  ],
  fahrer: [
    { name: 'Jonas M.', score: 98, stopps: 19, puenktl: 99, umsatz: 226, trinkgeld: 28, tier: 'platin' },
    { name: 'Anna B.',  score: 93, stopps: 16, puenktl: 95, umsatz: 192, trinkgeld: 21, tier: 'gold'   },
    { name: 'Sara K.',  score: 89, stopps: 14, puenktl: 92, umsatz: 168, trinkgeld: 18, tier: 'gut'    },
  ],
  zonen: [
    { zone: 'Mitte', sla: 97, avg_eta: 22, umsatz: 1200, kap: 85 },
    { zone: 'Nord',  sla: 91, avg_eta: 29, umsatz: 810,  kap: 70 },
    { zone: 'Süd',   sla: 87, avg_eta: 28, umsatz: 690,  kap: 72 },
    { zone: 'West',  sla: 78, avg_eta: 35, umsatz: 280,  kap: 50 },
  ],
  storno_grund: [
    { grund: 'Zu lang',   anzahl: 4 },
    { grund: 'Artikel fehlt', anzahl: 2 },
    { grund: 'Falsche Adresse', anzahl: 1 },
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

export function LieferdienstPhase5036StatistikenDashboardV26({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [tab, setTab]   = useState<'stunden' | 'woche' | 'velocity'>('stunden');

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
    const t = setInterval(fetchData, 45_000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const d = data ?? MOCK;
  const k = d.kpis;
  const monatPct = Math.round((k.monat_ist / k.monat_ziel) * 100);

  const kpis = [
    { label: 'Umsatz',        val: `${(k.umsatz / 1000).toFixed(1)}k €`,   delta: k.umsatz_delta,      icon: <Euro       className="h-3.5 w-3.5 text-emerald-600" />, warn: false },
    { label: 'Bestellungen',  val: k.bestellungen,                           delta: k.bestellungen_delta, icon: <Route      className="h-3.5 w-3.5 text-indigo-600" />,  warn: false },
    { label: 'Profit heute',  val: `${k.profit_heute} €`,                   delta: k.profit_delta,       icon: <Zap        className="h-3.5 w-3.5 text-violet-600" />,  warn: false },
    { label: 'Ø Lieferzeit',  val: `${k.avg_lieferzeit} min`,               delta: null,                 icon: <Clock      className="h-3.5 w-3.5 text-amber-500" />,   warn: k.avg_lieferzeit > 35 },
    { label: 'Pünktlichkeit', val: `${k.puenktlichkeit}%`,                  delta: null,                 icon: <Target     className="h-3.5 w-3.5 text-green-600" />,   warn: k.puenktlichkeit < 80 },
    { label: 'Aktive Fahrer', val: k.fahrer_aktiv,                           delta: null,                 icon: <Users      className="h-3.5 w-3.5 text-violet-600" />,  warn: false },
    { label: 'Bewertung',     val: `${k.bewertung} ★`,                      delta: null,                 icon: <Star       className="h-3.5 w-3.5 text-amber-400" />,   warn: k.bewertung < 4.0 },
    { label: 'Storno',        val: `${k.storno}%`,                          delta: null,                 icon: <AlertTriangle className="h-3.5 w-3.5 text-red-500" />, warn: k.storno > 4 },
  ];

  return (
    <div className="rounded-2xl border border-teal-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-teal-700 text-white">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-teal-300" />
          <span className="font-bold text-sm">Statistiken V26</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs font-bold">{k.profit_heute} € Profit</div>
            <div className="text-[10px] opacity-70">45 Sek Live</div>
          </div>
        </div>
      </div>

      {d.alert && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-b border-red-200 text-red-700 text-xs font-medium">
          <AlertTriangle className="h-4 w-4 shrink-0" />{d.alert}
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* Monatsziel */}
        <div className="rounded-xl border border-teal-100 bg-teal-50 px-4 py-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-teal-800">Monatsziel</span>
            <span className="text-xs font-bold text-teal-700">
              {(k.monat_ist / 1000).toFixed(1)}k / {(k.monat_ziel / 1000).toFixed(0)}k € · {monatPct}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-teal-200">
            <div
              className={`h-2 rounded-full transition-all ${monatPct >= 80 ? 'bg-teal-500' : monatPct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
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
              <div className={`font-black text-sm leading-tight ${kpi.warn ? 'text-red-600' : 'text-foreground'}`}>{kpi.val}</div>
              <div className="text-[10px] text-muted-foreground leading-tight">{kpi.label}</div>
              {kpi.delta != null && (
                <div className={`flex items-center gap-0.5 text-[10px] font-semibold mt-0.5 ${kpi.delta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {kpi.delta > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                  {kpi.delta > 0 ? '+' : ''}{kpi.delta}%
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Chart mit Velocity Tab */}
        <div>
          <div className="flex gap-2 mb-2">
            {(['stunden', 'woche', 'velocity'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${tab === t ? 'bg-teal-600 text-white' : 'bg-muted text-muted-foreground'}`}
              >
                {t === 'stunden' ? 'Heute' : t === 'woche' ? '7 Tage' : 'Velocity'}
              </button>
            ))}
          </div>
          <div className="h-36">
            {tab === 'stunden' && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.stunden} barGap={2}>
                  <XAxis dataKey="stunde" tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: unknown, n: unknown) => [((n as string) === 'umsatz' ? `${(v as number) ?? 0} €` : (v as number) ?? 0), (n as string) === 'umsatz' ? 'Umsatz' : 'Bestellungen'] as [string | number, string]} />
                  <Bar dataKey="umsatz" radius={[3, 3, 0, 0]}>
                    {d.stunden.map((s, i) => (
                      <Cell key={i} fill={s.umsatz >= s.ziel ? '#0d9488' : '#f59e0b'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
            {tab === 'woche' && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={d.woche}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="tag" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={38} />
                  <Tooltip formatter={(v: unknown) => [`${(v as number) ?? 0} €`, 'Umsatz'] as [string, string]} />
                  <Line dataKey="umsatz" stroke="#0d9488" strokeWidth={2} dot={{ r: 3, fill: '#0d9488' }} />
                </LineChart>
              </ResponsiveContainer>
            )}
            {tab === 'velocity' && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.velocity} barGap={2}>
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number | undefined) => [`${v ?? 0} €/h`, 'Velocity'] as [string, string]} />
                  <Bar dataKey="umsatz_pro_h" radius={[3, 3, 0, 0]}>
                    {d.velocity.map((v, i) => (
                      <Cell key={i} fill={v.umsatz_pro_h >= v.ziel ? '#8b5cf6' : '#d1d5db'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Storno Analyse */}
        {d.storno_grund.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <BarChart3 className="h-3.5 w-3.5" />Storno-Gründe
            </div>
            <div className="flex gap-2 flex-wrap">
              {d.storno_grund.map((s) => (
                <div key={s.grund} className="flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2.5 py-1 text-xs text-red-700">
                  <span className="font-bold">{s.anzahl}×</span>{s.grund}
                </div>
              ))}
            </div>
          </div>
        )}

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
                  <div className="h-1 rounded-full bg-teal-500" style={{ width: `${z.kap}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t border-border pt-2">
          <span className="flex items-center gap-1"><Award className="h-3 w-3" />{k.trinkgeld} € Trinkgeld heute</span>
          <span>45 Sek Polling</span>
        </div>
      </div>
    </div>
  );
}
