'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Package, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  locationId: string | null;
}

interface WaitingOrder {
  id: string;
  bestellnummer: string;
  fertig_am: string | null;
  zone: string | null;
  waitMin: number;
}

export function KitchenBatchAbholbereitBoard({ locationId }: Props) {
  const supabase = createClient();
  const [orders, setOrders] = useState<WaitingOrder[]>([]);
  const [, setTick] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!locationId) return;

    async function load() {
      const since = new Date(Date.now() - 90 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('customer_orders')
        .select('id,bestellnummer,fertig_am,delivery_zone')
        .eq('location_id', locationId)
        .eq('status', 'fertig')
        .eq('typ', 'lieferung')
        .gte('fertig_am', since)
        .order('fertig_am', { ascending: true })
        .limit(10);

      if (!mountedRef.current) return;
      const now = Date.now();
      setOrders(
        (data ?? []).map((r: { id: string; bestellnummer: string; fertig_am: string | null; delivery_zone: string | null }) => ({
          id: r.id,
          bestellnummer: r.bestellnummer,
          fertig_am: r.fertig_am,
          zone: r.delivery_zone ?? null,
          waitMin: r.fertig_am ? Math.floor((now - new Date(r.fertig_am).getTime()) / 60_000) : 0,
        })),
      );
    }

    load();
    const loadIv = setInterval(load, 30_000);
    const tickIv = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => { clearInterval(loadIv); clearInterval(tickIv); };
  }, [locationId]);

  if (!locationId || orders.length === 0) return null;

  const urgent = orders.filter((o) => o.waitMin >= 10);

  return (
    <div className={cn(
      'rounded-2xl border overflow-hidden',
      urgent.length > 0 ? 'border-red-300' : 'border-amber-300',
    )}>
      <div className={cn(
        'flex items-center gap-2 px-4 py-2.5 border-b',
        urgent.length > 0 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200',
      )}>
        <Package className={cn('h-4 w-4 shrink-0', urgent.length > 0 ? 'text-red-600' : 'text-amber-600')} />
        <span className={cn('text-xs font-bold uppercase tracking-wider', urgent.length > 0 ? 'text-red-900' : 'text-amber-900')}>
          Warten auf Abholung
        </span>
        <span className={cn(
          'ml-auto rounded-full px-2 py-0.5 text-[9px] font-black text-white',
          urgent.length > 0 ? 'bg-red-500' : 'bg-amber-500',
        )}>
          {orders.length} Bestellung{orders.length !== 1 ? 'en' : ''}
        </span>
      </div>
      <div className="divide-y bg-white">
        {orders.map((o) => (
          <div key={o.id} className="flex items-center gap-3 px-4 py-2.5">
            <div className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
              o.waitMin >= 15 ? 'bg-red-100 text-red-600' :
              o.waitMin >= 10 ? 'bg-orange-100 text-orange-600' : 'bg-amber-100 text-amber-600',
            )}>
              {o.waitMin >= 10 ? <AlertCircle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold">#{o.bestellnummer}</span>
                {o.zone && (
                  <span className="text-[9px] rounded-full bg-muted px-1.5 py-0.5 font-bold">Zone {o.zone}</span>
                )}
              </div>
              <div className={cn(
                'text-[10px] font-bold tabular-nums',
                o.waitMin >= 15 ? 'text-red-600' : o.waitMin >= 10 ? 'text-orange-600' : 'text-amber-600',
              )}>
                {o.waitMin} Min wartend
              </div>
            </div>
            {o.waitMin >= 15 && (
              <span className="shrink-0 text-[9px] font-black text-red-600 animate-pulse">DRINGEND</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
