'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Route, MapPin, Zap, Package } from 'lucide-react';

type ReadyOrder = {
  id: string;
  bestellnummer: string;
  delivery_zone: string | null;
  dispatch_score: number | null;
  gesamtbetrag: number;
  kunde_adresse: string | null;
  fertig_am: string | null;
};

interface Props {
  orders: ReadyOrder[];
}

type ZoneBundle = {
  zone: string;
  orders: ReadyOrder[];
  count: number;
  avgScore: number;
  totalValue: number;
  bundleScore: number;
  recommendation: 'sofort' | 'warte' | 'einzeln';
};

function computeBundleScore(count: number, avgScore: number): number {
  return Math.min(100, Math.round(avgScore * 0.7 + count * 10));
}

export function DispatchZoneBundleScore({ orders }: Props) {
  const ready = orders.filter((o) => o.delivery_zone);

  const bundles = useMemo((): ZoneBundle[] => {
    const byZone = new Map<string, ReadyOrder[]>();
    for (const o of ready) {
      const z = o.delivery_zone!;
      if (!byZone.has(z)) byZone.set(z, []);
      byZone.get(z)!.push(o);
    }

    return Array.from(byZone.entries())
      .map(([zone, zoneOrders]): ZoneBundle => {
        const avgScore = zoneOrders.length > 0
          ? zoneOrders.reduce((s, o) => s + (o.dispatch_score ?? 50), 0) / zoneOrders.length
          : 50;
        const totalValue = zoneOrders.reduce((s, o) => s + o.gesamtbetrag, 0);
        const bundleScore = computeBundleScore(zoneOrders.length, avgScore);

        let recommendation: ZoneBundle['recommendation'] = 'einzeln';
        if (zoneOrders.length >= 3) recommendation = 'sofort';
        else if (zoneOrders.length === 2) recommendation = 'warte';

        return { zone, orders: zoneOrders, count: zoneOrders.length, avgScore, totalValue, bundleScore, recommendation };
      })
      .sort((a, b) => b.bundleScore - a.bundleScore);
  }, [ready]);

  if (bundles.length === 0) return null;

  const recStyle = {
    sofort: { bg: 'bg-matcha-50', border: 'border-matcha-200', badge: 'bg-matcha-600 text-white', label: 'Jetzt bündeln' },
    warte:  { bg: 'bg-amber-50',  border: 'border-amber-200',  badge: 'bg-amber-500 text-white',  label: '+1 warten'    },
    einzeln:{ bg: 'bg-slate-50',  border: 'border-slate-200',  badge: 'bg-slate-400 text-white',  label: 'Einzeltour'   },
  };

  const totalBundlable = bundles.filter((b) => b.recommendation !== 'einzeln').reduce((s, b) => s + b.count, 0);

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b">
        <Route className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-black uppercase tracking-wider">Zonen-Bundle-Score</span>
        {totalBundlable > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-matcha-600 px-2 py-0.5 text-[9px] font-black text-white">
            <Zap className="h-2.5 w-2.5" />
            {totalBundlable} bündelbar
          </span>
        )}
      </div>

      <div className="divide-y">
        {bundles.map((b) => {
          const rs = recStyle[b.recommendation];
          const scorePct = b.bundleScore;
          return (
            <div key={b.zone} className={cn('px-4 py-3', rs.bg)}>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white border font-black text-sm text-matcha-700">
                  {b.zone}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold">Zone {b.zone}</span>
                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      <Package className="h-3 w-3" />
                      {b.count} Bestellung{b.count !== 1 ? 'en' : ''}
                    </span>
                    <span className={cn('ml-auto shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black', rs.badge)}>
                      {rs.label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Score bar */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-black/8 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      b.recommendation === 'sofort' ? 'bg-matcha-500' :
                      b.recommendation === 'warte'  ? 'bg-amber-400' : 'bg-slate-300',
                    )}
                    style={{ width: `${scorePct}%` }}
                  />
                </div>
                <span className="text-[10px] font-black tabular-nums w-8 text-right text-muted-foreground">
                  {scorePct}
                </span>
              </div>

              {/* Order list */}
              <div className="mt-2 flex flex-wrap gap-1">
                {b.orders.map((o) => (
                  <span
                    key={o.id}
                    className="inline-flex items-center gap-0.5 rounded bg-white border px-1.5 py-0.5 text-[9px] font-bold text-foreground"
                  >
                    <MapPin className="h-2 w-2 text-muted-foreground shrink-0" />
                    #{o.bestellnummer.slice(-4)}
                  </span>
                ))}
                <span className="ml-auto text-[10px] text-muted-foreground font-semibold tabular-nums">
                  {b.totalValue.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
