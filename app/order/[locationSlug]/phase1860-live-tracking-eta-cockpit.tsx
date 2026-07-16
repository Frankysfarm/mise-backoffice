'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, Check, ChefHat, Clock, MapPin, Package, Sparkles } from 'lucide-react';

/**
 * Phase 1860 — Live-Tracking-ETA-Cockpit (Storefront)
 *
 * Kombiniertes Tracking-Widget für die Kundenansicht:
 *  - 4-Phasen-Stepper (Bestätigt → Kochend → Unterwegs → Geliefert)
 *  - Live-Countdown bis zur nächsten Phase / Lieferung
 *  - Fahrer-Annäherungs-Animation (3 Ringe pulsieren wenn Fahrer nahe)
 *  - Optimistische ETA mit Komfort-Botschaft
 * 30-Sek-Polling. Hydration-safe.
 */

interface TrackingData {
  status: string;
  eta_min: number | null;
  fahrer_name: string | null;
  fahrer_dist_km: number | null;
  bestellt_am: string | null;
  fertig_am: string | null;
  abgeholt_am: string | null;
  geliefert_am: string | null;
}

type Phase = 'bestellt' | 'kochend' | 'unterwegs' | 'geliefert';

const STATUS_PHASE: Record<string, Phase> = {
  neu:             'bestellt',
  in_zubereitung:  'kochend',
  fertig:          'kochend',
  unterwegs:       'unterwegs',
  geliefert:       'geliefert',
  abgeholt:        'geliefert',
  abgeschlossen:   'geliefert',
};

const PHASES: { key: Phase; label: string; sub: string; icon: React.ReactNode }[] = [
  { key: 'bestellt',  label: 'Bestätigt',   sub: 'Wir haben deine Bestellung',     icon: <Package className="h-4 w-4" /> },
  { key: 'kochend',   label: 'In Arbeit',   sub: 'Die Küche bereitet dein Essen zu', icon: <ChefHat className="h-4 w-4" /> },
  { key: 'unterwegs', label: 'Unterwegs',   sub: 'Dein Fahrer ist auf dem Weg',    icon: <Bike className="h-4 w-4" /> },
  { key: 'geliefert', label: 'Angekommen',  sub: 'Guten Appetit!',                 icon: <Check className="h-4 w-4" /> },
];

const PHASE_ORDER: Phase[] = ['bestellt', 'kochend', 'unterwegs', 'geliefert'];

function phaseIndex(p: Phase): number {
  return PHASE_ORDER.indexOf(p);
}

