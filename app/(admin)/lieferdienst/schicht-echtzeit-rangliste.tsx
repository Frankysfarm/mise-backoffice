'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Trophy, Bike, Clock, Euro } from 'lucide-react';

type DriverEntry = {
  employeeId: string;
  name: string;
  deliveries: number;
  revenue: number;
  schichtBeginn: string;
};

const MEDAL = ['🥇', '🥈', '🥉'];

function schichtDauer(beginn: string): string {
  const ms = Date.now() - new Date(beginn).getTime();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}:${String(m).padStart(2, '0')}`;
}

export function SchichtEchtzeitRangliste() {
  const supabase = createClient();
  const [rows, setRows] = useState<DriverEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { data: drivers } = await supabase
          .from('driver_status')
          .select(`
            employee_id,
            ist_online,
            schicht_beginn,
            employee:employees(id, vorname, nachname, fahrzeug_praeferenz)
          `)
          .eq('ist_online', true)
          .not('schicht_beginn', 'is', null)
          .limit(10);

        const today = new Date().toISOString().split('T')[0];
        const { data: deliveries } = await supabase
          .from('customer_orders')
          .select('fahrer_id, gesamtbetrag, geliefert_am, eta_latest')
          .eq('status', 'geliefert')
          .gte('geliefert_am', today + 'T00:00:00')
          .limit(200);

        if (cancelled) return;

        const countMap = new Map<string, { deliveries: number; revenue: number }>();
        for (const d of deliveries ?? []) {
          if (!d.fahrer_id) continue;
          const cur = countMap.get(d.fahrer_id) ?? { deliveries: 0, revenue: 0 };
          cur.deliveries += 1;
          cur.revenue += Number(d.gesamtbetrag ?? 0);
          countMap.set(d.fahrer_id, cur);
        }

        const entries: DriverEntry[] = (drivers ?? []).map((dr: any) => {
          const emp = Array.isArray(dr.employee) ? dr.employee[0] : dr.employee;
          const name = emp
            ? `${emp.vorname} ${String(emp.nachname ?? '').charAt(0)}.`
            : dr.employee_id.slice(0, 6);
          const stats = countMap.get(dr.employee_id) ?? { deliveries: 0, revenue: 0 };
          return {
            employeeId: dr.employee_id,
            name,
            deliveries: stats.deliveries,
            revenue: stats.revenue,
            schichtBeginn: dr.schicht_beginn,
          };
        });

        entries.sort((a, b) => b.deliveries - a.deliveries);

        if (!cancelled) {
          setRows(entries.slice(0, 5));
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const iv = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="rounded-2xl border bg-white shadow-sm p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
          <span className="text-xs font-black text-stone-700 uppercase tracking-wider">
            Schicht-Rangliste
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-semibold text-emerald-600 uppercase tracking-wide">Live</span>
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="text-xs text-stone-400 text-center py-4">Lade…</div>
      ) : rows.length < 2 ? (
        <div className="text-xs text-stone-400 text-center py-4">Keine aktiven Fahrer</div>
      ) : (
        <div className="space-y-1.5">
          {rows.map((row, idx) => {
            const medal = MEDAL[idx] ?? null;
            const rowBg =
              idx === 0
                ? 'border-yellow-200 bg-yellow-50'
                : idx === 1
                ? 'border-stone-200 bg-stone-50'
                : idx === 2
                ? 'border-amber-100 bg-amber-50'
                : 'border-stone-100 bg-white';

            return (
              <div
                key={row.employeeId}
                className={cn(
                  'flex items-center gap-2 rounded-xl border px-3 py-2',
                  rowBg,
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

                {/* Name */}
                <span className="flex-1 min-w-0 text-[11px] font-bold text-stone-700 truncate">
                  {row.name}
                </span>

                {/* Shift duration */}
                <div className="flex items-center gap-0.5 shrink-0">
                  <Clock className="h-2.5 w-2.5 text-stone-400" />
                  <span className="text-[9px] tabular-nums text-stone-500 font-semibold">
                    {schichtDauer(row.schichtBeginn)}
                  </span>
                </div>

                {/* Deliveries */}
                <div className="flex items-center gap-0.5 shrink-0">
                  <Bike className="h-2.5 w-2.5 text-stone-400" />
                  <span className={cn(
                    'text-[10px] font-black tabular-nums',
                    idx === 0 ? 'text-yellow-700' : 'text-stone-600',
                  )}>
                    {row.deliveries}
                  </span>
                </div>

                {/* Revenue */}
                <div className="flex items-center gap-0.5 shrink-0">
                  <Euro className="h-2.5 w-2.5 text-stone-400" />
                  <span className="text-[10px] font-semibold tabular-nums text-stone-600">
                    {row.revenue.toFixed(0)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
