'use client';

import React, { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn, euro } from '@/lib/utils';
import {
  AlertCircle, Bell, BellOff, Bike, Check, ChefHat, Clock, Flame, Home as HomeIcon,
  Inbox, Loader2, MapPin, Package, ShoppingBag, TrendingUp, Utensils, X, Zap,
} from 'lucide-react';
import { BarChart, Bar, Cell, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { advanceOrder, cancelOrder } from './actions';

/* ------------------------------ Types ------------------------------ */

type Item = {
  id: string; name: string; menge: number;
  einzelpreis: number; notiz: string | null; extras: unknown; gang?: number | null;
};

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  typ: string;
  kunde_name: string;
  kunde_telefon: string | null;
  kunde_adresse: string | null;
  kunde_plz: string | null;
  kunde_notiz: string | null;
  kunde_lieferhinweis: string | null;
  zahlungsart: string;
  bezahlt: boolean;
  gesamtbetrag: number;
  bestellt_am: string | null;
  fertig_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  external_source: string | null;
  location_id: string | null;
  delivery_zone: string | null;
  tisch_id: string | null;
  tisch_nummer?: string | null;
  items: Item[];
};

type Driver = {
  id: string;
  vorname: string;
  nachname: string;
  status: {
    ist_online: boolean;
    fahrzeug: string | null;
    aktueller_batch_id: string | null;
    last_lat: number | null;
    last_lng: number | null;
    last_update: string | null;
    online_seit: string | null;
  } | null;
};

type Batch = {
  id: string;
  driver_id: string;
  status: string;
  started_at: string | null;
};

type Stop = {
  id: string;
  batch_id: string;
  order_id: string;
  reihenfolge: number;
  angekommen_am: string | null;
  geliefert_am: string | null;
};

type DriverState = 'offline' | 'frei' | 'unterwegs' | 'zurueck';

type KitchenTiming = {
  id: string;
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string; // scheduled | cooking | ready | picked_up
};

/* ------------------------------ Sounds ------------------------------ */

type SoundType = 'new_order' | 'driver_back' | 'order_picked' | 'urgent';

