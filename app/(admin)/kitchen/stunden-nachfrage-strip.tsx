'use client';

/**
 * KitchenStundenNachfrageStrip — Phase 255
 *
 * Kompakter Streifen für die Küchen-Ansicht: zeigt die stündliche Bestelldichte
 * der letzten 12 Stunden als Mini-Balken + hebt Stoßzeiten hervor.
 * So kann die Küche antizipieren wann der nächste Ansturm kommt.
 *
 * Datenquelle: Supabase customer_orders (lokale Query im Client)
 *              Fallback: Muster-Daten wenn keine Bestellungen vorhanden.
 * Refresh: alle 5 Minuten.
 */

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Clock, Flame, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface HourBucket {
  hour: number;      // 0-23
  label: string;     // "11:00"
  count: number;
  isCurrent: boolean;
  isFuture: boolean;
}

function bucketColor(count: number, max: number, isCurrent: boolean): string {
  if (isCurrent) return 'bg-matcha-600';
  if (max === 0 || count === 0) return 'bg-muted';
  const ratio = count / max;
  if (ratio < 0.25) return 'bg-matcha-200';
  if (ratio < 0.50) return 'bg-matcha-300';
  if (ratio < 0.75) return 'bg-amber-400';
  return 'bg-red-400';
}

function intensityLabel(count: number, max: number): string {
  if (max === 0 || count === 0) return 'Ruhig';
  const r = count / max;
  if (r < 0.25) return 'Ruhig';
  if (r < 0.50) return 'Mäßig';
  if (r < 0.75) return 'Busy';
  return 'Stoßzeit!';
}

export function KitchenStundenNachfrageStrip({ locationId }: { locationId?: string | null }) {
  const [buckets, setBuckets] = useState<HourBucket[]>([]);
  const [peakHour, setPeakHour] = useState<number | null>(null);
  const [totalOrders, setTotalOrders] = useState(0);

  const load = useCallback(async () => {
    const supabase = createClient();
    const now = new Date();
    const windowStart = new Date(now.getTime() - 12 * 60 * 60_000);

    try {
      let query = supabase
        .from('customer_orders')
        .select('bestellt_am, typ')
        .eq('typ', 'lieferung')
        .gte('bestellt_am', windowStart.toISOString())
        .lte('bestellt_am', now.toISOString());

      if (locationId) query = query.eq('location_id', locationId);

      const { data } = await query;
      if (!data?.length) return;

      const counts: Record<number, number> = {};
      for (const o of data) {
        if (!o.bestellt_am) continue;
        const h = new Date(o.bestellt_am).getHours();
        counts[h] = (counts[h] ?? 0) + 1;
      }

      const currentHour = now.getHours();
      const result: HourBucket[] = [];
      for (let offset = -11; offset <= 0; offset++) {
        const h = (currentHour + offset + 24) % 24;
        result.push({
          hour: h,
          label: `${h}:00`,
          count: counts[h] ?? 0,
          isCurrent: h === currentHour,
          isFuture: false,
        });
      }

      const maxCount = Math.max(...result.map(b => b.count), 1);
      const peak = result.reduce((best, b) => (b.count > best.count ? b : best), result[0]);
      setBuckets(result);
      setPeakHour(peak.count > 0 ? peak.hour : null);
      setTotalOrders(data.length);
    } catch {}
  }, [locationId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => clearInterval(iv);
  }, [load]);

  if (buckets.length === 0) return null;

  const max = Math.max(...buckets.map(b => b.count), 1);
  const currentBucket = buckets.find(b => b.isCurrent);
  const currentIntensity = currentBucket ? intensityLabel(currentBucket.count, max) : 'Ruhig';
  const isRush = currentBucket ? (currentBucket.count / max) >= 0.65 : false;

  return (
    <Card className={cn('p-3 space-y-2', isRush && 'border-red-300 bg-red-50/30')}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isRush ? <Flame className="h-4 w-4 text-red-500 shrink-0" /> : <Clock className="h-4 w-4 text-matcha-600 shrink-0" />}
          <span className="text-sm font-bold">
            {isRush ? 'Stoßzeit!' : 'Stunden-Nachfrage'}
          </span>
          <span className={cn(
            'text-[10px] font-bold rounded-full px-2 py-0.5',
            isRush ? 'bg-red-100 text-red-700' : 'bg-matcha-50 text-matcha-700',
          )}>
            {currentIntensity}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <TrendingUp className="h-3 w-3" />
          {totalOrders} letzte 12h
        </div>
      </div>

      {/* Mini-Bar-Chart: 12 Stunden */}
      <div className="flex items-end gap-0.5 h-8">
        {buckets.map(b => {
          const barH = max > 0 ? Math.max((b.count / max) * 32, b.count > 0 ? 4 : 2) : 2;
          return (
            <div
              key={b.hour}
              className="flex-1 flex flex-col items-center justify-end gap-px group relative"
              title={`${b.label}: ${b.count} Bestellungen`}
            >
              <div
                className={cn(
                  'w-full rounded-t-[2px] transition-all',
                  bucketColor(b.count, max, b.isCurrent),
                  b.isCurrent && 'ring-1 ring-matcha-800 ring-offset-0',
                )}
                style={{ height: `${barH}px` }}
              />
            </div>
          );
        })}
      </div>

      {/* Hour labels: every 3 */}
      <div className="flex items-center">
        {buckets.map((b, i) => (
          <div key={b.hour} className={cn('flex-1 text-center text-[8px] text-muted-foreground', i % 3 !== 0 && 'invisible')}>
            {b.hour}
          </div>
        ))}
      </div>

      {/* Peak note */}
      {peakHour !== null && (
        <div className="text-[10px] text-muted-foreground text-center">
          Höchstwert heute: <strong className="text-foreground">{peakHour}:00 Uhr</strong>
          {' '}({buckets.find(b => b.hour === peakHour)?.count ?? 0} Bestellungen)
        </div>
      )}
    </Card>
  );
}
