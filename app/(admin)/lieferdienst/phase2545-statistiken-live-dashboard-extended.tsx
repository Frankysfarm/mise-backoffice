'use client';

/**
 * Phase 2545 — Statistiken Live-Dashboard Extended (Lieferdienst)
 *
 * 10 KPI-Kacheln mit Ampel-Farbkodierung, Stunden-Verlauf-Chart
 * (Bestellungen/Umsatz umschaltbar), Zonen-Ranking, Fahrer-Top-3,
 * Alert-Strip für Storno/Lieferzeit/On-Time/Bewertung.
 * 3-Min-Polling.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BarChart, Bar, Cell, ResponsiveContainer, XAxis, Tooltip } from 'recharts';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, Award, BarChart3, CheckCircle2, Clock, Euro, MapPin, Package, RefreshCw, Star, TrendingDown, TrendingUp, Users,
} from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────────────── */

interface StundenPunkt { stunde: string; bestellungen: number; umsatz: number }
interface ZoneKpi { zone: string; bestellungen: number; umsatz: number; onTime: number }
interface FahrerKpi { name: string; touren: number; score: number; bewertung: number }

interface StatsData {
  bestellungen: number;        umsatz: number
  lieferzeit_avg: number;      on_time_rate: number
  storno_rate: number;         bewertung_avg: number
  aktive_fahrer: number;       touren_heute: number
  umsatz_gestern: number;      bestellungen_gestern: number
  stunden: StundenPunkt[];
  zonen: ZoneKpi[];
  top_fahrer: FahrerKpi[];
}

/* ── Mock ───────────────────────────────────────────────────────────── */

function buildMock(): StatsData {
  const stunden: StundenPunkt[] = Array.from({ length: 12 }, (_, i) => {
    const h = 11 + i;
    const b = h < 12 ? 4 : h < 14 ? 18 : h < 16 ? 11 : h < 19 ? 22 : 14;
    return { stunde: `${h}:00`, bestellungen: b + Math.floor(Math.random() * 4), umsatz: (b + Math.floor(Math.random() * 4)) * 14 };
  });
  return {
    bestellungen: 147, umsatz: 2180, lieferzeit_avg: 26, on_time_rate: 0.87,
    storno_rate: 0.04, bewertung_avg: 4.3, aktive_fahrer: 8, touren_heute: 62,
    umsatz_gestern: 1950, bestellungen_gestern: 131,
    stunden,
    zonen: [
      { zone: 'Mitte', bestellungen: 52, umsatz: 740, onTime: 0.91 },
      { zone: 'Nord',  bestellungen: 38, umsatz: 540, onTime: 0.85 },
      { zone: 'Süd',   bestellungen: 34, umsatz: 490, onTime: 0.82 },
      { zone: 'West',  bestellungen: 23, umsatz: 410, onTime: 0.88 },
    ],
    top_fahrer: [
      { name: 'Felix H.', touren: 12, score: 94, bewertung: 4.8 },
      { name: 'Sara M.',  touren: 10, score: 88, bewertung: 4.6 },
      { name: 'Jan K.',   touren: 9,  score: 82, bewertung: 4.4 },
    ],
  };
}

/* ── Helpers ────────────────────────────────────────────────────────── */

type Ampel = 'gruen' | 'gelb' | 'rot';

function ampelBg(a: Ampel): string {
  return a === 'gruen' ? 'bg-matcha-50 dark:bg-matcha-950/30 border-matcha-200 dark:border-matcha-800'
    : a === 'gelb'  ? 'bg-amber-50  dark:bg-amber-950/30  border-amber-200  dark:border-amber-800'
    : 'bg-red-50    dark:bg-red-950/30    border-red-200    dark:border-red-800';
}

function ampelText(a: Ampel): string {
  return a === 'gruen' ? 'text-matcha-700 dark:text-matcha-300'
    : a === 'gelb'  ? 'text-amber-700  dark:text-amber-300'
    : 'text-red-700    dark:text-red-300';
}

interface KpiDef { label: string; value: string; ampel: Ampel; icon: React.ReactNode; trend?: string; trendUp?: boolean }

