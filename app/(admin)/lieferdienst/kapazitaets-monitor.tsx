'use client';

import { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  locationId: string | null;
}

type Level = 'frei' | 'normal' | 'voll' | 'ueberlastet';

interface State {
  activeOrders: number;
  onlineDrivers: number;
  ordersPerDriver: number;
  level: Level;
}

const LEVEL_CONFIG: Record<Level, { label: string; sub: string; color: string; bar: string; pct: number }> = {
  frei:        { label: 'Kapazität frei',    sub: 'Weitere Bestellungen möglich',   color: 'text-matcha-700 border-matcha-200 bg-matcha-50', bar: 'bg-matcha-500', pct: 25 },
  normal:      { label: 'Normalbetrieb',     sub: 'Kapazität gut ausgelastet',      color: 'text-blue-700 border-blue-200 bg-blue-50',       bar: 'bg-blue-500',   pct: 55 },
  voll:        { label: 'Kapazität voll',    sub: 'Kaum Spielraum für neue Orders', color: 'text-amber-700 border-amber-200 bg-amber-50',    bar: 'bg-amber-500',  pct: 80 },
  ueberlastet: { label: 'Überlastet',        sub: 'Keine freie Kapazität!',         color: 'text-red-700 border-red-200 bg-red-50',          bar: 'bg-red-500',    pct: 100 },
};

export function LieferdienstKapazitaetsMonitor({ locationId }: Props) {
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch(`/api/delivery/admin/stats?period=today&location_id=${locationId}`);
        if (!r.ok || cancelled) return;
        const d = await r.json();
        const activeOrders: number = d?.pendingOrders ?? d?.today_stats?.pending_orders ?? 0;
        const onlineDrivers: number = d?.active_drivers ?? d?.today_stats?.active_drivers ?? 0;
        const ordersPerDriver = onlineDrivers > 0 ? activeOrders / onlineDrivers : activeOrders;

        const level: Level =
          ordersPerDriver > 4 ? 'ueberlastet' :
          ordersPerDriver > 2.5 ? 'voll' :
          ordersPerDriver > 1 ? 'normal' :
          'frei';

        if (!cancelled) setState({ activeOrders, onlineDrivers, ordersPerDriver, level });
      } catch {}
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (!state) return null;

  const cfg = LEVEL_CONFIG[state.level];

  return (
    <div className={cn('rounded-2xl border overflow-hidden', cfg.color)}>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-current/10">
        <Activity className="h-4 w-4 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-black uppercase tracking-wider">{cfg.label}</div>
          <div className="text-[10px] font-semibold opacity-70">{cfg.sub}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-sm font-black tabular-nums">{state.activeOrders}</div>
          <div className="text-[10px] opacity-70">aktive Aufträge</div>
        </div>
      </div>

      <div className="px-4 py-3">
        <div className="mb-2 flex justify-between text-[10px] font-semibold">
          <span>{state.onlineDrivers} Fahrer online</span>
          <span>Ø {state.ordersPerDriver.toFixed(1)} Auftr./Fahrer</span>
        </div>
        <div className="h-2 rounded-full bg-current/10 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-700', cfg.bar)}
            style={{ width: `${cfg.pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
