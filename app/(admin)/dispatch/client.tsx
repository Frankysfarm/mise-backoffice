'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
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

type Location = { id: string; name: string };

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
        .select('id, bestellnummer, status, typ, kunde_name, kunde_adresse, kunde_plz, kunde_lat, kunde_lng, gesamtbetrag, zahlungsart, fertig_am, external_source, location_id, dispatch_score, delivery_zone, eta_earliest, eta_latest')
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
    setOrders((o as any) ?? []);
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

      {/* Capacity Forecast — nächster freier Fahrer */}
      <CapacityForecastChip batches={batches} onlineDrivers={onlineDrivers} />

      {/* Score + Zone Summary */}
      <DispatchScoreSummary orders={readyOrders} batches={batches} />

      {/* Tour Return Timeline — wann kommen Fahrer zurück? */}
      {batches.length > 0 && <TourReturnTimeline batches={batches} />}

      {/* Fahrer-Tipp: welcher freie Fahrer ist am nächsten zu welcher Zone */}
      <DriverZoneMatchPanel orders={filteredOrders} drivers={drivers} batches={batches} />

      {/* Lange Wartezeiten: Bestellungen >8 Min ohne Fahrer */}
      <LongWaitOrdersPanel orders={readyOrders} onSelect={(id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; })} selected={selected} />

      {/* Zone Bundling Opportunities */}
      <ZoneBundlingAlert orders={readyOrders} onlineDrivers={onlineDrivers} onSelectZone={(zone) => {
        const ids = readyOrders.filter((o) => o.delivery_zone === zone).map((o) => o.id);
        setSelected(new Set(ids));
      }} />

      {/* Live Driver Map */}
      <LiveDriverMapPanel drivers={drivers} batches={batches} orders={filteredOrders} />

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
              <div className="space-y-3 p-4">
                {batches.map((b) => (
                  <BatchRow key={b.id} batch={b} />
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Drivers */}
        <div className="space-y-4">
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
              {onlineDrivers.map((d) => (
                <DriverRow
                  key={d.employee_id}
                  driver={d}
                  activeBatch={batches.find((b) => b.fahrer_id === d.employee_id || b.id === d.aktueller_batch_id) ?? null}
                  canAssign={selected.size > 0 && !d.aktueller_batch_id}
                  busy={pending}
                  onAssign={() => assignToDriver(d.employee_id)}
                />
              ))}
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
}: {
  drivers: Driver[];
  batches: Batch[];
  orders: ReadyOrder[];
}) {
  const [open, setOpen] = useState(false);

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
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums', scoreMeta(order.dispatch_score).cls)}>
              ⚡ {Math.round(order.dispatch_score)}
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
}: {
  driver: Driver;
  activeBatch?: ActiveBatchRef | null;
  canAssign: boolean;
  busy: boolean;
  onAssign: () => void;
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
              </>
            ) : (
              <span>offline</span>
            )}
          </div>
        </div>
        {e?.telefon && driver.ist_online && (
          <a
            href={`tel:${e.telefon}`}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-muted hover:bg-muted/70 text-muted-foreground"
            title="Anrufen"
          >
            <User className="h-3.5 w-3.5" />
          </a>
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
                    <div className="mt-1 w-16 text-center text-[9px] leading-tight truncate text-muted-foreground">
                      {s.order?.kunde_name ?? '—'}
                    </div>
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
      <div className="mt-1 flex items-center gap-2 text-xs">
        <span className={cn(
          'rounded-full px-2 py-0.5 font-bold',
          progress === 100 ? 'bg-matcha-100 text-matcha-800' :
          progress > 50 ? 'bg-orange-100 text-orange-800' :
          'bg-blue-100 text-blue-800',
        )}>
          {done}/{total} · {Math.round(progress)}%
        </span>

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
