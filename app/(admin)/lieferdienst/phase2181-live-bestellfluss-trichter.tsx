'use client';

/**
 * Phase 2181 – Live-Bestellfluss-Trichter
 * Visualisiert den aktuellen Bestellfluss als Trichter:
 * Eingehend → Küche → Fahrer → Geliefert
 * Mit Echtzeit-Zählung und Verweildauer pro Stufe.
 */

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Activity, ChefHat, Bike, CheckCircle2, Package, Zap, Clock } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface FunnelStage {
  key: string;
  label: string;
  count: number;
  avgMinutes: number | null;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

export function LieferdienstPhase2181LiveBestellflussTrichter({ locationId }: Props) {
  const supabase = createClient();
  const [stages, setStages] = useState<FunnelStage[]>([]);
  const [totalActive, setTotalActive] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      let query = supabase
        .from('customer_orders')
        .select('status, created_at, abgeholt_at, geliefert_at')
        .not('status', 'in', '("storniert","abgebrochen")');

      if (locationId) {
        query = query.eq('location_id', locationId);
      }

      const { data: orders } = await query.limit(200);

      const all = orders ?? [];
      const now = Date.now();

      const statusGroups: Record<string, typeof all> = {
        incoming: all.filter((o) =>
          ['ausstehend', 'bestätigt', 'neu'].includes(o.status),
        ),
        kitchen: all.filter((o) =>
          ['in_zubereitung', 'fertig'].includes(o.status),
        ),
        driver: all.filter((o) =>
          ['unterwegs', 'abgeholt', 'in_zustellung'].includes(o.status),
        ),
        delivered: all.filter((o) =>
          ['geliefert', 'abgeholt_extern'].includes(o.status),
        ),
      };

      function avgMin(items: typeof all, fromKey: 'created_at' | 'abgeholt_at', toNow: boolean) {
        if (items.length === 0) return null;
        const deltas = items
          .map((o) => {
            const from = new Date(o[fromKey] ?? o.created_at).getTime();
            const to = toNow ? now : now;
            return (to - from) / 60_000;
          })
          .filter((d) => d > 0 && d < 180);
        if (deltas.length === 0) return null;
        return Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length);
      }

      const newStages: FunnelStage[] = [
        {
          key: 'incoming',
          label: 'Eingehend',
          count: statusGroups.incoming.length,
          avgMinutes: avgMin(statusGroups.incoming, 'created_at', true),
          icon: <Package className="h-4 w-4" />,
          color: 'text-blue-700',
          bgColor: 'bg-blue-50 border-blue-200',
        },
        {
          key: 'kitchen',
          label: 'Küche',
          count: statusGroups.kitchen.length,
          avgMinutes: avgMin(statusGroups.kitchen, 'created_at', true),
          icon: <ChefHat className="h-4 w-4" />,
          color: 'text-amber-700',
          bgColor: 'bg-amber-50 border-amber-200',
        },
        {
          key: 'driver',
          label: 'Unterwegs',
          count: statusGroups.driver.length,
          avgMinutes: avgMin(statusGroups.driver, 'abgeholt_at', true),
          icon: <Bike className="h-4 w-4" />,
          color: 'text-matcha-700',
          bgColor: 'bg-matcha-50 border-matcha-200',
        },
        {
          key: 'delivered',
          label: 'Geliefert heute',
          count: statusGroups.delivered.length,
          avgMinutes: null,
          icon: <CheckCircle2 className="h-4 w-4" />,
          color: 'text-emerald-700',
          bgColor: 'bg-emerald-50 border-emerald-200',
        },
      ];

      setStages(newStages);
      setTotalActive(
        statusGroups.incoming.length +
        statusGroups.kitchen.length +
        statusGroups.driver.length,
      );
      setLoading(false);
    }

    load();
    const iv = setInterval(load, 30_000);

    const channel = supabase
      .channel('phase2181-funnel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_orders' }, load)
      .subscribe();

    return () => {
      clearInterval(iv);
      supabase.removeChannel(channel);
    };
  }, [locationId, supabase]);

  const maxCount = Math.max(...stages.map((s) => s.count), 1);

  return (
    <div className="rounded-2xl border border-matcha-100 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-matcha-100 bg-matcha-50/50">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-matcha-600" />
          <span className="text-sm font-semibold text-matcha-800">Bestellfluss-Trichter</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-matcha-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-matcha-600" />
          </div>
          <span className="text-xs text-matcha-500">{totalActive} aktiv</span>
        </div>
      </div>

      {/* Funnel stages */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-matcha-300 border-t-matcha-600" />
        </div>
      ) : (
        <div className="p-4 space-y-2">
          {stages.map((stage, idx) => {
            const widthPct = Math.max((stage.count / maxCount) * 100, 8);
            const isLast = idx === stages.length - 1;

            return (
              <div key={stage.key}>
                <div
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-4 py-3 transition-all',
                    stage.bgColor,
                  )}
                  style={{
                    width: isLast ? '100%' : `${Math.max(widthPct, 40)}%`,
                    minWidth: '60%',
                  }}
                >
                  <span className={stage.color}>{stage.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-xs font-semibold', stage.color)}>{stage.label}</p>
                    {stage.avgMinutes !== null && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Clock className="h-2.5 w-2.5 text-matcha-400" />
                        <span className="text-[10px] text-matcha-500">Ø {stage.avgMinutes} min</span>
                      </div>
                    )}
                  </div>
                  <span className={cn('text-2xl font-bold tabular-nums', stage.color)}>
                    {stage.count}
                  </span>
                </div>

                {/* Arrow connector */}
                {!isLast && (
                  <div className="flex items-center pl-6 my-0.5">
                    <div className="h-3 w-0.5 bg-matcha-200" />
                    <svg className="h-2 w-2 text-matcha-300 -ml-0.5" viewBox="0 0 8 8" fill="currentColor">
                      <polygon points="4,8 0,0 8,0" />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-matcha-100 bg-matcha-50/30 flex items-center gap-2">
        <Zap className="h-3 w-3 text-matcha-400" />
        <span className="text-xs text-matcha-500">Echtzeit · 30-Sek-Update</span>
      </div>
    </div>
  );
}
