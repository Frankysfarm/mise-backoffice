'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, YAxis, CartesianGrid } from 'recharts';
import {
  TrendingUp, TrendingDown, Users, Euro, Clock, Target, AlertTriangle,
  Star, Route, CheckCircle2, Activity, Award, Zap, BarChart3, XCircle,
} from 'lucide-react';

// Phase 5056 — Statistiken Dashboard V27
// Neu: Storno-Trend-Chart (7 Tage); SLA-Verlauf-Sparkline; Fahrer-Vergleich-Matrix;
// Top-3-Stunden-Umsatz; Kunden-Treue-Rate; Profit-Margin-Trend; 45-Sek-Polling; Mock-Fallback

interface StundeData   { stunde: string; bestellungen: number; umsatz: number; ziel: number }
interface WocheData    { tag: string; umsatz: number; bestellungen: number; storno: number }
interface FahrerData   { name: string; score: number; stopps: number; puenktl: number; umsatz: number; trinkgeld: number; tier: 'platin' | 'gold' | 'gut' | 'schwach'; vergleich_delta: number }
interface ZoneData     { zone: string; sla: number; avg_eta: number; umsatz: number; kap: number }
interface SlaVerlauf   { tag: string; sla: number }
interface StornoTrend  { tag: string; storno_pct: number }

interface ApiData {
  kpis: {
    umsatz: number; umsatz_delta: number;
    bestellungen: number; bestellungen_delta: number;
    fahrer_aktiv: number;
    avg_lieferzeit: number; puenktlichkeit: number;
    bewertung: number; trinkgeld: number; storno: number;
    monat_ziel: number; monat_ist: number;
    profit_heute: number; profit_delta: number;
    kunden_treue_rate: number;
    profit_margin: number; profit_margin_delta: number;
  };
  stunden: StundeData[];
  woche: WocheData[];
  fahrer: FahrerData[];
  zonen: ZoneData[];
  sla_verlauf: SlaVerlauf[];
  storno_trend: StornoTrend[];
  alert: string | null;
}

const MOCK: ApiData = {
  kpis: {
    umsatz: 3120, umsatz_delta: 13.2,
    bestellungen: 156, bestellungen_delta: 9,
    fahrer_aktiv: 9,
    avg_lieferzeit: 24, puenktlichkeit: 95,
    bewertung: 4.9, trinkgeld: 192, storno: 1.3,
    monat_ziel: 65000, monat_ist: 52400,
    profit_heute: 946, profit_delta: 10.1,
    kunden_treue_rate: 68,
    profit_margin: 28.4, profit_margin_delta: 1.8,
  },
  stunden: [
    { stunde: '11h', bestellungen: 5,  umsatz: 104, ziel: 80  },
    { stunde: '12h', bestellungen: 14, umsatz: 312, ziel: 240 },
    { stunde: '13h', bestellungen: 19, umsatz: 392, ziel: 310 },
    { stunde: '14h', bestellungen: 11, umsatz: 184, ziel: 200 },
    { stunde: '15h', bestellungen: 9,  umsatz: 228, ziel: 200 },
    { stunde: '16h', bestellungen: 16, umsatz: 276, ziel: 240 },
  ],
  woche: [
    { tag: 'Mo', umsatz: 1840, bestellungen: 78,  storno: 1.2 },
    { tag: 'Di', umsatz: 2100, bestellungen: 91,  storno: 0.8 },
    { tag: 'Mi', umsatz: 2450, bestellungen: 105, storno: 1.5 },
    { tag: 'Do', umsatz: 2780, bestellungen: 124, storno: 1.1 },
    { tag: 'Fr', umsatz: 3120, bestellungen: 156, storno: 1.3 },
    { tag: 'Sa', umsatz: 0,    bestellungen: 0,   storno: 0   },
    { tag: 'So', umsatz: 0,    bestellungen: 0,   storno: 0   },
  ],
  fahrer: [
    { name: 'Jonas M.', score: 97, stopps: 28, puenktl: 98, umsatz: 1240, trinkgeld: 62, tier: 'platin', vergleich_delta: 12 },
    { name: 'Anna B.',  score: 90, stopps: 22, puenktl: 93, umsatz: 980,  trinkgeld: 44, tier: 'gold',   vergleich_delta:  7 },
    { name: 'Tom H.',   score: 74, stopps: 18, puenktl: 81, umsatz: 740,  trinkgeld: 28, tier: 'gut',    vergleich_delta: -3 },
    { name: 'Sara K.',  score: 61, stopps: 14, puenktl: 68, umsatz: 560,  trinkgeld: 18, tier: 'schwach',vergleich_delta: -8 },
  ],
  zonen: [
    { zone: 'Mitte', sla: 97, avg_eta: 22, umsatz: 1480, kap: 82 },
    { zone: 'Nord',  sla: 93, avg_eta: 26, umsatz: 920,  kap: 67 },
    { zone: 'Süd',   sla: 88, avg_eta: 29, umsatz: 740,  kap: 58 },
    { zone: 'West',  sla: 91, avg_eta: 27, umsatz: 860,  kap: 91 },
  ],
  sla_verlauf: [
    { tag: 'Mo', sla: 91 }, { tag: 'Di', sla: 93 }, { tag: 'Mi', sla: 90 },
    { tag: 'Do', sla: 95 }, { tag: 'Fr', sla: 95 }, { tag: 'Sa', sla: 0  }, { tag: 'So', sla: 0 },
  ],
  storno_trend: [
    { tag: 'Mo', storno_pct: 1.2 }, { tag: 'Di', storno_pct: 0.8 }, { tag: 'Mi', storno_pct: 1.5 },
    { tag: 'Do', storno_pct: 1.1 }, { tag: 'Fr', storno_pct: 1.3 }, { tag: 'Sa', storno_pct: 0   }, { tag: 'So', storno_pct: 0 },
  ],
  alert: null,
};