function playSound(type: SoundType) {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const now = ctx.currentTime;

    switch (type) {
      case 'new_order':
        // 2-Ton Ding — tiefer dann höher
        o.type = 'sine';
        o.frequency.setValueAtTime(880, now);
        o.frequency.setValueAtTime(1320, now + 0.1);
        g.gain.setValueAtTime(0.25, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        o.connect(g); g.connect(ctx.destination);
        o.start(now); o.stop(now + 0.4);
        break;
      case 'driver_back':
        // Aufsteigender 3-Ton — „Fahrer kommt zurück"
        o.type = 'triangle';
        o.frequency.setValueAtTime(523, now);
        o.frequency.setValueAtTime(659, now + 0.12);
        o.frequency.setValueAtTime(784, now + 0.24);
        g.gain.setValueAtTime(0.2, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        o.connect(g); g.connect(ctx.destination);
        o.start(now); o.stop(now + 0.55);
        break;
      case 'order_picked':
        // Kurzer Bestätigungs-Blip
        o.type = 'sine';
        o.frequency.setValueAtTime(1047, now);
        g.gain.setValueAtTime(0.15, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        o.connect(g); g.connect(ctx.destination);
        o.start(now); o.stop(now + 0.15);
        break;
      case 'urgent':
        // Niedrig + piepend — Wartezeit überschritten
        o.type = 'square';
        o.frequency.setValueAtTime(440, now);
        o.frequency.setValueAtTime(0,   now + 0.08);
        o.frequency.setValueAtTime(440, now + 0.16);
        o.frequency.setValueAtTime(0,   now + 0.24);
        o.frequency.setValueAtTime(440, now + 0.32);
        g.gain.setValueAtTime(0.18, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        o.connect(g); g.connect(ctx.destination);
        o.start(now); o.stop(now + 0.5);
        break;
    }
  } catch {}
}

/* ------------------------------ KitchenBoard ------------------------------ */

const COLUMNS = [
  { status: 'neu',            label: 'Eingegangen',     icon: Inbox,    color: 'bg-gold/10 border-gold/30',            next: 'bestätigt' },
  { status: 'bestätigt',      label: 'Angenommen',      icon: Bell,     color: 'bg-blue-50 border-blue-200',            next: 'in_zubereitung' },
  { status: 'in_zubereitung', label: 'In Zubereitung',  icon: ChefHat,  color: 'bg-orange-50 border-orange-200',        next: 'fertig' },
  { status: 'fertig',         label: 'Fertig',          icon: Package,  color: 'bg-matcha-50 border-matcha-200',        next: null },
] as const;

export function KitchenBoard({
  initialOrders, locations, initialDrivers, initialBatches, initialStops,
}: {
  initialOrders: Order[];
  locations: { id: string; name: string; lat: number | null; lng: number | null }[];
  initialDrivers: Driver[];
  initialBatches: Batch[];
  initialStops: Stop[];
}) {
  const supabase = createClient();
  const [orders, setOrders] = useState(initialOrders);
  const [drivers, setDrivers] = useState(initialDrivers);
  const [batches, setBatches] = useState(initialBatches);
  const [stops, setStops] = useState(initialStops);
  const [timings, setTimings] = useState<KitchenTiming[]>([]);
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [audio, setAudio] = useState(true);
  const [completedToday, setCompletedToday] = useState<number | null>(null);
  const [hourlyData, setHourlyData] = useState<{ h: number; label: string; orders: number }[]>([]);

  // Für Vergleich zwischen Renders
  const prev = useRef({
    newCount: orders.filter((o) => o.status === 'neu').length,
    driverStates: computeDriverStates(drivers, batches, stops),
    orderPickedIds: new Set(orders.filter((o) => o.status === 'unterwegs').map((o) => o.id)),
  });

  /* --- Heute abgeschlossen --- */
  useEffect(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const fetch = async () => {
      const { count } = await supabase
        .from('customer_orders')
        .select('id', { count: 'exact', head: true })
        .in('status', ['geliefert', 'abgeholt', 'abgeschlossen'])
        .gte('bestellt_am', today.toISOString());
      if (count !== null) setCompletedToday(count);
    };
    fetch();
    const iv = setInterval(fetch, 60_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --- Stündliche Verteilung heute --- */
  useEffect(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const load = async () => {
      const { data } = await supabase
        .from('customer_orders')
        .select('bestellt_am')
        .gte('bestellt_am', today.toISOString())
        .not('bestellt_am', 'is', null);
      if (!data) return;
      const counts: Record<number, number> = {};
      for (const o of data as { bestellt_am: string }[]) {
        const h = new Date(o.bestellt_am).getHours();
        counts[h] = (counts[h] ?? 0) + 1;
      }
      const nowH = new Date().getHours();
      const buckets = [];
      for (let h = 10; h <= Math.max(nowH, 22); h++) {
        buckets.push({ h, label: `${h}:00`, orders: counts[h] ?? 0 });
      }
      setHourlyData(buckets);
    };
    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --- Realtime --- */
  useEffect(() => {
    refreshTimings();
    const ch = supabase
      .channel('kitchen-combined')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_orders' }, refreshOrders)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' },     refreshOrders)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_status' },   refreshDrivers)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_batches' },refreshBatches)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_batch_stops' }, refreshStops)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mise_delivery_batches' }, refreshBatches)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mise_delivery_batch_stops' }, refreshStops)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kitchen_timings' }, refreshTimings)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshOrders() {
    const { data } = await supabase
      .from('customer_orders')
      .select('*, items:order_items(id, name, menge, einzelpreis, notiz, extras, gang)')
      .in('status', ['neu', 'bestätigt', 'in_zubereitung', 'fertig', 'unterwegs'])
      .order('bestellt_am', { ascending: true });
    setOrders((data as any[]) ?? []);
  }
  async function refreshDrivers() {
    const { data } = await supabase.from('employees')
      .select('id, vorname, nachname, rolle, status:driver_status(ist_online, fahrzeug, aktueller_batch_id, last_lat, last_lng, last_update, online_seit)')
      .eq('rolle', 'fahrer').eq('aktiv', true);
    setDrivers((data as any[]) ?? []);
  }
  async function refreshBatches() {
    const [{ data: legacy }, { data: smart }] = await Promise.all([
      supabase.from('delivery_batches')
        .select('id, driver_id, status, started_at')
        .in('status', ['pickup', 'aktiv', 'unterwegs', 'zugewiesen']),
      supabase.from('mise_delivery_batches')
        .select('id, driver_id, state, started_at')
        .in('state', ['pending_acceptance', 'assigned', 'at_restaurant', 'on_route']),
    ]);
    const normalizedSmart = ((smart ?? []) as any[]).map((b: any) => ({
      id: b.id, driver_id: b.driver_id, status: b.state, started_at: b.started_at,
    }));
    setBatches([...((legacy ?? []) as any[]), ...normalizedSmart]);
  }
  async function refreshStops() {
    const [{ data: legacy }, { data: smart }] = await Promise.all([
      supabase.from('delivery_batch_stops')
        .select('id, batch_id, order_id, reihenfolge, angekommen_am, geliefert_am')
        .order('reihenfolge', { ascending: true }),
      supabase.from('mise_delivery_batch_stops')
        .select('id, batch_id, order_id, sequence, arrived_at, completed_at, type')
        .eq('type', 'dropoff')
        .order('sequence', { ascending: true }),
    ]);
    const normalizedSmart = ((smart ?? []) as any[]).map((s: any) => ({
      id: s.id, batch_id: s.batch_id, order_id: s.order_id,
      reihenfolge: s.sequence, angekommen_am: s.arrived_at, geliefert_am: s.completed_at,
    }));
    setStops([...((legacy ?? []) as any[]), ...normalizedSmart]);
  }
  async function refreshTimings() {
    const { data } = await supabase.from('kitchen_timings')
      .select('id, order_id, cook_start_at, ready_target, prep_min, status')
      .in('status', ['scheduled', 'cooking'])
      .order('cook_start_at', { ascending: true });
    setTimings((data as any[]) ?? []);
  }

  /* --- Sound-Trigger --- */
  useEffect(() => {
    if (!audio) return;

    // Neue Bestellung?
    const newCount = orders.filter((o) => o.status === 'neu').length;
    if (newCount > prev.current.newCount) playSound('new_order');

    // Bestellung gerade vom Fahrer abgeholt (Status unterwegs neu)?
    const newUnterwegs = orders.filter((o) => o.status === 'unterwegs').map((o) => o.id);
    const freshPickups = newUnterwegs.filter((id) => !prev.current.orderPickedIds.has(id));
    if (freshPickups.length > 0) playSound('order_picked');

    // Kritisch überzogen?
    const critical = orders.some((o) => isCriticallyLate(o));
    const prevCritical = prev.current.newCount > 0; // ungenau, aber ok
    if (critical && !prevCritical) playSound('urgent');

    prev.current.newCount = newCount;
    prev.current.orderPickedIds = new Set(newUnterwegs);
  }, [orders, audio]);

  useEffect(() => {
    if (!audio) return;
    const states = computeDriverStates(drivers, batches, stops);
    // Von 'unterwegs' → 'zurueck' Transition?
    for (const [driverId, state] of states) {
      const prevState = prev.current.driverStates.get(driverId);
      if (prevState === 'unterwegs' && state === 'zurueck') {
        playSound('driver_back');
      }
    }
    prev.current.driverStates = states;
  }, [drivers, batches, stops, audio]);

  /* --- Berechnung --- */
  const driverStates = useMemo(
    () => computeDriverStates(drivers, batches, stops),
    [drivers, batches, stops],
  );

  const filtered = orders.filter((o) => locationFilter === 'all' || o.location_id === locationFilter);

  // Popup: ungenommene Orders älter als 60 Sekunden
  const [snoozed, setSnoozed] = useState<Map<string, number>>(new Map());
  // Snooze-Eintrag nach 30s wieder aktivieren
  useEffect(() => {
    if (snoozed.size === 0) return;
    const iv = setInterval(() => {
      setSnoozed((prev) => {
        const next = new Map<string, number>();
        const now = Date.now();
        for (const [id, until] of prev) if (until > now) next.set(id, until);
        return next.size === prev.size ? prev : next;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [snoozed]);
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const unacceptedAlert = filtered
    .filter((o) => o.status === 'neu' && (snoozed.get(o.id) ?? 0) <= Date.now())
    .find((o) => {
      if (!o.bestellt_am) return false;
      const sec = (Date.now() - new Date(o.bestellt_am).getTime()) / 1000;
      return sec >= 60;
    });

  // Sound-Loop alle 15s solange Popup offen
  useEffect(() => {
    if (!unacceptedAlert || !audio) return;
    const iv = setInterval(() => playSound('urgent'), 15_000);
    return () => clearInterval(iv);
  }, [unacceptedAlert, audio]);

  return (
    <div className="space-y-4">
      {/* Schicht-Schnappschuss */}
      <KitchenShiftStats orders={filtered} completedToday={completedToday} hourlyData={hourlyData} />

      {/* Prioritäts-Queue: Welche 3 Bestellungen jetzt zubereiten? */}
      <TopUrgentOrders orders={filtered} />

      {/* Cooking Load Summary */}
      <CookingLoadPanel orders={filtered} />

      {/* Gang-Übersicht: Items nach Gängen für kochende Bestellungen */}
      <GangTimerPanel orders={filtered} />

      {/* Küchen-Checkliste: konsolidierte Items aller aktiven Bestellungen */}
      <PrepItemsPanel orders={filtered} />

      {/* Überfällige Bestellungen — prominenter Alert wenn ≥2 kritisch */}
      <OverdueOrdersAlert orders={filtered} />

      {/* Pickup-Forecast: kochende Lieferbestellungen die in <15 Min fertig sind */}
      <PickupForecastPanel orders={filtered} />

      {/* Dispatch-Bereit Panel: Fertige Lieferbest. gruppiert nach Zone */}
      <DispatchReadinessPanel orders={filtered} />

      {/* Abholung-Warte-Panel: Kunden die auf ihre Abholung warten */}
      <PickupWaitPanel orders={filtered} />

      {/* Stale Orders Alert — Lieferungen ohne Fahrer >10 Min */}
      <StaleOrdersWidget
        locationId={locationFilter === 'all' ? (locations[0]?.id ?? null) : locationFilter}
      />

      {/* Smart Timing Banner */}
      {timings.length > 0 && <KitchenTimingBanner timings={timings} orders={filtered} />}

      {/* Fahrer-Statusleiste oben */}
      <DriverPanel drivers={drivers} states={driverStates} batches={batches} stops={stops} orders={orders} />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="all">Alle Filialen</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <button
            onClick={() => setAudio((v) => !v)}
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm',
              audio ? 'bg-card' : 'bg-muted text-muted-foreground',
            )}
          >
            {audio ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
            {audio ? 'Ton an' : 'Ton aus'}
          </button>
          {audio && (
            <button
              onClick={() => playSound('new_order')}
              className="h-9 rounded-md border bg-card px-3 text-xs text-muted-foreground hover:bg-muted"
              title="Sound-Test"
            >
              Test
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{filtered.filter((o) => o.status !== 'unterwegs').length} offen</span>
          {completedToday !== null && (
            <span className="flex items-center gap-1">
              <Check className="h-3.5 w-3.5 text-matcha-500" />
              <span className="font-bold text-matcha-700">{completedToday}</span>
              <span>heute fertig</span>
            </span>
          )}
        </div>
      </div>

      {/* Proaktiv: "Jetzt kochen!" — wenn Kochstart <5 Min oder überfällig */}
      {timings.length > 0 && <CookingAlertBar timings={timings} orders={filtered} />}

      {/* Popup: ungenommene Order */}
      {unacceptedAlert && (
        <UnacceptedOrderPopup
          order={unacceptedAlert}
          onSnooze={() => setSnoozed((s) => new Map(s).set(unacceptedAlert.id, Date.now() + 30_000))}
        />
      )}

      {/* Kanban */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const colOrders = filtered.filter((o) => o.status === col.status);
          const criticalCount = colOrders.filter((o) => isCriticallyLate(o)).length;
          const totalItems = colOrders.reduce((s, o) => s + (o.items?.length ?? 0), 0);
          return (
            <section key={col.status} className={cn('rounded-xl border', col.color)}>
              <header className="border-b border-black/5">
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    <col.icon className="h-4 w-4" />
                    <h2 className="font-display text-sm font-bold uppercase tracking-wider">{col.label}</h2>
                    {totalItems > 0 && (
                      <span className="text-[9px] font-bold text-muted-foreground opacity-60">
                        {totalItems} Pos.
                      </span>
                    )}
                    {criticalCount > 0 && (
                      <span className="rounded-full bg-red-600 text-white px-1.5 py-0.5 text-[9px] font-black animate-pulse">
                        {criticalCount} krit.
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* "Nächste fertig" — nur für in_zubereitung */}
                    {col.status === 'in_zubereitung' && colOrders.length > 0 && (() => {
                      const now = Date.now();
                      const nextFinishMs = colOrders.reduce((best, o) => {
                        if (!o.bestellt_am) return best;
                        const target = new Date(o.bestellt_am).getTime() + (o.geschaetzte_zubereitung_min ?? 15) * 60_000;
                        return best === 0 || target < best ? target : best;
                      }, 0);
                      if (nextFinishMs === 0) return null;
                      const sec = Math.floor((nextFinishMs - now) / 1000);
                      const isReady = sec <= 0;
                      return (
                        <span className={cn(
                          'text-[9px] font-bold rounded-full px-1.5 py-0.5 tabular-nums',
                          isReady ? 'bg-matcha-200 text-matcha-800 animate-pulse' : sec < 120 ? 'bg-orange-100 text-orange-700' : 'bg-blue-50 text-blue-600',
                        )}>
                          {isReady ? '✓ Bereit!' : `🍳 ${fmtCountdown(sec)}`}
                        </span>
                      );
                    })()}
                    {colOrders.length > 0 && (() => {
                      const oldest = colOrders.reduce((m, o) => {
                        const ms = o.bestellt_am ? Date.now() - new Date(o.bestellt_am).getTime() : 0;
                        return ms > m ? ms : m;
                      }, 0);
                      const om = Math.floor(oldest / 60_000);
                      const os = Math.floor((oldest % 60_000) / 1_000);
                      const isLate = om >= 15;
                      return (
                        <span className={cn(
                          'text-[9px] font-bold tabular-nums rounded-full px-1.5 py-0.5',
                          isLate ? 'bg-red-100 text-red-700' : 'text-muted-foreground',
                        )}>
                          ⏱ {om}:{String(os).padStart(2, '0')}
                        </span>
                      );
                    })()}
                    <Badge variant="muted">{colOrders.length}</Badge>
                  </div>
                </div>
                {/* Heat-Strip: roter Balken = älteste Karte vs. 30-Min-Ziel */}
                {colOrders.length > 0 && (() => {
                  const maxWaitMs = colOrders.reduce((m, o) => {
                    const ms = o.bestellt_am ? Date.now() - new Date(o.bestellt_am).getTime() : 0;
                    return ms > m ? ms : m;
                  }, 0);
                  const pct = Math.min(100, (maxWaitMs / (30 * 60_000)) * 100);
                  const stripColor = pct >= 100 ? 'bg-red-500' : pct >= 60 ? 'bg-orange-400' : 'bg-matcha-400';
                  return (
                    <div className="h-1 bg-black/5 overflow-hidden">
                      <div
                        className={cn('h-full rounded-r-full transition-all duration-1000', stripColor, pct >= 100 && 'animate-pulse')}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  );
                })()}
              </header>
              <div className="space-y-3 p-3">
                {colOrders.length === 0 && (
                  <div className="rounded-lg border-2 border-dashed border-black/10 p-6 text-center text-xs text-muted-foreground">
                    Nichts hier.
                  </div>
                )}
                {(() => {
                  // Pre-compute zone counts for "fertig" delivery orders so each ticket can show a bundling chip
                  const fertigZoneCounts: Record<string, number> =
                    col.status === 'fertig'
                      ? colOrders.reduce((acc: Record<string, number>, o: Order) => {
                          if (o.delivery_zone && o.typ === 'lieferung') {
                            acc[o.delivery_zone] = (acc[o.delivery_zone] ?? 0) + 1;
                          }
                          return acc;
                        }, {})
                      : {};
                  return colOrders.map((o) => (
                    <OrderTicket
                      key={o.id}
                      order={o}
                      next={col.next}
                      timing={timings.find((t) => t.order_id === o.id) ?? null}
                      sameZoneCount={o.delivery_zone ? (fertigZoneCounts[o.delivery_zone] ?? 0) : 0}
                    />
                  ));
                })()}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ Priority Scoring ------------------------------ */

function computeOrderPriority(order: Order): number {
  if (['fertig', 'unterwegs'].includes(order.status)) return 0;
  const now = Date.now();
  let score = 0;

  if (order.bestellt_am) {
    const waitMin = (now - new Date(order.bestellt_am).getTime()) / 60_000;
    const est = order.geschaetzte_zubereitung_min ?? 15;
    const ratio = waitMin / est;
    score += Math.min(50, Math.round(ratio * 35));
    if (waitMin > est) score += Math.min(25, Math.round((waitMin - est) * 3));
  }
  if (order.status === 'neu') score += 22;
  else if (order.status === 'bestätigt') score += 10;
  if (order.typ === 'lieferung') score += 13;
  if (order.external_source) score += 8;

  return Math.min(100, score);
}

function nextStatusFor(status: string): string | null {
  switch (status) {
    case 'neu': return 'bestätigt';
    case 'bestätigt': return 'in_zubereitung';
    case 'in_zubereitung': return 'fertig';
    default: return null;
  }
}

function nextLabelFor(status: string): string {
  switch (status) {
    case 'neu': return 'Annehmen';
    case 'bestätigt': return 'Starten';
    case 'in_zubereitung': return 'Fertig';
    default: return '→';
  }
}

function TopUrgentOrders({ orders }: { orders: Order[] }) {
  const [pending, startTransition] = useTransition();
  const active = orders.filter((o) => !['fertig', 'unterwegs'].includes(o.status));
  if (active.length < 2) return null;

  const scored = active
    .map((o) => ({ order: o, score: computeOrderPriority(o) }))
    .filter((x) => x.score >= 25)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  if (scored.length === 0) return null;

  return (
    <div className="rounded-xl border-2 border-matcha-300 bg-matcha-50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Zap className="h-4 w-4 text-matcha-700" />
        <span className="font-display text-xs font-bold uppercase tracking-wider text-matcha-800">
          Jetzt priorisieren · Top {scored.length}
        </span>
        <span className="ml-auto text-[10px] text-matcha-500">Prioritätsscore 0–100</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {scored.map(({ order, score }) => {
          const now = Date.now();
          const waitMin = order.bestellt_am
            ? Math.floor((now - new Date(order.bestellt_am).getTime()) / 60_000)
            : 0;
          const est = order.geschaetzte_zubereitung_min ?? 15;
          const overMin = Math.max(0, waitMin - est);
          const isOverdue = overMin > 0;
          const scoreBg =
            score >= 75 ? 'bg-red-500 text-white' :
            score >= 55 ? 'bg-orange-400 text-white' :
            score >= 35 ? 'bg-amber-300 text-amber-900' :
            'bg-matcha-200 text-matcha-800';
          const cardBorder =
            score >= 75 ? 'border-red-300 bg-red-50' :
            score >= 55 ? 'border-orange-200 bg-orange-50' :
            'border-matcha-200 bg-white';
          const nextStatus = nextStatusFor(order.status);

          return (
            <div key={order.id} className={cn(
              'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs',
              cardBorder,
            )}>
              {/* Score badge */}
              <div className={cn(
                'h-8 w-8 rounded-full grid place-items-center text-[10px] font-black shrink-0',
                scoreBg,
              )}>
                {Math.round(score)}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-foreground">
                  #{order.bestellnummer.replace('FF-', '')}
                </div>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span className={cn(
                    'font-semibold tabular-nums',
                    isOverdue ? 'text-red-600 font-black' : 'text-muted-foreground',
                  )}>
                    {isOverdue ? `+${overMin}m over` : `${waitMin}/${est}m`}
                  </span>
                  {order.typ === 'lieferung' && (
                    <Bike className="h-2.5 w-2.5 text-muted-foreground" />
                  )}
                </div>
              </div>
              {/* Mini bar showing urgency */}
              <div className="ml-1 flex flex-col items-center gap-0.5">
                {[75, 50, 25].map((threshold) => (
                  <div
                    key={threshold}
                    className={cn(
                      'h-1 w-1 rounded-full',
                      score >= threshold
                        ? (threshold === 75 ? 'bg-red-500' : threshold === 50 ? 'bg-orange-400' : 'bg-amber-400')
                        : 'bg-muted',
                    )}
                  />
                ))}
              </div>
              {/* One-tap advance button */}
              {nextStatus && (
                <button
                  onClick={() => startTransition(() => void advanceOrder(order.id, nextStatus))}
                  disabled={pending}
                  className={cn(
                    'ml-1 h-7 rounded-md px-2 text-[10px] font-bold transition shrink-0',
                    score >= 75
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : score >= 55
                      ? 'bg-orange-500 text-white hover:bg-orange-600'
                      : 'bg-matcha-700 text-white hover:bg-matcha-800',
                  )}
                >
                  {nextLabelFor(order.status)} →
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ KitchenShiftStats ------------------------------ */

function KitchenShiftStats({ orders, completedToday, hourlyData }: { orders: Order[]; completedToday: number | null; hourlyData: { h: number; label: string; orders: number }[] }) {
  const now = Date.now();
  // Orders in last 60 minutes
  const ordersLastHour = orders.filter((o) =>
    o.bestellt_am && now - new Date(o.bestellt_am).getTime() < 60 * 60_000,
  ).length;
  const cookingNow = orders.filter((o) => o.status === 'in_zubereitung').length;
  const waitingForDriver = orders.filter((o) => o.status === 'fertig' && o.typ === 'lieferung').length;
  const criticalLate = orders.filter((o) => isCriticallyLate(o)).length;

  if (completedToday === null && ordersLastHour === 0 && waitingForDriver === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {completedToday !== null && (
        <div className="flex items-center gap-1.5 rounded-full border border-matcha-200 bg-matcha-50 px-3 py-1 text-xs font-bold text-matcha-700">
          <Check className="h-3 w-3" />
          {completedToday} heute fertig
        </div>
      )}
      {ordersLastHour > 0 && (
        <div className="flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
          <TrendingUp className="h-3 w-3" />
          {ordersLastHour}/Std gerade
        </div>
      )}
      {cookingNow > 0 && (
        <div className="flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">
          <ChefHat className="h-3 w-3" />
          {cookingNow} in Zubereitung
        </div>
      )}
      {waitingForDriver > 0 && (
        <div className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
          <Bike className="h-3 w-3" />
          {waitingForDriver}× wartet auf Fahrer
        </div>
      )}
      {criticalLate > 0 && (
        <div className="flex items-center gap-1.5 rounded-full border border-red-300 bg-red-50 px-3 py-1 text-xs font-bold text-red-700 animate-pulse">
          <Flame className="h-3 w-3" />
          {criticalLate} kritisch überzogen!
        </div>
      )}

      {/* Nächste Stunde Prognose */}
      {hourlyData.length >= 2 && (() => {
        const nowH = new Date().getHours();
        const nowMinFrac = new Date().getMinutes() / 60;
        const current = hourlyData.find((d) => d.h === nowH);
        const prev = hourlyData.find((d) => d.h === nowH - 1);
        if (!current || nowMinFrac < 0.2) return null;
        // Extrapolate: current hour rate → next hour
        const currentRate = current.orders / Math.max(0.1, nowMinFrac);
        const prevRate = prev?.orders ?? currentRate;
        const trend = currentRate - prevRate;
        const nextHrPred = Math.round(Math.max(0, currentRate + trend * 0.5));
        if (nextHrPred === 0) return null;
        const isRising = trend > 1;
        const isFalling = trend < -1;
        return (
          <div className={cn(
            'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold',
            isRising ? 'border-orange-300 bg-orange-50 text-orange-700' :
            isFalling ? 'border-matcha-200 bg-matcha-50 text-matcha-700' :
            'border-blue-200 bg-blue-50 text-blue-700',
          )}>
            {isRising ? <Flame className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
            {nowH + 1}:00 ≈ {nextHrPred} Best.
          </div>
        );
      })()}

      {/* Stündliches Bestellvolumen — kompakte Sparkline */}
      {hourlyData.length >= 3 && (() => {
        const nowH = new Date().getHours();
        const maxOrders = Math.max(...hourlyData.map((d) => d.orders), 1);
        return (
          <div className="w-full mt-1 rounded-xl border border-border bg-card p-2">
            <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
              <span className="font-bold uppercase tracking-wider flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-matcha-600" /> Bestellvolumen heute
              </span>
              <span className="tabular-nums">Spitze: {maxOrders}</span>
            </div>
            <ResponsiveContainer width="100%" height={44}>
              <BarChart data={hourlyData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barCategoryGap="20%">
                <Tooltip
                  cursor={false}
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const d = payload[0].payload as { label: string; orders: number };
                    return (
                      <div className="rounded-lg bg-matcha-900 px-2 py-1 text-[10px] text-white shadow-lg">
                        {d.label}: <span className="font-bold">{d.orders}</span>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="orders" radius={[2, 2, 0, 0]}>
                  {hourlyData.map((d) => (
                    <Cell
                      key={d.h}
                      fill={
                        d.h === nowH ? '#2d6b45' :
                        d.orders >= maxOrders * 0.8 ? '#f97316' :
                        d.h > nowH ? '#e5e7eb' :
                        '#94a3b8'
                      }
                    />
                  ))}
                </Bar>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 8, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  interval={1}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      })()}
    </div>
  );
}

/* ------------------------------ OverdueOrdersAlert ------------------------------ */

function OverdueOrdersAlert({ orders }: { orders: Order[] }) {
  const now = Date.now();
  const overdue = orders.filter((o) => {
    if (['fertig', 'unterwegs'].includes(o.status)) return false;
    if (!o.bestellt_am) return false;
    const waitMin = (now - new Date(o.bestellt_am).getTime()) / 60_000;
    const est = o.geschaetzte_zubereitung_min ?? 15;
    return waitMin >= est + 5;
  });

  if (overdue.length < 2) return null;

  const worst = overdue.reduce((m, o) => {
    const waitMin = o.bestellt_am ? (now - new Date(o.bestellt_am).getTime()) / 60_000 : 0;
    const est = o.geschaetzte_zubereitung_min ?? 15;
    const over = waitMin - est;
    const mOver = m.bestellt_am ? (now - new Date(m.bestellt_am).getTime()) / 60_000 - (m.geschaetzte_zubereitung_min ?? 15) : 0;
    return over > mOver ? o : m;
  }, overdue[0]);
  const worstOver = worst.bestellt_am
    ? Math.floor((now - new Date(worst.bestellt_am).getTime()) / 60_000) - (worst.geschaetzte_zubereitung_min ?? 15)
    : 0;

  return (
    <div className="rounded-xl border-2 border-red-400 bg-red-50 p-3 animate-pulse">
      <div className="flex items-center gap-2">
        <Flame className="h-5 w-5 text-red-600 shrink-0" />
        <div className="flex-1">
          <span className="font-display text-sm font-black text-red-800">
            {overdue.length} Bestellungen überfällig!
          </span>
          <span className="ml-2 text-xs text-red-600">
            Längste Überschreitung: +{worstOver} Min
            {worst && <span className="ml-1 font-bold">(#{worst.bestellnummer.replace('FF-', '')} · {worst.kunde_name})</span>}
          </span>
        </div>
        <div className="flex gap-1 shrink-0">
          {overdue.slice(0, 4).map((o) => {
            const ov = o.bestellt_am
              ? Math.floor((now - new Date(o.bestellt_am).getTime()) / 60_000) - (o.geschaetzte_zubereitung_min ?? 15)
              : 0;
            return (
              <span key={o.id} className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums',
                ov >= 15 ? 'bg-red-600 text-white' : 'bg-red-200 text-red-800',
              )}>
                +{ov}m
              </span>
            );
          })}
          {overdue.length > 4 && (
            <span className="rounded-full bg-red-200 text-red-800 px-2 py-0.5 text-[10px] font-bold">
              +{overdue.length - 4}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ CookingLoadPanel ------------------------------ */

function CookingLoadPanel({ orders }: { orders: Order[] }) {
  const now = Date.now();
  const active = orders.filter((o) => ['bestätigt', 'in_zubereitung', 'fertig'].includes(o.status));
  if (active.length === 0) return null;

  type Bucket = { label: string; color: string; bg: string; icon: React.ComponentType<{ className?: string }>; orders: Order[] };
  const buckets: Bucket[] = [
    { label: '0–10 Min',  color: 'text-matcha-700', bg: 'bg-matcha-100', icon: Clock,      orders: [] },
    { label: '10–20 Min', color: 'text-orange-700', bg: 'bg-orange-100', icon: TrendingUp, orders: [] },
    { label: '20+ Min',   color: 'text-red-700',    bg: 'bg-red-100',    icon: Flame,      orders: [] },
  ];

  for (const o of active) {
    const waitMin = o.bestellt_am ? (now - new Date(o.bestellt_am).getTime()) / 60_000 : 0;
    if (waitMin < 10) buckets[0].orders.push(o);
    else if (waitMin < 20) buckets[1].orders.push(o);
    else buckets[2].orders.push(o);
  }

  const maxCount = Math.max(...buckets.map((b) => b.orders.length), 1);
  const hasCritical = buckets[2].orders.length > 0;

  return (
    <div className={cn('rounded-xl border p-3', hasCritical ? 'border-red-200 bg-red-50' : 'border-border bg-card')}>
      <div className="mb-2 flex items-center gap-2">
        <Flame className={cn('h-4 w-4', hasCritical ? 'text-red-600' : 'text-matcha-600')} />
        <span className="font-display text-xs font-bold uppercase tracking-wider">
          Küchenauslastung · {active.length} aktiv
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {buckets.map((b) => {
          const BIcon = b.icon;
          const pct = (b.orders.length / maxCount) * 100;
          return (
            <div key={b.label} className={cn('rounded-lg p-2', b.bg, b.orders.length === 0 && 'opacity-40')}>
              <div className={cn('flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide mb-1', b.color)}>
                <BIcon className="h-3 w-3" />{b.label}
              </div>
              <div className="flex items-end gap-1.5">
                <div className={cn('font-display text-xl font-black leading-none', b.color)}>{b.orders.length}</div>
                {b.orders.length > 0 && (() => {
                  const oldestMs = b.orders.reduce((m, o) => {
                    const ms = o.bestellt_am ? now - new Date(o.bestellt_am).getTime() : 0;
                    return ms > m ? ms : m;
                  }, 0);
                  const om = Math.floor(oldestMs / 60_000);
                  const os = Math.floor((oldestMs % 60_000) / 1_000);
                  return (
                    <span className={cn('text-[10px] font-bold tabular-nums opacity-70 mb-0.5', b.color)}>
                      max {om}:{String(os).padStart(2, '0')}
                    </span>
                  );
                })()}
              </div>
              {b.orders.length > 0 && (
                <div className="mt-1 h-1 rounded-full bg-black/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 bg-current opacity-40"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
              <div className={cn('mt-0.5 text-[9px] truncate opacity-70', b.color)}>
                {b.orders.slice(0, 2).map((o) => `#${o.bestellnummer.replace('FF-', '')}`).join(' · ')}
                {b.orders.length > 2 && ` +${b.orders.length - 2}`}
              </div>
            </div>
          );
        })}
      </div>

      {/* Kochleistung: avg Wartezeit vs. Schätzzeit für in_zubereitung-Aufträge */}
      {(() => {
        const cooking = orders.filter((o) => o.status === 'in_zubereitung' && o.bestellt_am);
        if (cooking.length === 0) return null;
        const avgActualMin = cooking.reduce((s, o) => s + (now - new Date(o.bestellt_am!).getTime()) / 60_000, 0) / cooking.length;
        const avgEstMin = cooking.reduce((s, o) => s + (o.geschaetzte_zubereitung_min ?? 15), 0) / cooking.length;
        const ratio = avgActualMin / avgEstMin;
        const pct = Math.min(100, Math.round(ratio * 100));
        const color = ratio >= 1 ? 'bg-red-500' : ratio >= 0.8 ? 'bg-orange-400' : 'bg-matcha-400';
        const textColor = ratio >= 1 ? 'text-red-700' : ratio >= 0.8 ? 'text-orange-700' : 'text-matcha-700';
        return (
          <div className="mt-2 pt-2 border-t border-black/5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                Ø Kochzeit: {Math.floor(avgActualMin)}:{String(Math.floor((avgActualMin % 1) * 60)).padStart(2, '0')} Min
              </span>
              <span className={cn('text-[9px] font-bold tabular-nums', textColor)}>
                {pct}% von Schätzung ({Math.round(avgEstMin)} Min)
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
              <div className={cn('h-full rounded-full transition-all duration-1000', color, ratio >= 1 && 'animate-pulse')} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/* ------------------------------ GangTimerPanel ------------------------------ */

function GangTimerPanel({ orders }: { orders: Order[] }) {
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const cooking = orders.filter((o) => ['bestätigt', 'in_zubereitung'].includes(o.status));
  if (cooking.length === 0) return null;

  // Sammle alle Items von kochenden Bestellungen, gruppiert nach Gang
  const byGang: Record<string, { items: (Item & { orderWaitMin: number })[]; orderCount: number }> = {};
  for (const o of cooking) {
    const waitMin = o.bestellt_am ? (Date.now() - new Date(o.bestellt_am).getTime()) / 60_000 : 0;
    for (const item of (o.items ?? [])) {
      const gang = item.gang != null ? String(item.gang) : '0';
      if (!byGang[gang]) byGang[gang] = { items: [], orderCount: 0 };
      for (let i = 0; i < item.menge; i++) byGang[gang].items.push({ ...item, orderWaitMin: waitMin });
      byGang[gang].orderCount = Math.max(byGang[gang].orderCount, 1);
    }
  }

  const gangs = Object.entries(byGang).sort((a, b) => Number(a[0]) - Number(b[0]));
  if (gangs.length === 0) return null;

  // Nur anzeigen wenn mehre Gänge oder > 10 Items gesamt
  const totalItems = gangs.reduce((s, [, g]) => s + g.items.length, 0);
  if (gangs.length < 2 && totalItems < 8) return null;

  const gangLabel = (g: string) => {
    switch (g) {
      case '0': case '1': return 'Vorspeise';
      case '2': return 'Hauptgang';
      case '3': return 'Dessert';
      default: return `Gang ${g}`;
    }
  };

  const gangColor = (g: string) => {
    switch (g) {
      case '0': case '1': return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', bar: 'bg-blue-400' };
      case '2': return { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800', bar: 'bg-orange-400' };
      case '3': return { bg: 'bg-matcha-50', border: 'border-matcha-200', text: 'text-matcha-800', bar: 'bg-matcha-400' };
      default: return { bg: 'bg-muted', border: 'border-border', text: 'text-muted-foreground', bar: 'bg-muted-foreground' };
    }
  };

  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        <Utensils className="h-4 w-4 text-matcha-600" />
        <span className="font-display text-xs font-bold uppercase tracking-wider">
          Gang-Übersicht · {cooking.length} Bestellungen · {totalItems} Positionen
        </span>
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${gangs.length}, minmax(0, 1fr))` }}>
        {gangs.map(([gang, { items }]) => {
          const c = gangColor(gang);
          const maxWait = items.reduce((m, i) => Math.max(m, i.orderWaitMin), 0);
          const pct = Math.min(100, Math.round((maxWait / 20) * 100));
          // Top items by count
          const topItems = Object.entries(
            items.reduce<Record<string, number>>((acc, it) => { acc[it.name] = (acc[it.name] ?? 0) + 1; return acc; }, {})
          ).sort((a, b) => b[1] - a[1]).slice(0, 3);
          return (
            <div key={gang} className={cn('rounded-lg border p-2', c.bg, c.border)}>
              <div className={cn('text-[10px] font-black uppercase tracking-wide mb-1.5', c.text)}>
                {gangLabel(gang)}
              </div>
              <div className={cn('font-display text-2xl font-black leading-none mb-1', c.text)}>
                {items.length}
              </div>
              <div className="text-[9px] text-muted-foreground mb-1.5 space-y-0.5">
                {topItems.map(([name, cnt]) => (
                  <div key={name} className="truncate">
                    {cnt > 1 && <span className="font-bold">{cnt}× </span>}{name}
                  </div>
                ))}
              </div>
              <div className="h-1 rounded-full bg-black/10 overflow-hidden">
                <div
                  className={cn('h-full rounded-full', c.bar, pct >= 80 && 'animate-pulse')}
                  style={{ width: `${pct}%`, transition: 'width 1s linear' }}
                />
              </div>
              <div className={cn('mt-0.5 text-[9px] tabular-nums', c.text, 'opacity-70')}>
                max {Math.floor(maxWait)}:{String(Math.floor((maxWait % 1) * 60)).padStart(2, '0')} Min
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ PickupForecastPanel ------------------------------ */

function PickupForecastPanel({ orders }: { orders: Order[] }) {
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();
  const WINDOW_MIN = 20; // zeige Bestellungen die in <20 Min fertig sein sollten

  const upcoming = orders
    .filter((o) => o.typ === 'lieferung' && ['bestätigt', 'in_zubereitung'].includes(o.status))
    .map((o) => {
      const startMs = o.bestellt_am ? new Date(o.bestellt_am).getTime() : now;
      const estReadyMs = startMs + (o.geschaetzte_zubereitung_min ?? 15) * 60_000;
      const minUntilReady = Math.floor((estReadyMs - now) / 60_000);
      return { order: o, minUntilReady, estReadyMs };
    })
    .filter((x) => x.minUntilReady <= WINDOW_MIN)
    .sort((a, b) => a.estReadyMs - b.estReadyMs);

  if (upcoming.length === 0) return null;

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Bike className="h-4 w-4 text-blue-700" />
        <span className="font-display text-xs font-bold uppercase tracking-wider text-blue-800">
          Pickup-Forecast · {upcoming.length} Lieferung{upcoming.length !== 1 ? 'en' : ''} in &lt;{WINDOW_MIN} Min fertig
        </span>
        <a
          href="/dispatch"
          className="ml-auto text-[10px] font-bold text-blue-700 hover:text-blue-900 underline"
        >
          Zum Dispatch →
        </a>
      </div>
      <div className="flex flex-wrap gap-2">
        {upcoming.map(({ order, minUntilReady }) => {
          const isNow = minUntilReady <= 0;
          const isSoon = minUntilReady <= 5 && minUntilReady > 0;
          const readyStr = new Date(
            (order.bestellt_am ? new Date(order.bestellt_am).getTime() : now) +
            (order.geschaetzte_zubereitung_min ?? 15) * 60_000,
          ).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
          return (
            <div
              key={order.id}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px]',
                isNow  ? 'border-matcha-400 bg-matcha-100' :
                isSoon ? 'border-blue-400 bg-blue-100 animate-pulse' :
                         'border-blue-200 bg-white',
              )}
            >
              <span className="font-mono font-bold text-foreground">
                #{order.bestellnummer.replace('FF-', '')}
              </span>
              {order.delivery_zone && (
                <span className={cn(
                  'rounded px-1.5 py-0.5 text-[9px] font-black',
                  order.delivery_zone === 'A' ? 'bg-green-100 text-green-800' :
                  order.delivery_zone === 'B' ? 'bg-blue-100 text-blue-800' :
                  order.delivery_zone === 'C' ? 'bg-orange-100 text-orange-800' :
                  'bg-red-100 text-red-800',
                )}>
                  {order.delivery_zone}
                </span>
              )}
              <span className={cn(
                'rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums',
                isNow  ? 'bg-matcha-600 text-white' :
                isSoon ? 'bg-blue-600 text-white' :
                         'bg-blue-100 text-blue-800',
              )}>
                {isNow ? '✓ Jetzt' : `~${readyStr}`}
              </span>
              <span className="text-muted-foreground truncate max-w-[80px]">{order.kunde_name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ PickupWaitPanel ------------------------------ */

function PickupWaitPanel({ orders }: { orders: Order[] }) {
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 10_000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();
  const waiting = orders
    .filter((o) => o.status === 'fertig' && o.typ === 'abholung')
    .map((o) => {
      const fertigMs = o.fertig_am
        ? now - new Date(o.fertig_am).getTime()
        : now - new Date(o.bestellt_am ?? now).getTime();
      return { order: o, waitMin: Math.floor(fertigMs / 60_000) };
    })
    .sort((a, b) => b.waitMin - a.waitMin);

  if (waiting.length === 0) return null;

  const hasLong = waiting.some((w) => w.waitMin >= 10);

  return (
    <div className={cn(
      'rounded-xl border p-3',
      hasLong ? 'border-amber-300 bg-amber-50' : 'border-matcha-200 bg-matcha-50',
    )}>
      <div className="mb-2 flex items-center gap-2">
        <ShoppingBag className={cn('h-4 w-4', hasLong ? 'text-amber-700' : 'text-matcha-700')} />
        <span className={cn('font-display text-xs font-bold uppercase tracking-wider', hasLong ? 'text-amber-800' : 'text-matcha-800')}>
          Abholung wartet · {waiting.length} {waiting.length === 1 ? 'Bestellung' : 'Bestellungen'}
        </span>
        {hasLong && (
          <span className="ml-auto rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-bold text-white animate-pulse">
            Kunde wartet lang!
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {waiting.map(({ order, waitMin }) => {
          const isLong = waitMin >= 10;
          const isMedium = waitMin >= 5 && waitMin < 10;
          return (
            <div key={order.id} className={cn(
              'flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px]',
              isLong   ? 'border-red-300 bg-red-50' :
              isMedium ? 'border-amber-300 bg-amber-50' :
                         'border-matcha-200 bg-white',
            )}>
              <span className="font-mono font-bold text-foreground">
                #{order.bestellnummer.replace('FF-', '')}
              </span>
              <span className="text-muted-foreground truncate max-w-[80px]">{order.kunde_name}</span>
              <span className={cn(
                'rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums',
                isLong   ? 'bg-red-500 text-white animate-pulse' :
                isMedium ? 'bg-amber-500 text-white' :
                           'bg-matcha-100 text-matcha-800',
              )}>
                {waitMin} Min
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ DispatchReadinessPanel ------------------------------ */

function DispatchReadinessPanel({ orders }: { orders: Order[] }) {
  const now = Date.now();
  const fertigDelivery = orders.filter(
    (o) => o.status === 'fertig' && o.typ === 'lieferung',
  );
  if (fertigDelivery.length === 0) return null;

  const ZONE_COLORS: Record<string, { badge: string; bar: string }> = {
    A: { badge: 'bg-green-100 text-green-800',   bar: 'bg-green-400' },
    B: { badge: 'bg-blue-100 text-blue-800',     bar: 'bg-blue-400' },
    C: { badge: 'bg-orange-100 text-orange-800', bar: 'bg-orange-400' },
    D: { badge: 'bg-red-100 text-red-800',       bar: 'bg-red-400' },
  };
  function zoneColors(z: string | null) {
    return ZONE_COLORS[z ?? ''] ?? { badge: 'bg-muted text-muted-foreground', bar: 'bg-muted-foreground' };
  }

  const byZone: Record<string, { orders: Order[]; waitMax: number }> = {};
  for (const o of fertigDelivery) {
    const zone = o.delivery_zone ?? '?';
    if (!byZone[zone]) byZone[zone] = { orders: [], waitMax: 0 };
    const fertigMs = o.fertig_am
      ? now - new Date(o.fertig_am).getTime()
      : now - new Date(o.bestellt_am ?? now).getTime();
    const waitMin = Math.floor(fertigMs / 60_000);
    byZone[zone].orders.push(o);
    byZone[zone].waitMax = Math.max(byZone[zone].waitMax, waitMin);
  }

  const urgent = fertigDelivery.some((o) => {
    const ms = o.fertig_am ? now - new Date(o.fertig_am).getTime() : 0;
    return ms > 10 * 60_000;
  });

  return (
    <div className={cn(
      'rounded-xl border p-3',
      urgent ? 'border-red-200 bg-red-50' : 'border-matcha-200 bg-matcha-50',
    )}>
      <div className="mb-2 flex items-center gap-2">
        <MapPin className={cn('h-4 w-4', urgent ? 'text-red-600' : 'text-matcha-700')} />
        <span className={cn('font-display text-xs font-bold uppercase tracking-wider', urgent ? 'text-red-800' : 'text-matcha-800')}>
          Dispatch-Bereit · {fertigDelivery.length} Lieferung{fertigDelivery.length !== 1 ? 'en' : ''} warten
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {Object.entries(byZone).sort((a, b) => a[0].localeCompare(b[0])).map(([zone, { orders: zOrders, waitMax }]) => {
          const { badge } = zoneColors(zone);
          const waitUrgent = waitMax >= 10;
          return (
            <div key={zone} className={cn(
              'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs',
              waitUrgent ? 'border-red-300 bg-red-50' : 'border-border bg-card',
            )}>
              <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-black', badge)}>
                {zone === '?' ? '—' : `Zone ${zone}`}
              </span>
              <span className="font-bold">{zOrders.length}×</span>
              <span className="text-muted-foreground">
                {euro(zOrders.reduce((s, o) => s + o.gesamtbetrag, 0))}
              </span>
              <span className={cn(
                'rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums',
                waitUrgent ? 'bg-red-500 text-white animate-pulse' : 'bg-muted text-muted-foreground',
              )}>
                {waitMax} Min
              </span>
            </div>
          );
        })}
        <a
          href="/dispatch"
          className="flex items-center gap-1.5 rounded-lg border border-matcha-300 bg-matcha-700 px-3 py-2 text-[11px] font-bold text-matcha-50 hover:bg-matcha-800 transition"
        >
          <Bike className="h-3 w-3" />
          Zum Dispatch
        </a>
      </div>
    </div>
  );
}

/* ------------------------------ KitchenTimingBanner ------------------------------ */

function KitchenTimingBanner({ timings, orders }: { timings: KitchenTiming[]; orders: Order[] }) {
  const now = Date.now();

  const items = timings
    .map((t) => {
      const order = orders.find((o) => o.id === t.order_id);
      if (!order) return null;
      const cookStartMs = t.cook_start_at ? new Date(t.cook_start_at).getTime() : null;
      const readyMs     = t.ready_target  ? new Date(t.ready_target).getTime()  : null;
      const secsUntilCook = cookStartMs ? Math.floor((cookStartMs - now) / 1000) : null;
      const secsUntilReady = readyMs    ? Math.floor((readyMs - now) / 1000)    : null;
      return { t, order, secsUntilCook, secsUntilReady };
    })
    .filter(Boolean) as { t: KitchenTiming; order: Order; secsUntilCook: number | null; secsUntilReady: number | null }[];

  if (items.length === 0) return null;

  // Sortiere: cooking-Bestellungen zuerst, dann scheduled nach cook_start_at
  const sorted = [...items].sort((a, b) => {
    if (a.t.status === 'cooking' && b.t.status !== 'cooking') return -1;
    if (b.t.status === 'cooking' && a.t.status !== 'cooking') return 1;
    const aMs = a.t.ready_target ? new Date(a.t.ready_target).getTime() : (a.t.cook_start_at ? new Date(a.t.cook_start_at).getTime() : 0);
    const bMs = b.t.ready_target ? new Date(b.t.ready_target).getTime() : (b.t.cook_start_at ? new Date(b.t.cook_start_at).getTime() : 0);
    return aMs - bMs;
  });

  const nextReady = sorted.find((x) => x.t.status === 'cooking' && x.secsUntilReady !== null);
  const overdueCount = sorted.filter((x) => x.secsUntilCook !== null && x.secsUntilCook < 0).length;

  return (
    <div className={cn('rounded-xl border p-3', overdueCount > 0 ? 'border-orange-300 bg-orange-50' : 'border-matcha-200 bg-matcha-50')}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ChefHat className={cn('h-4 w-4', overdueCount > 0 ? 'text-orange-700' : 'text-matcha-700')} />
          <span className={cn('font-display text-xs font-bold uppercase tracking-wider', overdueCount > 0 ? 'text-orange-800' : 'text-matcha-800')}>
            Smart Timing · {items.length} Bestellungen
          </span>
        </div>
        {nextReady && nextReady.secsUntilReady !== null && (
          <span className={cn(
            'text-[10px] font-bold rounded-full px-2 py-0.5 tabular-nums',
            nextReady.secsUntilReady <= 0 ? 'bg-matcha-600 text-white animate-pulse' :
            nextReady.secsUntilReady < 120 ? 'bg-orange-500 text-white animate-pulse' :
            'bg-matcha-200 text-matcha-800',
          )}>
            {nextReady.secsUntilReady <= 0
              ? '✓ Fertig!'
              : `Nächste fertig in ${fmtCountdown(nextReady.secsUntilReady)}`}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {sorted.map(({ t, order, secsUntilCook, secsUntilReady }) => {
          const cookOverdue = secsUntilCook !== null && secsUntilCook < 0;
          const cookSoon    = secsUntilCook !== null && secsUntilCook >= 0 && secsUntilCook < 300;
          const isCooking   = t.status === 'cooking';
          // Mini-Fortschrittsbalken für kochende Bestellungen
          const cookPct = isCooking && t.cook_start_at && t.ready_target
            ? Math.min(100, Math.round(
                (now - new Date(t.cook_start_at).getTime()) /
                (new Date(t.ready_target).getTime() - new Date(t.cook_start_at).getTime()) * 100,
              ))
            : null;
          return (
            <div
              key={t.id}
              className={cn(
                'rounded-lg border px-3 py-2 text-[11px] min-w-[100px]',
                cookOverdue ? 'border-red-300 bg-red-50 text-red-900' :
                cookSoon    ? 'border-orange-300 bg-orange-50 text-orange-900 animate-pulse' :
                isCooking   ? 'border-matcha-300 bg-matcha-50 text-matcha-900' :
                              'border-matcha-200 bg-white text-matcha-900',
              )}
            >
              <div className="font-bold">#{order.bestellnummer.replace('FF-', '')}</div>
              {secsUntilCook !== null && secsUntilCook > 0 && (
                <div className="text-blue-700">Kochen in {fmtCountdown(secsUntilCook)}</div>
              )}
              {cookOverdue && <div className="font-bold text-red-700">⚠ Kochstart überfällig!</div>}
              {isCooking && secsUntilReady !== null && (
                <div className="mt-0.5 font-semibold text-matcha-700">
                  {secsUntilReady > 0 ? `Fertig in ${fmtCountdown(secsUntilReady)}` : '✓ Sollte fertig sein'}
                </div>
              )}
              {cookPct !== null && (
                <div className="mt-1.5 h-1 rounded-full bg-black/10 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      cookPct >= 90 ? 'bg-matcha-500 animate-pulse' :
                      cookPct >= 70 ? 'bg-orange-400' : 'bg-blue-400',
                    )}
                    style={{ width: `${cookPct}%`, transition: 'width 1s linear' }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ UnacceptedOrderPopup ------------------------------ */

function UnacceptedOrderPopup({ order, onSnooze }: { order: Order; onSnooze: () => void }) {
  const [pending, startTransition] = useTransition();
  const waitSec = order.bestellt_am
    ? Math.floor((Date.now() - new Date(order.bestellt_am).getTime()) / 1000)
    : 0;
  const waitMin = Math.floor(waitSec / 60);

  function accept() {
    startTransition(async () => {
      await advanceOrder(order.id, 'bestätigt');
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="relative max-w-lg w-full rounded-3xl bg-red-50 border-4 border-red-500 shadow-2xl p-6 animate-in zoom-in-95 duration-200">
        {/* Blink Ring */}
        <div className="absolute inset-0 rounded-3xl border-4 border-red-500 animate-ping opacity-50 pointer-events-none" />

        <div className="relative flex items-center gap-4 mb-4">
          <div className="h-14 w-14 rounded-2xl bg-red-600 text-white flex items-center justify-center animate-pulse">
            <AlertCircle className="h-7 w-7" />
          </div>
          <div className="flex-1">
            <div className="text-xs font-bold uppercase tracking-wider text-red-700">Bestellung noch nicht angenommen!</div>
            <div className="font-display text-2xl font-bold text-red-900 leading-tight">
              #{order.bestellnummer.replace('FF-', '')} · {waitMin > 0 ? `${waitMin} Min` : `${waitSec}s`} Wartezeit
            </div>
          </div>
        </div>

        <div className="relative bg-white rounded-2xl p-4 mb-4 border border-red-200">
          <div className="text-sm text-muted-foreground mb-2">
            <span className="font-bold text-foreground">{order.kunde_name}</span>
            {' · '}
            {order.typ === 'lieferung' ? '🛵 Liefern' : order.typ === 'abholung' ? '🥡 Abholung' : '🍽 Vor Ort'}
            {' · '}
            <span className="font-display font-bold">{euro(order.gesamtbetrag)}</span>
          </div>
          <ul className="space-y-1 text-sm">
            {order.items?.slice(0, 4).map((it) => (
              <li key={it.id} className="flex gap-2">
                <span className="font-bold text-matcha-800">{it.menge}×</span>
                <span>{it.name}</span>
              </li>
            ))}
            {order.items && order.items.length > 4 && (
              <li className="text-xs text-muted-foreground">+ {order.items.length - 4} weitere Positionen</li>
            )}
          </ul>
        </div>

        <div className="relative flex gap-3">
          <button
            onClick={accept}
            disabled={pending}
            className="flex-1 h-14 rounded-2xl bg-matcha-900 text-matcha-50 font-display font-bold text-lg hover:bg-matcha-800 disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            <Check className="h-5 w-5" />
            Jetzt annehmen
          </button>
          <button
            onClick={onSnooze}
            className="h-14 px-5 rounded-2xl border-2 border-red-300 bg-white text-red-900 font-bold hover:bg-red-100"
          >
            30s später
          </button>
        </div>

        <div className="relative mt-3 text-center text-xs text-red-700">
          Alarm wiederholt sich, solange die Bestellung nicht angenommen ist.
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ DriverPanel ------------------------------ */

function DriverPanel({
  drivers, states, batches, stops, orders,
}: {
  drivers: Driver[];
  states: Map<string, DriverState>;
  batches: Batch[];
  stops: Stop[];
  orders: Order[];
}) {
  const online = drivers.filter((d) => d.status?.ist_online);

  if (drivers.length === 0) {
    return (
      <Card className="p-4 border-dashed">
        <div className="text-sm text-muted-foreground">
          Keine Fahrer angelegt — <a href="/drivers" className="underline">jetzt Fahrer einladen</a>.
        </div>
      </Card>
    );
  }

  if (online.length === 0) {
    return (
      <Card className="p-4 bg-muted/30">
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <Bike className="h-4 w-4" /> Kein Fahrer online.
          {drivers.length > 0 && <span>({drivers.length} angelegt)</span>}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Bike className="h-4 w-4 text-matcha-700" />
        <h3 className="font-display text-sm font-bold uppercase tracking-wider">Fahrer ({online.length} online)</h3>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {online.map((d) => (
          <DriverChip
            key={d.id}
            driver={d}
            state={states.get(d.id) ?? 'frei'}
            batches={batches}
            stops={stops}
            orders={orders}
          />
        ))}
      </div>
    </Card>
  );
}

function DriverChip({
  driver, state, batches, stops, orders,
}: {
  driver: Driver;
  state: DriverState;
  batches: Batch[];
  stops: Stop[];
  orders: Order[];
}) {
  const batch = batches.find((b) => b.driver_id === driver.id);
  const batchId = driver.status?.aktueller_batch_id ?? batch?.id;
  const myStops = batchId ? stops.filter((s) => s.batch_id === batchId) : [];
  const totalStops = myStops.length;
  const deliveredStops = myStops.filter((s) => s.geliefert_am).length;
  const nextStop = myStops.find((s) => !s.geliefert_am);
  const nextOrder = nextStop ? orders.find((o) => o.id === nextStop.order_id) : null;

  const onlineMinutes = driver.status?.online_seit
    ? Math.floor((Date.now() - new Date(driver.status.online_seit).getTime()) / 60_000)
    : null;
  const remainingStops = totalStops - deliveredStops;
  const estReturnMin = state === 'unterwegs' ? remainingStops * 8 : null;

  const cfg = STATE_CONFIG[state];

  return (
    <div className={cn('rounded-xl border-2 p-3 transition', cfg.bg, state === 'zurueck' && 'animate-pulse ring-2 ring-matcha-500/50')}>
      <div className="flex items-start gap-2">
        <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', cfg.iconBg)}>
          {state === 'zurueck' ? <HomeIcon className="h-4 w-4" /> :
           state === 'unterwegs' ? <Bike className="h-4 w-4" /> :
           state === 'frei' ? <Zap className="h-4 w-4" /> :
                              <Bike className="h-4 w-4 opacity-40" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display text-sm font-bold truncate">
            {driver.vorname} {driver.nachname}
          </div>
          <div className={cn('text-[10px] font-bold uppercase tracking-wider', cfg.textColor)}>
            {cfg.label}
            {onlineMinutes !== null && state !== 'offline' && (
              <span className="ml-1 opacity-60">· {onlineMinutes} Min online</span>
            )}
          </div>
        </div>
      </div>

      {/* Details je State */}
      {state === 'unterwegs' && totalStops > 0 && (
        <div className="mt-2 pt-2 border-t border-current/10">
          <div className="flex items-center justify-between text-xs">
            <span>Stopp {deliveredStops + 1}/{totalStops}</span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono">{Math.round((deliveredStops / totalStops) * 100)}%</span>
              {estReturnMin !== null && estReturnMin > 0 && (() => {
                const returnAt = new Date(Date.now() + estReturnMin * 60_000);
                const returnStr = returnAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                return (
                  <span className={cn(
                    'rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums',
                    estReturnMin <= 10 ? 'bg-matcha-200 text-matcha-800' :
                    estReturnMin <= 20 ? 'bg-orange-200 text-orange-800' :
                    'bg-red-200 text-red-800',
                  )}>
                    ~{returnStr}
                  </span>
                );
              })()}
            </div>
          </div>
          <div className="mt-1.5 h-1 rounded-full bg-black/10 overflow-hidden">
            <div
              className="h-full bg-orange-400 rounded-full transition-all"
              style={{ width: `${(deliveredStops / totalStops) * 100}%` }}
            />
          </div>
          {nextOrder && (
            <div className="mt-1 text-[11px] text-foreground/70 truncate">
              → {nextOrder.kunde_name} {nextOrder.kunde_plz ?? ''}
            </div>
          )}
        </div>
      )}

      {state === 'zurueck' && (
        <div className="mt-2 pt-2 border-t border-current/10 text-xs font-semibold">
          Auf Weg zurück · {deliveredStops} ausgeliefert
        </div>
      )}

      {state === 'frei' && (
        <div className="mt-2 pt-2 border-t border-current/10 text-xs text-muted-foreground">
          Wartet auf Auftrag
        </div>
      )}
    </div>
  );
}

const STATE_CONFIG: Record<DriverState, { label: string; bg: string; iconBg: string; textColor: string }> = {
  offline:   { label: 'Offline',         bg: 'bg-muted border-border',              iconBg: 'bg-muted text-muted-foreground', textColor: 'text-muted-foreground' },
  frei:      { label: 'Frei',            bg: 'bg-matcha-50/60 border-matcha-200',   iconBg: 'bg-matcha-600 text-white',       textColor: 'text-matcha-800' },
  unterwegs: { label: 'Liefert',         bg: 'bg-orange-50 border-orange-200',      iconBg: 'bg-orange-500 text-white',       textColor: 'text-orange-800' },
  zurueck:   { label: 'Kommt zurück',    bg: 'bg-matcha-100 border-matcha-400',     iconBg: 'bg-matcha-900 text-matcha-50',   textColor: 'text-matcha-900' },
};

/* ------------------------------ OrderTicket ------------------------------ */

function fmtCountdown(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function OrderTicket({ order, next, timing, sameZoneCount = 0 }: { order: Order; next: string | null; timing: KitchenTiming | null; sameZoneCount?: number }) {
  const [pending, startTransition] = useTransition();

  const waitMin = order.bestellt_am
    ? Math.floor((Date.now() - new Date(order.bestellt_am).getTime()) / 60_000)
    : 0;
  const waitSec = order.bestellt_am
    ? Math.floor((Date.now() - new Date(order.bestellt_am).getTime()) / 1_000)
    : 0;
  const est = order.geschaetzte_zubereitung_min ?? 15;

  // `neu`: Annahme-Dringlichkeit (>1 Min = orange, >3 Min = rot)
  const acceptUrgent   = order.status === 'neu' && waitMin >= 1;
  const acceptCritical = order.status === 'neu' && waitMin >= 3;
  // Küchen-Dringlichkeit
  const cookUrgent     = order.status === 'in_zubereitung' && waitMin >= est;
  const cookCritical   = order.status !== 'neu' && waitMin >= est + 10;

  const urgent   = acceptUrgent   || cookUrgent;
  const critical = acceptCritical || cookCritical;

  // Smart-Timing-Progress: wenn `kitchen_timings.cook_start_at` + `ready_target` vorhanden →
  // echten Kochfortschritt (0 % → 100 %) anzeigen statt schätzungsbasierter Wartezeit.
  const cookTimingPct = (() => {
    if (!timing || timing.status !== 'cooking' || !timing.cook_start_at || !timing.ready_target) return null;
    const start = new Date(timing.cook_start_at).getTime();
    const end   = new Date(timing.ready_target).getTime();
    if (end <= start) return null;
    return Math.min(100, Math.max(0, Math.round((Date.now() - start) / (end - start) * 100)));
  })();

  const progressPct = cookTimingPct ?? Math.min(100, Math.round((waitMin / est) * 100));
  // Verbleibende Sekunden: aus `ready_target` wenn vorhanden, sonst geschätzt
  const remainingSec = (timing?.status === 'cooking' && timing.ready_target)
    ? Math.floor((new Date(timing.ready_target).getTime() - Date.now()) / 1000)
    : (est * 60) - waitSec;

  // Smart-Timing-Chip: zeigt Kochstart oder Fertig-Ziel
  const timingChip = (() => {
    if (!timing) return null;
    const now = Date.now();
    if (timing.status === 'scheduled' && timing.cook_start_at) {
      const secs = Math.floor((new Date(timing.cook_start_at).getTime() - now) / 1000);
      if (secs > 0) return { label: `Kochstart in ${fmtCountdown(secs)}`, color: 'bg-blue-100 text-blue-800', pulse: secs < 120 };
      return { label: 'Kochstart jetzt!', color: 'bg-orange-500 text-white', pulse: true };
    }
    if (timing.status === 'cooking' && timing.ready_target) {
      const secs = Math.floor((new Date(timing.ready_target).getTime() - now) / 1000);
      if (secs > 0) return { label: `Fertig in ${fmtCountdown(secs)}`, color: 'bg-matcha-100 text-matcha-800', pulse: secs < 120 };
      return { label: 'Sollte fertig sein!', color: 'bg-red-500 text-white', pulse: true };
    }
    return null;
  })();

  const isTable = Boolean(order.tisch_id);
  const typLabel = isTable ? `🍽 Tisch ${order.tisch_nummer ?? ''}` : order.typ === 'lieferung' ? '🛵 Liefern' : order.typ === 'abholung' ? '🥡 Abholung' : '🍽 Vor Ort';

  return (
    <Card className={cn('bg-card p-4 transition', urgent && 'ring-2 ring-orange-400', critical && 'ring-2 ring-red-500 animate-pulse')}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold tracking-wider text-matcha-700">
              #{order.bestellnummer.replace('FF-', '')}
            </span>
            {order.external_source && (
              <span className="rounded-full bg-gold px-1.5 py-0.5 text-[9px] font-bold uppercase text-matcha-900">
                {order.external_source}
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">{typLabel}</div>
        </div>
        {/* Cooking ring for in-progress orders, flat badge for everything else */}
        {(order.status === 'in_zubereitung' || order.status === 'bestätigt') ? (
          <div className="relative flex shrink-0 items-center justify-center h-12 w-12">
            <svg className="absolute inset-0 -rotate-90" width="48" height="48" viewBox="0 0 48 48">
              <circle cx="24" cy="24" r="19" fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="3.5" />
              <circle
                cx="24" cy="24" r="19"
                fill="none"
                stroke={
                  progressPct >= 100 ? '#ef4444' :
                  progressPct >= 85  ? '#f97316' :
                  progressPct >= 60  ? '#eab308' :
                  cookTimingPct !== null ? '#3b82f6' :
                  '#22c55e'
                }
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 19}`}
                strokeDashoffset={`${2 * Math.PI * 19 * (1 - Math.min(1, progressPct / 100))}`}
                style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }}
              />
            </svg>
            <span className={cn(
              'relative text-[9px] font-black tabular-nums leading-none text-center',
              progressPct >= 100 ? 'text-red-600' :
              progressPct >= 85  ? 'text-orange-600' :
              progressPct >= 60  ? 'text-yellow-600' :
              cookTimingPct !== null ? 'text-blue-600' :
              'text-matcha-700',
            )}>
              {cookTimingPct !== null && remainingSec > 0
                ? fmtCountdown(remainingSec)
                : waitMin < 60 ? `${waitMin}:${String(waitSec % 60).padStart(2, '0')}` : `${waitMin}′`}
            </span>
          </div>
        ) : (
          <div className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums',
            critical ? 'bg-red-500 text-white animate-pulse' :
            urgent   ? 'bg-orange-500 text-white' :
                       'bg-muted text-muted-foreground',
          )}>
            <Clock className="h-2.5 w-2.5" />
            {waitMin < 60 ? `${waitMin}:${String(waitSec % 60).padStart(2, '0')}` : `${waitMin}′`}
          </div>
        )}
      </div>

      {/* Smart-Timing Chip */}
      {timingChip && (
        <div className={cn(
          'mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold',
          timingChip.color,
          timingChip.pulse && 'animate-pulse',
        )}>
          <Zap className="h-2.5 w-2.5" />
          {timingChip.label}
        </div>
      )}

      {/* Bündelungs-Chip: mehrere fertige Lieferbestellungen in derselben Zone */}
      {order.status === 'fertig' && order.typ === 'lieferung' && sameZoneCount >= 2 && order.delivery_zone && (
        <a
          href="/dispatch"
          className={cn(
            'mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold',
            'bg-matcha-100 text-matcha-800 hover:bg-matcha-200 transition',
          )}
          title="Im Dispatch bündeln"
        >
          <Bike className="h-2.5 w-2.5" />
          {sameZoneCount}× Zone {order.delivery_zone} → bündeln!
        </a>
      )}

      {/* Annahme-Urgency für 'neu'-Bestellungen */}
      {order.status === 'neu' && acceptUrgent && (
        <div className={cn(
          'mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold',
          acceptCritical
            ? 'bg-red-500 text-white animate-pulse'
            : 'bg-orange-100 text-orange-800',
        )}>
          <AlertCircle className="h-2.5 w-2.5" />
          {acceptCritical ? 'Noch nicht angenommen!' : 'Warte auf Annahme…'}
        </div>
      )}

      {/* Progress bar + countdown — only for active cooking orders */}
      {(order.status === 'in_zubereitung' || order.status === 'bestätigt') && (
        <div className="mt-2">
          <div className="h-1 rounded-full bg-black/10 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-1000',
                progressPct < 70 ? 'bg-matcha-500' :
                progressPct < 100 ? 'bg-orange-400' :
                'bg-red-500 animate-pulse',
              )}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="mt-0.5 flex items-center justify-between gap-1">
            <span className={cn(
              'text-[10px] font-bold tabular-nums',
              remainingSec > 0 ? (cookTimingPct !== null ? 'text-blue-700' : 'text-muted-foreground') : 'text-red-600',
            )}>
              {remainingSec > 0
                ? `Noch ${fmtCountdown(remainingSec)}`
                : `+${fmtCountdown(-remainingSec)} überzogen`}
            </span>
            <span className={cn(
              'text-[9px] tabular-nums font-semibold',
              remainingSec > 0 ? 'text-muted-foreground/70' : 'text-red-500',
            )}>
              {(() => {
                const readyAt = timing?.ready_target
                  ? new Date(timing.ready_target)
                  : order.bestellt_am
                    ? new Date(new Date(order.bestellt_am).getTime() + est * 60_000)
                    : null;
                return readyAt ? `~${readyAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` : '';
              })()}
            </span>
          </div>
        </div>
      )}

      <div className="mt-3">
        <div className="text-sm font-semibold">{order.kunde_name}</div>
        {order.typ === 'lieferung' && order.kunde_adresse && (
          <div className="text-xs text-muted-foreground">
            {order.kunde_adresse}{order.kunde_plz ? `, ${order.kunde_plz}` : ''}
          </div>
        )}
        {order.status === 'fertig' && (() => {
          const fertigMs = order.fertig_am
            ? new Date(order.fertig_am).getTime()
            : order.bestellt_am
              ? new Date(order.bestellt_am).getTime() + (order.geschaetzte_zubereitung_min ?? 15) * 60_000
              : null;
          const fertigWaitMin = fertigMs ? Math.floor((Date.now() - fertigMs) / 60_000) : 0;
          return (
            <div className={cn(
              'mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
              fertigWaitMin < 5 ? 'bg-matcha-100 text-matcha-800' :
              fertigWaitMin < 10 ? 'bg-orange-100 text-orange-800' :
              'bg-red-100 text-red-800 animate-pulse',
            )}>
              <Clock className="h-2.5 w-2.5" />
              Warte seit {fertigWaitMin} Min
            </div>
          );
        })()}
      </div>

      <ul className="mt-3 space-y-1.5 border-t pt-3">
        {order.items?.map((it) => (
          <li key={it.id} className="flex items-start gap-2 text-sm">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-matcha-100 text-[10px] font-bold text-matcha-800">
              {it.menge}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 leading-tight">
                <span className="font-medium">{it.name}</span>
                {it.gang != null && it.gang > 0 && (
                  <span className="shrink-0 rounded px-1 py-0.5 text-[9px] font-bold bg-blue-50 border border-blue-200 text-blue-700">
                    {it.gang === 1 ? 'VS' : it.gang === 2 ? 'HG' : it.gang === 3 ? 'NA' : `G${it.gang}`}
                  </span>
                )}
              </div>
              {it.notiz && <div className="mt-0.5 text-[11px] italic text-orange-700">„{it.notiz}"</div>}
              {Array.isArray(it.extras) && (it.extras as unknown[]).length > 0 && (
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {(it.extras as unknown[]).slice(0, 5).map((e, ei) => {
                    const label = typeof e === 'string' ? e : typeof (e as any)?.name === 'string' ? (e as any).name : null;
                    if (!label) return null;
                    return (
                      <span key={ei} className="rounded px-1 py-0.5 bg-orange-50 border border-orange-200 text-[9px] font-medium text-orange-800">
                        +{label}
                      </span>
                    );
                  })}
                  {(it.extras as unknown[]).length > 5 && (
                    <span className="text-[9px] text-muted-foreground">+{(it.extras as unknown[]).length - 5}</span>
                  )}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      {(order.kunde_notiz || order.kunde_lieferhinweis) && (
        <div className="mt-3 rounded-md border border-gold/30 bg-gold/10 p-2 text-[11px] text-matcha-900">
          <span className="font-semibold">Hinweis: </span>
          {order.kunde_notiz ?? order.kunde_lieferhinweis}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between border-t pt-3">
        <div className="flex items-center gap-2 text-xs">
          <span className={cn('rounded-full px-2 py-0.5 font-bold uppercase text-[10px]', order.bezahlt ? 'bg-matcha-700 text-white' : 'bg-gold text-matcha-900')}>
            {order.bezahlt ? 'Bezahlt' : payLabel(order.zahlungsart)}
          </span>
          <span className="font-display text-sm font-bold">{euro(order.gesamtbetrag)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => startTransition(() => void cancelOrder(order.id))}
            disabled={pending}
            className="flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground hover:bg-destructive hover:text-white"
            title="Stornieren"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          {next && (
            <button
              onClick={() => startTransition(() => void advanceOrder(order.id, next))}
              disabled={pending}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-matcha-700 px-4 text-sm font-bold text-white hover:bg-matcha-800 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {nextLabel(next)}
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------ CookingAlertBar ------------------------------ */

function CookingAlertBar({ timings, orders }: { timings: KitchenTiming[]; orders: Order[] }) {
  const now = Date.now();

  const alerts = timings
    .filter((t) => t.status === 'scheduled' && t.cook_start_at)
    .map((t) => {
      const secs = Math.floor((new Date(t.cook_start_at!).getTime() - now) / 1000);
      const order = orders.find((o) => o.id === t.order_id);
      if (!order) return null;
      return { t, order, secs };
    })
    .filter((x): x is { t: KitchenTiming; order: Order; secs: number } => x !== null)
    .filter((x) => x.secs < 300) // nur innerhalb 5 Min anzeigen
    .sort((a, b) => a.secs - b.secs);

  if (alerts.length === 0) return null;

  return (
    <div className={cn(
      'rounded-xl border-2 p-3',
      alerts.some((a) => a.secs < 0) ? 'border-red-500 bg-red-50' : 'border-orange-400 bg-orange-50',
    )}>
      <div className="mb-2 flex items-center gap-2">
        <Flame className={cn('h-4 w-4', alerts.some((a) => a.secs < 0) ? 'text-red-600' : 'text-orange-600')} />
        <span className={cn(
          'font-display text-xs font-bold uppercase tracking-wider',
          alerts.some((a) => a.secs < 0) ? 'text-red-800' : 'text-orange-800',
        )}>
          Jetzt kochen! — {alerts.length} Bestellung{alerts.length !== 1 ? 'en' : ''}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {alerts.map(({ t, order, secs }) => {
          const overdue = secs < 0;
          const imminent = !overdue && secs < 60;
          return (
            <div
              key={t.id}
              className={cn(
                'rounded-lg border-2 px-3 py-2 min-w-[140px]',
                overdue  ? 'border-red-500 bg-red-100 animate-pulse' :
                imminent ? 'border-orange-500 bg-orange-100 animate-pulse' :
                           'border-orange-300 bg-white',
              )}
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-foreground">
                  #{order.bestellnummer.replace('FF-', '')}
                </span>
                <span className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums',
                  overdue  ? 'bg-red-600 text-white' :
                  imminent ? 'bg-orange-500 text-white' :
                             'bg-orange-200 text-orange-900',
                )}>
                  {overdue ? `+${fmtCountdown(-secs)} überfällig!` : `in ${fmtCountdown(secs)}`}
                </span>
              </div>
              <div className="mt-0.5 text-[10px] text-foreground/70 truncate">{order.kunde_name}</div>
              {t.ready_target && (
                <div className={cn(
                  'mt-0.5 text-[10px] font-semibold',
                  overdue ? 'text-red-700' : 'text-orange-700',
                )}>
                  Abholung {new Date(t.ready_target).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
              {/* Cook-to-ready mini bar: 0% = 5min vor Kochstart, 100% = Kochstart erreicht/überzogen */}
              {t.cook_start_at && t.ready_target && (() => {
                const pct = overdue ? 100 : Math.min(100, Math.round(((300 - secs) / 300) * 100));
                return (
                  <div className="mt-1.5 h-1 rounded-full bg-black/10 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        overdue ? 'bg-red-500 animate-pulse' : 'bg-orange-400',
                      )}
                      style={{ width: `${pct}%`, transition: 'width 1s linear' }}
                    />
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ StaleOrdersWidget ------------------------------ */

function StaleOrdersWidget({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<{
    count: number;
    needs_attention: boolean;
    orders: { id: string; bestellnummer: string; age_min: number; escalation_status: string; delivery_zone: string | null }[];
  } | null>(null);
  const [forceDispatching, setForceDispatching] = useState<string | null>(null);

  useEffect(() => {
    if (!locationId) return;
    const load = () => {
      fetch(`/api/delivery/admin/stale-orders?location_id=${locationId}`)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => d && setData(d))
        .catch(() => {});
    };
    load();
    const iv = setInterval(load, 90_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (!data || data.count === 0) return null;

  async function forceDispatch(orderId: string) {
    setForceDispatching(orderId);
    try {
      await fetch('/api/delivery/admin/stale-orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ order_id: orderId }),
      });
    } finally {
      setForceDispatching(null);
    }
  }

  return (
    <div className={cn(
      'rounded-xl border-2 p-3',
      data.needs_attention ? 'border-red-400 bg-red-50' : 'border-amber-300 bg-amber-50',
    )}>
      <div className="mb-2 flex items-center gap-2">
        <AlertCircle className={cn('h-4 w-4', data.needs_attention ? 'text-red-600 animate-pulse' : 'text-amber-600')} />
        <span className={cn(
          'font-display text-xs font-bold uppercase tracking-wider',
          data.needs_attention ? 'text-red-800' : 'text-amber-800',
        )}>
          {data.count} Lieferung{data.count !== 1 ? 'en' : ''} &gt;10 Min ohne Fahrer
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {data.orders.slice(0, 5).map((o) => {
          const isEscalated = o.escalation_status === 'needs_escalation' || o.escalation_status === 'escalated';
          const isLoading = forceDispatching === o.id;
          return (
            <div key={o.id} className={cn(
              'flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] bg-white',
              isEscalated ? 'border-red-300' : 'border-amber-200',
            )}>
              <span className="font-mono font-bold text-foreground">#{o.bestellnummer.replace('FF-', '')}</span>
              {o.delivery_zone && (
                <span className="rounded px-1.5 py-0.5 bg-amber-100 text-amber-800 font-bold text-[10px] uppercase">
                  Zone {o.delivery_zone}
                </span>
              )}
              <span className={cn('font-bold tabular-nums', isEscalated ? 'text-red-700' : 'text-amber-700')}>
                {o.age_min} Min
              </span>
              <button
                onClick={() => forceDispatch(o.id)}
                disabled={isLoading}
                className="rounded-md bg-matcha-700 text-white px-2 py-0.5 text-[10px] font-bold hover:bg-matcha-800 disabled:opacity-60 inline-flex items-center gap-1 transition"
              >
                {isLoading
                  ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  : <Zap className="h-2.5 w-2.5" />}
                {isLoading ? 'Läuft…' : 'Sofort dispatchen'}
              </button>
            </div>
          );
        })}
        {data.count > 5 && (
          <div className="flex items-center text-[11px] text-amber-700 font-semibold px-2">
            +{data.count - 5} weitere
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ PrepItemsPanel ------------------------------ */

function PrepItemsPanel({ orders }: { orders: Order[] }) {
  const cooking = orders.filter((o) => ['bestätigt', 'in_zubereitung'].includes(o.status));
  if (cooking.length === 0) return null;

  type ItemEntry = {
    name: string;
    totalMenge: number;
    orders: { bestellnummer: string; waitMin: number; urgent: boolean }[];
    maxWaitMin: number;
  };

  const now = Date.now();
  const byItem = new Map<string, ItemEntry>();

  for (const o of cooking) {
    const waitMin = o.bestellt_am
      ? Math.floor((now - new Date(o.bestellt_am).getTime()) / 60_000)
      : 0;
    const est = o.geschaetzte_zubereitung_min ?? 15;
    const urgent = waitMin >= est;

    for (const it of o.items ?? []) {
      const key = it.name;
      if (!byItem.has(key)) {
        byItem.set(key, { name: it.name, totalMenge: 0, orders: [], maxWaitMin: 0 });
      }
      const entry = byItem.get(key)!;
      entry.totalMenge += it.menge;
      entry.maxWaitMin = Math.max(entry.maxWaitMin, waitMin);
      entry.orders.push({
        bestellnummer: o.bestellnummer,
        waitMin,
        urgent,
      });
    }
  }

  const items = Array.from(byItem.values()).sort((a, b) => b.maxWaitMin - a.maxWaitMin);
  if (items.length === 0) return null;

  // Nur anzeigen wenn ≥3 verschiedene Items oder >1 Bestellung
  if (items.length < 3 && cooking.length < 2) return null;

  const urgentItems = items.filter((i) => i.orders.some((o) => o.urgent));

  return (
    <div className={cn(
      'rounded-xl border p-3',
      urgentItems.length > 0 ? 'border-red-200 bg-red-50' : 'border-border bg-card',
    )}>
      <div className="mb-2 flex items-center gap-2">
        <ChefHat className={cn('h-4 w-4', urgentItems.length > 0 ? 'text-red-600' : 'text-matcha-600')} />
        <span className={cn(
          'font-display text-xs font-bold uppercase tracking-wider',
          urgentItems.length > 0 ? 'text-red-800' : 'text-foreground',
        )}>
          Küchen-Checkliste · {cooking.length} Bestellungen · {items.reduce((s, i) => s + i.totalMenge, 0)} Positionen
        </span>
      </div>
      <div className="grid gap-1">
        {items.slice(0, 12).map((item) => {
          const isUrgent = item.orders.some((o) => o.urgent);
          const urgentCount = item.orders.filter((o) => o.urgent).length;
          const maxWait = item.maxWaitMin;
          const bg = isUrgent
            ? 'bg-red-100 border-red-300'
            : maxWait >= 10 ? 'bg-orange-50 border-orange-200'
            : 'bg-white border-border';
          return (
            <div key={item.name} className={cn('flex items-center gap-3 rounded-lg border px-3 py-2', bg)}>
              <span className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-display font-black text-sm',
                isUrgent ? 'bg-red-600 text-white' :
                maxWait >= 10 ? 'bg-orange-500 text-white' :
                'bg-matcha-700 text-white',
              )}>
                {item.totalMenge}
              </span>
              <div className="flex-1 min-w-0">
                <div className={cn('font-medium text-sm truncate', isUrgent && 'font-bold text-red-900')}>
                  {item.name}
                </div>
                <div className="flex items-center gap-1 flex-wrap mt-0.5">
                  {item.orders.slice(0, 4).map((o, i) => (
                    <span
                      key={i}
                      className={cn(
                        'rounded px-1.5 py-0.5 text-[9px] font-bold tabular-nums',
                        o.urgent ? 'bg-red-200 text-red-800' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      #{o.bestellnummer.replace('FF-', '')}
                      {o.urgent && ` +${o.waitMin - (orders.find((x) => x.bestellnummer === o.bestellnummer)?.geschaetzte_zubereitung_min ?? 15)}m`}
                    </span>
                  ))}
                  {item.orders.length > 4 && (
                    <span className="text-[9px] text-muted-foreground">+{item.orders.length - 4}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {urgentCount > 0 && (
                  <span className="rounded-full bg-red-500 text-white px-1.5 py-0.5 text-[9px] font-black">
                    {urgentCount} überfällig
                  </span>
                )}
                <span className={cn(
                  'text-[10px] font-bold tabular-nums',
                  isUrgent ? 'text-red-700' : 'text-muted-foreground',
                )}>
                  max {maxWait}m
                </span>
              </div>
            </div>
          );
        })}
        {items.length > 12 && (
          <div className="text-xs text-muted-foreground text-center py-1">
            + {items.length - 12} weitere Positionen
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ Helpers ------------------------------ */

function computeDriverStates(drivers: Driver[], batches: Batch[], stops: Stop[]): Map<string, DriverState> {
  const map = new Map<string, DriverState>();
  for (const d of drivers) {
    if (!d.status?.ist_online) { map.set(d.id, 'offline'); continue; }
    const batchId = d.status?.aktueller_batch_id
      ?? batches.find((b) => b.driver_id === d.id)?.id;
    if (!batchId) { map.set(d.id, 'frei'); continue; }
    const batch = batches.find((b) => b.id === batchId);
    if (!batch) { map.set(d.id, 'frei'); continue; }
    const myStops = stops.filter((s) => s.batch_id === batch.id);
    if (myStops.length === 0) { map.set(d.id, 'frei'); continue; }
    const allDelivered = myStops.every((s) => s.geliefert_am);
    map.set(d.id, allDelivered ? 'zurueck' : 'unterwegs');
  }
  return map;
}

function isCriticallyLate(o: Order): boolean {
  if (o.status === 'fertig' || o.status === 'unterwegs' || !o.bestellt_am) return false;
  const waitMin = Math.floor((Date.now() - new Date(o.bestellt_am).getTime()) / 60_000);
  const est = o.geschaetzte_zubereitung_min ?? 15;
  return waitMin >= est + 10;
}

function nextLabel(status: string): string {
  switch (status) {
    case 'bestätigt':      return 'Annehmen';
    case 'in_zubereitung': return 'Zubereiten';
    case 'fertig':         return 'Fertig';
    default:               return status;
  }
}
function payLabel(z: string): string {
  switch (z) {
    case 'bar':    return 'Bar';
    case 'karte':  return 'Karte';
    case 'online': return 'Online';
    default:       return z;
  }
}
