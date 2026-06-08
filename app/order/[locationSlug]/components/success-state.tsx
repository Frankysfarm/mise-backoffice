'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, Check, ChefHat, ChevronDown, ChevronUp, Package, ShoppingBag, Truck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type CartItem = {
  item: { name: string; preis: number };
  qty: number;
  extra_preis?: number;
};

type Props = {
  bestellnummer: string;
  name?: string;
  etaMinutes: number;
  isDelivery: boolean;
  onNewOrder: () => void;
  orderId?: string;
  cartItems?: CartItem[];
};

const DELIVERY_STEPS = [
  { status: 'bestätigt',      label: 'Angenommen',  icon: Check },
  { status: 'in_zubereitung', label: 'Zubereitung', icon: ChefHat },
  { status: 'fertig',         label: 'Bereit',      icon: Package },
  { status: 'unterwegs',      label: 'Unterwegs',   icon: Truck },
  { status: 'geliefert',      label: 'Geliefert',   icon: Check },
] as const;

const PICKUP_STEPS = [
  { status: 'bestätigt',      label: 'Angenommen',  icon: Check },
  { status: 'in_zubereitung', label: 'Zubereitung', icon: ChefHat },
  { status: 'fertig',         label: 'Abholbereit', icon: Package },
  { status: 'abgeholt',       label: 'Abgeholt',    icon: ShoppingBag },
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StatusStep = { status: string; label: string; icon: any };

function liveStatusIndex(status: string, steps: readonly StatusStep[]): number {
  const i = steps.findIndex((s) => s.status === status);
  return i >= 0 ? i : 0;
}

export function SuccessState({ bestellnummer, name, etaMinutes, isDelivery, onNewOrder, orderId, cartItems }: Props) {
  const firstName = name?.split(' ')[0];
  const supabase = React.useMemo(() => createClient(), []);
  const STATUS_STEPS: readonly StatusStep[] = isDelivery ? DELIVERY_STEPS : PICKUP_STEPS;

  const [itemsOpen, setItemsOpen] = React.useState(false);
  const [secsLeft, setSecsLeft] = React.useState(etaMinutes * 60);
  const [etaWindow, setEtaWindow] = React.useState<{ earliest: string; latest: string } | null>(null);
  const [liveStatus, setLiveStatus] = React.useState<string>('bestätigt');
  const [statusFlash, setStatusFlash] = React.useState(false);
  const [driverName, setDriverName] = React.useState<string | null>(null);
  const [shared, setShared] = React.useState(false);
  const [rating, setRating] = React.useState(0);
  const [ratingHover, setRatingHover] = React.useState(0);
  const [ratingSubmitted, setRatingSubmitted] = React.useState(false);
  const [driverPos, setDriverPos] = React.useState<{ lat: number; lng: number; heading: number | null; seconds_stale: number } | null>(null);
  const trackingMapRef = React.useRef<HTMLDivElement>(null);
  const trackingMapInstanceRef = React.useRef<{ map: any; marker: any } | null>(null);

  async function submitRating(stars: number) {
    if (!orderId || ratingSubmitted) return;
    setRating(stars);
    setRatingSubmitted(true);
    try {
      const tokenRes = await fetch(`/api/delivery/orders/${orderId}/rate`);
      if (tokenRes.ok) {
        const { token } = await tokenRes.json() as { token?: string };
        if (token) {
          await fetch(`/api/delivery/orders/${orderId}/rate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, rating: stars }),
          });
        }
      }
    } catch {}
  }

  async function shareTracking() {
    const url = typeof window !== 'undefined' ? `${window.location.origin}/track/${bestellnummer}` : '';
    const text = `Verfolge meine Bestellung ${bestellnummer} live!`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Bestellung verfolgen', text, url }); } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setShared(true);
        setTimeout(() => setShared(false), 3000);
      } catch {}
    }
  }

  React.useEffect(() => {
    if (secsLeft <= 0) return;
    const t = setTimeout(() => setSecsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secsLeft]);

  // Live ETA polling every 30s
  React.useEffect(() => {
    if (!orderId) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/delivery/eta/${orderId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data?.eta_earliest) {
          const newSecsLeft = Math.max(0, Math.floor((new Date(data.eta_earliest).getTime() - Date.now()) / 1000));
          setSecsLeft(newSecsLeft);
          if (data.eta_latest) {
            setEtaWindow({ earliest: data.eta_earliest, latest: data.eta_latest });
          }
        }
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 30_000);
    return () => clearInterval(iv);
  }, [orderId]);

  // Supabase realtime: live status updates
  React.useEffect(() => {
    if (!orderId) return;
    const ch = supabase
      .channel(`success-order-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'customer_orders', filter: `id=eq.${orderId}` },
        (payload: { new: { status?: string; eta_earliest?: string; eta_latest?: string } }) => {
          const newStatus = payload.new?.status;
          if (newStatus && newStatus !== liveStatus) {
            setLiveStatus(newStatus);
            setStatusFlash(true);
            setTimeout(() => setStatusFlash(false), 3000);
            // fahrer_vorname is not a column on customer_orders — fetch via tracking API
            if (newStatus === 'unterwegs' && orderId) {
              fetch(`/api/delivery/orders/${orderId}/tracking`)
                .then((r) => r.ok ? r.json() : null)
                .then((d) => { if (d?.driver_name) setDriverName(d.driver_name); })
                .catch(() => {});
            }
          }
          if (payload.new?.eta_earliest) {
            const newSecsLeft = Math.max(0, Math.floor((new Date(payload.new.eta_earliest).getTime() - Date.now()) / 1000));
            setSecsLeft(newSecsLeft);
            if (payload.new.eta_latest) {
              setEtaWindow({ earliest: payload.new.eta_earliest, latest: payload.new.eta_latest });
            }
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  // Poll driver GPS position every 15s when order is en-route
  React.useEffect(() => {
    if (!orderId || !isDelivery || liveStatus !== 'unterwegs') return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/delivery/orders/${orderId}/tracking`);
        if (!res.ok || cancelled) return;
        const d = await res.json();
        if (d?.driver?.lat != null) setDriverPos(d.driver);
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 15_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [orderId, isDelivery, liveStatus]);

  // Leaflet mini-map: init on first driver position, then pan on updates
  React.useEffect(() => {
    if (!driverPos || !trackingMapRef.current) return;
    (async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css' as any).catch(() => {});
      if (!trackingMapInstanceRef.current) {
        const map = L.map(trackingMapRef.current!, {
          zoomControl: false, attributionControl: false,
          dragging: false, scrollWheelZoom: false, doubleClickZoom: false,
        }).setView([driverPos.lat, driverPos.lng], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:36px;height:36px;border-radius:50%;background:#4ae68a;border:3px solid #fff;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 12px rgba(0,0,0,0.4)">🛵</div>`,
          iconAnchor: [18, 18],
        });
        const marker = L.marker([driverPos.lat, driverPos.lng], { icon }).addTo(map);
        trackingMapInstanceRef.current = { map, marker };
      } else {
        trackingMapInstanceRef.current.marker.setLatLng([driverPos.lat, driverPos.lng]);
        trackingMapInstanceRef.current.map.panTo([driverPos.lat, driverPos.lng], { animate: true });
      }
    })();
  }, [driverPos]);

  // Cleanup Leaflet map on unmount
  React.useEffect(() => {
    return () => {
      if (trackingMapInstanceRef.current) {
        try { trackingMapInstanceRef.current.map.remove(); } catch {}
        trackingMapInstanceRef.current = null;
      }
    };
  }, []);

  const minsLeft = Math.floor(secsLeft / 60);
  const secsPart = secsLeft % 60;
  const countdownStr = secsLeft > 0
    ? `${minsLeft}:${String(secsPart).padStart(2, '0')}`
    : '0:00';
  const activeStep = liveStatusIndex(liveStatus, STATUS_STEPS);

  return (
    <main
      className={cn(
        'flex min-h-screen items-center justify-center bg-matcha-900 p-6 text-matcha-50',
      )}
    >
      {/* Background bleeds */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 top-20 h-96 w-96 rounded-full bg-accent/15 blur-3xl" />
        <div className="absolute -right-32 bottom-10 h-96 w-96 rounded-full bg-gold/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md text-center">
        {/* Check circle with ETA ring */}
        <div className="mx-auto relative flex h-[120px] w-[120px] items-center justify-center">
          {/* SVG countdown ring — only shown while countdown is active */}
          {secsLeft > 0 && (
            <svg
              className="absolute inset-0 -rotate-90"
              width="120" height="120"
              viewBox="0 0 120 120"
            >
              {/* Track */}
              <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
              {/* Progress */}
              <circle
                cx="60" cy="60" r="54"
                fill="none"
                stroke="var(--accent, #4ae68a)"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 54}`}
                strokeDashoffset={`${2 * Math.PI * 54 * (1 - Math.min(1, secsLeft / (etaMinutes * 60)))}`}
                style={{ transition: 'stroke-dashoffset 1s linear' }}
              />
            </svg>
          )}
          <div className="relative flex h-[88px] w-[88px] items-center justify-center rounded-full bg-accent/20">
            <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-accent shadow-[0_0_40px_rgba(74,230,138,0.4)] motion-safe:animate-[scaleIn_400ms_ease-out]">
              <Check className="h-9 w-9 text-matcha-900" strokeWidth={3} />
            </div>
          </div>
        </div>

        <h1 className="mt-8 font-display text-5xl font-bold leading-tight tracking-[-0.03em] md:text-6xl">
          {firstName ? `Danke, ${firstName}!` : 'Bestellt!'}
        </h1>

        <p className="mt-4 text-base leading-relaxed text-matcha-200">
          Wir haben deine Bestellung erhalten.
          {isDelivery
            ? ` In etwa ${etaMinutes} Minuten klingeln wir.`
            : ` In etwa ${etaMinutes} Minuten kannst du abholen.`}
        </p>
        {secsLeft > 0 && (
          <div className="mt-3 inline-flex items-center gap-3 rounded-2xl bg-white/5 px-5 py-3 ring-1 ring-white/10">
            <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-matcha-300">
              {isDelivery ? 'Ankunft in' : 'Abholung in'}
            </div>
            <div className="font-mono text-2xl font-bold tabular-nums text-accent">{countdownStr}</div>
          </div>
        )}

        {/* ETA-Fenster: zeigt früheste und späteste Ankunftszeit */}
        {etaWindow && (() => {
          const fmt = (iso: string) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
          const windowMinutes = Math.round((new Date(etaWindow.latest).getTime() - new Date(etaWindow.earliest).getTime()) / 60_000);
          return (
            <div className="mt-2 inline-flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2 ring-1 ring-white/10 text-[11px]">
              <span className="text-matcha-400 font-bold uppercase tracking-wider">{isDelivery ? 'Zeitfenster' : 'Abholung'}</span>
              <span className="font-mono font-bold text-matcha-100">{fmt(etaWindow.earliest)}–{fmt(etaWindow.latest)}</span>
              {windowMinutes <= 10 && (
                <span className="rounded-full bg-matcha-500/30 text-matcha-300 px-1.5 py-0.5 text-[9px] font-bold">Präzise</span>
              )}
            </div>
          );
        })()}

        {/* Fahrer-Banner: sichtbar wenn Bestellung unterwegs ist */}
        {isDelivery && liveStatus === 'unterwegs' && (
          <div className={cn(
            'mt-4 flex items-center gap-3 w-full rounded-2xl px-4 py-3 ring-1 transition-all',
            'bg-matcha-700/60 ring-accent/40',
            statusFlash && 'ring-2 ring-accent animate-pulse',
          )}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/20 font-display text-sm font-bold text-accent">
              {driverName ? driverName[0].toUpperCase() : '🛵'}
            </div>
            <div className="text-left flex-1 min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-matcha-300">Dein Fahrer</div>
              <div className="font-display text-sm font-bold truncate">
                {driverName ? `${driverName} ist unterwegs!` : 'Fahrer ist unterwegs!'}
              </div>
            </div>
            <span className="text-xl shrink-0">🛵</span>
          </div>
        )}

        {/* Live Driver Position Mini-Map — shown when driver has GPS signal */}
        {isDelivery && liveStatus === 'unterwegs' && driverPos && (
          <div className="mt-4 w-full relative overflow-hidden rounded-2xl border border-accent/20" style={{ height: 150 }}>
            <div ref={trackingMapRef} className="w-full h-full" />
            <div className="absolute top-2 left-2 z-[1000] flex items-center gap-1.5 rounded-full bg-matcha-900/80 border border-accent/30 px-2.5 py-1 backdrop-blur-sm">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
              </span>
              <span className="text-[10px] font-bold text-accent">Fahrer live</span>
              {driverPos.seconds_stale > 30 && (
                <span className="text-[9px] text-matcha-400">· {Math.floor(driverPos.seconds_stale / 60)}m alt</span>
              )}
            </div>
          </div>
        )}

        {/* Live-Status Mini-Timeline — aktualisiert sich in Echtzeit */}
        {orderId && (
          <div className={cn(
            'mt-5 w-full rounded-2xl ring-1 ring-white/10 bg-white/5 px-4 py-3 transition-all',
            statusFlash && 'ring-accent ring-2',
          )}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-matcha-300">Status</span>
              {statusFlash && (
                <span className="text-[10px] font-bold text-accent animate-pulse">Aktualisiert!</span>
              )}
            </div>
            <div className="flex items-center gap-1 relative">
              {/* Track line */}
              <div className="absolute left-3 right-3 top-3.5 h-0.5 bg-white/10 rounded-full" />
              <div
                className="absolute left-3 top-3.5 h-0.5 bg-accent rounded-full transition-all duration-700"
                style={{ width: `calc(${(activeStep / (STATUS_STEPS.length - 1)) * 100}% - 1.5rem)` }}
              />
              {STATUS_STEPS.map((step, i) => {
                const done = i < activeStep;
                const current = i === activeStep;
                const Icon = step.icon;
                return (
                  <div key={step.status} className="relative z-10 flex-1 flex flex-col items-center gap-1">
                    <div className={cn(
                      'h-7 w-7 rounded-full border-2 flex items-center justify-center transition-all',
                      done ? 'bg-accent border-accent' :
                      current ? 'bg-matcha-800 border-accent ring-2 ring-accent/30' :
                      'bg-matcha-800 border-white/20',
                    )}>
                      <Icon className={cn(
                        'h-3 w-3',
                        done || current ? 'text-accent' : 'text-matcha-400',
                      )} />
                    </div>
                    <span className={cn(
                      'text-[8px] font-bold leading-tight text-center',
                      current ? 'text-accent' : done ? 'text-matcha-200' : 'text-matcha-500',
                    )}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-matcha-800/60 px-4 py-2 ring-1 ring-white/5 backdrop-blur">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-matcha-300">Bestellnr.</span>
          <span className="font-mono text-sm font-bold text-accent">{bestellnummer}</span>
        </div>

        {/* Bestellübersicht — aufklappbar */}
        {cartItems && cartItems.length > 0 && (
          <div className="mt-4 w-full rounded-2xl bg-white/5 ring-1 ring-white/10 overflow-hidden">
            <button
              onClick={() => setItemsOpen((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-matcha-300">
                Deine Bestellung · {cartItems.reduce((s, c) => s + c.qty, 0)} Artikel
              </span>
              {itemsOpen
                ? <ChevronUp className="h-3.5 w-3.5 text-matcha-400" />
                : <ChevronDown className="h-3.5 w-3.5 text-matcha-400" />
              }
            </button>
            {itemsOpen && (
              <div className="border-t border-white/10 px-4 pb-3 pt-2 space-y-1.5">
                {cartItems.map((ci, i) => (
                  <div key={i} className="flex items-center justify-between text-[12px]">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="h-5 w-5 rounded-full bg-accent/20 text-accent flex items-center justify-center text-[10px] font-black shrink-0">
                        {ci.qty}
                      </span>
                      <span className="text-matcha-100 truncate">{ci.item.name}</span>
                    </div>
                    <span className="text-matcha-300 font-mono tabular-nums shrink-0 ml-2">
                      {((ci.item.preis + (ci.extra_preis ?? 0)) * ci.qty).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    </span>
                  </div>
                ))}
                <div className="border-t border-white/10 mt-2 pt-2 flex items-center justify-between text-[12px]">
                  <span className="font-bold text-matcha-200">Gesamt</span>
                  <span className="font-mono font-black text-accent tabular-nums">
                    {cartItems.reduce((s, c) => s + (c.item.preis + (c.extra_preis ?? 0)) * c.qty, 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        <a
          href={`/track/${bestellnummer}`}
          className={cn(
            'mt-10 inline-flex w-full items-center justify-between rounded-2xl bg-accent px-6 py-4 font-display text-lg font-bold text-matcha-900 shadow-[0_0_30px_rgba(74,230,138,0.25)] transition hover:brightness-105',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-matcha-900',
          )}
        >
          Live verfolgen
          <ArrowRight className="h-5 w-5" />
        </a>

        {/* Tracking-Link teilen */}
        <button
          type="button"
          onClick={shareTracking}
          className={cn(
            'mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 px-6 py-3 text-sm font-semibold transition',
            shared
              ? 'bg-matcha-700/60 text-accent border-accent/30'
              : 'bg-white/5 text-matcha-200 hover:bg-white/10',
          )}
        >
          {shared ? (
            <>
              <Check className="h-4 w-4 text-accent" />
              Link kopiert!
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Tracking-Link teilen
            </>
          )}
        </button>

        {/* Celebration + Bewertung bei Lieferung/Abholung abgeschlossen */}
        {['geliefert', 'abgeholt'].includes(liveStatus) && (
          <div className="mt-5 w-full rounded-2xl bg-accent/10 ring-1 ring-accent/30 px-5 py-5">
            <div className="text-3xl mb-1">🎉</div>
            <div className="font-display text-lg font-black text-accent leading-tight">
              {liveStatus === 'geliefert' ? 'Guten Appetit!' : 'Viel Freude!'}
            </div>
            <div className="text-[11px] text-matcha-300 mt-1 mb-4">
              {liveStatus === 'geliefert' ? 'Deine Bestellung ist angekommen.' : 'Danke für deinen Besuch!'}
            </div>
            {ratingSubmitted ? (
              <div className="text-center">
                <div className="flex justify-center gap-1 mb-2">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <span key={s} className={cn('text-2xl', s <= rating ? 'text-gold' : 'text-matcha-600')}>★</span>
                  ))}
                </div>
                <div className="text-[11px] text-matcha-300">Danke für deine Bewertung!</div>
              </div>
            ) : orderId ? (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-matcha-400 mb-2 text-center">
                  Wie war es?
                </div>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      onClick={() => submitRating(s)}
                      onMouseEnter={() => setRatingHover(s)}
                      onMouseLeave={() => setRatingHover(0)}
                      className="text-3xl transition-transform hover:scale-125 active:scale-110"
                      aria-label={`${s} Stern${s !== 1 ? 'e' : ''}`}
                    >
                      <span className={s <= (ratingHover || rating) ? 'text-gold' : 'text-matcha-600'}>★</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}

        <button
          type="button"
          onClick={onNewOrder}
          className="mt-4 text-sm text-matcha-300 underline-offset-4 transition hover:text-matcha-50 hover:underline"
        >
          Neue Bestellung starten
        </button>
      </div>

      <style jsx>{`
        @keyframes scaleIn {
          from { transform: scale(0.6); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </main>
  );
}
