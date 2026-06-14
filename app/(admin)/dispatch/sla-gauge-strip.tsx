'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Clock, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

type Stop = {
  id: string;
  order_id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: {
    bestellnummer: string;
    kunde_name: string;
    kunde_adresse: string | null;
    eta_earliest: string | null;
    eta_latest: string | null;
  } | null;
};

type Batch = {
  id: string;
  status: string;
  fahrer_id: string | null;
  startzeit?: string | null;
  total_eta_min: number | null;
  zone: string | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: Stop[];
};

type Driver = {
  employee_id: string;
  ist_online: boolean;
  employee: { id: string; vorname: string; nachname: string; avatar_url: string | null; telefon: string | null } | null;
};

type Props = {
  batches: Batch[];
  drivers: Driver[];
};

type SLAStatus = 'on_time' | 'at_risk' | 'late' | 'delivered';

function getSlaStatus(batch: Batch): { status: SLAStatus; remainMin: number | null } {
  const activeStop = batch.stops.find(s => !s.geliefert_am);
  if (!activeStop) return { status: 'delivered', remainMin: null };

  const etaEarliest = activeStop.order?.eta_earliest;
  if (etaEarliest) {
    const remainMin = Math.floor((new Date(etaEarliest).getTime() - Date.now()) / 60_000);
    if (remainMin < 0) return { status: 'late', remainMin: Math.abs(remainMin) };
    if (remainMin < 5) return { status: 'at_risk', remainMin };
    return { status: 'on_time', remainMin };
  }

  if (batch.startzeit && batch.total_eta_min) {
    const etaMs = new Date(batch.startzeit).getTime() + batch.total_eta_min * 60_000;
    const remainMin = Math.floor((etaMs - Date.now()) / 60_000);
    if (remainMin < 0) return { status: 'late', remainMin: Math.abs(remainMin) };
    if (remainMin < 5) return { status: 'at_risk', remainMin };
    return { status: 'on_time', remainMin };
  }

  return { status: 'on_time', remainMin: null };
}

const STATUS_CFG: Record<SLAStatus, {
  Icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  barColor: string;
  label: string;
}> = {
  on_time:   { Icon: CheckCircle2,  color: 'text-matcha-600', bg: 'bg-matcha-50/70', barColor: 'bg-matcha-500', label: 'Pünktlich'  },
  at_risk:   { Icon: AlertTriangle, color: 'text-amber-600',  bg: 'bg-amber-50/70',  barColor: 'bg-amber-400',  label: 'Knapp'     },
  late:      { Icon: XCircle,       color: 'text-red-600',    bg: 'bg-red-50/70',    barColor: 'bg-red-500',    label: 'Überfällig' },
  delivered: { Icon: CheckCircle2,  color: 'text-stone-400',  bg: 'bg-stone-50/50',  barColor: 'bg-stone-300',  label: 'Abgeschlossen' },
};

export function DispatchSLAGaugeStrip({ batches, drivers }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 30_000);
    return () => clearInterval(iv);
  }, []);

  const ACTIVE_STATUSES = new Set(['pickup', 'unterwegs', 'assigned', 'at_restaurant', 'on_route', 'pending_acceptance']);
  const activeBatches = batches.filter(b => ACTIVE_STATUSES.has(b.status));

  if (activeBatches.length === 0) return null;

  const rows = activeBatches.map(b => {
    const { status, remainMin } = getSlaStatus(b);
    const driverName = b.fahrer
      ? `${b.fahrer.vorname} ${b.fahrer.nachname[0]}.`
      : (() => {
          const d = drivers.find(d => d.employee_id === b.fahrer_id);
          return d?.employee ? `${d.employee.vorname} ${d.employee.nachname[0]}.` : 'Fahrer';
        })();
    const deliveredStops = b.stops.filter(s => s.geliefert_am).length;
    return { batch: b, status, remainMin, driverName, deliveredStops, totalStops: b.stops.length };
  });

  const onTimeCount = rows.filter(r => r.status === 'on_time' || r.status === 'delivered').length;
  const slaRate = rows.length > 0 ? Math.round((onTimeCount / rows.length) * 100) : 100;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-xs font-bold uppercase tracking-wider">SLA Live-Status</span>
          <span className={cn(
            'rounded-full px-2 py-0.5 text-[9px] font-black',
            slaRate >= 90 ? 'bg-matcha-100 text-matcha-700' :
            slaRate >= 70 ? 'bg-amber-100 text-amber-700' :
            'bg-red-100 text-red-700',
          )}>
            {slaRate}% pünktlich
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {activeBatches.length} Tour{activeBatches.length !== 1 ? 'en' : ''}
        </span>
      </div>
      <div className="divide-y">
        {rows.map(row => {
          const cfg = STATUS_CFG[row.status];
          const Icon = cfg.Icon;
          const progressPct = row.totalStops > 0 ? (row.deliveredStops / row.totalStops) * 100 : 0;
          return (
            <div key={row.batch.id} className={cn('flex items-center gap-3 px-4 py-2.5', cfg.bg)}>
              <Icon className={cn('h-4 w-4 shrink-0', cfg.color)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold">{row.driverName}</span>
                  {row.batch.zone && (
                    <span className="text-[9px] bg-white/60 border rounded-full px-1.5 py-0.5 font-bold">
                      Zone {row.batch.zone}
                    </span>
                  )}
                  <span className={cn('text-[9px] font-black', cfg.color)}>{cfg.label}</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex-1 h-1 rounded-full bg-black/10 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500', cfg.barColor)}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground font-bold shrink-0">
                    {row.deliveredStops}/{row.totalStops}
                  </span>
                </div>
              </div>
              {row.remainMin !== null && row.status !== 'delivered' && (
                <div className="shrink-0 text-right">
                  <div className={cn('font-mono text-sm font-black tabular-nums', cfg.color)}>
                    {row.status === 'late' ? '-' : ''}{row.remainMin}m
                  </div>
                  <div className="text-[8px] text-muted-foreground">
                    {row.status === 'late' ? 'überfällig' : 'verbleibend'}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
