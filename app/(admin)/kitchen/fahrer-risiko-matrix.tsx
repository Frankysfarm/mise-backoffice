'use client';

import { useMemo, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, Clock, Bike, Flame } from 'lucide-react';
import { Card } from '@/components/ui/card';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  typ: string;
  geschaetzte_zubereitung_min: number | null;
  bestellt_am: string | null;
};

type KitchenTiming = {
  id: string;
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
};

type Batch = {
  id: string;
  status: string;
  driver_id: string;
  started_at: string | null;
  total_eta_min: number | null;
};

type Stop = {
  id: string;
  batch_id: string;
  order_id: string;
  geliefert_am: string | null;
};

type Driver = {
  id: string;
  vorname: string;
  nachname: string;
};

interface RisikoRow {
  orderId: string;
  bestellnummer: string;
  prepRemainSec: number | null;
  driverEtaSec: number | null;
  driverName: string | null;
  risk: 'ok' | 'warn' | 'critical' | 'unknown';
  gapSec: number | null;
}

function useTick() {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT((n) => n + 1), 5000);
    return () => clearInterval(iv);
  }, []);
}

function fmt(sec: number): string {
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m`;
}

export function KitchenFahrerRisikoMatrix({
  orders, timings, batches, stops, drivers,
}: {
  orders: Order[];
  timings: KitchenTiming[];
  batches: Batch[];
  stops: Stop[];
  drivers: Driver[];
}) {
  useTick();
  const now = Date.now();

  const rows = useMemo<RisikoRow[]>(() => {
    const activeOrders = orders.filter(
      (o) => o.typ === 'lieferung' && ['bestätigt', 'in_zubereitung'].includes(o.status),
    );

    return activeOrders.map((order) => {
      const timing = timings.find((t) => t.order_id === order.id);
      let prepRemainSec: number | null = null;
      if (timing?.ready_target) {
        prepRemainSec = Math.max(0, Math.floor((new Date(timing.ready_target).getTime() - now) / 1000));
      } else if (timing?.cook_start_at && timing.prep_min) {
        const readyAt = new Date(timing.cook_start_at).getTime() + timing.prep_min * 60_000;
        prepRemainSec = Math.max(0, Math.floor((readyAt - now) / 1000));
      } else if (order.bestellt_am && order.geschaetzte_zubereitung_min) {
        const readyAt = new Date(order.bestellt_am).getTime() + order.geschaetzte_zubereitung_min * 60_000;
        prepRemainSec = Math.max(0, Math.floor((readyAt - now) / 1000));
      }

      // Find driver ETA for this order
      const stop = stops.find((s) => s.order_id === order.id && !s.geliefert_am);
      let driverEtaSec: number | null = null;
      let driverName: string | null = null;
      if (stop) {
        const batch = batches.find((b) => b.id === stop.batch_id && (b.status === 'unterwegs' || b.status === 'on_route'));
        if (batch?.started_at && batch.total_eta_min != null) {
          const eta = new Date(batch.started_at).getTime() + batch.total_eta_min * 60_000;
          driverEtaSec = Math.max(0, Math.floor((eta - now) / 1000));
          const drv = drivers.find((d) => d.id === batch.driver_id);
          if (drv) driverName = `${drv.vorname} ${drv.nachname[0]}.`;
        }
      }

      // Risk: driver arrives before food is ready → critical
      let risk: RisikoRow['risk'] = 'unknown';
      let gapSec: number | null = null;
      if (driverEtaSec !== null && prepRemainSec !== null) {
        gapSec = driverEtaSec - prepRemainSec; // positive → driver waits; negative → food waits (cold risk)
        if (gapSec < -120) risk = 'critical'; // driver arrives 2+ min before food ready
        else if (gapSec < 0) risk = 'warn';   // driver arrives while food just barely done
        else risk = 'ok';
      } else if (prepRemainSec !== null) {
        risk = prepRemainSec < 300 ? 'warn' : 'unknown';
      }

      return { orderId: order.id, bestellnummer: order.bestellnummer, prepRemainSec, driverEtaSec, driverName, risk, gapSec };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, timings, batches, stops, drivers, now]);

  const critical = rows.filter((r) => r.risk === 'critical');
  const warn = rows.filter((r) => r.risk === 'warn');
  const ok = rows.filter((r) => r.risk === 'ok');
  const unknown = rows.filter((r) => r.risk === 'unknown');

  if (rows.length === 0) return null;

  const sorted = [...critical, ...warn, ...ok, ...unknown];

  const riskStyle = {
    critical: { bg: 'bg-red-50 border-red-200',     badge: 'bg-red-500 text-white',      icon: AlertTriangle, iconCls: 'text-red-500',    label: 'Kritisch' },
    warn:     { bg: 'bg-amber-50 border-amber-200',  badge: 'bg-amber-400 text-white',    icon: Clock,         iconCls: 'text-amber-500',  label: 'Knapp'    },
    ok:       { bg: 'bg-matcha-50 border-matcha-200',badge: 'bg-matcha-500 text-white',   icon: CheckCircle2,  iconCls: 'text-matcha-600', label: 'OK'       },
    unknown:  { bg: 'bg-muted/30 border-border',     badge: 'bg-muted text-muted-foreground', icon: Bike,       iconCls: 'text-muted-foreground', label: 'Kein Fahrer' },
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b">
        <Flame className="h-4 w-4 text-orange-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Fahrer-Risiko-Matrix
        </span>
        {critical.length > 0 && (
          <span className="ml-1 rounded-full bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 animate-pulse">
            {critical.length} Kritisch
          </span>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground">
          {warn.length} knapp · {ok.length} OK
        </span>
      </div>

      <div className="divide-y">
        {sorted.map((row) => {
          const s = riskStyle[row.risk];
          const Icon = s.icon;
          return (
            <div key={row.orderId} className={cn('flex items-center gap-3 px-4 py-2.5', s.bg)}>
              <Icon className={cn('h-4 w-4 shrink-0', s.iconCls)} />

              <span className="text-xs font-black tabular-nums text-foreground min-w-[52px]">
                #{row.bestellnummer}
              </span>

              <div className="flex-1 flex items-center gap-3 flex-wrap">
                {row.prepRemainSec !== null && (
                  <span className="text-[11px] font-bold text-foreground tabular-nums">
                    Fertig in {fmt(row.prepRemainSec)}
                  </span>
                )}
                {row.driverEtaSec !== null && (
                  <span className={cn('text-[11px] font-bold tabular-nums flex items-center gap-1',
                    row.risk === 'critical' ? 'text-red-600' : row.risk === 'warn' ? 'text-amber-600' : 'text-matcha-600',
                  )}>
                    <Bike className="h-3 w-3 shrink-0" />
                    {row.driverName ?? 'Fahrer'} in {fmt(row.driverEtaSec)}
                  </span>
                )}
                {row.gapSec !== null && (
                  <span className={cn('text-[10px] font-bold tabular-nums rounded-full px-1.5 py-0.5',
                    row.gapSec < 0
                      ? 'bg-red-100 text-red-700'
                      : 'bg-matcha-100 text-matcha-700',
                  )}>
                    {row.gapSec < 0 ? `Fahrer ${fmt(Math.abs(row.gapSec))} zu früh` : `${fmt(row.gapSec)} Puffer`}
                  </span>
                )}
              </div>

              <div className={cn('shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black', s.badge)}>
                {s.label}
              </div>
            </div>
          );
        })}
      </div>

      {critical.length > 0 && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-100 text-[11px] font-bold text-red-700 flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {critical.length} Bestellung{critical.length !== 1 ? 'en' : ''} — Fahrer kommt bevor Essen fertig ist!
        </div>
      )}
    </Card>
  );
}
