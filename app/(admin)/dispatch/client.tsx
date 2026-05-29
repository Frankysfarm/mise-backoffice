'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn, euro } from '@/lib/utils';
import {
  Bike,
  Clock,
  MapPin,
  Package,
  Radio,
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
    order: { bestellnummer: string; kunde_name: string; kunde_adresse: string | null } | null;
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
  const [pending, startTransition] = useTransition();
  const [dispatchPending, setDispatchPending] = useState(false);

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
        .select('id, bestellnummer, status, typ, kunde_name, kunde_adresse, kunde_plz, kunde_lat, kunde_lng, gesamtbetrag, zahlungsart, fertig_am, external_source, location_id, dispatch_score, delivery_zone, eta_earliest')
        .eq('typ', 'lieferung')
        .in('status', ['fertig', 'unterwegs'])
        .order('fertig_am', { ascending: true }),
      supabase
        .from('driver_status')
        .select('*, employee:employees(id, vorname, nachname, avatar_url, telefon)')
        .order('last_update', { ascending: false }),
      supabase
        .from('delivery_batches')
        .select('id, fahrer_id, status, startzeit, total_distance_km, total_eta_min, zone, fahrer:employees(vorname, nachname), stops:delivery_batch_stops(id, order_id, reihenfolge, geliefert_am, order:customer_orders(bestellnummer, kunde_name, kunde_adresse))')
        .in('status', ['pickup', 'unterwegs'])
        .order('created_at', { ascending: false }),
      supabase
        .from('mise_delivery_batches')
        .select('id, state, driver_id, started_at, total_distance_km, total_eta_min, zone, driver:mise_drivers(id, name), stops:mise_delivery_batch_stops(id, order_id, sequence, completed_at, type, order:customer_orders(bestellnummer, kunde_name, kunde_adresse))')
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

  const readyOrders = filteredOrders.filter((o) => o.status === 'fertig');
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

      {/* Score + Zone Summary */}
      <DispatchScoreSummary orders={readyOrders} batches={batches} />

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
              {selected.size > 0 && (
                <div className="text-xs text-muted-foreground">
                  {selected.size} ausgewählt · wähle Fahrer rechts
                </div>
              )}
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
        </div>
      </div>
    </div>
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
      {/* Avg Score Gauge */}
      {avgScore !== null && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4 text-matcha-600" />
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ø Dispatch-Score</div>
          </div>
          <div className="flex items-end gap-2">
            <div className={cn(
              'font-display text-3xl font-black leading-none',
              avgScore >= 80 ? 'text-matcha-700' : avgScore >= 60 ? 'text-blue-600' : avgScore >= 40 ? 'text-orange-600' : 'text-red-600',
            )}>{avgScore}</div>
            <div className="text-xs text-muted-foreground mb-0.5">/ 100</div>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', avgScore >= 80 ? 'bg-matcha-500' : avgScore >= 60 ? 'bg-blue-400' : avgScore >= 40 ? 'bg-orange-400' : 'bg-red-400')}
              style={{ width: `${avgScore}%` }}
            />
          </div>
          {scored.length > 0 && (
            <div className="mt-2 flex gap-0.5 h-1">
              {tiers.excellent > 0 && <div className="rounded-full bg-matcha-500" style={{ width: `${(tiers.excellent / scored.length) * 100}%` }} />}
              {tiers.good > 0 && <div className="rounded-full bg-blue-400" style={{ width: `${(tiers.good / scored.length) * 100}%` }} />}
              {tiers.fair > 0 && <div className="rounded-full bg-orange-400" style={{ width: `${(tiers.fair / scored.length) * 100}%` }} />}
              {tiers.low > 0 && <div className="rounded-full bg-red-400" style={{ width: `${(tiers.low / scored.length) * 100}%` }} />}
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

function DriverRow({
  driver,
  canAssign,
  busy,
  onAssign,
}: {
  driver: Driver;
  canAssign: boolean;
  busy: boolean;
  onAssign: () => void;
}) {
  const e = driver.employee;
  const initials = e ? `${e.vorname?.[0] ?? ''}${e.nachname?.[0] ?? ''}`.toUpperCase() : '?';
  const vehicleEmoji: Record<string, string> = { bike: '🚲', ebike: '🛵', scooter: '🛴', auto: '🚗' };
  const lastSeen = driver.last_update ? Math.floor((Date.now() - new Date(driver.last_update).getTime()) / 60_000) : null;

  // Online-Dauer berechnen
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!driver.ist_online) return;
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, [driver.ist_online]);
  const onlineSince = driver.online_seit
    ? Math.floor((Date.now() - new Date(driver.online_seit).getTime()) / 60_000)
    : null;

  return (
    <div className="flex items-center gap-3 px-5 py-3">
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
  );
}

function BatchRow({ batch }: { batch: Batch }) {
  const fahrer = batch.fahrer ? `${batch.fahrer.vorname} ${batch.fahrer.nachname}` : 'Unbekannt';
  const total = batch.stops.length;
  const done = batch.stops.filter((s) => s.geliefert_am).length;
  const progress = total > 0 ? (done / total) * 100 : 0;

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
              // Estimate per-stop delivery time from start + proportional share of total ETA
              const stopEtaStr = !isDone && batch.startzeit && batch.total_eta_min != null && total > 0
                ? new Date(
                    new Date(batch.startzeit).getTime() +
                    ((idx + 1) / total) * batch.total_eta_min * 60_000,
                  ).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
                : null;
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
                        'text-[8px] tabular-nums text-center',
                        isNext ? 'text-orange-600 font-bold' : 'text-muted-foreground/60',
                      )}>
                        ~{stopEtaStr}
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

function scoreMeta(score: number): { cls: string } {
  if (score >= 80) return { cls: 'bg-matcha-100 text-matcha-800' };
  if (score >= 60) return { cls: 'bg-blue-100 text-blue-800' };
  if (score >= 40) return { cls: 'bg-orange-100 text-orange-800' };
  return { cls: 'bg-red-100 text-red-800' };
}
