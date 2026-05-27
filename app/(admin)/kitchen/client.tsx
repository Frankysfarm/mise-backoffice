'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn, euro } from '@/lib/utils';
import {
  AlertCircle, Bell, BellOff, Bike, Check, ChefHat, Clock, Home as HomeIcon,
  Inbox, Package, Utensils, X, Zap,
} from 'lucide-react';
import { advanceOrder, cancelOrder } from './actions';

/* ------------------------------ Types ------------------------------ */

type Item = {
  id: string; name: string; menge: number;
  einzelpreis: number; notiz: string | null; extras: unknown;
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
  geschaetzte_zubereitung_min: number | null;
  external_source: string | null;
  location_id: string | null;
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
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [audio, setAudio] = useState(true);

  // Für Vergleich zwischen Renders
  const prev = useRef({
    newCount: orders.filter((o) => o.status === 'neu').length,
    driverStates: computeDriverStates(drivers, batches, stops),
    orderPickedIds: new Set(orders.filter((o) => o.status === 'unterwegs').map((o) => o.id)),
  });

  /* --- Realtime --- */
  useEffect(() => {
    const ch = supabase
      .channel('kitchen-combined')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_orders' }, refreshOrders)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' },     refreshOrders)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_status' },   refreshDrivers)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_batches' },refreshBatches)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_batch_stops' }, refreshStops)
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
    const { data } = await supabase.from('delivery_batches')
      .select('id, driver_id, status, started_at').in('status', ['aktiv', 'unterwegs']);
    setBatches((data as any[]) ?? []);
  }
  async function refreshStops() {
    const { data } = await supabase.from('delivery_batch_stops')
      .select('id, batch_id, order_id, reihenfolge, angekommen_am, geliefert_am')
      .order('reihenfolge', { ascending: true });
    setStops((data as any[]) ?? []);
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
        <div className="text-sm text-muted-foreground">
          {filtered.filter((o) => o.status !== 'unterwegs').length} offene Bestellungen
        </div>
      </div>

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
          return (
            <section key={col.status} className={cn('rounded-xl border', col.color)}>
              <header className="flex items-center justify-between border-b border-black/5 px-4 py-3">
                <div className="flex items-center gap-2">
                  <col.icon className="h-4 w-4" />
                  <h2 className="font-display text-sm font-bold uppercase tracking-wider">{col.label}</h2>
                </div>
                <Badge variant="muted">{colOrders.length}</Badge>
              </header>
              <div className="space-y-3 p-3">
                {colOrders.length === 0 && (
                  <div className="rounded-lg border-2 border-dashed border-black/10 p-6 text-center text-xs text-muted-foreground">
                    Nichts hier.
                  </div>
                )}
                {colOrders.map((o) => <OrderTicket key={o.id} order={o} next={col.next} />)}
              </div>
            </section>
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
  const batchId = driver.status?.aktueller_batch_id ?? batches.find((b) => b.driver_id === driver.id)?.id;
  const myStops = batchId ? stops.filter((s) => s.batch_id === batchId) : [];
  const totalStops = myStops.length;
  const deliveredStops = myStops.filter((s) => s.geliefert_am).length;
  const nextStop = myStops.find((s) => !s.geliefert_am);
  const nextOrder = nextStop ? orders.find((o) => o.id === nextStop.order_id) : null;

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
          </div>
        </div>
      </div>

      {/* Details je State */}
      {state === 'unterwegs' && totalStops > 0 && (
        <div className="mt-2 pt-2 border-t border-current/10">
          <div className="flex items-center justify-between text-xs">
            <span>Stopp {deliveredStops + 1}/{totalStops}</span>
            <span className="font-mono">{Math.round((deliveredStops / totalStops) * 100)}%</span>
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

function OrderTicket({ order, next }: { order: Order; next: string | null }) {
  const [pending, startTransition] = useTransition();

  const waitMin = order.bestellt_am
    ? Math.floor((Date.now() - new Date(order.bestellt_am).getTime()) / 60_000)
    : 0;
  const est = order.geschaetzte_zubereitung_min ?? 15;
  const urgent = order.status === 'in_zubereitung' && waitMin >= est;
  const critical = waitMin >= est + 10;

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
        <div className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold', urgent ? 'bg-orange-500 text-white' : 'bg-muted text-muted-foreground')}>
          <Clock className="h-2.5 w-2.5" />
          {waitMin}′
        </div>
      </div>

      <div className="mt-3">
        <div className="text-sm font-semibold">{order.kunde_name}</div>
        {order.typ === 'lieferung' && order.kunde_adresse && (
          <div className="text-xs text-muted-foreground">
            {order.kunde_adresse}{order.kunde_plz ? `, ${order.kunde_plz}` : ''}
          </div>
        )}
      </div>

      <ul className="mt-3 space-y-1.5 border-t pt-3">
        {order.items?.map((it) => (
          <li key={it.id} className="flex items-start gap-2 text-sm">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-matcha-100 text-[10px] font-bold text-matcha-800">
              {it.menge}
            </span>
            <div className="flex-1">
              <div className="font-medium leading-tight">{it.name}</div>
              {it.notiz && <div className="mt-0.5 text-[11px] italic text-orange-700">„{it.notiz}"</div>}
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

/* ------------------------------ Helpers ------------------------------ */

function computeDriverStates(drivers: Driver[], batches: Batch[], stops: Stop[]): Map<string, DriverState> {
  const map = new Map<string, DriverState>();
  for (const d of drivers) {
    if (!d.status?.ist_online) { map.set(d.id, 'offline'); continue; }
    const batch = batches.find((b) => b.driver_id === d.id);
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
