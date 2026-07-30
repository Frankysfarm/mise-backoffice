'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, YAxis } from 'recharts';
import { TrendingUp, TrendingDown, Users, Euro, Clock, Target, Zap, AlertTriangle, CheckCircle2, Star, Route, MapPin } from 'lucide-react';

// Phase 5030 — Statistiken Dashboard V24
// 8-KPI-Grid + Stunden-BarChart + Fahrer-Top-3 + Zonen-Matrix + Woche-Trend-LineChart
// 30-Sek-Polling; Mock-Fallback

interface StundenData {
  stunde: string;
  bestellungen: number;
  umsatz: number;
  ziel: number;
}

interface WochenTrend {
  tag: string;
  umsatz: number;
  bestellungen: number;
}

interface FahrerKpi {
  name: string;
  score: number;
  stopps: number;
  puenktl_pct: number;
  umsatz: number;
  trinkgeld: number;
  tier: 'platin' | 'gold' | 'gut';
}

interface ZonenStat {
  zone: string;
  bestellungen: number;
  avg_eta: number;
  kapazitaet_pct: number;
  sla_pct: number;
}

interface ApiData {
  kpis: {
    umsatz_heute: number;
    umsatz_delta_pct: number;
    bestellungen_heute: number;
    bestellungen_delta: number;
    aktive_fahrer: number;
    avg_lieferzeit_min: number;
    puenktlichkeit_pct: number;
    storno_quote_pct: number;
    kundenbewertung: number;
    trinkgeld_heute: number;
    profit_heute: number;
    co2_kg: number;
  };
  stunden: StundenData[];
  woche: WochenTrend[];
  fahrer_top: FahrerKpi[];
  zonen: ZonenStat[];
  alert: string | null;
}

const STUNDEN_MOCK: StundenData[] = [
  { stunde: '11h', bestellungen: 5, umsatz: 102, ziel: 90 },
  { stunde: '12h', bestellungen: 13, umsatz: 271, ziel: 220 },
  { stunde: '13h', bestellungen: 16, umsatz: 334, ziel: 300 },
  { stunde: '14h', bestellungen: 9, umsatz: 188, ziel: 200 },
  { stunde: '15h', bestellungen: 6, umsatz: 123, ziel: 130 },
  { stunde: '16h', bestellungen: 8, umsatz: 167, ziel: 150 },
  { stunde: '17h', bestellungen: 14, umsatz: 293, ziel: 260 },
  { stunde: '18h', bestellungen: 20, umsatz: 418, ziel: 340 },
  { stunde: '19h', bestellungen: 23, umsatz: 482, ziel: 400 },
  { stunde: '20h', bestellungen: 18, umsatz: 377, ziel: 320 },
];

const WOCHE_MOCK: WochenTrend[] = [
  { tag: 'Mo', umsatz: 1840, bestellungen: 88 },
  { tag: 'Di', umsatz: 2100, bestellungen: 101 },
  { tag: 'Mi', umsatz: 1960, bestellungen: 94 },
  { tag: 'Do', umsatz: 2350, bestellungen: 112 },
  { tag: 'Fr', umsatz: 2780, bestellungen: 133 },
  { tag: 'Sa', umsatz: 3120, bestellungen: 149 },
  { tag: 'So', umsatz: 2486, bestellungen: 119 },
];

const MOCK: ApiData = {
  kpis: {
    umsatz_heute: 2486, umsatz_delta_pct: 12.4,
    bestellungen_heute: 119, bestellungen_delta: 7,
    aktive_fahrer: 6,
    avg_lieferzeit_min: 27, puenktlichkeit_pct: 91,
    storno_quote_pct: 2.1, kundenbewertung: 4.8,
    trinkgeld_heute: 148, profit_heute: 612, co2_kg: 18,
  },
  stunden: STUNDEN_MOCK,
  woche: WOCHE_MOCK,
  fahrer_top: [
    { name: 'Jonas M.',  score: 96, stopps: 16, puenktl_pct: 98, umsatz: 192, trinkgeld: 24, tier: 'platin' },
    { name: 'Anna B.',   score: 90, stopps: 13, puenktl_pct: 93, umsatz: 158, trinkgeld: 18, tier: 'gold'   },
    { name: 'Sara K.',   score: 87, stopps: 12, puenktl_pct: 90, umsatz: 143, trinkgeld: 15, tier: 'gut'    },
  ],
  zonen: [
    { zone: 'Mitte', bestellungen: 46, avg_eta: 24, kapazitaet_pct: 80, sla_pct: 95 },
    { zone: 'Nord',  bestellungen: 31, avg_eta: 30, kapazitaet_pct: 65, sla_pct: 88 },
    { zone: 'Süd',   bestellungen: 28, avg_eta: 28, kapazitaet_pct: 72, sla_pct: 84 },
    { zone: 'West',  bestellungen: 14, avg_eta: 36, kapazitaet_pct: 48, sla_pct: 74 },
  ],
  alert: null,
};

const TIER_BADGE: Record<FahrerKpi['tier'], string> = {
  platin: 'bg-slate-700 text-white',
  gold:   'bg-amber-500 text-white',
  gut:    'bg-green-600 text-white',
};

