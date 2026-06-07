'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn, euro } from '@/lib/utils';
import {
  Bike,
  Clock,
  ChevronDown,
  ChevronUp,
  History,
  MapPin,
  Package,
  Radio,
  RefreshCw,
  Target,
  TrendingUp,
  Truck,
  Route as RouteIcon,
  User,
  Banknote,
  CreditCard,
  Check,
  Wifi,
  WifiOff,
  Zap,
  AlertTriangle,
  Gift,
  Phone,
  MessageSquare,
} from 'lucide-react';

const DispatchDriverMap = dynamic(
  () => import('./driver-map').then((m) => m.DispatchDriverMap),
  { ssr: false },
);

type Driver = {
  employee_id: string;
  ist_online: boolean;
  fahrzeug: string;
  aktueller_batch_id: string | null;
  last_lat: number | null;
  last_lng: number | null;
  last_update: string | null;
  online_seit: string | null;
  employee: { id: string; vorname: string; nachname: string; avatar_url: string | null; telefon: string | null } | null;
};


type ReadyOrder = {
  id: string;
  bestellnummer: string;
  status: string;
  typ: string;
  kunde_name: string;
  kunde_adresse: string | null;
  kunde_plz: string | null;
  kunde_lat: number | null;
  kunde_lng: number | null;
  gesamtbetrag: number;
  zahlungsart: string;
  fertig_am: string | null;
  external_source: string | null;
  location_id: string | null;
  dispatch_score: number | null;
  delivery_zone: string | null;
  eta_earliest: string | null;
  eta_latest: string | null;
  kunde_notiz: string | null;
  kunde_lieferhinweis: string | null;
};

type Batch = {
  id: string;
  status: string;
  fahrer_id: string | null;
  startzeit?: string | null;
  total_distance_km: number | null;
  total_eta_min: number | null;
  zone: string | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: {
    id: string;
    order_id: string;
    reihenfolge: number;
    geliefert_am: string | null;
    order: { bestellnummer: string; kunde_name: string; kunde_adresse: string | null; eta_earliest: string | null; eta_latest: string | null } | null;
  }[];
};

type Location = { id: string; name: string; lat?: number | null; lng?: number | null };

type ShiftClaimItem = {
  id: string;
  driverName: string | null;
  driverVehicle: string | null;
  plannedStart: string;
  plannedEnd: string;
  status: string;
  notes: string | null;
};

export function DispatchBoard({
  initialOrders,
  initialDrivers,
  initialBatches,
  locations,
}: {
  initialOrders: ReadyOrder[];
  initialDrivers: Driver[];
  initialBatches: Batch[];
  locations: Location[];
}) {
  const supabase = createClient();
  const [orders, setOrders] = useState(initialOrders);
  const [drivers, setDrivers] = useState(initialDrivers);
  const [batches, setBatches] = useState(initialBatches);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [orderSort, setOrderSort] = useState<'wait' | 'zone' | 'score'>('wait');
  const [pending, startTransition] = useTransition();
  const [dispatchPending, setDispatchPending] = useState(false);
  const [etaRefreshing, setEtaRefreshing] = useState(false);
  const [etaRefreshResult, setEtaRefreshResult] = useState<{ orders_updated: number; duration_ms: number } | null>(null);
  const [newOrderFlash, setNewOrderFlash] = useState<{ count: number } | null>(null);
  const prevReadyCountRef = useRef(initialOrders.filter((o) => o.status === 'fertig').length);
  const [kitchenLoad, setKitchenLoad] = useState<{ eta_min: number; load: string; active_orders: number; drivers_online: number } | null>(null);
  const [scheduledSummary, setScheduledSummary] = useState<{ total: number; pending: number; released: number; next_due_in_min: number | null } | null>(null);
  const [scheduledOrders, setScheduledOrders] = useState<{ id: string; bestellnummer: string; kunde_name: string | null; scheduled_at: string; schedule_status: string; mins_until_kitchen_start: number | null }[]>([]);
  const [shiftClaims, setShiftClaims] = useState<ShiftClaimItem[]>([]);
  const [staleOrders, setStaleOrders] = useState<{ id: string; bestellnummer: string; age_min: number; dispatch_attempts: number; escalation_status: string | null; delivery_zone: string | null }[]>([]);

  useEffect(() => {
    const locationId = locations[0]?.id;
    if (!locationId) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/delivery/eta/live?location_id=${locationId}`);
        if (!res.ok) return;
        const d = await res.json();
        if (d?.eta_min != null) setKitchenLoad({ eta_min: d.eta_min, load: d.load ?? 'quiet', active_orders: d.active_orders ?? 0, drivers_online: d.drivers_online ?? 0 });
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 60_000);
    return () => clearInterval(iv);
  }, [locations]);

  useEffect(() => {
    const locationId = locations[0]?.id;
    if (!locationId) return;
    const load = () => {
      fetch(`/api/delivery/admin/scheduled?location_id=${locationId}&hours=4`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d?.summary) setScheduledSummary(d.summary);
          if (d?.orders) setScheduledOrders(d.orders);
        })
        .catch(() => {});
    };
    load();
    const iv = setInterval(load, 120_000);
    return () => clearInterval(iv);
  }, [locations]);

  useEffect(() => {
    const load = () => {
      fetch('/api/delivery/admin/shift-claims')
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (Array.isArray(d?.claims)) setShiftClaims(d.claims); })
        .catch(() => {});
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const locationId = locations[0]?.id;
    if (!locationId) return;
    const load = () => {
      fetch(`/api/delivery/admin/stale-orders?location_id=${locationId}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (Array.isArray(d?.orders)) setStaleOrders(d.orders); })
        .catch(() => {});
    };
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [locations]);

  async function triggerEtaRefresh() {
    setEtaRefreshing(true);
    try {
      const res = await fetch('/api/delivery/admin/eta-refresh', { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (data?.ok) {
        setEtaRefreshResult({ orders_updated: data.orders_updated ?? 0, duration_ms: data.duration_ms ?? 0 });
        setTimeout(() => setEtaRefreshResult(null), 5000);
      }
      await refresh();
    } finally {
      setEtaRefreshing(false);
    }
  }

  async function smartDispatch() {
    setDispatchPending(true);
    try {
      await fetch('/api/delivery/dispatch', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      await refresh();
    } finally {
      setDispatchPending(false);
    }
  }

  useEffect(() => {
    const ch = supabase
      .channel('dispatch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_orders' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_status' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_batches' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_batch_stops' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mise_delivery_batches' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mise_delivery_batch_stops' }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    const [{ data: o }, { data: d }, { data: legacy }, { data: smart }] = await Promise.all([
      supabase
        .from('customer_orders')
        .select('id, bestellnummer, status, typ, kunde_name, kunde_adresse, kunde_plz, kunde_lat, kunde_lng, gesamtbetrag, zahlungsart, fertig_am, external_source, location_id, dispatch_score, delivery_zone, eta_earliest, eta_latest, kunde_notiz, kunde_lieferhinweis')
        .eq('typ', 'lieferung')
        .in('status', ['fertig', 'unterwegs'])
        .order('fertig_am', { ascending: true }),
      supabase
        .from('driver_status')
        .select('*, employee:employees(id, vorname, nachname, avatar_url, telefon)')
        .order('last_update', { ascending: false }),
      supabase
        .from('delivery_batches')
        .select('id, fahrer_id, status, startzeit, total_distance_km, total_eta_min, zone, fahrer:employees(vorname, nachname), stops:delivery_batch_stops(id, order_id, reihenfolge, geliefert_am, order:customer_orders(bestellnummer, kunde_name, kunde_adresse, eta_earliest, eta_latest))')
        .in('status', ['pickup', 'unterwegs'])
        .order('created_at', { ascending: false }),
      supabase
        .from('mise_delivery_batches')
        .select('id, state, driver_id, started_at, total_distance_km, total_eta_min, zone, driver:mise_drivers(id, name), stops:mise_delivery_batch_stops(id, order_id, sequence, completed_at, type, order:customer_orders(bestellnummer, kunde_name, kunde_adresse, eta_earliest, eta_latest))')
        .in('state', ['pending_acceptance', 'assigned', 'at_restaurant', 'on_route'])
        .order('created_at', { ascending: false }),
    ]);
    const newOrders: ReadyOrder[] = (o as any) ?? [];
    const newReadyCount = newOrders.filter((x) => x.status === 'fertig').length;
    if (newReadyCount > prevReadyCountRef.current) {
      setNewOrderFlash({ count: newReadyCount - prevReadyCountRef.current });
      setTimeout(() => setNewOrderFlash(null), 6000);
    }
    prevReadyCountRef.current = newReadyCount;
    setOrders(newOrders);
    setDrivers((d as any) ?? []);
    const normalizedSmart = ((smart ?? []) as any[]).map((b: any) => ({
      id: b.id, status: b.state, fahrer_id: b.driver_id, startzeit: b.started_at ?? null,
      total_distance_km: b.total_distance_km ?? null, total_eta_min: b.total_eta_min ?? null, zone: b.zone ?? null,
      fahrer: b.driver ? { vorname: b.driver.name, nachname: '' } : null,
      stops: ((b.stops ?? []) as any[]).filter((s: any) => s.type === 'dropoff').map((s: any) => ({
        id: s.id, order_id: s.order_id, reihenfolge: s.sequence, geliefert_am: s.completed_at ?? null, order: s.order ?? null,
      })),
    }));
    setBatches([...((legacy ?? []) as any[]), ...normalizedSmart]);
  }

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (locationFilter !== 'all' && o.location_id !== locationFilter) return false;
      return true;
    });
  }, [orders, locationFilter]);

  const readyOrders = useMemo(() => {
    const base = filteredOrders.filter((o) => o.status === 'fertig');
    return [...base].sort((a, b) => {
      if (orderSort === 'zone') return (a.delivery_zone ?? 'Z').localeCompare(b.delivery_zone ?? 'Z');
      if (orderSort === 'score') return (b.dispatch_score ?? 0) - (a.dispatch_score ?? 0);
      // default: wait time (oldest first)
      const aWait = a.fertig_am ? Date.now() - new Date(a.fertig_am).getTime() : 0;
      const bWait = b.fertig_am ? Date.now() - new Date(b.fertig_am).getTime() : 0;
      return bWait - aWait;
    });
  }, [filteredOrders, orderSort]);
  const enRouteOrders = filteredOrders.filter((o) => o.status === 'unterwegs');

  const onlineDrivers = drivers.filter((d) => d.ist_online);
  const offlineDrivers = drivers.filter((d) => !d.ist_online);

  function toggleSelect(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function assignToDriver(fahrerId: string) {
    if (selected.size === 0) return;
    const selectedOrders = readyOrders.filter((o) => selected.has(o.id));
    const locationId = selectedOrders[0]?.location_id ?? null;
    const orderIds = Array.from(selected);

    startTransition(async () => {
      // Bridge-Write: atomisch in Legacy + Mise-System schreiben (via DB-Funktion)
      const { data, error } = await supabase.rpc('assign_to_driver', {
        p_employee_id: fahrerId,
        p_order_ids:   orderIds,
        p_location_id: locationId,
      });

      if (error || !(data as { ok: boolean })?.ok) {
        // Fallback: Legacy-Only-Write wenn RPC nicht verfügbar
        const { data: batch, error: e1 } = await supabase
          .from('delivery_batches')
          .insert({
            location_id: locationId,
            fahrer_id: fahrerId,
            status: 'pickup',
            startzeit: new Date().toISOString(),
            erstellt_von: null,
            auto_erstellt: false,
          })
          .select()
          .single();
        if (e1 || !batch) return;

        const stops = orderIds.map((id, idx) => ({ batch_id: (batch as { id: string }).id, order_id: id, reihenfolge: idx + 1 }));
        await supabase.from('delivery_batch_stops').insert(stops);
        await supabase
          .from('customer_orders')
          .update({ fahrer_id: fahrerId, batch_id: (batch as { id: string }).id, status: 'unterwegs' })
          .in('id', orderIds);
        await supabase
          .from('driver_status')
          .update({ aktueller_batch_id: (batch as { id: string }).id })
          .eq('employee_id', fahrerId);
      }

      setSelected(new Set());
      await refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Neue Bestellung — kurzer Flash wenn neue Ready-Bestellung eintrifft */}
      {newOrderFlash && (
        <div className="flex items-center gap-3 rounded-xl border-2 border-matcha-400 bg-matcha-50 px-4 py-3 shadow-md animate-in slide-in-from-top-2 duration-300">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-matcha-600 text-white">
            <Package className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="font-display text-sm font-bold text-matcha-900">
              {newOrderFlash.count === 1 ? 'Neue Bestellung bereit!' : `${newOrderFlash.count} neue Bestellungen bereit!`}
            </div>
            <div className="text-xs text-matcha-600">Küche meldet Fertig — bitte Fahrer zuweisen</div>
          </div>
          <button onClick={() => setNewOrderFlash(null)} className="text-matcha-400 hover:text-matcha-700 text-lg leading-none">×</button>
        </div>
      )}
      {/* Küchen-Auslastungs-Chip: live ETA + Surge-Indikator */}
      {kitchenLoad && (
        <div className={cn(
          'flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm',
          kitchenLoad.load === 'busy' ? 'border-red-300 bg-red-50 text-red-800' :
          kitchenLoad.load === 'normal' ? 'border-amber-300 bg-amber-50 text-amber-800' :
          'border-matcha-300 bg-matcha-50 text-matcha-800'
        )}>
          <span className={cn(
            'h-2.5 w-2.5 rounded-full animate-pulse',
            kitchenLoad.load === 'busy' ? 'bg-red-500' :
            kitchenLoad.load === 'normal' ? 'bg-amber-500' : 'bg-matcha-500'
          )} />
          <span className="font-semibold">
            {kitchenLoad.load === 'busy' ? 'Küche sehr ausgelastet' :
             kitchenLoad.load === 'normal' ? 'Küche etwas ausgelastet' : 'Küche bereit'}
          </span>
          <span className="text-inherit opacity-70">·</span>
          <span>~{kitchenLoad.eta_min} Min ETA</span>
          <span className="text-inherit opacity-70">·</span>
          <span>{kitchenLoad.active_orders} aktive Bestellungen</span>
          <span className="text-inherit opacity-70">·</span>
          <span>{kitchenLoad.drivers_online} Fahrer online</span>
        </div>
      )}

      {/* Vorbestellungen: nächste 4h Übersicht */}
      {scheduledSummary && scheduledSummary.total > 0 && (
        <ScheduledOrdersPanel summary={scheduledSummary} orders={scheduledOrders} />
      )}

      {/* Schicht-Übersicht: Heutige Lieferleistung */}
      <TodayDispatchOverview
        locationId={locationFilter !== 'all' ? locationFilter : (orders[0]?.location_id ?? locations[0]?.id ?? null)}
        readyCount={readyOrders.length}
        enRouteCount={enRouteOrders.length}
        onlineDrivers={onlineDrivers.length}
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="all">Alle Filialen</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <div className="flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs">
            <Radio className="h-3.5 w-3.5 animate-pulse text-matcha-500" />
            <span className="text-muted-foreground">Live</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Metric icon={<Package className="h-4 w-4" />} label="Bereit" value={readyOrders.length} />
          <Metric icon={<Truck className="h-4 w-4" />} label="Unterwegs" value={enRouteOrders.length} />
          <Metric icon={<Bike className="h-4 w-4" />} label="Online" value={onlineDrivers.length} />
          <Metric icon={<RouteIcon className="h-4 w-4" />} label="Touren" value={batches.length} />
          <button
            onClick={triggerEtaRefresh}
            disabled={etaRefreshing || batches.length === 0}
            title="Live-ETAs aller laufenden Touren neu berechnen"
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition',
              etaRefreshResult
                ? 'border-matcha-400 bg-matcha-50 text-matcha-700'
                : batches.length > 0
                  ? 'border-border bg-card text-muted-foreground hover:bg-muted'
                  : 'border-border bg-muted text-muted-foreground cursor-default opacity-50',
            )}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', etaRefreshing && 'animate-spin')} />
            {etaRefreshResult
              ? `✓ ${etaRefreshResult.orders_updated} ETAs aktualisiert`
              : etaRefreshing ? 'ETAs…' : 'ETAs'}
          </button>
          <button
            onClick={smartDispatch}
            disabled={dispatchPending || readyOrders.length === 0}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-bold transition',
              readyOrders.length > 0
                ? 'bg-matcha-700 text-white hover:bg-matcha-800 border-matcha-700'
                : 'bg-muted text-muted-foreground cursor-default',
            )}
          >
            <Zap className="h-3.5 w-3.5" />
            {dispatchPending ? 'Läuft…' : 'Auto-Dispatch'}
          </button>
        </div>
      </div>

      {/* Unterwegs-ETA-Strip: alle aktiven Lieferungen mit Countdown */}
      {enRouteOrders.length > 0 && <EnRouteEtaStrip orders={enRouteOrders} />}

      {/* Beste nächste Aktion — KI-Empfehlung für Dispatcher */}
      {readyOrders.length > 0 && onlineDrivers.length > 0 && (
        <DispatchNextBestAction
          orders={readyOrders}
          drivers={onlineDrivers}
          batches={batches}
          onAssign={async (orderIds, driverId) => {
            // Direktzuweisung ohne selected-State-Abhängigkeit
            const locationId = readyOrders.find((o) => orderIds.includes(o.id))?.location_id ?? null;
            const { data, error } = await supabase.rpc('assign_to_driver', {
              p_employee_id: driverId,
              p_order_ids:   orderIds,
              p_location_id: locationId,
            });
            if (error || !(data as { ok: boolean })?.ok) {
              // Fallback
              const { data: batch } = await supabase
                .from('delivery_batches')
                .insert({ location_id: locationId, fahrer_id: driverId, status: 'pickup', startzeit: new Date().toISOString(), erstellt_von: null, auto_erstellt: false })
                .select().single();
              if (batch) {
                await supabase.from('delivery_batch_stops').insert(orderIds.map((id, i) => ({ batch_id: (batch as { id: string }).id, order_id: id, reihenfolge: i + 1 })));
                await supabase.from('customer_orders').update({ fahrer_id: driverId, batch_id: (batch as { id: string }).id, status: 'unterwegs' }).in('id', orderIds);
                await supabase.from('driver_status').update({ aktueller_batch_id: (batch as { id: string }).id }).eq('employee_id', driverId);
              }
            }
            await refresh();
          }}
        />
      )}

      {/* Capacity Forecast — nächster freier Fahrer */}
      <CapacityForecastChip batches={batches} onlineDrivers={onlineDrivers} />

      {/* Lieferfenster — vorgebuchte Zeit-Slots für heute */}
      <DeliveryWindowsPanel />

      {/* Schichtanfragen — ausstehende Fahrer-Schichtanmeldungen */}
      <ShiftClaimsPanel claims={shiftClaims} />

      {/* Score + Zone Summary */}
      <DispatchScoreSummary orders={readyOrders} batches={batches} />

      {/* Tour Return Timeline — wann kommen Fahrer zurück? */}
      {batches.length > 0 && <TourReturnTimeline batches={batches} />}

      {/* Fahrer-Schicht-Leaderboard: Stopps, Distanz, ETA-Genauigkeit */}
      <DriverShiftLeaderboard drivers={drivers} batches={batches} />

      {/* Tour-Visualisierung: alle laufenden Touren im Überblick mit Stopp-Details */}
      {batches.length > 0 && <TourVisualizationPanel batches={batches} drivers={drivers} />}

      {/* Fahrer-Tipp: welcher freie Fahrer ist am nächsten zu welcher Zone */}
      <DriverZoneMatchPanel orders={filteredOrders} drivers={drivers} batches={batches} />

      {/* Stale Dispatch: Bestellungen >10 Min ohne Fahrer-Zuweisung (Eskalation) */}
      <StaleOrdersPanel orders={staleOrders} />

      {/* Lange Wartezeiten: Bestellungen >8 Min ohne Fahrer */}
      <LongWaitOrdersPanel orders={readyOrders} onSelect={(id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; })} selected={selected} />

      {/* Verspätungs-Monitor: verspätete Lieferungen + Kompensations-Gutscheine */}
      <DelayMonitorPanel locationId={locationFilter !== 'all' ? locationFilter : (orders[0]?.location_id ?? locations[0]?.id)} />

      {/* Zone Bundling Opportunities */}
      <ZoneBundlingAlert orders={readyOrders} onlineDrivers={onlineDrivers} onSelectZone={(zone) => {
        const ids = readyOrders.filter((o) => o.delivery_zone === zone).map((o) => o.id);
        setSelected(new Set(ids));
      }} />

      {/* Ausstehender Warenwert — Aufschlüsselung nach Zahlungsart + Wartezeit */}
      <PendingValuePanel orders={readyOrders} />

      {/* Live Driver Map */}
      {(() => {
        const loc = locationFilter !== 'all'
          ? locations.find((l) => l.id === locationFilter)
          : locations[0];
        return (
          <LiveDriverMapPanel
            drivers={drivers}
            batches={batches}
            orders={filteredOrders}
            restaurantLat={loc?.lat ?? null}
            restaurantLng={loc?.lng ?? null}
            locationId={loc?.id ?? null}
          />
        );
      })()}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        {/* Left Column: Ready + Active */}
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-matcha-600" />
                <h2 className="font-display text-sm font-bold uppercase tracking-wider">Bereit zur Abholung</h2>
                <Badge variant="secondary">{readyOrders.length}</Badge>
              </div>
              <div className="flex items-center gap-2">
                {selected.size > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {selected.size} ausgewählt · wähle Fahrer rechts
                  </div>
                )}
                <select
                  value={orderSort}
                  onChange={(e) => setOrderSort(e.target.value as 'wait' | 'zone' | 'score')}
                  className="h-7 rounded border bg-background px-2 text-[11px] font-medium text-muted-foreground"
                >
                  <option value="wait">Älteste zuerst</option>
                  <option value="zone">Nach Zone</option>
                  <option value="score">Score ↓</option>
                </select>
              </div>
            </div>
            {readyOrders.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                Alles ausgeliefert. Neue Bestellungen erscheinen hier live.
              </div>
            ) : (
              <div className="divide-y">
                {readyOrders.map((o) => (
                  <OrderRow
                    key={o.id}
                    order={o}
                    selected={selected.has(o.id)}
                    onToggle={() => toggleSelect(o.id)}
                  />
                ))}
              </div>
            )}
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <div className="flex items-center gap-2">
                <RouteIcon className="h-4 w-4 text-matcha-600" />
                <h2 className="font-display text-sm font-bold uppercase tracking-wider">Laufende Touren</h2>
                <Badge variant="secondary">{batches.length}</Badge>
              </div>
            </div>
            {batches.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                Gerade ist niemand unterwegs.
              </div>
            ) : (
              <>
                <ActiveTourSummaryBar batches={batches} />
                <div className="space-y-3 p-4">
                  {batches.map((b) => (
                    <BatchRow key={b.id} batch={b} />
                  ))}
                </div>
              </>
            )}
          </Card>
        </div>

        {/* Right Column: Drivers */}
        <div className="space-y-4">
          {/* Smart Assign — beste Fahrer-Bestellungs-Kombination */}
          <SmartAssignCard
            orders={readyOrders}
            drivers={onlineDrivers}
            batches={batches}
            onSelectOrders={(ids, driverId) => {
              setSelected(new Set(ids));
              assignToDriver(driverId);
            }}
          />

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <div className="flex items-center gap-2">
                <Bike className="h-4 w-4 text-matcha-600" />
                <h2 className="font-display text-sm font-bold uppercase tracking-wider">Fahrer</h2>
              </div>
              <div className="text-xs text-muted-foreground">
                {onlineDrivers.length} online · {offlineDrivers.length} offline
              </div>
            </div>

            <div className="divide-y">
              {onlineDrivers.map((d) => {
                const loc = locationFilter !== 'all'
                  ? locations.find((l) => l.id === locationFilter)
                  : locations[0];
                return (
                  <DriverRow
                    key={d.employee_id}
                    driver={d}
                    activeBatch={batches.find((b) => b.fahrer_id === d.employee_id || b.id === d.aktueller_batch_id) ?? null}
                    canAssign={selected.size > 0 && !d.aktueller_batch_id}
                    busy={pending}
                    onAssign={() => assignToDriver(d.employee_id)}
                    restaurantLat={loc?.lat ?? null}
                    restaurantLng={loc?.lng ?? null}
                  />
                );
              })}
              {onlineDrivers.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Momentan ist kein Fahrer online.
                </div>
              )}

              {offlineDrivers.length > 0 && (
                <details className="group">
                  <summary className="cursor-pointer select-none border-t px-5 py-3 text-xs font-medium text-muted-foreground hover:bg-muted/50">
                    {offlineDrivers.length} Fahrer offline
                  </summary>
                  <div className="divide-y">
                    {offlineDrivers.map((d) => (
                      <DriverRow key={d.employee_id} driver={d} canAssign={false} busy={false} onAssign={() => {}} />
                    ))}
                  </div>
                </details>
              )}
            </div>
          </Card>

          {/* Lieferungs-Chronik */}
          <DeliveryChronikPanel
            locationId={locationFilter !== 'all' ? locationFilter : (orders[0]?.location_id ?? null)}
          />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ DeliveryChronikPanel ------------------------------ */

