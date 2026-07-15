'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Bike, ChefHat, ChevronDown, ChevronUp, Clock, Zap, AlertTriangle, CheckCircle2 } from 'lucide-react';

/**
 * Phase 1740 — Driver-Kitchen-Sync-Cockpit
 *
 * Synchronisiert Küchen-Zubereitungszeit mit Fahrer-Verfügbarkeit:
 * Zeigt je aktiver Bestellung an, ob das Essen fertig sein wird BEVOR der Fahrer
 * eintrifft (Warmhalte-Risiko) oder erst NACHDEM der Fahrer wartet (Fahrer-Wartezeit).
 *
 * Farbkodierung:
 * 🟢 Sync  — Essen fertig, Fahrer kommt in 2–5 Min (optimal)
 * 🟡 Früh  — Essen fertig >5 Min vor Fahrer (Warmhalte-Risiko)
 * 🔵 Warte — Fahrer bereits da, Essen noch nicht fertig (<2 Min)
 * 🔴 Spät  — Fahrer bereits da, Essen noch >2 Min weg (kritisch)
 */

interface Order {
  id: string;
  bestellnummer?: string | null;
  status: string;
  bestellt_am?: string | null;
  created_at?: string | null;
  geschaetzte_zubereitung_min?: number | null;
  kunde_name?: string | null;
}

interface Timing {
  order_id?: string | null;
  prep_min?: number | null;
}

type SyncLevel = 'sync' | 'early' | 'wait' | 'late' | 'unknown';

const LEVEL_CFG: Record<SyncLevel, {
  bg: string;
  border: string;
  text: string;
  label: string;
  icon: React.ReactNode;
}> = {
  sync:    { bg: 'bg-matcha-50',  border: 'border-matcha-200', text: 'text-matcha-700',  label: 'Optimal', icon: <CheckCircle2 className="w-3 h-3" /> },
  early:   { bg: 'bg-amber-50',   border: 'border-amber-200',  text: 'text-amber-700',   label: 'Warmhalte-Risiko', icon: <ChefHat className="w-3 h-3" /> },
  wait:    { bg: 'bg-blue-50',    border: 'border-blue-200',   text: 'text-blue-700',    label: 'Fahrer wartet', icon: <Bike className="w-3 h-3" /> },
  late:    { bg: 'bg-red-50',     border: 'border-red-200',    text: 'text-red-700',     label: 'Kritisch', icon: <AlertTriangle className="w-3 h-3" /> },
  unknown: { bg: 'bg-stone-50',   border: 'border-stone-200',  text: 'text-stone-600',   label: 'Kein Fahrer', icon: <Clock className="w-3 h-3" /> },
};

const ACTIVE_STATUSES = new Set([
  'accepted', 'confirmed', 'preparing', 'in_progress',
  'in_zubereitung', 'bestätigt', 'angenommen', 'neu',
]);

function getSyncLevel(prepRemainMin: number, driverEtaMin: number | null): SyncLevel {
  if (driverEtaMin === null) return 'unknown';
  const gap = driverEtaMin - prepRemainMin; // positive = driver arrives later
  if (gap >= 2 && gap <= 5) return 'sync';
  if (gap > 5) return 'early';
  if (gap >= -2) return 'wait';
  return 'late';
}

