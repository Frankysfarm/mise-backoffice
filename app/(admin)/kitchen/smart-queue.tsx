'use client';

/**
 * KitchenSmartQueue — Optimale Kochstart-Reihenfolge
 *
 * Zeigt welche Bestellungen als NÄCHSTE gestartet werden sollten,
 * basierend auf: Driver-ETA, Zielzeit, Batch-Größe, Stationslast.
 * Ergänzt KitchenSmartCountdownGrid (zeigt verbleibende Zeit)
 * durch eine aktionsorientierte Startempfehlung.
 */

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { ChefHat, Clock, Flame, Play, Salad, Coffee, Thermometer, Zap, AlertTriangle } from 'lucide-react';

type QueueOrder = {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  kunde_name: string;
  items: { name: string; menge: number }[];
};

type DriverBatchEta = {
  order_id: string;
  driver_arrival_sec: number | null;
  driver_name: string | null;
};

type Station = 'grill' | 'kalt' | 'frittiert' | 'getraenke' | 'mixed';

const GRILL_W  = ['burger', 'steak', 'grill', 'wrap', 'schnitzel', 'fleisch', 'chicken', 'hähnchen'];
const COLD_W   = ['salat', 'sushi', 'bowl', 'tartare', 'ceviche'];
const FRY_W    = ['pommes', 'fries', 'frittes', 'nugget', 'crispy', 'tempura'];
const DRINK_W  = ['cola', 'wasser', 'saft', 'bier', 'wein', 'shake', 'smoothie', 'kaffee', 'tee', 'limo'];

function detectStation(items: { name: string }[]): Station {
  const txt = items.map(i => i.name.toLowerCase()).join(' ');
  const s = { grill: 0, kalt: 0, frittiert: 0, getraenke: 0 };
  GRILL_W.forEach(w  => { if (txt.includes(w)) s.grill++; });
  COLD_W.forEach(w   => { if (txt.includes(w)) s.kalt++; });
  FRY_W.forEach(w    => { if (txt.includes(w)) s.frittiert++; });
  DRINK_W.forEach(w  => { if (txt.includes(w)) s.getraenke++; });
  const max = Math.max(s.grill, s.kalt, s.frittiert, s.getraenke);
  if (max === 0) return 'mixed';
  if (s.grill    === max) return 'grill';
  if (s.kalt     === max) return 'kalt';
  if (s.frittiert === max) return 'frittiert';
  return 'getraenke';
}

const STATION_META: Record<Station, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  grill:     { label: 'Grill',      icon: Flame,       color: 'text-red-700',    bg: 'bg-red-100' },
  kalt:      { label: 'Kalt',       icon: Salad,       color: 'text-cyan-700',   bg: 'bg-cyan-100' },
  frittiert: { label: 'Frittiert',  icon: Thermometer, color: 'text-yellow-700', bg: 'bg-yellow-100' },
  getraenke: { label: 'Getränke',   icon: Coffee,      color: 'text-purple-700', bg: 'bg-purple-100' },
  mixed:     { label: 'Gemischt',   icon: ChefHat,     color: 'text-matcha-700', bg: 'bg-matcha-100' },
};

type PriorityRow = {
  order: QueueOrder;
  station: Station;
  startInSec: number;
  urgency: 'now' | 'soon' | 'later';
  driverArrivalMin: number | null;
  driverName: string | null;
};

function computeStartIn(order: QueueOrder, driverArrSec: number | null): number {
  const prepSec = (order.geschaetzte_zubereitung_min ?? 15) * 60;
  if (driverArrSec !== null) {
    return Math.max(0, driverArrSec - prepSec);
  }
  const waitSec = order.bestellt_am
    ? (Date.now() - new Date(order.bestellt_am).getTime()) / 1000
    : 0;
  return Math.max(0, (order.geschaetzte_zubereitung_min ?? 15) * 60 - waitSec - prepSec);
}

function fmtMin(sec: number): string {
  if (sec <= 0) return 'JETZT';
  const m = Math.floor(sec / 60);
  if (m < 1) return '< 1 Min';
  return `${m} Min`;
}

