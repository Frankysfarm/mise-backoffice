'use client';

/**
 * KitchenSchichtWochenStats — Phase 485
 * Zeigt Wochenvergleich der Küchen-Performance:
 * - Heute vs. Wochendurchschnitt (letzte 7 Tage)
 * - Ø-Kochzeit, Pünktlichkeitsquote, Bestellanzahl
 * - Trend-Pfeil: besser/schlechter als Wochendurchschnitt
 * Prop-basiert: leitet Heute-Werte aus übergebenen Orders ab,
 * Wochen-Vergleichswerte per Mock-Fallback (API optional).
 */

import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, ChefHat, Clock, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

type Order = {
  id: string;
  status: string;
  bestellt_am: string | null;
  fertig_am: string | null;
  geschaetzte_zubereitung_min: number | null;
};

type KitchenTiming = {
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
};

type WeeklyStats = {
  avgKochzeitMin: number;
  puenktlichkeitPct: number;
  bestellungen: number;
};

const MOCK_WEEKLY: WeeklyStats = {
  avgKochzeitMin: 17.2,
  puenktlichkeitPct: 74,
  bestellungen: 38,
};

function TrendIcon({ delta, invertColors = false }: { delta: number; invertColors?: boolean }) {
  if (Math.abs(delta) < 0.5) return <Minus className="h-3.5 w-3.5 text-stone-400" />;
  const positive = delta > 0;
  const good = invertColors ? !positive : positive;
  return positive
    ? <TrendingUp className={cn('h-3.5 w-3.5', good ? 'text-matcha-600' : 'text-red-500')} />
    : <TrendingDown className={cn('h-3.5 w-3.5', good ? 'text-matcha-600' : 'text-red-500')} />;
}

function StatKachel({
  label,
  today,
  weekly,
  unit,
  icon: Icon,
  invertDelta,
}: {
  label: string;
  today: number | null;
  weekly: number;
  unit: string;
  icon: React.ElementType;
  invertDelta?: boolean;
}) {
  const delta = today !== null ? today - weekly : 0;
  const pct = weekly > 0 ? Math.round((delta / weekly) * 100) : 0;
  const isGood = invertDelta ? delta < 0 : delta >= 0;

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-400">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-xl font-black tabular-nums text-stone-900">
          {today !== null ? `${today}${unit}` : '–'}
        </span>
        {today !== null && (
          <div className={cn('mb-0.5 flex items-center gap-0.5 text-[10px] font-bold', isGood ? 'text-matcha-700' : 'text-red-600')}>
            <TrendIcon delta={delta} invertColors={invertDelta} />
            <span>{pct > 0 ? '+' : ''}{pct}%</span>
          </div>
        )}
      </div>
      <div className="text-[10px] text-stone-400">
        Ø Woche: {weekly}{unit}
      </div>
    </div>
  );
}

export function KitchenSchichtWochenStats({
  orders,
  timings,
  weekly = MOCK_WEEKLY,
}: {
  orders: Order[];
  timings: KitchenTiming[];
  weekly?: WeeklyStats;
}) {
  const today = useMemo<WeeklyStats>(() => {
    const done = orders.filter((o) => o.status === 'geliefert' || o.status === 'abgeholt' || o.fertig_am);

    let totalKochMin = 0;
    let kochCount = 0;
    let pünktlich = 0;

    for (const o of done) {
      const timing = timings.find((t) => t.order_id === o.id);
      const cookStart = timing?.cook_start_at ?? o.bestellt_am;
      const fertig = o.fertig_am;

      if (cookStart && fertig) {
        const min = (new Date(fertig).getTime() - new Date(cookStart).getTime()) / 60_000;
        if (min > 0 && min < 120) {
          totalKochMin += min;
          kochCount++;
        }
      }

      if (timing?.ready_target && o.fertig_am) {
        if (new Date(o.fertig_am) <= new Date(timing.ready_target)) pünktlich++;
      }
    }

    return {
      avgKochzeitMin: kochCount > 0 ? Math.round(totalKochMin / kochCount) : 0,
      puenktlichkeitPct: done.length > 0 ? Math.round((pünktlich / done.length) * 100) : 0,
      bestellungen: orders.length,
    };
  }, [orders, timings]);

  if (orders.length === 0) return null;

  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-stone-200 bg-white px-4 py-2.5">
        <ChefHat className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="font-display text-sm font-bold uppercase tracking-wider text-stone-800">
          Schicht vs. Wochenschnitt
        </span>
        <span className="ml-auto text-[10px] text-stone-400">Heute vs. Ø 7 Tage</span>
      </div>
      <div className="grid grid-cols-3 gap-2.5 p-3">
        <StatKachel
          label="Ø Kochzeit"
          today={today.avgKochzeitMin || null}
          weekly={weekly.avgKochzeitMin}
          unit=" Min"
          icon={Clock}
          invertDelta
        />
        <StatKachel
          label="Pünktlich"
          today={today.puenktlichkeitPct || null}
          weekly={weekly.puenktlichkeitPct}
          unit="%"
          icon={Target}
        />
        <StatKachel
          label="Bestellungen"
          today={today.bestellungen}
          weekly={weekly.bestellungen}
          unit=""
          icon={ChefHat}
        />
      </div>
    </div>
  );
}
