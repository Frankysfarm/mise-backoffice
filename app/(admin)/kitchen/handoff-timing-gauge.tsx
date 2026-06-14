'use client';

/**
 * KitchenHandoffTimingGauge
 *
 * Zeigt für jede fertige/fast-fertige Bestellung:
 * - Küche: wie viel Zeit bis fertig (aus kitchen_timings)
 * - Fahrer: wann kommt er zum Abholen (aus driver_status + active batch)
 *
 * Synchronisations-Ampel:
 *   🟢 Gut   — Fahrer trifft +/- 3 Min auf fertige Bestellung
 *   🟡 Nah   — Fahrer kommt 3–8 Min früher oder später
 *   🔴 Problem — Fahrer kommt >8 Min zu früh (wartet, Kosten) oder zu spät (Essen kalt)
 */

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, Clock, TrendingUp, Zap } from 'lucide-react';

type SyncEntry = {
  orderId: string;
  bestellnummer: string;
  kundeName: string;
  kitchenReadyInMin: number | null;   // negativ = bereits fertig und wartet
  driverPickupInMin: number | null;   // negativ = Fahrer bereits da
  syncDeltaMin: number | null;        // driverPickup - kitchenReady
  zone: string | null;
};

type SyncQuality = 'gut' | 'nah' | 'problem' | 'unbekannt';

function getSyncQuality(delta: number | null): SyncQuality {
  if (delta === null) return 'unbekannt';
  const abs = Math.abs(delta);
  if (abs <= 3) return 'gut';
  if (abs <= 8) return 'nah';
  return 'problem';
}

const QUALITY_STYLES: Record<SyncQuality, { bar: string; text: string; bg: string; label: string }> = {
  gut:      { bar: 'bg-matcha-500', text: 'text-matcha-700', bg: 'bg-matcha-50 border-matcha-200',  label: 'Synchron' },
  nah:      { bar: 'bg-amber-400',  text: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200',    label: 'Nah' },
  problem:  { bar: 'bg-red-500',    text: 'text-red-700',    bg: 'bg-red-50 border-red-200',        label: 'Problem' },
  unbekannt:{ bar: 'bg-stone-300',  text: 'text-stone-500',  bg: 'bg-stone-50 border-stone-200',    label: '?' },
};

function useTick() {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT(n => n + 1), 30_000);
    return () => clearInterval(iv);
  }, []);
}