function buildKpis(d: StatsData): KpiDef[] {
  const bestellDelta = d.bestellungen - d.bestellungen_gestern;
  const umsatzDelta = d.umsatz - d.umsatz_gestern;
  return [
    {
      label: 'Bestellungen',
      value: String(d.bestellungen),
      ampel: d.bestellungen >= d.bestellungen_gestern * 0.9 ? 'gruen' : 'gelb',
      icon: <Package className="h-4 w-4" />,
      trend: `${bestellDelta >= 0 ? '+' : ''}${bestellDelta} vs. gestern`,
      trendUp: bestellDelta >= 0,
    },
    {
      label: 'Umsatz',
      value: `€${d.umsatz.toLocaleString('de-DE')}`,
      ampel: d.umsatz >= d.umsatz_gestern * 0.9 ? 'gruen' : 'gelb',
      icon: <Euro className="h-4 w-4" />,
      trend: `${umsatzDelta >= 0 ? '+€' : '-€'}${Math.abs(umsatzDelta).toLocaleString('de-DE')}`,
      trendUp: umsatzDelta >= 0,
    },
    {
      label: 'Ø Lieferzeit',
      value: `${d.lieferzeit_avg} min`,
      ampel: d.lieferzeit_avg <= 25 ? 'gruen' : d.lieferzeit_avg <= 35 ? 'gelb' : 'rot',
      icon: <Clock className="h-4 w-4" />,
    },
    {
      label: 'On-Time-Rate',
      value: `${Math.round(d.on_time_rate * 100)}%`,
      ampel: d.on_time_rate >= 0.9 ? 'gruen' : d.on_time_rate >= 0.75 ? 'gelb' : 'rot',
      icon: <CheckCircle2 className="h-4 w-4" />,
    },
    {
      label: 'Storno-Rate',
      value: `${(d.storno_rate * 100).toFixed(1)}%`,
      ampel: d.storno_rate <= 0.05 ? 'gruen' : d.storno_rate <= 0.1 ? 'gelb' : 'rot',
      icon: <AlertTriangle className="h-4 w-4" />,
    },
    {
      label: 'Bewertung Ø',
      value: `${d.bewertung_avg.toFixed(1)} ★`,
      ampel: d.bewertung_avg >= 4.2 ? 'gruen' : d.bewertung_avg >= 3.5 ? 'gelb' : 'rot',
      icon: <Star className="h-4 w-4" />,
    },
    {
      label: 'Aktive Fahrer',
      value: String(d.aktive_fahrer),
      ampel: d.aktive_fahrer >= 6 ? 'gruen' : d.aktive_fahrer >= 3 ? 'gelb' : 'rot',
      icon: <Users className="h-4 w-4" />,
    },
    {
      label: 'Touren heute',
      value: String(d.touren_heute),
      ampel: 'gruen',
      icon: <BarChart3 className="h-4 w-4" />,
    },
  ];
}

interface Props {
  locationId?: string | null;
}

