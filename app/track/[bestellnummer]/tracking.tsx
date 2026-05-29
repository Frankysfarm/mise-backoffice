'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const LiveMap = dynamic(() => import('./live-map').then((m) => m.LiveMap), { ssr: false });
import { cn, euro } from '@/lib/utils';
import {
  Check,
  ChefHat,
  Clock,
  MapPin,
  Package,
  Phone,
  Send,
  Truck,
  ShoppingBag,
  MessageCircle,
} from 'lucide-react';

type Order = {
  order_id: string;
  bestellnummer: string;
  status: string;
  typ: string;
  kunde_name: string;
  kunde_adresse: string | null;
  kunde_plz: string | null;
  kunde_stadt: string | null;
  kunde_lat: number | null;
  kunde_lng: number | null;
  zahlungsart: string;
  bezahlt: boolean;
  gesamtbetrag: number;
  bestellt_am: string | null;
  fertig_am: string | null;
  geliefert_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  geschaetzte_lieferung_min: number | null;
  eta_earliest: string | null;
  eta_latest: string | null;
  fahrer_id: string | null;
  fahrer_vorname: string | null;
  fahrer_avatar: string | null;
  fahrer_lat: number | null;
  fahrer_lng: number | null;
  fahrer_heading: number | null;
  fahrer_last_update: string | null;
  fahrer_fahrzeug: string | null;
};

type Item = { name: string; menge: number; einzelpreis: number };

type Msg = {
  id: string;
  sender: 'fahrer' | 'kunde' | 'system';
  nachricht: string;
  created_at: string;
};

const STEPS: { status: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { status: 'bestätigt', label: 'Bestätigt', icon: Check },
  { status: 'in_zubereitung', label: 'Zubereitung', icon: ChefHat },
  { status: 'fertig', label: 'Fertig', icon: Package },
  { status: 'unterwegs', label: 'Unterwegs', icon: Truck },
  { status: 'geliefert', label: 'Geliefert', icon: ShoppingBag },
];

function stepIndex(status: string): number {
  const i = STEPS.findIndex((s) => s.status === status);
  return i >= 0 ? i : 0;
}

