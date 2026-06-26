'use client';

import { useEffect, useState } from 'react';
import { BarChart2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DriverEff {
  id: string;
  name: string;
  ordersToday: number;
  hoursActive: number;
  ordersPerHour: number;
  status: 'hoch' | 'normal' | 'niedrig';
}

interface ApiResponse {
  ok: boolean;
  drivers: DriverEff[];
  avgOrdersPerHour: number;
  generatedAt: string;
}

interface Props {
  locationId: string | null;
}

const STATUS_CONFIG: Record<DriverEff['status'], { label: string; bg: string; text: string }> = {
  hoch:    { label: 'Hoch',    bg: 'bg-matcha-100', text: 'text-matcha-700' },
  normal:  { label: 'Normal',  bg: 'bg-blue-100',   text: 'text-blue-700' },
  niedrig: { label: 'Niedrig', bg: 'bg-amber-100',  text: 'text-amber-700' },
};

export function DispatchFahrerEinsatzEffizienz({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!locationId) return;
    fetch(`/api/delivery/admin/fahrer-einsatz-effizienz?location_id=${encodeURIComponent(locationId)}`)
      .then((r) => r.json())
      .then((d: ApiResponse) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 90_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId) return null;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-stone-100">
        <BarChart2 className="h-4 w-4 text-blue-600 shrink-0" />
        <span className="font-display text-sm font-bold uppercase tracking-wider">Fahrer-Einsatz-Effizienz</span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-1" />}
        {data && !loading && (
          <span className="ml-auto rounded-full bg-blue-100 text-blue-700 px-2.5 py-0.5 text-[10px] font-bold">
            {data.drivers.length} online
          </span>
        )}
      </div>

      {loading && !data ? (
        <div className="px-5 py-6 space-y-2 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 bg-stone-100 rounded-lg" />
          ))}
        </div>
      ) : data && data.drivers.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-stone-100">
                <th className="px-4 py-2 text-left font-semibold text-muted-foreground">Fahrername</th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Bestellungen</th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Aktive Std.</th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Best./Std.</th>
                <th className="px-4 py-2 text-right font-semibold text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {data.drivers.map((d) => {
                const cfg = STATUS_CONFIG[d.status];
                return (
                  <tr key={d.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-4 py-2.5 font-medium truncate max-w-[140px]">{d.name}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{d.ordersToday}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{d.hoursActive}h</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{d.ordersPerHour}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', cfg.bg, cfg.text)}>
                        {cfg.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-stone-200 bg-stone-50">
                <td className="px-4 py-2.5 font-bold text-muted-foreground" colSpan={3}>
                  Durchschnitt
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums font-bold">{data.avgOrdersPerHour}</td>
                <td className="px-4 py-2.5" />
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="px-5 py-6 text-xs text-muted-foreground text-center">
          Keine Fahrer online
        </div>
      )}
    </div>
  );
}