export function LieferdienstPhase5030StatistikenDashboardV24({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'stunden' | 'woche'>('stunden');

  async function fetchData() {
    try {
      const params = locationId ? `?locationId=${locationId}` : '';
      const r = await fetch(`/api/delivery/admin/analytics${params}`, { cache: 'no-store' });
      if (!r.ok) throw new Error('api');
      setData(await r.json());
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 30_000);
    return () => clearInterval(t);
  }, [locationId]);

  const d = data ?? MOCK;
  const k = d.kpis;

  const kpiRows = [
    { label: 'Umsatz heute',  val: `${(k.umsatz_heute / 1000).toFixed(1)}k €`, delta: k.umsatz_delta_pct, icon: <Euro className="h-4 w-4 text-emerald-600" /> },
    { label: 'Bestellungen',  val: k.bestellungen_heute,                        delta: k.bestellungen_delta, icon: <Route className="h-4 w-4 text-indigo-600" /> },
    { label: 'Ø Lieferzeit',  val: `${k.avg_lieferzeit_min} min`,               delta: null,               icon: <Clock className="h-4 w-4 text-amber-500" /> },
    { label: 'Pünktlichkeit', val: `${k.puenktlichkeit_pct}%`,                  delta: null,               icon: <Target className="h-4 w-4 text-green-600" /> },
    { label: 'Aktive Fahrer', val: k.aktive_fahrer,                             delta: null,               icon: <Users className="h-4 w-4 text-violet-600" /> },
    { label: 'Kundenwertung', val: `${k.kundenbewertung} ★`,                    delta: null,               icon: <Star className="h-4 w-4 text-amber-400" /> },
    { label: 'Trinkgeld',     val: `${k.trinkgeld_heute} €`,                    delta: null,               icon: <Zap className="h-4 w-4 text-teal-600" /> },
    { label: 'Storno-Quote',  val: `${k.storno_quote_pct}%`,                    delta: null, warn: k.storno_quote_pct > 4, icon: <AlertTriangle className="h-4 w-4 text-red-500" /> },
  ];

  return (
    <div className="rounded-2xl border border-emerald-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-emerald-700 text-white">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-300" />
          <span className="font-bold text-sm">Statistiken V24</span>
        </div>
        <div className="text-xs opacity-80">Heute · Live</div>
      </div>

      {d.alert && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-b border-red-200 text-red-700 text-xs font-medium">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {d.alert}
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* KPI Grid */}
        <div className="grid grid-cols-4 gap-2">
          {kpiRows.map((row) => (
            <div key={row.label} className={`rounded-xl border p-3 ${row.warn ? 'border-red-200 bg-red-50' : 'border-border bg-muted/20'}`}>
              <div className="flex items-center gap-1 mb-1">{row.icon}</div>
              <div className={`font-black text-base ${row.warn ? 'text-red-600' : 'text-foreground'}`}>{row.val}</div>
              <div className="text-[10px] text-muted-foreground">{row.label}</div>
              {row.delta != null && (
                <div className={`text-[10px] font-semibold flex items-center gap-0.5 mt-0.5 ${row.delta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {row.delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {row.delta > 0 ? '+' : ''}{row.delta}{typeof row.delta === 'number' && row.delta % 1 !== 0 ? '' : ''}
                  {row.label.includes('Umsatz') ? '%' : ''}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Chart Tabs */}
        <div>
          <div className="flex gap-2 mb-2">
            {(['stunden', 'woche'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${tab === t ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
              >
                {t === 'stunden' ? 'Heute stündlich' : '7-Tage-Trend'}
              </button>
            ))}
          </div>
          <div className="h-36">
            {tab === 'stunden' ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.stunden} barGap={2}>
                  <XAxis dataKey="stunde" tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v, n) => [n === 'umsatz' ? `${v} €` : v, n === 'umsatz' ? 'Umsatz' : 'Bestellungen']} />
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
                  <XAxis dataKey="tag" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={35} />
                  <Tooltip formatter={(v) => [`${v} €`, 'Umsatz']} />
                  <Line dataKey="umsatz" stroke="#059669" strokeWidth={2} dot={{ r: 3, fill: '#059669' }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top Drivers */}
        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />Top Fahrer
          </div>
          <div className="space-y-1.5">
            {d.fahrer_top.map((f, i) => (
              <div key={f.name} className="flex items-center gap-3 rounded-lg bg-muted/20 border border-border px-3 py-2">
                <span className="text-sm font-black text-muted-foreground w-4">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm truncate">{f.name}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${TIER_BADGE[f.tier]}`}>{f.tier.charAt(0).toUpperCase() + f.tier.slice(1)}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">{f.stopps} Stopps · {f.puenktl_pct}% pünktl. · {f.trinkgeld} € Trinkgeld</div>
                </div>
                <div className={`text-sm font-black ${f.score >= 90 ? 'text-emerald-600' : f.score >= 75 ? 'text-amber-600' : 'text-red-600'}`}>
                  {f.score}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Zone Matrix */}
        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />Zonen-Performance
          </div>
          <div className="grid grid-cols-4 gap-2">
            {d.zonen.map((z) => (
              <div key={z.zone} className="rounded-lg border border-border bg-muted/20 p-2 text-center">
                <div className="text-xs font-bold text-muted-foreground">{z.zone}</div>
                <div className={`text-sm font-black mt-1 ${z.sla_pct >= 90 ? 'text-emerald-600' : z.sla_pct >= 80 ? 'text-amber-600' : 'text-red-600'}`}>
                  {z.sla_pct}%
                </div>
                <div className="text-[10px] text-muted-foreground">{z.avg_eta} min</div>
                <div className="mt-1 h-1 rounded-full bg-muted">
                  <div className="h-1 rounded-full bg-emerald-500" style={{ width: `${z.kapazitaet_pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
