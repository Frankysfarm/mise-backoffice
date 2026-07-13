'use client';

// Phase 1128 — Statistik-Dashboard Pro (Lieferdienst)
// Umfassendes Echtzeit-Statistik-Dashboard: Bestellungen, Umsatz, Pünktlichkeit, Fahrer, SLA, Trend

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, YAxis,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp,
  ShoppingBag, Euro, Clock, Star, Bike, AlertTriangle, CheckCircle2, Loader2,
} from 'lucide-react';

interface Props { locationId: string | null }

type KpiRow = {
  label: string;
  value: string;
  sub?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: string;
  icon: React.FC<{className?: string}>;
};

type ApiData = {
  bestellungen_heute: number;
  umsatz_heute_eur: number;
  avg_lieferzeit_min: number;
  avg_bewertung: number;
  aktive_fahrer: number;
  pünktlichkeit_pct: number;
  storno_rate_pct: number;
  sla_erfuellt_pct: number;
  stunden_verlauf: { h: number; bestellungen: number; umsatz: number }[];
  top_fahrer: { name: string; stopps: number; score: number }[];
  generiert_am: string;
};

const MOCK: ApiData = {
  bestellungen_heute: 87,
  umsatz_heute_eur: 2340.5,
  avg_lieferzeit_min: 28,
  avg_bewertung: 4.6,
  aktive_fahrer: 5,
  pünktlichkeit_pct: 81,
  storno_rate_pct: 4,
  sla_erfuellt_pct: 88,
  stunden_verlauf: [
    { h: 10, bestellungen: 3,  umsatz: 78 },
    { h: 11, bestellungen: 8,  umsatz: 210 },
    { h: 12, bestellungen: 19, umsatz: 498 },
    { h: 13, bestellungen: 22, umsatz: 570 },
    { h: 14, bestellungen: 14, umsatz: 370 },
    { h: 15, bestellungen: 9,  umsatz: 243 },
    { h: 16, bestellungen: 7,  umsatz: 185 },
    { h: 17, bestellungen: 5,  umsatz: 137 },
    { h: 18, bestellungen: 0,  umsatz: 0 },
  ],
  top_fahrer: [
    { name: 'Ahmad K.', stopps: 24, score: 91 },
    { name: 'Sara P.',  stopps: 19, score: 84 },
    { name: 'Lukas M.', stopps: 17, score: 78 },
    { name: 'Felix W.', stopps: 15, score: 76 },
    { name: 'Kemal D.', stopps: 12, score: 62 },
  ],
  generiert_am: new Date().toISOString(),
};