export function KitchenHandoffTimingGauge() {
  const supabase = createClient();
  const [entries, setEntries] = useState<SyncEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  useTick();

  const load = async () => {
    try {
      const now = new Date();
      const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);

      // 1. Bestellungen die bald fertig oder fertig sind
      const { data: timings } = await supabase
        .from('kitchen_timings')
        .select('order_id, cook_start_at, ready_target, prep_min, status')
        .in('status', ['cooking', 'scheduled', 'ready'])
        .gte('created_at', todayStart.toISOString())
        .order('ready_target', { ascending: true })
        .limit(8);

      if (!timings?.length) { setEntries([]); setLoading(false); return; }

      // 2. Zugehörige Orders laden
      const orderIds = timings.map((t: { order_id: string }) => t.order_id);
      const { data: orders } = await supabase
        .from('customer_orders')
        .select('id, bestellnummer, kunde_name, delivery_zone, status')
        .in('id', orderIds)
        .in('status', ['in_zubereitung', 'fertig', 'bestätigt']);

      if (!orders?.length) { setEntries([]); setLoading(false); return; }

      // 3. Aktive Batches: welche Orders haben bereits einen Fahrer on the way
      const { data: stops } = await supabase
        .from('mise_delivery_batch_stops')
        .select('order_id, batch_id, batch:mise_delivery_batches(status, total_eta_min, started_at)')
        .in('order_id', orderIds)
        .is('geliefert_am', null);

      // Build driver-pickup map: order_id -> estimated pickup in minutes
      const pickupMap: Record<string, number | null> = {};
      for (const stop of (stops ?? []) as Array<{
        order_id: string;
        batch: { status: string; total_eta_min: number | null; started_at: string | null } | null;
      }>) {
        const batch = stop.batch;
        if (!batch || !batch.started_at) continue;
        if (batch.status === 'pickup' || batch.status === 'at_restaurant') {
          pickupMap[stop.order_id] = 0;
        } else if (batch.status === 'unterwegs' || batch.status === 'on_route') {
          // Fahrer ist unterwegs liefern — kommt nach Tour zurück zum Abholstop
          // Vereinfachung: kein zuverlässiger ETA → null
          pickupMap[stop.order_id] = null;
        } else if (batch.status === 'zugewiesen' || batch.status === 'assigned') {
          pickupMap[stop.order_id] = 5; // Schätzung: 5 Min bis Abholung
        }
      }

      const result: SyncEntry[] = [];
      for (const timing of timings as Array<{
        order_id: string;
        ready_target: string | null;
        status: string;
      }>) {
        const order = (orders as Array<{
          id: string;
          bestellnummer: string;
          kunde_name: string;
          delivery_zone: string | null;
        }>).find(o => o.id === timing.order_id);
        if (!order) continue;

        const kitchenReadyInMin = timing.ready_target
          ? Math.round((new Date(timing.ready_target).getTime() - Date.now()) / 60_000)
          : null;

        const driverPickupInMin = pickupMap[timing.order_id] ?? null;
        const syncDeltaMin = (kitchenReadyInMin !== null && driverPickupInMin !== null)
          ? driverPickupInMin - kitchenReadyInMin
          : null;

        result.push({
          orderId: order.id,
          bestellnummer: order.bestellnummer,
          kundeName: order.kunde_name,
          kitchenReadyInMin,
          driverPickupInMin,
          syncDeltaMin,
          zone: order.delivery_zone,
        });
      }

      setEntries(result);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return null;
  if (!entries.length) return null;

  const problems = entries.filter(e => getSyncQuality(e.syncDeltaMin) === 'problem').length;
  const sync = entries.filter(e => getSyncQuality(e.syncDeltaMin) === 'gut').length;

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-stone-50 hover:bg-stone-100 transition text-left"
      >
        <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0" />
        <span className="text-[10px] font-black uppercase tracking-wider text-stone-600 flex-1">
          Fahrer ↔ Küche Sync
        </span>
        <span className={cn(
          'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
          problems > 0 ? 'bg-red-100 text-red-700' : 'bg-matcha-100 text-matcha-700',
        )}>
          {problems > 0 ? `${problems} Problem` : `${sync}/${entries.length} synchro`}
        </span>
      </button>

      {!collapsed && (
        <div className="divide-y divide-stone-100">
          {entries.map(entry => {
            const quality = getSyncQuality(entry.syncDeltaMin);
            const styles = QUALITY_STYLES[quality];
            return (
              <div key={entry.orderId} className={cn('flex items-center gap-2 px-3 py-2 border-l-4', styles.bg, styles.bar.replace('bg-', 'border-l-'))}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-black text-stone-800 tabular-nums">#{entry.bestellnummer}</span>
                    {entry.zone && (
                      <span className="text-[9px] bg-stone-200 text-stone-600 rounded-full px-1.5 py-0.5 font-bold">{entry.zone}</span>
                    )}
                  </div>
                  <span className="text-[10px] text-stone-500 truncate">{entry.kundeName}</span>
                </div>

                {/* Küchen-Timer */}
                <div className="flex flex-col items-center shrink-0">
                  <span className="text-[8px] font-bold uppercase tracking-wider text-stone-400">Küche</span>
                  <span className={cn(
                    'text-[11px] font-black tabular-nums',
                    entry.kitchenReadyInMin === null ? 'text-stone-400' :
                    entry.kitchenReadyInMin <= 0 ? 'text-matcha-600' :
                    entry.kitchenReadyInMin <= 5 ? 'text-amber-600' : 'text-stone-700',
                  )}>
                    {entry.kitchenReadyInMin === null ? '—'
                      : entry.kitchenReadyInMin <= 0 ? 'Fertig'
                      : `${entry.kitchenReadyInMin}m`}
                  </span>
                </div>

                <div className="text-stone-300 text-xs">→</div>

                {/* Fahrer-Timer */}
                <div className="flex flex-col items-center shrink-0">
                  <span className="text-[8px] font-bold uppercase tracking-wider text-stone-400">Fahrer</span>
                  <span className={cn(
                    'text-[11px] font-black tabular-nums',
                    entry.driverPickupInMin === null ? 'text-stone-400' :
                    entry.driverPickupInMin <= 0 ? 'text-blue-600' : 'text-stone-700',
                  )}>
                    {entry.driverPickupInMin === null ? '—'
                      : entry.driverPickupInMin <= 0 ? 'Hier'
                      : `~${entry.driverPickupInMin}m`}
                  </span>
                </div>

                {/* Sync-Qualität */}
                <div className="flex flex-col items-center shrink-0 w-12">
                  {quality === 'gut' ? (
                    <CheckCircle2 className="h-4 w-4 text-matcha-500" />
                  ) : quality === 'problem' ? (
                    <AlertTriangle className="h-4 w-4 text-red-500 animate-pulse" />
                  ) : quality === 'nah' ? (
                    <Clock className="h-4 w-4 text-amber-500" />
                  ) : (
                    <TrendingUp className="h-4 w-4 text-stone-300" />
                  )}
                  <span className={cn('text-[9px] font-bold', styles.text)}>
                    {quality === 'unbekannt' ? '—' :
                     entry.syncDeltaMin !== null
                       ? (entry.syncDeltaMin > 0 ? `+${entry.syncDeltaMin}m` : `${entry.syncDeltaMin}m`)
                       : styles.label}
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