export function KitchenSmartQueue({ locationId }: { locationId?: string | null }) {
  const [orders, setOrders]       = useState<QueueOrder[]>([]);
  const [batchEtas, setBatchEtas] = useState<DriverBatchEta[]>([]);
  const [, setTick]               = useState(0);
  const supabase = createClient();

  const refresh = useCallback(async () => {
    const [{ data: o }, { data: b }] = await Promise.all([
      supabase
        .from('customer_orders')
        .select('id, bestellnummer, status, bestellt_am, geschaetzte_zubereitung_min, kunde_name, items:order_items(name, menge)')
        .eq('status', 'bestätigt')
        .order('bestellt_am', { ascending: true })
        .limit(20),
      supabase
        .from('delivery_batch_stops')
        .select('order_id, batch:delivery_batches(id, started_at, total_eta_min, fahrer:employees(vorname, nachname))')
        .in('status', ['pending', 'picked_up'])
        .limit(50),
    ]);
    if (o) setOrders(o as QueueOrder[]);
    if (b) {
      const etas: DriverBatchEta[] = (b as any[]).map((s) => {
        const batch = s.batch;
        let driverArrivalSec: number | null = null;
        if (batch?.started_at && batch?.total_eta_min != null) {
          const etaMs = new Date(batch.started_at).getTime() + batch.total_eta_min * 60_000;
          driverArrivalSec = Math.floor((etaMs - Date.now()) / 1000);
        }
        return {
          order_id: s.order_id,
          driver_arrival_sec: driverArrivalSec,
          driver_name: batch?.fahrer
            ? `${batch.fahrer.vorname} ${batch.fahrer.nachname.charAt(0)}.`
            : null,
        };
      });
      setBatchEtas(etas);
    }
  }, [supabase]);

  useEffect(() => {
    refresh();
    const iv = setInterval(() => setTick(n => n + 1), 5_000);
    const ch = supabase
      .channel('smart-queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_orders' }, refresh)
      .subscribe();
    return () => { clearInterval(iv); supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const etaMap = new Map(batchEtas.map(e => [e.order_id, e]));

  const rows: PriorityRow[] = orders.map((o) => {
    const eta = etaMap.get(o.id);
    const startIn = computeStartIn(o, eta?.driver_arrival_sec ?? null);
    return {
      order: o,
      station: detectStation(o.items),
      startInSec: startIn,
      urgency: (startIn <= 0 ? 'now' : startIn <= 180 ? 'soon' : 'later') as 'now' | 'soon' | 'later',
      driverArrivalMin: eta?.driver_arrival_sec != null ? Math.ceil(eta.driver_arrival_sec / 60) : null,
      driverName: eta?.driver_name ?? null,
    };
  }).sort((a, b) => a.startInSec - b.startInSec);

  const stationLoad = orders.reduce((acc, o) => {
    const st = detectStation(o.items);
    acc[st] = (acc[st] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (orders.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
        <Zap className="h-4 w-4 text-matcha-600" />
        <span className="font-display text-sm font-bold uppercase tracking-wider">Smart-Queue · Kochstart-Empfehlung</span>
        <span className="ml-auto text-[11px] text-muted-foreground">{orders.length} wartend</span>
      </div>

      {/* Station-Last-Überblick */}
      {Object.keys(stationLoad).length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/10 overflow-x-auto scrollbar-none">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground shrink-0">Stationen:</span>
          {Object.entries(stationLoad).map(([st, count]) => {
            const meta = STATION_META[st as Station];
            const Icon = meta.icon;
            return (
              <div key={st} className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold shrink-0', meta.bg, meta.color)}>
                <Icon className="h-3 w-3" />
                {meta.label}: {count}
              </div>
            );
          })}
        </div>
      )}

      {/* Prioritätsliste */}
      <div className="divide-y">
        {rows.slice(0, 8).map(({ order: o, station, startInSec, urgency, driverArrivalMin, driverName }) => {
          const meta = STATION_META[station];
          const Icon = meta.icon;
          return (
            <div
              key={o.id}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 transition',
                urgency === 'now'  && 'bg-red-50',
                urgency === 'soon' && 'bg-amber-50',
              )}
            >
              {/* Priorität-Indikator */}
              <div className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                urgency === 'now'  ? 'bg-red-100'    : urgency === 'soon' ? 'bg-amber-100' : 'bg-muted',
              )}>
                {urgency === 'now'
                  ? <AlertTriangle className="h-4 w-4 text-red-600 animate-pulse" />
                  : urgency === 'soon'
                  ? <Clock className="h-4 w-4 text-amber-600" />
                  : <Play className="h-4 w-4 text-muted-foreground" />
                }
              </div>

              {/* Start-Zeit */}
              <div className="w-16 shrink-0">
                <div className={cn(
                  'text-sm font-black tabular-nums',
                  urgency === 'now'  ? 'text-red-600'    :
                  urgency === 'soon' ? 'text-amber-700'  : 'text-foreground',
                )}>
                  {fmtMin(startInSec)}
                </div>
                <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Start</div>
              </div>

              {/* Order-Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm">#{o.bestellnummer.slice(-4)}</span>
                  <span className="text-xs text-muted-foreground truncate">{o.kunde_name}</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {o.items.slice(0, 3).map((it, i) => (
                    <span key={i} className="text-[10px] bg-muted/60 rounded px-1 py-0.5">
                      {it.menge}× {it.name}
                    </span>
                  ))}
                  {o.items.length > 3 && (
                    <span className="text-[10px] text-muted-foreground">+{o.items.length - 3}</span>
                  )}
                </div>
              </div>

              {/* Station-Badge */}
              <div className={cn('flex items-center gap-1 rounded-full px-2 py-1 shrink-0', meta.bg, meta.color)}>
                <Icon className="h-3 w-3" />
                <span className="text-[10px] font-bold">{meta.label}</span>
              </div>

              {/* Driver-ETA */}
              {driverArrivalMin !== null && (
                <div className="text-right shrink-0">
                  <div className="text-xs font-bold tabular-nums text-blue-700">{driverArrivalMin}m</div>
                  <div className="text-[9px] text-muted-foreground truncate max-w-[60px]">{driverName ?? 'Fahrer'}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
