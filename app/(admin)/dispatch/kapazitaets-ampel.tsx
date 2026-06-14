'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Bike, AlertTriangle, CheckCircle2, Users, TrendingUp } from 'lucide-react';

type Driver = {
  employee_id: string;
  ist_online: boolean;
  aktueller_batch_id?: string | null;
};

type Batch = {
  id: string;
  status: string;
  driver_id: string | null;
  stops?: { geliefert_am: string | null }[];
};

type ReadyOrder = {
  id: string;
  status: string;
};

interface Props {
  drivers: Driver[];
  batches: Batch[];
  orders: ReadyOrder[];
}

type CapLevel = 'ok' | 'warning' | 'critical';

const LEVEL_META: Record<CapLevel, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  ok: {
    label: 'Kapazität OK',
    color: 'text-matcha-700',
    bg: 'bg-matcha-50',
    border: 'border-matcha-300',
    icon: <CheckCircle2 size={14} className="text-matcha-600" />,
  },
  warning: {
    label: 'Kapazität knapp',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    icon: <AlertTriangle size={14} className="text-amber-600" />,
  },
  critical: {
    label: 'Überlastet!',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-400',
    icon: <AlertTriangle size={14} className="text-red-600 animate-pulse" />,
  },
};

export function KapazitaetsAmpel({ drivers, batches, orders }: Props) {
  const { level, onlineCount, activeCount, queueCount, ratio, recommendation } = useMemo(() => {
    const onlineDrivers = drivers.filter(d => d.ist_online);
    const onlineCount = onlineDrivers.length;

    const activeCount = batches.filter(b =>
      ['unterwegs', 'on_route', 'aktiv', 'assigned'].includes(b.status),
    ).length;

    const queueCount = orders.filter(o => o.status === 'fertig').length;

    // Capacity ratio: (active batches + queued orders) vs available drivers
    const demand = activeCount + Math.ceil(queueCount / 2);
    const ratio = onlineCount > 0 ? demand / onlineCount : demand > 0 ? 99 : 0;

    const level: CapLevel =
      onlineCount === 0 && queueCount > 0 ? 'critical' :
      ratio >= 1.5 ? 'critical' :
      ratio >= 1.0 ? 'warning' :
      'ok';

    const recommendation =
      level === 'critical'
        ? queueCount > activeCount
          ? `${queueCount} Bestellungen warten — sofort weiteren Fahrer einsetzen`
          : `Alle Fahrer im Einsatz — kein Reserve verfügbar`
        : level === 'warning'
        ? `Kapazität wird knapp — bereit halten für neue Aufträge`
        : `Lieferbetrieb läuft optimal`;

    return { level, onlineCount, activeCount, queueCount, ratio, recommendation };
  }, [drivers, batches, orders]);

  const meta = LEVEL_META[level];
  const barPct = Math.min(100, Math.round(ratio * 60));

  return (
    <div className={cn('rounded-xl border p-3', meta.bg, meta.border)}>
      <div className="flex items-center gap-2 mb-2.5">
        {meta.icon}
        <span className={cn('text-[11px] font-black uppercase tracking-wider', meta.color)}>
          {meta.label}
        </span>
        {level === 'critical' && (
          <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-[9px] font-black text-white animate-pulse">
            ALERT
          </span>
        )}
      </div>

      {/* Auslastungsbalken */}
      <div className="mb-2 h-2 rounded-full bg-black/10 overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-700',
            level === 'ok' ? 'bg-matcha-500' :
            level === 'warning' ? 'bg-amber-500' :
            'bg-red-500',
          )}
          style={{ width: `${barPct}%` }}
        />
      </div>

      {/* KPI-Zeile */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center gap-1 text-[10px]">
          <Users size={10} className="text-muted-foreground" />
          <span className="font-bold tabular-nums">{onlineCount}</span>
          <span className="text-muted-foreground">online</span>
        </div>
        <div className="flex items-center gap-1 text-[10px]">
          <Bike size={10} className="text-muted-foreground" />
          <span className="font-bold tabular-nums">{activeCount}</span>
          <span className="text-muted-foreground">auf Tour</span>
        </div>
        <div className="flex items-center gap-1 text-[10px]">
          <TrendingUp size={10} className="text-muted-foreground" />
          <span className="font-bold tabular-nums">{queueCount}</span>
          <span className="text-muted-foreground">warten</span>
        </div>
      </div>

      <p className={cn('text-[10px] font-semibold leading-tight', meta.color)}>
        {recommendation}
      </p>
    </div>
  );
}
