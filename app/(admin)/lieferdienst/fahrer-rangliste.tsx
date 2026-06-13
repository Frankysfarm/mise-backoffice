'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Trophy, Bike, Clock } from 'lucide-react';

type DriverRow = {
  employeeId: string;
  name: string;
  deliveries: number;
  distKm: number;
  onlineMin: number | null;
  isOnline: boolean;
};

const MEDAL = ['🥇', '🥈', '🥉'];

export function FahrerRangliste({ locationId }: { locationId: string }) {
  const supabase = createClient();
  const [rows, setRows] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        // Today's completed batches for this location
        const { data: batches } = await supabase
          .from('delivery_batches')
          .select('id, fahrer_id, total_distance_km')
          .eq('location_id', locationId)
          .gte('created_at', todayStart.toISOString());

        if (!batches?.length) { if (!cancelled) setRows([]); return; }

        // Completed stops per batch
        const { data: stops } = await supabase
          .from('delivery_batch_stops')
          .select('batch_id')
          .in('batch_id', batches.map((b: any) => b.id))
          .not('geliefert_am', 'is', null);

        // Online status
        const driverIds = [...new Set(batches.map((b: any) => b.fahrer_id).filter(Boolean))];
        const { data: statuses } = await supabase
          .from('driver_status')
          .select('employee_id, ist_online, online_seit')
          .in('employee_id', driverIds);

        // Employee names
        const { data: employees } = await supabase
          .from('employees')
          .select('id, vorname, nachname')
          .in('id', driverIds);

        if (cancelled) return;

        // Aggregate per driver
        const stopsByBatch = new Map<string, number>();
        for (const s of (stops ?? [])) {
          stopsByBatch.set(s.batch_id, (stopsByBatch.get(s.batch_id) ?? 0) + 1);
        }

        const map = new Map<string, DriverRow>();
        for (const b of batches) {
          if (!b.fahrer_id) continue;
          const emp = (employees ?? []).find((e: any) => e.id === b.fahrer_id);
          const name = emp ? `${emp.vorname} ${emp.nachname[0]}.` : b.fahrer_id.slice(0, 6);
          const st = (statuses ?? []).find((s: any) => s.employee_id === b.fahrer_id);
          if (!map.has(b.fahrer_id)) {
            map.set(b.fahrer_id, {
              employeeId: b.fahrer_id,
              name,
              deliveries: 0,
              distKm: 0,
              isOnline: st?.ist_online ?? false,
              onlineMin: st?.online_seit
                ? Math.floor((Date.now() - new Date(st.online_seit).getTime()) / 60_000)
                : null,
            });
          }
          const row = map.get(b.fahrer_id)!;
          row.deliveries += stopsByBatch.get(b.id) ?? 0;
          row.distKm += b.total_distance_km ?? 0;
        }

        const sorted = [...map.values()].sort((a, b) => b.deliveries - a.deliveries);
        setRows(sorted);
      } catch { /* noop */ } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const iv = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!loading && rows.length === 0) return null;

  return (
    <div className="rounded-2xl border bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
          <span className="text-xs font-black text-stone-700 uppercase tracking-wider">Fahrer-Rangliste heute</span>
        </div>
        <div className="h-1.5 w-1.5 rounded-full bg-matcha-500 animate-pulse" />
      </div>

      {loading && rows.length === 0 ? (
        <div className="text-xs text-stone-400 text-center py-2">Lade…</div>
      ) : (
        <div className="space-y-1.5">
          {rows.map((row, idx) => {
            const medal = MEDAL[idx] ?? null;
            const ratePerH = row.onlineMin && row.onlineMin > 0
              ? (row.deliveries / (row.onlineMin / 60)).toFixed(1)
              : null;

            return (
              <div
                key={row.employeeId}
                className={cn(
                  'flex items-center gap-2.5 rounded-xl border px-3 py-2 transition',
                  idx === 0
                    ? 'border-yellow-200 bg-yellow-50'
                    : idx === 1
                    ? 'border-stone-200 bg-stone-50'
                    : idx === 2
                    ? 'border-amber-100 bg-amber-50'
                    : 'border-stone-100 bg-white',
                )}
              >
                {/* Rank */}
                <div className="w-6 text-center shrink-0">
                  {medal ? (
                    <span className="text-base leading-none">{medal}</span>
                  ) : (
                    <span className="text-[10px] font-black text-stone-400">#{idx + 1}</span>
                  )}
                </div>

                {/* Name + online dot */}
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <div className={cn(
                    'h-1.5 w-1.5 rounded-full shrink-0',
                    row.isOnline ? 'bg-matcha-500' : 'bg-stone-300',
                  )} />
                  <span className="text-[11px] font-bold text-stone-700 truncate">{row.name}</span>
                </div>

                {/* Pace chip */}
                {ratePerH && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Clock className="h-2.5 w-2.5 text-stone-400" />
                    <span className="text-[9px] tabular-nums text-stone-500 font-bold">{ratePerH}/h</span>
                  </div>
                )}

                {/* Distance */}
                {row.distKm > 0 && (
                  <span className="text-[9px] tabular-nums text-stone-400 shrink-0 hidden sm:inline">
                    {row.distKm.toFixed(1)} km
                  </span>
                )}

                {/* Deliveries badge */}
                <div className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums',
                  idx === 0
                    ? 'bg-yellow-400 text-yellow-900'
                    : 'bg-matcha-100 text-matcha-800',
                )}>
                  {row.deliveries}
                </div>

                {/* Vehicle icon */}
                <Bike className="h-3 w-3 text-stone-300 shrink-0" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
