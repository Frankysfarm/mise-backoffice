'use client';

import { useEffect, useState } from 'react';
import { BarChart2 } from 'lucide-react';
import { cn, euro } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

interface Props { locationId: string | null }

const ZONES = ['A', 'B', 'C', 'D'] as const;
type Zone = typeof ZONES[number];

const ZONE_STYLE: Record<Zone, { bg: string; text: string; badge: string; barColor: string }> = {
  A: { bg: 'bg-emerald-50', text: 'text-emerald-700', badge: 'bg-emerald-100', barColor: '#10b981' },
  B: { bg: 'bg-blue-50',    text: 'text-blue-700',    badge: 'bg-blue-100',    barColor: '#3b82f6' },
  C: { bg: 'bg-amber-50',   text: 'text-amber-700',   badge: 'bg-amber-100',   barColor: '#f59e0b' },
  D: { bg: 'bg-red-50',     text: 'text-red-700',     badge: 'bg-red-100',     barColor: '#ef4444' },
};

interface ZoneData { zone: Zone; orders: number; revenue: number; avg: number }

async function fetchData(locationId: string): Promise<ZoneData[]> {
  const sb = createClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data } = await sb
    .from('orders')
    .select('delivery_zone, gesamtbetrag')
    .eq('location_id', locationId)
    .eq('typ', 'lieferung')
    .in('status', ['geliefert', 'unterwegs', 'fertig'])
    .gte('bestellt_am', todayStart.toISOString());

  const rows = (data ?? []) as { delivery_zone: string | null; gesamtbetrag: number | null }[];
  return ZONES.map(zone => {
    const zr  = rows.filter(r => r.delivery_zone === zone);
    const cnt = zr.length;
    const rev = zr.reduce((s, r) => s + (r.gesamtbetrag ?? 0), 0);
    return { zone, orders: cnt, revenue: rev, avg: cnt > 0 ? rev / cnt : 0 };
  });
}

export function LieferdienstZoneUmsatzMatrix({ locationId }: Props) {
  const [data, setData] = useState<ZoneData[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    const load = () =>
      fetchData(locationId).then(d => { if (!cancelled) { setData(d); setLoaded(true); } }).catch(() => null);
    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (!locationId || !loaded || data.every(d => d.orders === 0)) return null;

  const maxOrders = Math.max(...data.map(d => d.orders), 1);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white">
      <div className="flex items-center gap-3 border-b border-stone-100 px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-matcha-100 text-matcha-700">
          <BarChart2 className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-bold text-char">Zonen-Umsatz heute</div>
          <div className="text-xs text-stone-400">Zonen A–D · aktive + gelieferte Bestellungen</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 p-5">
        {data.map(z => {
          const s = ZONE_STYLE[z.zone];
          return (
            <div key={z.zone} className={cn('rounded-xl p-3', s.bg)}>
              <div className="mb-2 flex items-center justify-between">
                <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-black', s.badge, s.text)}>
                  Zone {z.zone}
                </span>
                <span className={cn('text-xl font-black tabular-nums', s.text)}>{z.orders}</span>
              </div>
              <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-white/70">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${(z.orders / maxOrders) * 100}%`, background: s.barColor }}
                />
              </div>
              <div className="flex justify-between text-[9px] font-semibold text-stone-500">
                <span>{euro(z.revenue)}</span>
                <span>Ø {euro(z.avg)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
