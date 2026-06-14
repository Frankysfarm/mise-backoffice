'use client';

import React, { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn, euro } from '@/lib/utils';
import {
  AlertCircle, Bell, BellOff, Bike, Check, CheckCircle2, ChefHat, ChevronDown, ChevronUp, Clock, Euro, Flame, Home as HomeIcon,
  Inbox, Loader2, MapPin, MessageSquare, Monitor, Package, Pause, Phone, Play, ShoppingBag, Target, TrendingUp, Utensils, X, Zap,
} from 'lucide-react';
import { BarChart, Bar, Cell, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { advanceOrder, cancelOrder, updatePrepTime, startCookingNow, markTimingReady, createKitchenTiming } from './actions';
import { KitchenSmartCountdownGrid } from './countdown-grid';
import { KitchenTimingQualityStrip } from './timing-quality-strip';
import { KitchenSmartBatchAlert } from './smart-batch-alert';
import { KitchenWaveDetector } from './wave-detector';
import { KitchenCookStartTimer } from './cook-start-timer';
import { KitchenStationColorGrid } from './station-color-grid';
import { KitchenBatchPrepGrouping } from './batch-prep-grouping';
import { KitchenItemComplexityStrip } from './item-complexity-strip';
import { KitchenShiftPerformanceBadge } from './schicht-performance-badge';
import { KitchenPrepProgressCards } from './prep-progress-cards';
import { KochstartAlertBand } from './kochstart-alert';
import { ItemPriorityBoard } from './item-priority-board';
import { SchichtVelocity } from './schicht-velocity';
import { PrepAnalyticsCard } from './prep-analytics-card';
import { OrderUrgencyPanel } from './order-urgency-panel';
import { KitchenHandoffTimingGauge } from './handoff-timing-gauge';
import { KitchenReadyWaitAlert } from './ready-wait-alert';
import { KitchenVorhersagePanel } from './vorhersage-panel';
import { KitchenPrepSyncPanel } from './prep-sync-panel';
import { KitchenBatchSyncStrip } from './batch-sync-strip';
import { KitchenDriverPickupWarning } from './driver-pickup-warning';

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
  telefon?: string | null;
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
  total_eta_min: number | null;
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

type SoundType = 'new_order' | 'driver_back' | 'order_picked' | 'urgent' | 'conflict_alert';

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
      case 'conflict_alert':
        // Absteigender 3-Ton — "Handoff-Konflikt: Fahrer zu früh"
        o.type = 'triangle';
        o.frequency.setValueAtTime(784, now);
        o.frequency.setValueAtTime(622, now + 0.13);
        o.frequency.setValueAtTime(494, now + 0.26);
        g.gain.setValueAtTime(0.22, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        o.connect(g); g.connect(ctx.destination);
        o.start(now); o.stop(now + 0.6);
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
  const [cookFlash, setCookFlash] = useState<{ orderId: string; orderNum: string; name: string } | null>(null);
  const [rushSnoozedUntil, setRushSnoozedUntil] = useState(0);
  const [bigDisplay, setBigDisplay] = useState(false);
  const [showColorLegend, setShowColorLegend] = useState(false);
  const [stationFocus, setStationFocus] = useState<PrepStation | 'all'>('all');
  const prevTimingStatuses = useRef<Map<string, string>>(new Map());
  const [activityFeed, setActivityFeed] = useState<{ id: string; bestellnummer: string; status: string; name: string; ts: number }[]>([]);
  const prevOrderStatuses = useRef<Map<string, string>>(new Map());
  const prevHandoffConflictCount = useRef(0);

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
      .select('id, vorname, nachname, rolle, telefon, status:driver_status(ist_online, fahrzeug, aktueller_batch_id, last_lat, last_lng, last_update, online_seit)')
      .eq('rolle', 'fahrer').eq('aktiv', true);
    setDrivers((data as any[]) ?? []);
  }
  async function refreshBatches() {
    const [{ data: legacy }, { data: smart }] = await Promise.all([
      supabase.from('delivery_batches')
        .select('id, driver_id, status, started_at, total_eta_min')
        .in('status', ['pickup', 'aktiv', 'unterwegs', 'zugewiesen']),
      supabase.from('mise_delivery_batches')
        .select('id, driver_id, state, started_at, total_eta_min')
        .in('state', ['pending_acceptance', 'assigned', 'at_restaurant', 'on_route']),
    ]);
    const normalizedSmart = ((smart ?? []) as any[]).map((b: any) => ({
      id: b.id, driver_id: b.driver_id, status: b.state, started_at: b.started_at,
      total_eta_min: b.total_eta_min ?? null,
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

  // CookNowFlash: Überwache scheduled→cooking Übergänge
  useEffect(() => {
    for (const t of timings) {
      const prev = prevTimingStatuses.current.get(t.id);
      if (prev === 'scheduled' && t.status === 'cooking') {
        const order = orders.find((o) => o.id === t.order_id);
        if (order) {
          setCookFlash({ orderId: order.id, orderNum: order.bestellnummer, name: order.kunde_name });
          if (audio) playSound('new_order');
          setTimeout(() => setCookFlash(null), 9000);
        }
      }
      prevTimingStatuses.current.set(t.id, t.status);
    }
  }, [timings, orders, audio]);

  // Handoff-Konflikt Audio-Alert: Fahrer früher als Essen fertig
  useEffect(() => {
    if (!audio) return;
    const now = Date.now();
    const activeBatches = batches.filter(
      (b) => b.status === 'unterwegs' || b.status === 'on_route' || b.status === 'assigned' || b.status === 'pickup',
    );
    let conflictCount = 0;
    for (const b of activeBatches) {
      const etaMs = b.started_at && b.total_eta_min != null
        ? new Date(b.started_at).getTime() + b.total_eta_min * 60_000
        : null;
      if (!etaMs) continue;
      const secLeft = Math.floor((etaMs - now) / 1000);
      if (secLeft > 30 * 60 || secLeft < -5 * 60) continue;
      for (const s of stops.filter((st) => st.batch_id === b.id && !st.geliefert_am)) {
        const timing = timings.find((t) => t.order_id === s.order_id);
        if (!timing?.ready_target) continue;
        const readyMs = new Date(timing.ready_target).getTime();
        if (etaMs - readyMs < 0) conflictCount++;
      }
    }
    if (conflictCount > prevHandoffConflictCount.current) {
      playSound('conflict_alert');
    }
    prevHandoffConflictCount.current = conflictCount;
  }, [batches, stops, timings, audio]);

  // Activity-Feed: Überwache Statusübergänge aller Bestellungen
  useEffect(() => {
    const newEntries: typeof activityFeed = [];
    for (const o of orders) {
      const prev = prevOrderStatuses.current.get(o.id);
      if (prev !== undefined && prev !== o.status) {
        newEntries.push({ id: o.id, bestellnummer: o.bestellnummer, status: o.status, name: o.kunde_name, ts: Date.now() });
      }
      prevOrderStatuses.current.set(o.id, o.status);
    }
    if (newEntries.length > 0) {
      setActivityFeed((prev) => [...newEntries, ...prev].slice(0, 12));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  return (
    <div className="space-y-4">
      {/* Browser-Benachrichtigungen: neue Bestellungen + kritisch überfällige */}
      <KitchenWebNotifier orders={filtered} audio={audio} />
      <KitchenUrgencyTicker orders={filtered} />
      {/* Schicht-Tempo-Anzeige: Orders/h, Ø Zubereitungszeit, Pünktlichkeit */}
      <KitchenShiftPerformanceBadge locationId={locationFilter === 'all' ? (locations[0]?.id ?? null) : locationFilter} />
      {/* Schicht-Velocity: Orders/h jetzt vs. letzte Stunde vs. gestern */}
      <SchichtVelocity locationId={locationFilter === 'all' ? (locations[0]?.id ?? null) : locationFilter} />
      {/* Bestellungswellen-Detektor: Alarm wenn ≥3 Bestellungen in 5 Min eintreffen */}
      <KitchenWaveDetector orders={filtered} />
      {/* Fahrer-Abholungs-Warnung: kritischer Alert wenn Fahrer unterwegs ist aber Bestellungen noch nicht fertig */}
      <KitchenDriverPickupWarning batches={batches} drivers={drivers} stops={stops} orders={filtered} />
      {/* Kochstart-Alert-Band: SOFORT-Warnung wenn Bestellungen jetzt kochen müssen (basierend auf kitchen_timings) */}
      {timings.length > 0 && <KochstartAlertBand orders={filtered} timings={timings} />}
      {/* Timing-Qualitäts-Strip: Echtzeit-Übersicht wie viele kochende Bestellungen im Plan/knapp/überfällig sind */}
      {timings.length > 0 && <KitchenTimingQualityStrip timings={timings} orders={filtered} />}
      {/* Vollbild-Flash: scheduled→cooking Übergang */}
      {cookFlash && <CookNowFlash flash={cookFlash} onDismiss={() => setCookFlash(null)} />}

      {/* Kochstart-Empfehlung: wann muss die Küche mit kochen beginnen damit Fahrer nicht wartet */}
      <KitchenCookStartTimer
        orders={(() => {
          const now = Date.now();
          return batches
            .filter((b) => b.status === 'unterwegs' || b.status === 'on_route' || b.status === 'assigned')
            .flatMap((b) => {
              const etaMs = b.started_at && b.total_eta_min != null
                ? new Date(b.started_at).getTime() + b.total_eta_min * 60_000
                : null;
              if (!etaMs) return [];
              const etaSec = Math.max(0, Math.floor((etaMs - now) / 1000));
              return stops
                .filter((s) => s.batch_id === b.id && !s.geliefert_am)
                .map((s) => {
                  const order = orders.find((o) => o.id === s.order_id);
                  if (!order || order.status !== 'bestätigt') return null;
                  return {
                    id: order.id,
                    bestellnummer: order.bestellnummer,
                    kunde_name: order.kunde_name,
                    prep_min: order.geschaetzte_zubereitung_min ?? 15,
                    driver_eta_sec: etaSec,
                  };
                })
                .filter(Boolean) as any[];
            });
        })()}
      />

      {/* Artikel-Prioritäts-Board: Welche Items jetzt zubereiten? Gruppiert + nach Deadline sortiert */}
      {filtered.filter(o => ['bestätigt', 'in_zubereitung'].includes(o.status)).length > 0 && !bigDisplay && (
        <ItemPriorityBoard orders={filtered} timings={timings} />
      )}

      {/* Dringlichkeits-Übersicht: Alle aktiven Bestellungen nach Fertigstellungs-Deadline farbkodiert */}
      {!bigDisplay && filtered.filter(o => ['bestätigt', 'in_zubereitung', 'fertig'].includes(o.status)).length > 0 && (
        <OrderUrgencyPanel orders={filtered} timings={timings} />
      )}

      {/* Wärme-Risiko-Band: fertige Bestellungen die auf Abholung warten */}
      {!bigDisplay && <KitchenReadyWaitAlert />}

      {/* Fahrer ↔ Küche Sync: zeigt ob Küche fertig wird wenn Fahrer kommt */}
      {!bigDisplay && <KitchenHandoffTimingGauge />}

      {/* Stations-Farb-Raster: kompakte Farbkodierung aller kochenden Bestellungen */}
      <KitchenStationColorGrid orders={filtered} timings={timings} />

      {/* Kochfortschritt-Ringe: visueller Fortschritt je kochender Bestellung */}
      <KitchenPrepProgressCards orders={filtered} timings={timings} />

      {/* Smart-Countdown: Kochende Bestellungen mit Farbcodierung nach Dringlichkeit */}
      <KitchenSmartCountdownGrid
        orders={filtered}
        timings={timings}
        bigDisplay={bigDisplay}
        driverETAs={(() => {
          const now = Date.now();
          return batches
            .filter((b) => b.status === 'unterwegs' || b.status === 'on_route')
            .flatMap((b) => {
              const etaMs = b.started_at && b.total_eta_min != null
                ? new Date(b.started_at).getTime() + b.total_eta_min * 60_000
                : null;
              if (!etaMs) return [];
              const etaSec = Math.max(0, Math.floor((etaMs - now) / 1000));
              if (etaSec > 20 * 60) return [];
              const driver = drivers.find((d) => d.id === b.driver_id);
              const driverName = driver ? `${driver.vorname} ${driver.nachname[0]}.` : 'Fahrer';
              return stops
                .filter((s) => s.batch_id === b.id && !s.geliefert_am)
                .map((s) => ({ order_id: s.order_id, driver_name: driverName, eta_sec: etaSec }));
            });
        })()}
      />

      {/* 30-Minuten Fertigstellungs-Zeitleiste: alle aktiven Orders auf einem Zeitstrahl */}
      {filtered.filter((o) => ['bestätigt', 'in_zubereitung'].includes(o.status)).length > 0 && (
        <KitchenPrepTimelineBar orders={filtered} timings={timings} />
      )}

      {/* Fahrer am Restaurant Alert */}
      <KitchenDriverAtRestaurantAlert batches={batches} drivers={drivers} stops={stops} orders={orders} />

      {/* Nächste Fahrerankünfte: wann kommt welcher Fahrer, welche Orders mitnehmen? */}
      <KitchenUpcomingPickupStrip batches={batches} drivers={drivers} stops={stops} orders={filtered} />

      {/* Handoff-Matrix: Ready-Target vs. Fahrerankünfte — zeigt Konflikte (Fahrer früher als Essen fertig) */}
      {timings.length > 0 && (
        <KitchenHandoffMatrix batches={batches} drivers={drivers} stops={stops} orders={filtered} timings={timings} />
      )}

      {/* Artikel-Priorität: welche Items jetzt kochen? Sortiert nach Deadline */}
      {!bigDisplay && filtered.filter((o) => ['bestätigt', 'in_zubereitung'].includes(o.status)).length > 0 && (
        <KitchenItemPrioritySort orders={filtered} timings={timings} />
      )}

      {/* Queue-Signal-Steuerung: Bestellfluss pausieren / ETA verlängern */}
      <QueueSignalControl locationId={locationFilter === 'all' ? (locations[0]?.id ?? null) : locationFilter} />

      {/* Schicht-Schnappschuss */}
      <KitchenShiftStats orders={filtered} completedToday={completedToday} hourlyData={hourlyData} />

      {/* Küchen-Effizienz: Ist- vs Soll-Zubereitungszeit */}
      <KitchenEfficiencyPanel orders={filtered} />

      {/* Smart-Timing Genauigkeit: Wie präzise treffen unsere Schätzungen? */}
      {timings.length > 0 && <KitchenTimingAccuracyBar timings={timings} />}

      {/* Prep-Analytics: Ø Zubereitungszeit, Pünktlichkeitsquote, stündlicher Trend */}
      {!bigDisplay && timings.length >= 2 && (
        <PrepAnalyticsCard timings={timings} orders={filtered} />
      )}

      {/* Phase 89: Smart-Prep-Advisor — historische Ist-Zeiten analysieren + Empfehlung */}
      <KitchenSmartPrepAdvisor orders={filtered} />

      {/* Smart-Timing Nudge: Kochende Bestellungen ohne Timing-Eintrag */}
      <KitchenSmartTimingNudge orders={filtered} timings={timings} />

      {/* Prioritäts-Queue: Welche 3 Bestellungen jetzt zubereiten? */}
      <TopUrgentOrders orders={filtered} />

      {/* Warteschlangen-Druckmeter: Tiefe, Wachstumsrate, Räumungszeit */}
      <KitchenQueuePressureMeter orders={filtered} />

      {/* Cooking Load Summary */}
      <CookingLoadPanel orders={filtered} />

      {/* 2h-Fenster-Vorschau: 8×15-Min-Intervalle mit erwarteten Fertigstellungen */}
      <KitchenFensterForecast orders={filtered} timings={timings} />

      {/* Gang-Übersicht: Items nach Gängen für kochende Bestellungen */}
      <GangTimerPanel orders={filtered} />

      {/* Sonderanfragen & Kundennotizen — alle aktiven Bestellungen mit Notiz */}
      <OrderNotesPanel orders={filtered} />

      {/* Stations-Auslastungsbalken: Portionen je Station im aktuellen Queue */}
      <KitchenStationLoadBar orders={filtered} />

      {/* Küchen-Checkliste: konsolidierte Items aller aktiven Bestellungen */}
      <PrepItemsPanel orders={filtered} />

      {/* Parallelbatch-Empfehlung: gleiche Items über mehrere Bestellungen bündeln */}
      <KitchenItemConsolidationPanel orders={filtered} />

      {/* Bestellkomplexität: Einfach / Mittel / Komplex / ⚡ Alarm — Priorisierungshilfe */}
      <KitchenItemComplexityStrip orders={filtered} />

      {/* Echtzeit-Aktivitätsfeed: letzte Statusübergänge */}
      <KitchenActivityFeed feed={activityFeed} />

      {/* Überfällige Bestellungen — prominenter Alert wenn ≥2 kritisch */}
      <OverdueOrdersAlert orders={filtered} />

      {/* Rush Mode Banner — wenn ≥3 Bestellungen gleichzeitig ≥10 Min überfällig */}
      <RushModeBanner
        orders={filtered}
        snoozedUntil={rushSnoozedUntil}
        onSnooze={() => setRushSnoozedUntil(Date.now() + 3 * 60_000)}
      />

      {/* Pickup-Forecast: kochende Lieferbestellungen die in <15 Min fertig sind */}
      <PickupForecastPanel orders={filtered} />

      {/* Batch-Optimierungs-Hinweis: Zonen mit bündelbaren Bestellungen */}
      <BatchOptimizationHint orders={filtered} />

      {/* Dispatch-Bereit Panel: Fertige Lieferbest. gruppiert nach Zone */}
      <DispatchReadinessPanel orders={filtered} />

      {/* Smart-Batch-Alert: Mehrere fertige Bestellungen in gleicher Zone → Batch-Empfehlung */}
      <KitchenSmartBatchAlert orders={filtered} />

      {/* Phase 113: Batch-Zubereitung-Gruppierung — Orders derselben Tour zusammen sehen */}
      {batches.length > 0 && (
        <KitchenBatchPrepGrouping
          orders={filtered}
          batches={batches}
          stops={stops}
          drivers={drivers}
        />
      )}

      {/* Backlog-Eskalation: Fertige Lieferbestellungen ohne Fahrer */}
      <KitchenDispatchBacklogPanel orders={filtered} />

      {/* Heute vs. Vorwoche: Stunde-für-Stunde-Benchmark */}
      <KitchenSchichtVergleich />

      {/* Phase 94: Echtzeit-Küchen-Zubereitungsgeschwindigkeit */}
      <KitchenPrepSpeedometer orders={filtered} />

      {/* Bestellprognose: Vorhergesagtes Bestellvolumen für die nächsten 2 Stunden */}
      {!bigDisplay && (
        <KitchenVorhersagePanel
          locationId={locationFilter === 'all' ? (locations[0]?.id ?? '') : locationFilter}
          currentCookingCount={filtered.filter(o => o.status === 'in_zubereitung').length}
        />
      )}

      {/* Zubereitungszeit-Lernmodul: p75-Schätzwerte nach Tageszeit (Backend-Lernmodul Phase 131) */}
      <PrepLearningPanel locationId={locationFilter === 'all' ? (locations[0]?.id ?? null) : locationFilter} />

      {/* Fahrer-Küchen-Synchronisation: Timing-Abgleich zwischen aktiven Batches und Kochzeiten */}
      {batches.length > 0 && timings.length > 0 && (
        <KitchenHandoffSyncPanel batches={batches} stops={stops} timings={timings} orders={filtered} />
      )}

      {/* Küchen→Dispatch Sync: welche Bestellungen warten auf Fahrer, wo droht Timing-Konflikt */}
      {!bigDisplay && (orders.filter(o => ['in_zubereitung', 'bestätigt', 'fertig'].includes(o.status) && o.typ === 'lieferung').length > 0) && (
        <KitchenPrepSyncPanel orders={filtered} batches={batches} stops={stops} drivers={drivers} timings={timings} />
      )}

      {/* Phase 162: Touren-Küchen-Sync — zeigt ob alle Bestellungen einer Tour fertig sind bevor Fahrer abfährt */}
      {!bigDisplay && batches.filter(b => b.status !== 'delivered').length > 0 && (
        <KitchenBatchSyncStrip locationId={locationFilter === 'all' ? (locations[0]?.id ?? null) : locationFilter} />
      )}

      {/* Phase 105: Fahrer-Pickup-Prognose — wann kommt welcher Fahrer in den nächsten 30 Min? */}
      {batches.length > 0 && (
        <KitchenDriverPickupForecast batches={batches} drivers={drivers} stops={stops} orders={filtered} />
      )}

      {/* Phase 117: Urgency-Rail — alle aktiven Bestellungen als farbige Dringlichkeits-Chips */}
      {!bigDisplay && filtered.length > 0 && (
        <KitchenOrderUrgencyRail orders={filtered} timings={timings} />
      )}

      {/* Abholung-Warte-Panel: Kunden die auf ihre Abholung warten */}
      <PickupWaitPanel orders={filtered} />

      {/* Durchsatz-Meter: fertige Bestellungen pro Stunde (rollendes 30-Min-Fenster) */}
      <KitchenThroughputMeter orders={filtered} />

      {/* Stale Orders Alert — Lieferungen ohne Fahrer >10 Min */}
      <StaleOrdersWidget
        locationId={locationFilter === 'all' ? (locations[0]?.id ?? null) : locationFilter}
      />

      {/* Smart Timing Banner */}
      {timings.length > 0 && <KitchenTimingBanner timings={timings} orders={filtered} />}

      {/* Fahrer-Statusleiste oben */}
      <DriverPanel drivers={drivers} states={driverStates} batches={batches} stops={stops} orders={orders} />

      {/* Bestellalter-Grid: farbkodierte Chips für alle aktiven Bestellungen */}
      {!bigDisplay && <KitchenOrderAgeGrid orders={filtered} />}

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
          {/* Alle Timer starten — für alle in_zubereitung Bestellungen ohne Timing */}
          {(() => {
            const untracked = filtered.filter(
              (o) => o.status === 'in_zubereitung' && !timings.find((t) => t.order_id === o.id),
            );
            if (untracked.length === 0) return null;
            return (
              <KitchenBulkTimerStart orders={untracked} onDone={refreshTimings} />
            );
          })()}
          {/* Farbsystem-Legende */}
          <button
            onClick={() => setShowColorLegend((v) => !v)}
            className={cn(
              'inline-flex h-9 w-9 items-center justify-center rounded-md border text-sm font-bold transition',
              showColorLegend ? 'bg-matcha-100 border-matcha-400 text-matcha-700' : 'bg-card border-border text-muted-foreground hover:bg-muted',
            )}
            title="Farbsystem-Legende"
          >
            ?
          </button>
          <button
            onClick={() => setBigDisplay((v) => !v)}
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition',
              bigDisplay ? 'bg-matcha-700 text-white border-matcha-700' : 'bg-card text-foreground hover:bg-muted',
            )}
            title={bigDisplay ? 'Normalmodus' : 'Küchendisplay (TV-Modus)'}
          >
            <Monitor className="h-3.5 w-3.5" />
            {bigDisplay ? 'Normal' : 'TV'}
          </button>
          {/* Station-Fokus-Buttons */}
          <div className="flex items-center gap-1 rounded-lg border bg-muted p-1">
            {(['all', 'Grill', 'Warm', 'Kalt', 'Sonstiges'] as const).map((st) => {
              const meta = st !== 'all' ? STATION_META[st] : null;
              const isActive = stationFocus === st;
              // Count items in this station across active orders
              const count = st === 'all' ? 0 : filtered
                .filter(o => ['bestätigt', 'in_zubereitung'].includes(o.status))
                .flatMap(o => o.items ?? [])
                .filter(it => classifyStation(it.name) === st)
                .reduce((s, it) => s + it.menge, 0);
              if (st !== 'all' && count === 0) return null;
              return (
                <button
                  key={st}
                  onClick={() => setStationFocus(st)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold transition',
                    isActive
                      ? st === 'all'
                        ? 'bg-card text-foreground shadow-sm'
                        : cn('shadow-sm text-white', st === 'Grill' ? 'bg-orange-500' : st === 'Warm' ? 'bg-red-500' : st === 'Kalt' ? 'bg-sky-500' : 'bg-matcha-600')
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {st === 'all' ? 'Alle' : meta!.label}
                  {st !== 'all' && count > 0 && <span className="ml-0.5 tabular-nums opacity-80">{count}</span>}
                </button>
              );
            })}
          </div>
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
          {/* Küchen-Auslastungs-Ampel */}
          {(() => {
            const cooking = filtered.filter((o) => o.status === 'in_zubereitung').length;
            const level = cooking >= 7 ? 'red' : cooking >= 4 ? 'orange' : 'green';
            const label = cooking >= 7 ? 'Überlastet' : cooking >= 4 ? 'Ausgelastet' : 'Normal';
            const dotCls = level === 'red' ? 'bg-red-500 animate-pulse' : level === 'orange' ? 'bg-orange-500' : 'bg-matcha-500';
            const textCls = level === 'red' ? 'text-red-600' : level === 'orange' ? 'text-orange-600' : 'text-matcha-600';
            return (
              <span className="flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs">
                <span className={cn('h-2 w-2 rounded-full', dotCls)} />
                <span className={cn('font-bold', textCls)}>{cooking} kochend</span>
                <span className="text-muted-foreground">· {label}</span>
              </span>
            );
          })()}
          {/* Dispatch-Rückstau: fertige Lieferbestellungen warten auf Abholung */}
          {(() => {
            const waiting = filtered.filter(
              (o) => o.status === 'fertig' && o.typ === 'lieferung',
            ).length;
            if (waiting === 0) return null;
            const dotCls =
              waiting >= 4 ? 'bg-red-500 animate-pulse' : waiting >= 2 ? 'bg-orange-500' : 'bg-matcha-500';
            const textCls =
              waiting >= 4 ? 'text-red-600' : waiting >= 2 ? 'text-orange-600' : 'text-matcha-600';
            return (
              <span className="flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs">
                <span className={cn('h-2 w-2 rounded-full', dotCls)} />
                <span className={cn('font-bold', textCls)}>{waiting} warten auf Dispatch</span>
              </span>
            );
          })()}
        </div>
      </div>

      {/* Farbsystem-Legende: erklärt das Bedeutungssystem der Farben im Küchen-Board */}
      {showColorLegend && !bigDisplay && (
        <div className="rounded-xl border border-matcha-200 bg-matcha-50 p-4 text-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="font-display font-bold text-matcha-800 text-xs uppercase tracking-wider">Farbsystem-Legende</span>
            <button onClick={() => setShowColorLegend(false)} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { dot: 'bg-green-500',  ring: 'border-green-500',  label: 'Im Plan',        desc: '< 60% der Zeit verbraucht',    border: 'border-l-matcha-400' },
              { dot: 'bg-yellow-400', ring: 'border-yellow-400', label: 'Aufgepasst',     desc: '60–85% der Zeit verbraucht',  border: 'border-l-yellow-400' },
              { dot: 'bg-orange-500', ring: 'border-orange-500', label: 'Eilt',           desc: '85–100% der Zeit verbraucht', border: 'border-l-orange-400' },
              { dot: 'bg-red-500',    ring: 'border-red-500',    label: 'Überfällig',     desc: 'Zubereitungszeit überschritten', border: 'border-l-red-500' },
            ].map((item) => (
              <div key={item.label} className={cn('rounded-lg bg-white border-l-4 border px-3 py-2', item.border)}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn('h-3 w-3 rounded-full shrink-0', item.dot)} />
                  <span className="font-bold text-[11px]">{item.label}</span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-snug">{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-matcha-200 grid grid-cols-2 md:grid-cols-3 gap-2 text-[10px] text-muted-foreground">
            <span><span className="font-bold text-blue-600">Blauer Ring</span> = Smart-Timing aktiv (präzise Messung)</span>
            <span><span className="font-bold text-red-600">Rote Karte</span> = Kritisch überfällig (&gt;10 Min)</span>
            <span><span className="font-bold text-orange-600">Orangener Rand</span> = Dringlich (≥1 Min warten)</span>
          </div>
        </div>
      )}

      {/* Unkontrollierte Bestellungen: Echtzeitbalken für Bestellungen OHNE Kitchen-Timing — immer sichtbar */}
      {!bigDisplay && <KitchenUntrackedTimerRow orders={filtered} timings={timings} />}

      {/* Proaktiv: "Jetzt kochen!" — wenn Kochstart <5 Min oder überfällig */}
      {timings.length > 0 && <CookingAlertBar timings={timings} orders={filtered} />}

      {/* Geplante Kochstarts: SVG-Countdown-Grid für scheduled Timings */}
      {!bigDisplay && timings.filter((t) => t.status === 'scheduled').length > 0 && (
        <ScheduledCookCountdownGrid timings={timings} orders={filtered} />
      )}

      {/* Smart-Timing Countdown-Grid: Kompakte Uhren für alle kochenden Bestellungen */}
      {!bigDisplay && timings.filter((t) => t.status === 'cooking').length > 0 && (
        <SmartTimingCountdownGrid timings={timings} orders={filtered} />
      )}

      {/* Fertig-in-10-Min-Vorschau: zeigt Bestellungen die in <10 Min fertig sein werden */}
      {!bigDisplay && <KitchenReadyForecastPanel orders={filtered} timings={timings} />}

      {/* Gantt-Zeitleiste: alle kochenden + bestätigten Bestellungen auf einem Zeitstrahl */}
      {!bigDisplay && filtered.filter((o) => ['in_zubereitung', 'bestätigt'].includes(o.status)).length >= 2 && (
        <KitchenGanttStrip orders={filtered} timings={timings} />
      )}

      {/* Allergen & Sonderwunsch-Monitor: alle Notizen aktiver Bestellungen im Überblick */}
      {!bigDisplay && <KitchenAllergenMonitor orders={filtered} />}

      {/* Popup: ungenommene Order */}
      {unacceptedAlert && (
        <UnacceptedOrderPopup
          order={unacceptedAlert}
          onSnooze={() => setSnoozed((s) => new Map(s).set(unacceptedAlert.id, Date.now() + 30_000))}
        />
      )}

      {/* Küchendisplay (TV-Modus) */}
      {bigDisplay && (
        <KitchenBigDisplayGrid orders={filtered} timings={timings} batches={batches} drivers={drivers} onClose={() => setBigDisplay(false)} />
      )}

      {/* Station-Fokus-Panel: Kompaktansicht für einzelne Station */}
      {stationFocus !== 'all' && !bigDisplay && (
        <KitchenStationFocusPanel
          orders={filtered}
          station={stationFocus}
          onClose={() => setStationFocus('all')}
        />
      )}

      {/* Umsatz-Pipeline: Gesamtwert aller aktiven Bestellungen */}
      {!bigDisplay && <KitchenRevenueGauge orders={filtered} />}

      {/* Kanban */}
      {!bigDisplay && <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                    {/* Stationsverteilung — nur für in_zubereitung + bestätigt */}
                    {(col.status === 'in_zubereitung' || col.status === 'bestätigt') && colOrders.length > 0 && (() => {
                      const stationCounts: Partial<Record<PrepStation, number>> = {};
                      for (const o of colOrders) {
                        for (const it of o.items ?? []) {
                          const st = classifyStation(it.name);
                          stationCounts[st] = (stationCounts[st] ?? 0) + it.menge;
                        }
                      }
                      const entries = (Object.entries(stationCounts) as [PrepStation, number][]).filter(([, n]) => n > 0);
                      if (entries.length === 0) return null;
                      const dotColors: Record<PrepStation, string> = {
                        Grill: 'bg-orange-400', Warm: 'bg-red-400', Kalt: 'bg-sky-400', Sonstiges: 'bg-matcha-500',
                      };
                      return (
                        <div className="flex items-center gap-1">
                          {entries.map(([st, n]) => (
                            <span key={st} className="inline-flex items-center gap-0.5 rounded-full bg-black/5 px-1.5 py-0.5 text-[8px] font-black tabular-nums">
                              <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', dotColors[st])} />
                              {n}
                            </span>
                          ))}
                        </div>
                      );
                    })()}
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
                {/* Zonen-Verteilung: nur für `fertig`-Spalte — hilft Dispatch beim Bündeln */}
                {col.status === 'fertig' && colOrders.filter(o => o.typ === 'lieferung' && o.delivery_zone).length > 0 && (() => {
                  const zoneCounts: Record<string, number> = {};
                  for (const o of colOrders) {
                    if (o.delivery_zone) zoneCounts[o.delivery_zone] = (zoneCounts[o.delivery_zone] ?? 0) + 1;
                  }
                  const sorted = Object.entries(zoneCounts).sort((a, b) => b[1] - a[1]);
                  if (sorted.length === 0) return null;
                  return (
                    <div className="flex flex-wrap gap-1 px-3 py-1.5 border-t border-black/5 bg-matcha-50/40">
                      {sorted.map(([zone, cnt]) => (
                        <span key={zone} className={cn(
                          'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-black tabular-nums',
                          cnt >= 3 ? 'bg-matcha-700 text-white' : cnt === 2 ? 'bg-matcha-200 text-matcha-900' : 'bg-matcha-100 text-matcha-700',
                        )}>
                          {zone}
                          <span className="opacity-80">×{cnt}</span>
                        </span>
                      ))}
                      <span className="text-[8px] text-muted-foreground self-center">Dispatch-Zonen</span>
                    </div>
                  );
                })()}
              </header>

              {/* Batch-Koch-Empfehlung: häufigstes Item über ≥2 kochende Bestellungen */}
              {col.status === 'in_zubereitung' && colOrders.length >= 2 && (() => {
                const itemCounts: Record<string, { total: number; orders: number }> = {};
                for (const o of colOrders) {
                  for (const it of o.items ?? []) {
                    if (!itemCounts[it.name]) itemCounts[it.name] = { total: 0, orders: 0 };
                    itemCounts[it.name].total += it.menge;
                    itemCounts[it.name].orders += 1;
                  }
                }
                const best = Object.entries(itemCounts)
                  .filter(([, v]) => v.orders >= 2)
                  .sort((a, b) => b[1].total - a[1].total)[0];
                if (!best) return null;
                return (
                  <div className="mx-3 mt-2 flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-[11px]">
                    <span className="shrink-0 text-base">🍳</span>
                    <span className="font-bold text-orange-800">Jetzt gemeinsam:</span>
                    <span className="text-orange-700 truncate">
                      {best[1].total}× {best[0]}
                      <span className="ml-1 opacity-70">({best[1].orders} Best.)</span>
                    </span>
                  </div>
                );
              })()}

              {/* Dispatch-Hinweis: fertige Lieferbestellungen >5 Min warten — schnell dispatchen! */}
              {col.status === 'fertig' && (() => {
                const waitingLong = colOrders.filter((o) => {
                  if (o.typ !== 'lieferung' || !o.fertig_am) return false;
                  return (Date.now() - new Date(o.fertig_am).getTime()) / 60_000 >= 5;
                });
                if (waitingLong.length === 0) return null;
                return (
                  <a
                    href="/dispatch"
                    className="mx-3 mt-2 flex items-center gap-2 rounded-lg border border-matcha-300 bg-matcha-50 px-3 py-1.5 text-[11px] hover:bg-matcha-100 transition"
                  >
                    <Bike className="h-3 w-3 text-matcha-700 shrink-0" />
                    <span className="font-bold text-matcha-800">
                      {waitingLong.length} Bestellung{waitingLong.length !== 1 ? 'en' : ''} {waitingLong.length !== 1 ? 'warten' : 'wartet'} &gt;5 Min
                    </span>
                    <span className="ml-auto text-[10px] text-matcha-600 font-semibold">→ Dispatch</span>
                  </a>
                );
              })()}

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
                  return colOrders.map((o) => {
                    const batchStop = stops.find((s) => s.order_id === o.id && !s.geliefert_am);
                    const batch = batchStop ? batches.find((b) => b.id === batchStop.batch_id) : null;
                    const driverEtaMs = (() => {
                      if (!batchStop || !batch?.started_at || batch.total_eta_min == null) return null;
                      const batchStops = stops.filter((s) => s.batch_id === batch.id);
                      const total = batchStops.length;
                      const frac = total > 0 ? batchStop.reihenfolge / total : 1;
                      return new Date(batch.started_at).getTime() + frac * batch.total_eta_min * 60_000;
                    })();
                    return (
                      <OrderTicket
                        key={o.id}
                        order={o}
                        next={col.next}
                        timing={timings.find((t) => t.order_id === o.id) ?? null}
                        sameZoneCount={o.delivery_zone ? (fertigZoneCounts[o.delivery_zone] ?? 0) : 0}
                        driverEtaMs={driverEtaMs}
                      />
                    );
                  });
                })()}
              </div>
            </section>
          );
        })}
      </div>}
    </div>
  );
}

