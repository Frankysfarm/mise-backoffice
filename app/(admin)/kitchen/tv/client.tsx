'use client';

/**
 * KitchenTVDisplay — Dedizierter TV-Vollbild-Modus für Küchen-Wanddisplays.
 * Optimiert für großen Abstand: große Schrift, starke Farbkodierung, kein Scrollen.
 * Route: /kitchen/tv
 */

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Bike, CheckCircle2, ChefHat, Clock, Navigation, Package, Timer, Zap } from 'lucide-react';

const LOCATION_ID = 'bb01ae0a-da47-48b1-b986-3a1201aacc4b';

type LiveOps = {
  eta_min: number;
  load: 'quiet' | 'normal' | 'busy';
  active_orders: number;
  drivers_online: number;
};

function useLiveOps() {
  const [data, setData] = useState<LiveOps | null>(null);
  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`/api/delivery/eta/live?location_id=${LOCATION_ID}`);
        if (!r.ok) return;
        const d = await r.json();
        setData({ eta_min: d.eta_min ?? 30, load: d.load ?? 'normal', active_orders: d.active_orders ?? 0, drivers_online: d.drivers_online ?? 0 });
      } catch {}
    };
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, []);
  return data;
}

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  typ: string;
  kunde_name: string;
  bestellt_am: string | null;
  fertig_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  items: { id: string; name: string; menge: number }[];
};

type KitchenTiming = {
  id: string;
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
};

type BatchEta = {
  order_id: string;
  driver_name: string;
  eta_sec: number | null;
};

type UrgencyLevel = 'ok' | 'tight' | 'urgent' | 'overdue';

function getUrgency(order: Order, timing: KitchenTiming | undefined): UrgencyLevel {
  const now = Date.now();

  if (timing?.ready_target) {
    const remainMs = new Date(timing.ready_target).getTime() - now;
    const remainMin = remainMs / 60_000;
    if (remainMin < 0) return 'overdue';
    if (remainMin < 3) return 'urgent';
    if (remainMin < 7) return 'tight';
    return 'ok';
  }

  if (!order.bestellt_am) return 'ok';
  const elapsedMin = (now - new Date(order.bestellt_am).getTime()) / 60_000;
  const prepMin = order.geschaetzte_zubereitung_min ?? 15;
  const ratio = elapsedMin / prepMin;
  if (ratio > 1.1) return 'overdue';
  if (ratio > 0.9) return 'urgent';
  if (ratio > 0.7) return 'tight';
  return 'ok';
}

function CountdownDisplay({ readyTarget, prepMin, startedAt }: {
  readyTarget: string | null;
  prepMin: number | null;
  startedAt: string | null;
}) {
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    const update = () => {
      if (readyTarget) {
        setSecs(Math.floor((new Date(readyTarget).getTime() - Date.now()) / 1000));
      } else if (startedAt && prepMin) {
        const endMs = new Date(startedAt).getTime() + prepMin * 60_000;
        setSecs(Math.floor((endMs - Date.now()) / 1000));
      }
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [readyTarget, prepMin, startedAt]);

  const overdue = secs < 0;
  const mm = Math.floor(Math.abs(secs) / 60);
  const ss = Math.abs(secs) % 60;

  return (
    <div className={cn('font-mono font-black tabular-nums', overdue ? 'text-red-400' : 'text-white')}>
      {overdue ? '+' : ''}{mm}:{String(ss).padStart(2, '0')}
    </div>
  );
}

function Clock24h() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, []);
  return <span className="font-mono">{time}</span>;
}

const URGENCY_STYLE: Record<UrgencyLevel, { card: string; header: string; text: string; dot: string }> = {
  ok:      { card: 'border-matcha-600 bg-matcha-900',       header: 'bg-matcha-700',  text: 'text-matcha-100', dot: 'bg-matcha-400' },
  tight:   { card: 'border-amber-500 bg-amber-950',         header: 'bg-amber-700',   text: 'text-amber-50',   dot: 'bg-amber-400 animate-pulse' },
  urgent:  { card: 'border-orange-500 bg-orange-950',       header: 'bg-orange-700',  text: 'text-orange-50',  dot: 'bg-orange-400 animate-pulse' },
  overdue: { card: 'border-red-500 bg-red-950 animate-pulse', header: 'bg-red-700',   text: 'text-red-50',     dot: 'bg-red-400 animate-ping' },
};

const URGENCY_LABEL: Record<UrgencyLevel, string> = {
  ok: 'Im Plan', tight: 'Aufpassen', urgent: 'Dringend!', overdue: 'ÜBERFÄLLIG',
};

