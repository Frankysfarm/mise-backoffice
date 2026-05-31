'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, Check, ChefHat, Package, ShoppingBag, Truck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Props = {
  bestellnummer: string;
  name?: string;
  etaMinutes: number;
  isDelivery: boolean;
  onNewOrder: () => void;
  orderId?: string;
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

export function SuccessState({ bestellnummer, name, etaMinutes, isDelivery, onNewOrder, orderId }: Props) {
  const firstName = name?.split(' ')[0];
  const supabase = React.useMemo(() => createClient(), []);
  const STATUS_STEPS: readonly StatusStep[] = isDelivery ? DELIVERY_STEPS : PICKUP_STEPS;

  const [secsLeft, setSecsLeft] = React.useState(etaMinutes * 60);
  const [liveStatus, setLiveStatus] = React.useState<string>('bestätigt');
  const [statusFlash, setStatusFlash] = React.useState(false);

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
        (payload: { new: { status?: string } }) => {
          const newStatus = payload.new?.status;
          if (newStatus && newStatus !== liveStatus) {
            setLiveStatus(newStatus);
            setStatusFlash(true);
            setTimeout(() => setStatusFlash(false), 3000);
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

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
