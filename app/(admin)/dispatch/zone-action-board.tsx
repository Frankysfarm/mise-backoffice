'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, Package, Clock, Zap, AlertTriangle, CheckCircle2, User } from 'lucide-react';

type ZoneSummary = {
  zone: string;
  readyCount: number;
  totalValue: number;
  oldestWaitMin: number;
  assignedDrivers: number;
  urgency: 'critical' | 'high' | 'normal' | 'idle';
  action: string;
};

const ZONE_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  A: { bg: 'bg-matcha-50', border: 'border-matcha-200', text: 'text-matcha-800', badge: 'bg-matcha-700 text-white' },
  B: { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-800',   badge: 'bg-blue-700 text-white' },
  C: { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-800',  badge: 'bg-amber-500 text-white' },
  D: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800', badge: 'bg-purple-700 text-white' },
};

const URGENCY_STYLE = {
  critical: { ring: 'ring-2 ring-red-400', indicator: 'bg-red-500 animate-pulse', label: 'Kritisch' },
  high:     { ring: 'ring-1 ring-amber-400', indicator: 'bg-amber-400', label: 'Dringend' },
  normal:   { ring: '',                    indicator: 'bg-matcha-500', label: 'Normal' },
  idle:     { ring: '',                    indicator: 'bg-muted-foreground/30', label: 'Frei' },
};

function calcUrgency(readyCount: number, oldestWaitMin: number, assignedDrivers: number): ZoneSummary['urgency'] {
  if (readyCount === 0) return 'idle';
  if (oldestWaitMin >= 12 && assignedDrivers === 0) return 'critical';
  if (oldestWaitMin >= 7 || (readyCount >= 3 && assignedDrivers === 0)) return 'high';
  return 'normal';
}

function calcAction(zone: ZoneSummary): string {
  if (zone.urgency === 'idle') return 'Keine Bestellungen';
  if (zone.urgency === 'critical') return '→ Sofort zuweisen!';
  if (zone.urgency === 'high') {
    if (zone.readyCount >= 2) return `→ Bündeln (${zone.readyCount})`;
    return '→ Fahrer zuweisen';
  }
  if (zone.assignedDrivers > 0) return `✓ ${zone.assignedDrivers} Fahrer aktiv`;
  return '→ Bei Bedarf bündeln';
}

export function DispatchZoneActionBoard({
  orders,
  batches,
}: {
  orders: {
    id: string;
    status: string;
    delivery_zone: string | null;
    gesamtbetrag: number;
    fertig_am: string | null;
  }[];
  batches: {
    id: string;
    status: string;
    zone: string | null;
    fahrer_id: string | null;
  }[];
}) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(iv);
  }, []);

  const now = Date.now();

  const zones = useMemo<ZoneSummary[]>(() => {
    const ZONES = ['A', 'B', 'C', 'D'];

    return ZONES.map((zone) => {
      const zoneOrders = orders.filter(
        (o) => o.status === 'fertig' && (o.delivery_zone ?? 'A') === zone,
      );
      const totalValue = zoneOrders.reduce((s, o) => s + (o.gesamtbetrag ?? 0), 0);

      const waits = zoneOrders
        .filter((o) => o.fertig_am)
        .map((o) => Math.floor((now - new Date(o.fertig_am!).getTime()) / 60_000));

      const oldestWaitMin = waits.length > 0 ? Math.max(...waits) : 0;

      const assignedDrivers = batches.filter(
        (b) => (b.zone ?? '') === zone && ['unterwegs', 'pickup', 'aktiv', 'on_route', 'assigned'].includes(b.status) && b.fahrer_id,
      ).length;

      const urgency = calcUrgency(zoneOrders.length, oldestWaitMin, assignedDrivers);

      const summary: ZoneSummary = {
        zone,
        readyCount: zoneOrders.length,
        totalValue,
        oldestWaitMin,
        assignedDrivers,
        urgency,
        action: '',
      };
      summary.action = calcAction(summary);
      return summary;
    });
  }, [orders, batches, now]);

  const hasActivity = zones.some((z) => z.readyCount > 0 || z.urgency !== 'idle');
  if (!hasActivity) return null;

  const criticalCount = zones.filter((z) => z.urgency === 'critical').length;

  return (
    <div className="rounded-xl border overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-card">
        <MapPin className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="font-display text-sm font-bold uppercase tracking-wider">
          Zonen-Aktions-Board
        </span>
        {criticalCount > 0 && (
          <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-[9px] font-black text-white animate-pulse">
            {criticalCount} Zone{criticalCount > 1 ? 'n' : ''} kritisch
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
        {zones.map((z) => {
          const zc = ZONE_COLORS[z.zone] ?? ZONE_COLORS['A'];
          const us = URGENCY_STYLE[z.urgency];

          return (
            <div
              key={z.zone}
              className={cn(
                'rounded-xl border p-3 flex flex-col gap-2 transition-all',
                zc.bg, zc.border, us.ring,
              )}
            >
              {/* Zone Header */}
              <div className="flex items-center justify-between">
                <div className={cn('rounded-lg px-2 py-0.5 text-xs font-black', zc.badge)}>
                  Zone {z.zone}
                </div>
                <div className={cn('h-2 w-2 rounded-full shrink-0', us.indicator)} />
              </div>

              {/* Bestellungen */}
              <div className="flex items-end gap-2">
                <div className="flex flex-col">
                  <span className={cn('text-2xl font-black tabular-nums leading-none', zc.text)}>
                    {z.readyCount}
                  </span>
                  <span className="text-[9px] font-bold text-muted-foreground">fertige Bestellungen</span>
                </div>
                {z.assignedDrivers > 0 && (
                  <div className="flex items-center gap-0.5 text-[9px] font-bold text-matcha-700 mb-0.5">
                    <User className="h-2.5 w-2.5" />
                    {z.assignedDrivers}
                  </div>
                )}
              </div>

              {/* Details */}
              {z.readyCount > 0 && (
                <div className="space-y-0.5">
                  {z.totalValue > 0 && (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                      <Package className="h-2.5 w-2.5" />
                      {z.totalValue.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                    </div>
                  )}
                  {z.oldestWaitMin > 0 && (
                    <div className={cn(
                      'flex items-center gap-1 text-[10px] font-bold',
                      z.oldestWaitMin >= 10 ? 'text-red-600' : z.oldestWaitMin >= 5 ? 'text-amber-600' : 'text-muted-foreground',
                    )}>
                      <Clock className="h-2.5 w-2.5" />
                      {z.oldestWaitMin}m warten
                    </div>
                  )}
                </div>
              )}

              {/* Action */}
              <div className={cn(
                'mt-auto rounded-lg px-2 py-1.5 text-[9px] font-black text-center',
                z.urgency === 'critical' ? 'bg-red-500 text-white' :
                z.urgency === 'high' ? 'bg-amber-400 text-white' :
                z.urgency === 'normal' ? 'bg-matcha-100 text-matcha-800' :
                'bg-muted/40 text-muted-foreground',
              )}>
                {z.action}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
