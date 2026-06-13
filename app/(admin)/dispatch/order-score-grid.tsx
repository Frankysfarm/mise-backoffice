'use client';

/**
 * OrderScoreGrid — Kompaktes Score-Raster für alle Dispatch-Bestellungen.
 * Zeigt jede wartende Bestellung mit ihrem dispatch_score als Farbbalken + Zonenbadge.
 * Ermöglicht sofortigen Überblick über Dispatch-Prioritäten ohne Einzelklick.
 */

import { useEffect, useState } from 'react';
import { cn, euro } from '@/lib/utils';
import { Clock, MapPin, Package, Target, TrendingUp, Zap, ChevronDown, ChevronUp } from 'lucide-react';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  typ: string;
  kunde_name: string;
  kunde_adresse: string | null;
  gesamtbetrag: number;
  fertig_am: string | null;
  dispatch_score: number | null;
  delivery_zone: string | null;
  eta_earliest: string | null;
  eta_latest: string | null;
};

function useTick() {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT(n => n + 1), 10_000);
    return () => clearInterval(iv);
  }, []);
}

function WaitBadge({ fertigAm }: { fertigAm: string | null }) {
  useTick();
  if (!fertigAm) return null;
  const minWait = Math.floor((Date.now() - new Date(fertigAm).getTime()) / 60_000);
  const cls = minWait >= 10 ? 'text-red-600 bg-red-50 border-red-200 font-black' :
               minWait >= 5 ? 'text-amber-600 bg-amber-50 border-amber-200 font-bold' :
               'text-matcha-600 bg-matcha-50 border-matcha-200';
  return (
    <span className={cn('inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9px] tabular-nums', cls)}>
      <Clock className="h-2 w-2" />
      {minWait} Min
    </span>
  );
}

const ZONE_META: Record<string, { label: string; cls: string }> = {
  A: { label: 'Zone A', cls: 'bg-matcha-100 text-matcha-700 border-matcha-200' },
  B: { label: 'Zone B', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  C: { label: 'Zone C', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  D: { label: 'Zone D', cls: 'bg-red-100 text-red-700 border-red-200' },
};

function ScoreBar({ score }: { score: number | null }) {
  if (score == null) return (
    <div className="h-1.5 rounded-full bg-muted w-full">
      <div className="h-full w-[0%] rounded-full bg-muted-foreground/30" />
    </div>
  );
  const pct = Math.min(100, Math.max(0, score));
  const barCls = pct >= 70 ? 'bg-matcha-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-500', barCls)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn('text-[10px] font-black tabular-nums w-7 text-right',
        pct >= 70 ? 'text-matcha-700' : pct >= 40 ? 'text-amber-700' : 'text-red-600'
      )}>
        {Math.round(pct)}
      </span>
    </div>
  );
}

export function OrderScoreGrid({ orders }: { orders: Order[] }) {
  const [collapsed, setCollapsed] = useState(false);
  const readyOrders = orders.filter(o => o.status === 'fertig');
  if (readyOrders.length === 0) return null;

  // Sort by score desc, then wait time desc
  const sorted = [...readyOrders].sort((a, b) => {
    if ((b.dispatch_score ?? 0) !== (a.dispatch_score ?? 0)) return (b.dispatch_score ?? 0) - (a.dispatch_score ?? 0);
    const awm = a.fertig_am ? Date.now() - new Date(a.fertig_am).getTime() : 0;
    const bwm = b.fertig_am ? Date.now() - new Date(b.fertig_am).getTime() : 0;
    return bwm - awm;
  });

  const avgScore = readyOrders.filter(o => o.dispatch_score != null).reduce((s, o) => s + (o.dispatch_score ?? 0), 0) /
    Math.max(1, readyOrders.filter(o => o.dispatch_score != null).length);

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Header */}
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-muted/30 transition rounded-xl"
        onClick={() => setCollapsed(v => !v)}
      >
        <Target className="h-4 w-4 text-matcha-600" />
        <span className="text-xs font-black uppercase tracking-wider text-matcha-700">
          Score-Übersicht · {readyOrders.length} Bestellungen
        </span>
        {!isNaN(avgScore) && (
          <span className={cn(
            'ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
            avgScore >= 70 ? 'bg-matcha-100 text-matcha-700' :
            avgScore >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
          )}>
            Ø {Math.round(avgScore)} Punkte
          </span>
        )}
        <div className="flex-1" />
        <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
        {collapsed
          ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
          : <ChevronUp className="h-4 w-4 text-muted-foreground" />
        }
      </button>

      {!collapsed && (
        <div className="px-4 pb-3 space-y-2 border-t border-border/50 pt-2">
          {/* Score legend */}
          <div className="flex items-center gap-3 text-[9px] text-muted-foreground pb-0.5">
            <span className="flex items-center gap-1"><span className="h-1.5 w-3 rounded-full bg-matcha-500" />High (70+)</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-3 rounded-full bg-amber-400" />Medium (40–70)</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-3 rounded-full bg-red-400" />Low (&lt;40)</span>
          </div>

          {/* Order rows */}
          <div className="space-y-2">
            {sorted.map((order, i) => {
              const zone = order.delivery_zone?.toUpperCase() ?? null;
              const zoneMeta = zone ? ZONE_META[zone] : null;
              return (
                <div key={order.id} className={cn(
                  'rounded-lg border px-3 py-2 space-y-1.5',
                  i === 0 ? 'border-matcha-200 bg-matcha-50/50' : 'border-border bg-muted/20',
                )}>
                  {/* Row header */}
                  <div className="flex items-center gap-2">
                    {i === 0 && (
                      <span className="text-[8px] font-black text-matcha-600 bg-matcha-100 rounded px-1 py-0.5 shrink-0">PRIO</span>
                    )}
                    <Package className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-[10px] font-bold text-foreground flex-1 truncate">
                      #{order.bestellnummer} · {order.kunde_name}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {zoneMeta && (
                        <span className={cn('text-[9px] font-bold rounded border px-1 py-0.5', zoneMeta.cls)}>
                          {zoneMeta.label}
                        </span>
                      )}
                      <WaitBadge fertigAm={order.fertig_am} />
                    </div>
                  </div>

                  {/* Score bar */}
                  <ScoreBar score={order.dispatch_score} />

                  {/* Address + value */}
                  {order.kunde_adresse && (
                    <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                      <MapPin className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate">{order.kunde_adresse}</span>
                      <span className="ml-auto font-bold text-foreground shrink-0">{euro(order.gesamtbetrag)}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