export function KitchenTVDisplay({
  initialOrders,
  initialTimings,
}: {
  initialOrders: Order[];
  initialTimings: KitchenTiming[];
}) {
  const supabase = createClient();
  const [orders, setOrders] = useState(initialOrders);
  const [timings, setTimings] = useState(initialTimings);
  const [batchEtas, setBatchEtas] = useState<BatchEta[]>([]);

  const refresh = useCallback(async () => {
    const [{ data: o }, { data: t }, { data: bs }] = await Promise.all([
      supabase
        .from('customer_orders')
        .select('id, bestellnummer, status, typ, kunde_name, bestellt_am, fertig_am, geschaetzte_zubereitung_min, items:order_items(id, name, menge)')
        .in('status', ['bestätigt', 'in_zubereitung', 'fertig'])
        .order('bestellt_am', { ascending: true }),
      supabase
        .from('kitchen_timings')
        .select('id, order_id, cook_start_at, ready_target, prep_min, status')
        .in('status', ['scheduled', 'cooking']),
      supabase
        .from('delivery_batch_stops')
        .select('order_id, batch:delivery_batches(started_at, total_eta_min, fahrer:employees(vorname, nachname))')
        .in('status', ['pending', 'picked_up'])
        .limit(50),
    ]);
    if (o) setOrders(o as any[]);
    if (t) setTimings(t as any[]);
    if (bs) {
      const etas: BatchEta[] = (bs as any[]).map((s: any) => {
        const batch = s.batch;
        let eta_sec: number | null = null;
        if (batch?.started_at && batch?.total_eta_min != null) {
          eta_sec = Math.floor(
            (new Date(batch.started_at).getTime() + batch.total_eta_min * 60_000 - Date.now()) / 1000,
          );
        }
        return {
          order_id: s.order_id,
          driver_name: batch?.fahrer
            ? `${batch.fahrer.vorname} ${batch.fahrer.nachname.charAt(0)}.`
            : 'Fahrer',
          eta_sec,
        };
      });
      setBatchEtas(etas);
    }
  }, [supabase]);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 30_000);
    const ch = supabase
      .channel('kitchen-tv')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_orders' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kitchen_timings' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_batch_stops' }, refresh)
      .subscribe();

    return () => { clearInterval(iv); supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cooking = orders.filter((o) => o.status === 'in_zubereitung');
  const ready = orders.filter((o) => o.status === 'fertig');
  const accepted = orders.filter((o) => o.status === 'bestätigt');

  const timingMap  = new Map(timings.map((t) => [t.order_id, t]));
  const batchEtaMap = new Map(batchEtas.map((e) => [e.order_id, e]));

  const cookingWithUrgency = cooking
    .map((o) => ({ order: o, timing: timingMap.get(o.id), urgency: getUrgency(o, timingMap.get(o.id)) }))
    .sort((a, b) => {
      const rankU: Record<UrgencyLevel, number> = { overdue: 0, urgent: 1, tight: 2, ok: 3 };
      return rankU[a.urgency] - rankU[b.urgency];
    });

  const overdue = cookingWithUrgency.filter((x) => x.urgency === 'overdue');
  const critical = cookingWithUrgency.filter((x) => x.urgency !== 'ok');
  const liveOps = useLiveOps();

  return (
    <div className="min-h-screen bg-matcha-950 text-white flex flex-col select-none">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-white/10 bg-matcha-900">
        <div className="flex items-center gap-3">
          <ChefHat className="h-8 w-8 text-accent" />
          <div>
            <div className="text-2xl font-black tracking-tight">Küchen-Display</div>
            <div className="text-[11px] text-matcha-400 font-bold uppercase tracking-widest">Smart Delivery System</div>
          </div>
        </div>

        {/* Live-Ampel */}
        <div className="flex items-center gap-6">
          {/* Live-Ops-Status: Kunden-ETA + Fahrer */}
          {liveOps && (
            <div className={cn(
              'flex items-center gap-3 rounded-xl px-4 py-2 border text-sm',
              liveOps.load === 'busy' ? 'bg-red-900/40 border-red-500/50 text-red-200' :
              liveOps.load === 'normal' ? 'bg-amber-900/30 border-amber-500/40 text-amber-200' :
              'bg-matcha-900/50 border-matcha-500/40 text-matcha-200',
            )}>
              <span className={cn(
                'h-2.5 w-2.5 rounded-full shrink-0',
                liveOps.load === 'busy' ? 'bg-red-400 animate-pulse' :
                liveOps.load === 'normal' ? 'bg-amber-400' : 'bg-matcha-400',
              )} />
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4 opacity-60" />
                  <span className="font-black tabular-nums">~{liveOps.eta_min} Min</span>
                  <span className="opacity-60 text-xs">ETA</span>
                </div>
                <div className="flex items-center gap-1">
                  <Bike className="h-4 w-4 opacity-60" />
                  <span className={cn('font-black tabular-nums', liveOps.drivers_online === 0 && 'text-red-400')}>
                    {liveOps.drivers_online}
                  </span>
                  <span className="opacity-60 text-xs">Fahrer</span>
                </div>
                <div className="flex items-center gap-1">
                  <Package className="h-4 w-4 opacity-60" />
                  <span className="font-black tabular-nums">{liveOps.active_orders}</span>
                  <span className="opacity-60 text-xs">aktiv</span>
                </div>
              </div>
            </div>
          )}
          {overdue.length > 0 && (
            <div className="flex items-center gap-2 bg-red-700 rounded-xl px-4 py-2 animate-pulse">
              <span className="h-3 w-3 rounded-full bg-red-300 animate-ping" />
              <span className="font-black text-lg">{overdue.length} ÜBERFÄLLIG</span>
            </div>
          )}
          <div className="text-right">
            <div className="text-4xl font-black text-accent">
              <Clock24h />
            </div>
            <div className="text-[10px] text-matcha-400 uppercase tracking-widest mt-0.5">
              {cooking.length} kochend · {ready.length} fertig · {accepted.length} wartend
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-3 gap-0 overflow-hidden">
        {/* KOCHEND */}
        <section className="border-r border-white/10 p-6 overflow-y-auto">
          <div className="flex items-center gap-2 mb-5">
            <Zap className="h-5 w-5 text-orange-400" />
            <span className="font-black text-xl uppercase tracking-wider text-orange-300">
              Kochend ({cooking.length})
            </span>
          </div>
          <div className="space-y-3">
            {cookingWithUrgency.map(({ order: o, timing, urgency }) => {
              const s = URGENCY_STYLE[urgency];
              const items = o.items ?? [];
              return (
                <div key={o.id} className={cn('rounded-2xl border-2 overflow-hidden', s.card)}>
                  <div className={cn('flex items-center justify-between px-4 py-2', s.header)}>
                    <div className="flex items-center gap-2">
                      <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', s.dot)} />
                      <span className="font-black text-lg">#{o.bestellnummer.slice(-4)}</span>
                      <span className="text-sm opacity-80 truncate max-w-[120px]">{o.kunde_name}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black">
                        {timing ? (
                          <CountdownDisplay
                            readyTarget={timing.ready_target}
                            prepMin={timing.prep_min}
                            startedAt={timing.cook_start_at}
                          />
                        ) : (
                          <ElapsedSince iso={o.bestellt_am} />
                        )}
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-wide opacity-70">
                        {URGENCY_LABEL[urgency]}
                      </div>
                    </div>
                  </div>
                  <div className="px-4 py-2">
                    <div className="flex flex-wrap gap-1.5">
                      {items.slice(0, 4).map((it, i) => (
                        <span key={i} className="text-[11px] font-bold bg-white/10 rounded-full px-2 py-0.5">
                          {it.menge}× {it.name}
                        </span>
                      ))}
                      {items.length > 4 && (
                        <span className="text-[11px] text-white/50">+{items.length - 4}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {cooking.length === 0 && (
              <div className="text-center text-matcha-600 py-8 text-sm">Keine Bestellungen in Zubereitung</div>
            )}
          </div>
        </section>

        {/* FERTIG */}
        <section className="border-r border-white/10 p-6 overflow-y-auto">
          <div className="flex items-center gap-2 mb-5">
            <Package className="h-5 w-5 text-accent" />
            <span className="font-black text-xl uppercase tracking-wider text-accent">
              Fertig ({ready.length})
            </span>
          </div>
          <div className="space-y-3">
            {ready.map((o) => {
              const fertigMin = o.fertig_am
                ? Math.floor((Date.now() - new Date(o.fertig_am).getTime()) / 60_000)
                : null;
              const tooLong = fertigMin != null && fertigMin > 10;
              const batchEta = batchEtaMap.get(o.id);
              const driverEtaMin = batchEta?.eta_sec != null
                ? Math.max(0, Math.ceil(batchEta.eta_sec / 60))
                : null;
              const driverSoon = driverEtaMin !== null && driverEtaMin <= 3;
              return (
                <div
                  key={o.id}
                  className={cn(
                    'rounded-2xl border-2 overflow-hidden',
                    driverSoon
                      ? 'border-purple-500 bg-purple-950 animate-pulse'
                      : tooLong
                      ? 'border-amber-500 bg-amber-950'
                      : 'border-accent/40 bg-matcha-800',
                  )}
                >
                  <div className="p-4 flex items-center justify-between">
                    <div>
                      <div className="font-black text-2xl">#{o.bestellnummer.slice(-4)}</div>
                      <div className="text-sm text-matcha-300 truncate max-w-[160px]">{o.kunde_name}</div>
                      <div className="text-[11px] text-matcha-500 mt-0.5">
                        {o.typ === 'lieferung' ? '🛵 Lieferung' : '🏃 Abholung'}
                      </div>
                    </div>
                    <div className="text-right">
                      {fertigMin != null && (
                        <div className={cn('font-mono font-black text-3xl', driverSoon ? 'text-purple-300' : tooLong ? 'text-amber-300' : 'text-accent')}>
                          {fertigMin}m
                        </div>
                      )}
                      <div className="text-[10px] text-matcha-400 uppercase tracking-wide">wartet</div>
                      {tooLong && !driverSoon && (
                        <div className="text-[10px] font-black text-amber-400 animate-pulse mt-0.5">Dispatch!</div>
                      )}
                    </div>
                  </div>
                  {/* Fahrer-ETA-Streifen */}
                  {batchEta && (
                    <div className={cn(
                      'flex items-center gap-2 px-4 py-2 border-t text-sm',
                      driverSoon
                        ? 'border-purple-600 bg-purple-800/60 text-purple-100'
                        : 'border-white/10 bg-white/5 text-matcha-300',
                    )}>
                      {driverSoon
                        ? <Navigation className="h-4 w-4 text-purple-300 animate-pulse shrink-0" />
                        : <Bike className="h-4 w-4 shrink-0 opacity-60" />
                      }
                      <span className="font-bold truncate max-w-[120px]">{batchEta.driver_name}</span>
                      {driverEtaMin !== null && (
                        <span className="ml-auto font-black tabular-nums shrink-0">
                          {driverSoon ? '⚡ gleich da!' : `~${driverEtaMin} Min`}
                        </span>
                      )}
                      {driverEtaMin === null && (
                        <span className="ml-auto flex items-center gap-1 text-[11px] opacity-60">
                          <Timer className="h-3 w-3" /> unterwegs
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {ready.length === 0 && (
              <div className="text-center text-matcha-600 py-8 flex flex-col items-center gap-2">
                <CheckCircle2 className="h-8 w-8 text-matcha-700" />
                <span className="text-sm">Keine wartenden Bestellungen</span>
              </div>
            )}
          </div>
        </section>

        {/* WARTEND */}
        <section className="p-6 overflow-y-auto">
          <div className="flex items-center gap-2 mb-5">
            <Clock className="h-5 w-5 text-blue-400" />
            <span className="font-black text-xl uppercase tracking-wider text-blue-300">
              Wartend ({accepted.length})
            </span>
          </div>
          <div className="space-y-2">
            {accepted.map((o) => {
              const waitMin = o.bestellt_am
                ? Math.floor((Date.now() - new Date(o.bestellt_am).getTime()) / 60_000)
                : null;
              return (
                <div key={o.id} className="rounded-xl border border-blue-900 bg-blue-950/40 px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="font-black text-lg">#{o.bestellnummer.slice(-4)}</div>
                    <div className="text-[11px] text-blue-300 truncate max-w-[140px]">{o.kunde_name}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-xl text-blue-200">{waitMin ?? '–'}m</div>
                    <div className="text-[9px] text-blue-400 uppercase">wartet</div>
                  </div>
                </div>
              );
            })}
            {accepted.length === 0 && (
              <div className="text-center text-matcha-600 py-8 text-sm">Keine wartenden Bestellungen</div>
            )}
          </div>
        </section>
      </main>

      {/* Footer: Legende */}
      <footer className="px-8 py-3 border-t border-white/10 bg-matcha-900 flex items-center gap-8 text-[11px] text-matcha-400">
        {[
          { dot: 'bg-matcha-400', label: 'Im Plan' },
          { dot: 'bg-amber-400', label: 'Aufpassen' },
          { dot: 'bg-orange-400 animate-pulse', label: 'Dringend' },
          { dot: 'bg-red-400 animate-ping', label: 'Überfällig' },
        ].map((l) => (
          <span key={l.label} className="flex items-center gap-1.5">
            <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', l.dot)} />
            {l.label}
          </span>
        ))}
        <span className="ml-auto">Mise Smart Delivery · /kitchen/tv</span>
      </footer>
    </div>
  );
}

function ElapsedSince({ iso }: { iso: string | null }) {
  const [min, setMin] = useState(0);
  useEffect(() => {
    if (!iso) return;
    const update = () => setMin(Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
    update();
    const iv = setInterval(update, 60_000);
    return () => clearInterval(iv);
  }, [iso]);
  return <span className="text-matcha-300">{min}m</span>;
}
