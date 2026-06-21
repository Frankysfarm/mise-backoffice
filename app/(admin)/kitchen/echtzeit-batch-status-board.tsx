'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Package, Clock, Truck, AlertTriangle, CheckCircle2, ChefHat } from 'lucide-react';

type BatchStop = {
  id: string;
  order_id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: {
    bestellnummer: string;
    kunde_name: string;
    status: string;
  } | null;
};

type Batch = {
  id: string;
  status: string;
  fahrer_id: string | null;
  startzeit: string | null;
  total_eta_min: number | null;
  zone: string | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: BatchStop[];
};

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  kunde_name: string;
};

interface Props {
  batches: Batch[];
  orders: Order[];
}

type UrgencyLevel = 'ok' | 'knapp' | 'kritisch' | 'überfällig';

function getBatchUrgency(batch: Batch, now: number): UrgencyLevel {
  if (!batch.startzeit || batch.status !== 'unterwegs') return 'ok';
  const elapsedMin = (now - new Date(batch.startzeit).getTime()) / 60_000;
  const etaMin = batch.total_eta_min ?? 30;
  const pct = elapsedMin / etaMin;
  if (pct >= 1.15) return 'überfällig';
  if (pct >= 0.9) return 'kritisch';
  if (pct >= 0.7) return 'knapp';
  return 'ok';
}

const urgencyStyle: Record<UrgencyLevel, { card: string; badge: string; label: string }> = {
  ok:          { card: 'border-matcha-200 bg-matcha-50',    badge: 'bg-matcha-500 text-white',  label: 'Auf Kurs'  },
  knapp:       { card: 'border-amber-300 bg-amber-50',      badge: 'bg-amber-400 text-white',   label: 'Knapp'     },
  kritisch:    { card: 'border-orange-400 bg-orange-50 animate-pulse', badge: 'bg-orange-500 text-white', label: 'Kritisch' },
  überfällig:  { card: 'border-red-500 bg-red-50 animate-pulse',       badge: 'bg-red-600 text-white',   label: 'Überfällig' },
};

function RemainingLabel({ batch, now }: { batch: Batch; now: number }) {
  if (!batch.startzeit || batch.status !== 'unterwegs') {
    return <span className="text-[10px] text-muted-foreground">—</span>;
  }
  const etaMin = batch.total_eta_min ?? 30;
  const elapsedMin = (now - new Date(batch.startzeit).getTime()) / 60_000;
  const remainMin = etaMin - elapsedMin;
  if (remainMin < 0) {
    return (
      <span className="font-mono text-xs font-black text-red-600">
        +{Math.abs(Math.round(remainMin))} Min
      </span>
    );
  }
  return (
    <span className="font-mono text-xs font-black text-foreground">
      {Math.round(remainMin)} Min
    </span>
  );
}

export function KitchenEchtzeitBatchStatusBoard({ batches, orders }: Props) {
  const [now, setNow] = useState(Date.now());
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(t);
  }, []);

  const activeBatches = batches.filter((b) =>
    ['zusammengestellt', 'unterwegs', 'bestätigt'].includes(b.status),
  );

  const pendingOrders = orders.filter((o) =>
    ['neu', 'bestätigt', 'in_zubereitung'].includes(o.status),
  );

  if (activeBatches.length === 0 && pendingOrders.length === 0) return null;

  return (
    <Card className="p-3 border rounded-xl shadow-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-matcha-600" />
          <span className="text-sm font-bold">Echtzeit-Batch-Status</span>
          <span className="text-[10px] font-bold rounded-full bg-matcha-100 text-matcha-700 px-2 py-0.5">
            {activeBatches.length} aktiv
          </span>
        </div>
        <ChefHat className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', open ? '' : 'rotate-180')} />
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {activeBatches.map((batch) => {
            const urgency = getBatchUrgency(batch, now);
            const style = urgencyStyle[urgency];
            const driverName = batch.fahrer
              ? `${batch.fahrer.vorname} ${batch.fahrer.nachname.charAt(0)}.`
              : 'Kein Fahrer';
            const completedStops = batch.stops.filter((s) => s.geliefert_am).length;
            const totalStops = batch.stops.length;
            const progressPct = totalStops > 0 ? (completedStops / totalStops) * 100 : 0;

            return (
              <div
                key={batch.id}
                className={cn('flex items-center gap-2 rounded-lg border px-3 py-2', style.card)}
              >
                <div className="shrink-0">
                  <Truck className="h-4 w-4 text-current opacity-60" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold truncate">{driverName}</span>
                    {batch.zone && (
                      <span className="text-[9px] rounded-full border border-current/20 px-1.5 py-px font-semibold">
                        Zone {batch.zone}
                      </span>
                    )}
                    <span className={cn('text-[9px] rounded-full px-1.5 py-px font-bold', style.badge)}>
                      {style.label}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="flex-1 h-1 rounded-full bg-black/10 overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-700',
                          urgency === 'ok' ? 'bg-matcha-500' :
                          urgency === 'knapp' ? 'bg-amber-400' :
                          urgency === 'kritisch' ? 'bg-orange-500' : 'bg-red-600',
                        )}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <span className="text-[9px] font-bold tabular-nums shrink-0 text-muted-foreground">
                      {completedStops}/{totalStops}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <RemainingLabel batch={batch} now={now} />
                  <div className="text-[8px] text-muted-foreground">verbleibend</div>
                </div>
              </div>
            );
          })}

          {pendingOrders.length > 0 && (
            <div className="mt-2 pt-2 border-t border-dashed">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                  Wartend auf Zubereitung ({pendingOrders.length})
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {pendingOrders.slice(0, 8).map((o) => {
                  const elapsedMin = o.bestellt_am
                    ? Math.floor((now - new Date(o.bestellt_am).getTime()) / 60_000)
                    : 0;
                  const targetMin = o.geschaetzte_zubereitung_min ?? 20;
                  const pct = elapsedMin / targetMin;
                  const chipColor =
                    o.status === 'in_zubereitung'
                      ? pct >= 1 ? 'bg-red-100 text-red-700 border-red-200'
                        : pct >= 0.7 ? 'bg-amber-100 text-amber-700 border-amber-200'
                        : 'bg-blue-100 text-blue-700 border-blue-200'
                      : 'bg-gray-100 text-gray-600 border-gray-200';
                  return (
                    <span
                      key={o.id}
                      className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold', chipColor)}
                    >
                      {o.status === 'in_zubereitung' ? (
                        <ChefHat className="h-2.5 w-2.5" />
                      ) : (
                        <AlertTriangle className="h-2.5 w-2.5" />
                      )}
                      #{o.bestellnummer}
                    </span>
                  );
                })}
                {pendingOrders.length > 8 && (
                  <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">
                    +{pendingOrders.length - 8} weitere
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