const TIER_BADGE: Record<string, string> = {
  platin: 'bg-slate-700 text-white',
  gold:   'bg-amber-500 text-white',
  gut:    'bg-emerald-600 text-white',
  schwach:'bg-red-600 text-white',
};

export function LieferdienstPhase5056StatistikenDashboardV27({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);

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
  const topStunden = [...d.stunden].sort((a, b) => b.umsatz - a.umsatz).slice(0, 3);
  const monatPct   = Math.round((d.kpis.monat_ist / d.kpis.monat_ziel) * 100);

  return (
    <div className="rounded-2xl border border-teal-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-teal-700 text-white">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-teal-200" />
          <span className="font-bold text-sm">Statistiken V27</span>
        </div>
        <div className="text-xs opacity-70">45 Sek Polling</div>
      </div>

      {d.alert && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-b border-red-200 text-red-700 text-xs font-medium">
          <AlertTriangle className="h-4 w-4 shrink-0" />{d.alert}
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* 8-KPI Grid */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { icon: <Euro className="h-3.5 w-3.5 text-emerald-600" />, label: 'Umsatz',       val: `${(d.kpis.umsatz / 1000).toFixed(1)}k €`,  delta: d.kpis.umsatz_delta,        up: d.kpis.umsatz_delta >= 0 },
            { icon: <Activity className="h-3.5 w-3.5 text-blue-500" />,label: 'Bestellungen', val: `${d.kpis.bestellungen}`,                     delta: d.kpis.bestellungen_delta,  up: d.kpis.bestellungen_delta >= 0 },
            { icon: <Clock className="h-3.5 w-3.5 text-amber-500" />,  label: 'Ø Lieferzeit', val: `${d.kpis.avg_lieferzeit} min`,               delta: null,                       up: d.kpis.avg_lieferzeit <= 30 },
            { icon: <Target className="h-3.5 w-3.5 text-violet-500" />,label: 'Pünktlichkeit',val: `${d.kpis.puenktlichkeit}%`,                  delta: null,                       up: d.kpis.puenktlichkeit >= 90 },
            { icon: <Star className="h-3.5 w-3.5 text-amber-400" />,   label: 'Bewertung',    val: `${d.kpis.bewertung}★`,                       delta: null,                       up: d.kpis.bewertung >= 4.5 },
            { icon: <Award className="h-3.5 w-3.5 text-orange-500" />, label: 'Trinkgeld',    val: `${d.kpis.trinkgeld} €`,                      delta: null,                       up: true },
            { icon: <XCircle className="h-3.5 w-3.5 text-red-500" />,  label: 'Storno',       val: `${d.kpis.storno}%`,                          delta: null,                       up: d.kpis.storno <= 2 },
            { icon: <Zap className="h-3.5 w-3.5 text-teal-500" />,     label: 'Profit',       val: `${d.kpis.profit_heute} €`,                   delta: d.kpis.profit_delta,        up: d.kpis.profit_delta >= 0 },
          ].map((kpi) => (
            <div key={kpi.label} className={`rounded-xl border p-2.5 ${!kpi.up ? 'border-red-200 bg-red-50' : 'border-border bg-muted/20'}`}>
              <div className="flex items-center gap-1 mb-0.5">{kpi.icon}<span className="text-[10px] text-muted-foreground">{kpi.label}</span></div>
              <div className={`text-sm font-black ${!kpi.up ? 'text-red-600' : 'text-foreground'}`}>{kpi.val}</div>
              {kpi.delta != null && (
                <div className={`flex items-center gap-0.5 text-[10px] font-semibold ${kpi.up ? 'text-emerald-600' : 'text-red-600'}`}>
                  {kpi.up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                  {kpi.up ? '+' : ''}{kpi.delta}%
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Monatsziel */}
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-teal-800">Monatsziel Fortschritt</span>
            <span className={`text-sm font-black ${monatPct >= 80 ? 'text-emerald-700' : monatPct >= 60 ? 'text-teal-700' : 'text-amber-700'}`}>{monatPct}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-teal-200">
            <div className="h-2.5 rounded-full bg-teal-600 transition-all" style={{ width: `${Math.min(100, monatPct)}%` }} />
          </div>
          <div className="flex justify-between text-[10px] text-teal-700 mt-1">
            <span>{(d.kpis.monat_ist / 1000).toFixed(1)}k €</span>
            <span>Ziel {(d.kpis.monat_ziel / 1000).toFixed(0)}k €</span>
          </div>
        </div>

        {/* Neue Metriken: Treue + Profit-Margin */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-violet-200 bg-violet-50 p-2.5 text-center">
            <CheckCircle2 className="h-4 w-4 text-violet-600 mx-auto mb-1" />
            <div className="text-xl font-black text-violet-700">{d.kpis.kunden_treue_rate}%</div>
            <div className="text-[10px] text-muted-foreground">Kunden-Treue-Rate</div>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-center">
            <TrendingUp className="h-4 w-4 text-emerald-600 mx-auto mb-1" />
            <div className="text-xl font-black text-emerald-700">{d.kpis.profit_margin}%</div>
            <div className={`text-[10px] font-semibold ${d.kpis.profit_margin_delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {d.kpis.profit_margin_delta >= 0 ? '+' : ''}{d.kpis.profit_margin_delta}% ggü. Vortag
            </div>
          </div>
        </div>

        {/* Storno-Trend 7 Tage */}
        <div>
          <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground mb-2">
            <XCircle className="h-3.5 w-3.5 text-red-500" />Storno-Trend (7 Tage)
          </div>
          <ResponsiveContainer width="100%" height={60}>
            <LineChart data={d.storno_trend}>
              <XAxis dataKey="tag" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number | undefined) => [`${v ?? 0}%`, 'Storno'] as [string, string]} contentStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="storno_pct" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: '#ef4444' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* SLA-Verlauf */}
        <div>
          <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground mb-2">
            <Target className="h-3.5 w-3.5" />SLA-Verlauf (7 Tage)
          </div>
          <ResponsiveContainer width="100%" height={60}>
            <LineChart data={d.sla_verlauf}>
              <XAxis dataKey="tag" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number | undefined) => [`${v ?? 0}%`, 'SLA'] as [string, string]} contentStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="sla" stroke="#0d9488" strokeWidth={2} dot={{ r: 3, fill: '#0d9488' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Stunden Umsatz */}
        <div>
          <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground mb-2">
            <BarChart3 className="h-3.5 w-3.5" />Stunden-Umsatz vs. Ziel
          </div>
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={d.stunden} barSize={10}>
              <XAxis dataKey="stunde" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number | undefined) => `${v ?? 0} €`} contentStyle={{ fontSize: 11 }} />
              <Bar dataKey="umsatz" fill="#0d9488" radius={[3, 3, 0, 0]}>
                {d.stunden.map((h, i) => (
                  <Cell key={i} fill={h.umsatz >= h.ziel ? '#10b981' : '#f59e0b'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-2 mt-1">
            {topStunden.map((h, i) => (
              <div key={h.stunde} className="flex-1 rounded-lg border border-emerald-200 bg-emerald-50 p-1.5 text-center">
                <div className="text-[10px] font-bold text-emerald-700">#{i + 1} {h.stunde}</div>
                <div className="text-xs font-black text-foreground">{h.umsatz} €</div>
              </div>
            ))}
          </div>
        </div>

        {/* Fahrer Vergleich Matrix */}
        <div>
          <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground mb-2">
            <Users className="h-3.5 w-3.5" />Fahrer-Vergleich-Matrix
          </div>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/30 text-muted-foreground">
                  <th className="text-left px-2 py-1.5 font-semibold text-[10px]">Fahrer</th>
                  <th className="text-center px-1 py-1.5 font-semibold text-[10px]">Score</th>
                  <th className="text-center px-1 py-1.5 font-semibold text-[10px]">Stopps</th>
                  <th className="text-center px-1 py-1.5 font-semibold text-[10px]">Pünktl.</th>
                  <th className="text-center px-1 py-1.5 font-semibold text-[10px]">Δ</th>
                </tr>
              </thead>
              <tbody>
                {d.fahrer.map((f, i) => (
                  <tr key={f.name} className={i % 2 === 0 ? 'bg-white' : 'bg-muted/10'}>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-foreground truncate">{f.name}</span>
                        <span className={`rounded-full px-1 py-0.5 text-[9px] font-bold ${TIER_BADGE[f.tier]}`}>
                          {f.tier[0].toUpperCase()}
                        </span>
                      </div>
                    </td>
                    <td className="text-center px-1 py-1.5 font-black text-foreground">{f.score}</td>
                    <td className="text-center px-1 py-1.5 text-muted-foreground">{f.stopps}</td>
                    <td className="text-center px-1 py-1.5">
                      <span className={f.puenktl >= 90 ? 'text-emerald-600' : f.puenktl >= 75 ? 'text-amber-600' : 'text-red-600'}>
                        {f.puenktl}%
                      </span>
                    </td>
                    <td className="text-center px-1 py-1.5">
                      <span className={`font-semibold ${f.vergleich_delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {f.vergleich_delta >= 0 ? '+' : ''}{f.vergleich_delta}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Zonen SLA */}
        <div>
          <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground mb-2">
            <Route className="h-3.5 w-3.5" />Zonen-SLA
          </div>
          <div className="grid grid-cols-2 gap-2">
            {d.zonen.map((z) => (
              <div key={z.zone} className="rounded-xl border border-border bg-muted/10 p-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-foreground">{z.zone}</span>
                  <span className={`text-xs font-black ${z.sla >= 90 ? 'text-emerald-600' : z.sla >= 80 ? 'text-amber-600' : 'text-red-600'}`}>{z.sla}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted">
                  <div className={`h-1.5 rounded-full ${z.sla >= 90 ? 'bg-emerald-500' : z.sla >= 80 ? 'bg-amber-400' : 'bg-red-500'}`} style={{ width: `${z.sla}%` }} />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>Ø {z.avg_eta} min</span>
                  <span>{(z.umsatz / 1000).toFixed(1)}k €</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
