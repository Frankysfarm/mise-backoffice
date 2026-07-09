'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { BarChart3, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Euro, Clock, Package, Star, Loader2 } from 'lucide-react';

/**
 * Phase 980 — Statistiken-KPI-Hub (Lieferdienst)
 *
 * Kompakter Statistiken-Überblick mit 6 Kern-KPIs:
 * Umsatz, Bestellungen, Ø Lieferzeit, Pünktlichkeit, Stornoquote, Ø Bewertung.
 * Trend je KPI (Heute vs. Vortag). Polling /api/delivery/admin/stats.
 * Fallback auf Mock-Daten.
 */

interface KpiData {
  umsatzEur: number;
  bestellungen: number;
  avgLieferzeitMin: number;
  puenktlichkeitPct: number;
  stornoquotePct: number;
  avgBewertung: number;
  // Trends vs. Vortag (+/- in %)
  umsatzTrend: number;
  bestellungenTrend: number;
  lieferzeitTrend: number;
  puenktlichkeitTrend: number;
  stornoquoteTrend: number;
  bewertungTrend: number;
}

const MOCK: KpiData = {
  umsatzEur: 1842.50,
  bestellungen: 73,
  avgLieferzeitMin: 28.4,
  puenktlichkeitPct: 87,
  stornoquotePct: 3.2,
  avgBewertung: 4.6,
  umsatzTrend: +8.2,
  bestellungenTrend: +5.5,
  lieferzeitTrend: -2.1,
  puenktlichkeitTrend: +3.0,
  stornoquoteTrend: -0.8,
  bewertungTrend: +0.1,
};

interface KpiCard {
  label: string;
  value: string;
  trend: number;
  icon: React.ReactNode;
  higher_is_better: boolean;
  bg: string;
  text: string;
  iconBg: string;
}

function trendIcon(trend: number) {
  if (trend > 0.5) return <TrendingUp  className="h-3 w-3" />;
  if (trend < -0.5) return <TrendingDown className="h-3 w-3" />;
  return <Minus className="h-3 w-3" />;
}

function trendColor(trend: number, higher_is_better: boolean): string {
  const good = higher_is_better ? trend > 0.5 : trend < -0.5;
  const bad  = higher_is_better ? trend < -0.5 : trend > 0.5;
  if (good) return 'text-matcha-600 dark:text-matcha-400';
  if (bad)  return 'text-red-600 dark:text-red-400';
  return 'text-zinc-400';
}

function fmt(n: number, type: 'eur' | 'pct' | 'min' | 'stars' | 'int'): string {
  if (type === 'eur')   return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  if (type === 'pct')   return n.toFixed(1) + ' %';
  if (type === 'min')   return n.toFixed(1) + ' Min';
  if (type === 'stars') return n.toFixed(1) + ' ★';
  return String(Math.round(n));
}

