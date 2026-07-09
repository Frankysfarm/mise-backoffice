'use client';

/**
 * Phase 990 — Statistiken-Executive-Hub (Lieferdienst)
 *
 * Konsolidiertes Statistik-Dashboard für den Lieferdienst-Überblick:
 * - 6 Kern-KPIs mit Trend vs. Vortag (Umsatz, Bestellungen, Lieferzeit, Pünktlichkeit, Storno, Bewertung)
 * - 7-Tage-Trendlinie je KPI (Minibar)
 * - Top-3 Fahrer nach Score heute
 * - Stunden-Durchsatz als Balkendiagramm (letzte 8h)
 * - Polling: 90s
 */

import { useCallback, useEffect, useState } from 'react';
import { cn, euro } from '@/lib/utils';
import {
  TrendingUp, TrendingDown, Minus,
  Euro, Package, Clock, Target, XCircle, Star,
  ChevronDown, ChevronUp, Loader2, Trophy,
} from 'lucide-react';
import { BarChart, Bar, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface KpiRow {
  label: string;
  value: string;
  delta: number;
  unit: string;
  trend7d: number[];
  Icon: React.ElementType;
  good: 'up' | 'down';
}

interface DriverRank {
  name: string;
  score: number;
  deliveries: number;
}

interface HourBucket {
  hour: string;
  orders: number;
}

interface Stats {
  kpis: {
    umsatz: number; umsatz_delta: number; umsatz_7d: number[];
    bestellungen: number; bestellungen_delta: number; bestellungen_7d: number[];
    lieferzeit: number; lieferzeit_delta: number; lieferzeit_7d: number[];
    puenktlichkeit: number; puenktlichkeit_delta: number; puenktlichkeit_7d: number[];
    storno: number; storno_delta: number; storno_7d: number[];
    bewertung: number; bewertung_delta: number; bewertung_7d: number[];
  };
  top_fahrer: DriverRank[];
  stunden: HourBucket[];
}

const MOCK: Stats = {
  kpis: {
    umsatz: 3840, umsatz_delta: 12.4, umsatz_7d: [2900,3100,3300,2800,3500,3700,3840],
    bestellungen: 127, bestellungen_delta: 8.2, bestellungen_7d: [95,102,110,89,115,121,127],
    lieferzeit: 28, lieferzeit_delta: -3.1, lieferzeit_7d: [32,30,29,33,28,27,28],
    puenktlichkeit: 84, puenktlichkeit_delta: 2.1, puenktlichkeit_7d: [78,80,82,79,83,82,84],
    storno: 3.2, storno_delta: -0.8, storno_7d: [5.1,4.8,4.2,5.0,3.9,3.5,3.2],
    bewertung: 4.7, bewertung_delta: 0.1, bewertung_7d: [4.4,4.5,4.5,4.6,4.6,4.7,4.7],
  },
  top_fahrer: [
    { name: 'M. Bauer', score: 94, deliveries: 18 },
    { name: 'L. Huber', score: 88, deliveries: 15 },
    { name: 'K. Stein', score: 81, deliveries: 12 },
  ],
  stunden: [
    { hour: '11', orders: 8 }, { hour: '12', orders: 22 }, { hour: '13', orders: 19 },
    { hour: '14', orders: 11 }, { hour: '15', orders: 7 }, { hour: '16', orders: 9 },
    { hour: '17', orders: 16 }, { hour: '18', orders: 26 },
  ],
};

interface Props { locationId: string | null }

function Trend({ delta, good }: { delta: number; good: 'up' | 'down' }) {
  const isGood = good === 'up' ? delta > 0 : delta < 0;
  const isNeutral = delta === 0;
  if (isNeutral) return <Minus className="h-3 w-3 text-muted-foreground" />;
  const Icon = delta > 0 ? TrendingUp : TrendingDown;
  return (
    <div className={cn('flex items-center gap-0.5 text-[10px] font-bold',
      isGood ? 'text-matcha-600 dark:text-matcha-400' : 'text-red-600 dark:text-red-400',
    )}>
      <Icon className="h-3 w-3" />
      {Math.abs(delta).toFixed(1)}%
    </div>
  );
}

function MiniBar({ data7d }: { data7d: number[] }) {
  const max = Math.max(...data7d, 1);
  return (
    <div className="flex items-end gap-0.5 h-6">
      {data7d.map((v, i) => (
        <div
          key={i}
          className={cn('flex-1 rounded-sm', i === data7d.length - 1 ? 'bg-matcha-500' : 'bg-muted-foreground/20')}
          style={{ height: `${Math.max(15, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

export function LieferdienstPhase990StatistikenExecutiveHub({ locationId }: Props) {
  const [data, setData] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    try {
      const url = locationId
        ? `/api/delivery/stats/executive?location_id=${locationId}`
        : '/api/delivery/stats/executive';
      const r = await fetch(url);
      if (r.ok) { setData(await r.json()); return; }
    } catch {}
    setData(MOCK);
  }, [locationId]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
    const t = setInterval(load, 90_000);
    return () => clearInterval(t);
  }, [load]);

  const d = data?.kpis;

  const kpis: KpiRow[] = d ? [
    { label: 'Umsatz heute', value: euro(d.umsatz), delta: d.umsatz_delta, unit: '%', trend7d: d.umsatz_7d, Icon: Euro, good: 'up' },
    { label: 'Bestellungen', value: String(d.bestellungen), delta: d.bestellungen_delta, unit: '%', trend7d: d.bestellungen_7d, Icon: Package, good: 'up' },
    { label: 'Lieferzeit Ø', value: `${d.lieferzeit} Min`, delta: d.lieferzeit_delta, unit: ' Min', trend7d: d.lieferzeit_7d, Icon: Clock, good: 'down' },
    { label: 'Pünktlichkeit', value: `${d.puenktlichkeit}%`, delta: d.puenktlichkeit_delta, unit: '%', trend7d: d.puenktlichkeit_7d, Icon: Target, good: 'up' },
    { label: 'Stornoquote', value: `${d.storno}%`, delta: d.storno_delta, unit: '%', trend7d: d.storno_7d, Icon: XCircle, good: 'down' },
    { label: 'Bewertung Ø', value: `${d.bewertung.toFixed(1)} ★`, delta: d.bewertung_delta, unit: '', trend7d: d.bewertung_7d, Icon: Star, good: 'up' },
  ] : [];

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Statistiken Executive Hub
          </span>
          {!loading && data && (
            <span className="rounded-full bg-matcha-100 dark:bg-matcha-800 px-2 py-0.5 text-[10px] font-bold text-matcha-700 dark:text-matcha-200">
              {data.kpis.bestellungen} Best. · {euro(data.kpis.umsatz)}
            </span>
          )}
        </div>
        {loading
          ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          : open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />
        }
      </button>

      {open && data && (
        <div className="border-t p-4 space-y-4">
          {/* KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {kpis.map(k => {
              const Icon = k.Icon;
              return (
                <div key={k.label} className="rounded-xl border bg-muted/20 p-3 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">{k.label}</span>
                  </div>
                  <div className="flex items-end gap-2">
                    <span className="text-xl font-black leading-none tabular-nums">{k.value}</span>
                    <Trend delta={k.delta} good={k.good} />
                  </div>
                  <MiniBar data7d={k.trend7d} />
                </div>
              );
            })}
          </div>

          {/* Stunden-Durchsatz */}
          <div>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Bestellungen letzte 8 Stunden
            </div>
            <div className="h-24">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.stunden} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <XAxis dataKey="hour" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={false}
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      return (
                        <div className="rounded-lg border bg-card px-2 py-1 text-xs shadow font-bold">
                          {payload[0].value} Best.
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="orders" radius={[3, 3, 0, 0]} maxBarSize={28}>
                    {data.stunden.map((_, i) => (
                      <Cell key={i} fill={i === data.stunden.length - 1 ? '#5a7c4e' : '#d4e4cc'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Fahrer */}
          <div>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Top Fahrer heute
            </div>
            <div className="space-y-1.5">
              {data.top_fahrer.map((f, i) => (
                <div key={f.name} className="flex items-center gap-2">
                  <span className={cn(
                    'h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0',
                    i === 0 ? 'bg-yellow-400 text-yellow-900' :
                    i === 1 ? 'bg-zinc-300 dark:bg-zinc-600 text-zinc-700 dark:text-zinc-100' :
                               'bg-amber-700 text-white',
                  )}>
                    {i + 1}
                  </span>
                  <span className="flex-1 text-xs font-medium truncate">{f.name}</span>
                  <span className="text-[10px] text-muted-foreground">{f.deliveries} Touren</span>
                  <div className="flex items-center gap-1">
                    <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-matcha-500" style={{ width: `${f.score}%` }} />
                    </div>
                    <span className="text-[10px] font-bold tabular-nums text-matcha-600 dark:text-matcha-400 w-8 text-right">{f.score}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
