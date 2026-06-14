'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MapPin, TrendingUp } from 'lucide-react';

type ZoneRow = {
  zone: string;
  orders: number;
  revenue: number;
  avgTime: number | null;
};

const ZONE_COLORS: Record<string, string> = {
  A: '#4ade80',
  B: '#60a5fa',
  C: '#fbbf24',
  D: '#f97316',
  E: '#c084fc',
};

function getZoneColor(zone: string): string {
  return ZONE_COLORS[zone.toUpperCase()] ?? '#94a3b8';
}

export function ZoneErtragPanel() {
  const [rows, setRows] = useState<ZoneRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    supabase
      .from('customer_orders')
      .select('delivery_zone, gesamtbetrag, geschaetzte_lieferung_min')
      .eq('typ', 'lieferung')
      .gte('bestellt_am', today.toISOString())
      .not('delivery_zone', 'is', null)
      .then(({ data }: { data: Array<{ delivery_zone: string; gesamtbetrag: number | null; geschaetzte_lieferung_min: number | null }> | null }) => {
        if (!data?.length) { setLoading(false); return; }

        const map = new Map<string, { orders: number; revenue: number; times: number[] }>();
        for (const o of data) {
          const z = o.delivery_zone.toUpperCase();
          if (!map.has(z)) map.set(z, { orders: 0, revenue: 0, times: [] });
          const row = map.get(z)!;
          row.orders += 1;
          row.revenue += o.gesamtbetrag ?? 0;
          if (o.geschaetzte_lieferung_min) row.times.push(o.geschaetzte_lieferung_min);
        }

        const result: ZoneRow[] = Array.from(map.entries())
          .map(([zone, d]) => ({
            zone,
            orders: d.orders,
            revenue: d.revenue,
            avgTime: d.times.length
              ? Math.round(d.times.reduce((a, b) => a + b, 0) / d.times.length)
              : null,
          }))
          .sort((a, b) => b.revenue - a.revenue);

        setRows(result);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading || rows.length === 0) return null;

  const maxRevenue = Math.max(...rows.map(r => r.revenue), 1);
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalOrders = rows.reduce((s, r) => s + r.orders, 0);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white">
      <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            <MapPin className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-bold text-char">Zonen-Ertrag Heute</div>
            <div className="text-xs text-stone-400">{rows.length} Zone{rows.length !== 1 ? 'n' : ''} · {totalOrders} Bestellungen</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-black tabular-nums text-stone-800">
            {totalRevenue.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-stone-400 flex items-center gap-1 justify-end">
            <TrendingUp className="h-2.5 w-2.5" /> Gesamtumsatz
          </div>
        </div>
      </div>
      <div className="p-5 space-y-4">
        {rows.map(row => {
          const pct = (row.revenue / maxRevenue) * 100;
          const color = getZoneColor(row.zone);
          const sharePct = totalRevenue > 0 ? Math.round((row.revenue / totalRevenue) * 100) : 0;
          return (
            <div key={row.zone}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div
                    className="h-6 w-6 rounded-md flex items-center justify-center text-[11px] font-black text-white shrink-0"
                    style={{ backgroundColor: color }}
                  >
                    {row.zone}
                  </div>
                  <span className="text-xs font-bold text-stone-700">Zone {row.zone}</span>
                  <span className="text-[10px] text-stone-400">{row.orders} Bestellung{row.orders !== 1 ? 'en' : ''}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-stone-400">{sharePct}%</span>
                  <span className="text-xs font-black tabular-nums text-stone-700">
                    {row.revenue.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
              <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, backgroundColor: color }}
                />
              </div>
              {row.avgTime !== null && (
                <div className="text-[9px] text-stone-400 mt-0.5">
                  Ø {row.avgTime} Min Lieferzeit
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