export function LieferdienstPhase980StatistikenKpiHub({ locationId }: { locationId: string | null }) {
  const [data, setData]     = useState<KpiData>(MOCK);
  const [loading, setLoading] = useState(true);
  const [open, setOpen]     = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const qs = locationId ? `?location_id=${locationId}` : '';
        const res = await fetch(`/api/delivery/admin/stats${qs}`);
        if (!res.ok) throw new Error();
        const raw = await res.json();

        const today   = raw.today ?? raw.heute ?? {};
        const yesterday = raw.yesterday ?? raw.gestern ?? {};

        function pct(a: number, b: number): number {
          if (!b) return 0;
          return ((a - b) / b) * 100;
        }

        setData({
          umsatzEur:          today.revenue      ?? today.umsatz        ?? MOCK.umsatzEur,
          bestellungen:        today.orders       ?? today.bestellungen  ?? MOCK.bestellungen,
          avgLieferzeitMin:   today.avg_delivery_time ?? today.avg_lieferzeit ?? MOCK.avgLieferzeitMin,
          puenktlichkeitPct:  today.on_time_pct  ?? today.puenktlichkeit ?? MOCK.puenktlichkeitPct,
          stornoquotePct:     today.cancel_rate  ?? today.stornoquote   ?? MOCK.stornoquotePct,
          avgBewertung:        today.avg_rating   ?? today.bewertung     ?? MOCK.avgBewertung,
          umsatzTrend:         pct(today.revenue ?? MOCK.umsatzEur, yesterday.revenue ?? 0),
          bestellungenTrend:   pct(today.orders  ?? MOCK.bestellungen,  yesterday.orders  ?? 0),
          lieferzeitTrend:     pct(today.avg_delivery_time ?? MOCK.avgLieferzeitMin, yesterday.avg_delivery_time ?? 0),
          puenktlichkeitTrend: pct(today.on_time_pct ?? MOCK.puenktlichkeitPct, yesterday.on_time_pct ?? 0),
          stornoquoteTrend:    pct(today.cancel_rate ?? MOCK.stornoquotePct, yesterday.cancel_rate ?? 0),
          bewertungTrend:       pct(today.avg_rating ?? MOCK.avgBewertung, yesterday.avg_rating ?? 0),
        });
      } catch {
        // keep mock
      } finally {
        setLoading(false);
      }
    }
    load();
    const iv = setInterval(load, 120_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const cards: KpiCard[] = [
    {
      label: 'Umsatz heute', value: fmt(data.umsatzEur, 'eur'),
      trend: data.umsatzTrend, higher_is_better: true,
      icon: <Euro className="h-4 w-4" />,
      bg: 'bg-matcha-50 dark:bg-matcha-950/20', text: 'text-matcha-700 dark:text-matcha-300',
      iconBg: 'bg-matcha-100 dark:bg-matcha-900/40',
    },
    {
      label: 'Bestellungen', value: fmt(data.bestellungen, 'int'),
      trend: data.bestellungenTrend, higher_is_better: true,
      icon: <Package className="h-4 w-4" />,
      bg: 'bg-blue-50 dark:bg-blue-950/20', text: 'text-blue-700 dark:text-blue-300',
      iconBg: 'bg-blue-100 dark:bg-blue-900/40',
    },
    {
      label: 'Ø Lieferzeit', value: fmt(data.avgLieferzeitMin, 'min'),
      trend: data.lieferzeitTrend, higher_is_better: false,
      icon: <Clock className="h-4 w-4" />,
      bg: 'bg-amber-50 dark:bg-amber-950/20', text: 'text-amber-700 dark:text-amber-300',
      iconBg: 'bg-amber-100 dark:bg-amber-900/40',
    },
    {
      label: 'Pünktlichkeit', value: fmt(data.puenktlichkeitPct, 'pct'),
      trend: data.puenktlichkeitTrend, higher_is_better: true,
      icon: <BarChart3 className="h-4 w-4" />,
      bg: 'bg-emerald-50 dark:bg-emerald-950/20', text: 'text-emerald-700 dark:text-emerald-300',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
    },
    {
      label: 'Stornoquote', value: fmt(data.stornoquotePct, 'pct'),
      trend: data.stornoquoteTrend, higher_is_better: false,
      icon: <TrendingDown className="h-4 w-4" />,
      bg: 'bg-red-50 dark:bg-red-950/20', text: 'text-red-700 dark:text-red-300',
      iconBg: 'bg-red-100 dark:bg-red-900/40',
    },
    {
      label: 'Ø Bewertung', value: fmt(data.avgBewertung, 'stars'),
      trend: data.bewertungTrend, higher_is_better: true,
      icon: <Star className="h-4 w-4" />,
      bg: 'bg-yellow-50 dark:bg-yellow-950/20', text: 'text-yellow-700 dark:text-yellow-300',
      iconBg: 'bg-yellow-100 dark:bg-yellow-900/40',
    },
  ];

  return (
    <div className="rounded-2xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-stone-50 dark:hover:bg-zinc-800/60 transition border-b border-stone-100 dark:border-zinc-800"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-matcha-100 dark:bg-matcha-900/40 text-matcha-700 dark:text-matcha-300">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-foreground">Statistiken-KPI-Hub</div>
            <div className="text-xs text-stone-400">6 Kern-KPIs • Heute vs. Gestern</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          {open ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
        </div>
      </button>

      {open && (
        <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3">
          {cards.map((card) => {
            const tc = trendColor(card.trend, card.higher_is_better);
            return (
              <div key={card.label} className={cn('rounded-xl p-3 space-y-2', card.bg)}>
                <div className="flex items-center justify-between">
                  <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg', card.iconBg, card.text)}>
                    {card.icon}
                  </div>
                  <div className={cn('flex items-center gap-0.5 text-[10px] font-bold', tc)}>
                    {trendIcon(card.trend)}
                    <span className="tabular-nums">
                      {Math.abs(card.trend) < 0.5 ? '±0' : `${card.trend > 0 ? '+' : ''}${card.trend.toFixed(1)}%`}
                    </span>
                  </div>
                </div>
                <div>
                  <div className={cn('text-base font-black tabular-nums leading-tight', card.text)}>
                    {card.value}
                  </div>
                  <div className="text-[10px] font-semibold text-stone-500 dark:text-zinc-400 mt-0.5">
                    {card.label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
