'use client';

import React, { useMemo } from 'react';
import { Bike, Package, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  orders: { id: string; status: string; fahrer_id?: string | null }[];
  drivers: { id?: string; employee_id: string; is_available?: boolean; ist_online?: boolean }[];
}

export function DispatchLiveKapazitaetsAlert({ orders, drivers }: Props) {
  const { pending, available, level, label } = useMemo(() => {
    const PENDING_STATUSES = new Set(['bestätigt', 'neu', 'wartend']);
    const pending = orders.filter((o) => PENDING_STATUSES.has(o.status)).length;
    const available = drivers.filter((d) => d.is_available === true || d.ist_online === true).length;

    let level: 'ok' | 'tight' | 'critical' = 'ok';
    let label = 'Kapazität OK';

    if (pending === 0) return { pending, available, level: 'ok' as const, label: 'Keine offenen Bestellungen' };

    const ratio = available === 0 ? Infinity : pending / available;
    if (available === 0 || ratio > 5) { level = 'critical'; label = 'ENGPASS — Sofort handeln'; }
    else if (ratio > 3) { level = 'tight'; label = 'Knapp'; }

    return { pending, available, level, label };
  }, [orders, drivers]);

  if (pending === 0) return null;

  const colors = {
    ok: 'bg-matcha-50 border-matcha-200 text-matcha-800',
    tight: 'bg-yellow-50 border-yellow-300 text-yellow-800',
    critical: 'bg-red-50 border-red-400 text-red-800',
  };
  const labelColors = {
    ok: 'text-matcha-700 font-semibold',
    tight: 'text-yellow-700 font-semibold',
    critical: 'text-red-700 font-bold animate-pulse',
  };

  return (
    <div className={cn('flex items-center gap-3 rounded-lg border px-4 py-2 text-sm', colors[level])}>
      {level === 'critical' && <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />}
      <span className="flex items-center gap-1 text-xs">
        <Package className="h-3.5 w-3.5" />
        <span className="font-medium">{pending}</span> offen
      </span>
      <span className="text-gray-300">|</span>
      <span className="flex items-center gap-1 text-xs">
        <Bike className="h-3.5 w-3.5" />
        <span className="font-medium">{available}</span> frei
      </span>
      <span className="text-gray-300">|</span>
      <span className={cn('text-xs', labelColors[level])}>{label}</span>
    </div>
  );
}