export function LieferdienstPhase2545StatistikenLiveDashboardExtended({ locationId }: Props) {
  const supabase = createClient();
  const [data, setData] = useState<StatsData>(buildMock());
  const [loading, setLoading] = useState(false);
  const [chartMode, setChartMode] = useState<'bestellungen' | 'umsatz'>('bestellungen');
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  const load = useCallback(async () => {
    setLoading(true);
    // In production: fetch from supabase. For now use mock.
    setData(buildMock());
    setLoading(false);
  }, [locationId]); // eslint-disable-line

  useEffect(() => { load(); pollRef.current = setInterval(load, 3 * 60_000); return () => clearInterval(pollRef.current); }, [load]);

  const kpis = buildKpis(data);
  const alerts: string[] = [];
  if (data.storno_rate > 0.1) alerts.push(`Storno-Rate ${(data.storno_rate * 100).toFixed(1)}% — kritisch`);
  if (data.lieferzeit_avg > 35) alerts.push(`Lieferzeit ${data.lieferzeit_avg} min — zu hoch`);
  if (data.on_time_rate < 0.75) alerts.push(`On-Time-Rate ${Math.round(data.on_time_rate * 100)}% — unterdurchschnittlich`);
  if (data.bewertung_avg < 3.5) alerts.push(`Bewertung ${data.bewertung_avg.toFixed(1)}★ — Handlungsbedarf`);

  const maxChart = Math.max(...data.stunden.map(s => chartMode === 'bestellungen' ? s.bestellungen : s.umsatz), 1);

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary shrink-0" />
          <h3 className="text-sm font-semibold text-foreground">Statistiken Live-Dashboard</h3>
        </div>
        <div className="flex items-center gap-2">
          {loading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          <span className="text-[10px] text-muted-foreground">3-Min-Update</span>
        </div>
      </div>

      {/* Alert Strip */}
      {alerts.length > 0 && (
        <div className="space-y-1">
          {alerts.map(a => (
            <div key={a} className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
              <span className="text-xs font-medium text-red-700 dark:text-red-400">{a}</span>
            </div>
          ))}
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-4 gap-2">
        {kpis.map(k => (
          <div key={k.label} className={cn('rounded-lg border px-2.5 py-2 text-center', ampelBg(k.ampel))}>
            <div className={cn('flex justify-center mb-1', ampelText(k.ampel))}>{k.icon}</div>
            <div className={cn('text-sm font-black leading-none mb-0.5', ampelText(k.ampel))}>{k.value}</div>
            <div className="text-[9px] text-muted-foreground leading-snug">{k.label}</div>
            {k.trend && (
              <div className={cn('flex items-center justify-center gap-0.5 text-[9px] mt-0.5', k.trendUp ? 'text-matcha-600' : 'text-red-500')}>
                {k.trendUp ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                {k.trend}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Stunden-Chart */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-foreground">Stundenverlauf</span>
          <div className="flex rounded-lg overflow-hidden border border-border">
            {(['bestellungen', 'umsatz'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setChartMode(mode)}
                className={cn('px-2.5 py-1 text-[10px] font-medium transition-colors',
                  chartMode === mode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}
              >
                {mode === 'bestellungen' ? 'Bestellungen' : 'Umsatz €'}
              </button>
            ))}
          </div>
        </div>
        <div className="h-20">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.stunden} margin={{ top: 2, right: 2, bottom: 0, left: 2 }}>
              <XAxis dataKey="stunde" tick={{ fontSize: 8 }} tickLine={false} axisLine={false} interval={1} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 6 }}
                formatter={((v: number) => [chartMode === 'umsatz' ? `€${v}` : v, chartMode === 'bestellungen' ? 'Bestellungen' : 'Umsatz']) as any}
              />
              <Bar dataKey={chartMode} radius={[2, 2, 0, 0]}>
                {data.stunden.map((_, i) => {
                  const v = chartMode === 'bestellungen' ? data.stunden[i].bestellungen : data.stunden[i].umsatz;
                  const pct = v / maxChart;
                  const color = pct > 0.8 ? '#ef4444' : pct > 0.5 ? '#f59e0b' : '#6a9e5f';
                  return <Cell key={i} fill={color} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Zonen-Ranking */}
      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground">Zonen-Ranking</span>
        </div>
        <div className="space-y-1">
          {data.zonen.map((z, i) => (
            <div key={z.zone} className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-3 shrink-0">{i + 1}.</span>
              <span className="text-xs font-medium text-foreground w-14 truncate shrink-0">{z.zone}</span>
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-matcha-500 transition-all"
                  style={{ width: `${Math.round((z.bestellungen / (data.zonen[0]?.bestellungen || 1)) * 100)}%` }} />
              </div>
              <span className="text-[10px] text-muted-foreground w-8 text-right shrink-0">{z.bestellungen}</span>
              <span className={cn('text-[10px] w-10 text-right shrink-0', z.onTime >= 0.9 ? 'text-matcha-600' : z.onTime >= 0.8 ? 'text-amber-600' : 'text-red-500')}>
                {Math.round(z.onTime * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Fahrer Top-3 */}
      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <Award className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground">Fahrer Top-3</span>
        </div>
        <div className="space-y-1">
          {data.top_fahrer.map((f, i) => (
            <div key={f.name} className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-3 shrink-0">{i + 1}.</span>
              <span className="text-xs font-medium text-foreground flex-1 truncate">{f.name}</span>
              <span className="text-[10px] text-muted-foreground">{f.touren} Touren</span>
              <span className={cn('text-[10px] font-semibold', f.score >= 80 ? 'text-matcha-600' : f.score >= 60 ? 'text-amber-600' : 'text-red-500')}>
                Score {f.score}
              </span>
              <span className="text-[10px] text-yellow-500">{f.bewertung.toFixed(1)}★</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
