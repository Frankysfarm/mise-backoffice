'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Bike, Clock, MapPin, ChevronDown, ChevronUp, Zap } from 'lucide-react';

/**
 * Phase 955 — Live-ETA Fahrer-Tracking (Storefront)
 *
 * Zeigt dem Kunden nach Bestellabschluss:
 * - Dynamische ETA mit Live-Countdown (SSE-ready, fallback polling)
 * - Fahrer-Name + Status-Phase (Kochend → Bereit → Unterwegs → Gleich da)
 * - Fahrer-Nähe-Puls wenn < 500m entfernt
 */

interface TrackingData {
  orderId: string;
  eta_min: number;
  fahrer_name?: string | null;
  fahrer_entfernung_m?: number | null;
  phase: 'kochend' | 'bereit' | 'abgeholt' | 'unterwegs' | 'nah';
  generatedAt: string;
}

interface Props {
  orderId?: string | null;
  initialEtaMin?: number;
}

const PHASE_INFO: Record<TrackingData['phase'], { label: string; emoji: string; color: string }> = {
  kochend: { label: 'Wird zubereitet', emoji: '👨‍🍳', color: 'text-amber-600 dark:text-amber-400' },
  bereit: { label: 'Bereit zur Abholung', emoji: '📦', color: 'text-blue-600 dark:text-blue-400' },
  abgeholt: { label: 'Fahrer hat abgeholt', emoji: '🛵', color: 'text-matcha-600 dark:text-matcha-400' },
  unterwegs: { label: 'Unterwegs zu dir', emoji: '🚴', color: 'text-matcha-600 dark:text-matcha-400' },
  nah: { label: 'Fast da!', emoji: '📍', color: 'text-matcha-600 dark:text-matcha-400' },
};

function CountdownRing({ etaMin }: { etaMin: number }) {
  const clamped = Math.max(0, etaMin);
  const maxMin = 45;
  const pct = 1 - Math.min(clamped / maxMin, 1);
  const radius = 36;
  const circ = 2 * Math.PI * radius;
  const dash = pct * circ;
  const color = clamped <= 5 ? '#22c55e' : clamped <= 15 ? '#f59e0b' : '#6b7280';

  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg className="h-24 w-24 -rotate-90" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={radius} fill="none" strokeWidth="5" className="stroke-muted" />
        <circle
          cx="44" cy="44" r={radius} fill="none" strokeWidth="5"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          stroke={color}
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-black tabular-nums text-foreground">
          {clamped > 0 ? `${clamped}` : '🎉'}
        </span>
        {clamped > 0 && <span className="text-[10px] font-semibold text-muted-foreground">Min</span>}
      </div>
    </div>
  );
}

export function Phase955LiveEtaFahrerTracking({ orderId, initialEtaMin = 25 }: Props) {
  const [data, setData] = useState<TrackingData | null>(null);
  const [etaMin, setEtaMin] = useState(initialEtaMin);
  const [open, setOpen] = useState(true);
  const [pulsing, setPulsing] = useState(false);

  const load = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await fetch(`/api/delivery/order/eta-tracking?order_id=${orderId}`);
      if (res.ok) {
        const d: TrackingData = await res.json();
        setData(d);
        setEtaMin(d.eta_min);
        if (d.phase === 'nah') setPulsing(true);
      }
    } catch {
      // keep existing data
    }
  }, [orderId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  // Live-Countdown: jede Minute um 1 Min verringern
  useEffect(() => {
    if (etaMin <= 0) return;
    const id = setInterval(() => setEtaMin((m) => Math.max(0, m - 1)), 60_000);
    return () => clearInterval(id);
  }, [etaMin]);

  const phase = data?.phase ?? 'kochend';
  const phaseInfo = PHASE_INFO[phase];
  const fahrerName = data?.fahrer_name;
  const entfernungM = data?.fahrer_entfernung_m;

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden transition-all',
      pulsing ? 'border-matcha-400 dark:border-matcha-600 shadow-md shadow-matcha-500/20' : 'border-border',
      'bg-card',
    )}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-muted/20 transition text-left"
      >
        <Bike className={cn('h-4 w-4 shrink-0', pulsing ? 'text-matcha-500 animate-bounce' : 'text-matcha-500')} />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Live-Tracking
        </span>
        {pulsing && (
          <span className="flex items-center gap-1 rounded-full bg-matcha-100 dark:bg-matcha-900/40 px-2 py-0.5 text-[10px] font-black text-matcha-700 dark:text-matcha-300">
            <Zap className="h-2.5 w-2.5" />
            Fast da!
          </span>
        )}
        <span className="ml-auto text-muted-foreground">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-5">
          <div className="flex items-center gap-5">
            <CountdownRing etaMin={etaMin} />

            <div className="flex-1 space-y-3 min-w-0">
              {/* Phase */}
              <div>
                <p className={cn('text-sm font-bold flex items-center gap-1.5', phaseInfo.color)}>
                  <span>{phaseInfo.emoji}</span>
                  <span>{phaseInfo.label}</span>
                </p>
                {etaMin > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Voraussichtlich in <span className="font-bold text-foreground">{etaMin} Minuten</span>
                  </p>
                )}
                {etaMin === 0 && (
                  <p className="text-xs font-semibold text-matcha-600 dark:text-matcha-400 mt-0.5">
                    Deine Bestellung ist angekommen!
                  </p>
                )}
              </div>

              {/* Fahrer-Info */}
              {fahrerName && (
                <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-matcha-100 dark:bg-matcha-900/40 text-sm font-black text-matcha-700 dark:text-matcha-300 shrink-0">
                    {fahrerName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{fahrerName}</p>
                    <p className="text-[10px] text-muted-foreground">Dein Fahrer</p>
                  </div>
                  {entfernungM != null && (
                    <span className="ml-auto flex items-center gap-0.5 text-[10px] font-semibold text-muted-foreground shrink-0">
                      <MapPin className="h-2.5 w-2.5" />
                      {entfernungM < 1000 ? `${Math.round(entfernungM)}m` : `${(entfernungM / 1000).toFixed(1)}km`}
                    </span>
                  )}
                </div>
              )}

              {/* Phasen-Schritte */}
              <div className="flex items-center gap-1">
                {(['kochend', 'abgeholt', 'unterwegs', 'nah'] as TrackingData['phase'][]).map((p, i) => {
                  const phaseOrder = ['kochend', 'bereit', 'abgeholt', 'unterwegs', 'nah'];
                  const currentIdx = phaseOrder.indexOf(phase);
                  const stepIdx = phaseOrder.indexOf(p);
                  const done = stepIdx < currentIdx;
                  const active = stepIdx === currentIdx;
                  return (
                    <div key={p} className="flex items-center gap-1 flex-1">
                      <div className={cn(
                        'h-2 flex-1 rounded-full transition-all',
                        done || active ? 'bg-matcha-500' : 'bg-muted',
                      )} />
                      {i < 3 && <div className={cn('h-1.5 w-1.5 rounded-full shrink-0', done ? 'bg-matcha-500' : 'bg-muted')} />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {!orderId && (
            <p className="mt-3 text-center text-[10px] text-muted-foreground">
              Echtzeit-Tracking nach Bestellabschluss verfügbar
            </p>
          )}
        </div>
      )}
    </div>
  );
}
