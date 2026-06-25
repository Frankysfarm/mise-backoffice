'use client';

/**
 * Phase 501 — Abholbereitschafts-Board
 *
 * Zeigt alle "fertig"-Bestellungen und wie lange sie schon warten:
 * - Ampel-Farbkodierung: grün (<5 Min), amber (5-10 Min), rot (>10 Min)
 * - Wartezeit-Countdown je Bestellung
 * - Fahrer-Zuordnung falls bekannt
 * - Automatischer Refresh alle 30 Sekunden
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, AlertTriangle, Package } from 'lucide-react';

interface Order {
  id: string;
  bestellnummer: string;
  status: string;
  fertig_am: string | null;
  kunde_name?: string | null;
  typ: string;
}

interface Driver {
  id: string;
  vorname: string;
  nachname: string;
  status: { aktueller_batch_id: string | null } | null;
}

interface Batch {
  id: string;
  driver_id: string;
  status: string;
}

interface Stop {
  batch_id: string;
  order_id: string;
  geliefert_am: string | null;
}

interface Props {
  orders: Order[];
  drivers: Driver[];
  batches: Batch[];
  stops: Stop[];
}

type WaitBand = 'ok' | 'warning' | 'critical';

function waitBand(waitMin: number): WaitBand {
  if (waitMin >= 10) return 'critical';
  if (waitMin >= 5)  return 'warning';
  return 'ok';
}

const BAND_STYLES: Record<WaitBand, { bg: string; badge: string; text: string }> = {
  ok:       { bg: 'bg-matcha-50',  badge: 'bg-matcha-100 text-matcha-800',  text: 'text-matcha-700' },
  warning:  { bg: 'bg-amber-50',   badge: 'bg-amber-100 text-amber-800',    text: 'text-amber-700' },
  critical: { bg: 'bg-red-50',     badge: 'bg-red-100 text-red-800',        text: 'text-red-700' },
};

export function KitchenPhase501AbholbereitschaftsBoard({ orders, drivers, batches, stops }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(iv);
  }, []);

  const readyOrders = orders.filter(
    (o) => o.status === 'fertig' && o.fertig_am,
  );

  if (readyOrders.length === 0) return null;

  // Build a driver lookup by batch
  const batchDriverMap = new Map<string, string>();
  for (const b of batches) batchDriverMap.set(b.id, b.driver_id);
  const driverNameMap = new Map<string, string>();
  for (const d of drivers) driverNameMap.set(d.id, `${d.vorname} ${d.nachname}`);

  const stopBatchMap = new Map<string, string>();
  for (const s of stops) if (!s.geliefert_am) stopBatchMap.set(s.order_id, s.batch_id);

  const rows = readyOrders
    .map((o) => {
      const fertigMs = new Date(o.fertig_am!).getTime();
      const waitMin = Math.floor((now - fertigMs) / 60_000);
      const band = waitBand(Math.max(0, waitMin));
      const batchId = stopBatchMap.get(o.id);
      const driverId = batchId ? batchDriverMap.get(batchId) : undefined;
      const driverName = driverId ? driverNameMap.get(driverId) : undefined;
      return { order: o, waitMin: Math.max(0, waitMin), band, driverName };
    })
    .sort((a, b) => b.waitMin - a.waitMin);

  const critCount = rows.filter((r) => r.band === 'critical').length;
  const warnCount = rows.filter((r) => r.band === 'warning').length;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-muted/40 transition text-left"
      >
        <CheckCircle2 className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="font-display text-sm font-bold uppercase tracking-wider flex-1">
          Abholbereitschaft
        </span>
        {critCount > 0 && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-700">
            {critCount} &gt;10 Min
          </span>
        )}
        {warnCount > 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700">
            {warnCount} &gt;5 Min
          </span>
        )}
        <span className="text-[10px] text-muted-foreground">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t divide-y">
          {rows.map(({ order, waitMin, band, driverName }) => {
            const s = BAND_STYLES[band];
            return (
              <div key={order.id} className={cn('flex items-center gap-3 px-4 py-2.5', s.bg)}>
                <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold">#{order.bestellnummer}</span>
                    {order.kunde_name && (
                      <span className="text-xs text-muted-foreground truncate">{order.kunde_name}</span>
                    )}
                    {order.typ === 'abholung' && (
                      <span className="text-[9px] rounded-full bg-white border px-1.5 py-0.5 font-bold">
                        Selbstabholung
                      </span>
                    )}
                  </div>
                  {driverName && (
                    <div className="text-[10px] text-muted-foreground mt-0.5">Fahrer: {driverName}</div>
                  )}
                </div>
                <div className={cn('flex items-center gap-1 shrink-0', s.text)}>
                  {band === 'critical' ? (
                    <AlertTriangle className="h-3.5 w-3.5" />
                  ) : (
                    <Clock className="h-3.5 w-3.5" />
                  )}
                  <span className="font-mono text-sm font-black tabular-nums">{waitMin} Min</span>
                </div>
                <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black', s.badge)}>
                  {band === 'critical' ? 'Dringend' : band === 'warning' ? 'Warten' : 'Bereit'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
