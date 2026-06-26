'use client';

import { useEffect, useState } from 'react';
import { Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BatchSchedule {
  batchId: string;
  driverName: string | null;
  etaAt: string | null;
  prepTimeMin: number;
  optimalKochstart: string | null;
  status: string;
  minutesUntilKochstart: number | null;
}

interface ApiResponse {
  ok: boolean;
  schedule: BatchSchedule[];
  generatedAt: string;
}

interface Props {
  locationId: string | null;
}

function formatTime(iso: string | null): string {
  if (!iso) return '–';
  const d = new Date(iso);
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function urgencyConfig(min: number | null): { bg: string; text: string; label: string } {
  if (min === null) return { bg: 'bg-stone-100', text: 'text-stone-500', label: '–' };
  if (min < 0) return { bg: 'bg-red-100', text: 'text-red-700', label: `${Math.abs(min)} Min überfällig` };
  if (min <= 5) return { bg: 'bg-amber-100', text: 'text-amber-700', label: `${min} Min` };
  return { bg: 'bg-matcha-100', text: 'text-matcha-700', label: `${min} Min` };
}

export function KitchenBatchZeitplan({ locationId }: Props) {
  const [schedule, setSchedule] = useState<BatchSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!locationId) return;
    fetch(`/api/delivery/admin/kitchen-batch-schedule?location_id=${encodeURIComponent(locationId)}`)
      .then((r) => r.json())
      .then((d: ApiResponse) => setSchedule(d.schedule ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId) return null;
  if (!loading && schedule.length === 0) return null;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-stone-100">
        <Clock className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="font-display text-sm font-bold uppercase tracking-wider">Batch-Kochzeitplan</span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-1" />}
        {!loading && schedule.length > 0 && (
          <span className="ml-auto rounded-full bg-matcha-100 text-matcha-700 px-2.5 py-0.5 text-[10px] font-bold">
            {schedule.length} Batches
          </span>
        )}
      </div>

      {loading && schedule.length === 0 ? (
        <div className="px-5 py-6 space-y-2 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 bg-stone-100 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-stone-100">
                <th className="px-4 py-2 text-left font-semibold text-muted-foreground">Fahrer</th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground">ETA</th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Kochstart</th>
                <th className="px-4 py-2 text-right font-semibold text-muted-foreground">In / Überfällig</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {schedule.map((item) => {
                const urg = urgencyConfig(item.minutesUntilKochstart);
                return (
                  <tr key={item.batchId} className="hover:bg-stone-50 transition-colors">
                    <td className="px-4 py-2.5 font-medium truncate max-w-[120px]">
                      {item.driverName ?? <span className="text-muted-foreground italic">Kein Fahrer</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                      {formatTime(item.etaAt)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold">
                      {formatTime(item.optimalKochstart)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', urg.bg, urg.text)}>
                        {urg.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