function fmt(sec: number): string {
  const abs = Math.abs(Math.round(sec));
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface RowData {
  orderId: string;
  bestellnummer: string;
  kundeName: string;
  prepRemainSec: number;
  prepTotalSec: number;
  driverEtaMin: number | null;
  driverName: string | null;
  syncLevel: SyncLevel;
}

export function KitchenPhase1740DriverSyncCockpit({
  orders,
  timings,
  locationId,
}: {
  orders: Order[];
  timings?: Timing[];
  locationId?: string | null;
}) {
  const [tick, setTick] = useState(0);
  const [driverData, setDriverData] = useState<{ orderId: string; etaMin: number; driverName: string }[]>([]);
  const [open, setOpen] = useState(true);
  const supabase = createClient();

  // 1-Sekunden-Tick
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  // Fahrer-ETA aus active batches laden
  useEffect(() => {
    if (!locationId) return;
    const load = async () => {
      const { data } = await supabase
        .from('mise_delivery_batches')
        .select(`
          id, state, estimated_pickup_at,
          driver:mise_drivers(id, name),
          stops:mise_delivery_batch_stops(order_id, sequence)
        `)
        .eq('location_id', locationId)
        .in('state', ['assigned', 'at_restaurant', 'on_route', 'pending_acceptance'])
        .limit(20);
      if (!data) return;
      const now = Date.now();
      const results: typeof driverData = [];
      for (const batch of data) {
        const pickupAt = batch.estimated_pickup_at ? new Date(batch.estimated_pickup_at).getTime() : null;
        const etaMin = pickupAt ? Math.round((pickupAt - now) / 60_000) : null;
        const driverName = (batch.driver as any)?.name ?? null;
        if (Array.isArray(batch.stops)) {
          for (const stop of batch.stops) {
            if (stop.order_id && etaMin !== null) {
              results.push({ orderId: stop.order_id, etaMin, driverName: driverName ?? 'Fahrer' });
            }
          }
        }
      }
      setDriverData(results);
    };
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const rows: RowData[] = useMemo(() => {
    const now = Date.now();
    return orders
      .filter(o => ACTIVE_STATUSES.has(o.status))
      .map(o => {
        const start = new Date(o.bestellt_am ?? o.created_at ?? 0).getTime();
        const timingMin = timings?.find(t => t.order_id === o.id)?.prep_min ?? null;
        const prepMin = timingMin ?? o.geschaetzte_zubereitung_min ?? 20;
        const prepTotalSec = prepMin * 60;
        const elapsedSec = (now - start) / 1000;
        const prepRemainSec = prepTotalSec - elapsedSec;
        const prepRemainMin = prepRemainSec / 60;

        const driverEntry = driverData.find(d => d.orderId === o.id);
        const driverEtaMin = driverEntry?.etaMin ?? null;
        const driverName = driverEntry?.driverName ?? null;

        return {
          orderId: o.id,
          bestellnummer: o.bestellnummer ?? o.id.slice(-4),
          kundeName: o.kunde_name ?? '—',
          prepRemainSec,
          prepTotalSec,
          driverEtaMin,
          driverName,
          syncLevel: getSyncLevel(prepRemainMin, driverEtaMin),
        };
      })
      .sort((a, b) => {
        // Kritische zuerst
        const order: SyncLevel[] = ['late', 'wait', 'early', 'unknown', 'sync'];
        return order.indexOf(a.syncLevel) - order.indexOf(b.syncLevel);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, timings, driverData, tick]);

  const criticalCount = rows.filter(r => r.syncLevel === 'late').length;
  const syncCount = rows.filter(r => r.syncLevel === 'sync').length;

  if (rows.length === 0) return null;

  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-saffron" />
          <span className="font-display text-sm font-bold uppercase tracking-wider text-char">
            Fahrer-Küchen-Sync
          </span>
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-600">
            {rows.length} aktiv
          </span>
          {criticalCount > 0 && (
            <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-bold animate-pulse">
              {criticalCount} kritisch
            </span>
          )}
          {syncCount > 0 && (
            <span className="rounded-full bg-matcha-100 text-matcha-700 px-2 py-0.5 text-[10px] font-bold">
              {syncCount} optimal
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t divide-y">
          {rows.map(row => {
            const cfg = LEVEL_CFG[row.syncLevel];
            const pct = row.prepTotalSec > 0
              ? Math.min(1, Math.max(0, 1 - row.prepRemainSec / row.prepTotalSec))
              : 0;
            const isOverdue = row.prepRemainSec < 0;
            return (
              <div key={row.orderId} className={cn('flex items-center gap-3 px-4 py-3', cfg.bg)}>
                {/* Fortschrittsring */}
                <div className="shrink-0 relative w-10 h-10">
                  <svg width="40" height="40" className="-rotate-90">
                    <circle cx="20" cy="20" r="16" fill="none" strokeWidth="3" stroke="#e5e7eb" />
                    <circle
                      cx="20" cy="20" r="16" fill="none" strokeWidth="3"
                      stroke={isOverdue ? '#dc2626' : pct > 0.75 ? '#f59e0b' : '#4d7c0f'}
                      strokeDasharray={`${2 * Math.PI * 16}`}
                      strokeDashoffset={`${2 * Math.PI * 16 * (1 - pct)}`}
                      strokeLinecap="round"
                      style={{ transition: 'stroke-dashoffset 1s linear' }}
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center font-mono text-[9px] font-black text-foreground">
                    {fmt(row.prepRemainSec)}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-xs text-char">#{row.bestellnummer}</span>
                    <span className="text-[11px] text-muted-foreground truncate">{row.kundeName}</span>
                    <span className={cn('flex items-center gap-0.5 text-[10px] font-bold rounded-full px-1.5 py-0.5 border', cfg.bg, cfg.border, cfg.text)}>
                      {cfg.icon}
                      {cfg.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    {/* Küche */}
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <ChefHat className="w-3 h-3" />
                      {isOverdue
                        ? <span className="text-red-600 font-bold">+{fmt(Math.abs(row.prepRemainSec))} überfällig</span>
                        : <span>{fmt(row.prepRemainSec)} verbleibend</span>
                      }
                    </div>
                    {/* Fahrer */}
                    {row.driverEtaMin !== null ? (
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Bike className="w-3 h-3" />
                        <span>{row.driverName ?? 'Fahrer'} in {row.driverEtaMin > 0 ? `~${row.driverEtaMin} Min` : 'jetzt'}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[11px] text-stone-400">
                        <Bike className="w-3 h-3" />
                        <span>Kein Fahrer zugewiesen</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Gap-Anzeige */}
                {row.driverEtaMin !== null && (
                  <div className="shrink-0 text-right">
                    <div className={cn('text-sm font-black tabular-nums', cfg.text)}>
                      {(() => {
                        const gap = row.driverEtaMin - (row.prepRemainSec / 60);
                        return gap > 0 ? `+${gap.toFixed(0)}m` : `${gap.toFixed(0)}m`;
                      })()}
                    </div>
                    <div className="text-[9px] text-muted-foreground">Δ Sync</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
