'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { ArrowRight, Clock, Package, Truck, User, AlertTriangle, CheckCircle2, Zap } from 'lucide-react';

type BridgeItem = {
  orderId: string;
  bestellnummer: string;
  kundeName: string;
  fertigSeit: number; // Minuten
  driverName: string | null;
  driverEtaMin: number | null;
  zone: string | null;
  action: 'hold' | 'ready' | 'urgent' | 'no_driver';
};

function calcAction(fertigSeit: number, driverEtaMin: number | null): BridgeItem['action'] {
  if (driverEtaMin === null) return 'no_driver';
  const gap = driverEtaMin - fertigSeit;
  if (gap > 8) return 'hold';
  if (gap >= -2) return 'ready';
  return 'urgent';
}

const ACTION_STYLE = {
  hold:      { bg: 'bg-blue-50',    border: 'border-blue-200',   text: 'text-blue-800',   label: 'Warmhalten',  icon: Clock },
  ready:     { bg: 'bg-matcha-50',  border: 'border-matcha-200', text: 'text-matcha-800', label: 'Abgabe bereit', icon: CheckCircle2 },
  urgent:    { bg: 'bg-red-50',     border: 'border-red-200',    text: 'text-red-800',    label: 'Fahrer überfällig', icon: AlertTriangle },
  no_driver: { bg: 'bg-amber-50',   border: 'border-amber-200',  text: 'text-amber-800',  label: 'Kein Fahrer', icon: AlertTriangle },
};

export function KitchenDispatchBridgePanel({
  orders,
  batches,
  drivers,
}: {
  orders: { id: string; bestellnummer: string; status: string; fertig_am: string | null; kunde_name: string; delivery_zone: string | null }[];
  batches: { id: string; driver_id: string; status: string; started_at: string | null; total_eta_min: number | null }[];
  drivers: { id: string; vorname: string; nachname: string; status: { ist_online: boolean; aktueller_batch_id: string | null; last_update: string | null } | null }[];
}) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(iv);
  }, []);

  const now = Date.now();

  const fertigeOrders = orders.filter((o) => o.status === 'fertig' && o.fertig_am);

  if (fertigeOrders.length === 0) return null;

  const items: BridgeItem[] = fertigeOrders.map((order) => {
    const fertigMs = order.fertig_am ? now - new Date(order.fertig_am).getTime() : 0;
    const fertigSeit = Math.max(0, Math.floor(fertigMs / 60_000));

    // Finde zugehörigen Fahrer (über batch)
    const activeBatch = batches.find((b) =>
      ['pickup', 'aktiv', 'unterwegs', 'assigned'].includes(b.status)
    );
    const driver = activeBatch
      ? drivers.find((d) => d.id === activeBatch.driver_id)
      : null;

    const driverName = driver ? `${driver.vorname} ${driver.nachname[0]}.` : null;

    // Grobe ETA-Schätzung: batch started + total_eta - elapsed
    let driverEtaMin: number | null = null;
    if (activeBatch?.started_at && activeBatch.total_eta_min) {
      const elapsed = Math.floor((now - new Date(activeBatch.started_at).getTime()) / 60_000);
      driverEtaMin = Math.max(0, activeBatch.total_eta_min - elapsed);
    } else if (driver?.status?.ist_online) {
      driverEtaMin = 5; // Schätzung: 5 Min für freien Fahrer
    }

    return {
      orderId: order.id,
      bestellnummer: order.bestellnummer,
      kundeName: order.kunde_name,
      fertigSeit,
      driverName,
      driverEtaMin,
      zone: order.delivery_zone,
      action: calcAction(fertigSeit, driverEtaMin),
    };
  }).sort((a, b) => {
    const order = ['urgent', 'no_driver', 'ready', 'hold'];
    return order.indexOf(a.action) - order.indexOf(b.action);
  });

  const urgentCount = items.filter((i) => i.action === 'urgent' || i.action === 'no_driver').length;

  return (
    <div className="rounded-xl border overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-card">
        <Zap className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="font-display text-sm font-bold uppercase tracking-wider">
          Küchen-Dispatch-Bridge
        </span>
        <span className="text-[10px] font-bold text-muted-foreground">
          {items.length} fertige Bestellungen
        </span>
        {urgentCount > 0 && (
          <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-[9px] font-black text-white animate-pulse">
            {urgentCount} dringend
          </span>
        )}
      </div>

      <div className="divide-y">
        {items.slice(0, 6).map((item) => {
          const s = ACTION_STYLE[item.action];
          const ActionIcon = s.icon;
          return (
            <div key={item.orderId} className={cn('flex items-center gap-3 px-4 py-2.5', s.bg)}>
              {/* Bestellnummer */}
              <div className="shrink-0 w-16">
                <div className="font-mono text-xs font-black text-foreground">#{item.bestellnummer.slice(-4)}</div>
                {item.zone && (
                  <div className="text-[9px] font-bold text-muted-foreground">Zone {item.zone}</div>
                )}
              </div>

              {/* Fertig seit */}
              <div className="shrink-0 text-center w-14">
                <div className="flex items-center gap-1">
                  <Package className="h-3 w-3 text-muted-foreground" />
                  <span className={cn(
                    'font-mono text-xs font-black tabular-nums',
                    item.fertigSeit >= 10 ? 'text-red-600' : item.fertigSeit >= 5 ? 'text-amber-600' : 'text-matcha-600',
                  )}>
                    {item.fertigSeit}m
                  </span>
                </div>
                <div className="text-[8px] text-muted-foreground">fertig seit</div>
              </div>

              <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />

              {/* Fahrer ETA */}
              <div className="shrink-0 text-center w-14">
                {item.driverName ? (
                  <>
                    <div className="flex items-center gap-1">
                      <Truck className="h-3 w-3 text-muted-foreground" />
                      <span className="font-mono text-xs font-black tabular-nums text-foreground">
                        {item.driverEtaMin !== null ? `${item.driverEtaMin}m` : '–'}
                      </span>
                    </div>
                    <div className="text-[8px] text-muted-foreground truncate max-w-[56px]">{item.driverName}</div>
                  </>
                ) : (
                  <>
                    <User className="h-3 w-3 text-muted-foreground mx-auto" />
                    <div className="text-[8px] text-amber-600 font-bold">Kein Fahrer</div>
                  </>
                )}
              </div>

              {/* Action Badge */}
              <div className={cn(
                'ml-auto shrink-0 flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-black',
                s.bg, s.text, s.border, 'border',
              )}>
                <ActionIcon className="h-2.5 w-2.5" />
                {s.label}
              </div>
            </div>
          );
        })}
      </div>

      {items.length > 6 && (
        <div className="px-4 py-2 border-t bg-muted/20 text-[10px] text-muted-foreground">
          +{items.length - 6} weitere fertige Bestellungen
        </div>
      )}
    </div>
  );
}
