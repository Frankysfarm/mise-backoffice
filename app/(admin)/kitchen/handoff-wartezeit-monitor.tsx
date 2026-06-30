'use client';

/**
 * Phase 519 — KitchenHandoffWartezeitMonitor
 *
 * Zeigt Bestellungen, die fertig zubereitet sind, aber noch nicht vom Fahrer abgeholt wurden.
 * Farbkodierung:
 *   ok      — keine Bestellungen warten
 *   warning — ≥ threshold_min Min Wartezeit
 *   critical — ≥ 2× threshold_min Min Wartezeit (blinkt)
 *
 * Pollt alle 30s /api/delivery/admin/kitchen-handoff-monitor.
 */

import { useEffect, useState, useCallback } from 'react';
import { Clock, Package, X, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HandoffOrder {
  orderId: string;
  bestellnummer: string;
  kundeName: string;
  fertigSeitMin: number;
  status: string;
}

interface HandoffData {
  alertLevel: 'ok' | 'warning' | 'critical';
  waitingCount: number;
  longestWaitMin: number;
  thresholdMin: number;
  avgWaitMin: number | null;
  orders: HandoffOrder[];
}

interface Props {
  locationId: string;
  thresholdMin?: number;
}

export function KitchenHandoffWartezeitMonitor({ locationId, thresholdMin = 10 }: Props) {
  const [data, setData] = useState<HandoffData | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [prevLevel, setPrevLevel] = useState<string>('ok');

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ location_id: locationId, threshold_min: String(thresholdMin) });
      const res = await fetch(`/api/delivery/admin/kitchen-handoff-monitor?${params}`);
      if (!res.ok) return;
      const json = await res.json();
      if (json.ok) {
        setData(json.data as HandoffData);
        const newLevel = json.data.alertLevel;
        // Re-show wenn Level eskaliert
        if (newLevel !== 'ok' && (newLevel === 'critical' && prevLevel !== 'critical')) {
          setDismissed(false);
        }
        setPrevLevel(newLevel);
      }
    } catch { /* silent */ }
  }, [locationId, thresholdMin, prevLevel]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  if (!data || data.alertLevel === 'ok') return null;
  if (dismissed) return null;

  const isCritical = data.alertLevel === 'critical';

  return (
    <div
      className={cn(
        'rounded-xl border p-4 mb-3 transition-all',
        isCritical
          ? 'border-red-400 bg-red-50 dark:bg-red-950/30 animate-pulse'
          : 'border-amber-300 bg-amber-50 dark:bg-amber-950/30'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {isCritical ? (
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
          ) : (
            <Clock className="h-5 w-5 text-amber-500 shrink-0" />
          )}
          <div>
            <p className={cn('font-semibold text-sm', isCritical ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300')}>
              {isCritical ? 'Kritische Abholverzögerung' : 'Bestellungen warten auf Abholung'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {data.waitingCount} {data.waitingCount === 1 ? 'Bestellung' : 'Bestellungen'} fertig
              {' '}· längste Wartezeit: {data.longestWaitMin} Min
              {data.avgWaitMin !== null && ` · Ø ${data.avgWaitMin} Min`}
            </p>
          </div>
        </div>
        <button onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5">
          <X className="h-4 w-4" />
        </button>
      </div>

      {data.orders.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {data.orders.slice(0, 8).map((o) => (
            <span
              key={o.orderId}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
                o.fertigSeitMin >= thresholdMin * 2
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
              )}
            >
              <Package className="h-3 w-3" />
              {o.bestellnummer}
              <span className="opacity-75">+{o.fertigSeitMin}m</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function KitchenHandoffStatusChip({ locationId }: { locationId: string }) {
  const [data, setData] = useState<HandoffData | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/kitchen-handoff-monitor?location_id=${locationId}`);
        if (!res.ok) return;
        const json = await res.json();
        if (json.ok) setData(json.data as HandoffData);
      } catch { /* silent */ }
    };
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!data || data.alertLevel === 'ok') return (
    <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
      <CheckCircle className="h-3 w-3" /> Alle abgeholt
    </span>
  );

  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-xs font-medium',
      data.alertLevel === 'critical' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
    )}>
      <Clock className="h-3 w-3" />
      {data.waitingCount} warten · max {data.longestWaitMin}m
    </span>
  );
}