/* ------------------------------ KitchenBigDisplayGrid ------------------------------ */

function KitchenBigDisplayGrid({
  orders,
  timings,
  batches,
  drivers,
  onClose,
}: {
  orders: Order[];
  timings: KitchenTiming[];
  batches: Batch[];
  drivers: Driver[];
  onClose: () => void;
}) {
  const [, setTick] = useState(0);
  const [, startBigTransition] = useTransition();
  const [bigMarkedReady, setBigMarkedReady] = useState<Set<string>>(new Set());
  const [bigMarkedDone, setBigMarkedDone] = useState<Set<string>>(new Set());
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();
  const cooking = orders.filter((o) => ['bestätigt', 'in_zubereitung'].includes(o.status));
  const ready   = orders.filter((o) => o.status === 'fertig');

  const sortedCooking = [...cooking].sort((a, b) => {
    const aElapsed = a.bestellt_am ? now - new Date(a.bestellt_am).getTime() : 0;
    const bElapsed = b.bestellt_am ? now - new Date(b.bestellt_am).getTime() : 0;
    const aEst = (a.geschaetzte_zubereitung_min ?? 15) * 60_000;
    const bEst = (b.geschaetzte_zubereitung_min ?? 15) * 60_000;
    return (bElapsed - bEst) - (aElapsed - aEst);
  });

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-[#0a0f0c] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          <ChefHat className="h-6 w-6 text-matcha-400" />
          <span className="font-display text-xl font-black text-white uppercase tracking-widest">
            Küchendisplay
          </span>
          <span className="text-[10px] font-bold text-matcha-600 uppercase tracking-wider">
            {cooking.length} kochend · {ready.length} bereit
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm text-matcha-500 tabular-nums">
            {new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main grid */}
      <div className="flex-1 overflow-auto p-5">
        {sortedCooking.length === 0 && ready.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <ChefHat className="h-24 w-24 text-matcha-800 mb-4" />
            <div className="font-display text-4xl font-black text-matcha-600">Küche frei</div>
            <div className="mt-2 text-matcha-700 text-xl">Keine aktiven Bestellungen</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {sortedCooking.map((order) => {
              const timing = timings.find((t) => t.order_id === order.id) ?? null;
              const elapsedMs = order.bestellt_am ? now - new Date(order.bestellt_am).getTime() : 0;
              const est = order.geschaetzte_zubereitung_min ?? 15;
              const estMs = est * 60_000;

              let pct: number;
              let remainingSec: number;

              if (timing?.status === 'cooking' && timing.cook_start_at && timing.ready_target) {
                const start = new Date(timing.cook_start_at).getTime();
                const end   = new Date(timing.ready_target).getTime();
                pct = end > start ? Math.min(100, Math.max(0, Math.round((now - start) / (end - start) * 100))) : 100;
                remainingSec = Math.floor((new Date(timing.ready_target).getTime() - now) / 1000);
              } else {
                pct = Math.min(100, Math.round((elapsedMs / estMs) * 100));
                remainingSec = Math.floor((estMs - elapsedMs) / 1000);
              }

              const overdue = remainingSec < 0;
              const absSec  = Math.abs(remainingSec);
              const displayMin = Math.floor(absSec / 60);
              const displaySec = absSec % 60;
              const ringColor =
                pct >= 100 ? '#ef4444' :
                pct >= 85  ? '#f97316' :
                pct >= 60  ? '#eab308' :
                timing?.status === 'cooking' ? '#3b82f6' : '#22c55e';

              return (
                <div
                  key={order.id}
                  className={cn(
                    'rounded-2xl p-4 flex flex-col items-center gap-3 transition',
                    overdue
                      ? 'bg-red-950/80 border-2 border-red-500 animate-pulse'
                      : pct >= 85
                      ? 'bg-orange-950/80 border-2 border-orange-500/70'
                      : 'bg-matcha-900/80 border border-matcha-700/50',
                  )}
                >
                  {/* SVG Countdown Ring */}
                  <div className="relative h-24 w-24 flex items-center justify-center">
                    <svg className="absolute inset-0 -rotate-90" width="96" height="96" viewBox="0 0 96 96">
                      <circle cx="48" cy="48" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
                      <circle
                        cx="48" cy="48" r="42" fill="none"
                        stroke={ringColor} strokeWidth="5" strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 42}`}
                        strokeDashoffset={`${2 * Math.PI * 42 * (1 - Math.min(1, pct / 100))}`}
                        style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }}
                      />
                    </svg>
                    <div className="relative text-center">
                      <div className="font-mono text-xl font-black text-white tabular-nums leading-none">
                        {overdue ? '+' : ''}{displayMin}:{String(displaySec).padStart(2, '0')}
                      </div>
                      <div className="text-[9px] font-bold uppercase tracking-wider mt-0.5" style={{ color: ringColor }}>
                        {overdue ? 'ÜBERZOGEN' : 'verbleibend'}
                      </div>
                    </div>
                  </div>

                  {/* Order info */}
                  <div className="text-center space-y-1 w-full">
                    <div className="font-mono text-[10px] font-bold text-matcha-400">
                      #{order.bestellnummer.replace('FF-', '')}
                    </div>
                    <div className="font-display text-base font-black text-white leading-tight truncate">
                      {order.kunde_name}
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      <span className={cn(
                        'rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase',
                        order.status === 'in_zubereitung' ? 'bg-orange-500/30 text-orange-300' : 'bg-blue-500/30 text-blue-300',
                      )}>
                        {order.status === 'in_zubereitung' ? 'kocht' : 'angenommen'}
                      </span>
                      {order.typ === 'lieferung' && (
                        <Bike className="h-3 w-3 text-matcha-500" />
                      )}
                    </div>
                  </div>

                  {/* Items (max 3) */}
                  <div className="w-full space-y-0.5 border-t border-white/10 pt-2">
                    {order.items?.slice(0, 3).map((it) => (
                      <div key={it.id} className="flex items-center gap-1.5 text-[10px]">
                        <span className="h-4 w-4 rounded-full bg-white/10 flex items-center justify-center font-bold text-white shrink-0 text-[8px]">
                          {it.menge}
                        </span>
                        <span className="text-matcha-300 truncate">{it.name}</span>
                      </div>
                    ))}
                    {order.items && order.items.length > 3 && (
                      <div className="text-[9px] text-matcha-500">+{order.items.length - 3} weitere</div>
                    )}
                  </div>
                  {/* One-tap Fertig button — for kitchen staff using the TV display */}
                  {!bigMarkedDone.has(order.id) && (
                    <button
                      onClick={() => {
                        const t = timings.find((x) => x.order_id === order.id);
                        startBigTransition(async () => {
                          if (t) {
                            const res = await markTimingReady(t.id);
                            if (res.ok) { setBigMarkedReady((s) => new Set(s).add(t.id)); setBigMarkedDone((s) => new Set(s).add(order.id)); }
                          } else {
                            const res = await advanceOrder(order.id, 'fertig');
                            if (res.ok) setBigMarkedDone((s) => new Set(s).add(order.id));
                          }
                        });
                      }}
                      className={cn(
                        'mt-auto w-full rounded-xl py-2.5 text-sm font-black tracking-wide transition-all active:scale-[0.98]',
                        overdue
                          ? 'bg-red-600 text-white hover:bg-red-500'
                          : 'bg-accent text-matcha-900 hover:brightness-110',
                      )}
                    >
                      ✓ Fertig!
                    </button>
                  )}
                  {bigMarkedDone.has(order.id) && (
                    <div className="mt-auto w-full rounded-xl py-2.5 text-sm font-black text-center bg-matcha-700 text-accent">
                      ✓ Markiert
                    </div>
                  )}
                </div>
              );
            })}

            {/* Ready orders: smaller chips */}
            {ready.length > 0 && (
              <div className="col-span-full mt-2">
                <div className="text-[10px] font-bold uppercase tracking-widest text-matcha-600 mb-2">
                  Fertig · wartet auf Abholung ({ready.length})
                </div>
                <div className="flex flex-wrap gap-2">
                  {ready.map((order) => {
                    const waitMin = order.fertig_am
                      ? Math.floor((now - new Date(order.fertig_am).getTime()) / 60_000)
                      : 0;
                    const urgent = waitMin >= 10;
                    return (
                      <div
                        key={order.id}
                        className={cn(
                          'flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px]',
                          urgent ? 'border-red-500/50 bg-red-950/50 animate-pulse' : 'border-matcha-700/50 bg-matcha-900/50',
                        )}
                      >
                        <Package className={cn('h-3.5 w-3.5 shrink-0', urgent ? 'text-red-400' : 'text-matcha-400')} />
                        <span className="font-mono font-bold text-white">#{order.bestellnummer.replace('FF-', '')}</span>
                        <span className="text-matcha-300">{order.kunde_name}</span>
                        <span className={cn('font-mono font-bold tabular-nums', urgent ? 'text-red-400' : 'text-matcha-500')}>
                          {waitMin}m
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Aktive Touren — Footer-Leiste für Küchenpersonal */}
      {batches.filter(b => ['unterwegs', 'on_route', 'pickup', 'assigned'].includes(b.status)).length > 0 && (
        <div className="border-t border-white/5 bg-matcha-950/80 px-5 py-2.5">
          <div className="flex items-center gap-3 overflow-x-auto">
            <span className="text-[9px] font-black uppercase tracking-widest text-matcha-600 shrink-0">Touren</span>
            {batches
              .filter(b => ['unterwegs', 'on_route', 'pickup', 'assigned'].includes(b.status))
              .map(b => {
                const driver = drivers.find(d => d.id === b.driver_id);
                const etaMs = b.started_at && b.total_eta_min
                  ? new Date(b.started_at).getTime() + b.total_eta_min * 60_000
                  : null;
                const remainMin = etaMs ? Math.round((etaMs - now) / 60_000) : null;
                const isOverdue = remainMin !== null && remainMin < 0;
                return (
                  <div
                    key={b.id}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-3 py-1.5 shrink-0 text-[10px]',
                      b.status === 'pickup' ? 'border-amber-500/40 bg-amber-950/40 text-amber-300' :
                      isOverdue ? 'border-red-500/30 bg-red-950/30 text-red-400 animate-pulse' :
                      'border-matcha-700/30 bg-matcha-900/30 text-matcha-400',
                    )}
                  >
                    <Bike className="h-3 w-3 shrink-0" />
                    <span className="font-bold">
                      {driver ? `${driver.vorname} ${driver.nachname[0]}.` : 'Fahrer'}
                    </span>
                    {b.status === 'pickup' && (
                      <span className="font-black text-amber-200 uppercase text-[9px]">abholt</span>
                    )}
                    {remainMin !== null && b.status !== 'pickup' && (
                      <span className="font-mono tabular-nums">
                        {isOverdue ? `+${Math.abs(remainMin)}m` : `${remainMin}m`}
                      </span>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}
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

/* ------------------------------ KitchenEfficiencyPanel ------------------------------ */

function KitchenEfficiencyPanel({ orders }: { orders: Order[] }) {
  // Berechne Ist-Zubereitungszeit für fertige Bestellungen
  const fertig = orders.filter(
    (o) => (o.status === 'fertig' || o.status === 'unterwegs') && o.bestellt_am && o.fertig_am,
  );
  if (fertig.length < 2) return null;

  const prepTimes = fertig.map((o) => {
    const actual = Math.floor((new Date(o.fertig_am!).getTime() - new Date(o.bestellt_am!).getTime()) / 60_000);
    const target = o.geschaetzte_zubereitung_min ?? 15;
    return { actual, target, diff: actual - target };
  });

  const avgActual = Math.round(prepTimes.reduce((s, x) => s + x.actual, 0) / prepTimes.length);
  const avgTarget = Math.round(prepTimes.reduce((s, x) => s + x.target, 0) / prepTimes.length);
  const avgDiff = avgActual - avgTarget;
  const onTimeCount = prepTimes.filter((x) => x.diff <= 0).length;
  const onTimePct = Math.round((onTimeCount / prepTimes.length) * 100);
  const efficiencyPct = Math.min(100, Math.round((avgTarget / Math.max(avgActual, 1)) * 100));

  const statusColor =
    onTimePct >= 80 ? 'text-matcha-700' :
    onTimePct >= 60 ? 'text-amber-700' :
    'text-red-700';
  const barColor =
    efficiencyPct >= 85 ? 'bg-matcha-500' :
    efficiencyPct >= 65 ? 'bg-amber-400' :
    'bg-red-400';

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-matcha-600" />
        <span className="font-display text-xs font-bold uppercase tracking-wider">
          Küchen-Effizienz · {fertig.length} fertige Bestellungen
        </span>
        <span className={cn('ml-auto text-[10px] font-black tabular-nums', statusColor)}>
          {onTimePct}% rechtzeitig
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center justify-between text-[10px] mb-1">
            <span className="text-muted-foreground">Effizienz</span>
            <span className={cn('font-bold tabular-nums', statusColor)}>{efficiencyPct}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', barColor)}
              style={{ width: `${efficiencyPct}%` }}
            />
          </div>
        </div>
        <div className="flex gap-3 text-[11px] shrink-0">
          <div className="text-center">
            <div className="font-black text-base tabular-nums text-foreground">{avgActual}m</div>
            <div className="text-[9px] text-muted-foreground">Ø Ist</div>
          </div>
          <div className="text-center">
            <div className="font-black text-base tabular-nums text-muted-foreground">{avgTarget}m</div>
            <div className="text-[9px] text-muted-foreground">Ø Soll</div>
          </div>
          <div className="text-center">
            <div className={cn('font-black text-base tabular-nums', avgDiff > 0 ? 'text-red-600' : 'text-matcha-600')}>
              {avgDiff > 0 ? `+${avgDiff}` : avgDiff}m
            </div>
            <div className="text-[9px] text-muted-foreground">Δ</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ KitchenTimingAccuracyBar ------------------------------ */

function KitchenTimingAccuracyBar({ timings }: { timings: KitchenTiming[] }) {
  const done = timings.filter((t) => (t.status === 'ready' || t.status === 'picked_up') && t.cook_start_at && t.ready_target && t.prep_min);
  if (done.length < 2) return null;

  const results = done.map((t) => {
    const scheduledMs = new Date(t.ready_target!).getTime() - new Date(t.cook_start_at!).getTime();
    const scheduledMin = scheduledMs / 60_000;
    const actualMin = t.prep_min!;
    const diffMin = actualMin - scheduledMin;
    return { scheduledMin, actualMin, diffMin, onTime: Math.abs(diffMin) <= 2 };
  });

  const onTimePct = Math.round((results.filter((r) => r.onTime).length / results.length) * 100);
  const avgDiff = Math.round((results.reduce((s, r) => s + r.diffMin, 0) / results.length) * 10) / 10;
  const barColor = onTimePct >= 85 ? 'bg-matcha-500' : onTimePct >= 65 ? 'bg-amber-400' : 'bg-red-400';
  const textColor = onTimePct >= 85 ? 'text-matcha-700' : onTimePct >= 65 ? 'text-amber-700' : 'text-red-700';

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        <Target className="h-4 w-4 text-matcha-600" />
        <span className="font-display text-xs font-bold uppercase tracking-wider">
          Smart-Timing Genauigkeit · {done.length} abgeschlossen
        </span>
        <span className={cn('ml-auto text-[10px] font-black tabular-nums', textColor)}>
          {onTimePct}% im Ziel (±2 Min)
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${onTimePct}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>0%</span>
            <span>100%</span>
          </div>
        </div>
        <div className="flex gap-3 text-[11px] shrink-0">
          <div className="text-center">
            <div className={cn('font-black text-base tabular-nums', avgDiff > 2 ? 'text-red-600' : avgDiff < -2 ? 'text-amber-600' : 'text-matcha-600')}>
              {avgDiff > 0 ? `+${avgDiff}` : avgDiff}m
            </div>
            <div className="text-[9px] text-muted-foreground">Ø Abw.</div>
          </div>
          <div className="text-center">
            <div className={cn('font-black text-base tabular-nums', textColor)}>{onTimePct}%</div>
            <div className="text-[9px] text-muted-foreground">Präzision</div>
          </div>
        </div>
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
  const activeRevenue = orders
    .filter((o) => !['rejected', 'storniert'].includes(o.status))
    .reduce((s, o) => s + (o.gesamtbetrag ?? 0), 0);

  if (completedToday === null && ordersLastHour === 0 && waitingForDriver === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {completedToday !== null && (
        <div className="flex items-center gap-1.5 rounded-full border border-matcha-200 bg-matcha-50 px-3 py-1 text-xs font-bold text-matcha-700">
          <Check className="h-3 w-3" />
          {completedToday} heute fertig
        </div>
      )}
      {activeRevenue > 0 && (
        <div className="flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">
          <Euro className="h-3 w-3" />
          {euro(activeRevenue)} aktiv
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

/* ------------------------------ RushModeBanner ------------------------------ */

function RushModeBanner({
  orders,
  snoozedUntil,
  onSnooze,
}: {
  orders: Order[];
  snoozedUntil: number;
  onSnooze: () => void;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();
  if (snoozedUntil > now) return null;

  const critical = orders.filter((o) => {
    if (['fertig', 'unterwegs'].includes(o.status)) return false;
    if (!o.bestellt_am) return false;
    const waitMin = (now - new Date(o.bestellt_am).getTime()) / 60_000;
    return waitMin >= (o.geschaetzte_zubereitung_min ?? 15) + 10;
  });
  if (critical.length < 3) return null;

  const sorted = [...critical].sort((a, b) => {
    const aOver = a.bestellt_am ? (now - new Date(a.bestellt_am).getTime()) / 60_000 - (a.geschaetzte_zubereitung_min ?? 15) : 0;
    const bOver = b.bestellt_am ? (now - new Date(b.bestellt_am).getTime()) / 60_000 - (b.geschaetzte_zubereitung_min ?? 15) : 0;
    return bOver - aOver;
  });

  return (
    <div className="relative overflow-hidden rounded-xl border-2 border-red-500 bg-red-600 px-4 py-3 text-white animate-in slide-in-from-top duration-300">
      <div className="absolute inset-0 bg-red-700/40 animate-pulse pointer-events-none" />
      <div className="relative flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20">
          <Flame className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display text-lg font-black uppercase tracking-tight">
            Rush Mode — {critical.length} kritisch überfällig!
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {sorted.slice(0, 6).map((o) => {
              const waitMin = o.bestellt_am ? Math.floor((now - new Date(o.bestellt_am).getTime()) / 60_000) : 0;
              const overMin = waitMin - (o.geschaetzte_zubereitung_min ?? 15);
              return (
                <span key={o.id} className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold">
                  #{o.bestellnummer.replace('FF-', '')}
                  <span className="rounded-full bg-white px-1 text-[9px] font-black text-red-700">
                    +{overMin}m
                  </span>
                </span>
              );
            })}
            {critical.length > 6 && (
              <span className="text-[11px] text-red-200">+{critical.length - 6} weitere</span>
            )}
          </div>
        </div>
        <button
          onClick={onSnooze}
          className="shrink-0 rounded-full bg-white/20 p-1.5 hover:bg-white/30 transition"
          title="3 Minuten schließen"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------ KitchenFensterForecast ------------------------------ */

function KitchenFensterForecast({ orders, timings }: { orders: Order[]; timings: KitchenTiming[] }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();
  const WINDOW_MIN = 15;
  const NUM_WINDOWS = 8;

  const windows = Array.from({ length: NUM_WINDOWS }, (_, i) => {
    const startMs = now + i * WINDOW_MIN * 60_000;
    const endMs = startMs + WINDOW_MIN * 60_000;
    const label = new Date(startMs).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    let count = 0;
    for (const o of orders) {
      if (!['bestätigt', 'in_zubereitung'].includes(o.status)) continue;
      const timing = timings.find((t) => t.order_id === o.id);
      let estFinishMs: number;
      if (timing?.status === 'cooking' && timing.ready_target) {
        estFinishMs = new Date(timing.ready_target).getTime();
      } else if (timing?.status === 'scheduled' && timing.cook_start_at && timing.prep_min) {
        estFinishMs = new Date(timing.cook_start_at).getTime() + timing.prep_min * 60_000;
      } else if (o.bestellt_am) {
        estFinishMs = new Date(o.bestellt_am).getTime() + (o.geschaetzte_zubereitung_min ?? 15) * 60_000;
      } else {
        continue;
      }
      if (estFinishMs >= startMs && estFinishMs < endMs) count++;
    }
    const overdueCount = i === 0
      ? orders.filter((o) => {
          if (!['bestätigt', 'in_zubereitung'].includes(o.status)) return false;
          const t = timings.find((tt) => tt.order_id === o.id);
          const fin = t?.ready_target
            ? new Date(t.ready_target).getTime()
            : o.bestellt_am
            ? new Date(o.bestellt_am).getTime() + (o.geschaetzte_zubereitung_min ?? 15) * 60_000
            : null;
          return fin !== null && fin < now;
        }).length
      : 0;
    return { label, count, overdueCount };
  });

  const maxCount = Math.max(...windows.map((w) => w.count), 1);
  const total = windows.reduce((s, w) => s + w.count, 0);
  if (total === 0 && windows[0].overdueCount === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="h-4 w-4 text-matcha-600" />
        <span className="font-display text-xs font-bold uppercase tracking-wider">
          2h-Fenster · {total} erwartet
        </span>
        {windows[0].overdueCount > 0 && (
          <span className="ml-1 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-black text-red-700 animate-pulse">
            {windows[0].overdueCount} überfällig
          </span>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground">15-Min-Intervalle</span>
      </div>
      <div className="grid grid-cols-8 gap-1">
        {windows.map((w, i) => {
          const height = Math.max(6, Math.round((w.count / maxCount) * 56));
          const barColor =
            i === 0 && w.overdueCount > 0
              ? 'bg-red-500'
              : w.count >= 4
              ? 'bg-orange-400'
              : w.count >= 2
              ? 'bg-amber-400'
              : w.count > 0
              ? 'bg-matcha-400'
              : 'bg-muted';
          return (
            <div key={i} className="flex flex-col items-center gap-0.5">
              <div className="relative flex items-end h-[56px] w-full">
                <div
                  className={cn('w-full rounded-t-sm transition-all duration-500', barColor)}
                  style={{ height: `${height}px` }}
                />
                {i === 0 && w.overdueCount > 0 && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[8px] font-black text-red-600 animate-pulse">
                    +{w.overdueCount}
                  </span>
                )}
              </div>
              <span className={cn('text-[8px] font-bold tabular-nums', i === 0 ? 'text-foreground' : 'text-muted-foreground')}>
                {w.count > 0 ? w.count : '–'}
              </span>
              <span className="text-[7px] text-muted-foreground leading-none">{w.label}</span>
            </div>
          );
        })}
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
  const supabase = createClient();
  const [, setTick] = React.useState(0);
  const [notifiedIds, setNotifiedIds] = React.useState<Set<string>>(new Set());
  const [notifiedAt, setNotifiedAt] = React.useState<Record<string, number>>({});
  const [sendingId, setSendingId] = React.useState<string | null>(null);
  const [customerReplies, setCustomerReplies] = React.useState<Map<string, { nachricht: string; created_at: string }>>(new Map());

  React.useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 10_000);
    return () => clearInterval(t);
  }, []);

  // Kundennachrichten laden + Realtime-Abo für Abholbestellungen
  React.useEffect(() => {
    const pickupOrderIds = orders
      .filter((o) => o.status === 'fertig' && o.typ === 'abholung')
      .map((o) => o.id);
    if (pickupOrderIds.length === 0) return;

    // Letzte Kundennachricht pro Order laden
    supabase
      .from('order_messages')
      .select('order_id, nachricht, created_at')
      .in('order_id', pickupOrderIds)
      .eq('sender', 'kunde')
      .order('created_at', { ascending: false })
      .then(({ data }: { data: { order_id: string; nachricht: string; created_at: string }[] | null }) => {
        if (!data) return;
        const map = new Map<string, { nachricht: string; created_at: string }>();
        for (const m of data) {
          if (!map.has(m.order_id)) map.set(m.order_id, { nachricht: m.nachricht, created_at: m.created_at });
        }
        setCustomerReplies(map);
      });

    // Realtime: neue Kundennachrichten
    const ch = supabase
      .channel(`pickup-msgs-${pickupOrderIds.join('-').slice(0, 40)}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'order_messages',
        filter: `order_id=in.(${pickupOrderIds.join(',')})`,
      }, (payload: { new: { order_id: string; sender: string; nachricht: string; created_at: string } }) => {
        const msg = payload.new;
        if (msg.sender !== 'kunde') return;
        setCustomerReplies((prev) => {
          const m = new Map(prev);
          m.set(msg.order_id, { nachricht: msg.nachricht, created_at: msg.created_at });
          return m;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders.map(o => o.id).join(',')]);


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

  async function notifyCustomer(orderId: string) {
    setSendingId(orderId);
    try {
      await supabase.from('order_messages').insert({
        order_id: orderId,
        sender: 'küche',
        nachricht: '🔔 Ihre Bestellung ist fertig — bitte kommen Sie zur Kasse! Vielen Dank für Ihre Geduld. 🙏',
      });
      setNotifiedIds((s) => new Set([...s, orderId]));
      setNotifiedAt((m) => ({ ...m, [orderId]: Date.now() }));
    } catch { /* fire-and-forget */ }
    setSendingId(null);
  }

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
          const notified = notifiedIds.has(order.id);
          const notifiedMinsAgo = notifiedAt[order.id]
            ? Math.floor((now - notifiedAt[order.id]) / 60_000)
            : null;
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
              {/* Kunde benachrichtigen — schreibt in order_messages → Tracking-Seite zeigt Popup */}
              <button
                onClick={() => notifyCustomer(order.id)}
                disabled={sendingId === order.id || notified}
                title={notified ? `Kunde benachrichtigt${notifiedMinsAgo != null && notifiedMinsAgo > 0 ? ` vor ${notifiedMinsAgo} Min` : ''}` : 'Kunde per Tracking-Chat benachrichtigen'}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold transition',
                  notified
                    ? 'bg-matcha-600 text-white cursor-default'
                    : 'bg-matcha-100 text-matcha-800 hover:bg-matcha-200 active:scale-95',
                  sendingId === order.id && 'opacity-50',
                )}
              >
                <MessageSquare className="h-2.5 w-2.5 shrink-0" />
                {notified
                  ? notifiedMinsAgo != null && notifiedMinsAgo > 0
                    ? `vor ${notifiedMinsAgo}m`
                    : '✓ Gesendet'
                  : 'Benachrichtigen'}
              </button>
              {/* Kundenantwort auf Benachrichtigung */}
              {customerReplies.has(order.id) && (() => {
                const reply = customerReplies.get(order.id)!;
                const replyMin = Math.floor((now - new Date(reply.created_at).getTime()) / 60_000);
                return (
                  <span
                    className="inline-flex items-center gap-1 rounded-md bg-blue-100 border border-blue-300 px-1.5 py-0.5 text-[9px] font-medium text-blue-900 max-w-[120px]"
                    title={reply.nachricht}
                  >
                    <MessageSquare className="h-2 w-2 shrink-0 text-blue-500" />
                    <span className="truncate">{reply.nachricht}</span>
                    {replyMin > 0 && <span className="shrink-0 text-blue-400 font-bold">·{replyMin}m</span>}
                  </span>
                );
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ OrderNotesPanel ------------------------------ */

function OrderNotesPanel({ orders }: { orders: Order[] }) {
  const active = orders.filter((o) =>
    !['fertig', 'unterwegs'].includes(o.status) &&
    (o.kunde_notiz || o.kunde_lieferhinweis),
  );
  if (active.length === 0) return null;

  return (
    <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-amber-700 shrink-0" />
        <span className="font-display text-xs font-bold uppercase tracking-wider text-amber-800">
          Sonderanfragen · {active.length} Bestellung{active.length !== 1 ? 'en' : ''} mit Hinweis
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {active.map((o) => {
          const note = o.kunde_notiz || o.kunde_lieferhinweis;
          const isUrgent = (() => {
            if (!o.bestellt_am) return false;
            const waitMin = (Date.now() - new Date(o.bestellt_am).getTime()) / 60_000;
            return waitMin >= (o.geschaetzte_zubereitung_min ?? 15);
          })();
          return (
            <div
              key={o.id}
              className={cn(
                'rounded-lg border px-3 py-2 text-xs max-w-[280px]',
                isUrgent ? 'border-red-300 bg-red-50' : 'border-amber-200 bg-white',
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono font-bold text-matcha-700">
                  #{o.bestellnummer.replace('FF-', '')}
                </span>
                <span className="font-semibold truncate">{o.kunde_name}</span>
                {isUrgent && (
                  <span className="ml-auto shrink-0 rounded-full bg-red-500 text-white px-1.5 py-0.5 text-[8px] font-black animate-pulse">!</span>
                )}
              </div>
              <div className="text-[11px] text-amber-900 leading-snug italic">„{note}"</div>
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
  const vehicleEmoji: Record<string, string> = { bike: '🚲', ebike: '🛵', scooter: '🛴', auto: '🚗' };
  const vEmoji = driver.status?.fahrzeug ? (vehicleEmoji[driver.status.fahrzeug] ?? '🚲') : null;

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
          <div className="flex items-center gap-1">
            <div className="font-display text-sm font-bold truncate">
              {driver.vorname} {driver.nachname}
            </div>
            {vEmoji && <span className="text-xs shrink-0">{vEmoji}</span>}
          </div>
          <div className={cn('text-[10px] font-bold uppercase tracking-wider', cfg.textColor)}>
            {cfg.label}
            {onlineMinutes !== null && state !== 'offline' && (
              <span className="ml-1 opacity-60">· {onlineMinutes} Min online</span>
            )}
          </div>
        </div>
        {driver.telefon && driver.status?.ist_online && (
          <div className="flex items-center gap-1 shrink-0">
            <a
              href={`tel:${driver.telefon}`}
              className="h-7 w-7 rounded-lg flex items-center justify-center bg-white/60 hover:bg-white text-foreground/70 hover:text-foreground transition"
              title="Anrufen"
            >
              <Phone className="h-3 w-3" />
            </a>
            {(() => {
              const raw = driver.telefon.replace(/\s+/g, '').replace(/[^\d+]/g, '');
              const intl = raw.startsWith('+') ? raw.slice(1) : raw.startsWith('00') ? raw.slice(2) : raw.startsWith('0') ? '49' + raw.slice(1) : '49' + raw;
              const msg = encodeURIComponent(`Hallo ${driver.vorname}! Bitte komm zum Restaurant, es gibt einen Auftrag für dich. 🍔`);
              return (
                <a
                  href={`https://wa.me/${intl}?text=${msg}`}
                  target="_blank"
                  rel="noreferrer"
                  className="h-7 w-7 rounded-lg flex items-center justify-center bg-[#25D366]/20 hover:bg-[#25D366]/30 text-[#25D366] transition"
                  title="WhatsApp"
                >
                  <MessageSquare className="h-3 w-3" />
                </a>
              );
            })()}
          </div>
        )}
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

function OrderTicket({ order, next, timing, sameZoneCount = 0, driverEtaMs = null }: { order: Order; next: string | null; timing: KitchenTiming | null; sameZoneCount?: number; driverEtaMs?: number | null }) {
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

  // Smart-Timing-Chip: zeigt Kochstart oder Fertig-Ziel (relativ + absolut)
  const timingChip = (() => {
    if (!timing) return null;
    const now = Date.now();
    const fmtClock = (iso: string) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    if (timing.status === 'scheduled' && timing.cook_start_at) {
      const secs = Math.floor((new Date(timing.cook_start_at).getTime() - now) / 1000);
      if (secs > 0) return { label: `Kochstart in ${fmtCountdown(secs)} · um ${fmtClock(timing.cook_start_at)}`, color: 'bg-blue-100 text-blue-800', pulse: secs < 120 };
      return { label: 'Kochstart jetzt!', color: 'bg-orange-500 text-white', pulse: true };
    }
    if (timing.status === 'cooking' && timing.ready_target) {
      const secs = Math.floor((new Date(timing.ready_target).getTime() - now) / 1000);
      if (secs > 0) return { label: `Fertig in ${fmtCountdown(secs)} · um ${fmtClock(timing.ready_target)}`, color: 'bg-matcha-100 text-matcha-800', pulse: secs < 120 };
      return { label: `Sollte fertig sein! (${fmtClock(timing.ready_target)})`, color: 'bg-red-500 text-white', pulse: true };
    }
    return null;
  })();

  const isTable = Boolean(order.tisch_id);
  const typLabel = isTable ? `🍽 Tisch ${order.tisch_nummer ?? ''}` : order.typ === 'lieferung' ? '🛵 Liefern' : order.typ === 'abholung' ? '🥡 Abholung' : '🍽 Vor Ort';

  // Graduated urgency: left-border accent makes status scannable across the kanban
  const urgencyBorder =
    critical                              ? 'border-l-4 border-l-red-500'    :
    urgent                                ? 'border-l-4 border-l-orange-400' :
    progressPct >= 50 && progressPct < 70 ? 'border-l-4 border-l-yellow-400' :
    progressPct < 50 && order.status === 'in_zubereitung' ? 'border-l-4 border-l-matcha-400' :
    '';

  const urgencyBg =
    critical ? 'bg-red-50/50 dark:bg-red-950/20' :
    urgent   ? 'bg-orange-50/40 dark:bg-orange-950/15' :
    '';

  // Urgency-Farbband: 5px farbcodierter Streifen am Kartenrand (sofort lesbar auf TV-Abstand)
  const heatColor =
    progressPct >= 100 ? 'bg-red-500'    :
    progressPct >= 85  ? 'bg-orange-500' :
    progressPct >= 60  ? 'bg-yellow-400' :
    cookTimingPct !== null ? 'bg-blue-400'  :
    'bg-matcha-400';

  return (
    <Card className={cn(
      'p-4 transition',
      urgencyBorder,
      urgencyBg,
      urgent   && !critical && 'ring-2 ring-orange-400',
      critical && 'ring-2 ring-red-500 animate-pulse',
    )}>
      {/* Farb-Warnband: sofort sichtbar auch aus Entfernung (-mx-4 -mt-4 escapes card padding) */}
      {(order.status === 'in_zubereitung' || order.status === 'bestätigt') && (
        <div className={cn('-mx-4 -mt-4 mb-3 h-1.5 rounded-t-xl transition-all duration-1000', heatColor, progressPct >= 85 && 'animate-pulse')} />
      )}
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
            {/* Priority score badge — only shown when above threshold */}
            {(() => {
              const score = computeOrderPriority(order);
              if (score < 30) return null;
              const bg = score >= 75 ? 'bg-red-500 text-white' : score >= 55 ? 'bg-orange-400 text-white' : 'bg-amber-300 text-amber-900';
              return (
                <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-black tabular-nums', bg)} title={`Prioritätsscore: ${Math.round(score)}`}>
                  P{Math.round(score)}
                </span>
              );
            })()}
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

      {/* Smart-Timing Chip — klickbar wenn Status 'scheduled', ruft startCookingNow auf */}
      {timingChip && timing && (
        timing.status === 'scheduled' ? (
          <button
            onClick={() => startTransition(async () => { await startCookingNow(timing.id); })}
            disabled={pending}
            title="Kochstart bestätigen"
            className={cn(
              'mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold cursor-pointer',
              'hover:opacity-80 active:scale-95 transition-all disabled:opacity-50',
              timingChip.color,
              timingChip.pulse && 'animate-pulse',
            )}
          >
            <Zap className="h-2.5 w-2.5" />
            {timingChip.label}
          </button>
        ) : (
          <div className={cn(
            'mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold',
            timingChip.color,
            timingChip.pulse && 'animate-pulse',
          )}>
            <Zap className="h-2.5 w-2.5" />
            {timingChip.label}
          </div>
        )
      )}

      {/* Timer-Schnellstart: nur wenn in_zubereitung und noch kein Timing vorhanden */}
      {order.status === 'in_zubereitung' && timing === null && (
        <button
          onClick={() => startTransition(async () => { await createKitchenTiming(order.id, order.geschaetzte_zubereitung_min ?? 15); })}
          disabled={pending}
          className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold bg-blue-100 text-blue-800 hover:bg-blue-200 transition cursor-pointer disabled:opacity-50"
        >
          ⚡ Timer starten
        </button>
      )}

      {/* Verbleibend-Chip: geschätzte Restzeit ohne Smart-Timing */}
      {timing === null && order.status === 'in_zubereitung' && (est - waitMin) > 0 && (
        <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-matcha-50 border border-matcha-200 px-2 py-0.5 text-[9px] font-medium text-matcha-700">
          ~ {Math.max(0, est - waitMin)}m verbleibend
        </div>
      )}

      {/* Wartet-auf-Dispatch-Chip: fertige Lieferbestellung noch nicht in einem Batch */}
      {order.status === 'fertig' && order.typ === 'lieferung' && order.fertig_am && (() => {
        const fertigMs = Date.now() - new Date(order.fertig_am).getTime();
        const fertigMin = Math.floor(fertigMs / 60_000);
        const fertigSec = Math.floor((fertigMs % 60_000) / 1_000);
        const cls = fertigMin >= 12 ? 'bg-red-500 text-white animate-pulse' :
                    fertigMin >= 7  ? 'bg-orange-500 text-white' :
                    fertigMin >= 3  ? 'bg-amber-100 text-amber-800' :
                                      'bg-matcha-100 text-matcha-700';
        return (
          <div className={cn('mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold', cls)}>
            <Bike className="h-2.5 w-2.5" />
            Dispatch: {fertigMin}:{String(fertigSec).padStart(2,'0')}
          </div>
        );
      })()}

      {/* Fahrer-ETA-Chip: fertige Lieferbestellung ist bereits einem aktiven Batch zugewiesen */}
      {order.status === 'fertig' && order.typ === 'lieferung' && driverEtaMs != null && (() => {
        const secUntil = Math.floor((driverEtaMs - Date.now()) / 1000);
        const minUntil = Math.floor(secUntil / 60);
        const isImminent = secUntil < 300;
        const isOverdue = secUntil < 0;
        const countdownLabel = isOverdue
          ? 'Fahrer kommt gerade'
          : secUntil < 60
          ? 'Fahrer kommt gleich!'
          : `Fahrer in ${minUntil} Min`;
        const clockLabel = new Date(driverEtaMs).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        return (
          <div className={cn(
            'mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold',
            isImminent
              ? 'bg-matcha-700 text-white animate-pulse'
              : 'bg-blue-100 text-blue-800',
          )}>
            <Bike className="h-2.5 w-2.5" />
            <span>{countdownLabel}</span>
            <span className="opacity-60">~{clockLabel}</span>
          </div>
        );
      })()}

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

      {/* Fertig-seit-Chip: Wie lange wartet die fertige Bestellung auf Abholung? */}
      {order.status === 'fertig' && order.fertig_am && (() => {
        const waitSinceFertig = Math.floor((Date.now() - new Date(order.fertig_am).getTime()) / 60_000);
        if (waitSinceFertig < 3) return null;
        return (
          <div className={cn(
            'mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold',
            waitSinceFertig >= 20
              ? 'bg-red-500 text-white animate-pulse'
              : waitSinceFertig >= 12
              ? 'bg-orange-100 text-orange-800'
              : 'bg-amber-50 text-amber-700',
          )}>
            <Clock className="h-2.5 w-2.5" />
            Fertig seit {waitSinceFertig} Min
            {waitSinceFertig >= 20 && ' ⚠️'}
          </div>
        );
      })()}

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
          {/* Prep-Zeit-Korrektur: Inline-Anpassung der geschätzten Zubereitungszeit */}
          <div className="mt-1.5 flex items-center gap-1">
            <span className="text-[9px] text-muted-foreground/60 mr-0.5">Zubereitung:</span>
            <button
              onClick={() => startTransition(() => void updatePrepTime(order.id, est - 5))}
              disabled={pending || est <= 5}
              className="h-5 px-1.5 rounded text-[9px] font-bold bg-muted hover:bg-orange-100 hover:text-orange-700 text-muted-foreground disabled:opacity-30 transition"
              title="-5 Minuten"
            >
              −5
            </button>
            <span className="text-[9px] font-bold tabular-nums text-foreground px-0.5">{est} Min</span>
            <button
              onClick={() => startTransition(() => void updatePrepTime(order.id, est + 5))}
              disabled={pending || est >= 120}
              className="h-5 px-1.5 rounded text-[9px] font-bold bg-muted hover:bg-matcha-100 hover:text-matcha-700 text-muted-foreground disabled:opacity-30 transition"
              title="+5 Minuten"
            >
              +5
            </button>
            {/* Smart-Timing anlegen: nur wenn kein Timing vorhanden */}
            {!timing && (
              <button
                onClick={() => startTransition(() => void createKitchenTiming(order.id, est))}
                disabled={pending}
                className="ml-1 h-5 px-1.5 rounded text-[9px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 disabled:opacity-30 transition"
                title="Smart-Timing anlegen und Countdown starten"
              >
                ⏱ Timing
              </button>
            )}
          </div>
        </div>
      )}

      <div className="mt-3">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold">{order.kunde_name}</div>
          {order.kunde_telefon && (
            <a
              href={`tel:${order.kunde_telefon}`}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted hover:bg-muted/70 text-muted-foreground transition"
              title={`Anrufen: ${order.kunde_telefon}`}
            >
              <Phone className="h-3 w-3" />
            </a>
          )}
        </div>
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
                {(() => {
                  const st = classifyStation(it.name);
                  const dot = STATION_META[st].dot;
                  return <span className={cn('mt-0.5 h-2 w-2 shrink-0 rounded-full', dot)} title={STATION_META[st].label} />;
                })()}
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

      {/* Stations-Übersicht: welche Küchenstationen braucht diese Bestellung? */}
      {order.items && order.items.length > 0 && (() => {
        const needed = new Set<PrepStation>();
        for (const it of order.items) {
          const st = classifyStation(it.name);
          if (st !== 'Sonstiges') needed.add(st);
        }
        if (needed.size === 0) return null;
        return (
          <div className="mt-2 flex flex-wrap gap-1">
            {Array.from(needed).map((st) => {
              const m = STATION_META[st];
              return (
                <span key={st} className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold border', m.bg, m.color)}>
                  <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', m.dot)} />
                  {m.label}
                </span>
              );
            })}
          </div>
        );
      })()}

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
          {next && (() => {
            // Wenn Timing vorhanden + cooking + fertig-Schritt → kombinierten Button zeigen
            const isFertigStep = next === 'fertig';
            const cookingTimingOverdue = isFertigStep && timing?.status === 'cooking' && remainingSec <= 0;
            const cookingTimingDone   = isFertigStep && timing?.status === 'cooking' && remainingSec <= 60 && remainingSec > 0;
            const btnCls = cookingTimingOverdue
              ? 'inline-flex h-9 items-center gap-1.5 rounded-md bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50 animate-pulse'
              : cookingTimingDone
              ? 'inline-flex h-9 items-center gap-1.5 rounded-md bg-matcha-600 px-4 text-sm font-bold text-white hover:bg-matcha-700 disabled:opacity-50'
              : 'inline-flex h-9 items-center gap-1.5 rounded-md bg-matcha-700 px-4 text-sm font-bold text-white hover:bg-matcha-800 disabled:opacity-50';
            return (
              <button
                onClick={() => startTransition(async () => {
                  await advanceOrder(order.id, next);
                  if (isFertigStep && timing?.status === 'cooking') {
                    await markTimingReady(timing.id);
                  }
                })}
                disabled={pending}
                className={btnCls}
              >
                {cookingTimingOverdue ? <Flame className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                {cookingTimingOverdue ? 'Jetzt fertig!' : nextLabel(next)}
              </button>
            );
          })()}
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------ CookingAlertBar ------------------------------ */

function CookingAlertBar({ timings, orders }: { timings: KitchenTiming[]; orders: Order[] }) {
  const [pending, startTransition] = useTransition();
  const [started, setStarted] = useState<Set<string>>(new Set());
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
              <button
                disabled={pending || started.has(t.id)}
                onClick={() => startTransition(async () => {
                  const res = await startCookingNow(t.id);
                  if (res.ok) setStarted((s) => new Set(s).add(t.id));
                })}
                className={cn(
                  'mt-2 w-full rounded-lg py-1.5 text-[11px] font-bold transition-colors',
                  started.has(t.id)
                    ? 'bg-green-200 text-green-800 cursor-default'
                    : overdue
                    ? 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800'
                    : 'bg-orange-500 text-white hover:bg-orange-600 active:bg-orange-700',
                )}
              >
                {started.has(t.id) ? '✓ Kochen gestartet' : pending ? '…' : '🍳 Jetzt kochen!'}
              </button>
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

type PrepStation = 'Grill' | 'Warm' | 'Kalt' | 'Sonstiges';

function classifyStation(name: string): PrepStation {
  const n = name.toLowerCase();
  if (/burger|steak|schnitzel|grill|bbq|wrap|panini|sandwich|kebab|döner/.test(n)) return 'Grill';
  if (/suppe|pasta|nudel|curry|bowl|reis|wok|ramen|eintopf|couscous|ragout|frikadelle|braten/.test(n)) return 'Warm';
  if (/salat|dessert|tiramisu|eis|pudding|getränk|drink|cola|wasser|juice|limo|bier|saft|smoothie|kaffee|tee/.test(n)) return 'Kalt';
  return 'Sonstiges';
}

const STATION_META: Record<PrepStation, { label: string; color: string; bg: string; dot: string }> = {
  Grill:     { label: 'Grill',     color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200',  dot: 'bg-orange-500' },
  Warm:      { label: 'Warm',      color: 'text-red-700',    bg: 'bg-red-50 border-red-200',        dot: 'bg-red-500'    },
  Kalt:      { label: 'Kalt',      color: 'text-sky-700',    bg: 'bg-sky-50 border-sky-200',        dot: 'bg-sky-400'    },
  Sonstiges: { label: 'Sonstiges', color: 'text-matcha-700', bg: 'bg-muted border-border',          dot: 'bg-matcha-500' },
};

function PrepItemsPanel({ orders }: { orders: Order[] }) {
  const [expandedStations, setExpandedStations] = useState<Set<PrepStation>>(new Set(['Grill', 'Warm', 'Kalt', 'Sonstiges']));

  const cooking = orders.filter((o) => ['bestätigt', 'in_zubereitung'].includes(o.status));
  if (cooking.length === 0) return null;

  type ItemEntry = {
    name: string;
    totalMenge: number;
    station: PrepStation;
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
        byItem.set(key, { name: it.name, totalMenge: 0, station: classifyStation(it.name), orders: [], maxWaitMin: 0 });
      }
      const entry = byItem.get(key)!;
      entry.totalMenge += it.menge;
      entry.maxWaitMin = Math.max(entry.maxWaitMin, waitMin);
      entry.orders.push({ bestellnummer: o.bestellnummer, waitMin, urgent });
    }
  }

  const items = Array.from(byItem.values()).sort((a, b) => b.maxWaitMin - a.maxWaitMin);
  if (items.length === 0) return null;

  // Nur anzeigen wenn ≥3 verschiedene Items oder >1 Bestellung
  if (items.length < 3 && cooking.length < 2) return null;

  const urgentItems = items.filter((i) => i.orders.some((o) => o.urgent));

  // Group by station, only include stations that have items
  const STATION_ORDER: PrepStation[] = ['Grill', 'Warm', 'Kalt', 'Sonstiges'];
  const byStation = new Map<PrepStation, ItemEntry[]>();
  for (const st of STATION_ORDER) byStation.set(st, []);
  for (const item of items) byStation.get(item.station)!.push(item);
  const activeStations = STATION_ORDER.filter((st) => (byStation.get(st)?.length ?? 0) > 0);

  const toggleStation = (st: PrepStation) => {
    setExpandedStations((prev) => {
      const next = new Set(prev);
      if (next.has(st)) next.delete(st); else next.add(st);
      return next;
    });
  };

  return (
    <div className={cn(
      'rounded-xl border p-3',
      urgentItems.length > 0 ? 'border-red-200 bg-red-50' : 'border-border bg-card',
    )}>
      <div className="mb-3 flex items-center gap-2">
        <ChefHat className={cn('h-4 w-4', urgentItems.length > 0 ? 'text-red-600' : 'text-matcha-600')} />
        <span className={cn(
          'font-display text-xs font-bold uppercase tracking-wider',
          urgentItems.length > 0 ? 'text-red-800' : 'text-foreground',
        )}>
          Küchen-Checkliste · {cooking.length} Bestellungen · {items.reduce((s, i) => s + i.totalMenge, 0)} Positionen
        </span>
        {/* Station badges summary */}
        <div className="ml-auto flex items-center gap-1">
          {activeStations.map((st) => {
            const meta = STATION_META[st];
            const stItems = byStation.get(st)!;
            const hasUrgent = stItems.some((i) => i.orders.some((o) => o.urgent));
            return (
              <button
                key={st}
                onClick={() => toggleStation(st)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold border transition',
                  meta.bg, meta.color,
                  hasUrgent && 'ring-1 ring-red-400',
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
                {meta.label} {stItems.reduce((s, i) => s + i.totalMenge, 0)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        {activeStations.map((st) => {
          const meta = STATION_META[st];
          const stItems = byStation.get(st)!;
          const isExpanded = expandedStations.has(st);
          const stUrgent = stItems.filter((i) => i.orders.some((o) => o.urgent)).length;
          return (
            <div key={st} className={cn('rounded-lg border overflow-hidden', meta.bg)}>
              <button
                type="button"
                onClick={() => toggleStation(st)}
                className={cn('w-full flex items-center gap-2 px-3 py-1.5 text-left', meta.color)}
              >
                <span className={cn('h-2 w-2 rounded-full shrink-0', meta.dot)} />
                <span className="text-[10px] font-black uppercase tracking-wider">{meta.label}</span>
                <span className="text-[9px] opacity-70">{stItems.length} Artikel · {stItems.reduce((s, i) => s + i.totalMenge, 0)}× gesamt</span>
                {stUrgent > 0 && (
                  <span className="rounded-full bg-red-500 text-white px-1.5 py-0.5 text-[8px] font-black">{stUrgent} dringend</span>
                )}
                <span className="ml-auto text-[10px]">{isExpanded ? '▲' : '▼'}</span>
              </button>
              {isExpanded && (
                <div className="grid gap-1 px-2 pb-2">
                  {stItems.slice(0, 10).map((item) => {
                    const isUrgent = item.orders.some((o) => o.urgent);
                    const urgentCount = item.orders.filter((o) => o.urgent).length;
                    const maxWait = item.maxWaitMin;
                    const rowBg = isUrgent ? 'bg-red-100 border-red-300' : maxWait >= 10 ? 'bg-orange-50 border-orange-200' : 'bg-white border-border';
                    return (
                      <div key={item.name} className={cn('flex items-center gap-3 rounded-lg border px-3 py-2', rowBg)}>
                        <span className={cn(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-display font-black text-sm',
                          isUrgent ? 'bg-red-600 text-white' : maxWait >= 10 ? 'bg-orange-500 text-white' : 'bg-matcha-700 text-white',
                        )}>
                          {item.totalMenge}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className={cn('font-medium text-sm truncate', isUrgent && 'font-bold text-red-900')}>
                            {item.name}
                          </div>
                          <div className="flex items-center gap-1 flex-wrap mt-0.5">
                            {item.orders.slice(0, 4).map((o, i) => (
                              <span key={i} className={cn(
                                'rounded px-1.5 py-0.5 text-[9px] font-bold tabular-nums',
                                o.urgent ? 'bg-red-200 text-red-800' : 'bg-muted text-muted-foreground',
                              )}>
                                #{o.bestellnummer.replace('FF-', '')}
                                {o.urgent && ` +${o.waitMin - (orders.find((x) => x.bestellnummer === o.bestellnummer)?.geschaetzte_zubereitung_min ?? 15)}m`}
                              </span>
                            ))}
                            {item.orders.length > 4 && <span className="text-[9px] text-muted-foreground">+{item.orders.length - 4}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {urgentCount > 0 && (
                            <span className="rounded-full bg-red-500 text-white px-1.5 py-0.5 text-[9px] font-black">{urgentCount} überfällig</span>
                          )}
                          <span className={cn('text-[10px] font-bold tabular-nums', isUrgent ? 'text-red-700' : 'text-muted-foreground')}>
                            max {maxWait}m
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {stItems.length > 10 && (
                    <div className="text-xs text-muted-foreground text-center py-1">+ {stItems.length - 10} weitere</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ CookNowFlash ------------------------------ */

function CookNowFlash({
  flash,
  onDismiss,
}: {
  flash: { orderId: string; orderNum: string; name: string };
  onDismiss: () => void;
}) {
  const [secs, setSecs] = useState(9);
  useEffect(() => {
    if (secs <= 0) { onDismiss(); return; }
    const t = setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secs, onDismiss]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-orange-600/95 backdrop-blur-sm animate-in fade-in duration-300 cursor-pointer"
      onClick={onDismiss}
    >
      <div className="text-center px-6 select-none">
        <div className="mb-4 flex items-center justify-center">
          <Flame className="h-20 w-20 text-white animate-bounce" />
        </div>
        <div className="font-display text-6xl font-black uppercase tracking-tight text-white drop-shadow-lg">
          Jetzt kochen!
        </div>
        <div className="mt-3 text-2xl font-bold text-orange-100">
          #{flash.orderNum.replace('FF-', '')} · {flash.name}
        </div>
        <div className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-white/20 px-6 py-3 text-lg font-bold text-white">
          <span className="font-mono tabular-nums">{secs}s</span>
          <span className="text-orange-200">— tippen zum schließen</span>
        </div>
        {/* Countdown arc */}
        <svg className="mx-auto mt-4" width="64" height="64" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
          <circle
            cx="32" cy="32" r="28"
            fill="none" stroke="white" strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 28}`}
            strokeDashoffset={`${2 * Math.PI * 28 * (1 - secs / 9)}`}
            style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
      </div>
    </div>
  );
}

/* ------------------------------ SmartTimingCountdownGrid ------------------------------ */

function SmartTimingCountdownGrid({ timings, orders }: { timings: KitchenTiming[]; orders: Order[] }) {
  const [, setTick] = useState(0);
  const [readyPending, startReadyTransition] = useTransition();
  const [markedReady, setMarkedReady] = useState<Set<string>>(new Set());
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();
  const cooking = timings
    .filter((t) => t.status === 'cooking' && t.cook_start_at && t.ready_target)
    .map((t) => {
      const order = orders.find((o) => o.id === t.order_id);
      if (!order) return null;
      const start = new Date(t.cook_start_at!).getTime();
      const end   = new Date(t.ready_target!).getTime();
      const elapsed = now - start;
      const total   = end - start;
      const pct     = total > 0 ? Math.min(100, Math.max(0, Math.round((elapsed / total) * 100))) : 100;
      const remSec  = Math.floor((end - now) / 1000);
      const overdue = remSec < 0;
      const absSec  = Math.abs(remSec);
      const ringColor =
        pct >= 100 ? '#ef4444' :
        pct >= 80  ? '#f97316' :
        pct >= 55  ? '#eab308' : '#22c55e';
      return { t, order, pct, remSec, overdue, absSec, ringColor };
    })
    .filter(Boolean) as { t: KitchenTiming; order: Order; pct: number; remSec: number; overdue: boolean; absSec: number; ringColor: string }[];

  if (cooking.length === 0) return null;

  const R = 28, circ = 2 * Math.PI * R;

  // Gleichzeitig-fertig-Warnung: ≥2 Bestellungen fertig innerhalb 90 Sekunden
  const simultaneous = (() => {
    if (cooking.length < 2) return null;
    const sorted = [...cooking].sort((a, b) => a.remSec - b.remSec);
    const groups: typeof cooking[] = [];
    let cur: typeof cooking = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      if (Math.abs(sorted[i].remSec - sorted[i - 1].remSec) <= 90) {
        cur.push(sorted[i]);
      } else {
        if (cur.length >= 2) groups.push(cur);
        cur = [sorted[i]];
      }
    }
    if (cur.length >= 2) groups.push(cur);
    return groups.length > 0 ? groups[0] : null;
  })();

  return (
    <div className="rounded-xl border border-matcha-200 bg-gradient-to-br from-matcha-50 to-white p-3">
      <div className="mb-2 flex items-center gap-2">
        <ChefHat className="h-4 w-4 text-matcha-700" />
        <span className="font-display text-xs font-bold uppercase tracking-wider text-matcha-800">
          Kochende Bestellungen · {cooking.length} Timer aktiv
        </span>
        <span className="ml-auto text-[9px] text-matcha-500 tabular-nums">
          {new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </div>
      {simultaneous && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 animate-pulse">
          <Zap className="h-3.5 w-3.5 text-amber-600 shrink-0" />
          <span className="text-[10px] font-bold text-amber-800">
            ⚡ {simultaneous.length} Bestellungen gleichzeitig fertig
            {simultaneous[0].remSec > 0
              ? ` in ~${Math.floor(simultaneous[0].remSec / 60)}:${String(simultaneous[0].remSec % 60).padStart(2, '0')} Min`
              : ' — jetzt bündeln!'}
          </span>
          <span className="ml-auto text-[9px] text-amber-600 font-semibold">→ Dispatch</span>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        {cooking.map(({ t, order, pct, overdue, absSec, ringColor }) => {
          const m = Math.floor(absSec / 60);
          const s = absSec % 60;
          const cardBg =
            pct >= 100 ? 'bg-red-50 border-red-300' :
            pct >= 80  ? 'bg-orange-50 border-orange-200' :
            pct >= 55  ? 'bg-amber-50 border-amber-200' :
            'bg-matcha-50 border-matcha-200';
          return (
            <div key={t.id} className={cn('flex items-center gap-3 rounded-xl border px-3 py-2 min-w-[200px]', cardBg)}>
              {/* SVG Ring */}
              <div className="relative h-16 w-16 shrink-0 flex items-center justify-center">
                <svg className="absolute inset-0 -rotate-90" width="64" height="64" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r={R} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="4" />
                  <circle
                    cx="32" cy="32" r={R} fill="none"
                    stroke={ringColor} strokeWidth="4" strokeLinecap="round"
                    strokeDasharray={String(circ)}
                    strokeDashoffset={String(circ * (1 - Math.min(1, pct / 100)))}
                    style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }}
                  />
                </svg>
                <div className="relative text-center leading-none">
                  <div className="font-mono text-sm font-black tabular-nums" style={{ color: ringColor }}>
                    {overdue ? '+' : ''}{m}:{String(s).padStart(2, '0')}
                  </div>
                  <div className="text-[8px] font-bold uppercase" style={{ color: ringColor }}>
                    {overdue ? 'OVER' : `${Math.round(pct)}%`}
                  </div>
                </div>
              </div>
              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[10px] text-muted-foreground">
                  #{order.bestellnummer.replace('FF-', '')}
                </div>
                <div className="font-display font-bold truncate text-sm leading-tight">{order.kunde_name}</div>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {order.typ === 'lieferung' && (
                    <span className="rounded-full bg-blue-100 text-blue-700 px-1.5 py-0.5 text-[8px] font-bold">
                      Lieferung
                    </span>
                  )}
                  {order.delivery_zone && (
                    <span className={cn(
                      'rounded-full px-1.5 py-0.5 text-[8px] font-bold',
                      order.delivery_zone === 'A' ? 'bg-green-100 text-green-800' :
                      order.delivery_zone === 'B' ? 'bg-blue-100 text-blue-800' :
                      order.delivery_zone === 'C' ? 'bg-orange-100 text-orange-800' :
                      'bg-red-100 text-red-800',
                    )}>
                      Zone {order.delivery_zone}
                    </span>
                  )}
                  {overdue && (
                    <span className="rounded-full bg-red-500 text-white px-1.5 py-0.5 text-[8px] font-black animate-pulse">
                      ÜBERZOGEN
                    </span>
                  )}
                </div>
                {t.ready_target && (
                  <div className="text-[9px] text-muted-foreground mt-0.5 tabular-nums">
                    Fertig ~{new Date(t.ready_target).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                  </div>
                )}
                <button
                  disabled={readyPending || markedReady.has(t.id)}
                  onClick={() => startReadyTransition(async () => {
                    const res = await markTimingReady(t.id);
                    if (res.ok) setMarkedReady((s) => new Set(s).add(t.id));
                  })}
                  className={cn(
                    'mt-1.5 w-full rounded-lg py-1 text-[10px] font-black transition-colors',
                    markedReady.has(t.id)
                      ? 'bg-green-200 text-green-800 cursor-default'
                      : overdue
                      ? 'bg-red-600 text-white hover:bg-red-700 active:scale-[0.98]'
                      : 'bg-matcha-600 text-white hover:bg-matcha-700 active:scale-[0.98]',
                  )}
                >
                  {markedReady.has(t.id) ? '✓ Fertig!' : readyPending ? '…' : '✓ Als fertig markieren'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ ScheduledCookCountdownGrid ------------------------------ */

function ScheduledCookCountdownGrid({ timings, orders }: { timings: KitchenTiming[]; orders: Order[] }) {
  const [, setTick] = useState(0);
  const [cookPending, startCookTransition] = useTransition();
  const [cookStarted, setCookStarted] = useState<Set<string>>(new Set());
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const AHEAD_WINDOW_SEC = 15 * 60; // 15-Minuten-Vorschauhorizont
  const now = Date.now();

  const upcoming = timings
    .filter((t) => t.status === 'scheduled' && t.cook_start_at)
    .map((t) => {
      const order = orders.find((o) => o.id === t.order_id);
      if (!order) return null;
      const cookStartMs = new Date(t.cook_start_at!).getTime();
      const secsToCook = Math.floor((cookStartMs - now) / 1000);
      if (secsToCook > AHEAD_WINDOW_SEC) return null; // außerhalb Vorschauhorizont
      const overdue = secsToCook < 0;
      const absSec = Math.abs(secsToCook);
      // Ring füllt sich je näher der Kochstart kommt: 0% = 15 Min vor, 100% = Kochstart
      const pct = Math.min(100, Math.max(0, Math.round(((AHEAD_WINDOW_SEC - Math.max(0, secsToCook)) / AHEAD_WINDOW_SEC) * 100)));
      const ringColor =
        overdue           ? '#ef4444' :
        secsToCook < 120  ? '#f97316' :
        secsToCook < 300  ? '#eab308' :
        '#3b82f6';
      return { t, order, secsToCook, overdue, absSec, pct, ringColor };
    })
    .filter(Boolean) as { t: KitchenTiming; order: Order; secsToCook: number; overdue: boolean; absSec: number; pct: number; ringColor: string }[];

  if (upcoming.length === 0) return null;

  const R = 28, circ = 2 * Math.PI * R;

  return (
    <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-3">
      <div className="mb-2 flex items-center gap-2">
        <Clock className="h-4 w-4 text-blue-700" />
        <span className="font-display text-xs font-bold uppercase tracking-wider text-blue-800">
          Geplante Kochstarts · {upcoming.length} in den nächsten 15 Min
        </span>
        <span className="ml-auto text-[9px] text-blue-400 tabular-nums">
          {new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </div>
      <div className="flex flex-wrap gap-3">
        {upcoming
          .sort((a, b) => a.secsToCook - b.secsToCook)
          .map(({ t, order, secsToCook, overdue, absSec, pct, ringColor }) => {
            const m = Math.floor(absSec / 60);
            const s = absSec % 60;
            const cardBg =
              overdue           ? 'bg-red-50 border-red-300' :
              secsToCook < 120  ? 'bg-orange-50 border-orange-300' :
              secsToCook < 300  ? 'bg-amber-50 border-amber-200' :
              'bg-blue-50 border-blue-200';
            return (
              <div
                key={t.id}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-3 py-2 min-w-[200px]',
                  cardBg,
                  overdue && 'animate-pulse',
                )}
              >
                {/* SVG Countdown-Ring */}
                <div className="relative h-16 w-16 shrink-0 flex items-center justify-center">
                  <svg className="absolute inset-0 -rotate-90" width="64" height="64" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r={R} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="4" />
                    <circle
                      cx="32" cy="32" r={R} fill="none"
                      stroke={ringColor} strokeWidth="4" strokeLinecap="round"
                      strokeDasharray={String(circ)}
                      strokeDashoffset={String(circ * (1 - pct / 100))}
                      style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }}
                    />
                  </svg>
                  <div className="relative text-center leading-none">
                    <div className="font-mono text-sm font-black tabular-nums" style={{ color: ringColor }}>
                      {overdue ? '+' : ''}{m}:{String(s).padStart(2, '0')}
                    </div>
                    <div className="text-[8px] font-bold uppercase" style={{ color: ringColor }}>
                      {overdue ? 'ÜBER' : 'START'}
                    </div>
                  </div>
                </div>
                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[10px] text-muted-foreground">
                    #{order.bestellnummer.replace('FF-', '')}
                  </div>
                  <div className="font-display font-bold truncate text-sm leading-tight">{order.kunde_name}</div>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {order.typ === 'lieferung' && (
                      <span className="rounded-full bg-blue-100 text-blue-700 px-1.5 py-0.5 text-[8px] font-bold">Lieferung</span>
                    )}
                    {t.prep_min && (
                      <span className="rounded-full bg-blue-100 text-blue-700 px-1.5 py-0.5 text-[8px] font-bold">
                        {t.prep_min} Min
                      </span>
                    )}
                  </div>
                  {t.ready_target && (
                    <div className="text-[9px] text-muted-foreground mt-0.5 tabular-nums">
                      Fertig ~{new Date(t.ready_target).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                    </div>
                  )}
                  <button
                    disabled={cookPending || cookStarted.has(t.id)}
                    onClick={() => startCookTransition(async () => {
                      const res = await startCookingNow(t.id);
                      if (res.ok) setCookStarted((s) => new Set(s).add(t.id));
                    })}
                    className={cn(
                      'mt-1.5 w-full rounded-lg py-1 text-[10px] font-black transition-colors',
                      cookStarted.has(t.id)
                        ? 'bg-green-200 text-green-800 cursor-default'
                        : overdue
                        ? 'bg-red-600 text-white hover:bg-red-700 active:scale-[0.98]'
                        : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]',
                    )}
                  >
                    {cookStarted.has(t.id) ? '✓ Kochen gestartet' : cookPending ? '…' : '🍳 Jetzt starten!'}
                  </button>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

/* ------------------------------ KitchenItemConsolidationPanel ------------------------------ */

function KitchenItemConsolidationPanel({ orders }: { orders: Order[] }) {
  const active = orders.filter((o) => ['bestätigt', 'in_zubereitung'].includes(o.status));
  if (active.length < 2) return null;

  const itemMap = new Map<string, { total: number; orders: { id: string; bestellnummer: string; menge: number }[] }>();
  for (const order of active) {
    for (const item of (order.items ?? [])) {
      const key = item.name;
      const entry = itemMap.get(key) ?? { total: 0, orders: [] };
      entry.total += item.menge;
      entry.orders.push({ id: order.id, bestellnummer: order.bestellnummer, menge: item.menge });
      itemMap.set(key, entry);
    }
  }

  const multi = [...itemMap.entries()]
    .filter(([, v]) => v.orders.length >= 2)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 8);

  if (multi.length === 0) return null;

  const maxTotal = multi[0][1].total;

  return (
    <div className="rounded-xl border border-matcha-200 bg-matcha-50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <ChefHat className="h-4 w-4 text-matcha-700" />
        <span className="font-display text-xs font-bold uppercase tracking-wider text-matcha-800">
          Parallelbatch · gleiche Items in mehreren Bestellungen
        </span>
        <span className="ml-auto text-[10px] text-matcha-500">{multi.length} Artikel kombinierbar</span>
      </div>
      <div className="space-y-2">
        {multi.map(([name, { total, orders: itemOrders }]) => {
          const pct = Math.round((total / maxTotal) * 100);
          const orderNums = itemOrders.map((o) => `#${o.bestellnummer.replace(/^[A-Z]+-/, '')}`).join(' · ');
          return (
            <div key={name} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-matcha-600 text-white flex items-center justify-center text-[10px] font-black shrink-0">
                {total}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-[11px] mb-0.5">
                  <span className="font-bold truncate">{name}</span>
                  <span className="text-matcha-500 shrink-0 ml-2 text-[9px]">{itemOrders.length} Best.</span>
                </div>
                <div className="h-1.5 rounded-full bg-matcha-200 overflow-hidden">
                  <div className="h-full rounded-full bg-matcha-500 transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="text-[9px] text-matcha-500 mt-0.5 truncate">{orderNums}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ KitchenActivityFeed ------------------------------ */

function KitchenActivityFeed({
  feed,
}: {
  feed: { id: string; bestellnummer: string; status: string; name: string; ts: number }[];
}) {
  if (feed.length === 0) return null;

  const statusMeta = (s: string): { icon: string; label: string; bg: string; text: string } => {
    switch (s) {
      case 'bestätigt':      return { icon: '✓', label: 'Angenommen',    bg: 'bg-blue-100',   text: 'text-blue-800' };
      case 'in_zubereitung': return { icon: '🍳', label: 'Kochen',       bg: 'bg-orange-100', text: 'text-orange-800' };
      case 'fertig':         return { icon: '📦', label: 'Fertig',        bg: 'bg-matcha-100', text: 'text-matcha-800' };
      case 'unterwegs':      return { icon: '🛵', label: 'Unterwegs',     bg: 'bg-violet-100', text: 'text-violet-800' };
      case 'geliefert':      return { icon: '🏠', label: 'Geliefert',     bg: 'bg-emerald-100', text: 'text-emerald-800' };
      case 'abgeholt':       return { icon: '✅', label: 'Abgeholt',      bg: 'bg-emerald-100', text: 'text-emerald-800' };
      case 'storniert':      return { icon: '✕', label: 'Storniert',     bg: 'bg-red-100',    text: 'text-red-800' };
      default:               return { icon: '→', label: s,               bg: 'bg-muted',      text: 'text-muted-foreground' };
    }
  };

  const relTime = (ts: number) => {
    const sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 5) return 'gerade';
    if (sec < 60) return `${sec}s`;
    return `${Math.floor(sec / 60)}m`;
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
        <TrendingUp className="h-3.5 w-3.5 text-matcha-600" />
        <span className="font-display text-[10px] font-bold uppercase tracking-wider">Echtzeit-Aktivität</span>
        <span className="ml-auto text-[9px] text-muted-foreground tabular-nums">
          {new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto p-3 scrollbar-hide">
        {feed.map((entry) => {
          const m = statusMeta(entry.status);
          return (
            <div
              key={`${entry.id}-${entry.ts}`}
              className={cn('shrink-0 flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[10px]', m.bg)}
            >
              <span className="text-base leading-none">{m.icon}</span>
              <div className="min-w-0">
                <div className={cn('font-bold truncate', m.text)}>
                  #{entry.bestellnummer.replace(/^[A-Z]+-/, '')}
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className={cn('font-semibold', m.text)}>{m.label}</span>
                  <span className="text-[8px] text-muted-foreground tabular-nums">{relTime(entry.ts)}</span>
                </div>
              </div>
            </div>
          );
        })}
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
/* ------------------------------ KitchenGanttStrip ------------------------------ */

function KitchenGanttStrip({ orders, timings }: { orders: Order[]; timings: KitchenTiming[] }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();
  const horizonMs = 30 * 60_000; // 30-Minuten-Fenster

  const active = orders
    .filter((o) => ['in_zubereitung', 'bestätigt'].includes(o.status) && o.bestellt_am)
    .map((o) => {
      const timing = timings.find((t) => t.order_id === o.id);
      const startMs = now;
      let finishMs: number;
      if (timing?.status === 'cooking' && timing.ready_target) {
        finishMs = new Date(timing.ready_target).getTime();
      } else {
        const elapsed = o.bestellt_am ? now - new Date(o.bestellt_am).getTime() : 0;
        const remaining = ((o.geschaetzte_zubereitung_min ?? 15) * 60_000) - elapsed;
        finishMs = now + Math.max(0, remaining);
      }
      const remSec = Math.floor((finishMs - now) / 1000);
      const pct = timing?.cook_start_at && timing.ready_target
        ? Math.min(100, Math.max(0, Math.round((now - new Date(timing.cook_start_at).getTime()) / (new Date(timing.ready_target).getTime() - new Date(timing.cook_start_at).getTime()) * 100)))
        : o.bestellt_am
          ? Math.min(100, Math.round(((now - new Date(o.bestellt_am).getTime()) / ((o.geschaetzte_zubereitung_min ?? 15) * 60_000)) * 100))
          : 0;
      const overdue = remSec < 0;
      const barLeft = 0;
      const barRight = Math.min(1, (finishMs - now) / horizonMs);
      return { o, timing, finishMs, remSec, pct, overdue, barLeft, barRight };
    })
    .sort((a, b) => a.finishMs - b.finishMs);

  if (active.length < 2) return null;

  const ticks = [0, 5, 10, 15, 20, 25, 30];

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        <Clock className="h-4 w-4 text-matcha-600" />
        <span className="font-display text-xs font-bold uppercase tracking-wider text-foreground">
          Zeitleiste · nächste 30 Min
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
          {new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Zeitachse */}
      <div className="relative mb-1 flex items-center pl-24 pr-2">
        {ticks.map((m) => (
          <div
            key={m}
            className="absolute text-[8px] tabular-nums text-muted-foreground/70"
            style={{ left: `calc(6rem + ${(m / 30) * (100 - 8)}%)` }}
          >
            {m === 0 ? 'jetzt' : `+${m}m`}
          </div>
        ))}
      </div>

      {/* Balken je Bestellung */}
      <div className="space-y-1.5 pt-3">
        {active.map(({ o, remSec, pct, overdue, barRight }) => {
          const barColor =
            overdue    ? 'bg-red-500'    :
            pct >= 80  ? 'bg-orange-400' :
            pct >= 55  ? 'bg-amber-400'  :
            o.status === 'in_zubereitung' ? 'bg-blue-400' : 'bg-matcha-400';
          const textColor =
            overdue    ? 'text-red-600'    :
            pct >= 80  ? 'text-orange-600' :
            pct >= 55  ? 'text-amber-600'  : 'text-matcha-700';
          const absSecLeft = Math.abs(remSec);
          const m = Math.floor(absSecLeft / 60);
          const s = absSecLeft % 60;
          const label = overdue
            ? `+${m}:${String(s).padStart(2, '0')}`
            : `${m}:${String(s).padStart(2, '0')}`;
          return (
            <div key={o.id} className="flex items-center gap-2">
              {/* Label */}
              <div className="w-24 shrink-0 text-right pr-1.5">
                <div className="text-[10px] font-bold truncate text-foreground leading-tight">
                  {o.kunde_name.split(' ')[0]}
                </div>
                <div className={cn('text-[9px] font-mono tabular-nums font-bold leading-tight', textColor)}>
                  {overdue ? '!' : ''}{label}
                </div>
              </div>
              {/* Track */}
              <div className="flex-1 h-5 relative rounded-full bg-muted overflow-hidden">
                {/* Progress fill (elapsed portion shown as faint overlay) */}
                <div
                  className={cn('absolute left-0 h-full rounded-full opacity-20', barColor)}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
                {/* Remaining bar from "now" to finish */}
                {!overdue && (
                  <div
                    className={cn('absolute left-0 top-0 h-full rounded-full transition-all', barColor, overdue && 'animate-pulse')}
                    style={{ width: `${Math.min(100, barRight * 100)}%` }}
                  />
                )}
                {overdue && (
                  <div className="absolute inset-0 bg-red-400 animate-pulse rounded-full" />
                )}
                {/* Status label inside bar */}
                <div className="absolute inset-0 flex items-center px-2">
                  <span className="text-[8px] font-bold text-white drop-shadow truncate">
                    {o.status === 'in_zubereitung' ? 'kocht' : 'angenommen'}
                    {o.typ === 'lieferung' ? ' · Lieferung' : ''}
                  </span>
                </div>
              </div>
              {/* Finish time */}
              <div className="w-10 shrink-0 text-[8px] tabular-nums text-muted-foreground text-right">
                {new Date(Date.now() + Math.max(0, remSec * 1000)).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legende */}
      <div className="mt-2 flex flex-wrap gap-2 text-[8px] text-muted-foreground border-t pt-2">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-400" />In Zubereitung</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-matcha-400" />Angenommen</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-400" />&gt;80% verbraucht</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" />Überzogen</span>
      </div>
    </div>
  );
}

function payLabel(z: string): string {
  switch (z) {
    case 'bar':    return 'Bar';
    case 'karte':  return 'Karte';
    case 'online': return 'Online';
    default:       return z;
  }
}

/* ------------------------------ KitchenStationFocusPanel ------------------------------ */

function KitchenStationFocusPanel({
  orders,
  station,
  onClose,
}: {
  orders: Order[];
  station: PrepStation;
  onClose: () => void;
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const meta = STATION_META[station];
  const now = Date.now();
  const active = orders.filter((o) => ['neu', 'bestätigt', 'in_zubereitung'].includes(o.status));

  // Aggregate items for this station across all active orders
  type ItemEntry = {
    name: string;
    totalMenge: number;
    notizen: string[];
    orders: { id: string; bestellnummer: string; menge: number; urgent: boolean; critical: boolean; waitMin: number }[];
    maxWaitMin: number;
  };

  const byItem = new Map<string, ItemEntry>();
  for (const o of active) {
    const waitMin = o.bestellt_am
      ? Math.floor((now - new Date(o.bestellt_am).getTime()) / 60_000)
      : 0;
    const est = o.geschaetzte_zubereitung_min ?? 15;
    const urgent = waitMin >= est;
    const critical = waitMin >= est + 10;
    for (const it of o.items ?? []) {
      if (classifyStation(it.name) !== station) continue;
      const key = it.name;
      if (!byItem.has(key)) byItem.set(key, { name: it.name, totalMenge: 0, notizen: [], orders: [], maxWaitMin: 0 });
      const entry = byItem.get(key)!;
      entry.totalMenge += it.menge;
      entry.maxWaitMin = Math.max(entry.maxWaitMin, waitMin);
      if (it.notiz) entry.notizen.push(it.notiz);
      entry.orders.push({ id: o.id, bestellnummer: o.bestellnummer, menge: it.menge, urgent, critical, waitMin });
    }
  }

  const entries = Array.from(byItem.values()).sort((a, b) => b.maxWaitMin - a.maxWaitMin);
  if (entries.length === 0) return null;

  const urgentCount = entries.filter((e) => e.orders.some((o) => o.urgent)).length;
  const checkedCount = checked.size;
  const allDone = checkedCount === entries.length && entries.length > 0;

  const borderCls =
    station === 'Grill'     ? 'border-orange-300 bg-orange-50' :
    station === 'Warm'      ? 'border-red-300 bg-red-50' :
    station === 'Kalt'      ? 'border-sky-300 bg-sky-50' :
    'border-matcha-300 bg-matcha-50';

  return (
    <div className={cn('rounded-xl border-2 p-4', borderCls)}>
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <span className={cn('h-3 w-3 rounded-full shrink-0', meta.dot)} />
        <span className={cn('font-display text-sm font-bold uppercase tracking-wider', meta.color)}>
          Station {meta.label} · {entries.length} Artikel · {entries.reduce((s, e) => s + e.totalMenge, 0)} Stück
        </span>
        {urgentCount > 0 && (
          <span className="rounded-full bg-red-500 text-white px-2 py-0.5 text-[9px] font-bold animate-pulse">
            {urgentCount} dringend
          </span>
        )}
        {checkedCount > 0 && (
          <span className="ml-1 rounded-full bg-matcha-600 text-white px-2 py-0.5 text-[9px] font-bold">
            {checkedCount}/{entries.length} ✓
          </span>
        )}
        <button
          onClick={onClose}
          className="ml-auto h-7 w-7 rounded-full bg-black/10 flex items-center justify-center hover:bg-black/20 transition shrink-0"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Item list */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((entry) => {
          const isChecked = checked.has(entry.name);
          const isUrgent = entry.orders.some((o) => o.urgent);
          const isCritical = entry.orders.some((o) => o.critical);
          const maxWait = entry.maxWaitMin;
          return (
            <button
              key={entry.name}
              onClick={() => setChecked((s) => {
                const n = new Set(s);
                n.has(entry.name) ? n.delete(entry.name) : n.add(entry.name);
                return n;
              })}
              className={cn(
                'flex items-start gap-3 rounded-xl px-3 py-2.5 text-left transition active:scale-[0.98] border',
                isChecked
                  ? 'bg-matcha-700/15 border-matcha-400/30 opacity-60'
                  : isCritical
                    ? 'bg-red-500/10 border-red-300/70'
                    : isUrgent
                      ? 'bg-orange-500/10 border-orange-300/60'
                      : 'bg-white/70 border-black/8',
              )}
            >
              {/* Count badge */}
              <div className={cn(
                'h-10 w-10 rounded-xl grid place-items-center font-display font-black text-xl shrink-0 leading-none',
                isChecked
                  ? 'bg-matcha-500 text-white'
                  : isCritical
                    ? 'bg-red-500 text-white'
                    : isUrgent
                      ? 'bg-orange-500 text-white'
                      : 'bg-white text-foreground border border-black/10',
              )}>
                {isChecked ? <Check className="h-5 w-5" /> : entry.totalMenge}
              </div>

              <div className="flex-1 min-w-0">
                <div className={cn(
                  'font-bold text-sm leading-tight',
                  isChecked && 'line-through opacity-50',
                )}>
                  {entry.name}
                </div>
                {/* Per-order chips */}
                <div className="mt-1 flex flex-wrap gap-1">
                  {entry.orders.map((o, i) => (
                    <span key={i} className={cn(
                      'text-[9px] font-bold rounded-full px-1.5 py-0.5 tabular-nums',
                      o.critical ? 'bg-red-100 text-red-700' :
                      o.urgent   ? 'bg-orange-100 text-orange-700' :
                                   'bg-black/8 text-foreground/60',
                    )}>
                      #{o.bestellnummer.replace('FF-', '')} ×{o.menge}
                      {o.urgent && <span className="ml-0.5 text-[8px]">({o.waitMin}m)</span>}
                    </span>
                  ))}
                </div>
                {/* Notizen */}
                {entry.notizen.length > 0 && !isChecked && (
                  <div className="mt-1 text-[10px] italic text-orange-700 leading-tight">
                    „{entry.notizen[0]}"
                    {entry.notizen.length > 1 && <span className="text-muted-foreground"> +{entry.notizen.length - 1}</span>}
                  </div>
                )}
              </div>

              {/* Wait time */}
              {!isChecked && (
                <div className={cn(
                  'text-[10px] font-bold tabular-nums shrink-0 self-start mt-1',
                  isCritical ? 'text-red-600' : isUrgent ? 'text-orange-600' : 'text-muted-foreground',
                )}>
                  {maxWait}m
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* All done banner */}
      {allDone && (
        <div className="mt-3 rounded-xl bg-matcha-700/20 border border-matcha-400/40 px-4 py-3 flex items-center gap-3">
          <span className="text-2xl">🎉</span>
          <div>
            <div className="font-display font-bold text-matcha-800 text-sm">Alle Artikel dieser Station fertig!</div>
            <div className="text-[11px] text-matcha-600">Station {meta.label} abgehakt</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ BatchOptimizationHint ------------------------------ */

/**
 * Zeigt Zonen mit mehreren Lieferbestellungen, die innerhalb von 5 Minuten
 * gleichzeitig fertig sein werden — hilft Küche beim optimalen Batchversand.
 */
function BatchOptimizationHint({ orders }: { orders: Order[] }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();
  const BATCH_WINDOW_MS = 5 * 60_000; // 5-Minuten-Fenster

  // Schätze Fertigzeit für jede kochende/bestätigte Lieferbestellung
  const upcoming = orders
    .filter((o) => o.typ === 'lieferung' && ['bestätigt', 'in_zubereitung', 'fertig'].includes(o.status) && o.delivery_zone)
    .map((o) => {
      const base = o.bestellt_am ? new Date(o.bestellt_am).getTime() : now;
      const readyMs = o.status === 'fertig'
        ? (o.fertig_am ? new Date(o.fertig_am).getTime() : now)
        : base + (o.geschaetzte_zubereitung_min ?? 15) * 60_000;
      const minUntilReady = Math.floor((readyMs - now) / 60_000);
      return { order: o, readyMs, minUntilReady };
    });

  // Gruppiere nach Zone, finde Zonen mit ≥2 Bestellungen im selben 5-Min-Fenster
  const byZone = new Map<string, typeof upcoming>();
  for (const item of upcoming) {
    const z = item.order.delivery_zone!;
    if (!byZone.has(z)) byZone.set(z, []);
    byZone.get(z)!.push(item);
  }

  const batchOpportunities: { zone: string; items: typeof upcoming; windowMin: number; earliest: number; latest: number }[] = [];
  for (const [zone, items] of byZone) {
    if (items.length < 2) continue;
    const sorted = [...items].sort((a, b) => a.readyMs - b.readyMs);
    // Prüfe ob früheste und späteste Fertigzeit innerhalb BATCH_WINDOW_MS
    const earliest = sorted[0].readyMs;
    const latest = sorted[sorted.length - 1].readyMs;
    if (latest - earliest <= BATCH_WINDOW_MS) {
      const windowMin = Math.floor((latest - earliest) / 60_000);
      batchOpportunities.push({ zone, items: sorted, windowMin, earliest, latest });
    }
  }

  if (batchOpportunities.length === 0) return null;

  const ZONE_COLORS: Record<string, string> = {
    A: 'bg-green-100 text-green-800 border-green-300',
    B: 'bg-blue-100 text-blue-800 border-blue-300',
    C: 'bg-orange-100 text-orange-800 border-orange-300',
    D: 'bg-red-100 text-red-800 border-red-300',
  };

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Target className="h-4 w-4 text-amber-700" />
        <span className="font-display text-xs font-bold uppercase tracking-wider text-amber-800">
          Batch-Potenzial · {batchOpportunities.length} Zone{batchOpportunities.length !== 1 ? 'n' : ''} bündelbar
        </span>
        <span className="ml-auto text-[10px] text-amber-600">In 5-Min-Fenster</span>
      </div>
      <div className="space-y-2">
        {batchOpportunities.map(({ zone, items, windowMin, earliest }) => {
          const zCls = ZONE_COLORS[zone] ?? 'bg-muted text-muted-foreground border-border';
          const allReady = items.every((i) => i.order.status === 'fertig');
          const firstReadyStr = new Date(earliest).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
          return (
            <div key={zone} className={cn('flex items-start gap-2 rounded-lg border px-3 py-2 text-xs', allReady ? 'border-matcha-300 bg-matcha-50' : 'border-amber-200 bg-white')}>
              <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-black shrink-0', zCls)}>Zone {zone}</span>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap gap-1 mb-1">
                  {items.map(({ order, minUntilReady }) => (
                    <span
                      key={order.id}
                      className={cn(
                        'rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums',
                        order.status === 'fertig' ? 'bg-matcha-200 text-matcha-800' :
                        minUntilReady <= 2 ? 'bg-orange-200 text-orange-800 animate-pulse' :
                        'bg-amber-100 text-amber-800',
                      )}
                    >
                      #{order.bestellnummer.replace(/^[A-Z]+-/, '')}
                      {order.status === 'fertig' ? ' ✓' : ` ~${minUntilReady}m`}
                    </span>
                  ))}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {allReady
                    ? `Alle ${items.length} bereit — jetzt bündeln!`
                    : windowMin === 0
                    ? `Gleichzeitig fertig ~${firstReadyStr}`
                    : `Fertig innerhalb ${windowMin} Min · ab ~${firstReadyStr}`}
                </div>
              </div>
              {allReady && (
                <a
                  href="/dispatch"
                  className="shrink-0 rounded-lg bg-matcha-700 text-white px-2 py-1 text-[10px] font-bold hover:bg-matcha-800 transition"
                >
                  Dispatch →
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ KitchenQueuePressureMeter ------------------------------ */

function KitchenQueuePressureMeter({ orders }: { orders: Order[] }) {
  const [history, setHistory] = useState<{ ts: number; depth: number }[]>([]);
  const now = Date.now();

  const active = orders.filter((o) =>
    ['neu', 'bestätigt', 'in_zubereitung'].includes(o.status),
  );
  const depth = active.length;

  // Track depth over time for trend detection
  useEffect(() => {
    setHistory((prev) => {
      const next = [...prev, { ts: now, depth }].filter((p) => now - p.ts < 10 * 60_000);
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depth]);

  if (depth === 0) return null;

  // Trend: compare now with 3 min ago
  const oldEntry = history.find((h) => now - h.ts >= 2.5 * 60_000);
  const trend: 'up' | 'down' | 'stable' = oldEntry == null
    ? 'stable'
    : depth > oldEntry.depth ? 'up' : depth < oldEntry.depth ? 'down' : 'stable';

  // Clearance estimate: avg prep time remaining
  const avgEstMin = (() => {
    const withEst = active.filter((o) => o.geschaetzte_zubereitung_min);
    if (withEst.length === 0) return 15;
    const remaining = withEst.map((o) => {
      const elapsed = o.bestellt_am ? Math.floor((now - new Date(o.bestellt_am).getTime()) / 60_000) : 0;
      return Math.max(0, (o.geschaetzte_zubereitung_min ?? 15) - elapsed);
    });
    return Math.round(remaining.reduce((a, b) => a + b, 0) / remaining.length);
  })();

  // Pressure level
  const pressure: 'low' | 'medium' | 'high' | 'critical' =
    depth >= 8 ? 'critical' : depth >= 5 ? 'high' : depth >= 3 ? 'medium' : 'low';

  const pressureMeta = {
    low:      { label: 'Niedrig',  bar: 'bg-matcha-400', text: 'text-matcha-700', bg: 'bg-matcha-50 border-matcha-200',   pct: 20 },
    medium:   { label: 'Mittel',   bar: 'bg-amber-400',  text: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200',     pct: 45 },
    high:     { label: 'Hoch',     bar: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50 border-orange-200',   pct: 70 },
    critical: { label: 'Kritisch', bar: 'bg-red-500',    text: 'text-red-700',    bg: 'bg-red-50 border-red-200',         pct: 95 },
  }[pressure];

  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
  const trendCls  = trend === 'up' ? 'text-red-600' : trend === 'down' ? 'text-matcha-600' : 'text-muted-foreground';

  return (
    <div className={cn('rounded-xl border px-4 py-3', pressureMeta.bg)}>
      <div className="flex items-center gap-2 mb-2">
        <Flame className={cn('h-4 w-4', pressureMeta.text)} />
        <span className="font-display text-xs font-bold uppercase tracking-wider">Warteschlangen-Druck</span>
        <span className={cn('ml-auto text-xs font-black tabular-nums', pressureMeta.text)}>
          {depth} Bestellung{depth !== 1 ? 'en' : ''}
        </span>
        <span className={cn('text-xs font-bold', trendCls)} title="Trend letzte 3 Min">
          {trendIcon}
        </span>
      </div>

      {/* Pressure bar */}
      <div className="h-2 rounded-full bg-muted overflow-hidden mb-3">
        <div
          className={cn('h-full rounded-full transition-all duration-700', pressureMeta.bar)}
          style={{ width: `${pressureMeta.pct}%` }}
        />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 text-[10px]">
        <div className="text-center">
          <div className={cn('text-base font-black tabular-nums leading-none', pressureMeta.text)}>{depth}</div>
          <div className="text-muted-foreground mt-0.5">In Bearbeitung</div>
        </div>
        <div className="text-center border-x border-border">
          <div className={cn('text-base font-black tabular-nums leading-none', pressureMeta.text)}>
            {avgEstMin > 0 ? `${avgEstMin}m` : '—'}
          </div>
          <div className="text-muted-foreground mt-0.5">Ø Restzeit</div>
        </div>
        <div className="text-center">
          <div className={cn('text-base font-black leading-none', pressureMeta.text)}>{pressureMeta.label}</div>
          <div className="text-muted-foreground mt-0.5">Druckstufe</div>
        </div>
      </div>

      {pressure === 'critical' && (
        <div className="mt-2 text-center text-[10px] font-bold text-red-700 animate-pulse">
          ⚠ Hohe Auslastung — Prioritäten setzen!
        </div>
      )}
    </div>
  );
}

/* ------------------------------ KitchenUpcomingPickupStrip ------------------------------ */

function KitchenUpcomingPickupStrip({
  batches, drivers, stops, orders,
}: {
  batches: Batch[];
  drivers: Driver[];
  stops: Stop[];
  orders: Order[];
}) {
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();

  // Upcoming pickups: batches currently unterwegs that will return within 30 min
  type PickupEntry = { batch: Batch; etaMs: number; secLeft: number; batchOrders: Order[]; driver: Driver | undefined };
  const upcoming: PickupEntry[] = batches
    .filter((b) => b.status === 'unterwegs' || b.status === 'on_route')
    .flatMap((b) => {
      const etaMs = b.started_at && b.total_eta_min != null
        ? new Date(b.started_at).getTime() + b.total_eta_min * 60_000
        : null;
      if (!etaMs) return [];
      const secLeft = Math.floor((etaMs - now) / 1000);
      if (secLeft > 25 * 60 || secLeft < -3 * 60) return [];
      const batchStops = stops
        .filter((s) => s.batch_id === b.id && !s.geliefert_am)
        .sort((a, c) => a.reihenfolge - c.reihenfolge);
      const batchOrders = batchStops
        .map((s) => orders.find((o) => o.id === s.order_id))
        .filter((o): o is Order => o != null);
      const driver = drivers.find((d) => d.id === b.driver_id);
      return [{ batch: b, etaMs, secLeft, batchOrders, driver }];
    })
    .sort((a, b) => a.secLeft - b.secLeft);

  if (upcoming.length === 0) return null;

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Bike className="h-3.5 w-3.5 text-blue-600 shrink-0" />
        <span className="font-display text-xs font-black uppercase tracking-wider text-blue-800">
          Nächste Abholungen
        </span>
        <span className="text-[9px] font-bold text-blue-400 ml-auto">
          {upcoming.length} Fahrer kommen
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {upcoming.map(({ batch, etaMs: batchEtaMs, secLeft, batchOrders, driver }) => {
          const name = driver ? `${driver.vorname.charAt(0)}. ${driver.nachname}` : 'Fahrer';
          const overdue = secLeft < 0;
          const imminent = !overdue && secLeft < 5 * 60;
          const minLeft = Math.abs(Math.floor(secLeft / 60));
          const arrivalStr = new Date(batchEtaMs).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
          // Check if all orders for this pickup are ready
          const allReady = batchOrders.every((o) => o.status === 'fertig');
          const notReadyCount = batchOrders.filter((o) => o.status !== 'fertig').length;

          return (
            <div
              key={batch.id}
              className={cn(
                'rounded-lg border px-3 py-2 flex items-start gap-2 min-w-0',
                overdue   ? 'border-red-300 bg-red-50'    :
                imminent  ? 'border-orange-300 bg-orange-50' :
                allReady  ? 'border-matcha-300 bg-matcha-50' :
                'border-blue-200 bg-white',
              )}
            >
              <div className="shrink-0">
                <div className={cn(
                  'font-display text-sm font-black tabular-nums leading-tight',
                  overdue ? 'text-red-600' : imminent ? 'text-orange-600' : 'text-blue-700',
                )}>
                  {overdue ? `+${minLeft}m` : imminent ? `~${minLeft}m` : arrivalStr}
                </div>
                <div className="text-[9px] text-muted-foreground">{name}</div>
              </div>
              <div className="min-w-0 flex-1">
                {batchOrders.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {batchOrders.map((o) => (
                      <span
                        key={o.id}
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[9px] font-bold',
                          o.status === 'fertig'   ? 'bg-matcha-100 text-matcha-700' :
                          o.status === 'in_zubereitung' ? 'bg-orange-100 text-orange-700' :
                          'bg-amber-100 text-amber-700',
                        )}
                        title={o.kunde_name}
                      >
                        #{o.bestellnummer.replace('FF-', '')} {o.status === 'fertig' ? '✓' : '…'}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-[9px] text-muted-foreground italic">Alle geliefert</span>
                )}
                {notReadyCount > 0 && (
                  <div className="text-[9px] font-bold text-orange-600 mt-0.5">
                    ⚠ {notReadyCount} noch nicht fertig
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ KitchenDriverAtRestaurantAlert ------------------------------ */

function KitchenDriverAtRestaurantAlert({
  batches, drivers, stops, orders,
}: {
  batches: Batch[];
  drivers: Driver[];
  stops: Stop[];
  orders: Order[];
}) {
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 5_000);
    return () => clearInterval(t);
  }, []);

  const atRestaurant = batches.filter((b) => b.status === 'at_restaurant');
  if (atRestaurant.length === 0) return null;

  return (
    <div className="rounded-xl border-2 border-matcha-500 bg-matcha-50 p-3 ring-2 ring-matcha-400/30">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className="relative flex h-3 w-3 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-matcha-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-matcha-500" />
        </span>
        <span className="font-display text-xs font-black uppercase tracking-wider text-matcha-800">
          {atRestaurant.length === 1 ? 'Fahrer am Restaurant!' : `${atRestaurant.length} Fahrer am Restaurant!`}
        </span>
        <span className="ml-auto text-[10px] text-matcha-600 font-semibold animate-pulse">
          ⚡ Bestellungen bereitstellen!
        </span>
      </div>

      {/* Per-driver pickup checklist */}
      <div className="space-y-2">
        {atRestaurant.map((b) => {
          const driver = drivers.find((d) => d.id === b.driver_id);
          const name = driver ? `${driver.vorname} ${driver.nachname}` : 'Fahrer';
          const batchStops = stops
            .filter((s) => s.batch_id === b.id && !s.geliefert_am)
            .sort((a, c) => a.reihenfolge - c.reihenfolge);
          const batchOrders = batchStops
            .map((s) => orders.find((o) => o.id === s.order_id))
            .filter(Boolean) as Order[];

          return (
            <div key={b.id} className="rounded-lg bg-white border border-matcha-200 p-2.5">
              <div className="flex items-center gap-2 mb-2">
                <Bike className="h-3.5 w-3.5 text-matcha-700 shrink-0" />
                <span className="font-display text-[11px] font-black text-matcha-800">{name}</span>
                <span className="ml-auto text-[9px] font-bold text-matcha-500 bg-matcha-100 rounded-full px-2 py-0.5">
                  {batchOrders.length} Bestellungen
                </span>
              </div>
              {batchOrders.length > 0 ? (
                <div className="space-y-1">
                  {batchOrders.map((o) => {
                    const isReady = o.status === 'fertig';
                    const waitMin = o.fertig_am
                      ? Math.floor((Date.now() - new Date(o.fertig_am).getTime()) / 60_000)
                      : null;
                    return (
                      <div
                        key={o.id}
                        className={cn(
                          'flex items-center gap-2 rounded-md px-2 py-1.5 text-[10px]',
                          isReady ? 'bg-matcha-50 border border-matcha-300' : 'bg-orange-50 border border-orange-200',
                        )}
                      >
                        <span className={cn(
                          'h-4 w-4 rounded-full flex items-center justify-center text-[8px] font-black shrink-0',
                          isReady ? 'bg-matcha-600 text-white' : 'bg-orange-500 text-white',
                        )}>
                          {isReady ? '✓' : '!'}
                        </span>
                        <span className="font-mono font-bold text-matcha-700 shrink-0">
                          #{o.bestellnummer.replace('FF-', '')}
                        </span>
                        <span className="text-muted-foreground truncate flex-1">{o.kunde_name}</span>
                        {!isReady && (
                          <span className="shrink-0 font-bold text-orange-600">Noch nicht fertig!</span>
                        )}
                        {isReady && waitMin !== null && waitMin > 0 && (
                          <span className={cn(
                            'shrink-0 font-bold tabular-nums',
                            waitMin >= 10 ? 'text-red-600' : 'text-amber-600',
                          )}>
                            {waitMin} Min
                          </span>
                        )}
                        {o.delivery_zone && (
                          <span className="shrink-0 rounded px-1 py-0.5 bg-matcha-100 text-matcha-700 text-[8px] font-black">
                            Z{o.delivery_zone}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-[10px] text-muted-foreground italic">Keine offenen Stops gefunden</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ QueueSignalControl ------------------------------ */

type QueueSignal = {
  signal_type: 'normal' | 'extended' | 'paused';
  eta_extension_min: number | null;
  message_de: string | null;
  expires_at: string | null;
  trigger_source: string | null;
  created_at: string;
};

function QueueSignalControl({ locationId }: { locationId: string | null }) {
  const [signal, setSignal] = useState<QueueSignal | null>(null);
  const [history, setHistory] = useState<QueueSignal[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [extMin, setExtMin] = useState(15);

  async function load() {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch('/api/delivery/admin/queue-signal?action=status');
      if (!r.ok) return;
      const d = await r.json() as { signal: QueueSignal; history: QueueSignal[] };
      setSignal(d.signal ?? null);
      setHistory(d.history ?? []);
    } catch {} finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!locationId) return;
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  async function setSignalType(type: 'normal' | 'extended' | 'paused', etaMin?: number) {
    setActionPending(true);
    try {
      if (type === 'normal') {
        await fetch('/api/delivery/admin/queue-signal', { method: 'DELETE' });
      } else {
        await fetch('/api/delivery/admin/queue-signal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            signal_type: type,
            eta_extension_min: etaMin ?? null,
            message_de: type === 'paused'
              ? 'Küche überlastet — Bestellungen kurz pausiert'
              : `ETA um ${etaMin} Min verlängert`,
          }),
        });
      }
      await load();
    } catch {} finally {
      setActionPending(false);
    }
  }

  if (!locationId) return null;

  const isNormal = !signal || signal.signal_type === 'normal';
  const isPaused = signal?.signal_type === 'paused';
  const isExtended = signal?.signal_type === 'extended';

  const statusBg = isPaused
    ? 'border-red-300 bg-red-50'
    : isExtended
    ? 'border-amber-300 bg-amber-50'
    : 'border-matcha-200 bg-matcha-50';

  const statusDot = isPaused ? 'bg-red-500 animate-pulse' : isExtended ? 'bg-amber-500' : 'bg-matcha-500';

  const statusLabel = isPaused
    ? 'Pausiert — keine neuen Bestellungen'
    : isExtended
    ? `ETA +${signal?.eta_extension_min ?? '?'} Min verlängert`
    : 'Normal — Bestellungen fließen';

  return (
    <Card className={cn('overflow-hidden border-2', statusBg)}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:opacity-80 transition"
      >
        <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', statusDot)} />
        <span className="font-display text-sm font-bold">
          {isPaused ? '⏸ Bestellfluss pausiert!' : isExtended ? '⏱ ETA verlängert' : 'Bestellfluss-Steuerung'}
        </span>
        <span className={cn('text-xs font-semibold', isPaused ? 'text-red-700' : isExtended ? 'text-amber-700' : 'text-matcha-700')}>
          {statusLabel}
        </span>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        {expanded
          ? <ChevronUp size={14} className="ml-auto text-muted-foreground shrink-0" />
          : <ChevronDown size={14} className="ml-auto text-muted-foreground shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t">
          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-3">
            <button
              onClick={() => setSignalType('normal')}
              disabled={actionPending || isNormal}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold transition border',
                isNormal
                  ? 'bg-matcha-100 border-matcha-400 text-matcha-800 cursor-default'
                  : 'bg-white border-matcha-300 text-matcha-700 hover:bg-matcha-50 disabled:opacity-50',
              )}
            >
              <Play size={13} />
              Normal
            </button>

            {/* ETA-Verlängerung */}
            <div className="flex items-center gap-1">
              <select
                value={extMin}
                onChange={(e) => setExtMin(Number(e.target.value))}
                className="h-8 rounded-l-lg border border-amber-300 bg-white px-2 text-sm text-amber-800 font-bold"
              >
                {[10, 15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>+{m} Min</option>)}
              </select>
              <button
                onClick={() => setSignalType('extended', extMin)}
                disabled={actionPending}
                className="inline-flex items-center gap-1.5 h-8 rounded-r-lg border-y border-r border-amber-300 bg-amber-50 px-3 text-sm font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-50 transition"
              >
                <Clock size={12} />
                ETA verlängern
              </button>
            </div>

            <button
              onClick={() => { if (confirm('Bestellfluss pausieren? Keine neuen Lieferbestellungen werden angenommen!')) setSignalType('paused'); }}
              disabled={actionPending || isPaused}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold transition border',
                isPaused
                  ? 'bg-red-100 border-red-400 text-red-800 cursor-default'
                  : 'bg-white border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50',
              )}
            >
              <Pause size={13} />
              {isPaused ? 'Pausiert ✓' : 'Pausieren'}
            </button>
          </div>

          {/* Signal history */}
          {history.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-1.5">
                Letzte Signale
              </div>
              <div className="space-y-1">
                {history.slice(0, 5).map((h, i) => {
                  const t = new Date(h.created_at);
                  const timeStr = `${t.getHours().toString().padStart(2, '0')}:${t.getMinutes().toString().padStart(2, '0')}`;
                  const dotCls = h.signal_type === 'paused' ? 'bg-red-400' : h.signal_type === 'extended' ? 'bg-amber-400' : 'bg-matcha-400';
                  return (
                    <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', dotCls)} />
                      <span className="tabular-nums text-[11px]">{timeStr}</span>
                      <span className="font-semibold text-foreground">
                        {h.signal_type === 'paused' ? 'Pausiert' : h.signal_type === 'extended' ? `ETA +${h.eta_extension_min}m` : 'Normal'}
                      </span>
                      {h.trigger_source && (
                        <span className="text-[10px] text-muted-foreground opacity-70">({h.trigger_source})</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/* ------------------------------ KitchenHandoffMatrix ------------------------------ */

function KitchenHandoffMatrix({
  batches, drivers, stops, orders, timings,
}: {
  batches: Batch[];
  drivers: Driver[];
  stops: Stop[];
  orders: Order[];
  timings: KitchenTiming[];
}) {
  const [, setTick] = React.useState(0);
  const [startedIds, setStartedIds] = React.useState<Set<string>>(new Set());
  const [startPending, startTransition] = React.useTransition();
  React.useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();

  // Only batches that are en-route and returning within 30 min
  type Row = {
    batch: Batch;
    driver: Driver | undefined;
    arrivalMs: number;
    secLeft: number;
    entries: Array<{
      order: Order;
      timing: KitchenTiming | undefined;
      readyMs: number | null;
      gapSec: number | null; // positive = food ready before driver; negative = driver arrives early
    }>;
  };

  const rows: Row[] = batches
    .filter((b) => b.status === 'unterwegs' || b.status === 'on_route' || b.status === 'assigned' || b.status === 'pickup')
    .flatMap((b) => {
      const etaMs = b.started_at && b.total_eta_min != null
        ? new Date(b.started_at).getTime() + b.total_eta_min * 60_000
        : null;
      if (!etaMs) return [];
      const secLeft = Math.floor((etaMs - now) / 1000);
      if (secLeft > 30 * 60 || secLeft < -5 * 60) return [];

      const batchStops = stops
        .filter((s) => s.batch_id === b.id && !s.geliefert_am)
        .sort((a, c) => a.reihenfolge - c.reihenfolge);

      const entries = batchStops
        .map((s) => {
          const order = orders.find((o) => o.id === s.order_id);
          if (!order) return null;
          const timing = timings.find((t) => t.order_id === order.id);
          const readyMs = timing?.ready_target ? new Date(timing.ready_target).getTime() : null;
          // gap: how many seconds food will be ready BEFORE driver arrives
          const gapSec = readyMs != null ? Math.floor((etaMs - readyMs) / 1000) : null;
          return { order, timing, readyMs, gapSec };
        })
        .filter((e): e is NonNullable<typeof e> => e !== null);

      if (entries.length === 0) return [];
      const driver = drivers.find((d) => d.id === b.driver_id);
      return [{ batch: b, driver, arrivalMs: etaMs, secLeft, entries }];
    })
    .sort((a, b) => a.secLeft - b.secLeft);

  // Only show if there's at least one entry with timing data
  const hasTimingData = rows.some((r) => r.entries.some((e) => e.timing));
  if (rows.length === 0 || !hasTimingData) return null;

  // Count conflicts (driver arrives before food ready)
  const conflicts = rows.flatMap((r) => r.entries.filter((e) => e.gapSec !== null && e.gapSec < 0));

  return (
    <div className={cn(
      'rounded-xl border p-3',
      conflicts.length > 0 ? 'border-red-300 bg-red-50' : 'border-matcha-200 bg-matcha-50',
    )}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-2.5">
        <Target className="h-3.5 w-3.5 text-matcha-700 shrink-0" />
        <span className="font-display text-xs font-black uppercase tracking-wider text-matcha-800">
          Handoff-Matrix
        </span>
        {conflicts.length > 0 && (
          <span className="ml-1 rounded-full bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 animate-pulse">
            {conflicts.length} Konflikt{conflicts.length !== 1 ? 'e' : ''}
          </span>
        )}
        <span className="ml-auto text-[9px] text-matcha-500 font-semibold">
          Ready-Target vs. Ankunft
        </span>
      </div>

      {/* Rows */}
      <div className="space-y-2">
        {rows.map(({ batch, driver, arrivalMs, secLeft, entries }) => {
          const overdue = secLeft < 0;
          const imminent = !overdue && secLeft < 5 * 60;
          const minLeft = Math.abs(Math.floor(secLeft / 60));
          const arrivalStr = new Date(arrivalMs).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
          const driverName = driver ? `${driver.vorname.charAt(0)}. ${driver.nachname}` : 'Fahrer';

          return (
            <div key={batch.id} className="rounded-lg bg-white border border-matcha-100 p-2">
              {/* Row header: driver + ETA */}
              <div className="flex items-center gap-2 mb-1.5">
                <div className={cn(
                  'h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0',
                  overdue ? 'bg-red-500' : imminent ? 'bg-orange-500' : 'bg-matcha-600',
                )}>
                  {driverName.charAt(0)}
                </div>
                <span className="text-[11px] font-bold text-matcha-800">{driverName}</span>
                <span className={cn(
                  'ml-auto text-[11px] font-black tabular-nums',
                  overdue ? 'text-red-600' : imminent ? 'text-orange-600' : 'text-matcha-700',
                )}>
                  {overdue ? `+${minLeft}m überfällig` : imminent ? `~${minLeft} Min` : arrivalStr}
                </span>
              </div>

              {/* Order cells */}
              <div className="flex flex-wrap gap-1.5">
                {entries.map(({ order, timing, readyMs, gapSec }) => {
                  const conflict = gapSec !== null && gapSec < 0; // driver arrives before food ready
                  const ahead   = gapSec !== null && gapSec >= 0; // food ready before driver
                  const noTiming = !timing;

                  const readyStr = readyMs
                    ? new Date(readyMs).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
                    : null;

                  const gapMinAbs = gapSec !== null ? Math.abs(Math.floor(gapSec / 60)) : null;

                  return (
                    <div
                      key={order.id}
                      className={cn(
                        'rounded-lg border px-2 py-1.5 min-w-[72px] text-center',
                        conflict  ? 'border-red-300 bg-red-50'     :
                        ahead     ? 'border-matcha-300 bg-matcha-50' :
                        noTiming  ? 'border-dashed border-muted bg-muted/30' :
                        'border-amber-200 bg-amber-50',
                      )}
                    >
                      {/* Order number */}
                      <div className="text-[10px] font-black text-matcha-800 tabular-nums">
                        #{order.bestellnummer.replace('FF-', '')}
                      </div>

                      {/* Ready time */}
                      {readyStr ? (
                        <div className="text-[9px] tabular-nums text-muted-foreground mt-0.5">{readyStr}</div>
                      ) : (
                        <div className="text-[9px] text-muted-foreground italic mt-0.5">kein Timing</div>
                      )}

                      {/* Gap indicator */}
                      {gapMinAbs !== null && (
                        <div className={cn(
                          'text-[9px] font-black mt-0.5 tabular-nums',
                          conflict ? 'text-red-600' : 'text-matcha-600',
                        )}>
                          {conflict
                            ? `⚠ ${gapMinAbs}m zu früh`
                            : gapMinAbs === 0
                            ? '✓ pünktlich'
                            : `✓ +${gapMinAbs}m`}
                        </div>
                      )}

                      {/* Status dot */}
                      {timing && (
                        <div className={cn(
                          'mt-1 h-1 w-full rounded-full',
                          timing.status === 'ready'     ? 'bg-matcha-500' :
                          timing.status === 'cooking'   ? 'bg-orange-400' :
                          timing.status === 'scheduled' ? 'bg-blue-300'   :
                          'bg-muted',
                        )} />
                      )}

                      {/* Inline "Kochen starten" for conflict + scheduled timing */}
                      {conflict && timing && timing.status === 'scheduled' && !startedIds.has(timing.id) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startTransition(async () => {
                              await startCookingNow(timing.id);
                              setStartedIds((s) => new Set([...s, timing.id]));
                            });
                          }}
                          disabled={startPending}
                          className="mt-1.5 w-full rounded bg-red-600 text-white text-[8px] font-black py-0.5 hover:bg-red-700 active:scale-95 transition"
                        >
                          Kochen!
                        </button>
                      )}
                      {conflict && timing && timing.status === 'scheduled' && startedIds.has(timing.id) && (
                        <div className="mt-1.5 w-full rounded bg-matcha-500 text-white text-[8px] font-black py-0.5 text-center">
                          ✓ Start
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 mt-2.5 pt-2 border-t border-matcha-100">
        {[
          { cls: 'bg-red-500', label: 'Fahrer früher als Essen fertig' },
          { cls: 'bg-matcha-500', label: 'Essen rechtzeitig fertig' },
          { cls: 'bg-orange-400', label: 'In Zubereitung' },
          { cls: 'bg-blue-300', label: 'Geplant' },
        ].map(({ cls, label }) => (
          <div key={label} className="flex items-center gap-1">
            <div className={cn('h-2 w-2 rounded-full shrink-0', cls)} />
            <span className="text-[9px] text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- KitchenPrepTimelineBar ---- */
/* 30-Min-Fenster: alle kochenden/bestätigten Orders als farbige Punkte auf einem Zeitstrahl */
function KitchenPrepTimelineBar({ orders, timings }: { orders: Order[]; timings: KitchenTiming[] }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();
  const windowMs = 30 * 60_000;
  const windowStart = now;
  const windowEnd = now + windowMs;

  const active = orders.filter((o) => ['bestätigt', 'in_zubereitung'].includes(o.status));
  if (active.length === 0) return null;

  type TimeSlot = {
    order: Order;
    readyMs: number;
    isOverdue: boolean;
    stationCls: string;
    stationName: string;
  };

  const slots: TimeSlot[] = active.map((o) => {
    const timing = timings.find((t) => t.order_id === o.id);
    const readyMs = timing?.ready_target
      ? new Date(timing.ready_target).getTime()
      : o.bestellt_am
        ? new Date(o.bestellt_am).getTime() + (o.geschaetzte_zubereitung_min ?? 15) * 60_000
        : now + 15 * 60_000;
    const mainItem = (o.items?.[0]?.name ?? '').toLowerCase();
    const stationCls =
      /burger|steak|schnitzel|grill|bbq|wrap|kebab/.test(mainItem) ? 'bg-orange-500' :
      /suppe|pasta|curry|bowl|wok|ramen/.test(mainItem)             ? 'bg-red-500' :
      /salat|dessert|getränk|cola|wasser/.test(mainItem)            ? 'bg-sky-500' :
      'bg-matcha-500';
    const stationName =
      /burger|steak|schnitzel|grill|bbq|wrap|kebab/.test(mainItem) ? 'Grill' :
      /suppe|pasta|curry|bowl|wok|ramen/.test(mainItem)             ? 'Warm' :
      /salat|dessert|getränk|cola|wasser/.test(mainItem)            ? 'Kalt' :
      'Sonstiges';
    return { order: o, readyMs, isOverdue: readyMs < now, stationCls, stationName };
  }).sort((a, b) => a.readyMs - b.readyMs);

  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Fertigstellungs-Zeitstrahl · nächste 30 Min
        </span>
        <span className="text-[9px] text-muted-foreground tabular-nums">
          {new Date(windowStart).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          {' – '}
          {new Date(windowEnd).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      <div className="relative h-10 bg-muted/40 rounded-lg overflow-visible border border-border/50">
        {[5, 10, 15, 20, 25].map((m) => (
          <div key={m} className="absolute top-0 bottom-0 flex flex-col items-center" style={{ left: `${(m / 30) * 100}%`, transform: 'translateX(-50%)' }}>
            <div className="h-full w-px bg-border/40" />
            <span className="absolute -bottom-4 text-[8px] text-muted-foreground tabular-nums whitespace-nowrap">{m}&apos;</span>
          </div>
        ))}
        <div className="absolute top-0 bottom-0 w-0.5 bg-red-500/70 z-10" style={{ left: 0 }}>
          <span className="absolute -top-4 -left-2 text-[8px] font-black text-red-600 whitespace-nowrap">JETZT</span>
        </div>
        {slots.map((slot) => {
          const pct = Math.min(100, Math.max(0, ((slot.readyMs - windowStart) / windowMs) * 100));
          const inWindow = slot.readyMs >= windowStart && slot.readyMs <= windowEnd;
          if (!inWindow && !slot.isOverdue) return null;
          const leftPct = slot.isOverdue ? 0 : pct;
          const minLeft = Math.round((slot.readyMs - now) / 60_000);
          return (
            <div
              key={slot.order.id}
              className="absolute z-20"
              style={{ left: `${leftPct}%`, top: '50%', transform: 'translate(-50%, -50%)' }}
              title={`${slot.order.bestellnummer} · ${slot.order.kunde_name} · ${Math.abs(minLeft)} Min`}
            >
              <div className={cn(
                'h-6 w-6 rounded-full border-2 border-white shadow-md flex items-center justify-center text-[8px] font-black text-white',
                slot.isOverdue ? 'bg-red-500 animate-pulse' : slot.stationCls,
              )}>
                {slot.order.bestellnummer.slice(-2)}
              </div>
              <div className={cn(
                'absolute top-7 left-1/2 -translate-x-1/2 text-[7px] font-bold tabular-nums whitespace-nowrap',
                slot.isOverdue ? 'text-red-600' : 'text-muted-foreground',
              )}>
                {slot.isOverdue ? `+${Math.abs(minLeft)}m` : `${minLeft}m`}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-5">
        {[['bg-orange-500', 'Grill'], ['bg-red-500', 'Warm'], ['bg-sky-500', 'Kalt'], ['bg-matcha-500', 'Sonstiges']].map(([cls, name]) => {
          const count = slots.filter((s) => s.stationName === name).length;
          if (count === 0) return null;
          return (
            <div key={name} className="flex items-center gap-1">
              <div className={cn('h-2 w-2 rounded-full shrink-0', cls)} />
              <span className="text-[9px] text-muted-foreground">{name} ({count})</span>
            </div>
          );
        })}
        {slots.filter((s) => s.isOverdue).length > 0 && (
          <span className="text-[9px] font-bold text-red-600 flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            {slots.filter((s) => s.isOverdue).length} überzogen
          </span>
        )}
      </div>
    </div>
  );
}

/* ---- KitchenSmartTimingNudge ---- */
/* Zeigt Prompt wenn kochende Orders kein Smart-Timing haben — Batch-Erstellung */
/* ---- KitchenRevenueGauge ---- */
/* Zeigt den Gesamtwert der aktuell aktiven Bestellungen in der Küche */
function KitchenRevenueGauge({ orders }: { orders: Order[] }) {
  const active = orders.filter(o => ['neu', 'bestätigt', 'in_zubereitung', 'fertig'].includes(o.status));
  const total = active.reduce((s, o) => s + (o.gesamtbetrag ?? 0), 0);
  if (total === 0 || active.length === 0) return null;

  const byStatus: Record<string, number> = {};
  for (const o of active) {
    byStatus[o.status] = (byStatus[o.status] ?? 0) + (o.gesamtbetrag ?? 0);
  }
  const cooking = (byStatus['in_zubereitung'] ?? 0) + (byStatus['bestätigt'] ?? 0);
  const ready = byStatus['fertig'] ?? 0;
  const incoming = byStatus['neu'] ?? 0;

  const STATUS_COLORS: Record<string, string> = {
    fertig: 'bg-matcha-500',
    in_zubereitung: 'bg-orange-500',
    bestätigt: 'bg-blue-500',
    neu: 'bg-gold',
  };

  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[9px] font-black uppercase tracking-wider text-muted-foreground mb-0.5">
            Pipeline-Umsatz
          </div>
          <div className="text-2xl font-black tabular-nums text-foreground leading-none">
            {euro(total)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {active.length} aktive Bestellung{active.length !== 1 ? 'en' : ''}
          </div>
        </div>
        <div className="flex flex-col gap-1 text-right ml-auto shrink-0">
          {incoming > 0 && (
            <div className="flex items-center gap-1.5 text-[10px] justify-end">
              <span className="font-bold text-amber-600 tabular-nums">{euro(incoming)}</span>
              <span className="text-muted-foreground">neu</span>
              <span className="h-2 w-2 rounded-full bg-gold shrink-0" />
            </div>
          )}
          {cooking > 0 && (
            <div className="flex items-center gap-1.5 text-[10px] justify-end">
              <span className="font-bold text-orange-600 tabular-nums">{euro(cooking)}</span>
              <span className="text-muted-foreground">kochend</span>
              <span className="h-2 w-2 rounded-full bg-orange-500 shrink-0" />
            </div>
          )}
          {ready > 0 && (
            <div className="flex items-center gap-1.5 text-[10px] justify-end">
              <span className="font-bold text-matcha-600 tabular-nums">{euro(ready)}</span>
              <span className="text-muted-foreground">bereit</span>
              <span className="h-2 w-2 rounded-full bg-matcha-500 shrink-0" />
            </div>
          )}
        </div>
        {/* Fortschrittsbalken nach Status */}
        <div className="flex flex-col gap-1 w-24 shrink-0">
          {['fertig', 'in_zubereitung', 'bestätigt', 'neu'].map(status => {
            const val = byStatus[status] ?? 0;
            if (val === 0) return null;
            const pct = Math.round((val / total) * 100);
            return (
              <div key={status} className="flex items-center gap-1.5">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', STATUS_COLORS[status] ?? 'bg-muted-foreground')}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[8px] tabular-nums text-muted-foreground w-8 text-right">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function KitchenSmartTimingNudge({ orders, timings }: { orders: Order[]; timings: KitchenTiming[] }) {
  const [, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [done, setDone] = useState(false);

  const cookingWithoutTiming = orders.filter((o) =>
    ['in_zubereitung', 'bestätigt'].includes(o.status) &&
    !timings.find((t) => t.order_id === o.id)
  );

  if (cookingWithoutTiming.length === 0 || done) return null;

  async function createAll() {
    setCreating(true);
    try {
      await Promise.all(
        cookingWithoutTiming.map((o) =>
          createKitchenTiming(o.id, o.geschaetzte_zubereitung_min ?? 15),
        ),
      );
      setDone(true);
      setTimeout(() => setDone(false), 8000);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex items-center gap-3">
      <Zap className="h-4 w-4 text-blue-600 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold text-blue-900">
          {cookingWithoutTiming.length} {cookingWithoutTiming.length === 1 ? 'Bestellung' : 'Bestellungen'} ohne Smart-Timing
        </div>
        <div className="text-[10px] text-blue-600 mt-0.5">
          Präzise Countdowns aktivieren für:{' '}
          {cookingWithoutTiming.slice(0, 3).map((o) => o.bestellnummer.replace('FF-', '')).join(', ')}
          {cookingWithoutTiming.length > 3 ? ` +${cookingWithoutTiming.length - 3}` : ''}
        </div>
      </div>
      <button
        onClick={() => startTransition(() => void createAll())}
        disabled={creating}
        className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 text-white px-3 py-1.5 text-xs font-bold hover:bg-blue-700 disabled:opacity-50 transition"
      >
        {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
        {creating ? 'Erstelle…' : 'Alle aktivieren'}
      </button>
    </div>
  );
}

/* ------------------------------ KitchenStationLoadBar ------------------------------ */
/* Kompakter Überblick: Portionen je Prep-Station im aktiven Queue */
function KitchenStationLoadBar({ orders }: { orders: Order[] }) {
  const STATIONS: PrepStation[] = ['Grill', 'Warm', 'Kalt', 'Sonstiges'];

  const cooking = orders.filter((o) => ['bestätigt', 'in_zubereitung'].includes(o.status));
  if (cooking.length === 0) return null;

  // Count portions per station
  const portionsPerStation: Record<PrepStation, number> = { Grill: 0, Warm: 0, Kalt: 0, Sonstiges: 0 };
  const itemsPerStation: Record<PrepStation, number> = { Grill: 0, Warm: 0, Kalt: 0, Sonstiges: 0 };
  for (const o of cooking) {
    for (const it of o.items ?? []) {
      const st = classifyStation(it.name);
      portionsPerStation[st] += it.menge;
      itemsPerStation[st] += 1;
    }
  }

  const totalPortions = Object.values(portionsPerStation).reduce((s, n) => s + n, 0);
  if (totalPortions === 0) return null;

  const stationBarColor: Record<PrepStation, string> = {
    Grill:     'bg-orange-400',
    Warm:      'bg-red-400',
    Kalt:      'bg-sky-400',
    Sonstiges: 'bg-matcha-400',
  };
  const stationTextColor: Record<PrepStation, string> = {
    Grill:     'text-orange-700',
    Warm:      'text-red-700',
    Kalt:      'text-sky-700',
    Sonstiges: 'text-matcha-700',
  };

  const maxPortions = Math.max(...Object.values(portionsPerStation), 1);

  return (
    <div className="rounded-xl border border-matcha-200 bg-matcha-50 px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <Utensils className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="font-display text-xs font-bold uppercase tracking-wider text-matcha-800">
          Stations-Auslastung
        </span>
        <span className="ml-auto text-[10px] text-matcha-500 tabular-nums">{totalPortions} Portionen · {cooking.length} Best.</span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        {STATIONS.map((st) => {
          const portions = portionsPerStation[st];
          const items = itemsPerStation[st];
          const pct = Math.round((portions / maxPortions) * 100);
          if (portions === 0) return null;
          return (
            <div key={st} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className={`font-black uppercase tracking-wider ${stationTextColor[st]}`}>{st}</span>
                <span className="tabular-nums text-matcha-500 font-bold">{portions}×</span>
              </div>
              <div className="h-2 rounded-full bg-matcha-200 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${stationBarColor[st]}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="text-[9px] text-matcha-400">{items} {items === 1 ? 'Artikel' : 'Artikel'}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KitchenUntrackedTimerRow({ orders, timings }: { orders: Order[]; timings: KitchenTiming[] }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const trackedIds = new Set(timings.map((t) => t.order_id));
  const untracked = orders.filter(
    (o) => o.status === 'in_zubereitung' && !trackedIds.has(o.id) && o.bestellt_am,
  );
  if (untracked.length === 0) return null;

  const now = Date.now();

  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50/60 px-3 py-2">
      <div className="mb-1.5 flex items-center gap-2">
        <Flame className="h-3.5 w-3.5 text-orange-600 shrink-0" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-orange-800">
          Kocht · Kein Smart-Timing ({untracked.length})
        </span>
        <span className="ml-auto text-[9px] text-orange-500">Stoppuhr hochzählend</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {untracked.map((o) => {
          const elapsedMs = now - new Date(o.bestellt_am!).getTime();
          const elapsedMin = Math.floor(elapsedMs / 60_000);
          const elapsedSec = Math.floor((elapsedMs % 60_000) / 1000);
          const est = o.geschaetzte_zubereitung_min ?? 15;
          const ratio = elapsedMin / est;
          const isOver  = ratio >= 1;
          const isNear  = ratio >= 0.75;
          const station = classifyStation(o.items?.[0]?.name ?? '');
          const dot = STATION_META[station].dot;
          return (
            <div
              key={o.id}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] transition',
                isOver  ? 'border-red-300 bg-red-50 text-red-800 animate-pulse' :
                isNear  ? 'border-orange-300 bg-orange-100 text-orange-800' :
                          'border-orange-200 bg-white text-orange-700',
              )}
              title={`#${o.bestellnummer} · Schätzung: ${est} Min`}
            >
              <span className={cn('h-2 w-2 rounded-full shrink-0', dot)} />
              <span className="font-mono font-black tabular-nums">
                {elapsedMin}:{String(elapsedSec).padStart(2, '0')}
              </span>
              <span className="font-semibold truncate max-w-[80px]">
                #{o.bestellnummer.replace(/^[A-Z]+-/, '')} {o.kunde_name.split(' ')[0]}
              </span>
              {isOver && <AlertCircle className="h-3 w-3 text-red-600 shrink-0" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ KitchenItemPrioritySort (Phase 65) ------------------------------ */
function KitchenItemPrioritySort({ orders, timings }: { orders: Order[]; timings: KitchenTiming[] }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const active = orders.filter((o) => ['bestätigt', 'in_zubereitung'].includes(o.status));
  if (active.length === 0) return null;

  const now = Date.now();

  type ItemRow = {
    name: string;
    totalMenge: number;
    station: PrepStation;
    urgencyMs: number;
    isOverdue: boolean;
    isUrgent: boolean;
  };

  const map = new Map<string, ItemRow>();

  for (const order of active) {
    const timing = timings.find((t) => t.order_id === order.id);
    const urgencyMs = timing?.ready_target
      ? new Date(timing.ready_target).getTime()
      : now + ((order.geschaetzte_zubereitung_min ?? 20) * 60_000);

    for (const item of (order.items ?? [])) {
      const key = item.name.toLowerCase().trim();
      const existing = map.get(key);
      if (existing) {
        existing.totalMenge += item.menge;
        if (urgencyMs < existing.urgencyMs) existing.urgencyMs = urgencyMs;
      } else {
        map.set(key, {
          name: item.name,
          totalMenge: item.menge,
          station: classifyStation(item.name),
          urgencyMs,
          isOverdue: false,
          isUrgent: false,
        });
      }
    }
  }

  const rows = Array.from(map.values())
    .map((r) => ({
      ...r,
      isOverdue: r.urgencyMs < now,
      isUrgent: !r.isOverdue && r.urgencyMs < now + 6 * 60_000,
    }))
    .sort((a, b) => a.urgencyMs - b.urgencyMs)
    .slice(0, 10);

  if (rows.length === 0) return null;

  const overdueCount = rows.filter((r) => r.isOverdue).length;
  const urgentCount  = rows.filter((r) => r.isUrgent).length;

  return (
    <div className={cn(
      'rounded-xl border px-4 py-3',
      overdueCount > 0 ? 'border-red-200 bg-red-50/50' : 'border-matcha-200 bg-white',
    )}>
      <div className="mb-2 flex items-center gap-2">
        <Zap className="h-3.5 w-3.5 shrink-0 text-matcha-600" />
        <span className="font-display text-xs font-bold uppercase tracking-wider text-matcha-800">
          Artikel-Priorität
        </span>
        {overdueCount > 0 && (
          <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-black text-red-700">
            {overdueCount} überfällig
          </span>
        )}
        {urgentCount > 0 && (
          <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[9px] font-black text-orange-700">
            {urgentCount} dringend
          </span>
        )}
        <span className="ml-auto text-[9px] text-matcha-400">
          {active.length} Best. · {rows.length} Arten
        </span>
      </div>
      <div className="grid grid-cols-1 gap-y-1 sm:grid-cols-2">
        {rows.map((r) => {
          const minLeft = Math.round((r.urgencyMs - now) / 60_000);
          const dot = STATION_META[r.station].dot;
          return (
            <div key={r.name} className="flex items-center gap-2 py-0.5">
              <span className={cn('h-2 w-2 shrink-0 rounded-full', dot)} />
              <span className="flex-1 truncate text-xs font-medium text-matcha-800">{r.name}</span>
              <span className="shrink-0 text-[10px] font-black text-matcha-500">{r.totalMenge}×</span>
              <span className={cn(
                'shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums',
                r.isOverdue ? 'bg-red-100 text-red-700'    :
                r.isUrgent  ? 'bg-orange-100 text-orange-700' :
                              'bg-matcha-50 text-matcha-600',
              )}>
                {r.isOverdue ? `+${Math.abs(minLeft)}m` : minLeft <= 0 ? 'jetzt!' : `~${minLeft}m`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ KitchenThroughputMeter ------------------------------ */

function KitchenThroughputMeter({ orders }: { orders: Order[] }) {
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();
  const w30 = 30 * 60_000;
  const w60 = 60 * 60_000;

  const completedInWindow = (from: number, to: number) =>
    orders.filter((o) => {
      const t = o.fertig_am ? new Date(o.fertig_am).getTime() : null;
      return t != null && t >= from && t <= to;
    }).length;

  const last30 = completedInWindow(now - w30, now);
  const last60 = completedInWindow(now - w60, now);
  const prev30 = completedInWindow(now - w60, now - w30);

  const rate = last30 * 2;
  const prevRate = prev30 * 2;
  const trend: 'up' | 'down' | 'flat' =
    rate > prevRate + 1 ? 'up' : rate < prevRate - 1 ? 'down' : 'flat';

  const TARGET = 8;
  const pct = Math.min(100, Math.round((rate / TARGET) * 100));
  const barColor =
    pct >= 90 ? 'bg-matcha-500' :
    pct >= 60 ? 'bg-blue-400' :
    pct >= 30 ? 'bg-amber-400' : 'bg-muted';
  const label =
    pct >= 90 ? 'Volllast' : pct >= 60 ? 'Normal' : pct >= 30 ? 'Ruhig' : 'Sehr ruhig';
  const labelCls =
    pct >= 90 ? 'bg-matcha-100 text-matcha-700' :
    pct >= 60 ? 'bg-blue-100 text-blue-700' :
    pct >= 30 ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground';

  if (last30 === 0 && last60 === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <TrendingUp className="h-3.5 w-3.5 shrink-0 text-matcha-600" />
        <span className="font-display text-xs font-bold uppercase tracking-wider">Durchsatz</span>
        <span className={cn('ml-1 rounded-full px-2 py-0.5 text-[9px] font-black', labelCls)}>{label}</span>
        <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
          {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}{' '}
          <span className="font-bold">{Math.abs(rate - prevRate)}/h</span>{' vs. vorhin'}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="mb-1 flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">Best./h — 30-Min-Fenster</span>
            <span className="font-black tabular-nums">{rate}/h</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-700', barColor)}
              style={{ width: `${Math.max(4, pct)}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[9px] text-muted-foreground">
            <span>0</span>
            <span className="font-semibold text-matcha-500">Ziel {TARGET}/h</span>
            <span>{Math.round(TARGET * 1.5)}</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-2xl font-black tabular-nums text-matcha-700">{last30}</div>
          <div className="text-[9px] text-muted-foreground leading-tight">in 30 Min</div>
          {last60 > last30 && (
            <div className="text-[9px] text-muted-foreground opacity-60">{last60} in 60 Min</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ KitchenAllergenMonitor ------------------------------ */

const ALLERGY_KEYWORDS = /allergi|unverträgl|intoleran|laktose|gluten|nuss|erdnuss|fisch|krebst|ei-frei|weizen|sesam|senf|sellerie|halal|koscher|vegan|vegetari/i;

function KitchenAllergenMonitor({ orders }: { orders: Order[] }) {
  const active = orders.filter((o) => ['bestätigt', 'in_zubereitung'].includes(o.status));
  if (active.length === 0) return null;

  type NoteEntry = {
    orderId: string;
    bestellnummer: string;
    kundeNamen: string;
    text: string;
    isAllergy: boolean;
  };

  const entries: NoteEntry[] = [];

  for (const o of active) {
    if (o.kunde_notiz) {
      entries.push({
        orderId: o.id,
        bestellnummer: o.bestellnummer,
        kundeNamen: o.kunde_name,
        text: o.kunde_notiz,
        isAllergy: ALLERGY_KEYWORDS.test(o.kunde_notiz),
      });
    }
    if (o.kunde_lieferhinweis && o.kunde_lieferhinweis !== o.kunde_notiz) {
      entries.push({
        orderId: o.id + '_hl',
        bestellnummer: o.bestellnummer,
        kundeNamen: o.kunde_name,
        text: `📦 ${o.kunde_lieferhinweis}`,
        isAllergy: false,
      });
    }
    for (const item of o.items ?? []) {
      if (item.notiz) {
        entries.push({
          orderId: o.id + '_it_' + item.id,
          bestellnummer: o.bestellnummer,
          kundeNamen: o.kunde_name,
          text: `${item.menge}× ${item.name}: ${item.notiz}`,
          isAllergy: ALLERGY_KEYWORDS.test(item.notiz),
        });
      }
    }
  }

  if (entries.length === 0) return null;

  const allergyCount = entries.filter((e) => e.isAllergy).length;

  return (
    <div className={cn(
      'rounded-xl border px-4 py-3',
      allergyCount > 0 ? 'border-red-300 bg-red-50' : 'border-amber-200 bg-amber-50/60',
    )}>
      <div className="mb-2 flex items-center gap-2">
        <AlertCircle className={cn('h-3.5 w-3.5 shrink-0', allergyCount > 0 ? 'text-red-600' : 'text-amber-600')} />
        <span className={cn(
          'font-display text-xs font-bold uppercase tracking-wider',
          allergyCount > 0 ? 'text-red-800' : 'text-amber-800',
        )}>
          Sonderwünsche & Allergien
        </span>
        {allergyCount > 0 && (
          <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] font-black text-white animate-pulse">
            {allergyCount} Allergie
          </span>
        )}
        <span className="ml-auto text-[9px] text-muted-foreground">{entries.length} Hinweise</span>
      </div>
      <div className="space-y-1">
        {entries.map((e) => (
          <div
            key={e.orderId}
            className={cn(
              'flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-[11px]',
              e.isAllergy
                ? 'border-red-300 bg-white text-red-800'
                : 'border-amber-200 bg-white text-amber-900',
            )}
          >
            <span className={cn(
              'shrink-0 rounded px-1 py-0.5 text-[9px] font-black tabular-nums',
              e.isAllergy ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700',
            )}>
              #{e.bestellnummer.replace(/^[A-Z]+-/, '')}
            </span>
            <span className="flex-1 break-words font-medium leading-snug">{e.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ KitchenUrgencyTicker ------------------------------ */
function KitchenUrgencyTicker({ orders }: { orders: Order[] }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();
  const cooking = orders.filter((o) => ['bestätigt', 'in_zubereitung'].includes(o.status));
  if (cooking.length === 0) return null;

  // Find next-ready order (smallest remaining time)
  type ReadyInfo = { order: Order; remainSec: number; overdue: boolean };
  const infos: ReadyInfo[] = cooking.map((o) => {
    const est = (o.geschaetzte_zubereitung_min ?? 15) * 60;
    const elapsed = o.bestellt_am ? Math.floor((now - new Date(o.bestellt_am).getTime()) / 1000) : 0;
    const remain = est - elapsed;
    return { order: o, remainSec: remain, overdue: remain < 0 };
  });

  const overdueCount = infos.filter((x) => x.overdue).length;
  const nextReady = infos.filter((x) => !x.overdue).sort((a, b) => a.remainSec - b.remainSec)[0];

  const fmtSec = (s: number) => {
    const abs = Math.abs(s);
    return `${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3 flex-wrap px-1 mb-1">
      {overdueCount > 0 && (
        <div className={cn(
          'flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold',
          overdueCount >= 3 ? 'border-red-400 bg-red-50 text-red-700 animate-pulse' : 'border-orange-400 bg-orange-50 text-orange-700',
        )}>
          <Flame className="h-3 w-3" />
          {overdueCount} überfällig
        </div>
      )}
      {nextReady && (
        <div className={cn(
          'flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold tabular-nums',
          nextReady.remainSec < 120 ? 'border-matcha-400 bg-matcha-50 text-matcha-700 animate-pulse' : 'border-blue-300 bg-blue-50 text-blue-700',
        )}>
          <Clock className="h-3 w-3" />
          Nächste fertig: {fmtSec(nextReady.remainSec)}
          <span className="font-normal opacity-70 truncate max-w-[100px]">
            {nextReady.order.kunde_name}
          </span>
        </div>
      )}
      <div className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs text-muted-foreground">
        <Target className="h-3 w-3" />
        {cooking.length} in Zubereitung
      </div>
    </div>
  );
}

/* ------------------------------ KitchenReadyForecastPanel ------------------------------ */
// Zeigt alle Bestellungen die in den nächsten 10 Minuten fertig sein werden — sowohl mit
// Smart-Timing (ready_target) als auch ohne (basierend auf geschaetzte_zubereitung_min).
function KitchenReadyForecastPanel({ orders, timings }: { orders: Order[]; timings: KitchenTiming[] }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const WINDOW_MS = 10 * 60_000;
  const now = Date.now();

  const upcoming = orders
    .filter((o) => ['in_zubereitung', 'bestätigt'].includes(o.status))
    .map((o) => {
      const timing = timings.find((t) => t.order_id === o.id);
      let readyMs: number | null = null;
      if (timing?.status === 'cooking' && timing.ready_target) {
        readyMs = new Date(timing.ready_target).getTime();
      } else if (o.bestellt_am && o.geschaetzte_zubereitung_min) {
        readyMs = new Date(o.bestellt_am).getTime() + o.geschaetzte_zubereitung_min * 60_000;
      }
      return { order: o, timing, readyMs };
    })
    .filter(({ readyMs }) => readyMs !== null && readyMs - now >= -60_000 && readyMs - now <= WINDOW_MS)
    .sort((a, b) => (a.readyMs ?? 0) - (b.readyMs ?? 0));

  if (upcoming.length === 0) return null;

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Target className="h-4 w-4 text-blue-700" />
        <span className="font-display text-xs font-bold uppercase tracking-wider text-blue-800">
          In 10 Min fertig · {upcoming.length} Bestellung{upcoming.length !== 1 ? 'en' : ''}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {upcoming.map(({ order, timing, readyMs }) => {
          const secLeft = readyMs ? Math.floor((readyMs - now) / 1000) : null;
          const overdue = secLeft !== null && secLeft < 0;
          const imminent = !overdue && secLeft !== null && secLeft < 120;
          const hasSmartTiming = timing?.status === 'cooking' && timing.ready_target;
          const m = secLeft !== null ? Math.floor(Math.abs(secLeft) / 60) : null;
          const s = secLeft !== null ? Math.abs(secLeft) % 60 : null;
          return (
            <div
              key={order.id}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-3 py-2 min-w-[180px]',
                overdue   ? 'bg-red-50 border-red-300' :
                imminent  ? 'bg-orange-50 border-orange-300 animate-pulse' :
                'bg-white border-blue-200',
              )}
            >
              <div className={cn(
                'h-8 w-8 rounded-full flex items-center justify-center font-mono font-black text-[11px] shrink-0 tabular-nums',
                overdue  ? 'bg-red-500 text-white' :
                imminent ? 'bg-orange-500 text-white' :
                'bg-blue-100 text-blue-800',
              )}>
                {m !== null && s !== null
                  ? `${overdue ? '+' : ''}${m}:${String(s).padStart(2, '0')}`
                  : '?'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[9px] text-muted-foreground">
                  #{order.bestellnummer.replace('FF-', '')}
                  {hasSmartTiming && (
                    <span className="ml-1 text-blue-600 font-bold">⏱</span>
                  )}
                </div>
                <div className="font-display font-bold text-[12px] truncate leading-tight">{order.kunde_name}</div>
                {order.typ === 'lieferung' && order.delivery_zone && (
                  <span className={cn(
                    'inline-block rounded-full px-1.5 py-0.5 text-[8px] font-black mt-0.5',
                    order.delivery_zone === 'A' ? 'bg-green-100 text-green-800' :
                    order.delivery_zone === 'B' ? 'bg-blue-100 text-blue-800' :
                    order.delivery_zone === 'C' ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800',
                  )}>
                    Zone {order.delivery_zone}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ KitchenBulkTimerStart ------------------------------ */
function KitchenBulkTimerStart({ orders, onDone }: { orders: Order[]; onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  const handleStart = () => {
    startTransition(async () => {
      await Promise.all(
        orders.map((o) => createKitchenTiming(o.id, o.geschaetzte_zubereitung_min ?? 15)),
      );
      setDone(true);
      onDone();
      setTimeout(() => setDone(false), 3000);
    });
  };

  if (done) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-matcha-300 bg-matcha-50 px-3 py-1 text-xs font-bold text-matcha-700">
        <CheckCircle2 className="h-3 w-3" />
        {orders.length} Timer gestartet
      </span>
    );
  }

  return (
    <button
      onClick={handleStart}
      disabled={pending}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold transition-colors',
        pending
          ? 'border-blue-200 bg-blue-50 text-blue-400 cursor-not-allowed'
          : 'border-blue-400 bg-blue-500 text-white hover:bg-blue-600 active:scale-95',
      )}
    >
      {pending ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          Starte Timer…
        </>
      ) : (
        <>
          <Play className="h-3 w-3" />
          {orders.length} Timer starten
        </>
      )}
    </button>
  );
}

/* ------------------------------ KitchenWebNotifier ------------------------------ */
// Browser-Benachrichtigungen für neue Bestellungen und kritisch überfällige Aufträge.
// Nutzt die Web Notifications API — fragt nur einmalig nach Erlaubnis.
export function KitchenWebNotifier({
  orders,
  audio,
}: {
  orders: Order[];
  audio: boolean;
}) {
  const permRef = useRef<NotificationPermission | null>(null);
  const prevNewCountRef = useRef(orders.filter((o) => o.status === 'neu').length);
  const notifiedCriticalRef = useRef<Set<string>>(new Set());

  // Einmalig Erlaubnis anfragen wenn Audio aktiv (Nutzer hat Interaktion signalisiert)
  useEffect(() => {
    if (!audio) return;
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission().then((p) => { permRef.current = p; });
    } else {
      permRef.current = Notification.permission;
    }
  }, [audio]);

  useEffect(() => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const newCount = orders.filter((o) => o.status === 'neu').length;

    // Neue Bestellung angekommen
    if (newCount > prevNewCountRef.current) {
      const newest = [...orders]
        .filter((o) => o.status === 'neu')
        .sort((a, b) => (b.bestellt_am ?? '').localeCompare(a.bestellt_am ?? ''))
        .at(0);
      try {
        const n = new Notification('🔔 Neue Bestellung!', {
          body: newest
            ? `${newest.kunde_name} · ${newest.typ === 'lieferung' ? '🛵 Lieferung' : '🥡 Abholung'}`
            : 'Eine neue Bestellung ist eingegangen.',
          tag: `new-order-${Date.now()}`,
          requireInteraction: false,
          silent: true, // Ton kommt via playSound
        });
        setTimeout(() => n.close(), 8000);
      } catch {}
    }
    prevNewCountRef.current = newCount;

    // Kritisch überfällige Bestellungen
    for (const o of orders) {
      if (notifiedCriticalRef.current.has(o.id)) continue;
      if (!isCriticallyLate(o)) continue;
      notifiedCriticalRef.current.add(o.id);
      try {
        const elMin = o.bestellt_am
          ? Math.floor((Date.now() - new Date(o.bestellt_am).getTime()) / 60_000)
          : 0;
        const n = new Notification('⚠️ Bestellung überfällig!', {
          body: `#${o.bestellnummer.replace('FF-', '')} · ${o.kunde_name} · ${elMin} Min`,
          tag: `critical-${o.id}`,
          requireInteraction: true,
          silent: false,
        });
        setTimeout(() => n.close(), 15000);
      } catch {}
    }
  }, [orders]);

  return null;
}

/* ------------------------------ KitchenHandoffSyncPanel ------------------------------ */

function KitchenHandoffSyncPanel({
  batches, stops, timings, orders,
}: {
  batches: Batch[];
  stops: Stop[];
  timings: KitchenTiming[];
  orders: Order[];
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();
  const ACTIVE = new Set(['pickup', 'unterwegs', 'assigned', 'at_restaurant', 'on_route']);

  type SyncRow = {
    batchId: string;
    driverId: string;
    etaMs: number | null;
    syncQuality: 'gut' | 'warte' | 'konflikt';
    deltaMin: number | null; // positive = fahrer früher (warten), negative = essen früher (optimal/warm halten)
    orderNums: string[];
    readyTargets: (number | null)[];
  };

  const rows: SyncRow[] = batches
    .filter((b) => ACTIVE.has(b.status))
    .map((b) => {
      const etaMs =
        b.started_at && b.total_eta_min != null
          ? new Date(b.started_at).getTime() + b.total_eta_min * 60_000
          : null;

      const batchStops = stops.filter((s) => s.batch_id === b.id && !s.geliefert_am);
      const orderNums: string[] = [];
      const readyTargets: (number | null)[] = [];

      for (const s of batchStops) {
        const order = orders.find((o) => o.id === s.order_id);
        if (order) orderNums.push(order.bestellnummer.replace(/^FF-/, ''));
        const timing = timings.find((t) => t.order_id === s.order_id);
        readyTargets.push(timing?.ready_target ? new Date(timing.ready_target).getTime() : null);
      }

      const validTargets = readyTargets.filter((t): t is number => t !== null);
      const latestReady = validTargets.length ? Math.max(...validTargets) : null;

      let syncQuality: SyncRow['syncQuality'] = 'gut';
      let deltaMin: number | null = null;

      if (etaMs !== null && latestReady !== null) {
        deltaMin = Math.round((etaMs - latestReady) / 60_000);
        if (deltaMin > 5) syncQuality = 'konflikt'; // driver ETA after food ready → Essen wartet auf Fahrer
        else if (deltaMin < -8) syncQuality = 'warte'; // driver arrives before food ready → Fahrer wartet
        else syncQuality = 'gut';
      }

      return { batchId: b.id, driverId: b.driver_id, etaMs, syncQuality, deltaMin, orderNums, readyTargets };
    })
    .filter((r) => r.orderNums.length > 0);

  if (rows.length === 0) return null;

  const colorMap = {
    gut:      { card: 'border-matcha-300 bg-matcha-50', dot: 'bg-matcha-500', label: 'Synchron', text: 'text-matcha-700' },
    warte:    { card: 'border-amber-300 bg-amber-50',   dot: 'bg-amber-400',  label: 'Fahrer wartet', text: 'text-amber-700' },
    konflikt: { card: 'border-red-300 bg-red-50',       dot: 'bg-red-500',    label: 'Essen wartet', text: 'text-red-700' },
  };

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Zap className="h-4 w-4 text-blue-600" />
        <span className="font-display text-xs font-bold uppercase tracking-wider text-blue-800">
          Fahrer-Küchen-Sync · {rows.length} aktive Tour{rows.length > 1 ? 'en' : ''}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {rows.map((r) => {
          const meta = colorMap[r.syncQuality];
          const etaStr = r.etaMs
            ? new Date(r.etaMs).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
            : '—';
          return (
            <div key={r.batchId} className={cn('flex items-center gap-2 rounded-lg border px-3 py-2 min-w-[180px]', meta.card)}>
              <div className={cn('h-2.5 w-2.5 rounded-full shrink-0', meta.dot)} />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold truncate">
                  {r.orderNums.length > 0 ? `#${r.orderNums.slice(0, 2).join(' · #')}` : 'Ohne Nummern'}
                </div>
                <div className={cn('text-[9px] font-semibold', meta.text)}>
                  {meta.label}
                  {r.deltaMin !== null && r.deltaMin !== 0 && (
                    <span className="ml-1 opacity-80">
                      {r.deltaMin > 0
                        ? `(+${r.deltaMin}m Wartezeit)`
                        : `(${Math.abs(r.deltaMin)}m Vorlauf)`}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-[9px] text-muted-foreground tabular-nums shrink-0">
                ETA {etaStr}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ KitchenSmartPrepAdvisor ------------------------------ */
/* Phase 89: Analysiert die letzten fertiggestellten Bestellungen und schlägt optimale
   Zubereitungszeiten für die aktuell wartenden Bestellungen vor. */
function KitchenSmartPrepAdvisor({ orders }: { orders: Order[] }) {
  const supabase = createClient();
  type HistoryPoint = { status: string; bestellt_am: string; fertig_am: string; geschaetzte_zubereitung_min: number | null };
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const since = new Date(Date.now() - 4 * 60 * 60_000).toISOString();
        const { data } = await supabase
          .from('customer_orders')
          .select('status, bestellt_am, fertig_am, geschaetzte_zubereitung_min')
          .in('status', ['fertig', 'unterwegs', 'geliefert', 'abgeholt', 'abgeschlossen'])
          .gte('fertig_am', since)
          .not('fertig_am', 'is', null)
          .not('bestellt_am', 'is', null)
          .limit(30);
        setHistory((data as HistoryPoint[]) ?? []);
      } catch {} finally { setLoading(false); }
    };
    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pending = orders.filter((o) => ['bestätigt', 'in_zubereitung'].includes(o.status));
  if (pending.length === 0 || (loading && history.length === 0)) return null;

  // Compute historical actual prep time statistics
  const actuals = history
    .map((h) => {
      const actual = Math.floor((new Date(h.fertig_am).getTime() - new Date(h.bestellt_am).getTime()) / 60_000);
      const est = h.geschaetzte_zubereitung_min ?? 15;
      return { actual, est, delta: actual - est };
    })
    .filter((x) => x.actual > 0 && x.actual < 90);

  if (actuals.length < 3) return null;

  const avgActual = Math.round(actuals.reduce((s, x) => s + x.actual, 0) / actuals.length);
  const avgDelta  = Math.round(actuals.reduce((s, x) => s + x.delta, 0) / actuals.length);
  const onTimePct = Math.round((actuals.filter((x) => x.delta <= 2).length / actuals.length) * 100);

  // Suggest optimal prep time for next orders
  const avgPendingEst = pending.length > 0
    ? Math.round(pending.reduce((s, o) => s + (o.geschaetzte_zubereitung_min ?? 15), 0) / pending.length)
    : 15;
  const suggestedTime = Math.max(5, avgPendingEst + Math.round(avgDelta * 0.7));

  const qualityColor =
    onTimePct >= 80 ? 'text-matcha-700' :
    onTimePct >= 60 ? 'text-amber-700' :
    'text-red-700';
  const qualityBg =
    onTimePct >= 80 ? 'bg-matcha-50 border-matcha-200' :
    onTimePct >= 60 ? 'bg-amber-50 border-amber-200' :
    'bg-red-50 border-red-200';

  return (
    <div className={cn('rounded-xl border px-4 py-3', qualityBg)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Target className="h-3.5 w-3.5 text-matcha-600 shrink-0" />
          <span className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Smart-Prep-Advisor · {actuals.length} Referenzbestellungen
          </span>
        </div>
        <span className={cn('text-[10px] font-black tabular-nums', qualityColor)}>
          {onTimePct}% on-time
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-white/60 border border-current/10 px-2 py-1.5">
          <div className="font-black text-base tabular-nums">{avgActual}m</div>
          <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-wide">Ø Ist (4h)</div>
        </div>
        <div className="rounded-lg bg-white/60 border border-current/10 px-2 py-1.5">
          <div className={cn('font-black text-base tabular-nums', avgDelta > 2 ? 'text-red-600' : avgDelta < -2 ? 'text-matcha-600' : 'text-muted-foreground')}>
            {avgDelta > 0 ? `+${avgDelta}` : avgDelta}m
          </div>
          <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-wide">Ø Abweichung</div>
        </div>
        <div className="rounded-lg bg-white/60 border border-current/10 px-2 py-1.5">
          <div className="font-black text-base tabular-nums text-blue-700">{suggestedTime}m</div>
          <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-wide">Empfehlung</div>
        </div>
      </div>
      {Math.abs(avgDelta) >= 3 && (
        <div className={cn(
          'mt-2 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold',
          avgDelta > 0 ? 'bg-orange-100/80 text-orange-800' : 'bg-matcha-100/80 text-matcha-800',
        )}>
          <Zap className="h-3 w-3 shrink-0" />
          {avgDelta > 0
            ? `Bestellungen dauern Ø ${avgDelta}m länger als geschätzt — Schätzung erhöhen?`
            : `Küche ist ${Math.abs(avgDelta)}m schneller als geschätzt — gut!`}
        </div>
      )}
    </div>
  );
}

function KitchenOrderAgeGrid({ orders }: { orders: Order[] }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();
  const active = orders.filter(o => ['bestätigt', 'in_zubereitung'].includes(o.status) && o.bestellt_am);
  if (active.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <Clock className="h-3.5 w-3.5 text-matcha-600" />
        <span className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Bestellalter · {active.length} aktiv
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {active.map(o => {
          const est = (o.geschaetzte_zubereitung_min ?? 15) * 60_000;
          const elapsed = now - new Date(o.bestellt_am!).getTime();
          const pct = Math.min(200, Math.round((elapsed / est) * 100));
          const overdue = pct >= 100;
          const elapsedSec = Math.floor(elapsed / 1000);
          const mm = Math.floor(elapsedSec / 60);
          const ss = String(elapsedSec % 60).padStart(2, '0');
          const bg = overdue ? 'bg-red-100 border-red-300 text-red-800' :
                     pct >= 75 ? 'bg-orange-100 border-orange-300 text-orange-800' :
                     pct >= 50 ? 'bg-amber-100 border-amber-300 text-amber-800' :
                     'bg-matcha-50 border-matcha-200 text-matcha-800';
          return (
            <div
              key={o.id}
              className={cn('flex flex-col items-center rounded-lg border px-2.5 py-1.5 text-center min-w-[56px]', bg, overdue && 'animate-pulse')}
              title={`${o.kunde_name} · ${mm}:${ss} vergangen`}
            >
              <span className="font-mono text-[9px] font-black tabular-nums">#{o.bestellnummer.replace(/^FF-/, '').slice(-4)}</span>
              <span className="font-mono text-sm font-black tabular-nums leading-tight">{mm}:{ss}</span>
              <span className="text-[8px] font-bold opacity-60">{o.status === 'in_zubereitung' ? '🍳' : '✓'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KitchenDispatchBacklogPanel — fertige Lieferbestellungen warten auf Fahrer
// ---------------------------------------------------------------------------
function KitchenDispatchBacklogPanel({ orders }: { orders: Order[] }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 5_000);
    return () => clearInterval(id);
  }, []);

  const waiting = orders
    .filter(o => o.status === 'fertig' && o.typ === 'lieferung' && o.fertig_am)
    .sort((a, b) => new Date(a.fertig_am!).getTime() - new Date(b.fertig_am!).getTime());

  if (waiting.length === 0) return null;

  const now = Date.now();
  const worstSec = Math.floor((now - new Date(waiting[0].fertig_am!).getTime()) / 1000);
  const urgency =
    worstSec >= 900 ? 'critical' :
    worstSec >= 480 ? 'warning' : 'ok';

  const border =
    urgency === 'critical' ? 'border-red-500 bg-red-950/40' :
    urgency === 'warning'  ? 'border-amber-400 bg-amber-950/30' :
                             'border-matcha-500 bg-matcha-900/40';
  const label =
    urgency === 'critical' ? '🚨 Kritisch — Fahrer dringend benötigt!' :
    urgency === 'warning'  ? '⚠️ Warten auf Fahrer' :
                             '✅ Bereit zur Abholung';

  return (
    <div className={cn('rounded-xl border p-3 space-y-2', border)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-white">{label}</span>
        <span className="text-[10px] text-matcha-300">{waiting.length} Best. warten</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {waiting.map(o => {
          const sec = Math.floor((now - new Date(o.fertig_am!).getTime()) / 1000);
          const mm = String(Math.floor(sec / 60)).padStart(2, '0');
          const ss = String(sec % 60).padStart(2, '0');
          const chipColor =
            sec >= 900 ? 'bg-red-900 border-red-500 text-red-100 animate-pulse' :
            sec >= 480 ? 'bg-amber-900 border-amber-400 text-amber-100' :
                         'bg-matcha-800 border-matcha-500 text-matcha-100';
          return (
            <div
              key={o.id}
              className={cn('flex flex-col items-center rounded-lg border px-2.5 py-1.5 text-center min-w-[64px]', chipColor)}
              title={`${o.kunde_name} · wartet seit ${mm}:${ss}`}
            >
              <span className="font-mono text-[9px] font-black tabular-nums">#{o.bestellnummer.replace(/^FF-/, '').slice(-4)}</span>
              <span className="font-mono text-sm font-black tabular-nums leading-tight">{mm}:{ss}</span>
              {o.delivery_zone && <span className="text-[8px] font-bold opacity-70 truncate max-w-[56px]">{o.delivery_zone}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KitchenSchichtVergleich — Heute vs. gleicher Wochentag letzte Woche
// ---------------------------------------------------------------------------
function KitchenSchichtVergleich() {
  const supabase = createClient();
  const [data, setData] = useState<{ hour: number; heute: number; vorwoche: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const now = new Date();
      const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
      const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999);
      const lwStart    = new Date(todayStart); lwStart.setDate(lwStart.getDate() - 7);
      const lwEnd      = new Date(todayEnd);   lwEnd.setDate(lwEnd.getDate() - 7);

      const [r1, r2] = await Promise.all([
        supabase
          .from('customer_orders')
          .select('erstellt_am')
          .gte('erstellt_am', todayStart.toISOString())
          .lte('erstellt_am', todayEnd.toISOString()),
        supabase
          .from('customer_orders')
          .select('erstellt_am')
          .gte('erstellt_am', lwStart.toISOString())
          .lte('erstellt_am', lwEnd.toISOString()),
      ]);

      const bucket = (rows: { erstellt_am: string }[] | null) => {
        const h = Array(24).fill(0);
        (rows ?? []).forEach(r => { h[new Date(r.erstellt_am).getHours()]++; });
        return h;
      };

      const heute    = bucket(r1.data as { erstellt_am: string }[] | null);
      const vorwoche = bucket(r2.data as { erstellt_am: string }[] | null);
      setData(Array.from({ length: 24 }, (_, i) => ({ hour: i, heute: heute[i], vorwoche: vorwoche[i] })));
      setLoading(false);
    }
    load();
  }, [supabase]);

  if (loading) return null;

  const nowHour = new Date().getHours();
  const totalHeute    = data.reduce((s, d) => s + d.heute, 0);
  const totalVorwoche = data.reduce((s, d) => s + d.vorwoche, 0);
  const trend = totalVorwoche > 0 ? Math.round(((totalHeute - totalVorwoche) / totalVorwoche) * 100) : null;
  const maxVal = Math.max(...data.map(d => Math.max(d.heute, d.vorwoche)), 1);

  // Only show hours with any activity in either week, plus current hour
  const active = data.filter(d => d.heute > 0 || d.vorwoche > 0 || d.hour === nowHour);
  if (active.length === 0) return null;

  return (
    <div className="rounded-xl border border-matcha-700 bg-matcha-900/40 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-white">Heute vs. Vorwoche</span>
        {trend !== null && (
          <span className={cn('text-xs font-bold', trend >= 0 ? 'text-matcha-400' : 'text-red-400')}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <div className="flex items-end gap-0.5 h-14 overflow-x-auto">
        {active.map(d => {
          const isNow = d.hour === nowHour;
          const hPct = Math.round((d.heute / maxVal) * 100);
          const vPct = Math.round((d.vorwoche / maxVal) * 100);
          const barColor = isNow ? 'bg-gold' : d.heute >= d.vorwoche ? 'bg-matcha-500' : 'bg-red-400';
          return (
            <div key={d.hour} className="flex flex-col items-center gap-0.5 flex-1 min-w-[18px]" title={`${d.hour}h: heute ${d.heute}, vorwoche ${d.vorwoche}`}>
              <div className="flex items-end gap-px w-full justify-center" style={{ height: '44px' }}>
                <div className="bg-matcha-700 w-[5px] rounded-sm" style={{ height: `${vPct}%` }} />
                <div className={cn('w-[5px] rounded-sm', barColor)} style={{ height: `${hPct}%` }} />
              </div>
              <span className="text-[7px] text-matcha-400 font-mono">{String(d.hour).padStart(2, '0')}</span>
            </div>
          );
        })}
      </div>
      <div className="flex gap-3 text-[9px] text-matcha-400">
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-matcha-700" /> Vorwoche</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-matcha-500" /> Heute</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-gold" /> Jetzt</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase 94: KitchenPrepSpeedometer — Echtzeit-Küchen-Tempo (Bestellungen/h)
// Zeigt wie viele Bestellungen die Küche in den letzten 30 Min fertiggestellt
// hat (hochgerechnet auf /h) und vergleicht mit dem stündlichen Tagesdurchschnitt.
// ---------------------------------------------------------------------------
function KitchenPrepSpeedometer({ orders }: { orders: Order[] }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();
  const WINDOW_MS = 30 * 60_000; // 30 Minuten

  // Bestellungen die in den letzten 30 Min Status "fertig" oder "unterwegs" erreicht haben
  const recentDone = orders.filter((o) => {
    if (!o.fertig_am) return false;
    return now - new Date(o.fertig_am).getTime() < WINDOW_MS;
  });
  const ratePerHour = recentDone.length * 2; // 30 Min → × 2 = /h

  // Tagesdurchschnitt: alle fertiggestellten Bestellungen seit Mitternacht
  const midnightMs = new Date().setHours(0, 0, 0, 0);
  const hoursElapsed = Math.max(1, (now - midnightMs) / 3_600_000);
  const doneToday = orders.filter((o) => o.fertig_am && new Date(o.fertig_am).getTime() >= midnightMs);
  const avgPerHour = Math.round(doneToday.length / hoursElapsed);

  if (recentDone.length === 0 && doneToday.length === 0) return null;

  const isHot  = ratePerHour >= 8;
  const isWarm = ratePerHour >= 4;
  const speedColor  = isHot ? 'text-matcha-300' : isWarm ? 'text-amber-300' : 'text-red-400';
  const barColor    = isHot ? 'bg-matcha-500'   : isWarm ? 'bg-amber-400'   : 'bg-red-500';
  const borderColor = isHot ? 'border-matcha-700/40' : isWarm ? 'border-amber-500/30' : 'border-red-500/30';
  const bgColor     = isHot ? 'bg-matcha-900/30' : isWarm ? 'bg-amber-900/20' : 'bg-red-900/20';
  const label       = isHot ? '⚡ Spitzentempo' : isWarm ? '→ Normaltempo' : '⚠ Langsam';
  const maxBar      = Math.max(ratePerHour, avgPerHour, 12);

  return (
    <div className={cn('rounded-xl border p-3 space-y-2', bgColor, borderColor)}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-bold text-white">
          <Zap className="h-3.5 w-3.5 text-gold" />
          Küchen-Tempo
        </span>
        <span className={cn('text-[10px] font-bold', speedColor)}>{label}</span>
      </div>

      {/* Aktuelle Rate */}
      <div className="flex items-end gap-1">
        <span className={cn('font-mono text-2xl font-black tabular-nums leading-none', speedColor)}>
          {ratePerHour}
        </span>
        <span className="text-[10px] text-matcha-400 mb-0.5">Best./h jetzt</span>
        {avgPerHour > 0 && (
          <span className="ml-auto text-[10px] text-matcha-400">
            Ø heute: {avgPerHour}/h
          </span>
        )}
      </div>

      {/* Balken-Vergleich */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-matcha-400 w-12 shrink-0">Jetzt</span>
          <div className="flex-1 h-2 rounded-full bg-black/20 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-700', barColor)}
              style={{ width: `${Math.min(100, (ratePerHour / maxBar) * 100)}%` }}
            />
          </div>
          <span className="text-[9px] font-bold text-white w-6 text-right tabular-nums">{ratePerHour}</span>
        </div>
        {avgPerHour > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-matcha-400 w-12 shrink-0">Ø heute</span>
            <div className="flex-1 h-2 rounded-full bg-black/20 overflow-hidden">
              <div
                className="h-full rounded-full bg-matcha-700 transition-all duration-700"
                style={{ width: `${Math.min(100, (avgPerHour / maxBar) * 100)}%` }}
              />
            </div>
            <span className="text-[9px] text-matcha-400 w-6 text-right tabular-nums">{avgPerHour}</span>
          </div>
        )}
      </div>

      <div className="text-[9px] text-matcha-500">
        {recentDone.length} Best. fertig in letzten 30 Min · {doneToday.length} heute gesamt
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase 105: KitchenDriverPickupForecast
// Zeigt in den nächsten 30 Min wann welche Fahrer zum Abholen ankommen.
// Hilft der Küche zu entscheiden wann sie mit dem Kochen aufhören kann.
// ---------------------------------------------------------------------------
function KitchenDriverPickupForecast({
  batches, drivers, stops, orders,
}: {
  batches: Batch[];
  drivers: Driver[];
  stops: Stop[];
  orders: Order[];
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 10_000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();
  const WINDOW_MS = 30 * 60_000;

  // Batches die unterwegs sind und in 30 Min zurückkommen
  type PickupEvent = {
    driverName: string;
    etaMs: number;
    minLeft: number;
    orderIds: string[];
    urgency: 'now' | 'soon' | 'later';
  };

  const upcoming: PickupEvent[] = [];

  for (const b of batches) {
    if (!['unterwegs', 'on_route'].includes(b.status)) continue;
    if (!b.started_at || b.total_eta_min == null) continue;
    const etaMs = new Date(b.started_at).getTime() + b.total_eta_min * 60_000;
    const diff = etaMs - now;
    if (diff < -5 * 60_000 || diff > WINDOW_MS) continue;
    const minLeft = Math.max(0, Math.round(diff / 60_000));
    const driver = drivers.find((d) => d.id === b.driver_id);
    const driverName = driver ? `${driver.vorname} ${driver.nachname[0]}.` : 'Fahrer';
    const batchOrderIds = stops
      .filter((s) => s.batch_id === b.id && !s.geliefert_am)
      .map((s) => s.order_id);
    upcoming.push({
      driverName,
      etaMs,
      minLeft,
      orderIds: batchOrderIds,
      urgency: minLeft <= 5 ? 'now' : minLeft <= 15 ? 'soon' : 'later',
    });
  }

  // Also show free drivers who could be dispatched soon
  const freeDriverCount = drivers.filter((d) => {
    const st = d.status;
    return st?.ist_online && !st.aktueller_batch_id;
  }).length;

  if (upcoming.length === 0 && freeDriverCount === 0) return null;

  upcoming.sort((a, b) => a.etaMs - b.etaMs);

  return (
    <div className="rounded-xl border bg-card p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Bike className="h-4 w-4 text-blue-500 shrink-0" />
        <span className="text-xs font-bold text-foreground">Fahrer-Pickup-Prognose</span>
        <span className="text-[10px] text-muted-foreground ml-auto">nächste 30 Min</span>
      </div>

      {freeDriverCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-matcha-50 border border-matcha-200 px-3 py-1.5 text-[11px]">
          <span className="h-2 w-2 rounded-full bg-matcha-500 shrink-0" />
          <span className="font-bold text-matcha-700">{freeDriverCount} freier Fahrer</span>
          <span className="text-matcha-600">kann sofort für neue Tour eingeplant werden</span>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="space-y-1.5">
          {upcoming.map((ev, i) => {
            const returnTime = new Date(ev.etaMs).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
            const readyOrders = ev.orderIds.map((id) => orders.find((o) => o.id === id)).filter(Boolean);
            const allReady = readyOrders.every((o) => o && ['fertig', 'unterwegs'].includes(o.status));
            return (
              <div key={i} className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 border',
                ev.urgency === 'now'
                  ? 'bg-blue-50 border-blue-300'
                  : ev.urgency === 'soon'
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-muted/40 border-border',
              )}>
                <div className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-black',
                  ev.urgency === 'now' ? 'bg-blue-500 text-white' :
                  ev.urgency === 'soon' ? 'bg-amber-400 text-white' : 'bg-muted text-muted-foreground',
                )}>
                  {ev.urgency === 'now' ? '!' : `${ev.minLeft}m`}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold truncate">{ev.driverName}</span>
                    <span className="text-[10px] text-muted-foreground">~{returnTime} Uhr</span>
                    {ev.orderIds.length > 0 && (
                      <span className="text-[9px] rounded-full bg-blue-100 text-blue-700 px-1.5 py-0.5 font-bold">
                        {ev.orderIds.length} Stopps
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] mt-0.5">
                    {ev.urgency === 'now' ? (
                      <span className="text-blue-700 font-bold animate-pulse">Ankunft in Kürze — Neue Tour bereit?</span>
                    ) : ev.urgency === 'soon' ? (
                      <span className="text-amber-700">Jetzt neue Bestellungen vorbereiten</span>
                    ) : (
                      <span className="text-muted-foreground">Tour läuft noch</span>
                    )}
                  </div>
                </div>
                {allReady && ev.urgency !== 'later' && (
                  <CheckCircle2 className="h-4 w-4 text-matcha-500 shrink-0" aria-label="Alle Bestellungen fertig" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase 117: KitchenOrderUrgencyRail
// Horizontales Urgency-Band — alle aktiven Bestellungen als farbige Chips
// mit Live-Countdown seit Bestelleingang. Sofort-Scan für die Küche.
// Grün > 10 Min, Gelb 5-10 Min, Orange 2-5 Min, Rot < 2 Min, Pulsierend = überfällig
// ---------------------------------------------------------------------------
export function KitchenOrderUrgencyRail({ orders, timings }: { orders: Order[]; timings: KitchenTiming[] }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 5_000);
    return () => clearInterval(iv);
  }, []);

  const active = orders.filter((o) =>
    ['neu', 'bestätigt', 'in_zubereitung', 'fertig'].includes(o.status)
  );
  if (active.length === 0) return null;

  const now = Date.now();

  type ChipData = {
    id: string;
    nr: string;
    status: string;
    elapsedMin: number;
    prepMin: number | null;
    timing: KitchenTiming | undefined;
    remainSec: number | null; // seconds until ready_target
    urgency: 'ok' | 'tight' | 'urgent' | 'critical' | 'done';
  };

  const chips: ChipData[] = active.map((o) => {
    const elapsedMin = o.bestellt_am
      ? Math.floor((now - new Date(o.bestellt_am).getTime()) / 60_000)
      : 0;
    const timing = timings.find((t) => t.order_id === o.id);
    let remainSec: number | null = null;
    if (timing?.ready_target) {
      remainSec = Math.round((new Date(timing.ready_target).getTime() - now) / 1_000);
    }
    const prepMin = o.geschaetzte_zubereitung_min ?? timing?.prep_min ?? null;

    let urgency: ChipData['urgency'] = 'ok';
    if (o.status === 'fertig') {
      urgency = 'done';
    } else if (remainSec !== null) {
      if (remainSec < 0) urgency = 'critical';
      else if (remainSec < 120) urgency = 'urgent';
      else if (remainSec < 300) urgency = 'tight';
      else urgency = 'ok';
    } else if (prepMin !== null) {
      const expectedDoneMin = prepMin - elapsedMin;
      if (expectedDoneMin < 0) urgency = 'critical';
      else if (expectedDoneMin < 2) urgency = 'urgent';
      else if (expectedDoneMin < 5) urgency = 'tight';
      else urgency = 'ok';
    } else {
      if (elapsedMin > 20) urgency = 'critical';
      else if (elapsedMin > 12) urgency = 'urgent';
      else if (elapsedMin > 7) urgency = 'tight';
    }

    return { id: o.id, nr: o.bestellnummer.replace('FF-', ''), status: o.status, elapsedMin, prepMin, timing, remainSec, urgency };
  });

  chips.sort((a, b) => {
    const order = ['critical', 'urgent', 'tight', 'ok', 'done'];
    return order.indexOf(a.urgency) - order.indexOf(b.urgency);
  });

  const urgencyStyle: Record<ChipData['urgency'], { bg: string; text: string; border: string; pulse: boolean }> = {
    critical: { bg: 'bg-red-600',    text: 'text-white',          border: 'border-red-700',    pulse: true  },
    urgent:   { bg: 'bg-orange-500', text: 'text-white',          border: 'border-orange-600', pulse: false },
    tight:    { bg: 'bg-amber-400',  text: 'text-amber-900',      border: 'border-amber-500',  pulse: false },
    ok:       { bg: 'bg-matcha-600', text: 'text-white',          border: 'border-matcha-700', pulse: false },
    done:     { bg: 'bg-matcha-900', text: 'text-matcha-400',     border: 'border-matcha-700', pulse: false },
  };

  const statusIcon: Record<string, string> = {
    neu: '📥', bestätigt: '✓', in_zubereitung: '🔥', fertig: '✅',
  };

  function fmtRemain(sec: number | null): string {
    if (sec === null) return '';
    if (sec < 0) return `+${Math.abs(Math.ceil(sec / 60))}m`;
    const m = Math.floor(sec / 60);
    const s = Math.abs(sec % 60);
    if (m > 0) return `${m}:${String(s).padStart(2, '0')}`;
    return `0:${String(s).padStart(2, '0')}`;
  }

  const critCount = chips.filter((c) => c.urgency === 'critical').length;
  const urgentCount = chips.filter((c) => c.urgency === 'urgent').length;

  return (
    <div className="rounded-xl border border-matcha-700/50 bg-matcha-900/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-matcha-700/40">
        <Flame className="h-3.5 w-3.5 text-orange-400 shrink-0" />
        <span className="text-[10px] font-black uppercase tracking-widest text-matcha-300">
          Urgency-Rail · {active.length} aktiv
        </span>
        {critCount > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-black text-white animate-pulse">
            {critCount} krit.
          </span>
        )}
        {urgentCount > 0 && (
          <span className={cn('rounded-full bg-orange-500 px-2 py-0.5 text-[9px] font-black text-white', critCount === 0 && 'ml-auto')}>
            {urgentCount} dringend
          </span>
        )}
      </div>

      {/* Chip-Rail */}
      <div className="flex gap-2 overflow-x-auto px-3 py-2.5 scrollbar-none">
        {chips.map((chip) => {
          const s = urgencyStyle[chip.urgency];
          return (
            <div
              key={chip.id}
              className={cn(
                'flex-shrink-0 flex flex-col items-center gap-0.5 rounded-xl border px-2.5 py-2 min-w-[60px]',
                s.bg, s.text, s.border,
                chip.urgency === 'critical' && 'animate-pulse',
              )}
            >
              <span className="text-[10px]">{statusIcon[chip.status] ?? '·'}</span>
              <span className="font-mono text-[11px] font-black leading-none tabular-nums">
                #{chip.nr.slice(-4)}
              </span>
              {chip.remainSec !== null ? (
                <span className={cn('font-mono text-[10px] font-bold tabular-nums', chip.remainSec < 0 && 'text-red-200')}>
                  {fmtRemain(chip.remainSec)}
                </span>
              ) : (
                <span className="font-mono text-[10px] tabular-nums opacity-80">
                  {chip.elapsedMin}m
                </span>
              )}
              <span className="text-[8px] opacity-70 leading-none">
                {chip.urgency === 'done' ? 'fertig' : chip.urgency === 'critical' ? 'überfällig' : chip.urgency === 'urgent' ? 'dringend' : chip.urgency === 'tight' ? 'knapp' : 'OK'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ PrepLearningPanel ------------------------------ */

type PrepProfileLocal = {
  hourBucket: number;
  bucketLabel: string;
  observations: number;
  meanPrepMin: number;
  p75PrepMin: number;
  p90PrepMin: number;
  accuracyPct: number;
};

type PrepLearningData = {
  summary: {
    totalObservations: number;
    avgActualMin: number;
    avgDeltaMin: number;
    accuracyPct: number;
  } | null;
  profiles: PrepProfileLocal[];
  currentEstimate: number;
  defaultFallback: number;
};

function PrepLearningPanel({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<PrepLearningData | null>(null);
  const [loading, setLoading] = useState(false);
  const [recomputing, setRecomputing] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || !locationId) return;
    setLoading(true);
    fetch(`/api/delivery/admin/prep-learning?location_id=${locationId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, locationId]);

  async function recompute() {
    if (!locationId) return;
    setRecomputing(true);
    try {
      await fetch('/api/delivery/admin/prep-learning', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'recompute', location_id: locationId }),
      });
      const r = await fetch(`/api/delivery/admin/prep-learning?location_id=${locationId}`);
      if (r.ok) setData(await r.json());
    } catch {}
    finally { setRecomputing(false); }
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">Zubereitungszeit-Lernmodul</span>
          {data?.summary && (
            <span className="rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
              {data.summary.totalObservations} Beob. · ~{Math.round(data.currentEstimate)} Min jetzt
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-5 py-4 space-y-4">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Lade Lernprofil…
            </div>
          )}

          {!loading && data && (
            <>
              <div className="flex items-center gap-4 rounded-xl bg-matcha-50 border border-matcha-200 p-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-matcha-600 text-white font-display text-2xl font-black">
                  {Math.round(data.currentEstimate)}
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-matcha-600">Aktueller p75-Schätzwert</div>
                  <div className="text-sm text-muted-foreground">
                    Fallback: {data.defaultFallback} Min · {data.summary ? `${data.summary.totalObservations} Beobachtungen` : 'Keine Daten'}
                  </div>
                  {data.summary && (
                    <div className="flex items-center gap-3 mt-0.5 text-xs">
                      <span className={cn('font-bold', data.summary.accuracyPct >= 70 ? 'text-matcha-700' : data.summary.accuracyPct >= 50 ? 'text-amber-600' : 'text-red-600')}>
                        Genauigkeit {Math.round(data.summary.accuracyPct)}%
                      </span>
                      <span className="text-muted-foreground">
                        Ø Δ {data.summary.avgDeltaMin > 0 ? '+' : ''}{data.summary.avgDeltaMin.toFixed(1)} Min
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {data.profiles.length > 0 && (
                <div>
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Profil je Tageszeit</div>
                  <div className="space-y-1.5">
                    {data.profiles.map(p => (
                      <div key={p.hourBucket} className="flex items-center gap-2">
                        <span className="w-36 shrink-0 text-[11px] text-muted-foreground truncate">{p.bucketLabel}</span>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn('h-full rounded-full', p.accuracyPct >= 70 ? 'bg-matcha-500' : p.accuracyPct >= 50 ? 'bg-amber-400' : 'bg-red-400')}
                            style={{ width: `${Math.min(100, (p.p75PrepMin / 30) * 100)}%` }}
                          />
                        </div>
                        <span className="w-14 shrink-0 text-right text-[11px] font-bold tabular-nums">
                          {p.p75PrepMin.toFixed(1)} Min
                        </span>
                        <span className="w-10 shrink-0 text-right text-[9px] text-muted-foreground tabular-nums">
                          n={p.observations}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.profiles.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-2">
                  Noch keine Lernprofile — werden nach den ersten Bestellungen aufgebaut.
                </div>
              )}

              <button
                onClick={recompute}
                disabled={recomputing}
                className="inline-flex items-center gap-2 rounded-lg border border-matcha-300 bg-matcha-50 px-3 py-1.5 text-xs font-bold text-matcha-700 hover:bg-matcha-100 disabled:opacity-50 transition"
              >
                {recomputing ? <Loader2 className="h-3 w-3 animate-spin" /> : <TrendingUp className="h-3 w-3" />}
                {recomputing ? 'Neu berechnen…' : 'Profile neu berechnen'}
              </button>
            </>
          )}

          {!loading && !data && locationId && (
            <div className="text-sm text-muted-foreground">Lernmodul nicht verfügbar.</div>
          )}
          {!locationId && (
            <div className="text-sm text-muted-foreground">Bitte Filiale auswählen.</div>
          )}
        </div>
      )}
    </div>
  );
}
