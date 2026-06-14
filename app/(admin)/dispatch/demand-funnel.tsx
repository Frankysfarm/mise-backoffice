'use client';

/**
 * DispatchDemandFunnel
 *
 * Visualisiert die Bestellungen als Trichter von Eingang bis Lieferung.
 * Jede Stufe zeigt Anzahl + Konversionsrate zur nächsten Stufe.
 *
 * Stufen:
 *  1. Eingang     — neu / bestätigt
 *  2. Zubereitung — in_zubereitung
 *  3. Bereit       — fertig (wartet auf Fahrer)
 *  4. Unterwegs   — unterwegs
 *  5. Geliefert   — geliefert / abgeholt (heute)
 *
 * Ermöglicht Dispatch-Managern den Engpass auf einen Blick zu erkennen.
 */

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { ArrowDown, ChefHat, CheckCircle2, Inbox, Loader2, Package, Truck } from 'lucide-react';

type FunnelStage = {
  id: string;
  label: string;
  statuses: string[];
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
};

const STAGES: FunnelStage[] = [
  {
    id: 'eingang',
    label: 'Eingang',
    statuses: ['neu', 'bestätigt'],
    icon: <Inbox className="h-4 w-4" />,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  {
    id: 'zubereitung',
    label: 'Zubereitung',
    statuses: ['in_zubereitung'],
    icon: <ChefHat className="h-4 w-4" />,
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  {
    id: 'bereit',
    label: 'Bereit',
    statuses: ['fertig'],
    icon: <Package className="h-4 w-4" />,
    color: 'text-matcha-700',
    bgColor: 'bg-matcha-50',
    borderColor: 'border-matcha-200',
  },
  {
    id: 'unterwegs',
    label: 'Unterwegs',
    statuses: ['unterwegs'],
    icon: <Truck className="h-4 w-4" />,
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
  },
  {
    id: 'geliefert',
    label: 'Geliefert',
    statuses: ['geliefert', 'abgeholt', 'abgeschlossen'],
    icon: <CheckCircle2 className="h-4 w-4" />,
    color: 'text-matcha-700',
    bgColor: 'bg-matcha-100',
    borderColor: 'border-matcha-300',
  },
];

type FunnelData = {
  stageId: string;
  count: number;
  conversionRate: number | null; // rate to next stage, null for last
};

interface Props {
  locationFilter?: string;
}

export function DispatchDemandFunnel({ locationFilter }: Props) {
  const [data, setData] = useState<FunnelData[] | null>(null);
  const [totalToday, setTotalToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let q = supabase
        .from('customer_orders')
        .select('id, status, location_id, typ')
        .eq('typ', 'lieferung')
        .gte('bestellt_am', today.toISOString());

      const { data: orders } = await q;
      if (cancelled || !orders) return;

      const filtered = locationFilter && locationFilter !== 'all'
        ? orders.filter((o: any) => o.location_id === locationFilter)
        : orders;

      // Count per stage
      const counts: Record<string, number> = {};
      for (const stage of STAGES) {
        counts[stage.id] = filtered.filter((o: any) =>
          stage.statuses.includes(o.status),
        ).length;
      }

      // Total for today (all delivery orders)
      const total = filtered.length;
      setTotalToday(total);

      // Conversion rates: between consecutive active stages
      const funnelData: FunnelData[] = STAGES.map((stage, i) => {
        const count = counts[stage.id] ?? 0;
        // Conversion from previous non-completed stages (cumulative approach)
        let conversionRate: number | null = null;
        if (i > 0 && total > 0) {
          // How many of today's orders have progressed to THIS stage or beyond
          const cumulativeCurrent = STAGES.slice(i).reduce((sum, s) => sum + (counts[s.id] ?? 0), 0);
          const cumulativePrev   = STAGES.slice(i - 1).reduce((sum, s) => sum + (counts[s.id] ?? 0), 0);
          if (cumulativePrev > 0) {
            conversionRate = Math.round((cumulativeCurrent / cumulativePrev) * 100);
          }
        }
        return { stageId: stage.id, count, conversionRate };
      });

      if (!cancelled) {
        setData(funnelData);
        setLoading(false);
      }
    }

    load();
    const iv = setInterval(load, 30_000);

    const ch = supabase
      .channel('dispatch-funnel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_orders' }, load)
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(iv);
      supabase.removeChannel(ch);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationFilter]);

  // Max count for bar width calculation
  const maxCount = data ? Math.max(1, ...data.map(d => d.count)) : 1;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <ArrowDown className="h-4 w-4 text-matcha-600 shrink-0" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Liefertrichter
          </span>
          {totalToday > 0 && (
            <span className="rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
              {totalToday} heute
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t px-5 py-4 space-y-3">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Lade Trichterdaten…
            </div>
          )}

          {!loading && data && (
            <div className="space-y-1">
              {STAGES.map((stage, i) => {
                const stageData = data[i];
                const count = stageData.count;
                const pct = Math.round((count / maxCount) * 100);
                const convRate = stageData.conversionRate;

                return (
                  <div key={stage.id}>
                    <div className={cn(
                      'flex items-center gap-3 rounded-xl border px-3 py-2.5',
                      stage.bgColor, stage.borderColor,
                    )}>
                      {/* Icon */}
                      <span className={cn('shrink-0', stage.color)}>
                        {stage.icon}
                      </span>

                      {/* Label */}
                      <span className={cn('text-xs font-bold w-24 shrink-0', stage.color)}>
                        {stage.label}
                      </span>

                      {/* Bar */}
                      <div className="flex-1 h-2 rounded-full bg-black/10 overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all duration-700', {
                            'bg-blue-400':    stage.id === 'eingang',
                            'bg-amber-400':   stage.id === 'zubereitung',
                            'bg-matcha-500':  stage.id === 'bereit',
                            'bg-purple-400':  stage.id === 'unterwegs',
                            'bg-matcha-600':  stage.id === 'geliefert',
                          })}
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      {/* Count */}
                      <span className={cn('w-6 text-right font-black text-sm tabular-nums shrink-0', stage.color)}>
                        {count}
                      </span>
                    </div>

                    {/* Conversion arrow */}
                    {i < STAGES.length - 1 && convRate !== null && (
                      <div className="flex items-center gap-1 justify-center py-0.5">
                        <ArrowDown className="h-3 w-3 text-muted-foreground" />
                        <span className={cn(
                          'text-[10px] font-bold tabular-nums',
                          convRate >= 80 ? 'text-matcha-600' :
                          convRate >= 50 ? 'text-amber-600' :
                          'text-red-500',
                        )}>
                          {convRate}%
                        </span>
                      </div>
                    )}
                    {i < STAGES.length - 1 && convRate === null && (
                      <div className="h-4" />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!loading && data && totalToday === 0 && (
            <div className="text-sm text-muted-foreground text-center py-2">
              Noch keine Lieferbestellungen heute.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
