'use client';

/**
 * KitchenBestellungsReihenfolge — Phase 168
 *
 * Zeigt aktive Bestellungen in der empfohlenen Kochreihenfolge.
 * Faktoriert: Wartezeit, Überfälligkeit, verbleibende Prep-Zeit, Fahrer-ETA.
 * Ergebnis: nummerierte "Was jetzt starten?"-Liste für Küchenpersonal.
 */

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, ChefHat, Clock, Flame } from 'lucide-react';

type Item = { name: string; menge: number };

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  items: Item[];
};

type KitchenTiming = {
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
};

type Props = {
  orders: Order[];
  timings: KitchenTiming[];
};

function computeScore(order: Order, timing: KitchenTiming | undefined): number {
  const now = Date.now();
  const waitMin = order.bestellt_am
    ? (now - new Date(order.bestellt_am).getTime()) / 60_000
    : 0;

  // Already cooking → de-prioritise (handled)
  if (timing?.status === 'cooking' || order.status === 'in_zubereitung') return -20;

  let score = waitMin * 2;

  if (timing?.ready_target) {
    const minsLeft = (new Date(timing.ready_target).getTime() - now) / 60_000;
    if (minsLeft < 0)  score += 100;
    else if (minsLeft < 5)  score += 60;
    else if (minsLeft < 15) score += 25;
  }

  const prep = timing?.prep_min ?? order.geschaetzte_zubereitung_min ?? 20;
  if (waitMin + prep > 35) score += 30;

  return score;
}

const LABEL: Record<string, string> = {
  ÜBERFÄLLIG: 'ÜBERFÄLLIG',
  DRINGEND:   'DRINGEND',
  BALD:       'BALD',
  NORMAL:     'NORMAL',
};

const LABEL_COLORS: Record<string, string> = {
  ÜBERFÄLLIG: 'bg-red-500/20 text-red-400',
  DRINGEND:   'bg-amber-500/20 text-amber-400',
  BALD:       'bg-yellow-500/20 text-yellow-400',
  NORMAL:     'bg-matcha-500/20 text-matcha-400',
};

export function KitchenBestellungsReihenfolge({ orders, timings }: Props) {
  const ranked = useMemo(() => {
    const active = orders.filter((o) =>
      ['bestätigt', 'in_zubereitung'].includes(o.status),
    );

    return active
      .map((order) => {
        const timing = timings.find((t) => t.order_id === order.id);
        const score  = computeScore(order, timing);
        const now    = Date.now();
        const waitMin = order.bestellt_am
          ? Math.round((now - new Date(order.bestellt_am).getTime()) / 60_000)
          : 0;
        const isCooking   = timing?.status === 'cooking' || order.status === 'in_zubereitung';
        const isOverdue   = timing?.ready_target
          ? new Date(timing.ready_target).getTime() < now
          : waitMin > 35;
        const prepMin = timing?.prep_min ?? order.geschaetzte_zubereitung_min ?? 20;

        const urgLabel =
          isOverdue    ? 'ÜBERFÄLLIG' :
          waitMin >= 20 ? 'DRINGEND'  :
          waitMin >= 10 ? 'BALD'      : 'NORMAL';

        return { order, timing, score, waitMin, isOverdue, isCooking, prepMin, urgLabel };
      })
      .sort((a, b) => b.score - a.score);
  }, [orders, timings]);

  const toStart   = ranked.filter((r) => !r.isCooking).slice(0, 4);
  const cooking   = ranked.filter((r) => r.isCooking);

  // Only show when there are at least 2 orders waiting to start
  if (toStart.length < 2) return null;

  return (
    <div className="rounded-2xl bg-gradient-to-br from-stone-900 to-stone-800 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ChefHat className="h-4 w-4 text-amber-400" />
        <span className="text-[11px] font-black uppercase tracking-widest text-stone-300">
          Empfohlene Kochreihenfolge
        </span>
        <span className="ml-auto text-[10px] text-stone-500 font-medium">
          {toStart.length} wartend
        </span>
      </div>

      <div className="space-y-2">
        {toStart.map((item, idx) => {
          const summary = item.order.items
            .slice(0, 2)
            .map((i) => (i.menge > 1 ? `${i.menge}× ${i.name}` : i.name))
            .join(' · ');

          return (
            <div
              key={item.order.id}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 transition',
                idx === 0
                  ? 'bg-amber-500/15 border border-amber-500/30'
                  : 'bg-white/5 border border-transparent',
              )}
            >
              {/* Rank badge */}
              <div
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0',
                  idx === 0 ? 'bg-amber-500 text-white' : 'bg-white/10 text-stone-400',
                )}
              >
                {idx + 1}
              </div>

              {/* Order info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-white">
                    #{item.order.bestellnummer}
                  </span>
                  <span
                    className={cn(
                      'text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full',
                      LABEL_COLORS[item.urgLabel],
                    )}
                  >
                    {LABEL[item.urgLabel]}
                  </span>
                </div>
                <div className="text-[11px] text-stone-400 truncate mt-0.5">
                  {summary || '—'}
                </div>
              </div>

              {/* Timing */}
              <div className="text-right shrink-0">
                <div className="flex items-center gap-1 text-stone-300 justify-end">
                  <Clock className="h-3 w-3" />
                  <span className="text-xs font-bold tabular-nums">{item.waitMin} Min</span>
                </div>
                <div className="text-[10px] text-stone-500">{item.prepMin} Min Prep</div>
              </div>

              {idx === 0 && (
                <ArrowRight className="h-4 w-4 text-amber-400 shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {cooking.length > 0 && (
        <div className="pt-1 border-t border-white/10 flex items-center gap-1.5">
          <Flame className="h-3 w-3 text-orange-500 shrink-0" />
          <span className="text-[10px] text-stone-500">
            {cooking.length} bereits in Zubereitung
          </span>
        </div>
      )}
    </div>
  );
}
