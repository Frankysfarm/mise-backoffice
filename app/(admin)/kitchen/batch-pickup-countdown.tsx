'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, Bike, Package, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type BatchEntry = {
  batchId: string;
  driverName: string;
  totalOrders: number;
  readyOrders: number;
  eta_min: number | null;
  started_at: string | null;
};

function useCountdown(targetIso: string | null): number | null {
  const [sec, setSec] = useState<number | null>(null);
  useEffect(() => {
    if (!targetIso) return;
    const tick = () => {
      const diff = Math.round((new Date(targetIso).getTime() - Date.now()) / 1000);
      setSec(diff);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetIso]);
  return sec;
}

function fmtMmSs(sec: number): string {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const sign = sec < 0 ? '-' : '';
  return `${sign}${m}:${s.toString().padStart(2, '0')}`;
}

function urgencyFromSec(sec: number | null): 'ok' | 'soon' | 'critical' | 'late' {
  if (sec === null) return 'ok';
  if (sec < 0) return 'late';
  if (sec < 120) return 'critical';
  if (sec < 300) return 'soon';
  return 'ok';
}

const urgencyStyle = {
  ok:       { ring: 'border-matcha-300',  bg: 'bg-matcha-50',   text: 'text-matcha-700',   badge: 'bg-matcha-500 text-white',    label: 'Pünktlich'   },
  soon:     { ring: 'border-amber-300',   bg: 'bg-amber-50',    text: 'text-amber-700',    badge: 'bg-amber-400 text-white',     label: 'Bald'        },
  critical: { ring: 'border-red-400',     bg: 'bg-red-50',      text: 'text-red-700',      badge: 'bg-red-500 text-white',       label: 'Kritisch'    },
  late:     { ring: 'border-red-600',     bg: 'bg-red-100',     text: 'text-red-800',      badge: 'bg-red-700 text-white',       label: 'Überfällig'  },
};

function BatchRow({ entry }: { entry: BatchEntry }) {
  const targetIso = entry.eta_min != null && entry.started_at
    ? new Date(new Date(entry.started_at).getTime() + entry.eta_min * 60_000).toISOString()
    : null;
  const sec = useCountdown(targetIso);
  const urgency = urgencyFromSec(sec);
  const style = urgencyStyle[urgency];
  const allReady = entry.readyOrders >= entry.totalOrders;

  return (
    <div className={cn('flex items-center gap-3 rounded-xl border px-4 py-3 transition-all', style.ring, style.bg, urgency === 'critical' && 'animate-pulse')}>
      {/* Countdown ring placeholder */}
      <div className={cn('flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full border-2 font-mono font-black tabular-nums', style.ring, style.text)}>
        {sec !== null ? (
          <>
            <span className="text-xs leading-none">{sec < 0 ? '⚠' : <Clock className="h-3 w-3" />}</span>
            <span className="text-sm leading-tight">{fmtMmSs(sec)}</span>
          </>
        ) : (
          <span className="text-[10px] text-muted-foreground">–</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Bike className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="text-sm font-bold truncate">{entry.driverName}</span>
          <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-black', style.badge)}>
            {style.label}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Package className="h-3 w-3" />
            {entry.totalOrders} Bestellung{entry.totalOrders !== 1 ? 'en' : ''}
          </span>
          {allReady ? (
            <span className="flex items-center gap-1 text-matcha-600 font-semibold">
              <CheckCircle2 className="h-3 w-3" /> Alle fertig
            </span>
          ) : (
            <span className="flex items-center gap-1 text-amber-600 font-semibold">
              <AlertTriangle className="h-3 w-3" />
              {entry.readyOrders}/{entry.totalOrders} fertig
            </span>
          )}
        </div>
        {/* Progress bar */}
        <div className="mt-1.5 h-1.5 w-full rounded-full bg-black/10 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-700', allReady ? 'bg-matcha-500' : urgency === 'critical' ? 'bg-red-500' : 'bg-amber-400')}
            style={{ width: `${Math.round((entry.readyOrders / Math.max(1, entry.totalOrders)) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

type Props = {
  batches: Array<{
    id: string;
    driver_id: string;
    status: string;
    started_at: string | null;
    total_eta_min: number | null;
  }>;
  stops: Array<{
    id: string;
    batch_id: string;
    order_id: string;
    reihenfolge: number;
    angekommen_am: string | null;
    geliefert_am: string | null;
  }>;
  orders: Array<{
    id: string;
    bestellnummer: string;
    status: string;
  }>;
  drivers: Array<{
    id: string;
    vorname: string;
    nachname: string;
    status: {
      ist_online: boolean;
      fahrzeug: string | null;
      aktueller_batch_id: string | null;
    } | null;
  }>;
};

export function KitchenBatchPickupCountdown({ batches, stops, orders, drivers }: Props) {
  const activeBatches = batches.filter(b => b.status === 'in_progress' || b.status === 'assigned');

  const entries: BatchEntry[] = activeBatches.map(batch => {
    const driver = drivers.find(d => d.status?.aktueller_batch_id === batch.id);
    const batchStops = stops.filter(s => s.batch_id === batch.id);
    const batchOrderIds = new Set(batchStops.map(s => s.order_id));
    const batchOrders = orders.filter(o => batchOrderIds.has(o.id));
    const readyOrders = batchOrders.filter(o => o.status === 'fertig' || o.status === 'abgeholt').length;

    return {
      batchId: batch.id,
      driverName: driver ? `${driver.vorname} ${driver.nachname}` : 'Fahrer',
      totalOrders: batchOrders.length || batchStops.length,
      readyOrders,
      eta_min: batch.total_eta_min,
      started_at: batch.started_at,
    };
  });

  if (entries.length === 0) return null;

  const criticalCount = entries.filter(e => {
    const target = e.eta_min != null && e.started_at
      ? new Date(new Date(e.started_at).getTime() + e.eta_min * 60_000).getTime()
      : null;
    const sec = target ? Math.round((target - Date.now()) / 1000) : null;
    return urgencyFromSec(sec) === 'critical' || urgencyFromSec(sec) === 'late';
  }).length;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b">
        <Bike className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Abholung Countdown</span>
        <Badge variant="secondary" className="ml-auto text-[10px]">
          {entries.length} Tour{entries.length !== 1 ? 'en' : ''}
        </Badge>
        {criticalCount > 0 && (
          <Badge className="bg-red-500 text-white text-[10px] animate-pulse">
            {criticalCount} kritisch
          </Badge>
        )}
      </div>
      <div className="divide-y">
        {entries.map(e => (
          <div key={e.batchId} className="px-3 py-2">
            <BatchRow entry={e} />
          </div>
        ))}
      </div>
    </Card>
  );
}