function fmtCountdown(sec: number): string {
  if (sec <= 0) return 'Jeden Moment';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s} Sek`;
  return `${m}:${String(s).padStart(2, '0')} Min`;
}

interface Props {
  bestellId: string | null;
  className?: string;
}

export function StorefrontPhase1860LiveTrackingETACockpit({ bestellId, className }: Props) {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<TrackingData | null>(null);
  const [tick, setTick] = useState(0);
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!bestellId) return;
    let alive = true;
    async function load() {
      try {
        const res = await fetch(`/api/delivery/storefront/order-status?bestell_id=${bestellId}`);
        if (res.ok && alive) setData(await res.json());
      } catch { /* ignore — show last known */ }
    }
    load();
    ivRef.current = setInterval(load, 30_000);
    tickRef.current = setInterval(() => setTick((t) => t + 1), 1_000);
    return () => {
      alive = false;
      if (ivRef.current) clearInterval(ivRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [bestellId]);

  const phase = useMemo((): Phase => {
    if (!data) return 'bestellt';
    return STATUS_PHASE[data.status] ?? 'bestellt';
  }, [data]);

  const phaseIdx = phaseIndex(phase);

  const remainSec = useMemo(() => {
    void tick;
    if (!data?.eta_min) return null;
    // ETA is relative to bestellt_am
    if (!data.bestellt_am) return data.eta_min * 60;
    const eta = new Date(data.bestellt_am).getTime() + data.eta_min * 60_000;
    return Math.max(0, Math.floor((eta - Date.now()) / 1000));
  }, [data, tick]);

  const driverClose = data?.fahrer_dist_km !== null && (data?.fahrer_dist_km ?? 99) < 1.5;

  if (!mounted || !bestellId) return null;

  return (
    <div className={cn(
      'rounded-2xl border bg-card shadow-sm overflow-hidden',
      driverClose && 'ring-2 ring-matcha-400',
      className,
    )}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-gradient-to-r from-matcha-50/60 to-transparent dark:from-matcha-950/30">
        <Sparkles className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-sm font-bold text-foreground">Live-Tracking</span>
        {driverClose && (
          <span className="ml-1 rounded-full bg-matcha-100 dark:bg-matcha-900/50 text-matcha-700 dark:text-matcha-300 px-2 py-0.5 text-[10px] font-black animate-pulse">
            Fahrer in der Nähe!
          </span>
        )}
        {data?.eta_min && phase !== 'geliefert' && (
          <div className="ml-auto flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-bold tabular-nums text-foreground">
              {remainSec !== null ? fmtCountdown(remainSec) : `~${data.eta_min} Min`}
            </span>
          </div>
        )}
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Phase Stepper */}
        <div className="relative">
          {/* connecting line */}
          <div className="absolute top-4 left-4 right-4 h-0.5 bg-muted" />
          <div
            className="absolute top-4 left-4 h-0.5 bg-matcha-500 transition-all duration-700"
            style={{ width: phaseIdx === 0 ? '0%' : phaseIdx === 3 ? '100%' : `${(phaseIdx / 3) * 100}%` }}
          />

          <div className="relative flex justify-between">
            {PHASES.map((p, idx) => {
              const done    = idx < phaseIdx;
              const current = idx === phaseIdx;
              return (
                <div key={p.key} className="flex flex-col items-center gap-1.5 w-16">
                  {/* Dot */}
                  <div className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-500',
                    done    ? 'border-matcha-500 bg-matcha-500 text-white'                               : '',
                    current ? 'border-matcha-500 bg-matcha-50 dark:bg-matcha-950 text-matcha-600 scale-110' : '',
                    !done && !current ? 'border-muted bg-muted/30 text-muted-foreground'                 : '',
                  )}>
                    {done ? <Check className="h-3.5 w-3.5" /> : p.icon}
                  </div>
                  {/* Label */}
                  <span className={cn(
                    'text-[9px] font-bold text-center leading-tight',
                    (done || current) ? 'text-foreground' : 'text-muted-foreground',
                  )}>
                    {p.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Current phase info */}
        <div className={cn(
          'rounded-xl border px-3 py-2.5 text-center transition-all',
          phase === 'geliefert'
            ? 'border-matcha-200 bg-matcha-50 dark:bg-matcha-950/30 dark:border-matcha-800'
            : 'border-border bg-muted/20',
        )}>
          <p className="text-xs font-semibold text-foreground">
            {PHASES[phaseIdx]?.sub ?? ''}
          </p>
          {data?.fahrer_name && phase === 'unterwegs' && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Fahrer: <span className="font-bold text-foreground">{data.fahrer_name}</span>
              {data.fahrer_dist_km !== null && ` · ${data.fahrer_dist_km.toFixed(1)} km entfernt`}
            </p>
          )}
        </div>

        {/* Driver proximity rings */}
        {phase === 'unterwegs' && driverClose && (
          <div className="flex justify-center">
            <div className="relative flex items-center justify-center">
              <div className="absolute h-16 w-16 rounded-full border-2 border-matcha-400 opacity-30 animate-ping" />
              <div className="absolute h-12 w-12 rounded-full border-2 border-matcha-400 opacity-50 animate-ping animation-delay-150" />
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-matcha-500 text-white shadow-lg">
                <Bike className="h-5 w-5" />
              </div>
            </div>
          </div>
        )}

        {/* ETA message */}
        {phase !== 'geliefert' && data?.eta_min && (
          <div className="flex items-center gap-2 rounded-xl bg-muted/30 px-3 py-2">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground">
              {remainSec !== null && remainSec <= 0
                ? 'Dein Essen sollte jeden Moment ankommen!'
                : `Voraussichtliche Lieferung in ${remainSec !== null ? `${Math.ceil(remainSec / 60)} Min` : `${data.eta_min} Min`}`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