type ChronikEvent = {
  id: string;
  event_type: string;
  order_id: string | null;
  batch_id: string | null;
  driver_id: string | null;
  payload: Record<string, unknown> | null;
  occurred_at: string;
};

function DeliveryChronikPanel({ locationId }: { locationId: string | null }) {
  const [events, setEvents] = useState<ChronikEvent[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    const load = () => {
      fetch(`/api/delivery/admin/events?location_id=${locationId}&limit=25`)
        .then(r => r.ok ? r.json() : null)
        .then((d: { events?: ChronikEvent[] } | null) => { if (d?.events) setEvents(d.events) })
        .catch(() => {});
    };
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (!events.length) return null;

  const eventMeta = (type: string): { icon: string; label: string; cls: string } => {
    switch (type) {
      case 'order_received':     return { icon: '📦', label: 'Bestellung eingegangen', cls: 'text-blue-600' };
      case 'order_dispatched':   return { icon: '🛵', label: 'Dispatcht', cls: 'text-matcha-700' };
      case 'order_bundled':      return { icon: '📦📦', label: 'Gebündelt', cls: 'text-violet-600' };
      case 'batch_created':      return { icon: '🗺️', label: 'Tour erstellt', cls: 'text-matcha-700' };
      case 'batch_completed':    return { icon: '✅', label: 'Tour abgeschlossen', cls: 'text-emerald-700' };
      case 'stop_delivered':     return { icon: '🏠', label: 'Zugestellt', cls: 'text-emerald-600' };
      case 'driver_online':      return { icon: '🟢', label: 'Fahrer online', cls: 'text-emerald-600' };
      case 'driver_offline':     return { icon: '🔴', label: 'Fahrer offline', cls: 'text-red-600' };
      case 'eta_updated':        return { icon: '⏱', label: 'ETA aktualisiert', cls: 'text-amber-600' };
      case 'kitchen_ready':      return { icon: '🍽', label: 'Küche: Fertig', cls: 'text-matcha-600' };
      case 'kitchen_cooking':    return { icon: '🍳', label: 'Küche: Kochen', cls: 'text-orange-600' };
      case 'batch_optimized':    return { icon: '🔀', label: 'Route optimiert', cls: 'text-blue-600' };
      default:                   return { icon: '•', label: type.replace(/_/g, ' '), cls: 'text-muted-foreground' };
    }
  };

  const relTime = (iso: string) => {
    const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (sec < 60) return `${sec}s`;
    if (sec < 3600) return `${Math.floor(sec / 60)} Min`;
    return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-5 py-3 border-b text-left hover:bg-muted/30 transition"
      >
        <History className="h-4 w-4 text-muted-foreground" />
        <span className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">Chronik</span>
        <span className="ml-2 text-xs text-muted-foreground">{events.length} Ereignisse</span>
        {open ? <ChevronUp className="ml-auto h-4 w-4 text-muted-foreground" /> : <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="max-h-64 overflow-y-auto">
          {events.map(ev => {
            const m = eventMeta(ev.event_type);
            return (
              <div key={ev.id} className="flex items-start gap-3 px-4 py-2 border-b last:border-0 hover:bg-muted/20">
                <span className="text-base shrink-0 mt-0.5">{m.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className={cn('text-xs font-semibold', m.cls)}>{m.label}</div>
                  {(ev.payload as any)?.driver_name && (
                    <div className="text-[10px] text-muted-foreground truncate">
                      {(ev.payload as any).driver_name}
                    </div>
                  )}
                  {(ev.payload as any)?.bestellnummer && (
                    <div className="text-[10px] font-mono text-muted-foreground">
                      #{String((ev.payload as any).bestellnummer).replace('FF-', '')}
                    </div>
                  )}
                </div>
                <span className="text-[10px] tabular-nums text-muted-foreground shrink-0">{relTime(ev.occurred_at)}</span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* ------------------------------ PendingValuePanel ------------------------------ */

function PendingValuePanel({ orders }: { orders: ReadyOrder[] }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  if (orders.length === 0) return null;

  const now = Date.now();
  const totalValue = orders.reduce((s, o) => s + o.gesamtbetrag, 0);

  const byPay = {
    bar:    orders.filter((o) => o.zahlungsart === 'bar'),
    karte:  orders.filter((o) => o.zahlungsart === 'karte'),
    online: orders.filter((o) => !['bar', 'karte'].includes(o.zahlungsart)),
  };

  const longWait  = orders.filter((o) => o.fertig_am && (now - new Date(o.fertig_am).getTime()) >= 10 * 60_000);
  const medWait   = orders.filter((o) => o.fertig_am && (now - new Date(o.fertig_am).getTime()) >= 5 * 60_000 && (now - new Date(o.fertig_am).getTime()) < 10 * 60_000);
  const freshWait = orders.filter((o) => !o.fertig_am || (now - new Date(o.fertig_am).getTime()) < 5 * 60_000);

  const waitTimes = orders.map((o) => o.fertig_am ? Math.floor((now - new Date(o.fertig_am).getTime()) / 60_000) : 0);
  const avgWait = waitTimes.length > 0 ? Math.round(waitTimes.reduce((s, v) => s + v, 0) / waitTimes.length) : 0;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-card px-4 py-2.5">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-matcha-600" />
        <span className="font-display text-base font-black text-matcha-800">{euro(totalValue)}</span>
        <span className="text-xs text-muted-foreground">{orders.length} Bestellungen bereit</span>
      </div>
      <div className="h-4 w-px bg-border hidden sm:block" />
      <div className="flex flex-wrap items-center gap-1.5">
        {byPay.bar.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-bold">
            <Banknote className="h-3 w-3" />
            {byPay.bar.length}× Bar · {euro(byPay.bar.reduce((s, o) => s + o.gesamtbetrag, 0))}
          </span>
        )}
        {byPay.karte.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-[10px] font-bold">
            <CreditCard className="h-3 w-3" />
            {byPay.karte.length}× Karte · {euro(byPay.karte.reduce((s, o) => s + o.gesamtbetrag, 0))}
          </span>
        )}
        {byPay.online.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-matcha-100 text-matcha-800 px-2 py-0.5 text-[10px] font-bold">
            <Wifi className="h-3 w-3" />
            {byPay.online.length}× Online
          </span>
        )}
      </div>
      <div className="h-4 w-px bg-border hidden sm:block" />
      <div className="flex items-center gap-1.5">
        {longWait.length > 0 && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 animate-pulse">
            {longWait.length} &gt;10m
          </span>
        )}
        {medWait.length > 0 && (
          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">
            {medWait.length} 5–10m
          </span>
        )}
        {freshWait.length > 0 && (
          <span className="rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
            {freshWait.length} frisch
          </span>
        )}
        {avgWait > 0 && (
          <span className="text-[10px] tabular-nums text-muted-foreground">⌀ {avgWait}m</span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ ZoneBundlingAlert ------------------------------ */

function ZoneBundlingAlert({
  orders,
  onlineDrivers,
  onSelectZone,
}: {
  orders: ReadyOrder[];
  onlineDrivers: Driver[];
  onSelectZone?: (zone: string) => void;
}) {
  if (orders.length === 0) return null;

  // Gruppiere wartende Bestellungen nach Zone
  const byZone = orders.reduce<Record<string, { orders: ReadyOrder[]; maxWaitMin: number }>>((acc, o) => {
    const zone = o.delivery_zone ?? '?';
    if (!acc[zone]) acc[zone] = { orders: [], maxWaitMin: 0 };
    acc[zone].orders.push(o);
    const waitMin = o.fertig_am ? Math.floor((Date.now() - new Date(o.fertig_am).getTime()) / 60_000) : 0;
    acc[zone].maxWaitMin = Math.max(acc[zone].maxWaitMin, waitMin);
    return acc;
  }, {});

  // Nur Zonen mit ≥2 Bestellungen → Bündeln lohnt sich
  const bundlable = Object.entries(byZone)
    .filter(([, { orders: zos }]) => zos.length >= 2)
    .sort((a, b) => b[1].orders.length - a[1].orders.length);

  if (bundlable.length === 0) return null;

  const freeDrivers = onlineDrivers.filter((d) => !d.aktueller_batch_id);
  const totalBundlable = bundlable.reduce((s, [, { orders: zos }]) => s + zos.length, 0);
  const savingMin = Math.round(bundlable.reduce((s, [, { orders: zos }]) => s + (zos.length - 1) * 7, 0));

  return (
    <div className="rounded-xl border-2 border-matcha-300 bg-matcha-50 p-3">
      <div className="flex items-center gap-2 mb-2">
        <RouteIcon className="h-4 w-4 text-matcha-700" />
        <span className="font-display text-xs font-bold uppercase tracking-wider text-matcha-800">
          Bündelungs-Empfehlung · {totalBundlable} Bestellungen · ~{savingMin} Min gespart
        </span>
        {freeDrivers.length > 0 && (
          <span className="ml-auto text-[10px] font-bold text-matcha-600">
            {freeDrivers.length} freier Fahrer
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {bundlable.map(([zone, { orders: zos, maxWaitMin }]) => {
          const zm = zoneMeta(zone);
          const urgent = maxWaitMin >= 8;
          const totalEur = zos.reduce((s, o) => s + o.gesamtbetrag, 0);
          return (
            <button
              key={zone}
              type="button"
              onClick={() => onSelectZone?.(zone)}
              title={onSelectZone ? `Alle ${zos.length} Bestellungen in Zone ${zone} auswählen` : undefined}
              className={cn(
                'flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-xs text-left transition',
                urgent ? 'border-red-300 bg-red-50 hover:bg-red-100' : 'border-matcha-200 bg-white hover:bg-matcha-50',
                onSelectZone && 'cursor-pointer active:scale-[0.97]',
              )}
            >
              <span className={cn('rounded px-2 py-0.5 text-[11px] font-black', zm.cls)}>
                Zone {zone}
              </span>
              <span className="font-bold">{zos.length}×</span>
              <span className="text-muted-foreground">{euro(totalEur)}</span>
              {maxWaitMin > 0 && (
                <span className={cn(
                  'rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums',
                  urgent ? 'bg-red-500 text-white animate-pulse' : 'bg-muted text-muted-foreground',
                )}>
                  max {maxWaitMin}m
                </span>
              )}
              <span className="rounded-full bg-matcha-100 text-matcha-800 px-1.5 py-0.5 text-[9px] font-bold">
                {onSelectZone ? '→ Alle wählen' : '→ 1 Tour'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ LiveDriverMapPanel ------------------------------ */

function LiveDriverMapPanel({
  drivers,
  batches,
  orders,
  restaurantLat,
  restaurantLng,
  locationId,
}: {
  drivers: Driver[];
  batches: Batch[];
  orders: ReadyOrder[];
  restaurantLat?: number | null;
  restaurantLng?: number | null;
  locationId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [trails, setTrails] = useState<import('./driver-map').DriverTrail[]>([]);

  useEffect(() => {
    if (!open || !locationId) return;
    let cancelled = false;
    const load = () => {
      fetch(`/api/delivery/admin/gps-trails?location_id=${locationId}`)
        .then((r) => r.ok ? r.json() : null)
        .then((d: { drivers?: { driver_id: string; trail_points: { lat: number; lng: number }[] }[] } | null) => {
          if (cancelled || !d?.drivers) return;
          setTrails(
            d.drivers
              .filter((dr) => dr.trail_points.length >= 2)
              .map((dr) => ({ driverId: dr.driver_id, points: dr.trail_points })),
          );
        })
        .catch(() => {});
    };
    load();
    const iv = setInterval(load, 15_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [open, locationId]);

  const onlineWithGps = drivers.filter((d) => d.ist_online && d.last_lat && d.last_lng);
  if (onlineWithGps.length === 0) return null;

  const driverMarkers = onlineWithGps.map((d) => {
    const batch = batches.find((b) => b.fahrer_id === d.employee_id || b.id === d.aktueller_batch_id);
    const total = batch?.stops.length ?? 0;
    const done = batch?.stops.filter((s) => s.geliefert_am).length ?? 0;
    const state: 'frei' | 'unterwegs' | 'zurueck' =
      !batch ? 'frei' : total > 0 && done === total ? 'zurueck' : 'unterwegs';
    return {
      id: d.employee_id,
      name: `${d.employee?.vorname ?? ''} ${d.employee?.nachname ?? ''}`.trim(),
      lat: d.last_lat!,
      lng: d.last_lng!,
      state,
      stopCount: total,
      doneCount: done,
    };
  });

  const orderMarkers = batches.flatMap((b) =>
    b.stops.map((s) => {
      const o = orders.find((x) => x.id === s.order_id);
      if (!o?.kunde_lat || !o?.kunde_lng) return null;
      return {
        id: s.id,
        name: o.kunde_name,
        lat: o.kunde_lat,
        lng: o.kunde_lng,
        done: !!s.geliefert_am,
        seq: s.reihenfolge,
      };
    }).filter(Boolean) as { id: string; name: string; lat: number; lng: number; done: boolean; seq: number }[],
  );

  // Unassigned: fertige Bestellungen die NICHT in einem aktiven Batch sind
  const assignedOrderIds = new Set(batches.flatMap((b) => b.stops.map((s) => s.order_id)));
  const unassignedMarkers = orders
    .filter((o) => o.kunde_lat && o.kunde_lng && !assignedOrderIds.has(o.id))
    .map((o) => ({
      id: o.id,
      name: o.kunde_name,
      lat: o.kunde_lat!,
      lng: o.kunde_lng!,
      zone: o.delivery_zone,
      waitMin: o.fertig_am ? Math.floor((Date.now() - new Date(o.fertig_am).getTime()) / 60_000) : undefined,
    }));

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">Fahrer-Karte</span>
          <Badge variant="secondary">{onlineWithGps.length} aktiv</Badge>
          {unassignedMarkers.length > 0 && (
            <Badge variant="destructive" className="text-[10px]">
              {unassignedMarkers.length} unzugewiesen
            </Badge>
          )}
          <div className="flex gap-1 ml-1">
            {driverMarkers.map((d) => (
              <span
                key={d.id}
                className={cn(
                  'inline-block h-2 w-2 rounded-full',
                  d.state === 'frei' ? 'bg-green-500' :
                  d.state === 'zurueck' ? 'bg-blue-500' :
                  'bg-orange-500',
                )}
              />
            ))}
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="h-[360px] border-t">
          <DispatchDriverMap
            drivers={driverMarkers}
            orders={orderMarkers}
            unassigned={unassignedMarkers}
            restaurantLat={restaurantLat}
            restaurantLng={restaurantLng}
            trails={trails}
          />
        </div>
      )}
    </Card>
  );
}

/* ------------------------------ DispatchScoreSummary ------------------------------ */

function DispatchScoreSummary({ orders, batches }: { orders: ReadyOrder[]; batches: Batch[] }) {
  if (orders.length === 0 && batches.length === 0) return null;

  const scored = orders.filter((o) => o.dispatch_score != null);
  const avgScore = scored.length > 0
    ? Math.round(scored.reduce((s, o) => s + (o.dispatch_score ?? 0), 0) / scored.length)
    : null;

  const zoneCounts: Record<string, number> = {};
  for (const o of orders) {
    if (o.delivery_zone) zoneCounts[o.delivery_zone] = (zoneCounts[o.delivery_zone] ?? 0) + 1;
  }
  const zones = Object.entries(zoneCounts).sort((a, b) => a[0].localeCompare(b[0]));

  const totalStops = batches.reduce((s, b) => s + b.stops.length, 0);
  const doneStops = batches.reduce((s, b) => s + b.stops.filter((st) => st.geliefert_am).length, 0);
  const tourProgress = totalStops > 0 ? Math.round((doneStops / totalStops) * 100) : null;

  const tiers = {
    excellent: scored.filter((o) => (o.dispatch_score ?? 0) >= 80).length,
    good:      scored.filter((o) => (o.dispatch_score ?? 0) >= 60 && (o.dispatch_score ?? 0) < 80).length,
    fair:      scored.filter((o) => (o.dispatch_score ?? 0) >= 40 && (o.dispatch_score ?? 0) < 60).length,
    low:       scored.filter((o) => (o.dispatch_score ?? 0) < 40).length,
  };

  const urgent = orders.filter((o) => o.fertig_am && (Date.now() - new Date(o.fertig_am).getTime()) > 10 * 60_000);

  // Bündelungsrate aus aktiven Touren
  const bundledStops = batches.filter((b) => b.stops.length > 1).reduce((s, b) => s + b.stops.length, 0);
  const singleStops = batches.filter((b) => b.stops.length === 1).length;
  const totalBatchStops = bundledStops + singleStops;
  const bundlingRate = totalBatchStops > 0 ? Math.round((bundledStops / totalBatchStops) * 100) : null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {/* Avg Score Gauge — SVG Halbkreis-Anzeige mit Note */}
      {avgScore !== null && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-4 w-4 text-matcha-600" />
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ø Dispatch-Score</div>
          </div>
          <div className="flex items-center justify-center">
            <ScoreArcGauge score={avgScore} />
          </div>
          {scored.length > 0 && (
            <div className="mt-3">
              <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden">
                {tiers.excellent > 0 && <div className="bg-matcha-500" style={{ width: `${(tiers.excellent / scored.length) * 100}%` }} />}
                {tiers.good > 0 && <div className="bg-blue-400" style={{ width: `${(tiers.good / scored.length) * 100}%` }} />}
                {tiers.fair > 0 && <div className="bg-orange-400" style={{ width: `${(tiers.fair / scored.length) * 100}%` }} />}
                {tiers.low > 0 && <div className="bg-red-400" style={{ width: `${(tiers.low / scored.length) * 100}%` }} />}
              </div>
              <div className="mt-1.5 flex justify-between text-[9px] text-muted-foreground">
                <span className="text-matcha-700 font-bold">{tiers.excellent} A+</span>
                <span className="text-blue-600 font-bold">{tiers.good} B</span>
                <span className="text-orange-600 font-bold">{tiers.fair} C</span>
                <span className="text-red-600 font-bold">{tiers.low} F</span>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Zone Breakdown */}
      {zones.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="h-4 w-4 text-matcha-600" />
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Zonen-Verteilung</div>
          </div>
          <div className="space-y-1.5">
            {zones.map(([zone, count]) => {
              const pct = Math.round((count / orders.length) * 100);
              return (
                <div key={zone} className="flex items-center gap-2">
                  <span className={cn('w-5 text-center rounded text-[10px] font-black shrink-0', zoneMeta(zone).cls)}>{zone}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={cn('h-full rounded-full', zoneMeta(zone).barCls)} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground w-4 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Tour Progress */}
      {tourProgress !== null && batches.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-matcha-600" />
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tour-Fortschritt</div>
          </div>
          <div className="flex items-end gap-2 mb-2">
            <div className="font-display text-3xl font-black leading-none text-matcha-700">{tourProgress}%</div>
            <div className="text-xs text-muted-foreground mb-0.5">{doneStops}/{totalStops} Stopps</div>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', tourProgress === 100 ? 'bg-matcha-500' : tourProgress > 60 ? 'bg-orange-400' : 'bg-blue-400')}
              style={{ width: `${tourProgress}%` }}
            />
          </div>
          <div className="mt-2 text-[10px] text-muted-foreground">{batches.length} aktive Tour{batches.length !== 1 ? 'en' : ''}</div>
        </Card>
      )}

      {/* Revenue on Route */}
      {(() => {
        const onRouteOrders = orders.filter((o) => o.status === 'unterwegs');
        const readyTotal = orders.filter((o) => o.status === 'fertig').reduce((s, o) => s + o.gesamtbetrag, 0);
        const onRouteTotal = onRouteOrders.reduce((s, o) => s + o.gesamtbetrag, 0);
        const combined = readyTotal + onRouteTotal;
        if (combined === 0) return null;
        return (
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Banknote className="h-4 w-4 text-matcha-600" />
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Umsatz unterwegs</div>
            </div>
            <div className="font-display text-2xl font-black leading-none text-matcha-700">{euro(combined)}</div>
            <div className="mt-2 space-y-1 text-[10px] text-muted-foreground">
              {onRouteTotal > 0 && (
                <div className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-400 shrink-0" />
                  {euro(onRouteTotal)} liefert gerade
                </div>
              )}
              {readyTotal > 0 && (
                <div className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-matcha-400 shrink-0" />
                  {euro(readyTotal)} wartet auf Abholung
                </div>
              )}
            </div>
          </Card>
        );
      })()}

      {/* Urgent orders */}
      {urgent.length > 0 && (
        <Card className="p-4 border-red-200 bg-red-50">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-red-600" />
            <div className="text-[10px] font-bold uppercase tracking-wider text-red-700">Warten &gt;10 Min</div>
          </div>
          <div className="font-display text-3xl font-black leading-none text-red-700">{urgent.length}</div>
          <div className="mt-2 space-y-1">
            {urgent.slice(0, 3).map((o) => (
              <div key={o.id} className="text-[10px] text-red-700 font-semibold truncate">
                #{o.bestellnummer.replace('FF-', '')} · {o.kunde_name}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Bündelungsrate */}
      {bundlingRate !== null && totalBatchStops >= 2 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <RouteIcon className="h-4 w-4 text-matcha-600" />
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bündelungsrate</div>
          </div>
          <div className="flex items-end gap-2 mb-2">
            <div className={cn(
              'font-display text-3xl font-black leading-none',
              bundlingRate >= 70 ? 'text-matcha-700' : bundlingRate >= 40 ? 'text-orange-600' : 'text-red-600',
            )}>{bundlingRate}%</div>
            <div className="text-xs text-muted-foreground mb-0.5">gebündelt</div>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', bundlingRate >= 70 ? 'bg-matcha-500' : bundlingRate >= 40 ? 'bg-orange-400' : 'bg-red-400')}
              style={{ width: `${bundlingRate}%` }}
            />
          </div>
          <div className="mt-1.5 text-[9px] text-muted-foreground">{bundledStops} gebündelt · {singleStops} einzeln</div>
        </Card>
      )}

      {/* Score-Verteilung Histogramm */}
      {scored.length >= 2 && (
        <Card className="p-4 sm:col-span-2 lg:col-span-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-matcha-600" />
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Score-Verteilung · {scored.length} Bestellungen</div>
            {avgScore !== null && (
              <span className={cn(
                'ml-auto rounded-full px-2.5 py-0.5 text-[10px] font-black tabular-nums',
                avgScore >= 80 ? 'bg-matcha-100 text-matcha-800' :
                avgScore >= 60 ? 'bg-blue-100 text-blue-800' :
                avgScore >= 40 ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800',
              )}>
                Ø {avgScore}
              </span>
            )}
          </div>
          <div className="flex items-end gap-1 h-16">
            {[
              { lo: 0,  hi: 20,  label: '0–20',  cls: 'bg-red-400',     textCls: 'text-red-700' },
              { lo: 20, hi: 40,  label: '20–40', cls: 'bg-orange-400',  textCls: 'text-orange-700' },
              { lo: 40, hi: 60,  label: '40–60', cls: 'bg-amber-400',   textCls: 'text-amber-700' },
              { lo: 60, hi: 80,  label: '60–80', cls: 'bg-blue-400',    textCls: 'text-blue-700' },
              { lo: 80, hi: 101, label: '80–100',cls: 'bg-matcha-500',  textCls: 'text-matcha-700' },
            ].map((bucket) => {
              const count = scored.filter((o) => {
                const sc = o.dispatch_score ?? 0;
                return sc >= bucket.lo && sc < bucket.hi;
              }).length;
              const maxBucketCount = Math.max(
                ...([0,20,40,60,80].map((lo, _, arr) => {
                  const hi = lo + 20 === 100 ? 101 : lo + 20;
                  return scored.filter((o) => {
                    const sc = o.dispatch_score ?? 0;
                    return sc >= lo && sc < hi;
                  }).length;
                })),
                1,
              );
              const barPct = Math.round((count / maxBucketCount) * 100);
              return (
                <div key={bucket.label} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  {count > 0 && (
                    <span className={cn('text-[9px] font-black tabular-nums', bucket.textCls)}>{count}</span>
                  )}
                  <div className="w-full flex items-end" style={{ height: '44px' }}>
                    <div
                      className={cn('w-full rounded-t transition-all duration-500', bucket.cls, count === 0 && 'opacity-20')}
                      style={{ height: `${Math.max(count === 0 ? 6 : 20, barPct * 0.44)}px` }}
                    />
                  </div>
                  <span className="text-[8px] text-muted-foreground tabular-nums leading-none">{bucket.label}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5">
      <div className="text-muted-foreground">{icon}</div>
      <div>
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="font-display text-sm font-bold leading-none">{value}</div>
      </div>
    </div>
  );
}

function OrderRow({
  order,
  selected,
  onToggle,
}: {
  order: ReadyOrder;
  selected: boolean;
  onToggle: () => void;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const pay = payMeta(order.zahlungsart);
  const waitingMin = order.fertig_am
    ? Math.floor((Date.now() - new Date(order.fertig_am).getTime()) / 60_000)
    : null;
  const waitingSec = order.fertig_am
    ? Math.floor((Date.now() - new Date(order.fertig_am).getTime()) / 1_000)
    : null;
  const urgent = waitingMin !== null && waitingMin >= 10;

  // Live ETA countdown — how long until customer's expected delivery window
  const etaSec = order.eta_earliest
    ? Math.floor((new Date(order.eta_earliest).getTime() - Date.now()) / 1_000)
    : null;
  const etaOverdue = etaSec !== null && etaSec < 0;
  const etaSoon = etaSec !== null && etaSec >= 0 && etaSec < 900; // <15 min

  return (
    <button
      onClick={onToggle}
      className={cn(
        'flex w-full items-center gap-4 px-5 py-3.5 text-left transition hover:bg-muted/40',
        selected && 'bg-matcha-50',
      )}
    >
      <div
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition',
          selected ? 'border-matcha-600 bg-matcha-600 text-white' : 'border-border bg-transparent',
        )}
      >
        {selected && <Check className="h-3 w-3" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-xs font-bold tracking-wide text-matcha-700">
            {order.bestellnummer.replace('FF-', '')}
          </span>
          <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', pay.cls)}>
            {pay.icon} {pay.label}
          </span>
          {order.delivery_zone && (
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', zoneMeta(order.delivery_zone).cls)}>
              {order.delivery_zone}
            </span>
          )}
          {order.dispatch_score != null && (
            <span className={cn('inline-flex flex-col gap-0.5 items-start', scoreMeta(order.dispatch_score).cls)}>
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums', scoreMeta(order.dispatch_score).cls)}>
                ⚡ {Math.round(order.dispatch_score)}
              </span>
              <span className="inline-block h-1 w-14 rounded-full overflow-hidden bg-black/10">
                <span
                  className={cn(
                    'block h-full rounded-full transition-all',
                    order.dispatch_score >= 80 ? 'bg-matcha-500' :
                    order.dispatch_score >= 60 ? 'bg-blue-400' :
                    order.dispatch_score >= 40 ? 'bg-orange-400' : 'bg-red-400',
                  )}
                  style={{ width: `${order.dispatch_score}%` }}
                />
              </span>
            </span>
          )}
          {order.external_source && (
            <span className="rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-matcha-900">
              {order.external_source}
            </span>
          )}
          {urgent && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700">
              wartet {waitingMin}m
            </span>
          )}
          {etaOverdue && (
            <span className="rounded-full bg-red-500 text-white px-2 py-0.5 text-[10px] font-bold animate-pulse">
              ETA überzogen!
            </span>
          )}
          {etaSoon && !etaOverdue && etaSec !== null && (
            <span className="rounded-full bg-orange-100 text-orange-800 px-2 py-0.5 text-[10px] font-bold tabular-nums">
              ETA in {Math.floor(etaSec / 60)}:{String(etaSec % 60).padStart(2, '0')}
            </span>
          )}
          {order.eta_earliest && order.eta_latest && (() => {
            const fmt = (iso: string) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
            return (
              <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[9px] font-medium tabular-nums">
                {fmt(order.eta_earliest)}–{fmt(order.eta_latest)}
              </span>
            );
          })()}
          {/* Urgency ring: visual priority indicator based on dispatch_score */}
          {order.dispatch_score != null && order.dispatch_score >= 70 && (
            <span className={cn(
              'h-2 w-2 rounded-full shrink-0',
              order.dispatch_score >= 90 ? 'bg-red-500 animate-ping' :
              order.dispatch_score >= 80 ? 'bg-orange-500' : 'bg-amber-400',
            )} title={`Score: ${Math.round(order.dispatch_score)}`} />
          )}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="font-semibold">{order.kunde_name}</span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {order.kunde_adresse}
            {order.kunde_plz ? `, ${order.kunde_plz}` : ''}
          </span>
        </div>
        {(order.kunde_notiz || order.kunde_lieferhinweis) && (
          <div className="mt-1 flex items-center gap-1.5 rounded-md bg-amber-50 border border-amber-200 px-2 py-1">
            <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />
            <span className="text-[10px] text-amber-800 leading-snug line-clamp-1">
              {order.kunde_notiz ?? order.kunde_lieferhinweis}
            </span>
          </div>
        )}
      </div>

      <div className="text-right">
        <div className="font-display text-sm font-bold">{euro(order.gesamtbetrag)}</div>
        {waitingSec !== null && (
          <div className={cn(
            'mt-0.5 flex items-center justify-end gap-1 text-[10px] tabular-nums',
            urgent ? 'text-red-600 font-bold' : 'text-muted-foreground',
          )}>
            <Clock className="h-3 w-3" />
            {Math.floor(waitingSec / 60)}:{String(waitingSec % 60).padStart(2, '0')}
          </div>
        )}
      </div>
    </button>
  );
}

type ActiveBatchRef = Pick<Batch, 'startzeit' | 'total_eta_min' | 'stops'>;

function DriverRow({
  driver,
  activeBatch,
  canAssign,
  busy,
  onAssign,
  restaurantLat,
  restaurantLng,
}: {
  driver: Driver;
  activeBatch?: ActiveBatchRef | null;
  canAssign: boolean;
  busy: boolean;
  onAssign: () => void;
  restaurantLat?: number | null;
  restaurantLng?: number | null;
}) {
  const e = driver.employee;
  const initials = e ? `${e.vorname?.[0] ?? ''}${e.nachname?.[0] ?? ''}`.toUpperCase() : '?';
  const vehicleEmoji: Record<string, string> = { bike: '🚲', ebike: '🛵', scooter: '🛴', auto: '🚗' };
  const lastSeen = driver.last_update ? Math.floor((Date.now() - new Date(driver.last_update).getTime()) / 60_000) : null;

  // Live tick for countdown
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!driver.ist_online) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [driver.ist_online]);
  const onlineSince = driver.online_seit
    ? Math.floor((Date.now() - new Date(driver.online_seit).getTime()) / 60_000)
    : null;

  // Return-time estimate from active batch
  const returnInfo = (() => {
    if (!activeBatch?.startzeit || activeBatch.total_eta_min == null) return null;
    const etaMs = new Date(activeBatch.startzeit).getTime() + activeBatch.total_eta_min * 60_000;
    const secLeft = Math.floor((etaMs - Date.now()) / 1000);
    if (secLeft < -600) return null;
    const doneStops = activeBatch.stops.filter((s) => s.geliefert_am).length;
    const totalStops = activeBatch.stops.length;
    const remainingStops = totalStops - doneStops;
    const returnStr = new Date(Math.max(etaMs, Date.now())).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return { secLeft, returnStr, remainingStops, totalStops, doneStops };
  })();

  // Entfernung zum Abholort — nur für freie Fahrer mit GPS
  const distToRestaurant = (() => {
    if (activeBatch) return null;
    if (!driver.ist_online || driver.last_lat == null || driver.last_lng == null) return null;
    if (restaurantLat == null || restaurantLng == null) return null;
    const km = haversineKm(
      { lat: driver.last_lat, lng: driver.last_lng },
      { lat: restaurantLat, lng: restaurantLng },
    );
    const walkMinEstimate = Math.round((km / 15) * 60); // 15 km/h als Fahrad-Tempo
    return { km, walkMinEstimate };
  })();

  return (
    <div className="px-5 py-3">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-matcha-700 font-display text-sm font-bold text-white">
            {initials}
          </div>
          <div
            className={cn(
              'absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-background',
              driver.ist_online ? 'bg-matcha-500' : 'bg-muted',
            )}
          >
            {driver.ist_online ? <Wifi className="h-2 w-2 text-white" /> : <WifiOff className="h-2 w-2 text-white" />}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{e?.vorname} {e?.nachname}</span>
            <span>{vehicleEmoji[driver.fahrzeug] ?? '🚲'}</span>
            {driver.aktueller_batch_id && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">Unterwegs</Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {driver.ist_online ? (
              <>
                <span className="flex items-center gap-1">
                  <Radio className="h-3 w-3 text-matcha-500" /> online
                </span>
                {onlineSince !== null && <span>· {onlineSince} Min</span>}
                {lastSeen !== null && lastSeen > 5 && (
                  <span className={cn(
                    'rounded-full px-1.5 py-0.5 text-[9px] font-bold',
                    lastSeen > 15 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700',
                  )}>
                    GPS vor {lastSeen}m
                  </span>
                )}
                {distToRestaurant && (
                  <span className={cn(
                    'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold',
                    distToRestaurant.km < 0.5 ? 'bg-matcha-100 text-matcha-800' :
                    distToRestaurant.km < 2 ? 'bg-blue-50 text-blue-700' :
                    'bg-muted text-muted-foreground',
                  )} title={`~${distToRestaurant.walkMinEstimate} Min zum Restaurant`}>
                    <MapPin className="h-2.5 w-2.5" />
                    {distToRestaurant.km < 1 ? `${Math.round(distToRestaurant.km * 1000)} m` : `${distToRestaurant.km.toFixed(1)} km`}
                  </span>
                )}
              </>
            ) : (
              <span>offline</span>
            )}
          </div>
        </div>
        {e?.telefon && driver.ist_online && (
          <div className="flex items-center gap-1">
            <a
              href={`tel:${e.telefon}`}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-muted hover:bg-muted/70 text-muted-foreground"
              title="Anrufen"
            >
              <Phone className="h-3.5 w-3.5" />
            </a>
            {(() => {
              const raw = e.telefon!.replace(/\s+/g, '').replace(/[^\d+]/g, '');
              const intl = raw.startsWith('+') ? raw.slice(1) : raw.startsWith('00') ? raw.slice(2) : raw.startsWith('0') ? '49' + raw.slice(1) : '49' + raw;
              const driverName = `${e.vorname} ${e.nachname}`.trim();
              const msg = encodeURIComponent(`Hallo ${e.vorname}! Bitte melde dich kurz beim Dispatch. 🙏`);
              return (
                <a
                  href={`https://wa.me/${intl}?text=${msg}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366]"
                  title={`WhatsApp an ${driverName}`}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                </a>
              );
            })()}
          </div>
        )}
        {canAssign && (
          <Button size="sm" onClick={onAssign} disabled={busy}>
            Zuweisen
          </Button>
        )}
      </div>

      {/* Return countdown for active batch */}
      {returnInfo && (
        <div className="mt-2 pl-[52px]">
          <div className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold',
            returnInfo.secLeft <= 0
              ? 'bg-matcha-100 text-matcha-800 animate-pulse'
              : returnInfo.secLeft < 300
              ? 'bg-orange-100 text-orange-800'
              : 'bg-blue-50 text-blue-700',
          )}>
            <Clock className="h-3 w-3" />
            {returnInfo.secLeft <= 0
              ? `Kommt zurück · ${returnInfo.doneStops}/${returnInfo.totalStops} Stopps`
              : `Zurück ~${returnInfo.returnStr} · ${returnInfo.remainingStops} Stopp${returnInfo.remainingStops !== 1 ? 's' : ''} offen`}
          </div>
          {returnInfo.totalStops > 0 && (
            <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden" style={{ width: 180 }}>
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  returnInfo.secLeft <= 0 ? 'bg-matcha-500' :
                  returnInfo.secLeft < 300 ? 'bg-orange-400' :
                  'bg-blue-400',
                )}
                style={{ width: `${(returnInfo.doneStops / returnInfo.totalStops) * 100}%` }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ EnRouteEtaStrip ------------------------------ */

function EnRouteEtaStrip({ orders }: { orders: ReadyOrder[] }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();
  const enriched = orders
    .filter((o) => o.eta_earliest || o.eta_latest)
    .map((o) => {
      const etaMs = o.eta_earliest ? new Date(o.eta_earliest).getTime() : null;
      const etaLatestMs = o.eta_latest ? new Date(o.eta_latest).getTime() : null;
      const secLeft = etaMs ? Math.floor((etaMs - now) / 1000) : null;
      const etaStr = etaMs ? new Date(etaMs).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : null;
      const overdue = secLeft !== null && secLeft < 0;
      const imminent = !overdue && secLeft !== null && secLeft < 300;
      return { ...o, etaMs, etaLatestMs, secLeft, etaStr, overdue, imminent };
    })
    .sort((a, b) => (a.etaMs ?? 0) - (b.etaMs ?? 0));

  if (enriched.length === 0) return null;

  const overdueCount = enriched.filter((o) => o.overdue).length;
  const imminentCount = enriched.filter((o) => o.imminent).length;

  return (
    <div className={cn(
      'rounded-xl border p-3',
      overdueCount > 0 ? 'border-red-300 bg-red-50' :
      imminentCount > 0 ? 'border-orange-300 bg-orange-50' :
      'border-matcha-200 bg-matcha-50',
    )}>
      <div className="mb-2 flex items-center gap-2">
        <Truck className={cn('h-4 w-4', overdueCount > 0 ? 'text-red-600' : imminentCount > 0 ? 'text-orange-600' : 'text-matcha-700')} />
        <span className={cn(
          'font-display text-xs font-bold uppercase tracking-wider',
          overdueCount > 0 ? 'text-red-800' : imminentCount > 0 ? 'text-orange-800' : 'text-matcha-800',
        )}>
          {enriched.length} Unterwegs
          {overdueCount > 0 && ` · ${overdueCount} überzogen`}
          {imminentCount > 0 && !overdueCount && ` · ${imminentCount} gleich da`}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {enriched.map((o) => {
          const zm = zoneMeta(o.delivery_zone ?? '');
          return (
            <div
              key={o.id}
              className={cn(
                'flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-[11px] min-w-[160px]',
                o.overdue ? 'border-red-400 bg-red-100 animate-pulse' :
                o.imminent ? 'border-orange-400 bg-orange-100' :
                'border-matcha-200 bg-white',
              )}
            >
              <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="font-mono font-bold text-foreground">#{o.bestellnummer.replace('FF-', '')}</span>
                  {o.delivery_zone && (
                    <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-black', zm.cls)}>{o.delivery_zone}</span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground truncate max-w-[100px]">{o.kunde_name}</div>
              </div>
              <div className="ml-auto text-right">
                {o.etaStr && (
                  <div className={cn(
                    'font-mono font-black tabular-nums text-sm',
                    o.overdue ? 'text-red-700' : o.imminent ? 'text-orange-700' : 'text-matcha-700',
                  )}>
                    {o.etaStr}
                  </div>
                )}
                {o.secLeft !== null && (
                  <div className={cn(
                    'text-[9px] font-bold tabular-nums',
                    o.overdue ? 'text-red-600' : o.imminent ? 'text-orange-600' : 'text-muted-foreground',
                  )}>
                    {o.overdue
                      ? `+${Math.floor(-o.secLeft / 60)}:${String((-o.secLeft) % 60).padStart(2, '0')}`
                      : `${Math.floor(o.secLeft / 60)}:${String(o.secLeft % 60).padStart(2, '0')} noch`}
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

/* ------------------------------ SmartAssignCard ------------------------------ */

function SmartAssignCard({
  orders,
  drivers,
  batches,
  onSelectOrders,
}: {
  orders: ReadyOrder[];
  drivers: Driver[];
  batches: Batch[];
  onSelectOrders: (orderIds: string[], driverId: string) => void;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 10_000);
    return () => clearInterval(t);
  }, []);

  const busyIds = new Set(batches.map((b) => b.fahrer_id).filter(Boolean));
  const freeDrivers = drivers.filter((d) => d.ist_online && !busyIds.has(d.employee_id));
  const readyDelivery = orders.filter((o) => o.status === 'fertig' && o.delivery_zone);

  if (freeDrivers.length === 0 || readyDelivery.length === 0) return null;

  // Group orders by zone
  const byZone = readyDelivery.reduce<Record<string, ReadyOrder[]>>((acc, o) => {
    const z = o.delivery_zone!;
    if (!acc[z]) acc[z] = [];
    acc[z].push(o);
    return acc;
  }, {});

  // For each zone, compute centroid
  const zones = Object.entries(byZone).map(([zone, zOrders]) => {
    const lats = zOrders.map((o) => o.kunde_lat).filter((x): x is number => x != null);
    const lngs = zOrders.map((o) => o.kunde_lng).filter((x): x is number => x != null);
    const lat = lats.length > 0 ? lats.reduce((a, b) => a + b, 0) / lats.length : 0;
    const lng = lngs.length > 0 ? lngs.reduce((a, b) => a + b, 0) / lngs.length : 0;
    const maxWaitMin = zOrders.reduce((m, o) => {
      const w = o.fertig_am ? Math.floor((Date.now() - new Date(o.fertig_am).getTime()) / 60_000) : 0;
      return Math.max(m, w);
    }, 0);
    return { zone, orders: zOrders, lat, lng, maxWaitMin };
  });

  // Score each driver-zone pair: lower km + more orders + urgency
  type Rec = { driver: Driver; zone: string; orders: ReadyOrder[]; distKm: number; score: number; maxWaitMin: number };
  const recommendations: Rec[] = [];
  for (const freeDriver of freeDrivers) {
    for (const z of zones) {
      if (!freeDriver.last_lat || !freeDriver.last_lng || !z.lat || !z.lng) continue;
      const distKm = haversineKm(
        { lat: freeDriver.last_lat, lng: freeDriver.last_lng },
        { lat: z.lat, lng: z.lng },
      );
      // Score: more orders → better, less dist → better, more wait → urgent
      const score = z.orders.length * 20 - distKm * 5 + z.maxWaitMin * 3;
      const ordersToAssign = z.orders.slice(0, 3); // max 3 per tour
      recommendations.push({ driver: freeDriver, zone: z.zone, orders: ordersToAssign, distKm, score, maxWaitMin: z.maxWaitMin });
    }
  }
  recommendations.sort((a, b) => b.score - a.score);

  const top = recommendations.slice(0, 2);
  if (top.length === 0) return null;

  return (
    <Card className="overflow-hidden border-matcha-300 bg-matcha-50">
      <div className="flex items-center gap-2 border-b border-matcha-200 px-4 py-3">
        <Zap className="h-4 w-4 text-matcha-700" />
        <span className="font-display text-xs font-bold uppercase tracking-wider text-matcha-800">
          Empfohlene Zuweisung
        </span>
        <span className="ml-auto text-[10px] text-matcha-500">AI-Score</span>
      </div>
      <div className="space-y-2 p-3">
        {top.map((rec, i) => {
          const driverName = rec.driver.employee
            ? `${rec.driver.employee.vorname} ${rec.driver.employee.nachname?.charAt(0) ?? ''}.`
            : `Fahrer ${i + 1}`;
          const zm = zoneMeta(rec.zone);
          const urgency = rec.maxWaitMin >= 10 ? 'animate-pulse border-red-400 bg-red-50' : 'border-matcha-200 bg-white';
          return (
            <div key={`${rec.driver.employee_id}-${rec.zone}`} className={`rounded-xl border-2 p-3 ${urgency}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={cn('rounded px-2 py-0.5 text-[11px] font-black', zm.cls)}>
                  Zone {rec.zone}
                </span>
                <span className="text-xs font-bold text-foreground">{driverName}</span>
                <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
                  {rec.distKm.toFixed(1)} km
                </span>
              </div>
              <div className="flex flex-wrap gap-1 mb-2">
                {rec.orders.map((o) => (
                  <span key={o.id} className="inline-flex items-center gap-1 rounded-md border bg-white px-2 py-0.5 text-[10px] font-semibold">
                    <span className="font-mono">#{o.bestellnummer.replace('FF-', '')}</span>
                    <span className="text-muted-foreground">{o.kunde_name.split(' ')[0]}</span>
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2">
                {rec.maxWaitMin > 0 && (
                  <span className={cn(
                    'text-[9px] font-bold rounded-full px-2 py-0.5',
                    rec.maxWaitMin >= 10 ? 'bg-red-500 text-white' :
                    rec.maxWaitMin >= 5  ? 'bg-amber-400 text-matcha-900' :
                    'bg-muted text-muted-foreground',
                  )}>
                    max {rec.maxWaitMin}m Warte
                  </span>
                )}
                <button
                  className="ml-auto flex items-center gap-1.5 rounded-lg bg-matcha-700 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-matcha-800 active:scale-95"
                  onClick={() => onSelectOrders(rec.orders.map((o) => o.id), rec.driver.employee_id)}
                >
                  <Check className="h-3 w-3" />
                  Zuweisen
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ------------------------------ ActiveTourSummaryBar ------------------------------ */

function ActiveTourSummaryBar({ batches }: { batches: Batch[] }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);

  const totalStops = batches.reduce((s, b) => s + b.stops.length, 0);
  const doneStops  = batches.reduce((s, b) => s + b.stops.filter((st) => st.geliefert_am).length, 0);
  const leftStops  = totalStops - doneStops;
  const pct        = totalStops > 0 ? Math.round((doneStops / totalStops) * 100) : 0;

  const lateBatches = batches.filter((b) => {
    if (!b.startzeit || !b.total_eta_min) return false;
    const etaMs = new Date(b.startzeit).getTime() + b.total_eta_min * 60_000;
    return etaMs < Date.now() && b.stops.some((s) => !s.geliefert_am);
  }).length;

  return (
    <div className="border-b px-4 py-3 bg-matcha-50/50">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[11px] font-bold text-matcha-800 uppercase tracking-wider">
            {batches.length} Tour{batches.length !== 1 ? 'en' : ''} aktiv
          </span>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            <span className="font-bold text-matcha-700">{doneStops}</span>/{totalStops} Stops geliefert
          </span>
          {leftStops > 0 && (
            <span className="text-[11px] text-muted-foreground">
              <span className="font-bold text-blue-700">{leftStops}</span> ausstehend
            </span>
          )}
          {lateBatches > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 animate-pulse">
              ⚠ {lateBatches} überzogen
            </span>
          )}
        </div>
        <span className={cn(
          'text-[11px] font-black tabular-nums rounded-full px-2 py-0.5',
          pct === 100 ? 'bg-matcha-500 text-white' :
          pct >= 60   ? 'bg-blue-100 text-blue-800' :
                        'bg-stone-100 text-stone-700',
        )}>
          {pct}%
        </span>
      </div>
      {/* Combined progress bar with per-tour segments */}
      <div className="flex gap-0.5 h-2 rounded-full overflow-hidden bg-muted">
        {batches.map((b) => {
          const bTotal = b.stops.length;
          const bDone  = b.stops.filter((s) => s.geliefert_am).length;
          const bPct   = bTotal > 0 ? (bTotal / totalStops) * 100 : 0;
          const donePct = bTotal > 0 ? (bDone / bTotal) * 100 : 0;
          return (
            <div
              key={b.id}
              className="relative rounded-sm overflow-hidden bg-muted"
              style={{ width: `${bPct}%` }}
              title={`${b.fahrer?.vorname ?? '?'}: ${bDone}/${bTotal}`}
            >
              <div
                className={cn(
                  'h-full transition-all',
                  donePct === 100 ? 'bg-matcha-500' :
                  donePct > 50   ? 'bg-blue-400' :
                                   'bg-blue-300',
                )}
                style={{ width: `${donePct}%` }}
              />
            </div>
          );
        })}
      </div>
      {/* Per-driver mini badges */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {batches.map((b) => {
          const bTotal = b.stops.length;
          const bDone  = b.stops.filter((s) => s.geliefert_am).length;
          const name   = b.fahrer ? `${b.fahrer.vorname[0]}. ${b.fahrer.nachname}` : '—';
          return (
            <div
              key={b.id}
              className="inline-flex items-center gap-1 rounded-md border bg-white px-2 py-0.5 text-[10px] font-semibold"
              title={name}
            >
              <span className="text-muted-foreground truncate max-w-[60px]">{name}</span>
              <span className={cn(
                'rounded px-1 font-black',
                bDone === bTotal ? 'bg-matcha-100 text-matcha-700' : 'bg-blue-50 text-blue-700',
              )}>
                {bDone}/{bTotal}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BatchRow({ batch }: { batch: Batch }) {
  const fahrer = batch.fahrer ? `${batch.fahrer.vorname} ${batch.fahrer.nachname}`.trim() : 'Unbekannt';
  const total = batch.stops.length;
  const done = batch.stops.filter((s) => s.geliefert_am).length;
  const progress = total > 0 ? (done / total) * 100 : 0;

  const [optimizing, setOptimizing] = useState(false);
  const [optimizeResult, setOptimizeResult] = useState<{ total_eta_min?: number; total_distance_km?: number } | null>(null);

  async function handleOptimize() {
    setOptimizing(true);
    try {
      const res = await fetch(`/api/delivery/tours/${batch.id}/optimize`, { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (data?.ok) setOptimizeResult(data);
    } finally {
      setOptimizing(false);
    }
  }

  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const etaEndMs = batch.startzeit
    ? new Date(batch.startzeit).getTime() + (batch.total_eta_min ?? 0) * 60_000
    : null;
  const etaRemainingSec = etaEndMs ? Math.floor((etaEndMs - Date.now()) / 1000) : null;
  const etaReturnStr = etaEndMs
    ? new Date(etaEndMs).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-matcha-100 text-matcha-700">
            <User className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">{fahrer}</div>
            <div className="text-xs text-muted-foreground">{total} Stops · {done} geliefert</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {batch.zone && (
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase', zoneMeta(batch.zone).cls)}>
              {batch.zone}
            </span>
          )}
          <Badge variant={batch.status === 'unterwegs' ? 'default' : 'secondary'}>{batch.status}</Badge>
        </div>
      </div>

      {/* Tour-Metriken */}
      <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
        {batch.startzeit && (() => {
          const totalSec = Math.floor((Date.now() - new Date(batch.startzeit).getTime()) / 1000);
          const m = Math.floor(totalSec / 60);
          const s = totalSec % 60;
          return (
            <span className="flex items-center gap-1 text-muted-foreground tabular-nums">
              <Clock className="h-3 w-3" />
              {m}:{String(s).padStart(2, '0')} unterwegs
            </span>
          );
        })()}
        {batch.total_distance_km != null && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <RouteIcon className="h-3 w-3" />
            {batch.total_distance_km.toFixed(1)} km
          </span>
        )}
        {batch.total_eta_min != null && (
          <span className="flex items-center gap-1 font-bold text-matcha-700">
            <Clock className="h-3 w-3" />
            ~{batch.total_eta_min} Min ETA
          </span>
        )}
      </div>

      {etaRemainingSec !== null && (
        <div className={cn(
          'mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold',
          etaRemainingSec > 300 ? 'bg-matcha-100 text-matcha-800' :
          etaRemainingSec > 60 ? 'bg-orange-100 text-orange-800' :
          'bg-red-100 text-red-800 animate-pulse',
        )}>
          <Clock className="h-3 w-3" />
          {etaRemainingSec > 0
            ? `Fertig in ${Math.floor(etaRemainingSec / 60)}:${String(etaRemainingSec % 60).padStart(2, '0')}`
            : `+${Math.floor(-etaRemainingSec / 60)}:${String((-etaRemainingSec) % 60).padStart(2, '0')} überzogen`}
          {etaReturnStr && etaRemainingSec > 0 && (
            <span className="ml-1 opacity-70">· ~{etaReturnStr} Uhr</span>
          )}
        </div>
      )}

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full transition-all',
            progress === 100 ? 'bg-matcha-500' : progress > 60 ? 'bg-orange-500' : 'bg-blue-500',
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
      {/* Visual stop timeline */}
      <div className="mt-3">
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {batch.stops
            .sort((a, b) => a.reihenfolge - b.reihenfolge)
            .map((s, idx, arr) => {
              const isDone = !!s.geliefert_am;
              const isNext = !isDone && arr.slice(0, idx).every((p) => !!p.geliefert_am);
              // ETA: echte `eta_earliest` aus der Bestellung, Fallback: proportionale Schätzung
              const stopEtaStr = (() => {
                if (isDone) return null;
                if (s.order?.eta_earliest) {
                  const etaMs = new Date(s.order.eta_earliest).getTime();
                  const isOverdue = etaMs < Date.now();
                  const str = new Date(s.order.eta_earliest).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                  return isOverdue ? `!${str}` : str;
                }
                if (batch.startzeit && batch.total_eta_min != null && total > 0) {
                  return new Date(
                    new Date(batch.startzeit).getTime() +
                    ((idx + 1) / total) * batch.total_eta_min * 60_000,
                  ).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                }
                return null;
              })();
              const isEtaOverdue = s.order?.eta_earliest
                ? new Date(s.order.eta_earliest).getTime() < Date.now()
                : false;
              return (
                <div key={s.id} className="flex items-center gap-1 shrink-0">
                  <div className={cn(
                    'flex flex-col items-center',
                  )}>
                    <div className={cn(
                      'h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold border-2 transition',
                      isDone ? 'border-matcha-400 bg-matcha-100 text-matcha-700' :
                      isNext ? 'border-orange-400 bg-orange-50 text-orange-800 ring-2 ring-orange-200' :
                      'border-border bg-card text-muted-foreground',
                    )}>
                      {isDone ? <Check className="h-3.5 w-3.5 text-matcha-600" /> : s.reihenfolge}
                    </div>
                    <div
                      className="mt-1 w-20 text-center text-[9px] leading-tight truncate text-muted-foreground font-medium"
                      title={[s.order?.kunde_name, s.order?.kunde_adresse].filter(Boolean).join(' · ')}
                    >
                      {s.order?.kunde_name ?? '—'}
                    </div>
                    {s.order?.kunde_adresse && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.order.kunde_adresse)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="block w-20 text-center text-[8px] leading-tight truncate text-muted-foreground/60 hover:text-matcha-600 hover:underline transition"
                        title={`In Google Maps öffnen: ${s.order.kunde_adresse}`}
                      >
                        {s.order.kunde_adresse.split(',')[0]}
                      </a>
                    )}
                    {stopEtaStr && (
                      <div className={cn(
                        'text-[8px] tabular-nums text-center font-bold',
                        isEtaOverdue ? 'text-red-600 animate-pulse' :
                        isNext ? 'text-orange-600' :
                        'text-muted-foreground/60',
                      )}>
                        {isEtaOverdue ? stopEtaStr : `~${stopEtaStr}`}
                      </div>
                    )}
                  </div>
                  {idx < arr.length - 1 && (
                    <div className={cn(
                      'h-0.5 w-5 rounded-full shrink-0 mb-4',
                      isDone ? 'bg-matcha-400' : 'bg-border',
                    )} />
                  )}
                </div>
              );
            })}
        </div>
      </div>
      <div className="mt-1 flex items-center gap-2 text-xs flex-wrap">
        <span className={cn(
          'rounded-full px-2 py-0.5 font-bold',
          progress === 100 ? 'bg-matcha-100 text-matcha-800' :
          progress > 50 ? 'bg-orange-100 text-orange-800' :
          'bg-blue-100 text-blue-800',
        )}>
          {done}/{total} · {Math.round(progress)}%
        </span>

        {/* Google Maps Route für alle offenen Stops */}
        {(() => {
          const openStops = batch.stops
            .filter((s) => !s.geliefert_am && s.order?.kunde_adresse)
            .sort((a, b) => a.reihenfolge - b.reihenfolge);
          if (openStops.length === 0) return null;
          const addrs = openStops.map((s) => encodeURIComponent(s.order!.kunde_adresse!));
          const dest = addrs[addrs.length - 1];
          const waypoints = addrs.slice(0, -1).join('|');
          const mapsUrl = waypoints
            ? `https://www.google.com/maps/dir/?api=1&destination=${dest}&waypoints=${waypoints}&travelmode=driving`
            : `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
          return (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full bg-matcha-50 border border-matcha-200 px-2.5 py-0.5 text-[10px] font-bold text-matcha-700 hover:bg-matcha-100 transition"
              title="Route in Google Maps öffnen"
            >
              <MapPin className="h-3 w-3" />
              Route öffnen
            </a>
          );
        })()}

        {/* Re-Optimieren: nur wenn Tour noch nicht abgeschlossen */}
        {progress < 100 && (
          <button
            onClick={handleOptimize}
            disabled={optimizing}
            title="Route neu optimieren"
            className={cn(
              'ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold transition',
              optimizeResult
                ? 'bg-matcha-100 text-matcha-800'
                : 'bg-muted text-muted-foreground hover:bg-matcha-100 hover:text-matcha-800',
            )}
          >
            <RefreshCw className={cn('h-3 w-3', optimizing && 'animate-spin')} />
            {optimizing
              ? 'Optimiert…'
              : optimizeResult
                ? `✓ ${optimizeResult.total_eta_min ?? '?'} Min · ${optimizeResult.total_distance_km?.toFixed(1) ?? '?'} km`
                : 'Route optimieren'}
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ DriverZoneMatchPanel ------------------------------ */

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function DriverZoneMatchPanel({
  orders,
  drivers,
  batches,
}: {
  orders: ReadyOrder[];
  drivers: Driver[];
  batches: Batch[];
}) {
  const busyDriverIds = new Set(batches.map((b) => b.fahrer_id).filter(Boolean));
  const freeDriversWithGps = drivers.filter(
    (d) => d.ist_online && !busyDriverIds.has(d.employee_id) && d.last_lat != null && d.last_lng != null,
  );
  const readyOrders = orders.filter((o) => o.status === 'fertig' && o.delivery_zone);

  if (freeDriversWithGps.length === 0 || readyOrders.length === 0) return null;

  // Zone centroids
  const byZone = readyOrders.reduce<Record<string, { lats: number[]; lngs: number[]; count: number }>>((acc, o) => {
    if (!o.delivery_zone || !o.kunde_lat || !o.kunde_lng) return acc;
    if (!acc[o.delivery_zone]) acc[o.delivery_zone] = { lats: [], lngs: [], count: 0 };
    acc[o.delivery_zone].lats.push(o.kunde_lat);
    acc[o.delivery_zone].lngs.push(o.kunde_lng);
    acc[o.delivery_zone].count++;
    return acc;
  }, {});

  const zoneCentroids = Object.entries(byZone).map(([zone, { lats, lngs, count }]) => ({
    zone,
    count,
    lat: lats.reduce((a, b) => a + b, 0) / lats.length,
    lng: lngs.reduce((a, b) => a + b, 0) / lngs.length,
  }));

  if (zoneCentroids.length === 0) return null;

  // For each zone, find closest free driver
  const matches = zoneCentroids.map(({ zone, count, lat, lng }) => {
    const closest = freeDriversWithGps
      .map((d) => ({ d, km: haversineKm({ lat: d.last_lat!, lng: d.last_lng! }, { lat, lng }) }))
      .sort((a, b) => a.km - b.km)[0];
    return { zone, count, closest };
  }).sort((a, b) => a.zone.localeCompare(b.zone));

  return (
    <div className="rounded-xl border border-matcha-200 bg-matcha-50/60 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Target className="h-4 w-4 text-matcha-700" />
        <span className="font-display text-xs font-bold uppercase tracking-wider text-matcha-800">
          Fahrer-Tipp · GPS-Nähe zu Zonen
        </span>
        <span className="ml-auto text-[10px] text-matcha-500">{freeDriversWithGps.length} freie Fahrer</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {matches.map(({ zone, count, closest }) => {
          const zm = zoneMeta(zone);
          const name = closest?.d.employee
            ? `${closest.d.employee.vorname} ${closest.d.employee.nachname?.charAt(0)}.`
            : '—';
          const kmStr = closest ? `${closest.km.toFixed(1)} km` : '—';
          const kmColor = closest && closest.km < 1 ? 'text-matcha-700' : closest && closest.km < 3 ? 'text-orange-700' : 'text-red-600';
          return (
            <div key={zone} className="flex items-center gap-2 rounded-lg border border-matcha-200 bg-white px-3 py-2 text-xs">
              <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-black', zm.cls)}>
                {zone}
              </span>
              <span className="font-bold text-foreground">{count}×</span>
              <span className="text-muted-foreground">→</span>
              <span className="font-semibold text-foreground">{name}</span>
              <span className={cn('text-[10px] font-bold tabular-nums', kmColor)}>{kmStr}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ CapacityForecastChip ------------------------------ */

function CapacityForecastChip({
  batches,
  onlineDrivers,
}: {
  batches: Batch[];
  onlineDrivers: Driver[];
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();

  // Drivers currently on a tour
  const busyDriverIds = new Set(batches.map((b) => b.fahrer_id).filter(Boolean));
  const freeDrivers = onlineDrivers.filter((d) => !busyDriverIds.has(d.employee_id));

  // Earliest return from active tours
  const nextReturn = batches
    .map((b) => {
      if (!b.startzeit || b.total_eta_min == null) return null;
      return new Date(b.startzeit).getTime() + b.total_eta_min * 60_000;
    })
    .filter((ms): ms is number => ms != null && ms > now)
    .sort((a, b) => a - b)[0] ?? null;

  const fmtTime = (ms: number) =>
    new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  const minLeft = nextReturn ? Math.ceil((nextReturn - now) / 60_000) : null;

  if (freeDrivers.length === 0 && nextReturn == null && batches.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-2.5 text-sm">
      <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
        <Bike className="h-4 w-4 text-matcha-500" />
        <span>Kapazität</span>
      </div>

      {freeDrivers.length > 0 ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-matcha-100 px-2.5 py-0.5 text-xs font-semibold text-matcha-800">
          <span className="h-1.5 w-1.5 rounded-full bg-matcha-500 inline-block" />
          {freeDrivers.length} Fahrer sofort verfügbar
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block" />
          Alle Fahrer unterwegs
        </span>
      )}

      {nextReturn != null && (
        <span className="text-xs text-muted-foreground">
          Nächster frei:{' '}
          <span className="font-semibold text-foreground">
            ~{fmtTime(nextReturn)}
          </span>
          {minLeft != null && minLeft > 0 && (
            <span className="ml-1 text-muted-foreground">(in {minLeft} Min)</span>
          )}
        </span>
      )}

      {batches.length > 0 && (
        <span className="ml-auto text-xs text-muted-foreground">
          {batches.length} aktive Tour{batches.length !== 1 ? 'en' : ''}
        </span>
      )}
    </div>
  );
}

/* ------------------------------ TourReturnTimeline ------------------------------ */

function TourReturnTimeline({ batches }: { batches: Batch[] }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 10_000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();

  // Collect tours with return ETA
  const tours = batches
    .map((b) => {
      const etaMs = b.startzeit && b.total_eta_min != null
        ? new Date(b.startzeit).getTime() + b.total_eta_min * 60_000
        : null;
      const doneStops = b.stops.filter((s) => s.geliefert_am).length;
      const totalStops = b.stops.length;
      const fahrer = b.fahrer ? `${b.fahrer.vorname} ${b.fahrer.nachname}`.trim() : 'Unbekannt';
      const secLeft = etaMs ? Math.floor((etaMs - now) / 1000) : null;
      const progress = totalStops > 0 ? Math.round((doneStops / totalStops) * 100) : 0;
      return { id: b.id, fahrer, etaMs, secLeft, doneStops, totalStops, progress, zone: b.zone };
    })
    .sort((a, b) => {
      if (a.etaMs && b.etaMs) return a.etaMs - b.etaMs;
      if (a.etaMs) return -1;
      if (b.etaMs) return 1;
      return 0;
    });

  if (tours.length === 0) return null;

  // Compute timeline window: now → max return ETA + 10 min
  const maxEtaMs = tours.reduce((m, t) => (t.etaMs && t.etaMs > m ? t.etaMs : m), now + 30 * 60_000);
  const windowStart = now;
  const windowEnd = maxEtaMs + 10 * 60_000;
  const windowMs = windowEnd - windowStart;

  function toTimePct(ms: number | null): number {
    if (ms == null) return 0;
    return Math.max(0, Math.min(100, ((ms - windowStart) / windowMs) * 100));
  }

  const fmtTime = (ms: number) =>
    new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="h-4 w-4 text-matcha-600" />
        <span className="font-display text-xs font-bold uppercase tracking-wider">Rückkehr-Timeline</span>
        <span className="ml-auto text-[10px] text-muted-foreground">Jetzt → {fmtTime(maxEtaMs)}</span>
      </div>

      {/* Time axis */}
      <div className="relative mb-1">
        {/* Now line */}
        <div className="absolute top-0 bottom-0 w-0.5 bg-matcha-500" style={{ left: '0%' }} />
        <div className="text-[9px] text-matcha-600 font-bold ml-1 mb-1">Jetzt</div>

        {/* Tour rows */}
        <div className="space-y-2 mt-2">
          {tours.map((tour) => {
            const etaPct = toTimePct(tour.etaMs);
            const isOverdue = tour.secLeft != null && tour.secLeft < 0;
            const isSoon = tour.secLeft != null && tour.secLeft >= 0 && tour.secLeft < 300;

            return (
              <div key={tour.id} className="relative flex items-center gap-2">
                {/* Label */}
                <div className="w-24 shrink-0 text-[10px] font-semibold text-right truncate pr-1">
                  {tour.fahrer}
                </div>

                {/* Bar container */}
                <div className="flex-1 relative h-5 rounded-full bg-muted overflow-hidden">
                  {/* Progress fill */}
                  <div
                    className={cn(
                      'absolute inset-y-0 left-0 rounded-full transition-all',
                      tour.progress === 100 ? 'bg-matcha-400' :
                      isOverdue ? 'bg-red-400' :
                      isSoon ? 'bg-orange-400 animate-pulse' :
                      'bg-blue-400',
                    )}
                    style={{ width: `${tour.progress}%` }}
                  />

                  {/* Return ETA marker */}
                  {tour.etaMs && (
                    <div
                      className={cn(
                        'absolute top-0.5 bottom-0.5 w-1 rounded-full',
                        isOverdue ? 'bg-red-600' : isSoon ? 'bg-orange-600' : 'bg-matcha-700',
                      )}
                      style={{ left: `calc(${etaPct}% - 2px)` }}
                      title={`ETA: ${fmtTime(tour.etaMs)}`}
                    />
                  )}

                  {/* Stop counter */}
                  <div className="absolute inset-0 flex items-center px-2 justify-between">
                    <span className="text-[9px] font-bold text-white drop-shadow">
                      {tour.doneStops}/{tour.totalStops}
                    </span>
                    {tour.zone && (
                      <span className={cn(
                        'text-[9px] font-black rounded px-1',
                        zoneMeta(tour.zone).cls,
                      )}>
                        {tour.zone}
                      </span>
                    )}
                  </div>
                </div>

                {/* ETA label */}
                <div className={cn(
                  'w-14 shrink-0 text-[10px] font-bold tabular-nums text-right',
                  isOverdue ? 'text-red-600' : isSoon ? 'text-orange-600' : 'text-muted-foreground',
                )}>
                  {tour.etaMs
                    ? (isOverdue
                      ? `+${Math.floor(-tour.secLeft! / 60)}m`
                      : `~${fmtTime(tour.etaMs)}`)
                    : '—'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-400 shrink-0" /> Unterwegs</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-400 shrink-0" /> Kommt bald</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-matcha-400 shrink-0" /> Abgeschlossen</span>
      </div>
    </div>
  );
}

function payMeta(z: string) {
  switch (z) {
    case 'bar':
      return { label: 'Bar', icon: <Banknote className="h-3 w-3" />, cls: 'bg-accent/20 text-matcha-900' };
    case 'karte':
      return { label: 'Karte', icon: <CreditCard className="h-3 w-3" />, cls: 'bg-blue-100 text-blue-800' };
    case 'online':
    case 'stripe':
      return { label: 'Bezahlt', icon: <Check className="h-3 w-3" />, cls: 'bg-matcha-700 text-white' };
    default:
      return { label: z, icon: null, cls: 'bg-muted text-muted-foreground' };
  }
}

function zoneMeta(zone: string | null): { cls: string; barCls: string } {
  switch (zone) {
    case 'A': return { cls: 'bg-green-100 text-green-800',   barCls: 'bg-green-400' };
    case 'B': return { cls: 'bg-blue-100 text-blue-800',     barCls: 'bg-blue-400' };
    case 'C': return { cls: 'bg-orange-100 text-orange-800', barCls: 'bg-orange-400' };
    case 'D': return { cls: 'bg-red-100 text-red-800',       barCls: 'bg-red-400' };
    default:  return { cls: 'bg-muted text-muted-foreground', barCls: 'bg-muted-foreground' };
  }
}

function ScoreArcGauge({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score)) / 100;
  const r = 34;
  const arc = Math.PI * r; // semicircle circumference
  const color =
    score >= 80 ? '#2d6b45' :
    score >= 60 ? '#2563eb' :
    score >= 40 ? '#f97316' :
                  '#ef4444';
  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 65 ? 'C' : score >= 50 ? 'D' : 'F';
  const gradeColor =
    grade === 'A' || grade === 'B' ? 'text-matcha-700' :
    grade === 'C' ? 'text-blue-600' :
    grade === 'D' ? 'text-orange-600' :
                    'text-red-600';

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="88" height="52" viewBox="0 0 88 52" className="overflow-visible">
        {/* Track */}
        <path
          d={`M 10 44 A ${r} ${r} 0 0 1 78 44`}
          fill="none"
          stroke="rgba(0,0,0,0.08)"
          strokeWidth="7"
          strokeLinecap="round"
        />
        {/* Progress */}
        <path
          d={`M 10 44 A ${r} ${r} 0 0 1 78 44`}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={arc}
          strokeDashoffset={arc * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 1.2s ease, stroke 0.5s' }}
        />
        {/* Score label */}
        <text x="44" y="40" textAnchor="middle" fontSize="16" fontWeight="800" fill={color} fontFamily="sans-serif">
          {Math.round(score)}
        </text>
      </svg>
      <span className={cn('font-display text-3xl font-black leading-none -mt-2', gradeColor)}>
        {grade}
      </span>
      <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
        {grade === 'A' ? 'Exzellent' : grade === 'B' ? 'Sehr gut' : grade === 'C' ? 'Gut' : grade === 'D' ? 'Befriedigend' : 'Verbesserung nötig'}
      </span>
    </div>
  );
}

function scoreMeta(score: number): { cls: string } {
  if (score >= 80) return { cls: 'bg-matcha-100 text-matcha-800' };
  if (score >= 60) return { cls: 'bg-blue-100 text-blue-800' };
  if (score >= 40) return { cls: 'bg-orange-100 text-orange-800' };
  return { cls: 'bg-red-100 text-red-800' };
}

/* ------------------------------ LongWaitOrdersPanel ------------------------------ */

function LongWaitOrdersPanel({
  orders,
  onSelect,
  selected,
}: {
  orders: ReadyOrder[];
  onSelect: (id: string) => void;
  selected: Set<string>;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 10_000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();
  const THRESHOLD_MIN = 8;

  const longWait = orders
    .filter((o) => o.fertig_am && Math.floor((now - new Date(o.fertig_am).getTime()) / 60_000) >= THRESHOLD_MIN)
    .sort((a, b) => {
      const aWait = a.fertig_am ? now - new Date(a.fertig_am).getTime() : 0;
      const bWait = b.fertig_am ? now - new Date(b.fertig_am).getTime() : 0;
      return bWait - aWait;
    });

  if (longWait.length === 0) return null;

  const totalValue = longWait.reduce((s, o) => s + o.gesamtbetrag, 0);

  return (
    <div className="rounded-xl border-2 border-red-400 bg-red-50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Clock className="h-4 w-4 text-red-600 animate-pulse" />
        <span className="font-display text-xs font-bold uppercase tracking-wider text-red-800">
          Wartet zu lang · {longWait.length}× &gt;{THRESHOLD_MIN} Min · {euro(totalValue)}
        </span>
        <span className="ml-auto text-[10px] font-bold text-red-600">
          Sofort dispatchen!
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {longWait.map((o) => {
          const waitMin = o.fertig_am
            ? Math.floor((now - new Date(o.fertig_am).getTime()) / 60_000)
            : 0;
          const waitSec = o.fertig_am
            ? Math.floor((now - new Date(o.fertig_am).getTime()) / 1000)
            : 0;
          const isSel = selected.has(o.id);
          const isCritical = waitMin >= 15;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onSelect(o.id)}
              className={cn(
                'flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-xs text-left transition active:scale-[0.97]',
                isSel
                  ? 'border-matcha-600 bg-matcha-100'
                  : isCritical
                  ? 'border-red-500 bg-white animate-pulse'
                  : 'border-red-300 bg-white hover:border-red-500',
              )}
            >
              {isSel && <Check className="h-3 w-3 text-matcha-700 shrink-0" />}
              <span className="font-mono font-bold text-foreground">
                #{o.bestellnummer.replace('FF-', '')}
              </span>
              {o.delivery_zone && (
                <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-black', zoneMeta(o.delivery_zone).cls)}>
                  {o.delivery_zone}
                </span>
              )}
              <span className="font-medium text-foreground truncate max-w-[80px]">{o.kunde_name}</span>
              <span className={cn(
                'rounded-full px-2 py-0.5 text-[9px] font-black tabular-nums shrink-0',
                isCritical ? 'bg-red-600 text-white' : 'bg-red-200 text-red-800',
              )}>
                {Math.floor(waitSec / 60)}:{String(waitSec % 60).padStart(2, '0')}
              </span>
              <span className="text-muted-foreground font-medium shrink-0">{euro(o.gesamtbetrag)}</span>
            </button>
          );
        })}
      </div>
      {longWait.length > 0 && (
        <div className="mt-2 text-[10px] text-red-700 font-medium">
          Klicke eine Bestellung um sie auszuwählen → dann Fahrer rechts zuweisen.
        </div>
      )}
    </div>
  );
}

/* ------------------------------ DelayMonitorPanel ------------------------------ */

type DelayOrder = {
  orderId: string;
  bestellnummer: string;
  kundeName: string;
  delayMinutes: number;
  firstNoticeSent: boolean;
  criticalNoticeSent: boolean;
  voucherCreated: boolean;
};

type DelayMonitorData = {
  summary: {
    total_delayed: number;
    pending_first_notice: number;
    pending_critical: number;
    pending_voucher: number;
    max_delay_minutes: number;
  };
  delayed_orders: DelayOrder[];
} | null;

function DelayMonitorPanel({ locationId }: { locationId?: string }) {
  const [data, setData] = useState<DelayMonitorData>(null);
  const [scanning, setScanning] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/delay-monitor?location_id=${locationId}&limit=20`);
        if (!res.ok) return;
        const d = await res.json();
        if (d?.summary) setData(d);
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const triggerScan = async () => {
    if (!locationId || scanning) return;
    setScanning(true);
    try {
      await fetch('/api/delivery/admin/delay-monitor', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ location_id: locationId }),
      });
      const res = await fetch(`/api/delivery/admin/delay-monitor?location_id=${locationId}&limit=20`);
      if (res.ok) { const d = await res.json(); if (d?.summary) setData(d); }
    } finally {
      setScanning(false);
    }
  };

  if (!data || data.summary.total_delayed === 0) return null;

  const { summary, delayed_orders } = data;
  const hasCritical = summary.pending_critical > 0 || summary.max_delay_minutes >= 30;

  return (
    <div className={cn(
      'rounded-xl border-2 p-4 transition-all',
      hasCritical ? 'border-red-300 bg-red-50' : 'border-amber-200 bg-amber-50',
    )}>
      <div className="flex items-center gap-2">
        <AlertTriangle className={cn('h-4 w-4 shrink-0', hasCritical ? 'text-red-600' : 'text-amber-600')} />
        <span className={cn('font-display text-sm font-bold uppercase tracking-wider', hasCritical ? 'text-red-800' : 'text-amber-800')}>
          Verspätungs-Monitor · {summary.total_delayed} betroffen
        </span>
        <div className="ml-auto flex items-center gap-2">
          {summary.pending_voucher > 0 && (
            <div className="flex items-center gap-1 rounded-full bg-purple-100 border border-purple-200 px-2 py-0.5 text-[10px] font-bold text-purple-700">
              <Gift className="h-3 w-3" /> {summary.pending_voucher} Gutschein{summary.pending_voucher !== 1 ? 'e' : ''}
            </div>
          )}
          {summary.max_delay_minutes > 0 && (
            <div className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums',
              summary.max_delay_minutes >= 30 ? 'bg-red-200 text-red-800' : 'bg-amber-200 text-amber-800',
            )}>
              max +{summary.max_delay_minutes}m
            </div>
          )}
          <button
            onClick={triggerScan}
            disabled={scanning}
            className="rounded-lg border border-current bg-white/60 px-2 py-1 text-[10px] font-bold transition hover:bg-white disabled:opacity-50"
          >
            {scanning ? 'Scanne…' : 'Jetzt scannen'}
          </button>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="rounded-lg border border-current bg-white/60 px-2 py-1 text-[10px] font-bold transition hover:bg-white"
          >
            {expanded ? '▲ Weniger' : '▼ Details'}
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {summary.pending_first_notice > 0 && (
          <div className="rounded-full bg-amber-200 text-amber-800 px-2 py-0.5 text-[9px] font-bold">
            {summary.pending_first_notice}× 1. Benachrichtigung ausstehend
          </div>
        )}
        {summary.pending_critical > 0 && (
          <div className="rounded-full bg-red-200 text-red-800 px-2 py-0.5 text-[9px] font-bold animate-pulse">
            {summary.pending_critical}× Kritisch (≥30 Min)
          </div>
        )}
        {summary.pending_voucher > 0 && (
          <div className="rounded-full bg-purple-200 text-purple-800 px-2 py-0.5 text-[9px] font-bold">
            {summary.pending_voucher}× Kompensations-Gutschein
          </div>
        )}
      </div>

      {expanded && delayed_orders.length > 0 && (
        <div className="mt-3 grid gap-1.5 max-h-52 overflow-y-auto">
          {delayed_orders.slice(0, 15).map((o) => (
            <div
              key={o.orderId}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-3 py-2 text-xs',
                o.delayMinutes >= 30 ? 'bg-red-100 border-red-200' : 'bg-amber-100 border-amber-200',
              )}
            >
              <span className={cn(
                'rounded-full px-2 py-0.5 text-[9px] font-black tabular-nums shrink-0',
                o.delayMinutes >= 30 ? 'bg-red-600 text-white' : 'bg-amber-500 text-white',
              )}>
                +{o.delayMinutes}m
              </span>
              <span className="font-mono font-bold">#{o.bestellnummer.replace(/^[A-Z]+-/, '')}</span>
              <span className="flex-1 truncate font-medium">{o.kundeName}</span>
              <div className="flex items-center gap-1 shrink-0">
                {o.voucherCreated && <Gift className="h-3 w-3 text-purple-600" aria-label="Gutschein erstellt" />}
                {o.criticalNoticeSent && <span className="text-[8px] bg-red-200 text-red-700 rounded px-1">Krit.</span>}
                {o.firstNoticeSent && !o.criticalNoticeSent && <span className="text-[8px] bg-amber-200 text-amber-700 rounded px-1">Benach.</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ TourVisualizationPanel ------------------------------ */

function TourVisualizationPanel({ batches, drivers = [] }: { batches: Batch[]; drivers?: Driver[] }) {
  const [open, setOpen] = useState(false);
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();
  if (batches.length === 0) return null;

  const enriched = batches.map((b) => {
    const total = b.stops.length;
    const done = b.stops.filter((s) => s.geliefert_am).length;
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;
    const etaMs = b.startzeit && b.total_eta_min != null
      ? new Date(b.startzeit).getTime() + b.total_eta_min * 60_000
      : null;
    const secLeft = etaMs ? Math.floor((etaMs - now) / 1000) : null;
    const nextStop = b.stops
      .filter((s) => !s.geliefert_am)
      .sort((a, b) => a.reihenfolge - b.reihenfolge)[0] ?? null;
    return { batch: b, total, done, progress, etaMs, secLeft, nextStop };
  }).sort((a, b) => (a.secLeft ?? 9999) - (b.secLeft ?? 9999));

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-muted/30 transition border-b"
      >
        <div className="flex items-center gap-2">
          <RouteIcon className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">Tour-Visualisierung</span>
          <Badge variant="secondary">{batches.length} Touren</Badge>
          {enriched.filter((e) => e.secLeft !== null && e.secLeft < 0).length > 0 && (
            <Badge variant="destructive" className="text-[10px] animate-pulse">
              {enriched.filter((e) => e.secLeft !== null && e.secLeft < 0).length} überzogen
            </Badge>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {enriched.map(({ batch, total, done, progress, secLeft, nextStop, etaMs }) => {
            const driverName = batch.fahrer ? `${batch.fahrer.vorname} ${batch.fahrer.nachname}` : `Fahrer`;
            const driverPhone = drivers.find((d) => d.employee_id === batch.fahrer_id)?.employee?.telefon ?? null;
            const overdue = secLeft !== null && secLeft < 0;
            const imminent = !overdue && secLeft !== null && secLeft < 300;
            const headerBg =
              overdue   ? 'bg-red-50 border-red-200'    :
              imminent  ? 'bg-orange-50 border-orange-200' :
              progress === 100 ? 'bg-matcha-50 border-matcha-200' :
              'bg-card border-border';
            return (
              <div key={batch.id} className={cn('rounded-xl border p-3', headerBg)}>
                {/* Tour Header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className={cn(
                    'h-10 w-10 rounded-xl grid place-items-center font-display font-black text-sm shrink-0',
                    overdue   ? 'bg-red-600 text-white'    :
                    imminent  ? 'bg-orange-500 text-white'  :
                    progress === 100 ? 'bg-matcha-600 text-white' :
                    'bg-matcha-700 text-white',
                  )}>
                    {progress === 100 ? '✓' : `${Math.round(progress)}%`}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display font-bold">{driverName}</span>
                      {batch.zone && (
                        <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-black', zoneMeta(batch.zone).cls)}>
                          Zone {batch.zone}
                        </span>
                      )}
                      {driverPhone && (
                        <a
                          href={`tel:${driverPhone}`}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold transition',
                            overdue
                              ? 'bg-red-100 text-red-700 hover:bg-red-200'
                              : 'bg-muted text-muted-foreground hover:bg-muted/70',
                          )}
                          title={`Anrufen: ${driverPhone}`}
                        >
                          <Phone className="h-2.5 w-2.5" />
                          {overdue ? 'Anrufen!' : driverPhone}
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
                      <span className="tabular-nums">{done}/{total} Stopps</span>
                      {batch.total_distance_km != null && (
                        <span>{batch.total_distance_km.toFixed(1)} km</span>
                      )}
                      {secLeft !== null && (
                        <span className={cn(
                          'font-bold tabular-nums',
                          overdue ? 'text-red-600' : imminent ? 'text-orange-600' : 'text-matcha-700',
                        )}>
                          {overdue
                            ? `+${Math.floor(-secLeft / 60)}m überzogen`
                            : `~${Math.floor(secLeft / 60)}m zurück`}
                        </span>
                      )}
                      {etaMs !== null && !overdue && (
                        <span className="text-muted-foreground/60 tabular-nums">
                          ↩ {new Date(etaMs).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </div>
                  {nextStop?.order?.kunde_adresse && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(nextStop.order.kunde_adresse)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 inline-flex items-center gap-1 rounded-full border border-matcha-200 bg-matcha-50 px-2.5 py-1 text-[10px] font-bold text-matcha-700 hover:bg-matcha-100 transition"
                    >
                      <MapPin className="h-3 w-3" />
                      Nächster
                    </a>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="mb-3 h-1.5 rounded-full bg-black/10 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      progress === 100 ? 'bg-matcha-500' :
                      overdue ? 'bg-red-500 animate-pulse' :
                      progress > 60 ? 'bg-orange-400' : 'bg-blue-400',
                    )}
                    style={{ width: `${progress}%` }}
                  />
                </div>

                {/* Stop dots timeline */}
                <div className="flex items-center gap-0 overflow-x-auto pb-1 scrollbar-hide">
                  {batch.stops
                    .slice()
                    .sort((a, b) => a.reihenfolge - b.reihenfolge)
                    .map((stop, idx, arr) => {
                      const isDone = !!stop.geliefert_am;
                      const isNext = !isDone && arr.slice(0, idx).every((p) => !!p.geliefert_am);
                      const stopEtaStr = stop.order?.eta_earliest
                        ? new Date(stop.order.eta_earliest).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
                        : null;
                      const stopEtaOverdue = stop.order?.eta_earliest
                        ? new Date(stop.order.eta_earliest).getTime() < now
                        : false;
                      return (
                        <div key={stop.id} className="flex items-center shrink-0">
                          <div className="flex flex-col items-center gap-0.5">
                            <div className={cn(
                              'h-7 w-7 rounded-full grid place-items-center text-[10px] font-bold border-2 transition-all',
                              isDone
                                ? 'bg-matcha-100 border-matcha-400 text-matcha-700'
                                : isNext
                                ? 'bg-orange-50 border-orange-400 text-orange-800 ring-2 ring-orange-200 ring-offset-1'
                                : 'bg-muted border-border text-muted-foreground',
                            )}>
                              {isDone ? '✓' : stop.reihenfolge}
                            </div>
                            <div className="w-16 text-center text-[8px] leading-tight truncate text-muted-foreground">
                              {stop.order?.kunde_name ?? '—'}
                            </div>
                            {stopEtaStr && (
                              <div className={cn(
                                'text-[7px] font-bold tabular-nums text-center',
                                stopEtaOverdue && !isDone ? 'text-red-600' :
                                isNext ? 'text-orange-600' : 'text-muted-foreground/60',
                              )}>
                                {stopEtaOverdue && !isDone ? '!' : '~'}{stopEtaStr}
                              </div>
                            )}
                          </div>
                          {idx < arr.length - 1 && (
                            <div className={cn(
                              'h-0.5 w-6 rounded-full mx-1 shrink-0 mb-4',
                              isDone ? 'bg-matcha-400' : 'bg-border',
                            )} />
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* ------------------------------ TodayDispatchOverview ------------------------------ */

function TodayDispatchOverview({
  locationId,
  readyCount,
  enRouteCount,
  onlineDrivers,
}: {
  locationId: string | null;
  readyCount: number;
  enRouteCount: number;
  onlineDrivers: number;
}) {
  const [trend, setTrend] = useState<{
    today: { orders: number; delivered: number; avg_score: number | null };
    yesterday: { orders: number; delivered: number; avg_score: number | null };
    delta_orders: number;
    delta_delivered: number;
  } | null>(null);

  useEffect(() => {
    if (!locationId) return;
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/trends?location_id=${locationId}`);
        if (!res.ok) return;
        const data = await res.json();
        setTrend(data);
      } catch {}
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const hasData = trend && (trend.today.orders > 0 || enRouteCount > 0 || readyCount > 0);
  if (!hasData && readyCount === 0 && enRouteCount === 0) return null;

  const deliveredToday = trend?.today.delivered ?? 0;
  const ordersToday = trend?.today.orders ?? 0;
  const deliveryRate = ordersToday > 0 ? Math.round((deliveredToday / ordersToday) * 100) : null;
  const deltaDelivered = trend?.delta_delivered ?? 0;
  const avgScore = trend?.today.avg_score;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-gradient-to-r from-matcha-50 to-card px-4 py-2.5">
      <div className="flex items-center gap-2 shrink-0">
        <div className="h-2 w-2 rounded-full bg-matcha-500 animate-pulse" />
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-matcha-700">Schicht heute</span>
      </div>

      {deliveredToday > 0 && (
        <div className="flex items-center gap-1.5">
          <Check className="h-3.5 w-3.5 text-matcha-600" />
          <span className="font-display text-sm font-black text-matcha-800">{deliveredToday}</span>
          <span className="text-[10px] text-muted-foreground">geliefert</span>
          {deltaDelivered !== 0 && (
            <span className={cn(
              'text-[9px] font-bold rounded-full px-1.5 py-0.5',
              deltaDelivered > 0 ? 'bg-matcha-100 text-matcha-700' : 'bg-red-100 text-red-700',
            )}>
              {deltaDelivered > 0 ? '+' : ''}{deltaDelivered} vs gestern
            </span>
          )}
        </div>
      )}

      {deliveryRate !== null && (
        <>
          <div className="h-4 w-px bg-border hidden sm:block" />
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-matcha-600" />
            <span className={cn(
              'font-display text-sm font-black',
              deliveryRate >= 90 ? 'text-matcha-700' : deliveryRate >= 70 ? 'text-amber-700' : 'text-red-700',
            )}>{deliveryRate}%</span>
            <span className="text-[10px] text-muted-foreground">Lieferquote</span>
          </div>
        </>
      )}

      {avgScore !== null && avgScore !== undefined && (
        <>
          <div className="h-4 w-px bg-border hidden sm:block" />
          <div className="flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5 text-matcha-600" />
            <span className={cn(
              'font-display text-sm font-black',
              avgScore >= 80 ? 'text-matcha-700' : avgScore >= 60 ? 'text-amber-700' : 'text-red-700',
            )}>{Math.round(avgScore)}</span>
            <span className="text-[10px] text-muted-foreground">Ø Score</span>
          </div>
        </>
      )}

      <div className="ml-auto flex items-center gap-2">
        {readyCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-matcha-100 text-matcha-800 px-2 py-0.5 text-[10px] font-bold">
            <Package className="h-3 w-3" />
            {readyCount} bereit
          </span>
        )}
        {enRouteCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 text-orange-800 px-2 py-0.5 text-[10px] font-bold animate-pulse">
            <Truck className="h-3 w-3" />
            {enRouteCount} unterwegs
          </span>
        )}
        {onlineDrivers > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-[10px] font-bold">
            <Bike className="h-3 w-3" />
            {onlineDrivers} online
          </span>
        )}
        {/* Warteschlangen-Schätzung: wann ist die Queue leer? */}
        {readyCount > 0 && onlineDrivers > 0 && (() => {
          const avgTourMin = 25;
          const clearMin = Math.ceil(readyCount / onlineDrivers) * avgTourMin;
          const overloaded = clearMin > 60;
          return (
            <span className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
              overloaded ? 'bg-red-100 text-red-800' : 'bg-blue-50 text-blue-700',
            )}>
              <Clock className="h-3 w-3" />
              Queue ~{clearMin}m
            </span>
          );
        })()}
      </div>
    </div>
  );
}

/* ------------------------------ DispatchNextBestAction ------------------------------ */

function DispatchNextBestAction({
  orders,
  drivers,
  batches,
  onAssign,
}: {
  orders: ReadyOrder[];
  drivers: Driver[];
  batches: Batch[];
  onAssign: (orderIds: string[], driverId: string) => void;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 10_000);
    return () => clearInterval(t);
  }, []);

  if (dismissed || orders.length === 0 || drivers.length === 0) return null;

  const now = Date.now();
  const freeDrivers = drivers.filter((d) => !d.aktueller_batch_id);
  if (freeDrivers.length === 0) return null;

  const topOrder = [...orders]
    .sort((a, b) => {
      const aScore = (a.dispatch_score ?? 0) + (a.fertig_am ? Math.floor((now - new Date(a.fertig_am).getTime()) / 60_000) * 2 : 0);
      const bScore = (b.dispatch_score ?? 0) + (b.fertig_am ? Math.floor((now - new Date(b.fertig_am).getTime()) / 60_000) * 2 : 0);
      return bScore - aScore;
    })[0];

  if (!topOrder) return null;

  const waitMin = topOrder.fertig_am
    ? Math.floor((now - new Date(topOrder.fertig_am).getTime()) / 60_000)
    : null;

  const sameZone = topOrder.delivery_zone
    ? orders.filter((o) => o.id !== topOrder.id && o.delivery_zone === topOrder.delivery_zone)
    : [];

  const bestDriver = freeDrivers[0];
  const driverName = bestDriver.employee
    ? `${bestDriver.employee.vorname} ${bestDriver.employee.nachname}`.trim()
    : 'Fahrer';

  const orderIds = [topOrder.id, ...sameZone.slice(0, 2).map((o) => o.id)];
  const bundled = orderIds.length > 1;
  const urgency = (waitMin ?? 0) >= 10 ? 'critical' : (waitMin ?? 0) >= 5 ? 'urgent' : 'normal';

  return (
    <div className={cn(
      'rounded-xl border-2 p-3 transition',
      urgency === 'critical' ? 'border-red-400 bg-red-50 animate-pulse' :
      urgency === 'urgent'   ? 'border-orange-400 bg-orange-50' :
      'border-matcha-300 bg-matcha-50',
    )}>
      <div className="flex items-center gap-2 mb-2">
        <Zap className={cn(
          'h-4 w-4',
          urgency === 'critical' ? 'text-red-600' :
          urgency === 'urgent'   ? 'text-orange-600' : 'text-matcha-700',
        )} />
        <span className={cn(
          'font-display text-xs font-bold uppercase tracking-wider',
          urgency === 'critical' ? 'text-red-800' :
          urgency === 'urgent'   ? 'text-orange-800' : 'text-matcha-800',
        )}>
          Empfehlung — Beste nächste Aktion
        </span>
        <button
          onClick={() => setDismissed(true)}
          className="ml-auto text-muted-foreground hover:text-foreground text-lg leading-none transition"
          title="Ausblenden"
        >×</button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border bg-white/70 px-3 py-2 min-w-0">
          <Package className="h-4 w-4 text-matcha-600 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono text-xs font-bold text-matcha-700">
                #{topOrder.bestellnummer.replace('FF-', '')}
              </span>
              {topOrder.dispatch_score != null && (
                <span className={cn(
                  'rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums',
                  topOrder.dispatch_score >= 80 ? 'bg-matcha-100 text-matcha-800' :
                  topOrder.dispatch_score >= 60 ? 'bg-blue-100 text-blue-800' :
                  'bg-orange-100 text-orange-800',
                )}>⚡ {Math.round(topOrder.dispatch_score)}</span>
              )}
              {waitMin != null && waitMin > 0 && (
                <span className={cn(
                  'rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums',
                  waitMin >= 10 ? 'bg-red-100 text-red-700' :
                  waitMin >= 5  ? 'bg-orange-100 text-orange-700' : 'bg-muted text-muted-foreground',
                )}>{waitMin} Min Warte</span>
              )}
              {topOrder.delivery_zone && (
                <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-bold', zoneMeta(topOrder.delivery_zone).cls)}>
                  Zone {topOrder.delivery_zone}
                </span>
              )}
            </div>
            <div className="text-xs font-semibold truncate mt-0.5">{topOrder.kunde_name}</div>
          </div>
        </div>
        {bundled && (
          <div className="flex items-center gap-1 rounded-lg border bg-violet-50 px-3 py-2 text-xs font-bold text-violet-800">
            <RouteIcon className="h-3.5 w-3.5" />
            +{orderIds.length - 1} Bundle · ~{(orderIds.length - 1) * 7} Min gespart
          </div>
        )}
        <div className="flex items-center gap-1 text-muted-foreground text-xs">
          <Truck className="h-3.5 w-3.5" />→
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-white/70 px-3 py-2">
          <Bike className="h-4 w-4 text-matcha-600 shrink-0" />
          <div>
            <div className="text-xs font-bold">{driverName}</div>
            <div className="text-[10px] text-muted-foreground">{bestDriver.fahrzeug}</div>
          </div>
        </div>
        <button
          onClick={() => { onAssign(orderIds, bestDriver.employee_id); setDismissed(true); }}
          className={cn(
            'ml-auto inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white transition active:scale-[0.98]',
            urgency === 'critical' ? 'bg-red-600 hover:bg-red-700' :
            urgency === 'urgent'   ? 'bg-orange-600 hover:bg-orange-700' :
            'bg-matcha-700 hover:bg-matcha-800',
          )}
        >
          <Check className="h-3.5 w-3.5" />
          {bundled ? `${orderIds.length}× Zuweisen` : 'Zuweisen'}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------ DriverShiftLeaderboard ------------------------------ */

type ShiftStats = {
  driverId: string;
  name: string;
  initials: string;
  fahrzeug: string;
  completedStops: number;
  totalStops: number;
  totalDistKm: number;
  activeMinutes: number;
  avgEtaAccuracySec: number | null;
  isOnline: boolean;
  isBusy: boolean;
};

function DriverShiftLeaderboard({
  drivers,
  batches,
}: {
  drivers: Driver[];
  batches: Batch[];
}) {
  const supabase = createClient();
  const [dbStats, setDbStats] = useState<Record<string, { stops: number; km: number }>>({});

  useEffect(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const load = async () => {
      const onlineIds = drivers.filter((d) => d.ist_online).map((d) => d.employee_id);
      if (onlineIds.length === 0) return;
      const { data } = await supabase
        .from('delivery_batches')
        .select('fahrer_id, total_distance_km, stops:delivery_batch_stops(id, geliefert_am)')
        .in('fahrer_id', onlineIds)
        .gte('created_at', today.toISOString());
      if (!data) return;
      const map: Record<string, { stops: number; km: number }> = {};
      for (const b of data as any[]) {
        const id = b.fahrer_id as string;
        if (!map[id]) map[id] = { stops: 0, km: 0 };
        map[id].km += b.total_distance_km ?? 0;
        map[id].stops += ((b.stops as any[]) ?? []).filter((s: any) => s.geliefert_am).length;
      }
      setDbStats(map);
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drivers.length]);

  const onlineDrivers = drivers.filter((d) => d.ist_online);
  if (onlineDrivers.length === 0) return null;

  const stats: ShiftStats[] = onlineDrivers.map((d) => {
    const e = d.employee;
    const name = e ? `${e.vorname} ${e.nachname}`.trim() : '?';
    const initials = e ? `${e.vorname?.[0] ?? ''}${e.nachname?.[0] ?? ''}`.toUpperCase() : '?';
    const batch = batches.find((b) => b.fahrer_id === d.employee_id || b.id === d.aktueller_batch_id);
    const completed = batch?.stops.filter((s) => s.geliefert_am).length ?? 0;
    const total = batch?.stops.length ?? 0;
    const db = dbStats[d.employee_id] ?? { stops: 0, km: 0 };
    const activeMinutes = d.online_seit
      ? Math.floor((Date.now() - new Date(d.online_seit).getTime()) / 60_000)
      : 0;
    return {
      driverId: d.employee_id,
      name,
      initials,
      fahrzeug: d.fahrzeug ?? 'bike',
      completedStops: db.stops,
      totalStops: total,
      totalDistKm: Math.round(db.km * 10) / 10,
      activeMinutes,
      avgEtaAccuracySec: null,
      isOnline: true,
      isBusy: !!d.aktueller_batch_id,
    };
  }).sort((a, b) => b.completedStops - a.completedStops || b.activeMinutes - a.activeMinutes);

  const totalDeliveries = stats.reduce((s, x) => s + x.completedStops, 0);
  if (totalDeliveries === 0 && stats.every((s) => s.activeMinutes < 5)) return null;

  const vehicleEmoji: Record<string, string> = { bike: '🚲', ebike: '🛵', scooter: '🛴', auto: '🚗', fahrrad: '🚲' };

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-2 border-b px-5 py-3">
        <TrendingUp className="h-4 w-4 text-matcha-600" />
        <span className="font-display text-sm font-bold uppercase tracking-wider">Schicht-Leaderboard</span>
        <span className="ml-2 text-[10px] text-muted-foreground">{onlineDrivers.length} Fahrer online</span>
        {totalDeliveries > 0 && (
          <span className="ml-auto text-[10px] font-bold text-matcha-700">{totalDeliveries} Stopps heute</span>
        )}
      </div>

      <div className="divide-y">
        {stats.map((s, idx) => {
          const rank = idx + 1;
          const rankCls =
            rank === 1 ? 'text-yellow-600 font-black' :
            rank === 2 ? 'text-slate-500 font-black' :
            rank === 3 ? 'text-amber-700 font-black' :
            'text-muted-foreground font-medium';
          const delivPerHour = s.activeMinutes >= 5 && s.completedStops > 0
            ? Math.round((s.completedStops / s.activeMinutes) * 60 * 10) / 10
            : null;
          const effBar = delivPerHour != null ? Math.min(100, Math.round(delivPerHour * 20)) : 0;

          return (
            <div key={s.driverId} className="flex items-center gap-4 px-5 py-3">
              {/* Rank */}
              <div className={cn('w-6 text-sm text-center shrink-0', rankCls)}>
                {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}
              </div>

              {/* Avatar */}
              <div className="relative shrink-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-matcha-700 font-display text-xs font-bold text-white">
                  {s.initials}
                </div>
                <span
                  className={cn(
                    'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background',
                    s.isBusy ? 'bg-orange-500' : 'bg-matcha-400',
                  )}
                  title={s.isBusy ? 'Unterwegs' : 'Frei'}
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm truncate">{s.name}</span>
                  <span>{vehicleEmoji[s.fahrzeug] ?? '🚲'}</span>
                  {s.isBusy && (
                    <span className="shrink-0 text-[9px] font-bold rounded-full bg-orange-100 text-orange-800 px-1.5 py-0.5">
                      {s.totalStops > 0 ? `${batches.find(b => b.fahrer_id === s.driverId)?.stops.filter(x => x.geliefert_am).length ?? 0}/${s.totalStops} Stop` : 'unterwegs'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {/* Efficiency bar */}
                  {effBar > 0 && (
                    <div className="flex-1 max-w-[80px] h-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          effBar >= 80 ? 'bg-matcha-500' : effBar >= 50 ? 'bg-amber-400' : 'bg-blue-400',
                        )}
                        style={{ width: `${effBar}%` }}
                      />
                    </div>
                  )}
                  {delivPerHour != null && (
                    <span className="text-[10px] text-muted-foreground tabular-nums">{delivPerHour}/h</span>
                  )}
                  {s.activeMinutes > 0 && (
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {s.activeMinutes >= 60
                        ? `${Math.floor(s.activeMinutes / 60)}h ${s.activeMinutes % 60}m`
                        : `${s.activeMinutes}m`} online
                    </span>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-3 shrink-0 text-right">
                <div>
                  <div className={cn(
                    'font-display text-lg font-black leading-none tabular-nums',
                    s.completedStops >= 5 ? 'text-matcha-700' : s.completedStops >= 2 ? 'text-amber-700' : 'text-muted-foreground',
                  )}>
                    {s.completedStops}
                  </div>
                  <div className="text-[9px] text-muted-foreground">Stopps</div>
                </div>
                {s.totalDistKm > 0 && (
                  <div>
                    <div className="font-display text-sm font-bold leading-none text-muted-foreground tabular-nums">
                      {s.totalDistKm}
                    </div>
                    <div className="text-[9px] text-muted-foreground">km</div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer: aggregate */}
      {totalDeliveries > 0 && (
        <div className="flex items-center gap-4 border-t bg-muted/30 px-5 py-2 text-[10px] text-muted-foreground">
          <span><span className="font-bold text-foreground">{totalDeliveries}</span> Stopps gesamt</span>
          {stats.some((s) => s.totalDistKm > 0) && (
            <span>
              <span className="font-bold text-foreground">
                {Math.round(stats.reduce((s, x) => s + x.totalDistKm, 0) * 10) / 10}
              </span> km gesamt
            </span>
          )}
          <span className="ml-auto">
            Ø <span className="font-bold text-foreground">
              {stats.filter((s) => s.completedStops > 0).length > 0
                ? Math.round(totalDeliveries / stats.filter((s) => s.completedStops > 0).length * 10) / 10
                : 0}
            </span>/Fahrer
          </span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ DeliveryWindowsPanel ------------------------------ */

type WindowSlot = {
  slot_id: string;
  window_start_utc: string;
  window_end_utc: string;
  slot_type: string;
  label: string | null;
  extra_fee_eur: number;
  remaining_capacity: number;
  utilization_pct: number;
  is_filling_fast: boolean;
};

function DeliveryWindowsPanel() {
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState<WindowSlot[]>([]);
  const [stats, setStats] = useState<{
    total_bookings_today: number;
    confirmed: number;
    dispatched: number;
    delivered: number;
    missed: number;
    avg_utilization_pct: number;
  } | null>(null);

  useEffect(() => {
    const load = () => {
      Promise.all([
        fetch('/api/delivery/admin/windows?action=availability').then(r => r.ok ? r.json() : null),
        fetch('/api/delivery/admin/windows?action=stats').then(r => r.ok ? r.json() : null),
      ]).then(([avail, st]) => {
        if (avail?.today?.slots?.length) setSlots(avail.today.slots);
        if (st && !st._fallback) setStats(st);
      }).catch(() => {});
    };
    load();
    const iv = setInterval(load, 120_000);
    return () => clearInterval(iv);
  }, []);

  if (slots.length === 0 && !stats) return null;

  const now = new Date();
  const upcoming = slots.filter(s => new Date(s.window_end_utc) > now);
  const totalBooked = stats?.total_bookings_today ?? 0;

  if (totalBooked === 0 && upcoming.length === 0) return null;

  const slotTypeMeta = (type: string) =>
    type === 'express' ? { label: 'Express', cls: 'bg-amber-100 text-amber-800' }
    : type === 'scheduled' ? { label: 'Geplant', cls: 'bg-blue-100 text-blue-800' }
    : { label: 'Standard', cls: 'bg-stone-100 text-stone-700' };

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between px-5 py-3 border-b text-left hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">Lieferfenster · Heute</span>
          {totalBooked > 0 && (
            <Badge variant="secondary">{totalBooked} Buchungen</Badge>
          )}
          {upcoming.some(s => s.is_filling_fast) && (
            <Badge variant="destructive" className="text-[10px]">Fast voll!</Badge>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {/* Stats row */}
          {stats && totalBooked > 0 && (
            <div className="grid grid-cols-4 gap-2 mb-2">
              {[
                { label: 'Gesamt', value: stats.total_bookings_today, cls: 'text-foreground' },
                { label: 'Bestätigt', value: stats.confirmed, cls: 'text-blue-700' },
                { label: 'Unterwegs', value: stats.dispatched, cls: 'text-amber-700' },
                { label: 'Geliefert', value: stats.delivered, cls: 'text-matcha-700' },
              ].map(m => (
                <div key={m.label} className="text-center">
                  <div className={`text-lg font-black tabular-nums ${m.cls}`}>{m.value}</div>
                  <div className="text-[10px] text-muted-foreground">{m.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Upcoming slots */}
          {upcoming.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bevorstehende Slots</div>
              {upcoming.slice(0, 6).map(slot => {
                const start = new Date(slot.window_start_utc);
                const end   = new Date(slot.window_end_utc);
                const isActive = start <= now && now < end;
                const pct = Math.min(100, Math.round(slot.utilization_pct));
                const meta = slotTypeMeta(slot.slot_type);
                return (
                  <div key={slot.slot_id} className={cn(
                    'rounded-xl border p-2.5',
                    isActive ? 'border-matcha-300 bg-matcha-50' :
                    slot.is_filling_fast ? 'border-amber-300 bg-amber-50' :
                    'border-border bg-card',
                  )}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="font-mono text-xs font-bold tabular-nums text-foreground">
                        {start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                        {' – '}
                        {end.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-bold', meta.cls)}>{meta.label}</span>
                      {slot.label && <span className="text-[10px] text-muted-foreground truncate flex-1">{slot.label}</span>}
                      {isActive && <span className="ml-auto inline-flex h-1.5 w-1.5 rounded-full bg-matcha-500 animate-pulse" />}
                      {slot.extra_fee_eur > 0 && (
                        <span className="text-[10px] font-bold text-amber-700">+{slot.extra_fee_eur.toFixed(2)} €</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all', pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-400' : 'bg-matcha-500')}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className={cn('text-[10px] font-bold tabular-nums shrink-0', pct >= 90 ? 'text-red-700' : pct >= 70 ? 'text-amber-700' : 'text-muted-foreground')}>
                        {pct}%
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {slot.remaining_capacity} frei
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {upcoming.length === 0 && totalBooked === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">Keine Lieferfenster für heute konfiguriert.</p>
          )}
        </div>
      )}
    </Card>
  );
}

/* ------------------------------ ScheduledOrdersPanel ------------------------------ */

function ScheduledOrdersPanel({ summary, orders }: {
  summary: { total: number; pending: number; released: number; next_due_in_min: number | null };
  orders: { id: string; bestellnummer: string; kunde_name: string | null; scheduled_at: string; schedule_status: string; mins_until_kitchen_start: number | null }[];
}) {
  const [open, setOpen] = useState(false);

  const nextDue = summary.next_due_in_min;
  const isUrgent = nextDue !== null && nextDue <= 15;

  return (
    <div className={cn(
      'flex flex-col rounded-xl border px-4 py-3 text-sm transition',
      isUrgent
        ? 'border-amber-300 bg-amber-50'
        : 'border-matcha-200 bg-matcha-50',
    )}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-3 w-full text-left"
      >
        <Clock className={cn('h-4 w-4 shrink-0', isUrgent ? 'text-amber-600' : 'text-matcha-600')} />
        <div className="flex-1 flex flex-wrap items-center gap-2">
          <span className={cn('font-bold', isUrgent ? 'text-amber-800' : 'text-matcha-800')}>
            {summary.total} Vorbestellung{summary.total !== 1 ? 'en'  : ''} · nächste 4h
          </span>
          {summary.pending > 0 && (
            <span className="rounded-full bg-white/70 border border-matcha-200 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
              {summary.pending} ausstehend
            </span>
          )}
          {summary.released > 0 && (
            <span className="rounded-full bg-matcha-200 px-2 py-0.5 text-[10px] font-bold text-matcha-800">
              {summary.released} freigegeben
            </span>
          )}
          {nextDue !== null && (
            <span className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums',
              isUrgent ? 'bg-amber-200 text-amber-900' : 'bg-matcha-200 text-matcha-900',
            )}>
              Nächste Küche in {nextDue <= 0 ? 'jetzt' : `${nextDue} Min`}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && orders.length > 0 && (
        <div className="mt-3 divide-y divide-matcha-200/60 border-t border-matcha-200/60">
          {orders.slice(0, 8).map(o => {
            const sched = new Date(o.scheduled_at);
            const isPending = o.schedule_status === 'scheduled';
            const minsK = o.mins_until_kitchen_start;
            return (
              <div key={o.id} className="flex items-center gap-3 py-2">
                <div className={cn(
                  'h-2 w-2 rounded-full shrink-0',
                  isPending ? 'bg-amber-400' : 'bg-matcha-500',
                )} />
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-xs font-bold text-foreground">
                    #{o.bestellnummer.replace('FF-', '')}
                  </span>
                  {o.kunde_name && (
                    <span className="ml-2 text-xs text-muted-foreground truncate">{o.kunde_name}</span>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-mono text-xs font-bold tabular-nums">
                    {sched.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {minsK !== null && minsK > 0 && (
                    <div className={cn('text-[9px] tabular-nums', minsK <= 10 ? 'text-amber-700 font-bold' : 'text-muted-foreground')}>
                      Küche in {minsK} Min
                    </div>
                  )}
                  {isPending && (minsK === null || minsK <= 0) && (
                    <div className="text-[9px] text-amber-700 font-bold">▶ Freigeben!</div>
                  )}
                </div>
              </div>
            );
          })}
          {orders.length > 8 && (
            <div className="pt-2 text-[11px] text-muted-foreground text-center">+ {orders.length - 8} weitere Vorbestellungen</div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ ShiftClaimsPanel ------------------------------ */

function ShiftClaimsPanel({ claims: initialClaims }: { claims: ShiftClaimItem[] }) {
  const [open, setOpen] = useState(false);
  const [claims, setClaims] = useState(initialClaims);
  const [acting, setActing] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => { setClaims(initialClaims); }, [initialClaims]);

  const pendingClaims = claims.filter(c => c.status === 'pending');
  if (pendingClaims.length === 0) return null;

  async function doAction(claimId: string, action: 'approve' | 'reject', reason?: string) {
    setActing(claimId);
    try {
      const body: Record<string, string> = { action, claim_id: claimId };
      if (reason) body.reason = reason;
      const res = await fetch('/api/delivery/admin/shift-claims', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setClaims(cs => cs.map(c => c.id === claimId
          ? { ...c, status: action === 'approve' ? 'approved' : 'rejected' }
          : c,
        ));
        setRejectId(null);
        setRejectReason('');
      }
    } finally {
      setActing(null);
    }
  }

  return (
    <Card className="p-4 border-amber-300 bg-amber-50">
      <button onClick={() => setOpen(v => !v)} className="flex items-center gap-3 w-full text-left">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-200 text-amber-800 shrink-0">
          <User className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-amber-900 text-sm">Schichtanfragen</span>
            <span className="rounded-full bg-amber-600 text-white text-[10px] font-bold px-1.5 py-0.5 leading-none">
              {pendingClaims.length}
            </span>
          </div>
          <div className="text-xs text-amber-700 mt-0.5">
            {pendingClaims.length} offene Anfrage{pendingClaims.length !== 1 ? 'n' : ''} warten auf Genehmigung
          </div>
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-amber-600 shrink-0" />
          : <ChevronDown className="h-4 w-4 text-amber-600 shrink-0" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2.5 border-t border-amber-200 pt-3">
          {pendingClaims.map(claim => {
            const start = new Date(claim.plannedStart);
            const end   = new Date(claim.plannedEnd);
            const isActing = acting === claim.id;
            const isReject = rejectId === claim.id;
            return (
              <div key={claim.id} className="rounded-xl border border-amber-200 bg-white p-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-foreground">
                      {claim.driverName ?? 'Unbekannter Fahrer'}
                    </div>
                    {claim.driverVehicle && (
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {claim.driverVehicle}
                      </div>
                    )}
                    <div className="mt-1 font-mono text-xs tabular-nums text-foreground">
                      {start.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                      {' '}
                      {start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                      {' – '}
                      {end.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {claim.notes && (
                      <div className="mt-1 text-[11px] text-muted-foreground italic">
                        &ldquo;{claim.notes}&rdquo;
                      </div>
                    )}
                  </div>
                  {!isReject && (
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button
                        onClick={() => doAction(claim.id, 'approve')}
                        disabled={isActing}
                        className="flex items-center gap-1.5 rounded-lg bg-matcha-700 text-white px-2.5 py-1.5 text-xs font-bold disabled:opacity-50 transition"
                      >
                        <Check className="h-3 w-3" />
                        Genehmigen
                      </button>
                      <button
                        onClick={() => { setRejectId(claim.id); setRejectReason(''); }}
                        disabled={isActing}
                        className="flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 text-red-700 px-2.5 py-1.5 text-xs font-bold disabled:opacity-50 transition"
                      >
                        Ablehnen
                      </button>
                    </div>
                  )}
                </div>
                {isReject && (
                  <div className="mt-2 flex gap-2 items-center border-t border-amber-100 pt-2">
                    <input
                      type="text"
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      placeholder="Ablehnungsgrund (optional)"
                      className="flex-1 h-8 rounded-lg border px-3 text-xs bg-background"
                    />
                    <button
                      onClick={() => doAction(claim.id, 'reject', rejectReason || undefined)}
                      disabled={isActing}
                      className="rounded-lg bg-red-600 text-white px-3 py-1.5 text-xs font-bold disabled:opacity-50 transition"
                    >
                      {isActing ? '…' : 'Bestätigen'}
                    </button>
                    <button
                      onClick={() => setRejectId(null)}
                      className="rounded-lg border px-3 py-1.5 text-xs text-muted-foreground transition"
                    >
                      Abbrechen
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* ------------------------------ StaleOrdersPanel ------------------------------ */

function StaleOrdersPanel({ orders }: {
  orders: { id: string; bestellnummer: string; age_min: number; dispatch_attempts: number; escalation_status: string | null; delivery_zone: string | null }[]
}) {
  const [open, setOpen] = useState(false);

  const escalated = orders.filter(o => o.escalation_status === 'escalated' || o.escalation_status === 'needs_escalation');
  if (orders.length === 0) return null;

  const isUrgent = escalated.length > 0;

  return (
    <div className={cn(
      'rounded-xl border-2 px-4 py-3',
      isUrgent ? 'border-red-400 bg-red-50' : 'border-amber-300 bg-amber-50',
    )}>
      <button onClick={() => setOpen(v => !v)} className="flex items-center gap-3 w-full text-left">
        <AlertTriangle className={cn('h-4 w-4 shrink-0', isUrgent ? 'text-red-600 animate-pulse' : 'text-amber-600')} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('font-bold text-sm', isUrgent ? 'text-red-900' : 'text-amber-900')}>
              {orders.length} Bestellung{orders.length !== 1 ? 'en' : ''} ohne Fahrer (&gt;10 Min)
            </span>
            {escalated.length > 0 && (
              <span className="rounded-full bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5">
                {escalated.length}× eskaliert
              </span>
            )}
          </div>
          <div className={cn('text-xs mt-0.5', isUrgent ? 'text-red-700' : 'text-amber-700')}>
            Dispatch-Radius wurde bereits erweitert — manuelles Eingreifen empfohlen
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2 border-t border-amber-200 pt-3">
          {orders.slice(0, 8).map(o => {
            const isEsc = o.escalation_status === 'escalated';
            const needsEsc = o.escalation_status === 'needs_escalation';
            return (
              <div key={o.id} className={cn(
                'rounded-xl border p-3 flex items-center gap-3',
                isEsc ? 'border-red-200 bg-red-50' : needsEsc ? 'border-amber-200 bg-amber-50' : 'border-border bg-card',
              )}>
                <div className={cn('h-2.5 w-2.5 rounded-full shrink-0',
                  isEsc ? 'bg-red-500 animate-pulse' : needsEsc ? 'bg-amber-500' : 'bg-amber-300',
                )} />
                <div className="flex-1 min-w-0">
                  <div className="font-mono font-bold text-xs text-foreground">
                    #{o.bestellnummer.replace(/^[A-Z]+-/, '')}
                  </div>
                  {o.delivery_zone && (
                    <div className="text-[10px] text-muted-foreground">{o.delivery_zone}</div>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <div className={cn('font-bold tabular-nums text-xs', o.age_min >= 20 ? 'text-red-700' : 'text-amber-700')}>
                    {o.age_min} Min
                  </div>
                  <div className="text-[9px] text-muted-foreground">
                    {o.dispatch_attempts} Versuch{o.dispatch_attempts !== 1 ? 'e' : ''}
                  </div>
                </div>
                {isEsc && (
                  <span className="rounded-full bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 shrink-0">Eskaliert</span>
                )}
                {needsEsc && !isEsc && (
                  <span className="rounded-full bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 shrink-0">! Eskalieren</span>
                )}
              </div>
            );
          })}
          {orders.length > 8 && (
            <div className="text-center text-[11px] text-muted-foreground">+ {orders.length - 8} weitere</div>
          )}
        </div>
      )}
    </div>
  );
}