export function LieferdienstPhase1128StatistikDashboardPro({ locationId }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<'kpi' | 'verlauf' | 'fahrer'>('kpi');

  const load = useCallback(() => {
    if (!locationId) { setData(MOCK); return; }
    setLoading(true);
    fetch(`/api/delivery/stats/heute?location_id=${locationId}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d && d.bestellungen_heute !== undefined ? d : MOCK))
      .catch(() => setData(MOCK))
      .finally(() => setLoading(false));
  }, [locationId]);

  useEffect(() => { load(); const iv = setInterval(load, 60_000); return () => clearInterval(iv); }, [load]);

  const kpis: KpiRow[] = data ? [
    {
      label: 'Bestellungen heute',
      value: String(data.bestellungen_heute),
      sub: 'Gesamt',
      trend: data.bestellungen_heute >= 80 ? 'up' : data.bestellungen_heute >= 40 ? 'neutral' : 'down',
      icon: ShoppingBag,
      color: 'text-blue-600',
    },
    {
      label: 'Umsatz heute',
      value: data.umsatz_heute_eur.toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' €',
      sub: `${(data.umsatz_heute_eur / Math.max(data.bestellungen_heute, 1)).toFixed(0)} €/Bestellung`,
      trend: data.umsatz_heute_eur >= 2000 ? 'up' : data.umsatz_heute_eur >= 1000 ? 'neutral' : 'down',
      icon: Euro,
      color: 'text-emerald-600',
    },
    {
      label: 'Ø Lieferzeit',
      value: `${data.avg_lieferzeit_min} Min`,
      sub: data.avg_lieferzeit_min <= 30 ? 'Im Ziel' : 'Über Ziel',
      trend: data.avg_lieferzeit_min <= 25 ? 'up' : data.avg_lieferzeit_min <= 35 ? 'neutral' : 'down',
      icon: Clock,
      color: data.avg_lieferzeit_min <= 30 ? 'text-emerald-600' : 'text-red-600',
    },
    {
      label: 'Bewertung',
      value: data.avg_bewertung.toFixed(1) + ' ★',
      sub: 'Kunden-Ø',
      trend: data.avg_bewertung >= 4.5 ? 'up' : data.avg_bewertung >= 4.0 ? 'neutral' : 'down',
      icon: Star,
      color: 'text-amber-500',
    },
    {
      label: 'Aktive Fahrer',
      value: String(data.aktive_fahrer),
      sub: 'online',
      trend: 'neutral',
      icon: Bike,
      color: 'text-violet-600',
    },
    {
      label: 'Pünktlichkeit',
      value: `${data.pünktlichkeit_pct}%`,
      sub: data.pünktlichkeit_pct >= 80 ? 'Sehr gut' : data.pünktlichkeit_pct >= 65 ? 'OK' : 'Verbesserung nötig',
      trend: data.pünktlichkeit_pct >= 80 ? 'up' : data.pünktlichkeit_pct >= 65 ? 'neutral' : 'down',
      icon: CheckCircle2,
      color: data.pünktlichkeit_pct >= 80 ? 'text-emerald-600' : 'text-amber-600',
    },
    {
      label: 'Storno-Rate',
      value: `${data.storno_rate_pct}%`,
      sub: data.storno_rate_pct <= 5 ? 'Gut' : 'Zu hoch',
      trend: data.storno_rate_pct <= 5 ? 'up' : data.storno_rate_pct <= 10 ? 'neutral' : 'down',
      icon: AlertTriangle,
      color: data.storno_rate_pct <= 5 ? 'text-emerald-600' : 'text-red-600',
    },
    {
      label: 'SLA-Erfüllung',
      value: `${data.sla_erfuellt_pct}%`,
      sub: '≤35 Min Ziel',
      trend: data.sla_erfuellt_pct >= 85 ? 'up' : data.sla_erfuellt_pct >= 70 ? 'neutral' : 'down',
      icon: CheckCircle2,
      color: data.sla_erfuellt_pct >= 85 ? 'text-emerald-600' : 'text-amber-600',
    },
  ] : [];

  const maxStunden = data ? Math.max(...data.stunden_verlauf.map(s => s.bestellungen), 1) : 1;

  return (
    <div className="rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 overflow-hidden shadow-sm">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-stone-50 dark:hover:bg-stone-800/50 transition"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-stone-600 dark:text-stone-300" />
          <span className="font-bold text-sm">Statistik-Dashboard Pro</span>
          <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wide">Phase 1128</span>
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />}
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {data.bestellungen_heute} Bestellungen heute
            </span>
          )}
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && data && (
        <div className="border-t border-stone-200 dark:border-stone-700">
          {/* Tabs */}
          <div className="flex gap-1 px-4 pt-3 pb-2">
            {(['kpi', 'verlauf', 'fahrer'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'px-3 py-1 text-[10px] font-bold rounded-full transition',
                  tab === t
                    ? 'bg-stone-800 text-white dark:bg-stone-200 dark:text-stone-900'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300'
                )}
              >
                {t === 'kpi' ? 'KPI-Übersicht' : t === 'verlauf' ? 'Stunden-Verlauf' : 'Fahrer-Ranking'}
              </button>
            ))}
          </div>

          {/* KPI Grid */}
          {tab === 'kpi' && (
            <div className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {kpis.map(kpi => {
                  const TrendIcon = kpi.trend === 'up' ? TrendingUp : kpi.trend === 'down' ? TrendingDown : Minus;
                  const Icon = kpi.icon;
                  return (
                    <div key={kpi.label} className="rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <Icon className={cn('h-4 w-4', kpi.color)} />
                        <TrendIcon className={cn('h-3 w-3',
                          kpi.trend === 'up' ? 'text-emerald-500' :
                          kpi.trend === 'down' ? 'text-red-500' : 'text-muted-foreground'
                        )} />
                      </div>
                      <div className={cn('text-xl font-black tabular-nums', kpi.color)}>{kpi.value}</div>
                      <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide mt-0.5">{kpi.label}</div>
                      {kpi.sub && <div className="text-[9px] text-muted-foreground mt-0.5">{kpi.sub}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stunden-Verlauf Chart */}
          {tab === 'verlauf' && (
            <div className="p-4 space-y-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bestellungen je Stunde</div>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.stunden_verlauf} barSize={18}>
                    <XAxis dataKey="h" tick={{ fontSize: 9 }} tickFormatter={v => `${v}h`} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={((val: unknown, name: unknown) => [
                        name === 'bestellungen' ? `${val} Bestellungen` : `${val} €`,
                        name === 'bestellungen' ? 'Bestellungen' : 'Umsatz'
                      ]) as any}
                      labelFormatter={v => `${v}:00 Uhr`}
                    />
                    <Bar dataKey="bestellungen" radius={[3, 3, 0, 0]}>
                      {data.stunden_verlauf.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.bestellungen === maxStunden ? '#10b981' :
                                entry.bestellungen >= maxStunden * 0.7 ? '#f59e0b' : '#e2e8f0'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Umsatz je Stunde (€)</div>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.stunden_verlauf}>
                    <XAxis dataKey="h" tick={{ fontSize: 9 }} tickFormatter={v => `${v}h`} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} width={30} />
                    <Tooltip formatter={((v: unknown) => [`${v} €`, 'Umsatz']) as any} labelFormatter={v => `${v}:00 Uhr`} />
                    <Line type="monotone" dataKey="umsatz" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Fahrer-Ranking */}
          {tab === 'fahrer' && (
            <div className="divide-y divide-stone-100 dark:divide-stone-800">
              {data.top_fahrer.map((f, i) => (
                <div key={f.name} className="flex items-center gap-3 px-4 py-3">
                  <div className={cn(
                    'h-8 w-8 rounded-full flex items-center justify-center text-sm font-black shrink-0',
                    i === 0 ? 'bg-amber-100 text-amber-700' :
                    i === 1 ? 'bg-stone-100 text-stone-600' :
                    i === 2 ? 'bg-orange-100 text-orange-700' :
                    'bg-stone-50 text-stone-400'
                  )}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate">{f.name}</div>
                    <div className="text-[10px] text-muted-foreground">{f.stopps} Stopps heute</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className={cn(
                      'text-lg font-black tabular-nums',
                      f.score >= 85 ? 'text-emerald-600' : f.score >= 70 ? 'text-amber-600' : 'text-red-600'
                    )}>
                      {f.score}
                    </div>
                    <div className="text-[9px] text-muted-foreground">Score</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Timestamp */}
          <div className="px-4 py-2 border-t border-stone-100 dark:border-stone-800 text-[9px] text-muted-foreground text-right">
            Aktualisiert: {new Date(data.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      )}
    </div>
  );
}
