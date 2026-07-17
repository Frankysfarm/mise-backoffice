'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Bike, CheckCircle, Clock, MapPin, Package, Zap } from 'lucide-react';

/**
 * Phase 2060 — Dynamische ETA & Live-Tracking
 *
 * Kombiniert für den Kunden sichtbar:
 * - Live-Tracking Status (Bestellung → Küche → Fahrer → Lieferung)
 * - Dynamische ETA mit Countdown
 * - Fahrer-Name wenn unterwegs
 * - Animierter Fortschrittsbalken
 *
 * Nutzt /api/delivery/public/order-status?order_id= + Fallback auf Avg-ETA.
 */

type Phase = 'bestellt' | 'zubereitung' | 'bereit' | 'unterwegs' | 'geliefert';

interface OrderStatus {
  phase: Phase;
  eta_min: number | null;
  eta_label: string | null;
  driver_name: string | null;
  progress_pct: number;
}

interface Props {
  orderId?: string | null;
  locationSlug: string;
  className?: string;
}

const PHASE_CONFIG: Record<Phase, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  step: number;
}> = {
  bestellt:    { label: 'Bestellung eingegangen',  icon: Package,      color: 'text-matcha-600', bg: 'bg-matcha-50',  step: 1 },
  zubereitung: { label: 'Wird zubereitet',          icon: Zap,          color: 'text-amber-600',  bg: 'bg-amber-50',   step: 2 },
  bereit:      { label: 'Bereit zur Abholung',      icon: CheckCircle,  color: 'text-blue-600',   bg: 'bg-blue-50',    step: 3 },
  unterwegs:   { label: 'Fahrer ist unterwegs',     icon: Bike,         color: 'text-matcha-700', bg: 'bg-matcha-100', step: 4 },
  geliefert:   { label: 'Geliefert!',               icon: CheckCircle,  color: 'text-matcha-700', bg: 'bg-matcha-50',  step: 5 },
};

const STEPS: Phase[] = ['bestellt', 'zubereitung', 'unterwegs', 'geliefert'];

function mapApiPhase(apiPhase: string | null | undefined): Phase {
  if (!apiPhase) return 'bestellt';
  const p = apiPhase.toLowerCase();
  if (p.includes('gelief') || p === 'delivered' || p === 'abgeschlossen') return 'geliefert';
  if (p.includes('unterwegs') || p === 'on_route' || p === 'dispatched') return 'unterwegs';
  if (p.includes('bereit') || p === 'ready' || p === 'fertig') return 'bereit';
  if (p.includes('zubereit') || p === 'in_preparation' || p === 'cooking' || p.includes('zubereitung') || p === 'accepted' || p === 'confirmed' || p === 'bestätigt') return 'zubereitung';
  return 'bestellt';
}

function fetchOrderStatus(orderId: string): Promise<OrderStatus | null> {
  return fetch(`/api/delivery/public/order-status?order_id=${orderId}`)
    .then((r) => r.ok ? r.json() : null)
    .then((d) => {
      if (!d) return null;
      const phase = mapApiPhase(d.phase ?? d.status);
      return {
        phase,
        eta_min: d.eta_min ?? d.etaMin ?? null,
        eta_label: d.eta_label ?? d.displayLabel ?? null,
        driver_name: d.driver_name ?? d.driverName ?? null,
        progress_pct: d.progress_pct ?? d.progressPct ?? PHASE_CONFIG[phase].step * 20,
      };
    })
    .catch(() => null);
}

export function StorefrontPhase2060DynamischeEtaLiveTracking({ orderId, locationSlug, className }: Props) {
  const [status, setStatus] = useState<OrderStatus | null>(null);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    if (!orderId) return;
    const s = await fetchOrderStatus(orderId);
    if (s) setStatus(s);
  }, [orderId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [load]);

  // Countdown-Ticker
  useEffect(() => {
    if (!status || status.phase === 'geliefert') return;
    const iv = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(iv);
  }, [status?.phase]);

  if (!orderId || !status) return null;

  const cfg = PHASE_CONFIG[status.phase];
  const PhaseIcon = cfg.icon;

  const etaLabel = status.eta_label
    ?? (status.eta_min !== null ? `~${status.eta_min} Min` : null);

  const pct = Math.max(5, Math.min(100, status.progress_pct));
  const currentStep = PHASE_CONFIG[status.phase].step;

  if (status.phase === 'geliefert') {
    return (
      <div className={cn('rounded-2xl border border-matcha-200 bg-matcha-50 p-4 text-center', className)}>
        <div className="flex justify-center mb-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-matcha-600 text-white">
            <CheckCircle className="h-6 w-6" />
          </div>
        </div>
        <div className="text-base font-black text-matcha-700">Geliefert!</div>
        <div className="text-xs text-matcha-600 mt-0.5">Guten Appetit!</div>
      </div>
    );
  }

  return (
    <div className={cn('rounded-2xl border bg-card overflow-hidden', className)}>
      {/* Header */}
      <div className={cn('flex items-center gap-3 px-4 py-3', cfg.bg)}>
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white', cfg.color)}>
          <PhaseIcon className="h-4.5 w-4.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className={cn('text-sm font-black', cfg.color)}>{cfg.label}</div>
          {etaLabel && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
              <Clock className="h-3 w-3" />
              <span>Noch ca. <strong>{etaLabel}</strong></span>
            </div>
          )}
          {status.driver_name && status.phase === 'unterwegs' && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
              <Bike className="h-3 w-3" />
              <span>{status.driver_name} ist unterwegs</span>
            </div>
          )}
        </div>
      </div>

      {/* Progress-Balken */}
      <div className="px-4 py-2 border-t">
        <div className="flex items-center justify-between text-[9px] font-bold uppercase text-muted-foreground mb-1.5">
          {STEPS.map((s, i) => (
            <span key={s} className={cn(
              PHASE_CONFIG[s].step <= currentStep ? 'text-matcha-700' : '',
            )}>
              {s === 'bestellt' ? 'Bestellt' : s === 'zubereitung' ? 'Küche' : s === 'unterwegs' ? 'Unterwegs' : 'Geliefert'}
            </span>
          ))}
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-matcha-500 transition-all duration-1000"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Schritt-Indikatoren */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-1">
          {STEPS.map((s, i) => {
            const stepNum = PHASE_CONFIG[s].step;
            const done = stepNum < currentStep;
            const active = stepNum === currentStep;
            return (
              <div key={s} className="flex items-center flex-1">
                <div className={cn(
                  'h-2 w-2 rounded-full shrink-0',
                  done ? 'bg-matcha-500' : active ? 'bg-matcha-500 animate-pulse' : 'bg-muted',
                )} />
                {i < STEPS.length - 1 && (
                  <div className={cn('flex-1 h-0.5 mx-0.5', done ? 'bg-matcha-400' : 'bg-muted')} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