export function TrackingView({ order: initial, items, tenant }: { order: Order; items: Item[]; tenant?: { name?: string | null; logo_url?: string | null; brand_color?: string | null } | null }) {
  const supabase = createClient();
  const [order, setOrder] = useState(initial);
  const [stopsBefore, setStopsBefore] = useState<number | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const [, setTick] = useState(0);

  // Tick every second for live countdowns
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Poll tracking API every 30s to update driver position and ETA
  useEffect(() => {
    const pollTracking = () => {
      fetch(`/api/delivery/orders/${order.order_id}/tracking`)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => {
          if (!d) return;
          setOrder((prev) => ({
            ...prev,
            status: d.status ?? prev.status,
            eta_earliest: d.eta_earliest ?? prev.eta_earliest,
            eta_latest: d.eta_latest ?? prev.eta_latest,
            fahrer_lat: d.driver?.lat ?? prev.fahrer_lat,
            fahrer_lng: d.driver?.lng ?? prev.fahrer_lng,
            fahrer_heading: d.driver?.heading ?? prev.fahrer_heading,
            fahrer_last_update: d.driver ? new Date().toISOString() : prev.fahrer_last_update,
          }));
          if (d.stops_before != null) setStopsBefore(d.stops_before);
        })
        .catch(() => {});
    };
    // Only poll for active deliveries
    if (!['geliefert', 'abgeholt', 'storniert'].includes(order.status)) {
      pollTracking();
      const iv = setInterval(pollTracking, 30_000);
      return () => clearInterval(iv);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.order_id, order.status]);

  useEffect(() => {
    const ch = supabase
      .channel(`track:${order.order_id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customer_orders', filter: `id=eq.${order.order_id}` },
        () => void refresh(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driver_status' },
        () => void refresh(),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'order_messages', filter: `order_id=eq.${order.order_id}` },
        (payload: { new: Msg }) => setMessages((m) => [...m, payload.new]),
      )
      .subscribe();
    void loadMessages();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    const { data } = await supabase
      .from('v_order_tracking')
      .select('*')
      .eq('order_id', order.order_id)
      .maybeSingle();
    if (data) setOrder(data as Order);
  }
  async function loadMessages() {
    const { data } = await supabase
      .from('order_messages')
      .select('id, sender, nachricht, created_at')
      .eq('order_id', order.order_id)
      .order('created_at', { ascending: true });
    setMessages((data as Msg[]) ?? []);
    setTimeout(() => listRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 50);
  }

  async function send() {
    const msg = text.trim();
    if (!msg) return;
    setText('');
    await supabase.from('order_messages').insert({
      order_id: order.order_id,
      sender: 'kunde',
      nachricht: msg,
    });
  }

  const active = stepIndex(order.status);
  const isDelivery = order.typ === 'lieferung';
  const unread = messages.filter((m) => m.sender === 'fahrer').length;

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="border-b bg-matcha-900 text-matcha-50">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            {tenant?.logo_url ? (
              <img src={tenant.logo_url} alt={tenant.name ?? 'Logo'} className="h-8 w-8 rounded-lg object-cover" />
            ) : (
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-matcha-700 text-sm font-bold text-matcha-50">
                {(tenant?.name ?? 'M').charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <div className="font-display text-base font-bold leading-none">{tenant?.name ?? 'Bestellung'}</div>
              <div className="mt-0.5 text-[10px] uppercase tracking-wider text-matcha-300">Bestellung verfolgen</div>
            </div>
          </div>
          <div className="font-mono text-xs tracking-wider text-matcha-300">#{order.bestellnummer.replace(/^[A-Z]+-/, '')}</div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 sm:space-y-5 p-4 sm:p-5 pb-24">
        {/* Hero-Status */}
        <div className="rounded-2xl bg-gradient-to-br from-matcha-800 to-matcha-600 p-5 sm:p-6 text-white shadow-soft">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-matcha-200">
            <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-accent" />
            {heroHeadline(order)}
          </div>
          <h1 className="mt-2 font-display text-2xl sm:text-3xl font-bold leading-tight tracking-tight">
            {heroTitle(order)}
          </h1>
          <p className="mt-1 text-sm text-matcha-100">{heroSub(order)}</p>

          {order.status !== 'geliefert' && order.status !== 'abgeholt' && order.status !== 'storniert' && (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm backdrop-blur">
                  <Clock className="h-4 w-4" />
                  {eta(order)}
                </div>
                {(order.eta_earliest || order.eta_latest) && etaCountdown(order) && (
                  <div className="inline-flex items-center gap-2 rounded-full bg-accent/20 border border-accent/40 px-4 py-2 text-sm font-bold tabular-nums">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
                    {etaCountdown(order)}
                  </div>
                )}
              </div>
              {order.eta_earliest && order.eta_latest && order.bestellt_am && (
                <EtaWindowBar
                  startIso={order.bestellt_am}
                  earliestIso={order.eta_earliest}
                  latestIso={order.eta_latest}
                />
              )}
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="rounded-2xl border bg-card p-4 sm:p-5 shadow-subtle">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-sm font-bold uppercase tracking-wider">Status</h2>
            <span className="text-xs text-muted-foreground">
              Bestellt um {order.bestellt_am ? new Date(order.bestellt_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '—'}
            </span>
          </div>
          <ol className="relative space-y-5">
            <div className="absolute bottom-2 left-[15px] top-2 w-0.5 bg-border" />
            <div
              className="absolute left-[15px] top-2 w-0.5 bg-matcha-500 transition-all duration-700"
              style={{ height: `calc(${(active / (STEPS.length - 1)) * 100}% - 1rem)` }}
            />
            {STEPS.map((s, i) => {
              const done = i < active;
              const current = i === active;
              const Icon = s.icon;
              return (
                <li key={s.status} className="relative flex items-center gap-4 pl-0">
                  <div
                    className={cn(
                      'relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition',
                      done && 'border-matcha-500 bg-matcha-500 text-white',
                      current && 'border-matcha-500 bg-white text-matcha-600 ring-4 ring-matcha-500/20',
                      !done && !current && 'border-border bg-card text-muted-foreground',
                    )}
                  >
                    {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <div className="flex-1">
                    <div
                      className={cn(
                        'text-sm font-semibold',
                        current && 'text-matcha-700',
                        !done && !current && 'text-muted-foreground',
                      )}
                    >
                      {s.label}
                    </div>
                    {current && <div className="mt-0.5 text-xs text-muted-foreground">Jetzt</div>}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Fahrer + Map */}
        {isDelivery && order.fahrer_id && (order.status === 'unterwegs' || order.status === 'geliefert') && (
          <div className="overflow-hidden rounded-2xl border bg-card shadow-subtle">
            <div className="relative h-72 sm:h-56 bg-matcha-50">
              <LiveMap
                driver={order.fahrer_lat && order.fahrer_lng ? { lat: Number(order.fahrer_lat), lng: Number(order.fahrer_lng) } : null}
                dest={order.kunde_lat && order.kunde_lng ? { lat: Number(order.kunde_lat), lng: Number(order.kunde_lng) } : null}
              />
            </div>
            <div className="flex items-center gap-3 sm:gap-4 p-4 sm:p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-matcha-700 font-display text-base font-bold text-white">
                {order.fahrer_vorname?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="font-display text-base font-bold">{order.fahrer_vorname}</div>
                  <span className="text-lg">{vehicleEmoji(order.fahrer_fahrzeug)}</span>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {order.fahrer_last_update
                    ? `Zuletzt gesehen vor ${Math.max(0, Math.floor((Date.now() - new Date(order.fahrer_last_update).getTime()) / 60000))} Min.`
                    : 'Unterwegs'}
                </div>
                {stopsBefore != null && order.status === 'unterwegs' && (
                  <div className={cn(
                    'mt-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold',
                    stopsBefore === 0
                      ? 'bg-matcha-700 text-white'
                      : stopsBefore === 1
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-stone-100 text-stone-700',
                  )}>
                    <Truck className="h-3 w-3" />
                    {stopsBefore === 0
                      ? 'Nächste Lieferung'
                      : stopsBefore === 1
                      ? '1 Stop vor dir'
                      : `${stopsBefore} Stops vor dir`}
                  </div>
                )}
              </div>
              <button
                onClick={() => setChatOpen(true)}
                className="relative flex h-11 w-11 items-center justify-center rounded-full bg-matcha-700 text-white transition hover:bg-matcha-800"
              >
                <MessageCircle className="h-5 w-5" />
                {unread > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-matcha-900">
                    {unread}
                  </span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Adresse */}
        <div className="rounded-2xl border bg-card p-4 sm:p-5 shadow-subtle">
          <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-wider">Lieferadresse</h2>
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-5 w-5 text-matcha-600" />
            <div className="flex-1 text-sm">
              <div className="font-semibold">{order.kunde_name}</div>
              <div className="text-muted-foreground">
                {order.kunde_adresse}
                {order.kunde_plz || order.kunde_stadt ? (
                  <>
                    <br />
                    {order.kunde_plz} {order.kunde_stadt}
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Bestellung */}
        <div className="rounded-2xl border bg-card p-4 sm:p-5 shadow-subtle">
          <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-wider">Deine Bestellung</h2>
          <ul className="space-y-3">
            {items.map((it, i) => (
              <li key={i} className="flex items-start justify-between gap-4 text-sm">
                <div className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-matcha-100 text-xs font-bold text-matcha-700">
                    {it.menge}
                  </span>
                  <span>{it.name}</span>
                </div>
                <span className="whitespace-nowrap font-medium">{euro(it.menge * it.einzelpreis)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex items-center justify-between border-t pt-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Gesamt</span>
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase', order.bezahlt ? 'bg-matcha-700 text-white' : 'bg-gold text-matcha-900')}>
                {order.bezahlt ? 'Bezahlt' : paymentLabel(order.zahlungsart)}
              </span>
            </div>
            <div className="font-display text-xl font-bold">{euro(order.gesamtbetrag)}</div>
          </div>
        </div>

        <p className="pt-2 text-center text-xs text-muted-foreground">
          Fragen? <a href="tel:+4924190008888" className="underline">Anrufen</a> · Antworten in Minuten
        </p>
      </main>

      {/* Chat Modal */}
      {chatOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50 backdrop-blur-sm" onClick={() => setChatOpen(false)}>
          <div
            className="flex h-[85vh] w-full flex-col rounded-t-3xl bg-card shadow-strong"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-matcha-700 font-bold text-white">
                {order.fahrer_vorname?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="flex-1">
                <div className="font-display text-base font-bold">{order.fahrer_vorname ?? 'Fahrer'}</div>
                <div className="text-xs text-matcha-600">Live-Chat</div>
              </div>
              <button onClick={() => setChatOpen(false)} className="text-2xl text-muted-foreground">×</button>
            </div>

            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.length === 0 && (
                <div className="pt-10 text-center text-sm text-muted-foreground">
                  Noch keine Nachricht. Schreib deinem Fahrer gerne.
                </div>
              )}
              {messages.map((m) => (
                <div key={m.id} className={cn('flex', m.sender === 'kunde' ? 'justify-end' : 'justify-start')}>
                  <div
                    className={cn(
                      'max-w-[75%] rounded-2xl px-4 py-2 text-sm',
                      m.sender === 'kunde'
                        ? 'rounded-br-md bg-matcha-700 text-white'
                        : m.sender === 'system'
                        ? 'rounded-md border bg-muted text-xs italic text-muted-foreground'
                        : 'rounded-bl-md border bg-muted',
                    )}
                  >
                    {m.nachricht}
                    <div className={cn('mt-1 text-[10px]', m.sender === 'kunde' ? 'text-matcha-200' : 'text-muted-foreground')}>
                      {new Date(m.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-end gap-2 border-t p-4">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Nachricht …"
                rows={1}
                className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <button
                onClick={send}
                disabled={!text.trim()}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-matcha-700 text-white transition hover:bg-matcha-800 disabled:opacity-40"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ETA-Zeitfenster-Balken — zeigt den Lieferkorridor visuell */
function EtaWindowBar({
  startIso,
  earliestIso,
  latestIso,
}: {
  startIso: string;
  earliestIso: string;
  latestIso: string;
}) {
  const now = Date.now();
  const startMs = new Date(startIso).getTime();
  const earliestMs = new Date(earliestIso).getTime();
  const latestMs = new Date(latestIso).getTime();

  // Zeige Balken von Bestellzeitpunkt bis ~30 Min nach latestMs
  const windowStart = startMs;
  const windowEnd = latestMs + 5 * 60_000;
  const totalMs = windowEnd - windowStart;

  const earliestPct = Math.max(0, Math.min(100, ((earliestMs - windowStart) / totalMs) * 100));
  const latestPct = Math.max(0, Math.min(100, ((latestMs - windowStart) / totalMs) * 100));
  const nowPct = Math.max(0, Math.min(100, ((now - windowStart) / totalMs) * 100));

  const isOverdue = now > latestMs;
  const isInWindow = now >= earliestMs && now <= latestMs;

  const fmt = (ms: number) =>
    new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });

  return (
    <div className="rounded-xl bg-white/10 px-4 py-3">
      <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-matcha-200">
        <span>Lieferfenster</span>
        <span className={cn(
          'rounded-full px-2 py-0.5',
          isOverdue ? 'bg-red-500/40 text-red-200' :
          isInWindow ? 'bg-accent/30 text-accent animate-pulse' :
          'bg-white/10 text-matcha-300',
        )}>
          {isOverdue ? 'Überzogen' : isInWindow ? 'Jetzt erwartet' : `Ab ${fmt(earliestMs)}`}
        </span>
      </div>
      {/* Bar */}
      <div className="relative h-3 rounded-full bg-white/10">
        {/* Lieferfenster (grün) */}
        <div
          className={cn(
            'absolute top-0 h-full rounded-full',
            isOverdue ? 'bg-red-400/60' : 'bg-accent/50',
          )}
          style={{ left: `${earliestPct}%`, width: `${Math.max(2, latestPct - earliestPct)}%` }}
        />
        {/* Jetzt-Marker */}
        <div
          className={cn(
            'absolute top-1/2 -translate-y-1/2 h-4 w-1 rounded-full shadow-sm transition-all duration-1000',
            isOverdue ? 'bg-red-300' : isInWindow ? 'bg-accent' : 'bg-white/70',
          )}
          style={{ left: `calc(${nowPct}% - 2px)` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-matcha-300">
        <span>{fmt(startMs)}</span>
        <span className={cn(isInWindow && 'text-accent font-bold')}>
          {fmt(earliestMs)}–{fmt(latestMs)}
        </span>
      </div>
    </div>
  );
}

function heroHeadline(o: Order): string {
  switch (o.status) {
    case 'neu': return 'Eingegangen';
    case 'bestätigt': return 'Bestätigt';
    case 'in_zubereitung': return 'Wird zubereitet';
    case 'fertig': return o.typ === 'lieferung' ? 'Wartet auf Fahrer' : 'Zur Abholung bereit';
    case 'unterwegs': return 'Dein Fahrer ist unterwegs';
    case 'geliefert': return 'Geliefert';
    case 'abgeholt': return 'Abgeholt';
    case 'storniert': return 'Storniert';
    default: return o.status;
  }
}
function heroTitle(o: Order): string {
  if (o.status === 'geliefert') return 'Guten Appetit 🍵';
  if (o.status === 'unterwegs') return `Gleich bei dir, ${o.kunde_name.split(' ')[0]}!`;
  if (o.status === 'fertig' && o.typ === 'lieferung') return 'Ein Fahrer kommt gleich vorbei';
  if (o.status === 'fertig') return 'Du kannst abholen';
  if (o.status === 'in_zubereitung') return 'In der Küche';
  return 'Danke für deine Bestellung';
}
function heroSub(o: Order): string {
  if (o.status === 'geliefert') return 'Wir hoffen, es hat geschmeckt.';
  if (o.status === 'unterwegs') return 'Du kannst den Fahrer live verfolgen.';
  if (o.status === 'in_zubereitung') return 'Frisch gemacht, dauert noch ein paar Minuten.';
  return 'Wir halten dich hier auf dem Laufenden.';
}
function eta(o: Order): string {
  if (o.status === 'unterwegs') {
    if (o.eta_earliest && o.eta_latest) {
      const fmt = (iso: string) =>
        new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
      return `Ankunft ${fmt(o.eta_earliest)}–${fmt(o.eta_latest)}`;
    }
    return `Ankunft in ca. ${o.geschaetzte_lieferung_min ?? 10} Min.`;
  }
  if (o.status === 'in_zubereitung' || o.status === 'bestätigt') {
    if (o.eta_earliest) {
      const fmt = (iso: string) =>
        new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
      return `Bereit ab ca. ${fmt(o.eta_earliest)}`;
    }
    return `Fertig in ca. ${o.geschaetzte_zubereitung_min ?? 15} Min.`;
  }
  if (o.status === 'fertig' && o.typ === 'lieferung') {
    return 'Wird gleich abgeholt';
  }
  return '';
}

function etaCountdown(o: Order): string | null {
  const target = o.eta_latest ?? o.eta_earliest;
  if (!target) return null;
  const secs = Math.floor((new Date(target).getTime() - Date.now()) / 1000);
  if (secs <= 0) return 'Jeden Moment';
  if (secs > 90 * 60) return null; // don't show for far-future ETAs
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `Noch ${m}:${String(s).padStart(2, '0')} Min` : `Noch ${s}s`;
}
function paymentLabel(z: string): string {
  switch (z) {
    case 'bar': return 'Bar bei Lieferung';
    case 'karte': return 'Karte bei Lieferung';
    default: return z;
  }
}
function vehicleEmoji(v: string | null): string {
  switch (v) {
    case 'bike': return '🚲';
    case 'ebike': return '🛵';
    case 'scooter': return '🛴';
    case 'auto': return '🚗';
    default: return '🚲';
  }
}

