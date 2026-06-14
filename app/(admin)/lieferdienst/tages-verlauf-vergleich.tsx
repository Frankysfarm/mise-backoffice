'use client';

/**
 * TagesVerlaufVergleich
 *
 * Vergleicht das stündliche Bestellvolumen von heute mit gestern
 * im gleichen Zeitraum. Zeigt Trend und Abweichung (+/-%).
 *
 * Daten: customer_orders der letzten 48h, nach Stunde gruppiert.
 */

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { ArrowDown, ArrowUp, Minus, BarChart3, TrendingUp, TrendingDown } from 'lucide-react';

interface HourPair {
  hour: number;
  label: string;
  today: number;
  yesterday: number;
  delta: number;       // today - yesterday
  deltaPct: number | null;
  isCurrent: boolean;
  isPast: boolean;
}

interface Props {
  locationId: string;
}

export function TagesVerlaufVergleich({ locationId }: Props) {
  const [pairs, setPairs] = useState<HourPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayTotal, setTodayTotal] = useState(0);
  const [yesterdayTotal, setYesterdayTotal] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;

    async function load() {
      try {
        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);
        const yesterdayEnd = new Date(todayStart);

        const [todayRes, yesterdayRes] = await Promise.all([
          supabase
            .from('customer_orders')
            .select('bestellt_am')
            .eq('location_id', locationId)
            .gte('bestellt_am', todayStart.toISOString())
            .neq('status', 'storniert'),
          supabase
            .from('customer_orders')
            .select('bestellt_am')
            .eq('location_id', locationId)
            .gte('bestellt_am', yesterdayStart.toISOString())
            .lt('bestellt_am', yesterdayEnd.toISOString())
            .neq('status', 'storniert'),
        ]);

        if (cancelled) return;

        const todayByHour = new Array<number>(24).fill(0);
        for (const r of todayRes.data ?? []) {
          if (r.bestellt_am) todayByHour[new Date(r.bestellt_am).getHours()]++;
        }

        const yesterdayByHour = new Array<number>(24).fill(0);
        for (const r of yesterdayRes.data ?? []) {
          if (r.bestellt_am) yesterdayByHour[new Date(r.bestellt_am).getHours()]++;
        }

        const currentHour = now.getHours();
        const builtPairs: HourPair[] = Array.from({ length: 24 }, (_, h) => {
          const t = todayByHour[h];
          const y = yesterdayByHour[h];
          const delta = t - y;
          const deltaPct = y > 0 ? Math.round((delta / y) * 100) : null;
          return {
            hour: h,
            label: `${String(h).padStart(2, '0')}:00`,
            today: t,
            yesterday: y,
            delta,
            deltaPct,
            isCurrent: h === currentHour,
            isPast: h < currentHour,
          };
        });

        setPairs(builtPairs);
        setTodayTotal(todayByHour.reduce((s, c) => s + c, 0));
        setYesterdayTotal(yesterdayByHour.reduce((s, c) => s + c, 0));
      } catch {
        // Keep empty state
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    const iv = setInterval(() => void load(), 5 * 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (loading || pairs.length === 0) return null;

  const maxVal = Math.max(1, ...pairs.map((p) => Math.max(p.today, p.yesterday)));
  const totalDelta = todayTotal - yesterdayTotal;
  const totalDeltaPct = yesterdayTotal > 0 ? Math.round((totalDelta / yesterdayTotal) * 100) : null;

  // Zeige nur Stunden 6–23
  const visible = pairs.filter((p) => p.hour >= 6 && p.hour <= 23);
  const currentHour = new Date().getHours();

  // Stunden wo heute besser als gestern
  const betterHours = visible.filter((p) => p.isPast && p.today > p.yesterday).length;
  const worseHours = visible.filter((p) => p.isPast && p.today < p.yesterday).length;

  return (
    <div className="rounded-xl border bg-card p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <BarChart3 className="h-4 w-4 text-blue-500 shrink-0" />
        <span className="text-sm font-bold">Heute vs. Gestern</span>

        {totalDelta > 0 ? (
          <span className="flex items-center gap-0.5 rounded-full bg-matcha-100 text-matcha-700 px-2 py-0.5 text-[10px] font-black">
            <TrendingUp className="h-2.5 w-2.5" />
            +{totalDelta} Bestellungen
            {totalDeltaPct != null && ` (+${totalDeltaPct}%)`}
          </span>
        ) : totalDelta < 0 ? (
          <span className="flex items-center gap-0.5 rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-black">
            <TrendingDown className="h-2.5 w-2.5" />
            {totalDelta} Bestellungen
            {totalDeltaPct != null && ` (${totalDeltaPct}%)`}
          </span>
        ) : (
          <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[10px] font-bold">
            Gleich
          </span>
        )}

        <span className="ml-auto text-[9px] text-muted-foreground">
          Heute {todayTotal} · Gestern {yesterdayTotal}
        </span>
      </div>

      {/* Doppel-Balken-Diagramm */}
      <div>
        <div className="flex items-end gap-0.5 h-20">
          {visible.map((p) => (
            <div key={p.hour} className="flex-1 flex flex-col items-center gap-0.5" title={`${p.label}: Heute ${p.today}, Gestern ${p.yesterday}`}>
              <div className="w-full flex items-end gap-px" style={{ height: 60 }}>
                {/* Heute */}
                <div className="flex-1 flex items-end">
                  <div
                    className={cn(
                      'w-full rounded-t transition-all duration-500',
                      p.isCurrent ? 'bg-accent' :
                      p.isPast ? (p.today >= p.yesterday ? 'bg-matcha-400' : 'bg-red-300') :
                      'bg-blue-200',
                    )}
                    style={{ height: `${Math.max(2, (p.today / maxVal) * 100)}%` }}
                  />
                </div>
                {/* Gestern (gestrichelt / dezent) */}
                <div className="flex-1 flex items-end">
                  <div
                    className="w-full rounded-t bg-muted/70 transition-all duration-500"
                    style={{ height: `${Math.max(1, (p.yesterday / maxVal) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* X-Achse */}
        <div className="flex items-center gap-0.5 mt-1">
          {visible.map((p) => (
            <div key={p.hour} className="flex-1 text-center">
              {p.hour % 4 === 0 && (
                <span className={cn(
                  'text-[7px] tabular-nums',
                  p.isCurrent ? 'text-accent font-black' : 'text-muted-foreground',
                )}>
                  {p.hour}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Stunden-Delta Highlight-Strip */}
      <div className="flex items-center gap-0.5 overflow-x-auto pb-0.5">
        {visible.filter((p) => p.isPast || p.isCurrent).map((p) => {
          if (p.today === 0 && p.yesterday === 0) return null;
          const isUp = p.today > p.yesterday;
          const isDown = p.today < p.yesterday;
          return (
            <div
              key={p.hour}
              className={cn(
                'shrink-0 flex flex-col items-center rounded px-1 py-0.5',
                isUp ? 'bg-matcha-50' : isDown ? 'bg-red-50' : 'bg-muted/30',
              )}
              title={`${p.label}: ${isUp ? '+' : ''}${p.delta}`}
            >
              <span className="text-[7px] text-muted-foreground tabular-nums">{p.hour}h</span>
              <span className={cn(
                'text-[9px] font-black tabular-nums',
                isUp ? 'text-matcha-600' : isDown ? 'text-red-600' : 'text-muted-foreground',
              )}>
                {isUp ? '+' : ''}{p.delta}
              </span>
            </div>
          );
        })}
      </div>

      {/* Legende + Mini-Fazit */}
      <div className="flex items-center justify-between text-[9px] text-muted-foreground pt-1 border-t">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-matcha-400 inline-block" />Heute
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-muted inline-block" />Gestern
          </span>
        </div>
        {betterHours + worseHours > 0 && (
          <span className={cn(
            'font-bold',
            betterHours > worseHours ? 'text-matcha-600' : 'text-red-600',
          )}>
            {betterHours > worseHours
              ? `${betterHours}h besser als gestern`
              : `${worseHours}h schwächer als gestern`}
          </span>
        )}
      </div>
    </div>
  );
}
